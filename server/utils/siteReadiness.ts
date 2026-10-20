/**
 * The site readiness report: an expert's first read of a site's job, built
 * from the site's own data with fixed sentences and no model call.
 *
 * The owner sees the tracker, the next three things, how the job runs today
 * and what it takes today from the start. The robot readiness report (robot
 * fit, getting the site ready, what decides success, safety, and where robots
 * already do this kind of job) reaches the owner once Blueprint shares it,
 * with the robot-fit sharing switch. Nothing here names, counts or compares a
 * robot team, quotes a price, or promises an outcome. The simulation is
 * credited only with what the evaluation contract tests: the object's start
 * position and turn, the light and the grip, the fixtures in the rebuilt scene,
 * cycle time against the site's target and the site's pass mark.
 * Design: docs/superpowers/specs/2026-10-20-site-readiness-report-design.md.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { deployedEnvironments, environmentsFootnote } from "../../client/src/data/qualifyingEnvironments";
import { REQUIREMENT_SOURCE_LABELS, ROBOT_FORM_COPY, type RobotFitJob } from "../../client/src/data/robotFit";
import {
  type DeploymentExample,
  type NextThing,
  type ReadinessItem,
  type SiteOperations,
  type SiteReadinessReport,
  type SiteReadinessResponse,
  type SpeedCheck,
  type SuccessFactor,
  type Tracker,
  type TrackerStep,
  type Workload,
} from "../../client/src/data/siteReadiness";
import { gateFields } from "../../client/src/data/siteTaskQualification";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import {
  SCREENING,
  SITE_ROBOT_FIT_COLLECTION,
  cite,
  computeRobotFitJob,
  handsNeed,
  jobFactsOf,
  loadRobotFitInputs,
  measured,
  measuredDisplay,
  projectSiteRobotFit,
  videoEvidence,
  type JobFacts,
  type RobotFitInputs,
} from "./siteRobotFit";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { getItemInventory } from "./taskItemInventory";
import { savedWalkthrough, siteWalkthroughIdentity } from "./siteWalkthrough";

/** Screening bands for the space around the work. They describe the site, not any robot. */
export const READINESS_SCREENING = {
  /** Open floor in front of the starting surface that leaves room for a stand or base. */
  floorReadyM: 1.0,
  /** Below this the floor is very tight. */
  floorTightM: 0.6,
  /** Less open height than this above the surface is tight for an arm reaching in. */
  overheadTightM: 0.4,
  /** A success target at or above this leaves little room for misses. */
  highSuccessRate: 99,
} as const;

const NO_OPERATIONS: SiteOperations = { timesPerDay: null, daysPerWeek: null, peopleNearby: null, updatedAtIso: null };

export interface ReadinessInputs extends RobotFitInputs {
  /** Whether the walkthrough is saved; null when its status could not be read. */
  walkthroughReceived: boolean | null;
  reconstructionState: string | null;
  /** Whether any job item still needs photos; null when the inventory could not be read. */
  itemPhotosMissing: boolean | null;
  shared: boolean;
}

export async function loadReadinessInputs(requestId: string): Promise<ReadinessInputs> {
  if (!db) throw new Error("site_readiness_store_unavailable");
  const [fit, walkthrough, sessionSnap, inventory, fitSnap] = await Promise.all([
    loadRobotFitInputs(requestId),
    savedWalkthrough(siteWalkthroughIdentity(requestId)).catch(() => null),
    db.collection("captureUploadSessions").doc(`walkthrough-${requestId}`).get(),
    getItemInventory(requestId).catch(() => null),
    db.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId).get(),
  ]);
  const reconstruction = sessionSnap.data()?.world_reconstruction as { state?: unknown } | undefined;
  const items = inventory?.items ?? null;
  return {
    ...fit,
    walkthroughReceived: walkthrough ? walkthrough.received === true : null,
    reconstructionState: typeof reconstruction?.state === "string" ? reconstruction.state : null,
    itemPhotosMissing: items ? items.length === 0 || items.some((item) => item.images.length < 2) : null,
    shared: (fitSnap.data() as { sharing?: { shared?: unknown } } | undefined)?.sharing?.shared === true,
  };
}

