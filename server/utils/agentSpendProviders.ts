import {
  normalizeAgentSpendProvider,
  type AgentSpendProvider,
  type AgentSpendStatus,
} from "./agentSpendPolicy";

export type AgentSpendProviderRequestInput = {
  spendRequestId: string;
  provider: AgentSpendProvider | string | null | undefined;
  amountUsd: number;
  currency: string;
  vendorName: string;
  purpose: string;
  requestedAtIso: string;
};

export type AgentSpendProviderRequestResult = {
  provider: AgentSpendProvider;
  status: Extract<AgentSpendStatus, "policy_approved" | "provider_requested" | "denied">;
  providerRequestId: string | null;
  providerMode: "ledger_only" | "test" | "sandbox" | "live_disabled";
  rawCredentialDelivered: false;
  notes: string[];
};

function enabled(value: string | undefined) {
  return value === "1" || value === "true";
}

function testProviderRequestId(prefix: string, spendRequestId: string, requestedAtIso: string) {
  const timestamp = requestedAtIso.replace(/[^0-9]/g, "").slice(0, 14) || "pending";
  return `${prefix}_${spendRequestId}_${timestamp}`;
}

export function requestAgentSpendProvider(
  input: AgentSpendProviderRequestInput,
): AgentSpendProviderRequestResult {
  const provider = normalizeAgentSpendProvider(input.provider);

  if (provider === "manual") {
    return {
      provider,
      status: "policy_approved",
      providerRequestId: null,
      providerMode: "ledger_only",
      rawCredentialDelivered: false,
      notes: [
        "manual provider is ledger-only; no payment credential was requested or issued",
      ],
    };
  }

  if (provider === "link_cli_test") {
    if (!enabled(process.env.AGENT_SPEND_LINK_CLI_TEST_ENABLED)) {
      return {
        provider,
        status: "policy_approved",
        providerRequestId: null,
        providerMode: "test",
        rawCredentialDelivered: false,
        notes: [
          "link_cli_test adapter is installed but disabled; set AGENT_SPEND_LINK_CLI_TEST_ENABLED=1 to record test provider requests",
          "no raw card credential was requested or issued",
        ],
      };
    }
    return {
      provider,
      status: "provider_requested",
      providerRequestId: testProviderRequestId("link_test", input.spendRequestId, input.requestedAtIso),
      providerMode: "test",
      rawCredentialDelivered: false,
      notes: [
        "recorded a Link test-mode provider request placeholder",
        "no raw card credential was requested or issued",
      ],
    };
  }

  if (provider === "stripe_issuing_sandbox") {
    if (!enabled(process.env.AGENT_SPEND_STRIPE_ISSUING_SANDBOX_ENABLED)) {
      return {
        provider,
        status: "policy_approved",
        providerRequestId: null,
        providerMode: "sandbox",
        rawCredentialDelivered: false,
        notes: [
          "stripe_issuing_sandbox adapter is installed but disabled; set AGENT_SPEND_STRIPE_ISSUING_SANDBOX_ENABLED=1 after sandbox access is verified",
          "no raw card credential was requested or issued",
        ],
      };
    }
    return {
      provider,
      status: "provider_requested",
      providerRequestId: testProviderRequestId("stripe_issuing_sandbox", input.spendRequestId, input.requestedAtIso),
      providerMode: "sandbox",
      rawCredentialDelivered: false,
      notes: [
        "recorded a Stripe Issuing sandbox provider request placeholder",
        "no raw card credential was requested or issued",
      ],
    };
  }

  return {
    provider,
    status: "denied",
    providerRequestId: null,
    providerMode: "live_disabled",
    rawCredentialDelivered: false,
    notes: [
      "stripe_issuing_live is fail-closed in this repo until Stripe access, webhooks, sandbox tests, and kill switches are verified",
      "live autonomous spend remains disabled",
    ],
  };
}
