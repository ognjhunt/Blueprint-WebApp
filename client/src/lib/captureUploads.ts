import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

export type WebCaptureAuthorityProfile =
  | "camera_360_equirectangular"
  | "camera_360_native"
  | "monocular_video"
  | "provided_scene_mesh"
  | "provided_scene_splat";

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
  storage_provider?: "firebase" | "backblaze";
  upload_transport?: "single_file" | "multipart";
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
  cost_usd?: number | null;
  cost_basis?: "actual" | "estimate";
  cost_status?: "unknown";
  cost_reason?: string;
  known_cost_subtotal_usd?: number;
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

export class CaptureUploadRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
}

export async function apiRequest<T>(
  currentUser: FirebaseUser,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = await withFirebaseAuthHeaders(
    currentUser,
    await withCsrfHeader({
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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
    throw new CaptureUploadRequestError(`${String(payload.error || "Capture upload request failed")}.${blockers}`, response.status, String(payload.error || ""));
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
  storageProvider?: "firebase" | "backblaze";
}) {
  let lastStatus = 0;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (params.storageProvider === "firebase") {
        const form = new FormData(); form.append("part", params.blob, "part.bin");
        await apiRequest(params.currentUser,
          `/api/capture-uploads/${encodeURIComponent(params.sessionId)}/parts/${params.partNumber}`,
          {method: "POST", body: form, headers: {"x-blueprint-content-sha1": params.sha1}});
        return;
      }
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
      if (error instanceof CaptureUploadRequestError && error.status < 500
        && ![401, 408, 429].includes(error.status)) throw error;
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
  if (params.session.upload_transport === "single_file" ||
    (params.session.capture_authority_profile.startsWith("provided_scene_") && params.session.size_bytes <= 5*1024*1024)) {
    const form=new FormData();form.append("file",params.file);
    const result=await apiRequest<CaptureUploadSession>(params.currentUser,`/api/capture-uploads/${encodeURIComponent(params.session.session_id)}/file`,{method:"POST",body:form});
    params.onProgress?.(1,1);return result;
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
        storageProvider: params.session.storage_provider,
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
