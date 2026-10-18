import { reconcileAgentRunNotifications } from "./agentRunNotificationRecovery";
import { canDispatchFreeBetaRun, isBlueprintFundedRun, FREE_BETA_ONLY, FREE_BETA_PAID_DISABLED } from "./freeBeta";
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

import { isDeepStrictEqual } from "node:util";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { SceneScreening } from "./taskStatusProjection";
import { readEvaluation, type PassMark, type RunWithResult } from "./pilotRecommendationEvidence";
import {
  releaseReservation,
  settleReservation,
} from "./robotTeamBalance";
import {
  buildRequestedRunRecord,
  isSiteEvaluation,
  reservationTtlMs,
  executionTtlMs,
  runExecutionDueAtMs,
  runIdForReservation,
  type EvalRunRecord,
  type EvalRunState,
  type RequestedRunParams,
  type RunDispatch,
  type RunExecutionProgress,
} from "./agentRunRecord";
import { enqueueTaskLifecycleNotification, notifyIfNoTeamPassed } from "./taskLifecycleNotifications";
import { notifyTeamOfRunOutcome } from "./robotTeamNotifications";
import type { NoResultObservation } from "./runNoResultObservation";
import { teamJobAccess } from "./teamJobAccess";
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
  if (FREE_BETA_ONLY) throw new Error(FREE_BETA_PAID_DISABLED);
  const record = buildRequestedRunRecord(params);
  const ref = db.collection(RUNS_COLLECTION).doc(record.runId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const prior = snapshot.data() as EvalRunRecord;
      if (["teamId", "checkpointId", "sceneId", "reservationId", "quotedUsd", "quotedEpisodes", "evaluationPurpose"].some(key => prior[key as keyof EvalRunRecord] !== record[key as keyof EvalRunRecord]) || prior.executionAdmission?.digestSha256 !== record.executionAdmission?.digestSha256) throw new Error("Run idempotency conflict");
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

interface RunOutcomeParams {
  runId: string;
  state: Extract<EvalRunState, "completed" | "blocked">;
  episodesRun: number;
  note?: string | null;
  executionProgress?: RunExecutionProgress;
}

interface PipelineOutcomeBinding {
  teamId: string;
  pipelineRunId?: string;
  executionAdmissionDigest?: string;
}

/** Existing financial callers do not acquire authority to append closed-run diagnostics. */
export async function reportRunOutcome(params: RunOutcomeParams): Promise<boolean> {
  return (await recordRunOutcome(params)).recorded;
}

/** Signed Pipeline delivery may retain a blocked receipt after cancellation, without reopening it. */
export async function reportPipelineRunOutcome(params: RunOutcomeParams & {
  pipelineBinding: PipelineOutcomeBinding;
}): Promise<{ recorded: boolean; diagnosticOnly: boolean }> {
  return recordRunOutcome(params);
}

async function recordRunOutcome(params: RunOutcomeParams & {
  pipelineBinding?: PipelineOutcomeBinding;
}): Promise<{ recorded: boolean; diagnosticOnly: boolean }> {
  if (!db) return { recorded: false, diagnosticOnly: false };

  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  const episodesRun = Math.max(0, Math.round(params.episodesRun));
  let endedWithoutResult: { sceneId: string; teamId: string; siteVisible: boolean; progress: NoResultObservation } | null = null;
  const accepted = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    // An outcome for a run we never reserved money for has nothing to settle.
    if (!snapshot.exists) return "missing" as const;
    const run = snapshot.data() as EvalRunRecord & {
      result?: { observed?: { episodesRun?: number } } | null;
      closedExecutionDiagnostic?: Record<string, unknown>;
    };
    const binding = params.pipelineBinding;
    const boundClaim = Boolean(binding?.pipelineRunId && binding.executionAdmissionDigest
      && run.teamId === binding.teamId && run.dispatch?.pipelineRunId === binding.pipelineRunId
      && run.executionAdmission?.digestSha256 === binding.executionAdmissionDigest);
    if (binding && (run.teamId !== binding.teamId || (run.executionAdmission && !boundClaim))) {
      throw new RunOutcomeConflictError("Settlement does not match the current claimed execution");
    }
    const closed = run.cancellationRequested || run.state === "abandoned" || run.moneyResolved;
    if (closed && params.state === "blocked" && params.executionProgress) {
      if (!boundClaim) throw new RunOutcomeConflictError("A closed-run diagnostic requires its bound Pipeline claim");
      const diagnostic = {
        teamId: binding!.teamId,
        pipelineRunId: binding!.pipelineRunId!,
        executionAdmissionDigest: binding!.executionAdmissionDigest!,
        episodesRun,
        executionProgress: params.executionProgress,
        note: params.note ?? null,
      };
      const prior = run.closedExecutionDiagnostic;
      if (prior) {
        const { receivedAtIso: _receivedAt, ...priorEvidence } = prior;
        if (!isDeepStrictEqual(priorEvidence, diagnostic)) {
          throw new RunOutcomeConflictError("Closed-run diagnostic conflicts with the recorded receipt");
        }
      } else {
        transaction.set(ref, { closedExecutionDiagnostic: { ...diagnostic, receivedAtIso: nowIso() } }, { merge: true });
      }
      return "diagnostic" as const;
    }
    const observedEpisodes = run.result?.observed?.episodesRun;
    if (typeof observedEpisodes === "number" && observedEpisodes !== episodesRun) {
      throw new RunOutcomeConflictError("Settlement episodes conflict with the recorded result evidence");
    }
    const outcomeAlreadyReported = run.state === "completed" || run.state === "blocked";
    if (outcomeAlreadyReported) {
      if (run.state !== params.state || run.episodesRun !== episodesRun) {
        throw new RunOutcomeConflictError("Settlement conflicts with the recorded run outcome");
      }
      if (params.executionProgress && run.executionProgress
        && Object.entries(params.executionProgress).some(([key, value]) => run.executionProgress?.[key as keyof RunExecutionProgress] !== value)) {
        throw new RunOutcomeConflictError("Execution progress conflicts with the recorded run outcome");
      }
      endedWithoutResult = params.state === "blocked" || episodesRun === 0 ? { sceneId: run.sceneId, teamId: run.teamId, siteVisible: isSiteEvaluation(run),
        progress: { episodesRun: run.episodesRun, executionProgress: run.executionProgress } } : null;
      // An identical delivery is an idempotent acknowledgement. In particular,
      // do not put an already-resolved run back into the due queue.
      return "recorded" as const;
    }
    if (run.cancellationRequested || run.state === "abandoned" || run.moneyResolved) {
      throw new RunOutcomeConflictError("The run was cancelled or financially resolved before this outcome arrived");
    }
    if (run.state !== "requested") {
      throw new RunOutcomeConflictError("The run cannot accept a financial outcome in its current state");
    }
    if (params.state === "completed" && runExecutionDueAtMs(run) <= Date.now()) {
      throw new RunOutcomeConflictError("The execution lease expired before this outcome arrived");
    }
    transaction.set(ref, {
      ...(!run.result && (params.state === "blocked" || episodesRun === 0) ? { notificationPending: true, notificationIntent: { kind: "no_result" } } : {}),
      state: params.state,
      dispatchPending: false,
      episodesRun,
      note: params.note ?? null,
      ...(params.executionProgress ? { executionProgress: params.executionProgress } : {}),
      reportedAtIso: nowIso(),
      settlementDueAtMs: 0,
    }, { merge: true });
    endedWithoutResult = params.state === "blocked" || episodesRun === 0 ? { sceneId: run.sceneId, teamId: run.teamId, siteVisible: isSiteEvaluation(run),
      progress: { episodesRun, executionProgress: params.executionProgress ?? run.executionProgress } } : null;
    return "recorded" as const;
  });
  // A terminal run without a complete result can still retain partial episode
  // observations. Carry those observations to both audiences unchanged.
  const ended = endedWithoutResult as { sceneId: string; teamId: string; siteVisible: boolean; progress: NoResultObservation } | null;
  if (ended) {
    try {
      if (ended.siteVisible) {
        await enqueueTaskLifecycleNotification({ requestId: ended.sceneId, milestone: "run_no_result", eventId: params.runId, runProgress: ended.progress });
        try { await notifyIfNoTeamPassed(ended.sceneId, params.runId); } catch { /* best-effort */ }
      }
    } catch (error) {
      logger.warn({ error, runId: params.runId }, "Could not enqueue a no-result notice");
    }
    try {
      await notifyTeamOfRunOutcome({ teamId: ended.teamId, runId: params.runId, outcome: { kind: "no_result", progress: ended.progress } });
    } catch (error) {
      logger.warn({ error, runId: params.runId }, "Could not enqueue the team's no-result notice");
    }
  }
  return { recorded: accepted === "recorded", diagnosticOnly: accepted === "diagnostic" };
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
 * The quoted entry price is the maximum charge. Settle only the share of
 * quoted episodes that ran; if none ran, release the hold.
 */
