// The one question an outreach-ready hypothesis asks, by rule version: a TypeScript mirror of Pipeline
// tools/daily_research/verification.py (question_template, question_task, site_city, city_case,
// site_phrase and outreach_question). The shared golden file's question_wording vectors and tables pin
// it. A row keeps the wording of the rule it was published under: v1.1 rows v1.1, v1.2 rows v1.2.

export const OUTREACH_RULE_VERSION = "blueprint.outreach-ready-rule.v1.2";
export const LEGACY_OUTREACH_RULE_VERSION = "blueprint.outreach-ready-rule.v1.1";
export const OUTREACH_RULE_VERSIONS = [LEGACY_OUTREACH_RULE_VERSION, OUTREACH_RULE_VERSION] as const;
export type OutreachRuleVersion = typeof OUTREACH_RULE_VERSIONS[number];
export const isOutreachRuleVersion = (value: unknown): value is OutreachRuleVersion =>
  typeof value === "string" && (OUTREACH_RULE_VERSIONS as readonly string[]).includes(value);

/** v1.2, word for word: <task> is questionTask(task) and <site> is sitePhrase(site, location). */
export const OUTREACH_READY_QUESTION_TEMPLATES = {
  /** Site link open. */
  S: (task: string, site: string) => `Is ${task} done at ${site}, or somewhere else in the company?`,
  /** Manual workflow open. */
  M: (task: string, site: string) => `Which parts of ${task} at ${site} still need people, and what has kept them from being automated?`,
  /** Manual workflow verified, partial automation shown. */
  A: (task: string, site: string) => `What has kept the rest of ${task} at ${site} from being automated so far?`,
  /** Manual workflow verified, automation unknown or none shown. */
  U: (task: string, site: string) => `Is any of ${task} at ${site} automated today, or is it all done by hand?`,
} as const;
/** v1.1, word for word, with the candidate's task and site fields verbatim. Only re-derives v1.1 rows. */
export const LEGACY_OUTREACH_READY_QUESTION_TEMPLATES = {
  S: (task: string, site: string) => `Is ${task} done at your ${site} site, or somewhere else in the company?`,
  M: (task: string, site: string) => `Which parts of ${task} at ${site} still need people, and what has kept them from being automated?`,
  A: (task: string, site: string) => `What has kept the remaining ${task} work at ${site} from being automated so far?`,
} as const;
export const OUTREACH_READY_QUESTION_TEMPLATES_BY_RULE: Record<OutreachRuleVersion, Partial<Record<OutreachReadyQuestionTemplate,
  (task: string, site: string) => string>>> = {
  [LEGACY_OUTREACH_RULE_VERSION]: LEGACY_OUTREACH_READY_QUESTION_TEMPLATES, [OUTREACH_RULE_VERSION]: OUTREACH_READY_QUESTION_TEMPLATES };
export type OutreachReadyQuestionTemplate = keyof typeof OUTREACH_READY_QUESTION_TEMPLATES;

