import { Router, type Request, type Response } from "express";
import type Stripe from "stripe";
import { HTTP_STATUS } from "../constants/http-status";
import {
  STRIPE_ONBOARDING_REFRESH_URL,
  STRIPE_ONBOARDING_RETURN_URL,
  stripeClient,
} from "../constants/stripe";
import {
  beginCreatorPayoutDisbursement,
  failCreatorPayoutDisbursement,
  finalizeCreatorPayoutDisbursement,
  markCreatorPayoutDisbursementFunded,
  markCreatorPayoutDisbursementFundingFailure,
} from "../utils/accounting";
import { resolveStripeAccountForRequest } from "../utils/stripeConnectAccounts";

const VALID_SCHEDULES = new Set(["daily", "weekly", "monthly", "manual"]);
type OnboardingStatusCode = typeof HTTP_STATUS.OK | typeof HTTP_STATUS.CREATED;

const router = Router();

function populatedRequirements(
  requirements?: string[] | null,
): string[] | null {
  return requirements && requirements.length > 0 ? requirements : null;
}

function deadlineToISOString(deadline?: number | null): string | null {
  return deadline ? new Date(deadline * 1000).toISOString() : null;
}

function stripeRequirementPayload(account: Stripe.Account) {
  return {
    requirements_due: populatedRequirements(account.requirements?.currently_due),
    requirements_past_due: populatedRequirements(account.requirements?.past_due),
    requirements_pending_verification: populatedRequirements(
      account.requirements?.pending_verification,
    ),
    disabled_reason: account.requirements?.disabled_reason ?? null,
  };
}

async function ensureAccountReadyForInstantPayout(
  stripe: Stripe,
  accountId: string,
  res: Response,
): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId);
  const requirements = stripeRequirementPayload(account);
  const hasBlockingRequirements = Boolean(
    requirements.requirements_due ||
      requirements.requirements_past_due ||
      requirements.disabled_reason,
  );

  if (!account.details_submitted) {
    res.status(409).json({
      error: "Stripe onboarding is incomplete.",
      ...requirements,
    });
    return false;
  }

  if (!account.payouts_enabled || hasBlockingRequirements) {
    res.status(409).json({
      error: "Stripe payouts are not enabled for this account.",
      ...requirements,
    });
    return false;
  }

  return true;
}

router.use((req: Request, res: Response, next) => {
  const authenticatedUid = String(res.locals.firebaseUser?.uid || "").trim();
  if (!authenticatedUid) {
    return next();
  }

  const headerValue = String(req.header("X-Blueprint-Creator-Id") || "").trim();
  const queryValue = String(req.query.creator_id || "").trim();
  const bodyValue =
    typeof req.body?.creator_id === "string" ? req.body.creator_id.trim() : "";
  const requestedCreatorId = headerValue || queryValue || bodyValue;

  if (requestedCreatorId && requestedCreatorId !== authenticatedUid) {
    return res.status(403).json({
      error: "Creator identity does not match authenticated user",
    });
  }

  if (req.method === "GET" || req.method === "DELETE") {
    if (!String(req.query.creator_id || "").trim()) {
      (req.query as Record<string, unknown>).creator_id = authenticatedUid;
    }
  } else {
    const nextBody =
      req.body && typeof req.body === "object"
        ? { ...(req.body as Record<string, unknown>) }
        : {};
    if (typeof nextBody.creator_id !== "string" || !nextBody.creator_id.trim()) {
      nextBody.creator_id = authenticatedUid;
    }
    req.body = nextBody;
  }

  next();
});

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

  return true;
}

async function getScopedStripeContext(
  req: Request,
  res: Response,
  options?: {
    createIfMissing?: boolean;
  },
) {
  if (!ensureStripeConfigured(res) || !stripeClient) {
    return null;
  }

  const resolution = await resolveStripeAccountForRequest(req, {
    createIfMissing: options?.createIfMissing,
  });
  if (!resolution.accountId) {
    if (resolution.creatorId) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: "Creator Stripe account is not set up yet.",
      });
      return null;
    }

    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      error: "Stripe Connect account is not configured.",
    });
    return null;
  }

  return {
    stripe: stripeClient,
    accountId: resolution.accountId,
    creatorId: resolution.creatorId,
    source: resolution.source,
  };
}

