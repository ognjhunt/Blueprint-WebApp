// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildCityLaunchBudgetPolicy } from "../utils/cityLaunchPolicy";
import { evaluateAgentSpendPolicy } from "../utils/agentSpendPolicy";

describe("agent spend policy", () => {
  it("approves spend inside the city envelope, cap, allowlist, and provenance rules", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Austin, TX",
      amountUsd: 75,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail for launch ops",
      issueId: "BLU-123",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "funded" }),
      founderApprovedBudgetEnvelope: true,
      existingCommittedSpendUsd: 100,
    });

    expect(decision.status).toBe("policy_approved");
    expect(decision.withinPolicy).toBe(true);
    expect(decision.founderApprovalRequired).toBe(false);
  });

  it("denies requests without issue or run provenance", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Austin, TX",
      amountUsd: 75,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail for launch ops",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "funded" }),
      founderApprovedBudgetEnvelope: true,
    });

    expect(decision.status).toBe("denied");
    expect(decision.blockers).toContain("issueId or runId provenance is required");
  });

  it("requires founder approval under a zero-budget city envelope", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Durham, NC",
      amountUsd: 25,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail for launch ops",
      issueId: "BLU-124",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "zero_budget" }),
    });

    expect(decision.status).toBe("requires_founder_approval");
    expect(decision.reasons).toContain("city is operating under a zero-budget envelope");
  });

  it("requires founder approval above the per-transaction operator cap", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Austin, TX",
      amountUsd: 600,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail for launch ops",
      issueId: "BLU-125",
      budgetPolicy: buildCityLaunchBudgetPolicy({
        tier: "low_budget",
        maxTotalApprovedUsd: 2500,
        operatorAutoApproveUsd: 500,
      }),
      founderApprovedBudgetEnvelope: true,
    });

    expect(decision.status).toBe("requires_founder_approval");
    expect(decision.reasons.join(" ")).toContain("exceeds the per-transaction operator cap");
  });

  it("requires evidence refs for outbound spend", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Austin, TX",
      amountUsd: 50,
      category: "outbound",
      vendorName: "SendGrid",
      purpose: "Send city-launch outreach",
      issueId: "BLU-126",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "funded" }),
      founderApprovedBudgetEnvelope: true,
    });

    expect(decision.status).toBe("requires_founder_approval");
    expect(decision.reasons.join(" ")).toContain("requires a rights/access/recipient/proof evidence reference");
  });

  it("denies live Stripe Issuing requests while live money is disabled", () => {
    const decision = evaluateAgentSpendPolicy({
      city: "Austin, TX",
      amountUsd: 50,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Issue live agent card",
      issueId: "BLU-127",
      provider: "stripe_issuing_live",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "funded" }),
      founderApprovedBudgetEnvelope: true,
    });

    expect(decision.status).toBe("denied");
    expect(decision.blockers.join(" ")).toContain("stripe_issuing_live is disabled");
  });
});
