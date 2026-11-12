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

/* ------------------------------------------------------------------ the site's own identity and street addresses */

/** What the website holds about the site, decrypted on the server: names, organisation, typed address, email, phone. */
export interface KnownSiteIdentity {
  /** Personal or organisation names (site name, organisation, contact name, submitter name): each becomes "the site". */
  names: Array<string | null | undefined>;
  /** Addresses as the site typed them: each whole, and each line or comma-separated part, is removed. */
  addresses: Array<string | null | undefined>;
  /** Emails and phone numbers the site gave: each becomes `[removed]`. */
  contacts: Array<string | null | undefined>;
}

const COUNTRY_WORDS = new Set(["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america", "uk", "u.k.",
  "united kingdom", "great britain", "england", "canada", "mexico", "germany", "france", "australia", "ireland", "netherlands"]);

/** A known value as a pattern: case-insensitive, any whitespace or punctuation (or none) between its words. */
function knownValuePattern(value: string, withPlaceWord = false): RegExp | null {
  const words = value.normalize("NFKC").replace(ZERO_WIDTH, "").split(/[^\p{L}\p{N}@]+/u).filter(Boolean);
  if (!words.length || words.join("").length < 3) return null;
  const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // A leading "+" or "(" of a phone number, and a place word right before an address ("at", "on", "from" …), go with it.
  return new RegExp(`${withPlaceWord ? "(?:\\b(?:at|on|in|near|from)\\s+)?" : ""}[+(]?(?<![\\p{L}\\p{N}])${escaped.join("[\\s\\p{P}\\p{S}]*")}(?![\\p{L}\\p{N}])`, "giu");
}

/** The parts of a typed address worth removing on their own: lines and comma parts of three or more characters that
 * are not just a country or a number. */
function addressParts(address: string): string[] {
  return address.split(/[\n,;]+/).map(part => part.trim())
    .filter(part => part.length >= 3 && !/^[\d\s#-]+$/.test(part) && !COUNTRY_WORDS.has(part.toLowerCase().replace(/\s+/g, " ")));
}

/** Street-shaped text even when we do not hold it: a number, one to four words and a street word, an optional unit and
 * postal code. Words like "place", "way" or "court" count only when written as a name ("Mill Place"), so "pick 2 totes
 * and place them" is untouched; the middle words never include little joining words ("and", "the", "on" …). */
const STREET_WORDS_ANY = "street|avenue|ave|road|rd|lane|boulevard|blvd|highway|hwy|parkway|pkwy";
const STREET_WORDS_NAMED = "St|Ln|Dr|Drive|Way|Court|Ct|Place|Pl|Square|Sq|Terrace";
const MIDDLE = "(?!(?:and|or|the|a|an|to|on|in|of|at|by|for|from|onto|into|then|up|down|per|with|each|every|boxes|cartons|totes|pallets|items|parts|bins|shifts|hours|minutes|kg|lb|cm|mm|m)\\b)[\\p{L}][\\p{L}'.-]*";
const LEAD = "(?:\\b(?:[Aa]t|[Oo]n|[Ii]n|[Nn]ear|[Ff]rom)\\s+)?";
const UNIT_AND_POSTAL = "(?:\\s*,?\\s*(?:[Uu]nit|[Ss]uite|[Ss]te|[Aa]pt|[Aa]partment|#)\\s*[\\w-]+)?(?:\\s*,?\\s*\\d{5}(?:-\\d{4})?)?";
const STREET = new RegExp(
  `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_NAMED})\\b${UNIT_AND_POSTAL}`, "gu");
const STREET_ANY_CASE = new RegExp(
  `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_ANY})\\b${UNIT_AND_POSTAL}`, "giu");

/** Tidy what removal leaves: doubled spaces and commas, a space before punctuation, a comma at either end. */
function tidy(text: string): string {
  return text
    // A place word left with nothing after it ("in ," once "in Springfield" is gone).
    .replace(/\b(at|in|near|on)\s*(?=[,.;]|$)/gi, "")
    // …or before another place word ("at to the dock" once "at 12 Mill Road" is gone).
    .replace(/\b(at|in|near|on)\s+(?=(?:to|from|in|on|at)\b)/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])(\s*[,;:])+/g, "$1").replace(/\(\s*\)/g, "")
    .replace(/[,;:]\s*\./g, ".").replace(/\s{2,}/g, " ").replace(/^[\s,;:]+|[\s,;:]+$/g, "");
}

/**
 * The site's sentence as a company may read it. In order: the site's own known identity (every name the record holds
 * becomes "the site"; every typed address, whole and in its parts, is removed; its own email and phone become
 * `[removed]`), then street-shaped text we do not hold, then any other email, phone number or link
 * (`removeContactDetails`).
 *
 * The remaining limit, plainly: a name the site never gave us anywhere else, or an address written in an unusual way
 * (no number, no street word, spelled out), can still get through. Ordinary numbers and quantities are kept.
 */
export function removeIdentifyingDetails(text: string, known: KnownSiteIdentity): string {
  let out = text.normalize("NFKC").replace(ZERO_WIDTH, "");
  const values = (list: Array<string | null | undefined>) => list.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  // Longest first, so a whole address or a full name goes before its parts.
  const byLength = (list: string[]) => [...new Set(list)].sort((a, b) => b.length - a.length);
  for (const value of byLength(values(known.contacts))) {
    const pattern = knownValuePattern(value);
    if (pattern) out = out.replace(pattern, REMOVED);
  }
  for (const value of byLength(values(known.addresses).flatMap(address => [address, ...addressParts(address)]))) {
    const pattern = knownValuePattern(value, true);
    if (pattern) out = out.replace(pattern, "");
  }
  for (const value of byLength(values(known.names))) {
    const pattern = knownValuePattern(value);
    if (pattern) out = out.replace(pattern, "the site");
  }
  out = out.replace(STREET_ANY_CASE, "").replace(STREET, "");
  out = out.replace(/\bthe site(\s+the site)+\b/gi, "the site");
  return tidy(removeContactDetails(out));
}

/** Whether `removeIdentifyingDetails` would change the text: the site's page may then say `CONTACT_DETAILS_REMOVED_LINE`. */
export function identifyingDetailsRemoved(text: string, known: KnownSiteIdentity): boolean {
  return removeIdentifyingDetails(text, known) !== tidy(text.normalize("NFKC").replace(ZERO_WIDTH, ""));
}
