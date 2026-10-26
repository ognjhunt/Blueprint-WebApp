/**
 * The site readiness report: an expert's first read of a site's job, built
 * with fixed sentences and no model call of its own.
 *
 * The site sends its video and nothing else (founder direction, 2026-10-20).
 * The report reads what Blueprint already holds: the video reader's
 * measurements and estimates, anything the site told us, and the rebuilt
 * scene's state. It asks the site nothing. The robot readiness report (robot
 * fit, getting the site ready, what decides success, safety, and where robots
 * already do this kind of job) reaches the owner once Blueprint shares it,
 * with the robot-fit sharing switch; the printable brief adds where the job
 * stands. Nothing here names, counts or compares a partner, quotes a price,
 * or promises an outcome. The simulation is credited only with what the
 * evaluation contract tests: the object's start position and turn, the light
 * and the grip, the fixtures in the rebuilt scene, cycle time against the
 * site's target and the site's pass mark.
 * Design: docs/superpowers/specs/2026-10-20-site-readiness-report-design.md.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { deployedEnvironments, environmentsFootnote } from "../../client/src/data/qualifyingEnvironments";
import { REQUIREMENT_SOURCE_LABELS, ROBOT_FORM_COPY, type RobotFitJob } from "../../client/src/data/robotFit";
import {
  type DeploymentExample,
  type ReadinessItem,
  type SiteReadinessReport,
  type SiteReadinessResponse,
  type SuccessFactor,
  type Tracker,
  type TrackerStep,
} from "../../client/src/data/siteReadiness";
import { gateFields } from "../../client/src/data/siteTaskQualification";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import { isQualifiedRecommendationEvidence } from "./pilotRecommendationEvidence";
import {
  SCREENING,
  SITE_ROBOT_FIT_COLLECTION,
  cite,
  computeRobotFitJob,
  handsNeed,
  jobFactsOf,
  lengthText,
  loadRobotFitInputs,
  measured,
  measuredDisplay,
  projectSiteRobotFit,
  videoEvidence,
  type JobFacts,
  type RobotFitInputs,
} from "./siteRobotFit";
import { taskScopeNotYet } from "./siteTaskScope";
import { reconstructionIsViewable } from "./taskLifecycleNotifications";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
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

export interface ReadinessInputs extends RobotFitInputs {
  /** Whether the walkthrough is saved; null when its status could not be read, which never reads as "not filmed". */
  walkthroughReceived: boolean | null;
  reconstructionState: string | null;
  /** A ready scene with a viewable world, the same test the scene-ready notice uses. */
  sceneViewable: boolean;
  shared: boolean;
}

export async function loadReadinessInputs(requestId: string): Promise<ReadinessInputs> {
  if (!db) throw new Error("site_readiness_store_unavailable");
  const [fit, walkthrough, sessionSnap, fitSnap] = await Promise.all([
    loadRobotFitInputs(requestId),
    savedWalkthrough(siteWalkthroughIdentity(requestId)).catch(() => null),
    db.collection("captureUploadSessions").doc(`walkthrough-${requestId}`).get(),
    db.collection(SITE_ROBOT_FIT_COLLECTION).doc(requestId).get(),
  ]);
  const reconstruction = sessionSnap.data()?.world_reconstruction as Parameters<typeof reconstructionIsViewable>[0] | undefined;
  return {
    ...fit,
    walkthroughReceived: walkthrough ? walkthrough.received === true : null,
    reconstructionState: typeof reconstruction?.state === "string" ? reconstruction.state : null,
    sceneViewable: Boolean(reconstruction && reconstructionIsViewable(reconstruction)),
    shared: (fitSnap.data() as { sharing?: { shared?: unknown } } | undefined)?.sharing?.shared === true,
  };
}

/* ----------------------------------------------------------------- wording */

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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

/* ------------------------------------------------------------------ pace */

/** Today's pace against the site's target, when both are known: the speed success factor. */
function paceShortfall(inputs: RobotFitInputs): { today: number; target: number } | null {
  const today = cycleSeconds(inputs);
  const target = targetSeconds(inputs);
  return today && target && target < today.seconds ? { today: today.seconds, target } : null;
}

