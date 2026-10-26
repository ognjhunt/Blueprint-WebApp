/**
 * Whether Blueprint can score a site's job in simulation today.
 *
 * ## Why this screen exists
 *
 * A website job's scene is prepared as one of two tasks (Pipeline
 * `website_task_preparation`): picking up one rigid object and placing it at a
 * target spot (scored on a lift and a placement), or opening a door or drawer.
 * The beta's evaluation is a robot team's run, and the team scene packet
 * (Pipeline `team_scene_packet.py`) accepts both since Pipeline #2943: an
 * opening job compiles with its owner's contract and a robot station clear of
 * the part's swing, for teams on Blueprint's Franka interface. It still
 * refuses destination bodies by name, and the preparation blocks placing an
 * object inside a container (`task_destination_interior_geometry_required`)
 * and needs the target spot on the surface the object starts on. So a team
 * can evaluate a rigid pick-and-place onto that surface or opening one door
 * or drawer, and container placements are refused here rather than left to
 * wait for an evaluation that cannot run (audit N4).
 * Pushing is not scored: no website success contract scores a push, so a push
 * job is refused like any other. A closing job would be scored as a different
 * task and is refused too. The Pipeline builds every non-articulated website
 * job as `pick_and_place`, so a towel-folding job could "pass" a pick-and-place
 * it never asked for. Nothing screened the kind of task at intake. This does,
 * when the site confirms its job brief.
 *
 * Whether the target spot is on the same surface is not something a keyword
 * screen can read; the supported line says it plainly, and the Pipeline's
 * preparation holds a job whose spot is elsewhere.
 *
 * ## How it reads the brief
 *
 * The brief has no structured task-kind field: its summary is the site's own
 * task statement, and the success definition is free text. So this is a
 * deterministic keyword screen, and it is conservative on purpose:
 *
 * - any sign of a kind we cannot score (soft items, liquids, fitting parts
 *   together, moving around the site, or another action) fails it;
 * - more than one kind of action, or a sequence with a step we cannot read,
 *   is a multi-step job and fails it;
 * - a brief that names no action we recognize fails it as unclear.
 *
 * A false "not yet" costs a site a reply; a false pass shows robot teams a job
 * whose evaluation would score a different task. Not a model call: the same
 * brief always screens the same way, and anyone can see why.
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

export interface SiteTaskScopeVerdict {
  supported: boolean;
  kind: SupportedTaskKind | null;
  reason: UnsupportedTaskReason | null;
  /** The words the verdict rests on, so a person can check it. */
  matched: string[];
}

/** Stored on the job (`inboundRequests.site_task_scope`) at brief confirmation. */
export interface SiteTaskScope extends SiteTaskScopeVerdict {
  schemaVersion: "site_task_scope.v1";
  basis: "brief_text_screen";
  screenedAtIso: string;
}

/** The scope, in the words every surface uses: what a robot team's evaluation can run. */
export const SUPPORTED_TASK_LINES = [
  "Picking up one rigid object and placing it at another spot on the same table, shelf or counter",
  "Opening one door, drawer or lid of a fixture",
] as const;

export const SUPPORTED_TASK_SCOPE =
  "Today our simulation can score two kinds of job: picking up one rigid object and placing it at another spot "
  + "on the same table, shelf or counter, and opening one door, drawer or lid of a fixture.";

