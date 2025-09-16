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
  organizationName?: string;
  contactName?: string;
  contactEmail?: string;
  mappingDateTime?: string;
  successPath?: string;
  cancelPath?: string;
  totalCost?: number;
  hours?: number;
  costPerHour?: number;
};

const DEFAULT_STRIPE_SECRET =
  process.env.STRIPE_SECRET_KEY ||
  process.env.VITE_STRIPE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY ||
  // Test key supplied for local development convenience.
  "sk_test_51ODuefLAUkK46LtZ72Vjg867ez3Bk1pdC2GrFpDh3lgF241gNdqyJNGfXxCnN1QnSrniPohZuzweJTeFLHIuXFUl00rojQNqfj";

const stripe = new Stripe(DEFAULT_STRIPE_SECRET);

function resolveUrl(origin: string, path: string | undefined, fallbackPath: string) {
  const target = path && path.length ? path : fallbackPath;
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  if (target.startsWith("/")) {
    return `${origin}${target}`;
  }
  return `${origin}/${target}`;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as CheckoutRequestBody;
    const sessionType: PaymentSessionType =
      body.sessionType || (body.totalCost ? "legacy-hourly" : "onboarding");

    const originHeader = (req.headers.origin as string | undefined) || "";
    const originBase =
      originHeader ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VITE_PUBLIC_URL ||
      process.env.BASE_URL ||
      "http://localhost:5173";

    if (sessionType === "onboarding") {
      const onboardingFee = typeof body.onboardingFee === "number" ? body.onboardingFee : 499.99;
      const monthlyPrice = typeof body.monthlyPrice === "number" ? body.monthlyPrice : 49.99;
      const includedHours = typeof body.includedHours === "number" ? body.includedHours : 40;
      const extraHourlyRate = typeof body.extraHourlyRate === "number" ? body.extraHourlyRate : 1.25;

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

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
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
        ],
        metadata: {
          plan: "blueprint-care",
          onboardingFee: onboardingFee.toString(),
          monthlyPrice: monthlyPrice.toString(),
          includedWeeklyHours: includedHours.toString(),
          extraHourlyRate: extraHourlyRate.toString(),
          organizationName: body.organizationName || "",
          contactName: body.contactName || "",
          contactEmail: body.contactEmail || "",
          mappingDateTime: body.mappingDateTime || "",
          subscriptionTrialEnd: trialEndUnix ? trialEndUnix.toString() : "",
        },
        custom_text: {
          submit: {
            message: `Your $${monthlyPrice.toFixed(
              2,
            )}/mo Blueprint Care plan begins ${billingAnchorText}.`,
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
