import { Router, type Request, type Response } from "express";

import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { answerAgentQuestion } from "../retrieval/agentAsk";
import { fetchBuyerOrder } from "../utils/accounting";
import {
  buildRobotAgentAccessManifest,
  buildRobotAgentOpenApiContract,
} from "../utils/robot-agent-contract";
import {
  buildAgentLiveOrderStatusProjection,
  findProvisionedHostedSessionEntitlement,
  getAgentDryRunEntitlement,
  getAgentDryRunOrder,
  isAgentCommerceSku,
  normalizeAgentCommerceProduct,
} from "../utils/robot-agent-commerce";

const router = Router();

function retiredStandaloneCommerce(_req: Request, res: Response) {
  return res.status(410).json({
    error: "Standalone site-package and hosted-session purchasing is retired.",
    code: "standalone_commerce_retired",
    current_product: "Task Evaluation Run",
    request_url: "/contact/robot-team?interest=task-evaluation-run",
    truth:
      "Historical orders and entitlements remain readable. New work is scoped and quoted as one Task Evaluation Run; no Stripe session, order, charge, or entitlement was created.",
  });
}

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(buildRobotAgentOpenApiContract());
});

router.get("/", (_req, res) => {
  res.status(200).json(buildRobotAgentAccessManifest());
});

// Retired writes remain explicit so old clients receive a deterministic
// migration response rather than silently changing paid or customer intent.
router.all("/commerce/quote", retiredStandaloneCommerce);
router.all("/commerce/dry-run-checkout", retiredStandaloneCommerce);
router.all("/commerce/live-checkout", retiredStandaloneCommerce);

// Historical test records remain readable for compatibility and reconciliation.
router.get("/commerce/orders/:orderId", (req, res) => {
  const payload = getAgentDryRunOrder(String(req.params.orderId || ""));
  if (!payload) {
    return res.status(404).json({ error: "Historical dry-run order not found" });
  }
  return res.status(200).json({
    ...payload,
    receipt: {
      mode: "historical_dry_run",
      liveStripeTouched: false,
      orderId: payload.order.id,
      entitlementId: payload.entitlement?.id || null,
    },
  });
});

router.get("/commerce/entitlements/:entitlementId", (req, res) => {
  const entitlement = getAgentDryRunEntitlement(String(req.params.entitlementId || ""));
  if (!entitlement) {
    return res.status(404).json({ error: "Historical dry-run entitlement not found" });
  }
  return res.status(200).json({ entitlement });
});

router.get("/commerce/live-orders/:orderId", async (req, res) => {
  const orderId = String(req.params.orderId || "").trim();
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }
  const order = await fetchBuyerOrder(orderId);
  if (!order || !isAgentCommerceSku(order.item?.sku)) {
    return res.status(404).json({ error: "Historical agent order not found" });
  }
  return res.status(200).json(buildAgentLiveOrderStatusProjection(order));
});

async function ask(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const question = String(req.query.q || req.query.question || body.q || body.question || "").trim();
    const limit = Number(req.query.limit || body.limit || 3);
    return res.status(200).json(await answerAgentQuestion({ question, limit }));
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to answer question",
    });
  }
}

router.get("/ask", ask);
router.post("/ask", ask);

// Historical entitlement readiness remains authenticated and caller-scoped.
// The buyer id always comes from the verified token; query-supplied identity is
// ignored to preserve the original IDOR fix.
router.get("/commerce/entitlement-readiness", verifyFirebaseToken, async (req, res) => {
  const siteWorldId = String(req.query.siteWorldId || "").trim();
  const entitlementId = String(req.query.entitlementId || "").trim();
  const tokenUser = res.locals.firebaseUser as
    | { uid?: string; email?: string; email_verified?: boolean }
    | undefined;
  const buyerUserId = String(tokenUser?.uid || "").trim();
  if (!siteWorldId || !entitlementId) {
    return res.status(400).json({ error: "siteWorldId and entitlementId are required" });
  }
  if (!buyerUserId) {
    return res.status(401).json({ error: "Authenticated buyer is required." });
  }
  const entitlement = await findProvisionedHostedSessionEntitlement({
    buyerUserId,
    buyerEmail: tokenUser?.email_verified === false ? null : tokenUser?.email || null,
    siteWorldIds: [siteWorldId],
    entitlementId,
  });
  const entitled = Boolean(entitlement);
  return res.status(200).json({
    mode: "historical_authenticated_buyer_scoped",
    siteWorldId,
    product: normalizeAgentCommerceProduct(String(req.query.product || "")),
    entitlement,
    entitled,
    launchable: entitled,
    blockers: entitled
      ? []
      : ["A provisioned historical entitlement is required for this compatibility path."],
    truth:
      "This endpoint proves historical entitlement linkage only. Runtime, provider execution, rights clearance, deployment, and physical success remain separate claims.",
  });
});

export default router;
