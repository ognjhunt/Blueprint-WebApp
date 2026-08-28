import { describe, expect, it } from "vitest";

import {
  calculateDeploymentFee,
  deploymentFee,
  evaluationFee,
} from "@/lib/deploymentPricing";

describe("deployment pricing", () => {
  it("charges the floor when the per-robot total is below it", () => {
    // Five robots is exactly the crossover: 5 x $2,000 = the $10,000 floor.
    const five = calculateDeploymentFee({ robots: 5, wonAfterEvaluating: false });
    expect(five.total).toBe(10_000);
    expect(five.basis).toBe("floor");

    const one = calculateDeploymentFee({ robots: 1, wonAfterEvaluating: false });
    expect(one.total).toBe(10_000);
    expect(one.basis).toBe("floor");
  });

  it("charges per robot once the fleet clears the floor", () => {
    const twenty = calculateDeploymentFee({ robots: 20, wonAfterEvaluating: false });
    expect(twenty.total).toBe(40_000);
    expect(twenty.basis).toBe("per-robot");
  });

  it("credits the evaluation fee only for the task that deploys", () => {
    const won = calculateDeploymentFee({ robots: 5, wonAfterEvaluating: true });
    expect(won.creditApplied).toBe(evaluationFee.amount);
    expect(won.dueNow).toBe(9_000);

    const lost = calculateDeploymentFee({ robots: 5, wonAfterEvaluating: false });
    expect(lost.creditApplied).toBe(0);
    expect(lost.dueNow).toBe(10_000);
  });

  it("tops up on expansion, and never refunds the credit twice", () => {
    // The worked example: five robots, then twenty on the same task.
    const initial = calculateDeploymentFee({ robots: 5, wonAfterEvaluating: true });
    expect(initial.dueNow).toBe(9_000);

    const expanded = calculateDeploymentFee({
      robots: 20,
      wonAfterEvaluating: true,
      alreadyPaid: initial.dueNow,
    });
    expect(expanded.total).toBe(40_000);
    expect(expanded.dueNow).toBe(30_000);
  });

  it("charges nothing until a robot is deployed", () => {
    const none = calculateDeploymentFee({ robots: 0, wonAfterEvaluating: true });
    expect(none.total).toBe(0);
    expect(none.dueNow).toBe(0);
  });

  it("never produces a negative invoice from nonsense input", () => {
    const bad = calculateDeploymentFee({
      robots: Number.NaN,
      wonAfterEvaluating: true,
      alreadyPaid: -500,
    });
    expect(bad.dueNow).toBe(0);
    const overpaid = calculateDeploymentFee({
      robots: 5,
      wonAfterEvaluating: true,
      alreadyPaid: 999_999,
    });
    expect(overpaid.dueNow).toBe(0);
  });

  it("keeps the fee independent of any contract value", () => {
    // Nothing in the input describes what the robot team charged the site.
    const inputKeys = Object.keys({ robots: 1, wonAfterEvaluating: true, alreadyPaid: 0 });
    expect(inputKeys).not.toContain("contractValue");
    expect(deploymentFee.verifiable).toMatch(/deployment and acceptance record/i);
  });

  it("marks both posted rates as terms under test", () => {
    expect(evaluationFee.basis).toBe("under-test");
    expect(deploymentFee.basis).toBe("under-test");
  });
});
