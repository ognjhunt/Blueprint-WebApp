/**
 * The five answers to "How did it go?" after an introduction (PACKAGE_E E8), read by the emails, the
 * thank-you page and the admin console. "Installed" and "Not going ahead" are final: once either side
 * gives one, no later question is sent.
 */
export const OUTCOME_STATES = ["still_talking", "quote_given", "going_ahead", "installed", "not_going_ahead"] as const;
export type OutcomeState = (typeof OUTCOME_STATES)[number];

export const OUTCOME_STATE_LABELS: Readonly<Record<OutcomeState, string>> = {
  still_talking: "Still talking",
  quote_given: "Quote given",
  going_ahead: "Going ahead",
  installed: "Installed",
  not_going_ahead: "Not going ahead",
};

export const FINAL_OUTCOME_STATES: ReadonlySet<OutcomeState> = new Set(["installed", "not_going_ahead"]);

export function isOutcomeState(value: unknown): value is OutcomeState {
  return typeof value === "string" && (OUTCOME_STATES as readonly string[]).includes(value);
}

/** The thank-you page's one sentence. */
export const outcomeThanks = (state: OutcomeState) => `Thanks. We've recorded: ${OUTCOME_STATE_LABELS[state]}.`;
