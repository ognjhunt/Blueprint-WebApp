/**
 * Robot fit: what a site's job needs from a robot, how every form of robot
 * measures up to it, which researched teams look right for it, and the part
 * a site may see.
 *
 * The forms are the ones a robot team declares for its own robot
 * (`ROBOT_FORMS`, PR #1049): one arm, two arms, an arm on a wheeled base, a
 * wheeled humanoid, a walking humanoid and a legged robot with an arm. Robot
 * fit rates them all against the job's needs. What our simulation can score
 * today never narrows which robots a site hears about.
 *
 * The server computes it (`server/utils/siteRobotFit.ts`); the job console,
 * the pilot proposal review and the owner's job page show it. It shapes whom
 * Blueprint invites to evaluate a job. It is never the basis of a
 * recommendation, which stands on a team's passing evaluation of the job.
 * Design: docs/superpowers/specs/2026-10-20-robot-fit-design.md.
 */
import { ROBOT_FORMS } from "../types/robotEmbodiment";

export type RobotForm = (typeof ROBOT_FORMS)[number];

/** Every declarable form except "other", which has no shape to rate. */
export const RATED_FORMS = ["fixed_base_arm", "bimanual_arm", "mobile_manipulator", "wheeled_humanoid", "humanoid",
  "legged_manipulator"] as const satisfies readonly RobotForm[];
export type RatedForm = (typeof RATED_FORMS)[number];

export interface RobotFormCopy {
  label: string;
  description: string;
  arms: 1 | 2;
  /** How it gets between spots, if at all. */
  moves: "no" | "wheels" | "legs";
}

export const ROBOT_FORM_COPY: Record<RatedForm, RobotFormCopy> = {
  fixed_base_arm: { label: "One arm on a fixed stand", description: "A single robot arm fixed in place at the work area.",
    arms: 1, moves: "no" },
  bimanual_arm: { label: "Two arms on a fixed stand", description: "Two robot arms working together from one fixed spot.",
    arms: 2, moves: "no" },
  mobile_manipulator: { label: "Arm on a wheeled base", description: "A robot arm on a base that drives between spots.",
    arms: 1, moves: "wheels" },
  wheeled_humanoid: { label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.",
    arms: 2, moves: "wheels" },
  humanoid: { label: "Walking humanoid", description: "A human-shaped robot with two arms that walks on two legs.",
    arms: 2, moves: "legs" },
  legged_manipulator: { label: "Legged robot with an arm", description: "A robot that walks on legs, such as four, with an arm on top.",
    arms: 1, moves: "legs" },
};

/** Labels for any form a team may have, including the ones that are not rated. */
export function robotFormLabel(form: RobotForm | "unknown"): string {
  if (form === "other") return "Another kind of robot";
  if (form === "unknown") return "Form not stated";
  return ROBOT_FORM_COPY[form].label;
}

export type FitVerdict = "fits" | "possible" | "not_a_fit";

export const FIT_VERDICT_LABELS: Record<FitVerdict, string> = {
  fits: "Fits",
  possible: "Possible",
  not_a_fit: "Not a fit",
};

export type RequirementKey =
  | "pick_to_place_span"
  | "pick_height"
  | "place_height"
  | "object_mass"
  | "object_size"
  | "people_nearby";

/**
 * Where a requirement came from, in the words the site reads. The site is
 * never asked: most jobs rest on what the video shows and what the video
 * reader estimates from it. Readings the site already gave still come first.
 */
export type RequirementSource = "site_measured" | "site_stated" | "video_observed" | "video_estimate";

export const REQUIREMENT_SOURCE_LABELS: Record<RequirementSource, string> = {
  site_measured: "you measured this",
  site_stated: "you told us",
  video_observed: "seen in your video",
  video_estimate: "estimated from your video",
};

export interface FitRequirement {
  key: RequirementKey;
  /** "How far the object moves". */
  label: string;
  /** The value in the site's own unit or words: "90 cm", "2–10 kg". */
  display: string;
  source: RequirementSource;
}

