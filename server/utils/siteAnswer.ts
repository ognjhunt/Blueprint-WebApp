/**
 * The site's answer: which robot most likely fits its job, the runner-up, what
 * was ruled out, how sure, and one next step (`client/src/lib/siteAnswer.ts`).
 *
 * Composed on every read from documents that already exist: the job request
 * (the video reader's estimates, the task screen), the brief, the site's own
 * readings, the mirrored robot spec catalog and the cited deployment evidence.
 * Each check takes its outcome from the best source for its own quantity: the
 * site's numbers first, then the scene rebuilt from the video (reach only), then
 * the video's estimates. A robot's verdict comes only from its checks.
 *
 * Every rule here is fixed: no person and no model picks the robot. Every
 * sentence names the site's number with where it came from and the robot's
 * published figure. It is a fit check and a cited track record; it never
 * certifies performance or safety, and it never waits for the brief to be
 * confirmed or for staff to share it.
 */
import {
  ALSO_INVOLVES_PREFIX, ALSO_INVOLVES_SUFFIX, JOB_FAMILY_LABELS, REASON_UNSIZED, SITE_ANSWER_NOTE, SITE_ANSWER_SCHEMA, sceneOutrankedNote,
  UNKNOWN_JOB_KIND, UNKNOWN_MULTI_STEP, UNKNOWN_SCENE_NOT_COVERED,
  type AnswerBasis, type AnswerCheck, type AnswerEvidence, type AnswerRobot, type AnswerVerdict, type JobFamily,
  type JobSharing, type SiteAnswer,
} from "../../client/src/lib/siteAnswer";
import { REQUIREMENT_SOURCE_LABELS, ROBOT_FORM_COPY, type RequirementSource } from "../../client/src/data/robotFit";
import { sameRobot } from "../../client/src/lib/robotNameMatch";
import { EVIDENCE_RANK, evidenceFor as shippedEvidenceFor, type EvidenceLookup } from "./deploymentEvidence";
import {
  HAND_HEIGHT_FIGURES, figureSource, figureValue, robotSpecCatalog, type BodyType, type RobotSpecCatalog, type SpecModel,
} from "./robotSpecCatalog";
import {
  SCREENING, cite, digestOf, jobFactsOf, lengthText, loadRobotFitInputs, videoEvidence, type Quantity, type RobotFitInputs,
} from "./siteRobotFit";
import { isPlaceholderSummary, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { multiStepEvidence } from "./siteTaskScope";
import { getMeasurements, type SiteTaskMeasurementRecord } from "./siteTaskMeasurements";
import type { PublicRobotFit } from "./websitePreparationStatus";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { teamJobAccess } from "./teamJobAccess";
import { jobIsShared } from "./jobSharedListing";
import { hasCurrentRecordingConsent } from "./recordingConsent";

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

const HEADLINE_READING = "We are reading your video. Your first look will appear here.";
const HEADLINE_CANNOT = "We can't check robots against this job yet.";
/** The reason for a video that did not show the job clearly enough to size it; the answer email and the page key on it. */
export { REASON_UNSIZED, UNKNOWN_JOB_KIND };
const NEXT_STEP_INTRODUCTION = "Deployment companies we approve can answer about this job.";
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
  wheeled_humanoid: "wheeled_humanoid",
};

/**
 * The catalog files an arm on any base that moves as `mobile_manipulator`, wheeled or legged (Spot), so the
 * answer does not use the form copy's "Arm on a wheeled base" for it.
 */
export const MOVING_BASE_ARM_LABEL = "Arm on a base that moves";

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

/* ------------------------------------------------------------- hand heights */

/*
 * A robot that moves between the spots is not limited by the distance between them. What limits it is how
 * high and how low its hand goes: the maker's highest and lowest hand height above the floor, against the
 * height of each spot. Each sentence below is said only for the input it names.
 */

/** The maker lists no working height. */
export const HEIGHT_NO_FIGURES = "Height: this robot moves between the spots, so what limits it is how high and how low its hand goes, and the maker lists no working height.";
/** The job gives neither spot's height (the robot's hand heights follow). */
export const HEIGHT_JOB_UNKNOWN_BOTH = "Height: we don't know yet how high your two spots are.";
/** The job gives the put-down height but not the pick-up height. */
export const HEIGHT_JOB_UNKNOWN_PICK = "Height: we don't know yet how high the spot where it is picked up is.";
/** The job gives the pick-up height but not the put-down height. */
export const HEIGHT_JOB_UNKNOWN_PLACE = "Height: we don't know yet how high the spot where it is put down is.";
/** Both heights are within the end the maker publishes, but it does not publish the other end. */
export const HEIGHT_ONLY_TOP = "It lists how high this robot works but not how low, so we can't say yet.";
export const HEIGHT_ONLY_BOTTOM = "It lists how low this robot works but not how high, so we can't say yet.";
/** Why a height check with both figures is unknown: a spot's height band spans the hand's limit. */
const HEIGHT_SPANS_VIDEO = "The height estimated from your video spans this robot's limit, so we can't say yet.";
const HEIGHT_SPANS_SITE = "Your heights span this robot's limit, so we can't say yet.";
/** A spot is wholly above the highest, or wholly below the lowest, working height the maker lists. */
export const HEIGHT_TOO_HIGH = "That is above the highest working height the maker lists.";
export const HEIGHT_TOO_LOW = "That is below the lowest working height the maker lists.";

