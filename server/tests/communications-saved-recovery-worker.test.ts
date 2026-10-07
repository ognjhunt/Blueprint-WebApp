// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ owner: vi.fn(), readResearch: vi.fn(), mailbox: vi.fn(), readThread: vi.fn(), capability: vi.fn(), suppressed: vi.fn(), suppress: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: { getUser: native.owner }, default: {} }));
vi.mock("../agents/communications-research", async original => ({ ...await original<typeof import("../agents/communications-research")>(), readExistingResearchSnapshot: native.readResearch }));
vi.mock("../agents/communications-gmail", async original => ({ ...await original<typeof import("../agents/communications-gmail")>(), verifyFounderMailbox: native.mailbox, readFounderThread: native.readThread }));
vi.mock("../agents/communications-oauth-store", async original => ({ ...await original<typeof import("../agents/communications-oauth-store")>(), requireFounderDraftCapability: native.capability }));
vi.mock("../utils/email-suppression", async original => ({ ...await original<typeof import("../utils/email-suppression")>(), isEmailSuppressed: native.suppressed, recordEmailSuppression: native.suppress }));
import { savedRecoveryFixture } from "./fixtures/communications-saved-recovery";
import { communicationsMemoryCounters, COMMUNICATIONS_RECOVERY_HEADROOM_BYTES } from "../agents/communications-recovery-memory";
import { enqueueSavedRecovery, cancelSavedRecovery, SAVED_RECOVERY_REQUESTS, SAVED_RECOVERY_WORKER, SAVED_RECOVERY_CONTROLS, SAVED_RECOVERY_WINDOW_MS,
  type SavedRecoveryReadiness } from "../agents/communications-saved-recovery-queue";
import { executeSavedRecoveryRequest, savedRecoveryWorkerReadiness, startSavedRecoveryWorker } from "../agents/communications-saved-recovery-worker";
import { COMMUNICATIONS_WORKER_LAP_PATH } from "../agents/communications-release-lease";
import { communicationsDigest } from "../agents/communications-contract";

const memory = (now: number) => ({ stage: "synthetic_existing_worker", observedAt: new Date(now).toISOString(), pid: 555, rss: 180000000, heapUsed: 60000000,
  external: 4000000, processLifetimeMaxRss: 185000000, cgroup: { current: 300000000, limit: 536870912,
    counters: communicationsMemoryCounters("anon 180000000\nfile 80000000\nkernel 40000000\nshmem 0\nfile_mapped 10000000\nfile_dirty 0\nfile_writeback 0\ninactive_file 40000000\nactive_file 40000000\nunevictable 0") } });
