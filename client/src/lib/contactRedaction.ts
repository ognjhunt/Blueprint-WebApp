/**
 * Contact details out of a site's free text before a deployment company sees it (2026-11-12).
 *
 * A site's own sentence for its job is shared as written, and a site may type its email, phone number or web address
 * into it. A company gets the site's details only through an introduction the site asks for (package E, E6), so every
 * piece of the site's free text projected to a company goes through `removeContactDetails`: email addresses, phone
 * numbers (international and national forms, at least 7 digits with common separators) and web links become
 * `[removed]`, after normalising look-alike characters (NFKC) and dropping zero-width ones; spelled forms ("owner at
 * site-plant dot com") and bare handles ("@siteplant") count too. Ordinary numbers (weights, sizes, counts, times, "2 shifts", "24/7", dates, thousands) are kept.
 *
 * Widened 2026-11-24 (a $0 stress test: 17 of 28 realistic sentences leaked): a web address with any ending
 * ("harborfresh.farm", "harborfresh.co.nz"), a phone number with letters in it ("1-800-FLOWERS") or spelled in words
 * ("four one five, five five five, …"), and a social handle written without "@" after the network's name ("on instagram
 * as harborfreshfoods"). Pattern matching alone always leaks something (a lower-case name, a business name in ordinary
 * words), so a model pass (`server/utils/freeTextScreening.ts`) runs on the text these patterns leave, these patterns
 * run again on what it returns, and the other side reads the words only once that pass has succeeded.
 */
export const REMOVED = "[removed]";

/** The site's job page may say this when its sentence held a contact detail (site-side copy). */
export const CONTACT_DETAILS_REMOVED_LINE =
  "We remove contact details from what companies see. They get yours only when you ask for an introduction.";

