/**
 * Closing out the money a run reserved.
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

    try {
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
        return res.status(200).json({
          ok: true,
          settled: false,
          released: true,
          amountUsd: 0,
          balance,
        });
      }

      const amountUsd = Math.round(episodesRun * rateUsd * 100) / 100;
      const balance = await settleReservation({
        teamId,
        reservationId,
        amountUsd,
        reason: parsed.data.reason || `Run ${runId}: ${episodesRun} episodes`,
        // Keyed on the reservation, not the attempt, so the Pipeline retrying a
        // delivery it never saw acknowledged cannot charge the team twice.
        idempotencyKey: `settle:${reservationId}`,
      });

      return res.status(200).json({
        ok: true,
        settled: true,
        released: false,
        amountUsd,
        episodesRun,
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
