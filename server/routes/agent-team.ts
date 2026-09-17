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
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { logger } from "../logger";
import { createRateLimitRedisStore } from "../utils/rate-limit-redis";
import {
  authorizeAgentSpend,
  getSpendPolicy,
  getSpendToday,
  getTeamBalance,
  releaseReservation,
  setSpendPolicy,
} from "../utils/robotTeamBalance";
import {
  issueAgentKey,
  presentedAgentKey,
  resolveAgentKey,
} from "../utils/robotTeamAgentKeys";
import { registerSelfServeTeam } from "../utils/robotTeamRegistry";
import {
  MAX_TOPUP_USD,
  MIN_TOPUP_USD,
  startBalanceTopup,
} from "../utils/robotTeamFunding";
import {
  listCheckpoints,
  registerCheckpoint,
  type RobotCheckpoint,
} from "../utils/robotCheckpoints";
import {
  selectEvalsForBudget,
  type EvalCandidate,
} from "../utils/evalSelection";
import {
  buildTeamEvalCandidates,
  screeningRunCostUsd,
  screeningRunEpisodes,
} from "../utils/teamEvalCandidates";
import {
  createRequestedRun,
  listUnsettledRuns,
  markResolved,
  checkReleaseEligibility,
  reconcileTeamHolds,
  reservationTtlMs,
  runIdForReservation,
} from "../utils/agentEvalRuns";
import { createEvalPlanToken, verifyEvalPlanToken } from "../utils/evalPlanToken";
import { getRunForTeam, listRunsForTeam } from "../utils/agentRunResults";

const router = Router();

/**
 * What we need to run something. Declared here because registration can carry
 * a checkpoint inline, and a `const` is not hoisted.
 */
const checkpointSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    runtime: z.enum(["policy_endpoint", "container_image", "model_artifact"]),
    reference: z.string().trim().min(1).max(2000),
  })
  .strict();

/* ----------------------------------------------------------- registration */

/**
 * Open, because a closed one is a queue.
 *
 * Harder than the rest of this surface on purpose: registration is the only
 * route here with no credential, so it is the only one an anonymous caller can
 * reach. Ten a minute per address is far more than a real team needs and far
 * less than a useful way to fill a collection.
 */
const registrationRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitRedisStore("rl:agent-team-register:"),
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many registrations from this address. Try again shortly.",
      code: "registration_rate_limited",
    });
  },
});

const registerSchema = z
  .object({
    teamName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().email().max(320).optional(),
    website: z.string().trim().url().max(500).optional(),
    /** What the robot is for. One click, and it is the coarsest ranking input. */
    taskFamily: z.string().trim().max(60).optional(),
    /** What they build, in their words. For a person, never parsed. */
    capabilityDescription: z.string().trim().max(2000).optional(),
    /** Optional, so one call can get a team from nothing to a plan. */
    checkpoint: checkpointSchema.optional(),
  })
  .strict();

/**
 * Register a robot team and get a key, in one call, with no questions.
 *
 * ## Why there are no gates here
 *
 * The intake asks four gates before a team is in the registry: where the
 * hardware is, where they can deploy, engineer capacity, deployment timeline.
 * Every one of those is a fact about deploying a robot at a site. None of them
 * is needed to run a policy against a scene we already hold, and running it is
 * what a team came for. Gating evaluation on deployment questions is what made
 * the old flow end in "we will be in touch".
 *
 * They are still the right questions — for a pilot, where somebody is about to
 * spend real weeks. Asked then, they are due diligence. Asked here, they were
 * a queue.
 *
 * ## Why answering nothing costs a team nothing
 *
 * `evalSelection` ranks an unknown hard constraint above everything else: a
 * team we know nothing about has the most to learn from a run, by our own
 * scoring. So a blank team does not get a worse plan — it gets the most
 * informative one, and the run measures what the form used to ask it to
 * predict.
 *
 * ## What this grants
 *
 * An identity and nothing else. Zero balance, autonomous spend off, status
 * `self_registered`, which is outside the set of teams sites are told about.
 * The key is returned once and never stored in a readable form.
 */
