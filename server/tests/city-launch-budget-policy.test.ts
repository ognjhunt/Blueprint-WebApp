// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildCityLaunchBudgetPolicy } from "../utils/cityLaunchPolicy";

describe("city launch budget policy", () => {
  it("uses tier defaults when CLI callers pass null budget values", () => {
    const lean = buildCityLaunchBudgetPolicy({
      tier: "lean" as never,
      maxTotalApprovedUsd: null,
      operatorAutoApproveUsd: null,
    });
    const standard = buildCityLaunchBudgetPolicy({
      tier: "standard" as never,
      maxTotalApprovedUsd: null,
      operatorAutoApproveUsd: null,
    });
    const aggressive = buildCityLaunchBudgetPolicy({
      tier: "aggressive" as never,
      maxTotalApprovedUsd: null,
      operatorAutoApproveUsd: null,
    });

    expect(lean).toMatchObject({
      maxTotalApprovedUsd: 2_500,
      operatorAutoApproveUsd: 500,
    });
    expect(standard).toMatchObject({
      maxTotalApprovedUsd: 10_000,
      operatorAutoApproveUsd: 1_000,
    });
    expect(aggressive).toMatchObject({
      maxTotalApprovedUsd: 25_000,
      operatorAutoApproveUsd: 2_500,
    });
  });

  it("accepts founder-facing lean, standard, and aggressive budget tiers", () => {
    const lean = buildCityLaunchBudgetPolicy({
      tier: "lean" as never,
      maxTotalApprovedUsd: 1_500,
    });
    const standard = buildCityLaunchBudgetPolicy({
      tier: "standard" as never,
      maxTotalApprovedUsd: 7_500,
    });
    const aggressive = buildCityLaunchBudgetPolicy({
      tier: "aggressive" as never,
      maxTotalApprovedUsd: 25_000,
    });

    expect(lean).toMatchObject({
      tier: "lean",
      label: "Lean",
      maxTotalApprovedUsd: 1_500,
      allowPaidAcquisition: true,
    });
    expect(standard).toMatchObject({
      tier: "standard",
      label: "Standard",
      maxTotalApprovedUsd: 7_500,
      allowPaidAcquisition: true,
      allowReferralRewards: true,
    });
    expect(aggressive).toMatchObject({
      tier: "aggressive",
      label: "Aggressive",
      maxTotalApprovedUsd: 25_000,
      allowPaidAcquisition: true,
      allowReferralRewards: true,
      allowTravelReimbursement: true,
    });
  });

  it("treats budget max USD as a hard ceiling", () => {
    const policy = buildCityLaunchBudgetPolicy({
      tier: "standard" as never,
      maxTotalApprovedUsd: 300,
      operatorAutoApproveUsd: 800,
    });

    expect(policy.maxTotalApprovedUsd).toBe(300);
    expect(policy.operatorAutoApproveUsd).toBe(300);
    expect(policy.founderApprovalRequiredAboveUsd).toBe(300);
  });
});
