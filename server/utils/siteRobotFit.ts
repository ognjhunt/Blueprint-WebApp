/**
 * Robot fit for one site job: what it needs from a robot, how every form of
 * robot measures up to it, and which researched teams look right for it.
 *
 * ## Every form, rated against the job's needs
 *
 * The forms are the ones a robot team declares for its own robot
 * (`ROBOT_FORMS`): one arm, two arms, an arm on a wheeled base, a wheeled
 * humanoid, a walking humanoid and a legged robot with an arm. The rules start
 * from what the job needs (whether the robot has to move between spots, one
 * hand or two, reaching low or high, the weight, people nearby) and rate each
 * form against those needs. What our simulation can score today never narrows
 * which forms a site hears about.
 *
 * ## Two halves with different trust
 *
 * Needs and form ratings are rules over the site's own data. The site sends its
 * video and nothing else (founder direction, 2026-10-20), so most of that data
 * is what the video reader saw and estimated: the object's size and weight, how
 * far it moves, the two heights and the people nearby. Anything the site did
 * measure or tell us still comes first. Every figure carries its source in the
 * site's words ("estimated from your video"). The rules run on every read, so
 * they never go stale, and they are the only part a site may see, as fixed
 * sentences filled with its own numbers.
 *
 * The team ranking is a model reading Blueprint's research notes. Notes are
 * not measurements and a prospect has agreed to nothing, so the ranking stays
 * with staff. Every reason must quote one field of the team's research word
 * for word; a reason whose quote is not there is dropped, not trusted.
 *
 * ## What it is for
 *
 * Deciding whom to invite to evaluate a job, and giving whoever writes a
 * recommendation the job's needs beside each team's quoted evidence. A
 * recommendation still stands on a passing evaluation of the job.
 * Design: docs/superpowers/specs/2026-10-20-robot-fit-design.md.
 */
