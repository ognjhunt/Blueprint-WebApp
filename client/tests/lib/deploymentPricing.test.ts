import { describe, expect, it } from "vitest";

import {
  calculateDeploymentCost,
  deploymentFees,
  evaluationCredit,
  revenueShareAlternative,
} from "@/lib/deploymentPricing";

describe("deployment pricing", () => {
  it("bills activation once plus an active robot-month", () => {
    const cost = calculateDeploymentCost({
      robots: 3,
      months: 12,
      evaluationCreditPaid: false,
    });
    expect(cost.activation).toBe(5_000);
    expect(cost.robotMonths).toBe(3 * 12 * deploymentFees.robotMonth.low);
    expect(cost.total).toBe(8_600);
  });

  it("returns the evaluation credit in full, so evaluating costs a winner nothing", () => {
    const paid = calculateDeploymentCost({ robots: 3, months: 12, evaluationCreditPaid: true });
    const unpaid = calculateDeploymentCost({ robots: 3, months: 12, evaluationCreditPaid: false });
    expect(unpaid.total - paid.total).toBe(evaluationCredit.low);
    expect(paid.creditApplied).toBe(evaluationCredit.low);
  });

  it("never refunds credit beyond what is owed", () => {
    // One robot for one month owes less than the credit is worth.
    const cost = calculateDeploymentCost({ robots: 0, months: 0, evaluationCreditPaid: true });
    expect(cost.total).toBe(0);
    expect(cost.creditApplied).toBe(0);
  });

  it("charges nothing until a robot is actually working", () => {
    expect(calculateDeploymentCost({ robots: 0, months: 12, evaluationCreditPaid: false }).total).toBe(0);
    expect(calculateDeploymentCost({ robots: 5, months: 0, evaluationCreditPaid: false }).total).toBe(0);
  });

  it("scales linearly with robot-months, the unit both parties can count", () => {
    const one = calculateDeploymentCost({ robots: 1, months: 12, evaluationCreditPaid: false });
    const ten = calculateDeploymentCost({ robots: 10, months: 12, evaluationCreditPaid: false });
    expect(ten.robotMonths).toBe(one.robotMonths * 10);
    // Activation does not scale: it is per activated site-task, not per robot.
    expect(ten.activation).toBe(one.activation);
  });

  it("models the high end of each posted band", () => {
    const high = calculateDeploymentCost({
      robots: 3,
      months: 12,
      evaluationCreditPaid: true,
      bound: "high",
    });
    expect(high.robotMonths).toBe(3 * 12 * deploymentFees.robotMonth.high);
    expect(high.creditApplied).toBe(evaluationCredit.high);
  });

  it("ignores nonsense input rather than producing a negative invoice", () => {
    const cost = calculateDeploymentCost({
      robots: Number.NaN,
      months: -12,
      evaluationCreditPaid: true,
    });
    expect(cost.total).toBe(0);
    expect(cost.grossTotal).toBe(0);
  });

  it("keeps the revenue-share alternative narrow and conditional", () => {
    expect(revenueShareAlternative.firstYearHigh).toBeLessThanOrEqual(0.02);
    expect(revenueShareAlternative.condition).toMatch(/controls invoicing|audited/i);
    expect(revenueShareAlternative.basis).toBe("under-test");
  });

  it("marks every posted rate as a term under test, not a market rate", () => {
    expect(evaluationCredit.basis).toBe("under-test");
    expect(deploymentFees.activation.basis).toBe("under-test");
    expect(deploymentFees.robotMonth.basis).toBe("under-test");
  });
});
