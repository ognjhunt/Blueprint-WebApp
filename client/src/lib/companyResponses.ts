/**
 * A deployment company's answer about a site's job, and what the site is told of it (package C1, 2026-11-12).
 *
 * What each side agreed to decides what crosses: a site's summary goes to approved companies "without saying who you
 * are", and a site sees "an alias for each robot team", never a company's name. So the site is told an alias
 * ("Company A", "Company B", in the order each company first appeared on that job), a date, one of the fixed labels
 * and why: the company's own words about its answer (2026-11-20), with every name, email, phone number, web address
 * and link of the company's taken out first (`removeIdentifyingDetails`, `jobCompanies.ts`). Only words given under
 * the current line ("The site is told your answer"), or recorded by Blueprint from the company's email since the staff
 * form says the site reads them, are shown; words given under the older line ("not your company's name or your words")
 * never are. Never the company's name, email or website, and no note of Blueprint's (a note
 * could name the company). The types below are the whole of what the site's job page receives about companies;
 * nothing else is added to them.
 */

/**
 * The answers a company can give (package E, E9). `declined` is the stored name of "Not a fit" (kept from before). The
 * two tested answers are offered only when the job has a simulation to download (`TESTED_RESPONSE_STATES`).
 */
export const COMPANY_RESPONSE_STATES = ["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"] as const;
/** Answers that need the job's simulation package. */
export const TESTED_RESPONSE_STATES: readonly CompanyResponseState[] = ["tested_can_do", "tested_cannot_yet"];
/**
 * Answers beside which a site may ask for an introduction (E6, as E9 reads it). Not "Would need something": the Terms a
 * company accepted, and the line under its answer, say a site gets its name and contact details only after it answered
 * Interested or Tested it: can do. Meeting a company that would need something first takes a new line and new Terms
 * the company accepts (owner); until then the site reads why, and the company can change its answer.
 */
export const INTRODUCIBLE_RESPONSE_STATES: readonly CompanyResponseState[] = ["interested", "tested_can_do"];
/** Answers that may become an introduction when the company changes its answer: the site is told so. */
export const MAY_CHANGE_RESPONSE_STATES: readonly CompanyResponseState[] = ["needs_something", "tested_cannot_yet"];
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

/** What a company sees before it has accepted the current Terms and Privacy Policy: nothing of any job, only this. */
export const TERMS_PROMPT = "Before you see jobs, read and agree to our Terms and Privacy Policy.";

/** A stored alias letter ("A", "B", … "Z", "AA", …) as the site reads it. */
export const companyAliasName = (letter: string) => `Company ${letter}`;

/** A company's details, given to the site only after the site asked for an introduction to it (E6). */
export interface IntroducedCompany { name: string; contactName: string; email: string; website?: string }

/**
 * One line of the site's "Deployment companies" section. Nothing here comes from a company, except `reason` (its words,
 * with its identity taken out) and `company` on an answer the site asked to be introduced to.
 */
export type SiteCompanyEntry =
  | { kind: "sent"; alias: string; atIso: string }
  | { kind: "answered"; alias: string; atIso: string; state: CompanyResponseState;
      /**
       * Why: the company's words about its answer, with its name, people, email, phone, website and any link taken out.
       * Absent when there are none the site may read (given under the older line, or nothing left once taken out).
       */
      reason?: string;
      /** The site may press "Introduce us" for this company now. */
      canIntroduce?: boolean;
      /** When the site asked for the introduction. */
      introducedAtIso?: string;
      /** Only after the introduction. */
      company?: IntroducedCompany;
      /** The site asked for an introduction that could not go ahead: the company's email never went. */
      introductionCancelled?: boolean };

/** What the site's job page receives about companies. */
export interface SiteCompanyActivity {
  /** In date order: sends an operator recorded by hand, and answers in the order the companies answered. */
  entries: SiteCompanyEntry[];
  interested: boolean;
  /** The automatic send: how many approved deployment companies the job went to, and when it first went. */
  sent?: { count: number; firstAtIso: string } | null;
  startedAtIso?: string;
  /** Absent if an earlier answer may have lost its original timestamp. */
  firstAnswerAtIso?: string;
  /** Introductions made on this job (not cancelled). There is no limit per job (owner, 2026-11-12). */
  introductions?: { used: number };
}

export function elapsedSince(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const minutes = (Date.parse(end) - Date.parse(start)) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 1) return "under a minute";
  const [value, unit]: [number, string] = minutes < 60 ? [Math.floor(minutes), "minute"]
    : minutes < 1440 ? [minutes / 60, "hour"] : [minutes / 1440, "day"];
  return new Intl.NumberFormat("en", { style: "unit", unit, unitDisplay: "long", maximumFractionDigits: 1 }).format(value);
}

/** The site's sentence for the automatic send (E4). */
export const sentToCompanies = (count: number, date: string) =>
  `Sent to ${count} deployment ${count === 1 ? "company" : "companies"} on ${date}.`;

/**
 * Under the send line while the job has gone to at least one company and none has answered. The home page's example
 * card shows the same state with the same constant, so the example says only what a real job page says.
 */
export const NO_ANSWERS_YET = "No answers yet.";

/**
 * Under the sharing sentence while the job is shared and the site's company read came back with no send and no answer
 * (the job waits for its video check, or for the automatic send). Said only from a read that holds that fact: with no
 * read at all the page says nothing about sends.
 */
export const NOT_SENT_YET = "Not sent to any deployment company yet.";

/** The site's sentences. */
export const sentToCompany = (alias: string, date: string) => `Sent to ${alias} on ${date}.`;
export const companyAnswered = (alias: string, date: string, state: CompanyResponseState) =>
  `${alias} answered on ${date}: ${COMPANY_RESPONSE_LABELS[state]}.`;
/** Under an answer: the company's words, as the server gives them (its identity already taken out). */
export const companyReason = (reason: string) => `In their words: “${reason}”`;
/** Under an answer that is not a yes and carries no words the site may read: said plainly, nothing invented. */
export const NO_REASON_SHOWN = "No reason we can show.";
/**
 * Under an answer that may become an introduction when the company changes it (`MAY_CHANGE_RESPONSE_STATES`): either
 * answer an introduction may follow (`INTRODUCIBLE_RESPONSE_STATES`), so a "Tested it: cannot yet" is not told that only
 * "Interested" would do.
 */
export const introductionIfChanged = (alias: string) => `You can ask for an introduction if ${alias} changes its answer to `
  + `${COMPANY_RESPONSE_LABELS.interested} or ${COMPANY_RESPONSE_LABELS.tested_can_do}.`;

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