const EMAIL = /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z0-9-]+)*\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}\b/gi;
/** A web link, without the punctuation that ends the sentence around it ("see https://x.example/a, thanks"). */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')]*[^\s<>"'.,;:!?)]/gi;
const BARE_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au)\b(?:\/[^\s<>"')]*)?/gi;
/**
 * A web address with any ending ("harborfresh.farm", "acme.co.nz", "plant.example"): labels joined by dots, the last of
 * two or more lower-case letters (a typed web address is lower case, so "the dock.Then" and "St.Louis" are not one),
 * with no letter or digit right after it. The label before the ending has two characters at least, so "e.g." and
 * "i.e." stay, and a file's name ("report.pdf", "cell.step") is not a web address.
 */
const FILE_ENDINGS = "pdf|jpe?g|png|gif|heic|webp|svg|docx?|xlsx?|pptx?|csv|txt|mp4|mov|avi|webm|zip|stl|step|stp|dxf|dwg|json|xml";
const ANY_DOMAIN = new RegExp("(?<![\\p{L}\\p{N}@._-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)*[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]"
  + `\\.(?!(?:${FILE_ENDINGS})(?![\\p{L}\\p{N}]))[a-z]{2,24}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])(?:\\/[^\\s<>"')]*[^\\s<>"'.,;:!?)])?`, "gu");
/** A run of digits with phone separators, optionally led by + or "(". Checked further in `isPhone`. */
const PHONE_CANDIDATE = /(?:\+|\(\s*)?\d[\d\s().\-/]{4,}\d/g;

const RANGE_UNIT = /^\s+(?:boxes?|cartons?|cases?|totes?|items?|pieces?|units?|pallets?|parts?|bins?|cycles?|mm|cm|m|kg|g|lbs?|oz|seconds?|minutes?|hours?)\b/i;

function isPhone(candidate: string, following: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const text = candidate.trim();
  if (/\//.test(text) && !/^\+/.test(text)) return false; // fractions and "24/7"-style ratios, dates written with slashes
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false; // an ISO date
  if (/^\d{1,3}(?:[ ,.]\d{3})+$/.test(text)) return false; // thousands: "1 200 000", "1.200.000"
  if (/^\d+(?:\.\d+)?$/.test(text) && !/^0/.test(text) && digits.length < 10) return false; // one plain number under ten digits
  const range = /^(\d{1,4})\s*-\s*(\d{1,4})$/.exec(text); // a range, such as "1000-2000 boxes a week"
  if (range && range[1].length === range[2].length && Number(range[1]) < Number(range[2]) && RANGE_UNIT.test(following)) return false;
  return true;
}

/** "owner at site-plant dot com", "site-plant dot example": an address or a domain spelled out in words. */
const SPELLED = /\b[A-Z0-9._%+-]+\s+(?:at|\(at\)|\[at\])\s+[A-Z0-9-]+(?:\s*(?:\s+dot\s+|\(dot\)|\[dot\]|\.)\s*[A-Z0-9-]+)*\s*(?:\s+dot\s+|\(dot\)|\[dot\]|\.)\s*[A-Z]{2,}\b/gi;
const SPELLED_DOMAIN = /\b[A-Z0-9-]+(?:\s+dot\s+[A-Z0-9-]+)*\s+dot\s+(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au|example)\b/gi;
/** A domain with a space before its ending: "siteplant .com". */
const SPACED_DOMAIN = /\b[a-z0-9-]+\s+\.(?:com|net|org|io|co|us|uk|ca|de|fr|eu|info|biz|ai|app|dev|shop|store|site|online|tech|me|nl|au)\b/gi;
/** An address without an ending ("owner@siteplant") or a bare handle ("@siteplant"). */
const HANDLE = /(?:\b[A-Z0-9._%+-]+)?@[A-Z0-9_](?:[A-Z0-9._-]*[A-Z0-9_])?/gi;
/**
 * A social handle written without "@", after the network's name and a joining word or a colon ("on instagram as
 * harborfreshfoods", "Instagram: harbor.fresh", "our tiktok is harborfresh"). The network's name stays; the handle goes.
 * A little word in the handle's place ("our instagram is the best") is not a handle.
 */
const SOCIAL_NETWORK = "instagram|insta|facebook|twitter|tiktok|linkedin|youtube|snapchat|telegram|whatsapp|wechat|pinterest"
  + "|bluesky|mastodon|discord|etsy";
const SOCIAL_HANDLE = new RegExp(`((?<![\\p{L}\\p{N}])(?:${SOCIAL_NETWORK})(?:\\s+(?:page|account|handle|profile|channel))?`
  + `(?:\\s*[:\\-\\u2013]\\s*|\\s+(?:as|at|is|under|called|named|handle|username|user)\\s+))`
  + `(?!(?:a|an|the|our|us|we|it|its|well|too|also|and|or|for|to|daily|today|now|soon|great|best|down|up|on|off)(?![\\p{L}\\p{N}_.]))`
  + `([\\p{L}\\p{N}_](?:[\\p{L}\\p{N}_.]{0,28}[\\p{L}\\p{N}_])?)(?![\\p{L}\\p{N}_])`, "giu");

/**
 * A phone number with letters in it ("1-800-FLOWERS", "+1 (800) flowers"): with a leading "1" or "+1", three digits and
 * seven letters or digits, three of them letters at least; without it, the same in capital letters ("800-FLOWERS"). A
 * hyphenated word after it ("300-CARTONS-PER-HOUR") makes it not one.
 */
const VANITY_PHONE = /(?<![\p{L}\p{N}])(?:\+?1[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?(?=(?:[0-9-]*[A-Za-z]){3})[A-Za-z0-9]{3}-?[A-Za-z0-9]{4}|\(?[2-9]\d{2}\)?[\s.-]?(?=(?:[0-9-]*[A-Z]){3})[A-Z0-9]{3}-?[A-Z0-9]{4})(?![\p{L}\p{N}]|-[\p{L}\p{N}])/gu;

/** A digit as a word, and a run of digits and digit words: a phone number may be spelled out ("four one five, five five
 * five, zero one nine nine"). */
const DIGIT_WORD = "(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)";
const SPELLED_PHONE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${DIGIT_WORD}|\\d{1,4})(?:[\\s,.\\-]+(?:${DIGIT_WORD}|\\d{1,4}))+(?![\\p{L}\\p{N}])`, "giu");
const DIGIT_WORD_ALONE = new RegExp(`(?<![\\p{L}])${DIGIT_WORD}(?![\\p{L}])`, "giu");
/** Seven to fifteen digits in the run, three of them as words at least: a phone number, not a count ("two shifts"). */
function isSpelledPhone(run: string): boolean {
  const words = run.match(DIGIT_WORD_ALONE)?.length ?? 0;
  const digits = words + (run.match(/\d/g)?.length ?? 0);
  return words >= 3 && digits >= 7 && digits <= 15;
}
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/**
 * Which rules apply. Everything that crosses between a site and a deployment company uses the current ones. The
 * Pipeline's task context keeps the rules of 2026-11-19 (`websiteTaskContext.ts`): records already bound to the digest
 * of a job's context (its preparation grant, its sealed context) must keep the same text, so nothing paid is bought
 * again. Widening the Pipeline's copy too would need a new version of the field that marks a job's context as cleaned.
 */
export type RedactionRules = "2026-11-19" | "2026-11-24";
export const CURRENT_REDACTION_RULES: RedactionRules = "2026-11-24";
const widened = (rules: RedactionRules) => rules !== "2026-11-19";

/** The text with every email address, phone number and web link replaced by `[removed]`. */
export function removeContactDetails(text: string, rules: RedactionRules = CURRENT_REDACTION_RULES): string {
  // Full-width and look-alike forms ("＠", "ｗｗｗ.") become plain ones, and zero-width characters are dropped, first.
  const wide = widened(rules);
  let out = text.normalize("NFKC").replace(ZERO_WIDTH, "")
    .replace(EMAIL, REMOVED)
    .replace(SPELLED, REMOVED)
    .replace(SPELLED_DOMAIN, REMOVED)
    .replace(SPACED_DOMAIN, REMOVED)
    .replace(LINK, REMOVED);
  // Any ending first, so "acme.co.nz" goes whole before the listed endings could take "acme.co" alone.
  if (wide) out = out.replace(ANY_DOMAIN, REMOVED);
  out = out.replace(BARE_DOMAIN, REMOVED).replace(HANDLE, REMOVED);
  if (wide) out = out.replace(SOCIAL_HANDLE, (_match: string, network: string) => `${network}${REMOVED}`)
    .replace(VANITY_PHONE, REMOVED)
    .replace(SPELLED_PHONE, (match: string) => isSpelledPhone(match) ? REMOVED : match);
  return out
    .replace(PHONE_CANDIDATE, (match: string, offset: number, normalized: string) => {
      // Keep the separators the match swallowed at its edges.
      const lead = /^\s*/.exec(match)?.[0] ?? "";
      return isPhone(match, normalized.slice(offset + match.length)) ? `${lead}${REMOVED}` : match;
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
function knownValuePattern(value: string, withPlaceWord = false, wide = false): RegExp | null {
  const words = fold(value).split(/[^\p{L}\p{N}@]+/u).filter(Boolean);
  if (!words.length || words.join("").length < 3) return null;
  const escaped = words.map(word => (withPlaceWord ? streetFormPattern(word) : null) ?? wordPattern(word));
  // A leading "+" or "(" of a phone number, and a place word right before an address ("at", "on", "from" …), go with it;
  // under the current rules, so does a title right before a name ("Mr. Hlington").
  const lead = withPlaceWord ? "(?:\\b(?:at|on|in|near|from)\\s+)?" : wide ? "(?:\\b(?:Mr|Mrs|Ms|Mx|Dr|Miss|Mister)\\.?\\s+)?" : "";
  // Under the current rules, a held place takes a postal code written right after it with it ("Oakland, CA 94607").
  const tail = withPlaceWord && wide ? "(?:\\s*,?\\s*\\d{5}(?:-\\d{4})?(?![\\p{L}\\p{N}]))?" : "";
  return new RegExp(`${lead}[+(]?(?<![\\p{L}\\p{N}])${escaped.join("[\\s\\p{P}\\p{S}]*")}(?![\\p{L}\\p{N}])${tail}`, "giu");
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

/** Months, weekdays and compass directions: written with a capital anyway ("the March batch", "carry it North"). */
const CALENDAR_AND_COMPASS_WORDS = new Set(["january", "february", "march", "april", "june", "july", "august", "september",
  "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest", "northern", "southern", "eastern", "western"]);

/** Words that never identify a site on their own, so never removed alone (the full name still is): generic business,
 * street, workplace and place words, months, weekdays and compass directions. The one list of them. */
const GENERIC_NAME_WORDS = new Set(["foods", "food", "logistics", "group", "company", "warehouse", "fresh", "services", "supply",
  "store", "market", "kitchen", "laundry", "hotel", "farm", "works", "systems", "solutions", "industries", "holdings", "inc", "llc",
  "ltd", "corp", "corporation", "limited", "plant", "factory", "center", "centre", "distribution", "the", "and",
  "street", "avenue", "road", "lane", "boulevard", "highway", "parkway", "drive", "court", "place", "square", "terrace", "way",
  "boxes", "cartons", "totes", "pallets", "items", "parts", "bins", "shifts", "hours", "minutes", "line", "dock", "site",
  ...CALENDAR_AND_COMPASS_WORDS,
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

/**
 * Street-shaped text even when we do not hold it: a number, up to four words and a street word, an optional unit,
 * city, state and postal code ("77 Quokka Lane, Springfield, IL 62704"). Street words that are also ordinary job words
 * count only where a name makes them a street: lane, road and the like after a capitalised name word ("77 Quokka Lane",
 * "400 Industrial parkway"), or before a unit, a city or a postal code ("12 harbour road 90210"), so "move 2 trays along
 * conveyor lane" is untouched; Drive, Place, Court and St likewise ("Mill Place"), so "pick 2 totes and place them" is
 * untouched. The middle words never include little joining words ("and", "the", "on" …). The rules are the retired
 * Pipeline job packet export's (`redact_contacts`, 2026-11-19), carried here so the one delivery path keeps them.
 */
const anyCase = (word: string) => [...word].map(letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`).join("");
const STREET_WORDS_CLEAR = ["street", "avenue", "ave", "boulevard", "blvd", "highway", "hwy", "parkway", "pkwy"]
  .map(anyCase).join("|");
const STREET_WORDS_ANY = [STREET_WORDS_CLEAR, ...["road", "rd", "lane"].map(anyCase)].join("|");
const STREET_WORDS_NAMED = "Ln|Dr|Way|Ct|Pl|Square|Sq|Terrace";
/** Street words that are also ordinary job words ("10 Drive units", "1 Place", "15 Court files", "5 St Bernards"): a
 * street only with a capitalised name word right before them ("Mill Place"), or a unit or postal code after. */
const STREET_WORDS_WEAK = "Drive|Place|Court|St";
const JOINING = ["and", "or", "the", "a", "an", "to", "on", "in", "of", "at", "by", "for", "from", "onto", "into", "then", "up", "down",
  "per", "with", "each", "every", "boxes", "cartons", "totes", "pallets", "items", "parts", "bins", "shifts", "hours", "minutes",
  "kg", "lb", "cm", "mm", "m"];
const middle = (joining: string) => `(?!(?:${joining})\\b)[\\p{L}][\\p{L}'.-]*`;
const MIDDLE = middle(JOINING.join("|"));
/** The same, with the joining words in any case, where the street word may be in any case. */
const MIDDLE_ANY_CASE = middle(JOINING.map(anyCase).join("|"));
const LEAD = "(?:\\b(?:[Aa]t|[Oo]n|[Ii]n|[Nn]ear|[Ff]rom)\\s+)?";
const HOUSE = `${LEAD}(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?\\s+`;
/** A unit or suite with its number ("Suite 5", "Unit 4B", "#12"; never "units"), and a postal code. */
const UNIT = "(?:(?:[Uu]nit|[Ss]uite|[Ss]te|[Aa]pt|[Aa]partment)\\b\\.?\\s*#?\\s*|#\\s*)[\\w-]*\\d[\\w-]*";
const POSTAL = "\\d{5}(?:-\\d{4})?(?![\\p{L}\\p{N}])";
/** A city, an optional state and a postal code right after the street (", Springfield, IL 62704"). */
const CITY_STATE_POSTAL = `\\s*,\\s*\\p{Lu}[\\p{L}\\p{N}_'.-]*(?:\\s+\\p{Lu}[\\p{L}\\p{N}_'.-]*){0,2}(?:\\s*,?\\s*[A-Z]{2})?\\s*,?\\s*${POSTAL}`;
/** A street word's abbreviation dot goes with it only before a comma ("Main St., Suite 3"), never a sentence's end. */
const ABBREVIATION_DOT = "(?:\\.(?=\\s*,))?";
const TAIL = `${ABBREVIATION_DOT}(?:\\s*,?\\s*${UNIT})?(?:${CITY_STATE_POSTAL}|\\s*,?\\s*${POSTAL})?`;
const NAME_WORD = "\\p{Lu}[\\p{L}'.-]*";
/** An optional compass direction before a street's name ("12 N 5th St", "400 West 42nd Street"). */
const DIRECTION = "(?:(?:N|S|E|W|NE|NW|SE|SW|North|South|East|West)\\.?\\s+)?";
/** A numbered street's ordinal ("5th", "42nd", "1ST"). */
const ORDINAL = "\\d{1,3}(?:st|nd|rd|th|ST|ND|RD|TH)";
const STREETS: readonly RegExp[] = [
  new RegExp(`${HOUSE}(?:${MIDDLE_ANY_CASE}\\s+){1,3}(?:${STREET_WORDS_CLEAR})\\b${TAIL}`, "gu"),
  new RegExp(`${HOUSE}(?:${NAME_WORD}\\s+){1,3}(?:${STREET_WORDS_ANY})\\b${TAIL}`, "gu"),
  new RegExp(`${HOUSE}(?:${MIDDLE_ANY_CASE}\\s+){0,3}(?:${STREET_WORDS_ANY})\\b${ABBREVIATION_DOT}`
    + `(?:\\s*,?\\s*${UNIT}|${CITY_STATE_POSTAL}|\\s*,?\\s*${POSTAL})+`, "gu"),
  new RegExp(`${HOUSE}(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_NAMED})\\b${TAIL}`, "gu"),
  new RegExp(`${HOUSE}(?:${MIDDLE}\\s+){0,2}${NAME_WORD}\\s+(?:${STREET_WORDS_WEAK})\\b${TAIL}`, "gu"),
  new RegExp(`${HOUSE}(?:${MIDDLE}\\s+){0,3}(?:${STREET_WORDS_WEAK})\\b${ABBREVIATION_DOT}(?:\\s*,?\\s*${UNIT}|\\s*,?\\s*${POSTAL})+`, "gu"),
];
/**
 * Under the current rules (2026-11-24), a numbered or ordinal street too, with or without a house number and a direction
 * ("12 N 5th St", "400 West 42nd Street", "on 5th Avenue"). The street words that are also job words count only with a
 * capital ("5th Place", not "5th place").
 */
const ORDINAL_STREETS: readonly RegExp[] = [
  new RegExp(`${HOUSE}${DIRECTION}${ORDINAL}\\s+(?:${STREET_WORDS_ANY}|${STREET_WORDS_NAMED}|${STREET_WORDS_WEAK})\\b${TAIL}`, "gu"),
  new RegExp(`${LEAD}(?<![\\p{L}\\p{N}])${DIRECTION}${ORDINAL}\\s+(?:${STREET_WORDS_CLEAR}|${anyCase("road")}|${anyCase("rd")}|${STREET_WORDS_NAMED}|${STREET_WORDS_WEAK})\\b${TAIL}`, "gu"),
];

/**
 * Place forms a street pattern does not cover, each replaced by `[removed]` (2026-11-24):
 * - a highway, interstate or route with its number, and an exit after it ("Highway 99 near exit 23", "Hwy 101", "I-95",
 *   "US-101", "US Route 66", "SR 99", "Route 66"; "route 2" in lower case is a job's route, so "Route" needs its capital,
 *   and "US" alone needs its hyphen: "US 50 gallon drums" is not a road);
 * - a post office box ("PO Box 1182", "P.O. Box 7");
 * - a postcode: British ("LS10 1AB"), Canadian ("K1A 0B1"), and a US ZIP after a state's two letters ("CA 94607").
 */
const EXIT = "(?:,?\\s*(?:near|at|off|by|past|before|after|to|from)\\s+(?:[Ee]xit|EXIT)\\s+\\d{1,4}[A-Za-z]?)?";
const ROADS = new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:${anyCase("state")}\\s+|${anyCase("us")}\\s+|${anyCase("county")}\\s+)?`
  + `(?:${anyCase("highway")}|${anyCase("hwy")}\\.?|${anyCase("interstate")}|${anyCase("freeway")}|${anyCase("fwy")}\\.?`
  + `|${anyCase("motorway")}|${anyCase("turnpike")}|${anyCase("expressway")})|(?:State\\s+|US\\s+)?(?:Route|Rte\\.?)(?=\\s+\\d)`
  + `|County\\s+Road(?=\\s+\\d)|I-|US-|SR-?)\\s*\\d{1,4}[A-Z]?(?![\\p{L}\\p{N}])${EXIT}`, "gu");
const PO_BOX = /(?<![\p{L}\p{N}])(?:P\.?\s?O\.?\s?Box|Post\s+Office\s+Box)\s*(?:No\.?\s*)?#?\s*\d{1,8}(?![\p{L}\p{N}])/giu;
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND"
  + "|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const POSTCODES = [
  // British: the outward code, one space, a digit and two letters the inward code may hold (never C, I, K, M, O or V).
  // The space is required, so a part number ("M12AB") is not one.
  /(?<![\p{L}\p{N}])(?:[A-PR-UWYZ][A-HK-Y]?\d[A-HJKPSTUW\d]?|GIR) \d[ABD-HJLNP-UW-Z]{2}(?![\p{L}\p{N}])/gu,
  // Canadian.
  /(?<![\p{L}\p{N}])[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d(?![\p{L}\p{N}])/gu,
  // A US ZIP after a state's two capital letters.
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${US_STATES})\\s+\\d{5}(?:-\\d{4})?(?![\\p{L}\\p{N}])`, "gu"),
];
const PLACE_FORMS: readonly RegExp[] = [ROADS, PO_BOX, ...POSTCODES];

