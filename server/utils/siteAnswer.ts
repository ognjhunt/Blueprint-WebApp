/**
 * The site's answer: which robot most likely fits its job, the runner-up, what
 * was ruled out, how sure, and one next step (`client/src/lib/siteAnswer.ts`).
 *
 * Composed on every read from documents that already exist: the job request
 * (the video reader's estimates, the task screen), the brief, the site's own
 * readings, the mirrored robot spec catalog and the cited deployment evidence.
 * When the scene rebuilt from the video has been checked, its verdict for a
 * model replaces the one read from the video.
 *
 * Every rule here is fixed: no person and no model picks the robot. Every
 * sentence names the site's number with where it came from and the robot's
 * published figure. It is a fit check and a cited track record; it never
 * certifies performance or safety, and it never waits for the brief to be
 * confirmed or for staff to share it.
 */
import {
  JOB_FAMILY_LABELS, SITE_ANSWER_NOTE, SITE_ANSWER_SCHEMA,
  type AnswerBasis, type AnswerCheck, type AnswerEvidence, type AnswerRobot, type AnswerVerdict, type JobFamily,
  type SiteAnswer,
} from "../../client/src/lib/siteAnswer";
import { REQUIREMENT_SOURCE_LABELS, ROBOT_FORM_COPY, type RequirementSource } from "../../client/src/data/robotFit";
import { EVIDENCE_RANK, evidenceFor as shippedEvidenceFor, type EvidenceLookup } from "./deploymentEvidence";
import { figureSource, figureValue, robotSpecCatalog, type BodyType, type RobotSpecCatalog, type SpecModel } from "./robotSpecCatalog";
import {
  SCREENING, cite, digestOf, jobFactsOf, lengthText, loadRobotFitInputs, videoEvidence, type Quantity, type RobotFitInputs,
} from "./siteRobotFit";
import { isPlaceholderSummary, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { screenTaskScope } from "./siteTaskScope";
import { getMeasurements, type SiteTaskMeasurementRecord } from "./siteTaskMeasurements";
import type { PublicRobotFit } from "./websitePreparationStatus";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

/** The Pipeline's model table from the measured scene, as the status read projects it. */
export type SceneRobotFit = Pick<PublicRobotFit, "models"> | null;

export interface SiteAnswerInputs {
  /** `inboundRequests/{id}` as stored. */
  request: Record<string, any> | null;
  brief: SiteTaskBriefRecord | null;
  measurements: SiteTaskMeasurementRecord | null;
  /** The site's video is saved. Without it and without any number there is no answer yet. */
  videoReceived: boolean;
  /** The measured scene's model table, when scene preparation has produced one. */
  robotFit?: SceneRobotFit;
  /** Defaults to the mirrored catalog. */
  catalog?: RobotSpecCatalog;
  /** Defaults to the shipped deployment evidence. */
  evidenceFor?: EvidenceLookup;
}

const HEADLINE_READING = "We are reading your video. Your answer will appear here.";
const HEADLINE_CANNOT = "We can't check robots against this job yet.";
/** The reason for a video that did not show the job clearly enough to size it; the answer email keys on it. */
export const REASON_UNSIZED = "The video did not show the job clearly enough for us to size it.";
const NEXT_STEP_INTRODUCTION = "Share this job with deployment companies Blueprint has approved, and one of them can pilot it at your site.";
const SCENE_RULED_OUT = "Ruled out in the scene rebuilt from your video.";
/** Wrist and mounting margin an arm standing between the spots needs beyond half the span. */
const REACH_MARGIN_M = 0.10;
/** A length the video reader estimated as one figure is checked across this band. */
const VIDEO_LENGTH_BAND = [0.75, 1.33] as const;
/** The pessimistic cycle: each carry at a tenth of the published top speed, a longer path, and time to grip and let go. */
const CYCLE_SLOW_FRACTION = 0.1;
const CYCLE_EXTRA_PATH_M = 0.6;
const CYCLE_ALLOWANCE_S = 4;
// Margin beyond a fifth of the robot's rating does not make the job more likely to
// work; it adds size, cost and guarding. So headroom counts up to 0.2, and past that
// the smaller robot comes first.
const HEADROOM_CAP = 0.2;
// Under a tenth of the rating to spare, an estimate's error or a heavier gripper can use it all up.
const COMFORTABLE_HEADROOM = 0.1;
const TIGHT_FIT = " This is a tight fit.";

const BODY_FORM: Record<BodyType, keyof typeof ROBOT_FORM_COPY> = {
  fixed_arm: "fixed_base_arm",
  mobile_manipulator: "mobile_manipulator",
  humanoid: "humanoid",
};

type Band = { lo: number; hi: number };
type Outcome = AnswerCheck["outcome"];

/* -------------------------------------------------------------- small words */

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const figure = (value: number) => String(Number(value.toFixed(value < 10 ? 2 : 1)));
const kgText = (value: number) => `${figure(value)} kg`;
const secondsText = (value: number) => `${value < 10 ? Number(value.toFixed(1)) : Math.round(value)} s`;
const sourceLabel = (source: RequirementSource) => REQUIREMENT_SOURCE_LABELS[source];

/**
 * A length in a check sentence, the robot's and the job's alike, to the centimetre: one rounding for
 * both sides, so a need within the limit never reads as more than it, nor a need beyond it as less.
 */
const specLength = (metres: number) => {
  const centimetres = Math.round(metres * 100);
  return centimetres < 100 ? `${centimetres} cm` : `${Number((centimetres / 100).toFixed(2))} m`;
};

/** A length range in the site's words: "about 86 cm–1.36 m", or one figure when both ends read the same. */
function lengthRange(band: Band) {
  const [lo, hi] = [specLength(band.lo), specLength(band.hi)];
  if (lo === hi) return `about ${lo}`;
  const unit = (value: string) => value.split(" ")[1];
  return unit(lo) === unit(hi) ? `about ${lo.split(" ")[0]}–${hi}` : `about ${lo}–${hi}`;
}

/** Pass when even the pessimistic need is within the limit; a fail when even the optimistic need exceeds it. */
export function within(need: Band, limit: number): Outcome {
  return need.hi <= limit ? "pass" : need.lo > limit ? "fail" : "unknown";
}

/** A weight range at the same precision as a rated payload (`kgText`), for the same reason. */
function kgRange(band: Band) {
  const [lo, hi] = [figure(band.lo), figure(band.hi)];
  return lo === hi ? `about ${lo} kg` : `about ${lo}–${hi} kg`;
}

/** A video estimate given as one figure is checked across a band; anything the site gave keeps its own ends. */
function bandOf(quantity: Quantity): Band {
  if (quantity.source === "video_estimate" && quantity.min === quantity.max) {
    return { lo: quantity.min * VIDEO_LENGTH_BAND[0], hi: quantity.min * VIDEO_LENGTH_BAND[1] };
  }
  return { lo: quantity.min, hi: quantity.max };
}

/* ------------------------------------------------------------- the job */

type Facts = ReturnType<typeof jobFactsOf>;

interface Job {
  facts: Facts;
  /** Straight line between the two spots, at both band ends. */
  span: Band | null;
  spanEstimated: boolean;
  /** How the span reads in a sentence, with its basis. */
  spanText: string | null;
  mass: Band | null;
  massEstimated: boolean;
  cycleTarget: number | null;
}

function heightGap(pick: Band, place: Band): Band {
  return {
    lo: Math.max(0, pick.lo - place.hi, place.lo - pick.hi),
    hi: Math.max(pick.hi - place.lo, place.hi - pick.lo),
  };
}

function jobOf(inputs: SiteAnswerInputs, facts: Facts): Job {
  const { distance, pick, place } = facts;
  let span: Band | null = null;
  let spanEstimated = false;
  let spanText: string | null = null;
  if (distance) {
    const across = bandOf(distance);
    const used = pick && place ? [distance, pick, place] : [distance];
    spanEstimated = used.some((entry) => entry.source === "video_estimate");
    if (pick && place) {
      const gap = heightGap(bandOf(pick), bandOf(place));
      span = { lo: Math.hypot(across.lo, gap.lo), hi: Math.hypot(across.hi, gap.hi) };
      const nominal = Math.hypot(distance.min, pick.min - place.min);
      spanText = `about ${lengthText(nominal)} apart (${sourceLabel(spanEstimated ? "video_estimate" : distance.source)})`;
    } else {
      span = across;
      spanText = `${distance.display} apart (${sourceLabel(distance.source)})`;
    }
  }
  const success = isRecord(inputs.brief?.successCriteria) ? inputs.brief!.successCriteria : null;
  const target = number(success?.cycleTimeSeconds);
  return {
    facts, span, spanEstimated, spanText,
    mass: facts.mass ? { lo: facts.mass.min, hi: facts.mass.max } : null,
    massEstimated: facts.mass?.source === "video_estimate",
    cycleTarget: target !== null && target > 0 ? target : null,
  };
}

/** The raw reading's object name, walkthrough first, then a link the site shared. */
function readingObject(request: Record<string, any>): string | null {
  const walkthrough = isRecord(request.walkthrough_job_estimates) ? request.walkthrough_job_estimates.job_estimates : null;
  const link = isRecord(request.site_video_evidence) ? request.site_video_evidence.job_estimates : null;
  return text(isRecord(walkthrough) ? walkthrough.object : null) ?? text(isRecord(link) ? link.object : null);
}

function readingText(request: Record<string, any>): string | null {
  const walkthrough = isRecord(request.walkthrough_job_estimates) ? request.walkthrough_job_estimates.job_estimates : null;
  const parts = [readingObject(request), text(isRecord(walkthrough) ? walkthrough.basis : null),
    text(isRecord(request.site_video_evidence) ? request.site_video_evidence.summary : null)].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export function jobFamilyOf(sentence: string | null): JobFamily {
  const value = (sentence ?? "").toLowerCase();
  if (/pallet/.test(value)) return "palletizing";
  if (/\b(machine|cnc|lathe|mill|press|mould|mold|injection|tend)/.test(value)) return "machine_tending";
  return "pick_place";
}

/**
 * Kinds of job that are plainly not one solid object picked up and put down.
 * `container`, `mobile` and `multi_step` are still a pick and a place for the
 * fit check: the task screen describes what the simulation can score, not
 * whether robots can be checked against the job.
 */
const OTHER_KIND_REASONS = new Set(["deformable", "liquid", "assembly", "closing", "push", "articulated"]);
const REASON_OTHER_KIND = "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet.";
const UNKNOWN_MULTI_STEP = "Your job has more than one step; this checks one carry.";

type Screen = { kind: string | null; reason: string | null };

function isOtherKind(screen: Screen): boolean {
  return (screen.kind !== null && screen.kind !== "rigid_pick_and_place")
    || (screen.reason !== null && OTHER_KIND_REASONS.has(screen.reason));
}

/** The stored task screen, when the job has one. */
function storedScreen(request: Record<string, any>): Screen | null {
  const scope = isRecord(request.site_task_scope) ? request.site_task_scope : null;
  if (!scope || (scope.supported !== true && scope.supported !== false)) return null;
  return { kind: typeof scope.kind === "string" ? scope.kind : null, reason: typeof scope.reason === "string" ? scope.reason : null };
}

/** The brief's own words: the typed or drafted summary and its success line. Placeholders say nothing. */
function briefTexts(brief: SiteTaskBriefRecord | null): string[] {
  const summary = typeof brief?.summary === "string" && !isPlaceholderSummary(brief.summary) ? brief.summary : null;
  const success = isRecord(brief?.successCriteria) ? text(brief!.successCriteria.successDefinition) : null;
  return [summary, success].filter((entry): entry is string => Boolean(entry && entry.trim()));
}

/**
 * The video reading's own sentences: the coverage review's basis, and a linked
 * video's summary and basis. The object's bare name is not screened on its own:
 * the task screen's word lists are written for sentences, and a bare noun reads
 * wrongly ("water bottle" as a liquid, "bolt" as assembly).
 */
function readingTexts(request: Record<string, any>): string[] {
  const walkthrough = isRecord(request.walkthrough_job_estimates) ? request.walkthrough_job_estimates.job_estimates : null;
  const link = isRecord(request.site_video_evidence) ? request.site_video_evidence : null;
  return [text(isRecord(walkthrough) ? walkthrough.basis : null), text(link?.summary),
    text(isRecord(link?.job_estimates) ? link!.job_estimates.basis : null)].filter((entry): entry is string => Boolean(entry));
}

/**
 * Whether robots can be checked against the job, in this order: when the stored
 * scope or a screen of any text describing the job (the brief, the reading's own
 * words) says the job is plainly another kind, it cannot be assessed, whatever
 * numbers the reading gave. Otherwise an object and a distance or a height is a
 * pick and a place (the caller runs the fit check, or says the job could not be
 * sized when there is no number).
 */
function scopeOf(request: Record<string, any>, brief: SiteTaskBriefRecord | null): { otherKind: boolean; multiStep: boolean } {
  const stored = storedScreen(request);
  const briefScreens = briefTexts(brief).map((summary) => screenTaskScope({ summary }));
  const readingScreens = readingTexts(request).map((summary) => screenTaskScope({ summary }));
  const otherKind = [stored, ...briefScreens, ...readingScreens].some((screen) => screen !== null && isOtherKind(screen));
  // More than one step is the site's description of its job: the stored scope, else its brief.
  const multiStep = stored ? stored.reason === "multi_step" : briefScreens.some((screen) => screen.reason === "multi_step");
  return { otherKind, multiStep };
}

const APPROACH_PROGRAMMED = "A programmed application: the installer teaches the robot this motion once.";
const APPROACH_PROGRAMMED_ARMS = " Arms of this kind are deployed this way on jobs like yours.";
const APPROACH_CAMERA = "The objects vary, so the robot needs camera-guided picking. Ask the deployment company how it handles each item.";

/** How the pick would be controlled, reasoned only from what the video shows. */
function approachOf(inputs: RobotFitInputs, request: Record<string, any>, pick: Rated | null): SiteAnswer["approach"] {
  if (!pick) return null;
  const others = videoEvidence(inputs)?.estimates?.otherItemsLikely ?? [];
  if (others.length) return { kind: "camera_guided", text: APPROACH_CAMERA };
  if (!readingObject(request)) return null;
  // The deployment-practice sentence is about fixed industrial and collaborative arms only.
  return { kind: "programmed", text: APPROACH_PROGRAMMED + (pick.model.body_type === "fixed_arm" ? APPROACH_PROGRAMMED_ARMS : "") };
}

/* ------------------------------------------------------------- the checks */

interface Rated {
  model: SpecModel;
  verdict: AnswerVerdict;
  sceneChecked: boolean;
  checks: AnswerCheck[];
  reason: { text: string; estimated: boolean } | null;
  evidence: AnswerEvidence[];
  headroom: number;
  /** At least `COMFORTABLE_HEADROOM` to spare on every check that has a headroom figure. */
  comfortable: boolean;
  /** Passed checks with less than that to spare. */
  tight: Set<AnswerCheck["key"]>;
}

function reachCheck(model: SpecModel, job: Job, toolLength: number | null): { check: AnswerCheck; headroom: number | null } {
  const reach = figureValue(model, "max_reach_m");
  const estimated = job.spanEstimated;
  if (model.body_type !== "fixed_arm") {
    const arm = reach !== null ? ` Its arm reaches ${specLength(reach)}.` : "";
    return { check: { key: "reach", outcome: "unknown", estimated: false,
      text: `Reach: this robot moves between the spots, so its reach is not checked against the distance on paper.${arm}` }, headroom: null };
  }
  if (reach === null) {
    return { check: { key: "reach", outcome: "unknown", estimated: false, text: "Reach: the maker publishes no reach figure for this arm." }, headroom: null };
  }
  if (!job.span || !job.spanText) {
    return { check: { key: "reach", outcome: "unknown", estimated: false,
      text: `Reach: we don't know yet how far apart your two spots are. This arm reaches ${specLength(reach)}.` }, headroom: null };
  }
  if (job.span.lo > SCREENING.fixedSpanMaxM) {
    return { check: { key: "reach", outcome: "fail", estimated,
      text: `Reach: your two spots are ${job.spanText}, more than the ${lengthText(SCREENING.fixedSpanMaxM)} an arm that stays in one place can serve. This arm reaches ${specLength(reach)}.` },
      headroom: null };
  }
  if (toolLength === null) {
    return { check: { key: "reach", outcome: "unknown", estimated,
      text: `Reach: your two spots are ${job.spanText}. The gripper's length is not published, so we could not size the reach. This arm reaches ${specLength(reach)}.` },
      headroom: null };
  }
  const need = { lo: job.span.lo / 2 + toolLength + REACH_MARGIN_M, hi: job.span.hi / 2 + toolLength + REACH_MARGIN_M };
  return {
    check: { key: "reach", outcome: within(need, reach), estimated,
      text: `Reach: your two spots are ${job.spanText}, so an arm standing between them needs ${lengthRange(need)}. This arm reaches ${specLength(reach)}.` },
    headroom: (reach - need.hi) / reach,
  };
}

function payloadCheck(model: SpecModel, job: Job, toolMass: number | null): { check: AnswerCheck; headroom: number | null } {
  const payload = figureValue(model, "rated_payload_kg");
  const fixed = model.body_type === "fixed_arm";
  const noun = fixed ? "This arm" : "This robot";
  if (payload === null) {
    return { check: { key: "payload", outcome: "unknown", estimated: false, text: "Payload: the maker publishes no rated payload for this robot." }, headroom: null };
  }
  const mass = job.facts.mass;
  if (!mass || !job.mass) {
    return { check: { key: "payload", outcome: "unknown", estimated: false,
      text: `Payload: we don't know yet how heavy your object is. ${noun} is rated for ${kgText(payload)}.` }, headroom: null };
  }
  const tool = fixed ? toolMass ?? 0 : 0;
  // A lighter gripper may be fitted, so only the object's own weight can rule a model out.
  const need = { lo: job.mass.lo, hi: job.mass.hi + tool };
  const gripper = fixed && tool > 0 ? `, plus about ${kgText(tool)} for a standard gripper` : "";
  // The total is said in the rating's own precision, so the sentence never reads against its outcome.
  const carry = Number.isFinite(need.hi) ? `, so it must carry ${kgRange(need)}` : "";
  return {
    check: { key: "payload", outcome: within(need, payload), estimated: job.massEstimated,
      text: `Payload: your object weighs ${cite(mass)}${gripper}${carry}. ${noun} is rated for ${kgText(payload)}.` },
    headroom: Number.isFinite(need.hi) ? (payload - need.hi) / payload : -1,
  };
}

function cycleCheck(model: SpecModel, job: Job): AnswerCheck | null {
  if (job.cycleTarget === null) return null;
  const target = `Cycle time: you want one cycle in ${secondsText(job.cycleTarget)} (${sourceLabel("site_stated")}).`;
  const speed = figureValue(model, "max_tcp_speed_m_s");
  if (speed === null || speed <= 0) {
    return { key: "cycle_time", outcome: "unknown", estimated: false, text: `${target} The maker publishes no top speed for this robot.` };
  }
  if (!job.span) {
    return { key: "cycle_time", outcome: "unknown", estimated: false, text: `${target} We don't know yet how far apart your two spots are.` };
  }
  const need = {
    lo: (2 * job.span.lo) / speed,
    hi: (2 * (job.span.hi + CYCLE_EXTRA_PATH_M)) / (CYCLE_SLOW_FRACTION * speed) + CYCLE_ALLOWANCE_S,
  };
  return { key: "cycle_time", outcome: within(need, job.cycleTarget), estimated: job.spanEstimated,
    text: `${target} With a published top speed of ${figure(speed)} m/s and your spots ${job.spanText}, a cycle takes between about ${secondsText(need.lo)} and ${secondsText(need.hi)} on paper.` };
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function sceneVerdict(robotFit: SceneRobotFit | undefined, model: SpecModel) {
  const rows = Array.isArray(robotFit?.models) ? robotFit!.models : [];
  const row = rows.find((entry) => isRecord(entry) && typeof entry.name === "string" && typeof entry.manufacturer === "string"
    && norm(entry.manufacturer) === norm(model.manufacturer) && norm(entry.name) === norm(model.name));
  return row?.verdict ?? null;
}

function rateModel(model: SpecModel, job: Job, catalog: RobotSpecCatalog, robotFit: SceneRobotFit | undefined,
  evidence: AnswerEvidence[]): Rated {
  const toolLength = figureValue(catalog.default_tool, "length_m");
  const toolMass = figureValue(catalog.default_tool, "mass_kg");
  const reach = reachCheck(model, job, toolLength);
  const payload = payloadCheck(model, job, toolMass);
  const cycle = cycleCheck(model, job);
  const checks = [reach.check, payload.check, ...(cycle ? [cycle] : [])];
  const failed = checks.find((entry) => entry.outcome === "fail") ?? null;
  let verdict: AnswerVerdict = failed ? "ruled_out" : checks.every((entry) => entry.outcome === "pass") ? "fits_on_paper" : "possible";
  let reason = failed ? { text: failed.text, estimated: failed.estimated } : null;
  const scene = sceneVerdict(robotFit, model);
  if (scene) {
    verdict = scene === "fits" ? "fits" : scene === "fits_spec" ? "fits_on_paper" : scene === "doesnt_fit" ? "ruled_out" : "possible";
    reason = verdict === "ruled_out" ? { text: SCENE_RULED_OUT, estimated: false } : null;
  }
  const headroom = Math.max(-1, Math.min(HEADROOM_CAP, reach.headroom ?? 0, payload.headroom ?? 0));
  const margins = [[reach.check, reach.headroom], [payload.check, payload.headroom]] as const;
  const comfortable = margins.every(([, room]) => room === null || room >= COMFORTABLE_HEADROOM);
  const tight = new Set(margins.filter(([check, room]) => check.outcome === "pass" && room !== null && room < COMFORTABLE_HEADROOM)
    .map(([check]) => check.key));
  return { model, verdict, sceneChecked: Boolean(scene), checks, reason, evidence, headroom, comfortable, tight };
}

/* ------------------------------------------------------------- ranking */

const VERDICT_RANK: Record<AnswerVerdict, number> = { fits: 3, fits_on_paper: 2, possible: 1, ruled_out: 0 };
const evidenceRank = (rated: Rated) => (rated.evidence[0] ? EVIDENCE_RANK[rated.evidence[0].level] : 0);
const scopeRank = (rated: Rated) => (rated.evidence[0]?.scope === "model" ? 0 : 1);

/** The least machine first: no capability the job does not need. */
function formRank(body: BodyType, job: Job): number {
  const moves = Boolean(job.span && job.span.lo > SCREENING.fixedSpanMaxM);
  const order: BodyType[] = moves ? ["mobile_manipulator", "humanoid", "fixed_arm"] : ["fixed_arm", "mobile_manipulator", "humanoid"];
  return order.indexOf(body);
}

function compareRated(job: Job) {
  return (a: Rated, b: Rated) => VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict]
    // Physical margin predicts a working job better than a document does: a comfortable fit first.
    || Number(b.comfortable) - Number(a.comfortable)
    || evidenceRank(b) - evidenceRank(a)
    || scopeRank(a) - scopeRank(b)
    || formRank(a.model.body_type, job) - formRank(b.model.body_type, job)
    || b.headroom - a.headroom
    || (figureValue(a.model, "rated_payload_kg") ?? Number.MAX_VALUE) - (figureValue(b.model, "rated_payload_kg") ?? Number.MAX_VALUE)
    || a.model.model_id.localeCompare(b.model.model_id);
}

function robotOf(rated: Rated): AnswerRobot {
  const { model } = rated;
  const specs: AnswerRobot["specs"] = [];
  const reach = figureValue(model, "max_reach_m");
  const reachUrl = figureSource(model, "max_reach_m");
  if (reach !== null && reachUrl) specs.push({ label: "Reach", display: specLength(reach), sourceUrl: reachUrl });
  const payload = figureValue(model, "rated_payload_kg");
  const payloadUrl = figureSource(model, "rated_payload_kg");
  if (payload !== null && payloadUrl) specs.push({ label: "Rated payload", display: kgText(payload), sourceUrl: payloadUrl });
  return {
    modelId: model.model_id, name: model.name, manufacturer: model.manufacturer,
    formLabel: ROBOT_FORM_COPY[BODY_FORM[model.body_type]].label,
    verdict: rated.verdict, sceneChecked: rated.sceneChecked, specs, evidence: rated.evidence.slice(0, 2),
    // The pick and the runner-up say when a check passed with little to spare.
    checks: rated.checks.map((check) => (rated.tight.has(check.key) ? { ...check, text: `${check.text}${TIGHT_FIT}` } : check)),
  };
}

const displayName = (model: { manufacturer: string; name: string }) => `${model.manufacturer} ${model.name}`;

/* ------------------------------------------------------------- confidence */

function confidenceOf(pick: Rated | null, job: Job, familyLabel: string): SiteAnswer["confidence"] {
  const raiseIt: string[] = [];
  if (!job.facts.mass || job.massEstimated) raiseIt.push("Tell us the object's weight.");
  if (!job.facts.distance || job.spanEstimated) raiseIt.push("Tell us how far apart the two spots are.");
  if (!pick) return { level: "low", reasons: ["No robot we checked fits this job on the numbers we have."], raiseIt: [...raiseIt, "A measured scene of your work area."] };
  if (!pick.sceneChecked) raiseIt.push("A measured scene of your work area.");
  raiseIt.push("A pilot at your site.");

  const reasons: string[] = [];
  const estimatedKeys = new Set(pick.checks.filter((entry) => entry.estimated).map((entry) => entry.key));
  const parts = [estimatedKeys.has("payload") ? "weight" : null, estimatedKeys.has("reach") || estimatedKeys.has("cycle_time") ? "distances" : null]
    .filter(Boolean);
  if (parts.length) reasons.push(`The ${parts.join(" and ")} ${parts.length > 1 || parts[0] === "distances" ? "are" : "is"} estimated from your video.`);
  if (pick.verdict === "possible") reasons.push("Some of its checks could not be settled on the numbers we have.");
  if (pick.sceneChecked) reasons.push("It was checked against the scene rebuilt from your video.");
  const top = pick.evidence[0];
  const subject = top?.scope === "maker" ? `${pick.model.manufacturer} robots` : "this robot";
  if (!top) reasons.push("We found no documented use of this robot on this kind of job.");
  else if (top.level === "production") reasons.push(`We found documented production use of ${subject} for ${familyLabel}.`);
  else if (top.level === "pilot") reasons.push(`We found a documented pilot of ${subject} for ${familyLabel}.`);
  else reasons.push(`We found ${subject} offered for ${familyLabel}, with no named customer.`);

  const fits = pick.verdict === "fits" || pick.verdict === "fits_on_paper";
  const level = fits && !estimatedKeys.size && top?.level === "production" ? "good"
    : fits && ((top && EVIDENCE_RANK[top.level] >= EVIDENCE_RANK.pilot) || pick.sceneChecked) ? "fair" : "low";
  return { level, reasons, raiseIt };
}

/* ------------------------------------------------------------- unknowns */

function unknownsOf(inputs: RobotFitInputs, job: Job): string[] {
  const estimates = videoEvidence(inputs)?.estimates ?? null;
  const unknowns = ["Whether there is floor space for the robot between the two spots."];
  const surface = estimates?.surface;
  unknowns.push(surface === "shiny" || surface === "transparent"
    ? `Which gripper or tool the object needs: it looks ${surface} in your video, which affects that choice.`
    : "Which gripper or tool the object needs.");
  const others = estimates?.otherItemsLikely ?? [];
  unknowns.push(others.length
    ? `How many different objects the job handles: your video suggests it may also handle ${others.join(", ")}.`
    : "How many different objects the job handles.");
  const people = job.facts.people;
  if (!people || people.value !== "isolated") {
    unknowns.push("Safety around people, which the company that deploys the robot assesses at your site.");
  }
  if (!job.facts.mass) unknowns.push("How heavy the object is.");
  if (!job.facts.distance) unknowns.push("How far apart the two spots are.");
  return unknowns;
}

/* ------------------------------------------------------------- compose */

function introductionAt(request: Record<string, any>): string | null {
  const intro = isRecord(request.introduction_request) ? request.introduction_request : null;
  return text(intro?.requested_at_iso);
}

/** Whether the job card is on, as stored: what the confirmation under an asked introduction says. */
function jobCardListed(request: Record<string, any>): boolean {
  return isRecord(request.public_task_listing) && request.public_task_listing.enabled === true;
}

function coverageDone(request: Record<string, any>, inputs: RobotFitInputs): boolean {
  return Boolean(request.capture_coverage) || Boolean(videoEvidence(inputs)?.estimates);
}

/**
 * The answer, or null while there is nothing to answer from (no video and no
 * number) or once recording consent is withdrawn. Pure: the same inputs always
 * give the same answer, and junk inputs give a smaller answer, never an error.
 */
export function composeSiteAnswer(inputs: SiteAnswerInputs): SiteAnswer | null {
  const request = isRecord(inputs?.request) ? inputs.request : null;
  if (!request) return null;
  if (projectWebsiteCaptureRights(request).consent_revoked) return null;
  const brief = isRecord(inputs.brief) ? inputs.brief : null;
  const measurements = isRecord(inputs.measurements) ? inputs.measurements : null;
  const fitInputs: RobotFitInputs = { request, brief, measurements };
  const catalog = inputs.catalog ?? robotSpecCatalog();
  const lookup = inputs.evidenceFor ?? shippedEvidenceFor;

  const facts = jobFactsOf(fitInputs);
  const known = [facts.distance, facts.pick, facts.place, facts.mass, facts.size].filter((entry): entry is Quantity => Boolean(entry));
  if (!inputs.videoReceived && !known.length) return null;
  const siteNumbers = known.some((entry) => entry.source === "site_measured" || entry.source === "site_stated");
  const job = jobOf(inputs, facts);

  const summary = typeof brief?.summary === "string" && !isPlaceholderSummary(brief.summary) ? brief.summary.trim() : null;
  const drafted = Boolean(summary) && !brief?.confirmedAtIso && !request.site_task_brief_confirmed_at
    && isRecord(request.capture_task_statement_draft) && request.capture_task_statement_draft.state === "drafted";
  const family = jobFamilyOf(summary ?? readingText(request));
  const familyLabel = JOB_FAMILY_LABELS[family];

  const answerFacts: SiteAnswer["facts"] = known.map((entry) => ({ label: entry.label, display: entry.display, basis: entry.source as AnswerBasis }));
  if (job.cycleTarget !== null) answerFacts.push({ label: "Your target cycle time", display: secondsText(job.cycleTarget), basis: "site_stated" });

  const makers = new Set(catalog.models.map((model) => model.manufacturer));
  const base = {
    schemaVersion: SITE_ANSWER_SCHEMA,
    job: { sentence: summary, drafted, family, familyLabel },
    facts: answerFacts,
    pick: null, runnerUp: null, alsoFit: [], ruledOut: [], ruledOutMore: 0, formNote: null, approach: null,
    unknowns: [] as string[],
    confidence: { level: "low" as const, reasons: [] as string[], raiseIt: [] as string[] },
    nextStep: { kind: "none" as const, text: "" },
    reason: null as string | null,
    note: SITE_ANSWER_NOTE,
    checked: { models: catalog.models.length, makers: makers.size, specsRetrievedOn: catalog.retrieved_on },
    introductionRequestedAtIso: introductionAt(request),
    jobCardListed: jobCardListed(request),
  };
  const basis = {
    facts: known.map(({ key, display, source, min, max }) => ({ key, display, source, min, max })),
    people: facts.people?.value ?? null, cycleTarget: job.cycleTarget, summary, drafted, family,
    scope: isRecord(request.site_task_scope) ? { supported: request.site_task_scope.supported ?? null,
      kind: request.site_task_scope.kind ?? null, reason: request.site_task_scope.reason ?? null } : null,
    videoReceived: Boolean(inputs.videoReceived), catalog: catalog.retrieved_on,
  };
  const finish = (answer: Omit<SiteAnswer, "basisDigest">, extra: Record<string, unknown> = {}): SiteAnswer =>
    ({ ...answer, basisDigest: digestOf({ ...basis, state: answer.state, ...extra }) });

  const scope = scopeOf(request, brief);
  if (scope.otherKind) return finish({ ...base, state: "cannot_assess", headline: HEADLINE_CANNOT, reason: REASON_OTHER_KIND });
  if (!coverageDone(request, fitInputs) && !siteNumbers) return finish({ ...base, state: "reading", headline: HEADLINE_READING });
  if (!facts.distance && !facts.mass && !facts.size) {
    if (!coverageDone(request, fitInputs)) return finish({ ...base, state: "reading", headline: HEADLINE_READING });
    return finish({ ...base, state: "cannot_assess", headline: HEADLINE_CANNOT, reason: REASON_UNSIZED });
  }

  const rated = catalog.models.map((model) => {
    let evidence: AnswerEvidence[] = [];
    try { evidence = lookup(model.model_id, model.manufacturer, model.body_type, family) ?? []; } catch { evidence = []; }
    return rateModel(model, job, catalog, inputs.robotFit, Array.isArray(evidence) ? evidence : []);
  });
  const candidates = rated.filter((entry) => entry.verdict !== "ruled_out").sort(compareRated(job));
  const ruled = rated.filter((entry) => entry.verdict === "ruled_out");
  const pick = candidates[0] ?? null;
  const runnerUp = pick ? candidates.slice(1).find((entry) => entry.model.manufacturer !== pick.model.manufacturer) ?? candidates[1] ?? null : null;
  const alsoFit = candidates.filter((entry) => entry !== pick && entry !== runnerUp && (entry.verdict === "fits" || entry.verdict === "fits_on_paper"))
    .slice(0, 6).map(({ model }) => ({ name: model.name, manufacturer: model.manufacturer }));
  const ruledOut = ruled.slice(0, 8).map(({ model, reason }) => ({ name: model.name, manufacturer: model.manufacturer,
    reason: reason?.text ?? SCENE_RULED_OUT, estimated: reason?.estimated ?? false }));

  const headline = !pick ? `None of the ${catalog.models.length} robots we checked fits this job on the numbers we have.`
    : pick.verdict === "possible" ? `No robot clearly fits yet. The closest is ${displayName(pick.model)}.`
      : `Most likely to fit: ${displayName(pick.model)}.`;
  const formNote = job.span && job.span.lo > SCREENING.fixedSpanMaxM && job.spanText
    ? `Your two spots are ${job.spanText}, so the job needs a robot that moves between them, such as an arm on a wheeled base.`
    : null;

  return finish({
    ...base,
    state: "ready",
    headline,
    pick: pick ? robotOf(pick) : null,
    runnerUp: runnerUp ? robotOf(runnerUp) : null,
    alsoFit,
    ruledOut,
    ruledOutMore: Math.max(0, ruled.length - ruledOut.length),
    formNote,
    approach: approachOf(fitInputs, request, pick),
    unknowns: [...unknownsOf(fitInputs, job), ...(scope.multiStep ? [UNKNOWN_MULTI_STEP] : [])],
    confidence: confidenceOf(pick, job, familyLabel),
    nextStep: pick ? { kind: "introduction", text: NEXT_STEP_INTRODUCTION } : { kind: "none", text: "" },
  }, {
    verdicts: rated.map((entry) => [entry.model.model_id, entry.verdict, entry.sceneChecked,
      entry.evidence.slice(0, 2).map((row) => [row.level, row.scope, row.sourceUrl])]),
  });
}

/* ------------------------------------------------------------- loading */

export interface LoadSiteAnswerOptions {
  /** The status route's projected Pipeline table, or null. */
  robotFit?: SceneRobotFit;
  /** Documents the caller has already read, so they are not read twice. */
  request?: Record<string, any> | null;
  brief?: SiteTaskBriefRecord | null;
  /** Whether the walkthrough is saved; read from the request when not given. */
  videoReceived?: boolean;
}

/** Whether the request shows a received video, for callers that have not checked the upload itself. */
function requestShowsVideo(request: Record<string, any> | null): boolean {
  return Boolean(request && (request.capture_coverage || request.capture_coverage_pending || request.capture_coverage_request
    || request.walkthrough_job_estimates || request.site_video_evidence));
}

/** Read the job's documents (only those the caller has not passed) and compose its answer. */
export async function loadSiteAnswer(requestId: string, options: LoadSiteAnswerOptions = {}): Promise<SiteAnswer | null> {
  const robotFit = options.robotFit ?? null;
  if (options.request === undefined || options.brief === undefined) {
    const loaded = await loadRobotFitInputs(requestId);
    return composeSiteAnswer({ ...loaded, robotFit, videoReceived: options.videoReceived ?? requestShowsVideo(loaded.request) });
  }
  const request = options.request ?? null;
  // The one read a caller holding the request and the brief still needs: the site's own readings.
  const measurements = await getMeasurements(requestId);
  return composeSiteAnswer({ request, brief: options.brief ?? null, measurements, robotFit,
    videoReceived: options.videoReceived ?? requestShowsVideo(request) });
}
