/**
 * What a robot team has, what is spoken for, and what it may still spend.
 *
 * ## Why a balance and not an invoice
 *
 * `episodePricing.ts` has published this model for a while — "add funds, screen
 * the checkpoints you want to put forward, top up when the balance gets low" —
 * and nothing implemented it. `episodeRate`, `quoteScreening` and
 * `episodesForBalance` appeared in exactly two files: the pricing module and the
 * pricing page. A revenue model with no collection mechanism.
 *
 * It matters more now than it did. The site side is free, so robot teams are the
 * only payer, and an agent spending on a team's behalf needs something it can
 * check before it acts. You cannot hand an autonomous agent an invoice.
 *
 * ## Reserve, then settle
 *
 * The primitive is a reservation, not a charge. An agent asks what a run costs,
 * the amount is held, the run happens, and only then does the hold become a
 * spend. That ordering is what makes autonomous spending safe:
 *
 * - **Reserve** moves money out of `available` without spending it. Two agents
 *   racing cannot both spend the last dollar, because the first reservation
 *   already removed it.
 * - **Settle** turns a hold into a spend, for the amount actually consumed,
 *   which may be less than reserved. Episodes that never ran are released.
 * - **Release** returns a hold untouched, for a run that never happened.
 *
 * This is also what `billingRules` already promises publicly: "the full quote is
 * shown and reserved before a run starts, unrun episodes are released."
 *
 * ## The ledger is append-only
 *
 * Balance is derived by replaying entries, never stored as a mutable number. A
 * stored total is a number that can drift from its own history and be wrong
 * silently; a derived one cannot. Every entry carries an idempotency key, so an
 * agent that retries a call it never saw the answer to does not pay twice —
 * which for an autonomous spender is not an edge case, it is Tuesday.
 *
 * ## Failing closed
 *
 * Every read path that cannot establish the balance returns zero available
 * rather than throwing or assuming. An agent that cannot find out what it has
 * must not spend.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { verifyEvalPlanToken } from "./evalPlanToken";
import { buildRequestedRunRecord, reservationTtlMs, type EvalRunRecord } from "./agentRunRecord";

const LEDGER_COLLECTION = "robotTeamLedger";
const POLICY_COLLECTION = "robotTeamSpendPolicy";

export type LedgerEntryKind =
  /** Money added. The only entry that increases what a team can spend. */
  | "credit"
  /** Held against a quoted run. Leaves `available`, not yet spent. */
  | "reserve"
  /** A hold consumed. `amountUsd` may be less than the reservation. */
  | "settle"
  /** A hold returned in full. The run did not happen. */
  | "release";

export interface LedgerEntry {
  entryId: string;
  teamId: string;
  kind: LedgerEntryKind;
  amountUsd: number;
  /** Ties `settle`/`release` back to the `reserve` they resolve. */
  reservationId: string | null;
  /** What this was for, in a form a person reading the ledger can follow. */
  reason: string;
  /** A retried call with the same key is a no-op, not a second movement. */
  idempotencyKey: string;
  createdAtIso: string;
}

export interface TeamBalance {
  teamId: string;
  /** Everything ever credited. */
  creditedUsd: number;
  /** Everything actually consumed. */
  spentUsd: number;
  /** Held against runs that have neither settled nor released. */
  reservedUsd: number;
  /** What an agent may commit right now. Never negative. */
  availableUsd: number;
  /**
   * Settlements that arrived after the reservation was already resolved, and
   * were therefore not charged.
   *
   * Financial finality and evidence are separate: a run that timed out and was
   * released, then reported late, keeps its result and costs the team nothing.
   * We absorb it. This is that number, surfaced rather than silently dropped,
   * because a cost we take on is still a cost somebody should be able to see.
   */
  absorbedUsd: number;
  /**
   * Committed money in excess of funded money. Should always be zero.
   *
   * `availableUsd` clamps at zero, which is right for an agent deciding whether
   * it may spend, and wrong as the only record: the reserve/release loop used to
   * show up here as a balance that stopped moving rather than as a breach. If
   * this is ever non-zero, an invariant has failed and the clamp is hiding it.
   */
  overdrawnUsd: number;
}

