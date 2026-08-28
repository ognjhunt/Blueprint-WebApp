import { describe, expect, it } from "vitest";

import { calculateTeamCost, deploymentFee, evaluationFee } from "@/lib/deploymentPricing";

describe("deployment pricing", () => {
  it("charges $1,000 to a team that evaluates and does not win", () => {
    const cost = calculateTeamCost({ evaluated: 1, won: 0 });
    expect(cost.total).toBe(1_000);
    expect(cost.selectionTopUp).toBe(0);
  });

  it("charges $10,000 in total to a team that wins the task it evaluated", () => {
    const cost = calculateTeamCost({ evaluated: 1, won: 1 });
    expect(cost.total).toBe(deploymentFee.total);
    // The evaluation fee is part of the $10,000, not on top of it.
    expect(cost.evaluations).toBe(evaluationFee.amount);
    expect(cost.selectionTopUp).toBe(9_000);
  });

  it("prices the worked example: three evaluations, one win", () => {
    const cost = calculateTeamCost({ evaluated: 3, won: 1 });
    expect(cost.evaluations).toBe(3_000);
    expect(cost.selectionTopUp).toBe(9_000);
    expect(cost.total).toBe(12_000);
  });

  it("cannot bill more wins than evaluations", () => {
    const cost = calculateTeamCost({ evaluated: 2, won: 5 });
    expect(cost.total).toBe(calculateTeamCost({ evaluated: 2, won: 2 }).total);
  });

  it("charges nothing for evaluating nothing", () => {
    expect(calculateTeamCost({ evaluated: 0, won: 0 }).total).toBe(0);
    expect(calculateTeamCost({ evaluated: 0, won: 3 }).total).toBe(0);
  });

  it("never produces a negative invoice from nonsense input", () => {
    expect(calculateTeamCost({ evaluated: Number.NaN, won: -4 }).total).toBe(0);
    expect(calculateTeamCost({ evaluated: -10, won: -1 }).total).toBe(0);
  });

  it("takes no contract value and no robot count as an input", () => {
    // The signature is the guard: nothing here can depend on a number only one
    // party can see, and nothing scales after the deal is done.
    const cost = calculateTeamCost({ evaluated: 1, won: 1 });
    expect(Object.keys(cost).sort()).toEqual(["evaluations", "selectionTopUp", "total"]);
    expect(deploymentFee.noExtras).toMatch(/no per-robot rate/i);
    expect(deploymentFee.noExtras).toMatch(/costs nothing further/i);
  });

  it("marks both posted numbers as terms under test", () => {
    expect(evaluationFee.basis).toBe("under-test");
    expect(deploymentFee.basis).toBe("under-test");
  });
});
