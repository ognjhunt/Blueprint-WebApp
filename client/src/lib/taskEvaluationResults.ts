import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";

import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { RigidTaskSuccessContract } from "@/lib/rigidTaskSuccessContract";

export type TaskEvaluationResultArtifact = {
  artifact_id: string;
  role: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
  media_type?: string;
  retention_status?: "retained" | "expires" | "expired" | "not_reported";
  retention_expires_at_iso?: string | null;
  access_mode?: "authenticated_ticket" | "inline" | "restricted" | "not_reported";
};

export type TaskEvaluationResultEpisode = {
  episode_id: string;
  episode_kind: "control" | "learned_candidate";
  subject_id: string;
  policy_candidate_id?: string | null;
  policy_checkpoint_digest?: string | null;
  robot_preset_id?: string;
  runtime_identity?: string;
  score: {
    status: string;
    outcome?: unknown;
    task_succeeded?: boolean | null;
    grader_authority: string;
    progress_score?: number | null;
    destination_error?: number | null;
    contact_maintenance_rate?: number | null;
    collision?: boolean | null;
    policy_outcome_interpretable?: boolean;
  };
  variation?: {
    cell_id: string;
    family_id: string;
    label?: string;
    partition?: "qualification" | "held_out" | string;
    seed?: number;
  };
  metrics?: {
    contact_count?: number | null;
    duration_seconds?: number | null;
    intervention_count?: number | null;
  };
  failure?: {
    code: string;
    phase?: string;
    summary?: string;
  } | null;
  evidence?: {
    complete?: boolean;
    lossless_policy_inputs_complete?: boolean;
    frame_manifest_digest?: string;
    review_video_digest?: string;
    deterministic_non_policy_grader?: boolean;
    lossless_policy_inputs?: TaskEvaluationResultArtifact | null;
    frame_manifest?: TaskEvaluationResultArtifact | null;
    videos?: Record<string, TaskEvaluationResultArtifact>;
    typed_media_gap?: { code: string; explanation: string } | null;
    episode_json?: TaskEvaluationResultArtifact | null;
    indexed_mcap_rosbag?: TaskEvaluationResultArtifact | null;
  };
  action_delivery?: {
    actions_reached_robot: boolean;
    arm_moved: boolean;
    returned_action_sequence?: TaskEvaluationResultArtifact | null;
    delivery_readback?: TaskEvaluationResultArtifact | null;
    harness_failure_code?: string | null;
  };
  traces?: {
    state?: TaskEvaluationResultArtifact | null;
    contact_force?: TaskEvaluationResultArtifact | null;
    task_object_trajectory?: TaskEvaluationResultArtifact | null;
  };
  timing?: {
    started_at_iso: string;
    completed_at_iso: string;
    duration_seconds: number;
  };
  timeline?: Array<{
    time_seconds: number;
    action: string | null;
    joint_pose: string | null;
    task_object_pose: string | null;
    contact_state: string | null;
    force_newtons: number | null;
    scoring_state: string | null;
  }>;
  telemetry?: {
    policy_query_count: number | null;
    policy_latency_ms: { p50: number | null; p95: number | null; maximum: number | null };
    gpu_utilization_percent: number | null;
    gpu_memory_bytes: number | null;
    cpu_utilization_percent: number | null;
    memory_bytes: number | null;
    network_received_bytes: number | null;
    network_transmitted_bytes: number | null;
    disk_read_bytes: number | null;
    disk_written_bytes: number | null;
  };
  video_timebase_offsets_seconds?: Record<string, number>;
  corrected_score?: PolicyCanaryCorrectedScore;
  interpretation?: {
    status: "completed" | "abstained";
    abstention_reason: string | null;
    episode_outcome: "appears_complete" | "appears_incomplete" | "unclear";
    summary: string;
    events: Array<Record<string, unknown>>;
    possible_missed_events: Array<Record<string, unknown>>;
    contract_considerations: string[];
    confidence: number;
    deterministic_agreement: "agrees" | "disagrees" | "abstains";
    receipt: TaskEvaluationResultArtifact;
    learned_interpretation_only: true;
    authoritative_task_success_unchanged: true;
    ranking_or_promotion_effect: "none";
  } | null;
  artifacts?: {
    receipt: TaskEvaluationResultArtifact;
    frame_manifest: TaskEvaluationResultArtifact;
    videos: Record<"external" | "wrist" | "overview", TaskEvaluationResultArtifact>;
  };
};

