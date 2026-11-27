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
 *
 * Widened again 2026-11-24 (stress test round 2: a reply of only a phone number crossed both ways): a phone number in
 * the 3-3-3 grouping ("612 345 678", "021 234 567"), with any separator that is not a letter or a digit ("415_555_0199",
 * "415•555•0199", "415 📞 555 📞 0199"), and in any script's digits ("٤١٥٥٥٥٠١٩٩"). Every digit is read as its ASCII form
 * first; the text the other side reads shows it so.
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

/**
 * Under the current rules (stress test round 2, 2026-11-24: "415_555_0199", "415•555•0199", "415|555|0199" and
 * "415 📞 555 📞 0199" crossed whole): digit groups joined by any separator that is not a letter or a digit — spaces, and one
 * to three other marks (dots, dashes, slashes, brackets, underscores, bullets, bars, emoji) with spaces around them, or
 * a comma on its own. Never one that joins ordinary numbers: a comma with a space beside it (a list), a semicolon, a colon
 * (a time), a currency sign, the signs of a sum or a measurement, a quote mark, "#" or "&". Matched after every digit is
 * read as its ASCII form (`foldDigits`), so Arabic-Indic, Devanagari and other scripts' digits count the same.
 */
const PHONE_SEPARATOR_MARK = "[^\\p{L}\\p{N}\\p{M}\\s,;:\\p{Sc}%‰°×÷*+=<>±~#&!?'\"‘’“”«»]";
const WIDE_PHONE_SEPARATOR = `(?:,|[^\\S\\n]+|[^\\S\\n]*${PHONE_SEPARATOR_MARK}{1,3}[^\\S\\n]*)`;
const WIDE_PHONE_CANDIDATE = new RegExp(`(?:\\+|\\(\\s*)?\\d+(?:${WIDE_PHONE_SEPARATOR}\\d+)*`, "gu");

const RANGE_UNIT = /^\s+(?:boxes?|cartons?|cases?|totes?|items?|pieces?|units?|pallets?|parts?|bins?|cycles?|mm|cm|m|kg|g|lbs?|oz|seconds?|minutes?|hours?)\b/i;
/** A quantity written after a number grouped in threes with spaces or dots ("1 200 000 units", "612 345 678 kg"). */
const QUANTITY_AFTER = /^\s*(?:boxes|box|cartons?|cases?|totes?|items?|pieces?|units?|pallets?|parts?|bins?|cycles?|picks?|orders?|bottles?|cans?|bags?|trays?|crates?|packages?|parcels?|mm|cm|km|m|kg|g|t|tons?|tonnes?|lbs?|oz|l|litres?|liters?|gallons?|seconds?|minutes?|hours?|days?|a\s+(?:year|month|week|day|shift)|per\b|each\b|every\b|in\s+total\b)(?![\p{L}\p{N}])/iu;

function isPhone(candidate: string, following: string, wide = false): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const text = candidate.trim();
  if (/\//.test(text) && !/^\+/.test(text)) return false; // fractions and "24/7"-style ratios, dates written with slashes
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false; // an ISO date
  if (!wide && /^\d{1,3}(?:[ ,.]\d{3})+$/.test(text)) return false; // thousands: "1 200 000", "1.200.000"
  if (wide) {
    // An ISO date with its hour ("2026-11-12 09" of "2026-11-12 09:00").
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}$/.test(text)) return false;
    // Thousands with commas ("1,200,000", "1,200,000.50").
    if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return false;
    // Thousands with spaces or dots, read as a phone number unless they cannot be one: "1 200 000" and "12 500 000"
    // (a first group of one or two digits) or a quantity after them ("1 200 000 units"). "612 345 678", "612.345.678"
    // and "021 234 567" are phone numbers in the 3-3-3 grouping.
    if (/^[1-9]\d{0,2}(?:([ .])\d{3})(?:\1\d{3})*$/.test(text) && (/^\d{1,2}[ .]/.test(text) || QUANTITY_AFTER.test(following))) return false;
    // A range of two amounts with thousands or decimals ("4,000-6,000", "1.5-2.5").
    if (/^(?:[1-9]\d{0,2}(?:,\d{3})+|\d+\.\d+)\s*[-–—]\s*(?:[1-9]\d{0,2}(?:,\d{3})+|\d+\.\d+)$/.test(text)) return false;
    // Two or more groups of one digit: a list or decimals ("0.5 1.5 2.5 3.5", "1.25,0.40,0.80"), never a phone number.
    if ((text.match(/\d+/g) ?? []).filter(group => group.length === 1).length >= 2) return false;
  }
  if (/^\d+(?:\.\d+)?$/.test(text) && !/^0/.test(text) && digits.length < 10) return false; // one plain number under ten digits
  const range = /^(\d{1,4})\s*-\s*(\d{1,4})$/.exec(text); // a range, such as "1000-2000 boxes a week"
  if (range && range[1].length === range[2].length && Number(range[1]) < Number(range[2]) && RANGE_UNIT.test(following)) return false;
  return true;
}

