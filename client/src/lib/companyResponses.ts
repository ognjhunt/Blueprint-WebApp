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

/**
 * What an application tells the site at a glance (owner, 2026-11-23, from the research on what sites decide on: proof
 * from similar jobs, how a company charges, and no cost surprises): how the company charges, an optional estimate range
 * in US dollars before a site visit (never a quote, and never a price of Blueprint's), how many similar jobs it has done,
 * and what a visit must confirm. Every field is optional: a company that will not give a number before a visit still
 * applies.
 */
export const CHARGE_MODELS = ["purchase", "subscription", "per_hour", "per_task", "undecided"] as const;
export type ChargeModel = (typeof CHARGE_MODELS)[number];
export const CHARGE_MODEL_LABELS: Readonly<Record<ChargeModel, string>> = {
  purchase: "One-time purchase", subscription: "Monthly subscription", per_hour: "Per hour of work",
  per_task: "Per task or item", undecided: "Not decided yet",
};
/** The unit an estimate is in, by how the company charges; "Not decided yet" takes no estimate. */
export const ESTIMATE_UNITS: Readonly<Record<ChargeModel, string | null>> = {
  purchase: "in total", subscription: "a month", per_hour: "an hour", per_task: "per task or item", undecided: null,
};
export const SIMILAR_JOBS = ["none", "1_5", "6_20", "over_20"] as const;
export type SimilarJobs = (typeof SIMILAR_JOBS)[number];
export const SIMILAR_JOBS_LABELS: Readonly<Record<SimilarJobs, string>> = {
  none: "None yet", "1_5": "1 to 5", "6_20": "6 to 20", over_20: "More than 20",
};
/**
 * The largest estimate a site reads, by how the company charges (stress test round 2, 2026-11-24: "$41,555,501.99 an hour"
 * carried a phone number, 415 555 0199, to the site before Accept). Generous for one site's one recurring job, and no
 * figure of Blueprint's: a ceiling on what the form takes.
 */
export const ESTIMATE_MAX_USD_BY_CHARGE: Readonly<Record<Exclude<ChargeModel, "undecided">, number>> = {
  purchase: 10_000_000, subscription: 1_000_000, per_hour: 10_000, per_task: 10_000,
};
/** The largest estimate under any way of charging. */
export const ESTIMATE_MAX_USD = Math.max(...Object.values(ESTIMATE_MAX_USD_BY_CHARGE));
/** The smallest estimate: one cent (stress test, 2026-11-24: a per-item price under a dollar must be possible). */
export const ESTIMATE_MIN_USD = 0.01;
/** At this many digits as written (cents included), an amount could be read as a phone number unless it is whole thousands. */
const PHONE_LENGTH_DIGITS = 7;
export const VISIT_NOTE_LIMIT = 300;
/** Beside every estimate the site reads, and under the company's estimate fields. */
export const ESTIMATE_LABEL = "Estimate before a site visit. Not a quote.";
export const ESTIMATES_NOT_CHECKED = "Estimates are each company's own, before a site visit. They are not quotes, and Blueprint does not check them.";
export interface ApplicationEstimate { lowUsd: number; highUsd: number }
/** The estimate an application gave when the site pressed Accept, recorded on the introduction. */
export interface AcceptedEstimate { chargeModel: Exclude<ChargeModel, "undecided">; estimate: ApplicationEstimate }

/** Dollars, with cents only when the estimate has them: "$12,000", "$0.35"; both ends alike in a range ("$45.50 to $60.00"). */
const usd = (value: number, cents: boolean) =>
  "$" + value.toLocaleString("en-US", cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });

/** "$12,000 to $18,000 a month", "$0.35 to $0.50 per task or item", or "$15 an hour" when both ends are the same. */
export function estimateInWords(model: ChargeModel, estimate: ApplicationEstimate): string | null {
  const unit = ESTIMATE_UNITS[model];
  if (!unit || !isApplicationEstimate(estimate, model)) return null;
  const cents = !Number.isInteger(estimate.lowUsd) || !Number.isInteger(estimate.highUsd);
  const range = estimate.lowUsd === estimate.highUsd ? usd(estimate.lowUsd, cents)
    : usd(estimate.lowUsd, cents) + " to " + usd(estimate.highUsd, cents);
  return range + " " + unit;
}

