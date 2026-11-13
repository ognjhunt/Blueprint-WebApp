/**
 * A withdrawal also closes the job's stored model runs: every agent run, session, runtime event, checkpoint,
 * compaction and action log row that belongs to the job has its content redacted in place
 * (agents/withdrawal-redaction.ts), with cost, usage, model, provider, status, timings, failover and ids kept, and
 * every private evidence object ever written for such a row is deleted. Run by the capture deletion worker after the
 * object deletion and independent of it: a failure here never blocks or undoes the object deletion.
 *
 * When. Under the same gate as the object deletion (websiteWithdrawalDeletionGate.ts): never while a legal hold is
 * set, and the first pass only once the deletion itself may delete. A hold that arrives later stops further passes.
 * The job is queued in the same act as its deletion is first claimed, so a new withdrawal never waits behind old ones.
 *
 * Which rows belong to the job. Agent runs are found by equality on one field each (no composite index):
 *   - privacy_request_binding.request_id   the server's binding (runAgentTask's privacyRequestBinding)
 *   - metadata.request_id                  set by callers (picker, inbound, preview, robot fit). It is caller-set,
 *   - metadata.inbound_request_id          so it could name a job the data is not from; for REDACTION that wider
 *                                          match is the safe direction (it can only redact too much). Both stay
 *                                          inline on offloaded rows from now on (private-evidence.ts).
 *   - metadata.capture_id                  each capture of the job (footage and coverage lanes)
 *   - session_key                          the lane keys that name the job or one of its captures
 *   - task_kind == site_assessment         retired admin sessions; filtered on the request id after reading (once)
 *   - task_kind of each lane that can carry a job's content: offloaded rows written before the ids stayed inline,
 *                                          filtered on metadata.request_id / inbound_request_id after reading (once)
 * A run in an agent session takes its session, checkpoints and compactions (the conversation), the session's events
 * that belong to one of the job's runs or to no run, and the replay copies of the conversation in the session's
 * other runs (only those fields of those runs). Every run takes its action log rows.
 *
 * Discipline: bounded work per pass (MAX_RECORDS_PER_PASS rows read), a cursor per step, idempotent (a redacted row
 * carries a marker; it is still visited for its evidence objects), retried with backoff, and a receipt per pass with
 * counts only. A row that cannot be redacted this pass is counted and skipped; it never holds the cursor, and the
 * sweep is repeated until it ends clean. After a clean sweep the worker waits until RUN_HORIZON_MS after the
 * withdrawal and sweeps once more, so a run in flight cannot leave content behind. Only a clean sweep that started
 * after the horizon completes the job.
 *
 * Jobs withdrawn before this existed are found once by a backfill over `consent_revoked == true` with its own
 * cursor and completion marker; after it has finished an idle tick costs one query. Only a job whose site asked for
 * withdrawal (a valid `capture_withdrawal` with its consent revoked) is ever redacted.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { websiteWithdrawalCommand } from "./websiteCaptureWithdrawal";
import { withdrawalDeletionGate } from "./websiteWithdrawalDeletionGate";
import { AgentEvidenceError, agentEvidencePrefix, hydrateAgentEvidence, projectAgentEvidence,
  type EvidenceCollection } from "../agents/private-evidence";
import { collapseToFit, fitsStore, redactReplayCopies, redactWithdrawnRecord, withdrawalRedactionOf,
  WITHDRAWAL_REDACTION_SCHEMA, type WithdrawalRedactionMarker } from "../agents/withdrawal-redaction";

export const MODEL_RUN_REDACTION_FIELD = "capture_withdrawal_model_runs";
export const MODEL_RUN_REDACTION_PENDING = "modelRunRedactionPending";
export const MODEL_RUN_REDACTION_RECEIPTS_COLLECTION = "websiteCaptureModelRunRedactionReceipts";
export const MODEL_RUN_REDACTION_BACKFILL_DOC = "websiteMaintenance/website-model-run-redaction-backfill";
export const MAX_RECORDS_PER_PASS = 100;
/** Every provider request is capped at 10 minutes and a run makes a bounded number of them; a day is ample. */
export const RUN_HORIZON_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 10 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const LEGAL_HOLD_RECHECK_MS = 6 * 60 * 60 * 1000;
const DEFAULT_ACK_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const MAX_FAILED_IDS = 50;
/** Document-id order: equality on one field plus this order is served by that field's single-field index. */
const DOCUMENT_ID = "__name__";

