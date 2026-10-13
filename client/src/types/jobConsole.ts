/**
 * The job console's shared contract: per-job facts, the loop stages, and what
 * the admin API returns. Pure types and constants, read by the server's
 * derivation (`server/utils/jobConsoleStage.ts`) and the admin page.
 */

/** `review_pending`: Blueprint's brief review of new evidence is queued. */
export type BriefState = "none" | "draft" | "review_pending" | "confirmed";
export type CaptureState =
  | "none"
  /** A walkthrough exists; coverage has not been measured. */
  | "uploaded"
  | "coverage_short"
  | "covered"
  | "scene_ready"
  | "scene_failed";
export type ListingState = "none" | "hidden" | "review_required" | "live" | "paused";
export type RecommendationState = "none" | "recommended" | "review_required";
export type BookingState = "none" | "booked" | "awaiting_coordination" | "scheduled";
export type WithdrawalState =
  | "none" | "requested" | "cleanup_pending" | "legal_hold" | "external_pending" | "complete";

export interface PendingAdmission {
  /** The evaluation request's own inboundRequests id; the admit endpoint takes this. */
  requestId: string;
  teamName: string | null;
  setupName: string | null;
}

export interface BestRunSummary {
  runId: string;
  teamId: string;
  teamName: string | null;
  episodesRun: number;
  episodesSucceeded: number;
  /** Percent, 0–100, rounded to two places. */
  successRatePct: number | null;
  medianCycleSeconds: number | null;
  /** Against the site's own targets. Null when the site set none. Development simulation only. */
  meetsTarget: boolean | null;
}

export interface JobFacts {
  requestId: string;
  createdAtIso: string | null;
  siteName: string;
  siteLocation: string;
  company: string;
  claimed: boolean;
  archived: boolean;
  brief: { state: BriefState; unresolvedGates: number };
  capture: { state: CaptureState; missingViews: string[] };
  listing: { state: ListingState };
  evaluations: {
    total: number;
    pendingAdmission: number;
    admitted: number;
    pending: PendingAdmission[];
  };
  runs: {
    queued: number;
    running: number;
    /** Concluded with observed episodes. */
    reported: number;
    /** Concluded with no observation: blocked, or zero episodes. */
    noResult: number;
    /** Reported runs that met the site's targets. */
    passing: number;
    /** Reported runs that missed the site's targets. */
    belowTarget: number;
    /** Reported runs with no target to compare against. */
    untargeted: number;
    best: BestRunSummary | null;
  };
  recommendation: {
    state: RecommendationState;
    recommendationId: string | null;
    teamId: string | null;
    teamName: string | null;
    evaluationRunId: string | null;
  };
  booking: { state: BookingState; startsAt: string | null };
  withdrawal: { state: WithdrawalState };
  /** Written by a separate notice lane when present; read defensively. */
  opsNotice: { state: string; summary: string | null } | null;
  lastActivityIso: string | null;
}

export const JOB_STAGES = [
  "intake",
  "brief_review",
  "capture",
  "listing",
  "awaiting_teams",
  "admission",
  "evaluating",
  "no_passing_run",
  "recommend",
  "recommendation_review",
  "awaiting_booking",
  "coordination",
  "scheduled",
  "withdrawn",
  "closed",
] as const;
export type JobStage = typeof JOB_STAGES[number];

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  intake: "Intake",
  brief_review: "Brief review",
  capture: "Capture",
  listing: "Public card",
  awaiting_teams: "Awaiting teams",
  admission: "Admit evaluation",
  evaluating: "Evaluating",
  no_passing_run: "No passing run",
  recommend: "Recommend",
  recommendation_review: "Recommendation review",
  awaiting_booking: "Awaiting booking",
  coordination: "Schedule pilot",
  scheduled: "Pilot scheduled",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

export type ActionOwner = "blueprint" | "site" | "robot_team" | "none";

export interface JobStageResult {
  stage: JobStage;
  nextAction: string;
  actionOwner: ActionOwner;
  /** Side conditions worth a glance that do not change the stage. */
  attention: string[];
}

export type RunOutcome = "queued" | "running" | "reported" | "no_result";

export interface ProjectedRun {
  runId: string;
  teamId: string;
  teamName: string | null;
  outcome: RunOutcome;
  episodesRun: number | null;
  episodesSucceeded: number | null;
  successRatePct: number | null;
  medianCycleSeconds: number | null;
  meetsTarget: boolean | null;
  evidenceScope: string | null;
  requestedAtIso: string | null;
  reportedAtIso: string | null;
}

export interface TimelineEntry {
  key: string;
  label: string;
  atIso: string | null;
  done: boolean;
}

export type JobConsoleRow = JobFacts & JobStageResult;

export interface JobConsoleListResponse {
  jobs: JobConsoleRow[];
  nextCursor: string | null;
  scanned: number;
  stages: readonly JobStage[];
}

export interface AdmissionCandidate {
  evaluationRequestId: string;
  submittedAtIso: string | null;
  admitted: boolean;
  handoff: { runId: string; executionRequestId: string | null; approvedBy: string | null } | null;
  ownerUid: string | null;
  team: { teamId: string; name: string; status: string | null } | null;
  setup: { setupId: string; name: string | null; reference: string | null; missing: boolean };
  /** Checkpoints of the team whose reference equals the setup's: what admission will accept. */
  matchingCheckpoints: Array<{ checkpointId: string; label: string; runtime: string; status: string }>;
  /** Why this request cannot be admitted yet, in the founder's terms. Empty when it can. */
  blockers: string[];
}

export interface AdmissionDefaults {
  episodes: number;
  sponsorCapUsd: number;
  maxSponsorCapUsd: number;
  reservationTtlMs: number;
  maxAttempts: 1;
  evidenceScope: "development_only";
}

export interface JobConsoleDetail {
  job: JobConsoleRow;
  timeline: TimelineEntry[];
  runs: ProjectedRun[];
  admissions: AdmissionCandidate[];
  admissionDefaults: AdmissionDefaults;
  links: { lead: string; recommendation: string };
}
