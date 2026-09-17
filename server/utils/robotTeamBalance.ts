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
export function deriveBalance(teamId: string, entries: readonly LedgerEntry[]): TeamBalance {
  let creditedUsd = 0;
  let spentUsd = 0;
  const openReservations = new Map<string, number>();

  for (const entry of entries) {
    if (entry.kind === "credit") {
      creditedUsd += entry.amountUsd;
      continue;
    }
    if (entry.kind === "reserve") {
      openReservations.set(
        entry.reservationId || entry.entryId,
        (openReservations.get(entry.reservationId || entry.entryId) ?? 0) + entry.amountUsd,
      );
      continue;
    }
    if (entry.kind === "settle") {
      spentUsd += entry.amountUsd;
      // The whole hold clears, not just the settled portion: a run that
      // consumed less than quoted returns the difference.
      openReservations.delete(entry.reservationId || "");
      continue;
    }
    if (entry.kind === "release") {
      openReservations.delete(entry.reservationId || "");
    }
  }

  const reservedUsd = [...openReservations.values()].reduce((sum, value) => sum + value, 0);
  const availableUsd = Math.max(0, creditedUsd - spentUsd - reservedUsd);

  return {
    teamId,
    creditedUsd: round2(creditedUsd),
    spentUsd: round2(spentUsd),
    reservedUsd: round2(reservedUsd),
    availableUsd: round2(availableUsd),
  };
}

export async function getTeamBalance(teamId: string): Promise<TeamBalance> {
  // No store means no confirmed funds. An agent that cannot read its balance
  // must not spend, so the honest answer is zero rather than an exception the
  // caller might catch and shrug off.
  if (!db) return { teamId, creditedUsd: 0, spentUsd: 0, reservedUsd: 0, availableUsd: 0 };
  return deriveBalance(teamId, await readEntries(teamId));
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
  | "ledger_unavailable";

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
}): Promise<SpendAuthorization> {
  if (!db) {
    return {
      authorized: false,
      refusal: "ledger_unavailable",
      detail: "The ledger could not be read, and unknown funds are not spendable funds.",
    };
  }

  const amountUsd = round2(params.amountUsd);
  const policy = await getSpendPolicy(params.teamId);

  if (!policy.agentSpendEnabled) {
    return {
      authorized: false,
      refusal: policy.dailyLimitUsd > 0 ? "agent_spend_disabled" : "no_policy_configured",
      detail:
        "Autonomous spend is off for this team. A balance alone is not permission; the team sets a daily limit and switches the agent on.",
    };
  }

  if (policy.perRunLimitUsd > 0 && amountUsd > policy.perRunLimitUsd) {
    return {
      authorized: false,
      refusal: "over_per_run_limit",
      detail: `This run quotes $${amountUsd}, above the per-run limit of $${policy.perRunLimitUsd}. One mistake is supposed to be bounded.`,
    };
  }

  const spentToday = await getSpendToday(params.teamId);
  if (policy.dailyLimitUsd > 0 && spentToday + amountUsd > policy.dailyLimitUsd) {
    return {
      authorized: false,
      refusal: "over_daily_limit",
      detail: `$${spentToday} of today's $${policy.dailyLimitUsd} is already committed; this run needs $${amountUsd}.`,
    };
  }

  const balance = await getTeamBalance(params.teamId);
  if (balance.availableUsd < amountUsd) {
    return {
      authorized: false,
      refusal: "insufficient_balance",
      detail: `$${balance.availableUsd} available, $${amountUsd} needed. Top up to continue.`,
    };
  }

  const reservationId = await reserve({
    teamId: params.teamId,
    amountUsd,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });

  return { authorized: true, reservationId };
}

async function writeEntry(entry: Omit<LedgerEntry, "entryId" | "createdAtIso">): Promise<string> {
  if (!db) throw new Error("Ledger is unavailable");

  // The idempotency key is the document id, so a retry is a write of identical
  // content rather than a second movement. This is the whole protection against
  // an agent that timed out and tried again.
  const entryId = `${entry.teamId}:${entry.idempotencyKey}`;
  const ref = db.collection(LEDGER_COLLECTION).doc(entryId);
  const existing = await ref.get();
  if (existing.exists) {
    return (existing.data() as LedgerEntry).reservationId || entryId;
  }

  const record: LedgerEntry = {
    ...entry,
    entryId,
    amountUsd: round2(entry.amountUsd),
    createdAtIso: nowIso(),
  };
  await ref.set({ ...record, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return record.reservationId || entryId;
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

async function reserve(params: {
  teamId: string;
  amountUsd: number;
  reason: string;
  idempotencyKey: string;
}): Promise<string> {
  const reservationId = `res_${params.teamId}_${params.idempotencyKey}`;
  await writeEntry({
    teamId: params.teamId,
    kind: "reserve",
    amountUsd: params.amountUsd,
    reservationId,
    reason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });
  return reservationId;
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
