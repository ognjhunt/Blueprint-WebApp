/**
 * The review queue.
 *
 * A proposal nobody can act on is just a log line. This is the surface where a
 * person turns a model's reading of a public page into a registry value — or
 * declines it, which is the more common and more valuable outcome.
 *
 * Every route here is behind `verifyFirebaseToken` at registration. The accept
 * path records who accepted, because "a person reviewed this" is only a real
 * guarantee if the person is named.
 */
import { Router, type Request, type Response } from "express";

import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import { z } from "zod";

import {
  applyProposal,
  getRobotTeam,
  listMatchableRobotTeams,
  listPendingProposals,
  recordSupplyAgreement,
  withdrawTeamSupplyAgreement,
} from "../utils/robotTeamRegistry";
import {
  isWillingSupply,
  readSupplyAgreement,
  supplySummary,
  SUPPLY_AGREEMENT_TERM_LABELS,
  SUPPORTED_SUPPLY_INTERFACES,
} from "../utils/robotTeamSupply";
import { robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";
import { ROBOT_TEAM_ROLES, SUPPLY_AGREEMENT_TERMS, type RobotTeamRole } from "../types/robot-team-registry";
import { hasAnyRole } from "../utils/access-control";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { requireAdminRole } from "../middleware/requireAdminRole";
import {
  creditTeam,
  getSpendPolicy,
  getSpendToday,
  getTeamBalance,
  setSpendPolicy,
} from "../utils/robotTeamBalance";
import {
  issueAgentKey,
  listAgentKeys,
  revokeAgentKey,
} from "../utils/robotTeamAgentKeys";

const router = Router();
// Every route here is operator-only. The queue and the registry used to check
// only that a caller was signed in, so any robot team or site with an account
// could list every team.
router.use(requireAdminRole);

import { getBrief } from "../utils/siteTaskBrief";
import { loadCurrentSiteAssessmentView } from "../utils/siteAssessmentPublic";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { projectCurrentSiteJobDecision, siteJobDecisionSourceDigest } from "../utils/siteJobDecision";
import siteJobCommunicationsRouter from "./admin-site-job-communications";
import type { RobotTeamRecord } from "../types/robot-team-registry";

router.use(siteJobCommunicationsRouter);

const decisionSchema = z.object({ sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  recommendation: z.string().trim().min(8).max(2000), why: z.string().trim().min(8).max(2000),
  decisiveUncertainty: z.string().trim().max(2000), nextAction: z.string().trim().min(8).max(2000),
  question: z.object({ text: z.string().trim().min(8).max(1000), reason: z.string().trim().min(8).max(1000) }).strict().nullable().default(null),
}).strict();

/** Blueprint's reviewed decision for the site, recorded against the current evidence. */
router.post("/recommendations/:requestId/decision", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body), actor = String(res.locals.firebaseUser?.uid ?? "").trim();
  if (!parsed.success || !actor) return res.status(400).json({ error: "A named reviewer must record the recommendation, why, decisive uncertainty and Blueprint's next action against the current evidence." });
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const requestId = String(req.params.requestId), input = parsed.data;
  try {
    await db.runTransaction(async tx => {
      const ref = db!.collection("inboundRequests").doc(requestId), current = (await tx.get(ref)).data();
      const brief = (await tx.get(db!.collection("siteTaskBriefs").doc(requestId))).data() ?? null;
      if (!current) throw new Error("job_missing");
      const assessment = await loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: current.account_owner_uid ?? null });
      if (siteJobDecisionSourceDigest(current, brief, assessment.decisionAssessment) !== input.sourceDigest) throw new Error("decision_source_changed");
      if (current.customer_decision?.sourceDigest === input.sourceDigest
        && humanDecisionDigest({ recommendation: current.customer_decision.recommendation, why: current.customer_decision.why,
          decisiveUncertainty: current.customer_decision.decisiveUncertainty, nextAction: current.customer_decision.nextAction,
          question: current.customer_decision.question ?? null }) === humanDecisionDigest({ recommendation: input.recommendation,
          why: input.why, decisiveUncertainty: input.decisiveUncertainty, nextAction: input.nextAction, question: input.question })) return;
      tx.update(ref, { customer_decision: { schemaVersion: "site_job_decision.v1", ...input,
        reviewedBy: actor, reviewedAtIso: new Date().toISOString() }, customerAnswerReviewRequired: false,
        customerAnswerNextOwner: "Blueprint", customerAnswerNextAction: input.nextAction });
    });
    return res.json({ ok: true });
  } catch { return res.status(409).json({ error: "The job or assessment changed. Reload the current evidence before recording the decision." }); }
});

