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

/**
 * Why approved robot teams cannot evaluate a job: `teamJobAccess`'s reasons
 * (`server/utils/teamJobAccess.ts`). `jobConsoleFacts.ts` stops compiling if
 * that predicate gains a reason this list does not name.
 */
export type TeamAccessReason =
  | "not_a_site_job"
  | "pipeline_placeholder"
  | "task_not_yet_supported"
  | "not_listed"
  | "kept_private"
  | "restricted_to_named_teams"
  | "operator_paused"
  | "consent_withdrawn"
  | "development_only"
  | "rights_blocked"
  | "rights_needs_review"
  | "recording_consent_missing"
  | "scene_not_runnable";

/**
 * For `scene_not_runnable`: the first runnable-scene condition (`isRunnableTask`)
 * the job is missing, the site's before screening's before the Pipeline's.
 */
export type SceneHold =
  /** The site has not confirmed the brief. */
  | "brief_unconfirmed"
  /** Screening needs a conversation, and the site's written clarification awaits review. */
  | "clarification_review"
  /** Screening needs a conversation, and no written clarification awaits review. */
  | "screening_call"
  /** Screening said not now, so no scene is built. */
  | "not_now"
  /** The brief is confirmed but no screening decision is on file. */
  | "unscreened"
  /** Qualified, but the site has not saved the job to an account and no scene grant is on file; the scene is built only for a claimed site. */
  | "unclaimed"
  /** Qualified, and claimed or granted a scene; the Pipeline has not reported a built scene. */
  | "scene_not_built"
  /** Built, but the Pipeline has not proven an evaluation can run on it. */
  | "scene_not_proven"
  /** Built and proven, but a gate an evaluation needs is unanswered. */
  | "gates_open";

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
  /**
   * The answer every team-facing surface gives (`teamJobAccess` on the stored
   * record): whether approved robot teams can evaluate this job now, and if
   * not, why. The console never invites teams to a job this closes.
   */
  teamAccess: {
    listed: boolean;
    evaluationAvailable: boolean;
    /** Null when teams can evaluate the job. */
    reason: TeamAccessReason | null;
    /** Set only for `scene_not_runnable`; null when no known condition is missing. */
    sceneHold: SceneHold | null;
    /**
     * Set only for `task_not_yet_supported`: the recorded screen's reason
     * (`site_task_scope.reason`). `unclear` waits on the site's one sentence.
     */
    scopeReason?: string | null;
  };
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
    /** Reported runs that meet the pass mark a recommendation is verified against. */
    passing: number;
    /** Reported runs below that pass mark. */
    belowTarget: number;
    /** Reported runs with no target to compare against. */
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
  "not_open",
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
  not_open: "Not open to teams",
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
  /** The job's own count: 200 for a team evaluation, else its offer's. Null before an offer is published. */
  episodes: number | null;
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
