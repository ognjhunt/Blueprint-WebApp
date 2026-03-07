import type { Request, Response } from "express";
import Stripe from "stripe";
import {
  calculateTotalPrice,
  marketplaceScenes,
  premiumCapabilities,
  syntheticDatasets,
  trainingDatasets,
  type ExclusivityType,
  type LicenseTier,
} from "../../../client/src/data/content";

type PaymentSessionType = "onboarding" | "legacy-hourly" | "marketplace";

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
};

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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

function getStripeClient() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is required");
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

  try {
    const stripe = getStripeClient();

    const body = (req.body || {}) as CheckoutRequestBody;
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

      if (itemType === "scene") {
        const scene = findSceneBySku(marketplaceItem.sku);
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
      } else if (itemType === "dataset") {
        const dataset = findDatasetBySku(marketplaceItem.sku);
        if (!dataset) {
          return res.status(400).json({ error: "Unknown marketplace dataset SKU" });
        }

        expectedBasePrice = dataset.pricePerScene;
        expectedQuantity = dataset.sceneCount || 1;
      } else if (itemType === "training") {
        const training = findTrainingBySku(marketplaceItem.sku);
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

      const session = await stripe.checkout.sessions.create({
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
                  sku: marketplaceItem.sku || "",
                  itemType: marketplaceItem.itemType || "",
                  licenseTier,
                  exclusivity,
                },
              },
              unit_amount: Math.round(computedPrice * 100),
            },
            quantity,
          },
        ],
        metadata: {
          marketplaceSku: marketplaceItem.sku || "",
          marketplaceItemType: itemType,
          marketplaceTitle: marketplaceItem.title,
          marketplaceDescription: sanitizedDescription,
          marketplacePrice: computedPrice.toFixed(2),
          marketplaceQuantity: quantity.toString(),
          // Hybrid marketplace metadata
          licenseTier,
          exclusivity,
          basePrice: expectedBasePrice.toFixed(2),
          addons: addons.join(','),
        },
        success_url: resolveUrl(
          originBase,
          body.successPath,
          "/environments?checkout=success",
        ),
        cancel_url: resolveUrl(originBase, body.cancelPath, "/environments?checkout=cancel"),
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

    const { totalCost, hours, costPerHour } = body;
    if (
      typeof totalCost === "number" &&
      typeof hours === "number" &&
      typeof costPerHour === "number"
    ) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Blueprint Plus Plan",
                description: `${hours} hours at $${costPerHour.toFixed(2)}/hour`,
              },
              unit_amount: Math.round(totalCost * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          plan: "plus",
          hours: hours.toString(),
          costPerHour: costPerHour.toString(),
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

    return res.status(400).json({ error: "Invalid checkout session payload" });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ error: errorMessage });
  }
}
