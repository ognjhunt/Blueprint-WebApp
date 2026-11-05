/** Blueprint-owned commercial workflow. It never supplies scientific evaluation verdicts. */
export type PurchaseReadiness = "exploring" | "planning" | "ready_for_proposals" | "unsure";
export interface JobBuyingRequirements {
  jobFrequency: string | null;
  purchaseReadiness: PurchaseReadiness;
  requiredOutput: string | null;
  installationBudget: string | null;
  ongoingBudget: string | null;
  currentProcessCost: string | null;
  targetStartDate: string | null;
}
export interface JobOptionsReview {
  disposition: "options_identified" | "more_information" | "no_suitable_option";
  summary: string;
  nextAction: string;
  reviewedAtIso: string;
  scopeRevision: string;
}
export type MarketplaceJobStage = "job_submitted" | "brief_agreed" | "options_assessed";
export interface JobMarketplaceWorkflow {
  schemaVersion: "job_marketplace.v1";
  jobId?: string;
  revision: string;
  requirements: JobBuyingRequirements;
  briefAgreed: boolean;
  optionsAssessed: boolean;
  reviewRequired: boolean;
  stage: MarketplaceJobStage;
  nextAction: string;
  actionOwner: "site" | "blueprint" | "none";
  review: JobOptionsReview | null;
  evidence?: JobEvidenceSummary[];
  managedEvidence?: JobManagedEvidenceSummary[];
  managedEvidenceUnavailable?: boolean;
  candidateReadiness?: JobCandidateReadiness;
  evidenceContext?: { briefDigest: string; question: string | null; testbedDigest: string | null } | null;
}

/** Factual Pipeline projection. Commercial recommendations remain operator-authored. */
export interface JobEvidenceSummary {
  requestId: string;
  publicationDigest: string | null;
  briefDigest: string;
  current: boolean;
  state: string;
  question: string;
  summary: string;
  nextAction: string;
  limitations: string[];
  runId: string | null;
  decisionDigest: string | null;
  planDigest: string | null;
  testbedDigest: string | null;
  approvedTaskDigest: string | null;
  serviceMessage?: string;
  claims: Array<{ claimId: string; verdict: string; rationale: string }>;
}

/**
 * What a finished job evaluation means for the site (F-03): its estimate, why
 * there is none, or that it is still in progress. One plain sentence each.
 */
export type JobScreeningOutcome = "estimate" | "reference_only" | "held_capability" | "held_unprepared" | "infeasible" | "no_match"
  | "held_setup" | "held_budget" | "held_scene_check" | "awaiting_spend_approval" | "setup_repair" | "superseded";

export interface JobManagedEvidenceSummary {
  runId: string;
  state: string;
  /** A job evaluation's outcome; null while it is still running. Absent on other run kinds. */
  outcome?: JobScreeningOutcome | null;
  current: boolean;
  resultDigest: string | null;
  summary: string;
  /** What the site can read: never an operator instruction. */
  nextAction: string;
  /** Staff only (absent in the site's view): what Blueprint has to do next. */
  opsNextAction?: string;
  limitations: string[];
  href: string;
  /** `budget` is staff only: Blueprint's internal control, absent in the site's view. */
  screening?: { budget?: { limitUsd: string; committedUpperBoundUsd: string; spentUpperBoundUsd: string; reservedUsd: string };
    candidates: Array<{ candidateId: string; name: string; state: string; planned: number; configurationDigest?: string;
    scored: number; succeeded: number; failed: number; void: number; blockers: string[];
    /** Where the success rate likely lies (a Wilson interval, whole percents); only on rows with scored episodes. */
    successRange?: { lowerPercent: number; upperPercent: number; confidencePercent: number };
    executionEvidence?: { execution_evidence_kind: "learned_policy" | "scripted_simulator_state_baseline";
      action_source: "learned_policy" | "scripted_simulator_state"; scripted_rollout_count: number;
      learned_policy_rollout_count: number; scripted_controller_invoked: boolean; candidate_policy_queried: boolean };
    /** Each practice run (episode) with the review videos kept of it; only on completed candidates with kept videos. */
    practiceRuns?: Array<{ number: number; outcome: "success" | "failure" | "void";
      videos: Array<{ videoId: string; camera: string; phase: "run" | "setup_check"; durationSeconds: number | null }> }> }>;
    selection?: JobCandidateSelection };
}

/** The Pipeline's rule-based choice from a finished job evaluation: a simulation estimate, never a physical guarantee. */
export interface JobCandidateSelection {
  status: "chosen" | "no_successful_candidate" | "no_evaluated_candidate";
  selectionDigest: string;
  chosen: null | { candidateId: string; name: string; successRate: number; scored: number; succeeded: number;
    configurationId: string | null; policyRouteId: string | null; deploymentCompanies: string[]; relationship: string | null;
    evidenceUrl: string | null; relatedTeams: string[]; partnerBlockers: string[];
    /** Staff only (empty in the site's view): registry teams whose recorded name matches a company or related team. */
    registryTeams: Array<{ id: string; name: string }> };
  tiedWith: string[];
  candidates: Array<{ candidateId: string; resultRank: number | null; choiceBlocker: string | null }>;
}

/** Preparation inventory only. Compatibility and task outcomes have not been evaluated. */
export type JobCandidateReadiness = {state: "unavailable"; message: string} | {
  state: "available"; revision: string; catalogCandidateCount: number;
  candidates: Array<{candidateId: string; configurationDigest: string; name: string; compatibility: "not_evaluated";
    kind: "learned_policy" | "scripted_baseline"; notes: string[]}>;
};
