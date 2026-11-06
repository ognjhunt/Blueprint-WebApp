/**
 * Intake accepts every task family. Text recognition below is only a hint about
 * the two native evaluators, never a robot-capability verdict or job refusal.
 * Current video and source-bound robot research decide which approaches need
 * investigation. Unknown evaluator coverage stays accepted for analysis and
 * counts as demand; it must not be coerced into a pick-and-place evaluation.
 */

/** `articulated_open_close`: opening one door, drawer or lid of a fixture (Pipeline #2943). */
export type SupportedTaskKind = "rigid_pick_and_place" | "articulated_open_close";

export type UnsupportedTaskReason =
  | "deformable"
  | "liquid"
  | "assembly"
  | "mobile"
  | "closing"
  | "push"
  | "container"
  | "articulated"
  | "other"
  | "multi_step"
  | "unclear";

/**
 * `scorable` is a native task-shape hint, never execution authority.
 * `accepted_for_analysis` keeps arbitrary tasks open for video/database
 * assessment; `held_for_preparation` remains readable on historical records.
 * `needs_description` means no description was supplied.
 */
export type TaskScopeDisposition = "scorable" | "accepted_for_analysis" | "held_for_preparation" | "needs_description";

export interface SiteTaskScopeVerdict {
  /** Native task-shape hint only. False never establishes robot incapability. */
  supported: boolean;
  kind: SupportedTaskKind | null;
  reason: UnsupportedTaskReason | null;
  disposition: TaskScopeDisposition;
  /** The words the verdict rests on, so a person can check it. */
  matched: string[];
}

/** Stored on the job (`inboundRequests.site_task_scope`) at brief confirmation. */
export interface SiteTaskScope extends SiteTaskScopeVerdict {
  schemaVersion: "site_task_scope.v1";
  basis: "brief_text_screen";
  screenedAtIso: string;
  /** For a held job, the kind it asks for: demand evidence for what to build next. */
  demandKind: Exclude<UnsupportedTaskReason, "unclear"> | null;
}

/**
 * The scope, in the words every surface uses: the kinds of job Blueprint's own
 * evaluation can score today. Blueprint runs the candidates itself (owner,
 * 2026-10-26), so this names what our simulation scores, not what any team runs.
 */
export const SUPPORTED_TASK_LINES = [
  "Picking up one rigid object and placing it on a supported destination surface",
  "Opening one door, drawer or lid of a fixture",
] as const;

export const SUPPORTED_TASK_SCOPE =
  "The existing native evaluators cover: picking up one rigid object and placing it at another spot "
  + "on a supported destination surface, and opening one door, drawer or lid of a fixture.";