/** Every decimal digit, of any script, as its ASCII digit ("٤١٥" and "४१५" read as "415"). */
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/gu;
const DECIMAL_DIGIT = /^\p{Nd}$/u;
const digitValues = new Map<string, string>();
function asciiDigit(char: string): string {
  const known = digitValues.get(char);
  if (known) return known;
  // Unicode encodes each script's decimal digits as one run of ten, 0 to 9, so a digit's value is its distance from the
  // start of the run it is in (runs that sit side by side are whole tens).
  const point = char.codePointAt(0)!;
  let zero = point;
  while (zero > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(zero - 1))) zero -= 1;
  const value = String((point - zero) % 10);
  digitValues.set(char, value);
  return value;
}
export function foldDigits(text: string): string {
  return text.replace(NON_ASCII_DIGIT, asciiDigit);
}
/** Emoji presentation selectors and the keycap mark ("4️⃣"): they carry nothing a reader needs. */
const PRESENTATION_MARKS = /[︎️⃣]/g;

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
// Letters in small case count only after a "+1", a "1-" or "1." with a separator after the area code too, an area code
// in brackets, or a toll-free code just after a word that calls ("+1 800 flowers", "1-800-flowers", "(800) got-junk",
// "Call 1800 flowers"); in capitals after an optional "1" ("1-800-FLOWERS", "800-FLOWERS"). Reviews of PR #1467: "Move
// 1500 cartons a day" read as "1", "500" and "cartons", and "1 500 cartons" is how French writes a count.
const VANITY_LETTERS = "(?=(?:[0-9-]*[A-Za-z]){3})[A-Za-z0-9]{3}-?[A-Za-z0-9]{4}";
const CALL_WORD = String.raw`(?<=\b(?:[Cc]all|CALL|[Pp]hone|PHONE|[Rr]ing|[Tt]ext|[Dd]ial|[Tt]el|[Ff]ax|[Rr]each|[Cc]ontact)\b[^.!?\n]{0,12})`;
const VANITY_PHONE = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:(?:\+1[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?|1[.-]\(?[2-9]\d{2}\)?[.-]`
  + String.raw`|\([2-9]\d{2}\)[\s.-]?|${CALL_WORD}(?:1[\s.-]?)?\(?8(?:00|33|44|55|66|77|88)\)?[\s.-]?)${VANITY_LETTERS}`
  + String.raw`|(?:1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?(?=(?:[0-9-]*[A-Z]){3})[A-Z0-9]{3}-?[A-Z0-9]{4})(?![\p{L}\p{N}]|-[\p{L}\p{N}])`, "gu");

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

/**
 * The text as the patterns read it: full-width and look-alike forms ("＠", "ｗｗｗ.") plain, zero-width characters dropped;
 * under the current rules also every digit of any script as its ASCII digit and emoji presentation marks dropped.
 */
function patternForm(text: string, rules: RedactionRules): string {
  const plain = text.normalize("NFKC").replace(ZERO_WIDTH, "");
  return widened(rules) ? foldDigits(plain.replace(PRESENTATION_MARKS, "")) : plain;
}

/** The text with every email address, phone number and web link replaced by `[removed]`. */
export function removeContactDetails(text: string, rules: RedactionRules = CURRENT_REDACTION_RULES): string {
  const wide = widened(rules);
  let out = patternForm(text, rules)
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
    .replace(wide ? WIDE_PHONE_CANDIDATE : PHONE_CANDIDATE, (match: string, offset: number, normalized: string) => {
      // Keep the separators the match swallowed at its edges.
      const lead = /^\s*/.exec(match)?.[0] ?? "";
      return isPhone(match, normalized.slice(offset + match.length), wide) ? `${lead}${REMOVED}` : match;
    });
}

/** Whether the text holds a contact detail `removeContactDetails` would remove. */
export function containsContactDetails(text: string): boolean {
  return removeContactDetails(text) !== patternForm(text, CURRENT_REDACTION_RULES);
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
  /**
   * People's names held (also in `names`, whole): under the current rules each word of two or more letters is also
   * removed on its own wherever it is written with a capital first letter, with a title before it ("Casey will bring
   * the drawings", "Thanks, Casey", "Mr. Hlington"). Only with its capital, so a first name that is also a word ("Will",
   * "Mark") leaves the word in lower case alone; the model pass after this one reads the rest.
   */
  people?: Array<string | null | undefined>;
}

const COUNTRY_WORDS = new Set(["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america", "uk", "u.k.",
  "united kingdom", "great britain", "england", "canada", "mexico", "germany", "france", "australia", "ireland", "netherlands"]);

/** Accents folded (NFKD, combining marks dropped), look-alikes normalised, zero-width characters dropped. */
function fold(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH, "").normalize("NFKD").replace(/\p{M}+/gu, "").normalize("NFC");
}

/* ------------------------------------------------------- the kept words as written (stress test, 2026-11-27) */

/** The form every pattern reads (`removeIdentifyingDetails`): what its output was built from. */
function matchingForm(text: string, rules: RedactionRules): string {
  return widened(rules) ? patternForm(fold(text), rules) : fold(text);
}

const GRAPHEMES = typeof Intl !== "undefined" && typeof (Intl as { Segmenter?: unknown }).Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
/** A word (letters, digits and their marks), a run of spaces, or one other character. */
const TOKEN = /[\p{L}\p{N}\p{M}]+|\s+|[^\p{L}\p{N}\p{M}\s]/gu;

/** Each token's text and its span in code points. */
function tokens(text: string): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  let at = 0;
  for (const match of text.matchAll(TOKEN)) {
    const length = [...match[0]].length;
    out.push({ text: match[0], start: at, end: at + length });
    at += length;
  }
  return out;
}

/**
 * The shortest edit from `a` to `b` (Myers), as runs: `=` kept (a's indices), `-` dropped from `a`, `+` added from `b`
 * (b's indices). Equal items are compared as strings.
 */
function editRuns(a: readonly string[], b: readonly string[]): Array<{ op: "=" | "-" | "+"; from: number; to: number }> {
  const n = a.length, m = b.length, max = n + m, offset = max + 1;
  // Each round keeps only the window of diagonals it reads (2d + 3 values), so memory grows with the edits squared,
  // not with the edits times the length (a review of PR #1467: a 2,000-character text of emails took about 50 MB).
  const trace: Int32Array[] = [];
  const v = new Int32Array(2 * max + 3);
  let found = false;
  for (let d = 0; d <= max && !found; d += 1) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x += 1; y += 1; }
      v[offset + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }
  const steps: Array<{ op: "=" | "-" | "+"; index: number }> = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d -= 1) {
    const window = trace[d], at = (k: number) => window[k + d + 1], k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK), prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x -= 1; y -= 1; steps.push({ op: "=", index: x }); }
    if (d > 0) {
      if (x === prevX) { y -= 1; steps.push({ op: "+", index: y }); } else { x -= 1; steps.push({ op: "-", index: x }); }
    }
  }
  steps.reverse();
  const runs: Array<{ op: "=" | "-" | "+"; from: number; to: number }> = [];
  for (const step of steps) {
    const last = runs[runs.length - 1];
    if (last && last.op === step.op && last.to === step.index) last.to += 1;
    else runs.push({ op: step.op, from: step.index, to: step.index + 1 });
  }
  return runs;
}

/**
 * The redacted text with every word it kept written as the writer wrote it (stress test, 2026-11-27: "l'étagère"
 * reached a company as "l'etagere", and "ガラス棚", a glass shelf, as "カラス棚", a crow shelf). The patterns read a folded
 * form (`fold`, `patternForm`: accents and other marks dropped, look-alikes and digits plain) and each removal is made
 * there, as before; this changes no removal. Only a word the redaction kept unchanged, matched word for word against
 * the folded original, takes the writer's own characters back, still without zero-width characters; everything it
 * added ("[removed]", "the site") and every word it changed stays as it made them. Any text whose folded form is not
 * the sum of its characters' (no grapheme segmenter, or a composition across characters) is returned as redacted.
 */
export function asWritten(original: string, redacted: string, rules: RedactionRules = CURRENT_REDACTION_RULES): string {
  if (!GRAPHEMES || !redacted) return redacted;
  const clusters = [...GRAPHEMES.segment(original)].map(part => part.segment);
  const forms = clusters.map(cluster => matchingForm(cluster, rules));
  const matched = matchingForm(original, rules);
  if (forms.join("") !== matched) return redacted;
  if (matched === redacted) return clusters.map(restored).join("").normalize("NFC");
  // Where each cluster's form starts and ends, in code points of `matched`.
  const starts: number[] = [], ends: number[] = [];
  let at = 0;
  for (const form of forms) { starts.push(at); at += [...form].length; ends.push(at); }
  const points = [...matched];
  const asOriginal = (from: number, to: number): string => {
    let out = "";
    for (let k = 0; k < clusters.length; k += 1) {
      if (ends[k] <= from || starts[k] >= to) continue;
      out += starts[k] >= from && ends[k] <= to ? restored(clusters[k])
        : points.slice(Math.max(from, starts[k]), Math.min(to, ends[k])).join("");
    }
    return out;
  };
  const before = tokens(matched), after = tokens(redacted);
  // A kept word is given the writer's characters only when every word that folds to it was written the same way: a
  // diff may line a kept word up with the same folded word inside a removed span, and would then show that removed
  // word's own characters (a review of PR #1467: "12 गांधी Street, गधा" showed the removed street name, "12 Müller
  // Street Muller" showed "Müller"). Where the writer wrote them differently, it stays in the folded form, as before.
  const written = new Map<string, string | null>();
  for (const token of before) {
    const form = asOriginal(token.start, token.end), seen = written.get(token.text);
    written.set(token.text, seen === undefined || seen === form ? form : null);
  }
  // The words both ends share need no diff: most of a text is kept, and the diff's work grows with what is left.
  let head = 0;
  while (head < before.length && head < after.length && before[head].text === after[head].text) head += 1;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head
    && before[before.length - 1 - tail].text === after[after.length - 1 - tail].text) tail += 1;
  const middleBefore = before.slice(head, before.length - tail), middleAfter = after.slice(head, after.length - tail);
  const runs = editRuns(middleBefore.map(token => token.text), middleAfter.map(token => token.text));
  // A removal may start or end inside a word and leave a piece of it ("Streetカラス" leaves "カラス"), or join two pieces
  // ("カat" and "Streetラス" leave "カラス"); the diff can then line that piece up with the same folded word inside the
  // removed span ("ガラス"), whose characters it would show (second and third reviews of PR #1467). A kept word that may
  // be such a piece stays in the folded form: the start of a dropped word, its end, a start and an end joined, or (three
  // characters or more) any part of one.
  const dropped = [...new Set(runs.filter(run => run.op === "-")
    .flatMap(run => middleBefore.slice(run.from, run.to).map(token => token.text)).filter(text => /[\p{L}\p{N}]/u.test(text)))];
  const startsDropped = (part: string) => dropped.some(word => word.length > part.length && word.startsWith(part));
  const endsDropped = (part: string) => dropped.some(word => word.length > part.length && word.endsWith(part));
  const piece = (text: string): boolean => {
    if (!/[\p{L}\p{N}]/u.test(text)) return false;
    if (startsDropped(text) || endsDropped(text)) return true;
    if ([...text].length >= 3 && dropped.some(word => word !== text && word.includes(text))) return true;
    const points = [...text];
    for (let k = 1; k < points.length; k += 1)
      if (startsDropped(points.slice(0, k).join("")) && endsDropped(points.slice(k).join(""))) return true;
    return false;
  };
  const insideDropped = new Map<string, boolean>();
  const keep = (token: { text: string }) => {
    // A word the redaction writes may stand where a removed name was ("Thé" folds to "The", as in "The site"): it is
    // never given a writer's characters (a review of PR #1467).
    if (WRITTEN_WORDS.has(token.text)) return token.text;
    let inside = insideDropped.get(token.text);
    if (inside === undefined) {
      inside = piece(token.text);
      insideDropped.set(token.text, inside);
    }
    return inside ? token.text : written.get(token.text) ?? token.text;
  };
  let out = before.slice(0, head).map(keep).join("");
  for (const run of runs) {
    if (run.op === "+") out += middleAfter.slice(run.from, run.to).map(token => token.text).join("");
    else if (run.op === "=") out += middleBefore.slice(run.from, run.to).map(keep).join("");
  }
  out += before.slice(before.length - tail).map(keep).join("");
  return out.normalize("NFC");
}

/**
 * A cluster without the characters that show nothing and can hide a word from a pattern or a model: format characters
 * (zero-width spaces and joiners, soft hyphens, invisible operators, bidirectional controls), the combining grapheme
 * joiner and variation selectors (a review of PR #1467: "D\u034Fana" or a variation selector after each letter kept a
 * name from reading as one). Accents and every other mark that changes a letter stay.
 */
function visible(cluster: string): string {
  return cluster.replace(/[\p{Cf}\u034F\u0334-\u0338\uFE00-\uFE0F\u180B-\u180F]|\uDB40[\uDD00-\uDDEF]/gu, "");
}

/**
 * A cluster as a kept word gives it back: its letters with their own accents and marks (canonical forms: "é", "ガ"), but
 * look-alike forms plain (compatibility forms: circled, full-width, squared, superscript and modifier letters, ligatures:
 * "Ⓓ" is "D", "ﬁ" is "fi"), and nothing invisible. A look-alike form says nothing a plain letter does not, and can
 * hide a word from a pattern or a model.
 */
function restored(cluster: string): string {
  return visible(cluster.normalize("NFKC"));
}

/** The text as every pattern of the current rules reads it: what the model pass's distrust rules read too. */
export function foldedForPatterns(text: string): string {
  return matchingForm(text, CURRENT_REDACTION_RULES);
}

/** The words the redaction itself writes: "[removed]" and "the site" or "the company", in either case. */
const WRITTEN_WORDS: ReadonlySet<string> = new Set(["removed", "the", "The", "THE", "site", "Site", "company", "Company"]);

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

/** One word of a held person's name, alone, where it is written with a capital first letter, with a title before it. */
function namePartPattern(word: string): RegExp | null {
  if (!/^\p{L}{2,}$/u.test(word)) return null;
  const [first, ...rest] = [...word];
  const tail = rest.map(letter => `[${escapeRegExp(letter.toLowerCase())}${escapeRegExp(letter.toUpperCase())}]`).join("");
  return new RegExp(`(?:(?<![\\p{L}\\p{N}])(?:Mr|Mrs|Ms|Mx|Dr|Miss|Mister)\\.?\\s+)?(?<![\\p{L}\\p{N}])`
    + `${escapeRegExp(first.toUpperCase())}${tail}(?![\\p{L}\\p{N}])`, "gu");
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
const US_STATE_NAMES = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho"
  + "|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri"
  + "|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon"
  + "|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia"
  + "|Wisconsin|Wyoming";
/**
 * Count and unit words, as the patterns read them (accents folded), in the languages sites write most. After a number
 * they make it a quantity, not a postcode ("Halle 2, 2000 Teile", "Texas 12000 units", "Station 3, 1200 Totes"), and
 * one is never a street's name ("4 Boulevard Cartons"). A third review of PR #1467.
 */
const COUNT_WORDS: readonly string[] = [
  // English
  "unit", "units", "box", "boxes", "tote", "totes", "carton", "cartons", "pallet", "pallets", "bottle", "bottles", "can",
  "cans", "bag", "bags", "part", "parts", "item", "items", "case", "cases", "cycle", "cycles", "order", "orders", "piece",
  "pieces", "pcs", "tray", "trays", "bin", "bins", "crate", "crates", "pack", "packs", "parcel", "parcels", "sack", "sacks",
  "roll", "rolls", "jar", "jars", "truck", "trucks", "sq", "square", "ft", "feet", "foot", "hour", "hours", "minute",
  "minutes", "second", "seconds", "day", "days", "week", "weeks", "gram", "grams", "kilo", "kilos", "kg", "lb", "lbs",
  "pound", "pounds", "meter", "meters", "metre", "metres", "liter", "liters", "litre", "litres", "gallon", "gallons",
  "degree", "degrees", "shift", "shifts", "pick", "picks", "move", "moves", "load", "loads", "people", "workers", "robots",
  "sku", "skus", "times", "per",
  // German
  "teil", "teile", "stuck", "stueck", "kiste", "kisten", "karton", "kartons", "palette", "paletten", "flasche", "flaschen",
  "dose", "dosen", "sack", "sacke", "beutel", "paket", "pakete", "zyklen", "zyklus", "einheiten", "artikel", "boxen",
  "behalter", "stunde", "stunden", "minuten", "sekunden", "tag", "tage", "woche", "wochen", "gramm", "kilogramm", "liter",
  "grad", "schicht", "schichten", "mal", "pro",
  // Dutch
  "dozen", "doos", "doosjes", "stuk", "stuks", "krat", "kratten", "pakket", "pakketten", "fles", "flessen", "onderdelen",
  "uur", "uren", "keer", "ploeg", "ploegen",
  // Spanish and Portuguese
  "caja", "cajas", "bolsa", "bolsas", "pieza", "piezas", "unidad", "unidades", "botella", "botellas", "paquete", "paquetes",
  "ciclo", "ciclos", "pales", "palet", "palets", "hora", "horas", "minutos", "gramos", "litros", "metros", "turno", "turnos",
  "veces", "caixa", "caixas", "pecas", "garrafa", "garrafas",
  // French
  "colis", "caisse", "caisses", "bouteille", "bouteilles", "sac", "sacs", "unite", "unites", "heure", "heures", "gramme",
  "grammes", "fois", "equipe", "equipes",
  // Italian
  "pezzi", "pezzo", "scatola", "scatole", "bottiglie", "colli", "cicli", "unita", "ore", "minuti", "grammi", "litri",
  "metri", "turni", "volte",
];
const anyCaseWords = (words: Iterable<string>) => [...new Set(words)].filter(word => /^\p{L}+$/u.test(word))
  .sort((a, b) => b.length - a.length).map(anyCase).join("|");
const COUNT_WORD = String.raw`(?:${anyCaseWords(COUNT_WORDS)})(?![\p{L}\p{N}])`;
/** A number that a count word follows is a quantity ("12000 units"). */
const NOT_A_COUNT = String.raw`(?![^\S\n]+${COUNT_WORD})`;
const POSTCODES = [
  // British: the outward code, one space, a digit and two letters the inward code may hold (never C, I, K, M, O or V).
  // The space is required, so a part number ("M12AB") is not one.
  /(?<![\p{L}\p{N}])(?:[A-PR-UWYZ][A-HK-Y]?\d[A-HJKPSTUW\d]?|GIR) \d[ABD-HJLNP-UW-Z]{2}(?![\p{L}\p{N}])/gu,
  // Canadian.
  /(?<![\p{L}\p{N}])[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d(?![\p{L}\p{N}])/gu,
  // A US ZIP after a state's two capital letters, or after the state written out ("California 94501"); not a count
  // after a state ("Texas 12000 units", a third review of PR #1467).
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${US_STATES}|${US_STATE_NAMES})\\s+\\d{5}(?:-\\d{4})?(?![\\p{L}\\p{N}])${NOT_A_COUNT}`, "gu"),
  // Australian: a state and four digits after the town ("Fitzroy VIC 3065"). The two-letter states (ACT, NT, SA, WA)
  // need a comma before them ("Perth, WA 6000"): after a word they are a machine's model ("the Epson SA 2000", reviews
  // of PR #1467).
  new RegExp(String.raw`(?:(?<=\p{Lu}[\p{L}'’-]*,?[^\S\n]+)(?:NSW|VIC|QLD|TAS)|(?<=\p{Lu}[\p{L}'’-]*,[^\S\n]*)(?:ACT|NT|SA|WA))`
    + String.raw`[^\S\n]+\d{4}(?![\p{L}\p{N}])${NOT_A_COUNT}`, "gu"),
];
/** A continental postcode and its town ("10115 Berlin", "1012 LG Amsterdam", "60311 Frankfurt am Main"): only after a
 * street (`EU_ADDRESS`), and never a count ("2000 Teile"). Alone it is a quantity as often as a place ("in 2000 Kisten
 * pro Tag"), and a town and its code alone name no site. */