/*
 * What the maker lists, in its own terms: some makers state a height above the floor, others a vertical
 * workspace starting at 0 (and Galbot's is for the wrist centre), so the sentence says "working height as
 * the maker lists it", never that the hand reaches it.
 */
const workingLow = (bottom: number) => (bottom === 0 ? "0" : specLength(bottom));

/** The listed range in words: "0 to 2.2 m", "only as up to 1.8 m", "only as starting at 0". */
function workingRangeText(top: number | null, bottom: number | null): string {
  if (top !== null && bottom !== null) return `${workingLow(bottom)} to ${specLength(top)}`;
  return top !== null ? `only as up to ${specLength(top)}` : `only as starting at ${workingLow(bottom!)}`;
}

/** The listed range as the short `has` figure, in the sentence's own words: "0–2.2 m", "up to 1.8 m", "starting at 40 cm". */
function workingRangeShort(top: number | null, bottom: number | null): string {
  if (top !== null && bottom !== null) return `${workingLow(bottom)}–${specLength(top)}`;
  return top !== null ? `up to ${specLength(top)}` : `starting at ${workingLow(bottom!)}`;
}

/** A height band in words, the floor named as such. */
const heightText = (band: Band) => (band.hi === 0 ? "floor level" : lengthRange(band));

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

/* ------------------------------------------------------------- the kind of job */

/*
 * No word list decides anything about the job. The video reader, which watched
 * the job and read the site's description, says what kind it is (`job_kind`):
 * "other" means robots cannot be checked against it; a carrying kind means they
 * can, and it gives the job family. When the reader does not say (an older
 * reading, or footage that did not show the job), the check runs on the numbers,
 * the first unknown says only a carry was checked, and the standing note says
 * what every answer covers. What else the job involves comes only from the
 * reader's `other_actions`, a closed list.
 */

// UNKNOWN_MULTI_STEP and UNKNOWN_JOB_KIND (said first, so the answer never passes for more than a carry) live in
// `client/src/lib/siteAnswer.ts`, so the page knows them as lines that change what the answer covers.

const listInWords = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0];

function alsoInvolves(actions: string[]): string {
  return `${ALSO_INVOLVES_PREFIX}${listInWords(actions)}${ALSO_INVOLVES_SUFFIX}`;
}

/**
 * Why a job the reader says is another kind cannot be checked, with what the reader saw, and the one thing the
 * site can do: a summary edit causes a new reading.
 */
function reasonOtherKind(actions: string[]): string {
  const seen = actions.length ? ` (${listInWords(actions)})` : "";
  return `From your video, the job looks like more than picking an object up and putting it down${seen}, which we can't check robots against yet. If that is not right, edit the job description to say what the robot should do, and we will read the video again.`;
}

const READER_FAMILY: Record<"pick_and_place" | "palletizing" | "machine_tending", JobFamily> = {
  pick_and_place: "pick_place", palletizing: "palletizing", machine_tending: "machine_tending",
};

interface Scope {
  /** The reader says the job mainly does something else to the object: no robot can be checked against it. */
  otherKind: boolean;
  /** The job family: the reader's kind of job when it gives one, otherwise pick and place. */
  family: JobFamily;
  /** What else is done to the object besides carrying it, from the reader's closed list. */
  otherActions: string[];
  /** The reader gave no kind of job: only a carry was checked, and the answer says so. */
  kindUnknown: boolean;
  /** The reader judged the job a carrying kind: only then is the kind of job stated. */
  readerJudged: boolean;
  multiStep: boolean;
}

/** Whether robots can be checked against the job, from the reader's own kind of job. */
function scopeOf(inputs: RobotFitInputs, jobSentences: string[]): Scope {
  const estimates = videoEvidence(inputs)?.estimates ?? null;
  const kind = estimates?.jobKind ?? null;
  const otherKind = kind === "other";
  return {
    otherKind,
    family: kind && kind !== "other" ? READER_FAMILY[kind] : "pick_place",
    otherActions: estimates?.otherActions ?? [],
    kindUnknown: kind === null,
    readerJudged: kind !== null && kind !== "other",
    multiStep: jobSentences.some((sentence) => Boolean(multiStepEvidence(sentence))),
  };
}

const APPROACH_PROGRAMMED = "A programmed application: the installer teaches the robot this motion once.";
const APPROACH_CAMERA = "The objects vary, so the robot needs camera-guided picking. Ask the deployment company how it handles each item.";

/** How the pick would be controlled, reasoned only from what the video shows. */
function approachOf(inputs: RobotFitInputs, request: Record<string, any>, pick: Rated | null): SiteAnswer["approach"] {
  if (!pick) return null;
  const others = videoEvidence(inputs)?.estimates?.otherItemsLikely ?? [];
  if (others.length) return { kind: "camera_guided", text: APPROACH_CAMERA };
  if (!readingObject(request)) return null;
  return { kind: "programmed", text: APPROACH_PROGRAMMED };
}

/* ------------------------------------------------------------- the checks */

interface Rated {
  model: SpecModel;
  verdict: AnswerVerdict;
  /** The reach check was decided (passed or failed) in the scene rebuilt from the video. */
  sceneChecked: boolean;
  checks: AnswerCheck[];
  /** The first failed check: what rules the robot out. */
  reason: { text: string; estimated: boolean } | null;
  evidence: AnswerEvidence[];
  headroom: number;
  /** At least `COMFORTABLE_HEADROOM` to spare on every check that has a headroom figure. */
  comfortable: boolean;
  /** Passed checks with less than that to spare. */
  tight: Set<AnswerCheck["key"]>;
  /**
   * The scene says this robot does not fit on a check the scene decides (reach, where it can stand, access), but the
   * site gave its own distance, which outranks the reconstruction: the verdict stands and the answer says both.
   */
  sceneOverruled: boolean;
}

