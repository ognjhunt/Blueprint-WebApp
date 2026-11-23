/**
 * The automatic check on a deployment company's application (owner direction 2026-11-23: approval in minutes, not
 * days). The published rule: a company is approved at once when its work email is at its website's domain and that
 * website shows it deploys robots. Anything the rule does not settle goes to the owner, with the reasons below.
 *
 * One list, read by the server (`server/utils/companyCheck.ts`, the Slack bell) and the owner's approvals page.
 */

export const COMPANY_CHECK_SCHEMA = "company_check.v1" as const;
/** `decidedBy` on an application the rule approved. The approvals page marks any `auto:` decision as automatic. */
export const COMPANY_CHECK_DECIDED_BY = "auto:company-check.v1";
export const COMPANY_CHECK_DECISION_NOTE = "Approved by the published rule: work email at the website's domain, and the website shows the company deploys robots.";

/** The rule as the application form states it. */
export const COMPANY_CHECK_RULE_SENTENCE = "We approve a company at once when its work email is at its website's domain and the website shows it deploys robots. Otherwise we look ourselves.";

export const COMPANY_CHECK_REASONS = {
  webmail: "The email is at a personal email provider.",
  domain_mismatch: "The email is not at the website's domain.",
  website_invalid: "The website address could not be read.",
  daily_check_cap: "Today's limit of automatic checks was reached.",
  website_unreadable: "The website could not be read.",
  redirected_off_domain: "The website sends visitors to another domain.",
  website_no_text: "The website has too little text to check.",
  no_model: "No model is set up to check websites.",
  model_unavailable: "The model check did not answer.",
  not_a_robot_company: "The website does not show the company deploys robots.",
  unclear: "The website does not say clearly whether the company deploys robots.",
  quote_not_found: "The model's quote is not on the website, so its answer was not used.",
  check_failed: "The check could not run.",
} as const;

export type CompanyCheckReason = keyof typeof COMPANY_CHECK_REASONS;

export interface CompanyCheck {
  schemaVersion: typeof COMPANY_CHECK_SCHEMA;
  checkedAtIso: string;
  outcome: "approved" | "needs_owner";
  reasons: CompanyCheckReason[];
  /** What was checked: the email's domain and the website as given. */
  emailDomain: string;
  website: string | null;
  /** The model's own words, for the owner only, and its quote, checked word for word against the page. */
  modelAnswer?: "yes" | "no" | "unclear";
  modelReason?: string;
  evidenceQuote?: string;
}

export function companyCheckReasonWords(reason: string): string {
  return Object.hasOwn(COMPANY_CHECK_REASONS, reason) ? COMPANY_CHECK_REASONS[reason as CompanyCheckReason] : reason;
}
