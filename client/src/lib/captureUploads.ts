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
  claim_boundary: {
    capture_accepted: false;
    metric_scale_inherent: false;
    collision_geometry_established: false;
    physical_task_success_established: false;
    comparative_policy_ranking_verdict: "thesis_not_supported";
  };
  created_at_iso: string | null;
  updated_at_iso: string | null;
  error: string | null;
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

export function createCaptureUpload(
  currentUser: FirebaseUser,
  request: CreateCaptureUploadSession,
) {
  return apiRequest<CaptureUploadSession>(currentUser, "/api/capture-uploads", {
    method: "POST",
    body: JSON.stringify(request),
  });
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