async function setup() {
  const f = await savedRecoveryFixture(), now = f.deps.now();
  const readiness: SavedRecoveryReadiness = { version: "existing-worker-saved-recovery-v1", executionPlacement: "existing_background_worker",
    sourceCommit: f.input.expectedSourceCommit, serviceId: "existing-worker-service", ownerUid: "synthetic-owner", observedAtMs: now,
    providerKeyConfigured: true, founderBindingConfigured: true, controls: Object.fromEntries(SAVED_RECOVERY_CONTROLS.map(key => [key, "literal_off"])),
    outreachControlsOff: true, headroomAvailable: true, headroomReserveBytes: COMMUNICATIONS_RECOVERY_HEADROOM_BYTES, memory: memory(now) };
  await f.db.doc(SAVED_RECOVERY_WORKER).set(readiness);
  const options = { now: f.deps.now, readiness: () => readiness, assertOwner: vi.fn(async () => {}), capability: vi.fn(async () => {}), dependencies: vi.fn(() => f.deps) };
  const path = `${SAVED_RECOVERY_REQUESTS}/${f.input.jobId}`;
  return { ...f, readiness, options, requestPath: path, enqueue: () => enqueueSavedRecovery(f.db, f.input, "synthetic-owner", now),
    execute: (signal = new AbortController().signal) => executeSavedRecoveryRequest(f.db, f.input.jobId, signal, options) };
}
beforeEach(() => {
  for (const mock of Object.values(native)) mock.mockReset();
  vi.stubEnv("RENDER_GIT_COMMIT", "a".repeat(40));
  for (const flag of SAVED_RECOVERY_CONTROLS) vi.stubEnv(flag, "false");
  // The Web-side intent has no provider or Gmail runtime credential.
  vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("existing worker placement for explicit saved-output recovery", () => {
  it("Web queues without a provider key; real consumer uses the worker only and retains unknown liabilities", async () => {
    const f = await setup(), before = structuredClone(f.db.records.get(f.budgetPath));
    const request = await f.enqueue(); expect(request).toMatchObject({ state: "queued", generation: 1 });
    expect(f.requests).toHaveLength(0); expect(f.db.records.get(f.path)).toEqual(f.original);
    await f.execute();
    expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "completed", generation: 1, executionServiceId: "existing-worker-service",
      result: { state: "pending_approval", ledgerId: `communications_${f.input.jobId}`, sent: false, gmailDraftCreated: false, sessionCreated: false } });
    expect(f.requests).toHaveLength(3); expect(f.db.records.get(f.budgetPath)).toEqual(before);
    expect(f.db.records.get(f.path).savedOutputRecovery.ownerAction.requestDigest).toBe(communicationsDigest(f.input));
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH)).toMatchObject({ phase: "complete", lease: { until: 0 } });
    expect(await f.enqueue()).toMatchObject({ state: "completed", generation: 1 }); await f.execute(); expect(f.requests).toHaveLength(3);
  });
  it("the native adapter authenticates only with the worker key and performs three original-session GETs with no paid hook", async () => {
    const f = await setup(); await f.enqueue();
    expect(process.env.OPENAI_API_KEY).toBe(""); expect(f.requests).toHaveLength(0);
    vi.stubEnv("OPENAI_API_KEY", "synthetic-worker-existing-binding"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID", "synthetic-owner");
    vi.spyOn(Date, "now").mockReturnValue(f.deps.now());
    native.owner.mockResolvedValue({ disabled: false, customClaims: { admin: true } }); native.capability.mockResolvedValue(undefined);
    native.readResearch.mockResolvedValue(f.snapshot); native.mailbox.mockResolvedValue({}); native.readThread.mockResolvedValue(f.thread); native.suppressed.mockResolvedValue(false);
    const originalTransport = (f.deps.api as any).options.fetch;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer synthetic-worker-existing-binding" });
      expect(init?.method ?? "GET").toBe("GET"); expect(init?.redirect).toBe("error"); return originalTransport(url, init);
    });
    await executeSavedRecoveryRequest(f.db, f.input.jobId, new AbortController().signal, { now: f.deps.now, readiness: f.options.readiness });
    expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "completed", result: { state: "pending_approval" } });
    expect(fetchMock).toHaveBeenCalledTimes(3); expect(native.capability).toHaveBeenCalledTimes(1); expect(native.owner).toHaveBeenCalled();
    expect(native.suppress).not.toHaveBeenCalled(); expect(f.db.records.get(f.budgetPath)).toEqual({ activeAdmissionId: "original-unknown-liability", actualModelMicros: 14755 });
  });
  it("the existing-worker poller publishes readiness and drains its exact active recovery on shutdown", async () => {
    const f = await setup(); await f.enqueue();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
    const original = f.deps.api.reconcileSaved.bind(f.deps.api);
    vi.spyOn(f.deps.api, "reconcileSaved").mockImplementation(async (...args) => { entered(); await held; return original(...args); });
    const stop = startSavedRecoveryWorker({ db: f.db, worker: f.options }); await started;
    expect(f.db.records.get(SAVED_RECOVERY_WORKER)).toEqual(f.readiness);
    let drained = false; const stopping = stop().then(() => { drained = true; }); await Promise.resolve(); expect(drained).toBe(false);
    release(); await stopping; expect(drained).toBe(true);
    expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "cancelled" });
    expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH)).toMatchObject({ phase: "complete", lease: { until: 0 } });
  });
  it("checks cancellation again when Firestore reruns a draft transaction after a conflict", async () => {
    const f = await setup(); await f.enqueue();
    const run = f.db.runTransaction.bind(f.db); let conflicted = false;
    f.db.runTransaction = async (fn: any) => {
      try { return await run((tx: any) => fn({ ...tx, get: async (ref: any) => {
        const snap = await tx.get(ref);
        if (!conflicted && ref.path.startsWith("action_ledger/")) {
          conflicted = true; f.db.records.set(f.requestPath, { ...f.db.records.get(f.requestPath), cancelRequested: true });
          throw Error("synthetic_transaction_conflict");
        }
        return snap;
      } })); } catch (error) { if ((error as Error).message !== "synthetic_transaction_conflict") throw error; return run(fn); }
    };
    await f.execute(); expect(conflicted).toBe(true); expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
    expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "cancelled" });
  });
  it.each(["stale", "source", "provider", "binding", "memory", "controls", "owner"])("rejects %s worker readiness without touching the job", async kind => {
    const f = await setup();
    if (kind === "stale") f.readiness.observedAtMs -= 45001;
    if (kind === "source") f.readiness.sourceCommit = "b".repeat(40);
    if (kind === "provider") f.readiness.providerKeyConfigured = false;
    if (kind === "binding") f.readiness.founderBindingConfigured = false;
    if (kind === "memory") f.readiness.memory.cgroup!.current = f.readiness.memory.cgroup!.limit - 1;
    if (kind === "controls") f.readiness.controls[SAVED_RECOVERY_CONTROLS[2]] = "missing";
    if (kind === "owner") f.readiness.ownerUid = "other-owner";
    await f.db.doc(SAVED_RECOVERY_WORKER).set(f.readiness);
    await expect(f.enqueue()).rejects.toThrow(); expect(f.requests).toHaveLength(0); expect(f.db.records.get(f.path)).toEqual(f.original);
  });
  it("rechecks the actual worker after admission, and never substitutes Web memory", async () => {
    const f = await setup(); await f.enqueue(); f.readiness.memory.cgroup!.current = f.readiness.memory.cgroup!.limit;
    await expect(f.execute()).rejects.toThrow("memory_headroom"); expect(f.requests).toHaveLength(0);
    expect(f.db.records.get(f.requestPath).state).toBe("queued");
  });
  it("duplicate POST/lost ACK retains one immutable generation and rejects a changed original pin", async () => {
    const f = await setup(); const first = await f.enqueue(); expect(await f.enqueue()).toEqual(first);
    await expect(enqueueSavedRecovery(f.db, { ...f.input, rawOutputSha256: "0".repeat(64) }, "synthetic-owner", f.deps.now())).rejects.toThrow("intent_binding_changed");
    expect(f.db.records.get(f.requestPath).generation).toBe(1); expect(f.requests).toHaveLength(0);
  });
  it("cancels queued work and retains the cancelled generation on explicit retry", async () => {
    const f = await setup(), first = await f.enqueue();
    await cancelSavedRecovery(f.db, f.input.jobId, "synthetic-owner", first.generation, first.requestDigest, f.deps.now()); await f.execute(); expect(f.requests).toHaveLength(0);
    expect(await f.enqueue()).toMatchObject({ generation: 2, state: "queued" });
    expect(f.db.records.get(`${f.requestPath}/attempts/1`)).toMatchObject({ state: "cancelled", cancelRequested: true });
    await expect(cancelSavedRecovery(f.db, f.input.jobId, "synthetic-owner", 1, first.requestDigest, f.deps.now())).rejects.toThrow("intent_binding_changed");
  });
  it.each(["cancel", "generation", "expiry", "revoked_owner", "stopping"])("fences %s during an awaited saved GET before approval commit", async kind => {
    const f = await setup(), request = await f.enqueue(), controller = new AbortController();
    let currentTime = f.deps.now(); f.options.now = () => currentTime;
    const original = f.deps.api.reconcileSaved.bind(f.deps.api);
    vi.spyOn(f.deps.api, "reconcileSaved").mockImplementation(async (...args) => {
      const result = await original(...args);
      if (kind === "cancel") await cancelSavedRecovery(f.db, f.input.jobId, "synthetic-owner", request.generation, request.requestDigest, f.deps.now());
      if (kind === "generation") await f.db.doc(f.requestPath).update({ generation: 2 });
      if (kind === "expiry") currentTime += SAVED_RECOVERY_WINDOW_MS;
      if (kind === "revoked_owner") f.options.assertOwner.mockRejectedValue(Error("communications_saved_recovery_owner_changed"));
      if (kind === "stopping") controller.abort();
      return result;
    });
    if (kind === "generation") await expect(f.execute(controller.signal)).rejects.toThrow("settlement_changed"); else await f.execute(controller.signal);
    expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
    expect(f.db.records.get(COMMUNICATIONS_WORKER_LAP_PATH)).toMatchObject({ phase: "complete", lease: { until: 0 } });
  });
  it.each(["lost_ack", "sdk_retry"])("retains its attempted claim across %s and executes the saved consumer once", async mode => {
    const f = await setup(); await f.enqueue(); const run = f.db.runTransaction.bind(f.db); let affected = false;
    f.db.runTransaction = async (fn: any) => {
      const wasQueued = f.db.records.get(f.requestPath)?.state === "queued", result = await run(fn);
      if (!affected && wasQueued && f.db.records.get(f.requestPath)?.state === "running") {
        affected = true; if (mode === "lost_ack") throw Error("synthetic_claim_ack_lost"); return run(fn);
      }
      return result;
    };
    await f.execute(); expect(affected).toBe(true); expect(f.requests).toHaveLength(3);
    expect(f.db.records.get(f.requestPath).state).toBe("completed"); await f.execute(); expect(f.requests).toHaveLength(3);
  });
  it("retains a committed claim when its confirming read fails, then resumes only the same local token", async () => {
    const f = await setup(); await f.enqueue(); const run = f.db.runTransaction.bind(f.db), doc = f.db.doc.bind(f.db);
    let claimLost = false, readUnavailable = false;
    f.db.doc = (path: string) => { const ref = doc(path), get = ref.get.bind(ref); ref.get = async () => {
      if (path === f.requestPath && readUnavailable) { readUnavailable = false; throw Error("synthetic_claim_confirmation_unavailable"); } return get();
    }; return ref; };
    f.db.runTransaction = async (fn: any) => {
      const queued = f.db.records.get(f.requestPath)?.state === "queued", result = await run(fn);
      if (!claimLost && queued && f.db.records.get(f.requestPath)?.state === "running") { claimLost = true; readUnavailable = true; throw Error("synthetic_claim_ack_lost"); }
      return result;
    };
    await expect(f.execute()).rejects.toThrow("synthetic_claim_confirmation_unavailable");
    const token = f.db.records.get(f.requestPath).executionToken; expect(f.requests).toHaveLength(0);
    await f.execute(); expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "completed", executionToken: token }); expect(f.requests).toHaveLength(3);
  });
  it.each(["unavailable", "lost_ack"])("retains a drained final settlement after %s and never retrieves the output again", async mode => {
    const f = await setup(); await f.enqueue(); const run = f.db.runTransaction.bind(f.db); let affected = false;
    f.db.runTransaction = async (fn: any) => {
      const result = await run((tx: any) => fn({ ...tx, set: (ref: any, value: any) => {
        if (!affected && mode === "unavailable" && ref.path === f.requestPath && value.state === "completed") { affected = true; throw Error("synthetic_settlement_unavailable"); }
        return tx.set(ref, value);
      } }));
      if (!affected && mode === "lost_ack" && f.db.records.get(f.requestPath)?.state === "completed") { affected = true; throw Error("synthetic_settlement_ack_lost"); }
      return result;
    };
    await expect(f.execute()).rejects.toThrow(/synthetic_settlement/); expect(f.db.records.get(f.path).state).toBe("pending_approval");
    expect(f.requests).toHaveLength(3); const token = f.db.records.get(f.requestPath).executionToken;
    await f.execute(); expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "completed", executionToken: token }); expect(f.requests).toHaveLength(3);
  });
  it("conditionally fences an uncertain local claim after its first confirming read failed", async () => {
    const f = await setup(); await f.enqueue(); const run = f.db.runTransaction.bind(f.db), doc = f.db.doc.bind(f.db);
    let interrupted = false, readUnavailable = false;
    f.db.doc = (path: string) => { const ref = doc(path), get = ref.get.bind(ref); ref.get = async () => {
      if (path === f.requestPath && readUnavailable) { readUnavailable = false; throw Error("synthetic_claim_confirmation_unavailable"); } return get();
    }; return ref; };
    f.db.runTransaction = async (fn: any) => {
      const before = structuredClone(f.db.records.get(f.requestPath)), result = await run(fn);
      if (!interrupted && before?.state === "queued" && f.db.records.get(f.requestPath)?.state === "running") {
        interrupted = true; f.db.records.set(f.requestPath, before); readUnavailable = true; throw Error("synthetic_claim_uncommitted");
      }
      return result;
    };
    await expect(f.execute()).rejects.toThrow("synthetic_claim_confirmation_unavailable"); expect(f.requests).toHaveLength(0);
    await f.execute(); expect(f.requests).toHaveLength(0); expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "cancelled", cancelRequested: true,
      error: "communications_saved_recovery_claim_not_confirmed" });
    await f.enqueue(); await f.execute(); expect(f.requests).toHaveLength(3); expect(f.db.records.get(f.requestPath)).toMatchObject({ state: "completed", generation: 2 });
  });
  it("does not steal a running intent after expiry, and expires queued authority without execution", async () => {
    const f = await setup(); await f.enqueue(); await f.db.doc(f.requestPath).update({ state: "running", executionToken: "old-token", expiresAtMs: f.deps.now() - 1 });
    await f.execute(); expect(f.db.records.get(f.requestPath).executionToken).toBe("old-token"); expect(f.requests).toHaveLength(0);
    await f.db.doc(f.requestPath).update({ state: "queued", requestedAtMs: f.deps.now() - SAVED_RECOVERY_WINDOW_MS, expiresAtMs: f.deps.now() });
    await f.execute(); expect(f.db.records.get(f.requestPath).state).toBe("cancelled"); expect(f.requests).toHaveLength(0);
  });
  it("late opt-out reaches the real consumer and never creates an approval", async () => {
    const f = await setup(); await f.enqueue(); await f.db.doc(`outboundProspects/${f.brief.prospectId}`).update({ stage: "closed" });
    await f.execute(); expect(f.requests).toHaveLength(0); expect(f.db.records.has(`action_ledger/communications_${f.input.jobId}`)).toBe(false);
  });
  it("reports missing controls distinctly and never reads or copies key values", () => {
    vi.stubEnv("RENDER_SERVICE_ID", "existing-worker-service");
    vi.stubEnv("OPENAI_API_KEY", "synthetic-private-key");
    vi.stubEnv(SAVED_RECOVERY_CONTROLS[2], undefined);
    const value = savedRecoveryWorkerReadiness(); expect(value.providerKeyConfigured).toBe(true); expect(value.outreachControlsOff).toBe(false);
    expect(value.controls[SAVED_RECOVERY_CONTROLS[2]]).toBe("missing"); expect(JSON.stringify(value)).not.toContain("synthetic-private-key");
    for (const name of ["BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID", "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID", "BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET", "BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF"]) vi.stubEnv(name, "synthetic-private-binding");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE", "bound-field-firestore-v1"); vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "synthetic-existing-kms");
    expect(savedRecoveryWorkerReadiness().founderBindingConfigured).toBe(true);
    vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", ""); expect(savedRecoveryWorkerReadiness().founderBindingConfigured).toBe(false);
    vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", "synthetic-existing-master"); expect(savedRecoveryWorkerReadiness().founderBindingConfigured).toBe(true);
  });
});
