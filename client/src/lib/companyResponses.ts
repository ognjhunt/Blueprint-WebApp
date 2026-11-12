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

/** The three answers a company can give. `declined` is the stored name of "Not a fit" (kept from before). */
export const COMPANY_RESPONSE_STATES = ["interested", "declined", "needs_something"] as const;
export type CompanyResponseState = (typeof COMPANY_RESPONSE_STATES)[number];

export const COMPANY_RESPONSE_LABELS: Readonly<Record<CompanyResponseState, string>> = {
  interested: "Interested",
  declined: "Not a fit",
  needs_something: "Would need something",
};

export function isCompanyResponseState(value: unknown): value is CompanyResponseState {
  return typeof value === "string" && (COMPANY_RESPONSE_STATES as readonly string[]).includes(value);
}

/** Under the company's response form in the job library. */
export const RESPONSE_PRIVACY_LINE = "The site is told your response, not your company's name or your words.";

/** A stored alias letter ("A", "B", … "Z", "AA", …) as the site reads it. */
export const companyAliasName = (letter: string) => `Company ${letter}`;

/** One line of the site's "Deployment companies" section. Nothing here comes from a company. */
export type SiteCompanyEntry =
  | { kind: "sent"; alias: string; atIso: string }
  | { kind: "answered"; alias: string; atIso: string; state: CompanyResponseState };

/** What the site's job page receives about companies: its entries in date order, and whether any company is interested. */
export interface SiteCompanyActivity {
  entries: SiteCompanyEntry[];
  interested: boolean;
}

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