const EU_TOWN = String.raw`(?!${COUNT_WORD})\p{Lu}\p{Ll}[\p{L}'’-]*(?:[^\S\n]+(?:(?:am|an|der|im|bei|sur|sous|en|de|la|le|aan|den)[^\S\n]+)?\p{Lu}[\p{L}'’-]*)?`;
const EU_POSTCODE = String.raw`\d{4,5}(?:[^\S\n]?[A-Z]{2})?[^\S\n]+${EU_TOWN}`;
/**
 * A street word that starts its name, as the patterns read it (accents folded: "allée" is "allee"). French writes the
 * number first, in either case ("12 rue de la Paix"); every one of them may come before its name and a number, with a
 * capital ("Via Roma 10", "Calle Mayor 5"). Reviews of PR #1467: "Move totes via Dock 4", "Via Gate 2, bring pallets"
 * and "4 Boulevard Cartons" are routes and counts, so the name is never a workplace, route or count word.
 */
const NUMBER_FIRST_STREET = String.raw`(?:${["rue", "avenue", "boulevard", "allee", "chemin", "impasse", "quai"]
  .map(word => `[${word[0]}${word[0].toUpperCase()}]${word.slice(1)}`).join("|")})`;
const ROMANCE_STREET = String.raw`(?:${["Rue", "Avenue", "Boulevard", "Allee", "Chemin", "Impasse", "Quai", "Calle", "Avenida",
  "Plaza", "Paseo", "Carrer", "Avinguda", "Via", "Viale", "Piazza", "Corso", "Largo", "Rua", "Travessa", "Praca"].join("|")})`;