/** Tidy what removal leaves: doubled spaces and commas, a space before punctuation, a comma at either end. `noun` is
 * what a held name became ("site" in "the site", or "company"). */
function tidy(text: string, noun: NameNoun = "site"): string {
  return text
    // A place word left with nothing after it ("in ," once "in Springfield" is gone).
    .replace(/\b(at|in|near|on)\s*(?=[,.;]|$)/gi, "")
    // …or before another place word ("at to the dock" once "at 12 Mill Road" is gone).
    .replace(/\b(at|in|near|on)\s+(?=(?:to|from|in|on|at)\b)/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])(\s*[,;:])+/g, "$1").replace(/\(\s*\)/g, "")
    .replace(/[,;:]\s*\./g, ".").replace(/\s{2,}/g, " ").replace(/^[\s,;:]+|[\s,;:]+$/g, "")
    // An article left before "the site" ("the the site", "a the site", "at the the site"); a capital is kept.
    .replace(new RegExp(`\\b(?:(?:the|a|an)\\s+)+(?=the ${noun}\\b)`, "gi"), (articles: string) => /^[A-Z]/.test(articles) ? "\u0000" : "")
    .replace(new RegExp(`\u0000the ${noun}`, "g"), `The ${noun}`);
}

/** What a held name becomes: "the site" in a site's words (the default), "the company" in a company's. */
export type NameNoun = "site" | "company";

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
 * kept. These are what the model pass after this one is for (`server/utils/freeTextScreening.ts`): the other side reads
 * the words only once it has succeeded.
 *
 * The same rules take a deployment company out of its own words before a site reads them (`jobCompanies.ts`), with
 * `nameAs: "company"`: each held name then becomes "the company".
 */
