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

/**
 * Native execution coverage hint. It does not close intake, hide an approved
 * card or veto a source-bound scene-only proposal. A false hint keeps exact
 * task execution held until the compatible adapter/scorer is available.
 */
export function taskScopeNotSupported(record: { site_task_scope?: unknown } | null | undefined): boolean {
  const scope = record?.site_task_scope as { supported?: unknown } | null | undefined;
  return scope?.supported === false;
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
  multi_step: "Your job has more than one step, and needs task-specific evaluation preparation.",
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
