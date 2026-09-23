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
import type { SceneScreening } from "./taskStatusProjection";
import {
  releaseReservation,
  settleReservation,
} from "./robotTeamBalance";
import {
  buildRequestedRunRecord,
  reservationTtlMs,
  runIdForReservation,
  type EvalRunRecord,
  type EvalRunState,
  type RequestedRunParams,
  type RunDispatch,
} from "./agentRunRecord";
import { enqueueTaskLifecycleNotification } from "./taskLifecycleNotifications";
import { notifyTeamOfRunOutcome } from "./robotTeamNotifications";
export {
  buildRequestedRunRecord,
  reservationTtlMs,
  runIdForReservation,
  type EvalRunRecord,
  type EvalRunState,
  type RequestedRunParams,
  type RunDispatch,
} from "./agentRunRecord";

const RUNS_COLLECTION = "evaluationRuns";

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
export async function createRequestedRun(params: RequestedRunParams): Promise<EvalRunRecord | null> {
  if (!db) return null;
  const record = buildRequestedRunRecord(params);
  const ref = db.collection(RUNS_COLLECTION).doc(record.runId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const prior = snapshot.data() as EvalRunRecord;
      if (["teamId", "checkpointId", "sceneId", "reservationId", "quotedUsd", "quotedEpisodes"].some(key => prior[key as keyof EvalRunRecord] !== record[key as keyof EvalRunRecord]) || prior.executionAdmission?.digestSha256 !== record.executionAdmission?.digestSha256) throw new Error("Run idempotency conflict");
      return prior;
    }
    transaction.set(ref, { ...record, settlementDueAtMs: Date.now() + reservationTtlMs() });
    return record;
  });
}

/**
 * The run id for a hold.
 *
 * Derived from the reservation rather than random, so a retried confirm
 * rewrites the same run instead of creating a second one beside it, and so the
 * Pipeline can name a run it was told about without us keeping a second map.
 */
/**
 * Report what happened to a run.
 *
 * Deliberately does not move money — it only makes the run due. Settlement is
 * the reconciler's job, so a caller reporting an outcome twice cannot charge
 * twice, and an outcome that arrives while the ledger is unavailable is not
 * lost: it sits on the record, due, until the next pass picks it up.
 */
export class RunOutcomeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunOutcomeConflictError";
  }
}