export function settlementAmountUsd(run: {
  quotedUsd: number;
  quotedEpisodes: number;
  episodesRun: number | null;
}): number {
  if ((run.episodesRun ?? 0) <= 0) return 0;
  if (run.quotedEpisodes <= 0) return round2(run.quotedUsd);
  return round2(run.quotedUsd * Math.min((run.episodesRun ?? 0) / run.quotedEpisodes, 1));
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
  await reconcileAgentRunNotifications(params?.limit).catch(error => logger.warn({ error }, "Notification recovery will retry"));

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

  for (const doc of docs) {
    const run = doc.data() as EvalRunRecord;
    summary.examined += 1;

    try {
      if (isBlueprintFundedRun(run) && ["completed", "blocked"].includes(run.state)) {
        await markResolved(doc.id, run.state, "Free evaluation: customer charge is zero; sponsor usage reconciles in Pipeline.");
        summary.settled += 1;
        continue;
      }
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

      // A queue reservation is not a runtime limit. Claimed work has a fixed
      // execution deadline and, once supported by the worker, a liveness lease.
      const executionDue = runExecutionDueAtMs(run);
      if (run.cancellationRequested || (run.state === "requested" && executionDue <= Date.now())) {
        const expired = await db!.runTransaction(async transaction => {
          const current = await transaction.get(doc.ref);
          const latest = current.data() as EvalRunRecord | undefined;
          if (!latest || latest.moneyResolved) return false;
          const dueAtMs = runExecutionDueAtMs(latest);
          if (!latest.cancellationRequested && (latest.state !== "requested" || dueAtMs > Date.now())) return false;
          transaction.set(doc.ref, { state: "abandoned", cancellationRequested: true, dispatchPending: false, settlementDueAtMs: 0 }, { merge: true });
          return true;
        });
        if (!expired) continue;
        if (isBlueprintFundedRun(run)) {
          await markResolved(doc.id, "abandoned", "Free evaluation cancelled or expired: customer charge is zero; unresolved sponsor usage remains in Pipeline.");
          summary.abandoned += 1;
          continue;
        }
        await releaseReservation({ teamId: run.teamId, reservationId: run.reservationId,
          reason: `Run ${run.runId} cancelled or expired before a billable report`,
          idempotencyKey: `release:${run.reservationId}` });
        await markResolved(doc.id, "abandoned", "Hold released after cancellation or expiry");
        summary.abandoned += 1;
        continue;
      }

      // Re-read transactionally so a concurrent heartbeat or completion cannot
      // be overwritten with the stale snapshot's due time.
      await db!.runTransaction(async transaction => {
        const current = await transaction.get(doc.ref);
        const latest = current.data() as EvalRunRecord | undefined;
        if (!latest || latest.moneyResolved || latest.state !== "requested" || latest.cancellationRequested) return;
        transaction.set(doc.ref, { settlementDueAtMs: runExecutionDueAtMs(latest) }, { merge: true });
      });
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

/** The admitted setup stays frozen, but a revoked grant or a closed site job
 * cannot authorize a new claim or renew an executor. Read these authorities in
 * the claim transaction so a concurrent withdrawal forces Firestore to retry. */
async function workspaceRunAuthorityIsCurrent(transaction: FirebaseFirestore.Transaction, run: EvalRunRecord): Promise<boolean> {
  const envelope = run.executionAdmission?.envelope;
  const funding = envelope?.funding as Record<string, unknown> | undefined;
  if (!funding || !Object.prototype.hasOwnProperty.call(funding, "workspace_request_id")) return true;
  const requestId = funding.workspace_request_id;
  const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(value);
  if (!validId(requestId) || !validId(run.sceneId)) return false;
  const frozen = envelope?.policy_run_license as Record<string, unknown> | undefined;
  if (!frozen || frozen.schemaVersion !== "blueprint.policy_run_license.v1" || frozen.revokedAtIso !== undefined
    || frozen.requestId !== requestId || frozen.opportunityId !== run.sceneId || !validId(frozen.setupId)
    || typeof frozen.grantedByUid !== "string" || !frozen.grantedByUid
    || typeof frozen.setupDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(frozen.setupDigest)
    || typeof frozen.grantedAtIso !== "string" || !Number.isFinite(Date.parse(frozen.grantedAtIso))
    || Date.parse(frozen.grantedAtIso) > Date.now()) return false;
  const [request, scene] = await Promise.all([
    transaction.get(db!.collection("inboundRequests").doc(requestId)),
    transaction.get(db!.collection("inboundRequests").doc(run.sceneId)),
  ]);
  const source = request.data(), selection = source?.workspace_evaluation;
  return request.exists && scene.exists && source?.account_owner_uid === frozen.grantedByUid
    && selection?.opportunityId === run.sceneId && selection?.setupId === frozen.setupId
    && isDeepStrictEqual(selection?.policyRunLicense, frozen)
    && teamJobAccess(scene.data()).evaluationAvailable;
}

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
    .filter(run => canDispatchFreeBetaRun(run) && run.state === "requested" && !run.moneyResolved && !run.cancellationRequested && !run.dispatch?.startedAtIso && Date.parse(run.requestedAtIso) + reservationTtlMs() > Date.now());
}

/**
 * The Pipeline has taken a run.
 *
 * Records who took it and when, with a separate bounded execution deadline.
 * Healthy work can exceed the queue reservation TTL. Only a queued run can be started; a run
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
    if (!canDispatchFreeBetaRun(run)) return null;
    if (!(await workspaceRunAuthorityIsCurrent(transaction, run))) return null;
    if (run.dispatch?.startedAtIso) {
      return run.dispatch.pipelineRunId === params.pipelineRunId && runExecutionDueAtMs(run) > Date.now() ? run : null;
    }
    const due = run.settlementDueAtMs ?? Date.parse(run.requestedAtIso) + reservationTtlMs();
    if (!Number.isFinite(due) || due <= Date.now()) return null;
    const dispatch: RunDispatch = { startedAtIso: nowIso(), pipelineRunId: params.pipelineRunId!, executionDeadlineAtMs: Date.now() + executionTtlMs() };
    transaction.set(ref, { dispatch, dispatchPending: false, settlementDueAtMs: dispatch.executionDeadlineAtMs }, { merge: true });
    return { ...run, dispatch };
  });
  if (!claimed) return false;

  // Only a successful CAS (or its same-owner idempotent retry) reaches here.
  // The retry repairs an enqueue lost after the run was durably claimed.
  try {
    if (isSiteEvaluation(claimed)) await enqueueTaskLifecycleNotification({
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

/** Renew only the current executor's liveness; never extend the hard deadline. */
export async function heartbeatRun(params: {
  runId: string;
  pipelineRunId: string;
  executionAdmissionDigest?: string;
}): Promise<boolean> {
  if (!db || !params.pipelineRunId.trim()) return false;
  const ref = db.collection(RUNS_COLLECTION).doc(params.runId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const run = snapshot.data() as EvalRunRecord | undefined;
    if (!run || run.state !== "requested" || run.moneyResolved || run.cancellationRequested
      || !run.dispatch?.startedAtIso || run.dispatch.pipelineRunId !== params.pipelineRunId
      || (run.executionAdmission && run.executionAdmission.digestSha256 !== params.executionAdmissionDigest)
      || runExecutionDueAtMs(run) <= Date.now()) return false;
    if (!(await workspaceRunAuthorityIsCurrent(transaction, run))) return false;
    const dispatch: RunDispatch = {
      ...run.dispatch,
      executionDeadlineAtMs: run.dispatch.executionDeadlineAtMs ?? Date.parse(run.dispatch.startedAtIso) + executionTtlMs(),
      lastHeartbeatAtIso: nowIso(),
    };
    transaction.set(ref, { dispatch, settlementDueAtMs: runExecutionDueAtMs({ ...run, dispatch }) }, { merge: true });
    return true;
  });
}

/**
 * What the runs against one scene add up to, for the site that owns it.
 *
 * Counts only. Observed runs are counted without comparing their outcomes:
 * different protocols and resets are not proven comparable. A blocked or
 * zero-episode completion is counted explicitly as no result.
 *
 * With the job's pass mark, `passed` counts reported runs whose result meets
 * it (`readEvaluation`). A recorded result is final evidence and settlement can
 * land after it, so it is judged as recorded: this can only over-count passes,
 * which keeps "no team passed" from being said early.
 */
export async function loadSceneScreening(sceneId: string, passMark?: PassMark): Promise<SceneScreening> {
  const empty: SceneScreening = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0, ...(passMark ? { passed: 0, ineligible: 0 } : {}) };
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
    if (!isSiteEvaluation(run)) continue;
    const observed = run.result?.observed;
    const episodes = Math.max(0, Math.round(observed?.episodesRun ?? 0));

    if (observed && episodes > 0) {
      screening.reported += 1;
      if (passMark) {
        const reading = readEvaluation({ ...run, state: "completed" } as RunWithResult, sceneId, passMark);
        if (reading.passed === true) screening.passed = (screening.passed ?? 0) + 1;
        // Missing qualification, measurements or accounting is unknown evidence,
        // never proof that the team's policy failed the job.
        if (reading.refusals.some(refusal => !["evaluation_below_pass_mark", "evaluation_cycle_time_missed"].includes(refusal)))
          screening.ineligible = (screening.ineligible ?? 0) + 1;
      }
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
      evidenceScope?: "development_only";
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
    .filter((run) => isSiteEvaluation(run) && ["requested", "completed", "blocked"].includes(run.state))
    .sort((a, b) => (a.requestedAtIso || "").localeCompare(b.requestedAtIso || ""));
}