const NATIVE_COVERAGE_HINTS: ReadonlyArray<[Exclude<UnsupportedTaskReason, "multi_step" | "unclear">, RegExp]> = [
  ["deformable", /\b(fold(s|ed|ing)?|unfold\w*|towels?|cloths?|clothes|clothing|laundry|linens?|garments?|shirts?|fabrics?|textiles?|napkins?|socks?|bed ?sheets?|blankets?|ropes?|cables?|wires?|hoses?|strings?|bags?|bagging|sacks?|pouch(es)?|wrap(s|ped|ping)?|tape|taping|dough|sew(s|ed|ing)?)\b/g],
  ["liquid", /\b(pour(s|ed|ing)?|liquids?|fluids?|spill\w*|spray\w*|sauces?|soups?|drinks?|beverages?|dispens\w*|scoop\w*|wash(es|ed|ing)?|rins\w*|water)\b/g],
  ["assembly", /\b(assembl\w*|insert\w*|screw\w*|unscrew\w*|bolt(s|ed|ing)?|fasten\w*|plug(s|ged|ging)?|pegs?|snap(s|ped|ping)?|install\w*|thread(s|ed|ing)?|weld\w*|glu(e|es|ed|ing)|solder\w*|tighten\w*|loosen\w*|attach\w*|crimp\w*|cnc|fixtures?|chucks?|press[- ]fit\w*|kitting|machine tending)\b/g],
  ["mobile", /\b(walk\w*|driv(e|es|ing)|drove|navigat\w*|deliver\w*|tow(s|ed|ing)?|forklifts?|pallet jacks?|elevators?|hallways?|corridors?|(each|every) floor|room to room|between (rooms|floors|buildings|sites)|across the (room|floor|site|building|warehouse|store|plant|kitchen)|(push|pull|wheel|roll)\w*[^.;]*\b(carts?|trolleys?|dolly|dollies))\b/g],
  ["closing", /\b(clos(e|es|ed|ing)|shut(s|ting)?)\b[^.;]*\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b|\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b[^.;]*\b(clos(e|es|ed|ing)|shut)\b/g],
  // Interior contact geometry needs a compatible native contract before scoring.
  ["container", /\b(in|into|inside)\s+(?:(?:the|a|an|each|every|its|their|one|its own)\s+)?(?:\w+\s+){0,2}?(bins?|totes?|box(es)?|crates?|containers?|baskets?|buckets?|tubs?|cartons?|cases?)\b/g],
  // After "mobile", so pushing a cart reads as moving around the site.
  ["push", /\b(push(es|ed|ing)?|slid(e|es|ing)|nudg(e|es|ed|ing)|shov(e|es|ed|ing))\b/g],
  ["other", /\b(cut(s|ting)?|slic\w*|peel\w*|chop\w*|cook\w*|fry(ing)?|fried|grill\w*|paint\w*|sand(s|ed|ing)?|polish\w*|cleaning|clean(s|ed)?\s+(the|up|down|off|out|all)|wip(e|es|ed|ing)|scrub\w*|mop(s|ped|ping)?|vacuum\w*|sweep\w*|inspect\w*|scan(s|ned|ning)?|label(s|ed|led|ing|ling)?|sort(s|ed|ing)?|count(s|ed|ing)?|weigh(s|ed|ing)?|measur\w*|buttons?|switch(es)?)\b/g],
];

const POSITIVE: ReadonlyArray<[SupportedTaskKind, RegExp]> = [
  ["articulated_open_close", /\b(open(s|ed|ing)?|pull(s|ed|ing)? open)\b[^.;]*\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b|\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b[^.;]*\bopen(s|ed|ing)?\b/g],
  ["rigid_pick_and_place", /\b(pick(s|ed|ing)?|plac(e|es|ed|ing)|put(s|ting)?|mov(e|es|ed|ing)|transfer(s|red|ring)?|(un)?load(s|ed|ing)?|lift(s|ed|ing)?|grab(s|bed|bing)?|grasp(s|ed|ing)?|tak(e|es|ing)|took|restock(s|ed|ing)?|stock(s|ed|ing)?|relocat(e|es|ed|ing)|bring(s|ing)?|brought|stow(s|ed|ing)?|retriev(e|es|ed|ing)|fetch(es|ed|ing)?|pack(s|ed|ing)?(?=[^.;]*\b(into|in|onto)\b))\b/g],
];

/** "Cartons from a conveyor onto a pallet": a relocation even with no verb. */
const RELOCATION = /\bfrom\b[^.;]*\b(to|onto|into|on to|in to)\b/;

/** Where one step ends and the next begins. "And" alone joins one step's verbs. */
const STEP_BREAK = /\b(?:and then|then|after that|afterwards|followed by)\b|;/;

function normalize(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

function hits(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(new RegExp(pattern.source, "g"))].map((match) => match[0]);
}

