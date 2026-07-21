import type { Request, Response } from "express";
import Stripe from "stripe";
import { getPublicSiteWorldById } from "../../utils/site-worlds";
import {
  attachStripeCheckoutSessionToBuyerOrder,
  createBuyerOrderDraft,
  markBuyerOrderCheckoutFailure,
} from "../../utils/accounting";
import { stripeAvailable } from "../../constants/stripe";
import { logger } from "../../logger";
import {
  betaDecisionForResponse,
  evaluateBetaCohortGate,
} from "../../utils/beta-cohort-policy";

type PaymentSessionType =
  | "onboarding"
  | "robot-eval-run";

type CheckoutRequestBody = {
  sessionType?: PaymentSessionType;
  onboardingFee?: number;
  monthlyPrice?: number;
  includedHours?: number;
  extraHourlyRate?: number;
  planId?: string;
  planName?: string;
  kitUpgradeSurcharge?: number;
  organizationName?: string;
  contactName?: string;
  contactEmail?: string;
  mappingDateTime?: string;
  mappingOptIn?: boolean;
  qrKit?: {
    id?: string;
    name?: string;
    price?: number;
  };
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  successPath?: string;
  cancelPath?: string;
  totalCost?: number;
  hours?: number;
  costPerHour?: number;
  robotEvalRun?: {
    siteSlug?: string;
  };
};

export const ROBOT_EVAL_RUN_SKU_SUFFIX = "-robot-eval-run";
export const ROBOT_EVAL_RUN_PRICE_USD = 350;
export const ROBOT_EVAL_RUN_DESCRIPTION =
  "Capture-backed virtual policy evaluation with a queued Pipeline handoff and buyer-visible run status.";

export function robotEvalRunSkuForSiteSlug(siteSlug: string) {
  return `${siteSlug}${ROBOT_EVAL_RUN_SKU_SUFFIX}`;
}

function roundToCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

function getStripeClient() {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is required. Revenue metrics are currently blocked. Please provision a valid Stripe secret key to restore full functionality."
    );
  }

  return new Stripe(stripeSecretKey);
}

