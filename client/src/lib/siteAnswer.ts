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

export const SITE_ANSWER_NOTE =
  "This is a fit check against published robot specifications and a cited track record. It is not a test of a robot at your site and does not certify performance or safety.";

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
  /** Whether the job card is visible to approved deployment companies, as stored. */
  jobCardListed: boolean;
  /** sha256 of the inputs the answer was composed from. */
  basisDigest: string;
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
    && isRecord(value.confidence) && isRecord(value.nextStep) && isRecord(value.checked);
}
