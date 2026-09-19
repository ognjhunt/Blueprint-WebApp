/**
 * Closing out the money a run reserved.
 *
 * ## The fast path, not the only path
 *
 * This is how a hold is resolved *promptly*: the Pipeline finishes a run, calls
 * here, and the team's balance frees within the second. It is not what makes
 * resolution *certain*. That is `reconcileAgentRunSettlements`, which reads the
 * run records we hold and resolves anything that finished or timed out whether
 * or not this route was ever called.
 *
 * The two share one idempotency key per reservation, so whichever gets there
 * first wins and the other is a no-op. Which means a Pipeline deploy that
 * forgets this endpoint costs latency, not money — and that is deliberate,
 * because the Pipeline lives in a repo this one cannot change.
 *
 * ## Why this is its own route
 *
 * When an agent starts runs, each one reserves what it was quoted. Something
 * has to turn those holds into spends, and until it does a team's balance stays
 * locked against work that already finished — which looks, from the team's
 * side, exactly like being overcharged.
 *
 * It is deliberately not folded into the evaluation-run schemas next door.
 * Those carry the result of the work; this carries what the work cost. Coupling
 * them would mean a change to either schema could silently stop money moving,
 * and one job per route is what makes that impossible.
 *
 * ## Why the Pipeline signs it and the agent cannot
 *
 * A team's agent authenticates with its own key. If settlement were on that
 * surface, an agent could close its own reservation for zero and get the work
 * free. So this sits behind the Pipeline sync signature, like every other route
 * that reports what actually happened during execution.
 *
 * ## Billable versus not
 *
 * The published rule is that a failed attempt is billable and a failure of ours
 * is not: "the robot dropping the box is a result, and you pay for it. An
 * environment that will not launch is not a result, and you do not." So the
 * Pipeline reports `episodesRun`, and a run that never executed an episode
 * settles at zero rather than being argued about afterwards.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../logger";
import {
  createPipelineSyncRateLimiter,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import {
  releaseReservation,
  settleReservation,
} from "../utils/robotTeamBalance";
import {
  getRunForReservation,
  markResolved,
  reportRunOutcome,
  RunOutcomeConflictError,
  runIdForReservation,
  settlementAmountUsd,
} from "../utils/agentEvalRuns";
import { recordRunResult } from "../utils/agentRunResults";
import { getRun, listRequestedRuns, markRunStarted } from "../utils/agentEvalRuns";
import { getCheckpoint } from "../utils/robotCheckpoints";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const router = Router();

function guard(req: Request, res: Response, next: () => void) {
  const verified = verifyPipelineSyncRequest(req);
  if (!verified.ok) {
    return res.status(verified.status).json({ error: verified.message, code: verified.code });
  }
  next();
}

const settlementSchema = z
  .object({
    pipeline_run_id: z.string().trim().min(1).max(200).optional(),
    execution_admission_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
    team_id: z.string().trim().min(1).max(200),
    reservation_id: z.string().trim().min(1).max(300),
    run_id: z.string().trim().min(1).max(200),
    /** Episodes that actually executed and produced a result. */
    episodes_run: z.number().int().min(0).max(100_000),
    /** The rate those episodes were quoted at. */
    rate_usd: z.number().finite().min(0).max(1_000),
    /**
     * Set when the environment failed rather than the robot. Settles at zero
     * and gives the whole hold back, per the published billing rule.
     */
    blocked_before_any_episode: z.boolean().optional(),
    reason: z.string().trim().max(400).optional(),
  })
  .strict();

const resultSchema = z
  .object({
    pipeline_run_id: z.string().trim().min(1).max(200).optional(),
    execution_admission_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
    reservation_id: z.string().trim().min(1).max(300),
    /** Episodes that executed. The denominator. */
    episodes_run: z.number().int().min(0).max(100_000),
    /** Of those, the ones that met the task's success contract. */
    episodes_succeeded: z.number().int().min(0).max(100_000),
    median_cycle_seconds: z.number().finite().nonnegative().max(86_400).nullish(),
    /** Spread, when measured. Only ever used to say "it varies". */
    cycle_seconds_p10: z.number().finite().nonnegative().max(86_400).nullish(),
    cycle_seconds_p90: z.number().finite().nonnegative().max(86_400).nullish(),
    note: z.string().trim().max(2000).nullish(),
    artifact_uri: z.string().trim().max(1600).nullish(),
  })
  .strict();