router.post("/register", registrationRateLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Registration is invalid",
      code: "registration_invalid",
      required: {
        teamName: "string",
        contactEmail: "email (optional)",
        website: "url (optional)",
        checkpoint: "{ label, runtime, reference } (optional)",
      },
    });
  }

  const team = await registerSelfServeTeam({
    name: parsed.data.teamName,
    contactEmail: parsed.data.contactEmail ?? null,
    website: parsed.data.website ?? null,
    taskFamily: parsed.data.taskFamily ?? null,
    capabilityDescription: parsed.data.capabilityDescription ?? null,
  });
  if (!team) {
    return res.status(503).json({
      error: "The registry is unavailable, so no team was created.",
      code: "registry_unavailable",
    });
  }

  const issued = await issueAgentKey({ teamId: team.id, label: "self-serve" });
  if (!issued) {
    // A team with no key cannot do anything, and a second registration would
    // create a second team. Say so plainly rather than returning a half-made
    // account that looks like it worked.
    return res.status(503).json({
      error: "The team was created but no key could be issued.",
      code: "agent_key_unavailable",
      teamId: team.id,
      recovery: "Retry registration; this team record has no usable credential.",
    });
  }

  let checkpoint: RobotCheckpoint | { refusal: string; detail: string } | null = null;
  if (parsed.data.checkpoint) {
    const result = await registerCheckpoint({ teamId: team.id, ...parsed.data.checkpoint });
    // A bad checkpoint does not undo a good registration. The team keeps its
    // key and can register another; failing the whole call here would make them
    // register twice and leave an orphan team behind.
    checkpoint = result.registered ? result.checkpoint : { refusal: result.refusal, detail: result.detail };
  }

  return res.status(201).json({
    ok: true,
    teamId: team.id,
    // Once. We store a SHA-256 and cannot show it again.
    agentKey: issued.key,
    keyNote: "Store this now. It is not recoverable — issue another if you lose it.",
    checkpoint,
    grants: {
      balanceUsd: 0,
      agentSpendEnabled: false,
      note: "A key is an identity, not a credit line. Fund a balance and set a policy before an agent can spend.",
    },
    next: parsed.data.checkpoint
      ? [
          "POST /api/agent-team/funding to add balance (Stripe, face value).",
          "PUT /api/agent-team/policy to set a daily limit and switch the agent on.",
          "POST /api/agent-team/plan to see what your checkpoint should run against. Free.",
        ]
      : [
          "POST /api/agent-team/checkpoints with something we can run.",
          "POST /api/agent-team/funding to add balance (Stripe, face value).",
          "PUT /api/agent-team/policy to set a daily limit and switch the agent on.",
        ],
  });
});

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

  // Free this team's expired holds before anything here reads a balance.
  //
  // Reserving money is instant and resolving it used to depend on the Pipeline
  // calling our settlement endpoint, so a run nobody reported left the money
  // locked until a person noticed. Doing it here means the agent that is short
  // a hold is the one that clears it, on its own next call: no clock to be
  // switched on, no other system to remember. It swallows its own failures, so
  // a reconciliation problem cannot take down the surface — the balance just
  // stays conservative, which is the safe direction.
  await reconcileTeamHolds(teamId);

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
 * How much of a plan to show a team that has not funded anything yet.
 *
 * Ten runs is enough to see the shape of the offer — a spread of sites, the
 * reasons, the prices — without generating a list nobody will read.
 */
const PLANNING_PREVIEW_RUNS = 10;