const configuredOrigins = (process.env.CHECKOUT_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const fallbackOrigin =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.VITE_PUBLIC_APP_URL ||
  process.env.VITE_PUBLIC_URL ||
  process.env.BASE_URL ||
  "http://localhost:5173";

const allowedOrigins = new Set<string>([
  fallbackOrigin,
  ...configuredOrigins,
]);
function resolveBaseOrigin(originHeader: string | undefined): string {
  if (originHeader && allowedOrigins.has(originHeader)) {
    return originHeader;
  }
  const [firstAllowed] = Array.from(allowedOrigins);
  return firstAllowed || "http://localhost:5173";
}

function resolveUrl(baseOrigin: string, path: string | undefined, fallbackPath: string) {
  if (path && /^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      if (allowedOrigins.has(parsed.origin)) {
        return parsed.toString();
      }
    } catch (_error) {
      // Ignore invalid URLs
    }
  }

  const safePath = path && path.startsWith("/") ? path : fallbackPath;
  return new URL(safePath, baseOrigin).toString();
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body || {}) as CheckoutRequestBody;

  try {
    // Check Stripe availability before proceeding
    if (!stripeAvailable) {
      return res.status(503).json({
        error: "Stripe revenue metrics are currently blocked due to missing configuration. Please provision a valid Stripe secret key to restore checkout functionality.",
        unblockPath: "Contact Blueprint CTO to provision STRIPE_SECRET_KEY in the Paperclip runtime",
        status: "blocked",
        affectedFeatures: ["revenue-metrics", "checkout", "payments"]
      });
    }

    const stripe = getStripeClient();

    const sessionType: PaymentSessionType = body.sessionType || "onboarding";

    const originHeader = req.headers.origin as string | undefined;
    const originBase = resolveBaseOrigin(originHeader);

    if (sessionType === "robot-eval-run") {
      const firebaseUser = (res.locals.firebaseUser || {}) as {
        uid?: string;
        email?: string;
      };
      const buyerUserId =
        typeof firebaseUser.uid === "string" ? firebaseUser.uid.trim() : "";
      const buyerEmail =
        typeof firebaseUser.email === "string" ? firebaseUser.email.trim() : "";
      if (!buyerUserId) {
        return res.status(401).json({
          error: "Sign in to purchase a policy evaluation run.",
        });
      }

      const siteSlug = String(body.robotEvalRun?.siteSlug || "").trim();
      if (!siteSlug) {
        return res.status(400).json({
          error: "A site slug is required for a policy evaluation run.",
        });
      }

      const site = await getPublicSiteWorldById(siteSlug);
      if (!site || site.dataSource !== "pipeline") {
        return res.status(404).json({ error: "Unknown site for policy evaluation run." });
      }
      if (
        site.evaluationReadiness?.robot_eval_dataset_summary
          ?.ready_to_evaluate_publishable !== true ||
        !site.siteSubmissionId ||
        !site.captureId
      ) {
        return res.status(409).json({
          error:
            "This site does not have a publication-ready evaluation package yet, so a run cannot be purchased.",
        });
      }

      // The intake route applies the robot_eval_request beta-cohort gate before
      // queueing anything; run the same gate here so a buyer is never charged
      // for a run the intake route would immediately reject.
      const betaCohortDecision = await evaluateBetaCohortGate({
        gate: "robot_eval_request",
        creatorId: buyerUserId,
        source: "robot_eval_run_checkout",
      });
      if (betaCohortDecision && !betaCohortDecision.allowed) {
        return res.status(betaCohortDecision.statusCode).json({
          error: betaCohortDecision.message,
          code: betaCohortDecision.reason,
          beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
        });
      }

      if (!Number.isFinite(ROBOT_EVAL_RUN_PRICE_USD) || ROBOT_EVAL_RUN_PRICE_USD <= 0) {
        return res.status(503).json({
          error: "Policy evaluation run pricing is not configured.",
        });
      }
      const priceUsd = roundToCurrency(ROBOT_EVAL_RUN_PRICE_USD);

      const sku = robotEvalRunSkuForSiteSlug(site.id);
      const successUrl = resolveUrl(
        originBase,
        body.successPath,
        `/sites/${site.id}?robotEvalCheckout=success`,
      );
      const cancelUrl = resolveUrl(
        originBase,
        body.cancelPath,
        `/sites/${site.id}?robotEvalCheckout=cancelled`,
      );

      const order = await createBuyerOrderDraft({
        buyerUserId,
        buyerEmail: buyerEmail || null,
        sku,
        title: `${site.siteName} — Policy Evaluation Run`,
        description: ROBOT_EVAL_RUN_DESCRIPTION,
        itemType: "robot_eval_run",
        quantity: 1,
        licenseTier: "commercial",
        exclusivity: "non-exclusive",
        addons: [],
        inventorySource: "pipeline-site-world",
        liveInventoryRecordId: site.siteSubmissionId,
        // hosted_runtime is a provisionable delivery mode with no hourly
        // expiry, so the paid webhook grants the marketplaceEntitlements doc
        // that /api/robot-eval/job-requests requires — no manual review step.
        deliveryMode: "hosted_runtime",
        inventoryFulfillmentStatus: "auto_ready",
        rightsStatus: null,
        unitAmountCents: Math.round(priceUsd * 100),
        totalAmountCents: Math.round(priceUsd * 100),
        currency: "usd",
        successUrl,
        cancelUrl,
      });
      if (!order) {
        return res.status(500).json({ error: "Order ledger is not available" });
      }

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
          client_reference_id: order.id,
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `${site.siteName} — Policy Evaluation Run`,
                  description:
                    "Virtual policy-evaluation run on this captured site package. Blueprint queues the request and forwards it to Pipeline for scheduling.",
                  metadata: {
                    orderId: order.id,
                    sku,
                    itemType: "robot_eval_run",
                    robotEvalSiteSlug: site.id,
                  },
                },
                unit_amount: Math.round(priceUsd * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            order_id: order.id,
            sessionKind: "robot_eval_run",
            marketplaceSku: sku,
            robotEvalSiteSlug: site.id,
            buyerUserId,
          },
          payment_intent_data: {
            metadata: {
              order_id: order.id,
              marketplace_sku: sku,
            },
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });
      } catch (error) {
        await markBuyerOrderCheckoutFailure({
          orderId: order.id,
          reason:
            error instanceof Error
              ? error.message
              : "Stripe failed to create the checkout session.",
        });
        throw error;
      }

      await attachStripeCheckoutSessionToBuyerOrder({
        orderId: order.id,
        checkoutSessionId: session.id,
        checkoutSessionUrl: typeof session.url === "string" ? session.url : null,
        livemode: session.livemode,
      });

      return res.json({ sessionId: session.id, sessionUrl: session.url });
    }

    if (sessionType === "onboarding") {
      const onboardingFee = typeof body.onboardingFee === "number" ? body.onboardingFee : 0;
      const planId =
        typeof body.planId === "string" && body.planId.trim().length > 0
          ? body.planId.trim()
          : "starter";
      const planName =
        typeof body.planName === "string" && body.planName.trim().length > 0
          ? body.planName.trim()
          : "Starter";
      const monthlyPrice =
        typeof body.monthlyPrice === "number" && Number.isFinite(body.monthlyPrice)
          ? body.monthlyPrice
          : 99;
      const kitUpgradeSurcharge =
        typeof body.kitUpgradeSurcharge === "number" && Number.isFinite(body.kitUpgradeSurcharge)
          ? Math.max(body.kitUpgradeSurcharge, 0)
          : 0;

      // Never charge client-authored amounts. Anything outside the server-owned
      // onboarding price allowlist is a forged or stale payload.
      const ONBOARDING_ALLOWED_MONTHLY_PRICES = new Set([49.99, 99, 149]);
      const ONBOARDING_ALLOWED_KIT_SURCHARGES = new Set([0, 15, 45, 99, 114, 144]);
      if (
        onboardingFee !== 0 ||
        !ONBOARDING_ALLOWED_MONTHLY_PRICES.has(monthlyPrice) ||
        !ONBOARDING_ALLOWED_KIT_SURCHARGES.has(kitUpgradeSurcharge)
      ) {
        logger.warn(
          {
            event: "stripe_checkout_onboarding_price_rejected",
            onboardingFee,
            monthlyPrice,
            kitUpgradeSurcharge,
          },
          "Rejected onboarding checkout with off-catalog pricing",
        );
        return res.status(400).json({
          error: "Invalid onboarding pricing. Please reload and try again.",
        });
      }
      const monthlyPriceWithKit = monthlyPrice + kitUpgradeSurcharge;

      let billingAnchorText = "24 hours after onboarding";
      let trialEndUnix: number | undefined;
      if (body.mappingDateTime) {
        const mappingDate = new Date(body.mappingDateTime);
        if (!Number.isNaN(mappingDate.getTime())) {
          const billingStart = new Date(mappingDate.getTime() + 24 * 60 * 60 * 1000);
          billingAnchorText = new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(billingStart);
          trialEndUnix = Math.floor(billingStart.getTime() / 1000);
        }
      }

      const qrKitPrice =
        typeof body.qrKit?.price === "number" && Number.isFinite(body.qrKit.price)
          ? body.qrKit.price
          : 0;
      const qrKitId =
        typeof body.qrKit?.id === "string" && body.qrKit.id.trim().length > 0
          ? body.qrKit.id.trim()
          : "";
      const qrKitName = body.qrKit?.name || "Blueprint QR Kit";

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      if (onboardingFee > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: "Blueprint Onboarding Experience",
              description: "One-time on-site activation & setup",
            },
            unit_amount: Math.round(onboardingFee * 100),
          },
          quantity: 1,
        });
      }

      if (kitUpgradeSurcharge > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: `${qrKitName} upgrade`,
              description: "One-time surcharge for QR kit upgrade",
            },
            unit_amount: Math.round(kitUpgradeSurcharge * 100),
          },
          quantity: 1,
        });
      }

      if (lineItems.length === 0) {
        // Stripe rejects payment-mode sessions with no line items, so surface a
        // clear client error instead of an opaque Stripe 500. This happens when
        // nothing is due today (no onboarding fee, no kit surcharge).
        return res.status(400).json({
          error:
            "Nothing is due today for this plan, so checkout isn't needed. Contact team@tryblueprint.io to finish setup.",
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: lineItems,
        metadata: {
          plan: planId,
          planId,
          planName,
          onboardingFee: onboardingFee.toString(),
          monthlyPrice: monthlyPrice.toString(),
          planMonthlyPrice: monthlyPrice.toString(),
          planMonthlyPriceWithKit: monthlyPriceWithKit.toString(),
          kitUpgradeSurcharge: kitUpgradeSurcharge.toString(),
          qrKitId,
          organizationName: body.organizationName || "",
          contactName: body.contactName || "",
          contactEmail: body.contactEmail || "",
          mappingDateTime: body.mappingDateTime || "",
          mappingOptIn:
            typeof body.mappingOptIn === "boolean"
              ? body.mappingOptIn.toString()
              : "",
          qrKitName,
          qrKitBasePrice: qrKitPrice ? qrKitPrice.toString() : "0",
          qrKitPrice: kitUpgradeSurcharge ? kitUpgradeSurcharge.toString() : "0",
          shippingName: body.shippingAddress?.name || "",
          shippingLine1: body.shippingAddress?.line1 || "",
          shippingLine2: body.shippingAddress?.line2 || "",
          shippingCity: body.shippingAddress?.city || "",
          shippingState: body.shippingAddress?.state || "",
          shippingPostalCode: body.shippingAddress?.postalCode || "",
          shippingCountry: body.shippingAddress?.country || "",
          subscriptionTrialEnd: trialEndUnix ? trialEndUnix.toString() : "",
          billingAnchorText,
        },
        custom_text: {
          submit: {
            message: `Billing begins once your kits are delivered and activated. We'll notify you before the first $${monthlyPriceWithKit.toFixed(
              2,
            )} charge.`,
          },
        },
        success_url: resolveUrl(
          originBase,
          body.successPath,
          "/pricing?success=true",
        ),
        cancel_url: resolveUrl(originBase, body.cancelPath, "/pricing?canceled=true"),
      });

      return res.json({ sessionId: session.id, sessionUrl: session.url });
    }

    // Unknown and retired checkout modes fail closed instead of accepting a
    // client-authored price or SKU.
    return res.status(400).json({ error: "Invalid checkout session payload" });
  } catch (error) {
    logger.error(
      {
        event: "stripe_checkout_session_create_failed",
        sessionType: body.sessionType ?? null,
        err: error,
      },
      "Error creating Stripe session",
    );
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ error: errorMessage });
  }
}
