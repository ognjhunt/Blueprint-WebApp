/**
 * What the other side reads of a person's own words, shown to that person (2026-11-24): the site sees, on its own job
 * page, exactly what deployment companies read of its sentence, its success rule and its replies, with names,
 * addresses and contact details taken out (`server/utils/freeTextScreening.ts`). No step to confirm: the site reads it
 * and changes its words if it wants to.
 */

/** One piece of the site's words as companies read it, or `pending` while names and contact details are taken out. */
export type CompaniesReadText = { text: string } | { pending: true };
export interface CompaniesReadSiteWords { sentence?: CompaniesReadText; successRule?: CompaniesReadText }

export function isCompaniesReadText(value: unknown): value is CompaniesReadText {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (typeof item.text === "string" && item.text.length > 0) || item.pending === true;
}

export function isCompaniesReadSiteWords(value: unknown): value is CompaniesReadSiteWords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const view = value as Record<string, unknown>;
  return (view.sentence === undefined || isCompaniesReadText(view.sentence))
    && (view.successRule === undefined || isCompaniesReadText(view.successRule));
}

export const COMPANIES_READ_TITLE = "What companies read";
export const COMPANIES_READ_SENTENCE_LABEL = "Your job";
export const COMPANIES_READ_SUCCESS_LABEL = "What counts as done";
/** Under the words: what is taken out, and how to change them. */
export const COMPANIES_READ_LINE = "We take names, addresses and contact details out of your words before companies read them. "
  + "To change what they read, change your job description.";
/** In place of the words while they are being prepared: companies read none of them until then. */
export const COMPANIES_READ_PENDING = "Companies do not see these words yet. We are taking names, addresses and contact details out of them first.";

/** Under the site's reply to a company's question. */
export const replyAsReadLine = (alias: string) => `This is your reply as ${alias} reads it, with names and contact details taken out.`;
export const replyPendingLine = (alias: string) => `${alias} sees your reply once we have taken names and contact details out of it.`;

/** On a company's page, in place of the site's reply while it is being prepared. */
export const SITE_REPLY_BEING_PREPARED = "The site replied. You can read it here once we have taken names and contact details out of it.";
/** On the site's page, under a company's answer whose words are being prepared. */
export const COMPANY_WORDS_BEING_PREPARED = "Their words show here once we have taken names and contact details out of them.";
