/**
 * A deployment company's answer about a site's job, and what the site is told of it (package C1, 2026-11-12).
 *
 * What each side agreed to decides what crosses: a site's summary goes to approved companies "without saying who you
 * are", and a site sees "an alias for each robot team", never a company's name. So the site is told an alias
 * ("Company A", "Company B", in the order each company first appeared on that job), a date and one of three fixed
 * labels. No free text from anyone reaches the site's page: never the company's name, email, website or its own words,
 * and no note of Blueprint's either (a note could name the company). The types below are the whole of what the site's
 * job page receives about companies; nothing else is added to them.
 */

/**
 * The answers a company can give (package E, E9). `declined` is the stored name of "Not a fit" (kept from before). The
 * two tested answers are offered only when the job has a simulation to download (`TESTED_RESPONSE_STATES`).
 */
export const COMPANY_RESPONSE_STATES = ["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"] as const;
/** Answers that need the job's simulation package. */
export const TESTED_RESPONSE_STATES: readonly CompanyResponseState[] = ["tested_can_do", "tested_cannot_yet"];
/** Answers beside which a site may ask for an introduction (E6, as E9 reads it). */
export const INTRODUCIBLE_RESPONSE_STATES: readonly CompanyResponseState[] = ["interested", "tested_can_do"];
export type CompanyResponseState = (typeof COMPANY_RESPONSE_STATES)[number];

export const COMPANY_RESPONSE_LABELS: Readonly<Record<CompanyResponseState, string>> = {
  interested: "Interested",
  declined: "Not a fit",
  needs_something: "Would need something",
  tested_can_do: "Tested it: can do",
  tested_cannot_yet: "Tested it: cannot yet",
};

export function isCompanyResponseState(value: unknown): value is CompanyResponseState {
  return typeof value === "string" && (COMPANY_RESPONSE_STATES as readonly string[]).includes(value);
}

/** Under the company's response form in the job library, until 2026-11-12. Kept as the record of the older wording. */
export const RESPONSE_PRIVACY_LINE = "The site is told your response, not your company's name or your words.";

/**
 * The line under the response form on the company's page for a job (package E, E5), recorded on every answer as
 * `statementVersion`. An Interested answer recorded under any other line cannot be introduced until the company
 * answers again under this one. Never change this text under this version: add a new version.
 */
export const COMPANY_RESPONSE_STATEMENT_VERSION = "company-response-2026-11-12";
// The text names both answers an introduction may follow (planner, 15:33Z). The id is unchanged because this version
// was never recorded in production before this text.
export const COMPANY_RESPONSE_STATEMENT = "The site is told your answer. If you answer Interested or Tested it: can do and the "
  + "site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.";

/** Introductions a site may ask for on one job. */
export const MAX_INTRODUCTIONS_PER_JOB = 3;

/** A stored alias letter ("A", "B", … "Z", "AA", …) as the site reads it. */
export const companyAliasName = (letter: string) => `Company ${letter}`;

/** A company's details, given to the site only after the site asked for an introduction to it (E6). */
export interface IntroducedCompany { name: string; contactName: string; email: string; website?: string }

/**
 * One line of the site's "Deployment companies" section. Nothing here comes from a company, except `company` on an
 * answer the site asked to be introduced to.
 */
export type SiteCompanyEntry =
  | { kind: "sent"; alias: string; atIso: string }
  | { kind: "answered"; alias: string; atIso: string; state: CompanyResponseState;
      /** The site may press "Introduce us" for this company now. */
      canIntroduce?: boolean;
      /** When the site asked for the introduction. */
      introducedAtIso?: string;
      /** Only after the introduction. */
      company?: IntroducedCompany };

/** What the site's job page receives about companies. */
export interface SiteCompanyActivity {
  /** In date order: sends an operator recorded by hand, and answers in the order the companies answered. */
  entries: SiteCompanyEntry[];
  interested: boolean;
  /** The automatic send: how many approved deployment companies the job went to, and when it first went. */
  sent?: { count: number; firstAtIso: string } | null;
  /** Introductions asked for on this job, of the most allowed. */
  introductions?: { used: number; max: number };
}

/** The site's sentence for the automatic send (E4). */
export const sentToCompanies = (count: number, date: string) =>
  `Sent to ${count} deployment ${count === 1 ? "company" : "companies"} on ${date}.`;

/** The site's sentences. */
export const sentToCompany = (alias: string, date: string) => `Sent to ${alias} on ${date}.`;
export const companyAnswered = (alias: string, date: string, state: CompanyResponseState) =>
  `${alias} answered on ${date}: ${COMPANY_RESPONSE_LABELS[state]}.`;
/** When any company is interested: the introduction is made by a person, by hand. */
export const NEXT_STEPS_LINE = "We will write to you about next steps.";

/** A cheap shape check for the job page: anything else is dropped, never shown. */
export function isSiteCompanyActivity(value: unknown): value is SiteCompanyActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const activity = value as Record<string, unknown>;
  return typeof activity.interested === "boolean" && Array.isArray(activity.entries)
    && activity.entries.every(entry => Boolean(entry) && typeof entry === "object"
      && typeof (entry as Record<string, unknown>).alias === "string" && typeof (entry as Record<string, unknown>).atIso === "string"
      && ((entry as Record<string, unknown>).kind === "sent"
        || ((entry as Record<string, unknown>).kind === "answered" && isCompanyResponseState((entry as Record<string, unknown>).state))));
}