import { createHash, randomUUID } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  RATED_FORMS,
  REQUIREMENT_SOURCE_LABELS,
  ROBOT_FORM_COPY,
  SITE_ROBOT_FIT_NOTE,
  type CheckOutcome,
  type FitCheck,
  type FitRequirement,
  type FitUnknown,
  type FitVerdict,
  type RankedTeam,
  type RatedForm,
  type RequirementKey,
  type RequirementSource,
  type RobotFitAttempt,
  type RobotFitJob,
  type RobotFitRanking,
  type RobotFitSharing,
  type RobotFormRating,
  type SiteRobotFit,
} from "../../client/src/data/robotFit";
import { UNIT_LABELS, type EntryUnit } from "../../client/src/data/siteMeasurements";
import { robotFitRankingOutputSchema, type RobotFitRankingInput } from "../agents/tasks/robot-fit-ranking";
import type { AgentResult, AgentTask } from "../agents/types";
import type { RobotTeamRecord } from "../types/robot-team-registry";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import { listMatchableRobotTeams, quotableCapability } from "./robotTeamRegistry";
import { supplySummary } from "./robotTeamSupply";
import { getBrief, isPlaceholderSummary, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { taskScopeReasonSentence } from "./siteTaskScope";
import { getMeasurements, type SiteTaskMeasurementRecord, type StoredReading } from "./siteTaskMeasurements";
import { teamEvaluationTerms } from "./teamJobAccess";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

export const SITE_ROBOT_FIT_COLLECTION = "siteRobotFit";
const SCHEMA_VERSION = "site_robot_fit.v1";

/* ------------------------------------------------------------ screening bands */

/**
 * Blueprint's screening bands, deliberately conservative. They describe the
 * job, not any robot's specification, and the site never sees them: only its
 * own numbers and a verdict. A robot that stays in one place and stands
 * between the two spots needs about half the span plus wrist and tool margin.
 */
export const SCREENING = {
  /** Spots this close can be served from one place. */
  oneSpotSpanM: 1.2,
  /** Beyond this span, a robot that stays in one place cannot serve both spots. */
  fixedSpanMaxM: 2.4,
  /** Spots below or above this need a long reach, or a different stand height. */
  comfortableHeightM: [0.3, 1.6] as const,
  /** Larger or heavier than this may take two arms, or a wide gripper or suction cups. */
  largeSideM: 0.6,
  largeMassKg: 15,
  /** Heavy enough to narrow the choice of model within every form. */
  heavyMassKg: 25,
} as const;

/* ---------------------------------------------------------------- the inputs */

export interface RobotFitInputs {
  request: Record<string, any> | null;
  brief: SiteTaskBriefRecord | null;
  measurements: SiteTaskMeasurementRecord | null;
}

export async function loadRobotFitInputs(requestId: string): Promise<RobotFitInputs> {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  const [requestSnap, brief, measurements] = await Promise.all([
    db.collection("inboundRequests").doc(requestId).get(),
    getBrief(requestId),
    getMeasurements(requestId),
  ]);
  return { request: (requestSnap.data() as Record<string, any> | undefined) ?? null, brief, measurements };
}

/* ----------------------------------------------------------- requirements */

type Quantity = { key: RequirementKey; label: string; display: string; source: RequirementSource;
  /** SI value, or a range when the site answered a band. */
  min: number; max: number };

/** The intake's weight bands (`payloadWeight`), as SI ranges and as words that sit inside a sentence. */
const MASS_BANDS: Record<string, { range: [number, number]; display: string }> = {
  under_2kg: { range: [0, 2], display: "under 2 kg" },
  two_to_ten: { range: [2, 10], display: "2–10 kg" },
  ten_to_twentyfive: { range: [10, 25], display: "10–25 kg" },
  // "Over" 25 kg: anything in the band is above the heavy line.
  over_25kg: { range: [25.01, Number.POSITIVE_INFINITY], display: "over 25 kg" },
};
/** The intake's `humanProximity` answers, in words that sit inside a sentence. */
const PEOPLE_DISPLAY = {
  isolated: "the area is clear of people while it runs",
  nearby: "people pass nearby but do not work in it",
  shared: "people work in the same space",
} as const;
type People = keyof typeof PEOPLE_DISPLAY;
const PEOPLE_NEED: Record<People, string> = {
  isolated: "It can work in an area kept clear of people",
  nearby: "It has to work safely with people passing nearby",
  shared: "It has to work safely alongside people in the same space",
};
/** What the video reader saw, mapped only where it says something about the space. */
const PEOPLE_FROM_VIDEO: Record<string, People> = {
  working_in_the_space: "shared",
  passing_nearby: "nearby",
};

/**
 * A spec answer the site gave: confirmed brief answers first, then intake
 * answers. The capture-first flow asks no spec question, so most jobs have none.
 */
function specAnswer(inputs: RobotFitInputs, fieldId: string): string | null {
  const confirmed = inputs.brief?.operatorAnswers?.[fieldId];
  if (typeof confirmed === "string" && confirmed) return confirmed;
  const onFile = gateAnswersOnFile(inputs.request)[fieldId];
  if (onFile) return onFile;
  const intake = inputs.request?.request?.siteTaskSpec?.[fieldId];
  return typeof intake === "string" && intake ? intake : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** A length in the words a site uses: centimetres below a metre, metres with one decimal above. */
export function lengthText(metres: number) {
  const centimetres = Math.round(metres * 100);
  return centimetres < 100 ? `${centimetres} cm` : `${Number(metres.toFixed(1))} m`;
}

/** A weight range in grams below a kilogram, else kilograms; one figure when both ends read the same. */
function massRangeText(low: number, high: number) {
  const grams = high < 1;
  const figure = (kg: number) => (grams ? String(Math.round(kg * 1000)) : kg < 10 ? String(Number(kg.toFixed(1))) : String(Math.round(kg)));
  const [from, to] = [figure(low), figure(high)];
  return `about ${from === to ? from : `${from}–${to}`} ${grams ? "g" : "kg"}`;
}

export function measuredDisplay(reading: StoredReading): string {
  if (reading.value === null || !reading.unit) return `${formatNumber(reading.si)} m`;
  return `${formatNumber(reading.value)} ${UNIT_LABELS[reading.unit as EntryUnit] ?? reading.unit}`;
}

/** A rigid pick-and-place reading. Zero is a real height (the floor), so only negatives are refused. */
export function measured(inputs: RobotFitInputs, sampleId: string): StoredReading | null {
  const record = inputs.measurements;
  if (!record || record.family !== "rigid_pick_place") return null;
  const reading = record.readings?.[sampleId];
  return reading && Number.isFinite(reading.si) && reading.si >= 0 ? reading : null;
}

const WEIGHT_TO_KG: Array<[RegExp, number]> = [
  [/^kilograms?$|^kgs?$/i, 1], [/^grams?$|^g$/i, 0.001], [/^pounds?$|^lbs?$/i, 0.45359237], [/^ounces?$|^oz$/i, 0.028349523125],
];
const NUMBERS = /\d+(?:[.,]\d+)*|[.,]\d+/g;
const NUMBER_WITH_UNIT = /(\d+(?:[.,]\d+)*|[.,]\d+)\s*(kilograms?|kgs?|grams?|g|pounds?|lbs?|ounces?|oz)\b/i;

/**
 * The weight the owner typed after uploading, only when it is one number and
 * one unit. A range, a list ("totes 3 kg, bins 18 kg"), a fraction or a
 * thousands separator stays unknown rather than read as its first number.
 */
export function parseStatedWeight(text: unknown): { kg: number; display: string } | null {
  if (typeof text !== "string") return null;
  if ((text.match(NUMBERS) ?? []).length !== 1) return null;
  const match = NUMBER_WITH_UNIT.exec(text);
  if (!match) return null;
  const raw = match[1];
  if ((raw.match(/[.,]/g) ?? []).length > 1 || /,\d{3}$/.test(raw)) return null;
  const value = Number(raw.replace(",", "."));
  const factor = WEIGHT_TO_KG.find(([pattern]) => pattern.test(match[2]))?.[1];
  if (!Number.isFinite(value) || value <= 0 || !factor) return null;
  return { kg: value * factor, display: `${formatNumber(value)} ${match[2].toLowerCase()}` };
}

function massRequirement(inputs: RobotFitInputs): Quantity | null {
  const label = "Object weight";
  const reading = measured(inputs, "object_mass");
  if (reading && reading.si > 0) {
    return { key: "object_mass", label, display: measuredDisplay(reading), source: "site_measured", min: reading.si, max: reading.si };
  }
  const stated = parseStatedWeight(inputs.brief?.operatorTaskDetails?.item_weight);
  if (stated) return { key: "object_mass", label, display: stated.display, source: "site_stated", min: stated.kg, max: stated.kg };
  const band = specAnswer(inputs, "payloadWeight");
  if (band && MASS_BANDS[band]) {
    const { range: [min, max], display } = MASS_BANDS[band];
    return { key: "object_mass", label, display, source: "site_stated", min, max };
  }
  const estimate = videoEvidence(inputs)?.estimates?.massKg;
  return estimate ? { key: "object_mass", label, display: massRangeText(estimate.low, estimate.high), source: "video_estimate",
    min: estimate.low, max: estimate.high } : null;
}

function lengthRequirement(inputs: RobotFitInputs, key: RequirementKey, sampleId: string, label: string,
  estimate: number | null | undefined): Quantity | null {
  const reading = measured(inputs, sampleId);
  if (reading) return { key, label, display: measuredDisplay(reading), source: "site_measured", min: reading.si, max: reading.si };
  return typeof estimate === "number" ? { key, label, display: estimate === 0 ? "floor level" : `about ${lengthText(estimate)}`,
    source: "video_estimate", min: estimate, max: estimate } : null;
}

function largestSide(inputs: RobotFitInputs): Quantity | null {
  const label = "Object's largest side";
  const sides = ["object_length", "object_width", "object_height"]
    .map((sampleId) => measured(inputs, sampleId)).filter((reading): reading is StoredReading => Boolean(reading));
  if (sides.length) {
    const largest = sides.reduce((best, reading) => (reading.si > best.si ? reading : best));
    return { key: "object_size", label, display: measuredDisplay(largest), source: "site_measured", min: largest.si, max: largest.si };
  }
  const estimate = videoEvidence(inputs)?.estimates?.largestSideM;
  return typeof estimate === "number"
    ? { key: "object_size", label, display: `about ${lengthText(estimate)}`, source: "video_estimate", min: estimate, max: estimate } : null;
}

/** The video reader's estimates, in SI. Never measurements: shown as "estimated from your video". */
export interface VideoEstimates {
  largestSideM: number | null;
  massKg: { low: number; high: number } | null;
  surface: "matte" | "shiny" | "transparent" | "mixed" | null;
  pickToPlaceM: number | null;
  pickHeightM: number | null;
  placeHeightM: number | null;
  frontClearanceM: number | null;
  otherItemsLikely: string[];
  cycleSeconds: number | null;
}

/** A stored number only inside the reader's own bounds; anything else reads as no estimate. */
function bounded(value: unknown, min: number, max: number, exclusiveMin = false): number | null {
  return typeof value === "number" && Number.isFinite(value) && value <= max && (exclusiveMin ? value > min : value >= min) ? value : null;
}

const SURFACE_VALUES = new Set(["matte", "shiny", "transparent", "mixed"]);

/**
 * An unseen item as a plain noun phrase, or nothing: the name reaches the site's
 * report, so a link, a code or anything naming a robot is dropped.
 */
function itemName(item: unknown): string | null {
  if (typeof item !== "string") return null;
  const name = item.replace(/\s+/g, " ").trim();
  if (!/^[\p{L}][\p{L}\p{N} ,'&()/-]{0,59}$/u.test(name) || /robot/i.test(name)) return null;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function estimatesOf(raw: unknown): VideoEstimates | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const low = bounded(value.object_mass_kg_low, 0.001, 2000);
  const high = bounded(value.object_mass_kg_high, 0.001, 2000);
  const ends = [low ?? high, high ?? low] as const;
  return {
    largestSideM: bounded(value.object_largest_side_m, 0.005, 5),
    massKg: ends[0] !== null && ends[1] !== null ? { low: Math.min(ends[0], ends[1]), high: Math.max(ends[0], ends[1]) } : null,
    surface: typeof value.object_surface === "string" && SURFACE_VALUES.has(value.object_surface)
      ? value.object_surface as VideoEstimates["surface"] : null,
    pickToPlaceM: bounded(value.pick_to_place_m, 0, 50, true),
    pickHeightM: bounded(value.pick_height_m, 0, 4),
    placeHeightM: bounded(value.place_height_m, 0, 4),
    // Zero is a reading: no open floor at all.
    frontClearanceM: bounded(value.front_clearance_m, 0, 20),
    otherItemsLikely: (Array.isArray(value.other_items_likely) ? value.other_items_likely : [])
      .map(itemName).filter((item): item is string => Boolean(item)).slice(0, 5),
    cycleSeconds: bounded(value.cycle_seconds, 1, 7200),
  };
}

function usableReading(value: unknown): Record<string, unknown> | null {
  const evidence = value as Record<string, unknown> | null | undefined;
  return evidence?.status === "analysed" && (evidence.footage_status === "usable" || evidence.footage_status === "partially_usable")
    ? evidence : null;
}

/** Each estimate from the walkthrough where it has one, else from the intake link's reading. */
function mergeEstimates(first: VideoEstimates | null, second: VideoEstimates | null): VideoEstimates | null {
  if (!first || !second) return first ?? second;
  return {
    largestSideM: first.largestSideM ?? second.largestSideM,
    massKg: first.massKg ?? second.massKg,
    surface: first.surface ?? second.surface,
    pickToPlaceM: first.pickToPlaceM ?? second.pickToPlaceM,
    pickHeightM: first.pickHeightM ?? second.pickHeightM,
    placeHeightM: first.placeHeightM ?? second.placeHeightM,
    frontClearanceM: first.frontClearanceM ?? second.frontClearanceM,
    otherItemsLikely: first.otherItemsLikely.length ? first.otherItemsLikely : second.otherItemsLikely,
    cycleSeconds: first.cycleSeconds ?? second.cycleSeconds,
  };
}

/**
 * What the site's video tells us, or null. Estimates come from the uploaded
 * walkthrough's coverage review first (the one reading every website job gets),
 * then from a link the site shared at intake. A timed cycle and people nearby
 * come only from the intake link's footage reader, and only while usable.
 */
export function videoEvidence(inputs: RobotFitInputs): {
  measuredCycleSeconds: number | null; people: string | null; estimates: VideoEstimates | null;
} | null {
  const link = usableReading(inputs.request?.site_video_evidence);
  const walkthrough = (inputs.request?.walkthrough_job_estimates as { job_estimates?: unknown } | null | undefined)?.job_estimates;
  const estimates = mergeEstimates(estimatesOf(walkthrough), link ? estimatesOf(link.job_estimates) : null);
  if (!link && !estimates) return null;
  const seconds = link?.measured_cycle_seconds;
  return {
    measuredCycleSeconds: typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    people: typeof link?.people_relationship_to_work === "string" ? link.people_relationship_to_work : null,
    estimates,
  };
}

export type PeopleReading = { value: People; display: string; source: RequirementSource };

/** The site's own answer if it ever gave one, else what its video shows. */
export function peopleNearby(inputs: RobotFitInputs): PeopleReading | null {
  const answered = specAnswer(inputs, "humanProximity");
  if (answered && Object.prototype.hasOwnProperty.call(PEOPLE_DISPLAY, answered)) {
    return { value: answered as People, display: PEOPLE_DISPLAY[answered as People], source: "site_stated" };
  }
  const seen = PEOPLE_FROM_VIDEO[videoEvidence(inputs)?.people ?? ""];
  return seen ? { value: seen, display: PEOPLE_DISPLAY[seen], source: "video_observed" } : null;
}

/* ------------------------------------------------------- needs and ratings */

export const cite = (quantity: { display: string; source: RequirementSource }) =>
  `${quantity.display} (${REQUIREMENT_SOURCE_LABELS[quantity.source]})`;

function check(requirement: RequirementKey, outcome: CheckOutcome, text: string): FitCheck {
  return { requirement, outcome, text };
}

export interface JobFacts {
  distance: Quantity | null;
  /** Straight-line span between the spots, using the heights when both are known. */
  span: number | null;
  /** The span rests on a video estimate, so it never rules a form out on its own. */
  spanEstimated: boolean;
  mass: Quantity | null;
  size: Quantity | null;
  extremes: Array<{ height: Quantity; low: boolean }>;
  people: PeopleReading | null;
}

/** "large" when the object is known to be large or heavy; "maybe" when a weight band straddles the line. */
export function handsNeed(facts: JobFacts): "large" | "maybe" | null {
  const { size, mass } = facts;
  if ((size && size.min > SCREENING.largeSideM) || (mass && mass.min > SCREENING.largeMassKg)) return "large";
  if (mass && mass.max > SCREENING.largeMassKg) return "maybe";
  return null;
}

const heavy = (facts: JobFacts) => Boolean(facts.mass && facts.mass.min > SCREENING.heavyMassKg);

/** What the job needs from any robot, in the site's own numbers. */
function needsOf(facts: JobFacts): string[] {
  const needs = ["It has to pick the object up and put it down at another spot."];
  const { distance, span } = facts;
  if (distance && span !== null) {
    needs.push(span <= SCREENING.oneSpotSpanM ? `It can work from one place: the object moves ${cite(distance)}.`
      : span <= SCREENING.fixedSpanMaxM ? `It has to reach across ${cite(distance)} from one place, or move between the spots.`
        : `It has to move between the spots: the object moves ${cite(distance)}.`);
  }
  if (facts.mass) needs.push(`It has to lift ${cite(facts.mass)}.`);
  const hands = handsNeed(facts);
  if (hands === "large") {
    const parts = [
      facts.size && facts.size.min > SCREENING.largeSideM ? `its largest side is ${cite(facts.size)}` : null,
      facts.mass && facts.mass.min > SCREENING.largeMassKg ? `it weighs ${cite(facts.mass)}` : null,
    ].filter(Boolean);
    needs.push(`It has to handle a large or heavy object (${parts.join(" and ")}), which takes two arms, or one arm with a wide gripper or suction cups.`);
  } else if (hands === "maybe") {
    needs.push(`It may have to handle a heavy object (it weighs ${cite(facts.mass!)}), which can take two arms, or one arm with a wide gripper or suction cups.`);
  }
  for (const { height, low } of facts.extremes) {
    const where = height.key === "pick_height" ? "picked up" : "put down";
    needs.push(low ? `It has to reach down near the floor: the object is ${where} at ${cite(height)}.`
      : `It has to reach up high: the object is ${where} at ${cite(height)}.`);
  }
  if (facts.people) needs.push(`${PEOPLE_NEED[facts.people.value]} (${REQUIREMENT_SOURCE_LABELS[facts.people.source]}).`);
  return needs;
}

function rateForm(id: RatedForm, facts: JobFacts): RobotFormRating {
  const form = ROBOT_FORM_COPY[id];
  const checks: FitCheck[] = [];
  const moved = facts.distance ? `the object moves ${cite(facts.distance)}` : null;
  if (form.moves === "no") {
    if (!moved || facts.span === null) {
      checks.push(check("pick_to_place_span", "unknown", "We don't know yet how far the object moves."));
    } else if (facts.span <= SCREENING.oneSpotSpanM) {
      checks.push(check("pick_to_place_span", "pass", `It can reach both spots from where it stands: ${moved}.`));
    } else if (facts.span <= SCREENING.fixedSpanMaxM) {
      checks.push(check("pick_to_place_span", "caution", `It stays in one place, so it needs a long reach: ${moved}.`));
    } else if (facts.spanEstimated) {
      // A guess from the video cannot rule a form out, and the site has no step to correct it.
      checks.push(check("pick_to_place_span", "caution", `It stays in one place, and ${moved}, likely too far to reach both spots.`));
    } else {
      checks.push(check("pick_to_place_span", "fail", `It stays in one place, and ${moved}, too far to reach both spots.`));
    }
  } else if (moved && facts.span !== null) {
    const going = form.moves === "legs" ? "Walking" : "Driving";
    checks.push(facts.span <= SCREENING.oneSpotSpanM
      ? check("pick_to_place_span", "extra", `${going} between spots isn't needed: ${moved}.`)
      : check("pick_to_place_span", "pass", `It can move between the spots: ${moved}.`));
  }
  const hands = handsNeed(facts);
  if (hands) {
    const requirement = facts.size && facts.size.min > SCREENING.largeSideM ? "object_size" : "object_mass";
    checks.push(form.arms === 2
      ? check(requirement, "pass", "It has two arms to share a large or heavy object.")
      : check(requirement, "caution", hands === "large"
        ? "With one arm, it needs a wide gripper or suction cups for an object this large or heavy."
        : "With one arm, it may need a wide gripper or suction cups if the object is at the heavy end."));
  }
  if (heavy(facts)) checks.push(check("object_mass", "caution", `The object weighs ${cite(facts.mass!)}, so check that this robot can lift it.`));
  for (const { height, low } of facts.extremes) {
    checks.push(check(height.key, "caution", form.moves === "no"
      ? `It stays in one place, so it needs a long reach or a stand set ${low ? "low" : "high"} for a spot at ${cite(height)}.`
      : `It has to reach ${low ? "down near the floor" : "up high"}, to a spot at ${cite(height)}.`));
  }
  return { id, verdict: verdictOf(checks), checks };
}

function verdictOf(checks: FitCheck[]): FitVerdict {
  if (checks.some((entry) => entry.outcome === "fail")) return "not_a_fit";
  if (checks.some((entry) => entry.outcome === "caution" || entry.outcome === "unknown")) return "possible";
  return "fits";
}

/** Rated only once the job is screened as one rigid object picked up and put down; otherwise why not. */
function notRated(inputs: RobotFitInputs): string | null {
  const scope = inputs.request?.site_task_scope as { supported?: unknown; kind?: unknown; reason?: unknown } | undefined;
  if (!scope) return "This job's task has not been screened yet. Robot forms are rated once its brief is confirmed.";
  if (scope.supported === false) return taskScopeReasonSentence(scope.reason);
  if (scope.supported !== true || scope.kind !== "rigid_pick_and_place") {
    return "Robot forms are rated for jobs that pick up one rigid object and put it down. This job is another kind.";
  }
  return null;
}

/** What the site's own data says about the job, for the ratings here and the readiness report. */
export function jobFactsOf(inputs: RobotFitInputs): JobFacts & { pick: Quantity | null; place: Quantity | null } {
  const estimates = videoEvidence(inputs)?.estimates;
  const distance = lengthRequirement(inputs, "pick_to_place_span", "pick_to_place_distance", "How far the object moves", estimates?.pickToPlaceM);
  const pick = lengthRequirement(inputs, "pick_height", "pick_surface_height", "Height where it is picked up", estimates?.pickHeightM);
  const place = lengthRequirement(inputs, "place_height", "place_surface_height", "Height where it is put down", estimates?.placeHeightM);
  const [low, high] = SCREENING.comfortableHeightM;
  return {
    distance,
    pick,
    place,
    span: distance ? (pick && place ? Math.hypot(distance.min, pick.min - place.min) : distance.min) : null,
    spanEstimated: [distance, ...(distance && pick && place ? [pick, place] : [])]
      .some((entry) => entry?.source === "video_estimate"),
    mass: massRequirement(inputs),
    size: largestSide(inputs),
    extremes: [pick, place].filter((entry): entry is Quantity => Boolean(entry))
      .filter((height) => height.min < low || height.min > high)
      .map((height) => ({ height, low: height.min < low })),
    people: peopleNearby(inputs),
  };
}

/** The rule-based half. Pure: the same inputs always give the same report. */
export function computeRobotFitJob(inputs: RobotFitInputs): RobotFitJob {
  const summary = typeof inputs.brief?.summary === "string" && !isPlaceholderSummary(inputs.brief.summary)
    ? inputs.brief.summary : null;
  const instruction = teamEvaluationTerms(inputs.request)?.instruction ?? null;
  const reason = notRated(inputs);
  if (reason) {
    return { rated: false, notRatedReason: reason, summary, instruction, requirements: [], needs: [], unknowns: [], forms: [] };
  }

  const facts = jobFactsOf(inputs);
  const { distance, mass, size, people } = facts;
  const requirements: FitRequirement[] = [distance, facts.pick, facts.place, mass, size]
    .filter((entry): entry is Quantity => Boolean(entry))
    .map(({ key, label, display, source }) => ({ key, label, display, source }));
  if (people) requirements.push({ key: "people_nearby", label: "People near the job", display: people.display, source: people.source });

  const unknowns: FitUnknown[] = [];
  // What neither the video nor anything on file gives: notes for staff, never questions to the site.
  if (!distance) unknowns.push({ key: "pick_to_place_span", label: "How far the object moves" });
  if (!mass) unknowns.push({ key: "object_mass", label: "How heavy the object is" });
  if (!people) unknowns.push({ key: "people_nearby", label: "Whether people work near the job" });

  return {
    rated: true, notRatedReason: null, summary, instruction, requirements, needs: needsOf(facts), unknowns,
    forms: RATED_FORMS.map((id) => rateForm(id, facts)),
  };
}

/**
 * What the owner's job page shows: the job's needs and each form's verdict
 * with the reasons that set it apart. No team, count, quote, price, screening
 * limit or question: the site sends its video and nothing else.
 */
export function projectSiteRobotFit(job: RobotFitJob): SiteRobotFit | null {
  if (!job.rated) return null;
  const anyKnown = job.requirements.some((entry) => ["pick_to_place_span", "object_mass", "object_size"].includes(entry.key));
  return {
    needs: job.needs,
    forms: anyKnown ? job.forms.map((rating) => ({
      id: rating.id, label: ROBOT_FORM_COPY[rating.id].label, description: ROBOT_FORM_COPY[rating.id].description,
      verdict: rating.verdict,
      // Passing checks repeat the needs above; the rest are what tells the forms apart.
      reasons: rating.checks.filter((entry) => entry.outcome !== "pass").map((entry) => entry.text),
    })) : [],
    note: SITE_ROBOT_FIT_NOTE,
  };
}

/* --------------------------------------------------------- team ranking */

export type RobotFitRankingCandidate = RobotFitRankingInput["candidates"][number];
export type RankRunner = (task: AgentTask<RobotFitRankingInput>) => Promise<AgentResult<unknown>>;

export class RobotFitError extends Error {
  constructor(readonly code: "job_not_found" | "consent_revoked" | "job_details_missing" | "no_candidates" | "nothing_to_share"
    | "ranking_in_progress",
    message: string) {
    super(message);
    this.name = "RobotFitError";
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, stable(entry)]));
}

const digestOf = (value: unknown) => `sha256:${sha256(JSON.stringify(stable(value)))}`;

const NOTE_LIMIT = 4000;
const EVIDENCE_LIMIT = 1000;

/** Teams with a research note, in a stable order, so the shared corpus is a cacheable prompt prefix. */
export function rankingCandidates(teams: RobotTeamRecord[]): RobotFitRankingCandidate[] {
  return teams
    .filter((team) => typeof team.capabilityDescription === "string" && team.capabilityDescription.trim())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((team) => {
      const recorded = Object.entries(quotableCapability(team))
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([field, value]) => `${field}: ${value} (${team.fieldProvenance[field as keyof typeof team.fieldProvenance]?.grade})`);
      return {
        teamId: team.id,
        name: team.name,
        status: team.status,
        agreed: supplySummary(team).willingSupply,
        notes: team.capabilityDescription!.trim().slice(0, NOTE_LIMIT),
        whatGoesWrong: team.evidenceBar?.trim() ? team.evidenceBar.trim().slice(0, EVIDENCE_LIMIT) : null,
        recorded,
      };
    });
}

function rankingJob(job: RobotFitJob, inputs: RobotFitInputs): RobotFitRankingInput["job"] {
  return {
    summary: job.summary,
    instruction: job.instruction,
    rated: job.rated,
    notRatedReason: job.notRatedReason,
    needs: job.needs,
    requirements: job.requirements.map(({ label, display, source }) => ({ label, value: display, source })),
    unknowns: job.unknowns.map((entry) => entry.label),
    forms: job.forms.map((rating) => ({ id: rating.id, verdict: rating.verdict })),
    serviceArea: gateAnswersOnFile(inputs.request).serviceArea ?? null,
  };
}

function rankingDigest(jobInput: RobotFitRankingInput["job"], candidates: RobotFitRankingCandidate[]) {
  return digestOf({ job: jobInput, candidates: candidates.map((candidate) => ({ teamId: candidate.teamId,
    notes: sha256(JSON.stringify([candidate.notes, candidate.whatGoesWrong, candidate.recorded, candidate.agreed, candidate.status])) })) });
}

/** Lowercase, straight quotes and hyphens, one space: the form a quote is checked in. */
function normalizeForQuote(value: string) {
  return value.toLowerCase().replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, "\"")
    .replace(/[‐-―−]/g, "-").replace(/\s+/g, " ").trim();
}

