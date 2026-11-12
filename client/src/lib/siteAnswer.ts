/**
 * The site's answer: which robot most likely fits its job, the runner-up, what
 * was ruled out, how sure, and one next step.
 *
 * Owner direction, 2026-11-11. The answer leads the job page. It is a fit check
 * against published robot specifications and a cited track record, read from
 * the site's video and its own numbers. It is not a test of a robot at the
 * site and never certifies performance or safety. Simulation, where it ran, is
 * one more line of evidence below it.
 *
 * The server composes it on every read (`server/utils/siteAnswer.ts`); the
 * owner's job page shows it (`client/src/components/site/SiteAnswer.tsx`).
 * Design: docs/superpowers/specs/2026-11-11-site-answer-design.md.
 */

import type { SiteCompanyActivity } from "./companyResponses";

export const SITE_ANSWER_SCHEMA = "site_answer.v1" as const;

/** The kind of job, which keys the deployment evidence. */
export const JOB_FAMILIES = ["pick_place", "palletizing", "machine_tending"] as const;
export type JobFamily = (typeof JOB_FAMILIES)[number];

export const JOB_FAMILY_LABELS: Readonly<Record<JobFamily, string>> = {
  pick_place: "pick and place",
  palletizing: "palletizing",
  machine_tending: "machine tending",
};

/** Where a number came from, in the order of trust. */
export type AnswerBasis = "site_measured" | "site_stated" | "video_observed" | "video_estimate" | "scene_measured";

export interface AnswerCheck {
  key: "reach" | "payload" | "cycle_time";
  outcome: "pass" | "fail" | "unknown";
  /** One plain sentence naming the site's number, where it came from, and the robot's number. */
  text: string;
  /** The check rests on an estimate from the video. */
  estimated: boolean;
  /**
   * Where the site's side of the check came from: the best source for this check's own quantity
   * (the site's measurement or statement, the scene rebuilt from its video, or the video reading).
   * Null when the check could not be made for lack of that quantity or of the robot's figure.
   */
  basis: AnswerBasis | null;
  /**
   * What the job asks of the robot, as the check's own sentence says it ("about 64–93 cm",
   * "about 3–4.9 kg", "30 s"). Absent on older answers; null when the check has no such figure
   * (a reach decided in the scene, or a quantity the job does not give).
   */
  need?: string | null;
  /**
   * The robot's side, as the sentence says it: its published reach or rated payload ("1.3 m",
   * "12.5 kg"), or how long a cycle takes on paper ("1.2–31 s"). Absent on older answers; null
   * when the maker publishes no figure.
   */
  has?: string | null;
  /**
   * What a `reach` check measured: the distance between the spots (an arm that stays in one place) or how
   * high and how low the hand goes (a robot that moves between the spots). Absent on older answers and on
   * other checks.
   */
  measure?: "distance" | "height";
}