export function removeIdentifyingDetails(text: string, known: KnownSiteIdentity,
  options: { nameAs?: NameNoun; rules?: RedactionRules } = {}): string {
  const noun = options.nameAs ?? "site";
  const rules = options.rules ?? CURRENT_REDACTION_RULES, wide = widened(rules);
  const nameAs = (whole: string, offset: number) => `${startsSentence(whole, offset) ? "The" : "the"} ${noun}`;
  let out = fold(text);
  const values = (list: Array<string | null | undefined>) => list.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  // Longest first, so a whole address or a full name goes before its parts.
  const byLength = (list: string[]) => [...new Set(list)].sort((a, b) => b.length - a.length);
  for (const value of byLength(values(known.contacts))) {
    const pattern = knownValuePattern(value);
    if (pattern) out = out.replace(pattern, REMOVED);
  }
  for (const value of byLength(values(known.addresses).flatMap(address => [address, ...addressParts(address)]))) {
    const pattern = knownValuePattern(value, true, wide);
    if (pattern) out = out.replace(pattern, "");
  }
  for (const value of byLength(values(known.names))) {
    const pattern = knownValuePattern(value, false, wide);
    if (pattern) out = out.replace(pattern, (...args: unknown[]) => nameAs(String(args[args.length - 1]), Number(args[args.length - 2])));
  }
  for (const word of new Set(values(known.organisations ?? []).flatMap(name => name.split(/[^\p{L}\p{N}]+/u)))) {
    const pattern = capitalisedWordPattern(word);
    // Wherever it is capitalised, the first word of a sentence included (privacy over a mangled sentence).
    if (pattern) out = out.replace(pattern, (_match: string, offset: number, whole: string) => nameAs(whole, offset));
  }
  for (const street of wide ? [...STREETS, ...ORDINAL_STREETS] : STREETS) out = out.replace(street, "");
  if (wide) for (const form of PLACE_FORMS) out = out.replace(form, REMOVED);
  out = out.replace(new RegExp(`\\bthe ${noun}(\\s+the ${noun})+\\b`, "gi"), `the ${noun}`);
  return tidy(removeContactDetails(out, rules), noun);
}

