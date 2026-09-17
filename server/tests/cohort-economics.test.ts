// @vitest-environment node
/**
 * The arithmetic that forced the shortlist floor, and the metering that will
 * eventually settle whether the offer works at all.
 *
 * A screening entry is 50 episodes at $0.50, paid by the team. A finalist round
 * is 500 at ours. So every advancing candidate carries ten unpaid episodes for
 * each paid one -- and the shortlist rule advances a close field intact, which
 * is exactly the field screening cannot separate. Three indistinguishable
 * entrants means $75 of revenue against 1,650 executed episodes.
 *
 * None of that is a measurement. The per-episode cost is the unknown, and these
 * tests pin the shape of the answer rather than pretending to know it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
          increment: (n: number) => ({ __increment: n }),
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  breakEvenEpisodeCostUsd,
  cohortContribution,
  projectedBreakEvenEpisodeCostUsd,
} = await import("../utils/cohortEconomics");
const { finalistRoundRuns, shortlistRule } = await import(
  "../../client/src/lib/episodePricing"
);

function cohort(overrides: Record<string, number> = {}) {
  return {
    sceneId: "scene-1",
    paidEntries: 0,
    revenueUsd: 0,
    screeningEpisodes: 0,
    finalistEpisodes: 0,
    finalists: 0,
    siteCostUsd: 0,
    costBreakdown: {},
    firstRecordedIso: "2026-09-17T00:00:00.000Z",
    lastRecordedIso: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("the ceiling the published offer implies", () => {
  it("leaves under five cents an episode at a thin field", () => {
    // Three entrants, three finalists: $75 against 1,650 episodes. This is the
    // number that makes a cold start dangerous -- the least liquid sites are
    // the least profitable ones even when execution is cheap.
    const ceiling = projectedBreakEvenEpisodeCostUsd({ paidEntries: 3, finalists: 3 });

    expect(ceiling).toBeCloseTo(0.0455, 4);
  });

  it("improves with entries and worsens with finalists", () => {
    const fifteenThree = projectedBreakEvenEpisodeCostUsd({ paidEntries: 15, finalists: 3 })!;
    const fifteenFive = projectedBreakEvenEpisodeCostUsd({ paidEntries: 15, finalists: 5 })!;

    expect(fifteenThree).toBeCloseTo(0.1667, 4);
    expect(fifteenFive).toBeCloseTo(0.1154, 4);
    // More entries pay for more of the subsidy; more finalists spend it.
    expect(fifteenThree).toBeGreaterThan(fifteenFive);
  });

  it("has no ceiling to report when nothing has run", () => {
    expect(projectedBreakEvenEpisodeCostUsd({ paidEntries: 0, finalists: 0 })).toBeNull();
    expect(breakEvenEpisodeCostUsd(cohort())).toBeNull();
  });
});

describe("contribution, once somebody supplies a measured cost", () => {
  it("loses money at three entrants and a dime an episode", () => {
    // 3 × 50 + 3 × 500 = 1,650 episodes at $0.10 is $165 against $75.
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 3,
        finalists: 3,
        revenueUsd: 75,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(-90, 2);
  });

  it("leaves a little at fifteen entrants, before the site is prepared", () => {
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 15,
        finalists: 5,
        revenueUsd: 375,
        screeningEpisodes: 750,
        finalistEpisodes: 2_500,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(50, 2);
  });

  it("subtracts the site's own cost, which is where the margin usually goes", () => {
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 15,
        finalists: 5,
        revenueUsd: 375,
        screeningEpisodes: 750,
        finalistEpisodes: 2_500,
        siteCostUsd: 200,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(-150, 2);
  });

  it("reports the ten-to-one ratio that is the thing to watch", () => {
    const result = cohortContribution({
      cohort: cohort({
        revenueUsd: 75,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.05,
      finalistEpisodeCostUsd: 0.05,
    });

    expect(result.unpaidEpisodesPerPaidEpisode).toBe(10);
  });

  it("even five cents loses money on three entrants", () => {
    const result = cohortContribution({
      cohort: cohort({
        revenueUsd: 75,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.05,
      finalistEpisodeCostUsd: 0.05,
    });

    expect(result.contributionUsd).toBeCloseTo(-7.5, 2);
  });
});

describe("a finalist round needs something to separate", () => {
  it("does not run for one surviving candidate", () => {
    // The floor. A finalist round exists to separate candidates; with one
    // there is nothing to separate and 500 episodes of ours to spend on it.
    const verdict = finalistRoundRuns(1);

    expect(verdict.runs).toBe(false);
    expect(verdict.reason).toMatch(/not a comparison/i);
  });

  it("does not run for none", () => {
    expect(finalistRoundRuns(0).runs).toBe(false);
  });

  it("runs from two upward", () => {
    expect(finalistRoundRuns(2).runs).toBe(true);
    expect(finalistRoundRuns(5).runs).toBe(true);
  });

  it("keeps a floor below the cap, or one of them is meaningless", () => {
    expect(shortlistRule.floor).toBeGreaterThan(1);
    expect(shortlistRule.floor).toBeLessThan(shortlistRule.cap);
  });

  it("says in the published rule that a field of one is not a comparison", () => {
    // The floor has to be in the copy a team reads, not only in the code that
    // enforces it.
    expect(shortlistRule.statement).toMatch(/more than one candidate/i);
    expect(shortlistRule.detail).toMatch(/field of one is not a comparison/i);
  });
});
