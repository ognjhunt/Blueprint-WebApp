import { describe, expect, it } from "vitest";

import * as pricing from "@/lib/evaluationPricing";
import {
  betaFeeUsd,
  finalistRound,
  finalistRoundRuns,
  formatPrice,
  pilotReplacementPolicy,
  screeningRound,
  shortlistRule,
  siteAssessment,
} from "@/lib/evaluationPricing";

describe("free beta pricing", () => {
  it("charges nobody anything during the beta", () => {
    expect(betaFeeUsd).toBe(0);
    expect(siteAssessment.amount).toBe(0);
    expect(formatPrice(siteAssessment.amount)).toBe("$0");
    expect(siteAssessment.allIn).toMatch(/^Free during the beta\./);
    expect(siteAssessment.allIn).toMatch(/pilot coordination cost nothing/i);
  });

  it("no longer exports a live site fee, booking authorization or paid-entry quote", () => {
    // These were the $2,500 booking fee and the $99 private-entry model. The
    // founder made the beta free on 2026-10-13; a public surface that can
    // import them can quote them.
    for (const name of [
      "pilotFeeUsd",
      "pilotBookingAuthorization",
      "entryModel",
      "billingRules",
      "quoteEntries",
      "quoteExamples",
      "entriesForBalance",
      "included",
      "includedLimit",
    ]) {
      expect(pricing, name).not.toHaveProperty(name);
    }
  });

  it("keeps the physical pilot between the site and the robot team, with no Blueprint cut", () => {
    expect(siteAssessment.whatIsNotFree).toMatch(/agreed directly with the site/i);
    expect(siteAssessment.whatIsNotFree).toMatch(/no cut/i);
  });

  it("replaces a withdrawn team without promising a refund of a fee that does not exist", () => {
    expect(pilotReplacementPolicy).toMatch(/replacement needs its own evidence and your approval/i);
    expect(pilotReplacementPolicy).not.toMatch(/refund your fee/i);
  });

  it("keeps every price and episode count out of site-facing copy", () => {
    const siteCopy = [
      siteAssessment.summary,
      siteAssessment.allIn,
      siteAssessment.bounded,
      siteAssessment.whatWeGetFromIt,
      siteAssessment.whatIsNotFree,
      ...siteAssessment.covers,
    ].join(" ");
    expect(siteCopy).not.toMatch(/\$\d/);
    expect(siteCopy).not.toMatch(/\bepisode/i);
    expect(siteCopy).not.toMatch(/\bmatch(?:ed|es|ing)?\b/i);
  });

  it("keeps pilot approval with the customer and preserves evidence limits", () => {
    expect(siteAssessment.bounded).toMatch(/evidence limits/i);
    expect(siteAssessment.bounded).toMatch(/never certifies physical performance or safety/i);
    expect(siteAssessment.bounded).toMatch(/You choose and approve/i);
    const siteCopy = [siteAssessment.summary, siteAssessment.allIn, siteAssessment.bounded, ...siteAssessment.covers].join(" ");
    expect(siteCopy).not.toMatch(/comparable|delivery proposal|recommendation|book/i);
  });
});

describe("the operating constants behind an evaluation", () => {
  it("still runs a screen small enough to cut only what it can rule out", () => {
    expect(screeningRound.episodes).toBe(50);
  });

  it("keeps the final comparison large enough to be worth running after it", () => {
    // Screening cannot rank close candidates, so the final comparison has to
    // resolve a materially smaller gap or it buys nothing.
    expect(finalistRound.episodes).toBe(500);
    expect(finalistRound.episodes).toBeGreaterThan(screeningRound.episodes);
  });

  it("bounds the shortlist behind the one recommendation", () => {
    expect(finalistRound.shortlist).toBe(5);
    expect(shortlistRule.cap).toBe(finalistRound.shortlist);
  });

  it("does not run a final comparison with nothing to compare", () => {
    expect(finalistRoundRuns(0).runs).toBe(false);
    expect(finalistRoundRuns(1).runs).toBe(false);
    expect(finalistRoundRuns(1).reason).toMatch(/not a comparison/i);
    expect(finalistRoundRuns(2).runs).toBe(true);
  });
});