/** A full cycle measured from the video, else the video reader's estimate. */
function cycleSeconds(inputs: RobotFitInputs): { seconds: number; measured: boolean } | null {
  const video = videoEvidence(inputs);
  if (video?.measuredCycleSeconds) return { seconds: video.measuredCycleSeconds, measured: true };
  return video?.estimates?.cycleSeconds ? { seconds: video.estimates.cycleSeconds, measured: false } : null;
}

/* ------------------------------------------------------- steps to a pilot */

const REBUILDING = new Set(["generating", "processing", "exporting"]);

function step(id: string, label: string, state: TrackerStep["state"], owner: TrackerStep["owner"]): TrackerStep {
  return { id, label, state, owner };
}

/** Where the job stands, from recorded states only. The site's only steps are its video and its brief. */
export function trackerOf(inputs: ReadinessInputs): Tracker {
  const recommendation = inputs.request?.pilot_recommendation as { id?: unknown; reviewRequired?: unknown; evidence?: unknown } | undefined;
  const proposed = typeof recommendation?.id === "string" && recommendation.id.length > 0;
  // What the owner booking route accepts: a recorded recommendation, not awaiting
  // review, on qualified evidence. Nothing else may read as "book it" (audit N14).
  const bookable = proposed && recommendation!.reviewRequired !== true
    && isQualifiedRecommendationEvidence(recommendation!.evidence as Parameters<typeof isQualifiedRecommendationEvidence>[0]);
  const booked = Boolean(inputs.request?.pilot_booking);
  const scope = inputs.request?.site_task_scope as { supported?: unknown; reason?: unknown } | undefined;
  // Done only once the scene can be viewed: a "ready" label without its world is not a rebuilt site.
  const sceneState = inputs.sceneViewable ? "done" : REBUILDING.has(inputs.reconstructionState ?? "") ? "in_progress" : "pending";
  // A scene is only ever built from a received video; a status that could not be read is unknown, never "not filmed".
  const video = inputs.walkthroughReceived === true || sceneState !== "pending" ? "done"
    : inputs.walkthroughReceived === false ? "pending" : "unknown";
  const steps: TrackerStep[] = [
    step("video", "Video received", video, "site"),
    step("brief", "Job brief confirmed", inputs.brief?.confirmedAtIso ? "done" : "pending", "site"),
    step("scene", "Your site rebuilt in 3D", sceneState, "blueprint"),
    step("evaluation", "Blueprint evaluates candidate robots and policies in simulation", booked || proposed ? "done" : "pending", "blueprint"),
    step("recommendation", "Blueprint recommends the approach that wins", booked || bookable ? "done" : proposed ? "in_progress" : "pending", "blueprint"),
    step("booking", "You book the pilot", booked ? "done" : "pending", "site"),
  ];
  const meanwhile = booked ? "Your pilot is booked. You and the delivery partner agree its details directly."
    : bookable ? "Blueprint has recommended a pilot for your job. You can review and book it on your job page."
      : proposed ? "Blueprint is reviewing its recommendation against your job brief."
        : scope?.supported === false ? taskScopeNotYet(scope.reason).headline
          : sceneState === "in_progress" ? "Blueprint is rebuilding your work area in 3D from your video."
            : sceneState === "done" ? "Next, Blueprint evaluates candidate robots and policies that look right for your job in a simulation of your site."
              : null;
  return { steps, meanwhile };
}

/* ------------------------------------------------- robot readiness report */

function formsInPlay(job: RobotFitJob) {
  const inPlay = job.forms.filter((rating) => rating.verdict !== "not_a_fit").map((rating) => ROBOT_FORM_COPY[rating.id]);
  return { fixed: inPlay.some((form) => form.moves === "no"), moving: inPlay.some((form) => form.moves !== "no"),
    walking: inPlay.some((form) => form.moves === "legs") };
}

/**
 * The open floor in front of the starting surface, the site's measurement else
 * the video reader's estimate, as a phrase: "120 cm (you measured this) of open
 * floor", or "no open floor (estimated from your video)" for a zero.
 */