type Collection = EvidenceCollection | "opsActionLogs" | "agentCompactions";
type Mode = "full" | "replay_copies" | "session_event";
type Step = { collection: Collection; field: string; value: string; mode?: Mode };
type ScanName = "offloaded" | "site_assessment";
type Counts = Record<Collection, number>;
const emptyCounts = (): Counts => ({ agentRuns: 0, agentSessions: 0, agentRuntimeEvents: 0, agentCheckpoints: 0, opsActionLogs: 0,
  agentCompactions: 0 });
const EVIDENCE_COLLECTIONS = new Set<Collection>(["agentRuns", "agentSessions", "agentCheckpoints", "agentRuntimeEvents"]);

type ListedFile = { name: string; generation?: string | number; metadata?: { generation?: string | number } };
export type RedactionBucket = { name?: string;
  getFiles?(options: Record<string, unknown>): Promise<[ListedFile[], ...unknown[]]>;
  file(name: string, options?: { generation?: number }): { delete(options?: Record<string, unknown>): Promise<unknown> } };
export type RedactionDeps = { now: () => number; bucket: RedactionBucket | null; bucketName: string; ackTimeoutMs?: number;
  maxRecordsPerPass?: number };

type Sweep = { started_at_ms: number | null; rows_failed: number; objects_failed: number; objects_remaining: number;
  failed_row_ids: string[] };
export type ModelRunRedactionState = {
  phase: "pending" | "final_sweep" | "done"; held: boolean;
  step: number; cursor: string | null;
  dependents: { runId: string; steps: Step[]; step: number; cursor: string | null; returnTo?: "steps" | ScanName } | null;
  /** The once-per-job scans: their cursors and done flags; a repeated or final sweep never scans again. */
  scans: Record<ScanName, { cursor: string | null; done: boolean }>;
  /** Job rows the scans found: every later sweep visits them by id, so the scans never need to run again. */
  scan_found: string[];
  passes: number; nextAttemptAtMs: number; leaseUntilMs: number; lease: string | null; attempts: number;
  redacted: Counts; already_redacted: number; replay_copies_redacted: number; evidence_objects_deleted: number;
  evidence_unreadable: number; other_rows_unreadable: number; sweep: Sweep; sweep_repeats: number; horizon_at_ms: number;
  completed_at_iso: string | null;
};
const initialScans = (): ModelRunRedactionState["scans"] => ({ offloaded: { cursor: null, done: false }, site_assessment: { cursor: null, done: false } });
const emptySweep = (): Sweep => ({ started_at_ms: null, rows_failed: 0, objects_failed: 0, objects_remaining: 0, failed_row_ids: [] });

export function initialModelRunRedactionState(requestedAtMs: number): ModelRunRedactionState {
  return { phase: "pending", held: false, step: 0, cursor: null, dependents: null, passes: 0, nextAttemptAtMs: 0,
    leaseUntilMs: 0, lease: null, attempts: 0, redacted: emptyCounts(), already_redacted: 0, replay_copies_redacted: 0,
    scans: initialScans(), scan_found: [], evidence_objects_deleted: 0, evidence_unreadable: 0, other_rows_unreadable: 0, sweep: emptySweep(),
    sweep_repeats: 0, horizon_at_ms: requestedAtMs + RUN_HORIZON_MS,
    completed_at_iso: null };
}

/** Called inside the object deletion's claim transaction: queue this job's redaction once, in the same act. */
export function queueWebsiteJobModelRunRedaction(tx: { set(ref: any, value: any, options?: any): unknown },
  ref: FirebaseFirestore.DocumentReference, record: Record<string, any>, requestedAtMs: number) {
  if (record[MODEL_RUN_REDACTION_FIELD] || record[MODEL_RUN_REDACTION_PENDING] !== undefined) return;
  tx.set(ref, { [MODEL_RUN_REDACTION_PENDING]: true, [MODEL_RUN_REDACTION_FIELD]: initialModelRunRedactionState(requestedAtMs) },
    { merge: true });
}

