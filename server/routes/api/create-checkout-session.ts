import type { Request, Response } from "express";
import Stripe from "stripe";
import {
  calculateTotalPrice,
  marketplaceScenes,
  premiumCapabilities,
  syntheticDatasets,
  trainingDatasets,
  type MarketplaceScene,
  type SyntheticDataset,
  type TrainingDataset,
  type ExclusivityType,
  type LicenseTier,
} from "../../../client/src/data/content";
import { getSiteLibrarySite } from "../../../client/src/data/siteLibrary";
import { findPublishedMarketplaceInventoryBySku } from "../../utils/marketplaceInventory";
import {
  attachStripeCheckoutSessionToBuyerOrder,
  createBuyerOrderDraft,
  markBuyerOrderCheckoutFailure,
} from "../../utils/accounting";
import { stripeAvailable } from "../../constants/stripe";
import { logger } from "../../logger";

type PaymentSessionType =
  | "onboarding"
  | "legacy-hourly"
  | "marketplace"
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
  marketplaceItem?: {
    sku?: string;
    title?: string;
    description?: string;
    price?: number;
    quantity?: number;
    itemType?: string;
    // Hybrid marketplace fields
    licenseTier?: 'research' | 'commercial' | 'enterprise';
    exclusivity?: 'non-exclusive' | 'time-limited' | 'category' | 'semi-exclusive' | 'full-exclusive';
    basePrice?: number;
    addons?: string[];
    dataTier?: "basic" | "standard" | "premium";
  };
  robotEvalRun?: {
    siteSlug?: string;
  };
};

export const ROBOT_EVAL_RUN_SKU_SUFFIX = "-robot-eval-run";
export const ROBOT_EVAL_RUN_PRICE_CATALOG_SLUG = "policy-benchmarking";

export function robotEvalRunSkuForSiteSlug(siteSlug: string) {
  return `${siteSlug}${ROBOT_EVAL_RUN_SKU_SUFFIX}`;
}

const VALID_LICENSE_TIERS: ReadonlySet<LicenseTier> = new Set<LicenseTier>([
  "research",
  "commercial",
  "enterprise",
]);

const VALID_EXCLUSIVITY_TYPES: ReadonlySet<ExclusivityType> = new Set<ExclusivityType>([
  "non-exclusive",
  "time-limited",
  "category",
  "semi-exclusive",
  "full-exclusive",
]);

function findSceneBySku(sku: string) {
  const normalizedSku = sku.trim();
  return marketplaceScenes
    .filter((scene) => normalizedSku === scene.slug || normalizedSku.startsWith(`${scene.slug}-`))
    .sort((a, b) => b.slug.length - a.slug.length)[0];
}

function findDatasetBySku(sku: string) {
  const normalizedSku = sku.trim();
  return syntheticDatasets
    .filter((dataset) => normalizedSku === dataset.slug || normalizedSku.startsWith(`${dataset.slug}-`))
    .sort((a, b) => b.slug.length - a.slug.length)[0];
}

function findTrainingBySku(sku: string) {
  const normalizedSku = sku.trim();
  return trainingDatasets
    .filter((training) => normalizedSku === training.slug || normalizedSku.startsWith(`${training.slug}-`))
    .sort((a, b) => b.slug.length - a.slug.length)[0];
}

function roundToCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMarketplaceCheckoutMetadata(params: {
  orderId: string;
  marketplaceItem: NonNullable<CheckoutRequestBody["marketplaceItem"]>;
  itemType: string | undefined;
  liveInventoryRecord?: {
    deliveryMode?: string | null;
    fulfillmentStatus?: string | null;
  } | null;
  computedPrice: number;
  quantity: number;
  expectedBasePrice: number;
  licenseTier: LicenseTier;
  exclusivity: ExclusivityType;
  addons: string[];
}) {
  const {
    orderId,
    marketplaceItem,
    itemType,
    liveInventoryRecord,
    computedPrice,
    quantity,
    expectedBasePrice,
    licenseTier,
    exclusivity,
    addons,
  } = params;
  return {
    order_id: orderId,
    marketplaceSku: marketplaceItem.sku || "",
    marketplaceItemType: itemType || "",
    marketplaceTitle: marketplaceItem.title || "",
    marketplaceDescription: (marketplaceItem.description || "").slice(0, 500),
    marketplacePrice: computedPrice.toFixed(2),
    marketplaceQuantity: quantity.toString(),
    marketplaceInventorySource: liveInventoryRecord ? "firestore" : "static",
    marketplaceDeliveryMode: liveInventoryRecord?.deliveryMode || "",
    marketplaceFulfillmentStatus: liveInventoryRecord?.fulfillmentStatus || "",
    licenseTier,
    exclusivity,
    basePrice: expectedBasePrice.toFixed(2),
    addons: addons.join(","),
  };
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
const staticMarketplaceFallbackEnabled =
  process.env.NODE_ENV !== "production" || process.env.BLUEPRINT_ENABLE_DEMO_SITE_WORLDS === "1";

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

    const sessionType: PaymentSessionType =
      body.sessionType || (body.totalCost ? "legacy-hourly" : "onboarding");

    const originHeader = req.headers.origin as string | undefined;
    const originBase = resolveBaseOrigin(originHeader);

    if (sessionType === "marketplace") {
      const { marketplaceItem } = body;

      if (
        !marketplaceItem?.title ||
        typeof marketplaceItem.title !== "string" ||
        !marketplaceItem.sku ||
        typeof marketplaceItem.sku !== "string"
      ) {
        return res.status(400).json({
          error: "A valid marketplace item title and SKU are required",
        });
      }

      const requestedPrice = marketplaceItem?.price;
      const quantity =
        typeof marketplaceItem?.quantity === "number" &&
        Number.isFinite(marketplaceItem.quantity) &&
        marketplaceItem.quantity > 0
          ? Math.floor(marketplaceItem.quantity)
          : 1;

      if (typeof requestedPrice !== "number" || !Number.isFinite(requestedPrice)) {
        return res.status(400).json({
          error: "A valid marketplace item price is required",
        });
      }

      const sanitizedDescription = (marketplaceItem.description || "").slice(0, 500);

      // Hybrid marketplace fields (strictly server-validated)
      const licenseTier: LicenseTier = VALID_LICENSE_TIERS.has(marketplaceItem.licenseTier as LicenseTier)
        ? (marketplaceItem.licenseTier as LicenseTier)
        : "commercial";
      const exclusivity: ExclusivityType = VALID_EXCLUSIVITY_TYPES.has(
        marketplaceItem.exclusivity as ExclusivityType,
      )
        ? (marketplaceItem.exclusivity as ExclusivityType)
        : "non-exclusive";

      const requestedAddons = Array.isArray(marketplaceItem.addons)
        ? marketplaceItem.addons.filter((addon): addon is string => typeof addon === "string")
        : [];
      const addonPriceMap = new Map(premiumCapabilities.map((addon) => [addon.slug, addon]));
      const addons = requestedAddons.filter((addonSlug) => addonPriceMap.has(addonSlug));

      const itemType = marketplaceItem.itemType;
      let expectedBasePrice = 0;
      let expectedQuantity = quantity;
      const liveInventoryRecord = await findPublishedMarketplaceInventoryBySku(
        marketplaceItem.sku,
      );

      if (!liveInventoryRecord && !staticMarketplaceFallbackEnabled) {
        return res.status(409).json({
          error: "This marketplace item is not available from live inventory.",
        });
      }

      if ((liveInventoryRecord?.itemType || itemType) === "scene") {
        const scene: MarketplaceScene | undefined =
          liveInventoryRecord?.itemType === "scene"
            ? (liveInventoryRecord.item as MarketplaceScene)
            : findSceneBySku(marketplaceItem.sku);
        if (!scene) {
          return res.status(400).json({ error: "Unknown marketplace scene SKU" });
        }

        if (marketplaceItem.sku.includes("-scene-")) {
          expectedBasePrice = scene.sceneOnlyPrice || Math.round(scene.price * 0.45);
        } else if (marketplaceItem.sku.includes("-episodes-")) {
          expectedBasePrice = scene.episodesOnlyPrice || Math.round(scene.price * 0.65);
        } else if (marketplaceItem.sku.includes("-bundle-")) {
          expectedBasePrice = scene.bundlePrice || scene.price;
        } else {
          expectedBasePrice = scene.price;
        }

        expectedQuantity = 1;
      } else if ((liveInventoryRecord?.itemType || itemType) === "dataset") {
        const dataset: SyntheticDataset | undefined =
          liveInventoryRecord?.itemType === "dataset"
            ? (liveInventoryRecord.item as SyntheticDataset)
            : findDatasetBySku(marketplaceItem.sku);
        if (!dataset) {
          return res.status(400).json({ error: "Unknown marketplace dataset SKU" });
        }

        expectedBasePrice = dataset.pricePerScene;
        expectedQuantity = dataset.sceneCount || 1;
      } else if ((liveInventoryRecord?.itemType || itemType) === "training") {
        const training: TrainingDataset | undefined =
          liveInventoryRecord?.itemType === "training"
            ? (liveInventoryRecord.item as TrainingDataset)
            : findTrainingBySku(marketplaceItem.sku);
        if (!training) {
          return res.status(400).json({ error: "Unknown marketplace training SKU" });
        }

        const dataTier = marketplaceItem.dataTier;
        if (dataTier === "basic" || marketplaceItem.sku.includes("-basic-")) {
          expectedBasePrice = training.basicPrice || Math.round(training.price * 0.4);
        } else if (dataTier === "premium" || marketplaceItem.sku.includes("-premium-")) {
          expectedBasePrice = training.premiumPrice || Math.round(training.price * 1.5);
        } else {
          expectedBasePrice = training.standardPrice || training.price;
        }

        expectedQuantity = 1;
      } else {
        return res.status(400).json({ error: "Unknown marketplace item type" });
      }

      if (liveInventoryRecord?.rightsStatus === "blocked") {
        return res.status(409).json({
          error: "This marketplace item is not commercially publishable.",
        });
      }

      if (quantity !== expectedQuantity) {
        return res.status(400).json({ error: "Invalid quantity for selected marketplace item" });
      }

      const addonTotal = addons.reduce((sum, addonSlug) => {
        return sum + (addonPriceMap.get(addonSlug)?.price || 0);
      }, 0);

      const computedPrice = roundToCurrency(
        calculateTotalPrice(expectedBasePrice, licenseTier, exclusivity) + addonTotal,
      );

      if (roundToCurrency(requestedPrice) !== computedPrice) {
        return res.status(400).json({
          error: "Invalid marketplace price for selected SKU and license options",
        });
      }

      // Build product description with license info
      const licenseLabels: Record<string, string> = {
        research: 'Research License',
        commercial: 'Commercial License',
        enterprise: 'Enterprise License',
      };
      const licenseLabel = licenseLabels[licenseTier] || 'Commercial License';

      const exclusivityLabels: Record<string, string> = {
        'non-exclusive': '',
        'time-limited': ' (90-Day Exclusive)',
        'category': ' (Category Exclusive)',
        'semi-exclusive': ' (Limited Availability)',
        'full-exclusive': ' (Full Exclusive)',
      };
      const exclusivityLabel = exclusivityLabels[exclusivity] || '';

      const fullDescription = sanitizedDescription
        ? `${sanitizedDescription} | ${licenseLabel}${exclusivityLabel}`
        : `${licenseLabel}${exclusivityLabel}`;

      const successUrl = resolveUrl(
        originBase,
        body.successPath,
        "/world-models?checkout=success",
      );
      const cancelUrl = resolveUrl(
        originBase,
        body.cancelPath,
        "/world-models?checkout=cancel",
      );

      const firebaseUser = (res.locals.firebaseUser || {}) as {
        uid?: string;
        email?: string;
      };
      const order = await createBuyerOrderDraft({
        buyerUserId:
          typeof firebaseUser.uid === "string" ? firebaseUser.uid : null,
        buyerEmail:
          typeof firebaseUser.email === "string" ? firebaseUser.email : null,
        sku: marketplaceItem.sku,
        title: marketplaceItem.title,
        description: sanitizedDescription,
        itemType: itemType || liveInventoryRecord?.itemType || "",
        quantity,
        licenseTier,
        exclusivity,
        addons,
        inventorySource: liveInventoryRecord ? "firestore-live" : "static",
        liveInventoryRecordId: liveInventoryRecord?.id || null,
        deliveryMode: liveInventoryRecord?.deliveryMode || null,
        inventoryFulfillmentStatus: liveInventoryRecord?.fulfillmentStatus || null,
        rightsStatus: liveInventoryRecord?.rightsStatus || null,
        unitAmountCents: Math.round(computedPrice * 100),
        totalAmountCents: Math.round(computedPrice * 100 * quantity),
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
                  name: marketplaceItem.title,
                  description: fullDescription || undefined,
                  metadata: {
                    orderId: order.id,
                    sku: marketplaceItem.sku || "",
                    itemType: marketplaceItem.itemType || null,
                    licenseTier,
                    exclusivity,
                  },
                },
                unit_amount: Math.round(computedPrice * 100),
              },
              quantity,
            },
          ],
          metadata: buildMarketplaceCheckoutMetadata({
            orderId: order.id,
            marketplaceItem,
            itemType,
            liveInventoryRecord,
            computedPrice,
            quantity,
            expectedBasePrice,
            licenseTier,
            exclusivity,
            addons,
          }),
          payment_intent_data: {
            metadata: {
              order_id: order.id,
              marketplace_sku: marketplaceItem.sku || "",
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
        checkoutSessionUrl:
          typeof session.url === "string" ? session.url : null,
        livemode: session.livemode,
      });

      return res.json({ sessionId: session.id, sessionUrl: session.url });
    }

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

      const site = getSiteLibrarySite(siteSlug);
      if (!site) {
        return res.status(404).json({ error: "Unknown site for policy evaluation run." });
      }
      if (
        !site.robotEvalPublication?.readyToEvaluatePublishable ||
        !site.defaultRobotEvalSelection
      ) {
        return res.status(409).json({
          error:
            "This site does not have a publication-ready evaluation package yet, so a run cannot be purchased.",
        });
      }

      const evalService = premiumCapabilities.find(
        (capability) => capability.slug === ROBOT_EVAL_RUN_PRICE_CATALOG_SLUG,
      );
      if (!evalService || !Number.isFinite(evalService.price) || evalService.price <= 0) {
        return res.status(503).json({
          error: "Policy evaluation run pricing is not configured.",
        });
      }
      const priceUsd = roundToCurrency(evalService.price);

      const sku = robotEvalRunSkuForSiteSlug(site.slug);
      const successUrl = resolveUrl(
        originBase,
        body.successPath,
        `/sites/${site.slug}?robotEvalCheckout=success`,
      );
      const cancelUrl = resolveUrl(
        originBase,
        body.cancelPath,
        `/sites/${site.slug}?robotEvalCheckout=cancelled`,
      );

      const order = await createBuyerOrderDraft({
        buyerUserId,
        buyerEmail: buyerEmail || null,
        sku,
        title: `${site.name} — Policy Evaluation Run`,
        description: evalService.description,
        itemType: "robot_eval_run",
        quantity: 1,
        licenseTier: "commercial",
        exclusivity: "non-exclusive",
        addons: [],
        inventorySource: "site-library",
        liveInventoryRecordId: null,
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
                  name: `${site.name} — Policy Evaluation Run`,
                  description:
                    "Virtual policy-evaluation run on this captured site package. Blueprint queues the request and forwards it to Pipeline for scheduling.",
                  metadata: {
                    orderId: order.id,
                    sku,
                    itemType: "robot_eval_run",
                    robotEvalSiteSlug: site.slug,
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
            robotEvalSiteSlug: site.slug,
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

      // WEB-08: like the marketplace path (and the removed WEB-07 legacy path),
      // never charge client-authored amounts. Every legitimate caller submits
      // values from a static client catalog, so anything outside that catalog is
      // a forged payload: onboarding fee is always 0; plan prices are the
      // published subscription tiers; the kit surcharge is a kit upgrade fee
      // (0/15/45) plus an optional mapping fee (99).
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

    // WEB-07: the legacy "hourly plus plan" path charged a client-supplied
    // `totalCost` with no server-side validation, letting a caller set their own
    // price. It has no remaining client caller (the marketplace path above is the
    // real one, and it recomputes+rejects mismatched prices server-side), so it is
    // removed. Any legacy caller now gets a 400 instead of a self-priced checkout.
    return res.status(400).json({ error: "Invalid checkout session payload" });
  } catch (error) {
    logger.error(
      {
        event: "stripe_checkout_session_create_failed",
        sessionType: body.sessionType ?? null,
        marketplaceSku:
          typeof body.marketplaceItem?.sku === "string" ? body.marketplaceItem.sku : null,
        marketplaceItemType:
          typeof body.marketplaceItem?.itemType === "string" ? body.marketplaceItem.itemType : null,
        err: error,
      },
      "Error creating Stripe session",
    );
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ error: errorMessage });
  }
}
