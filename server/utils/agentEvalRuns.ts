/**
 * The record that connects money held to work done.
 *
 * ## The hole this fills
 *
 * `agent-team/runs` reserved money per run and returned the reservation ids,
 * and that was the end of it. Nothing recorded that a run had been requested,
 * so nothing could ever conclude one. A reservation was attached to a promise
 * rather than to an object — which meant the money stayed held until a person
 * went looking for it, and `teamEvalCandidates` read an `evaluationRuns`
 * collection that nothing wrote, so "already answered" never fired either.
 *
 * ## Why this does not wait for the Pipeline
 *
 * The obvious fix is for the Pipeline to call our settlement endpoint when a
 * run finishes. That endpoint exists and works, and the Pipeline should call
 * it. But a design where money stays locked whenever another system forgets to
 * make a call is a design that leaks, and the other system is in a repo this
 * work cannot touch.
 *
 * So settlement is reconciled from records we hold, and every hold carries an
 * expiry. A run that reports back settles for what it consumed. A run that
 * never reports anything at all releases its hold when it expires. Either way
 * the money comes back without anyone going looking for it, and the worst case
 * is a team is un-billed for work we cannot prove happened — which is the right
 * direction for that error to point.
 *
 * ## A due time, not a scan
 *
 * Runs are picked up by `settlementDueAtMs`: set to the expiry when the hold is
 * taken, set to zero the moment an outcome is reported, and deleted outright
 * once the money has moved. So the reconciler reads only what is actually due,
 * oldest first, and the field's absence — not a flag — is what takes a finished
 * run out of the queue. Scanning `moneyResolved == false` instead would have let
 * a hundred holds that are merely young crowd out the one that expired an hour
 * ago, which is the failure this module exists to prevent.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  releaseReservation,
  settleReservation,
} from "./robotTeamBalance";

const RUNS_COLLECTION = "evaluationRuns";

/**
 * How long a hold may sit unresolved before it is given back.
 *
 * Six hours is well past any real screening run and well short of a team
 * noticing its balance is wrong. Configurable because the right number is an
 * operational fact about the Pipeline, not a constant.
 */
const DEFAULT_RESERVATION_TTL_MS = 6 * 60 * 60 * 1000;

