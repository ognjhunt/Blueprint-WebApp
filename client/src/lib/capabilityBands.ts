/**
 * Comparing a site's requirement to a robot team's capability.
 *
 * ## Why this is a separate module from the matcher
 *
 * Everything here is about one question — does this band clear that band — and
 * it is the only place in the match path where an enum value is interpreted as
 * a magnitude. Keeping it separate means the ordering of every scale is stated
 * once, in a table a reviewer can read, rather than implied by comparison
 * operators scattered through matching logic.
 *
 * `robotSpecFields` already declares `siteSpecCounterpart` on each mirrored
 * field, with the intent written out: "a match is `robot.payloadCapacity >=
 * site.payloadWeight` rather than two humans reading two paragraphs." This is
 * the `>=`.
 *
 * ## Three outcomes, never two
 *
 * A comparison returns `clears`, `short`, or `unknown`. The third is the one
 * that matters. An unanswered payload question is not a passing payload
 * question, and it is not a failing one either — it is a thing nobody has told
 * us. Collapsing it into either would put "three teams clear your payload" in
 * an email when the truth is "we have no idea about two of them."
 *
 * This mirrors `gateTriage`'s rule that a blank never counts as a pass, and it
 * is the reason `MatchResult` distinguishes a confirmed clear from an unknown.
 */

/** How one band reading compares to what was asked of it. */
export type BandComparison = "clears" | "short" | "unknown";

/**
 * Which way the comparison runs.
 *
 * `at_least` — the capability must reach or exceed the requirement. Payload: a
 * site lifting 10-25kg needs a robot rated 10-25kg or better.
 *
 * `at_most` — the capability must come in at or under the requirement. Cycle
 * time: a site on a 30-second cycle needs a robot that can hold 30 seconds or
 * faster. Budget: a robot whose deployments start above the site's ceiling is
 * the 5x gap the intake exists to catch early.
 */
export type BandDirection = "at_least" | "at_most";

/**
 * An ordered scale, lowest first.
 *
 * `unknowns` are values that carry no magnitude — "It varies a lot", "We have
 * not set one". They are listed rather than inferred so that adding an option
 * to an intake without deciding what it means here is a visible omission
 * instead of a silent `short`.
 */
export interface BandScale {
  id: string;
  /** Ordered lowest to highest. Membership is the source of truth for rank. */
  order: readonly string[];
  /** Values that mean "not answered" rather than a position on the scale. */
  unknowns?: readonly string[];
  direction: BandDirection;
  /** Whether failing this comparison removes a candidate or merely ranks it. */
  weight: "hard" | "soft";
  /** How to say the comparison out loud, for a reviewer and for an email. */
  label: string;
}

/**
 * The scales, in the order a match applies them: cheapest no first.
 *
 * Hard constraints come first and eliminate. A robot that cannot lift the thing
 * is not a worse match, it is not a match, and no amount of cycle-time
 * excellence changes that. Soft constraints only order the survivors.
 *
 * `lighting` is deliberately soft. The two intakes list it in the same order —
 * consistent, mixed, daylight, low — but whether changing daylight is genuinely
 * harder than low light is an assumption, not a fact, and an assumption should
 * cost ranking accuracy rather than eliminate a team that might be right.
 */
export const bandScales: readonly BandScale[] = [
  {
    id: "payload",
    order: ["under_2kg", "two_to_ten", "ten_to_twentyfive", "over_25kg"],
    direction: "at_least",
    weight: "hard",
    label: "payload",
  },
  {
    // The safety envelope. A site whose people work in the same space needs a
    // system rated for exactly that; anything less is a different and much
    // longer safety project, which is the clear-window gate's own argument.
    id: "humanProximity",
    order: ["isolated", "nearby", "shared"],
    direction: "at_least",
    weight: "hard",
    label: "human proximity",
  },
  {
    id: "budget",
    order: ["under_50k", "fifty_to_250k", "250k_to_1m", "over_1m"],
    unknowns: ["unsure"],
    direction: "at_most",
    weight: "hard",
    label: "budget",
  },
  {
    id: "cycleTime",
    order: ["under_30s", "thirty_to_two_min", "two_to_ten_min", "over_ten_min"],
    unknowns: ["varies"],
    direction: "at_most",
    weight: "soft",
    label: "cycle time",
  },
  {
    id: "volume",
    order: ["under_50", "fifty_to_250", "250_to_1000", "over_1000"],
    direction: "at_least",
    weight: "soft",
    label: "throughput",
  },
  {
    id: "successRate",
    order: ["ninety", "ninetyfive", "ninetynine", "ninetynine_plus"],
    unknowns: ["unsure"],
    direction: "at_least",
    weight: "soft",
    label: "demonstrated success rate",
  },
  {
    id: "lighting",
    order: ["consistent", "mixed", "daylight", "low"],
    direction: "at_least",
    weight: "soft",
    label: "lighting",
  },
];

export const bandScaleById: Readonly<Record<string, BandScale>> = Object.fromEntries(
  bandScales.map((scale) => [scale.id, scale]),
);

function rankOf(scale: BandScale, value: string | null | undefined): number | null {
  if (!value) return null;
  if (scale.unknowns?.includes(value)) return null;
  const index = scale.order.indexOf(value);
  return index === -1 ? null : index;
}

/**
 * Compare one requirement against one capability.
 *
 * Either side being absent, unrecognised, or an explicit non-answer yields
 * `unknown`. Nothing here guesses.
 */
export function compareBand(
  scale: BandScale,
  requirement: string | null | undefined,
  capability: string | null | undefined,
): BandComparison {
  const required = rankOf(scale, requirement);
  const have = rankOf(scale, capability);
  if (required === null || have === null) return "unknown";

  const clears = scale.direction === "at_least" ? have >= required : have <= required;
  return clears ? "clears" : "short";
}

/**
 * Say what happened, in the operator's own bands rather than a number.
 *
 * "ruled out on payload: site needs 10–25 kg, team tops out at 2–10 kg" is
 * something a person can act on and a reviewer can check. A similarity score is
 * neither.
 */
export function describeComparison(
  scale: BandScale,
  requirement: string | null | undefined,
  capability: string | null | undefined,
  labelFor: (scaleId: string, value: string) => string,
): string {
  const comparison = compareBand(scale, requirement, capability);
  if (comparison === "unknown") {
    if (!requirement || scale.unknowns?.includes(requirement)) {
      return `${scale.label}: the site has not given a figure`;
    }
    return `${scale.label}: no figure on record for this team`;
  }

  const needs = labelFor(scale.id, requirement as string);
  const has = labelFor(scale.id, capability as string);
  return comparison === "clears"
    ? `${scale.label}: needs ${needs}, team has ${has}`
    : `${scale.label}: needs ${needs}, team has ${has}`;
}
