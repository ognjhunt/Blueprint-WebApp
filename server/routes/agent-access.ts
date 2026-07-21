import { Router, type NextFunction, type Request, type Response } from "express";
import Stripe from "stripe";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { buildRobotAgentAccessManifest, buildRobotAgentOpenApiContract } from "../utils/robot-agent-contract";
import { getPublicSiteWorldById } from "../utils/site-worlds";
import {
  buildAgentCommerceQuote,
  buildAgentLiveOrderStatusProjection,
  createAgentDryRunCheckout,
  evaluateAgentLiveCheckoutEligibility,
  findProvisionedHostedSessionEntitlement,
  getAgentDryRunEntitlement,
  getAgentDryRunOrder,
  isAgentCommerceSku,
  normalizeAgentCommerceProduct,
  sanitizeLiveCheckoutRedirect,
  type AgentLiveCheckoutInput,
} from "../utils/robot-agent-commerce";
import { answerAgentQuestion } from "../retrieval/agentAsk";
import {
  attachStripeCheckoutSessionToBuyerOrder,
  createBuyerOrderDraft,
  fetchBuyerOrder,
  markBuyerOrderCheckoutFailure,
} from "../utils/accounting";
import { stripeAvailable, stripeClient } from "../constants/stripe";
import { logger } from "../logger";
import {
  betaDecisionForResponse,
  evaluateBetaCohortGate,
  recordBetaCohortAdmission,
} from "../utils/beta-cohort-policy";

const router = Router();

const liveCheckoutBaseOrigin =
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  process.env.VITE_PUBLIC_APP_URL?.trim() ||
  process.env.VITE_PUBLIC_URL?.trim() ||
  process.env.BASE_URL?.trim() ||
  "https://tryblueprint.io";

function resolveLiveCheckoutUrl(pathValue: unknown, fallbackPath: string) {
  return sanitizeLiveCheckoutRedirect(pathValue, fallbackPath, liveCheckoutBaseOrigin);
}

// Live checkout works with or without a Firebase bearer token: an authenticated
// buyer gets the entitlement bound to their uid, while an anonymous agent binds
// by the email Stripe collects at payment. A present-but-invalid token still
// fails closed through verifyFirebaseToken.
function optionalVerifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization) {
    return next();
  }
  return verifyFirebaseToken(req, res, next);
}

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(buildRobotAgentOpenApiContract());
});

