import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

export type WebCaptureAuthorityProfile =
  | "camera_360_equirectangular"
  | "camera_360_native"
  | "monocular_video";

export type CaptureUploadSession = {
  schema_version: "capture_upload_session.v1";
  session_id: string;
  intake_id: string;
  status: string;
  upload_status: string;
  capture_authority_profile: WebCaptureAuthorityProfile;
  source_type: WebCaptureAuthorityProfile;
  scene_id: string;
  original_filename: string;
  size_bytes: number;
  media_type: string;
  part_size_bytes: number;
  expected_part_count: number;
  uploaded_parts: Array<{
    partNumber: number;
    contentLength: number;
    contentSha1: string;
  }>;
  storage_uri: string | null;
  upload_validation: { status: string; [key: string]: unknown };
  malware_content_validation: { status: string; [key: string]: unknown };
  content_addressing: { status: string; [key: string]: unknown };
  pipeline_handoff: {
    status: string;
    performed: boolean;
    required?: boolean;
    blocker?: string | null;
    [key: string]: unknown;
  };
  completed_capture_lifecycle: CompletedCaptureLifecycleSummary;
  reconstruction: CaptureReconstructionSummary;
  capture_qa?: CaptureQaSummary;
  task_review: {
    status: string;
    candidate_count: number;
    latest_action: string | null;
  };
  site_task_testbed?:
    | { state: "not_available" | "pipeline_artifact_invalid" }
    | {
        state: "testbed_ready";
        testbed_id: string;
        version: string;
        testbed_digest: string;
        lifecycle_state: string;
        artifact_reference: { uri: string; digest: string };
        known_unsupported_conditions: string[];
        request_digest: string | null;
        proof_boundary: Record<string, unknown>;
      };
  task_evaluation_run_control?: TaskEvaluationRunControlSummary;
  task_evaluation_run?:
    | { state: "not_available" | "pipeline_artifact_invalid" }
    | {
        state: "decided" | "partially_decided" | "abstained";
        run_id: string;
        request_digest: string;
        plan_digest: string;
        decision_envelope_digest: string;
        overall_outcome: "decision" | "partial_decision" | "abstention";
        next_cheapest_experiment: string;
        proof_boundary: TaskEvaluationRunProofBoundary;
      };
  claim_boundary: {
    capture_accepted: boolean;
    metric_scale_inherent: false;
    collision_geometry_established: false;
    physical_task_success_established: false;
    comparative_policy_ranking_verdict: "thesis_not_supported";
  };
  created_at_iso: string | null;
  updated_at_iso: string | null;
  error: string | null;
};

export type CompletedCaptureLifecycleSummary = {
  state: "active" | "revocation_in_progress" | "revoked" | string;
  action?: "consent_revoked" | "operator_deletion_request" | string;
  local_payload_deletion_complete?: boolean;
  object_store_deletion_complete?: boolean;
  webapp_access_denied?: boolean;
  external_revocation_complete?: boolean;
  lifecycle_complete: boolean;
  blocker?: string | null;
  updated_at_iso?: string | null;
};

export type CompletedCaptureLifecycleInspection = CompletedCaptureLifecycleSummary & {
  schema_version: "completed_capture_lifecycle_inspection.v1";
  session_id: string;
  intake_id: string;
};

export type ReconstructionAuthorizationCandidate = {
  method_id: string;
  method_profile_digest: string;
  adapter_reference: string;
  execution_authorized: false;
};

export type CaptureReconstructionSummary = {
  state: "not_planned" | "authorization_required" | "authorized" | "completed" | "partial" | "abstained" | string;
  plan_id?: string;
  reconstruction_plan_digest?: string | null;
  authorization_candidates?: ReconstructionAuthorizationCandidate[];
  authorized_adapter_references?: string[];
  result_count?: number;
  missing_representations?: string[];
  next_cheapest_experiments?: string[];
  cost_usd?: number;
  blocker?: string | null;
  proof_boundary?: Record<string, unknown>;
};

