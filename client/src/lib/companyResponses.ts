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
 * never are. No note of Blueprint's (a note could name the company). The types below are the whole of what the site's
 * job page receives about companies; nothing else is added to them.
 *
 * Since 2026-11-23 (owner: a company applies, the site sees its applicants and accepts): an answer given under the
 * current line (`company-response-2026-11-23`, "The site sees your company's name and website with your answer") also
 * shows the site the company's name and website (`applicant`). Its email and contact name still reach the site only when
 * the site accepts. An answer given under an earlier line keeps its alias.
 */

/**
 * The answers a company can give (package E, E9). `declined` is the stored name of "Not a fit" (kept from before). The
 * two tested answers are offered only when the job has a simulation to download (`TESTED_RESPONSE_STATES`).
 */
export const COMPANY_RESPONSE_STATES = ["interested", "declined", "needs_something", "tested_can_do", "tested_cannot_yet"] as const;
/** Answers that need the job's simulation package. */
export const TESTED_RESPONSE_STATES: readonly CompanyResponseState[] = ["tested_can_do", "tested_cannot_yet"];
/** Replies a company can give after reviewing the job and its video. */
export const FIT_RESPONSE_STATES = COMPANY_RESPONSE_STATES.filter(state => !TESTED_RESPONSE_STATES.includes(state));
/**
 * Answers beside which a site may ask for an introduction (E6, as E9 reads it). Not "Need more details": the Terms a
 * company accepted, and the line under its answer, say a site gets its name and contact details only after it answered
 * Interested or Tested it: can do. Meeting a company that would need something first takes a new line and new Terms
 * the company accepts (owner); until then the site reads why, and the company can change its answer.
 */
export const INTRODUCIBLE_RESPONSE_STATES: readonly CompanyResponseState[] = ["interested", "tested_can_do"];
/** Answers that may become an introduction when the company changes its answer: the site is told so. */
export const MAY_CHANGE_RESPONSE_STATES: readonly CompanyResponseState[] = ["needs_something", "tested_cannot_yet"];
export type CompanyResponseState = (typeof COMPANY_RESPONSE_STATES)[number];

export const COMPANY_START_WINDOWS = ["within_month", "one_to_three_months", "over_three_months"] as const;
export type CompanyStartWindow = (typeof COMPANY_START_WINDOWS)[number];
export const COMPANY_START_LABELS: Record<CompanyStartWindow, string> = {
  within_month: "Within a month",
  one_to_three_months: "In 1–3 months",
  over_three_months: "More than 3 months",
};
export const COMPANY_QUESTION_LIMIT = 400;
export const SITE_CLARIFICATION_LIMIT = 600;

export interface CompanyReplyDetails {
  verified?: string;
  question?: string;
  startWindow?: CompanyStartWindow;
}

/**
 * The answers as the company chooses them (owner, 2026-11-23: a company applies, the site sees its applicants and
 * accepts the ones it wants to meet). `interested` is the stored name of "Apply" (kept from before).
 */
export const COMPANY_RESPONSE_LABELS: Readonly<Record<CompanyResponseState, string>> = {
  interested: "Apply",
  declined: "Not a fit",
  needs_something: "Need more details",
  tested_can_do: "Tested it: can do",
  tested_cannot_yet: "Tested it: cannot yet",
};
/** The same answers as the site reads them beside each applicant. */
export const SITE_RESPONSE_LABELS: Readonly<Record<CompanyResponseState, string>> = {
  ...COMPANY_RESPONSE_LABELS,
  interested: "Applied",
};

export function isCompanyResponseState(value: unknown): value is CompanyResponseState {
  return typeof value === "string" && (COMPANY_RESPONSE_STATES as readonly string[]).includes(value);
}

export function companyResponseNeedsNote(state: CompanyResponseState): boolean {
  return state === "needs_something" || TESTED_RESPONSE_STATES.includes(state);
}

/** Under the company's response form in the job library, until 2026-11-12. Kept as the record of the older wording. */
export const RESPONSE_PRIVACY_LINE = "The site is told your response, not your company's name or your words.";