router.get("/", (_req, res) => {
  res.status(200).json(buildRobotAgentAccessManifest());
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
            commercialStatus: "pipeline_backed",
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

router.post("/commerce/live-checkout", optionalVerifyFirebaseToken, async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const siteWorldId = String(body.siteWorldId || "").trim();
    if (!siteWorldId) {
      return res.status(400).json({ error: "siteWorldId is required" });
    }
    const input: AgentLiveCheckoutInput = {
      siteWorldId,
      mode: String(body.mode || "live"),
      product: String(body.product || ""),
      sessionHours: typeof body.sessionHours === "number" ? body.sessionHours : String(body.sessionHours || ""),
      budgetCents: typeof body.budgetCents === "number" ? body.budgetCents : String(body.budgetCents ?? ""),
      successPath: typeof body.successPath === "string" ? body.successPath : null,
      cancelPath: typeof body.cancelPath === "string" ? body.cancelPath : null,
      buyer: body.buyer && typeof body.buyer === "object" ? (body.buyer as { uid?: string; email?: string }) : null,
    };
    const siteWorld = await getPublicSiteWorldById(siteWorldId);
    const preAuthFirebaseUser = (res.locals.firebaseUser || {}) as { uid?: string };
    const eligibility = evaluateAgentLiveCheckoutEligibility(input, siteWorld, {
      stripeConfigured: stripeAvailable && Boolean(stripeClient),
      authenticatedBuyerUid: typeof preAuthFirebaseUser.uid === "string" ? preAuthFirebaseUser.uid : null,
    });
    if (!eligibility.eligible || !stripeClient) {
      return res.status(409).json({
        error: "Live checkout is blocked for this request.",
        code: "live_checkout_blocked",
        mode: "live",
        quote: eligibility.quote,
        budgetCents: eligibility.budgetCents,
        withinBudget: eligibility.withinBudget,
        blockers: eligibility.blockers,
        truth:
          "Blocked live checkout creates no Stripe session, order, charge, or entitlement. Dry-run checkout and request intake remain available.",
      });
    }

    const quote = eligibility.quote;
    const firebaseUser = (res.locals.firebaseUser || {}) as { uid?: string; email?: string };
    const buyerUserId =
      (typeof firebaseUser.uid === "string" && firebaseUser.uid.trim()) ||
      String(input.buyer?.uid || "").trim() ||
      null;
    // Lowercased so the verified-email entitlement lookup can exact-match it.
    const buyerEmailRaw =
      (typeof firebaseUser.email === "string" && firebaseUser.email.trim()) ||
      String(input.buyer?.email || "").trim() ||
      null;
    const buyerEmail = buyerEmailRaw ? buyerEmailRaw.toLowerCase() : null;

    const successUrl = resolveLiveCheckoutUrl(input.successPath, "/app/entitlements?live_checkout=success");
    const cancelUrl = resolveLiveCheckoutUrl(input.cancelPath, "/app/entitlements?live_checkout=cancel");
    const deliveryMode = quote.product === "hosted_session_rental" ? "hosted_session" : "download_link";

    // Beta cohort policy gates live buyer checkout the same way it gates
    // capture intake: a denial creates no order draft, Stripe session, or
    // entitlement.
    const betaCohortDecision = await evaluateBetaCohortGate({
      gate: "buyer_checkout",
      creatorId: buyerUserId,
      email: buyerEmail,
      source: "agent_live_checkout",
    });
    if (!betaCohortDecision.allowed) {
      return res.status(betaCohortDecision.statusCode).json({
        error: betaCohortDecision.message,
        code: betaCohortDecision.reason,
        mode: "live",
        beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
        truth:
          "Beta-cohort-blocked live checkout creates no Stripe session, order, charge, or entitlement.",
      });
    }

    const order = await createBuyerOrderDraft({
      buyerUserId,
      buyerEmail,
      sku: quote.sku,
      title: quote.title,
      description: quote.description,
      itemType: quote.product,
      quantity: quote.quantity,
      licenseTier: "commercial",
      exclusivity: "non-exclusive",
      addons: [],
      inventorySource: "agent_live_checkout",
      liveInventoryRecordId: null,
      deliveryMode,
      inventoryFulfillmentStatus: "auto_ready",
      rightsStatus: null,
      unitAmountCents: quote.unitAmountCents,
      totalAmountCents: quote.totalAmountCents,
      currency: "usd",
      successUrl,
      cancelUrl,
    });
    if (!order) {
      return res.status(503).json({ error: "Order ledger is not available for live checkout." });
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripeClient.checkout.sessions.create({
        client_reference_id: order.id,
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: buyerEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: quote.title,
                description: quote.description || undefined,
                metadata: {
                  orderId: order.id,
                  sku: quote.sku,
                  itemType: quote.product,
                  siteWorldId: quote.siteWorldId,
                },
              },
              unit_amount: quote.unitAmountCents,
            },
            quantity: quote.quantity,
          },
        ],
        metadata: {
          order_id: order.id,
          marketplaceSku: quote.sku,
          marketplaceItemType: quote.product,
          marketplaceTitle: quote.title,
          agentCommerceMode: "live",
          siteWorldId: quote.siteWorldId,
        },
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            marketplace_sku: quote.sku,
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
    } catch (error) {
      await markBuyerOrderCheckoutFailure({
        orderId: order.id,
        reason: error instanceof Error ? error.message : "Stripe failed to create the live agent checkout session.",
      });
      throw error;
    }

    await attachStripeCheckoutSessionToBuyerOrder({
      orderId: order.id,
      checkoutSessionId: session.id,
      checkoutSessionUrl: typeof session.url === "string" ? session.url : null,
      livemode: session.livemode,
    });

    await recordBetaCohortAdmission({
      gate: "buyer_checkout",
      admissionId: `checkout:${order.id}`,
      decision: betaCohortDecision,
      creatorId: buyerUserId,
      email: buyerEmail,
      source: "agent_live_checkout",
    });

    logger.info(
      {
        event: "agent_live_checkout_created",
        orderId: order.id,
        sku: quote.sku,
        siteWorldId: quote.siteWorldId,
        totalAmountCents: quote.totalAmountCents,
        authenticatedBuyer: Boolean(firebaseUser.uid),
      },
      "Agent live checkout session created",
    );

    return res.status(201).json({
      mode: "live",
      quote,
      budgetCents: eligibility.budgetCents,
      withinBudget: eligibility.withinBudget,
      order: {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        sku: quote.sku,
        pricing: order.pricing,
      },
      checkout: {
        provider: "stripe",
        sessionId: session.id,
        url: typeof session.url === "string" ? session.url : null,
        livemode: session.livemode,
      },
      statusUrl: `/api/agent-access/commerce/live-orders/${order.id}`,
      nextSteps: [
        "Complete payment at checkout.url with the buying team's payment method.",
        `Poll GET /api/agent-access/commerce/live-orders/${order.id} until payment_status=paid and fulfillment_status=provisioned.`,
        "Use the provisioned entitlement with the buyer's Firebase bearer token for entitlement-readiness and protected hosted-session launch.",
      ],
      truth:
        "This creates a real Stripe Checkout Session and buyer-order ledger entry. Payment, webhook fulfillment, and entitlement provisioning complete only after the payer finishes Stripe checkout; rights, provider execution, and hosted runtime proof remain owned by their normal systems.",
    });
  } catch (error) {
    logger.error(
      { event: "agent_live_checkout_failed", err: error },
      "Agent live checkout failed",
    );
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create live checkout" });
  }
});