function frontClearance(inputs: RobotFitInputs): { metres: number; floor: string; measured: boolean } | null {
  const reading = measured(inputs, "pick_front_clearance");
  const estimate = videoEvidence(inputs)?.estimates?.frontClearanceM;
  const found = reading ? { metres: reading.si, figure: measuredDisplay(reading), source: "you measured this" }
    : typeof estimate === "number" ? { metres: estimate, figure: `about ${lengthText(estimate)}`, source: "estimated from your video" }
      : null;
  if (!found) return null;
  return { metres: found.metres, measured: Boolean(reading),
    floor: found.metres === 0 ? `no open floor (${found.source})` : `${found.figure} (${found.source}) of open floor` };
}

export function checklistOf(inputs: RobotFitInputs, facts: JobFacts, job: RobotFitJob): ReadinessItem[] {
  const { fixed, moving } = formsInPlay(job);
  const front = frontClearance(inputs);
  const overhead = measured(inputs, "pick_overhead_clearance");
  const overheadTight = overhead && overhead.si < READINESS_SCREENING.overheadTightM
    ? ` Above the surface there is ${measuredDisplay(overhead)} of open height (you measured this), tight for an arm reaching in from above.` : "";
  const roomy = Boolean(front && front.metres >= READINESS_SCREENING.floorReadyM);
  // Only a reading on file makes the floor "Looks ready"; an estimate is confirmed with the deployment partner.
  const floor: ReadinessItem = { id: "floor_space", title: "Floor space at the station",
    state: roomy && front?.measured && !overheadTight ? "ready" : "confirm",
    detail: (!front ? "The deployment partner confirms the floor space its robot needs beside the work."
      : roomy ? `There is ${front.floor} in front of the starting surface, ${front.measured ? "" : "likely "}room for a robot's stand or base.`
        : front.metres === 0 ? `There is ${front.floor} in front of the starting surface, so a robot's stand or base needs another spot. `
          + "Confirm the space with the deployment partner."
          : `There is ${front.metres >= READINESS_SCREENING.floorTightM ? "" : "only "}${front.floor} in front of the starting surface, `
            + "tight for a robot's stand or base. Confirm the space with the deployment partner.") + overheadTight };

  const standing = [
    fixed ? "For a robot on a fixed stand: a level spot where the stand can be bolted down or weighted." : null,
    moving ? "For a robot that moves: a place to park and charge, and a clear, level path between the spots." : null,
  ].filter(Boolean).join(" ") || "Where the robot stands depends on which kind of robot fits. The deployment partner confirms it with you.";

  const people = facts.people;
  const said = people ? `${sentence(people.display)} (${REQUIREMENT_SOURCE_LABELS[people.source]})` : null;
  const zone: ReadinessItem = !people || !said
    ? { id: "safe_zone", title: "A safe working zone", state: "confirm",
      detail: "The deployment partner's risk assessment settles how its robot works around people." }
    : { id: "safe_zone", title: "A safe working zone", state: people.value === "isolated" ? "ready" : "confirm",
      detail: people.value === "isolated" ? `${said}, so the robot can work in an area kept clear of people.`
        : people.value === "nearby" ? `${said}. Plan a marked working area; the deployment partner's risk assessment decides whether it needs guarding or sensors.`
          : `${said}. The robot has to work safely alongside them; the deployment partner's risk assessment sets how, such as speed limits, sensors or a marked area.` };

  const answers: Array<[string, ReturnType<typeof gateAnswer>]> = [
    ["Work area", gateAnswer(inputs, "sceneStability")],
    ["The job", gateAnswer(inputs, "taskShape")],
    ["Different items", gateAnswer(inputs, "objectVariety")],
  ];
  const answered = answers.flatMap(([name, answer]) => (answer ? [[name, answer] as const] : []));

  return [
    floor,
    { id: "standing_spot", title: "Where the robot stands", state: "confirm", detail: standing },
    { id: "power_network", title: "Power and network", state: "confirm",
      detail: `A power outlet near the work area${moving ? ", and Wi-Fi along the route for a robot that drives between spots" : ""}. The deployment partner tells you exactly what its robot needs.` },
    zone,
    // Left out when nothing is known: an empty item is only more to read.
    ...(answered.length ? [{ id: "object_arrival" as const, title: "How objects arrive",
      state: answered.every(([, answer]) => answer.verdict === "clear") ? "ready" as const : "confirm" as const,
      detail: `${answered.map(([name, answer]) => `${name}: ${answer.label.charAt(0).toLowerCase()}${answer.label.slice(1)}`).join(". ")} (you told us).` }] : []),
  ];
}

