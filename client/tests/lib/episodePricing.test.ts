import { describe, expect, it } from "vitest";

import {
  episodeRate,
  episodesForBalance,
  finalistRound,
  formatPrice,
  quoteEpisodes,
  quoteScreening,
  rounds,
  screeningRound,
  shortlistRule,
  siteAssessment,
} from "@/lib/episodePricing";

describe("episode pricing", () => {
  it("bills screening at checkpoints times the screening count times the rate", () => {
    expect(quoteScreening(1)).toEqual({ episodes: 50, usd: 25 });
    expect(quoteScreening(3)).toEqual({ episodes: 150, usd: 75 });
    expect(quoteScreening(6)).toEqual({ episodes: 300, usd: 150 });
  });

  it("counts a checkpoint per run rather than per comparison", () => {
    expect(quoteScreening(6).usd).toBe(quoteScreening(1).usd * 6);
  });

  it("offers exactly two rounds, and no contestant funds its own final", () => {
    expect(rounds).toHaveLength(2);
    expect(screeningRound.fundedBy).toBe("robot-team");
    // Not "site" and not "robot-team". A finalist round bought by its own
    // contestant is an auction: the richest entrant buys the longest run and
    // therefore the tightest interval. Blueprint setting the count is the
    // whole reason the comparison is a comparison.
    expect(finalistRound.fundedBy).toBe("blueprint");
  });

  it("sets the finalist round large enough to be worth running after screening", () => {
    // Screening cannot rank close candidates, so the finalist round has to
    // resolve a materially smaller gap or it buys nothing.
    expect(finalistRound.episodes).toBeGreaterThan(screeningRound.episodes);
    expect(screeningRound.episodes).toBe(50);
    expect(finalistRound.episodes).toBe(500);
  });

  it("bounds the shortlist the site fee covers", () => {
    expect(finalistRound.shortlist).toBe(5);
    expect(shortlistRule.cap).toBe(finalistRound.shortlist);
    expect(siteAssessment.bounded).toMatch(/up to five finalists/i);
  });

  it("sets the shortlist by what screening can rule out, not by a fixed count", () => {
    // A fixed shortlist cuts candidates on differences screening cannot
    // establish; the rule only cuts what it can.
    expect(shortlistRule.statement).toMatch(/cannot separate from the leader/i);
    expect(shortlistRule.detail).toMatch(/only cuts a candidate it can rule out/i);
    expect(screeningRound.resolves).toMatch(/up to five/i);
  });

  it("keeps every per-episode rate out of the site's side of the page", () => {
    const siteCopy = [
      siteAssessment.summary,
      siteAssessment.allIn,
      siteAssessment.bounded,
      ...siteAssessment.covers,
    ].join(" ");
    expect(siteCopy).not.toMatch(/0\.50|per episode/i);
  });

  it("never produces a negative or fractional-episode invoice", () => {
    expect(quoteEpisodes(-3, 50)).toEqual({ episodes: 0, usd: 0 });
    expect(quoteEpisodes(Number.NaN, 50)).toEqual({ episodes: 0, usd: 0 });
    expect(quoteEpisodes(1, 50.9).episodes).toBe(50);
    expect(quoteScreening(-2)).toEqual({ episodes: 0, usd: 0 });
  });

  it("converts a dollar balance into whole standard episodes", () => {
    expect(episodesForBalance(200)).toBe(200 / episodeRate);
    expect(episodesForBalance(25)).toBe(50);
    expect(episodesForBalance(-5)).toBe(0);
  });

  it("keeps cents on the rate and drops them on whole dollars", () => {
    expect(formatPrice(episodeRate)).toBe("$0.50");
        // Free to find out. A price here -- any price -- reintroduces procurement,
    // which is weeks, and the ten-minute path dies with it.
    expect(siteAssessment.amount).toBe(0);
    expect(formatPrice(siteAssessment.amount)).toBe("$0");
    expect(formatPrice(quoteScreening(6).usd)).toBe("$150");
  });
});