/**
 * The limits a team puts on its own agent.
 *
 * Separate from the balance on purpose. A balance answers "can this be paid
 * for"; a policy answers "should this be spent today, without asking me". A
 * team funding $5,000 and capping its agent at $100 a day is expressing two
 * different things, and collapsing them into one number loses the intent.
 */
export interface SpendPolicy {
  teamId: string;
  /** Hard ceiling on what the agent may commit in a UTC day. */
  dailyLimitUsd: number;
  /** Ceiling for any one run, so a single mistake is bounded. */
  perRunLimitUsd: number;
  /** False parks the agent without touching the balance. */
  agentSpendEnabled: boolean;
  updatedAtIso: string;
}

/** No policy on file means no autonomous spend. Opt in, never opt out. */
export const DEFAULT_SPEND_POLICY: Omit<SpendPolicy, "teamId" | "updatedAtIso"> = {
  dailyLimitUsd: 0,
  perRunLimitUsd: 0,
  agentSpendEnabled: false,
};

function nowIso() {
  return new Date().toISOString();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** UTC, so a team's day does not depend on where its agent is running. */
export function utcDayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

async function readEntries(teamId: string): Promise<LedgerEntry[]> {
  if (!db) return [];
  const snapshot = await db
    .collection(LEDGER_COLLECTION)
    .where("teamId", "==", teamId)
    .get();
  return snapshot.docs.map((doc) => doc.data() as LedgerEntry);
}

/**
 * Replay the ledger.
 *
 * A reservation counts against `available` until something resolves it, and a
 * settlement reduces the hold by whatever it consumed rather than by the amount
 * reserved — which is how a run that used fewer episodes than quoted gives the
 * remainder back without anyone doing arithmetic by hand.
 */
/** credit, then reserve, then whatever resolves it. Ties broken the same way twice. */
const KIND_REPLAY_RANK: Record<LedgerEntryKind, number> = {
  credit: 0,
  reserve: 1,
  settle: 2,
  release: 2,
};

/**
 * Put the ledger in the order it happened.
 *
 * `readEntries` runs a query with no `orderBy`, and Firestore answers one of
 * those in document-id order. The ids are `team:kind:reservation`, so for a
 * single reservation they sort `release` before `reserve` before `settle` --
 * alphabetically, which is to say meaninglessly. Every rule in the replay below
 * is order-dependent, and one of them is now "the first resolution wins", so
 * the order has to be stated rather than inherited from a key format.
 */
function inReplayOrder(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.createdAtIso !== b.createdAtIso) {
      return a.createdAtIso < b.createdAtIso ? -1 : 1;
    }
    const rank = KIND_REPLAY_RANK[a.kind] - KIND_REPLAY_RANK[b.kind];
    return rank !== 0 ? rank : a.entryId.localeCompare(b.entryId);
  });
}

export function deriveBalance(teamId: string, entries: readonly LedgerEntry[]): TeamBalance {
  let creditedUsd = 0;
  let spentUsd = 0;
  let absorbedUsd = 0;
  const openReservations = new Map<string, number>();
  /** Reservations a settle or a release has already closed. */
  const resolvedReservations = new Set<string>();

  for (const entry of inReplayOrder(entries)) {
    if (entry.kind === "credit") {
      creditedUsd += entry.amountUsd;
      continue;
    }
    if (entry.kind === "reserve") {
      const key = entry.reservationId || entry.entryId;
      openReservations.set(key, (openReservations.get(key) ?? 0) + entry.amountUsd);
      continue;
    }
    if (entry.kind === "settle") {
      const key = entry.reservationId || "";
      // A settle used to book spend unconditionally, which is how the balance
      // could go past what was funded: release the hold, reserve again, and the
      // late settlements all landed as real spend against money that had been
      // handed back. One resolution per reservation, and the first one wins.
      if (key && resolvedReservations.has(key)) {
        absorbedUsd += entry.amountUsd;
        continue;
      }
      spentUsd += entry.amountUsd;
      if (key) {
        resolvedReservations.add(key);
        // The whole hold clears, not just the settled portion: a run that
        // consumed less than quoted returns the difference.
        openReservations.delete(key);
      }
      continue;
    }
    if (entry.kind === "release") {
      const key = entry.reservationId || "";
      if (!key || resolvedReservations.has(key)) continue;
      resolvedReservations.add(key);
      openReservations.delete(key);
    }
  }

  const reservedUsd = [...openReservations.values()].reduce((sum, value) => sum + value, 0);
  const committedUsd = spentUsd + reservedUsd;

  return {
    teamId,
    creditedUsd: round2(creditedUsd),
    spentUsd: round2(spentUsd),
    reservedUsd: round2(reservedUsd),
    availableUsd: round2(Math.max(0, creditedUsd - committedUsd)),
    absorbedUsd: round2(absorbedUsd),
    overdrawnUsd: round2(Math.max(0, committedUsd - creditedUsd)),
  };
}