export function reservationTtlMs(): number {
  const raw = Number(process.env.BLUEPRINT_AGENT_RESERVATION_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RESERVATION_TTL_MS;
}

export type EvalRunState =
  /** Reserved and handed on. Nothing has reported back. */
  | "requested"
  /** Episodes executed. Billable, whatever the robot did in them. */
  | "completed"
  /** The environment failed before any episode ran. Not billable. */
  | "blocked"
  /** Nothing reported for longer than the hold was allowed to sit. */
  | "abandoned";

export interface EvalRunRecord {
  runId: string;
  teamId: string;
  checkpointId: string;
  sceneId: string;
  /** What `teamEvalCandidates` reads to reward variety. */
  taskFamily: string | null;
  reservationId: string;
  quotedUsd: number;
  /** Episodes the quote was priced for, so a partial run can be pro-rated. */
  quotedEpisodes: number;
  state: EvalRunState;
  /** Episodes that actually executed. Null until something reports. */
  episodesRun: number | null;
  /** True once the reservation has been settled or released. */
  moneyResolved: boolean;
  requestedAtIso: string;
  resolvedAtIso: string | null;
  note: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Record a run at the moment its money is held.
 *
 * Written with the reservation id on it, because the reservation is the only
 * thing that can later be settled and a run that cannot name its own hold is
 * exactly the orphan this module exists to prevent.
 */
export async function createRequestedRun(params: {
  teamId: string;
  checkpointId: string;
  sceneId: string;
  taskFamily: string | null;
  reservationId: string;
  quotedUsd: number;
  quotedEpisodes: number;
}): Promise<EvalRunRecord | null> {
  if (!db) return null;

  const record: EvalRunRecord = {
    runId: runIdForReservation(params.reservationId),
    teamId: params.teamId,
    checkpointId: params.checkpointId,
    sceneId: params.sceneId,
    taskFamily: params.taskFamily,
    reservationId: params.reservationId,
    quotedUsd: round2(params.quotedUsd),
    quotedEpisodes: Math.max(1, Math.round(params.quotedEpisodes)),
    state: "requested",
    episodesRun: null,
    moneyResolved: false,
    requestedAtIso: nowIso(),
    resolvedAtIso: null,
    note: null,
  };

  await db.collection(RUNS_COLLECTION).doc(record.runId).set(
    {
      ...record,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      settlementDueAtMs: Date.now() + reservationTtlMs(),
    },
    { merge: true },
  );
  return record;
}

/**
 * The run id for a hold.
 *
 * Derived from the reservation rather than random, so a retried confirm
 * rewrites the same run instead of creating a second one beside it, and so the
 * Pipeline can name a run it was told about without us keeping a second map.
 */
export function runIdForReservation(reservationId: string): string {
  return `run_${reservationId}`;
}

/**
 * Report what happened to a run.
 *
 * Deliberately does not move money — it only makes the run due. Settlement is
 * the reconciler's job, so a caller reporting an outcome twice cannot charge
 * twice, and an outcome that arrives while the ledger is unavailable is not
 * lost: it sits on the record, due, until the next pass picks it up.
 */
export async function reportRunOutcome(params: {
  runId: string;
  state: Extract<EvalRunState, "completed" | "blocked">;
  episodesRun: number;
  note?: string | null;
}): Promise<boolean> {
  if (!db) return false;

  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  const snapshot = await ref.get();
  // An outcome for a run we never reserved money for has nothing to settle.
  // Recording it anyway would put a row in the queue that no reconciliation
  // pass could ever clear.
  if (!snapshot.exists) return false;

  await ref.set(
    {
      state: params.state,
      episodesRun: Math.max(0, Math.round(params.episodesRun)),
      note: params.note ?? null,
      reportedAtIso: nowIso(),
      // Due now. The next pass resolves the money.
      settlementDueAtMs: 0,
    },
    { merge: true },
  );
  return true;
}

export interface ReconciliationSummary {
  examined: number;
  settled: number;
  released: number;
  abandoned: number;
  failed: number;
}

/**
 * What a run should be billed for, given what it actually ran.
 *
 * Pro-rated against the quote rather than against a rate passed in, so the
 * number on the bill can only ever be derived from the number the team was
 * quoted. A run that executed more episodes than it was quoted for still bills
 * the quote: we do not get to charge for work nobody agreed to.
 */
export function settlementAmountUsd(run: {
  quotedUsd: number;
  quotedEpisodes: number;
  episodesRun: number | null;
}): number {
  const ran = Math.max(0, run.episodesRun ?? 0);
  const quotedEpisodes = Math.max(1, run.quotedEpisodes || 1);
  if (ran >= quotedEpisodes) return round2(run.quotedUsd);
  return round2((run.quotedUsd * ran) / quotedEpisodes);
}

/**
 * Resolve the money for every run that has finished or timed out.
 *
 * Three cases:
 *
 * - **completed** with episodes: settle for what they cost. A robot dropping
 *   the box is a result, and results are the product.
 * - **blocked**, or completed with zero episodes: release the hold whole. An
 *   environment that would not launch is not a result.
 * - **requested** past its expiry: release, and mark the run `abandoned`. We
 *   cannot prove the work happened, so we do not keep the money. This is the
 *   case that makes the whole thing independent of anyone else remembering to
 *   call us.
 *
 * A failure inside any one run leaves that run due, so the next pass retries
 * it. Nothing is dropped on the floor and nothing blocks anything else.
 */
export async function reconcileAgentRunSettlements(params?: {
  limit?: number;
}): Promise<ReconciliationSummary> {
  if (!db) return emptySummary();

  // Inequality and ordering on the same field, so this needs only the
  // single-field index Firestore maintains on its own.
  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("settlementDueAtMs", "<=", Date.now())
    .orderBy("settlementDueAtMs", "asc")
    .limit(clampLimit(params?.limit))
    .get();

  return resolveDueRuns(snapshot.docs);
}

/**
 * Resolve one team's due holds, right now.
 *
 * This is what makes settlement certain rather than scheduled. The agent whose
 * available balance is short because of a hold nothing ever claimed is exactly
 * the caller who asks next, so its own call is the natural moment to free it —
 * no clock, no env flag, and no dependence on another system remembering
 * anything. The scheduled lane is then only a sweep for teams that went quiet.
 *
 * Bounded and swallowing: a team asking what it can spend must still get an
 * answer if reconciliation fails, and the answer is conservative either way
 * because an unresolved hold reads as money it cannot spend.
 */
export async function reconcileTeamHolds(
  teamId: string,
  limit = 25,
): Promise<ReconciliationSummary> {
  if (!db) return emptySummary();
  try {
    const snapshot = await db
      .collection(RUNS_COLLECTION)
      .where("teamId", "==", teamId)
      .where("settlementDueAtMs", "<=", Date.now())
      .orderBy("settlementDueAtMs", "asc")
      .limit(clampLimit(limit))
      .get();
    return await resolveDueRuns(snapshot.docs);
  } catch (error) {
    logger.warn({ err: error, teamId }, "Could not reconcile a team's holds inline");
    return emptySummary();
  }
}

function emptySummary(): ReconciliationSummary {
  return { examined: 0, settled: 0, released: 0, abandoned: 0, failed: 0 };
}

function clampLimit(limit?: number): number {
  return Math.max(1, Math.min(limit ?? 50, 500));
}

async function resolveDueRuns(
  docs: readonly admin.firestore.QueryDocumentSnapshot[],
): Promise<ReconciliationSummary> {
  const summary = emptySummary();
  const expiryCutoff = Date.now() - reservationTtlMs();

  for (const doc of docs) {
    const run = doc.data() as EvalRunRecord;
    summary.examined += 1;

    try {
      if (run.state === "completed" && (run.episodesRun ?? 0) > 0) {
        const amountUsd = settlementAmountUsd(run);
        await settleReservation({
          teamId: run.teamId,
          reservationId: run.reservationId,
          amountUsd,
          reason: `Run ${run.runId}: ${run.episodesRun} episodes`,
          // The same key the Pipeline's direct settlement uses, so whichever
          // path gets there first, the other one is a no-op rather than a
          // second charge.
          idempotencyKey: `settle:${run.reservationId}`,
        });
        await markResolved(doc.id, "completed", `Settled $${amountUsd}`);
        summary.settled += 1;
        continue;
      }

      if (run.state === "blocked" || (run.state === "completed" && !run.episodesRun)) {
        await releaseReservation({
          teamId: run.teamId,
          reservationId: run.reservationId,
          reason: `Run ${run.runId} executed no episodes`,
          idempotencyKey: `settle-release:${run.reservationId}`,
        });
        await markResolved(doc.id, run.state, "Released: no episodes ran");
        summary.released += 1;
        continue;
      }

      if (run.state === "requested" && Date.parse(run.requestedAtIso) <= expiryCutoff) {
        await releaseReservation({
          teamId: run.teamId,
          reservationId: run.reservationId,
          reason: `Run ${run.runId} reported nothing before its hold expired`,
          idempotencyKey: `settle-release:${run.reservationId}`,
        });
        await markResolved(
          doc.id,
          "abandoned",
          "Released on expiry: nothing reported, so the work cannot be billed",
        );
        summary.abandoned += 1;
        continue;
      }

      // Due but not actionable: a `requested` run whose clock says it is early,
      // which happens when the TTL is shortened under it. Push it out to the
      // expiry it should have had rather than re-reading it every pass.
      await doc.ref.set(
        { settlementDueAtMs: Date.parse(run.requestedAtIso) + reservationTtlMs() },
        { merge: true },
      );
    } catch (error) {
      summary.failed += 1;
      logger.warn(
        { err: error, runId: run.runId, reservationId: run.reservationId },
        "Could not resolve an agent run reservation; it stays due for the next pass",
      );
    }
  }

  if (summary.settled || summary.released || summary.abandoned || summary.failed) {
    logger.info({ ...summary }, "Agent run settlement reconciliation pass complete");
  }
  return summary;
}


/**
 * Take a run out of the settlement queue.
 *
 * `settlementDueAtMs` is deleted rather than set to a sentinel, because the
 * reconciler's query is a range over that field and a document without it
 * simply cannot match. Absence is a stronger guarantee than a flag somebody
 * has to remember to read.
 */
export async function markResolved(docId: string, state: EvalRunState, note: string) {
  if (!db) return;
  await db.collection(RUNS_COLLECTION).doc(docId).set(
    {
      state,
      moneyResolved: true,
      resolvedAtIso: nowIso(),
      note,
      settlementDueAtMs: admin.firestore.FieldValue.delete(),
    },
    { merge: true },
  );
}

/**
 * Whether a team's agent may still cancel its own reservation.
 *
 * ## The hole this closes
 *
 * `POST /runs/:reservationId/release` took any reservation id, wrote
 * `reason: "Run did not start"` as a fixed string, and never looked at the run.
 * So an agent could reserve, let execution begin, release the hold, and keep
 * the work. Today -- with nothing reporting outcomes yet -- that work is never
 * billed at all. Once outcomes do report, the same call still frees the balance
 * in between, so reserve/release/reserve runs N jobs against one funded balance.
 *
 * `deriveBalance` used to hide the result rather than prevent it: it clamps
 * `availableUsd` at zero, so the overdraft showed up as a balance that stopped
 * moving instead of as a number anybody could see.
 *
 * ## So a release is a cancellation, and cancellation has a window
 *
 * It is valid while nothing has reported. Once an outcome exists the run is
 * billable or not on its own merits, and that is the Pipeline's report to make
 * rather than the spender's.
 *
 * We cannot see from this repo whether execution has physically started -- that
 * is the completion-record contract's job. What we can see is whether anything
 * has been reported, and refusing on that is the honest half of the guarantee:
 * it closes the loop that costs money and leaves the race that costs latency.
 */
export type ReleaseEligibility =
  | { allowed: true; alreadyResolved: boolean; run: EvalRunRecord | null }
  | {
      allowed: false;
      reason: "outcome_reported" | "not_your_reservation";
      run: EvalRunRecord;
    };

export async function checkReleaseEligibility(
  teamId: string,
  reservationId: string,
): Promise<ReleaseEligibility> {
  const run = await getRunForReservation(reservationId);

  // No run record at all. This is an orphan hold, and giving it back is the
  // same thing the reconciler does at expiry -- refusing would strand it.
  if (!run) return { allowed: true, alreadyResolved: false, run: null };

  // A reservation belongs to the team that took it. Releasing someone else's
  // is a no-op in the ledger, because entries are per team, but saying so
  // beats writing a meaningless entry and reporting success.
  if (run.teamId && run.teamId !== teamId) {
    return { allowed: false, reason: "not_your_reservation", run };
  }

  // Already settled or released. Idempotent rather than an error: an agent
  // retrying a call it never saw the answer to should get the same answer.
  if (run.moneyResolved) {
    return { allowed: true, alreadyResolved: true, run };
  }

  // Something reported. `episodesRun` is null until it does, and the state
  // leaves `requested` at the same moment, so either one is enough -- both are
  // checked because they are written together and a partial write should fail
  // closed.
  if (run.state !== "requested" || run.episodesRun !== null) {
    return { allowed: false, reason: "outcome_reported", run };
  }

  return { allowed: true, alreadyResolved: false, run };
}

/** The run attached to a hold, or null if nothing was ever recorded for it. */
export async function getRunForReservation(
  reservationId: string,
): Promise<EvalRunRecord | null> {
  if (!db) return null;
  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .doc(runIdForReservation(reservationId))
    .get();
  return snapshot.exists ? (snapshot.data() as EvalRunRecord) : null;
}

/** What the reconciler would do with a team's outstanding holds, for an agent. */
export async function listUnsettledRuns(teamId: string, limit = 50): Promise<EvalRunRecord[]> {
  if (!db) return [];
  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("teamId", "==", teamId)
    .limit(Math.max(1, Math.min(limit * 5, 500)))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as EvalRunRecord)
    .filter((run) => !run.moneyResolved)
    .sort((a, b) => (a.requestedAtIso < b.requestedAtIso ? 1 : -1))
    .slice(0, limit);
}
