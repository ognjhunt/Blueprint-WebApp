/**
 * WebApp-owned storage deletion after a site withdraws recording permission.
 *
 * The withdrawal forwarder (websiteCaptureWithdrawal.ts) hands Pipeline a
 * non-destructive tombstone and records its acknowledgement; it never deletes.
 * This worker deletes what the WebApp itself wrote for that site, and nothing
 * else:
 *
 *   scenes/site-<id>/captures/walkthrough-<id>/raw/      video, manifest, multipart parts, markers, app bundle files
 *   scenes/site-<id>/captures/walkthrough-<id>/upload/   app bundle plan and completion records
 *   scenes/site-<id>/captures/<supplement>/raw|upload/   supplements recorded for this request
 *   scenes/site-<id>/items/                              job item photos
 *
 * Every object generation is deleted, every listed name is re-checked against
 * its owned prefix, and the pass writes a durable receipt (objects listed,
 * deleted count, failures, timestamps). Derived scenes, results and Pipeline
 * copies are outside this scope; results already produced are retained per the
 * Terms and the published retention schedule.
 *
 * Upload targets. New targets stop at withdrawal: every upload, bundle and
 * target route requires current recording consent. Targets issued before then
 * cannot be revoked server-side, so the worker waits them out: signed PUT URLs
 * live 30 minutes, so the first pass waits for that horizon; Cloud Storage
 * resumable session URIs (the app's video) stay usable for up to a week, so a
 * capture that ever had an app bundle plan gets a late-upload sweep after that
 * horizon before deletion is confirmed. Both expiries are recorded.
 *
 * Timing. Deletion waits for Pipeline's acknowledgement of the tombstone. If
 * none arrives within the acknowledgement timeout it deletes anyway and
 * records the acknowledgement as pending; deletion is confirmed only once the
 * acknowledgement also exists. A Pipeline legal hold stops deletion.
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { deriveWebsiteWithdrawalState, websiteWithdrawalCommand } from "./websiteCaptureWithdrawal";

export const DELETION_RECEIPTS_COLLECTION = "websiteCaptureDeletionReceipts";
/** Mirrors SIGNED_URL_TTL_MS in siteCaptureBundleService.ts. */
export const SIGNED_PUT_TARGET_TTL_MS = 30 * 60 * 1000;
/** Cloud Storage resumable session URIs expire one week after creation. */
export const NATIVE_RESUMABLE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_MARGIN_MS = 5 * 60 * 1000;
const LATE_SWEEP_MARGIN_MS = 60 * 60 * 1000;
const DEFAULT_ACK_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const LEGAL_HOLD_RECHECK_MS = 6 * 60 * 60 * 1000;
export const MAX_OBJECTS_PER_PASS = 500;
const DELETE_CONCURRENCY = 16;

type ListedFile = { name: string; generation?: string | number; metadata?: { generation?: string | number; size?: string | number } };
export interface DeletionBucket {
  name?: string;
  getFiles(options: Record<string, unknown>): Promise<[ListedFile[], ...unknown[]]>;
  file(name: string, options?: { generation?: number }): { delete(options?: Record<string, unknown>): Promise<unknown> };
}

export type DeletionDeps = {
  bucket: DeletionBucket | null;
  bucketName: string;
  now: () => number;
  ackTimeoutMs: number;
};

function bucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

