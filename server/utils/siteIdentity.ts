/**
 * What the job record holds that names or reaches the site, decrypted (the site's name, its organisation, the contact
 * and submitter names, the typed address and its parts, email and phone). Read only to REMOVE it from the site's own
 * words before they leave the website: from the sentence a deployment company reads (`companyJobPage.ts`) and from the
 * task context the Pipeline reads (`websiteTaskContext.ts`). Never logged, never returned to anyone.
 */
import type { KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { decryptFieldValue } from "./field-encryption";

export async function knownSiteIdentity(record: Record<string, any>): Promise<KnownSiteIdentity> {
  const read = async (value: unknown): Promise<string | null> => {
    if (value === null || value === undefined || value === "") return null;
    // A stored field that cannot be decrypted is unknown, not absent: removing identity with it missing would let
    // the name through. Fail closed: the caller retries later (the Pipeline's projection) or shows nothing (a page).
    try { return String(await decryptFieldValue(value as never) ?? "").trim() || null; }
    catch { throw new Error("site_identity_unreadable"); }
  };
  const contact = record.contact ?? {}, request = record.request ?? {}, place = request.siteLocationMetadata ?? {};
  // In parallel: each field may be one key-service call, and some callers read this inside a transaction.
  const [first, last, company, email, phone, siteName, siteLocation, formatted, city, postal] = await Promise.all([
    read(contact.firstName), read(contact.lastName), read(contact.company), read(contact.email), read(contact.phone),
    read(request.siteName), read(request.siteLocation), read(place.formattedAddress), read(place.city), read(place.postalCode)]);
  const plain = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const placeholder = (value: string | null) => value === "Untitled site" || value === "Location pending" ? null : value;
  return {
    names: [placeholder(siteName), company, first && last ? `${first} ${last}` : null, first, last,
      plain(record.siteName), plain(record.submitterName), plain(record.contactFirstName), plain(record.contactName)],
    // The site's and the organisation's own names: their distinctive words are removed alone too, when capitalised.
    organisations: [placeholder(siteName), company, plain(record.siteName)],
    addresses: [placeholder(siteLocation), formatted, city, postal, plain(record.site_address)],
    contacts: [email, phone, plain(record.contactEmail), plain(record.contactPhone)],
  };
}