type Checked = { check: AnswerCheck; headroom: number | null };

/** Why a check with figures is unknown: its need spans the robot's limit. Said after the figures. */
const SPANS_VIDEO = "The estimate from your video spans this robot's limit, so we can't say yet.";
const SPANS_SITE = "Your numbers span this robot's limit, so we can't say yet.";
const SPANS_VIDEO_PAYLOAD = "The estimate from your video, with the gripper's weight, spans this robot's rating, so we can't say yet.";
const SPANS_SITE_PAYLOAD = "With the gripper's weight added, this is at this robot's rating, so we can't say yet.";
const SPANS_CYCLE = "On paper a cycle may or may not fit in your target, so we can't say yet.";
/**
 * `need` and `has` are the figures the sentence itself says, as the same strings, so a short line built from them
 * never reads differently from the sentence: the job's side and the robot's side, or null where there is none.
 */
const unknownCheck = (key: AnswerCheck["key"], text: string, has: string | null = null): AnswerCheck =>
  ({ key, outcome: "unknown", estimated: false, basis: null, text, need: null, has });

/** Where the span between the two spots came from. */
const spanBasis = (job: Job): AnswerBasis => (job.spanEstimated ? "video_estimate" : job.facts.distance!.source as AnswerBasis);

function reachCheck(model: SpecModel, job: Job, toolLength: number | null): Checked {
  const reach = figureValue(model, "max_reach_m");
  const estimated = job.spanEstimated;
  if (model.body_type !== "fixed_arm") return heightCheck(model, job);
  const distanceUnknown = (text: string, has: string | null = null): Checked =>
    ({ check: { ...unknownCheck("reach", text, has), measure: "distance" }, headroom: null });
  if (reach === null) return distanceUnknown("Reach: the maker publishes no reach figure for this arm.");
  if (!job.span || !job.spanText) {
    return distanceUnknown(`Reach: we don't know yet how far apart your two spots are. This arm reaches ${specLength(reach)}.`, specLength(reach));
  }
  const basis = spanBasis(job);
  if (job.span.lo > SCREENING.fixedSpanMaxM) {
    return { check: { key: "reach", measure: "distance", outcome: "fail", estimated, basis,
      text: `Reach: your two spots are ${job.spanText}, more than the ${lengthText(SCREENING.fixedSpanMaxM)} an arm that stays in one place can serve. This arm reaches ${specLength(reach)}.`,
      need: null, has: specLength(reach) },
      headroom: null };
  }
  if (toolLength === null) {
    return { check: { key: "reach", measure: "distance", outcome: "unknown", estimated, basis,
      text: `Reach: your two spots are ${job.spanText}. The gripper's length is not published, so we could not size the reach. This arm reaches ${specLength(reach)}.`,
      need: null, has: specLength(reach) },
      headroom: null };
  }
  const need = { lo: job.span.lo / 2 + toolLength + REACH_MARGIN_M, hi: job.span.hi / 2 + toolLength + REACH_MARGIN_M };
  const outcome = within(need, reach);
  // An unknown says why it is unknown, so its figures never read as a pass or a fail.
  const needText = lengthRange(need);
  const text = `Reach: your two spots are ${job.spanText}, so an arm standing between them needs ${needText}. This arm reaches ${specLength(reach)}.`
    + (outcome === "unknown" ? ` ${estimated ? SPANS_VIDEO : SPANS_SITE}` : "");
  return { check: { key: "reach", measure: "distance", outcome, estimated, basis, text, need: needText, has: specLength(reach) },
    headroom: (reach - need.hi) / reach };
}

/**
 * How high and how low the hand must go, for every body type that moves (fixed arms keep the distance check).
 * Pass when both spots' height bands lie inside the published range; fail when a band lies wholly above the
 * highest or wholly below the lowest; otherwise unknown, each case with its own sentence.
 */