export type PolicyCanaryCorrectedScore = {
  status?: string;
  outcome?: string;
  task_succeeded?: boolean;
  criteria_satisfied?: Record<string, boolean>;
  failed_criteria?: string[];
  failure_reason_plain_english?: string | null;
  measurements?: Record<string, unknown>;
  task_success_contract?: Record<string, any>;
  task_success_contract_digest?: string;
  event_ledger?: {
    drop_events?: Array<Record<string, any>>;
    peak_task_contact_force_n?: number | null;
    observed_contact_classes?: string[];
    observed_forbidden_contact_classes?: string[];
    containment_excursion_steps?: number[];
    workspace_excursion_steps?: number[];
    maximum_retries_observed?: number | null;
    maximum_regrasps_observed?: number | null;
    required_readback_gaps?: string[];
  };
  report_digest?: string;
  [key: string]: unknown;
};

export type PolicyCanaryScoreCorrectionSidecar = {
  schema_version: "task_evaluation_policy_canary_score_correction_sidecar.v1";
  correction: {
    schema_version: "task_evaluation_policy_canary_score_correction.v1";
    correction_id: string;
    correction_digest: string;
    source_run_id: string;
    source_result_status: "completed_unqualified";
    corrected_result_status: "completed_unqualified";
    episode_count: 20;
    score_updates: Array<{
      candidate_id: string;
      cell_id: string;
      seed: number;
      old_score_digest: string;
      new_score_digest: string;
      new_score: PolicyCanaryCorrectedScore;
    }>;
    [key: string]: unknown;
  };
  source_binding: {
    source_projection_digest: string;
    source_delivery_digest: string;
    [key: string]: unknown;
  };
  audit: {
    original_publication_preserved: true;
    original_score_receipts_preserved: true;
    corrected_result_status: "completed_unqualified";
    winner_declared: false;
    [key: string]: unknown;
  };
  sidecar_digest: string;
};

export type PolicyCanaryEpisodeInterpretationSidecar = {
  schema_version: "task_evaluation_policy_canary_episode_interpretation_sidecar.v1";
  source_binding: {
    record_id: string;
    source_run_id: string;
    source_projection_digest: string;
    source_delivery_digest: string;
    source_score_correction_sidecar_digest: string | null;
  };
  summary: Record<string, unknown> & {
    schema_version: "policy_canary_episode_interpretation_closeout.v1";
    status: "completed" | "partial" | "abstained";
    episode_count: number;
    receipt_count: number;
    completed_count: number;
    abstained_count: number;
  };
  episodes: Array<{
    episode_id: string;
    candidate_id: "pi05_droid" | "groot_n17_droid";
    cell_id: string;
    seed: number;
    interpretation: NonNullable<TaskEvaluationResultEpisode["interpretation"]>;
  }>;
  audit: {
    original_publication_preserved: true;
    deterministic_scores_unchanged: true;
    learned_interpretation_only: true;
    ranking_or_promotion_effect: "none";
    verified_at_iso: string;
  };
  sidecar_digest: string;
};