const SESSION_KEY_PREFIXES_BY_REQUEST = ["inbound", "preview", "robot-fit", "brief_reading", "site-video"];
const SESSION_KEY_PREFIXES_BY_CAPTURE = ["capture_privacy", "capture_review", "capture_coverage"];
/**
 * The two once-per-job scans, for rows that name the job only inside their content:
 *   - offloaded: every row offloaded to private evidence (`agent_evidence_ref.version == 1`, one equality), hydrated
 *     and matched on the job's ids. It covers offloaded rows written before the request ids stayed inline, of every
 *     lane, offloaded site_assessment rows included.
 *   - site_assessment: the retired lane's INLINE rows (the request id is only in `input.context`); offloaded ones are
 *     the first scan's.
 */
const SCANS: Record<ScanName, { field: string; value: string | number }> = {
  offloaded: { field: "agent_evidence_ref.version", value: 1 },
  site_assessment: { field: "task_kind", value: "site_assessment" },
};
const namedRequestIds = (full: Record<string, any>) => [full.metadata?.request_id, full.metadata?.inbound_request_id,
  full.input?.metadata?.request_id, full.input?.input?.context?.request_id, full.input?.context?.request_id,
  full.artifacts?.source_admission?.request_id];

/** The run steps for one job, in a fixed order (the cursor indexes it). */
export function jobRunSteps(requestId: string, captureIds: string[]): Step[] {
  const run = (field: string, value: string, extra: Partial<Step> = {}): Step => ({ collection: "agentRuns", field, value, ...extra });
  return [
    run("privacy_request_binding.request_id", requestId),
    run("metadata.request_id", requestId),
    run("metadata.inbound_request_id", requestId),
    ...captureIds.map(capture => run("metadata.capture_id", capture)),
    ...SESSION_KEY_PREFIXES_BY_REQUEST.flatMap(prefix => [`${prefix}:${requestId}`, `${prefix}:${requestId}:shadow:autoagent`])
      .map(key => run("session_key", key)),
    ...captureIds.flatMap(capture => SESSION_KEY_PREFIXES_BY_CAPTURE.map(prefix => run("session_key", `${prefix}:${capture}`))),
  ];
}

function dependentSteps(runId: string, run: Record<string, unknown>): Step[] {
  const sessionId = typeof run.session_id === "string" && run.session_id ? run.session_id : null;
  return [
    ...(sessionId ? [{ collection: "agentSessions" as const, field: "__name__", value: sessionId },
      { collection: "agentRuntimeEvents" as const, field: "session_id", value: sessionId, mode: "session_event" as const },
      { collection: "agentCheckpoints" as const, field: "session_id", value: sessionId },
      { collection: "agentCompactions" as const, field: "source_session_id", value: sessionId },
      { collection: "agentRuns" as const, field: "session_id", value: sessionId, mode: "replay_copies" as const }] : []),
    { collection: "opsActionLogs", field: "run_id", value: runId },
  ];
}

async function page(step: { collection: Collection; field: string; value: string | number }, cursor: string | null, limit: number) {
  if (step.field === "__name__") {
    if (cursor !== null) return [];
    const doc = await db!.collection(step.collection).doc(String(step.value)).get();
    return doc.exists ? [doc as unknown as FirebaseFirestore.QueryDocumentSnapshot] : [];
  }
  let query = db!.collection(step.collection).where(step.field, "==", step.value).orderBy(DOCUMENT_ID).limit(limit);
  if (cursor !== null) query = query.startAfter(cursor);
  return (await query.get()).docs;
}

const stableDigest = (value: unknown) => canonicalArtifactDigest({ value: JSON.parse(JSON.stringify(value ?? null)) }, "digest");

type PassCounts = { examined: number; redacted: Counts; already_redacted: number; replay_copies_redacted: number;
  evidence_objects_deleted: number; evidence_unreadable: number; other_rows_unreadable: number; rows_failed: number; objects_failed: number;
  objects_remaining: number; failed_row_ids: string[] };