export type CaptureQaSummary =
  | { state: "not_available" | "pipeline_artifact_invalid" }
  | {
      state: "capture_accepted" | "validating" | "rejected_or_recapture_required" | "failed";
      status: "accepted" | "analysis_required" | "recapture_required" | "rejected";
      qa_report_digest: string;
      recapture_plan: Array<{ code: string; instruction: string; reason: string }>;
      missing_evidence: string[];
      next_cheapest_experiment: Record<string, unknown> | null;
      proof_boundary: CaptureQaProofBoundary;
    };

export type CaptureQaProofBoundary = {
  qa_is_task_success: false;
  qa_is_physical_success: false;
  deployment_or_safety_approved: false;
  comparative_policy_ranking_verdict: "thesis_not_supported";
};

export type CaptureQaInspection = {
  schema_version: "capture_qa_inspection.v1";
  session_id: string;
  intake_id: string;
  status: "accepted" | "analysis_required" | "recapture_required" | "rejected";
  state: "capture_accepted" | "validating" | "rejected_or_recapture_required" | "failed";
  publication: Record<string, any> & {
    qa_report_digest: string;
    report: Record<string, any> & {
      checks: Array<Record<string, unknown>>;
      recapture_plan: Array<{ code: string; instruction: string; reason: string }>;
      missing_evidence: string[];
      next_cheapest_experiment: Record<string, unknown> | null;
      claim_ceiling: Record<string, unknown>;
    };
  };
};

export type TaskEvaluationRunAuthorizationCandidate = {
  adapter_reference: string;
  method_id: string;
  method_version: string;
  method_profile_digest: string;
  method_family: string;
  expected_cost_usd: number;
  proof_tier: string;
  execution_authorized: false;
};

export type TaskEvaluationRunPreparedControl = {
  state: "authorization_required" | "authorization_failed" | "authorized";
  run_id: string;
  plan_digest: string;
  method_catalog: {
    catalog_id: string;
    version: string;
    catalog_digest: string;
    pipeline_owned: true;
  };
  authorization_candidates: TaskEvaluationRunAuthorizationCandidate[];
  authorization_digest: string | null;
  authorized_adapter_references: string[];
  blocker: string | null;
  proof_boundary: Record<string, unknown>;
};

export type TaskEvaluationRunControlSummary =
  | { state: "not_available" | "pipeline_artifact_invalid" }
  | { state: "planning" | "planning_failed"; run_id: string; blocker: string | null }
  | TaskEvaluationRunPreparedControl;

export type CaptureTaskEvaluationRunPlanReceipt = {
  schema_version: "capture_task_evaluation_run_plan_receipt.v1";
  already_exists: boolean;
  status: "authorization_required";
  run_id: string;
  pipeline_preparation: Record<string, any> & {
    evidence_plan: { plan_digest: string };
    authorization_candidates: TaskEvaluationRunAuthorizationCandidate[];
  };
};

export type CaptureTaskEvaluationRunAuthorizationReceipt = {
  schema_version: "capture_task_evaluation_run_authorization_receipt.v1";
  already_exists: boolean;
  status: "authorized";
  run_id: string;
  plan_digest: string;
  pipeline_authorization: Record<string, any> & {
    authorization_digest: string;
    authorized_adapter_references: string[];
    live_provider_execution: false;
    paid_compute_authorized: false;
    physical_robot_run_authorized: false;
  };
};

export type CaptureTaskEvaluationRunExecutionReceipt = {
  schema_version: "capture_task_evaluation_run_execution_receipt.v1";
  already_exists: boolean;
  status: "decided" | "partially_decided" | "abstained";
  run_id: string;
  decision_envelope_digest: string;
};

export type TaskEvaluationRunProofBoundary = {
  simulation_is_physical_success: false;
  deployment_or_safety_approved: false;
  comparative_policy_ranking_verdict: "thesis_not_supported";
};

