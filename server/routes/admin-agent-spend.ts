import { Request, Response, Router } from "express";
import { logger } from "../logger";
import { hasAnyRole, resolveAccessContext } from "../utils/access-control";
import { listAgentSpendRequests, reconcileAgentSpendProviderEvent, requestAgentSpend } from "../utils/agentSpendLedger";
import { isCityLaunchBudgetCategory } from "../utils/agentSpendPolicy";
import { normalizeCityLaunchBudgetTier } from "../utils/cityLaunchPolicy";

/**
 * Agent spend requests: request, list and reconcile. These are the only
 * handlers kept from the retired growth studio router, at their original URLs
 * under /api/admin/growth, because they control money: a request is checked
 * against the written budget policy, and reconcile records what a provider
 * actually charged against an approved request.
 */
const router = Router();

async function requireOps(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    return res.status(403).json({ error: "Ops access required" });
  }

  next();
}

async function operatorEmail(res: Response) {
  const access = await resolveAccessContext(res);
  return access.email || "ops@tryblueprint.io";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStringArray(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];

  return rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeIsoOrNull(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

router.post("/city-launch/spend-requests", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const amountUsd = normalizeNumber(req.body?.amountUsd);
    const category = normalizeString(req.body?.category);
    const vendorName = normalizeString(req.body?.vendorName);
    const purpose = normalizeString(req.body?.purpose);
    if (!city || amountUsd === null || !category || !vendorName || !purpose) {
      return res.status(400).json({
        error: "city, amountUsd, category, vendorName, and purpose are required",
      });
    }
    if (!isCityLaunchBudgetCategory(category)) {
      return res.status(400).json({ error: "Unsupported spend category" });
    }
    const spendRequest = await requestAgentSpend({
      id: normalizeString(req.body?.id) || undefined,
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      issueId: normalizeString(req.body?.issueId) || null,
      runId: normalizeString(req.body?.runId) || null,
      requestedByAgent: normalizeString(req.body?.requestedByAgent) || null,
      requestedByRole: normalizeString(req.body?.requestedByRole) || (await operatorEmail(res)),
      amountUsd,
      currency: normalizeString(req.body?.currency) || "USD",
      category,
      vendorName,
      vendorUrl: normalizeString(req.body?.vendorUrl) || null,
      purpose,
      expectedOutcome: normalizeString(req.body?.expectedOutcome) || null,
      evidenceRefs: normalizeStringArray(req.body?.evidenceRefs),
      provider: normalizeString(req.body?.provider) || "manual",
      budgetTier: normalizeCityLaunchBudgetTier(req.body?.budgetTier),
      maxTotalApprovedUsd: normalizeNumber(req.body?.maxTotalApprovedUsd),
      operatorAutoApproveUsd: normalizeNumber(req.body?.operatorAutoApproveUsd),
      founderApprovedBudgetEnvelope:
        typeof req.body?.founderApprovedBudgetEnvelope === "boolean"
          ? req.body.founderApprovedBudgetEnvelope
          : null,
      allowedVendorNames: normalizeStringArray(req.body?.allowedVendorNames),
      expiresAtIso: normalizeIsoOrNull(req.body?.expiresAtIso),
      metadata: null,
    });
    return res.status(201).json({ ok: true, spendRequest });
  } catch (error) {
    logger.error({ err: error }, "Failed to request agent spend");
    return res.status(500).json({ error: "Failed to request agent spend" });
  }
});

router.get("/city-launch/spend-requests", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.query.city) || "Austin, TX";
    return res.json({
      ok: true,
      spendRequests: await listAgentSpendRequests(city),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list agent spend requests");
    return res.status(500).json({ error: "Failed to list agent spend requests" });
  }
});

router.post("/city-launch/spend-requests/:spendRequestId/reconcile", requireOps, async (req, res) => {
  try {
    const spendRequestId = normalizeString(req.params.spendRequestId);
    const status = normalizeString(req.body?.status);
    if (!spendRequestId || !status) {
      return res.status(400).json({ error: "spendRequestId and status are required" });
    }
    const spendRequest = await reconcileAgentSpendProviderEvent({
      spendRequestId,
      provider: normalizeString(req.body?.provider) || null,
      providerEventId: normalizeString(req.body?.providerEventId) || null,
      status,
      paidAmountUsd: normalizeNumber(req.body?.paidAmountUsd),
      note: normalizeString(req.body?.note) || null,
      occurredAtIso: normalizeIsoOrNull(req.body?.occurredAtIso),
      rawCredentialDelivered:
        typeof req.body?.rawCredentialDelivered === "boolean"
          ? req.body.rawCredentialDelivered
          : null,
    });
    return res.json({ ok: true, spendRequest });
  } catch (error) {
    logger.error({ err: error }, "Failed to reconcile agent spend provider event");
    return res.status(500).json({ error: "Failed to reconcile agent spend provider event" });
  }
});

export default router;