/** Delete every evidence object ever written for a row, except the one its stored redacted form now points to. */
async function sweepEvidence(collection: Collection, id: string, keep: Record<string, any> | null | undefined, deps: RedactionDeps,
  counts: PassCounts) {
  if (!EVIDENCE_COLLECTIONS.has(collection)) return;
  if (!deps.bucket?.getFiles) throw Object.assign(new Error("evidence_storage_unavailable"), { code: "evidence_storage_unavailable" });
  const prefix = agentEvidencePrefix({ collection: collection as EvidenceCollection, id });
  const [files, next] = await deps.bucket.getFiles({ prefix, versions: true, autoPaginate: false, maxResults: 100 });
  for (const file of files) {
    if (!file.name.startsWith(prefix)) continue;
    const generation = String(file.metadata?.generation ?? file.generation ?? "");
    if (keep?.object === file.name && String(keep.generation) === generation) continue;
    try {
      const numeric = Number(generation);
      await deps.bucket.file(file.name, Number.isFinite(numeric) && generation ? { generation: numeric } : undefined).delete({ ignoreNotFound: true });
      counts.evidence_objects_deleted++;
    } catch { counts.objects_failed++; }
  }
  if (next && typeof next === "object" && (next as { pageToken?: string }).pageToken) counts.objects_remaining++;
}

/** A stored form that fits the store: the runtime's own projection for evidence rows, collapsed subtrees otherwise. */
async function storable(collection: Collection, id: string, record: Record<string, unknown>) {
  if (EVIDENCE_COLLECTIONS.has(collection)) {
    try {
      const projected = await projectAgentEvidence(record, { collection: collection as EvidenceCollection, id });
      if (fitsStore(projected)) return projected;
    } catch { /* No storage, or still too large: collapse below. */ }
  }
  const inline = { ...record, ...(EVIDENCE_COLLECTIONS.has(collection) ? { agent_evidence_ref: null } : {}) };
  return fitsStore(inline) ? inline : collapseToFit(inline);
}

type Visit = "redacted" | "already" | "skipped" | "failed";
/** Visit one row: redact it (or its replay copies), and sweep its evidence objects. Never throws. */
async function visitRow(collection: Collection, ref: FirebaseFirestore.DocumentReference, mode: Mode, marker: WithdrawalRedactionMarker,
  requestId: string, deps: RedactionDeps, counts: PassCounts, counted = true): Promise<Visit> {
  if (counted) counts.examined++;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const snapshot = await ref.get();
      if (!snapshot.exists) return "skipped";
      const raw = snapshot.data() as Record<string, any>;
      const ownMarker = withdrawalRedactionOf(raw);
      if (ownMarker) {
        // Redacted already, by this job or another one: only its evidence objects are left to check.
        if (mode === "full" || ownMarker.request_id === requestId) {
          if (ownMarker.request_id === requestId) counts.already_redacted++;
          await sweepEvidence(collection, ref.id, raw.agent_evidence_ref, deps, counts);
        }
        return ownMarker.request_id === requestId ? "already" : "skipped";
      }
      if (mode === "session_event") {
        const runId = typeof raw.run_id === "string" && raw.run_id ? raw.run_id : null;
        if (runId) {
          const run = (await db!.collection("agentRuns").doc(runId).get()).data();
          if (withdrawalRedactionOf(run)?.request_id !== requestId) return "skipped"; // another run's event stays as it is
        }
      }
      let full: Record<string, any> = raw;
      const evidenceRef = raw.agent_evidence_ref;
      if (EVIDENCE_COLLECTIONS.has(collection) && evidenceRef) {
        try { full = await hydrateAgentEvidence(raw, { collection: collection as EvidenceCollection, id: ref.id }); }
        catch (error) {
          // Another run's row is never rewritten without its evidence. If the store says its object is gone, there is
          // nothing left to redact: counted, and the job goes on. Any other failure (transient, digest, decode) may
          // hide a copy of the conversation: the row is remaining, retried on later passes, its content untouched.
          // The job's own row is redacted as it stands.
          if (mode === "replay_copies") {
            if (error instanceof AgentEvidenceError && error.code === "agent_evidence_object_missing") {
              counts.other_rows_unreadable++; return "skipped";
            }
            counts.rows_failed++;
            if (counts.failed_row_ids.length < MAX_FAILED_IDS) counts.failed_row_ids.push(`${collection}/${ref.id}`);
            return "failed";
          }
          counts.evidence_unreadable++; full = { ...raw };
        }
      }
      let next: Record<string, unknown>;
      if (mode === "replay_copies") {
        const { record, changed } = redactReplayCopies({ ...full });
        if (!changed && !evidenceRef) return "skipped";
        if (changed) counts.replay_copies_redacted++;
        next = record;
      } else {
        next = redactWithdrawnRecord({ ...full }, marker);
      }
      const { agent_evidence_ref: _ref, ...withoutRef } = next as Record<string, unknown>;
      const stored = await storable(collection, ref.id, withoutRef);
      const before = stableDigest(raw);
      const written = await db!.runTransaction(async tx => {
        const latest = await tx.get(ref);
        if (!latest.exists || stableDigest(latest.data()) !== before) return false;
        tx.set(ref, stored);
        return true;
      });
      if (!written) continue;
      if (mode !== "replay_copies") counts.redacted[collection]++;
      await sweepEvidence(collection, ref.id, (stored as Record<string, any>).agent_evidence_ref, deps, counts);
      return mode === "replay_copies" ? "skipped" : "redacted";
    }
    throw Object.assign(new Error("row_changed_during_redaction"), { code: "row_changed_during_redaction" });
  } catch {
    counts.rows_failed++;
    if (counts.failed_row_ids.length < MAX_FAILED_IDS) counts.failed_row_ids.push(`${collection}/${ref.id}`);
    return "failed";
  }
}

