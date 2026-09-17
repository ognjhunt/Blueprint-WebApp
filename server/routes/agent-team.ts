/**
 * What a robot team's agent can do without a person in the loop.
 *
 * ## The shape of the thing
 *
 * A team funds a balance, sets a daily limit, switches its agent on, and hands
 * it a key. From then on the agent can look at every site on the platform,
 * work out which evaluations would actually teach it something, and buy them —
 * inside limits the team set and can change or revoke at any moment.
 *
 * Every route here is bounded by the same three questions, in order: who is
 * this key for, may that team spend this, and is this run worth buying. The
 * first two are policy and arithmetic. The third is `evalSelection`, which
 * ranks by expected information gain per dollar rather than by likelihood of
 * passing — a run that confirms what a team already knows is the thing they
 * should not be sold.
 *
 * ## Read is open; spend is not
 *
 * Discovery, quoting and planning need a key but commit nothing, so an agent
 * can explore the whole platform and produce a plan its team reads before any
 * money is authorised. `POST /runs` is the only route here that spends, and it
 * goes through `authorizeAgentSpend`, which reserves before it runs and refuses
 * with a named reason an agent can act on rather than a generic failure.
 *
 * ## Dry run by default is deliberate
 *
 * `POST /runs` requires `confirm: true`. An agent that forgets it gets the plan
 * and the quote back and spends nothing. The cost of that mistake should be
 * reading a JSON body, not a bill.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../logger";
import {
  authorizeAgentSpend,
  getSpendPolicy,
  getSpendToday,
  getTeamBalance,
  releaseReservation,
  setSpendPolicy,
} from "../utils/robotTeamBalance";
import {
  presentedAgentKey,
  resolveAgentKey,
} from "../utils/robotTeamAgentKeys";
import {
  listCheckpoints,
  registerCheckpoint,
} from "../utils/robotCheckpoints";
import {
  selectEvalsForBudget,
  type EvalCandidate,
} from "../utils/evalSelection";
import { buildTeamEvalCandidates } from "../utils/teamEvalCandidates";

const router = Router();

/** Resolve the key to a team, or answer 401 without saying why. */
async function requireTeam(req: Request, res: Response): Promise<string | null> {
  const teamId = await resolveAgentKey(
    presentedAgentKey(req.headers as unknown as Record<string, unknown>),
  );
  if (!teamId) {
    res.status(401).json({
      error: "A valid Blueprint agent key is required.",
      code: "agent_key_invalid",
      hint: "Send it as `Authorization: Bearer bpk_...`. Keys are issued per team and can be revoked.",
    });
    return null;
  }
  return teamId;
}

/* ------------------------------------------------------------ who am i */

/**
 * Everything an agent needs to decide whether it can act, in one call.
 *
 * Deliberately one round trip. An agent that has to make four calls to learn it
 * is switched off will make four calls every time it wakes up.
 */
router.get("/me", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const [balance, policy, spentToday, checkpoints] = await Promise.all([
    getTeamBalance(teamId),
    getSpendPolicy(teamId),
    getSpendToday(teamId),
    listCheckpoints(teamId),
  ]);

  const remainingToday = policy.dailyLimitUsd > 0
    ? Math.max(0, Math.round((policy.dailyLimitUsd - spentToday) * 100) / 100)
    : 0;

  return res.json({
    teamId,
    balance,
    policy,
    spentTodayUsd: spentToday,
    remainingTodayUsd: remainingToday,
    checkpoints: checkpoints.map((item) => ({
      checkpointId: item.checkpointId,
      label: item.label,
      runtime: item.runtime,
      status: item.status,
      unrunnableReason: item.unrunnableReason,
    })),
    canSpendNow: policy.agentSpendEnabled && remainingToday > 0 && balance.availableUsd > 0,
  });
});

/* -------------------------------------------------------- checkpoints */

const checkpointSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    runtime: z.enum(["policy_endpoint", "container_image", "model_artifact"]),
    reference: z.string().trim().min(1).max(2000),
  })
  .strict();

/**
 * Register something we can run.
 *
 * Note what this does not ask for: payload, cycle time, success rate. Those are
 * outputs of a run, and asking a team to predict its own benchmark results was
 * the worst requirement in the old intake.
 */