/**
 * Whether an amount's digits, as the site reads them (cents included when it has cents), could be a phone number: seven
 * digits or more that are not whole thousands ("$41,555,501.99" is 415 555 0199; "$1,250,000" is not). So an amount of
 * $10,000 or more takes no cents, and one of $1,000,000 or more is whole thousands.
 */
export function amountReadsAsPhoneNumber(value: number): boolean {
  const cents = Math.round(value * 100);
  const digits = String(cents % 100 === 0 ? cents / 100 : cents);
  return digits.length >= PHONE_LENGTH_DIGITS && cents % 100_000 !== 0;
}

/**
 * One end of an estimate: dollars and cents (at most two decimals), from one cent to `ESTIMATE_MAX_USD` (or the ceiling for
 * the way of charging, when given), and never digits a site could read as a phone number (`amountReadsAsPhoneNumber`).
 */
export function isEstimateAmount(value: unknown, model?: ChargeModel): value is number {
  const ceiling = model && model !== "undecided" ? ESTIMATE_MAX_USD_BY_CHARGE[model] : ESTIMATE_MAX_USD;
  return typeof value === "number" && Number.isFinite(value) && value >= ESTIMATE_MIN_USD && value <= ceiling
    && Math.abs(Math.round(value * 100) - value * 100) < 1e-6 && !amountReadsAsPhoneNumber(value);
}

export function isApplicationEstimate(value: unknown, model?: ChargeModel): value is ApplicationEstimate {
  if (!value || typeof value !== "object") return false;
  const { lowUsd, highUsd } = value as Record<string, unknown>;
  return isEstimateAmount(lowUsd, model) && isEstimateAmount(highUsd, model) && lowUsd <= highUsd;
}

/** The form's limits on an estimate, in words (no dollar sign: these are limits, never a price). */
export const ESTIMATE_LIMITS = "At most 10,000 an hour or per task or item, 1,000,000 a month and 10,000,000 in total. "
  + "Amounts of 10,000 or more take no cents, and amounts of 1,000,000 or more are whole thousands.";
/** The rule for an estimate in words, for a refusal. */
export const ESTIMATE_RULE = `Enter the estimate in US dollars, with at most two decimals and the lower amount first. ${ESTIMATE_LIMITS}`;

