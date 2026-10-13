import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

/**
 * Admission control for the inbound-qualification LLM call that every
 * anonymous intake triggers.
 *
 * - BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED: on unless set to a falsy
 *   value ("0", "false", "no", "off"), which preserves today's behavior.
 * - BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT: runs admitted per UTC day
 *   (default 200). A durable Firestore counter is shared by every instance;
 *   without Firestore an in-process counter applies.
 *
 * Skipped requests keep `ops_automation.status: pending`, so a person or the
 * qualification loop can still pick them up.
 */

const COUNTER_COLLECTION = "opsUsageCounters";
const DEFAULT_DAILY_LIMIT = 200;

export type QualificationAdmission =
  | { allowed: true; used: number; limit: number; reason: null }
  | { allowed: false; used: number; limit: number; reason: "disabled" | "daily_limit_reached" };

export function inboundQualificationLlmEnabled(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.BLUEPRINT_INBOUND_QUALIFICATION_LLM_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

export function inboundQualificationDailyLimit(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.BLUEPRINT_INBOUND_QUALIFICATION_DAILY_LIMIT ?? "").trim();
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_DAILY_LIMIT;
}

const localCounts = new Map<string, number>();

export function __resetInboundQualificationGateForTests() {
  localCounts.clear();
}

type CounterStore = {
  collection: (name: string) => { doc: (id: string) => FirebaseFirestore.DocumentReference };
  runTransaction: <T>(fn: (tx: FirebaseFirestore.Transaction) => Promise<T>) => Promise<T>;
};

export async function admitInboundQualificationRun(options: {
  store?: CounterStore | null;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<QualificationAdmission> {
  const env = options.env || process.env;
  const limit = inboundQualificationDailyLimit(env);
  if (!inboundQualificationLlmEnabled(env) || limit === 0) {
    return { allowed: false, used: 0, limit, reason: "disabled" };
  }
  const day = (options.now ? options.now() : new Date()).toISOString().slice(0, 10);
  const counterId = `inbound_qualification_llm:${day}`;
  const store = options.store === undefined
    ? (dbAdmin && typeof dbAdmin.runTransaction === "function" ? (dbAdmin as unknown as CounterStore) : null)
    : options.store;

  const local = () => {
    const used = localCounts.get(counterId) || 0;
    if (used >= limit) return { allowed: false as const, used, limit, reason: "daily_limit_reached" as const };
    localCounts.set(counterId, used + 1);
    return { allowed: true as const, used: used + 1, limit, reason: null };
  };

  if (!store) return local();

  try {
    const ref = store.collection(COUNTER_COLLECTION).doc(counterId);
    return await store.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const used = Number((snapshot.data() || {}).count) || 0;
      if (used >= limit) {
        return { allowed: false as const, used, limit, reason: "daily_limit_reached" as const };
      }
      tx.set(ref, { count: used + 1, limit, day, updated_at_iso: new Date().toISOString() }, { merge: true });
      return { allowed: true as const, used: used + 1, limit, reason: null };
    });
  } catch (error) {
    logger.warn({ err: error }, "Inbound qualification counter unavailable; using the in-process daily cap");
    return local();
  }
}