/** Whether a scanned row names the job, read from the row (and its evidence when offloaded). Another job's unreadable
 * row is counted on its own and skipped. */
async function scannedRowIsJobs(scan: ScanName, doc: FirebaseFirestore.QueryDocumentSnapshot, requestId: string, counts: PassCounts) {
  const raw = doc.data() as Record<string, any>;
  if (withdrawalRedactionOf(raw)) return false;
  if (scan === "site_assessment" && raw.agent_evidence_ref) return false; // the offloaded scan's
  let full = raw;
  if (raw.agent_evidence_ref) {
    try { full = await hydrateAgentEvidence(raw, { collection: "agentRuns", id: doc.id }); }
    catch { counts.other_rows_unreadable++; return false; }
  }
  return namedRequestIds(full).includes(requestId);
}

/** One bounded pass over one job. Mutates and returns the state; writes nothing but the rows it redacts. */
export async function redactJobModelRunsPass(requestId: string, captureIds: string[], state: ModelRunRedactionState, deps: RedactionDeps) {
  const budget = Math.max(1, deps.maxRecordsPerPass ?? MAX_RECORDS_PER_PASS);
  const marker: WithdrawalRedactionMarker = { schema_version: WITHDRAWAL_REDACTION_SCHEMA, request_id: requestId,
    redacted_at_iso: new Date(deps.now()).toISOString() };
  state.scan_found ??= [];
  const baseSteps = jobRunSteps(requestId, captureIds);
  const allSteps = (): Step[] => [...baseSteps,
    ...state.scan_found.map(id => ({ collection: "agentRuns" as const, field: "__name__", value: id }))];
  const counts: PassCounts = { examined: 0, redacted: emptyCounts(), already_redacted: 0, replay_copies_redacted: 0,
    evidence_objects_deleted: 0, evidence_unreadable: 0, other_rows_unreadable: 0, rows_failed: 0, objects_failed: 0,
    objects_remaining: 0, failed_row_ids: [] };
  state.scans ??= initialScans();
  const finishDependents = (runId: string, returnTo: "steps" | ScanName | undefined) => {
    if (!returnTo || returnTo === "steps") state.cursor = runId; else state.scans[returnTo].cursor = runId;
    state.dependents = null;
  };
  const followRun = (doc: FirebaseFirestore.QueryDocumentSnapshot, returnTo: "steps" | ScanName) => {
    // The run is the job's: its session, events, checkpoints, compactions, replay copies and logs follow.
    state.dependents = { runId: doc.id, steps: dependentSteps(doc.id, doc.data() as Record<string, unknown>), step: 0, cursor: null, returnTo };
  };
  while (counts.examined < budget) {
    if (state.dependents) {
      const dependents = state.dependents;
      const step = dependents.steps[dependents.step];
      if (!step) { finishDependents(dependents.runId, dependents.returnTo); continue; }
      const limit = budget - counts.examined;
      const docs = await page(step, dependents.cursor, limit);
      for (const doc of docs) {
        await visitRow(step.collection, doc.ref, step.mode ?? "full", marker, requestId, deps, counts);
        dependents.cursor = doc.id;
      }
      if (docs.length < limit) { dependents.step++; dependents.cursor = null; }
      continue;
    }
    const step = allSteps()[state.step];
    if (step) {
      // The job's findable rows first, every sweep.
      const [doc] = await page(step, state.cursor, 1);
      if (!doc) { state.step++; state.cursor = null; continue; }
      const visit = await visitRow("agentRuns", doc.ref, "full", marker, requestId, deps, counts);
      if (visit === "redacted" || visit === "already") followRun(doc, "steps"); else state.cursor = doc.id;
      continue;
    }
    // Then the scans, once per job.
    const scanName = (["offloaded", "site_assessment"] as ScanName[]).find(name => !state.scans[name].done);
    if (!scanName) break;
    const scan = state.scans[scanName];
    const limit = budget - counts.examined;
    const docs = await page({ collection: "agentRuns", ...SCANS[scanName] }, scan.cursor, limit);
    let followed = false;
    for (const doc of docs) {
      counts.examined++;
      scan.cursor = doc.id;
      if (!(await scannedRowIsJobs(scanName, doc, requestId, counts))) continue;
      if (!state.scan_found.includes(doc.id)) state.scan_found.push(doc.id);
      const visit = await visitRow("agentRuns", doc.ref, "full", marker, requestId, deps, counts, false);
      if (visit === "redacted" || visit === "already") { followRun(doc, scanName); followed = true; break; }
    }
    if (!followed && docs.length < limit) scan.done = true;
  }
  for (const key of Object.keys(counts.redacted) as Collection[]) state.redacted[key] += counts.redacted[key];
  state.already_redacted += counts.already_redacted;
  state.replay_copies_redacted += counts.replay_copies_redacted;
  state.evidence_objects_deleted += counts.evidence_objects_deleted;
  state.evidence_unreadable += counts.evidence_unreadable;
  state.other_rows_unreadable = Number(state.other_rows_unreadable || 0) + counts.other_rows_unreadable;
  state.sweep.rows_failed += counts.rows_failed;
  state.sweep.objects_failed += counts.objects_failed;
  state.sweep.objects_remaining += counts.objects_remaining;
  state.sweep.failed_row_ids = [...state.sweep.failed_row_ids, ...counts.failed_row_ids].slice(0, MAX_FAILED_IDS);
  const exhausted = !state.dependents && state.step >= allSteps().length && state.scans.offloaded.done && state.scans.site_assessment.done;
  return { pass: counts, exhausted };
}

