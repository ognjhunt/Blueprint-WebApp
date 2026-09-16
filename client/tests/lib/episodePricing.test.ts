import { describe, expect, it } from "vitest";

import {
  episodeRate,
  episodesForBalance,
  formatPrice,
  quoteEpisodes,
  siteAssessment,
  stagedExample,
} from "@/lib/episodePricing";

describe("episode pricing", () => {
  it("bills checkpoints times episodes times the rate", () => {
    expect(quoteEpisodes(1, 50)).toEqual({ episodes: 50, usd: 25 });
    expect(quoteEpisodes(6, 50)).toEqual({ episodes: 300, usd: 150 });
    expect(quoteEpisodes(6, 500)).toEqual({ episodes: 3_000, usd: 1_500 });
  });

  it("counts a checkpoint per run rather than per comparison", () => {
    // Six checkpoints on the same scenario cost six times one checkpoint.
    expect(quoteEpisodes(6, 50).usd).toBe(quoteEpisodes(1, 50).usd * 6);
  });

  it("makes staged screening cheaper than testing every checkpoint deeply", () => {
    expect(stagedExample.staged.episodes).toBe(700);
    expect(stagedExample.flat.episodes).toBe(3_000);
    expect(quoteEpisodes(1, stagedExample.staged.episodes).usd).toBeLessThan(
      quoteEpisodes(1, stagedExample.flat.episodes).usd,
    );
  });

  it("never produces a negative or fractional-episode invoice", () => {
    expect(quoteEpisodes(-3, 50)).toEqual({ episodes: 0, usd: 0 });
    expect(quoteEpisodes(Number.NaN, 50)).toEqual({ episodes: 0, usd: 0 });
    expect(quoteEpisodes(1, 50.9).episodes).toBe(50);
  });

  it("converts a dollar balance into whole standard episodes", () => {
    expect(episodesForBalance(200)).toBe(200 / episodeRate);
    expect(episodesForBalance(25)).toBe(50);
    expect(episodesForBalance(-5)).toBe(0);
  });

  it("keeps cents on the rate and drops them on whole dollars", () => {
    expect(formatPrice(episodeRate)).toBe("$0.50");
    expect(formatPrice(siteAssessment.amount)).toBe("$2,500");
    expect(formatPrice(quoteEpisodes(6, 50).usd)).toBe("$150");
  });
});