/**
 * What would you buy, and why. Free, and free *before* funding.
 *
 * ## Why this is not capped by the balance
 *
 * It used to be. `budgetUsd` was the minimum of the ask, the daily allowance
 * and the balance — so a team that had just registered got an empty plan, and
 * the only way to find out what Blueprint could offer them was to pay first.
 *
 * That is exactly backwards for a loss leader. "Free to find out, paid to act"
 * requires that finding out works with a zero balance, and this route commits
 * nothing: no reservation, no ledger entry, no promise. A plan a team cannot
 * currently afford is not a lie, it is a quote.
 *
 * So the plan is sized by what the team asked for, and what they could actually
 * spend right now is reported beside it rather than silently truncating it. The
 * two numbers are different and a team is owed both.
 *
 * ## Why the rationale matters more than the ranking
 *
 * This is the call a team points at before it trusts its agent with a budget.
 * A ranking is not trustworthy because it is correct; it is trustworthy because
 * someone can read it and disagree.
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

  const dailyRemaining = policy.dailyLimitUsd > 0
    ? Math.max(0, policy.dailyLimitUsd - spentToday)
    : 0;
  // What the team could commit this minute. Reported, never used to truncate.
  const spendableNowUsd =
    Math.round(Math.min(dailyRemaining, balance.availableUsd) * 100) / 100;

  const budgetUsd =
    parsed.data.budgetUsd
    ?? (dailyRemaining > 0
      ? dailyRemaining
      : Math.round(PLANNING_PREVIEW_RUNS * screeningRunCostUsd() * 100) / 100);

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

  // Against what the plan actually costs, not against the budget it was sized
  // by: a $500 plan under a $2,000 ask needs $500, and quoting the ask would
  // ask a team to fund runs this plan does not contain.
  const fundingNeededUsd =
    Math.round(Math.max(0, selection.totalCostUsd - spendableNowUsd) * 100) / 100;

  return res.json({
    teamId,
    checkpointId: parsed.data.checkpointId,
    committed: false,
    plannedAgainstUsd: budgetUsd,
    spendableNowUsd,
    fundingNeededUsd,
    /** What stops this plan being bought right now, if anything does. */
    blockedBy:
      fundingNeededUsd === 0
        ? null
        : !policy.agentSpendEnabled
          ? "agent_spend_disabled"
          : balance.availableUsd <= 0
            ? "no_balance"
            : dailyRemaining <= 0
              ? "daily_limit_reached"
              : "insufficient_balance",
    next:
      fundingNeededUsd === 0
        ? "POST /api/agent-team/runs with confirm:true and an idempotencyKey."
        : !policy.agentSpendEnabled
          ? "PUT /api/agent-team/policy to set a daily limit and switch the agent on."
          : `POST /api/agent-team/funding with amountUsd ${fundingNeededUsd} to cover this plan.`,
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
    /**
     * The plan the team saw in the dry run, signed. When present, confirm
     * reserves exactly the scenes it names and refuses any that are no longer
     * runnable -- so a team spends on what it approved, not on whatever supply
     * happens to look like at confirm time. Absent keeps the old behaviour:
     * confirm reserves a freshly computed selection.
     */
    planToken: z.string().trim().max(4000).optional(),
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
    // Sign the plan we are showing, so a later confirm can reserve exactly
    // this and not whatever supply looks like by then.
    const planToken = createEvalPlanToken({
      teamId,
      checkpointId: parsed.data.checkpointId,
      lines: selection.selected.map((candidate) => ({
        sceneId: candidate.sceneId,
        costUsd: candidate.costUsd,
      })),
    });
    return res.status(200).json({
      dryRun: true,
      teamId,
      spent: false,
      planToken,
      ...selection,
      note: "Nothing was spent. Send confirm:true with this planToken and an idempotencyKey to start exactly these runs.",
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
    runId: string;
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

  // Which scenes actually get reserved. With a plan token, it is exactly what
  // the team approved: each named scene re-validated against current supply,
  // and any that is no longer runnable refused by name rather than swapped for
  // another. Without a token, the freshly computed selection, as before.
  let toReserve = selection.selected;
  if (parsed.data.planToken) {
    const plannedLines = verifyEvalPlanToken(parsed.data.planToken, {
      teamId,
      checkpointId: parsed.data.checkpointId,
    });
    if (!plannedLines) {
      return res.status(409).json({
        error: "That plan is no longer valid. Request a fresh dry run and confirm again.",
        code: "eval_plan_invalid",
      });
    }
    // Runnable means still in the catalogue, not still inside this confirm's
    // budget. `selected` is the budget-capped slice; `selected ∪ skipped` is
    // every scene `buildTeamEvalCandidates` returned -- the runnable supply,
    // ranked, with each rationale intact. Pinning against the slice would refuse
    // a scene the team approved just because supply that arrived since outranked
    // it for the budget, and call a site that plainly still exists "gone". A
    // scene the team approved that is genuinely unaffordable now is refused
    // below by `authorizeAgentSpend`, with a reason that says so.
    const rankedById = new Map(
      [...selection.selected, ...selection.skipped].map((ranked) => [ranked.sceneId, ranked]),
    );
    const pinned: typeof selection.selected = [];
    for (const line of plannedLines) {
      const candidate = rankedById.get(line.sceneId);
      if (!candidate) {
        // Named in the plan, not runnable now. Refused rather than substituted:
        // the team approved this site, and swapping in another would be
        // spending on something it never saw.
        refused.push({
          sceneId: line.sceneId,
          siteLabel: "This site",
          costUsd: line.costUsd,
          refusal: "site_no_longer_runnable",
          detail: "This site is no longer available to evaluate. Nothing was charged for it.",
        });
        continue;
      }
      pinned.push(candidate);
    }
    toReserve = pinned;
  }

  for (const [index, candidate] of toReserve.entries()) {
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

    // A hold with nothing attached to it is the bug this replaced: the money
    // was reserved, the run existed only as a promise, and nothing could ever
    // conclude it. The run record is what the settlement reconciler reads, so
    // writing it is part of authorising the spend, not a step after it.
    const run = await createRequestedRun({
      teamId,
      checkpointId: parsed.data.checkpointId,
      sceneId: candidate.sceneId,
      taskFamily: candidate.taskFamily ?? null,
      reservationId: authorization.reservationId,
      quotedUsd: candidate.costUsd,
      quotedEpisodes: screeningRunEpisodes(),
    });

    if (!run) {
      // The hold exists and the run does not, so nothing downstream could ever
      // settle it. Give the money straight back rather than leaving a hold the
      // reconciler has no record of.
      await releaseReservation({
        teamId,
        reservationId: authorization.reservationId,
        reason: "Run record could not be written; hold returned immediately",
        idempotencyKey: `release:${authorization.reservationId}`,
      });
      refused.push({
        sceneId: candidate.sceneId,
        siteLabel: candidate.siteLabel,
        costUsd: candidate.costUsd,
        refusal: "run_record_unavailable",
        detail:
          "The run could not be recorded, so its hold was released. Nothing was charged. Retry with the same idempotencyKey.",
      });
      continue;
    }

    started.push({
      runId: run.runId,
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
    // Stated in the response because an agent budgeting across days needs to
    // know that a hold is not a permanent deduction. Nothing has to be polled
    // and nothing has to be chased: a run that never reports releases itself.
    holds: {
      settlesOn: "episodes actually executed, pro-rated against the quote",
      expiresAfterMs: reservationTtlMs(),
      onExpiry: "released in full; the run is marked abandoned and nothing is charged",
      inspect: "GET /api/agent-team/runs",
    },
  });
});

/**
 * Every hold this team has open, and what will happen to it.
 *
 * The question an agent asks when its available balance is lower than it
 * expected. Without this the only answer was to ask a person to read the
 * ledger, which is the thing this whole surface exists to remove.
 */
router.get("/runs", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const runs = await listUnsettledRuns(teamId);
  const ttlMs = reservationTtlMs();

  return res.json({
    teamId,
    ttlMs,
    runs: runs.map((run) => ({
      runId: run.runId,
      sceneId: run.sceneId,
      checkpointId: run.checkpointId,
      reservationId: run.reservationId,
      state: run.state,
      quotedUsd: run.quotedUsd,
      quotedEpisodes: run.quotedEpisodes,
      episodesRun: run.episodesRun,
      requestedAtIso: run.requestedAtIso,
      // Absolute, not relative, so an agent comparing two responses taken
      // minutes apart reads one number rather than doing the arithmetic twice.
      holdExpiresAtIso:
        run.state === "requested"
          ? new Date(Date.parse(run.requestedAtIso) + ttlMs).toISOString()
          : null,
    })),
    heldUsd:
      Math.round(runs.reduce((sum, run) => sum + run.quotedUsd, 0) * 100) / 100,
  });
});