async function captureIdsFor(requestId: string) {
  const rows = await db!.collection("captureSupplements").where("requestId", "==", requestId).get();
  return [`walkthrough-${requestId}`, ...rows.docs.filter(row => row.data()?.sceneId === `site-${requestId}`).map(row => row.id)];
}

function withdrawnAt(requestId: string, record: Record<string, any> | undefined): number | null {
  if (!record || record.consent_revoked !== true || !record.capture_withdrawal) return null;
  try { websiteWithdrawalCommand(requestId, record.capture_withdrawal); } catch { return null; }
  return Date.parse(record.capture_withdrawal.requestedAtIso);
}

let backfillDone = false;
/**
 * One-off: queue jobs withdrawn before this change, a bounded number per tick, with a cursor and a completion marker
 * kept in MODEL_RUN_REDACTION_BACKFILL_DOC. Once finished, this process stops reading it.
 */
async function backfillWithdrawnJobs(limit: number) {
  if (backfillDone) return;
  const [collection, id] = MODEL_RUN_REDACTION_BACKFILL_DOC.split("/");
  const markerRef = db!.collection(collection).doc(id);
  const markerDoc = (await markerRef.get()).data();
  if (markerDoc?.done === true) { backfillDone = true; return; }
  let query = db!.collection("inboundRequests").where("consent_revoked", "==", true).orderBy(DOCUMENT_ID).limit(limit);
  if (typeof markerDoc?.cursor === "string") query = query.startAfter(markerDoc.cursor);
  const rows = await query.get();
  for (const row of rows.docs) {
    const data = row.data();
    if (data?.[MODEL_RUN_REDACTION_FIELD] || data?.[MODEL_RUN_REDACTION_PENDING] !== undefined) continue;
    const requestedAtMs = withdrawnAt(row.id, data);
    if (requestedAtMs === null) continue;
    await db!.runTransaction(async tx => {
      const current = (await tx.get(row.ref)).data();
      if (!current) return;
      queueWebsiteJobModelRunRedaction(tx, row.ref, current, requestedAtMs);
    });
  }
  const done = rows.docs.length < limit;
  await markerRef.set({ cursor: rows.docs.at(-1)?.id ?? markerDoc?.cursor ?? null, done,
    ...(done ? { completed_at_iso: new Date().toISOString() } : {}) }, { merge: true });
  if (done) backfillDone = true;
}