export async function reportRunOutcome(params: {
  runId: string;
  state: Extract<EvalRunState, "completed" | "blocked">;
  episodesRun: number;
  note?: string | null;
}): Promise<boolean> {
  if (!db) return false;

  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  const episodesRun = Math.max(0, Math.round(params.episodesRun));
  let endedWithoutResult: { sceneId: string; teamId: string } | null = null;
  const accepted = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    // An outcome for a run we never reserved money for has nothing to settle.
    if (!snapshot.exists) return false;
    const run = snapshot.data() as EvalRunRecord & {
      result?: { observed?: { episodesRun?: number } } | null;
    };
    const observedEpisodes = run.result?.observed?.episodesRun;
    if (typeof observedEpisodes === "number" && observedEpisodes !== episodesRun) {
      throw new RunOutcomeConflictError("Settlement episodes conflict with the recorded result evidence");
    }
    const outcomeAlreadyReported = run.state === "completed" || run.state === "blocked";
    if (outcomeAlreadyReported) {
      if (run.state !== params.state || run.episodesRun !== episodesRun) {
        throw new RunOutcomeConflictError("Settlement conflicts with the recorded run outcome");
      }
      // An identical delivery is an idempotent acknowledgement. In particular,
      // do not put an already-resolved run back into the due queue.
      return true;
    }
    if (run.cancellationRequested || run.state === "abandoned" || run.moneyResolved) {
      throw new RunOutcomeConflictError("The run was cancelled or financially resolved before this outcome arrived");
    }
    if (run.state !== "requested") {
      throw new RunOutcomeConflictError("The run cannot accept a financial outcome in its current state");
    }
    transaction.set(ref, {
      state: params.state,
      dispatchPending: false,
      episodesRun,
      note: params.note ?? null,
      reportedAtIso: nowIso(),
      settlementDueAtMs: 0,
    }, { merge: true });
    endedWithoutResult = params.state === "blocked" || episodesRun === 0 ? { sceneId: run.sceneId, teamId: run.teamId } : null;
    return true;
  });
  // The site hears about a run that ended with nothing to show, too. A run
  // with episodes gets its email when the result is recorded.
  const ended = endedWithoutResult as { sceneId: string; teamId: string } | null;
  if (ended) {
    try {
      await enqueueTaskLifecycleNotification({ requestId: ended.sceneId, milestone: "run_no_result", eventId: params.runId });
    } catch (error) {
      logger.warn({ error, runId: params.runId }, "Could not enqueue a no-result notice");
    }
    try {
      await notifyTeamOfRunOutcome({ teamId: ended.teamId, runId: params.runId, outcome: { kind: "no_result" } });
    } catch (error) {
      logger.warn({ error, runId: params.runId }, "Could not enqueue the team's no-result notice");
    }
  }
  return accepted;
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

      // A run the Pipeline has started is measured from when it started, not
      // from when it was queued: a queue can legitimately hold a run for longer
      // than one TTL, and releasing a run that is executing would un-bill work
      // that is happening.
      const holdAnchorMs = Date.parse(run.dispatch?.startedAtIso || run.requestedAtIso);
      if (run.cancellationRequested || (run.state === "requested" && holdAnchorMs <= expiryCutoff)) {
        const expired = await db!.runTransaction(async transaction => {
          const current = await transaction.get(doc.ref);
          const latest = current.data() as EvalRunRecord | undefined;
          if (!latest || latest.moneyResolved) return false;
          const anchor = Date.parse(latest.dispatch?.startedAtIso || latest.requestedAtIso);
          if (!latest.cancellationRequested && (latest.state !== "requested" || anchor > expiryCutoff)) return false;
          transaction.set(doc.ref, { state: "abandoned", cancellationRequested: true, dispatchPending: false, settlementDueAtMs: 0 }, { merge: true });
          return true;
        });
        if (!expired) continue;
        await releaseReservation({ teamId: run.teamId, reservationId: run.reservationId,
          reason: `Run ${run.runId} cancelled or expired before a billable report`,
          idempotencyKey: `release:${run.reservationId}` });
        await markResolved(doc.id, "abandoned", "Hold released after cancellation or expiry");
        summary.abandoned += 1;
        continue;
      }

      // Due but not actionable: a `requested` run whose clock says it is early,
      // which happens when the TTL is shortened under it. Push it out to the
      // expiry it should have had rather than re-reading it every pass.
      await doc.ref.set(
        { settlementDueAtMs: holdAnchorMs + reservationTtlMs() },
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
      dispatchPending: false,
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
      reason: "outcome_reported" | "not_your_reservation" | "execution_started";
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
  if (run.dispatch?.startedAtIso) return { allowed: false, reason: "execution_started", run };
  if (run.state !== "requested" || run.episodesRun !== null) {
    return { allowed: false, reason: "outcome_reported", run };
  }

  return { allowed: true, alreadyResolved: false, run };
}

/** Atomically close the cancellation window before returning a hold. */
export async function claimRunCancellation(teamId: string, reservationId: string): Promise<ReleaseEligibility> {
  if (!db) throw new Error("Run store unavailable");
  const ref = db.collection(RUNS_COLLECTION).doc(runIdForReservation(reservationId));
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { allowed: true, alreadyResolved: false, run: null };
    const run = snapshot.data() as EvalRunRecord;
    if (run.teamId !== teamId) return { allowed: false, reason: "not_your_reservation", run };
    if (run.moneyResolved) return { allowed: true, alreadyResolved: true, run };
    if (run.cancellationRequested) return { allowed: true, alreadyResolved: false, run };
    if (run.dispatch?.startedAtIso) return { allowed: false, reason: "execution_started", run };
    if (run.state !== "requested" || run.episodesRun !== null) return { allowed: false, reason: "outcome_reported", run };
    transaction.set(ref, { cancellationRequested: true, dispatchPending: false, state: "abandoned", settlementDueAtMs: 0 }, { merge: true });
    return { allowed: true, alreadyResolved: false, run };
  });
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

/* ------------------------------------------------ the seam the Pipeline reads */

/**
 * Runs waiting to be executed, oldest first.
 *
 * This is the list the Pipeline pulls. A run stays on it while it is being
 * executed too -- `dispatch` says which ones are already taken -- so a Pipeline
 * that restarts can see what it was in the middle of rather than only what is
 * new.
 */
export async function listRequestedRuns(limit = 50, captureId?: string): Promise<EvalRunRecord[]> {
  if (!db) return [];
  let query = db.collection(RUNS_COLLECTION).where("dispatchPending", "==", true);
  if (captureId) query = query.where("executionCaptureId", "==", captureId);
  const snapshot = await query
    .where("settlementDueAtMs", ">", Date.now())
    .orderBy("settlementDueAtMs", "asc")
    .limit(clampLimit(limit))
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as EvalRunRecord)
    .filter(run => run.state === "requested" && !run.moneyResolved && !run.cancellationRequested && !run.dispatch?.startedAtIso && Date.parse(run.requestedAtIso) + reservationTtlMs() > Date.now());
}

