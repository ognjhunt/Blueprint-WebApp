import { describe, expect, it } from "vitest";

import {
  calculateDeploymentNetworkFee,
  calculateRenewalNetworkFee,
} from "@/lib/deploymentNetworkPricing";

describe("deployment network pricing", () => {
  it("charges five percent through the first million collected", () => {
    expect(calculateDeploymentNetworkFee(100_000)).toMatchObject({
      fee: 5_000,
      effectiveRate: 0.05,
    });
    expect(calculateDeploymentNetworkFee(1_000_000).fee).toBe(50_000);
  });

  it("applies automatic marginal volume discounts", () => {
    expect(calculateDeploymentNetworkFee(10_000_000)).toMatchObject({
      fee: 320_000,
      effectiveRate: 0.032,
    });
    expect(calculateDeploymentNetworkFee(100_000_000)).toMatchObject({
      fee: 1_670_000,
      effectiveRate: 0.0167,
    });
  });

  it("charges renewals at one and a half percent", () => {
    expect(calculateRenewalNetworkFee(1_000_000)).toBe(15_000);
  });

  it("never produces a negative or non-finite fee", () => {
    expect(calculateDeploymentNetworkFee(-10).fee).toBe(0);
    expect(calculateDeploymentNetworkFee(Number.NaN).fee).toBe(0);
  });
});