/** Whether `removeIdentifyingDetails` would change the text: the site's page may then say `CONTACT_DETAILS_REMOVED_LINE`. */
export function identifyingDetailsRemoved(text: string, known: KnownSiteIdentity, rules: RedactionRules = CURRENT_REDACTION_RULES): boolean {
  return removeIdentifyingDetails(text, known, { rules }) !== tidy(fold(text));
}

/* ------------------------------------------------------------- names the record does not hold (company side only) */

/** Words a sentence starts with that are never a name, even when a capitalised word follows ("Move Hobart racks"). */
const SENTENCE_STARTERS = new Set(["a", "an", "the", "we", "i", "our", "us", "you", "your", "they", "their", "it", "its", "this",
  "that", "these", "those", "there", "here", "each", "every", "all", "any", "some", "most", "many", "few", "both", "no", "not",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "someone", "everyone", "everything", "staff",
  "at", "in", "on", "from", "to", "into", "onto", "for", "with", "without", "by", "of", "after", "before", "during", "when",
  "while", "once", "then", "next", "first", "second", "last", "finally", "also", "and", "but", "or", "so", "if", "about",
  "around", "between", "under", "over", "up", "down", "out", "only", "just", "usually", "normally", "currently", "sometimes",
  "often", "always", "now", "today", "daily", "weekly", "nightly", "please", "how", "what", "which", "who", "where", "why",
  "my", "he", "she", "his", "her", "can", "could", "would", "should", "will", "must", "do", "does", "is", "are", "was", "were",
  "have", "has", "need", "needs", "help", "let", "make", "get", "move", "pick", "put", "take", "carry", "bring", "load",
  "unload", "stack", "unstack", "sort", "pack", "unpack", "wrap", "fold", "open", "close", "push", "pull", "lift", "transfer",
  "fill", "empty", "clean", "wipe", "wash", "rinse", "inspect", "check", "scan", "label", "count", "weigh", "measure",
  "restock", "replenish", "stock", "retrieve", "collect", "gather", "deliver", "drop", "insert", "remove", "feed", "tend",
  "sweep", "mop", "cut", "slice", "trim", "assemble", "seal", "tape", "bag", "palletize", "palletise", "depalletize",
  "depalletise", "kit", "pour", "mix", "cook", "fry", "bake", "flip", "serve", "hang", "polish", "sand", "paint", "weld",
  "grind", "drill", "deburr", "return", "rotate", "turn", "align", "arrange", "organize", "organise", "set", "grab", "keep",
  "use", "run", "operate", "start", "stop", "repeat", "replace", "swap", "shelve", "dispose", "discard", "refill", "hand"]);