/**
 * Everything this team has bought, and what each one showed.
 *
 * `GET /runs` above answers "where is my money"; this answers "what did I
 * learn", which is the question the team actually paid for and the one nothing
 * on this surface could answer. A run that has settled drops off the holds
 * list, so without this a finished evaluation became invisible at the exact
 * moment it became useful.
 *
 * Results carry both what was observed and what that entitles us to claim, kept
 * apart on purpose: fifty successes in fifty episodes is a real observation and
 * is not a demonstration of better than 99%, and a team reading its own result
 * should be able to see both numbers and tell which is which.
 */
router.get("/results", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const runs = await listRunsForTeam(teamId);

  return res.json({
    teamId,
    runs: runs.map((run) => ({
      runId: run.runId,
      checkpointId: run.checkpointId,
      sceneId: run.sceneId,
      taskFamily: run.taskFamily,
      state: run.state,
      quotedUsd: run.quotedUsd,
      episodesRun: run.episodesRun,
      requestedAtIso: run.requestedAtIso,
      result: run.result ?? null,
      // Said plainly rather than left to be inferred from a null: a run with no
      // result is not a run that found nothing.
      resultStatus: run.result
        ? "reported"
        : run.state === "abandoned"
          ? "never_reported"
          : "awaiting_result",
    })),
  });
});