router.get("/account", async (req, res) => {
  try {
    const stripeContext = await getScopedStripeContext(req, res);
    if (!stripeContext) {
      if (String(req.header("X-Blueprint-Creator-Id") || "").trim()) {
        return res.status(200).json({
          onboarding_complete: false,
          payouts_enabled: false,
          payout_schedule: "manual",
          instant_payout_eligible: false,
          next_payout: null,
          requirements_due: null,
          requirements_past_due: null,
          requirements_eventually_due: null,
          requirements_pending_verification: null,
          disabled_reason: null,
          requirements_current_deadline: null,
        });
      }
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
      ...stripeRequirementPayload(account),
      requirements_eventually_due: populatedRequirements(
        account.requirements?.eventually_due,
      ),
      requirements_current_deadline: deadlineToISOString(
        account.requirements?.current_deadline,
      ),
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to fetch account";
    return res.status(status).json({ error: message });
  }
});

router.get("/accounts/current", async (req, res) => {
  try {
    const stripeContext = await getScopedStripeContext(req, res);
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
  req: Request,
  res: Response,
  statusCode: OnboardingStatusCode = HTTP_STATUS.OK,
) {
  const stripeContext = await getScopedStripeContext(req, res, {
    createIfMissing: true,
  });
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
    collection_options: {
      fields: "eventually_due",
      future_requirements: "include",
    },
  } as Stripe.AccountLinkCreateParams);

  return res.status(statusCode).json({
    onboarding_url: link.url,
  });
}

router.post("/account/onboarding_link", async (req, res) => {
  try {
    await createOnboardingLink(req, res, HTTP_STATUS.CREATED);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.get("/account/onboarding_link", async (req, res) => {
  try {
    await createOnboardingLink(req, res, HTTP_STATUS.OK);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = (error as Error).message || "Failed to create onboarding link";
    return res.status(status).json({ error: message });
  }
});

router.put("/account/payout_schedule", async (req, res) => {
  try {
    const stripeContext = await getScopedStripeContext(req, res);
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
    const stripeContext = await getScopedStripeContext(req, res);
    if (!stripeContext) {
      return;
    }

    const amount = req.body?.amount_cents;

    if (
      amount !== undefined &&
      (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)
    ) {
      return res.status(400).json({
        error: "Invalid amount_cents. It must be a positive integer when provided.",
      });
    }

    const stripeAccountReady = await ensureAccountReadyForInstantPayout(
      stripeContext.stripe,
      stripeContext.accountId,
      res,
    );
    if (!stripeAccountReady) {
      return;
    }

    if (stripeContext.creatorId) {
      const disbursement = await beginCreatorPayoutDisbursement({
        creatorId: stripeContext.creatorId,
        stripeConnectAccountId: stripeContext.accountId,
        requestedAmountCents:
          typeof amount === "number" ? Math.round(amount) : undefined,
      });
      if (!disbursement) {
        return res.status(409).json({
          error: "No approved capturer payouts are available for disbursement.",
        });
      }

      let transferFunded = Boolean(disbursement.disbursement.stripe_transfer_id);
      try {
        if (!transferFunded) {
          const platformBalance = await stripeContext.stripe.balance.retrieve();
          const availableCents = (platformBalance.available || [])
            .filter((entry) => entry.currency === "usd")
            .reduce((sum, entry) => sum + entry.amount, 0);

          if (availableCents < disbursement.disbursement.disbursed_amount_cents) {
            await markCreatorPayoutDisbursementFundingFailure({
              disbursementId: disbursement.disbursement.id,
              status: "insufficient_platform_balance",
              reason: "Platform treasury balance is insufficient to fund this payout.",
              platformAvailableBalanceCents: availableCents,
            });
            return res.status(409).json({
              error: "Platform treasury balance is insufficient to fund this payout.",
            });
          }

          const transfer = await stripeContext.stripe.transfers.create({
            amount: disbursement.disbursement.disbursed_amount_cents,
            currency: "usd",
            destination: stripeContext.accountId,
            transfer_group: `creator-payout:${disbursement.disbursement.id}`,
            metadata: {
              creator_id: stripeContext.creatorId,
              disbursement_id: disbursement.disbursement.id,
            },
          });

          await markCreatorPayoutDisbursementFunded({
            disbursementId: disbursement.disbursement.id,
            stripeTransferId: transfer.id,
            platformAvailableBalanceCents: availableCents,
          });
          transferFunded = true;
        }

        const payout = await stripeContext.stripe.payouts.create(
          {
            amount: disbursement.disbursement.disbursed_amount_cents,
            currency: "usd",
            method: "instant",
            metadata: {
              creator_id: stripeContext.creatorId,
              disbursement_id: disbursement.disbursement.id,
            },
          },
          { stripeAccount: stripeContext.accountId },
        );

        await finalizeCreatorPayoutDisbursement({
          disbursementId: disbursement.disbursement.id,
          stripePayoutId: payout.id,
        });

        return res.status(HTTP_STATUS.CREATED).json({
          success: true,
          payout_id: payout.id,
          disbursement_id: disbursement.disbursement.id,
          amount_cents: disbursement.disbursement.disbursed_amount_cents,
        });
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : "Stripe payout creation failed.";
        if (!transferFunded) {
          await markCreatorPayoutDisbursementFundingFailure({
            disbursementId: disbursement.disbursement.id,
            status: "transfer_failed",
            reason,
          });
        } else {
          await failCreatorPayoutDisbursement({
            disbursementId: disbursement.disbursement.id,
            reason,
          });
        }
        throw error;
      }
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "amount_cents is required when no creator context is supplied.",
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
    const stripeContext = await getScopedStripeContext(req, res);
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