export type CaptureTaskEvaluationRunInspection = {
  schema_version: "capture_task_evaluation_run_inspection.v1";
  session_id: string;
  intake_id: string;
  status: "decided" | "partially_decided" | "abstained";
  publication: {
    schema_version: "task_evaluation_run_publication.v1";
    capture_session_id: string;
    intake_id: string;
    run_id: string;
    testbed_digest: string;
    request_digest: string;
    plan_digest: string;
    state: "decided" | "partially_decided" | "abstained";
    evidence_plan: Record<string, any> & {
      plan_digest: string;
      physical_evidence_requests: Array<Record<string, unknown>>;
    };
    decision_envelope: Record<string, any> & {
      decision_envelope_digest: string;
      overall_outcome: "decision" | "partial_decision" | "abstention";
      per_claim_verdicts: Array<{
        claim_id: string;
        claim_type: string;
        verdict: "supported" | "not_supported" | "abstention";
        rationale: string;
        claim_ceiling: Record<string, unknown>;
      }>;
      unsupported_conditions: string[];
      next_cheapest_experiment: string;
      physical_evidence_still_required: Array<Record<string, unknown>>;
      cross_method_disagreements: Array<Record<string, unknown>>;
    };
    proof_boundary: TaskEvaluationRunProofBoundary;
  };
};

export type CaptureSiteTaskTestbedInspection = {
  schema_version: "capture_site_task_testbed_inspection.v1";
  session_id: string;
  intake_id: string;
  status: "testbed_ready";
  artifact_reference: { uri: string; digest: string };
  testbed: Record<string, any> & {
    semantic_object_inventory?: SemanticObjectCandidate[];
  };
  decision_evidence_request: Record<string, any> | null;
  proof_boundary: {
    appearance_is_collision_truth: false;
    generated_completion_is_observed_truth: false;
    simulation_is_physical_success: false;
    deployment_or_safety_approved: false;
    comparative_policy_ranking_verdict: "thesis_not_supported";
  };
};

export type SemanticObjectCandidate = {
  track_id: string;
  label: string;
  semantic_status: "qualified_metric_obb_candidate" | "abstained";
  center_world_m?: [number, number, number] | null;
  dimensions_m?: [number, number, number] | null;
  yaw_rad?: number | null;
  corners_world_m?: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] | null;
  coordinate_frame: string;
  semantic_oriented_box_result_digest: string;
  collision_consistency_status: string;
  collision_validation_result_digest: string | null;
  collision_consistency_metrics: Record<string, unknown>;
  next_experiment?: unknown;
  claim_ceiling?: unknown;
  collision_ready: false;
  physics_ready: false;
};

export type CaptureTestbedCompilationCommand = {
  schema_version: "capture_testbed_compilation_command.v1";
  testbed_id: string;
  version: string;
  robot_binding: {
    robot_id: string;
    embodiment_version: string;
    base_footprint: { shape: "circle"; radius_m: number };
    sensors: Record<string, string>;
    controller_id: string;
    end_effector_id: string;
    reach_envelope: { minimum_m: number; maximum_m: number };
  };
  false_safe_consequence: "low" | "moderate" | "high" | "critical";
  acceptable_false_safe_risk: number;
  minimum_coverage: number;
  minimum_independent_methods: number;
  max_cost_usd: number;
  max_latency_seconds: number;
  deadline: string;
  requested_result_audience: string;
  idempotency_key: string;
};

export type CaptureTestbedCompilationReceipt = {
  schema_version: "capture_testbed_compilation_receipt.v1";
  already_exists: boolean;
  status: "testbed_ready";
  testbed_id: string;
  version: string;
  testbed_digest: string;
  artifact_reference: { uri: string; digest: string };
  request_digest: string | null;
  proof_boundary: CaptureSiteTaskTestbedInspection["proof_boundary"];
};

export type TaskCandidate = {
  task_candidate_id: string;
  candidate_digest: string;
  description: string;
  observed_objects: Array<Record<string, unknown>>;
  target_regions: Array<Record<string, unknown>>;
  required_robot_capabilities: string[];
  likely_task_family: string;
  proposed_measurable_success_condition: {
    metric: string;
    operator: string;
    threshold: unknown;
    units: string;
  };
  required_site_reset: string;
  supporting_frames: string[];
  supporting_3d_regions: string[];
  confidence: number;
  coverage: Record<string, unknown>;
  assumptions: string[];
  missing_evidence: string[];
  prohibited_claims: string[];
  estimated_evaluation_cost_usd: number;
  expected_customer_value: unknown;
  approval_status: "approval_required";
};