function ackTimeoutMs() {
  const configured = Number(process.env.BLUEPRINT_WEBSITE_WITHDRAWAL_ACK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_ACK_TIMEOUT_MS;
}

function defaultDeps(): DeletionDeps {
  return {
    bucket: storageAdmin ? storageAdmin.bucket(bucketName()) as unknown as DeletionBucket : null,
    bucketName: bucketName(),
    now: Date.now,
    ackTimeoutMs: ackTimeoutMs(),
  };
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

/** The prefixes this request's WebApp uploads were written to. Exact, slash-terminated. */
export function ownedPrefixes(requestId: string, supplementCaptureIds: string[] = []): string[] {
  if (!SAFE_ID.test(requestId)) throw new Error("website_deletion_request_invalid");
  const scene = `scenes/site-${requestId}`;
  const captures = [`walkthrough-${requestId}`, ...supplementCaptureIds.filter(id => SAFE_ID.test(id) && id.startsWith("supplement-"))];
  return [...new Set(captures)].flatMap(capture => [`${scene}/captures/${capture}/raw/`, `${scene}/captures/${capture}/upload/`])
    .concat(`${scene}/items/`);
}

async function supplementCaptureIds(requestId: string): Promise<string[]> {
  const rows = await db!.collection("captureSupplements").where("requestId", "==", requestId).get();
  return rows.docs.filter(row => row.data()?.sceneId === `site-${requestId}`).map(row => row.id);
}

type ListedObject = { name: string; generation: string | null; sizeBytes: number | null; prefix: string };

async function listOwned(bucket: DeletionBucket, prefixes: string[], budget: number) {
  const objects: ListedObject[] = [];
  let truncated = false;
  for (const prefix of prefixes) {
    let query: Record<string, unknown> | null = { prefix, versions: true, autoPaginate: false, maxResults: Math.min(budget, 1000) };
    while (query && objects.length < budget) {
      const [files, next] = await bucket.getFiles({ ...query, maxResults: Math.min(budget - objects.length, 1000) });
      for (const file of files) {
        // Never trust a listing to stay inside its prefix.
        if (!file.name.startsWith(prefix) || file.name.includes("/../")) continue;
        const generation = file.metadata?.generation ?? file.generation;
        const size = Number(file.metadata?.size);
        objects.push({ name: file.name, generation: generation === undefined ? null : String(generation),
          sizeBytes: Number.isFinite(size) ? size : null, prefix });
      }
      query = next && typeof next === "object" && (next as { pageToken?: string }).pageToken ? next as Record<string, unknown> : null;
    }
    if (query || objects.length >= budget) { truncated = true; break; }
  }
  return { objects, truncated };
}

async function deleteObjects(bucket: DeletionBucket, objects: ListedObject[]) {
  const failures: Array<{ name: string; generation: string | null; error: string }> = [];
  let deleted = 0;
  for (let index = 0; index < objects.length; index += DELETE_CONCURRENCY) {
    await Promise.all(objects.slice(index, index + DELETE_CONCURRENCY).map(async object => {
      try {
        const generation = object.generation === null ? undefined : Number(object.generation);
        await bucket.file(object.name, Number.isFinite(generation) ? { generation } : undefined).delete({ ignoreNotFound: true });
        deleted++;
      } catch (error) {
        const code = (error as { code?: unknown })?.code;
        failures.push({ name: object.name, generation: object.generation,
          error: typeof code === "number" || typeof code === "string" ? `storage_error_${code}` : "storage_delete_failed" });
      }
    }));
  }
  return { deleted, failures };
}

type Claim = {
  ref: FirebaseFirestore.DocumentReference;
  requestId: string;
  token: string;
  pass: "initial" | "late_upload_sweep" | "finalize";
  withdrawal: Record<string, any>;
  requestedAtMs: number;
};

function nextBackoff(attempts: number) {
  return Math.min(MAX_BACKOFF_MS, 60_000 * 2 ** Math.max(0, attempts - 1));
}

/** Decide in a transaction whether this record is due, and claim it if so. */
async function claim(ref: FirebaseFirestore.DocumentReference, deps: DeletionDeps): Promise<Claim | null> {
  return db!.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    const withdrawal = record?.capture_withdrawal;
    if (!record || record.captureDeletionPending !== true || !withdrawal) return null;
    const now = deps.now();
    // A record that lost its consent revocation or binding is never a delete authority.
    let requestedAtMs: number;
    try {
      websiteWithdrawalCommand(ref.id, withdrawal);
      requestedAtMs = Date.parse(withdrawal.requestedAtIso);
    } catch {
      tx.set(ref, { captureDeletionPending: false, capture_withdrawal: { webappDeletion: {
        ...(withdrawal.webappDeletion || {}), lastError: "withdrawal_binding_invalid" } } }, { merge: true });
      return null;
    }
    if (record.consent_revoked !== true) return null;
    const deletion = { phase: "pending", attempts: 0, nextAttemptAtMs: 0, leaseUntilMs: 0, ...(withdrawal.webappDeletion || {}) };
    if (Number(deletion.leaseUntilMs || 0) > now || Number(deletion.nextAttemptAtMs || 0) > now) return null;
    const write = (webappDeletion: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
      const next = { ...withdrawal, webappDeletion };
      tx.set(ref, { ...extra, capture_withdrawal: { ...next, ...deriveWebsiteWithdrawalState(next) } }, { merge: true });
    };
    if (withdrawal.legalHold === true) {
      write({ ...deletion, nextAttemptAtMs: now + LEGAL_HOLD_RECHECK_MS, heldForLegalHold: true });
      return null;
    }
    let pass: Claim["pass"];
    if (deletion.phase === "deleted") {
      if (withdrawal.pipelineAcknowledged === true) {
        write({ ...deletion, pipelineAckState: "acknowledged", confirmedAtIso: new Date(now).toISOString() },
          { captureDeletionPending: false });
        return null;
      }
      write({ ...deletion, nextAttemptAtMs: now + 10 * 60 * 1000 });
      return null;
    } else if (deletion.phase === "awaiting_late_upload_sweep") {
      if (Number(deletion.lateSweepAtMs || 0) > now) {
        write({ ...deletion, nextAttemptAtMs: Number(deletion.lateSweepAtMs) });
        return null;
      }
      pass = "late_upload_sweep";
    } else {
      const targetsExpiredAt = requestedAtMs + SIGNED_PUT_TARGET_TTL_MS + CLOCK_MARGIN_MS;
      const ackDeadline = requestedAtMs + deps.ackTimeoutMs;
      const acknowledged = withdrawal.pipelineAcknowledged === true;
      if (now < targetsExpiredAt || (!acknowledged && now < ackDeadline)) {
        write({ ...deletion, phase: "pending",
          nextAttemptAtMs: Math.max(targetsExpiredAt, acknowledged ? 0 : Math.min(ackDeadline, now + 10 * 60 * 1000)) });
        return null;
      }
      pass = "initial";
    }
    const token = randomUUID();
    write({ ...deletion, lease: token, leaseUntilMs: now + CLAIM_LEASE_MS, attempts: Number(deletion.attempts || 0) + 1 });
    return { ref, requestId: ref.id, token, pass, withdrawal: { ...withdrawal, webappDeletion: deletion }, requestedAtMs };
  });
}

