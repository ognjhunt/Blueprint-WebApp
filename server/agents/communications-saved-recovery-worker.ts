import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { authAdmin, dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { CommunicationsAgentsAPI } from "./communications-api";
import { communicationsDigest } from "./communications-contract";
import { CommunicationsStore } from "./communications-store";
import { recoverCommunicationsDraftInProcess } from "./communications-inprocess-recovery";
import { sampleCommunicationsRecoveryMemory, assertCommunicationsRecoveryHeadroom, COMMUNICATIONS_RECOVERY_HEADROOM_BYTES } from "./communications-recovery-memory";
import { SAVED_RECOVERY_CONTROLS, SAVED_RECOVERY_REQUESTS, SAVED_RECOVERY_WORKER, assertSavedRecoveryRequest, assertSavedRecoveryWorker,
  SAVED_RECOVERY_WINDOW_MS, type SavedRecoveryReadiness, type SavedRecoveryRequest } from "./communications-saved-recovery-queue";
import { readExistingResearchSnapshot } from "./communications-research";
import { requireFounderDraftCapability, founderDraftRuntimeConfigured } from "./communications-oauth-store";
import { verifyFounderMailbox, readFounderThread } from "./communications-gmail";
import { isEmailSuppressed, recordEmailSuppression } from "../utils/email-suppression";
import type { CommunicationsDependencies } from "./communications-worker";

const safeCode = (error: unknown) => error instanceof Error && /^communications_[a-z_]+$/.test(error.message) ? error.message : "communications_saved_recovery_not_verified";
export function savedRecoveryWorkerReadiness(now = Date.now()): SavedRecoveryReadiness {
  const memory = sampleCommunicationsRecoveryMemory("existing_background_worker_idle");
  let headroomAvailable = false;
  try { assertCommunicationsRecoveryHeadroom(memory); headroomAvailable = true; } catch { /* Never discount cache or substitute Web RSS. */ }
  const controls = Object.fromEntries(SAVED_RECOVERY_CONTROLS.map(key => [key, process.env[key] === "false" ? "literal_off" : process.env[key] === undefined ? "missing" : "other"])) as SavedRecoveryReadiness["controls"];
  return { version: "existing-worker-saved-recovery-v1", executionPlacement: "existing_background_worker", sourceCommit: process.env.RENDER_GIT_COMMIT ?? null,
    serviceId: process.env.RENDER_SERVICE_ID ?? null, ownerUid: process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim() ?? null,
    observedAtMs: now, providerKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()), founderBindingConfigured: founderDraftRuntimeConfigured(),
    controls, outreachControlsOff: SAVED_RECOVERY_CONTROLS.every(key => controls[key] === "literal_off"), memory,
    headroomAvailable, headroomReserveBytes: COMMUNICATIONS_RECOVERY_HEADROOM_BYTES };
}
type Options = { now?: () => number; readiness?: () => SavedRecoveryReadiness; assertOwner?: (uid: string) => Promise<void>;
  capability?: () => Promise<void>; dependencies?: (request: SavedRecoveryRequest, signal: AbortSignal, assertCurrent: () => Promise<void>) => CommunicationsDependencies };
async function assertOwner(uid: string) {
  if (!authAdmin || uid !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim()) throw Error("communications_saved_recovery_owner_changed");
  const owner = await authAdmin.getUser(uid);
  if (owner.disabled || !(owner.customClaims?.admin === true || owner.customClaims?.ops === true
    || owner.customClaims?.role === "admin" || owner.customClaims?.role === "ops"
    || Array.isArray(owner.customClaims?.roles) && owner.customClaims.roles.some((role: unknown) => role === "admin" || role === "ops"))) throw Error("communications_saved_recovery_owner_changed");
}
function nativeDependencies(db: Firestore, request: SavedRecoveryRequest, signal: AbortSignal, assertCurrent: () => Promise<void>): CommunicationsDependencies {
  let gets = 0;
  const api = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY, allowPaidInference: false,
    reviewedSavedOutputDigest: request.input.rawOutputSha256, fetch: async (url, init: RequestInit = {}) => {
      await assertCurrent();
      const target = new URL(String(url)), base = `/v1/agents/sessions/${request.input.sessionId}`;
      if ((init.method ?? "GET") !== "GET" || target.origin !== "https://api.openai.com" || ![base, `${base}/turns`, `${base}/items`].includes(target.pathname)
        || ++gets > 32) throw Error("communications_saved_recovery_get_only_boundary");
      const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.any([signal, init.signal ?? new AbortController().signal, AbortSignal.timeout(30000)]) });
      if (!response.body) return response;
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
      try { for (;;) { const next = await reader.read(); if (next.done) break;
        bytes += next.value.length; if (bytes > 262144) throw Error("communications_saved_recovery_response_too_large"); chunks.push(next.value); }
      } finally { await reader.cancel(); }
      await assertCurrent();
      return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
    } });
  return { store: new CommunicationsStore(db), api, now: Date.now,
    readResearch: async (date, admissionId) => { await assertCurrent(); return readExistingResearchSnapshot(db, date, admissionId); },
    verifyMailbox: async () => { await assertCurrent(); const result = await verifyFounderMailbox(); await assertCurrent(); return result; },
    readThread: async id => { await assertCurrent(); const result = await readFounderThread(id); await assertCurrent(); return result; },
    isSuppressed: async email => { await assertCurrent(); return isEmailSuppressed(email, "growth_campaign"); },
    suppress: async (email, reason) => { await assertCurrent(); return recordEmailSuppression({ email, reason, scope: "all", source: "communications_reply" }); } };
}
/** Runs inside the existing worker, with no general intake, paid draft, copy or
 * send callback. Each intent needs its own current founder action and pins. */
