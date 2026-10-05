/** Owner decision 2026-10-05 (contact sources): a plain LinkedIn people-search link the founder may open
 * to find who runs the task at an outreach-ready hypothesis's operator. Blueprint never fetches it, never
 * stores what it shows and never treats LinkedIn as evidence for a person or an address
 * (communications-contact-evidence isLinkedInUrl refuses it as a source). This module does no I/O. */
export const LINKEDIN_PEOPLE_SEARCH_PREFIX = "https://www.linkedin.com/search/results/people/?keywords=";

export function linkedinPeopleSearchUrl(role: string, operator: string) {
  return LINKEDIN_PEOPLE_SEARCH_PREFIX + encodeURIComponent(`${role.trim()} ${operator.trim()}`);
}

const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
/** The link for an outreach-ready hypothesis brief: the published role (the recipient, or the person
 * behind an inbox), else the brief's decision owner, else "operations manager", with the operator's
 * name. Null for any other brief. Reads the brief only; computed on each read and never stored. */
export function linkedinPeopleSearchHint(brief: unknown): { url: string; role: string; operator: string } | null {
  const value = brief && typeof brief === "object" && !Array.isArray(brief) ? brief as Record<string, any> : null;
  if (!value?.qualification || !text(value.facilityName)) return null;
  const recipient = value.contact?.recipient;
  const published = recipient?.kind === "named_person" ? recipient.role : recipient?.kind === "inbox" ? recipient.person?.role : undefined;
  const role = text(published) ? published.trim() : text(value.decisionOwner) ? value.decisionOwner.trim() : "operations manager";
  const operator = value.facilityName.trim();
  return { url: linkedinPeopleSearchUrl(role, operator), role, operator };
}
