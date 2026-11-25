/**
 * The answers to "How did it go?" after an introduction (PACKAGE_E E8), read by the emails, the confirm page, the
 * thank-you page and the admin console.
 *
 * Owner, 2026-11-25: the answers prove what an introduction led to, and pricing will rest on them, so each is a step a
 * side can see for itself: no contact yet, we met, a site visit booked or done, a pilot or deployment agreed, or not going
 * ahead (with one reason from a closed list, or none). "Not going ahead" is final: the side that gives it is asked
 * nothing more. The answers offered before 2026-11-25 are still read and still recorded from a link already sent, and
 * are never offered again.
 */
export const OUTCOME_STATES = ["no_contact_yet", "met", "site_visit", "pilot_agreed", "not_going_ahead"] as const;
/** Offered until 2026-11-25: read on stored answers and on links already emailed, never offered again. */
export const EARLIER_OUTCOME_STATES = ["still_talking", "quote_given", "going_ahead", "installed"] as const;
export type OutcomeState = (typeof OUTCOME_STATES)[number] | (typeof EARLIER_OUTCOME_STATES)[number];

export const OUTCOME_STATE_LABELS: Readonly<Record<OutcomeState, string>> = {
  no_contact_yet: "No contact yet",
  met: "We met",
  site_visit: "Site visit booked or done",
  pilot_agreed: "Pilot or deployment agreed",
  not_going_ahead: "Not going ahead",
  still_talking: "Still talking",
  quote_given: "Quote given",
  going_ahead: "Going ahead",
  installed: "Installed",
};

/** A side's own final answer ends its questions. "Installed" was final while it was offered. */
export const FINAL_OUTCOME_STATES: ReadonlySet<OutcomeState> = new Set(["not_going_ahead", "installed"]);

/** Why not, one press on the confirm page of a "Not going ahead" link; "Rather not say" records none. */
export const NOT_GOING_AHEAD_REASONS = ["cost", "not_a_fit", "timing", "chose_another", "other"] as const;
export type NotGoingAheadReason = (typeof NOT_GOING_AHEAD_REASONS)[number];
export const NOT_GOING_AHEAD_REASON_LABELS: Readonly<Record<NotGoingAheadReason, string>> = {
  cost: "Cost",
  not_a_fit: "Not a fit for the job",
  timing: "Timing",
  chose_another: "Chose another option",
  other: "Another reason",
};
export const RATHER_NOT_SAY_LABEL = "Rather not say";

export function isOutcomeState(value: unknown): value is OutcomeState {
  return typeof value === "string" && ((OUTCOME_STATES as readonly string[]).includes(value)
    || (EARLIER_OUTCOME_STATES as readonly string[]).includes(value));
}

export function isNotGoingAheadReason(value: unknown): value is NotGoingAheadReason {
  return typeof value === "string" && (NOT_GOING_AHEAD_REASONS as readonly string[]).includes(value);
}

/** An answer in words: its label, and for "Not going ahead" the reason when one was given. */
export function outcomeLabel(state: OutcomeState, reason?: unknown): string {
  return state === "not_going_ahead" && isNotGoingAheadReason(reason)
    ? `${OUTCOME_STATE_LABELS[state]} (${NOT_GOING_AHEAD_REASON_LABELS[reason]})` : OUTCOME_STATE_LABELS[state];
}

/** The thank-you page's one sentence. */
export const outcomeThanks = (state: OutcomeState, reason?: unknown) => `Thanks. We've recorded: ${outcomeLabel(state, reason)}.`;
