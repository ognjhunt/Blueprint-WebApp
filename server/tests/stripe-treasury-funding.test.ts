// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  stripeAccount: {
    details_submitted: true,
    payouts_enabled: true,
    settings: { payouts: { schedule: { interval: "manual" } } },
    requirements: { currently_due: [], past_due: [] },
  } as Record<string, unknown>,
  availableAmount: 100_000,
  transferCreate: vi.fn().mockResolvedValue({ id: "tr_123" }),
  payoutCreate: vi.fn().mockResolvedValue({ id: "po_123" }),
  markFunded: vi.fn().mockResolvedValue(undefined),
  markFundingFailure: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../constants/stripe", () => ({
  STRIPE_ONBOARDING_REFRESH_URL: "https://tryblueprint.io/refresh",
  STRIPE_ONBOARDING_RETURN_URL: "https://tryblueprint.io/return",
  stripeClient: {
    balance: {
      retrieve: vi.fn().mockImplementation(async () => ({
        available: [{ amount: state.availableAmount, currency: "usd" }],
      })),
    },
    transfers: {
      create: state.transferCreate,
    },
    payouts: {
      create: state.payoutCreate,
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    accounts: {
      retrieve: vi.fn().mockImplementation(async () => state.stripeAccount),
      listExternalAccounts: vi.fn().mockResolvedValue({ data: [] }),
      update: vi.fn().mockResolvedValue(undefined),
      deleteExternalAccount: vi.fn().mockResolvedValue(undefined),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/test" }),
    },
  },
}));

vi.mock("../utils/stripeConnectAccounts", () => ({
  resolveStripeAccountForRequest: vi.fn(async () => ({
    accountId: "acct_creator_123",
    creatorId: "creator-123",
    source: "creator",
  })),
}));

vi.mock("../utils/accounting", () => ({
  beginCreatorPayoutDisbursement: vi.fn(async () => ({
    disbursement: {
      id: "disb_123",
      disbursed_amount_cents: 4500,
      stripe_transfer_id: null,
    },
    entries: [],
  })),
  markCreatorPayoutDisbursementFunded: state.markFunded,
  markCreatorPayoutDisbursementFundingFailure: state.markFundingFailure,
  finalizeCreatorPayoutDisbursement: state.finalize,
  failCreatorPayoutDisbursement: vi.fn().mockResolvedValue(undefined),
}));

async function startServer() {
  const { default: stripeRouter } = await import("../routes/stripe");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid: "creator-123" };
    next();
  });
  app.use("/v1/stripe", stripeRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(() => {
  state.stripeAccount = {
    details_submitted: true,
    payouts_enabled: true,
    settings: { payouts: { schedule: { interval: "manual" } } },
    requirements: { currently_due: [], past_due: [] },
  };
  state.availableAmount = 100_000;
  state.transferCreate.mockClear();
  state.payoutCreate.mockClear();
  state.markFunded.mockClear();
  state.markFundingFailure.mockClear();
  state.finalize.mockClear();
});

describe("stripe treasury funding", () => {
  it("blocks instant payouts when Stripe still has verification requirements", async () => {
    state.stripeAccount = {
      details_submitted: true,
      payouts_enabled: false,
      settings: { payouts: { schedule: { interval: "manual" } } },
      requirements: {
        currently_due: ["individual.verification.document"],
        past_due: ["external_account"],
        disabled_reason: "requirements.past_due",
      },
    };

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/stripe/account/instant_payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount_cents: 4500 }),
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "Stripe payouts are not enabled for this account.",
        requirements_due: ["individual.verification.document"],
        requirements_past_due: ["external_account"],
        disabled_reason: "requirements.past_due",
      });
      expect(state.transferCreate).not.toHaveBeenCalled();
      expect(state.payoutCreate).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("funds the creator connected account before creating the payout", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/stripe/account/instant_payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount_cents: 4500 }),
      });

      expect(response.status).toBe(201);
      expect(state.transferCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4500,
          destination: "acct_creator_123",
        }),
      );
      expect(state.payoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4500,
        }),
        { stripeAccount: "acct_creator_123" },
      );
      expect(state.markFunded).toHaveBeenCalled();
      expect(state.finalize).toHaveBeenCalledWith({
        disbursementId: "disb_123",
        stripePayoutId: "po_123",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("blocks payout creation when platform treasury balance is insufficient", async () => {
    state.availableAmount = 1000;

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/stripe/account/instant_payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount_cents: 4500 }),
      });

      expect(response.status).toBe(409);
      expect(state.transferCreate).not.toHaveBeenCalled();
      expect(state.payoutCreate).not.toHaveBeenCalled();
      expect(state.markFundingFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          disbursementId: "disb_123",
          status: "insufficient_platform_balance",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
