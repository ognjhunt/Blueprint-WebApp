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
import { randomUUID } from "node:crypto";

import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import { z } from "zod";

import {
  applyProposal,
  getRobotTeam,
  listMatchableRobotTeams,
  listPendingProposals,
} from "../utils/robotTeamRegistry";
import { hasAnyRole } from "../utils/access-control";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxEntry } from "../utils/captureOutbox";
import { buildPilotRecommendationNotification } from "../utils/pilotRecommendationNotifications";
import { decryptFieldValue } from "../utils/field-encryption";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
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

const recommendationSchema = z.object({
  teamId: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(8).max(400),
  siteProvides: z.string().trim().min(4).max(400),
  teamProvides: z.string().trim().min(4).max(400),
  pilotCost: z.string().trim().min(2).max(120),
  window: z.string().trim().min(2).max(120),
  uncertainties: z.string().trim().max(400).default(""),
  alternative: z.string().trim().max(400).default(""),
}).strict();

/**
 * A team we can name to a site: one we have talked to. A prospect has not
 * told us it wants the pilot, a self-registered team has not been measured,
 * and a declined team said no.
 */
const RECOMMENDABLE_STATUSES = new Set(["applied", "engaged"]);

/**
 * Blueprint's one recommended pilot for a site job. Blueprint does the
 * technical selection; the site's only decision is whether to book it.
 * The team is resolved from the registry, never typed, so the name a site
 * sees is a team we have a record for. Replacing a recommendation gives it a
 * new id, so a booking can never bind text the site did not see, and a
 * booked pilot is not replaced. The check and write share one transaction
 * with the site's booking.
 */
router.post("/recommendations/:requestId", async (req: Request, res: Response) => {
  const parsed = recommendationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Fill in the team ID, purpose, what each side provides, cost and window." });
  }
  if (!db) return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Store unavailable" });
  const store = db;
  const requestId = String(req.params.requestId);
  const { teamId, ...plan } = parsed.data;
  try {
    const team = await getRobotTeam(teamId);
    if (!team || !RECOMMENDABLE_STATUSES.has(team.status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Recommend a registered team that has applied or is engaged." });
    }
    // Stable across Firestore callback retries. A lost HTTP response can also
    // retry an unchanged plan without replacing the recommendation it saved.
    const proposed = {
      id: `rec_${randomUUID()}`, teamId: team.id, teamName: team.name, ...plan,
      recommendedAtIso: new Date().toISOString(),
      recommendedBy: (res.locals?.firebaseUser?.uid as string | undefined) ?? null,
    };
    const captureUrl = captureUploadUrlFor(requestId, "owner");
    const rows = new Map<string, ReturnType<typeof buildOutboxEntry>>();
    const ref = store.collection("inboundRequests").doc(requestId);
    const outcome = await store.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (!current.exists) return { status: "missing" } as const;
      const record = current.data()!;
      if (record.pilot_booking) return { status: "booked" } as const;
      const previous = record.pilot_recommendation;
      const samePlan = typeof previous?.id === "string"
        && Object.entries({ teamId: team.id, teamName: team.name, ...plan })
          .every(([key, value]) => previous[key] === value);
      const recommendation = samePlan ? previous as typeof proposed : proposed;
      const to = String(await decryptFieldValue(record.contact?.email ?? "")).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { status: "contact_missing" } as const;
      const input = buildPilotRecommendationNotification({ requestId, recommendation, to, captureUrl });
      const intentRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(input.idempotencyKey);
      const intent = await transaction.get(intentRef);
      const legacyKey = `${requestId}:pilot_recommended:${recommendation.id}`;
      const legacyRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(legacyKey);
      const legacy = await transaction.get(legacyRef);
      const matches = (existing: OutboxEntry, key: string) =>
        existing.idempotencyKey === key && existing.requestId === requestId
        && existing.kind === "pilot_recommended" && existing.to === to;
      if (intent.exists && !matches(intent.data() as OutboxEntry, input.idempotencyKey)) {
        throw new Error("Recommendation notification identity conflict");
      }
      // The previous writer used only the recommendation ID. Its pending,
      // acknowledged or ambiguous delivery is the SAME authorized event;
      // adding a recipient-hashed copy would send that recommendation twice.
      const reuseLegacy = legacy.exists && matches(legacy.data() as OutboxEntry, legacyKey);
      const existing = (reuseLegacy ? legacy.data() : intent.data()) as OutboxEntry | undefined;
      const existingRef = reuseLegacy ? legacyRef : intentRef;
      // All authoritative reads precede writes. Failure to persist either row
      // aborts the recommendation; no post-commit enqueue can lose the notice.
      if (!samePlan) transaction.update(ref, { pilot_recommendation: recommendation });
      if (!existing) {
        if (!rows.has(input.idempotencyKey)) rows.set(input.idempotencyKey, buildOutboxEntry(input));
        transaction.create(intentRef, rows.get(input.idempotencyKey)!);
      } else if (existing.status === "cancelled" && existing.attempts === 0) {
        // A→B→A contact correction can restore an event cancelled before any
        // dispatch. Only this explicit, currently authorized admin retry may
        // rearm it; preserve all attempted/ambiguous/acknowledged histories.
        transaction.update(existingRef, { status: "pending", lastError: null });
      }
      return { status: "ok", id: recommendation.id } as const;
    });
    if (outcome.status === "missing") return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "Job not found" });
    if (outcome.status === "booked") return res.status(HTTP_STATUS.CONFLICT).json({ ok: false, error: "This pilot is already booked." });
    if (outcome.status === "contact_missing") return res.status(HTTP_STATUS.CONFLICT).json({ ok: false, error: "Add a valid site contact email before recommending this pilot." });
    return res.json({ ok: true, id: outcome.id });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to record a pilot recommendation");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Unable to record the recommendation" });
  }
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

