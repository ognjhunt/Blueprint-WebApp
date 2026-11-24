import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { captureLifecycleNoticeSettings } from "./captureLifecycleForwarding";

/**
 * Liveness of the background worker (`blueprint-webapp-worker`).
 *
 * The worker writes one Firestore doc every minute. The web process reads it:
 * the beta ops monitor alerts when it goes stale, and `GET /health/worker`
 * answers 503 so the external uptime probe fails too. Render's own health
 * check cannot do this, because a Render worker serves no HTTP.
 *
 * Only a deployed, non-preview worker writes: a pull-request preview or a
 * local worker shares the production Firestore and would otherwise keep the
 * heartbeat fresh while the real worker is down.
 */

export const OPS_HEARTBEAT_COLLECTION = "opsHeartbeats";
export const WORKER_HEARTBEAT_DOC = "blueprint-webapp-worker";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_STALE_AFTER_MS = 5 * 60_000;

type HeartbeatDocRef = {
  set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown>;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
};
export type HeartbeatStore = { collection: (name: string) => { doc: (id: string) => HeartbeatDocRef } };

export type WorkerHeartbeatStatus = "fresh" | "stale" | "missing" | "unavailable";
/** What the worker said, at its last beat, about the settings its withdrawal notice needs; null when it said nothing. */
export type WorkerWithdrawalNoticeReport = { addressConfigured: boolean; tokenConfigured: boolean } | null;
export type WorkerHeartbeatReading = {
  status: WorkerHeartbeatStatus;
  ageMs: number | null;
  staleAfterMs: number;
  beatAtIso: string | null;
  revision: string | null;
  withdrawalNotice?: WorkerWithdrawalNoticeReport;
};

function defaultStore(): HeartbeatStore | null {
  return dbAdmin as unknown as HeartbeatStore | null;
}

function heartbeatRef(store: HeartbeatStore, doc: string = WORKER_HEARTBEAT_DOC) {
  return store.collection(OPS_HEARTBEAT_COLLECTION).doc(doc);
}

/**
 * Each worker loop also records when its last pass finished, at
 * opsHeartbeats/blueprint-webapp-worker--<loop>, so one loop that hangs or
 * keeps failing is seen while the process itself still beats. The value is
 * the loop's normal interval.
 */
export const WORKER_LOOPS = {
  "automatic-send": 60_000,
  "outcome-questions": 15 * 60_000,
  withdrawal: 60_000,
  deletion: 60_000,
  "window-sweep": 60_000,
} as const;
export type WorkerLoop = keyof typeof WORKER_LOOPS;

export function workerLoopHeartbeatDoc(loop: WorkerLoop) {
  return `${WORKER_HEARTBEAT_DOC}--${loop}`;
}

/** A loop is overdue after three of its intervals, and never sooner than the worker heartbeat. */
export function workerLoopStaleAfterMs(loop: WorkerLoop) {
  return Math.max(workerHeartbeatStaleAfterMs(), 3 * WORKER_LOOPS[loop]);
}


export function workerHeartbeatStaleAfterMs() {
  const configured = Number(process.env.BLUEPRINT_WORKER_HEARTBEAT_STALE_AFTER_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_STALE_AFTER_MS;
}

/** Whether this process is the deployed worker whose heartbeat counts. */
export function workerHeartbeatWriterEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.IS_PULL_REQUEST?.trim().toLowerCase() === "true") return false;
  if (["0", "false", "no", "off"].includes(String(env.BLUEPRINT_WORKER_HEARTBEAT_ENABLED || "").trim().toLowerCase())) return false;
  return env.NODE_ENV === "production";
}

export async function writeWorkerHeartbeat(options: { store?: HeartbeatStore | null; now?: () => number; startedAtIso?: string;
  env?: NodeJS.ProcessEnv } = {}) {
  const store = options.store === undefined ? defaultStore() : options.store;
  if (!store) return false;
  const nowMs = (options.now || Date.now)();
  const revision = process.env.RENDER_GIT_COMMIT;
  await heartbeatRef(store).set({
    service: WORKER_HEARTBEAT_DOC,
    beat_at_ms: nowMs,
    beat_at_iso: new Date(nowMs).toISOString(),
    started_at_iso: options.startedAtIso ?? null,
    revision: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null,
    pid: process.pid,
    // The worker sends a site's withdrawal to the Pipeline; the web process cannot see the worker's settings, so the
    // worker says whether it has what the notice needs (never a value). Readiness names a missing one.
    withdrawal_notice: (({ addressConfigured, tokenConfigured }) => ({ pipeline_address_configured: addressConfigured,
      signing_token_configured: tokenConfigured }))(captureLifecycleNoticeSettings(options.env ?? process.env)),
  }, { merge: true });
  return true;
}