/** One run, with whatever it showed. */
router.get("/results/:runId", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const run = await getRunForTeam(teamId, String(req.params.runId || "").trim());
  // 404 for another team's run as well as for one that does not exist. A run id
  // is derivable from a reservation id, so distinguishing the two would let a
  // team confirm which of its guesses name real runs.
  if (!run) {
    return res.status(404).json({ error: "No such run for this team.", code: "run_not_found" });
  }

  return res.json({
    teamId,
    runId: run.runId,
    checkpointId: run.checkpointId,
    sceneId: run.sceneId,
    state: run.state,
    quotedUsd: run.quotedUsd,
    episodesRun: run.episodesRun,
    requestedAtIso: run.requestedAtIso,
    result: run.result ?? null,
    resultStatus: run.result
      ? "reported"
      : run.state === "abandoned"
        ? "never_reported"
        : "awaiting_result",
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

  // A release is a cancellation, and cancellation has a window. This used to
  // take any reservation id and give the hold back without looking at the run,
  // so an agent could reserve, let execution start, release, and keep the work.
  const eligibility = await checkReleaseEligibility(teamId, reservationId);

  if (!eligibility.allowed) {
    return res.status(409).json({
      error:
        eligibility.reason === "outcome_reported"
          ? "This run has already reported an outcome, so its hold is not yours to cancel."
          : "That reservation belongs to another team.",
      code: eligibility.reason,
      ...(eligibility.reason === "outcome_reported"
        ? {
            why:
              "Cancelling is for a run that never started. Once episodes are reported the run " +
              "settles on what it did — a failed attempt is billable and an environment that " +
              "would not launch is not, and that is the Pipeline's report to make rather than " +
              "the spender's.",
            state: eligibility.run.state,
            episodesRun: eligibility.run.episodesRun,
          }
        : {}),
    });
  }

  // Already settled or released. Same answer as the first time, and no second
  // ledger entry: an agent retrying a call it never saw the answer to must not
  // change anything by asking twice.
  if (eligibility.alreadyResolved) {
    return res.json({
      ok: true,
      reservationId,
      released: false,
      alreadyResolved: true,
      balance: await getTeamBalance(teamId),
    });
  }

  const balance = await releaseReservation({
    teamId,
    reservationId,
    reason: "Cancelled by the team's agent before any outcome was reported",
    idempotencyKey: `release:${reservationId}`,
  });

  // Take the run out of the settlement queue too. Without this the reconciler
  // would later find a `requested` run whose hold was already given back and
  // release it a second time — harmless, because the ledger dedupes, but it
  // would report work as abandoned that a team deliberately cancelled.
  await markResolved(
    runIdForReservation(reservationId),
    "abandoned",
    "Released by the team's agent before the run started",
  );

  return res.json({ ok: true, reservationId, released: true, balance });
});

/* ------------------------------------------------------------- funding */

const fundingSchema = z
  .object({
    amountUsd: z.number().finite().positive().max(1_000_000),
  })
  .strict();

/**
 * Add balance, without asking anyone.
 *
 * This was the last thing on the robot-team path that required an operator. An
 * agent could plan, quote and refuse entirely on its own, and then the money it
 * spent against had to be credited by a person running an admin route — so "a
 * team hands its agent $100 a day" started with an email to us.
 *
 * ## No price is invented here
 *
 * A top-up is face value: ask for $100, pay $100, get $100 of balance. Run
 * prices still come from `episodePricing` and are quoted per run. That is why
 * this can be self-serve at all — a number the team chose, charged at face
 * value, is not a commercial term that needs approving.
 *
 * ## The link, not the money
 *
 * This returns a Stripe URL and credits nothing. Payment is proven by
 * `checkout.session.completed`, at the webhook, because a success redirect is
 * just a URL anyone could open. An agent creates the session, passes the link
 * to whoever holds the card, and watches `GET /me` for the balance to move —
 * which is the right shape for an agent in CI with nowhere to be redirected to.
 */
router.post("/funding", async (req: Request, res: Response) => {
  const teamId = await requireTeam(req, res);
  if (!teamId) return;

  const parsed = fundingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Funding request is invalid",
      code: "funding_invalid",
      required: { amountUsd: `number between ${MIN_TOPUP_USD} and ${MAX_TOPUP_USD}` },
    });
  }

  const result = await startBalanceTopup({ teamId, amountUsd: parsed.data.amountUsd });
  if (!result.created) {
    return res.status(result.refusal === "stripe_unavailable" ? 503 : 400).json({
      error: result.detail,
      code: result.refusal,
      bounds: { minUsd: MIN_TOPUP_USD, maxUsd: MAX_TOPUP_USD },
    });
  }

  return res.status(201).json({
    ok: true,
    teamId,
    amountUsd: result.amountUsd,
    checkoutUrl: result.checkoutUrl,
    sessionId: result.sessionId,
    credited: false,
    note: "Nothing is credited until the payment completes. Poll GET /api/agent-team/me for the balance.",
    next: "PUT /api/agent-team/policy to set a daily limit and switch the agent on once funded.",
  });
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