function heightCheck(model: SpecModel, job: Job): Checked {
  const top = figureValue(model, HAND_HEIGHT_FIGURES.max);
  const bottom = figureValue(model, HAND_HEIGHT_FIGURES.min);
  const unknown = (text: string, has: string | null): Checked =>
    ({ check: { ...unknownCheck("reach", text, has), measure: "height" }, headroom: null });
  if (top === null && bottom === null) return unknown(HEIGHT_NO_FIGURES, null);
  const hand = `The maker lists its working height ${top !== null && bottom !== null ? "as " : ""}${workingRangeText(top, bottom)}.`;
  const has = workingRangeShort(top, bottom);
  const { pick, place } = job.facts;
  if (!pick || !place) {
    const missing = !pick && !place ? HEIGHT_JOB_UNKNOWN_BOTH : !pick ? HEIGHT_JOB_UNKNOWN_PICK : HEIGHT_JOB_UNKNOWN_PLACE;
    return unknown(`${missing} ${hand}`, has);
  }
  const spots = [{ words: "where it is picked up", quantity: pick }, { words: "where it is put down", quantity: place }]
    .map((spot) => ({ ...spot, band: bandOf(spot.quantity) }));
  const estimated = spots.some((spot) => spot.quantity.source === "video_estimate");
  // Both heights are the site's measurement unless one is the video's estimate (`lengthRequirement`).
  const basis: AnswerBasis = estimated ? "video_estimate" : pick.source as AnswerBasis;
  const need = { lo: Math.min(...spots.map((spot) => spot.band.lo)), hi: Math.max(...spots.map((spot) => spot.band.hi)) };
  const needText = heightText(need);
  const said = `Height: it is picked up at ${cite(pick)} and put down at ${cite(place)}, so the hand must work at ${needText}`
    + `${need.hi === 0 ? "" : " above the floor"}.`;
  const decided = (outcome: Outcome, text: string): Checked =>
    ({ check: { key: "reach", measure: "height", outcome, estimated, basis, text, need: needText, has }, headroom: null });
  const above = top === null ? undefined : spots.find((spot) => spot.band.lo > top);
  if (above) return decided("fail", `${said} The spot ${above.words} is ${heightText(above.band)}. ${HEIGHT_TOO_HIGH} ${hand}`);
  const below = bottom === null ? undefined : spots.find((spot) => spot.band.hi < bottom);
  if (below) return decided("fail", `${said} The spot ${below.words} is ${heightText(below.band)}. ${HEIGHT_TOO_LOW} ${hand}`);
  const spans = (top !== null && need.hi > top) || (bottom !== null && need.lo < bottom);
  if (spans) return decided("unknown", `${said} ${hand} ${estimated ? HEIGHT_SPANS_VIDEO : HEIGHT_SPANS_SITE}`);
  if (bottom === null) return decided("unknown", `${said} ${hand} ${HEIGHT_ONLY_TOP}`);
  if (top === null) return decided("unknown", `${said} ${hand} ${HEIGHT_ONLY_BOTTOM}`);
  return decided("pass", `${said} ${hand}`);
}

function payloadCheck(model: SpecModel, job: Job, toolMass: number | null): Checked {
  const payload = figureValue(model, "rated_payload_kg");
  const fixed = model.body_type === "fixed_arm";
  const noun = fixed ? "This arm" : "This robot";
  if (payload === null) return { check: unknownCheck("payload", "Payload: the maker publishes no rated payload for this robot."), headroom: null };
  const mass = job.facts.mass;
  if (!mass || !job.mass) {
    return { check: unknownCheck("payload", `Payload: we don't know yet how heavy your object is. ${noun} is rated for ${kgText(payload)}.`, kgText(payload)),
      headroom: null };
  }
  const tool = fixed ? toolMass ?? 0 : 0;
  // A lighter gripper may be fitted, so only the object's own weight can rule a model out.
  const need = { lo: job.mass.lo, hi: job.mass.hi + tool };
  const gripper = fixed && tool > 0 ? `, plus about ${kgText(tool)} for a standard gripper` : "";
  // The total is said in the rating's own precision, so the sentence never reads against its outcome.
  const needText = Number.isFinite(need.hi) ? kgRange(need) : null;
  const carry = needText ? `, so it must carry ${needText}` : "";
  const outcome = within(need, payload);
  // An unknown says why it is unknown, so its figures never read as a pass or a fail. The gripper's weight is
  // added at the heavy end only, so a single weight the site gave can straddle the rating too.
  const text = `Payload: your object weighs ${cite(mass)}${gripper}${carry}. ${noun} is rated for ${kgText(payload)}.`
    + (outcome === "unknown" ? ` ${job.massEstimated ? SPANS_VIDEO_PAYLOAD : SPANS_SITE_PAYLOAD}` : "");
  return {
    check: { key: "payload", outcome, estimated: job.massEstimated, basis: mass.source as AnswerBasis, text, need: needText, has: kgText(payload) },
    headroom: Number.isFinite(need.hi) ? (payload - need.hi) / payload : -1,
  };
}

function cycleCheck(model: SpecModel, job: Job): AnswerCheck | null {
  if (job.cycleTarget === null) return null;
  const target = `Cycle time: you want one cycle in ${secondsText(job.cycleTarget)} (${sourceLabel("site_stated")}).`;
  const speed = figureValue(model, "max_tcp_speed_m_s");
  if (speed === null || speed <= 0) return unknownCheck("cycle_time", `${target} The maker publishes no top speed for this robot.`);
  if (!job.span) return unknownCheck("cycle_time", `${target} We don't know yet how far apart your two spots are.`);
  const need = {
    lo: (2 * job.span.lo) / speed,
    hi: (2 * (job.span.hi + CYCLE_EXTRA_PATH_M)) / (CYCLE_SLOW_FRACTION * speed) + CYCLE_ALLOWANCE_S,
  };
  const outcome = within(need, job.cycleTarget);
  return { key: "cycle_time", outcome, estimated: job.spanEstimated, basis: spanBasis(job),
    text: `${target} With a published top speed of ${figure(speed)} m/s and your spots ${job.spanText}, a cycle takes between about ${secondsText(need.lo)} and ${secondsText(need.hi)} on paper.`
      + (outcome === "unknown" ? ` ${SPANS_CYCLE}` : ""),
    // The job asks for one cycle in its target; on paper the robot takes this long.
    need: secondsText(job.cycleTarget), has: `about ${secondsText(need.lo)}–${secondsText(need.hi)}` };
}

type SceneRow = PublicRobotFit["models"][number];

/** The measured scene's row for this model, matched by maker and name. */
function sceneRowOf(robotFit: SceneRobotFit | undefined, model: SpecModel): SceneRow | null {
  const rows = Array.isArray(robotFit?.models) ? robotFit!.models : [];
  return rows.find((entry) => isRecord(entry) && typeof entry.name === "string" && typeof entry.manufacturer === "string"
    && sameRobot(entry, model)) ?? null;
}