const SURFACES = /\b(shiny|glossy|reflective|transparent|see-through|glass|shrink[- ]?wrap(?:ped)?|plastic wrap|cling film|foil|metallic|chrome|mirrored)\b/i;
const EXCEPTIONS = new RegExp([
  String.raw`\bjam(?:s|med|ming)?\b(?![- ]?jars?\b)`,
  String.raw`(?<!\b(?:zero|no|without|any|un)[- ]?)\bdamaged\b`,
  String.raw`\bbroken\b(?![- ]cases?\b)`,
  String.raw`\b(?:crushed|torn|dented|misplaced|fallen)\b`,
  String.raw`\bdropped\b(?!\s+off\b)`,
  String.raw`\bspill(?:s|ed)?\b(?![- ]?(?:proof|resistant)\b)`,
].join("|"), "i");

/** Up to three things that decide success here, in priority order, each paired with what tests it. */
export function successFactorsOf(inputs: RobotFitInputs, facts: JobFacts): SuccessFactor[] {
  const estimates = videoEvidence(inputs)?.estimates ?? null;
  const text = [inputs.brief?.summary, inputs.brief?.successCriteria?.successDefinition,
    inputs.request?.agent_execution_offer?.team_evaluation?.contract?.instruction]
    .filter((value): value is string => typeof value === "string").join(" ");
  const pace = paceShortfall(inputs);
  const today = cycleSeconds(inputs);
  const variety = gateAnswer(inputs, "objectVariety");
  const shape = gateAnswer(inputs, "taskShape");
  const scene = gateAnswer(inputs, "sceneStability");
  const surface = SURFACES.exec(text)?.[0]
    ?? (estimates?.surface === "shiny" || estimates?.surface === "transparent" ? estimates.surface : undefined);
  const exception = EXCEPTIONS.exec(text)?.[0];
  const front = frontClearance(inputs);
  const overhead = measured(inputs, "pick_overhead_clearance");
  const tight = (front && front.metres < READINESS_SCREENING.floorReadyM) || (overhead && overhead.si < READINESS_SCREENING.overheadTightM);
  const hands = handsNeed(facts);
  const rate = inputs.brief?.successCriteria?.successRate;
  const people = facts.people;
  const otherItems = estimates?.otherItemsLikely ?? [];

  const factors: Array<SuccessFactor | false> = [
    Boolean(pace && today) && { id: "speed", title: "Speed",
      detail: `Your target, ${secondsText(pace!.target)} per cycle, is faster than today's ${secondsText(today!.seconds)} `
        + `(${today!.measured ? "timed from your video" : "estimated from your video"}).`,
      test: "The evaluation measures cycle time against your target.", where: "simulation" },
    Boolean((variety && variety.verdict !== "clear") || (shape && shape.verdict !== "clear") || otherItems.length) && {
      id: "variety", title: "How many different items",
      detail: [shape && shape.verdict !== "clear" ? `The job: ${shape.label.toLowerCase()} (you told us)` : null,
        variety && variety.verdict !== "clear" ? `Different items: ${variety.label.toLowerCase()} (you told us)` : null,
        otherItems.length ? `Probably also handled here, though not in your video: ${otherItems.join(", ")} (estimated from your video)` : null]
        .filter(Boolean).join(". ") + ".",
      test: "The evaluation tests the object in your rebuilt scene. Other items are checked in the pilot.",
      where: "pilot" },
    Boolean(scene && scene.verdict !== "clear") && { id: "placement", title: "Things move between shifts",
      detail: `Work area: ${scene!.label.toLowerCase()} (you told us).`,
      test: "The evaluation moves the object's starting spot and turn within set bounds. A work area that is rearranged needs a new scene.",
      where: "simulation" },
    Boolean(surface) && { id: "surfaces", title: "Shiny or see-through items",
      detail: SURFACES.test(text) ? `Your job mentions "${surface!.toLowerCase()}".` : `The object looks ${surface} in your video.`,
      test: "Cameras find shiny and see-through surfaces hard, and a simulation shows them less faithfully than the real thing, so this is checked again in the pilot.",
      where: "pilot" },
    Boolean(exception) && { id: "exceptions", title: "Jams and damaged items", detail: `Your job mentions "${exception!.toLowerCase()}".`,
      test: "Jams and damaged items are not in the simulation. Plan who handles them; your success target sets how many a person catches.",
      where: "pilot" },
    Boolean(tight) && { id: "tight_space", title: "Tight space",
      detail: sentence([front && front.metres < READINESS_SCREENING.floorReadyM ? `${front.floor} in front of the starting surface` : null,
        overhead && overhead.si < READINESS_SCREENING.overheadTightM ? `${measuredDisplay(overhead)} of open height above it (you measured this)` : null]
        .filter(Boolean).join(" and ")) + ".",
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
      test: "People are not in the simulation. How the robot works around them is settled by the deployment partner's risk assessment before the pilot.",
      where: "pilot" },
  ];
  return factors.filter((entry): entry is SuccessFactor => Boolean(entry)).slice(0, 3);
}