/**
 * What the run showed, as opposed to what it cost.
 *
 * Separate from settlement next door for the reason stated there: that route
 * carries the cost of the work and this one carries its result, and a change to
 * either schema must not be able to silently stop the other from happening. A
 * run that settles and never reports is billed and invisible; a run that
 * reports and never settles is free and visible. Both are recoverable, and
 * neither can break the other.
 *
 * This is the call that was missing. `recordEvaluationOutcome` and
 * `recordMeasuredCapability` existed, were correct, and had no caller — so the
 * `measured` grade had no writer, a self-registered team could never be
 * promoted into the supply sites are shown, and a team could buy evaluations
 * and never learn what they showed.
 */
router.post(
  "/agent-run-results",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = resultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Run result is invalid",
        code: "agent_run_result_invalid",
      });
    }

    if (parsed.data.episodes_succeeded > parsed.data.episodes_run) {
      // Refused rather than clamped. More successes than episodes is a bug on
      // the reporting side, and quietly clamping it would write a measured
      // claim derived from a number nobody meant.
      return res.status(400).json({
        error: "More successes were reported than episodes ran.",
        code: "agent_run_result_impossible",
      });
    }

    try {
      const run = await getRunForReservation(parsed.data.reservation_id);
      if (run?.executionAdmission && (!run.dispatch?.pipelineRunId || run.dispatch.pipelineRunId !== parsed.data.pipeline_run_id || run.executionAdmission.digestSha256 !== parsed.data.execution_admission_digest)) {
        return res.status(409).json({ error: "Result does not match the claimed execution", code: "agent_execution_mismatch" });
      }
      const result = await recordRunResult({
        runId: runIdForReservation(parsed.data.reservation_id),
        report: {
          episodesRun: parsed.data.episodes_run,
          episodesSucceeded: parsed.data.episodes_succeeded,
          medianCycleSeconds: parsed.data.median_cycle_seconds ?? null,
          cycleSecondsP10: parsed.data.cycle_seconds_p10 ?? null,
          cycleSecondsP90: parsed.data.cycle_seconds_p90 ?? null,
          note: parsed.data.note ?? null,
          artifactUri: parsed.data.artifact_uri ?? null,
        },
      });

      if (!result) {
        return res.status(404).json({
          error: "No run is on file for that reservation.",
          code: "agent_run_not_found",
        });
      }

      return res.status(200).json({
        ok: true,
        runId: result.runId,
        observed: result.observed,
        // Echoed so the Pipeline can see what the numbers were allowed to
        // establish, which is deliberately less than the numbers themselves.
        claimed: result.claimed,
      });
    } catch (error) {
      logger.error(
        { error, reservationId: parsed.data.reservation_id },
        "Agent run result could not be recorded",
      );
      return res.status(503).json({
        error: "The result could not be recorded",
        code: "agent_run_result_unavailable",
      });
    }
  },
);