/** The reviewed decision on an existing private job, with the customer's answers; never auto-match or publish. */
router.get("/recommendations/:requestId", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const requestId = String(req.params.requestId);
  try {
    const record = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (!record) return res.status(404).json({ error: "Job not found" });
    const [brief, assessment, interests] = await Promise.all([getBrief(requestId),
      loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: record.account_owner_uid ?? null }),
      db.collection("inboundRequests").doc(requestId).collection("robotTeamInterest").limit(100).get()]);
    res.set("Cache-Control", "no-store");
    return res.json({ requestId,
      decision: projectCurrentSiteJobDecision(record, brief, assessment.decisionAssessment, assessment.compatibleDecisionAssessments), decisionSourceDigest: siteJobDecisionSourceDigest(record, brief, assessment.decisionAssessment),
      customerConversation: Array.isArray(record.customerConversation) ? record.customerConversation : [],
      customerClarification: record.site_task_clarification ?? null,
      assessment: assessment.customerAdvisory,
      interests: interests.docs.map(doc => doc.data()),
      communications: { route: `/api/admin/robot-teams/jobs/${encodeURIComponent(requestId)}/communications`,
        draftingEnabled: process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true", deliveryEnabled: process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true" } });
  } catch (error) { logger.error({ err: error, requestId }, "Job review unavailable"); return res.status(503).json({ error: "Job review unavailable" }); }
});

/** The queue, oldest proposals first so nothing rots at the bottom. */
router.get("/proposals", async (_req: Request, res: Response) => {
  try {
    const proposals = await listPendingProposals();
    return res.json({
      ok: true,
      proposals: proposals.sort((left, right) =>
        left.proposedAt.localeCompare(right.proposedAt),
      ),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list capability proposals");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to list proposals" });
  }
});

/**
 * Accept or decline one proposal.
 *
 * `accept` is required rather than defaulted. A missing field should not mean
 * "yes" on the one route in this system that turns an inferred figure into
 * something a site operator may eventually read.
 */
router.post("/proposals/:proposalId", async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const accept = req.body?.accept;
  if (typeof accept !== "boolean") {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ ok: false, error: "accept must be true or false" });
  }

  // The auth middleware sets `firebaseUser`; this read `res.locals.user`,
  // which nothing sets, so every review was refused as anonymous.
  const reviewedBy =
    (res.locals?.firebaseUser?.email as string | undefined) ||
    (res.locals?.firebaseUser?.uid as string | undefined) ||
    null;
  if (!reviewedBy) {
    return res
      .status(401)
      .json({ ok: false, error: "A named reviewer is required" });
  }

  try {
    const record = await applyProposal({ proposalId, reviewedBy, accept });
    return res.json({ ok: true, accepted: accept, robotTeam: record });
  } catch (error) {
    logger.error({ err: error, proposalId }, "Failed to apply a capability proposal");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to apply proposal" });
  }
});

const REGISTRY_LIST_STATUSES: RobotTeamRecord["status"][] = ["applied", "engaged", "prospect", "declined", "self_registered"];

/**
 * The registry itself, for an operator checking what a match ran against.
 * `?status=self_registered` lists account-bound rows, which is where a team's
 * evaluations run and so where its supply agreement is best recorded.
 */