export type TaskCandidateDiscovery = {
  schema_version: "task_candidate_discovery.v1";
  discovery_id: string;
  discovery_digest: string;
  source_capture: {
    intake_id: string;
    capture_digest: string;
    capture_authority_profile: string;
  };
  scene_analysis: {
    observed_site_facts: Array<Record<string, unknown>>;
    inferred_objects_and_affordances: Array<Record<string, unknown>>;
    unsupported_or_occluded_regions: Array<Record<string, unknown>>;
    hazards: Array<Record<string, unknown>>;
    privacy_sensitive_areas: Array<Record<string, unknown>>;
  };
  task_candidates: TaskCandidate[];
  approval_state: "task_approval_required" | "no_candidates";
  claim_boundaries: {
    candidate_is_customer_intent: false;
    candidate_is_task_success_evidence: false;
    generated_or_inferred_content_upgrades_capture_authority: false;
  };
};

export type TaskDecisionCommandReceipt = {
  schema_version: "task_candidate_decision_command_receipt.v1";
  command_request_id: string;
  capture_session_id: string;
  discovery_digest: string;
  task_candidate_id: string;
  candidate_digest: string;
  action: "approve" | "edit_and_approve" | "reject" | "request_more_capture";
  rationale: string;
  edited_task: Record<string, unknown> | null;
  pipeline_approval_status:
    | "pending_pipeline_validation"
    | "approved"
    | "rejected"
    | "recapture_requested";
  pipeline_task_decision: Record<string, unknown> | null;
  approved_task_definition: Record<string, unknown> | null;
  decision_evidence_request: null;
  pipeline_result_proof_boundary: Record<string, unknown> | null;
  created_at_iso: string;
};

export type CaptureTaskReview = {
  schema_version: "capture_task_review.v1";
  session_id: string;
  intake_id: string;
  status:
    | "analysis_not_available"
    | "task_approval_required"
    | "no_candidates"
    | "decision_pending_pipeline_validation"
    | "task_approved"
    | "task_rejected"
    | "recapture_requested";
  discovery: TaskCandidateDiscovery | null;
  latest_decision_command: TaskDecisionCommandReceipt | null;
  claim_boundary: {
    webapp_command_is_pipeline_approval: false;
    decision_evidence_request_compiled: false;
    task_success_established: false;
  };
};

export type TaskDecisionCommandRequest = {
  schema_version: "task_candidate_decision_command.v1";
  discovery_digest: string;
  task_candidate_id: string;
  candidate_digest: string;
  action: TaskDecisionCommandReceipt["action"];
  idempotency_key: string;
  rationale: string;
  edited_task: Record<string, unknown> | null;
};

export type CreateCaptureUploadSession = {
  schema_version: "capture_upload_session_request.v1";
  intake_id: string;
  idempotency_key: string;
  capture_authority_profile: WebCaptureAuthorityProfile;
  source_type: WebCaptureAuthorityProfile;
  scene_id: string;
  organization_id?: string;
  original_file: {
    original_filename: string;
    size_bytes: number;
    media_type: string;
  };
  capture_device: Record<string, unknown>;
  timing_declaration: Record<string, unknown>;
  coordinate_frame_declaration: Record<string, unknown>;
  available_sensor_streams: Array<{
    stream_type: string;
    status: "available" | "diagnostic" | "unavailable";
  }>;
  governance: {
    rights: "accepted";
    consent: "accepted" | "not_required";
    privacy: "cleared" | "restricted_local_only";
    retention: Record<string, unknown>;
    revocation: Record<string, unknown>;
    provider_constraints: Record<string, unknown>;
    allowed_uses: string[];
  };
  requested_task_evaluation_run_audience: string;
  known_task_specification?: Record<string, unknown> | null;
  calibration_board_dimensions?: Record<string, unknown> | null;
  operator_notes: string[];
  permitted_reconstruction_providers: string[];
  permitted_evidence_uses: string[];
};

type PartAuthorization = {
  session_id: string;
  part_number: number;
  upload_url: string;
  authorization_token: string;
};