/** The supported kinds one step names; an explicit verb outranks a bare "from … to". */
function kindsIn(step: string): { kinds: Set<SupportedTaskKind>; matched: string[] } {
  const kinds = new Set<SupportedTaskKind>();
  const matched: string[] = [];
  const articulated = hits(step, POSITIVE[0][1]);
  if (articulated.length) {
    kinds.add("articulated_open_close");
    matched.push(...articulated);
  }
  // An opening sentence's own verbs ("pull it open") are not a second kind of job.
  const rest = articulated.reduce((text, phrase) => text.replace(phrase, " "), step);
  for (const [kind, pattern] of POSITIVE.slice(1)) {
    const found = hits(rest, pattern);
    if (found.length) {
      kinds.add(kind);
      matched.push(...found);
    }
  }
  if (!kinds.size && RELOCATION.test(step)) {
    kinds.add("rigid_pick_and_place");
    matched.push(step.match(RELOCATION)![0]);
  }
  return { kinds, matched };
}

/**
 * The parts verbs play in one move: picking up, putting down, moving in one go, or another act (opening,
 * wiping, loading a machine, handing over). One step is one object, picked up and put down at one place
 * at most. The act list is long on purpose: a verb it does not know cannot add a step, and a missed step
 * narrows the job silently, while a wrong hold only asks the site to rephrase.
 */
type VerbRole = "pickup" | "place" | "relocate" | "act";
const VERB_LEMMAS: ReadonlyArray<[VerbRole, string]> = [
  ["pickup", "pick lift grab grasp collect remove retrieve fetch unload clear"],
  ["place", "put place set lay drop stack store stow hang leave load return pack unpack restock"],
  ["relocate", "move carry bring transfer take deliver relocate shift"],
  ["act", "open close shut turn flip rotate tip tilt shake twist hand give throw toss empty fill pour swap replace "
    + "arrange rearrange align organize organise unlock lock press push pull slide wait check wipe clean wash rinse "
    + "dry scrub sweep mop vacuum dust polish wrap unwrap fold unfold scan label sort count weigh measure inspect "
    + "insert plug unplug screw unscrew tighten loosen attach detach cut slice peel chop cook heat stir mix scoop "
    + "spray tape seal staple bag print sign mark switch start stop"],
];
const IRREGULAR_FORMS: Record<string, string> = { took: "take", taken: "take", brought: "bring", laid: "lay",
  gave: "give", given: "give", threw: "throw", thrown: "throw", shook: "shake", shaken: "shake",
  hung: "hang", putting: "put", setting: "set", dropping: "drop", dropped: "drop", grabbing: "grab",
  grabbed: "grab", shutting: "shut", flipping: "flip", flipped: "flip", tipping: "tip", tipped: "tip",
  swapping: "swap", swapped: "swap", mopping: "mop", mopped: "mop", cutting: "cut", chopping: "chop",
  chopped: "chop", stirring: "stir", stirred: "stir", scooping: "scoop", bagging: "bag", bagged: "bag",
  plugging: "plug", plugged: "plug", unplugging: "unplug", unplugged: "unplug", stopping: "stop", stopped: "stop",
  dried: "dry", drying: "dry" };
/** Each verb form and its role: the lemma, its -s, -ed and -ing forms, and the irregular ones. */
const VERBS: ReadonlyMap<string, VerbRole> = (() => {
  const forms = new Map<string, VerbRole>();
  for (const [role, lemmas] of VERB_LEMMAS) for (const lemma of lemmas.split(" ")) {
    const stem = lemma.endsWith("e") ? lemma.slice(0, -1) : lemma;
    const third = /(s|x|z|ch|sh)$/.test(lemma) ? `${lemma}es` : /[^aeiou]y$/.test(lemma) ? `${lemma.slice(0, -1)}ies` : `${lemma}s`;
    const past = lemma.endsWith("e") ? `${lemma}d` : /[^aeiou]y$/.test(lemma) ? `${lemma.slice(0, -1)}ied` : `${lemma}ed`;
    for (const form of [lemma, third, past, `${stem}ing`]) forms.set(form, role);
  }
  for (const [form, lemma] of Object.entries(IRREGULAR_FORMS)) forms.set(form, forms.get(lemma)!);
  return forms;
})();
/** A word before a verb form that makes it a noun: "the load", "a set", "its place". */
const DETERMINERS = new Set(["the", "a", "an", "this", "that", "these", "those", "its", "their", "his", "her", "my",
  "our", "your", "each", "every", "all", "some", "any", "both", "one", "two", "three", "four", "five", "several",
  "few", "many", "other", "another", "next", "same", "whole", "no"]);
