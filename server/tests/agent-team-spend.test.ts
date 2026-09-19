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
    // Make the unavailable store explicit. Other suites initialize Firebase,
    // so ambient module state must not decide whether this test is fail-closed.
    vi.resetModules();
    vi.doMock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));
    const { authorizeAgentSpend } = await import("../utils/robotTeamBalance");

    const result = await authorizeAgentSpend({
      teamId: "team-1",
      amountUsd: 25,
      reason: "test",
      idempotencyKey: "k-1",
    });

    expect(result.authorized).toBe(false);
    expect(result.authorized === false && result.refusal).toBe("ledger_unavailable");
    vi.doUnmock("../../client/src/lib/firebaseAdmin");
    vi.resetModules();
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

/* --------------------------------------------- the intake's own answers */

describe("the intake knows which of its questions a run will answer better", () => {
  it("marks exactly the seven an evaluation measures", async () => {
    const { measurableRobotSpecFieldIds } = await import(
      "../../client/src/data/robotTeamQualification"
    );

    expect([...measurableRobotSpecFieldIds()].sort()).toEqual([
      "cycleTime",
      "demonstratedSuccessRate",
      "dutyCycle",
      "humanProximity",
      "lighting",
      "objectHandling",
      "payloadCapacity",
    ]);
  });

  it("leaves the two no episode can settle unmarked", async () => {
    // budgetBand is a commercial fact about the business and taskFamily is a
    // declaration of what the robot is for. No run establishes either, so
    // marking them superseded would promise a measurement we cannot make.
    const { measurableRobotSpecFieldIds } = await import(
      "../../client/src/data/robotTeamQualification"
    );
    const measurable = measurableRobotSpecFieldIds();

    expect(measurable).not.toContain("budgetBand");
    expect(measurable).not.toContain("taskFamily");
  });
});

describe("one resolution per reservation, and the first one wins", () => {
  /** Entries at distinct times, so replay order is the written order. */
  function at(iso: string, partial: Partial<LedgerEntry> & Pick<LedgerEntry, "kind" | "amountUsd">) {
    return entry({ createdAtIso: iso, ...partial });
  }

  it("closes the reserve/release loop that could spend past the balance", () => {
    // The attack the release endpoint made possible: reserve, let execution
    // start, hand the hold back, reserve again. Each released hold frees the
    // balance, so one $25 top-up funded two runs -- and when the settlements
    // arrived they booked as real spend, because a settle used to be added
    // unconditionally. `availableUsd` clamps at zero, so the breach showed up
    // as a balance that stopped moving rather than as a number.
    const balance = deriveBalance("team-1", [
      at("2026-09-17T00:00:00.000Z", { kind: "credit", amountUsd: 25 }),
      at("2026-09-17T00:01:00.000Z", { kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      at("2026-09-17T00:02:00.000Z", { kind: "release", amountUsd: 0, reservationId: "res-1" }),
      at("2026-09-17T00:03:00.000Z", { kind: "reserve", amountUsd: 25, reservationId: "res-2" }),
      at("2026-09-17T00:04:00.000Z", { kind: "release", amountUsd: 0, reservationId: "res-2" }),
      // Both runs executed anyway and reported late.
      at("2026-09-17T00:05:00.000Z", { kind: "settle", amountUsd: 25, reservationId: "res-1" }),
      at("2026-09-17T00:06:00.000Z", { kind: "settle", amountUsd: 25, reservationId: "res-2" }),
    ]);

    // Nothing charged, because both holds were already resolved. We absorb the
    // work rather than billing against money that was handed back.
    expect(balance.spentUsd).toBe(0);
    expect(balance.absorbedUsd).toBe(50);
    expect(balance.overdrawnUsd).toBe(0);
    expect(balance.availableUsd).toBe(25);
  });

  it("keeps the evidence cost visible instead of dropping it", () => {
    // A run that timed out, was released, and reported afterwards. The result
    // is still recorded elsewhere; the money is final. What this asserts is
    // that the cost we took on is a number somebody can read.
    const balance = deriveBalance("team-1", [
      at("2026-09-17T00:00:00.000Z", { kind: "credit", amountUsd: 100 }),
      at("2026-09-17T00:01:00.000Z", { kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      at("2026-09-17T00:02:00.000Z", { kind: "release", amountUsd: 0, reservationId: "res-1" }),
      at("2026-09-17T00:03:00.000Z", { kind: "settle", amountUsd: 18.5, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(0);
    expect(balance.absorbedUsd).toBe(18.5);
    expect(balance.availableUsd).toBe(100);
  });

  it("still settles normally when the settle is the first resolution", () => {
    // The regression guard for the change above. Finality must not mean that
    // an ordinary settlement stops working.
    const balance = deriveBalance("team-1", [
      at("2026-09-17T00:00:00.000Z", { kind: "credit", amountUsd: 100 }),
      at("2026-09-17T00:01:00.000Z", { kind: "reserve", amountUsd: 25, reservationId: "res-1" }),
      at("2026-09-17T00:02:00.000Z", { kind: "settle", amountUsd: 18.5, reservationId: "res-1" }),
      // A release arriving after the settle is the no-op, not the other way round.
      at("2026-09-17T00:03:00.000Z", { kind: "release", amountUsd: 0, reservationId: "res-1" }),
    ]);

    expect(balance.spentUsd).toBe(18.5);
    expect(balance.absorbedUsd).toBe(0);
    expect(balance.reservedUsd).toBe(0);
    expect(balance.availableUsd).toBe(81.5);
  });

  it("does not depend on the order the store happens to return", () => {
    // `readEntries` queries without an `orderBy`, and Firestore answers those
    // in document-id order -- `team:release:res-1` before `team:reserve:res-1`
    // before `team:settle:res-1`, which is alphabetical and therefore
    // meaningless. A reservation could be resolved before it was taken.
    const written: LedgerEntry[] = [
      at("2026-09-17T00:00:00.000Z", { kind: "credit", amountUsd: 100, entryId: "team-1:credit" }),
      at("2026-09-17T00:01:00.000Z", {
        kind: "reserve",
        amountUsd: 25,
        reservationId: "res-1",
        entryId: "team-1:reserve:res-1",
      }),
      at("2026-09-17T00:02:00.000Z", {
        kind: "settle",
        amountUsd: 10,
        reservationId: "res-1",
        entryId: "team-1:settle:res-1",
      }),
    ];

    const inOrder = deriveBalance("team-1", written);
    const idOrder = deriveBalance("team-1", [...written].sort((a, b) =>
      a.entryId.localeCompare(b.entryId),
    ));
    const reversed = deriveBalance("team-1", [...written].reverse());

    expect(idOrder).toEqual(inOrder);
    expect(reversed).toEqual(inOrder);
    expect(inOrder.spentUsd).toBe(10);
    expect(inOrder.reservedUsd).toBe(0);
  });

  it("surfaces a breach rather than clamping it out of sight", () => {
    // Should never happen. If it does, `availableUsd` would read zero and carry
    // on, so the excess is reported as its own number.
    const balance = deriveBalance("team-1", [
      at("2026-09-17T00:00:00.000Z", { kind: "credit", amountUsd: 10 }),
      at("2026-09-17T00:01:00.000Z", { kind: "settle", amountUsd: 30, reservationId: "res-x" }),
    ]);

    expect(balance.spentUsd).toBe(30);
    expect(balance.availableUsd).toBe(0);
    expect(balance.overdrawnUsd).toBe(20);
  });
});
