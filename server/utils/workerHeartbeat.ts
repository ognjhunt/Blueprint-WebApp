import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

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
export type WorkerHeartbeatReading = {
  status: WorkerHeartbeatStatus;
  ageMs: number | null;
  staleAfterMs: number;
  beatAtIso: string | null;
  revision: string | null;
};

function defaultStore(): HeartbeatStore | null {
  return dbAdmin as unknown as HeartbeatStore | null;
}

function heartbeatRef(store: HeartbeatStore) {
  return store.collection(OPS_HEARTBEAT_COLLECTION).doc(WORKER_HEARTBEAT_DOC);
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

export async function writeWorkerHeartbeat(options: { store?: HeartbeatStore | null; now?: () => number; startedAtIso?: string } = {}) {
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
  }, { merge: true });
  return true;
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

export async function readWorkerHeartbeat(options: { store?: HeartbeatStore | null; now?: () => number; staleAfterMs?: number } = {}): Promise<WorkerHeartbeatReading> {
  const store = options.store === undefined ? defaultStore() : options.store;
  const staleAfterMs = options.staleAfterMs ?? workerHeartbeatStaleAfterMs();
  const empty = { ageMs: null, staleAfterMs, beatAtIso: null, revision: null };
  if (!store) return { status: "unavailable", ...empty };
  let snapshot: Awaited<ReturnType<HeartbeatDocRef["get"]>>;
  try {
    snapshot = await heartbeatRef(store).get();
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
  };
}
