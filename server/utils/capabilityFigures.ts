/**
 * Turning a published figure into the band the matcher compares.
 *
 * ## Why this is code and not a spreadsheet column
 *
 * A spec sheet says "Payload: 20 kg". The matcher speaks in bands. Somebody has
 * to decide that 20 kg is `ten_to_twentyfive`, and if that somebody is a person
 * typing into a seed file, the mapping is unreviewable and drifts: one entry
 * rounds up, another rounds down, and the registry quietly stops meaning one
 * thing.
 *
 * So the real figure is what gets recorded as evidence, and the band is derived
 * from it here, once, by a function with tests. A reviewer checks the quoted
 * number against the source; the band follows automatically.
 *
 * ## Boundaries are inclusive at the top
 *
 * The intake asks "what is the heaviest thing this task handles" and offers
 * "10–25 kg". A 10 kg payload belongs in `two_to_ten`, because that band's
 * label says "2–10 kg" and a site operator reading it would put 10 there. The
 * bands are contiguous and each owns its upper bound.
 */

/**
 * Pounds to kilograms.
 *
 * Manufacturers publish in whichever unit their market uses, and Agility state
 * Digit's capacity as "35 pound carrying capacity". Converting in code keeps
 * the quoted figure verbatim in the record while the band stays derived — the
 * alternative is a person doing the arithmetic into a seed file, which is the
 * thing this module exists to avoid.
 */
export function poundsToKg(pounds: number): number {
  return pounds * 0.45359237;
}

/** Payload bands, shared by `payloadWeight` (site) and `payloadCapacity` (robot). */
export function payloadKgToBand(kg: number): string | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  if (kg <= 2) return "under_2kg";
  if (kg <= 10) return "two_to_ten";
  if (kg <= 25) return "ten_to_twentyfive";
  return "over_25kg";
}

/** Cycle-time bands, from a figure in seconds. */
export function cycleSecondsToBand(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 30) return "under_30s";
  if (seconds <= 120) return "thirty_to_two_min";
  if (seconds <= 600) return "two_to_ten_min";
  return "over_ten_min";
}

/**
 * Success-rate bands, from a percentage.
 *
 * Rounds down to the band a figure actually reaches: 94% is not 95%, and a
 * registry that rounds up on acceptance thresholds is one that puts a team in
 * front of a site it cannot satisfy.
 */
export function successRateToBand(percent: number): string | null {
  if (!Number.isFinite(percent) || percent <= 0) return null;
  if (percent >= 99.5) return "ninetynine_plus";
  if (percent >= 99) return "ninetynine";
  if (percent >= 95) return "ninetyfive";
  if (percent >= 90) return "ninety";
  // Below the lowest band the site intake offers. Recording it as "ninety"
  // would overstate it, so it is unknown to the matcher.
  return null;
}

/** Shift-volume bands, from a cycle count. */
export function shiftVolumeToBand(cycles: number): string | null {
  if (!Number.isFinite(cycles) || cycles <= 0) return null;
  if (cycles < 50) return "under_50";
  if (cycles <= 250) return "fifty_to_250";
  if (cycles <= 1000) return "250_to_1000";
  return "over_1000";
}