async function runPass(work: Claim, deps: DeletionDeps) {
  const startedAtIso = new Date(deps.now()).toISOString();
  const deletion = work.withdrawal.webappDeletion;
  const acknowledged = work.withdrawal.pipelineAcknowledged === true;
  let receiptId: string | null = null;
  let outcome: "complete" | "partial" | "failed" = "failed";
  let lastError: string | null = null;
  let nativePlanSeen = deletion.nativePlanSeen === true;
  let deletedCount = 0, failedCount = 0;
  try {
    if (!deps.bucket) throw Object.assign(new Error("storage_unavailable"), { code: "storage_unavailable" });
    const prefixes = ownedPrefixes(work.requestId, await supplementCaptureIds(work.requestId));
    const listed = await listOwned(deps.bucket, prefixes, MAX_OBJECTS_PER_PASS);
    // Resumable sessions are minted only after an app bundle plan is stored.
    nativePlanSeen = nativePlanSeen || listed.objects.some(object => object.prefix.endsWith("/upload/"))
      || prefixes.some(prefix => prefix.includes("/captures/supplement-"));
    const result = await deleteObjects(deps.bucket, listed.objects);
    const remaining = listed.truncated ? null : (await listOwned(deps.bucket, prefixes, 1)).objects.length;
    deletedCount = result.deleted; failedCount = result.failures.length;
    outcome = result.failures.length === 0 && remaining === 0 ? "complete" : result.failures.length ? "failed" : "partial";
    if (outcome === "failed") lastError = "storage_delete_failed";
    const requestedAt = work.requestedAtMs;
    const body = {
      schema_version: "website_capture_deletion_receipt.v1",
      request_id: work.requestId,
      withdrawal_requested_at_iso: work.withdrawal.requestedAtIso,
      pass: work.pass,
      attempt: Number(deletion.attempts || 0) + 1,
      bucket: deps.bucketName,
      owned_prefixes: prefixes,
      objects: listed.objects.map(({ name, generation, sizeBytes }) => ({ name, generation, size_bytes: sizeBytes })),
      listed_count: listed.objects.length,
      listing_truncated: listed.truncated,
      deleted_count: result.deleted,
      failures: result.failures,
      remaining_count_after_pass: remaining,
      outcome,
      upload_targets: {
        minting_stopped_at_iso: work.withdrawal.requestedAtIso,
        signed_put_ttl_ms: SIGNED_PUT_TARGET_TTL_MS,
        signed_put_targets_expired_by_iso: new Date(requestedAt + SIGNED_PUT_TARGET_TTL_MS + CLOCK_MARGIN_MS).toISOString(),
        native_resumable_sessions_possible: nativePlanSeen,
        native_resumable_sessions_expired_by_iso: nativePlanSeen
          ? new Date(requestedAt + NATIVE_RESUMABLE_SESSION_TTL_MS + LATE_SWEEP_MARGIN_MS).toISOString() : null,
      },
      pipeline_acknowledgement: acknowledged ? "acknowledged" : "pending_after_timeout",
      started_at_iso: startedAtIso,
      completed_at_iso: new Date(deps.now()).toISOString(),
    };
    const receipt = { ...body, digest: canonicalArtifactDigest(body, "digest") };
    receiptId = `${work.requestId}-${work.pass}-${body.attempt}`;
    await db!.collection(DELETION_RECEIPTS_COLLECTION).doc(receiptId).set(receipt);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    lastError = code === "storage_unavailable" ? "storage_unavailable" : "deletion_pass_failed";
    logger.error({ requestId: work.requestId, code: lastError }, "Website capture deletion pass will retry");
  }

  await db!.runTransaction(async tx => {
    const record = (await tx.get(work.ref)).data();
    const withdrawal = record?.capture_withdrawal;
    const current = withdrawal?.webappDeletion;
    if (!withdrawal || current?.lease !== work.token) return;
    const now = deps.now();
    const receiptIds = [...(Array.isArray(current.receiptIds) ? current.receiptIds : []), ...(receiptId ? [receiptId] : [])];
    const counts = { deletedObjectCount: Number(current.deletedObjectCount || 0) + deletedCount,
      failedObjectCount: failedCount, receiptIds, nativePlanSeen,
      pipelineAckState: withdrawal.pipelineAcknowledged === true ? "acknowledged" : "pending_after_timeout" };
    let webappDeletion: Record<string, unknown>;
    if (outcome === "complete") {
      const lateSweepAtMs = work.requestedAtMs + NATIVE_RESUMABLE_SESSION_TTL_MS + LATE_SWEEP_MARGIN_MS;
      const awaitLate = work.pass === "initial" && nativePlanSeen && lateSweepAtMs > now;
      webappDeletion = { ...current, ...counts, lease: null, leaseUntilMs: 0, attempts: 0, lastError: null,
        phase: awaitLate ? "awaiting_late_upload_sweep" : "deleted",
        lateSweepAtMs: awaitLate ? lateSweepAtMs : current.lateSweepAtMs ?? null,
        firstDeletedAtIso: current.firstDeletedAtIso ?? new Date(now).toISOString(),
        completedAtIso: awaitLate ? null : new Date(now).toISOString(),
        uploadTargetsExpiredByIso: new Date(nativePlanSeen ? lateSweepAtMs : work.requestedAtMs
          + SIGNED_PUT_TARGET_TTL_MS + CLOCK_MARGIN_MS).toISOString(),
        nextAttemptAtMs: awaitLate ? lateSweepAtMs : 0 };
    } else {
      // A partial pass is progress, not a failure: continue promptly.
      webappDeletion = { ...current, ...counts, lease: null, leaseUntilMs: 0, lastError,
        attempts: outcome === "partial" ? 0 : current.attempts,
        nextAttemptAtMs: now + (outcome === "partial" ? 0 : nextBackoff(Number(current.attempts || 1))) };
    }
    const next = { ...withdrawal, webappDeletion };
    const derived = deriveWebsiteWithdrawalState(next);
    tx.set(work.ref, { capture_withdrawal: { ...next, ...derived },
      ...(derived.deletionConfirmed ? { captureDeletionPending: false } : {}) }, { merge: true });
  });
}

let pendingCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
let adoptionCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

/** Withdrawals recorded before this worker existed carry no deletion queue flag. */
async function adoptLegacyWithdrawals(limit: number) {
  let query = db!.collection("inboundRequests").where("captureWithdrawalPending", "==", true).limit(limit);
  if (adoptionCursor) query = query.startAfter(adoptionCursor);
  const rows = await query.get();
  adoptionCursor = rows.docs.length === limit ? rows.docs.at(-1) : undefined;
  for (const row of rows.docs) {
    const data = row.data();
    if (data?.capture_withdrawal?.webappDeletion || data?.captureDeletionPending !== undefined) continue;
    await db!.runTransaction(async tx => {
      const current = (await tx.get(row.ref)).data();
      if (!current?.capture_withdrawal || current.capture_withdrawal.webappDeletion
        || current.captureDeletionPending !== undefined) return;
      tx.set(row.ref, { captureDeletionPending: true, capture_withdrawal: {
        webappDeletion: { phase: "pending", attempts: 0, nextAttemptAtMs: 0, leaseUntilMs: 0 } } }, { merge: true });
    });
  }
}

/** One bounded pass over due withdrawals. Safe to run concurrently: claims are leased per record. */
export async function runWebsiteCaptureDeletions(params: { limit?: number; deps?: Partial<DeletionDeps> } = {}) {
  const summary = { examined: 0, passes: 0 };
  if (!db) return summary;
  const deps = { ...defaultDeps(), ...params.deps };
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  await adoptLegacyWithdrawals(limit).catch(() => logger.warn("Legacy withdrawal adoption will retry"));
  let query = db.collection("inboundRequests").where("captureDeletionPending", "==", true).limit(limit);
  if (pendingCursor) query = query.startAfter(pendingCursor);
  const rows = await query.get();
  // Rotate so waiting records (ack, late sweep, legal hold) cannot starve due ones.
  pendingCursor = rows.docs.length === limit ? rows.docs.at(-1) : undefined;
  for (const row of rows.docs) {
    summary.examined++;
    try {
      const work = await claim(row.ref, deps);
      if (!work) continue;
      await runPass(work, deps);
      summary.passes++;
    } catch (error) {
      logger.error({ requestId: row.id }, "Website capture deletion remains pending");
    }
  }
  return summary;
}

export function resetWebsiteCaptureDeletionCursorsForTests() {
  pendingCursor = undefined;
  adoptionCursor = undefined;
}

/** Runs beside the withdrawal forwarder in the worker, under its own leader lease. */
export function startWebsiteCaptureDeletionWorker(options: { intervalMs?: number; lease?: AutomationLeaderLease } = {}) {
  const lease = options.lease ?? createAutomationLeaderLease({ leaseName: "website-capture-deletion-leader" });
  lease.start();
  let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (!running && lease.isLeader()) {
      running = true;
      try { await runWebsiteCaptureDeletions(); }
      catch { logger.error("Website capture deletion pass failed; it will retry"); }
      finally { running = false; }
    }
    if (!stopped) { timer = setTimeout(run, options.intervalMs ?? 60_000); timer.unref?.(); }
  };
  timer = setTimeout(run, 10_000); timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); void lease.stop(); };
}