const NOT_A_STREET_NAME = String.raw`(?!(?:${anyCaseWords([...GENERIC_NAME_WORDS, ...COUNT_WORDS, "gate", "door", "ramp", "exit",
  "entrance", "chute", "belt", "lift", "elevator", "loading", "packing", "shipping", "receiving", "nord", "sud", "est",
  "ouest", "norte", "sur", "este", "oeste", "ost"])})(?![\p{L}\p{N}]))`;
const STREET_NAME = String.raw`(?:(?:de|du|des|la|le|les|del|dels|di|della|delle|dei|do|da|dos|das|d['’])[^\S\n]*){0,2}`
  + String.raw`${NOT_A_STREET_NAME}\p{Lu}[\p{L}'’-]*(?:[^\S\n]+\p{Lu}[\p{L}'’-]*){0,3}`;
/**
 * Continental street addresses (reviews of PR #1467): the number before the street word ("12 rue de la Paix") or after
 * the name ("Calle Mayor 5", "Via Roma 10"), and a German or Dutch street word joined to its name ("Hauptstraße 12",
 * "Kerkstraat 4"). "-weg", "-gasse", "-platz", "-kade" and "-plein" are as often a workplace's spot ("Fluchtweg 3",
 * "Regalgasse 12", "Lagerplatz 12", "Laadkade 2"): they count as a street only with a postcode after them (`EU_STREET`).
 */