/** Record that one pass of a worker loop finished. Never throws. */
export async function recordWorkerLoopPass(
  loop: WorkerLoop,
  options: { store?: HeartbeatStore | null; now?: () => number; env?: NodeJS.ProcessEnv } = {},
) {
  if (!workerHeartbeatWriterEnabled(options.env)) return false;
  const store = options.store === undefined ? defaultStore() : options.store;
  if (!store) return false;
  const nowMs = (options.now || Date.now)();
  try {
    await heartbeatRef(store, workerLoopHeartbeatDoc(loop)).set({
      service: WORKER_HEARTBEAT_DOC,
      loop,
      beat_at_ms: nowMs,
      beat_at_iso: new Date(nowMs).toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    logger.warn({ err: error, event: "worker_loop_heartbeat_write_failed", loop }, "Could not record a worker loop pass");
    return false;
  }
}

/** Start beating. Returns a stop function. */
export function startWorkerHeartbeat(options: { intervalMs?: number; store?: HeartbeatStore | null } = {}): () => void {
  if (!workerHeartbeatWriterEnabled()) {
    logger.info({ event: "worker_heartbeat_disabled" }, "Worker heartbeat not written by this process");
    return () => undefined;
  }
  const startedAtIso = new Date().toISOString();
  const beat = () => writeWorkerHeartbeat({ store: options.store, startedAtIso })
    .catch((error) => logger.warn({ err: error, event: "worker_heartbeat_write_failed" }, "Could not write the worker heartbeat"));
  void beat();
  const timer = setInterval(beat, Math.max(10_000, options.intervalMs ?? DEFAULT_INTERVAL_MS));
  timer.unref?.();
  logger.info({ event: "worker_heartbeat_started" }, "Worker heartbeat started");
  return () => clearInterval(timer);
}

export async function readWorkerHeartbeat(options: { store?: HeartbeatStore | null; now?: () => number; staleAfterMs?: number; doc?: string } = {}): Promise<WorkerHeartbeatReading> {
  const store = options.store === undefined ? defaultStore() : options.store;
  const staleAfterMs = options.staleAfterMs ?? workerHeartbeatStaleAfterMs();
  const empty = { ageMs: null, staleAfterMs, beatAtIso: null, revision: null, withdrawalNotice: null };
  if (!store) return { status: "unavailable", ...empty };
  let snapshot: Awaited<ReturnType<HeartbeatDocRef["get"]>>;
  try {
    snapshot = await heartbeatRef(store, options.doc).get();
  } catch (error) {
    logger.warn({ err: error, event: "worker_heartbeat_read_failed" }, "Could not read the worker heartbeat");
    return { status: "unavailable", ...empty };
  }
  const data = snapshot.exists ? snapshot.data() || {} : null;
  const beatAtMs = Number(data?.beat_at_ms);
  if (!data || !Number.isFinite(beatAtMs)) return { status: "missing", ...empty };
  const ageMs = Math.max(0, (options.now || Date.now)() - beatAtMs);
  return {
    status: ageMs <= staleAfterMs ? "fresh" : "stale",
    ageMs,
    staleAfterMs,
    beatAtIso: typeof data.beat_at_iso === "string" ? data.beat_at_iso : null,
    revision: typeof data.revision === "string" ? data.revision : null,
    withdrawalNotice: withdrawalNoticeReport(data.withdrawal_notice),
  };
}

function withdrawalNoticeReport(value: unknown): WorkerWithdrawalNoticeReport {
  const report = value as Record<string, unknown> | null | undefined;
  if (!report || typeof report !== "object" || typeof report.pipeline_address_configured !== "boolean"
    || typeof report.signing_token_configured !== "boolean") return null;
  return { addressConfigured: report.pipeline_address_configured, tokenConfigured: report.signing_token_configured };
}