export async function executeSavedRecoveryRequest(db: Firestore, jobId: string, signal: AbortSignal, options: Options = {}) {
  const now = options.now ?? Date.now, readiness = options.readiness ?? (() => savedRecoveryWorkerReadiness(now()));
  const ref = db.doc(`${SAVED_RECOVERY_REQUESTS}/${jobId}`), token = randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const request = (await tx.get(ref)).data() as SavedRecoveryRequest | undefined;
    if (!request || request.state !== "queued") return null;
    if (request.version !== "owner-saved-recovery-request-v1" || request.input.jobId !== jobId
      || !Number.isSafeInteger(request.generation) || request.generation < 1 || !Number.isSafeInteger(request.requestedAtMs)
      || request.requestedAtMs > now() || request.expiresAtMs !== request.requestedAtMs + SAVED_RECOVERY_WINDOW_MS
      || request.requestDigest !== communicationsDigest({ input: request.input, actorUid: request.actorUid })) throw Error("communications_saved_recovery_intent_binding_changed");
    if (request.cancelRequested || now() >= request.expiresAtMs) {
      tx.set(ref, { ...request, state: "cancelled", settledAtMs: now() }); return null;
    }
    const runtime = readiness();
    assertSavedRecoveryWorker(runtime, request.input.expectedSourceCommit, request.actorUid, now());
    const next: SavedRecoveryRequest = { ...request, state: "running", executionToken: token, executionServiceId: runtime.serviceId };
    tx.set(ref, next); return next;
  });
  if (!claimed) return;
  const controller = new AbortController(), abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort();
  const deadline = setTimeout(abort, Math.max(1, claimed.expiresAtMs - now()));
  const checkRecord = (record: unknown) => {
    if (controller.signal.aborted) throw Error("communications_saved_recovery_request_cancelled");
    assertSavedRecoveryRequest(record as SavedRecoveryRequest, claimed, token, now());
  };
  const check = async () => {
    checkRecord((await ref.get()).data());
    assertSavedRecoveryWorker(readiness(), claimed.input.expectedSourceCommit, claimed.actorUid, now());
    await (options.assertOwner ?? assertOwner)(claimed.actorUid);
    if (controller.signal.aborted) throw Error("communications_saved_recovery_request_cancelled");
  };
  let monitor: Promise<void> | undefined;
  const poll = setInterval(() => { if (!monitor) monitor = check().catch(abort).finally(() => { monitor = undefined; }); }, 1000);
  poll.unref(); deadline.unref();
  let result: SavedRecoveryRequest["result"], error: string | undefined;
  try {
    await check(); await (options.capability ?? requireFounderDraftCapability)(); await check();
    const deps = (options.dependencies ?? ((r, s, c) => nativeDependencies(db, r, s, c)))(claimed, controller.signal, check);
    const recovered = await recoverCommunicationsDraftInProcess(claimed.input, claimed.actorUid, deps, { signal: controller.signal,
      sample: stage => { const runtime = readiness(); assertSavedRecoveryWorker(runtime, claimed.input.expectedSourceCommit, claimed.actorUid, now()); return { ...runtime.memory, stage }; },
      authority: { path: ref.path, assertRecord: checkRecord, assertCurrent: check } });
    result = { state: recovered.state, ledgerId: "ledgerId" in recovered && typeof recovered.ledgerId === "string" ? recovered.ledgerId : null,
      sent: false, gmailDraftCreated: false, sessionCreated: false };
  } catch (caught) { error = safeCode(caught); }
  finally { clearInterval(poll); clearTimeout(deadline); signal.removeEventListener("abort", abort); await monitor; }
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data() as SavedRecoveryRequest | undefined;
    // Exact receipt only: a subsequent generation or cancellation cannot be
    // overwritten by a stale completion. Never expire-steal a running intent.
    if (!current || current.generation !== claimed.generation || current.requestDigest !== claimed.requestDigest || current.executionToken !== token || current.state !== "running") throw Error("communications_saved_recovery_settlement_changed");
    tx.set(ref, { ...current, state: result && ["pending_approval", "no_op"].includes(result.state) ? "completed" : current.cancelRequested || controller.signal.aborted ? "cancelled" : "failed",
      settledAtMs: now(), ...(result ? { result } : {}), ...(error ? { error } : {}) });
  });
}
/** Only server/worker.ts starts this poller; Web neither starts another process
 * nor gains the worker's provider/Gmail credentials. Shutdown drains its lap. */
export function startSavedRecoveryWorker(options: { db?: Firestore; worker?: Options } = {}): () => Promise<void> {
  const db = options.db ?? dbAdmin;
  if (!db) return async () => undefined;
  const controller = new AbortController(); let active: Promise<void> | undefined;
  const tick = async () => {
    if (controller.signal.aborted) return;
    await db.doc(SAVED_RECOVERY_WORKER).set((options.worker?.readiness ?? savedRecoveryWorkerReadiness)());
    const queued = await db.collection(SAVED_RECOVERY_REQUESTS).where("state", "==", "queued").limit(1).get();
    if (controller.signal.aborted) return;
    if (queued.docs[0]) await executeSavedRecoveryRequest(db, queued.docs[0].id, controller.signal, options.worker);
  };
  const start = () => { if (!active && !controller.signal.aborted) active = tick().catch(error => logger.warn({ code: safeCode(error) }, "Saved-output recovery waits for its exact owner intent and worker readiness")).finally(() => { active = undefined; }); };
  const timer = setInterval(start, 10000); timer.unref(); start();
  return async () => { controller.abort(); clearInterval(timer); await active; };
}