/** Checks in the scene that are about where the arm can stand and what it can reach. */
const SCENE_GEOMETRY_CHECKS = new Set(["reach", "stance", "access"]);

/**
 * The reach check from the measured scene, or null when the scene does not decide it. The scene measures
 * geometry; it knows nothing better about weight, so a scene "doesn't fit" decides reach only when this
 * composer's own payload check passes (and, when the row lists what failed, a geometry check is among them).
 */
function sceneReach(row: SceneRow | null, model: SpecModel, payload: AnswerCheck): AnswerCheck | null {
  if (!row) return null;
  const reach = figureValue(model, "max_reach_m");
  const figureText = reach !== null ? ` It reaches ${specLength(reach)}.` : "";
  const open = Array.isArray(row.openChecks) ? row.openChecks : [];
  // The scene decides reach by where the arm can stand, not by a distance: there is no figure for the job's side.
  const scene = (outcome: AnswerCheck["outcome"], text: string): AnswerCheck =>
    ({ key: "reach", measure: "distance", outcome, estimated: false, basis: "scene_measured", text: `${text}${figureText}`, need: null,
      has: reach !== null ? specLength(reach) : null });
  switch (row.verdict) {
    case "fits":
      return scene("pass", "Reach: checked in the scene rebuilt from your video: this robot reaches both spots with a clear arm path.");
    case "fits_spec":
      return scene("pass", "Reach: sized in the scene rebuilt from your video: both spots are within this robot's published reach. Its arm path was not checked.");
    case "doesnt_fit":
      if (payload.outcome !== "pass" || (open.length > 0 && !open.some((check) => SCENE_GEOMETRY_CHECKS.has(check)))) return null;
      return scene("fail", "Reach: ruled out in the scene rebuilt from your video: this robot could not reach both spots from a clear place to stand.");
    case "unknown":
      return open.includes("reach")
        ? scene("unknown", "Reach: the scene rebuilt from your video could not settle whether this robot reaches both spots.")
        : null;
    default:
      return null;
  }
}

/**
 * Each check takes its outcome from the best source for its own quantity, in the order of trust:
 * site-measured or site-stated, then the scene measured from the video, then the video estimate.
 * Payload is always this composer's check on the best weight. Reach is the scene's when the scene has the
 * model and the site gave no distance of its own; otherwise this composer's. The verdict comes only from the
 * combined checks; nothing is copied over them.
 */
function rateModel(model: SpecModel, job: Job, catalog: RobotSpecCatalog, robotFit: SceneRobotFit | undefined,
  evidence: AnswerEvidence[]): Rated {
  const toolLength = figureValue(catalog.default_tool, "length_m");
  const toolMass = figureValue(catalog.default_tool, "mass_kg");
  const payload = payloadCheck(model, job, toolMass);
  const own = reachCheck(model, job, toolLength);
  const siteSpan = Boolean(job.span && job.facts.distance && !job.spanEstimated
    && (job.facts.distance.source === "site_measured" || job.facts.distance.source === "site_stated"));
  const sceneSays = sceneReach(sceneRowOf(robotFit, model), model, payload.check);
  const fromScene = siteSpan ? null : sceneSays;
  const reach: Checked = fromScene ? { check: fromScene, headroom: null } : own;
  const cycle = cycleCheck(model, job);
  const checks = [reach.check, payload.check, ...(cycle ? [cycle] : [])];
  const failed = checks.find((entry) => entry.outcome === "fail") ?? null;
  const sceneFits = fromScene?.outcome === "pass" && sceneRowOf(robotFit, model)?.verdict === "fits";
  const verdict: AnswerVerdict = failed ? "ruled_out"
    : checks.every((entry) => entry.outcome === "pass") ? (sceneFits ? "fits" : "fits_on_paper") : "possible";
  const headroom = Math.max(-1, Math.min(HEADROOM_CAP, reach.headroom ?? 0, payload.headroom ?? 0));
  const margins = [[reach.check, reach.headroom], [payload.check, payload.headroom]] as const;
  // A height check (a robot that moves) never counts as a comfortable margin: a hand-height range has no margin figure.
  // Every other check counts as before: no headroom figure (a reach the scene passed, an unknown) is not held against it.
  const comfortable = margins.every(([check, room]) => check.measure !== "height" && (room === null || room >= COMFORTABLE_HEADROOM));
  const tight = new Set(margins.filter(([check, room]) => check.outcome === "pass" && room !== null && room < COMFORTABLE_HEADROOM)
    .map(([check]) => check.key));
  return {
    model, verdict, checks, evidence, headroom, comfortable, tight,
    sceneChecked: fromScene !== null && fromScene.outcome !== "unknown",
    sceneOverruled: siteSpan && sceneSays?.outcome === "fail",
    reason: failed ? { text: failed.text, estimated: failed.estimated } : null,
  };
}

/* ------------------------------------------------------------- ranking */

const VERDICT_RANK: Record<AnswerVerdict, number> = { fits: 3, fits_on_paper: 2, possible: 1, ruled_out: 0 };
const evidenceRank = (rated: Rated) => (rated.evidence[0] ? EVIDENCE_RANK[rated.evidence[0].level] : 0);
/** A source that names the model before one that names only its family. */
const scopeRank = (rated: Rated) => (rated.evidence[0]?.scope === "model" ? 0 : 1);