/* ----------------------------------------------------------------- wording */

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function hoursText(hours: number) {
  if (hours < 0.05) return "under 0.1";
  return hours < 10 ? String(Number(hours.toFixed(1))) : String(Math.round(hours));
}

function secondsText(seconds: number) {
  if (seconds < 90) {
    const whole = Math.round(seconds);
    return `${whole} ${whole === 1 ? "second" : "seconds"}`;
  }
  return `${Number((seconds / 60).toFixed(1))} minutes`;
}

function targetSeconds(inputs: RobotFitInputs): number | null {
  const value = inputs.brief?.successCriteria?.cycleTimeSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** A confirmed screening answer with its label and verdict, from the same options the site chose from. */
function gateAnswer(inputs: RobotFitInputs, fieldId: string) {
  const value = gateAnswersOnFile(inputs.request)[fieldId];
  const option = gateFields.find((field) => field.id === fieldId)?.options.find((entry) => entry.value === value);
  return option ? { value: option.value, label: option.label, verdict: (option as { verdict?: string }).verdict ?? "clear" } : null;
}

/* ------------------------------------------------------- what it takes today */

/** Times a day (the site's answer) × the time per cycle measured from its video. No price, no market figure. */
export function workloadOf(inputs: RobotFitInputs): Workload | null {
  const times = inputs.operations?.timesPerDay ?? null;
  const cycle = videoEvidence(inputs)?.measuredCycleSeconds ?? null;
  if (!times || !cycle) return null;
  const hoursPerDay = (times * cycle) / 3600;
  const days = inputs.operations?.daysPerWeek ?? null;
  const hoursPerWeek = days ? hoursPerDay * days : null;
  const perDay = hoursText(hoursPerDay);
  return {
    hoursPerDay,
    hoursPerWeek,
    sentence: `This job takes about ${perDay} ${perDay === "1" ? "person-hour" : "person-hours"} a day`
      + `${hoursPerWeek !== null ? `, about ${hoursText(hoursPerWeek)} a week` : ""}.`,
    basis: `${times} ${times === 1 ? "time" : "times"} a day${days ? `, ${days} ${days === 1 ? "day" : "days"} a week` : ""} `
      + `(you told us), at about ${secondsText(cycle)} per cycle (measured from your video). It counts time on this job only.`,
  };
}

/** Today's measured pace against the site's target time per cycle. */
export function speedOf(inputs: RobotFitInputs): SpeedCheck | null {
  const today = videoEvidence(inputs)?.measuredCycleSeconds ?? null;
  const target = targetSeconds(inputs);
  if (today && target) {
    return target < today
      ? { state: "target_faster_than_today", sentence: `Your target is ${secondsText(target)} per cycle, faster than your people `
        + `take today: about ${secondsText(today)}, measured from your video. A robot would need to beat today's pace; the `
        + "evaluation measures cycle time against your target." }
      : { state: "target_within_today", sentence: `Your target is ${secondsText(target)} per cycle, and your people take about `
        + `${secondsText(today)} today (measured from your video). The evaluation measures cycle time against your target.` };
  }
  if (today) {
    return { state: "needs_target", sentence: `Your people take about ${secondsText(today)} per cycle (measured from your video). `
      + "Set a target time per cycle in your job brief, and the evaluation checks a robot against it." };
  }
  if (target) {
    return { state: "needs_measurement", sentence: `Your target is ${secondsText(target)} per cycle. We compare it with today's `
      + "pace once a full cycle is measured from your video." };
  }
  return null;
}

/* ------------------------------------------------------- steps to a pilot */

const KEY_READINGS: readonly (readonly string[])[] = [
  ["pick_surface_height"], ["place_surface_height"], ["pick_to_place_distance"],
  ["object_length", "object_width", "object_height"], ["object_mass"], ["pick_front_clearance"],
];
const REBUILDING = new Set(["generating", "processing", "exporting"]);

function step(id: string, label: string, state: TrackerStep["state"], owner: TrackerStep["owner"], detail: string | null = null): TrackerStep {
  return { id, label, state, owner, detail };
}

function hasSuccessTarget(inputs: RobotFitInputs) {
  const criteria = inputs.brief?.successCriteria;
  return Boolean(criteria && (criteria.successRate != null || criteria.cycleTimeSeconds != null || criteria.successDefinition));
}

export function trackerOf(inputs: ReadinessInputs): Tracker {
  const keyReadings = KEY_READINGS.filter((ids) => ids.some((id) => measured(inputs, id))).length;
  const articulated = inputs.measurements?.family === "articulated_open_close"
    ? Object.values(inputs.measurements.readings ?? {}).filter((reading) => reading.basis !== "paper_standard").length : null;
  const operations = inputs.operations ?? NO_OPERATIONS;
  const answered = [operations.timesPerDay, operations.peopleNearby].filter((value) => value !== null).length;
  const recommended = Boolean(inputs.request?.pilot_recommendation);
  const booked = Boolean(inputs.request?.pilot_booking);
  const scene = inputs.reconstructionState === "ready" ? "done" : REBUILDING.has(inputs.reconstructionState ?? "") ? "in_progress" : "pending";

  const steps: TrackerStep[] = [
    step("video", "Video received", inputs.walkthroughReceived === true ? "done" : inputs.walkthroughReceived === false ? "todo" : "pending", "site"),
    step("brief", "Job brief confirmed", inputs.brief?.confirmedAtIso ? "done" : "todo", "site"),
    articulated !== null
      ? step("measurements", "Measurements", articulated ? "partial" : "todo", "site", `${articulated} recorded`)
      : step("measurements", "Measurements", keyReadings === KEY_READINGS.length ? "done" : keyReadings ? "partial" : "todo", "site",
        `${keyReadings} of ${KEY_READINGS.length}`),
    step("operations", "How the job runs today", answered === 2 ? "done" : answered ? "partial" : "todo", "site"),
    step("success_target", "Success target", hasSuccessTarget(inputs) ? "done" : "todo", "site"),
    step("access_window", "When a robot team can work on site", gateAnswer(inputs, "accessWindow") ? "done" : "todo", "site"),
    step("scene", "Your site rebuilt in 3D", scene, "blueprint"),
    step("evaluation", "Robot teams evaluate your job in simulation", recommended ? "done" : "pending", "blueprint"),
    step("recommendation", "Blueprint recommends one team", recommended ? "done" : "pending", "blueprint"),
    step("booking", "You book the pilot", booked ? "done" : "pending", "site"),
  ];
  const meanwhile = booked ? "Your pilot is booked. You and the robot team agree its details directly."
    : recommended ? "Blueprint has recommended one team for your job. You can review and book it on this page."
      : scene === "in_progress" ? "Blueprint is rebuilding your work area in 3D from your video."
        : scene === "done" ? "Next, Blueprint invites robot teams whose robots look right for your job to evaluate it in a simulation of your site."
          : null;
  return { steps, meanwhile };
}

/** The three most useful missing facts, in priority order, each with why it matters and where it is answered. */
export function nextThingsOf(inputs: ReadinessInputs, facts: JobFacts): NextThing[] {
  const operations = inputs.operations ?? NO_OPERATIONS;
  // The pick-and-place readings mean nothing for a door, drawer or lid, or a job we cannot score.
  const scope = inputs.request?.site_task_scope as { supported?: unknown; kind?: unknown } | undefined;
  const pickPlace = scope?.supported !== false && scope?.kind !== "articulated_open_close"
    && inputs.measurements?.family !== "articulated_open_close";
  const candidates: Array<NextThing | false> = [
    !inputs.brief?.confirmedAtIso && { id: "confirm_brief", action: "Confirm your job brief",
      why: "Robot teams can evaluate your job only after you confirm it.", target: "brief" },
    pickPlace && !facts.distance && { id: "measure_distance", action: "Measure how far the object moves",
      why: "It tells us which robots can reach both spots.", target: "measurements" },
    !operations.timesPerDay && { id: "times_per_day", action: "Tell us how many times a day the job is done",
      why: "It lets us work out the hours this job takes.", target: "operations" },
    pickPlace && !facts.mass && { id: "weigh_object", action: "Weigh one object",
      why: "It tells us how much the robot has to lift.", target: "measurements" },
    !facts.people && { id: "people_nearby", action: "Tell us whether people work near the job",
      why: "It decides how a robot has to work around them.", target: "operations" },
    pickPlace && !measured(inputs, "pick_front_clearance") && { id: "floor_space", action: "Measure the open floor in front of the starting surface",
      why: "It tells us whether a robot's stand or base fits.", target: "measurements" },
    !hasSuccessTarget(inputs) && { id: "success_target", action: "Say what a good result looks like",
      why: "The evaluation scores robots against your success rate and time per cycle.", target: "brief" },
    inputs.itemPhotosMissing === true && { id: "item_photos", action: "Add photos of the items the robot handles",
      why: "They help us rebuild each item for the simulation.", target: "photos" },
  ];
  return candidates.filter((entry): entry is NextThing => Boolean(entry)).slice(0, 3);
}

/* ------------------------------------------------- robot readiness report */

function formsInPlay(job: RobotFitJob) {
  const inPlay = job.forms.filter((rating) => rating.verdict !== "not_a_fit").map((rating) => ROBOT_FORM_COPY[rating.id]);
  return { fixed: inPlay.some((form) => form.moves === "no"), moving: inPlay.some((form) => form.moves !== "no"),
    walking: inPlay.some((form) => form.moves === "legs") };
}

export function checklistOf(inputs: RobotFitInputs, facts: JobFacts, job: RobotFitJob): ReadinessItem[] {
  const { fixed, moving } = formsInPlay(job);
  const front = measured(inputs, "pick_front_clearance");
  const overhead = measured(inputs, "pick_overhead_clearance");
  const overheadTight = overhead && overhead.si < READINESS_SCREENING.overheadTightM
    ? ` Above the surface there is ${measuredDisplay(overhead)} of open height (you measured this), tight for an arm reaching in from above.` : "";
  const floor: ReadinessItem = { id: "floor_space", title: "Floor space at the station",
    why: "A robot needs room to stand, or to drive up, beside the work.", state: "unknown",
    detail: "We don't know yet how much open floor is in front of the starting surface. You can add it under Add measurements (optional) on this page." };
  if (front) {
    const there = `${measuredDisplay(front)} of open floor in front of the starting surface (you measured this)`;
    floor.state = front.si >= READINESS_SCREENING.floorReadyM && !overheadTight ? "ready" : "check";
    floor.detail = (front.si >= READINESS_SCREENING.floorReadyM ? `There is ${there}, room for a robot's stand or base.`
      : front.si >= READINESS_SCREENING.floorTightM
        ? `There is ${there}. That is tight for a robot's stand or base, so Blueprint checks it in the rebuilt scene.`
        : `There is only ${there}, little room for a robot's stand or base.`) + overheadTight;
  }

  const standing = [
    fixed ? "For a robot on a fixed stand: a level spot where the stand can be bolted down or weighted." : null,
    moving ? "For a robot that moves: a place to park and charge, and a clear, level path between the spots." : null,
  ].filter(Boolean).join(" ") || "Where the robot stands depends on which kind of robot fits. The robot team confirms it with you.";

  const people = facts.people;
  const said = people ? `${sentence(people.display)} (${REQUIREMENT_SOURCE_LABELS[people.source]})` : null;
  const zone: ReadinessItem = !people || !said
    ? { id: "safe_zone", title: "A safe working zone", state: "unknown",
      detail: "We don't know yet whether people work near the job. You can answer it under How the job runs today on this page.",
      why: "How people and the robot share the space decides how the robot is kept safe." }
    : { id: "safe_zone", title: "A safe working zone", state: people.value === "isolated" ? "ready" : "check",
      detail: people.value === "isolated" ? `${said}, so the robot can work in an area kept clear of people.`
        : people.value === "nearby" ? `${said}. Plan a marked working area; the robot team's risk assessment decides whether it needs guarding or sensors.`
          : `${said}. The robot has to work safely alongside them; the robot team's risk assessment sets how, such as speed limits, sensors or a marked area.`,
      why: "How people and the robot share the space decides how the robot is kept safe." };

  const arrival = [
    ["Work area", gateAnswer(inputs, "sceneStability")],
    ["The job", gateAnswer(inputs, "taskShape")],
    ["Different items", gateAnswer(inputs, "objectVariety")],
  ] as const;
  const answered = arrival.filter(([, answer]) => answer);
  const arrivalItem: ReadinessItem = answered.length
    ? { id: "object_arrival", title: "How objects arrive",
      state: answered.every(([, answer]) => answer!.verdict === "clear") ? "ready" : "check",
      detail: `${answered.map(([name, answer]) => `${name}: ${answer!.label.charAt(0).toLowerCase()}${answer!.label.slice(1)}`).join(". ")} (you told us).`,
      why: "A robot does best when objects arrive in the same spot and the same way up, and the area does not change." }
    : { id: "object_arrival", title: "How objects arrive", state: "unknown",
      detail: "We don't know yet how much the work area, the job and the items change. You answer this when you confirm your job brief.",
      why: "A robot does best when objects arrive in the same spot and the same way up, and the area does not change." };

  return [
    floor,
    { id: "standing_spot", title: "Where the robot stands", state: "confirm", detail: standing,
      why: "Every robot needs a fixed place to work from, or somewhere to park and charge." },
    { id: "power_network", title: "Power and network", state: "confirm",
      detail: `A power outlet near the work area${moving ? ", and Wi-Fi along the route for a robot that drives between spots" : ""}. The robot team tells you exactly what its robot needs.`,
      why: "A robot needs power where it works." },
    zone,
    arrivalItem,
  ];
}

const SURFACES = /\b(shiny|glossy|reflective|transparent|see-through|glass|shrink[- ]?wrap(?:ped)?|plastic wrap|cling film|foil|metallic|chrome|mirrored)\b/i;
const EXCEPTIONS = /\b(jams?|jammed|damaged|broken|crushed|torn|dented|misplaced|fallen|dropped|spills?)\b/i;

/** Up to three things that decide success here, in priority order, each paired with what tests it. */
export function successFactorsOf(inputs: RobotFitInputs, facts: JobFacts): SuccessFactor[] {
  const text = [inputs.brief?.summary, inputs.brief?.successCriteria?.successDefinition,
    inputs.request?.agent_execution_offer?.team_evaluation?.contract?.instruction]
    .filter((value): value is string => typeof value === "string").join(" ");
  const speed = speedOf(inputs);
  const today = videoEvidence(inputs)?.measuredCycleSeconds ?? null;
  const target = targetSeconds(inputs);
  const variety = gateAnswer(inputs, "objectVariety");
  const shape = gateAnswer(inputs, "taskShape");
  const scene = gateAnswer(inputs, "sceneStability");
  const surface = SURFACES.exec(text)?.[0];
  const exception = EXCEPTIONS.exec(text)?.[0];
  const front = measured(inputs, "pick_front_clearance");
  const overhead = measured(inputs, "pick_overhead_clearance");
  const tight = (front && front.si < READINESS_SCREENING.floorReadyM) || (overhead && overhead.si < READINESS_SCREENING.overheadTightM);
  const hands = handsNeed(facts);
  const rate = inputs.brief?.successCriteria?.successRate;
  const people = facts.people;

  const factors: Array<SuccessFactor | false> = [
    speed?.state === "target_faster_than_today" && today !== null && target !== null && { id: "speed", title: "Speed",
      detail: `Your target, ${secondsText(target)} per cycle, is faster than today's ${secondsText(today)} (measured from your video).`,
      test: "The evaluation measures cycle time against your target.", where: "simulation" },
    Boolean((variety && variety.verdict !== "clear") || (shape && shape.verdict !== "clear")) && { id: "variety", title: "How many different items",
      detail: [shape && shape.verdict !== "clear" ? `The job: ${shape.label.toLowerCase()}` : null,
        variety && variety.verdict !== "clear" ? `Different items: ${variety.label.toLowerCase()}` : null].filter(Boolean).join(". ") + " (you told us).",
      test: "The evaluation tests the items in your rebuilt scene. Add photos of every item the robot handles, so none is left out.",
      where: "simulation" },
    Boolean(scene && scene.verdict !== "clear") && { id: "placement", title: "Things move between shifts",
      detail: `Work area: ${scene!.label.toLowerCase()} (you told us).`,
      test: "The evaluation moves the object's starting spot and turn within set bounds. A work area that is rearranged needs a new scene.",
      where: "simulation" },
    Boolean(surface) && { id: "surfaces", title: "Shiny or see-through packaging", detail: `Your job mentions "${surface!.toLowerCase()}".`,
      test: "Cameras find shiny and see-through surfaces hard, and a simulation shows them less faithfully than the real thing, so this is checked again in the pilot.",
      where: "pilot" },
    Boolean(exception) && { id: "exceptions", title: "Jams and damaged items", detail: `Your job mentions "${exception!.toLowerCase()}".`,
      test: "Jams and damaged items are not in the simulation. Plan who handles them; your success target sets how many a person catches.",
      where: "pilot" },
    Boolean(tight) && { id: "tight_space", title: "Tight space",
      detail: [front && front.si < READINESS_SCREENING.floorReadyM ? `${measuredDisplay(front)} of open floor in front of the starting surface` : null,
        overhead && overhead.si < READINESS_SCREENING.overheadTightM ? `${measuredDisplay(overhead)} of open height above it` : null]
        .filter(Boolean).join(" and ") + " (you measured this).",
      test: "Your rebuilt scene includes the fixtures around the work, so the evaluation checks that the robot reaches in without hitting them.",
      where: "simulation" },
    Boolean(hands) && { id: "large_or_heavy", title: "A large or heavy object",
      detail: [facts.size && facts.size.min > SCREENING.largeSideM ? `Its largest side is ${cite(facts.size)}` : null,
        facts.mass ? `it weighs ${cite(facts.mass)}` : null].filter(Boolean).join(" and ").replace(/^it/, "It") + ".",
      test: "The evaluation varies how well the grip holds, so a large or heavy object is a real test of the robot's grip.",
      where: "simulation" },
    typeof rate === "number" && rate >= READINESS_SCREENING.highSuccessRate && { id: "reliability", title: "A high success target",
      detail: `Your target is ${rate}% successful cycles.`,
      test: "The evaluation scores many runs against your pass mark, so a high target leaves little room for misses.", where: "simulation" },
    Boolean(people && people.value !== "isolated") && { id: "people", title: "People in the space",
      detail: `${sentence(people!.display)} (${REQUIREMENT_SOURCE_LABELS[people!.source]}).`,
      test: "People are not in the simulation. How the robot works around them is settled by the robot team's risk assessment before the pilot.",
      where: "pilot" },
  ];
  return factors.filter((entry): entry is SuccessFactor => Boolean(entry)).slice(0, 3);
}

/** Safety in plain English: who assesses it, under which standards, how robots work near people, and what Blueprint does not certify. */
export function safetyOf(facts: JobFacts, job: RobotFitJob): string[] {
  const { moving, walking } = formsInPlay(job);
  const paragraphs = [
    "Before a robot works at your site, the robot team does a risk assessment of the job with you. It follows the robot-safety "
      + `standards: ISO 10218, adopted in the US as ANSI/A3 R15.06${moving ? ", and ANSI/A3 R15.08 for robots that drive between spots" : ""}.`,
  ];
  if (walking) paragraphs.push("Safety standards for walking robots are still being written, so ask the robot team how its robot is kept safe.");
  paragraphs.push("A robot works near people in one of a few ways: it slows down or stops when someone comes close, it limits its "
    + "speed and force so that contact stays within safe limits, or it works in a guarded or marked area people stay out of. The "
    + "risk assessment decides which for your job.");
  if (facts.people && facts.people.value !== "isolated") {
    paragraphs.push(`${sentence(facts.people.display)} (${REQUIREMENT_SOURCE_LABELS[facts.people.source]}), so this decides how the robot works alongside them.`);
  }
  paragraphs.push("Blueprint's evaluation runs in a simulation of your site. It does not certify that any robot is safe, or that a "
    + "robot will perform the same at your site.");
  return paragraphs;
}

/** A job's words and the curated environments they describe. Precise on purpose: no example beats a wrong one. */
const EXAMPLE_TRIGGERS: ReadonlyArray<[string, RegExp[]]> = [
  ["line-side-packing", [/\b(pack|packs|packing|packed)\b/i, /\b(cartons?|box|boxes|cases?)\b/i]],
  ["parcel-sorting", [/\b(parcels?|packages?)\b/i, /\b(sort|sorts|sorting|sorted|induct\w*)\b/i]],
  ["forward-warehouse", [/\b(pick|picks|picking)\b/i, /\b(orders?|shelf|shelves|totes?)\b/i]],
  ["pharmacy", [/\b(pharmacy|pharmacies|medications?|prescriptions?)\b/i]],
  ["substation-inspection", [/\b(substations?|inspection rounds?|meter readings?|gauge readings?)\b/i]],
];

export function examplesOf(inputs: RobotFitInputs): DeploymentExample[] {
  const text = [inputs.brief?.summary, inputs.request?.agent_execution_offer?.team_evaluation?.contract?.instruction]
    .filter((value): value is string => typeof value === "string").join(" ");
  if (!text.trim()) return [];
  return EXAMPLE_TRIGGERS.filter(([, patterns]) => patterns.every((pattern) => pattern.test(text)))
    .map(([id]) => deployedEnvironments.find((environment) => environment.id === id))
    .filter((environment): environment is (typeof deployedEnvironments)[number] => Boolean(environment && environment.basis === "published"))
    .slice(0, 2)
    .map((environment) => ({ id: environment.id, name: environment.name, status: environment.status,
      evidence: environment.evidence, sources: environment.sources }));
}

/** The robot readiness report for a rated job, or null when there is nothing to show. */
export function buildReadinessReport(inputs: RobotFitInputs, job: RobotFitJob = computeRobotFitJob(inputs)): SiteReadinessReport | null {
  const robotFit = projectSiteRobotFit(job);
  if (!robotFit) return null;
  const facts = jobFactsOf(inputs);
  return {
    robotFit,
    checklist: checklistOf(inputs, facts, job),
    successFactors: successFactorsOf(inputs, facts),
    safety: safetyOf(facts, job),
    examples: examplesOf(inputs),
    examplesFootnote: environmentsFootnote,
  };
}

/* ---------------------------------------------------------------- readers */

/** The owner's view. The report is included only while shared and while consent stands. */
export async function getSiteReadiness(requestId: string): Promise<SiteReadinessResponse | null> {
  const inputs = await loadReadinessInputs(requestId);
  if (!inputs.request) return null;
  const job = computeRobotFitJob(inputs);
  const consentRevoked = projectWebsiteCaptureRights(inputs.request).consent_revoked === true;
  return {
    ok: true,
    summary: job.summary,
    tracker: trackerOf(inputs),
    nextThings: nextThingsOf(inputs, jobFactsOf(inputs)),
    operations: inputs.operations ?? NO_OPERATIONS,
    workload: workloadOf(inputs),
    speed: speedOf(inputs),
    report: inputs.shared && !consentRevoked ? buildReadinessReport(inputs, job) : null,
  };
}

/** Staff preview: the full report as the site would see it once shared, and what the job takes today. */
export async function getReadinessPreview(requestId: string) {
  const inputs = await loadRobotFitInputs(requestId);
  if (!inputs.request) return null;
  return { report: buildReadinessReport(inputs), operations: inputs.operations ?? NO_OPERATIONS,
    workload: workloadOf(inputs), speed: speedOf(inputs) };
}