export type TaskEvaluationResultDelivery = {
  schema_version: "task_evaluation_result_delivery.v1" | "task_evaluation_result_delivery.v2";
  run_id: string;
  state?: "decided" | "partially_decided" | "abstained";
  result_status?: "completed_unqualified" | "blocked" | "cancelled";
  status: "ready" | "blocked";
  claim_class?: "development_only" | "evaluation";
  claim_ceiling?: "diagnostic_policy_execution";
  decision_envelope_digest?: string;
  episode_evidence_index_digest?: string;
  stages: Array<{
    stage: "validate" | "seal" | "project" | "package" | "publish";
    status: "complete" | "ready" | "blocked" | "waiting";
  }>;
  blockers: string[];
  summary: {
    episode_count: number;
    learned_candidate_episode_count: number;
    control_episode_count: number;
    successful_episode_count: number;
    interpretable_episode_count?: number;
  };
  episodes: TaskEvaluationResultEpisode[];
  artifacts: TaskEvaluationResultArtifact[];
  proof_boundary: {
    review_video_is_authoritative_evidence: false;
    simulation_is_physical_success: false;
    cross_team_leaderboard_authorized: false;
  };
  delivery_digest: string;
  matrix_digest?: string | null;
  candidate_results?: Array<{
    candidate_id: string;
    display_name: string;
    checkpoint_digest: string;
    episodes_completed: number;
    interpretable_episode_count: number;
    success_count: number;
    success_rate: number | null;
    progress_score: number | null;
    mean_destination_error: number | null;
    contact_maintenance_rate: number | null;
    collision_rate: number | null;
    action_delivery_rate: number;
  }>;
  reproducibility?: {
    scene_id?: string;
    task_id?: string;
    robot_preset_id?: string;
    scene_revision_digest?: string;
    runtime_container_digest?: string;
    scoring_version?: string;
    observation_schema_id?: string;
    action_schema_id?: string;
    calibration_digest?: string;
    timebase?: { clock_id: string; frequency_hz: number | null; synchronized: boolean };
    evidence_manifest?: TaskEvaluationResultArtifact;
    billing_receipt?: TaskEvaluationResultArtifact;
    teardown_receipt?: TaskEvaluationResultArtifact;
    provider_zero_receipt?: TaskEvaluationResultArtifact;
  };
};

export type TaskEvaluationResultSiteRecord = {
  schema_version: "task_evaluation_result_site_record.v1";
  record_id: string;
  organization_id: string;
  access_visibility: "owner_only" | "organization_members" | "unlisted_public";
  created_at_iso?: string;
  updated_at_iso?: string;
  publication: {
    schema_version: "task_evaluation_run_publication.v1" | "task_evaluation_run_publication.v2" | "task_evaluation_run_publication.v3" | "task_evaluation_run_publication.v4";
    run_id: string;
    state?: "decided" | "partially_decided" | "abstained";
    testbed_digest?: string;
    run_kind?: "internal_policy_canary";
    claim_ceiling?: "diagnostic_policy_execution";
    result_status?: "completed_unqualified" | "blocked" | "cancelled";
    scene_controls_status?: "configured_controls_pending";
    warning?: string;
    source_launch_id?: string;
    offering_digest?: string;
    request_digest?: string;
    configuration_digest?: string;
    scene?: { id: string; revision_digest: string };
    task?: { id: string; label: string };
    robot?: { preset_id: string; display_name: string };
    policy_candidates?: Array<{ candidate_id: string; display_name: string; checkpoint_digest: string }>;
    submitted_by?: { actor_id: string; actor_role: string };
    team_namespace?: string;
    access_visibility?: "owner_only" | "organization_members" | "unlisted_public";
    started_at_iso?: string;
    completed_at_iso?: string;
    duration_seconds?: number;
    notification_delivery?: {
      status: "pending" | "accepted" | "delivered" | "failed";
      provider: string | null;
      message_id: string | null;
      attempts: number;
      accepted_at_iso?: string | null;
      delivered_at_iso: string | null;
      failure_reason: string | null;
      receipt?: TaskEvaluationResultArtifact | null;
    };
    decision_envelope?: Record<string, any> & {
      decision_question: string;
      decision_envelope_digest: string;
      overall_outcome: "decision" | "partial_decision" | "abstention";
      per_claim_verdicts: Array<Record<string, any>>;
      unsupported_conditions: string[];
      next_cheapest_experiment: string;
    };
    result_delivery?: TaskEvaluationResultDelivery;
    policy_canary_result?: Record<string, any> & {
      task_success_contract?: RigidTaskSuccessContract;
    };
    proof_boundary: Record<string, unknown>;
  };
  score_correction?: PolicyCanaryScoreCorrectionSidecar;
  episode_interpretation?: PolicyCanaryEpisodeInterpretationSidecar;
  score_correction_audit?: {
    schema_version: "task_evaluation_policy_canary_score_correction_audit.v1";
    current_correction_sequence: number;
    current_correction_digest: string;
    current_scoring_version_digest: string;
    current_sidecar_digest: string;
    history: Array<{
      correction_sequence: number;
      correction_digest: string;
      scoring_version_digest: string;
      sidecar_digest: string;
    }>;
    history_digest: string;
    history_projection_digest: string;
  };
};