/** The least machine first: no capability the job does not need. */
function formRank(body: BodyType, job: Job): number {
  const moves = Boolean(job.span && job.span.lo > SCREENING.fixedSpanMaxM);
  const order: BodyType[] = moves ? ["mobile_manipulator", "wheeled_humanoid", "humanoid", "fixed_arm"]
    : ["fixed_arm", "mobile_manipulator", "wheeled_humanoid", "humanoid"];
  return order.indexOf(body);
}

function compareRated(job: Job) {
  return (a: Rated, b: Rated) => VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict]
    // Physical margin predicts a working job better than a document does: a comfortable fit first. Track record is
    // ranked before body type by design, so a moving robot with a stronger cited track record can be named ahead of a
    // fixed arm even on a short carry.
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
  // A robot that moves is checked on its listed working heights: the page links them like the reach.
  const [top, bottom] = [figureValue(model, HAND_HEIGHT_FIGURES.max), figureValue(model, HAND_HEIGHT_FIGURES.min)];
  const heightUrl = figureSource(model, HAND_HEIGHT_FIGURES.max) ?? figureSource(model, HAND_HEIGHT_FIGURES.min);
  if (model.body_type !== "fixed_arm" && (top !== null || bottom !== null) && heightUrl) {
    specs.push({ label: "Working height", display: workingRangeShort(top, bottom), sourceUrl: heightUrl });
  }
  return {
    modelId: model.model_id, name: model.name, manufacturer: model.manufacturer,
    formLabel: model.body_type === "mobile_manipulator" ? MOVING_BASE_ARM_LABEL : ROBOT_FORM_COPY[BODY_FORM[model.body_type]].label,
    verdict: rated.verdict, sceneChecked: rated.sceneChecked, specs, evidence: rated.evidence.slice(0, 2),
    // The pick and the runner-up say when a check passed with little to spare.
    checks: rated.checks.map((check) => (rated.tight.has(check.key) ? { ...check, text: `${check.text}${TIGHT_FIT}` } : check)),
  };
}

const displayName = (model: { manufacturer: string; name: string }) => `${model.manufacturer} ${model.name}`;

/* ------------------------------------------------------------- confidence */

/** Why the sureness is held below its top level: the stored coverage review says the video misses part of the work area. */
export const SURENESS_SCENE_NOT_COVERED = UNKNOWN_SCENE_NOT_COVERED;

function confidenceOf(pick: Rated | null, job: Job, familyLabel: string, kindUnknown: boolean,
  sceneNotCovered: boolean): SiteAnswer["confidence"] {
  const raiseIt: string[] = [];
  if (!job.facts.mass || job.massEstimated) raiseIt.push("Tell us the object's weight.");
  if (!job.facts.distance || job.spanEstimated) raiseIt.push("Tell us how far apart the two spots are.");
  if (!pick) return { level: "low", reasons: ["No robot we checked fits this job on the numbers we have."], raiseIt: [...raiseIt, "A measured scene of your work area."] };
  if (!pick.sceneChecked) raiseIt.push("A measured scene of your work area.");
  raiseIt.push("A pilot at your site.");

  const reasons: string[] = [];
  const estimatedKeys = new Set(pick.checks.filter((entry) => entry.estimated).map((entry) => entry.key));
  // A robot that moves is checked on heights, not on the distance between the spots.
  const heightsOnly = pick.checks.some((entry) => entry.key === "reach" && entry.measure === "height" && entry.estimated)
    && !estimatedKeys.has("cycle_time");
  const parts = [estimatedKeys.has("payload") ? "weight" : null,
    estimatedKeys.has("reach") || estimatedKeys.has("cycle_time") ? (heightsOnly ? "heights" : "distances") : null]
    .filter(Boolean);
  if (parts.length) reasons.push(`The ${parts.join(" and ")} ${parts.length > 1 || parts[0] !== "weight" ? "are" : "is"} estimated from your video.`);
  if (pick.verdict === "possible") reasons.push("Some of its checks could not be settled on the numbers we have.");
  if (pick.sceneChecked) reasons.push("Its reach was checked in the scene rebuilt from your video.");
  if (sceneNotCovered) reasons.push(SURENESS_SCENE_NOT_COVERED);
  const top = pick.evidence[0];
  // The source's own words for the family, with "family" added only when they do not already say what it is.
  const familyWords = top?.family && /\b(series|family|line)$/i.test(top.family.trim()) ? top.family.trim() : `${top?.family} family`;
  const subject = top?.scope === "family" && top.family ? `robots in the ${familyWords}` : "this robot";
  if (!top) reasons.push("We found no documented use of this robot on this kind of job.");
  else if (top.level === "production") reasons.push(`We found documented production use of ${subject} for ${familyLabel}.`);
  else if (top.level === "pilot") reasons.push(`We found a documented pilot of ${subject} for ${familyLabel}.`);
  else reasons.push(`We found ${subject} offered for ${familyLabel}, with no named customer.`);

  const fits = pick.verdict === "fits" || pick.verdict === "fits_on_paper";
  // "Good" rests on no estimate and no unknown: every check passed on the site's or the scene's numbers.
  const settled = pick.checks.every((entry) => entry.outcome === "pass" && !entry.estimated);
  // Nor on an unknown kind of job: then only a carry was checked.
  // Nor on a video that misses part of the work area.
  const level = fits && settled && !kindUnknown && !sceneNotCovered && top?.level === "production" ? "good"
    : fits && ((top && EVIDENCE_RANK[top.level] >= EVIDENCE_RANK.pilot) || pick.sceneChecked) ? "fair" : "low";
  return { level, reasons, raiseIt };
}

