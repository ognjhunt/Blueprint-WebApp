import { createHash, createHmac } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

/**
 * Durable per-UTC-day counters, shared by every instance and every restart.
 *
 * The in-memory limiters in front of anonymous routes reset when the single
 * Render instance restarts, so they bound bursts, not days. These counters live
 * in Firestore and are checked and incremented in one transaction, so a cap
 * holds across restarts and across instances.
 *
 * - A counter is keyed by (cap name, UTC day, optional subject). A subject (an
 *   IP address, an email address, a job id) is never stored or used as a key in
 *   the clear: it is keyed by an HMAC under a server-side secret, so the
 *   counters hold no raw PII and cannot be enumerated back to a person.
 * - Several caps are consumed together, all or nothing: a request refused by
 *   its per-IP cap does not use up the global cap.
 * - An idempotency key makes a consumption count once per UTC day. A retried
 *   request with the same key is admitted without being charged again.
 * - Every document carries `expires_at` for the Firestore TTL policy applied
 *   by `scripts/apply_firestore_ttl_policies.sh`.
 *
 * When Firestore is missing or a transaction fails, `failClosed` decides. A
 * fail-closed caller is refused (`store_unavailable`); otherwise the call falls
 * back to an in-process counter, which is what local development and tests run
 * on. Callers that guard spend fail closed in production.
 */

export const DURABLE_DAILY_CAPS_COLLECTION = "durableDailyCaps";
export const DURABLE_DAILY_CAP_RECEIPTS_COLLECTION = "durableDailyCapReceipts";

/** Counters and receipts are kept this many days past their UTC day, then TTL-deleted. */
const RETENTION_DAYS = 8;
const STORE_UNAVAILABLE_RETRY_AFTER_SECONDS = 60;
const LOCAL_MAX_ENTRIES = 20_000;
const CAP_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const SUBJECT_KEY_LABEL = "blueprint.durable-daily-caps.subject.v1";

