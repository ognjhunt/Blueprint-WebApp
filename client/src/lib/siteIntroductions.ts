/**
 * The site's side of an introduction (PACKAGE_E E6, 2026-11-12). Beside each deployment company that answered
 * Interested, the site's job page offers one button. Pressing it asks Blueprint to give that company the site's name and
 * contact details and to give the site the company's; nobody at Blueprint is in the loop. At most three per job, in the
 * order the companies answered. Before an introduction the site sees aliases only ("Company A").
 */

export const INTRODUCE_LABEL = "Introduce us";
/**
 * The sentence beside the button: exactly what pressing it shares, both ways. A recorded statement (planner, 2026-11-12,
 * 18:25Z): pressing the button is the site's agreement, recorded under this version with the introduction. The recorded
 * text is the template; the alias is filled in on the page. Changing a word means a new version.
 */
export const INTRODUCTION_REQUEST_STATEMENT_VERSION = "introduction-request-2026-11-12";
export const INTRODUCTION_REQUEST_STATEMENT = "We give {alias} your name, address and contact details, and give you theirs.";
export const introduceSentence = (alias: string) => INTRODUCTION_REQUEST_STATEMENT.replace("{alias}", alias);
/** A page showing another wording (an old tab) is refused before anything is recorded. */
export const INTRODUCTION_STATEMENT_CHANGED = "The wording on this page has changed. Reload the page, read it, then press Introduce us again.";
export const INTRODUCTIONS_USED = "You have used your three introductions.";
export const INTRODUCTION_FAILED = "We could not ask for the introduction just now. Try again shortly.";
export const introducedOn = (company: string, date: string) => `You were introduced to ${company} on ${date}.`;

/** The refusal reasons `requestIntroduction` returns (`server/utils/jobIntroductions.ts`), each said in one plain sentence. */
export const INTRODUCTION_REFUSAL_REASONS = [
  "not_listed", "withdrawn", "not_interested", "consent_missing", "limit_reached", "already_introduced", "company_not_approved",
] as const;
export type IntroductionRefusalReason = (typeof INTRODUCTION_REFUSAL_REASONS)[number];

export const INTRODUCTION_REFUSAL_SENTENCES: Readonly<Record<IntroductionRefusalReason, string>> = {
  not_listed: "Your job is not in front of deployment companies right now, so we cannot make an introduction.",
  /** A withdrawn job: said for good, never "right now" (review S8). Chosen by the route, not by `requestIntroduction`. */
  withdrawn: "You withdrew this job, so we cannot make an introduction.",
  not_interested: "This company has not answered Interested, so we cannot introduce you.",
  consent_missing: "This company needs to answer again before we can introduce you.",
  limit_reached: INTRODUCTIONS_USED,
  already_introduced: "You have already been introduced to this company.",
  company_not_approved: "This company can no longer be introduced.",
};

export function isIntroductionRefusalReason(value: unknown): value is IntroductionRefusalReason {
  return typeof value === "string" && (INTRODUCTION_REFUSAL_REASONS as readonly string[]).includes(value);
}

/** The most introductions a job has (owner, 2026-11-12). */
export const MAX_INTRODUCTIONS = 3;
