import { Router } from "express";
import { buildRobotAgentOpenApiContract } from "../utils/robot-agent-contract";
import { getPublicSiteWorldById } from "../utils/site-worlds";
import {
  buildAgentCommerceQuote,
  createAgentDryRunCheckout,
  findProvisionedHostedSessionEntitlement,
  getAgentDryRunEntitlement,
  getAgentDryRunOrder,
  normalizeAgentCommerceProduct,
} from "../utils/robot-agent-commerce";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(buildRobotAgentOpenApiContract());
});

router.get("/", (_req, res) => {
  res.status(200).json({
    name: "Blueprint Robot-Team Agent Access",
    docs: "/agents",
    openapi: "/api/agent-access/openapi.json",
    staticOpenapi: "/agent-access.openapi.json",
    llms: "/llms.txt",
    llmsFull: "/llms-full.txt",
    publicDemoSiteWorldId: "siteworld-f5fd54898cfb",
    env: {
      apiBaseUrl: "BLUEPRINT_API_BASE_URL",
      bearerToken: "BLUEPRINT_AGENT_AUTH_TOKEN",
    },
    truth:
      "Public demo endpoints are sample/demo only. Protected site worlds require Firebase robot-team/admin bearer auth and current launch readiness.",
  });
});

router.get("/commerce/quote", async (req, res) => {
  try {
    const siteWorldId = String(req.query.siteWorldId || "").trim();
    if (!siteWorldId) {
      return res.status(400).json({ error: "siteWorldId is required" });
    }
    const siteWorld = await getPublicSiteWorldById(siteWorldId);
    const quote = buildAgentCommerceQuote(
      {
        siteWorldId,
        product: String(req.query.product || ""),
        sessionHours: String(req.query.sessionHours || ""),
      },
      siteWorld,
    );
    return res.status(200).json({
      quote,
      siteWorld: siteWorld
        ? {
            id: siteWorld.id,
            siteName: siteWorld.siteName,
            commercialStatus: siteWorld.dataSource === "pipeline" ? "pipeline_backed" : "sample_or_planned",
            agentCommerce: {
              product: quote.product,
              sku: quote.sku,
              entitlementType: quote.entitlementType,
            },
          }
        : null,
      truth:
        "Dry-run quotes do not create live Stripe sessions, charge cards, grant live package access, or prove rights clearance.",
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to build dry-run quote" });
  }
});

router.post("/commerce/dry-run-checkout", async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const siteWorldId = String(body.siteWorldId || "").trim();
    if (!siteWorldId) {
      return res.status(400).json({ error: "siteWorldId is required" });
    }
    if (String(body.mode || "dry_run").trim() !== "dry_run") {
      return res.status(400).json({ error: "Only mode=dry_run is supported" });
    }
    const siteWorld = await getPublicSiteWorldById(siteWorldId);
    const payload = createAgentDryRunCheckout(
      {
        siteWorldId,
        mode: "dry_run",
        product: String(body.product || ""),
        sessionHours: typeof body.sessionHours === "number" ? body.sessionHours : String(body.sessionHours || ""),
        buyer:
          body.buyer && typeof body.buyer === "object"
            ? (body.buyer as { uid?: string; email?: string })
            : null,
      },
      siteWorld,
    );
    return res.status(201).json({
      ...payload,
      truth:
        "This is a dry-run order. It reuses buyer-order and marketplace-entitlement response shapes but does not call live Stripe or provision live package access.",
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create dry-run checkout" });
  }
});

router.get("/commerce/orders/:orderId", (req, res) => {
  const payload = getAgentDryRunOrder(String(req.params.orderId || ""));
  if (!payload) {
    return res.status(404).json({ error: "Dry-run order not found" });
  }
  return res.status(200).json({
    ...payload,
    receipt: {
      mode: "dry_run",
      liveStripeTouched: false,
      orderId: payload.order.id,
      entitlementId: payload.entitlement?.id || null,
    },
  });
});

router.get("/commerce/entitlements/:entitlementId", (req, res) => {
  const entitlement = getAgentDryRunEntitlement(String(req.params.entitlementId || ""));
  if (!entitlement) {
    return res.status(404).json({ error: "Dry-run entitlement not found" });
  }
  return res.status(200).json({ entitlement });
});

router.get("/commerce/entitlement-readiness", async (req, res) => {
  const siteWorldId = String(req.query.siteWorldId || "").trim();
  const entitlementId = String(req.query.entitlementId || "").trim();
  const buyerUserId = String(req.query.buyerUserId || "agent-dry-run-buyer").trim();
  if (!siteWorldId || !entitlementId) {
    return res.status(400).json({ error: "siteWorldId and entitlementId are required" });
  }
  const entitlement = await findProvisionedHostedSessionEntitlement({
    buyerUserId,
    siteWorldIds: [siteWorldId],
    entitlementId,
  });
  const entitled = Boolean(entitlement);
  return res.status(200).json({
    mode: "dry_run",
    siteWorldId,
    product: normalizeAgentCommerceProduct(String(req.query.product || "")),
    entitlement,
    entitled,
    launchable: entitled,
    blockers: entitled
      ? []
      : ["A provisioned hosted-session entitlement is required for protected site-world launch."],
    truth:
      "This readiness endpoint proves entitlement linkage only. Live hosted-session runtime, provider execution, rights clearance, and deployment proof remain owned by their normal systems.",
  });
});

export default router;