router.post(
  "/agent-run-settlements",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = settlementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Settlement is invalid",
        code: "agent_run_settlement_invalid",
      });
    }

    const {
      team_id: teamId,
      reservation_id: reservationId,
      run_id: runId,
      episodes_run: episodesRun,
      rate_usd: rateUsd,
    } = parsed.data;

    // Our own record for this hold, keyed on the reservation rather than on the
    // Pipeline's run id — the reservation is the only identifier both sides
    // agreed on, and it is the thing being settled.
    const recordId = runIdForReservation(reservationId);

    try {
      const priorRun = await getRunForReservation(reservationId);
      if (!priorRun) return res.status(404).json({ error: "No funded run exists for this reservation", code: "agent_run_not_found" });
      if (priorRun.teamId !== teamId || (priorRun.executionAdmission && (!priorRun.dispatch?.pipelineRunId || priorRun.dispatch.pipelineRunId !== parsed.data.pipeline_run_id || priorRun.executionAdmission.digestSha256 !== parsed.data.execution_admission_digest))) {
        return res.status(409).json({ error: "Settlement does not match the funded execution", code: "agent_execution_mismatch" });
      }
      if (parsed.data.blocked_before_any_episode && episodesRun > 0) return res.status(400).json({ error: "A blocked-before-execution report cannot contain executed episodes", code: "agent_run_settlement_invalid" });
      // Record the outcome before moving any money. If the ledger write below
      // throws, the outcome is already durable and due, so the reconciler
      // finishes the job on its next pass instead of the hold sitting there
      // waiting for a retry that may never come.
      const recorded = await reportRunOutcome({
        runId: recordId,
        state:
          parsed.data.blocked_before_any_episode || episodesRun === 0
            ? "blocked"
            : "completed",
        episodesRun,
        note: parsed.data.reason || `Pipeline run ${runId}`,
      });

      // A run that never executed an episode is our failure, not a result.
      // Release the whole hold rather than settling it at zero, so the ledger
      // says what happened rather than recording a spend of nothing.
      if (parsed.data.blocked_before_any_episode || episodesRun === 0) {
        const balance = await releaseReservation({
          teamId,
          reservationId,
          reason: parsed.data.reason || `Run ${runId} executed no episodes`,
          idempotencyKey: `settle-release:${reservationId}`,
        });
        if (recorded) {
          await markResolved(recordId, "blocked", "Released: no episodes ran");
        }
        return res.status(200).json({
          ok: true,
          settled: false,
          released: true,
          amountUsd: 0,
          reconciled: recorded,
          balance,
        });
      }

      // What the Pipeline says the work cost, capped at what the team's agent
      // actually authorised. `deriveBalance` books a settle at face value and
      // does not clamp it to the hold, so a wrong rate on this side would come
      // out of a team's balance as real spend. The quote is the ceiling: we
      // never charge for more than was agreed, however many episodes ran.
      const reportedUsd = Math.round(episodesRun * rateUsd * 100) / 100;
      const record = recorded ? await getRunForReservation(reservationId) : null;
      const amountUsd = record
        ? settlementAmountUsd({ ...record, episodesRun })
        : reportedUsd;

      const balance = await settleReservation({
        teamId,
        reservationId,
        amountUsd,
        reason: parsed.data.reason || `Run ${runId}: ${episodesRun} episodes`,
        // Keyed on the reservation, not the attempt, so the Pipeline retrying a
        // delivery it never saw acknowledged cannot charge the team twice — and
        // so the reconciler, using the same key, cannot charge for it either.
        idempotencyKey: `settle:${reservationId}`,
      });
      if (record) {
        await markResolved(recordId, "completed", `Settled $${amountUsd}`);
      }

      return res.status(200).json({
        ok: true,
        settled: true,
        released: false,
        amountUsd,
        quotedUsd: record?.quotedUsd ?? null,
        reportedUsd,
        episodesRun,
        reconciled: Boolean(record),
        balance,
      });
    } catch (error) {
      if (error instanceof RunOutcomeConflictError) {
        return res.status(409).json({
          error: error.message,
          code: "agent_run_outcome_conflict",
        });
      }
      logger.error({ error, teamId, reservationId }, "Agent run settlement failed");
      return res.status(503).json({
        error: "Settlement could not be recorded",
        code: "agent_run_settlement_unavailable",
      });
    }
  },
);

export default router;

/* ------------------------------------------------ the front of the loop */

/**
 * What an executor needs to know about the scene, and nothing about the site.
 *
 * The capture, the scene, the world manifest and the readiness summary are the
 * Pipeline's own vocabulary, written here by its own sync. The site's name,
 * address and contact are not on this payload: an executor runs a policy
 * against a scene, and who owns the room is not its business.
 */
async function sceneForExecutor(requestId: string) {
  if (!db) return null;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return null;
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  const pipeline = (data.pipeline ?? {}) as Record<string, unknown>;
  const artifacts = (pipeline.artifacts ?? {}) as Record<string, unknown>;
  return {
    request_id: requestId,
    capture_id: typeof pipeline.capture_id === "string" ? pipeline.capture_id : null,
    scene_id: typeof pipeline.scene_id === "string" ? pipeline.scene_id : null,
    world_manifest_uri:
      typeof artifacts.worldlabs_world_manifest_uri === "string"
        ? artifacts.worldlabs_world_manifest_uri
        : null,
    evaluation_readiness: data.evaluation_readiness ?? null,
  };
}