/**
 * The Pipeline has taken a run.
 *
 * Records who took it and when, and pushes the settlement due time out by a
 * full TTL from now, so a run that is executing is not released as abandoned
 * because it waited in a queue first. Only a queued run can be started; a run
 * that already concluded, or that we hold no record of, is refused.
 */
export async function markRunStarted(params: {
  runId: string;
  pipelineRunId?: string | null;
  executionAdmissionDigest?: string;
}): Promise<boolean> {
  if (!db || !params.pipelineRunId?.trim()) return false;
  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  const claimed = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const run = snapshot.data() as EvalRunRecord & { settlementDueAtMs?: number };
    if (run.executionAdmission && params.executionAdmissionDigest !== run.executionAdmission.digestSha256) return null;
    if (run.moneyResolved || run.cancellationRequested || run.state !== "requested" || run.episodesRun !== null) return null;
    const due = run.settlementDueAtMs ?? Date.parse(run.requestedAtIso) + reservationTtlMs();
    if (!Number.isFinite(due) || due <= Date.now()) return null;
    if (run.dispatch?.startedAtIso) {
      return run.dispatch.pipelineRunId === params.pipelineRunId ? run : null;
    }
    const dispatch: RunDispatch = { startedAtIso: nowIso(), pipelineRunId: params.pipelineRunId! };
    transaction.set(ref, { dispatch, dispatchPending: false, settlementDueAtMs: Date.now() + reservationTtlMs() }, { merge: true });
    return { ...run, dispatch };
  });
  if (!claimed) return false;

  // Only a successful CAS (or its same-owner idempotent retry) reaches here.
  // The retry repairs an enqueue lost after the run was durably claimed.
  try {
    await enqueueTaskLifecycleNotification({
      requestId: claimed.sceneId,
      milestone: "screening_started",
      // One email per run: each team picking the task up is its own event.
      eventId: params.runId,
    });
  } catch (error) {
    logger.warn({ error, runId: params.runId }, "Could not enqueue screening-started notice");
  }
  return true;
}

/**
 * What the runs against one scene add up to, for the site that owns it.
 *
 * Counts only. Observed runs are counted without comparing their outcomes:
 * different protocols and resets are not proven comparable. A blocked or
 * zero-episode completion is counted explicitly as no result.
 */
export async function loadSceneScreening(sceneId: string): Promise<SceneScreening> {
  const empty: SceneScreening = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 };
  if (!db || !sceneId) return empty;

  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("sceneId", "==", sceneId)
    .limit(500)
    .get();

  const teams = new Set<string>();
  const screening: SceneScreening = { ...empty };

  for (const doc of snapshot.docs) {
    const run = doc.data() as EvalRunRecord & {
      result?: { observed?: { episodesRun?: number; episodesSucceeded?: number } } | null;
    };
    const observed = run.result?.observed;
    const episodes = Math.max(0, Math.round(observed?.episodesRun ?? 0));

    if (observed && episodes > 0) {
      screening.reported += 1;
      teams.add(run.teamId);
      continue;
    }

    if (run.state === "blocked" || run.state === "completed") {
      screening.noResult += 1;
      teams.add(run.teamId);
      continue;
    }

    if (run.state === "requested") {
      if (run.dispatch?.startedAtIso) screening.running += 1;
      else screening.queued += 1;
      teams.add(run.teamId);
    }
  }

  screening.teams = teams.size;
  return screening;
}

/** One run by id, or null. The result block rides along when one was reported. */
export async function getRun(
  runId: string,
): Promise<(EvalRunRecord & { result?: unknown }) | null> {
  if (!db || !runId) return null;
  const snapshot = await db.collection(RUNS_COLLECTION).doc(runId).get();
  return snapshot.exists ? (snapshot.data() as EvalRunRecord & { result?: unknown }) : null;
}

/**
 * The runs a site can be shown for its scene: queued, running, or reported.
 *
 * Abandoned runs are left out. Blocked and zero-episode completed runs remain
 * visible because they are real concluded outcomes, but carry no metrics.
 */
export async function listRunsForScene(sceneId: string): Promise<
  (EvalRunRecord & {
    result?: {
      observed: {
        episodesRun: number;
        episodesSucceeded: number;
        successRate: number | null;
        medianCycleSeconds: number | null;
      };
    } | null;
  })[]
> {
  if (!db || !sceneId) return [];
  const snapshot = await db
    .collection(RUNS_COLLECTION)
    .where("sceneId", "==", sceneId)
    .limit(500)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as EvalRunRecord & { result?: never })
    .filter((run) => ["requested", "completed", "blocked"].includes(run.state))
    .sort((a, b) => (a.requestedAtIso || "").localeCompare(b.requestedAtIso || ""));
}
