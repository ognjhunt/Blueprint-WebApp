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
  listMatchableRobotTeams,
  listPendingProposals,
} from "../utils/robotTeamRegistry";
import { hasAnyRole } from "../utils/access-control";
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

  const reviewedBy =
    (res.locals?.user?.uid as string | undefined) ||
    (res.locals?.user?.email as string | undefined) ||
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

/** The registry itself, for an operator checking what a match ran against. */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const teams = await listMatchableRobotTeams({
      statuses: ["applied", "engaged", "prospect", "declined"],
    });
    return res.json({ ok: true, teams });
  } catch (error) {
    logger.error({ err: error }, "Failed to list robot teams");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to list robot teams" });
  }
});


/* ------------------------------------------------- the agent's account */

/**
 * Four things a person must do before a team's agent can run: issue it a key,
 * fund it, set what it may spend, and see what it did.
 *
 * None of these belong on the agent surface itself. An agent must not be able
 * to raise its own limit or top up its own balance, which is the whole reason
 * the spend policy lives outside the key it authenticates with.
 *
 * Funding is an operator action rather than a self-serve checkout. `creditTeam`
 * is idempotent and takes an external reference, so the ledger is ready for
 * Stripe — but the top-up SKU and its price points are a product decision
 * nobody has made, and shipping a payment flow on an invented price would be
 * worse than an operator crediting a beta team.
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