export interface CompanyReplyDetails {
  verified?: string;
  question?: string;
  startWindow?: CompanyStartWindow;
  chargeModel?: ChargeModel;
  estimate?: ApplicationEstimate;
  similarJobs?: SimilarJobs;
  visitMustConfirm?: string;
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
export const COMPANY_RESPONSE_STATEMENT_VERSION = "company-response-2026-11-23.2";
export const COMPANY_RESPONSE_STATEMENT = "The site sees your company's name and website with your answer, and any estimate you "
  + "give, as an estimate before a site visit, not a quote. If you apply or answer Tested it: can do and the site accepts, we "
  + "give the site your contact details, and give you theirs.";
/**
 * 2026-11-23, later the same day (owner: "yes build it this way"): an application may carry how the company charges and an
 * optional estimate range. The current line says the site sees the estimate, as one before a site visit and not a quote;
 * an estimate is shown only for an answer given under it (`COMPANY_ESTIMATE_STATEMENT_VERSIONS`).
 */
export const COMPANY_RESPONSE_STATEMENT_2026_11_23_VERSION = "company-response-2026-11-23";
export const COMPANY_RESPONSE_STATEMENT_2026_11_23 = "The site sees your company's name and website with your answer. If you apply or "
  + "answer Tested it: can do and the site accepts, we give the site your contact details, and give you theirs.";
/** The line of 2026-11-12, kept as the record of what an answer given under it agreed to. */
export const COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION = "company-response-2026-11-12";
export const COMPANY_RESPONSE_STATEMENT_2026_11_12 = "The site is told your answer. If you answer Interested or Tested it: can do and the "
  + "site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.";
/** Lines under which an answer tells the site the answer and agrees to an introduction once the site accepts. */
export const COMPANY_RESPONSE_STATEMENT_VERSIONS: readonly string[] = [COMPANY_RESPONSE_STATEMENT_VERSION,
  COMPANY_RESPONSE_STATEMENT_2026_11_23_VERSION, COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION];
/** Lines under which the site also sees the company's name and website with the answer. */
export const COMPANY_NAME_STATEMENT_VERSIONS: readonly string[] = [COMPANY_RESPONSE_STATEMENT_VERSION,
  COMPANY_RESPONSE_STATEMENT_2026_11_23_VERSION];
/** Lines under which the site also sees the estimate an application gives. */
export const COMPANY_ESTIMATE_STATEMENT_VERSIONS: readonly string[] = [COMPANY_RESPONSE_STATEMENT_VERSION];

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
      details?: Pick<CompanyReplyDetails, "verified" | "startWindow" | "chargeModel" | "estimate" | "similarJobs" | "visitMustConfirm">;
      question?: { id: string; text: string;
        /** The site's reply as the company reads it (names and contact details taken out). */
        answer?: string;
        /** The site replied, and the company does not read it yet: its names and contact details are being taken out. */
        answerPending?: true;
        /** The site replied, and the company does not read it: the job reached its limit on checking words. */
        answerLimit?: true;
        /** When the site is asked to reply by (`replyByIso`); absent for a question asked before the window existed. */
        replyByIso?: string };
      /** Some of the company's words exist but the site does not read them yet: names and contact details are being
       * taken out of them (`server/utils/freeTextScreening.ts`). */
      wordsPending?: true;
      /** Some of the company's words are not shown: the job reached its limit on checking words for names. */
      wordsLimit?: true;
      /**
       * The company's name and website, only for an answer given under a line that says the site sees them
       * (`COMPANY_NAME_STATEMENT_VERSIONS`); otherwise the site reads the alias.
       */
      applicant?: { name: string; website: string | null };
      /** The site may press "Accept" for this company now. */
      canIntroduce?: boolean;
      /** When the introduction was made: the company's introduction email was sent (H2). */
      introducedAtIso?: string;
      /** Only after the introduction is made. */
      company?: IntroducedCompany;
      /** The site asked for an introduction that is not made yet: the company's email has not been sent. */
      introductionPending?: boolean;
      /** The site asked for an introduction that could not go ahead: the company's email never went. */
      introductionCancelled?: boolean;
      /**
       * The estimate the answer gave when the site pressed Accept (null: none then), recorded on the introduction, only
       * for an answer under a line that shows the site an estimate. The page says when the estimate changed since.
       */
      acceptedEstimate?: AcceptedEstimate | null;
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
  /**
   * The version of the sentence beside Accept that is true for this job (`siteIntroductions.ts`): the page shows its text
   * and sends this version with the press. Absent: the current one.
   */
  introductionStatementVersion?: string;
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

/**
 * The reply window on a company's question (owner, 2026-11-23, after freight marketplaces: a pending step carries its
 * date). The site is asked to reply within three days of the question; at the date one reminder goes to the site, and
 * after it both sides read that the date has passed. Nothing closes or is held: the site can still reply, and the
 * company can still apply or change its answer.
 */
export const REPLY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export function replyByIso(askedAtIso: string | null | undefined): string | null {
  const at = Date.parse(String(askedAtIso ?? ""));
  return Number.isFinite(at) ? new Date(at + REPLY_WINDOW_MS).toISOString() : null;
}
export const replyByLine = (date: string) => `Please reply by ${date}.`;
export const REPLY_DATE_PASSED = (date: string) => `The reply date, ${date}, has passed. You can still reply.`;
/** On the company's page, while its question waits. */
export const companyQuestionWaiting = (asked: string, by: string) => `You asked on ${asked}. The site is asked to reply by ${by}.`;
export const companyQuestionOverdue = (by: string, reminded: boolean) =>
  `The site has not replied yet. Its reply date was ${by}${reminded ? ", and we reminded it" : ""}.`;