async function claim(ref: FirebaseFirestore.DocumentReference, deps: RedactionDeps) {
  return db!.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    const state = record?.[MODEL_RUN_REDACTION_FIELD] as ModelRunRedactionState | undefined;
    if (!record || record[MODEL_RUN_REDACTION_PENDING] !== true || !state || state.phase === "done") return null;
    const requestedAtMs = withdrawnAt(ref.id, record);
    if (requestedAtMs === null) return null;
    const now = deps.now();
    if (Number(state.leaseUntilMs || 0) > now || Number(state.nextAttemptAtMs || 0) > now) return null;
    // The object deletion's own gate: never under a legal hold, and not before the deletion may delete.
    const gate = withdrawalDeletionGate(record.capture_withdrawal, requestedAtMs, now, deps.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS);
    if (gate.state !== "allowed") {
      tx.set(ref, { [MODEL_RUN_REDACTION_FIELD]: { ...state, held: gate.state === "held",
        nextAttemptAtMs: gate.state === "held" ? now + LEGAL_HOLD_RECHECK_MS : gate.untilMs } }, { merge: true });
      return null;
    }
    const lease = `${now}-${Math.random().toString(36).slice(2)}`;
    const claimed = { ...state, held: false, lease, leaseUntilMs: now + LEASE_MS, sweep: state.sweep ?? emptySweep() };
    tx.set(ref, { [MODEL_RUN_REDACTION_FIELD]: claimed }, { merge: true });
    return { lease, state: claimed as ModelRunRedactionState };
  });
}

