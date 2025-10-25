import { Router, type Response } from "express";
import type Stripe from "stripe";
import {
  STRIPE_CONNECT_ACCOUNT_ID,
  STRIPE_ONBOARDING_REFRESH_URL,
  STRIPE_ONBOARDING_RETURN_URL,
  stripeClient,
} from "../constants/stripe";

const VALID_SCHEDULES = new Set(["daily", "weekly", "monthly", "manual"]);

const router = Router();

function ensureStripeConfigured() {
  if (!stripeClient) {
    throw Object.assign(new Error("STRIPE_SECRET_KEY environment variable is required"), {
      status: 500,
    });
  }
  if (!STRIPE_CONNECT_ACCOUNT_ID) {
    throw Object.assign(new Error("Stripe Connect account id is not configured"), {
      status: 500,
    });
  }
}

router.get("/account", async (_req, res) => {
  try {
    ensureStripeConfigured();
    const account = await stripeClient!.accounts.retrieve(STRIPE_CONNECT_ACCOUNT_ID);

    const payouts = await stripeClient!.payouts.list(
      { limit: 3 },
      { stripeAccount: STRIPE_CONNECT_ACCOUNT_ID },
    );

    const pendingPayout = payouts.data
      .filter((payout) => payout.status === "pending")
      .sort((a, b) => (a.arrival_date || a.created) - (b.arrival_date || b.created))[0];

    const instantBalance = await stripeClient!.balance.retrieve(undefined, {
      stripeAccount: STRIPE_CONNECT_ACCOUNT_ID,
    });

    const instantAvailable = instantBalance.instant_available ?? [];

    return res.status(200).json({
      onboarding_complete: Boolean(account.details_submitted),
      payouts_enabled: Boolean(account.payouts_enabled),
      payout_schedule: account.settings?.payouts?.schedule?.interval || "manual",
      instant_payout_eligible: instantAvailable.some((entry) => entry.amount > 0),
      next_payout: pendingPayout
        ? {
            estimated_arrival: new Date(
              (pendingPayout.arrival_date || pendingPayout.created) * 1000,
            ).toISOString(),
            amount_cents: pendingPayout.amount,
          }
        : null,
      requirements_due:
        account.requirements?.currently_due && account.requirements.currently_due.length > 0
          ? account.requirements.currently_due
          : null,
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to fetch account";
    return res.status(status).json({ error: message });
  }
});

async function createOnboardingLink(res: Response) {
  ensureStripeConfigured();

  if (!STRIPE_ONBOARDING_REFRESH_URL || !STRIPE_ONBOARDING_RETURN_URL) {
    return res.status(500).json({
      error: "Stripe onboarding redirect URLs are not configured",
    });
  }

  const link = await stripeClient!.accountLinks.create({
    account: STRIPE_CONNECT_ACCOUNT_ID,
    refresh_url: STRIPE_ONBOARDING_REFRESH_URL,
    return_url: STRIPE_ONBOARDING_RETURN_URL,
    type: "account_onboarding",
  });

  return res.status(200).json({
    onboarding_url: link.url,
  });
}

router.post("/account/onboarding_link", async (_req, res) => {
  try {
    await createOnboardingLink(res);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.get("/account/onboarding_link", async (_req, res) => {
  try {
    await createOnboardingLink(res);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.put("/account/payout_schedule", async (req, res) => {
  try {
    ensureStripeConfigured();

    const schedule = req.body?.schedule;

    if (typeof schedule !== "string" || !VALID_SCHEDULES.has(schedule)) {
      return res.status(400).json({
        error: "Invalid payout schedule. Expected one of: daily, weekly, monthly, manual.",
      });
    }

    await stripeClient!.accounts.update(STRIPE_CONNECT_ACCOUNT_ID, {
      settings: {
        payouts: {
          schedule: {
            interval: schedule as Stripe.AccountUpdateParams.Settings.Payouts.Schedule.Interval,
          },
        },
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to update payout schedule";
    return res.status(status).json({ error: message });
  }
});

router.post("/account/instant_payout", async (req, res) => {
  try {
    ensureStripeConfigured();

    const amount = req.body?.amount_cents;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount_cents. It must be a positive integer.",
      });
    }

    const payout = await stripeClient!.payouts.create(
      {
        amount: Math.round(amount),
        currency: "usd",
        method: "instant",
      },
      { stripeAccount: STRIPE_CONNECT_ACCOUNT_ID },
    );

    return res.status(200).json({
      success: true,
      payout_id: payout.id,
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create instant payout";
    return res.status(status).json({ error: message });
  }
});

export default router;