const UNSUPPORTED: ReadonlyArray<[Exclude<UnsupportedTaskReason, "multi_step" | "unclear">, RegExp]> = [
  ["deformable", /\b(fold(s|ed|ing)?|unfold\w*|towels?|cloths?|clothes|clothing|laundry|linens?|garments?|shirts?|fabrics?|textiles?|napkins?|socks?|bed ?sheets?|blankets?|ropes?|cables?|wires?|hoses?|strings?|bags?|bagging|sacks?|pouch(es)?|wrap(s|ped|ping)?|tape|taping|dough|sew(s|ed|ing)?)\b/g],
  ["liquid", /\b(pour(s|ed|ing)?|liquids?|fluids?|spill\w*|spray\w*|sauces?|soups?|drinks?|beverages?|dispens\w*|scoop\w*|wash(es|ed|ing)?|rins\w*|water)\b/g],
  ["assembly", /\b(assembl\w*|insert\w*|screw\w*|unscrew\w*|bolt(s|ed|ing)?|fasten\w*|plug(s|ged|ging)?|pegs?|snap(s|ped|ping)?|install\w*|thread(s|ed|ing)?|weld\w*|glu(e|es|ed|ing)|solder\w*|tighten\w*|loosen\w*|attach\w*|crimp\w*|cnc|fixtures?|chucks?|press[- ]fit\w*|kitting|machine tending)\b/g],
  ["mobile", /\b(walk\w*|driv(e|es|ing)|drove|navigat\w*|deliver\w*|tow(s|ed|ing)?|forklifts?|pallet jacks?|elevators?|hallways?|corridors?|(each|every) floor|room to room|between (rooms|floors|buildings|sites)|across the (room|floor|site|building|warehouse|store|plant|kitchen)|(push|pull|wheel|roll)\w*[^.;]*\b(carts?|trolleys?|dolly|dollies))\b/g],
  ["closing", /\b(clos(e|es|ed|ing)|shut(s|ting)?)\b[^.;]*\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b|\b(doors?|drawers?|cabinets?|cupboards?|lockers?|hatch(es)?|gates?)\b[^.;]*\b(clos(e|es|ed|ing)|shut)\b/g],
  // Placing an object inside something: the preparation holds it before a scene exists.
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
    return { supported: false, kind: null, reason: "multi_step", matched };
  }
  return { supported: true, kind: [...kinds][0], reason: null, matched };
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
  for (const [reason, pattern] of UNSUPPORTED) {
    const found = hits(all, pattern);
    if (found.length) return { supported: false, kind: null, reason, matched: [...new Set(found)] };
  }
  const verdict = classifyAction(summary) ?? classifyAction(success);
  return verdict ?? { supported: false, kind: null, reason: "unclear", matched: [] };
}

export function taskScopeRecord(verdict: SiteTaskScopeVerdict, screenedAtIso: string): SiteTaskScope {
  return { schemaVersion: "site_task_scope.v1", ...verdict, matched: verdict.matched.slice(0, 20),
    basis: "brief_text_screen", screenedAtIso };
}

/** True only when the job's recorded screen says we cannot score it. Unscreened jobs are unaffected. */
export function taskScopeNotSupported(record: { site_task_scope?: unknown } | null | undefined): boolean {
  const scope = record?.site_task_scope as { supported?: unknown } | null | undefined;
  return scope?.supported === false;
}

const REASON_SENTENCES: Record<UnsupportedTaskReason, string> = {
  deformable: "Your job involves soft or flexible items, such as cloth, bags or cables, and our simulation cannot score those yet.",
  liquid: "Your job involves liquids, and our simulation cannot score those yet.",
  assembly: "Your job involves fitting, inserting or fastening parts, and our simulation cannot score that yet.",
  mobile: "Your job involves moving around the site, and our simulation scores work at one station today.",
  closing: "Your job closes a door or drawer, and our simulation cannot score that yet.",
  push: "Your job pushes or slides an object, and our simulation scores picking it up and placing it today.",
  container: "Your job places an object inside a container, such as a bin or tote, and our simulation scores placing it on a surface today.",
  // Read only from screens recorded before Pipeline #2943; the screen no longer returns it.
  articulated: "Your job opens a door or drawer, and a robot team's evaluation cannot score that yet.",
  other: "Your job involves an action our simulation cannot score yet.",
  multi_step: "Your job has more than one step, and our simulation scores one action at a time today.",
  unclear: "From your job brief, we could not tell which kind of job this is.",
};

export function taskScopeReasonSentence(reason: unknown): string {
  return REASON_SENTENCES[(reason as UnsupportedTaskReason)] ?? REASON_SENTENCES.other;
}

/**
 * What the site is told, on the confirmation, the job page and by email. A
 * brief we could not read is not out of scope: it needs one sentence, so it
 * is asked for, not refused (audit N3).
 */
export function taskScopeNotYet(reason: unknown): { headline: string; detail: string; nextStep: string } {
  if (reason === "unclear") {
    return {
      headline: "Your job brief needs one sentence about the job before robot teams can evaluate it.",
      detail: `${taskScopeReasonSentence(reason)} ${SUPPORTED_TASK_SCOPE}`,
      nextStep: "Describe the job in one sentence at the top of your job brief and confirm it again.",
    };
  }
  return {
    headline: "Not yet: we cannot score this job in simulation today, so it is not open to robot teams.",
    detail: `${taskScopeReasonSentence(reason)} ${SUPPORTED_TASK_SCOPE}`,
    nextStep: "Your job stays on file. If we read it wrong, reply to our email.",
  };
}

/**
 * The task the simulation actually scored, from the Pipeline's task kind or
 * strategy, in the site's terms. Null when the kind is missing or unknown, so
 * a card never guesses what was tested.
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
      return "Open the door or drawer and hold it open";
    default:
      return null;
  }
}
