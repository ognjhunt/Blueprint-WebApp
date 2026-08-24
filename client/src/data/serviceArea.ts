/**
 * Where Blueprint operates.
 *
 * One metro, and one place in the codebase that says so.
 *
 * This used to live inside `captureVisit.ts`, which was fine while only the
 * capture-visit page made the claim. It is not fine now: the footer, the
 * qualifying screen on `/for-site-operators`, the site-task intake, and the
 * capturer network all state or imply a footprint, and two of those read from
 * different sources. A company that operates in one city and has two answers
 * to "where do you operate" will eventually publish the wrong one.
 *
 * ## Why this is stated at all
 *
 * Saying "Austin only" costs leads and is the only honest option. A national
 * implication we cannot staff is fabricated readiness, which this repo does not
 * ship. It is also the better story: operating one metro is what keeps a visit
 * schedulable in days rather than quarters, which is the whole premise of
 * compressing months 0-2.
 *
 * ## The capturer program is the same footprint
 *
 * `cityLaunchCoverageExpansion.ts` carries coverage policies for several
 * metros, and the capturer launch status is served from Firestore at runtime —
 * so the capturer surfaces could advertise a city the deployment program does
 * not serve. A reader does not distinguish Blueprint's two programs, so the
 * public surfaces are filtered through `isServedCitySlug` rather than trusting
 * whatever the backend happens to return. Those coverage policies stay in the
 * codebase as prepared work for expansion; they are not a claim that a city is
 * open.
 *
 * ## Changing this
 *
 * When a second metro opens, add it to `servedCitySlugs` and update the copy
 * below. Do not soften it to "and select other markets" in the meantime, and do
 * not let a backend record widen the public claim on its own.
 */

/** Slugs of every metro Blueprint actually serves, in the launch-city format. */
export const servedCitySlugs: readonly string[] = ["austin-tx"];

export const serviceArea = {
  city: "Austin, TX",
  citySlug: "austin-tx",
  claim: "Austin, Texas — one metro, on purpose.",
  detail:
    "Capture visits run in the Austin metro today. That is a real limit and we would rather state it than imply a footprint we do not have. It is also deliberate: operating one metro is what keeps a visit schedulable in days, and it is where the deployment density we are building for starts.",
  outside:
    "If your site is outside the metro, tell us anyway. We will say where you sit relative to expansion rather than book a visit we cannot staff.",
} as const;

/**
 * Whether a launch-city slug is one we actually serve.
 *
 * Used to filter runtime city data before it reaches a public surface. The
 * comparison is slug-based and case-insensitive because launch records are
 * written by several different code paths.
 */
export function isServedCitySlug(citySlug: string | null | undefined): boolean {
  if (!citySlug) return false;
  return servedCitySlugs.includes(citySlug.trim().toLowerCase());
}

/** Keep only the cities Blueprint serves, whatever the backend returned. */
export function filterToServedCities<T extends { citySlug: string }>(
  cities: readonly T[],
): T[] {
  return cities.filter((city) => isServedCitySlug(city.citySlug));
}