/** The longest part of a quote must be at least this long, so a label or two words prove nothing. */
const MIN_QUOTE_CHARS = 20;

/**
 * A quote stands only inside one field of the team's research (its note, what
 * goes wrong, or one recorded capability). A quote that elides text with an
 * ellipsis is checked part by part, in order, within that same field.
 */
function quoteFound(candidate: RobotFitRankingCandidate, quote: string) {
  const parts = normalizeForQuote(quote).split(/\.{3}|…/)
    .map((part) => part.replace(/^["'\s.,;:-]+|["'\s.,;:-]+$/g, "")).filter(Boolean);
  if (!parts.length || Math.max(...parts.map((part) => part.length)) < MIN_QUOTE_CHARS) return false;
  const fields = [candidate.notes, candidate.whatGoesWrong ?? "", ...candidate.recorded].filter(Boolean).map(normalizeForQuote);
  return fields.some((field) => {
    let from = 0;
    for (const part of parts) {
      const at = field.indexOf(part, from);
      if (at < 0) return false;
      from = at + part.length;
    }
    return true;
  });
}

const clean = (value: string, limit: number) => value.replace(/\s+/g, " ").trim().slice(0, limit);

/**
 * What a team's own research must say before the model's reading of its robot
 * form is believed. A form the research does not support is treated as
 * unknown, so a wrong label can never carry a team past the "not a fit" cap.
 */
const FORM_EVIDENCE: Record<RatedForm, RegExp> = {
  fixed_base_arm: /\b(robot(?:ic)? arms?|cobots?|collaborative robots?|industrial robots?|fixed arms?|franka|universal robots)\b/i,
  bimanual_arm: /\b(dual[- ]arms?|two[- ]armed|two arms|bimanual)\b/i,
  mobile_manipulator: /\b(mobile manipulat\w*|mobile robot arms?|arms? on (?:an? )?(?:mobile|wheeled) bases?|amrs? with (?:an? )?arms?)\b/i,
  wheeled_humanoid: /\b(wheeled humanoids?|humanoids? on wheels)\b/i,
  humanoid: /\b(humanoids?|bipedal|biped)\b/i,
  legged_manipulator: /\b(quadrupeds?|legged robots?|four-legged|robot dogs?)\b/i,
};

/** Most specific first: "mobile robot arm" is evidence of an arm that moves, never also of a fixed arm. */
const FORM_EVIDENCE_ORDER: readonly RatedForm[] = ["wheeled_humanoid", "mobile_manipulator", "legged_manipulator", "bimanual_arm",
  "humanoid", "fixed_base_arm"];

/** A generic form whose research also names a more specific kind of robot is ambiguous, so it reads as unknown. */
const MORE_SPECIFIC_FORMS: Partial<Record<RatedForm, readonly RatedForm[]>> = {
  fixed_base_arm: ["mobile_manipulator", "legged_manipulator", "wheeled_humanoid", "humanoid"],
  bimanual_arm: ["mobile_manipulator", "wheeled_humanoid", "humanoid"],
  humanoid: ["wheeled_humanoid"],
};

/** The forms a team's research names, each phrase counted once, for its most specific form. */
function evidencedForms(research: string): Set<RatedForm> {
  const found = new Set<RatedForm>();
  let rest = research;
  for (const form of FORM_EVIDENCE_ORDER) {
    const pattern = new RegExp(FORM_EVIDENCE[form].source, "gi");
    const remaining = rest.replace(pattern, " ");
    if (remaining !== rest) found.add(form);
    rest = remaining;
  }
  return found;
}

function groundedForm(candidate: RobotFitRankingCandidate, form: RankedTeam["form"]): RankedTeam["form"] {
  if (!(RATED_FORMS as readonly string[]).includes(form)) return form;
  const found = evidencedForms([candidate.notes, candidate.whatGoesWrong ?? "", ...candidate.recorded].join(" \n "));
  const rated = form as RatedForm;
  return found.has(rated) && !(MORE_SPECIFIC_FORMS[rated] ?? []).some((specific) => found.has(specific)) ? form : "unknown";
}

/**
 * Keep what the research supports. Unknown or repeated teams and unquoted
 * reasons are dropped and counted. The model's reading of a team's robot form
 * stands only where the team's research says it. A team whose form the rules
 * rate "not a fit" for this job is a weak fit at most; while the job rules any
 * form out, a team whose form the research does not establish is a possible
 * fit at most.
 */
export function validateRanking(output: unknown, candidates: RobotFitRankingCandidate[],
  formVerdicts: ReadonlyMap<RatedForm, FitVerdict> = new Map()) {
  const parsed = robotFitRankingOutputSchema.parse(output);
  const byId = new Map(candidates.map((candidate) => [candidate.teamId, candidate]));
  const seen = new Set<string>();
  const teams: RankedTeam[] = [];
  let droppedReasons = 0;
  let droppedTeams = 0;
  for (const entry of parsed.ranked) {
    const candidate = byId.get(entry.teamId);
    if (!candidate || seen.has(entry.teamId)) {
      droppedTeams += 1;
      continue;
    }
    const reasons = entry.reasons.filter((reason) => quoteFound(candidate, reason.quote));
    droppedReasons += entry.reasons.length - reasons.length;
    if (!reasons.length || teams.length >= 10) {
      droppedTeams += 1;
      continue;
    }
    seen.add(entry.teamId);
    let fit = entry.fit;
    const concerns = entry.concerns.map((concern) => clean(concern, 300)).filter(Boolean);
    const form = groundedForm(candidate, entry.form);
    const rated = (RATED_FORMS as readonly string[]).includes(form) ? formVerdicts.get(form as RatedForm) : undefined;
    if (rated === "not_a_fit") {
      fit = "weak";
      concerns.unshift(`Its form (${ROBOT_FORM_COPY[form as RatedForm].label.toLowerCase()}) is rated not a fit for this job.`);
    } else if (!rated && [...formVerdicts.values()].includes("not_a_fit")) {
      if (fit === "strong") fit = "possible";
      concerns.unshift("Its research does not establish its robot form, and this job rules some forms out: check it against the job's needs.");
    }
    teams.push({
      teamId: candidate.teamId, name: candidate.name, status: candidate.status, agreed: candidate.agreed,
      fit, form,
      reasons: reasons.map((reason) => ({ claim: clean(reason.claim, 300), quote: clean(reason.quote, 400) })),
      concerns: concerns.slice(0, 4),
    });
  }
  return { teams, droppedReasons, droppedTeams };
}

async function defaultRunner(task: AgentTask<RobotFitRankingInput>) {
  const { runAgentTask } = await import("../agents/runtime");
  return runAgentTask<RobotFitRankingInput, unknown>(task);
}

type Stored = { ranking?: RobotFitRanking | null; lastAttempt?: RobotFitAttempt | null; sharing?: RobotFitSharing | null;
  /** Set while a ranking run holds the job, so a second click cannot pay for a second run. */
  runningSinceIso?: string | null };

/** A claim older than this belongs to a run that died; the next run may take it over. */
const RUN_CLAIM_MS = 10 * 60 * 1000;

/**
 * Keep a run in one transaction: a good ranking replaces the stored one, a
 * failed run is recorded beside it without hiding it, and a slower run that
 * started earlier never replaces a newer one. Every run is also kept in history.
 */
async function keepRun(requestId: string, ranking: RobotFitRanking | null, attempt: RobotFitAttempt, started: Date) {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  const store = db;
  const ref = store.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId);
  const history = ref.collection("rankings").doc(`${started.getTime()}-${randomUUID().slice(0, 8)}`);
  await store.runTransaction(async (transaction) => {
    const current = ((await transaction.get(ref)).data() as Stored | undefined) ?? {};
    const update: Record<string, unknown> = { schemaVersion: SCHEMA_VERSION, requestId, updatedAtIso: attempt.atIso };
    if (ranking && !(current.ranking && current.ranking.rankedAtIso > ranking.rankedAtIso)) update.ranking = ranking;
    if (!(current.lastAttempt && current.lastAttempt.atIso > attempt.atIso)) update.lastAttempt = attempt;
    // Release only this run's own claim; a run that took over a stale claim keeps it.
    if (current.runningSinceIso === attempt.atIso) update.runningSinceIso = null;
    transaction.set(ref, update, { merge: true });
    transaction.set(history, { schemaVersion: SCHEMA_VERSION, requestId, attempt, ranking });
  });
}

/** Claim the job for one ranking run before any model call; a fresh claim refuses a second run. */
async function claimRun(requestId: string, atIso: string, actor: string | null) {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  const ref = db.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId);
  await db.runTransaction(async (transaction) => {
    const current = ((await transaction.get(ref)).data() as Stored | undefined) ?? {};
    const since = current.runningSinceIso ? Date.parse(current.runningSinceIso) : Number.NaN;
    if (Number.isFinite(since) && Date.parse(atIso) - since < RUN_CLAIM_MS) {
      throw new RobotFitError("ranking_in_progress", "A ranking is already running for this job. It usually finishes within a few minutes.");
    }
    transaction.set(ref, { schemaVersion: SCHEMA_VERSION, requestId, runningSinceIso: atIso, runningBy: actor }, { merge: true });
  });
}

/**
 * Rank researched teams for a job and keep the result. Refused once recording
 * consent is withdrawn, and when the job says nothing a team could be judged
 * against. A failed run is kept as the last attempt, so staff see that it
 * failed and why, while the last good ranking stays on screen.
 */
export async function rankTeamsForJob(requestId: string, options: { actor: string | null; run?: RankRunner; now?: () => Date }) {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  const inputs = await loadRobotFitInputs(requestId);
  if (!inputs.request) throw new RobotFitError("job_not_found", "Site job not found.");
  if (projectWebsiteCaptureRights(inputs.request).consent_revoked) {
    throw new RobotFitError("consent_revoked", "Recording consent was withdrawn for this job, so its details are not sent for team ranking.");
  }
  const job = computeRobotFitJob(inputs);
  if (!job.summary && !job.instruction && !job.requirements.length) {
    throw new RobotFitError("job_details_missing", "This job has no description, video instruction or measurements to rank teams against yet.");
  }
  const candidates = rankingCandidates(await listMatchableRobotTeams({ limit: 500 }));
  if (!candidates.length) throw new RobotFitError("no_candidates", "No robot team in the registry has a research note to read.");

  const jobInput = rankingJob(job, inputs);
  const started = (options.now ?? (() => new Date()))();
  const atIso = started.toISOString();
  await claimRun(requestId, atIso, options.actor);
  const failed = (error: string, provider: string | null = null): RobotFitAttempt =>
    ({ state: "failed", atIso, by: options.actor, error: clean(`${error}${provider ? ` (${provider})` : ""}`, 300) });
  let ranking: RobotFitRanking | null = null;
  let attempt: RobotFitAttempt;
  try {
    const result = await (options.run ?? defaultRunner)({
      kind: "robot_fit_ranking",
      input: { candidates, job: jobInput },
      session_key: `robot-fit:${requestId}`,
      metadata: { request_id: requestId },
    });
    if (result.status !== "completed" || !result.output) {
      attempt = failed(String(result.error || result.status), result.provider ?? null);
    } else {
      const validated = validateRanking(result.output, candidates,
        new Map(job.forms.map((rating) => [rating.id, rating.verdict])));
      ranking = { rankedAtIso: atIso, rankedBy: options.actor, inputsDigest: rankingDigest(jobInput, candidates),
        candidateCount: candidates.length, ...validated, provider: result.provider ?? null, model: result.model ?? null };
      attempt = { state: "ranked", atIso, by: options.actor, error: null };
    }
  } catch (error) {
    attempt = failed(error instanceof Error ? error.message : "ranking_failed");
  }
  await keepRun(requestId, ranking, attempt, started);
  return { ranking, attempt };
}

/* ------------------------------------------------------- reading and sharing */

async function readStored(requestId: string): Promise<Stored> {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  return ((await db.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId).get()).data() as Stored | undefined) ?? {};
}