export class TaskEvaluationArtifactTicketError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, options: {
    status: number;
    retryAfterSeconds: number | null;
  }) {
    super(message);
    this.name = "TaskEvaluationArtifactTicketError";
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

type TaskEvaluationResultList = {
  scope: "owner" | "organization" | "blueprint_operations";
  public_leaderboard: false;
  results: TaskEvaluationResultSiteRecord[];
};

async function authenticatedFetch(currentUser: FirebaseUser, path: string) {
  return fetch(path, {
    credentials: "include",
    headers: await withFirebaseAuthHeaders(currentUser),
  });
}

async function fetchResults(currentUser: FirebaseUser): Promise<TaskEvaluationResultList> {
  const response = await authenticatedFetch(currentUser, "/api/task-evaluation-results");
  if (!response.ok) throw new Error(`Failed to load sealed results (${response.status})`);
  return response.json() as Promise<TaskEvaluationResultList>;
}

async function fetchResult(currentUser: FirebaseUser | null, recordId: string) {
  const response = await fetch(
    `/api/task-evaluation-results/${encodeURIComponent(recordId)}`,
    {
      credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load sealed result (${response.status})`);
  return response.json() as Promise<TaskEvaluationResultSiteRecord>;
}

export async function createTaskEvaluationResultArtifactTicket(
  currentUser: FirebaseUser | null,
  recordId: string,
  artifactId: string,
) {
  const response = await fetch(
    `/api/task-evaluation-results/${encodeURIComponent(recordId)}/artifacts/${encodeURIComponent(artifactId)}/ticket`,
    {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        currentUser,
        await withCsrfHeader({ "Content-Type": "application/json" }),
      ),
      body: "{}",
    },
  );
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.ceil(retryAfter)
      : null;
    const message = response.status === 429
      ? `Playback is temporarily rate-limited.${retryAfterSeconds
        ? ` Retry in ${retryAfterSeconds} seconds.`
        : " Please retry shortly."}`
      : `Failed to authorize result artifact (${response.status})`;
    throw new TaskEvaluationArtifactTicketError(message, {
      status: response.status,
      retryAfterSeconds,
    });
  }
  const ticket = await response.json() as { download_url: string };
  return ticket.download_url;
}

export function useTaskEvaluationResults() {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["task-evaluation-results", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser && !loading),
    queryFn: () => fetchResults(currentUser!),
    staleTime: 30_000,
  });
  return useMemo(() => ({
    results: query.data?.results || [],
    scope: query.data?.scope || null,
    isLoading: loading || query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  }), [loading, query.data, query.error, query.isLoading]);
}

export function useTaskEvaluationResult(recordId: string) {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["task-evaluation-result", currentUser?.uid || "anonymous", recordId],
    enabled: Boolean(!loading && recordId),
    queryFn: () => fetchResult(currentUser, recordId),
    staleTime: 30_000,
  });
  return {
    result: query.data || null,
    notFound: query.isFetched && query.data === null,
    isLoading: loading || query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    currentUser,
  };
}

export function humanBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