/** Safety in plain English: who assesses it, under which standards, how robots work near people, and what Blueprint does not certify. */
export function safetyOf(facts: JobFacts, job: RobotFitJob): string[] {
  const { moving, walking } = formsInPlay(job);
  const paragraphs = [
    "Before a robot works at your site, ask the deployment partner for its risk assessment of the job. Robot safety follows the "
      + `standards ISO 10218, adopted in the US as ANSI/A3 R15.06${moving ? ", and ANSI/A3 R15.08 for robots that drive between spots" : ""}.`,
  ];
  if (walking) paragraphs.push("Safety standards for walking robots are still being written, so ask the deployment partner how its robot is kept safe.");
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

/**
 * A job's words and the curated environments they describe, for deployments on
 * the public record only. Precise on purpose: no example beats a wrong one.
 */
const EXAMPLE_TRIGGERS: ReadonlyArray<[string, RegExp[]]> = [
  ["parcel-sorting", [/\b(parcels?|packages?)\b/i, /\b(sort|sorts|sorting|sorted|induct\w*)\b/i]],
  ["pharmacy", [/\b(pharmacy|pharmacies|medications?|prescriptions?)\b/i]],
  ["substation-inspection", [/\b(substations?|inspection rounds?|meter readings?|gauge readings?)\b/i]],
];

export function examplesOf(inputs: RobotFitInputs): DeploymentExample[] {
  const text = [inputs.brief?.summary, inputs.request?.agent_execution_offer?.team_evaluation?.contract?.instruction]
    .filter((value): value is string => typeof value === "string").join(" ");
  if (!text.trim()) return [];
  return EXAMPLE_TRIGGERS.filter(([, patterns]) => patterns.every((pattern) => pattern.test(text)))
    .map(([id]) => deployedEnvironments.find((environment) => environment.id === id))
    .filter((environment): environment is (typeof deployedEnvironments)[number] =>
      Boolean(environment && environment.basis === "published" && environment.status === "documented"))
    .slice(0, 2)
    // The environment and its sources only: the evidence text names robot companies, and a site never weighs teams.
    .map((environment) => ({ id: environment.id, name: environment.name, sources: environment.sources }));
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

/** The owner's view: where the job stands, and the report only while shared and while consent stands. */
export async function getSiteReadiness(requestId: string): Promise<SiteReadinessResponse | null> {
  const inputs = await loadReadinessInputs(requestId);
  if (!inputs.request) return null;
  const job = computeRobotFitJob(inputs);
  const consentRevoked = projectWebsiteCaptureRights(inputs.request).consent_revoked === true;
  return {
    ok: true,
    summary: job.summary,
    tracker: trackerOf(inputs),
    report: inputs.shared && !consentRevoked ? buildReadinessReport(inputs, job) : null,
    // Minted by the owner's route; the brief's own read never mints another.
    briefPath: null,
  };
}

/** Staff preview: the full report as the site would see it once shared. */
export async function getReadinessPreview(requestId: string) {
  const inputs = await loadRobotFitInputs(requestId);
  if (!inputs.request) return null;
  return { report: buildReadinessReport(inputs) };
}
