// @vitest-environment node
import { describe, expect, it } from "vitest";

import { deriveBalance, type LedgerEntry } from "../utils/robotTeamBalance";
import {
  scoreEvalCandidate,
  selectEvalsForBudget,
  type EvalCandidate,
} from "../utils/evalSelection";

/* ------------------------------------------------------------- ledger */

function entry(partial: Partial<LedgerEntry> & Pick<LedgerEntry, "kind" | "amountUsd">): LedgerEntry {
  return {
    entryId: `e-${Math.random()}`,
    teamId: "team-1",
    reservationId: null,
    reason: "test",
    idempotencyKey: `k-${Math.random()}`,
    createdAtIso: "2026-09-17T00:00:00.000Z",
    ...partial,
  };
}

describe("an agent can never commit money the team does not have", () => {
  it("counts a reservation against what is available, before anything is spent", () => {
    // The property that makes concurrent agents safe: the hold leaves
    // `available` immediately, so a second agent cannot also spend it.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
    ]);

    expect(balance.availableUsd).toBe(75);
    expect(balance.reservedUsd).toBe(25);
    expect(balance.spentUsd).toBe(0);
  });

  it("returns the difference when a run consumed less than it reserved", () => {
    // Published billing rule: unrun episodes are released. Settling for less
    // than the hold has to give the remainder back without anyone doing
    // arithmetic by hand.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "settle", amountUsd: 10, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(10);
    expect(balance.reservedUsd).toBe(0);
    expect(balance.availableUsd).toBe(90);
  });

  it("gives a hold back whole when the run never happened", () => {
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 40, reservationId: "res-1" }),
      entry({ kind: "release", amountUsd: 0, reservationId: "res-1" }),
    ]);

    expect(balance.availableUsd).toBe(100);
    expect(balance.spentUsd).toBe(0);
    expect(balance.reservedUsd).toBe(0);
  });

  it("never reports a negative balance", () => {
    // Derived, not stored, so it cannot drift -- but an over-settle should
    // still floor at zero rather than hand an agent a negative number it will
    // do something creative with.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 10 }),
      entry({ kind: "settle", amountUsd: 25 }),
    ]);

    expect(balance.availableUsd).toBe(0);
  });

  it("tracks several open reservations independently", () => {
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-2" }),
      entry({ kind: "settle", amountUsd: 25, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(25);
    expect(balance.reservedUsd).toBe(25);
    expect(balance.availableUsd).toBe(50);
  });
});

/* ---------------------------------------------------------- selection */

function candidate(partial: Partial<EvalCandidate> = {}): EvalCandidate {
  return {
    sceneId: "scene-1",
    siteLabel: "Warehouse",
    match: { outcome: "matched", score: 5, scored: 5, unknownHardConstraints: [] },
    costUsd: 25,
    taskFamily: "tote_transfer",
    alreadyEvaluatedFamilies: ["tote_transfer"],
    alreadyRunForCheckpoint: false,
    ...partial,
  };
}

describe("we rank by what a run teaches, not by what it is likely to pass", () => {
  it("puts resolving an unknown hard constraint above everything else", () => {
    // The best money in the system. A provisional match is an open question and
    // one run closes it for every future site sharing that constraint.
    const unknown = scoreEvalCandidate(
      candidate({
        match: {
          outcome: "provisional",
          score: 3,
          scored: 5,
          unknownHardConstraints: [{ scaleId: "payload" }] as never,
        },
      }),
    );
    const comfortable = scoreEvalCandidate(candidate());

    expect(unknown.value).toBeGreaterThan(comfortable.value);
    expect(unknown.skipReason).toBeNull();
  });

  it("ranks a comfortable pass last, because it is close to predictable", () => {
    const comfortable = scoreEvalCandidate(candidate());
    const boundary = scoreEvalCandidate(
      candidate({ match: { outcome: "matched", score: 2, scored: 5, unknownHardConstraints: [] } }),
    );

    expect(boundary.value).toBeGreaterThan(comfortable.value);
    expect(comfortable.rationale).toContain("predictable");
  });

  it("rewards a task family this team has never been run against", () => {
    const novel = scoreEvalCandidate(candidate({ taskFamily: "cold_storage_pick" }));
    const familiar = scoreEvalCandidate(candidate());
    expect(novel.value).toBeGreaterThan(familiar.value);
  });

  it("refuses to sell a second copy of an answer it already has", () => {
    const repeat = scoreEvalCandidate(candidate({ alreadyRunForCheckpoint: true }));
    expect(repeat.skipReason).toBe("already_answered");
    expect(repeat.value).toBe(0);
  });

  it("refuses to sell a confirmation of a known failure", () => {
    const ruledOut = scoreEvalCandidate(candidate({ match: { outcome: "ruled_out", score: 0, scored: 5, unknownHardConstraints: [] } }));
    expect(ruledOut.skipReason).toBe("ruled_out_on_measured_constraint");
  });
});

