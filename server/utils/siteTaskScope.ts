/**
 * Intake accepts every job, whatever its kind or shape (owner: "accept every job then determine what
 * is needed from there"). Text recognition below is only a hint about the two native evaluators, never a
 * robot-capability verdict, a hold or a refusal: every accepted job is told the same thing, and the Pipeline
 * prepares every kind, shipping the room package with a note when a piece cannot be prepared. Unknown evaluator
 * coverage stays accepted for analysis; it must not be coerced into a pick-and-place evaluation. The one thing
 * asked of the site here is the job's own sentence, when its brief gives none (`UNCLEAR_BRIEF_ASK`).
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
 * assessment, and is prepared like any other job; `held_for_preparation`
 * remains readable on historical records and holds nothing.
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
  /** For a job our native evaluators do not score, the kind it asks for: demand evidence, never a hold. */
  demandKind: Exclude<UnsupportedTaskReason, "unclear"> | null;
}

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

/**
 * The summary's own instruction is a trip by the robot: a verb of going opens its first clause, or follows
 * the robot as subject, and is followed straight by where it goes ("Go from the doorway to the table",
 * "Move over to the bench", "Head back to the dock", "The robot travels from the lobby to the lift").
 * Without it, a "from … to" with no known verb reads as an object moved (RELOCATION), and "move" as moving
 * an object. Never read from the success definition, mid-sentence, or with an object as subject.
 */
const ROBOT_TRIP = /^(?:(?:the |our )?robot (?:(?:should|must|will|can|needs to|has to) )?(?:go(?:es)?|mov(?:e|es)|travel(?:s)?|head(?:s)?|proceed(?:s)?|come(?:s)?)|(?:go|going|mov(?:e|ing)|travel(?:ling|ing)?|head(?:ing)?|proceed(?:ing)?|com(?:e|ing))) (?:(?:over|back|straight|directly|forward|all the way) )?(?:from|to|toward|towards|into|through|across|along|around|past|between)\b/;

/** The trip the summary names, when it names nothing else: one clause, and no verb of handling an object. */
function robotTrip(summary: string, success: string): string | null {
  const trip = summary.match(ROBOT_TRIP)?.[0];
  if (!trip || STEP_BREAK.test(summary) || /[,:]/.test(summary)) return null;
  // A place followed straight by another noun phrase names an object after it: "move to the shelf the boxes".
  const said = summary.slice(trip.length).replace(/[.!?]/g, " ").split(/\s+/).filter(Boolean);
  if (said.some((word, index) => index + 1 < said.length && !PREPOSITIONS.has(word) && !DETERMINERS.has(word)
    && !["and", "or"].includes(word) && (DETERMINERS.has(said[index + 1]) || /^\d/.test(said[index + 1])))) return null;
  // A verb form after a determiner is a noun ("the loading dock", "the lift"), so it is set aside.
  const words = `${summary.slice(trip.length)} ; ${success}`.split(/\s+/)
    .filter((word, index, all) => !DETERMINERS.has(all[index - 1] ?? ""));
  const rest = words.join(" ");
  if (POSITIVE.some(([, pattern]) => hits(rest, pattern).length)) return null;
  if (words.some(word => VERBS.has(word.replace(/[^a-z-]/g, "")))) return null;
  return trip;
}

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
 * narrows the job silently, while a wrong reading of several steps only leaves the job's family to the Pipeline's
 * own reading (`general_task`): the job is accepted and prepared either way.
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

/** Whether a text names an action on the site, whatever its kind: a verb this reader knows, used as a verb. */
export function namesAnAction(text: string | null | undefined): boolean {
  return actionSegments(text ?? "").some(words => actionIn(words) !== null);
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
  // Several steps are never read as one (they would be narrowed to its first move). The job goes ahead as any other.
  const steps = multiStepEvidence(summary) ?? multiStepEvidence(success);
  if (steps) return { supported: false, kind: null, reason: "multi_step", disposition: "accepted_for_analysis", matched: steps };
  // A trip by the robot reads as a walk job does, before a bare "from … to" could make it an object move.
  const trip = robotTrip(summary, success);
  if (trip) return { supported: false, kind: null, reason: "mobile", disposition: "accepted_for_analysis", matched: [trip] };
  const verdict = classifyAction(summary) ?? classifyAction(success);
  if (verdict) return verdict;
  // An unfamiliar verb is a valid task description. Only absent/placeholder
  // content needs another description; task knowledge is not an intake enum.
  const described = [summary, success].some(text => text && text !== "your site task");
  return { supported: false, kind: null, reason: described ? "other" : "unclear",
    disposition: described ? "accepted_for_analysis" : "needs_description", matched: [] };
}

export function taskScopeRecord(verdict: SiteTaskScopeVerdict, screenedAtIso: string): SiteTaskScope {
  const demand = ["held_for_preparation", "accepted_for_analysis"].includes(verdict.disposition) && verdict.reason && verdict.reason !== "unclear";
  return { schemaVersion: "site_task_scope.v1", ...verdict, matched: verdict.matched.slice(0, 20),
    basis: "brief_text_screen", screenedAtIso,
    demandKind: demand ? verdict.reason as Exclude<UnsupportedTaskReason, "unclear"> : null };
}

/**
 * What the site is asked, on the confirmation, the job page and by email, when its brief gives no sentence about
 * the job (`reason: "unclear"`): the one thing the job needs from the site. Every other reading of a job's kind or
 * shape is said nowhere: an accepted job of any kind is told what every accepted job is told.
 */
export const UNCLEAR_BRIEF_ASK = {
  headline: "Tell us the job in one sentence.",
  detail: "We couldn't tell what the job is from your description.",
  nextStep: "Write it in one sentence in your job description and confirm it.",
} as const;

/** Whether a stored scope reading asks the site for its job's sentence (`UNCLEAR_BRIEF_ASK`). */
export function taskBriefUnclear(scope: { supported?: unknown; reason?: unknown } | null | undefined): boolean {
  return scope?.supported === false && scope.reason === "unclear";
}

/**
 * The task Blueprint's simulation actually scored, from the Pipeline's task
 * kind or strategy, in the site's terms. Null when the kind is missing or
 * unknown, so a card never guesses what was tested.
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