router.post("/checkpoints", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const parsed = checkpointSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Checkpoint registration is invalid",
      code: "checkpoint_invalid",
      required: { label: "string", runtime: "policy_endpoint | container_image | model_artifact", reference: "string" },
    });
  }

  const result = await registerCheckpoint({ teamId, ...parsed.data });
  if (!result.registered) {
    return res.status(409).json({ error: result.detail, code: result.refusal });
  }

  return res.status(201).json({
    ok: true,
    checkpoint: result.checkpoint,
    next: "POST /api/agent-team/plan to see which evaluations would teach you the most.",
  });
});

router.get("/checkpoints", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;
  return res.json({ teamId, checkpoints: await listCheckpoints(teamId) });
});

/* --------------------------------------------------------------- plan */

const planSchema = z
  .object({
    checkpointId: z.string().trim().min(1).max(200),
    /** Defaults to whatever the team's daily limit still allows. */
    budgetUsd: z.number().finite().positive().max(100_000).optional(),
    maxRuns: z.number().int().positive().max(50).optional(),
  })
  .strict();

/**
 * What would you buy, and why.
 *
 * Commits nothing. This is the call a team points at before it trusts its agent
 * with a budget, and the call the agent makes every morning before it spends.
 * The rationale on every row is the point — a team should be able to read its
 * agent's reasoning and disagree with it.
 */
router.post("/plan", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Plan request is invalid", code: "plan_invalid" });
  }

  const [policy, spentToday, balance] = await Promise.all([
    getSpendPolicy(teamId),
    getSpendToday(teamId),
    getTeamBalance(teamId),
  ]);

  // A plan is capped by whichever runs out first: today's allowance, or the
  // money. Planning against a budget the team cannot fund produces a list that
  // reads like a promise and is not one.
  const dailyRemaining = policy.dailyLimitUsd > 0
    ? Math.max(0, policy.dailyLimitUsd - spentToday)
    : 0;
  const budgetUsd = Math.min(
    parsed.data.budgetUsd ?? dailyRemaining,
    dailyRemaining,
    balance.availableUsd,
  );

  let candidates: EvalCandidate[];
  try {
    candidates = await buildTeamEvalCandidates({
      teamId,
      checkpointId: parsed.data.checkpointId,
    });
  } catch (error) {
    logger.error({ error, teamId }, "Could not build evaluation candidates");
    return res.status(503).json({ error: "Site catalogue is unavailable", code: "catalogue_unavailable" });
  }

  const selection = selectEvalsForBudget({
    candidates,
    budgetUsd,
    maxRuns: parsed.data.maxRuns,
  });

  return res.json({
    teamId,
    checkpointId: parsed.data.checkpointId,
    constrainedBy:
      budgetUsd === 0
        ? policy.agentSpendEnabled
          ? "no_budget_remaining"
          : "agent_spend_disabled"
        : budgetUsd === balance.availableUsd
          ? "balance"
          : "daily_limit",
    ...selection,
  });
});

/* --------------------------------------------------------------- spend */