async function apiRequest<T>(
  currentUser: FirebaseUser,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = await withFirebaseAuthHeaders(
    currentUser,
    await withCsrfHeader({
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...((init.headers as Record<string, string> | undefined) || {}),
    }),
  );
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const blockers = Array.isArray(payload.blockers)
      ? ` ${payload.blockers.join(", ")}`
      : "";
    throw new Error(`${String(payload.error || "Capture upload request failed")}.${blockers}`);
  }
  return payload as T;
}

export function listCaptureUploads(currentUser: FirebaseUser) {
  return apiRequest<{ sessions: CaptureUploadSession[] }>(
    currentUser,
    "/api/capture-uploads",
  );
}

export function getCaptureUpload(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureUploadSession>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}`,
  );
}

export function getCaptureTaskReview(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureTaskReview>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-discovery`,
  );
}

export function getCaptureSiteTaskTestbed(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureSiteTaskTestbedInspection>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/testbed`,
  );
}

export function getCaptureQa(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureQaInspection>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/capture-qa`,
  );
}

export function getCaptureTaskEvaluationRun(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureTaskEvaluationRunInspection>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-evaluation-run`,
  );
}

export function planCaptureTaskEvaluationRun(
  currentUser: FirebaseUser,
  sessionId: string,
  idempotencyKey: string,
) {
  return apiRequest<CaptureTaskEvaluationRunPlanReceipt>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-evaluation-runs/plan`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_task_evaluation_run_plan_command.v1",
        idempotency_key: idempotencyKey,
      }),
    },
  );
}

export function authorizeCaptureTaskEvaluationRun(
  currentUser: FirebaseUser,
  sessionId: string,
  runId: string,
  request: {
    plan_digest: string;
    authorized_adapter_references: string[];
    idempotency_key: string;
  },
) {
  return apiRequest<CaptureTaskEvaluationRunAuthorizationReceipt>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-evaluation-runs/${encodeURIComponent(runId)}/authorize`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_task_evaluation_run_authorization_command.v1",
        ...request,
      }),
    },
  );
}

export function executeCaptureTaskEvaluationRun(
  currentUser: FirebaseUser,
  sessionId: string,
  runId: string,
) {
  return apiRequest<CaptureTaskEvaluationRunExecutionReceipt>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-evaluation-runs/${encodeURIComponent(runId)}/execute`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_task_evaluation_run_execution_command.v1",
        idempotency_key: `web-execute-${runId}`,
      }),
    },
  );
}

export function submitTaskDecisionCommand(
  currentUser: FirebaseUser,
  sessionId: string,
  request: TaskDecisionCommandRequest,
) {
  return apiRequest<TaskDecisionCommandReceipt>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/task-decisions`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function createCaptureUpload(
  currentUser: FirebaseUser,
  request: CreateCaptureUploadSession,
) {
  return apiRequest<CaptureUploadSession>(currentUser, "/api/capture-uploads", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function retryCaptureUploadProcessing(
  currentUser: FirebaseUser,
  sessionId: string,
) {
  return apiRequest<CaptureUploadSession>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/process`,
    { method: "POST", body: "{}" },
  );
}

export function applyCompletedCaptureLifecycle(
  currentUser: FirebaseUser,
  sessionId: string,
  action: "consent_revoked" | "operator_deletion_request",
  idempotencyKey: string,
) {
  return apiRequest<CompletedCaptureLifecycleInspection>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/lifecycle`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "completed_capture_lifecycle_command.v1",
        action,
        idempotency_key: idempotencyKey,
      }),
    },
  );
}

export function planCaptureReconstruction(
  currentUser: FirebaseUser,
  sessionId: string,
  requestedClaimTypes: Array<"perception_visibility" | "task_discovery" | "reachability">,
  idempotencyKey: string,
) {
  return apiRequest<Record<string, any>>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/reconstructions/plan`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_reconstruction_plan_command.v1",
        requested_claim_types: requestedClaimTypes,
        idempotency_key: idempotencyKey,
      }),
    },
  );
}

