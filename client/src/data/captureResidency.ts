/**
 * Where we are actually cleared to receive a walkthrough.
 *
 * ## The contradiction this closes
 *
 * The capture page invited a site to film and said "a city is plenty", and
 * `decideCaptureDispatch` was documented as dispatching self-capture
 * "anywhere". The privacy policy says something else: Blueprint's external beta
 * "is scoped to US testers and US capture sites unless a written review
 * approves a different region", and non-US participation "require[s] signed
 * transfer terms, such as a DPA, SCCs or equivalent transfer mechanism, and
 * approved retention/residency terms **before capture or sharing**."
 *
 * So the product was inviting people to hand us footage we had told them we
 * were not cleared to process. That is not a copy nit. Collection is the act
 * the lawful basis has to exist for, and it happens the moment they upload.
 *
 * ## Why the region is asked rather than inferred
 *
 * A free-text "where is it?" cannot be parsed into a jurisdiction reliably, and
 * a residency decision made on a guess is worse than no decision — it reads as
 * a clearance we never had. One explicit control is the only way to be certain,
 * and certainty is what a legal basis requires.
 *
 * ## The region does not decide whether we want the site
 *
 * An out-of-region site is a site we would like to serve and cannot serve
 * *yet*. It still submits, we still have the lead, and the answer is a
 * conversation about transfer terms rather than a rejection. What it does not
 * get is a camera link, because the link is the invitation to collect.
 */

export const CAPTURE_REGIONS = ["us", "non_us"] as const;

export type CaptureRegion = (typeof CAPTURE_REGIONS)[number];

/**
 * The one region the external beta is cleared for.
 *
 * A list rather than a boolean so approving a second region is a data change
 * here, not a hunt through copy and gates for the places that assumed one.
 */
export const APPROVED_CAPTURE_REGIONS: readonly CaptureRegion[] = ["us"];

export function isCaptureRegion(value: unknown): value is CaptureRegion {
  return typeof value === "string" && (CAPTURE_REGIONS as readonly string[]).includes(value);
}

/**
 * Whether a walkthrough from this region can be collected today.
 *
 * An unknown value is not approved. This is the stricter reading, matching
 * `defaultCaptureMode`'s rule that a submission can never relax a gate by
 * omitting a field — and here omitting it would mean collecting footage with no
 * recorded basis at all.
 */
export function isApprovedCaptureRegion(value: unknown): boolean {
  return isCaptureRegion(value) && APPROVED_CAPTURE_REGIONS.includes(value);
}

export const captureRegionOptions: readonly { value: CaptureRegion; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "non_us", label: "Outside the United States" },
];

/**
 * Said before the recording, not after.
 *
 * The audit finding this answers was specifically about ordering: "State the
 * actual eligibility before collection. Do not make someone record a site
 * before discovering that you cannot serve it."
 */
export const captureRegionNotice =
  "During the beta we can only take walkthroughs from sites in the United States. " +
  "Outside the US we need data-transfer terms signed before you record anything, so tell us " +
  "about the site and we will start that rather than send you a camera link.";

/** What an out-of-region submission is told, in the success state. */
export const captureRegionHeldNotice =
  "We have your site. We are not sending a camera link yet: outside the US we need " +
  "data-transfer terms in place before we collect a walkthrough, and that is a conversation " +
  "rather than a form. Nothing has been recorded and nothing has been shared.";