router.get("/commerce/live-orders/:orderId", async (req, res) => {
  const orderId = String(req.params.orderId || "").trim();
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }
  const order = await fetchBuyerOrder(orderId);
  if (!order || !isAgentCommerceSku(order.item?.sku)) {
    return res.status(404).json({ error: "Live agent order not found" });
  }
  return res.status(200).json(buildAgentLiveOrderStatusProjection(order));
});

router.get("/ask", async (req, res) => {
  try {
    const question = String(req.query.q || req.query.question || "").trim();
    const limit = Number(req.query.limit || 3);
    const payload = await answerAgentQuestion({ question, limit });
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to answer question" });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const question = String(body.q || body.question || "").trim();
    const limit = Number(body.limit || 3);
    const payload = await answerAgentQuestion({ question, limit });
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to answer question" });
  }
});

// WEB-04: this route reads real `marketplaceEntitlements`, so it must be
// authenticated and scoped to the caller. Previously it took `buyerUserId` from an
// attacker-controlled query param with no auth — an IDOR that leaked any buyer's
// entitlement (buyer_email, order_id, sku, title) by supplying their UID. The buyer
// is now derived from the verified Firebase token; the query `buyerUserId` is ignored.
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
    // Verified token email only — lets an anonymous live purchase (buyer bound
    // by email) unlock readiness once the buyer signs in with that email.
    buyerEmail: tokenUser?.email_verified === false ? null : tokenUser?.email || null,
    siteWorldIds: [siteWorldId],
    entitlementId,
  });
  const entitled = Boolean(entitlement);
  return res.status(200).json({
    mode: "authenticated_buyer_scoped",
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