const runsSchema = z
  .object({
    checkpointId: z.string().trim().min(1).max(200),
    budgetUsd: z.number().finite().positive().max(100_000).optional(),
    maxRuns: z.number().int().positive().max(50).optional(),
    /** Absent or false returns the plan and spends nothing. */
    confirm: z.boolean().optional(),
    /** Required when confirming, so a retry cannot double-spend. */
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .strict();

/**
 * Buy the plan.
 *
 * The only route on this surface that moves money. Each selected run is
 * authorised separately rather than as one lump, so a team that can afford
 * three of five gets three runs and a clear reason for the other two — instead
 * of an all-or-nothing refusal that tells the agent nothing about what to try
 * next.
 */
router.post("/runs", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const parsed = runsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Run request is invalid", code: "run_request_invalid" });
  }

  const [policy, spentToday, balance] = await Promise.all([
    getSpendPolicy(teamId),
    getSpendToday(teamId),
    getTeamBalance(teamId),
  ]);

  const dailyRemaining = policy.dailyLimitUsd > 0
    ? Math.max(0, policy.dailyLimitUsd - spentToday)
    : 0;
  const budgetUsd = Math.min(
    parsed.data.budgetUsd ?? dailyRemaining,
    dailyRemaining,
    balance.availableUsd,
  );

  let candidates: EvalCandidate[];
  try {
    candidates = await buildTeamEvalCandidates({
      teamId,
      checkpointId: parsed.data.checkpointId,
    });
  } catch (error) {
    logger.error({ error, teamId }, "Could not build evaluation candidates");
    return res.status(503).json({ error: "Site catalogue is unavailable", code: "catalogue_unavailable" });
  }

  const selection = selectEvalsForBudget({
    candidates,
    budgetUsd,
    maxRuns: parsed.data.maxRuns,
  });

  if (!parsed.data.confirm) {
    return res.status(200).json({
      dryRun: true,
      teamId,
      spent: false,
      ...selection,
      note: "Nothing was spent. Send confirm:true with an idempotencyKey to start these runs.",
    });
  }

  if (!parsed.data.idempotencyKey) {
    return res.status(400).json({
      error: "An idempotencyKey is required to confirm spend.",
      code: "idempotency_key_required",
      why: "An agent that retries a call it never saw the answer to must not pay twice.",
    });
  }

  type StartedRun = {
    sceneId: string;
    siteLabel: string;
    costUsd: number;
    reservationId: string;
    rationale: string;
  };
  const started: StartedRun[] = [];
  const refused: {
    sceneId: string;
    siteLabel: string;
    costUsd: number;
    refusal: string;
    detail: string;
  }[] = [];

  for (const [index, candidate] of selection.selected.entries()) {
    const authorization = await authorizeAgentSpend({
      teamId,
      amountUsd: candidate.costUsd,
      reason: `Evaluation of ${parsed.data.checkpointId} against ${candidate.siteLabel}`,
      idempotencyKey: `${parsed.data.idempotencyKey}:${index}`,
    });

    if (!authorization.authorized) {
      refused.push({
        sceneId: candidate.sceneId,
        siteLabel: candidate.siteLabel,
        costUsd: candidate.costUsd,
        refusal: authorization.refusal,
        detail: authorization.detail,
      });
      continue;
    }

    // The reservation is the commitment. Handing the run to the Pipeline is the
    // next step and is not this route's job; a run that never starts releases
    // its hold rather than silently keeping the money.
    started.push({
      sceneId: candidate.sceneId,
      siteLabel: candidate.siteLabel,
      costUsd: candidate.costUsd,
      reservationId: authorization.reservationId,
      rationale: candidate.rationale,
    });
  }

  return res.status(202).json({
    dryRun: false,
    teamId,
    spent: started.length > 0,
    started,
    refused,
    reservedUsd:
      Math.round(started.reduce((sum, item) => sum + item.costUsd, 0) * 100) / 100,
    balance: await getTeamBalance(teamId),
    summary: selection.summary,
  });
});

/** Give back a hold for a run that never started. */
router.post("/runs/:reservationId/release", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const reservationId = String(req.params.reservationId || "").trim();
  if (!reservationId) {
    return res.status(400).json({ error: "A reservationId is required" });
  }

  const balance = await releaseReservation({
    teamId,
    reservationId,
    reason: "Run did not start",
    idempotencyKey: `release:${reservationId}`,
  });

  return res.json({ ok: true, reservationId, balance });
});

/* -------------------------------------------------------------- policy */

const policySchema = z
  .object({
    dailyLimitUsd: z.number().finite().min(0).max(100_000),
    perRunLimitUsd: z.number().finite().min(0).max(100_000),
    agentSpendEnabled: z.boolean(),
  })
  .strict();

/**
 * The team's own limits on its agent.
 *
 * Readable by the agent so it can explain why it did nothing, and writable so a
 * team can stop it instantly without revoking the key or touching the balance.
 */
router.get("/policy", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;
  return res.json({ teamId, policy: await getSpendPolicy(teamId) });
});

router.put("/policy", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Policy is invalid", code: "policy_invalid" });
  }

  return res.json({ ok: true, policy: await setSpendPolicy({ teamId, ...parsed.data }) });
});

export default router;
