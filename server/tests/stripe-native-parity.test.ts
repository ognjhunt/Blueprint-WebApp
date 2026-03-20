// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
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
  STRIPE_ONBOARDING_REFRESH_URL: "https://tryblueprint.io/refresh",
  STRIPE_ONBOARDING_RETURN_URL: "https://tryblueprint.io/return",
  getStripeConnectAccountId: () => "acct_live_blueprint",
  stripeConnectAccountConfigured: true,
  stripeClient: {
    accounts: {
      retrieve: vi.fn().mockResolvedValue({
        details_submitted: true,
        payouts_enabled: true,
        settings: { payouts: { schedule: { interval: "manual" } } },
        requirements: { currently_due: [] },
      }),
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
        stripe_account_id: "acct_live_blueprint",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("disconnects connected bank accounts through the mobile compatibility endpoint", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/v1/stripe/accounts/acct_live_blueprint`,
        {
          method: "DELETE",
          headers: {
            "X-Blueprint-Native-Client": "ios",
          },
        },
      );

      expect(response.status).toBe(200);
      expect(state.deleteExternalAccount).toHaveBeenCalledWith(
        "acct_live_blueprint",
        "ba_123",
      );
    } finally {
      await stopServer(server);
    }
  });
});