/* ------------------------------------------------------------- unknowns */

/** The stored coverage review says the video does not show the whole work area (only its yes or no is read). */
function sceneNotCovered(request: Record<string, any> | null | undefined): boolean {
  const coverage = isRecord(request?.capture_coverage) ? request!.capture_coverage : null;
  return coverage?.covers_scene === false;
}

function unknownsOf(inputs: RobotFitInputs, job: Job): string[] {
  const estimates = videoEvidence(inputs)?.estimates ?? null;
  // Only the stored review's yes or no; the reviewer's own words about what is missing are never shown.
  const unknowns = [...(sceneNotCovered(inputs.request) ? [UNKNOWN_SCENE_NOT_COVERED] : []),
    "Whether there is floor space for the robot between the two spots."];
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

/** Whether the job's listing record is on, as stored (it may still be hidden: see `sharing`). */
function jobCardListed(request: Record<string, any>): boolean {
  return isRecord(request.public_task_listing) && request.public_task_listing.enabled === true;
}

/** Why a shared job is not in front of companies yet, as opposed to held: the video check or the job sentence. */
const PREPARING_REASONS = new Set<string>(["privacy_screen_pending", "no_job_sentence", "not_listed"]);

/**
 * Where the job stands with deployment companies (2026-11-12, sharing is the service). A job is shared if, and only if,
 * its site accepted recording statement v4 or later and its listing record was written (`jobSharedListing.ts`):
 * - `visible`: the one predicate that decides what an approved company can see (`teamJobAccess`) lists it;
 * - `preparing`: shared, and not in front of companies until its video passes the privacy check;
 * - `not_visible`: shared, but held (Blueprint's hold, a rights hold, the site closed it);
 * - `not_shared`: never shared. `olderStatement` says the site agreed to an older statement and its page offers v4.
 * The date is when the site accepted the statement that shares the job.
 */
export function jobSharingOf(request: Record<string, any>,
  /** The whole rule's answer (`loadCompanyJobAccess`), when the caller read it; else the record-only rule. */
  wholeAccess?: { listed: boolean; reason: string | null }): JobSharing {
  if (!jobIsShared(request)) {
    const older = isRecord(request.request) && request.request.buyerType === "site_operator"
      && hasCurrentRecordingConsent(request.request.consent_attestation) && !projectWebsiteCaptureRights(request).consent_revoked;
    return older ? { state: "not_shared", sharedAtIso: null, olderStatement: true } : { state: "not_shared", sharedAtIso: null };
  }
  const listing = request.public_task_listing as Record<string, unknown>;
  const sharedAtIso = text(listing.approvedAtIso) ?? text(listing.wentLiveIso);
  const access = wholeAccess ?? teamJobAccess(request);
  if (access.listed) return { state: "visible", sharedAtIso };
  return { state: access.reason && PREPARING_REASONS.has(access.reason) ? "preparing" : "not_visible", sharedAtIso };
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
  // The job's own sentences, read only to say whether the job has more than one step.
  const success = isRecord(brief?.successCriteria) ? text(brief!.successCriteria.successDefinition) : null;
  const jobSentences = [summary, success].filter((entry): entry is string => Boolean(entry));
  const scope = scopeOf(fitInputs, jobSentences);
  const family = scope.family;
  const familyLabel = JOB_FAMILY_LABELS[family];

  const answerFacts: SiteAnswer["facts"] = known.map((entry) => ({ label: entry.label, display: entry.display, basis: entry.source as AnswerBasis }));
  if (job.cycleTarget !== null) answerFacts.push({ label: "Your target cycle time", display: secondsText(job.cycleTarget), basis: "site_stated" });

  const makers = new Set(catalog.models.map((model) => model.manufacturer));
  const base = {
    schemaVersion: SITE_ANSWER_SCHEMA,
    // The kind of job is stated only when the reader judged it a carrying kind. Otherwise nobody did: the
    // evidence is still looked up for pick and place, since picking up and putting down is what is checked.
    job: { sentence: summary, drafted, family: scope.readerJudged ? family : null, familyLabel: scope.readerJudged ? familyLabel : null },
    facts: answerFacts,
    pick: null, runnerUp: null, alsoFit: [], ruledOut: [], ruledOutMore: 0, formNote: null, sceneNote: null as string | null, approach: null,
    unknowns: [] as string[],
    confidence: { level: "low" as const, reasons: [] as string[], raiseIt: [] as string[] },
    nextStep: { kind: "none" as const, text: "" },
    reason: null as string | null,
    note: SITE_ANSWER_NOTE,
    checked: { models: catalog.models.length, makers: makers.size, specsRetrievedOn: catalog.retrieved_on },
    introductionRequestedAtIso: introductionAt(request),
    jobCardListed: jobCardListed(request),
    sharing: jobSharingOf(request),
  };
  const basis = {
    facts: known.map(({ key, display, source, min, max }) => ({ key, display, source, min, max })),
    people: facts.people?.value ?? null, cycleTarget: job.cycleTarget, summary, drafted, family,
    scope: isRecord(request.site_task_scope) ? { supported: request.site_task_scope.supported ?? null,
      kind: request.site_task_scope.kind ?? null, reason: request.site_task_scope.reason ?? null } : null,
    videoReceived: Boolean(inputs.videoReceived), catalog: catalog.retrieved_on,
    reader: { jobKind: videoEvidence(fitInputs)?.estimates?.jobKind ?? null, otherActions: scope.otherActions },
  };
  const finish = (answer: Omit<SiteAnswer, "basisDigest">, extra: Record<string, unknown> = {}): SiteAnswer =>
    ({ ...answer, basisDigest: digestOf({ ...basis, state: answer.state, ...extra }) });

  if (scope.otherKind) return finish({ ...base, state: "cannot_assess", headline: HEADLINE_CANNOT, reason: reasonOtherKind(scope.otherActions) });
  if (!coverageDone(request, fitInputs) && !siteNumbers) return finish({ ...base, state: "reading", headline: HEADLINE_READING });
  if (!facts.distance && !facts.mass && !facts.size) {
    if (!coverageDone(request, fitInputs)) return finish({ ...base, state: "reading", headline: HEADLINE_READING });
    return finish({ ...base, state: "cannot_assess", headline: HEADLINE_CANNOT, reason: REASON_UNSIZED });
  }

  const rated = catalog.models.map((model) => {
    let evidence: AnswerEvidence[] = [];
    try { evidence = lookup(model.model_id, family) ?? []; } catch { evidence = []; }
    return rateModel(model, job, catalog, inputs.robotFit, Array.isArray(evidence) ? evidence : []);
  });
  const candidates = rated.filter((entry) => entry.verdict !== "ruled_out").sort(compareRated(job));
  const ruled = rated.filter((entry) => entry.verdict === "ruled_out");
  const pick = candidates[0] ?? null;
  const runnerUp = pick ? candidates.slice(1).find((entry) => entry.model.manufacturer !== pick.model.manufacturer) ?? candidates[1] ?? null : null;
  const alsoFit = candidates.filter((entry) => entry !== pick && entry !== runnerUp && (entry.verdict === "fits" || entry.verdict === "fits_on_paper"))
    .slice(0, 6).map(({ model }) => ({ name: model.name, manufacturer: model.manufacturer }));
  const ruledOut = ruled.slice(0, 8).map(({ model, reason }) => ({ name: model.name, manufacturer: model.manufacturer,
    // A robot is ruled out only by a failed check, and that check's sentence is the reason.
    reason: reason!.text, estimated: reason!.estimated }));

  const headline = !pick ? `None of the ${catalog.models.length} robots we checked fits this job on the numbers we have.`
    : pick.verdict === "possible" ? `No robot clearly fits. The closest is ${displayName(pick.model)}.`
      : `Most likely to fit: ${displayName(pick.model)}.`;
  // Said only while no arm that stays in one place passed its reach check (the measured scene can show one does).
  const fixedArmReaches = rated.some((entry) => entry.model.body_type === "fixed_arm"
    && entry.checks.some((check) => check.key === "reach" && check.outcome === "pass"));
  const formNote = job.span && job.span.lo > SCREENING.fixedSpanMaxM && job.spanText && !fixedArmReaches
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
    // Decided here once, so the page, the card and the emails say the same.
    sceneNote: pick && pick.sceneOverruled && pick.verdict !== "ruled_out" ? sceneOutrankedNote(pick.model.name) : null,
    approach: approachOf(fitInputs, request, pick),
    unknowns: [...(scope.kindUnknown ? [UNKNOWN_JOB_KIND] : []), ...unknownsOf(fitInputs, job),
      ...(scope.otherActions.length ? [alsoInvolves(scope.otherActions)] : []),
      ...(scope.multiStep ? [UNKNOWN_MULTI_STEP] : [])],
    confidence: confidenceOf(pick, job, familyLabel, scope.kindUnknown, sceneNotCovered(request)),
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

/**
 * The scene's robot table the job page's status read uses, for a caller that has none (the job card, the emails),
 * so every surface composes from the same inputs and says the same. Null when the job has no scene preparation or
 * it cannot be read; never fails the answer.
 */
async function sceneRobotFitFor(requestId: string, request: Record<string, any> | null): Promise<SceneRobotFit> {
  try {
    const [{ siteWalkthroughIdentity }, { dbAdmin }] = await Promise.all([import("./siteWalkthrough"), import("../../client/src/lib/firebaseAdmin")]);
    const { captureId } = siteWalkthroughIdentity(requestId, request ?? undefined);
    if (!dbAdmin || request?.captureRights?.consent_revoked) return null;
    const session = await dbAdmin.collection("captureUploadSessions").doc(captureId).get();
    if (!session.data()?.website_preparation) return null;
    const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
    const status = await loadCurrentWebsitePreparationStatus(requestId, captureId);
    return status.robotFit ?? null;
  } catch {
    return null;
  }
}

/** Read the job's documents (only those the caller has not passed) and compose its answer. */
export async function loadSiteAnswer(requestId: string, options: LoadSiteAnswerOptions = {}): Promise<SiteAnswer | null> {
  if (options.request === undefined || options.brief === undefined) {
    const loaded = await loadRobotFitInputs(requestId);
    const robotFit = options.robotFit !== undefined ? options.robotFit ?? null : await sceneRobotFitFor(requestId, loaded.request);
    return composeSiteAnswer({ ...loaded, robotFit, videoReceived: options.videoReceived ?? requestShowsVideo(loaded.request) });
  }
  const robotFit = options.robotFit !== undefined ? options.robotFit ?? null : await sceneRobotFitFor(requestId, options.request ?? null);
  const request = options.request ?? null;
  // The one read a caller holding the request and the brief still needs: the site's own readings.
  const measurements = await getMeasurements(requestId);
  return composeSiteAnswer({ request, brief: options.brief ?? null, measurements, robotFit,
    videoReceived: options.videoReceived ?? requestShowsVideo(request) });
}