const PRONOUNS = new Set(["it", "them", "this", "that", "these", "those", "one", "ones", "both", "all", "everything",
  "each", "they", "me", "us", "him", "her"]);
const PARTICLES = new Set(["up", "down", "out", "off", "away", "back", "over"]);
/** Prepositions that end a noun phrase; "of" continues one ("a stack of plates" names the plates). */
const PREPOSITIONS = new Set(["to", "onto", "into", "on", "in", "inside", "under", "beneath", "beside", "behind",
  "next", "at", "by", "near", "against", "above", "over", "from", "off", "out", "with", "for", "toward", "towards",
  "until", "while", "when", "where", "so", "as", "up", "down", "away", "back", "through", "across", "along", "around"]);
const DESTINATION = new Set(["to", "onto", "into", "toward", "towards"]);
/** Where a putting-down verb sets the object: "put it on the counter". */
const PLACED_AT = new Set(["on", "in", "inside", "under", "beneath", "beside", "behind", "at", "by", "near", "against",
  "above", "over"]);
/** Words that always end one action: a second verb on the same object ("pick up the tray and put it on
 * the counter") still reads as one step below, so "and" ends an action too. */
const BREAKS = new Set([";", ",", ".", "!", "?", ":", "(", ")", "-", "•", "and", "then", "afterwards", "afterward",
  "finally", "lastly", "subsequently", "also", "plus", "before", "after", "once"]);

type Action = { role: VerbRole; object: string | null; destination: string | null; text: string };

/** The text as words and punctuation, one action per run of words. Hyphenated words stay whole
 * ("wash-and-fold"); "pick-and-place" is one verb pair. A numbered list's numbers end actions. */
function actionSegments(text: string): string[][] {
  const words = normalize(text).replace(/&/g, " and ").replace(/\bpick-and-place\b/g, "pick and place")
    .replace(/(^|\s)\(?\d+[.)](?=\s)/g, " ; ").replace(/([;,.!?:()•])/g, " $1 ").replace(/\s-\s/g, " - ")
    .split(" ").filter(Boolean);
  const segments: string[][] = [[]];
  for (let index = 0; index < words.length; index++) {
    const word = words[index], following = words[index + 1];
    // "after that", "after this", "followed by", and "next" as a step ("..., next load it"),
    // never "the next box" or "next to the sink".
    const twoWord = (word === "after" || word === "followed") && (following === "that" || following === "this" || following === "by");
    const next = word === "next" && following !== "to" && !DETERMINERS.has(words[index - 1] ?? "");
    if (BREAKS.has(word) || twoWord || next) {
      if (twoWord) index++;
      if (segments[segments.length - 1].length) segments.push([]);
      continue;
    }
    segments[segments.length - 1].push(word);
  }
  return segments.filter(segment => segment.length);
}