export const STATE_NAMES: Record<string, string> = { AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii",
  ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine",
  MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana",
  NE: "nebraska", NV: "nevada", NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york", NC: "north carolina",
  ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania", PR: "puerto rico", RI: "rhode island",
  SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont", VA: "virginia",
  WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming" };
export const COUNTRY_NAMES = ["canada", "mexico", "uk", "united kingdom", "united states", "united states of america", "us", "usa"];
export const TRAILING_MARKS = ".,;:!?…。，；：！？؟،؛ ";
export const SHORT_SITE_NAME = { words: 4, characters: 40 } as const;
export const SMALL_WORDS = ["and", "de", "del", "du", "la", "le", "of", "or", "the"];
const ZIP = "[0-9]{5}(?:-[0-9]{4})?";
const STATE_TAIL = new RegExp(`(?:^| )(?:(?:${[...new Set([...Object.keys(STATE_NAMES), ...Object.values(STATE_NAMES)])]
  .sort((a, b) => b.length - a.length).join("|")})(?: ${ZIP})?|${ZIP})$`, "i");
// ASCII whitespace and digits only, as verification.py reads them.
const collapsed = (value: unknown) => typeof value === "string" ? value.replace(/[ \t\n\r\f\v]+/g, " ").replace(/^ +| +$/g, "") : "";
function trimMarks(value: string) {
  let end = value.length;
  while (end > 0 && TRAILING_MARKS.includes(value[end - 1])) end--;
  return value.slice(0, end);
}
const placeKey = (value: string) => collapsed(value.replaceAll(".", "")).toLowerCase();
const hasLetter = (value: string) => /\p{L}/u.test(value);

/** S while the site link is open, else M while the manual workflow is open, else A when partial automation
 * is shown and U when it is unknown or none is shown. v1.1 asks A in both of those cases. */
export function outreachReadyQuestionTemplate(openChecks: readonly string[], partialAutomation = false,
  ruleVersion: OutreachRuleVersion = OUTREACH_RULE_VERSION): OutreachReadyQuestionTemplate {
  if (openChecks.includes("site_link")) return "S";
  if (openChecks.includes("manual_workflow")) return "M";
  return partialAutomation === true || ruleVersion === LEGACY_OUTREACH_RULE_VERSION ? "A" : "U";
}
/** The task as the question writes it: whitespace collapsed, trailing punctuation dropped, and the first
 * letter lower-cased only when the first word is an ordinary capitalised word ("Loading", not "CNC"). */
export function questionTask(task: unknown) {
  let value = trimMarks(collapsed(task));
  const word = [...value.split(" ", 1)[0]], letters = word.filter(char => /\p{L}/u.test(char));
  if (word.length && /^\p{Lu}$/u.test(word[0]) && letters.length >= 2 && letters.slice(1).every(char => /^\p{Ll}$/u.test(char))) {
    value = word[0].toLowerCase() + value.slice(word[0].length);
  }
  return value;
}
/** The city of a location or address as the source wrote it, without its state, ZIP code or country. */
export function siteCity(location: unknown): string | null {
  if (typeof location !== "string") return null;
  let parts = location.split(";")[0].split(",").map(collapsed).filter(Boolean), stated = false;
  while (parts.length && COUNTRY_NAMES.includes(placeKey(parts.at(-1)!))) parts.pop();
  while (parts.length && new RegExp(`^${ZIP}$`).test(parts.at(-1)!)) { parts.pop(); stated = true; }
  if (parts.length && (Object.hasOwn(STATE_NAMES, placeKey(parts.at(-1)!).toUpperCase())
    || Object.values(STATE_NAMES).includes(placeKey(parts.at(-1)!)))) { parts.pop(); stated = true; }
  else if (parts.length && STATE_TAIL.test(parts.at(-1)!)) {
    parts[parts.length - 1] = parts.at(-1)!.replace(STATE_TAIL, "").replace(/ +$/, ""); stated = true;
  }
  parts = parts.map(trimMarks).filter(Boolean);
  const city = parts.length ? (stated ? parts.at(-1)! : parts[0]) : null;
  return !city || /[0-9]/.test(city) || !hasLetter(city) ? null : city;
}
/** An ALL CAPS city title-cased (Mc and a letter-apostrophe prefix restored, small words lower-case
 * inside); any other casing is kept exactly. */
export function cityCase(city: string) {
  if (!/\p{Lu}/u.test(city) || /\p{Ll}/u.test(city)) return city;
  return city.split(" ").map((word, index) => word.split("-").map((part, position) => {
    const letters = [...part.toLowerCase()];
    if ((index || position) && SMALL_WORDS.includes(letters.join(""))) return letters.join("");
    if (letters.length) letters[0] = letters[0].toUpperCase();
    if (letters.length > 2 && (letters[0] + letters[1] === "Mc" || "'’".includes(letters[1]))) letters[2] = letters[2].toUpperCase();
    return letters.join("");
  }).join("-")).join(" ");
}
/** "your <City> site", else "your <name> site" for a short site name, else "this site". */
export function sitePhrase(site: unknown, location?: unknown) {
  const city = siteCity(location);
  if (city) return `your ${cityCase(city)} site`;
  const name = typeof site === "string" ? trimMarks(collapsed(site.split(",")[0])) : "";
  if (name && !"0123456789".includes(name[0]) && name.split(" ").length <= SHORT_SITE_NAME.words
    && [...name].length <= SHORT_SITE_NAME.characters && hasLetter(name)) {
    return name.toLowerCase() === "site" || name.toLowerCase().endsWith(" site") ? `your ${name}` : `your ${name} site`;
  }
  return "this site";
}
/** The one question a hypothesis with these open checks asks under ``ruleVersion`` (default v1.2):
 * v1.2 with questionTask and sitePhrase(site, location), v1.1 with the task and site fields verbatim. */
export function outreachReadyQuestion(openChecks: readonly string[], task: string, site: string,
  { location = null, partialAutomation = false, ruleVersion = OUTREACH_RULE_VERSION }:
    { location?: unknown; partialAutomation?: boolean; ruleVersion?: OutreachRuleVersion } = {}) {
  if (!isOutreachRuleVersion(ruleVersion)) throw new Error("outreach_rule_version_unknown");
  const template = outreachReadyQuestionTemplate(openChecks, partialAutomation, ruleVersion);
  return ruleVersion === LEGACY_OUTREACH_RULE_VERSION ? LEGACY_OUTREACH_READY_QUESTION_TEMPLATES[template as "S" | "M" | "A"](task, site)
    : OUTREACH_READY_QUESTION_TEMPLATES[template](questionTask(task), sitePhrase(site, location));
}

// Each template with <task> and <site> left open, for a block that does not carry them.
const shapes = (templates: Record<string, (task: string, site: string) => string>) => Object.fromEntries(Object.entries(templates)
  .map(([name, template]) => {
    const [task, site] = ["\u0000", "\u0001"];
    const pattern = template(task, site).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(task, "(.+)").replace(site, "(.+)");
    return [name, new RegExp(`^${pattern}$`)];
  }));
const SHAPES = { [LEGACY_OUTREACH_RULE_VERSION]: shapes(LEGACY_OUTREACH_READY_QUESTION_TEMPLATES),
  [OUTREACH_RULE_VERSION]: shapes(OUTREACH_READY_QUESTION_TEMPLATES) } as Record<OutreachRuleVersion, Record<string, RegExp>>;
/** The question follows a template these open checks choose under one rule version: S, M, or (v1.2) A or U, or (v1.1) A. */
export function outreachReadyQuestionShaped(openChecks: readonly string[], question: string) {
  return OUTREACH_RULE_VERSIONS.some(rule => [...new Set([false, true].map(partial => outreachReadyQuestionTemplate(openChecks, partial, rule)))]
    .some(name => SHAPES[rule][name]?.test(question)));
}