export const EVIDENCE_LEVELS = ["production", "pilot", "offered"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LEVEL_LABELS: Readonly<Record<EvidenceLevel, string>> = {
  production: "In production use",
  pilot: "Piloted with a named customer",
  offered: "Offered for this kind of job",
};

export interface AnswerEvidence {
  level: EvidenceLevel;
  /**
   * What the source names: this exact model, or the robot family it belongs to (`family` says which).
   * A source that names neither is never evidence.
   */
  scope: "model" | "family";
  /** The family the source names, in its own words, when `scope` is "family"; otherwise null. */
  family: string | null;
  /** Blueprint's one-sentence paraphrase. */
  summary: string;
  /** Word for word from the source. */
  quote: string;
  sourceUrl: string;
  sourceTitle: string;
  publisher: string;
  publishedOn: string | null;
}

/** What the source names, as the page says it: "names this model" or "names this robot family (GoFa)". */
export function evidenceScopeLabel(evidence: Pick<AnswerEvidence, "scope" | "family">): string {
  return evidence.scope === "family"
    ? `The source names this robot family${evidence.family ? ` (${evidence.family})` : ""}`
    : "The source names this model";
}

export type AnswerVerdict = "fits" | "fits_on_paper" | "possible" | "ruled_out";

export const ANSWER_VERDICT_LABELS: Readonly<Record<AnswerVerdict, string>> = {
  fits: "Fits, checked in the scene rebuilt from your video",
  fits_on_paper: "Fits on paper",
  possible: "May fit",
  ruled_out: "Ruled out",
};

export interface AnswerRobot {
  modelId: string;
  name: string;
  manufacturer: string;
  /** The robot's build in plain words, such as "One arm that stays in one place". */
  formLabel: string;
  verdict: AnswerVerdict;
  /** The reach check was decided in the scene rebuilt from the site's video. */
  sceneChecked: boolean;
  checks: AnswerCheck[];
  /** Published figures shown beside the pick, each with its source. */
  specs: Array<{ label: string; display: string; sourceUrl: string }>;
  /** For this job family, strongest first, at most two. */
  evidence: AnswerEvidence[];
}

export type AnswerState = "reading" | "ready" | "cannot_assess";
export type AnswerConfidenceLevel = "good" | "fair" | "low";

export const ANSWER_CONFIDENCE_LABELS: Readonly<Record<AnswerConfidenceLevel, string>> = {
  good: "Good",
  fair: "Fair",
  low: "Low",
};

/** The scene's contrary finding beside a verdict that rests on the site's own measurement (`SiteAnswer.sceneNote`). */
export const sceneOutrankedNote = (name: string) =>
  `The simulation of your site found that the ${name} does not fit. This check uses your own measurement instead, which we trust more.`;

/** The standing note under every answer: what the check covers, and what it is not. The email and the job card say it in full. */
export const SITE_ANSWER_NOTE =
  "This checks whether a robot can pick your object up and put it down, against published robot specifications and a cited track record. It is not a test of a robot at your site and does not certify performance or safety.";
/**
 * The limits in one line, at the foot of the emails, chosen by what the email says: our early trial's result, a trial
 * still running, or the first look. Each is true for every state that shows it.
 */
export const LIMITS_TESTED = "Tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
/** While the test runs nothing has been tested yet, so the line says it is being tested. */
export const LIMITS_TESTING = "Being tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
/** While the simulation of the site is being built: nothing has been tested yet. */
export const LIMITS_GETTING_READY = "To be tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
export const LIMITS_PAPER = "A first look on paper, not a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
/** The job page's one limits line, true in every state it has: whatever the page shows, none of it is a test at the site. */
export const LIMITS_JOB_PAGE = "Nothing here is a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";

/** The first look in one sentence, on the job page and in the email that says it is ready (frame of 2026-11-12). */
export function firstLookSentence(pick: Pick<AnswerRobot, "manufacturer" | "name" | "verdict">): string {
  const robot = `${pick.manufacturer} ${pick.name}`;
  return pick.verdict === "fits" || pick.verdict === "fits_on_paper"
    ? `On paper, the robot most likely to fit: ${robot}.` : `On paper, the closest robot: ${robot}. No robot clearly fits.`;
}
/** What the first look rests on, said under it. */
export const FIRST_LOOK_SOURCE = "From published specifications and where it has been used.";
/** The same lines as an approved deployment company reads them on the card, with the full note in the card's details. */
export const JOB_CARD_LIMITS_TESTED = "Tested in a simulation, not at the site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
export const JOB_CARD_LIMITS_TESTING = "Being tested in a simulation, not at the site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";
export const JOB_CARD_LIMITS = "A first look on paper, not a test at the site. Pick-up-and-put-down jobs only. It does not certify performance or safety.";

/** How sure, in words: the one map the job page, the job card and the emails all read. */
export const SURENESS_WORDS: Readonly<Record<AnswerConfidenceLevel, string>> = { low: "Not sure yet", fair: "Fairly sure", good: "Sure" };
/** The same words by number of dots, low to high, for a sureness that comes in steps. */
export const SURENESS_STEPS: ReadonlyArray<{ filled: 1 | 2 | 3; word: string }> = [
  { filled: 1, word: SURENESS_WORDS.low }, { filled: 2, word: SURENESS_WORDS.fair }, { filled: 3, word: SURENESS_WORDS.good }];

/*
 * Sentences the server composes and the page treats specially, kept here so both read the same words.
 * The scope lines change what the answer covers, so the page never folds them away.
 */
/** The reader did not say what is done to the object: said first, so the answer never passes for more than a carry. */
export const UNKNOWN_JOB_KIND = "We could not tell from your video what is done to the object; this checks only whether a robot can pick it up and put it down.";
/** The job's own sentence names more than one step. */
export const UNKNOWN_MULTI_STEP = "Your job has more than one step; this checks one carry.";
/** The start of the line naming what else the reader saw done to the object (from its closed list). */
export const ALSO_INVOLVES_PREFIX = "Your job also involves ";
/** The end of that line. */
export const ALSO_INVOLVES_SUFFIX = "; this checks only the picking up and putting down.";
/** The end of a passed check's sentence when it has little to spare (server/utils/siteAnswer.ts `TIGHT_FIT` says " " + this). */
export const TIGHT_FIT_SENTENCE = "This is a tight fit.";
/** The stored coverage review says the video does not cover the scene. */
export const UNKNOWN_SCENE_NOT_COVERED = "Your video does not show the whole work area.";
/** Why a finished reading gave nothing to size; the answer email keys on it, and the page offers a new video. */
export const REASON_UNSIZED = "The video did not show the job clearly enough for us to size it.";

/** A line of `unknowns` that changes what the answer covers: shown with the answer, never folded away. */
export function isScopeNote(line: string): boolean {
  return line === UNKNOWN_JOB_KIND || line === UNKNOWN_MULTI_STEP
    || (line.startsWith(ALSO_INVOLVES_PREFIX) && line.endsWith(ALSO_INVOLVES_SUFFIX));
}

export interface SiteAnswer {
  schemaVersion: typeof SITE_ANSWER_SCHEMA;
  state: AnswerState;
  /** One sentence: the answer, or why there is none yet. */
  headline: string;
  job: {
    sentence: string | null;
    /** The sentence was drafted from the video and the site has not confirmed it. */
    drafted: boolean;
    family: JobFamily | null;
    familyLabel: string | null;
  };
  /** The site's numbers the answer rests on. */
  facts: Array<{ label: string; display: string; basis: AnswerBasis }>;
  pick: AnswerRobot | null;
  runnerUp: AnswerRobot | null;
  /** Further robots that fit, names only, at most six. */
  alsoFit: Array<{ name: string; manufacturer: string }>;
  /** At most eight, each with the one reason it was ruled out. */
  ruledOut: Array<{ name: string; manufacturer: string; reason: string; estimated: boolean }>;
  /** How many more were ruled out than are listed. */
  ruledOutMore: number;
  /** A note about the kind of robot the job needs, such as one that moves between the spots. */
  formNote: string | null;
  /**
   * The simulation of the site found the pick does not fit on a check the scene decides, but the site gave its own
   * measurement, which outranks the reconstruction (its scale is estimated): the verdict stands and this says both.
   * Absent on answers stored before it existed.
   */
  sceneNote?: string | null;
  /**
   * How the pick would be controlled on this job, reasoned from what the video
   * shows: a programmed application taught once, or camera-guided picking when
   * the objects vary. Never a claim about a named product.
   */
  approach: { kind: "programmed" | "camera_guided"; text: string } | null;
  /** What the video could not tell. */
  unknowns: string[];
  confidence: { level: AnswerConfidenceLevel; reasons: string[]; raiseIt: string[] };
  nextStep: { kind: "introduction" | "none"; text: string };
  /** For `cannot_assess`: why, in one sentence. */
  reason: string | null;
  note: string;
  checked: { models: number; makers: number; specsRetrievedOn: string };
  introductionRequestedAtIso: string | null;
  /** Whether the job card is switched on, as stored (it may still be hidden: see `sharing`). */
  jobCardListed: boolean;
  /**
   * Where the job's summary stands with deployment companies, decided on the server by the same predicate that decides
   * what a company can see (`teamJobAccess`): not shared; shared and visible to approved companies; or shared but not
   * visible right now (the site paused or closed the job, Blueprint stopped showing it to companies, or a rights hold). A site shares on the start form or from its job page.
   */
  sharing: JobSharing;
  /**
   * The approved deployment companies Blueprint sent the job to and what each answered, by alias only
   * (`server/utils/jobCompanies.ts`, `projectSiteCompanyActivity`). Only on the owner's status read; absent elsewhere.
   */
  companies?: SiteCompanyActivity;
  /** sha256 of the inputs the answer was composed from. */
  basisDigest: string;
}

export type JobSharingState = "not_shared" | "visible" | "not_visible";
export interface JobSharing {
  state: JobSharingState;
  sharedAtIso: string | null;
  /**
   * What the shared summary leaves out under the statement the site agreed to (review, 2026-11-12): a site that shared
   * on the start form agreed to the card without the first look; one that pressed the button under statement v1 or v2
   * agreed to the first look only, never a later trial result. Absent on answers composed before it existed.
   */
  leavesOut?: { firstLook: boolean; trialResult: boolean };
}

const isString = (value: unknown): value is string => typeof value === "string";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A cheap shape check for the job page: enough to render, never a full validation. */
export function isSiteAnswer(value: unknown): value is SiteAnswer {
  if (!isRecord(value) || value.schemaVersion !== SITE_ANSWER_SCHEMA) return false;
  return isString(value.headline)
    && (value.state === "reading" || value.state === "ready" || value.state === "cannot_assess")
    && isRecord(value.job) && Array.isArray(value.facts) && Array.isArray(value.alsoFit)
    && Array.isArray(value.ruledOut) && Array.isArray(value.unknowns)
    && isRecord(value.confidence) && isRecord(value.nextStep) && isRecord(value.checked)
    && isRecord(value.sharing) && (value.sharing.state === "not_shared" || value.sharing.state === "visible" || value.sharing.state === "not_visible");
}