export async function getTeamBalance(teamId: string): Promise<TeamBalance> {
  // No store means no confirmed funds. An agent that cannot read its balance
  // must not spend, so the honest answer is zero rather than an exception the
  // caller might catch and shrug off.
  if (!db) {
    return {
      teamId,
      creditedUsd: 0,
      spentUsd: 0,
      reservedUsd: 0,
      availableUsd: 0,
      absorbedUsd: 0,
      overdrawnUsd: 0,
    };
  }
  const balance = deriveBalance(teamId, await readEntries(teamId));
  if (balance.overdrawnUsd > 0) {
    // Never expected. `availableUsd` would show this as zero and carry on, so
    // it is said out loud instead: committed money exceeds funded money, and
    // something upstream let it.
    logger.error(
      { teamId, balance },
      "Robot team balance is overdrawn: committed exceeds credited",
    );
  }
  return balance;
}

/** What the agent has already committed today, for the daily cap. */
export async function getSpendToday(teamId: string, day = utcDayKey()): Promise<number> {
  const entries = await readEntries(teamId);
  const committed = entries.filter(
    (entry) =>
      (entry.kind === "reserve" || entry.kind === "settle") &&
      entry.createdAtIso.slice(0, 10) === day,
  );
  // Reservations count against the cap the moment they are taken. A cap that
  // only counted settled spend would let an agent reserve the entire balance
  // before lunch and call it nothing.
  //
  // A settlement against a reservation is deliberately *not* added: the
  // reservation already counted, and counting both would charge the cap twice
  // for one run. Only a settlement with no reservation behind it — a direct
  // charge — adds anything here.
  return round2(
    committed
      .filter((entry) => entry.kind === "reserve" || !entry.reservationId)
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
}

export async function getSpendPolicy(teamId: string): Promise<SpendPolicy> {
  const fallback: SpendPolicy = {
    teamId,
    ...DEFAULT_SPEND_POLICY,
    updatedAtIso: nowIso(),
  };
  if (!db) return fallback;

  const snapshot = await db.collection(POLICY_COLLECTION).doc(teamId).get();
  if (!snapshot.exists) return fallback;

  const stored = snapshot.data() as Partial<SpendPolicy>;
  return {
    teamId,
    dailyLimitUsd: Number(stored.dailyLimitUsd) || 0,
    perRunLimitUsd: Number(stored.perRunLimitUsd) || 0,
    agentSpendEnabled: stored.agentSpendEnabled === true,
    updatedAtIso: String(stored.updatedAtIso || nowIso()),
  };
}

export async function setSpendPolicy(params: {
  teamId: string;
  dailyLimitUsd: number;
  perRunLimitUsd: number;
  agentSpendEnabled: boolean;
}): Promise<SpendPolicy> {
  const policy: SpendPolicy = {
    teamId: params.teamId,
    dailyLimitUsd: Math.max(0, round2(params.dailyLimitUsd)),
    perRunLimitUsd: Math.max(0, round2(params.perRunLimitUsd)),
    agentSpendEnabled: params.agentSpendEnabled,
    updatedAtIso: nowIso(),
  };
  if (db) {
    await db.collection(POLICY_COLLECTION).doc(params.teamId).set(policy, { merge: true });
  }
  return policy;
}

export type SpendRefusal =
  | "agent_spend_disabled"
  | "no_policy_configured"
  | "insufficient_balance"
  | "over_per_run_limit"
  | "over_daily_limit"
  | "ledger_unavailable"
  | "invalid_approval"
  | "idempotency_conflict";

export type SpendAuthorization =
  | { authorized: true; reservationId: string }
  | { authorized: false; refusal: SpendRefusal; detail: string };

/**
 * Everything that must be true before an agent commits a team's money.
 *
 * Order matters for the message the agent gets back. "Your agent is switched
 * off" is a different problem from "you are out of money", and an agent that
 * cannot tell them apart will retry the wrong one forever.
 */
export async function authorizeAgentSpend(params: {
  teamId: string;
  amountUsd: number;
  reason: string;
  idempotencyKey: string;
  confirmedPlan?: { token: string; checkpointId: string; sceneId: string };
  requestedRun?: Pick<EvalRunRecord, "checkpointId" | "sceneId" | "taskFamily" | "quotedEpisodes" | "executionAdmission">;
}): Promise<SpendAuthorization> {
  if (!db) return { authorized: false, refusal: "ledger_unavailable", detail: "The ledger could not be read." };
  const amountUsd = round2(params.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { authorized: false, refusal: "invalid_approval", detail: "A positive quote is required." };
  if (params.confirmedPlan) {
    const lines = verifyEvalPlanToken(params.confirmedPlan.token, { teamId: params.teamId, checkpointId: params.confirmedPlan.checkpointId });
    if (!lines?.some(line => line.sceneId === params.confirmedPlan!.sceneId && line.costUsd === amountUsd)) {
      return { authorized: false, refusal: "invalid_approval", detail: "Review and approve a current plan before reserving funds." };
    }
  }
  const entryId = `${params.teamId}:${params.idempotencyKey}`;
  const reservationId = `res_${params.teamId}_${params.idempotencyKey}`;
  const ledgerRef = db.collection(LEDGER_COLLECTION).doc(entryId);
  const lockRef = db.collection("robotTeamLedgerLocks").doc(params.teamId);
  const policyRef = db.collection(POLICY_COLLECTION).doc(params.teamId);
  const ledgerQuery = db.collection(LEDGER_COLLECTION).where("teamId", "==", params.teamId);
  return db.runTransaction(async transaction => {
    // Every ledger writer takes this lock, including credits and resolutions.
    // Firestore retries this transaction if another writer changes the balance.
    const lock = await transaction.get(lockRef);
    const existing = await transaction.get(ledgerRef);
    if (existing.exists) {
      const entry = existing.data() as LedgerEntry;
      if (entry.kind !== "reserve" || entry.amountUsd !== amountUsd || entry.reason !== params.reason) {
        return { authorized: false, refusal: "idempotency_conflict", detail: "This request key already belongs to a different reservation." } as const;
      }
      if (params.requestedRun) {
        const priorRun = await transaction.get(db!.collection("evaluationRuns").doc(`run_${entry.reservationId}`));
        const run = priorRun.data() as EvalRunRecord | undefined;
        if (!run || run.checkpointId !== params.requestedRun.checkpointId || run.sceneId !== params.requestedRun.sceneId || run.executionAdmission?.digestSha256 !== params.requestedRun.executionAdmission?.digestSha256) {
          return { authorized: false, refusal: "idempotency_conflict", detail: "This preparation already belongs to a different execution." } as const;
        }
      }
      return { authorized: true, reservationId: entry.reservationId! } as const;
    }
    const policyDoc = await transaction.get(policyRef);
    const ledger = await transaction.get(ledgerQuery);
    const entries = ledger.docs.map(doc => doc.data() as LedgerEntry);
    if (!params.confirmedPlan) {
      const policy = { ...DEFAULT_SPEND_POLICY, ...policyDoc.data() };
      if (!policy.agentSpendEnabled) return { authorized: false, refusal: policy.dailyLimitUsd > 0 ? "agent_spend_disabled" : "no_policy_configured", detail: "Autonomous spending is off. A balance does not authorize recurring runs." } as const;
      if (policy.perRunLimitUsd > 0 && amountUsd > policy.perRunLimitUsd) return { authorized: false, refusal: "over_per_run_limit", detail: "This quote exceeds the per-run limit." } as const;
      const spentToday = entries.filter(entry => entry.createdAtIso.slice(0, 10) === utcDayKey() && (entry.kind === "reserve" || (entry.kind === "settle" && !entry.reservationId))).reduce((sum, entry) => sum + entry.amountUsd, 0);
      if (policy.dailyLimitUsd <= 0 || spentToday + amountUsd > policy.dailyLimitUsd) return { authorized: false, refusal: "over_daily_limit", detail: "This quote exceeds the remaining daily limit." } as const;
    }
    const balance = deriveBalance(params.teamId, entries);
    if (balance.availableUsd < amountUsd) return { authorized: false, refusal: "insufficient_balance", detail: `$${balance.availableUsd} available, $${amountUsd} needed.` } as const;
    const createdAtIso = nextLedgerTime(lock.data()?.lastEntryAtIso);
    const record: LedgerEntry = { entryId, teamId: params.teamId, kind: "reserve", amountUsd, reservationId, reason: params.reason, idempotencyKey: params.idempotencyKey, createdAtIso };
    transaction.set(lockRef, { lastEntryAtIso: createdAtIso });
    transaction.set(ledgerRef, record);
    if (params.requestedRun) {
      const run = buildRequestedRunRecord({ ...params.requestedRun, teamId: params.teamId, reservationId, quotedUsd: amountUsd });
      transaction.set(db!.collection("evaluationRuns").doc(run.runId), { ...run, settlementDueAtMs: Date.now() + reservationTtlMs() });
    }
    return { authorized: true, reservationId } as const;
  });
}

function nextLedgerTime(previous: unknown): string {
  const priorMs = typeof previous === "string" ? Date.parse(previous) : 0;
  return new Date(Math.max(Date.now(), (Number.isFinite(priorMs) ? priorMs : 0) + 1)).toISOString();
}

async function writeEntry(entry: Omit<LedgerEntry, "entryId" | "createdAtIso">): Promise<string> {
  if (!db) throw new Error("Ledger is unavailable");
  const entryId = `${entry.teamId}:${entry.idempotencyKey}`;
  const ref = db.collection(LEDGER_COLLECTION).doc(entryId);
  const lockRef = db.collection("robotTeamLedgerLocks").doc(entry.teamId);
  return db.runTransaction(async transaction => {
    const lock = await transaction.get(lockRef);
    const existing = await transaction.get(ref);
    if (existing.exists) {
      const prior = existing.data() as LedgerEntry;
      if (prior.kind !== entry.kind || prior.reservationId !== entry.reservationId || prior.amountUsd !== round2(entry.amountUsd)) throw new Error("Ledger idempotency conflict");
      return prior.reservationId || entryId;
    }
    const createdAtIso = nextLedgerTime(lock.data()?.lastEntryAtIso);
    const record: LedgerEntry = { ...entry, entryId, amountUsd: round2(entry.amountUsd), createdAtIso };
    transaction.set(lockRef, { lastEntryAtIso: createdAtIso });
    transaction.set(ref, { ...record, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return record.reservationId || entryId;
  });
}

export async function creditTeam(params: {
  teamId: string;
  amountUsd: number;
  reason: string;
  idempotencyKey: string;
}): Promise<TeamBalance> {
  await writeEntry({
    teamId: params.teamId,
    kind: "credit",
    amountUsd: params.amountUsd,
    reservationId: null,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });
  return getTeamBalance(params.teamId);
}

/**
 * Turn a hold into a spend.
 *
 * `amountUsd` is what was actually consumed. The published rule is that a
 * failed attempt is billable and a failure of ours is not — so a run whose
 * episodes executed settles for them even if the robot dropped everything,
 * while an environment that would not launch settles for nothing.
 */
export async function settleReservation(params: {
  teamId: string;
  reservationId: string;
  amountUsd: number;
  reason: string;
  idempotencyKey: string;
}): Promise<TeamBalance> {
  await writeEntry({
    teamId: params.teamId,
    kind: "settle",
    amountUsd: params.amountUsd,
    reservationId: params.reservationId,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });
  return getTeamBalance(params.teamId);
}

/** Give a hold back whole, for a run that never happened. */
export async function releaseReservation(params: {
  teamId: string;
  reservationId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<TeamBalance> {
  await writeEntry({
    teamId: params.teamId,
    kind: "release",
    amountUsd: 0,
    reservationId: params.reservationId,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });
  return getTeamBalance(params.teamId);
}