/** A capitalised word ("Acme", "Joe's", "Coca-Cola", "ACME"); a word with a digit in it is never one ("B2B", "M8"). */
const CAPITALISED_WORD = /(?<![\p{L}\p{N}'’&-])\p{Lu}(?:\p{L}|['’&-](?=\p{L}))*(?![\p{L}\p{N}])/gu;
/** A title and the capitalised word after it ("Mr. Smith", "Dr Jones"): the name, whatever follows. */
const TITLED_NAME = /(?<![\p{L}\p{N}])(?:Mr|Mrs|Ms|Mx|Dr|Miss)\.?\s+\p{Lu}(?:\p{L}|['’-](?=\p{L}))*/gu;
const POSSESSIVE = /['’]s$/i;

/** A capitalised word that names nothing: an ordinary place or workplace word, a month, weekday, direction or country,
 * a single letter, or a short acronym in capitals ("SKU", "SKUs", "AGV", "CNC"). */
function ordinaryCapitalised(word: string): boolean {
  const bare = word.replace(POSSESSIVE, "");
  const lower = bare.toLowerCase();
  return bare.length === 1 || /^\p{Lu}{2,3}s?$/u.test(bare) || GENERIC_NAME_WORDS.has(lower) || COUNTRY_WORDS.has(lower)
    || lower === "blueprint";
}

/**
 * A name the site typed that the record does not hold, out of what a deployment company reads (2026-11-20). The start
 * form asks for no site or person name, so `removeIdentifyingDetails` cannot know one the site writes into its sentence
 * ("At Joe's Diner, …", "Acme Fulfillment needs …", "Joe Smith at Smith Bakery …"). Run on its result, this takes out
 * name-shaped text instead, each as `[removed]` (it may be a business, a person or a brand; it is never said to be the
 * site):
 *
 * - a capitalised word inside a sentence ("ask Joe", "the Hobart dishwasher"), unless it names nothing
 *   (`ordinaryCapitalised`);
 * - a capitalised word with "'s" anywhere ("Joe's");
 * - a sentence's first word followed by another capitalised word ("Acme Fulfillment"), unless the first word is one a
 *   sentence ordinarily starts with (`SENTENCE_STARTERS`: "Move Hobart racks" keeps "Move") or the next word is a
 *   month, weekday or direction;
 * - a title and the name after it ("Mr. Smith");
 * - with each, the capitalised words next to it ("Acme Foods", "Smith & Sons Bakery").
 *
 * Company side only: the site's task context for the Pipeline is not touched, so no digest bound to it changes.
 *
 * The remaining limit, exactly: a name written in lower case ("joe's diner"), a lone name as a sentence's first word with
 * a lower-case word after it ("Acme needs …"), a name of three capital letters or fewer ("IBM") and a name made only of
 * ordinary words ("Central Kitchen") still get through this pass; the model pass after it (`server/utils/freeTextScreening.ts`)
 * is for them. Brand names of equipment and products are removed with names.
 */
export function removeNamesNotHeld(text: string): string {
  const source = text.replace(TITLED_NAME, REMOVED);
  const words = [...source.matchAll(CAPITALISED_WORD)].map(match => ({ word: match[0], start: match.index!,
    end: match.index! + match[0].length }));
  // Runs of capitalised words next to each other ("Joe Smith", "Smith & Sons Bakery"), on one line.
  const runs: Array<typeof words> = [];
  for (const word of words) {
    const last = runs[runs.length - 1];
    if (last && /^[^\S\n]+(?:&[^\S\n]+)?$/.test(source.slice(last[last.length - 1].end, word.start))) last.push(word);
    else runs.push([word]);
  }
  const spans: Array<[number, number]> = [];
  for (const run of runs) {
    const [first] = run;
    const atStart = startsSentence(source, first.start);
    const firstLower = first.word.replace(POSSESSIVE, "").toLowerCase();
    // A sentence's own capital: a word it ordinarily starts with, or an ordinary word, is kept whatever follows it.
    const from = atStart && (SENTENCE_STARTERS.has(firstLower) || ordinaryCapitalised(first.word)) ? 1 : 0;
    const named = run.slice(from).some((item, index) => {
      if (ordinaryCapitalised(item.word)) return false;
      if (from + index > 0 || !atStart || POSSESSIVE.test(item.word)) return true;
      const next = run[1];
      return Boolean(next) && !CALENDAR_AND_COMPASS_WORDS.has(next.word.replace(POSSESSIVE, "").toLowerCase());
    });
    if (named) spans.push([run[from].start, run[run.length - 1].end]);
  }
  let out = source;
  for (const [start, end] of spans.reverse()) out = `${out.slice(0, start)}${REMOVED}${out.slice(end)}`;
  return out.replace(/\[removed\](?:[^\S\n]+\[removed\])+/g, REMOVED);
}