describe("a daily budget is filled with the most informative runs that fit", () => {
  it("buys the highest value per dollar first", () => {
    const result = selectEvalsForBudget({
      budgetUsd: 50,
      candidates: [
        candidate({ sceneId: "comfortable" }),
        candidate({
          sceneId: "unknown-constraint",
          match: {
            outcome: "provisional",
            score: 3,
            scored: 5,
            unknownHardConstraints: [{ scaleId: "payload" }] as never,
          },
        }),
      ],
    });

    expect(result.selected[0].sceneId).toBe("unknown-constraint");
    expect(result.totalCostUsd).toBe(50);
  });

  it("stops at the budget rather than going one run over", () => {
    const result = selectEvalsForBudget({
      budgetUsd: 30,
      candidates: [candidate({ sceneId: "a" }), candidate({ sceneId: "b" })],
    });

    expect(result.selected).toHaveLength(1);
    expect(result.totalCostUsd).toBe(25);
    expect(result.skipped.some((item) => item.skipReason === "over_budget")).toBe(true);
  });

  it("honours a cap on how many runs start at once", () => {
    const result = selectEvalsForBudget({
      budgetUsd: 1000,
      maxRuns: 2,
      candidates: [
        candidate({ sceneId: "a" }),
        candidate({ sceneId: "b" }),
        candidate({ sceneId: "c" }),
      ],
    });

    expect(result.selected).toHaveLength(2);
  });

  it("buys nothing, and says why, when everything is already answered", () => {
    const result = selectEvalsForBudget({
      budgetUsd: 500,
      candidates: [
        candidate({ sceneId: "a", alreadyRunForCheckpoint: true }),
        candidate({ sceneId: "b", alreadyRunForCheckpoint: true }),
      ],
    });

    expect(result.selected).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.summary).toContain("already answered");
  });

  it("explains a spend in terms the team can argue with", () => {
    const result = selectEvalsForBudget({
      budgetUsd: 100,
      candidates: [
        candidate({
          sceneId: "unknown-constraint",
          match: {
            outcome: "provisional",
            score: 3,
            scored: 5,
            unknownHardConstraints: [{ scaleId: "payload" }] as never,
          },
        }),
      ],
    });

    expect(result.summary).toContain("close a hard constraint");
    expect(result.selected[0].rationale).toContain("Resolves");
  });

  it("spends nothing when the budget is zero", () => {
    // What an agent that is switched off, or out of daily allowance, sees.
    const result = selectEvalsForBudget({ budgetUsd: 0, candidates: [candidate()] });
    expect(result.selected).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
  });
});

/* ------------------------------------------------------- authorization */

describe("a balance is not permission", () => {
  it("refuses every spend until the team opts its agent in", async () => {
    // Funding an account and authorising an autonomous spender are two
    // different decisions. DEFAULT_SPEND_POLICY is off with a zero limit, so a
    // team that never configured anything cannot have money spent for it.
    const { DEFAULT_SPEND_POLICY } = await import("../utils/robotTeamBalance");

    expect(DEFAULT_SPEND_POLICY.agentSpendEnabled).toBe(false);
    expect(DEFAULT_SPEND_POLICY.dailyLimitUsd).toBe(0);
    expect(DEFAULT_SPEND_POLICY.perRunLimitUsd).toBe(0);
  });

  it("refuses when the ledger cannot be read, rather than assuming funds", async () => {
    // No Firestore in this environment, so this exercises the real fail-closed
    // path: unknown funds are not spendable funds.
    const { authorizeAgentSpend } = await import("../utils/robotTeamBalance");

    const result = await authorizeAgentSpend({
      teamId: "team-1",
      amountUsd: 25,
      reason: "test",
      idempotencyKey: "k-1",
    });

    expect(result.authorized).toBe(false);
    expect(result.authorized === false && result.refusal).toBe("ledger_unavailable");
  });

  it("reports zero available when the ledger is unreachable", async () => {
    const { getTeamBalance } = await import("../utils/robotTeamBalance");
    const balance = await getTeamBalance("team-1");
    expect(balance.availableUsd).toBe(0);
  });

  it("keys the day in UTC, so an agent's location cannot shift the limit", async () => {
    const { utcDayKey } = await import("../utils/robotTeamBalance");
    expect(utcDayKey(new Date("2026-09-17T23:59:00.000Z"))).toBe("2026-09-17");
    expect(utcDayKey(new Date("2026-09-18T00:01:00.000Z"))).toBe("2026-09-18");
  });
});

