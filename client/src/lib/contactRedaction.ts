/**
 * Contact details out of a site's free text before a deployment company sees it (2026-11-12).
 *
 * A site's own sentence for its job is shared as written, and a site may type its email, phone number or web address
 * into it. A company gets the site's details only through an introduction the site asks for (package E, E6), so every
 * piece of the site's free text projected to a company goes through `removeContactDetails`: email addresses, phone
 * numbers (international and national forms, at least 7 digits with common separators) and web links become
 * `[removed]`, after normalising look-alike characters (NFKC) and dropping zero-width ones; spelled forms ("owner at
 * site-plant dot com") and bare handles ("@siteplant") count too. Ordinary numbers (weights, sizes, counts, times, "2 shifts", "24/7", dates, thousands) are kept.
 */
export const REMOVED = "[removed]";

/** The site's job page may say this when its sentence held a contact detail (site-side copy). */
export const CONTACT_DETAILS_REMOVED_LINE =
  "We remove contact details from what companies see. They get yours only when you ask for an introduction.";

const EMAIL = /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z0-9-]+)*\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}\b/gi;
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const BARE_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au)\b(?:\/[^\s<>"')]*)?/gi;
/** A run of digits with phone separators, optionally led by + or "(". Checked further in `isPhone`. */
const PHONE_CANDIDATE = /(?:\+|\(\s*)?\d[\d\s().\-/]{4,}\d/g;

function isPhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const text = candidate.trim();
  if (/\//.test(text) && !/^\+/.test(text)) return false; // fractions and "24/7"-style ratios, dates written with slashes
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false; // an ISO date
  if (/^\d{1,3}(?:[ ,.]\d{3})+$/.test(text)) return false; // thousands: "1 200 000", "1.200.000"
  if (/^\d+(?:\.\d+)?$/.test(text) && !/^0/.test(text) && digits.length < 10) return false; // one plain number under ten digits
  return true;
}

/** "owner at site-plant dot com", "site-plant dot example": an address or a domain spelled out in words. */
const SPELLED = /\b[A-Z0-9._%+-]+\s+(?:at|\(at\)|\[at\])\s+[A-Z0-9-]+(?:\s*(?:\s+dot\s+|\(dot\)|\[dot\]|\.)\s*[A-Z0-9-]+)*\s*(?:\s+dot\s+|\(dot\)|\[dot\]|\.)\s*[A-Z]{2,}\b/gi;
const SPELLED_DOMAIN = /\b[A-Z0-9-]+(?:\s+dot\s+[A-Z0-9-]+)*\s+dot\s+(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au|example)\b/gi;
/** A domain with a space before its ending: "siteplant .com". */
const SPACED_DOMAIN = /\b[a-z0-9-]+\s+\.(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au)\b/gi;
/** An address without an ending ("owner@siteplant") or a bare handle ("@siteplant"). */
const HANDLE = /(?:\b[A-Z0-9._%+-]+)?@[A-Z0-9_](?:[A-Z0-9._-]*[A-Z0-9_])?/gi;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** The text with every email address, phone number and web link replaced by `[removed]`. */
export function removeContactDetails(text: string): string {
  // Full-width and look-alike forms ("＠", "ｗｗｗ.") become plain ones, and zero-width characters are dropped, first.
  return text.normalize("NFKC").replace(ZERO_WIDTH, "")
    .replace(EMAIL, REMOVED)
    .replace(SPELLED, REMOVED)
    .replace(SPELLED_DOMAIN, REMOVED)
    .replace(SPACED_DOMAIN, REMOVED)
    .replace(LINK, REMOVED)
    .replace(BARE_DOMAIN, REMOVED)
    .replace(HANDLE, REMOVED)
    .replace(PHONE_CANDIDATE, match => {
      // Keep the separators the match swallowed at its edges.
      const lead = /^\s*/.exec(match)?.[0] ?? "";
      return isPhone(match) ? `${lead}${REMOVED}` : match;
    });
}

/** Whether the text holds a contact detail `removeContactDetails` would remove. */
export function containsContactDetails(text: string): boolean {
  return removeContactDetails(text) !== text.normalize("NFKC").replace(ZERO_WIDTH, "");
}