export function compileCaptureTestbed(
  currentUser: FirebaseUser,
  sessionId: string,
  command: CaptureTestbedCompilationCommand,
) {
  return apiRequest<CaptureTestbedCompilationReceipt>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/testbed/compile`,
    { method: "POST", body: JSON.stringify(command) },
  );
}

export function authorizeCaptureReconstruction(
  currentUser: FirebaseUser,
  sessionId: string,
  planId: string,
  request: {
    reconstruction_plan_digest: string;
    authorized_adapter_references: string[];
    idempotency_key: string;
  },
) {
  return apiRequest<Record<string, any>>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/reconstructions/${encodeURIComponent(planId)}/authorize`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_reconstruction_authorization_command.v1",
        ...request,
      }),
    },
  );
}

export function executeCaptureReconstruction(
  currentUser: FirebaseUser,
  sessionId: string,
  planId: string,
  idempotencyKey: string,
) {
  return apiRequest<Record<string, any>>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/reconstructions/${encodeURIComponent(planId)}/execute`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_reconstruction_execution_command.v1",
        idempotency_key: idempotencyKey,
      }),
    },
  );
}

async function authorizePart(
  currentUser: FirebaseUser,
  sessionId: string,
  partNumber: number,
) {
  return apiRequest<PartAuthorization>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}/parts/${partNumber}/authorize`,
    { method: "POST", body: "{}" },
  );
}

async function sha1Hex(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadPart(params: {
  currentUser: FirebaseUser;
  sessionId: string;
  partNumber: number;
  blob: Blob;
  sha1: string;
}) {
  let lastStatus = 0;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const authorization = await authorizePart(
        params.currentUser,
        params.sessionId,
        params.partNumber,
      );
      const response = await fetch(authorization.upload_url, {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: authorization.authorization_token,
          "X-Bz-Part-Number": String(params.partNumber),
          "X-Bz-Content-Sha1": params.sha1,
        },
        body: params.blob,
      });
      if (response.ok) return;
      lastStatus = response.status;
      const transient = response.status === 401 || response.status === 408
        || response.status === 429 || response.status >= 500;
      if (!transient) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
    }
  }
  if (!lastStatus && lastError instanceof Error) {
    throw new Error(`Capture part ${params.partNumber} upload failed (network: ${lastError.message}).`);
  }
  throw new Error(`Capture part ${params.partNumber} upload failed (${lastStatus || "network"}).`);
}

export async function uploadCaptureFile(params: {
  currentUser: FirebaseUser;
  session: CaptureUploadSession;
  file: File;
  onProgress?: (completedParts: number, totalParts: number) => void;
}) {
  if (
    params.file.name !== params.session.original_filename ||
    params.file.size !== params.session.size_bytes
  ) {
    throw new Error("The selected file does not match this resumable upload session.");
  }
  const uploaded = new Map(
    params.session.uploaded_parts.map((part) => [part.partNumber, part.contentSha1]),
  );
  const receipts: string[] = [];
  for (let partNumber = 1; partNumber <= params.session.expected_part_count; partNumber += 1) {
    const start = (partNumber - 1) * params.session.part_size_bytes;
    const end = Math.min(start + params.session.part_size_bytes, params.file.size);
    const blob = params.file.slice(start, end);
    const sha1 = await sha1Hex(blob);
    const storedSha1 = uploaded.get(partNumber);
    if (storedSha1 && storedSha1 !== sha1) {
      throw new Error(`Stored part ${partNumber} does not match the reselected file.`);
    }
    if (!storedSha1) {
      await uploadPart({
        currentUser: params.currentUser,
        sessionId: params.session.session_id,
        partNumber,
        blob,
        sha1,
      });
    }
    receipts.push(sha1);
    params.onProgress?.(partNumber, params.session.expected_part_count);
  }
  return apiRequest<CaptureUploadSession>(
    params.currentUser,
    `/api/capture-uploads/${encodeURIComponent(params.session.session_id)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: "capture_upload_completion_request.v1",
        part_sha1_array: receipts,
      }),
    },
  );
}

export function cancelCaptureUpload(currentUser: FirebaseUser, sessionId: string) {
  return apiRequest<CaptureUploadSession>(
    currentUser,
    `/api/capture-uploads/${encodeURIComponent(sessionId)}`,
    { method: "DELETE", body: "{}" },
  );
}