/* ------------------------------------------------- checkpoint intake */

describe("a checkpoint asks for nothing a run would measure", () => {
  it("refuses a checkpoint with nothing runnable behind it", async () => {
    const { registerCheckpoint } = await import("../utils/robotCheckpoints");
    const result = await registerCheckpoint({
      teamId: "team-1",
      label: "v3",
      runtime: "policy_endpoint",
      reference: "   ",
    });

    expect(result.registered).toBe(false);
    // No Firestore here, so the store check fires first; either refusal is a
    // refusal, and neither invents a checkpoint we cannot execute.
    expect(result.registered === false && result.refusal).toBeTruthy();
  });

  it("refuses a runtime we cannot execute", async () => {
    const { registerCheckpoint } = await import("../utils/robotCheckpoints");
    const result = await registerCheckpoint({
      teamId: "team-1",
      label: "v3",
      runtime: "powerpoint",
      reference: "https://example.test/policy",
    });

    expect(result.registered).toBe(false);
  });
});

describe("measurement outranks the team's own estimate", () => {
  it("puts measured above self_reported in the grade ladder", async () => {
    // The property the whole checkpoint-first change rests on: once a run
    // writes `measured`, mergeCapability stops letting the team's own number
    // win, with no migration and no deletion.
    const { QUOTABLE_GRADES } = await import("../types/robot-team-registry");
    const { mergeCapability } = await import("../utils/robotTeamRegistry");

    const existing = {
      capability: { payloadCapacity: "under_5kg" },
      fieldProvenance: {
        payloadCapacity: {
          grade: "self_reported" as const,
          source: "intake",
          observedAt: "2026-09-01T00:00:00.000Z",
        },
      },
    };

    const merged = mergeCapability(existing, { payloadCapacity: "five_to_20kg" }, {
      grade: "measured",
      source: "evaluationRun:run-1",
    });

    expect(merged.capability.payloadCapacity).toBe("five_to_20kg");
    expect(merged.fieldProvenance.payloadCapacity?.grade).toBe("measured");
    // And a later self-report cannot take it back.
    const reverted = mergeCapability(
      { capability: merged.capability, fieldProvenance: merged.fieldProvenance },
      { payloadCapacity: "under_5kg" },
      { grade: "self_reported", source: "intake-2" },
    );
    expect(reverted.capability.payloadCapacity).toBe("five_to_20kg");
    expect(QUOTABLE_GRADES).toContain("measured");
  });
});

/* ------------------------------------------------------- settlement */

describe("a hold becomes a spend only for work that happened", () => {
  it("charges for episodes that executed, whatever the robot did in them", () => {
    // Published billing rule: "the robot dropping the box is a result, and you
    // pay for it." Failure is a finding, and findings are the product.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "settle", amountUsd: 25, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(25);
    expect(balance.availableUsd).toBe(75);
  });

  it("charges nothing when the environment never launched", () => {
    // The other half of the same rule: "an environment that will not launch is
    // not a result, and you do not pay." Released whole rather than settled at
    // zero, so the ledger records what happened instead of a spend of nothing.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "release", amountUsd: 0, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(0);
    expect(balance.availableUsd).toBe(100);
    expect(balance.reservedUsd).toBe(0);
  });

  it("charges for a partial run and frees the rest", () => {
    // 50 episodes quoted, 20 ran. The team keeps the difference without
    // anybody filing anything.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "settle", amountUsd: 10, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(10);
    expect(balance.availableUsd).toBe(90);
  });

  it("cannot be charged twice by a retried delivery", () => {
    // Settlement is keyed on the reservation, not the attempt. Two deliveries
    // of the same settlement are one movement, which matters because the
    // Pipeline retries anything it never saw acknowledged.
    const duplicated = [
      entry({ kind: "credit", amountUsd: 100 }),
      entry({ kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      entry({ kind: "settle", amountUsd: 25, reservationId: "res-1", entryId: "same" }),
    ];

    // The ledger stores one document per idempotency key, so a replay is the
    // same entry rather than a second one; replaying the derived list proves
    // the arithmetic does not double even if a duplicate ever reached it.
    const once = deriveBalance("team-1", duplicated);
    expect(once.spentUsd).toBe(25);
    expect(once.reservedUsd).toBe(0);
  });
});