/** One bounded pass for one claimed job; records its receipt and the new state. */
async function runPass(ref: FirebaseFirestore.DocumentReference, claimed: { lease: string; state: ModelRunRedactionState }, deps: RedactionDeps) {
  const requestId = ref.id;
  const state = claimed.state;
  const startedAtIso = new Date(deps.now()).toISOString();
  let outcome: "partial" | "awaiting_horizon" | "sweep_repeated" | "complete" | "failed" = "failed";
  let pass: PassCounts | null = null;
  let sweepRows = 0, sweepObjects = 0;
  try {
    if (state.step === 0 && state.cursor === null && !state.dependents) state.sweep = { ...emptySweep(), started_at_ms: deps.now() };
    const result = await redactJobModelRunsPass(requestId, await captureIdsFor(requestId), state, deps);
    pass = result.pass;
    state.passes++;
    state.attempts = 0;
    sweepRows = state.sweep.rows_failed; sweepObjects = state.sweep.objects_failed + state.sweep.objects_remaining;
    if (!result.exhausted) outcome = "partial";
    else if (sweepRows > 0 || sweepObjects > 0) {
      // Something was left this sweep: everything else is done, and the sweep runs again after a backoff.
      state.step = 0; state.cursor = null; state.sweep_repeats = Number(state.sweep_repeats || 0) + 1; outcome = "sweep_repeated";
    } else if (Number(state.sweep.started_at_ms) >= state.horizon_at_ms) outcome = "complete";
    else { state.phase = "final_sweep"; state.step = 0; state.cursor = null; state.sweep_repeats = 0; outcome = "awaiting_horizon"; }
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    state.attempts = Number(state.attempts || 0) + 1;
    logger.error({ requestId, code: typeof code === "string" ? code : "model_run_redaction_failed" }, "Model-run redaction pass will retry");
  }
  const now = deps.now();
  const body = { schema_version: "website_capture_model_run_redaction_receipt.v2", request_id: requestId,
    pass: state.passes, outcome, rows_examined: pass?.examined ?? 0, rows_redacted: pass?.redacted ?? emptyCounts(),
    rows_already_redacted: pass?.already_redacted ?? 0, replay_copies_redacted: pass?.replay_copies_redacted ?? 0,
    evidence_objects_deleted: pass?.evidence_objects_deleted ?? 0, evidence_unreadable: pass?.evidence_unreadable ?? 0,
    other_rows_unreadable: pass?.other_rows_unreadable ?? 0,
    rows_remaining: sweepRows, evidence_objects_remaining: sweepObjects, totals_redacted: state.redacted,
    started_at_iso: startedAtIso, completed_at_iso: new Date(now).toISOString() };
  const receiptId = `${requestId}-model-runs-${state.passes}-${outcome}-${state.attempts}`;
  await db!.collection(MODEL_RUN_REDACTION_RECEIPTS_COLLECTION).doc(receiptId)
    .set({ ...body, digest: canonicalArtifactDigest(body, "digest") });
  if (outcome === "complete") { state.phase = "done"; state.completed_at_iso = new Date(now).toISOString(); }
  const backoff = (count: number) => Math.min(MAX_BACKOFF_MS, 60_000 * 2 ** Math.max(0, count - 1));
  state.nextAttemptAtMs = outcome === "failed" ? now + backoff(state.attempts)
    : outcome === "sweep_repeated" ? now + backoff(state.sweep_repeats)
    : outcome === "awaiting_horizon" ? state.horizon_at_ms : 0;
  await db!.runTransaction(async tx => {
    const current = (await tx.get(ref)).data()?.[MODEL_RUN_REDACTION_FIELD];
    if (current?.lease !== claimed.lease) return;
    // Only the most recent receipts are listed on the job; every receipt stays in its own collection.
    const receiptIds = [...(Array.isArray(current.receiptIds) ? current.receiptIds : []), receiptId].slice(-20);
    tx.set(ref, { [MODEL_RUN_REDACTION_FIELD]: { ...state, lease: null, leaseUntilMs: 0, receiptIds },
      ...(state.phase === "done" ? { [MODEL_RUN_REDACTION_PENDING]: false } : {}) }, { merge: true });
  });
  return outcome;
}

let pendingCursor: string | null = null;
/** One bounded tick: the one-off backfill while it runs, then one pass for each due job, a bounded number of jobs. */
export async function runWebsiteJobModelRunRedactions(params: { limit?: number; deps: RedactionDeps }) {
  const summary = { examined: 0, passes: 0 };
  if (!db) return summary;
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  await backfillWithdrawnJobs(limit).catch(() => logger.warn("Withdrawn-job model-run backfill will retry"));
  let query = db.collection("inboundRequests").where(MODEL_RUN_REDACTION_PENDING, "==", true).orderBy(DOCUMENT_ID).limit(limit);
  if (pendingCursor) query = query.startAfter(pendingCursor);
  const rows = await query.get();
  pendingCursor = rows.docs.length === limit ? rows.docs.at(-1)!.id : null;
  for (const row of rows.docs) {
    summary.examined++;
    try {
      const claimed = await claim(row.ref, params.deps);
      if (!claimed) continue;
      await runPass(row.ref, claimed, params.deps);
      summary.passes++;
    } catch {
      logger.error({ requestId: row.id }, "Model-run redaction remains pending");
    }
  }
  return summary;
}

export function resetWebsiteJobModelRunRedactionCursorsForTests() {
  backfillDone = false;
  pendingCursor = null;
}