/**
 * The line under the response form on the company's page for a job (package E, E5), recorded on every answer as
 * `statementVersion`. Never change a line's text under its version: add a new version.
 *
 * 2026-11-23 (owner: "rename the flow to Apply, Applicants and Accept; show each applicant's company name and website
 * to the site before it accepts"): the current line says the site sees the company's name and website with its answer.
 * The site is shown a company's name only for an answer given under this line (`COMPANY_NAME_STATEMENT_VERSIONS`); an
 * answer given under the 2026-11-12 line keeps its alias. Both lines say the site is told the answer, and both agree to
 * an introduction after the site accepts, so an answer under either may be accepted (`COMPANY_RESPONSE_STATEMENT_VERSIONS`).
 */
export const COMPANY_RESPONSE_STATEMENT_VERSION = "company-response-2026-11-23";
export const COMPANY_RESPONSE_STATEMENT = "The site sees your company's name and website with your answer. If you apply or "
  + "answer Tested it: can do and the site accepts, we give the site your contact details, and give you theirs.";
/** The line of 2026-11-12, kept as the record of what an answer given under it agreed to. */
export const COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION = "company-response-2026-11-12";
export const COMPANY_RESPONSE_STATEMENT_2026_11_12 = "The site is told your answer. If you answer Interested or Tested it: can do and the "
  + "site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.";
/** Lines under which an answer tells the site the answer and agrees to an introduction once the site accepts. */
export const COMPANY_RESPONSE_STATEMENT_VERSIONS: readonly string[] = [COMPANY_RESPONSE_STATEMENT_VERSION,
  COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION];
/** Lines under which the site also sees the company's name and website with the answer. */
export const COMPANY_NAME_STATEMENT_VERSIONS: readonly string[] = [COMPANY_RESPONSE_STATEMENT_VERSION];

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
      details?: Pick<CompanyReplyDetails, "verified" | "startWindow">;
      question?: { id: string; text: string; answer?: string };
      /**
       * The company's name and website, only for an answer given under a line that says the site sees them
       * (`COMPANY_NAME_STATEMENT_VERSIONS`); otherwise the site reads the alias.
       */
      applicant?: { name: string; website: string | null };
      /** The site may press "Accept" for this company now. */
      canIntroduce?: boolean;
      /** When the site asked for the introduction. */
      introducedAtIso?: string;
      /** Only after the introduction. */
      company?: IntroducedCompany;
      /** The site asked for an introduction that could not go ahead: the company's email never went. */
      introductionCancelled?: boolean;
      /** After the introduction, what the site said happened: the dates it marked a visit and a pilot. */
      progress?: { visitAtIso?: string; pilotAtIso?: string } };

/** What the site's job page receives about companies. */
export interface SiteCompanyActivity {
  /** In date order: sends an operator recorded by hand, and answers in the order the companies answered. */
  entries: SiteCompanyEntry[];
  interested: boolean;
  /** The automatic send: how many approved deployment companies the job went to, and when it first went. */
  sent?: { count: number; firstAtIso: string } | null;
  /** Distinct approved company accounts that opened the job page, or null if the count could not be read. */
  views?: number | null;
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

/** The site's sentences. */
export const sentToCompany = (alias: string, date: string) => `Sent to ${alias} on ${date}.`;
export const companyAnswered = (alias: string, date: string, state: CompanyResponseState) =>
  `${alias} answered on ${date}: ${SITE_RESPONSE_LABELS[state]}.`;
/** Under an answer: the company's words, as the server gives them (its identity already taken out). */
export const companyReason = (reason: string) => `In their words: “${reason}”`;
/** Under an answer that is not a yes and carries no words the site may read: said plainly, nothing invented. */
export const NO_REASON_SHOWN = "No reason shared.";
/**
 * Under an answer that may become an introduction when the company changes it (`MAY_CHANGE_RESPONSE_STATES`): either
 * answer an introduction may follow (`INTRODUCIBLE_RESPONSE_STATES`), so a "Tested it: cannot yet" is not told that only
 * "Interested" would do.
 */
export const introductionIfChanged = (alias: string) => `You can accept ${alias} if it applies or changes its answer to `
  + `${COMPANY_RESPONSE_LABELS.tested_can_do}.`;

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