/**
 * The runs waiting to be executed.
 *
 * This is the call that was missing. Every purchased run was a record and a
 * hold; nothing could read the queue. The Pipeline pulls from here, marks a
 * run started below, and reports through the two routes above. A started run
 * stays on the list with its dispatch marker, so a Pipeline that restarts can
 * see what it was in the middle of.
 */
router.get("/agent-runs", createPipelineSyncRateLimiter(), guard, async (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

  try {
    const captureId = typeof req.query.capture_id === "string" ? req.query.capture_id.trim() : undefined;
    if (req.query.capture_id !== undefined && (!captureId || captureId.length > 200)) return res.status(400).json({ code: "capture_id_invalid" });
    const runs = await listRequestedRuns(limit, captureId);
    const rows = await Promise.all(
      runs.map(async (run) => {
        const [checkpoint, scene] = await Promise.all([
          getCheckpoint(run.checkpointId),
          sceneForExecutor(run.sceneId),
        ]);
        return {
          run_id: run.runId,
          reservation_id: run.reservationId,
          team_id: run.teamId,
          task_family: run.taskFamily,
          quoted_episodes: run.quotedEpisodes,
          quoted_usd: run.quotedUsd,
          requested_at_iso: run.requestedAtIso,
          execution_admission: run.executionAdmission?.envelope ?? null,
          execution_admission_canonical_json: run.executionAdmission?.canonicalJson ?? null,
          execution_admission_digest: run.executionAdmission?.digestSha256 ?? null,
          dispatch: run.dispatch
            ? { started_at_iso: run.dispatch.startedAtIso, pipeline_run_id: run.dispatch.pipelineRunId }
            : null,
          checkpoint: checkpoint
            ? {
                checkpoint_id: checkpoint.checkpointId,
                label: checkpoint.label,
                runtime: checkpoint.runtime,
                reference: checkpoint.reference,
              }
            : null,
          scene,
        };
      }),
    );
    return res.status(200).json({ runs: rows, count: rows.length });
  } catch (error) {
    logger.error({ error }, "Could not list queued agent runs");
    return res.status(503).json({ error: "The run queue could not be read", code: "agent_runs_unavailable" });
  }
});

const startedSchema = z
  .object({
    /** The Pipeline's own id for the run, when it has one. */
    pipeline_run_id: z.string().trim().min(1).max(200),
    execution_admission_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  })
  .strict();

/** The Pipeline has taken a run. Only a queued run can be started. */
router.post(
  "/agent-runs/:runId/started",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = startedSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Start marker is invalid", code: "agent_run_start_invalid" });
    }
    const runId = String(req.params.runId || "").trim();
    try {
      const started = await markRunStarted({ runId, pipelineRunId: parsed.data.pipeline_run_id, executionAdmissionDigest: parsed.data.execution_admission_digest });
      if (!started) {
        return res.status(409).json({ error: "Run is expired, resolved, or claimed by another executor.", code: "agent_run_not_queued" });
      }
      const run = await getRun(runId);
      return res.status(200).json({
        ok: true,
        run_id: runId,
        started_at_iso: run?.dispatch?.startedAtIso ?? null,
        pipeline_run_id: run?.dispatch?.pipelineRunId ?? null,
      });
    } catch (error) {
      logger.error({ error, runId }, "Could not mark an agent run started");
      return res.status(503).json({ error: "The start could not be recorded", code: "agent_run_start_unavailable" });
    }
  },
);

router.get("/agent-runs/:runId", createPipelineSyncRateLimiter(), guard, async (req: Request, res: Response) => {
  const run = await getRun(String(req.params.runId));
  if (!run) return res.status(404).json({ code: "agent_run_not_found" });
  return res.json({ run_id: run.runId, state: run.state, money_resolved: run.moneyResolved,
    execution_admission: run.executionAdmission?.envelope ?? null,
          execution_admission_canonical_json: run.executionAdmission?.canonicalJson ?? null,
    execution_admission_digest: run.executionAdmission?.digestSha256 ?? null,
    dispatch: run.dispatch ? { pipeline_run_id: run.dispatch.pipelineRunId, started_at_iso: run.dispatch.startedAtIso } : null });
});
