// @vitest-environment node
/**
 * The arithmetic that forced the shortlist floor, and the metering that will
 * eventually settle whether the offer works at all.
 *
 * An entry is $99 flat, paid by the team. It is screened at 50 episodes and, if
 * it advances, runs 500 more at our cost -- and the shortlist rule advances a
 * close field intact, which is exactly the field screening cannot separate. So
 * three indistinguishable entrants means $297 of revenue against 1,650 executed
 * episodes, and the entry price no longer moves when that number does.
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
  "../../client/src/lib/evaluationPricing"
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
  it("leaves eighteen cents an episode at a thin field", () => {
    // Three entrants, three finalists: $297 against 1,650 episodes. The flat
    // entry price bought real headroom over the 4.5c the per-episode model
    // left here, but a cold start is still nothing but thin fields, and $297
    // still has to fund 1,650 episodes plus the site itself.
    const ceiling = projectedBreakEvenEpisodeCostUsd({ paidEntries: 3, finalists: 3 });

    expect(ceiling).toBeCloseTo(0.18, 4);
  });

  it("improves with entries and worsens with finalists", () => {
    const fifteenThree = projectedBreakEvenEpisodeCostUsd({ paidEntries: 15, finalists: 3 })!;
    const fifteenFive = projectedBreakEvenEpisodeCostUsd({ paidEntries: 15, finalists: 5 })!;

    expect(fifteenThree).toBeCloseTo(0.66, 4);
    expect(fifteenFive).toBeCloseTo(0.4569, 4);
    // More entries pay for more of the subsidy; more finalists spend it.
    expect(fifteenThree).toBeGreaterThan(fifteenFive);
  });

  it("has no ceiling to report when nothing has run", () => {
    expect(projectedBreakEvenEpisodeCostUsd({ paidEntries: 0, finalists: 0 })).toBeNull();
    expect(breakEvenEpisodeCostUsd(cohort())).toBeNull();
  });
});

describe("contribution, once somebody supplies a measured cost", () => {
  it("clears a thin field at a dime an episode, which the old price did not", () => {
    // 3 × 50 + 3 × 500 = 1,650 episodes at $0.10 is $165 against $297. The same
    // field lost $90 when three entries brought in $75, so this is the single
    // biggest thing the flat price changed.
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 3,
        finalists: 3,
        revenueUsd: 297,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(132, 2);
  });

  it("still loses a thin field once execution passes its ceiling", () => {
    // The ceiling at three entrants is 18c. At 20c the same field is underwater
    // again, which is why the flat price bought headroom rather than immunity.
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 3,
        finalists: 3,
        revenueUsd: 297,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.2,
      finalistEpisodeCostUsd: 0.2,
    });

    expect(result.contributionUsd).toBeCloseTo(-33, 2);
  });

  it("leaves real margin at fifteen entrants, before the site is prepared", () => {
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 15,
        finalists: 5,
        revenueUsd: 1_485,
        screeningEpisodes: 750,
        finalistEpisodes: 2_500,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(1_160, 2);
  });

  it("subtracts the site's own cost, which is where a thin field's margin goes", () => {
    // $132 of contribution does not survive $200 of capture, review and
    // acquisition. Execution was never the expensive part at a thin field.
    const result = cohortContribution({
      cohort: cohort({
        paidEntries: 3,
        finalists: 3,
        revenueUsd: 297,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
        siteCostUsd: 200,
      }),
      screeningEpisodeCostUsd: 0.1,
      finalistEpisodeCostUsd: 0.1,
    });

    expect(result.contributionUsd).toBeCloseTo(-68, 2);
  });

  it("reports the ten-to-one ratio that is the thing to watch", () => {
    const result = cohortContribution({
      cohort: cohort({
        revenueUsd: 297,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.05,
      finalistEpisodeCostUsd: 0.05,
    });

    // Ten final-comparison episodes per screening episode, whatever the price
    // is. The flat entry fee changed the revenue side of this and not this.
    expect(result.unpaidEpisodesPerPaidEpisode).toBe(10);
  });

  it("clears three entrants comfortably at five cents", () => {
    // The same field that lost $7.50 at $75 of revenue.
    const result = cohortContribution({
      cohort: cohort({
        revenueUsd: 297,
        screeningEpisodes: 150,
        finalistEpisodes: 1_500,
      }),
      screeningEpisodeCostUsd: 0.05,
      finalistEpisodeCostUsd: 0.05,
    });

    expect(result.contributionUsd).toBeCloseTo(214.5, 2);
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