router.get("/", async (req: Request, res: Response) => {
  const requested = typeof req.query.status === "string" ? req.query.status : null;
  const role = typeof req.query.role === "string" ? req.query.role : null;
  if (requested && !REGISTRY_LIST_STATUSES.includes(requested as RobotTeamRecord["status"])) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: `status must be one of ${REGISTRY_LIST_STATUSES.join(", ")}` });
  }
  if (role && !ROBOT_TEAM_ROLES.includes(role as RobotTeamRole)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: `role must be one of ${ROBOT_TEAM_ROLES.join(", ")}` });
  }
  try {
    const teams = await listMatchableRobotTeams({
      ...(requested ? { statuses: [requested as RobotTeamRecord["status"]] }
        : !role ? { statuses: ["applied", "engaged", "prospect", "declined"] as RobotTeamRecord["status"][] } : {}),
      ...(role ? { role: role as RobotTeamRole } : {}),
    });
    // Status is already the effective one; `supply` says why a team is or is
    // not counted, so a reviewer never has to infer it from the status word.
    return res.json({
      ok: true,
      supplyCount: teams.filter(isWillingSupply).length,
      teams: teams.map((team) => ({ ...team, supply: supplySummary(team) })),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list robot teams");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to list robot teams" });
  }
});

/* ------------------------------------------------- supply agreements */

/**
 * The founder's record of what a robot team agreed to.
 *
 * A team counts as supply (`engaged`) only once three agreements are on
 * record: it runs a policy on the supported interface, it accepts a free
 * evaluation on a real job, and it takes the pilot if it passes. Each is
 * recorded with the day, a reference to where the agreement is kept, and the
 * signed-in operator, who is read from the session and never from the body.
 * Runbook: docs/beta/ROBOT_TEAM_SUPPLY_AGREEMENTS.md.
 */
const supplyTermSchema = z.object({
  term: z.enum(SUPPLY_AGREEMENT_TERMS),
  agreedOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  evidenceRef: z.string().trim().min(3).max(300),
  interfaceId: z.string().trim().min(1).max(120).optional(),
  robotEmbodiment: robotEmbodimentSchema.optional(),
}).strict();
const supplyAgreementSchema = z.object({
  terms: z.array(supplyTermSchema).min(1).max(SUPPLY_AGREEMENT_TERMS.length),
  /** The operator holds the referenced evidence and it says exactly this. */
  evidenceHeld: z.literal(true),
}).strict();
const supplyWithdrawalSchema = z.object({
  withdrawnOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  evidenceRef: z.string().trim().min(3).max(300),
  evidenceHeld: z.literal(true),
  /** Omitted keeps legacy full withdrawal. A delivery withdrawal need not revoke policy access. */
  terms: z.array(z.enum(SUPPLY_AGREEMENT_TERMS)).min(1).max(SUPPLY_AGREEMENT_TERMS.length).optional(),
}).strict();

function namedOperator(res: Response): string | null {
  return (res.locals?.firebaseUser?.email as string | undefined)
    || (res.locals?.firebaseUser?.uid as string | undefined)
    || null;
}

function supplyResponse(record: RobotTeamRecord) {
  return { teamId: record.id, status: record.status, ...supplySummary(record) };
}

/** What the team has agreed to, with the evidence references, for an operator. */
router.get("/:teamId/supply-agreement", async (req: Request, res: Response) => {
  const teamId = String(req.params.teamId || "").trim();
  try {
    const team = await getRobotTeam(teamId);
    if (!team) return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "No registry row has that id." });
    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      ...supplyResponse(team),
      supportedInterfaceId: team.supplyAgreement?.terms?.supportedInterface?.interfaceId ?? null,
      supportedInterfaces: SUPPORTED_SUPPLY_INTERFACES,
      terms: SUPPLY_AGREEMENT_TERMS.map((term) => ({ term, label: SUPPLY_AGREEMENT_TERM_LABELS[term],
        recorded: team.supplyAgreement?.terms?.[term] ?? null,
        problem: readSupplyAgreement(team).problems.find((row) => row.term === term)?.problem ?? null })),
      history: team.supplyAgreement?.history ?? [],
    });
  } catch (error) {
    logger.error({ err: error, teamId }, "Supply agreement unavailable");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Supply agreement unavailable" });
  }
});

