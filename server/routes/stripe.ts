import { Router, type Response } from "express";
import type Stripe from "stripe";
import { HTTP_STATUS } from "../constants/http-status";
import {
  STRIPE_ONBOARDING_REFRESH_URL,
  STRIPE_ONBOARDING_RETURN_URL,
  getStripeConnectAccountId,
  stripeConnectAccountConfigured,
  stripeClient,
} from "../constants/stripe";

const VALID_SCHEDULES = new Set(["daily", "weekly", "monthly", "manual"]);
type OnboardingStatusCode = typeof HTTP_STATUS.OK | typeof HTTP_STATUS.CREATED;

const router = Router();

async function fetchPrimaryBankAccount(
  stripe: Stripe,
  accountId: string,
): Promise<Stripe.BankAccount | null> {
  const response = await stripe.accounts.listExternalAccounts(accountId, {
    object: "bank_account",
    limit: 10,
  });
  const bankAccount = response.data.find(
    (item): item is Stripe.BankAccount => item.object === "bank_account",
  );
  return bankAccount ?? null;
}

function ensureStripeConfigured(res: Response) {
  if (!stripeClient) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      error: "Stripe is disabled. Configure STRIPE_SECRET_KEY to enable it.",
    });
    return false;
  }
  if (!stripeConnectAccountConfigured) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      error: "Stripe Connect account is not configured.",
    });
    return false;
  }

  return true;
}

function getStripeContext(res: Response) {
  if (!ensureStripeConfigured(res) || !stripeClient) {
    return null;
  }

  const accountId = getStripeConnectAccountId();
  if (!accountId) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      error: "Stripe Connect account is not configured.",
    });
    return null;
  }

  return { stripe: stripeClient, accountId };
}

router.get("/account", async (_req, res) => {
  try {
    const stripeContext = getStripeContext(res);
    if (!stripeContext) {
      return;
    }
    const { stripe, accountId } = stripeContext;
    const account = await stripe.accounts.retrieve(accountId);

    const payouts = await stripe.payouts.list(
      { limit: 3 },
      { stripeAccount: accountId },
    );

    const pendingPayout = payouts.data
      .filter((payout) => payout.status === "pending")
      .sort((a, b) => (a.arrival_date || a.created) - (b.arrival_date || b.created))[0];

    const instantBalance = await stripe.balance.retrieve(undefined, {
      stripeAccount: accountId,
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

router.get("/accounts/current", async (_req, res) => {
  try {
    const stripeContext = getStripeContext(res);
    if (!stripeContext) {
      return;
    }

    const bankAccount = await fetchPrimaryBankAccount(
      stripeContext.stripe,
      stripeContext.accountId,
    );
    if (!bankAccount) {
      return res.status(204).end();
    }

    return res.status(200).json({
      bank_name: bankAccount.bank_name || "Bank account",
      last4: bankAccount.last4 || "",
      account_holder_name: bankAccount.account_holder_name || "Account holder",
      stripe_account_id: stripeContext.accountId,
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to fetch billing info";
    return res.status(status).json({ error: message });
  }
});

async function createOnboardingLink(
  res: Response,
  statusCode: OnboardingStatusCode = HTTP_STATUS.OK,
) {
  const stripeContext = getStripeContext(res);
  if (!stripeContext) {
    return res;
  }

  if (!STRIPE_ONBOARDING_REFRESH_URL || !STRIPE_ONBOARDING_RETURN_URL) {
    return res.status(500).json({
      error: "Stripe onboarding redirect URLs are not configured",
    });
  }

  const link = await stripeContext.stripe.accountLinks.create({
    account: stripeContext.accountId,
    refresh_url: STRIPE_ONBOARDING_REFRESH_URL,
    return_url: STRIPE_ONBOARDING_RETURN_URL,
    type: "account_onboarding",
  });

  return res.status(statusCode).json({
    onboarding_url: link.url,
  });
}

router.post("/account/onboarding_link", async (_req, res) => {
  try {
    await createOnboardingLink(res, HTTP_STATUS.CREATED);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.get("/account/onboarding_link", async (_req, res) => {
  try {
    await createOnboardingLink(res, HTTP_STATUS.OK);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.put("/account/payout_schedule", async (req, res) => {
  try {
    const stripeContext = getStripeContext(res);
    if (!stripeContext) {
      return;
    }

    const schedule = req.body?.schedule;

    if (typeof schedule !== "string" || !VALID_SCHEDULES.has(schedule)) {
      return res.status(400).json({
        error: "Invalid payout schedule. Expected one of: daily, weekly, monthly, manual.",
      });
    }

    await stripeContext.stripe.accounts.update(stripeContext.accountId, {
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
    const stripeContext = getStripeContext(res);
    if (!stripeContext) {
      return;
    }

    const amount = req.body?.amount_cents;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount_cents. It must be a positive integer.",
      });
    }

    const payout = await stripeContext.stripe.payouts.create(
      {
        amount: Math.round(amount),
        currency: "usd",
        method: "instant",
      },
      { stripeAccount: stripeContext.accountId },
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      payout_id: payout.id,
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create instant payout";
    return res.status(status).json({ error: message });
  }
});

router.delete("/accounts/:stripeAccountId", async (req, res) => {
  try {
    const stripeContext = getStripeContext(res);
    if (!stripeContext) {
      return;
    }

    const requestedAccountId = String(req.params.stripeAccountId || "").trim();
    if (requestedAccountId && requestedAccountId !== stripeContext.accountId) {
      return res.status(404).json({ error: "Stripe account not found" });
    }

    const bankAccounts = await stripeContext.stripe.accounts.listExternalAccounts(
      stripeContext.accountId,
      {
        object: "bank_account",
        limit: 25,
      },
    );

    for (const account of bankAccounts.data) {
      if (account.object !== "bank_account") {
        continue;
      }
      await stripeContext.stripe.accounts.deleteExternalAccount(
        stripeContext.accountId,
        account.id,
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message =
      (error as Error).message || "Failed to disconnect bank account";
    return res.status(status).json({ error: message });
  }
});

export default router;
