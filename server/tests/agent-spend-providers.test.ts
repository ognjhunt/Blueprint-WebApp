// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { requestAgentSpendProvider } from "../utils/agentSpendProviders";

const baseRequest = {
  spendRequestId: "spend-1",
  amountUsd: 25,
  currency: "USD",
  vendorName: "Stripe",
  purpose: "Test payment rail",
  requestedAtIso: "2026-04-30T12:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("agent spend providers", () => {
  it("keeps manual spend ledger-only", () => {
    const result = requestAgentSpendProvider({
      ...baseRequest,
      provider: "manual",
    });

    expect(result.status).toBe("policy_approved");
    expect(result.providerRequestId).toBeNull();
    expect(result.rawCredentialDelivered).toBe(false);
    expect(result.providerMode).toBe("ledger_only");
  });

  it("records Link test provider requests only when explicitly enabled", () => {
    const disabled = requestAgentSpendProvider({
      ...baseRequest,
      provider: "link_cli_test",
    });
    expect(disabled.status).toBe("policy_approved");
    expect(disabled.providerRequestId).toBeNull();

    vi.stubEnv("AGENT_SPEND_LINK_CLI_TEST_ENABLED", "1");
    const enabled = requestAgentSpendProvider({
      ...baseRequest,
      provider: "link_cli_test",
    });
    expect(enabled.status).toBe("provider_requested");
    expect(enabled.providerRequestId).toContain("link_test_spend-1");
    expect(enabled.rawCredentialDelivered).toBe(false);
  });

  it("fails closed for live Stripe Issuing", () => {
    vi.stubEnv("AGENT_SPEND_LIVE_ENABLED", "1");
    const result = requestAgentSpendProvider({
      ...baseRequest,
      provider: "stripe_issuing_live",
    });

    expect(result.status).toBe("denied");
    expect(result.providerMode).toBe("live_disabled");
    expect(result.rawCredentialDelivered).toBe(false);
  });
});
