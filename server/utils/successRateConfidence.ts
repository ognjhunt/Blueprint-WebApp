export const CONFIDENCE_POLICY_VERSION = "wilson95-success-bands.v2";

export function wilsonLowerBound(successes: number, trials: number): number {
  if (trials <= 0) return 0;
  const z = 1.96;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin =
    z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return Math.max(0, (centre - margin) / denominator);
}

/**
 * The upper end of the same interval.
 *
 * Needed for the opposite question. `wilsonLowerBound` answers "what can this
 * run claim"; this answers "what can this run rule out" -- and only the second
 * one justifies withdrawing somebody else's claim.
 */
export function wilsonUpperBound(successes: number, trials: number): number {
  if (trials <= 0) return 1;
  const z = 1.96;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin =
    z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return Math.min(1, (centre + margin) / denominator);
}

/** Minimum supported success probability for each displayed band. */
export const SUCCESS_RATE_BAND_CLAIM: Record<string, number> = {
  ninety: 0.9,
  ninetyfive: 0.95,
  ninetynine: 0.99,
  ninetynine_plus: 0.99,
};

/**
 * Whether this run rules out a band somebody already claimed.
 *
 * ## Why "no band" is the wrong test
 *
 * My first attempt withdrew a claim whenever the run earned no band of its own.
 * That is wrong, and wrong in a way that punishes honesty: ten-for-ten earns no
 * band, because ten trials cannot separate 90% from 99% -- but it is a perfect
 * result, and it contradicts nothing. Withdrawing a claim on the strength of it
 * would mean a team's good short run cost it the claim its long run earned.
 *
 * So the test is contradiction, not silence. The claim goes only when the whole
 * interval this run supports sits below what the claim asserts -- 30 of 50 has
 * an upper bound near 73%, which rules out 95%, while 10 of 10 rules out
 * nothing. Same rule the footage review uses on a site: `contradicts` revokes,
 * and an absence of corroboration does not.
 */
export function measurementContradictsBand(
  successes: number,
  trials: number,
  heldBand: string | null | undefined,
): boolean {
  if (trials <= 0) return false;
  const claimed = heldBand ? SUCCESS_RATE_BAND_CLAIM[heldBand] : undefined;
  // Nothing recognisable is claimed, so there is nothing to disprove. An
  // unknown band is left alone rather than guessed at.
  if (claimed === undefined) return false;
  return wilsonUpperBound(successes, trials) < claimed;
}

/**
 * The highest band this run can honestly claim, or null.
 *
 * Null is a real answer and the common one for a short run. It means the
 * registry keeps whatever it had rather than gaining a worse-founded claim that
 * nothing could later outrank.
 */
export function successRateBand(successes: number, trials: number): string | null {
  if (!Number.isInteger(trials) || !Number.isInteger(successes) || trials <= 0 || successes < 0 || successes > trials) return null;
  const bound = wilsonLowerBound(successes, trials);
  if (bound > 0.99) return "ninetynine_plus";
  if (bound >= 0.99) return "ninetynine";
  if (bound >= 0.95) return "ninetyfive";
  if (bound >= 0.9) return "ninety";
  // Below the lowest band on the scale. `unsure` would be a lie -- it means
  // "not measured" and this was measured -- so nothing is claimed.
  return null;
}

