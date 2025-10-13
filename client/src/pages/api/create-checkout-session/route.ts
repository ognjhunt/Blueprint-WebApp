import type { Request, Response } from "express";
import Stripe from "stripe";

type PaymentSessionType =
  | "onboarding"
  | "legacy-hourly";

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
};

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

const configuredOrigins = (process.env.CHECKOUT_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const fallbackOrigin =
  process.env.NEXT_PUBLIC_BASE_URL ||
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
    if (!stripe) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    const body = (req.body || {}) as CheckoutRequestBody;
    const sessionType: PaymentSessionType =
      body.sessionType || (body.totalCost ? "legacy-hourly" : "onboarding");

    const originHeader = req.headers.origin as string | undefined;
    const originBase = resolveBaseOrigin(originHeader);

    if (sessionType === "onboarding") {
      const onboardingFee = typeof body.onboardingFee === "number" ? body.onboardingFee : 499.99;
      const planId =
        typeof body.planId === "string" && body.planId.trim().length > 0
          ? body.planId.trim()
          : "blueprint-care";
      const planName =
        typeof body.planName === "string" && body.planName.trim().length > 0
          ? body.planName.trim()
          : "Blueprint Care";
      const monthlyPrice =
        typeof body.monthlyPrice === "number" && Number.isFinite(body.monthlyPrice)
          ? body.monthlyPrice
          : 49.99;
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

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Blueprint Onboarding Experience",
              description: "One-time on-site activation & setup",
            },
            unit_amount: Math.round(onboardingFee * 100),
          },
          quantity: 1,
        },
      ];

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
