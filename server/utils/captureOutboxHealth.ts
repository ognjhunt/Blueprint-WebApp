import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { undeliveredAgeMs, unknownRowState } from "./captureOutboxRetry";

/**
 * Counts and ages of the customer email outbox. Read-only, and numbers only:
 * no recipient, request or message is read out of a row.
 *
 * The beta ops monitor alerts from it, and `GET /health/outbox` answers from it
 * so the external uptime probe fails when site email has stopped moving even
 * if this process's own alerting has stopped too.
 */

const CAPTURE_OUTBOX_COLLECTION = "captureOutbox";
/** `unknown` rows read per pass. Rows that need a person stay in that status, so this is not a small set forever. */
const UNKNOWN_READ_LIMIT = 200;

export type OutboxHealthStore = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      limit: (n: number) => { get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> | undefined }> }> };
    };
  };
};

export type OutboxDeliveryHealth = {
  /** Rows in `pending`. */
  pending: number;
  /** Rows the pump still owes a delivery: pending, claimed, dispatching, and unknown rows being re-sent. */
  undelivered: number;
  /** Age of the oldest of those since its intent was written, or null when there are none. */
  oldestUndeliveredAgeMs: number | null;
  /** `unknown` rows being re-sent with their provider idempotency key. */
  unknownRetrying: number;
  /** `unknown` rows that are not sent again automatically. */
  unknownNeedsPerson: number;
};

/** Reads at most `maxPerStatus` rows of each waiting status; below that the counts and the oldest age are exact. */
export async function readOutboxDeliveryHealth(store: OutboxHealthStore, nowMs: number, maxPerStatus: number): Promise<OutboxDeliveryHealth> {
  const read = async (status: string, limit: number) =>
    (await store.collection(CAPTURE_OUTBOX_COLLECTION).where("status", "==", status).limit(limit).get())
      .docs.map((doc) => doc.data() || {});
  const [pending, claimed, dispatching, unknown] = await Promise.all([
    read("pending", maxPerStatus), read("claimed", maxPerStatus), read("dispatching", maxPerStatus), read("unknown", UNKNOWN_READ_LIMIT),
  ]);
  const retrying = unknown.filter((row) => unknownRowState(row, nowMs) === "retrying");
  const waiting = [...pending, ...claimed, ...dispatching, ...retrying];
  const ages = waiting.map((row) => undeliveredAgeMs(row, nowMs)).filter((age) => Number.isFinite(age));
  return {
    pending: pending.length,
    undelivered: waiting.length,
    oldestUndeliveredAgeMs: ages.length ? Math.max(...ages) : null,
    unknownRetrying: retrying.length,
    unknownNeedsPerson: unknown.length - retrying.length,
  };
}

export type OutboxStallReading = {
  status: "moving" | "stalled" | "unavailable";
  oldestUndeliveredAgeMs: number | null;
  stalledAfterMs: number;
};

/**
 * The in-process alert fires at 30 minutes (BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS).
 * This is the outside backstop for when that alert cannot be delivered, so it
 * waits longer: 2 hours unless BLUEPRINT_OUTBOX_HEALTH_STALLED_AGE_MS says otherwise.
 */
export function outboxStalledAfterMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.BLUEPRINT_OUTBOX_HEALTH_STALLED_AGE_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? Math.floor(configured) : 2 * 60 * 60 * 1000;
}

/** Whether the oldest undelivered customer email has waited too long. An unreadable outbox is `unavailable`, not `moving`. */
export async function readOutboxStall(options: { store?: OutboxHealthStore | null; now?: () => number } = {}): Promise<OutboxStallReading> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxHealthStore | null) : options.store;
  const stalledAfterMs = outboxStalledAfterMs();
  if (!store) return { status: "unavailable", oldestUndeliveredAgeMs: null, stalledAfterMs };
  try {
    const { oldestUndeliveredAgeMs } = await readOutboxDeliveryHealth(store, (options.now || Date.now)(), 50);
    return {
      status: oldestUndeliveredAgeMs !== null && oldestUndeliveredAgeMs >= stalledAfterMs ? "stalled" : "moving",
      oldestUndeliveredAgeMs,
      stalledAfterMs,
    };
  } catch {
    return { status: "unavailable", oldestUndeliveredAgeMs: null, stalledAfterMs };
  }
}