/** Record one or more agreements. The third one makes the team `engaged`. */
router.post("/:teamId/supply-agreement", async (req: Request, res: Response) => {
  const recordedBy = namedOperator(res);
  if (!recordedBy) return res.status(401).json({ ok: false, error: "A named operator must record the agreement." });
  const parsed = supplyAgreementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: "supply_agreement_invalid",
      errors: parsed.error.issues.map(issue => ({ field: issue.path.join("."), problem: issue.message })),
      error: "Send each agreement as { term, agreedOn: YYYY-MM-DD, evidenceRef }, and confirm evidenceHeld: true. For supportedInterface, explicitly name interfaceId and include robotEmbodiment when using blueprint_policy_https.v1. Terms: supportedInterface, freeEvaluation, pilotIfPassed." });
  }
  const teamId = String(req.params.teamId || "").trim();
  try {
    const outcome = await recordSupplyAgreement({ teamId, terms: parsed.data.terms, recordedBy });
    if (outcome.status === "unavailable") return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Registry unavailable" });
    if (outcome.status === "not_found") return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "No registry row has that id." });
    if (outcome.status === "invalid") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: "supply_agreement_invalid", errors: outcome.errors,
        error: "Nothing was recorded. Fix the agreements listed and send them again." });
    }
    return res.json({ ok: true, ...supplyResponse(outcome.record), engagedNow: Boolean(outcome.engagedNow) });
  } catch (error) {
    logger.error({ err: error, teamId }, "Failed to record a supply agreement");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "The agreement was not recorded." });
  }
});

/** The team withdrew. It stops counting as supply at once. */
router.post("/:teamId/supply-agreement/withdraw", async (req: Request, res: Response) => {
  const recordedBy = namedOperator(res);
  if (!recordedBy) return res.status(401).json({ ok: false, error: "A named operator must record the withdrawal." });
  const parsed = supplyWithdrawalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: "supply_withdrawal_invalid",
      error: "Send { withdrawnOn: YYYY-MM-DD, evidenceRef, evidenceHeld: true }." });
  }
  const teamId = String(req.params.teamId || "").trim();
  try {
    const outcome = await withdrawTeamSupplyAgreement({ teamId, ...parsed.data, recordedBy });
    if (outcome.status === "unavailable") return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Registry unavailable" });
    if (outcome.status === "not_found") return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "No registry row has that id." });
    if (outcome.status === "invalid") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: "supply_withdrawal_invalid", errors: outcome.errors,
        error: outcome.errors[0]?.problem ?? "The withdrawal was not recorded." });
    }
    return res.json({ ok: true, ...supplyResponse(outcome.record), wasEngaged: Boolean(outcome.wasEngaged) });
  } catch (error) {
    logger.error({ err: error, teamId }, "Failed to record a supply withdrawal");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "The withdrawal was not recorded." });
  }
});


/* ------------------------------------------------- the agent's account */

/**
 * The operator's view of a team's account, and the levers for a team that asks
 * us to do it for them.
 *
 * ## None of this is on the critical path any more
 *
 * It used to be all of it. A team could not get a key, funds or a policy
 * without one of these routes, so the agent surface was autonomous downstream
 * of four manual steps. A team can now register itself, fund itself and set its
 * own policy; these remain for support, for teams invoiced off-platform, and
 * for correcting our own mistakes.
 *
 * ## What actually bounds an agent
 *
 * Not these routes — an earlier version of this comment claimed an agent
 * "cannot raise its own limit or top up its own balance", and both halves were
 * wrong. `PUT /api/agent-team/policy` has always let a team's key change its
 * own limits, and funding is now self-serve too.
 *
 * The real ceiling is the balance, and it is a hard one: the only entry that
 * increases it is a `credit`, and a credit comes from a real payment landing or
 * an operator here. An agent cannot credit itself by asking. The policy is
 * pacing on top of that — self-imposed, changeable by the team at any moment,
 * and useful precisely because it is not the thing stopping a runaway.
 */