/** What the rules could not read or estimate: a note for staff, never a question to the site. */
export interface FitUnknown {
  key: RequirementKey;
  label: string;
}

/**
 * `extra` notes a capability the job does not need, such as walking between
 * spots that one place can reach. It never lowers a verdict.
 */
export type CheckOutcome = "pass" | "extra" | "caution" | "fail" | "unknown";

export interface FitCheck {
  requirement: RequirementKey;
  outcome: CheckOutcome;
  /** A sentence for the site, built only from its own data. */
  text: string;
}

export interface RobotFormRating {
  id: RatedForm;
  verdict: FitVerdict;
  checks: FitCheck[];
}

/** The rule-based part, computed on every read so it is never stale. */
export interface RobotFitJob {
  /** False until the job is screened as one rigid object picked up and put down. */
  rated: boolean;
  notRatedReason: string | null;
  /** The brief's one-line job, for staff. */
  summary: string | null;
  /** The instruction the Pipeline derived from the video, for staff. */
  instruction: string | null;
  requirements: FitRequirement[];
  /** What the job needs from any robot, as sentences in the site's own numbers. */
  needs: string[];
  unknowns: FitUnknown[];
  forms: RobotFormRating[];
}

export const TEAM_FITS = ["strong", "possible", "weak"] as const;
export type TeamFit = (typeof TEAM_FITS)[number];

export interface RankedTeamReason {
  /** The model's reading. A person judges it against the quote. */
  claim: string;
  /** Verbatim from one field of the team's research; the server drops any it cannot find. */
  quote: string;
}

export interface RankedTeam {
  teamId: string;
  name: string;
  /** Registry status: `prospect` means researched, with nothing agreed. */
  status: string;
  /** All three supply agreements are on record. */
  agreed: boolean;
  fit: TeamFit;
  form: RobotForm | "unknown";
  reasons: RankedTeamReason[];
  concerns: string[];
}

export interface RobotFitRanking {
  rankedAtIso: string;
  rankedBy: string | null;
  /** Digest of the job and the research notes this ranking read. */
  inputsDigest: string;
  candidateCount: number;
  teams: RankedTeam[];
  /** Reasons dropped because their quote is not in one field of the team's research. */
  droppedReasons: number;
  /** Entries dropped for naming an unknown or repeated team, or keeping no reason. */
  droppedTeams: number;
  provider: string | null;
  model: string | null;
}

/** The latest ranking run, kept apart so a failed run never hides the last good ranking. */
export interface RobotFitAttempt {
  state: "ranked" | "failed";
  atIso: string;
  by: string | null;
  error: string | null;
}

export interface RobotFitSharing {
  shared: boolean;
  changedAtIso: string;
  changedBy: string | null;
}

/** What the owner's job page shows, once shared. Fixed sentences and the site's own data only. */
export interface SiteRobotFit {
  needs: string[];
  forms: Array<{ id: RatedForm; label: string; description: string; verdict: FitVerdict; reasons: string[] }>;
  note: string;
}

export const SITE_ROBOT_FIT_NOTE =
  "Blueprint evaluates candidate robots and policies that look right for this job in a simulation of your site. "
  + "If Blueprint recommends an approach, it will be one that passed a full evaluation on your job. This is a first read from your "
  + "video, not a promise that any robot can do the job.";

export interface AdminRobotFitResponse {
  job: RobotFitJob;
  ranking: (RobotFitRanking & { stale: boolean }) | null;
  lastAttempt: RobotFitAttempt | null;
  sharing: RobotFitSharing | null;
  /** Exactly what the site would see if shared, or null when there is nothing to show. */
  site: SiteRobotFit | null;
  consentRevoked: boolean;
  /** The whole readiness report as the site would see it once shared. */
  readiness: AdminReadinessPreview | null;
}

/** Imported by type only, so this module stays free of the readiness copy. */
export type AdminReadinessPreview = {
  report: import("./siteReadiness").SiteReadinessReport | null;
};