type DocRef = { id: string };
type Snapshot = { exists?: boolean; data(): Record<string, unknown> | undefined };
type Tx = {
  get(ref: any): Promise<Snapshot>;
  set(ref: any, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
};
/** The slice of Firestore this module uses; the in-memory test fake satisfies it. */
export type DailyCapStore = {
  collection(name: string): { doc(id: string): DocRef };
  runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
};

export type DailyCapSpec = {
  /** Lower-case snake case, stable: it is part of the stored key. */
  name: string;
  /** Units per UTC day. 0 closes the cap. */
  limit: number;
  /** Optional raw subject (IP, email, job id). HMAC-keyed, never stored. */
  subject?: string | null;
};

export type DailyCapAllowed = {
  allowed: true;
  day: string;
  /** False when an earlier consumption with the same idempotency key already counted today. */
  counted: boolean;
  /** True when the in-process fallback answered instead of Firestore. */
  degraded: boolean;
};
export type DailyCapDenied =
  | { allowed: false; day: string; reason: "limit_reached"; cap: string; used: number; limit: number; retryAfterSeconds: number }
  | { allowed: false; day: string; reason: "store_unavailable"; cap: null; retryAfterSeconds: number };
export type DailyCapDecision = DailyCapAllowed | DailyCapDenied;

export type DailyCapOptions = {
  /** Injected for tests. `null` means "no store"; undefined means Firebase Admin. */
  store?: DailyCapStore | null;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
};

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Seconds until the next UTC midnight, never less than one. */
export function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function expiresAt(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) + (RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
}

function subjectSecret(env: NodeJS.ProcessEnv): string {
  // Reuses the server's existing signing secret, domain-separated below, so no
  // new secret has to be provisioned. Without one, production refuses rather
  // than keying subjects with a guessable constant.
  const secret = env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim()
    || env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim()
    || env.PIPELINE_SYNC_TOKEN?.trim();
  if (secret) return secret;
  if (env.NODE_ENV === "production") throw new Error("daily_cap_subject_secret_required");
  return "blueprint-durable-daily-caps-dev-secret";
}

/** HMAC of a subject under a key derived for this purpose only. */
export function dailyCapSubjectKey(capName: string, subject: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = createHmac("sha256", subjectSecret(env)).update(SUBJECT_KEY_LABEL).digest();
  return createHmac("sha256", key).update(`${capName}\u0000${subject}`).digest("hex").slice(0, 40);
}

function counterId(cap: DailyCapSpec, day: string, env: NodeJS.ProcessEnv): { id: string; subjectKey: string | null } {
  const subject = typeof cap.subject === "string" ? cap.subject.trim() : "";
  const subjectKey = subject ? dailyCapSubjectKey(cap.name, subject, env) : null;
  return { id: subjectKey ? `${cap.name}__${day}__${subjectKey}` : `${cap.name}__${day}`, subjectKey };
}

function receiptId(scope: string, day: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${scope}\u0000${day}\u0000${idempotencyKey}`).digest("hex");
}

function validate(caps: DailyCapSpec[], amount: number) {
  if (!caps.length) throw new Error("daily_cap_specs_required");
  const names = new Set<string>();
  for (const cap of caps) {
    if (!CAP_NAME.test(cap.name)) throw new Error("daily_cap_name_invalid");
    if (!Number.isSafeInteger(cap.limit) || cap.limit < 0) throw new Error("daily_cap_limit_invalid");
    const key = `${cap.name}\u0000${cap.subject ?? ""}`;
    if (names.has(key)) throw new Error("daily_cap_duplicate");
    names.add(key);
  }
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("daily_cap_amount_invalid");
}

function defaultStore(): DailyCapStore | null {
  return dbAdmin && typeof dbAdmin.runTransaction === "function" ? (dbAdmin as unknown as DailyCapStore) : null;
}

/* ------------------------------------------------------------ in-process fallback */

const localUsed = new Map<string, number>();
const localReceipts = new Set<string>();

function pruneLocal(day: string) {
  if (localUsed.size + localReceipts.size <= LOCAL_MAX_ENTRIES) return;
  for (const key of [...localUsed.keys()]) if (!key.includes(`__${day}`)) localUsed.delete(key);
  for (const key of [...localReceipts]) if (!key.endsWith(`:${day}`)) localReceipts.delete(key);
}

export function __resetDurableDailyCapsForTests() {
  localUsed.clear();
  localReceipts.clear();
}

/* ------------------------------------------------------------ public API */

/**
 * Check and increment every cap in `caps` by `amount`, atomically.
 *
 * Refuses (without writing anything) when any one cap would exceed its limit.
 */
export async function consumeDailyCaps(input: {
  /** Namespace for idempotency receipts, e.g. "inbound_intake". */
  scope: string;
  caps: DailyCapSpec[];
  amount?: number;
  idempotencyKey?: string | null;
  failClosed: boolean;
}, options: DailyCapOptions = {}): Promise<DailyCapDecision> {
  const env = options.env ?? process.env;
  const now = options.now ? options.now() : new Date();
  const day = utcDay(now);
  const amount = input.amount ?? 1;
  validate(input.caps, amount);
  if (!CAP_NAME.test(input.scope)) throw new Error("daily_cap_scope_invalid");
  const retryAfterSeconds = secondsUntilNextUtcDay(now);
  const unavailable = (): DailyCapDenied => ({ allowed: false, day, reason: "store_unavailable", cap: null,
    retryAfterSeconds: STORE_UNAVAILABLE_RETRY_AFTER_SECONDS });

  let ids: Array<{ cap: DailyCapSpec; id: string; subjectKey: string | null }>;
  try {
    ids = input.caps.map((cap) => ({ cap, ...counterId(cap, day, env) }));
  } catch (error) {
    logger.error({ err: error, scope: input.scope }, "Daily cap subject keying unavailable");
    return unavailable();
  }
  const receipt = input.idempotencyKey ? receiptId(input.scope, day, input.idempotencyKey) : null;

  const local = (): DailyCapDecision => {
    pruneLocal(day);
    if (receipt && localReceipts.has(`${receipt}:${day}`)) return { allowed: true, day, counted: false, degraded: true };
    for (const { cap, id } of ids) {
      const used = localUsed.get(id) ?? 0;
      if (used + amount > cap.limit) {
        return { allowed: false, day, reason: "limit_reached", cap: cap.name, used, limit: cap.limit, retryAfterSeconds };
      }
    }
    for (const { id } of ids) localUsed.set(id, (localUsed.get(id) ?? 0) + amount);
    if (receipt) localReceipts.add(`${receipt}:${day}`);
    return { allowed: true, day, counted: true, degraded: true };
  };

  const store = options.store === undefined ? defaultStore() : options.store;
  if (!store) {
    if (input.failClosed) {
      logger.error({ scope: input.scope }, "Daily cap store unavailable; refusing");
      return unavailable();
    }
    return local();
  }

  try {
    const collection = store.collection(DURABLE_DAILY_CAPS_COLLECTION);
    const refs = ids.map(({ id }) => collection.doc(id));
    const receiptRef = receipt ? store.collection(DURABLE_DAILY_CAP_RECEIPTS_COLLECTION).doc(receipt) : null;
    const decision = await store.runTransaction(async (tx): Promise<DailyCapDecision> => {
      const [receiptSnap, ...snaps] = await Promise.all([
        receiptRef ? tx.get(receiptRef) : Promise.resolve(null),
        ...refs.map((ref) => tx.get(ref)),
      ]);
      if (receiptSnap && (receiptSnap.exists ?? Boolean(receiptSnap.data()))) {
        return { allowed: true, day, counted: false, degraded: false };
      }
      const used = snaps.map((snap) => {
        const value = Number((snap.data() || {}).used);
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
      });
      for (const [index, { cap }] of ids.entries()) {
        if (used[index] + amount > cap.limit) {
          return { allowed: false, day, reason: "limit_reached", cap: cap.name, used: used[index], limit: cap.limit, retryAfterSeconds };
        }
      }
      const updatedAtIso = now.toISOString();
      for (const [index, { cap, subjectKey }] of ids.entries()) {
        tx.set(refs[index], { schema_version: "durable_daily_cap.v1", cap: cap.name, day, subject_key: subjectKey,
          used: used[index] + amount, limit: cap.limit, updated_at_iso: updatedAtIso, expires_at: expiresAt(day) }, { merge: true });
      }
      if (receiptRef) {
        tx.set(receiptRef, { schema_version: "durable_daily_cap_receipt.v1", scope: input.scope, day, amount,
          caps: ids.map(({ id }) => id), created_at_iso: updatedAtIso, expires_at: expiresAt(day) });
      }
      return { allowed: true, day, counted: true, degraded: false };
    });
    if (!decision.allowed && decision.reason === "limit_reached") {
      logger.warn({ scope: input.scope, cap: decision.cap, day, used: decision.used, limit: decision.limit },
        "Durable daily cap reached");
    }
    return decision;
  } catch (error) {
    if (input.failClosed) {
      logger.error({ err: error, scope: input.scope }, "Daily cap transaction failed; refusing");
      return unavailable();
    }
    logger.warn({ err: error, scope: input.scope }, "Daily cap transaction failed; using the in-process counter");
    return local();
  }
}

/**
 * Move one counter by `delta` (negative to release a reservation), floored at
 * zero and never checked against the limit: reconciliation records what was
 * actually spent, it does not ask permission. Returns false when it could not
 * be recorded; the caller's earlier, larger reservation then stands.
 */
export async function adjustDailyCap(input: { name: string; day: string; subject?: string | null; delta: number },
  options: DailyCapOptions = {}): Promise<boolean> {
  const env = options.env ?? process.env;
  if (!CAP_NAME.test(input.name) || !/^\d{4}-\d{2}-\d{2}$/.test(input.day) || !Number.isSafeInteger(input.delta)) {
    throw new Error("daily_cap_adjustment_invalid");
  }
  if (input.delta === 0) return true;
  let id: string, subjectKey: string | null;
  try {
    ({ id, subjectKey } = counterId({ name: input.name, limit: 0, subject: input.subject }, input.day, env));
  } catch (error) {
    logger.warn({ err: error, cap: input.name }, "Daily cap adjustment could not key its subject");
    return false;
  }
  const store = options.store === undefined ? defaultStore() : options.store;
  if (!store) {
    localUsed.set(id, Math.max(0, (localUsed.get(id) ?? 0) + input.delta));
    return true;
  }
  try {
    const ref = store.collection(DURABLE_DAILY_CAPS_COLLECTION).doc(id);
    await store.runTransaction(async (tx) => {
      const current = Number(((await tx.get(ref)).data() || {}).used);
      const used = Math.max(0, (Number.isSafeInteger(current) ? current : 0) + input.delta);
      tx.set(ref, { schema_version: "durable_daily_cap.v1", cap: input.name, day: input.day, subject_key: subjectKey,
        used, updated_at_iso: (options.now ? options.now() : new Date()).toISOString(), expires_at: expiresAt(input.day) },
      { merge: true });
    });
    return true;
  } catch (error) {
    logger.warn({ err: error, cap: input.name, day: input.day }, "Daily cap adjustment failed; the earlier reservation stands");
    return false;
  }
}

/** Read-only usage for today's counter, or null when it cannot be read. */
export async function readDailyCapUsage(input: { name: string; subject?: string | null },
  options: DailyCapOptions = {}): Promise<{ day: string; used: number } | null> {
  const env = options.env ?? process.env;
  const day = utcDay(options.now ? options.now() : new Date());
  let id: string;
  try {
    ({ id } = counterId({ name: input.name, limit: 0, subject: input.subject }, day, env));
  } catch {
    return null;
  }
  const store = options.store === undefined ? defaultStore() : options.store;
  if (!store) return { day, used: localUsed.get(id) ?? 0 };
  try {
    const ref = store.collection(DURABLE_DAILY_CAPS_COLLECTION).doc(id);
    const used = await store.runTransaction(async (tx) => Number(((await tx.get(ref)).data() || {}).used));
    return { day, used: Number.isSafeInteger(used) && used >= 0 ? used : 0 };
  } catch (error) {
    logger.warn({ err: error, cap: input.name }, "Daily cap usage could not be read");
    return null;
  }
}