async function requireOps(res: Response) {
  return hasAnyRole(res, ["admin", "ops"]);
}

/** Balance, policy and today's spend for one team. */
router.get("/:teamId/account", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const teamId = String(req.params.teamId || "").trim();
  const [balance, policy, spentToday, keys] = await Promise.all([
    getTeamBalance(teamId),
    getSpendPolicy(teamId),
    getSpendToday(teamId),
    listAgentKeys(teamId),
  ]);

  return res.json({
    teamId,
    balance,
    policy,
    spentTodayUsd: spentToday,
    // Hashes only. We do not hold the keys, so there is nothing else to show.
    keys: keys.map((key) => ({
      keyHash: key.keyHash,
      label: key.label,
      createdAtIso: key.createdAtIso,
      lastUsedAtIso: key.lastUsedAtIso,
      revokedAtIso: key.revokedAtIso,
    })),
  });
});

const creditSchema = z
  .object({
    amountUsd: z.number().finite().positive().max(1_000_000),
    reason: z.string().trim().min(1).max(400),
    /**
     * The payment, invoice or agreement this credit corresponds to. Doubles as
     * the idempotency key, so replaying the same funding event cannot credit
     * twice.
     */
    externalReference: z.string().trim().min(3).max(200),
  })
  .strict();

router.post("/:teamId/credit", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Credit is invalid",
      code: "credit_invalid",
      why: "An externalReference is required so the same funding event cannot be credited twice.",
    });
  }

  const teamId = String(req.params.teamId || "").trim();
  const balance = await creditTeam({
    teamId,
    amountUsd: parsed.data.amountUsd,
    reason: parsed.data.reason,
    idempotencyKey: `credit:${parsed.data.externalReference}`,
  });

  return res.status(201).json({ ok: true, teamId, balance });
});

const policySchema = z
  .object({
    dailyLimitUsd: z.number().finite().min(0).max(100_000),
    perRunLimitUsd: z.number().finite().min(0).max(100_000),
    agentSpendEnabled: z.boolean(),
  })
  .strict();

router.put("/:teamId/policy", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Policy is invalid", code: "policy_invalid" });
  }

  const teamId = String(req.params.teamId || "").trim();
  return res.json({ ok: true, policy: await setSpendPolicy({ teamId, ...parsed.data }) });
});

const keySchema = z.object({ label: z.string().trim().min(1).max(120) }).strict();

/**
 * Issue an agent key. The plaintext is in this response and nowhere else.
 *
 * We store a SHA-256 and cannot show it again, which is the same reason a
 * password hash exists and matters more here because this credential moves
 * money. A team that loses it issues another.
 */
router.post("/:teamId/agent-keys", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A label is required", code: "key_label_required" });
  }

  const teamId = String(req.params.teamId || "").trim();
  const issued = await issueAgentKey({ teamId, label: parsed.data.label });
  if (!issued) {
    return res.status(503).json({ error: "Key store is unavailable", code: "key_store_unavailable" });
  }

  return res.status(201).json({
    ok: true,
    teamId,
    key: issued.key,
    keyHash: issued.record.keyHash,
    warning:
      "This is the only time this key is shown. Blueprint stores a hash and cannot recover it.",
    usage: "Authorization: Bearer <key> against /api/agent-team/*",
  });
});

router.post("/:teamId/agent-keys/:keyHash/revoke", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const revoked = await revokeAgentKey(String(req.params.keyHash || "").trim());
  return revoked
    ? res.json({ ok: true, revoked: true })
    : res.status(404).json({ error: "not_found" });
});

export default router;

