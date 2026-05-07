// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  stripeAccount: {
    livemode: false,
    details_submitted: true,
    payouts_enabled: true,
    settings: { payouts: { schedule: { interval: "manual" } } },
    requirements: {
      currently_due: [],
      past_due: [],
      eventually_due: [],
      pending_verification: [],
      disabled_reason: null,
      current_deadline: null,
    },
  } as Record<string, unknown>,
  bankAccounts: [
    {
      id: "ba_123",
      object: "bank_account",
      bank_name: "Mercury",
      last4: "6789",
      account_holder_name: "Blueprint Capture",
    },
  ] as Array<Record<string, unknown>>,
  deleteExternalAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../constants/stripe", () => ({
  STRIPE_CURRENT_PROVIDER: "stripe",
  STRIPE_LIVE_PAYOUT_EXECUTION_ENABLED: false,
  isStripeLivePayoutExecutionEnabled: () => false,
  STRIPE_ONBOARDING_REFRESH_URL: "https://tryblueprint.io/refresh",
  STRIPE_ONBOARDING_RETURN_URL: "https://tryblueprint.io/return",
  getStripeConnectAccountId: () => "acct_mock_contract",
  stripeConnectAccountConfigured: true,
  stripeClient: {
    accounts: {
      retrieve: vi.fn().mockImplementation(async () => state.stripeAccount),
      listExternalAccounts: vi.fn().mockImplementation(async () => ({
        data: state.bankAccounts,
      })),
      deleteExternalAccount: state.deleteExternalAccount,
      update: vi.fn().mockResolvedValue(undefined),
    },
    payouts: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: "po_123" }),
    },
    balance: {
      retrieve: vi.fn().mockResolvedValue({ instant_available: [] }),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/test" }),
    },
  },
}));

async function startServer() {
  const { default: stripeRouter } = await import("../routes/stripe");
  const { csrfProtection } = await import("../middleware/csrf");
  const app = express();
  app.use(express.json());
  app.use("/v1/stripe", csrfProtection, stripeRouter);
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
    livemode: false,
    details_submitted: true,
    payouts_enabled: true,
    settings: { payouts: { schedule: { interval: "manual" } } },
    requirements: {
      currently_due: [],
      past_due: [],
      eventually_due: [],
      pending_verification: [],
      disabled_reason: null,
      current_deadline: null,
    },
  };
  state.bankAccounts = [
    {
      id: "ba_123",
      object: "bank_account",
      bank_name: "Mercury",
      last4: "6789",
      account_holder_name: "Blueprint Capture",
    },
  ];
  state.deleteExternalAccount.mockReset();
  state.deleteExternalAccount.mockResolvedValue(undefined);
});

describe("stripe native parity routes", () => {
  it("returns Stripe verification requirements for native payout readiness", async () => {
    state.stripeAccount = {
      livemode: false,
      details_submitted: true,
      payouts_enabled: false,
      settings: { payouts: { schedule: { interval: "manual" } } },
      requirements: {
        currently_due: [
          "individual.verification.document",
          "individual.ssn_last_4",
        ],
        past_due: ["external_account"],
        eventually_due: ["individual.dob.day"],
        pending_verification: ["individual.address.line1"],
        disabled_reason: "requirements.past_due",
        current_deadline: 1_765_497_600,
      },
    };

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/stripe/account`, {
        headers: {
          "X-Blueprint-Native-Client": "ios",
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        onboarding_complete: true,
        payouts_enabled: false,
        provider_state_checked: true,
        provider_mode: "test",
        contract_provider_ready: false,
        live_provider_ready: false,
        live_payout_execution_enabled: false,
        requirements_due: [
          "individual.verification.document",
          "individual.ssn_last_4",
        ],
        requirements_past_due: ["external_account"],
        requirements_eventually_due: ["individual.dob.day"],
        requirements_pending_verification: ["individual.address.line1"],
        disabled_reason: "requirements.past_due",
        requirements_current_deadline: "2025-12-12T00:00:00.000Z",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("asks Stripe-hosted onboarding to collect future payout requirements", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/v1/stripe/account/onboarding_link`,
        {
          headers: {
            "X-Blueprint-Native-Client": "ios",
          },
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        onboarding_url: "https://connect.stripe.com/test",
      });
      const { stripeClient } = await import("../constants/stripe");
      expect(stripeClient?.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account: "acct_mock_contract",
          type: "account_onboarding",
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("allows native clients to fetch billing info without CSRF cookies", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/stripe/accounts/current`, {
        headers: {
          "X-Blueprint-Native-Client": "ios",
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        bank_name: "Mercury",
        last4: "6789",
        account_holder_name: "Blueprint Capture",
        stripe_account_id: "acct_mock_contract",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("disconnects connected bank accounts through the mobile compatibility endpoint", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/v1/stripe/accounts/acct_mock_contract`,
        {
          method: "DELETE",
          headers: {
            "X-Blueprint-Native-Client": "ios",
          },
        },
      );

      expect(response.status).toBe(200);
      expect(state.deleteExternalAccount).toHaveBeenCalledWith(
        "acct_mock_contract",
        "ba_123",
      );
    } finally {
      await stopServer(server);
    }
  });
});