/** "plates" and "plate" name the same thing. */
function head(word: string): string {
  return /(ches|shes|sses|xes)$/.test(word) ? word.slice(0, -2)
    : word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** The head of the noun phrase starting at `start`, or a pronoun, and where the phrase ends. */
function nounPhrase(words: string[], start: number): { noun: string | null; pronoun: boolean; end: number } {
  let index = start; let noun: string | null = null; let pronoun = false;
  for (; index < words.length; index++) {
    const word = words[index];
    if (word === "of") { noun = null; continue; }
    if (PREPOSITIONS.has(word) || VERBS.has(word) && noun !== null) break;
    if (noun === null && PRONOUNS.has(word) && !DETERMINERS.has(word)) { pronoun = true; index++; break; }
    if (DETERMINERS.has(word) && noun === null) {
      // "that" alone is the object; "that box" names the box.
      if (PRONOUNS.has(word) && (index + 1 >= words.length || PREPOSITIONS.has(words[index + 1]))) { pronoun = true; index++; break; }
      continue;
    }
    noun = head(word);
  }
  return { noun, pronoun, end: index };
}

/** The first place this action puts its object, if it names one. Sources ("from", "off", "out of") are skipped. */
function destinationOf(words: string[], start: number, role: VerbRole): string | null {
  for (let index = start; index < words.length; index++) {
    const word = words[index];
    if (DESTINATION.has(word) || role === "place" && PLACED_AT.has(word)) {
      const phrase = nounPhrase(words, index + 1);
      if (phrase.noun) return phrase.noun;
    }
  }
  return null;
}

function actionIn(words: string[]): Omit<Action, "text"> | null {
  const at = words.findIndex((word, index) => VERBS.has(word) && (index === 0 || !DETERMINERS.has(words[index - 1])));
  if (at < 0) return null;
  const role = VERBS.get(words[at])!;
  let start = at + 1;
  while (start < words.length && PARTICLES.has(words[start])) start++;
  const phrase = nounPhrase(words, start);
  return { role, object: phrase.pronoun ? null : phrase.noun, destination: destinationOf(words, phrase.end, role) };
}

/**
 * The steps a text names when it names more than one, else null. One step is one object, picked up and put
 * down at one place at most, whatever joins its verbs: "pick up the tray and put it on the counter" is one
 * step, as is "pick up the tray, then put it on the counter". More than one step is:
 *
 * - verbs on different objects: "open the fridge and take out the milk", "move the box …, then move the bottle …";
 * - more than one destination: "take the plates to the kitchen and the cups to the sink";
 * - another act beside the move: "put the mug in the sink, then wipe the counter", "pick up the box and turn it over".
 *
 * Sequencing words ("then", "after that", "next", "before", "finally", a numbered list), with or without a
 * comma, only mark where an action may end. Case and punctuation do not matter.
 */
export function multiStepEvidence(text: string | null | undefined): string[] | null {
  const actions: Action[] = [];
  for (const words of actionSegments(text ?? "")) {
    const segment = words.join(" ");
    const action = actionIn(words);
    if (action) { actions.push({ ...action, text: segment }); continue; }
    // No verb: "... and the cups to the sink" repeats the last move for another object and place;
    // "the cup and plate on the tray" names one move's extra object or its place.
    const last = actions[actions.length - 1];
    if (!last) continue;
    const phrase = nounPhrase(words, 0);
    const destination = destinationOf(words, phrase.end, last.role === "relocate" ? "relocate" : "place");
    if (destination && last.destination && phrase.noun)
      actions.push({ role: last.role, object: phrase.noun, destination, text: segment });
    else if (destination && !last.destination) last.destination = destination;
  }
  if (actions.length < 2) return null;
  const objects = new Set(actions.map(action => action.object).filter(Boolean));
  const destinations = new Set(actions.map(action => action.destination).filter(Boolean));
  const otherAct = actions.some(action => action.role === "act") && actions.some(action => action.role !== "act");
  return objects.size > 1 || destinations.size > 1 || otherAct
    ? actions.map(action => action.text.slice(0, 80)).slice(0, 6) : null;
}

function classifyAction(text: string): SiteTaskScopeVerdict | null {
  const steps = text.split(STEP_BREAK).map((step) => step.trim()).filter(Boolean);
  if (!steps.length) return null;
  const readings = steps.map(kindsIn);
  const kinds = new Set(readings.flatMap((reading) => [...reading.kinds]));
  const matched = readings.flatMap((reading) => reading.matched);
  if (!kinds.size) return null;
  if (kinds.size > 1 || readings.some((reading) => !reading.kinds.size)) {
    return { supported: false, kind: null, reason: "multi_step", disposition: "accepted_for_analysis", matched };
  }
  return { supported: true, kind: [...kinds][0], reason: null, disposition: "scorable", matched };
}

/**
 * Screen a confirmed brief. Pure and deterministic.
 *
 * The summary names the job; the success definition can only narrow it, or
 * name the job when the summary does not (a capture sent without a
 * description has the placeholder summary).
 */
export function screenTaskScope(input: {
  summary: string | null | undefined;
  successDefinition?: string | null;
}): SiteTaskScopeVerdict {
  const summary = normalize(input.summary);
  const success = normalize(input.successDefinition);
  const all = `${summary} ; ${success}`;
  for (const [reason, pattern] of NATIVE_COVERAGE_HINTS) {
    const found = hits(all, pattern);
    if (found.length) {
      return { supported: false, kind: null, reason, disposition: "accepted_for_analysis", matched: [...new Set(found)] };
    }
  }
  // Several steps are never read as one (they would be narrowed to its first move): held by name.
  const steps = multiStepEvidence(summary) ?? multiStepEvidence(success);
  if (steps) return { supported: false, kind: null, reason: "multi_step", disposition: "accepted_for_analysis", matched: steps };
  const verdict = classifyAction(summary) ?? classifyAction(success);
  if (verdict) return verdict;
  // An unfamiliar verb is a valid task description. Only absent/placeholder
  // content needs another description; task knowledge is not an intake enum.
  const described = [summary, success].some(text => text && text !== "your site task");
  return { supported: false, kind: null, reason: described ? "other" : "unclear",
    disposition: described ? "accepted_for_analysis" : "needs_description", matched: [] };
}

export function taskScopeRecord(verdict: SiteTaskScopeVerdict, screenedAtIso: string): SiteTaskScope {
  const held = ["held_for_preparation", "accepted_for_analysis"].includes(verdict.disposition) && verdict.reason && verdict.reason !== "unclear";
  return { schemaVersion: "site_task_scope.v1", ...verdict, matched: verdict.matched.slice(0, 20),
    basis: "brief_text_screen", screenedAtIso,
    demandKind: held ? verdict.reason as Exclude<UnsupportedTaskReason, "unclear"> : null };
}

/** True when the job is accepted and held while we prepare an evaluation for its kind. */
export function taskScopeHeld(record: { site_task_scope?: unknown } | null | undefined): boolean {
  const scope = record?.site_task_scope as { supported?: unknown; reason?: unknown } | null | undefined;
  return scope?.supported === false && scope.reason !== "unclear";
}

const REASON_SENTENCES: Record<UnsupportedTaskReason, string> = {
  deformable: "Your job involves soft or flexible items, such as cloth, bags or cables, and needs task-specific evaluation preparation.",
  liquid: "Your job involves liquids, and needs task-specific evaluation preparation.",
  assembly: "Your job involves fitting, inserting or fastening parts, and needs task-specific evaluation preparation.",
  mobile: "Your job involves moving around the site, and needs task-specific evaluation preparation.",
  closing: "Your job closes a door or drawer, and needs task-specific evaluation preparation.",
  push: "Your job pushes or slides an object, and needs task-specific evaluation preparation.",
  container: "Your job places an object inside a container, such as a bin or tote, and needs task-specific evaluation preparation.",
  // Read only from screens recorded before Pipeline #2943; the screen no longer returns it.
  articulated: "Your job opens a door or drawer, which our evaluation could not score before.",
  other: "Your job needs task-specific evaluation preparation.",
  multi_step: "Your job has more than one step. Our simulation tests one step at a time, so we hold your job rather than test only part of it.",
  unclear: "From your job brief, we could not tell which kind of job this is.",
};

export function taskScopeReasonSentence(reason: unknown): string {
  return REASON_SENTENCES[(reason as UnsupportedTaskReason)] ?? REASON_SENTENCES.other;
}

/**
 * What the site is told, on the confirmation, the job page and by email. A
 * brief we could not read needs one sentence, so it is asked for (audit N3).
 * Any other job we cannot score yet is accepted and held while we prepare its
 * evaluation; nothing here refuses a job.
 */
export function taskScopeNotYet(reason: unknown): { headline: string; detail: string; nextStep: string } {
  if (reason === "multi_step") {
    return {
      headline: "Your job is on hold because it has more than one step.",
      detail: `${taskScopeReasonSentence(reason)} ${SUPPORTED_TASK_SCOPE}`,
      nextStep: MULTI_STEP_NEXT_STEP,
    };
  }
  if (reason === "unclear") {
    return {
      headline: "Your job brief needs one sentence about the job before we can evaluate it.",
      detail: `${taskScopeReasonSentence(reason)} ${SUPPORTED_TASK_SCOPE}`,
      nextStep: "Describe the job in one sentence at the top of your job brief and confirm it again.",
    };
  }
  return {
    headline: "We have your job and are preparing an evaluation for it.",
    detail: `${taskScopeReasonSentence(reason)} ${SUPPORTED_TASK_SCOPE} We are holding your job while we build an `
      + "evaluation for its kind, and jobs like yours decide what we build next.",
    nextStep: "Your job stays on file, and we will email you when we can evaluate it. "
      + "If we read your job wrong, reply to our email.",
  };
}

/** The typed hold for a job whose description names more than one step. Held before any spend: no grant,
 * reservation or scene intake is admitted for it (websiteSceneSponsorship.ts), so it is never narrowed. */
export const MULTI_STEP_TASK_HOLD = "website_multi_step_task_preparation_required";
const MULTI_STEP_NEXT_STEP = "To have one step tested, change your job description to that one step and confirm it. "
  + "Otherwise your job stays on hold and your video stays saved; you do not need to send it again.";

/**
 * The current brief's multi-step hold, with the steps it was read from, or null.
 *
 * Read from the steps themselves, whatever reason the screen gives: "put the mug in the sink, then wipe
 * the counter" screens as `other` (wiping) and is still several steps. Pure, and never part of the task
 * context, so a job it does not hold keeps its context digest: only `screenTaskScope`'s own verdict
 * shapes that projection (`projectWebsiteTaskContext`), and it changes only for a job held here.
 */
export function multiStepTaskHold(brief: { summary?: string | null;
  successCriteria?: { successDefinition?: string | null } | null } | null | undefined):
  { code: typeof MULTI_STEP_TASK_HOLD; steps: string[] } | null {
  if (!brief) return null;
  const success = brief.successCriteria?.successDefinition;
  const steps = multiStepEvidence(brief.summary) ?? multiStepEvidence(success);
  if (steps) return { code: MULTI_STEP_TASK_HOLD, steps };
  // Steps of different kinds, or one the screen could not place ("pick up the box, then wait for approval").
  const verdict = screenTaskScope({ summary: brief.summary, successDefinition: success });
  return verdict.reason === "multi_step" ? { code: MULTI_STEP_TASK_HOLD, steps: verdict.matched.slice(0, 6) } : null;
}

/** What the job page says while a multi-step job is held: which steps we read, and the one thing that moves it. */
export function multiStepHoldMessage(steps: readonly string[]): { headline: string; action: string } {
  const read = steps.length > 1 ? ` We read these steps: ${steps.map(step => `“${step}”`).join(", ")}.` : "";
  return {
    headline: "Your job is on hold because it has more than one step.",
    action: `Our simulation tests one step at a time, such as picking up one object and putting it down somewhere else.${read} `
      + `We won't test only part of your job without asking you. ${MULTI_STEP_NEXT_STEP}`,
  };
}

/**
 * The task Blueprint's simulation actually scored, from the Pipeline's task
 * kind or strategy, in the site's terms and the same words as
 * `SUPPORTED_TASK_LINES`. Null when the kind is missing or unknown, so a card
 * never guesses what was tested.
 */
export function scoredTaskDescription(kind: unknown): string | null {
  switch (typeof kind === "string" ? kind.trim() : "") {
    case "rigid_pick_place":
    case "pick_and_place":
    case "rigid_pick_and_place":
      return "Pick up the object and place it in the target area";
    case "planar_push":
      return "Push the object across the surface into the target area";
    case "articulated_open_close":
      return "Open the door, drawer or lid and hold it open";
    default:
      return null;
  }
}
