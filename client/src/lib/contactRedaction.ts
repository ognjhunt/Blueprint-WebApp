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
  /**
   * The site's own name and its organisation's name (also in `names`): each distinctive word of four or more letters
   * is also removed on its own, where the sentence writes it with a capital first letter.
   */
  organisations?: Array<string | null | undefined>;
  /** Addresses as the site typed them: each whole, and each line or comma-separated part, is removed. */
  addresses: Array<string | null | undefined>;
  /** Emails and phone numbers the site gave: each becomes `[removed]`. */
  contacts: Array<string | null | undefined>;
}

const COUNTRY_WORDS = new Set(["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america", "uk", "u.k.",
  "united kingdom", "great britain", "england", "canada", "mexico", "germany", "france", "australia", "ireland", "netherlands"]);

/** Accents folded (NFKD, combining marks dropped), look-alikes normalised, zero-width characters dropped. */
function fold(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH, "").normalize("NFKD").replace(/\p{M}+/gu, "").normalize("NFC");
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A word of a held name: one of six or more letters may be written with separators between its letters ("Zebra
 * Plant", "Z.E.B.R.A.P.L.A.N.T."). */
function wordPattern(word: string): string {
  return /^\p{L}{6,}$/u.test(word) ? [...word].map(escapeRegExp).join("[\\s._-]*") : escapeRegExp(word);
}

/** Street words and their short forms, so a held "Quokka Lane" also finds "Quokka Ln". */
const STREET_FORMS: ReadonlyArray<readonly string[]> = [["street", "st"], ["avenue", "ave"], ["road", "rd"], ["lane", "ln"],
  ["drive", "dr"], ["boulevard", "blvd"], ["highway", "hwy"], ["parkway", "pkwy"], ["court", "ct"], ["place", "pl"], ["square", "sq"]];
function streetFormPattern(word: string): string | null {
  const forms = STREET_FORMS.find(list => list.includes(word.toLowerCase()));
  return forms ? `(?:${forms.join("|")})\\.?` : null;
}

/** A known value as a pattern: case-insensitive, any whitespace or punctuation (or none) between its words. */
function knownValuePattern(value: string, withPlaceWord = false): RegExp | null {
  const words = fold(value).split(/[^\p{L}\p{N}@]+/u).filter(Boolean);
  if (!words.length || words.join("").length < 3) return null;
  const escaped = words.map(word => (withPlaceWord ? streetFormPattern(word) : null) ?? wordPattern(word));
  // A leading "+" or "(" of a phone number, and a place word right before an address ("at", "on", "from" …), go with it.
  return new RegExp(`${withPlaceWord ? "(?:\\b(?:at|on|in|near|from)\\s+)?" : ""}[+(]?(?<![\\p{L}\\p{N}])${escaped.join("[\\s\\p{P}\\p{S}]*")}(?![\\p{L}\\p{N}])`, "giu");
}

/** The parts of a typed address worth removing on their own: lines and comma parts of three or more characters that
 * are not just a country or a number, and a postal code it holds (five digits) alone. */
function addressParts(address: string): string[] {
  const parts = address.split(/[\n,;]+/).map(part => part.trim())
    .filter(part => part.length >= 3 && !/^[\d\s#-]+$/.test(part) && !COUNTRY_WORDS.has(part.toLowerCase().replace(/\s+/g, " ")));
  // The street without its number ("Quokka Lane" from "77 Quokka Lane"), so a mention without the number goes too.
  const streets = parts.map(part => /^\d+[A-Za-z]?\s+(.*\S)$/.exec(part)?.[1]).filter((rest): rest is string => typeof rest === "string"
    && rest.split(/\s+/).length >= 2);
  return [...parts, ...streets, ...(address.match(/\b\d{5}(?:-\d{4})?\b/g) ?? [])];
}

/** Words that never identify a site on their own, so never removed alone (the full name still is): generic business,
 * street, workplace and place words, months, weekdays and compass directions. The one list of them. */
const GENERIC_NAME_WORDS = new Set(["foods", "food", "logistics", "group", "company", "warehouse", "fresh", "services", "supply",
  "store", "market", "kitchen", "laundry", "hotel", "farm", "works", "systems", "solutions", "industries", "holdings", "inc", "llc",
  "ltd", "corp", "corporation", "limited", "plant", "factory", "center", "centre", "distribution", "the", "and",
  "street", "avenue", "road", "lane", "boulevard", "highway", "parkway", "drive", "court", "place", "square", "terrace", "way",
  "boxes", "cartons", "totes", "pallets", "items", "parts", "bins", "shifts", "hours", "minutes", "line", "dock", "site",
  // Months, weekdays and compass directions are written with a capital anyway ("the March batch", "carry it North").
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
  "northern", "southern", "eastern", "western",
  // Ordinary workplace and place words (planner, 2026-11-12, H3): everyday sentences stay whole.
  "station", "robot", "bay", "cell", "zone", "aisle", "shelf", "rack", "tote", "box", "pallet", "conveyor", "machine",
  "press", "oven", "counter", "safety", "quality", "central", "main", "national", "american", "united", "general", "first",
  "global", "pacific", "atlantic", "metro", "city", "valley", "mountain", "river", "lake", "coast", "green", "blue", "red",
  "gold", "silver", "royal", "premier", "express", "direct", "quick", "clean", "bright", "smart"]);

/** Whether a match at `offset` starts a sentence, so its replacement keeps the capital ("The site handles it."). */
function startsSentence(text: string, offset: number): boolean {
  const before = text.slice(0, offset).replace(/["'“‘(\[\s]+$/u, "");
  return before.length === 0 || /[.!?:;\n]$/.test(before);
}

/** A distinctive word of the site's or organisation's name, alone, only where the sentence capitalises it ("Acme"). */
function capitalisedWordPattern(word: string): RegExp | null {
  const folded = fold(word);
  if (!/^\p{L}{4,}$/u.test(folded) || GENERIC_NAME_WORDS.has(folded.toLowerCase())) return null;
  const [first, ...rest] = [...folded];
  const tail = rest.map(letter => `[${escapeRegExp(letter.toLowerCase())}${escapeRegExp(letter.toUpperCase())}]`).join("");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(first.toUpperCase())}${tail}(?![\\p{L}\\p{N}])`, "gu");
}

/** Street-shaped text even when we do not hold it: a number, one to four words and a street word, an optional unit and
 * postal code. Words like "place", "way" or "court" count only when written as a name ("Mill Place"), so "pick 2 totes
 * and place them" is untouched; the middle words never include little joining words ("and", "the", "on" …). */
const STREET_WORDS_ANY = "street|avenue|ave|road|rd|lane|boulevard|blvd|highway|hwy|parkway|pkwy";
const STREET_WORDS_NAMED = "Ln|Dr|Way|Ct|Pl|Square|Sq|Terrace";
/** Street words that are also ordinary job words ("10 Drive units", "1 Place", "15 Court files", "5 St Bernards"): a
 * street only with a capitalised name word right before them ("Mill Place"), or a unit or postal code after. */
const STREET_WORDS_WEAK = "Drive|Place|Court|St";
const MIDDLE = "(?!(?:and|or|the|a|an|to|on|in|of|at|by|for|from|onto|into|then|up|down|per|with|each|every|boxes|cartons|totes|pallets|items|parts|bins|shifts|hours|minutes|kg|lb|cm|mm|m)\\b)[\\p{L}][\\p{L}'.-]*";
const LEAD = "(?:\\b(?:[Aa]t|[Oo]n|[Ii]n|[Nn]ear|[Ff]rom)\\s+)?";
/** A unit or suite with its number ("Suite 5", "Unit 4B", "#12"; never "units"), and a postal code. */
const UNIT = "(?:(?:[Uu]nit|[Ss]uite|[Ss]te|[Aa]pt|[Aa]partment)\\b\\.?\\s*#?\\s*|#\\s*)[\\w-]*\\d[\\w-]*";
const POSTAL = "\\d{5}(?:-\\d{4})?(?![\\p{L}\\p{N}])";
const UNIT_AND_POSTAL = `(?:\\s*,?\\s*${UNIT})?(?:\\s*,?\\s*${POSTAL})?`;
const STREET = new RegExp(
  `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_NAMED})\\b${UNIT_AND_POSTAL}`, "gu");
const NAME_WORD = "[\\p{Lu}][\\p{L}'.-]*";
const STREET_WEAK_NAMED = new RegExp(
  `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+(?:${MIDDLE}\\s+){0,2}${NAME_WORD}\\s+(?:${STREET_WORDS_WEAK})\\b${UNIT_AND_POSTAL}`, "gu");
const STREET_WEAK_WITH_UNIT = new RegExp(
  `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_WEAK})\\b`
  + `(?:\\s*,?\\s*${UNIT}|\\s*,?\\s*${POSTAL})+`, "gu");
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
    .replace(/[,;:]\s*\./g, ".").replace(/\s{2,}/g, " ").replace(/^[\s,;:]+|[\s,;:]+$/g, "")
    // An article left before "the site" ("the the site", "a the site", "at the the site"); a capital is kept.
    .replace(/\b(?:(?:the|a|an)\s+)+(?=the site\b)/gi, (articles: string) => /^[A-Z]/.test(articles) ? "\u0000" : "")
    .replace(/\u0000the site/g, "The site");
}

/**
 * The site's sentence as a company may read it. In order: the site's own known identity (every name the record holds
 * becomes "the site"; every typed address, whole and in its parts, is removed; its own email and phone become
 * `[removed]`), then street-shaped text we do not hold, then any other email, phone number or link
 * (`removeContactDetails`).
 *
 * Matching folds accents on both sides, lets a held name word of six or more letters be written with separators
 * between its letters ("Zebra Plant", "Z.E.B.R.A.P.L.A.N.T."), finds a held street in its short form ("Quokka Ln") and a
 * held postal code alone, and removes each distinctive word (four or more letters, not a generic business word) of the
 * site's or organisation's name on its own where the sentence writes it with a capital first letter ("Acme").
 *
 * The capitalised-word rule applies wherever the word is capitalised, the first word of a sentence included; it never
 * applies to the ordinary words in `GENERIC_NAME_WORDS` (business, street, workplace and place words, months, weekdays,
 * compass directions).
 *
 * The remaining limit, exactly: nicknames, abbreviations, landmarks, a reordered address, a street with no street word
 * and a state or region spelled differently from the record can still get through. Ordinary numbers and quantities are
 * kept.
 */
export function removeIdentifyingDetails(text: string, known: KnownSiteIdentity): string {
  let out = fold(text);
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
    if (pattern) out = out.replace(pattern, (...args: unknown[]) =>
      startsSentence(String(args[args.length - 1]), Number(args[args.length - 2])) ? "The site" : "the site");
  }
  for (const word of new Set(values(known.organisations ?? []).flatMap(name => name.split(/[^\p{L}\p{N}]+/u)))) {
    const pattern = capitalisedWordPattern(word);
    // Wherever it is capitalised, the first word of a sentence included (privacy over a mangled sentence).
    if (pattern) out = out.replace(pattern, (_match: string, offset: number, whole: string) =>
      startsSentence(whole, offset) ? "The site" : "the site");
  }
  out = out.replace(STREET_ANY_CASE, "").replace(STREET, "").replace(STREET_WEAK_NAMED, "").replace(STREET_WEAK_WITH_UNIT, "");
  out = out.replace(/\bthe site(\s+the site)+\b/gi, "the site");
  return tidy(removeContactDetails(out));
}

/** Whether `removeIdentifyingDetails` would change the text: the site's page may then say `CONTACT_DETAILS_REMOVED_LINE`. */
export function identifyingDetailsRemoved(text: string, known: KnownSiteIdentity): boolean {
  return removeIdentifyingDetails(text, known) !== tidy(fold(text));
}