const NUMBER_FIRST_ROMANCE = String.raw`\d{1,4}[a-z]?,?[^\S\n]+${NUMBER_FIRST_STREET}[^\S\n]+${STREET_NAME}`;
const NAME_FIRST_ROMANCE = String.raw`${ROMANCE_STREET}[^\S\n]+${STREET_NAME},?[^\S\n]+\d{1,4}[a-z]?`;
const GERMANIC_STREET = String.raw`\p{Lu}\p{L}*(?:straße|strasse|str\.|allee|laan|straat|gracht)[^\S\n]*\d{1,4}[a-z]?`;
const GERMANIC_STREET_WITH_CODE = String.raw`\p{Lu}\p{L}*(?:straße|strasse|str\.|allee|laan|straat|gracht|weg|gasse|platz|kade|plein)[^\S\n]*\d{1,4}[a-z]?`;
const CONTINENTAL_STREETS: readonly RegExp[] = [
  new RegExp(String.raw`(?<![\p{L}\p{N}])${NUMBER_FIRST_ROMANCE}`, "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}])${NAME_FIRST_ROMANCE}(?![\p{L}\p{N}])`, "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}])${GERMANIC_STREET}(?![\p{L}\p{N}])`, "gu"),
];
const PLACE_FORMS: readonly RegExp[] = [ROADS, PO_BOX, ...POSTCODES, ...CONTINENTAL_STREETS];
/**
 * The address before a postal code: on its line, up to six comma-separated parts, each a unit ("Unit 7", "Suite 5B"), a
 * number and capitalised words ("12 Mill Road"), capitalised words and a number ("Damrak 1"), or capitalised words with
 * their small joining words ("Riverside Industrial Estate", "The Old Mill on the Green"), then the code
 * ("Unit 7, Riverside Industrial Estate, Leeds LS10 1AB", "Oakland, CA 94607"): all of it becomes one "[removed]". Or up
 * to four lines of such parts above a code on its own line, where one of them holds a number or a street word: those
 * lines go, and the code is a place form. A postal code says the words before it are an address (owner, 2026-11-27: the
 * capitalised-word rule that caught these parts by accident no longer runs, and a street address stays a pattern's to
 * remove). Never across a line otherwise.
 */
const ADDRESS_WORD = String.raw`\p{Lu}[\p{L}'’.&-]*`;
// No "in", "by" or "and" between them (a second review of PR #1467: "Consegna in Via Roma 10" took "Consegna in").
const ADDRESS_WORDS = String.raw`${ADDRESS_WORD}(?:[^\S\n]+(?:(?:on|the|upon|under|of|de|la|le|du|des|del|di|da|do|van|von|der)[^\S\n]+)*${ADDRESS_WORD}){0,5}`;
const ADDRESS_PART = String.raw`(?:(?:Unit|Suite|Ste|Floor|Fl|Building|Bldg|Block|Apt|Flat|Room)\.?[^\S\n]+#?[\p{L}\p{N}-]{1,6}`
  + String.raw`|${NUMBER_FIRST_ROMANCE}|${NAME_FIRST_ROMANCE}`
  + String.raw`|\d{1,6}[A-Za-z]?[^\S\n]+${ADDRESS_WORDS}|${ADDRESS_WORDS}[^\S\n]+\d{1,5}[A-Za-z]?|${ADDRESS_WORDS})`;
const ANY_POSTCODE = String.raw`(?:${POSTCODES.map(code => code.source).join("|")})`;
// The address and its code together become one "[removed]".
const ADDRESS_BEFORE_POSTCODE = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${ADDRESS_PART}[^\S\n]*,[^\S\n]*){0,5}${ADDRESS_PART}`
  + String.raw`[^\S\n]*,?[^\S\n]*${ANY_POSTCODE}`, "gu");
const ADDRESS_LINE = String.raw`[^\S\n]*${ADDRESS_PART}(?:[^\S\n]*,[^\S\n]*${ADDRESS_PART}){0,3}[^\S\n]*,?[^\S\n]*\n`;
const ADDRESS_LINES_BEFORE_POSTCODE = new RegExp(String.raw`^(?:${ADDRESS_LINE}){1,4}(?=[^\S\n]*${ANY_POSTCODE})`, "gmu");
/** Lines above a code are an address only when one holds a number or a street or premises word (a second review of PR
 * #1467: "Pick Totes" and "Scan Labels" above "CA 94607" are steps). */
const ADDRESS_LINE_SIGN = /\p{N}|\b(?:Road|Rd|Street|St|Lane|Ln|Avenue|Ave|Way|Close|Ct|Pl|Square|Sq|Terrace|Crescent|Boulevard|Blvd|Highway|Hwy|Parkway|Pkwy|Estate|Unit|Suite|Building|Bldg|House|Centre|Center|Industrial|Business|Trading|Wharf|Mews|Gardens)\b/u;
/**
 * A continental address (reviews of PR #1467): a street ("Hauptstraße 12", "Alexanderplatz 1", "12 rue de la Paix", "Via
 * Roma 10") or capitalised words and a number after a comma or a line's end ("Damrak 1, "), then a postcode and its
 * town wherever the sentence goes on ("Damrak 1, 1012 LG Amsterdam voor de middag"), with any parts before it on its
 * line. On its own lines, the lines above it go too only when one holds a number or a street word.
 */
const EU_STREET = String.raw`(?:${GERMANIC_STREET_WITH_CODE}|${NUMBER_FIRST_ROMANCE}|${NAME_FIRST_ROMANCE})`;
const EU_STREET_AND_CODE = String.raw`(?:${EU_STREET}[^\S\n]*,?|${ADDRESS_WORDS}[^\S\n]+\d{1,4}[a-z]?[^\S\n]*,)[^\S\n]*${EU_POSTCODE}`;
const EU_STREET_AND_CODE_LINES = String.raw`(?:${EU_STREET}|${ADDRESS_WORDS}[^\S\n]+\d{1,4}[a-z]?)[^\S\n]*,?[^\S\n]*\n[^\S\n]*${EU_POSTCODE}`;
const EU_ADDRESS = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${ADDRESS_PART}[^\S\n]*,[^\S\n]*){0,3}${EU_STREET_AND_CODE}`, "gu");
const EU_ADDRESS_LINES = new RegExp(String.raw`^((?:${ADDRESS_LINE}){0,3})[^\S\n]*${EU_STREET_AND_CODE_LINES}`, "gmu");

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
  // Under the current rules every digit is read in its ASCII form first, so a held number or a street number written in
  // another script's digits is found too.
  let out = wide ? patternForm(fold(text), rules) : fold(text);
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
  if (wide) for (const word of new Set(values(known.people ?? []).flatMap(name => fold(name).split(/[^\p{L}]+/u)))) {
    const pattern = namePartPattern(word);
    if (pattern) out = out.replace(pattern, (_match: string, offset: number, whole: string) => nameAs(whole, offset));
  }
  for (const street of wide ? [...STREETS, ...ORDINAL_STREETS] : STREETS) out = out.replace(street, "");
  if (wide) {
    out = out.replace(EU_ADDRESS_LINES, (_match: string, above: string) => `${ADDRESS_LINE_SIGN.test(above) ? "" : above}${REMOVED}`)
      .replace(EU_ADDRESS, REMOVED)
      .replace(ADDRESS_LINES_BEFORE_POSTCODE, (lines: string) => ADDRESS_LINE_SIGN.test(lines) ? "" : lines)
      .replace(ADDRESS_BEFORE_POSTCODE, REMOVED);
  }
  if (wide) for (const form of PLACE_FORMS) out = out.replace(form, REMOVED);
  // The comma an address left after its place word ("Ship to Oakland, CA 94607" is "Ship to [removed]").
  if (wide) out = out.replace(/\b(to|at|in|near|on|from|into|onto|au|aux|à|en|nach|zu|op|al|para)[^\S\n]*,[^\S\n]*(?=\[removed\])/giu, "$1 ");
  // An email's local part in any script ("ダナ@example.com"): the email pattern reads ASCII only, and left the name. It
  // becomes one ASCII letter, so the email pattern takes the address whole and no word before it (a third review of PR
  // #1467: "Écrivez à marie.desile@exemple.fr" lost "à").
  if (wide) out = out.replace(/[\p{L}\p{N}\p{M}._%+-]*[^\x00-\x7F][\p{L}\p{N}\p{M}._%+-]*(?=@[\p{L}\p{N}])/gu, "x");
  out = out.replace(new RegExp(`\\bthe ${noun}(\\s+the ${noun})+\\b`, "gi"), `the ${noun}`);
  return tidy(removeContactDetails(out, rules), noun);
}