/** The console's view: live ratings, the stored ranking (flagged stale when its inputs moved), the last run, sharing and the site preview. */
export async function getAdminRobotFit(requestId: string) {
  const [inputs, stored] = await Promise.all([loadRobotFitInputs(requestId), readStored(requestId)]);
  if (!inputs.request) return null;
  const job = computeRobotFitJob(inputs);
  let ranking: (RobotFitRanking & { stale: boolean }) | null = null;
  if (stored.ranking) {
    const candidates = rankingCandidates(await listMatchableRobotTeams({ limit: 500 }));
    ranking = { ...stored.ranking, stale: stored.ranking.inputsDigest !== rankingDigest(rankingJob(job, inputs), candidates) };
  }
  return { job, ranking, lastAttempt: stored.lastAttempt ?? null, sharing: stored.sharing ?? null, site: projectSiteRobotFit(job),
    consentRevoked: projectWebsiteCaptureRights(inputs.request).consent_revoked === true };
}

/** Share or stop sharing the site version. Sharing needs something to show and current consent. */
export async function setRobotFitSharing(requestId: string, shared: boolean, options: { actor: string | null; now?: () => Date }) {
  if (!db) throw new Error("site_robot_fit_store_unavailable");
  const inputs = await loadRobotFitInputs(requestId);
  if (!inputs.request) throw new RobotFitError("job_not_found", "Site job not found.");
  if (shared) {
    if (projectWebsiteCaptureRights(inputs.request).consent_revoked) {
      throw new RobotFitError("consent_revoked", "Recording consent was withdrawn for this job, so nothing new is shared with the site.");
    }
    if (!projectSiteRobotFit(computeRobotFitJob(inputs))) {
      throw new RobotFitError("nothing_to_share", "This job is not rated, so there is nothing to share with the site.");
    }
  }
  const nowIso = (options.now ?? (() => new Date()))().toISOString();
  const sharing: RobotFitSharing = { shared, changedAtIso: nowIso, changedBy: options.actor };
  await db.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId)
    .set({ schemaVersion: SCHEMA_VERSION, requestId, sharing, updatedAtIso: nowIso }, { merge: true });
  return sharing;
}
