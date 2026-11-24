/**
 * The site's side of an introduction (PACKAGE_E E6, 2026-11-12). Beside each deployment company that applied, the site's
 * job page offers one button, "Accept" (owner, 2026-11-23: a company applies, the site sees its applicants and accepts
 * the ones it wants to meet). Pressing it asks Blueprint to give that company the site's details the sentence beside it
 * names (since 2026-11-24, for a job from the start form, its email and the place it gave) and to give the site the
 * company's; nobody at Blueprint is in the loop. One for each company the site wants to meet, with
 * no limit per job (owner, 2026-11-12). Before it accepts, the site sees the company's name and website when the company
 * answered under the current line, else its alias ("Company A"); never its contact details.
 */

export const INTRODUCE_LABEL = "Accept";
/**
 * The sentence beside the button: exactly what pressing it shares, both ways. A recorded statement (planner, 2026-11-12,
 * 18:25Z): pressing the button is the site's agreement, recorded under this version with the introduction. The recorded
 * text is the template; the alias is filled in on the page. Changing a word means a new version.
 */
/**
 * 2026-11-24: the start form asks for no name and only a city or region, and the company receives the site's email and
 * the place it typed (`server/utils/jobIntroductions.ts`, `siteDetailsOf`). The sentence says only that. It is the one a
 * job shows unless its record holds a name the site gave (`introductionStatementVersionFor`).
 */
export const INTRODUCTION_REQUEST_STATEMENT_VERSION = "introduction-request-2026-11-24";
export const INTRODUCTION_REQUEST_STATEMENT = "We give {alias} your email address and the place you gave us, and give you theirs.";
/**
 * The sentence of 2026-11-12, word for word. Every introduction accepted under it stays valid. It is still the one shown
 * for a job whose record holds a name of the site's own or a person's (one started before the start form stopped asking
 * for them), where each word of it is true: the company receives that name, the address it typed and its email.
 */
export const INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION = "introduction-request-2026-11-12";
export const INTRODUCTION_REQUEST_STATEMENT_2026_11_12 = "We give {alias} your name, address and contact details, and give you theirs.";
/** Every version an introduction may be recorded under, with its text. Changing a word means a new version. */
export const INTRODUCTION_REQUEST_STATEMENTS: Readonly<Record<string, string>> = {
  [INTRODUCTION_REQUEST_STATEMENT_VERSION]: INTRODUCTION_REQUEST_STATEMENT,
  [INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION]: INTRODUCTION_REQUEST_STATEMENT_2026_11_12,
};
export const INTRODUCTION_REQUEST_STATEMENT_VERSIONS: readonly string[] = Object.keys(INTRODUCTION_REQUEST_STATEMENTS);
export const isIntroductionStatementVersion = (value: unknown): value is string =>
  typeof value === "string" && INTRODUCTION_REQUEST_STATEMENT_VERSIONS.includes(value);
/** The sentence beside Accept for one company, in the version the job's page was given (the current one by default). */
export const introduceSentence = (alias: string, version: string = INTRODUCTION_REQUEST_STATEMENT_VERSION) =>
  (INTRODUCTION_REQUEST_STATEMENTS[version] ?? INTRODUCTION_REQUEST_STATEMENT).replace("{alias}", alias);
/** A page showing another wording (an old tab) is refused before anything is recorded. */
export const INTRODUCTION_STATEMENT_CHANGED = "The wording on this page has changed. Reload the page, read it, then press Accept again.";
export const INTRODUCTION_FAILED = "We could not accept this company just now. Try again shortly.";
/** Beside an introduction cancelled before the company's email went: true by construction (H2). */
export const INTRODUCTION_CANCELLED = "This could not go ahead. We did not give them your details.";
/** Right after Accept is pressed: one plain sentence that both sides are being emailed (ledger EL19). */
export const introductionRequested = (alias: string) => `We are emailing you and ${alias} each other's contact details.`;
export const introducedOn = (company: string, date: string) => `You accepted ${company} on ${date}.`;

/** The refusal reasons `requestIntroduction` returns (`server/utils/jobIntroductions.ts`), each said in one plain sentence. */
export const INTRODUCTION_REFUSAL_REASONS = [
  "not_listed", "withdrawn", "not_interested", "consent_missing", "already_introduced", "company_not_approved",
] as const;
export type IntroductionRefusalReason = (typeof INTRODUCTION_REFUSAL_REASONS)[number];

export const INTRODUCTION_REFUSAL_SENTENCES: Readonly<Record<IntroductionRefusalReason, string>> = {
  not_listed: "Your job is not in front of deployment companies right now, so you cannot accept a company.",
  /** A withdrawn job: said for good, never "right now" (review S8). Chosen by the route, not by `requestIntroduction`. */
  withdrawn: "You withdrew this job, so you cannot accept a company.",
  not_interested: "This company has not applied, or has changed its answer since, so you cannot accept it now.",
  consent_missing: "This company needs to apply again before you can accept it.",
  already_introduced: "You have already accepted this company.",
  company_not_approved: "This company can no longer be accepted.",
};

export function isIntroductionRefusalReason(value: unknown): value is IntroductionRefusalReason {
  return typeof value === "string" && (INTRODUCTION_REFUSAL_REASONS as readonly string[]).includes(value);
}