/** Whether `removeIdentifyingDetails` would change the text: the site's page may then say `CONTACT_DETAILS_REMOVED_LINE`. */
export function identifyingDetailsRemoved(text: string, known: KnownSiteIdentity, rules: RedactionRules = CURRENT_REDACTION_RULES): boolean {
  return removeIdentifyingDetails(text, known, { rules }) !== tidy(patternForm(fold(text), rules));
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
 * The capitalised words after a text's first word that could still be a name (stress test round 2, 2026-11-24): what
 * `removeNamesNotHeld` leaves ("Cartons go out. Acme needs them."), which only the model pass can judge. Not an ordinary
 * word (`ordinaryCapitalised`, or a workplace word or a word sentences start with, singular or plural).
 */
export function capitalisedWordsAfterFirst(text: string): string[] {
  const first = /[\p{L}\p{N}]/u.exec(text)?.index ?? 0;
  const ordinary = (lower: string) => GENERIC_NAME_WORDS.has(lower) || SENTENCE_STARTERS.has(lower) || COUNTRY_WORDS.has(lower);
  return [...text.matchAll(CAPITALISED_WORD)].filter(match => {
    if (match.index! <= first || ordinaryCapitalised(match[0])) return false;
    const lower = match[0].replace(POSSESSIVE, "").toLowerCase();
    return ![lower, lower.replace(/s$/, ""), lower.replace(/es$/, "")].some(ordinary);
  }).map(match => match[0]);
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
