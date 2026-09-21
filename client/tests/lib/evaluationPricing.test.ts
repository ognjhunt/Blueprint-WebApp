import { describe, expect, it } from "vitest";

import {
  entriesForBalance,
  entryBoundaries,
  entryModel,
  entryPrice,
  finalistRound,
  finalistRoundRuns,
  formatPrice,
  included,
  quoteEntries,
  screeningRound,
  shortlistRule,
  siteAssessment,
} from "@/lib/evaluationPricing";

describe("evaluation pricing", () => {
  it("bills entries times tasks times the entry price", () => {
    // The three shapes stated on the page, which are the three a team asks
    // about: more policies, more tasks, and both at once.
    expect(quoteEntries(3, 1)).toEqual({ units: 3, usd: 297 });
    expect(quoteEntries(3, 2)).toEqual({ units: 6, usd: 594 });
    expect(quoteEntries(1, 3)).toEqual({ units: 3, usd: 297 });
  });

  it("charges one entry per policy-embodiment pair, per task", () => {
    // The clarification the whole model turns on. Either half changing is a
    // new entry, and both halves changing is still only one new entry -- the
    // unit is the pair, not the policy and not the robot.
    expect(quoteEntries(1).usd).toBe(entryPrice);
    expect(quoteEntries(2).usd).toBe(entryPrice * 2);
    expect(quoteEntries(6, 1).usd).toBe(quoteEntries(1, 6).usd);
  });

  it("says in the copy that either half of the pair makes a new entry", () => {
    const boundaries = entryBoundaries.join(" ");
    expect(boundaries).toMatch(/same policy on a second embodiment/i);
    expect(boundaries).toMatch(/second policy on the same embodiment/i);
    // And that a pair is never billed twice for changing twice.
    expect(boundaries).toMatch(/one new entry, not two/i);
  });

  it("defaults to a single task so a one-task quote reads as entries alone", () => {
    expect(quoteEntries(4)).toEqual(quoteEntries(4, 1));
  });

  it("never produces a negative or fractional invoice", () => {
    expect(quoteEntries(-3, 1)).toEqual({ units: 0, usd: 0 });
    expect(quoteEntries(Number.NaN, 2)).toEqual({ units: 0, usd: 0 });
    expect(quoteEntries(1, -2)).toEqual({ units: 0, usd: 0 });
    expect(quoteEntries(2.9, 1).units).toBe(2);
  });

  it("converts a dollar balance into whole entries", () => {
    expect(entriesForBalance(297)).toBe(3);
    // A balance that does not divide evenly buys what it covers, not what it
    // nearly covers.
    expect(entriesForBalance(200)).toBe(2);
    expect(entriesForBalance(-5)).toBe(0);
  });

  it("keeps the site free and the price a whole number of dollars", () => {
    // A price here -- any price -- reintroduces procurement, which is weeks,
    // and the ten-minute path dies with it.
    expect(siteAssessment.amount).toBe(0);
    expect(formatPrice(siteAssessment.amount)).toBe("$0");
    expect(formatPrice(entryPrice)).toBe("$99");
    expect(formatPrice(quoteEntries(3, 2).usd)).toBe("$594");
  });

  it("keeps every episode count out of what a buyer is quoted", () => {
    // The point of the flat price: the buyer does not size the run. If an
    // episode count reappears in buyer-facing copy, the statistics problem is
    // back on their desk.
    const buyerCopy = [
      entryModel.summary,
      entryModel.detail,
      entryModel.fairness,
      ...entryModel.notCharged,
      ...included,
      siteAssessment.summary,
      siteAssessment.allIn,
      siteAssessment.bounded,
      ...siteAssessment.covers,
    ].join(" ");
    expect(buyerCopy).not.toMatch(/\bepisode/i);
    expect(buyerCopy).not.toMatch(/\$0\.50|per episode/i);
  });

  it("promises the buyer cannot buy a longer run than a rival", () => {
    // Funding and allocation stay separate, or the comparison is an auction.
    expect(entryModel.fairness).toMatch(/cannot buy a longer run/i);
    expect(entryModel.fairness).toMatch(/same conditions/i);
  });
});

describe("the operating constants behind a flat price", () => {
  it("still runs a screen small enough to cut only what it can rule out", () => {
    expect(screeningRound.episodes).toBe(50);
  });

  it("keeps the final comparison large enough to be worth running after it", () => {
    // Screening cannot rank close candidates, so the final comparison has to
    // resolve a materially smaller gap or it buys nothing.
    expect(finalistRound.episodes).toBe(500);
    expect(finalistRound.episodes).toBeGreaterThan(screeningRound.episodes);
  });

  it("bounds the shortlist the free assessment covers", () => {
    expect(finalistRound.shortlist).toBe(5);
    expect(shortlistRule.cap).toBe(finalistRound.shortlist);
    expect(siteAssessment.bounded).toMatch(/up to five candidates/i);
  });

  it("does not run a final comparison with nothing to compare", () => {
    expect(finalistRoundRuns(0).runs).toBe(false);
    expect(finalistRoundRuns(1).runs).toBe(false);
    expect(finalistRoundRuns(1).reason).toMatch(/not a comparison/i);
    expect(finalistRoundRuns(2).runs).toBe(true);
  });
});
