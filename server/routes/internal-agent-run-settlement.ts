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
  runIdForReservation,
  settlementAmountUsd,
} from "../utils/agentEvalRuns";

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
        ? Math.min(reportedUsd, settlementAmountUsd({ ...record, episodesRun }))
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
      logger.error({ error, teamId, reservationId }, "Agent run settlement failed");
      return res.status(503).json({
        error: "Settlement could not be recorded",
        code: "agent_run_settlement_unavailable",
      });
    }
  },
);

export default router;
