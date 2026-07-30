import { createHash } from "node:crypto";
import path from "node:path";

import { Router, type Response } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { parseVerifiedCaptureQaPublication } from "../utils/captureQaContract";
import {
  canonicalArtifactDigest,
  parseVerifiedTaskDiscovery,
  stableJson,
  taskDecisionCommandSchema,
} from "../utils/taskCandidateContract";
import {
  nativeDecisionEvidenceRequestSchema,
  parseVerifiedMaintainedSiteTaskTestbed,
} from "../utils/siteTaskTestbedContract";
import {
  parseVerifiedTaskEvaluationRunAuthorization,
  parseVerifiedTaskEvaluationRunPreparation,
  parseVerifiedTaskEvaluationRunPublication,
} from "../utils/taskEvaluationRunContract";
import { forwardTaskCandidateDecisionToPipeline } from "../utils/taskCandidateForwarding";
import {
  captureUploadIntakeForwardingReadiness,
  forwardCaptureUploadToPipeline,
} from "../utils/captureUploadForwarding";
import {
  applyCompletedCaptureLifecycleToPipeline,
  inspectCompletedCaptureLifecycleInPipeline,
  recordCaptureExternalRevocationEvidenceInPipeline,
} from "../utils/captureLifecycleForwarding";
import {
  forwardTaskEvaluationRunAuthorizationToPipeline,
  forwardTaskEvaluationRunExecutionToPipeline,
  forwardTaskEvaluationRunPlanToPipeline,
} from "../utils/taskEvaluationRunForwarding";
import {
  forwardReconstructionAuthorizationToPipeline,
  forwardReconstructionExecutionToPipeline,
  forwardReconstructionPlanToPipeline,
  inspectReconstructionInPipeline,
} from "../utils/reconstructionForwarding";
import {
  authorizeBackblazeCapturePart,
  cancelBackblazeResumableCapture,
  createBackblazeCaptureDownloadGrant,
  deleteBackblazeCaptureFile,
  finishBackblazeResumableCapture,
  getBackblazeCaptureFileInfo,
  listBackblazeCaptureParts,
  resolveStorageProviderName,
  safeStorageFileName,
  startBackblazeResumableCapture,
  type StoredCapturePart,
} from "../utils/storage-provider";

const router = Router();

const MEBIBYTE = 1024 * 1024;
const MIN_RESUMABLE_FILE_BYTES = 5 * MEBIBYTE + 1;
const MAX_CAPTURE_FILE_BYTES = 50 * 1024 * MEBIBYTE;
const MIN_PART_BYTES = 5 * MEBIBYTE;
const DEFAULT_PART_BYTES = 64 * MEBIBYTE;
const MAX_PARTS = 10_000;
const SHA1_PATTERN = /^[0-9a-f]{40}$/;
const PATH_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const webCaptureProfiles = [
  "camera_360_equirectangular",
  "camera_360_native",
  "monocular_video",
] as const;

const streamSchema = z
  .object({
    stream_type: z.string().trim().min(1).max(128),
    status: z.enum(["available", "diagnostic", "unavailable"]),
  })
  .strict();

const sessionRequestSchema = z
  .object({
    schema_version: z.literal("capture_upload_session_request.v1"),
    intake_id: z.string().trim().regex(PATH_IDENTIFIER_PATTERN),
    idempotency_key: z.string().trim().min(8).max(256),
    capture_authority_profile: z.enum(webCaptureProfiles),
    source_type: z.enum(webCaptureProfiles),
    scene_id: z.string().trim().regex(PATH_IDENTIFIER_PATTERN),
    organization_id: z.string().trim().min(1).max(128).optional(),
    original_file: z
      .object({
        original_filename: z.string().trim().min(1).max(255),
        size_bytes: z.number().int().min(MIN_RESUMABLE_FILE_BYTES).max(MAX_CAPTURE_FILE_BYTES),
        media_type: z.string().trim().min(1).max(128),
      })
      .strict(),
    capture_device: z.record(z.string(), z.unknown()).refine(
      (value) => Object.keys(value).length > 0,
      "capture_device must not be empty",
    ),
    timing_declaration: z.record(z.string(), z.unknown()).refine(
      (value) => Object.keys(value).length > 0,
      "timing_declaration must not be empty",
    ),
    coordinate_frame_declaration: z.record(z.string(), z.unknown()).refine(
      (value) => Object.keys(value).length > 0,
      "coordinate_frame_declaration must not be empty",
    ),
    available_sensor_streams: z.array(streamSchema).min(1).max(64),
    governance: z
      .object({
        rights: z.literal("accepted"),
        consent: z.enum(["accepted", "not_required"]),
        privacy: z.enum(["cleared", "restricted_local_only"]),
        retention: z.record(z.string(), z.unknown()).refine(
          (value) => Object.keys(value).length > 0,
          "retention must not be empty",
        ),
        revocation: z.record(z.string(), z.unknown()).refine(
          (value) => Object.keys(value).length > 0,
          "revocation must not be empty",
        ),
        provider_constraints: z.record(z.string(), z.unknown()),
        allowed_uses: z.array(z.string().trim().min(1)).min(1),
      })
      .strict(),
    requested_task_evaluation_run_audience: z.string().trim().min(1).max(128),
    known_task_specification: z.record(z.string(), z.unknown()).nullable().optional(),
    calibration_board_dimensions: z.record(z.string(), z.unknown()).nullable().optional(),
    operator_notes: z.array(z.string().trim().min(1).max(2_000)).max(50).default([]),
    permitted_reconstruction_providers: z.array(z.string().trim().min(1).max(128)).max(50),
    permitted_evidence_uses: z.array(z.string().trim().min(1).max(128)).max(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source_type !== value.capture_authority_profile) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_type"],
        message: "source_type must match capture_authority_profile",
      });
    }
  });

const completionSchema = z
  .object({
    schema_version: z.literal("capture_upload_completion_request.v1"),
    part_sha1_array: z.array(z.string().regex(SHA1_PATTERN)).min(2).max(MAX_PARTS),
  })
  .strict();

const taskEvaluationRunPlanCommandSchema = z.object({
  schema_version: z.literal("capture_task_evaluation_run_plan_command.v1"),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const taskEvaluationRunAuthorizationCommandSchema = z.object({
  schema_version: z.literal("capture_task_evaluation_run_authorization_command.v1"),
  plan_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  authorized_adapter_references: z.array(z.string().trim().min(1).max(512)).max(64),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const taskEvaluationRunExecutionCommandSchema = z.object({
  schema_version: z.literal("capture_task_evaluation_run_execution_command.v1"),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const completedCaptureLifecycleCommandSchema = z.object({
  schema_version: z.literal("completed_capture_lifecycle_command.v1"),
  action: z.enum(["consent_revoked", "operator_deletion_request"]),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const reconstructionClaimTypeSchema = z.enum([
  "perception_visibility",
  "task_discovery",
  "appearance_review",
  "reachability",
  "robot_placement",
  "navigation_clearance",
  "collision_contact",
  "grasp_contact",
  "articulation",
  "containment",
  "mass_inertia",
  "friction_compliance",
  "object_state_transition",
]);

const reconstructionPlanCommandSchema = z.object({
  schema_version: z.literal("capture_reconstruction_plan_command.v1"),
  requested_claim_types: z.array(reconstructionClaimTypeSchema).min(1).max(16),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const reconstructionAuthorizationCommandSchema = z.object({
  schema_version: z.literal("capture_reconstruction_authorization_command.v1"),
  reconstruction_plan_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  authorized_adapter_references: z.array(z.string().trim().min(1).max(512)).min(1).max(16),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

const reconstructionExecutionCommandSchema = z.object({
  schema_version: z.literal("capture_reconstruction_execution_command.v1"),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/),
}).strict();

type SessionRequest = z.infer<typeof sessionRequestSchema>;
type SessionRecord = Record<string, unknown> & {
  session_id: string;
  owner_user_id: string;
  organization_id?: string;
  status: string;
  request_fingerprint_sha256: string;
  request: SessionRequest;
  provider_file_id?: string;
  object_path?: string;
  storage_uri?: string;
  part_size_bytes: number;
  expected_part_count: number;
  pipeline_task_discovery?: unknown;
  latest_task_decision_command?: Record<string, unknown>;
  pipeline_site_task_testbed?: Record<string, unknown>;
  pipeline_task_evaluation_run?: Record<string, unknown>;
  pipeline_task_evaluation_run_plan?: Record<string, unknown>;
  pipeline_capture_qa?: Record<string, unknown>;
  pipeline_capture_intake_receipt?: Record<string, unknown>;
  pipeline_capture_handoff?: Record<string, unknown>;
  pipeline_capture_state?: string;
  completed_capture_lifecycle?: Record<string, any>;
  capture_access?: Record<string, unknown>;
  pipeline_reconstruction?: Record<string, any>;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function authenticatedUser(res: Response) {
  const user = res.locals.firebaseUser as
    | { uid?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  return {
    uid: String(user?.uid || "").trim(),
    tenantId: String(user?.tenantId || user?.tenant_id || "").trim(),
  };
}

function sessionIdFor(uid: string, idempotencyKey: string) {
  return `capture-upload-${sha256Text(`${uid}\u0000${idempotencyKey}`).slice(0, 32)}`;
}

function configuredPartSize(fileSize: number) {
  const configured = Number(process.env.CAPTURE_UPLOAD_PART_SIZE_BYTES || DEFAULT_PART_BYTES);
  const bounded = Number.isInteger(configured) && configured >= MIN_PART_BYTES
    ? configured
    : DEFAULT_PART_BYTES;
  // A B2 large file must contain at least two parts. The first part must be at
  // least 5 MiB; the final part may be smaller.
  return Math.min(bounded, Math.max(MIN_PART_BYTES, Math.ceil(fileSize / 2)));
}

function fileExtensionFor(request: SessionRequest) {
  const original = safeStorageFileName(request.original_file.original_filename);
  const extension = path.extname(original).toLowerCase();
  const allowed = request.capture_authority_profile === "camera_360_native"
    ? new Set([".insv"])
    : new Set([".mp4", ".mov"]);
  return allowed.has(extension) ? extension : null;
}

function mediaTypeAllowed(request: SessionRequest) {
  const value = request.original_file.media_type.toLowerCase();
  if (request.capture_authority_profile === "camera_360_native") {
    return value === "application/octet-stream" || value === "video/x-insta360";
  }
  return value === "video/mp4" || value === "video/quicktime";
}

function requiredStreams(profile: SessionRequest["capture_authority_profile"]) {
  if (profile === "camera_360_equirectangular") {
    return ["retained_video", "camera_metadata"];
  }
  if (profile === "camera_360_native") {
    return ["retained_original", "camera_metadata"];
  }
  return ["retained_video"];
}

function requestBlockers(request: SessionRequest, tenantId: string) {
  const blockers: string[] = [];
  if (!fileExtensionFor(request)) blockers.push("capture_file_extension_not_supported_for_profile");
  if (!mediaTypeAllowed(request)) blockers.push("capture_media_type_not_supported_for_profile");
  if (tenantId && request.organization_id && request.organization_id !== tenantId) {
    blockers.push("organization_identity_mismatch");
  }
  const available = new Set(
    request.available_sensor_streams
      .filter((stream) => stream.status === "available")
      .map((stream) => stream.stream_type),
  );
  for (const stream of requiredStreams(request.capture_authority_profile)) {
    if (!available.has(stream)) blockers.push(`required_stream_missing:${stream}`);
  }
  if (
    request.governance.provider_constraints.external_processing_allowed === false &&
    request.permitted_reconstruction_providers.some(
      (provider) => !["local", "local_only"].includes(provider),
    )
  ) {
    blockers.push("provider_restriction_conflict");
  }
  return blockers.sort();
}

function publicSession(record: SessionRecord, uploadedParts: StoredCapturePart[] = []) {
  const taskReview = taskReviewProjection(record);
  const captureQa = captureQaProjection(record);
  const testbed = siteTaskTestbedProjection(record);
  const taskEvaluationRun = taskEvaluationRunProjection(record);
  const taskEvaluationRunControl = taskEvaluationRunControlProjection(record, testbed);
  return {
    schema_version: "capture_upload_session.v1",
    session_id: record.session_id,
    intake_id: record.request.intake_id,
    status: record.completed_capture_lifecycle?.status
      || captureQa.publication?.state
      || record.pipeline_capture_state
      || record.status,
    upload_status: record.status,
    capture_authority_profile: record.request.capture_authority_profile,
    source_type: record.request.source_type,
    scene_id: record.request.scene_id,
    original_filename: record.request.original_file.original_filename,
    size_bytes: record.request.original_file.size_bytes,
    media_type: record.request.original_file.media_type,
    part_size_bytes: record.part_size_bytes,
    expected_part_count: record.expected_part_count,
    uploaded_parts: uploadedParts,
    storage_uri: record.status === "uploaded_verification_pending" ? record.storage_uri || null : null,
    upload_validation: record.upload_validation || { status: "pending" },
    malware_content_validation: record.malware_content_validation || { status: "pending" },
    content_addressing: record.content_addressing || {
      status: "pending_server_sha256_verification",
    },
    pipeline_handoff: record.pipeline_capture_handoff || {
      status: "not_started",
      performed: false,
    },
    completed_capture_lifecycle: completedCaptureLifecycleProjection(record),
    reconstruction: reconstructionProjection(record),
    capture_qa: captureQa.summary,
    task_review: {
      status: taskReview.status,
      candidate_count: taskReview.candidateCount,
      latest_action: record.latest_task_decision_command?.action || null,
    },
    site_task_testbed: testbed.summary,
    task_evaluation_run_control: taskEvaluationRunControl.summary,
    task_evaluation_run: taskEvaluationRun.summary,
    claim_boundary: {
      capture_accepted: captureQa.publication?.status === "accepted",
      metric_scale_inherent: false,
      collision_geometry_established: false,
      physical_task_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
    created_at_iso: record.created_at_iso || null,
    updated_at_iso: record.updated_at_iso || null,
    error: record.error || null,
  };
}

function completedCaptureLifecycleProjection(record: SessionRecord) {
  const lifecycle = record.completed_capture_lifecycle;
  if (!lifecycle) return { state: "active" as const, lifecycle_complete: false };
  return {
    state: String(lifecycle.status || "revocation_in_progress"),
    action: String(lifecycle.action || ""),
    local_payload_deletion_complete: Boolean(
      lifecycle.pipeline_inspection?.local_payload_deletion_complete
        || lifecycle.pipeline_tombstone?.local_payload_deletion_complete,
    ),
    object_store_deletion_complete: Boolean(lifecycle.storage_deletion_receipt),
    webapp_access_denied: record.capture_access?.serve_allowed === false,
    external_revocation_complete: Boolean(
      lifecycle.pipeline_inspection?.external_revocation_complete,
    ),
    lifecycle_complete: Boolean(lifecycle.pipeline_inspection?.lifecycle_complete),
    blocker: lifecycle.blocker || null,
    updated_at_iso: lifecycle.updated_at_iso || null,
  };
}

function reconstructionProjection(record: SessionRecord) {
  const reconstruction = record.pipeline_reconstruction;
  if (!reconstruction) return { state: "not_planned" as const };
  const plan = reconstruction.pipeline_plan;
  const execution = reconstruction.pipeline_execution;
  return {
    state: String(execution?.state || reconstruction.status || plan?.state || "planning_failed"),
    plan_id: String(plan?.plan_id || reconstruction.plan_id || ""),
    reconstruction_plan_digest: plan?.reconstruction_plan?.reconstruction_plan_digest || null,
    authorization_candidates: plan?.authorization_candidates || [],
    authorized_adapter_references:
      reconstruction.pipeline_authorization?.authorized_adapter_references || [],
    result_count: Array.isArray(execution?.results) ? execution.results.length : 0,
    missing_representations: execution?.missing_representations
      || plan?.reconstruction_plan?.missing_representations?.map(
        (row: Record<string, unknown>) => row.representation,
      )
      || [],
    next_cheapest_experiments: execution?.next_cheapest_experiments
      || plan?.next_cheapest_experiments
      || [],
    cost_usd: execution?.cost_usd ?? plan?.reconstruction_plan?.estimated_cost_usd ?? 0,
    blocker: reconstruction.blocker || null,
    proof_boundary: execution?.proof_boundary || plan?.proof_boundary || {
      derived_reconstruction_upgrades_raw_capture: false,
      physical_task_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
  };
}

async function processCompletedCaptureIntake(record: SessionRecord): Promise<SessionRecord> {
  if (record.pipeline_capture_intake_receipt) return record;
  const readiness = captureUploadIntakeForwardingReadiness();
  if (!readiness.endpointConfigured) {
    const updates = {
      pipeline_capture_handoff: {
        status: "not_configured",
        performed: false,
        required: readiness.required,
        blocker: "capture_upload_intake_forward_url_missing",
      },
      updated_at_iso: new Date().toISOString(),
    };
    await db!.collection("captureUploadSessions").doc(record.session_id).set(updates, { merge: true });
    return { ...record, ...updates };
  }
  if (!readiness.tokenConfigured) {
    const updates = {
      pipeline_capture_handoff: {
        status: "blocked",
        performed: false,
        required: readiness.required,
        blocker: "capture_upload_intake_forward_token_missing",
      },
      updated_at_iso: new Date().toISOString(),
    };
    await db!.collection("captureUploadSessions").doc(record.session_id).set(updates, { merge: true });
    return { ...record, ...updates };
  }
  if (!record.object_path) {
    const updates = {
      pipeline_capture_handoff: {
        status: "blocked",
        performed: false,
        required: readiness.required,
        blocker: "capture_storage_object_path_missing",
      },
      updated_at_iso: new Date().toISOString(),
    };
    await db!.collection("captureUploadSessions").doc(record.session_id).set(updates, { merge: true });
    return { ...record, ...updates };
  }
  let forwardResult;
  try {
    const transfer = await createBackblazeCaptureDownloadGrant({
      objectPath: record.object_path,
    });
    forwardResult = await forwardCaptureUploadToPipeline({
      captureSessionId: record.session_id,
      customerId: record.owner_user_id,
      organizationId: record.organization_id || `user:${record.owner_user_id}`,
      request: record.request,
      transfer,
    });
  } catch (error) {
    forwardResult = {
      status: "failed" as const,
      performed: false,
      required: readiness.required,
      endpoint_configured: true,
      blocker: "capture_upload_transfer_grant_failed",
      error_name: error instanceof Error ? error.name : "UnknownError",
    };
  }
  const handoff = {
    status: forwardResult.status,
    performed: forwardResult.performed,
    required: forwardResult.required,
    endpoint_configured: forwardResult.endpoint_configured,
    http_status: forwardResult.http_status || null,
    blocker: forwardResult.blocker || null,
    error_name: forwardResult.error_name || null,
  };
  const receipt = forwardResult.receipt;
  const captureQa = forwardResult.captureQaPublication;
  const updates = receipt && captureQa
    ? {
        pipeline_capture_handoff: handoff,
        pipeline_capture_intake_receipt: receipt,
        pipeline_capture_qa: captureQa,
        pipeline_capture_state: captureQa.state,
        upload_validation: {
          ...(record.upload_validation as Record<string, unknown>),
          status: "server_bytes_verified",
          server_size_verified: true,
        },
        malware_content_validation: receipt.malware_content_validation,
        content_addressing: {
          status: "passed",
          sha256: receipt.capture_digest,
          envelope_digest: receipt.envelope_digest,
          raw_input_content_addressed: true,
        },
        updated_at_iso: new Date().toISOString(),
      }
    : {
        pipeline_capture_handoff: handoff,
        updated_at_iso: new Date().toISOString(),
      };
  await db!.collection("captureUploadSessions").doc(record.session_id).set(updates, { merge: true });
  return { ...record, ...updates } as SessionRecord;
}

function captureQaProjection(record: SessionRecord) {
  if (!record.pipeline_capture_qa) return {
    summary: { state: "not_available" as const },
    publication: null,
    blockers: [] as string[],
  };
  const verified = parseVerifiedCaptureQaPublication(record.pipeline_capture_qa);
  if (!verified.ok) return {
    summary: { state: "pipeline_artifact_invalid" as const },
    publication: null,
    blockers: verified.blockers,
  };
  const publication = verified.publication;
  const blockers: string[] = [];
  if (publication.capture_session_id !== record.session_id) blockers.push("capture_qa_session_mismatch");
  if (publication.intake_id !== record.request.intake_id) blockers.push("capture_qa_intake_mismatch");
  if (publication.capture_authority_profile !== record.request.capture_authority_profile) {
    blockers.push("capture_qa_profile_mismatch");
  }
  if (blockers.length) return {
    summary: { state: "pipeline_artifact_invalid" as const },
    publication: null,
    blockers: blockers.sort(),
  };
  return {
    summary: {
      state: publication.state,
      status: publication.status,
      qa_report_digest: publication.qa_report_digest,
      recapture_plan: publication.report.recapture_plan,
      missing_evidence: publication.report.missing_evidence,
      next_cheapest_experiment: publication.report.next_cheapest_experiment,
      proof_boundary: publication.proof_boundary,
    },
    publication,
    blockers,
  };
}

function taskEvaluationRunControlProjection(
  record: SessionRecord,
  testbedProjection = siteTaskTestbedProjection(record),
) {
  const stored = record.pipeline_task_evaluation_run_plan as Record<string, any> | undefined;
  if (!stored) return {
    summary: { state: "not_available" as const },
    preparation: null,
    authorization: null,
    blockers: [] as string[],
  };
  if (!stored.pipeline_preparation) return {
    summary: {
      state: stored.status === "planning_failed" ? "planning_failed" as const : "planning" as const,
      run_id: String(stored.run_id || ""),
      blocker: String(stored.pipeline_forward?.blocker || "") || null,
    },
    preparation: null,
    authorization: null,
    blockers: [] as string[],
  };
  if (!testbedProjection.testbed || !testbedProjection.decisionRequest) return {
    summary: { state: "pipeline_artifact_invalid" as const },
    preparation: null,
    authorization: null,
    blockers: ["run_control_testbed_or_request_missing"],
  };
  const verified = parseVerifiedTaskEvaluationRunPreparation({
    value: stored.pipeline_preparation,
    expectedCaptureSessionId: record.session_id,
    expectedIntakeId: record.request.intake_id,
    expectedRunId: String(stored.run_id || ""),
    expectedRequestDigest: testbedProjection.decisionRequest.request_digest,
    expectedTestbed: testbedProjection.testbed,
  });
  if (!verified.ok) return {
    summary: { state: "pipeline_artifact_invalid" as const },
    preparation: null,
    authorization: null,
    blockers: verified.blockers,
  };
  const preparation = verified.preparation;
  const blockers: string[] = [];
  if (
    stored.request_digest !== preparation.request.request_digest ||
    stored.testbed_digest !== preparation.evidence_plan.testbed_digest
  ) blockers.push("run_control_binding_mismatch");
  let authorization: Record<string, any> | null = null;
  if (stored.pipeline_authorization) {
    const verifiedAuthorization = parseVerifiedTaskEvaluationRunAuthorization({
      value: stored.pipeline_authorization,
      expectedRunId: preparation.run_id,
      expectedPlanDigest: preparation.evidence_plan.plan_digest,
      expectedAdapterReferences: stored.pipeline_authorization.authorized_adapter_references || [],
      expectedActorRole: "customer",
      expectedActorIdentity: `firebase:${record.owner_user_id}`,
    });
    if (!verifiedAuthorization.ok) blockers.push(...verifiedAuthorization.blockers);
    else authorization = verifiedAuthorization.authorization;
  }
  if (stored.status === "authorized" && !authorization) {
    blockers.push("run_control_authorization_missing");
  }
  if (blockers.length) return {
    summary: { state: "pipeline_artifact_invalid" as const },
    preparation: null,
    authorization: null,
    blockers: [...new Set(blockers)].sort(),
  };
  return {
    summary: {
      state: stored.status as "authorization_required" | "authorization_failed" | "authorized",
      run_id: preparation.run_id,
      plan_digest: preparation.evidence_plan.plan_digest,
      method_catalog: preparation.method_catalog,
      authorization_candidates: preparation.authorization_candidates,
      authorization_digest: authorization?.authorization_digest || null,
      authorized_adapter_references: authorization?.authorized_adapter_references || [],
      blocker: String(stored.authorization_forward?.blocker || "") || null,
      proof_boundary: preparation.proof_boundary,
    },
    preparation,
    authorization,
    blockers,
  };
}

function taskEvaluationRunProjection(record: SessionRecord) {
  const stored = record.pipeline_task_evaluation_run;
  if (!stored) {
    return {
      summary: { state: "not_available" as const },
      publication: null,
      blockers: [] as string[],
    };
  }
  const parsed = parseVerifiedTaskEvaluationRunPublication(stored.publication);
  if (!parsed.ok) {
    return {
      summary: { state: "pipeline_artifact_invalid" as const },
      publication: null,
      blockers: parsed.blockers,
    };
  }
  const publication = parsed.publication;
  const blockers: string[] = [];
  if (publication.capture_session_id !== record.session_id) blockers.push("run_capture_session_mismatch");
  if (publication.intake_id !== record.request.intake_id) blockers.push("run_intake_mismatch");
  const testbedDigest = (record.pipeline_site_task_testbed as { testbed_digest?: unknown } | undefined)?.testbed_digest;
  if (publication.testbed_digest !== testbedDigest) blockers.push("run_testbed_mismatch");
  if (blockers.length) {
    return {
      summary: { state: "pipeline_artifact_invalid" as const },
      publication: null,
      blockers: blockers.sort(),
    };
  }
  return {
    summary: {
      state: publication.state,
      run_id: publication.run_id,
      request_digest: publication.request_digest,
      plan_digest: publication.plan_digest,
      decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
      overall_outcome: publication.decision_envelope.overall_outcome,
      next_cheapest_experiment: publication.decision_envelope.next_cheapest_experiment,
      proof_boundary: publication.proof_boundary,
    },
    publication,
    blockers,
  };
}

function siteTaskTestbedProjection(record: SessionRecord) {
  const stored = record.pipeline_site_task_testbed;
  if (!stored) {
    return {
      summary: { state: "not_available" as const },
      testbed: null,
      decisionRequest: null,
      blockers: [] as string[],
    };
  }
  const parsed = parseVerifiedMaintainedSiteTaskTestbed(stored.testbed);
  if (!parsed.ok) {
    return {
      summary: { state: "pipeline_artifact_invalid" as const },
      testbed: null,
      decisionRequest: null,
      blockers: parsed.blockers,
    };
  }
  const testbed = parsed.testbed;
  const blockers: string[] = [];
  const requestResult = nativeDecisionEvidenceRequestSchema.safeParse(
    stored.decision_evidence_request,
  );
  const decisionRequest = requestResult.success ? requestResult.data : null;
  if (stored.decision_evidence_request && !requestResult.success) {
    blockers.push("decision_evidence_request_schema_invalid");
  }
  if (stored.intake_id !== record.request.intake_id) blockers.push("testbed_intake_mismatch");
  if (stored.testbed_id !== testbed.testbed_id) blockers.push("testbed_id_mismatch");
  if (stored.version !== testbed.version) blockers.push("testbed_version_mismatch");
  if (stored.testbed_digest !== testbed.testbed_digest) blockers.push("testbed_digest_mismatch");
  if (stored.approved_task_digest !== testbed.approved_task_definition.digest) {
    blockers.push("testbed_approved_task_mismatch");
  }
  if (decisionRequest && (
    canonicalArtifactDigest(decisionRequest, "request_digest") !== decisionRequest.request_digest ||
    decisionRequest.testbed_id !== testbed.testbed_id ||
    decisionRequest.testbed_version !== testbed.version ||
    decisionRequest.testbed_digest !== testbed.testbed_digest
  )) {
    blockers.push("decision_evidence_request_binding_invalid");
  }
  const authoritativeApproved = record.approved_task_definition as
    | { approved_task_digest?: unknown }
    | undefined;
  if (
    authoritativeApproved?.approved_task_digest &&
    authoritativeApproved.approved_task_digest !== testbed.approved_task_definition.digest
  ) {
    blockers.push("testbed_authoritative_task_mismatch");
  }
  const sourceMatches = testbed.source_capture_bundles.filter(
    (bundle) => bundle.bundle_id === record.request.intake_id,
  );
  if (sourceMatches.length !== 1) blockers.push("testbed_source_capture_mismatch");
  if (blockers.length) {
    return {
      summary: { state: "pipeline_artifact_invalid" as const },
      testbed: null,
      decisionRequest: null,
      blockers: blockers.sort(),
    };
  }
  return {
    summary: {
      state: "testbed_ready" as const,
      testbed_id: testbed.testbed_id,
      version: testbed.version,
      testbed_digest: testbed.testbed_digest,
      lifecycle_state: testbed.lifecycle_state,
      artifact_reference: {
        uri: `testbed://${testbed.testbed_id}/${testbed.version}/${testbed.testbed_digest.slice(7)}.json`,
        digest: testbed.testbed_digest,
      },
      known_unsupported_conditions: testbed.known_unsupported_conditions,
      request_digest: decisionRequest?.request_digest || null,
      proof_boundary: testbed.proof_boundary,
    },
    testbed,
    decisionRequest,
    blockers,
  };
}

function taskReviewProjection(record: SessionRecord) {
  if (!record.pipeline_task_discovery) {
    return {
      status: "analysis_not_available" as const,
      candidateCount: 0,
      discovery: null,
      blockers: [] as string[],
    };
  }
  const parsed = parseVerifiedTaskDiscovery(record.pipeline_task_discovery);
  if (!parsed.ok) {
    return {
      status: "pipeline_artifact_invalid" as const,
      candidateCount: 0,
      discovery: null,
      blockers: parsed.blockers,
    };
  }
  const blockers: string[] = [];
  if (parsed.discovery.source_capture.intake_id !== record.request.intake_id) {
    blockers.push("task_discovery_intake_mismatch");
  }
  const contentAddressing = record.content_addressing as
    | { status?: unknown; sha256?: unknown }
    | undefined;
  if (
    contentAddressing?.status === "verified" &&
    contentAddressing.sha256 &&
    contentAddressing.sha256 !== parsed.discovery.source_capture.capture_digest
  ) {
    blockers.push("task_discovery_capture_digest_mismatch");
  }
  if (blockers.length) {
    return {
      status: "pipeline_artifact_invalid" as const,
      candidateCount: 0,
      discovery: null,
      blockers,
    };
  }
  return {
    status: record.latest_task_decision_command?.pipeline_approval_status ===
      "pending_pipeline_validation"
      ? "decision_pending_pipeline_validation" as const
      : record.latest_task_decision_command?.pipeline_approval_status === "approved"
        ? "task_approved" as const
        : record.latest_task_decision_command?.pipeline_approval_status === "rejected"
          ? "task_rejected" as const
          : record.latest_task_decision_command?.pipeline_approval_status ===
              "recapture_requested"
            ? "recapture_requested" as const
      : parsed.discovery.approval_state === "task_approval_required"
        ? "task_approval_required" as const
        : "no_candidates" as const,
    candidateCount: parsed.discovery.task_candidates.length,
    discovery: parsed.discovery,
    blockers,
  };
}

function publicTaskDecisionCommand(record: Record<string, unknown>) {
  return {
    schema_version: "task_candidate_decision_command_receipt.v1",
    command_request_id: record.command_request_id,
    capture_session_id: record.capture_session_id,
    discovery_digest: record.discovery_digest,
    task_candidate_id: record.task_candidate_id,
    candidate_digest: record.candidate_digest,
    action: record.action,
    rationale: record.rationale,
    edited_task: record.edited_task,
    pipeline_approval_status: record.pipeline_approval_status,
    pipeline_task_decision: record.pipeline_task_decision || null,
    approved_task_definition: record.approved_task_definition || null,
    decision_evidence_request: record.decision_evidence_request || null,
    pipeline_result_proof_boundary: record.pipeline_result_proof_boundary || null,
    created_at_iso: record.created_at_iso,
  };
}

async function readOwnedSession(sessionId: string, uid: string) {
  if (!db) return { status: 503 as const, record: null };
  const snapshot = await db.collection("captureUploadSessions").doc(sessionId).get();
  if (!snapshot.exists) return { status: 404 as const, record: null };
  const record = snapshot.data() as SessionRecord;
  if (record.owner_user_id !== uid) return { status: 404 as const, record: null };
  return { status: 200 as const, record };
}

router.post("/", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Capture upload session store is unavailable" });
  if (resolveStorageProviderName() !== "backblaze") {
    return res.status(409).json({ error: "Resumable capture storage is not configured" });
  }
  const parsed = sessionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Capture upload session request is invalid",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  const request = parsed.data;
  const blockers = requestBlockers(request, user.tenantId);
  if (blockers.length) {
    return res.status(422).json({
      error: "Capture upload cannot start",
      blockers,
    });
  }
  const sessionId = sessionIdFor(user.uid, request.idempotency_key);
  const fingerprint = `sha256:${sha256Text(stable(request))}`;
  const ref = db.collection("captureUploadSessions").doc(sessionId);
  const existing = await ref.get();
  if (existing.exists) {
    const record = existing.data() as SessionRecord;
    if (
      record.owner_user_id !== user.uid ||
      record.request_fingerprint_sha256 !== fingerprint
    ) {
      return res.status(409).json({ error: "Capture upload idempotency conflict" });
    }
    return res.status(200).json({ ...publicSession(record), already_exists: true });
  }

  const now = new Date().toISOString();
  const partSize = configuredPartSize(request.original_file.size_bytes);
  const expectedPartCount = Math.ceil(request.original_file.size_bytes / partSize);
  if (expectedPartCount < 2 || expectedPartCount > MAX_PARTS) {
    return res.status(422).json({
      error: "Capture file cannot be represented by the supported multipart contract",
    });
  }
  const extension = fileExtensionFor(request)!;
  const objectPath = `captures/${user.uid}/intakes/${sessionId}/${sessionId}${extension}`;
  const pending: SessionRecord = {
    schema_version: "capture_upload_session_record.v1",
    session_id: sessionId,
    owner_user_id: user.uid,
    organization_id: user.tenantId || request.organization_id || `user:${user.uid}`,
    organization_binding_status: user.tenantId
      ? "firebase_tenant_verified"
      : "owner_declared_or_user_scoped",
    request,
    request_fingerprint_sha256: fingerprint,
    status: "provider_start_pending",
    provider: "backblaze",
    object_path: objectPath,
    part_size_bytes: partSize,
    expected_part_count: expectedPartCount,
    created_at_iso: now,
    updated_at_iso: now,
    upload_validation: { status: "pending" },
    malware_content_validation: { status: "pending" },
    content_addressing: { status: "pending_server_sha256_verification" },
  };
  try {
    await ref.create(pending);
  } catch {
    const raced = await ref.get();
    if (raced.exists) {
      const record = raced.data() as SessionRecord;
      if (
        record.owner_user_id === user.uid &&
        record.request_fingerprint_sha256 === fingerprint
      ) {
        return res.status(200).json({ ...publicSession(record), already_exists: true });
      }
    }
    return res.status(409).json({ error: "Capture upload idempotency conflict" });
  }

  try {
    const provider = await startBackblazeResumableCapture({
      objectPath,
      contentType: request.original_file.media_type,
    });
    const active: SessionRecord = {
      ...pending,
      status: "upload_pending",
      provider_file_id: provider.fileId,
      storage_uri: provider.storageUri,
      updated_at_iso: new Date().toISOString(),
    };
    await ref.set(active, { merge: false });
    return res.status(201).json(publicSession(active));
  } catch (error) {
    const failed: SessionRecord = {
      ...pending,
      status: "failed",
      error: "Capture storage provider could not start the upload",
      updated_at_iso: new Date().toISOString(),
    };
    await ref.set(failed, { merge: false });
    logger.error({ sessionId, err: error }, "Failed to start resumable capture upload");
    return res.status(502).json(publicSession(failed));
  }
});

router.get("/", async (_req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Capture upload session store is unavailable" });
  const snapshot = await db
    .collection("captureUploadSessions")
    .where("owner_user_id", "==", user.uid)
    .limit(100)
    .get();
  const sessions = (snapshot.docs || [])
    .map((document) => publicSession(document.data() as SessionRecord))
    .sort((left, right) =>
      String(right.updated_at_iso || "").localeCompare(String(left.updated_at_iso || "")),
    );
  return res.status(200).json({
    schema_version: "capture_upload_session_list.v1",
    sessions,
  });
});

router.get("/:sessionId", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) {
    return res.status(result.status).json({ error: result.status === 404 ? "Capture upload not found" : "Capture upload session store is unavailable" });
  }
  let parts: StoredCapturePart[] = [];
  if (
    result.record.provider_file_id &&
    ["upload_pending", "uploading"].includes(result.record.status)
  ) {
    try {
      parts = await listBackblazeCaptureParts(result.record.provider_file_id);
    } catch (error) {
      logger.warn({ sessionId: result.record.session_id, err: error }, "Could not refresh capture upload parts");
    }
  }
  return res.status(200).json(publicSession(result.record, parts));
});

router.get("/:sessionId/task-discovery", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const review = taskReviewProjection(result.record);
  res.set("Cache-Control", "no-store");
  if (review.status === "pipeline_artifact_invalid") {
    return res.status(409).json({
      error: "Pipeline task-discovery artifact failed integrity validation",
      blockers: review.blockers,
    });
  }
  return res.status(200).json({
    schema_version: "capture_task_review.v1",
    session_id: result.record.session_id,
    intake_id: result.record.request.intake_id,
    status: review.status,
    discovery: review.discovery,
    latest_decision_command: result.record.latest_task_decision_command
      ? publicTaskDecisionCommand(result.record.latest_task_decision_command)
      : null,
    claim_boundary: {
      webapp_command_is_pipeline_approval: false,
      decision_evidence_request_compiled: false,
      task_success_established: false,
    },
  });
});

router.get("/:sessionId/testbed", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const projection = siteTaskTestbedProjection(result.record);
  res.set("Cache-Control", "no-store");
  if (projection.summary.state === "not_available") {
    return res.status(404).json({ error: "Maintained Site-Task Testbed is not available" });
  }
  if (projection.summary.state === "pipeline_artifact_invalid" || !projection.testbed) {
    return res.status(409).json({
      error: "Pipeline testbed artifact failed integrity validation",
      blockers: projection.blockers,
    });
  }
  return res.status(200).json({
    schema_version: "capture_site_task_testbed_inspection.v1",
    session_id: result.record.session_id,
    intake_id: result.record.request.intake_id,
    status: "testbed_ready",
    artifact_reference: projection.summary.artifact_reference,
    testbed: projection.testbed,
    decision_evidence_request: projection.decisionRequest,
    proof_boundary: projection.testbed.proof_boundary,
  });
});

router.get("/:sessionId/capture-qa", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const projection = captureQaProjection(result.record);
  res.set("Cache-Control", "no-store");
  if (projection.summary.state === "not_available") {
    return res.status(404).json({ error: "Capture QA is not available" });
  }
  if (projection.summary.state === "pipeline_artifact_invalid" || !projection.publication) {
    return res.status(409).json({
      error: "Pipeline Capture QA artifact failed integrity validation",
      blockers: projection.blockers,
    });
  }
  return res.status(200).json({
    schema_version: "capture_qa_inspection.v1",
    session_id: result.record.session_id,
    intake_id: result.record.request.intake_id,
    status: projection.publication.status,
    state: projection.publication.state,
    publication: projection.publication,
  });
});

router.get("/:sessionId/task-evaluation-run", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const projection = taskEvaluationRunProjection(result.record);
  res.set("Cache-Control", "no-store");
  if (projection.summary.state === "not_available") {
    return res.status(404).json({ error: "Task Evaluation Run is not available" });
  }
  if (projection.summary.state === "pipeline_artifact_invalid" || !projection.publication) {
    return res.status(409).json({
      error: "Pipeline Task Evaluation Run artifact failed integrity validation",
      blockers: projection.blockers,
    });
  }
  return res.status(200).json({
    schema_version: "capture_task_evaluation_run_inspection.v1",
    session_id: result.record.session_id,
    intake_id: result.record.request.intake_id,
    status: projection.publication.state,
    publication: projection.publication,
  });
});

router.post("/:sessionId/task-evaluation-runs/plan", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const command = taskEvaluationRunPlanCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Task Evaluation Run plan command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const projection = siteTaskTestbedProjection(owned.record);
  if (!projection.testbed || !projection.decisionRequest) {
    return res.status(409).json({
      error: "An authoritative testbed and Decision/Evidence Request are required",
      blockers: projection.blockers,
    });
  }
  const runId = `task-run-${sha256Text(
    `${user.uid}\u0000${owned.record.session_id}\u0000${command.data.idempotency_key}`,
  ).slice(0, 32)}`;
  const planRecordId = `capture-plan-${sha256Text(
    `${owned.record.session_id}\u0000${runId}`,
  ).slice(0, 32)}`;
  const fingerprint = `sha256:${sha256Text(stableJson({
    capture_session_id: owned.record.session_id,
    intake_id: owned.record.request.intake_id,
    run_id: runId,
    request_digest: projection.decisionRequest.request_digest,
    testbed_digest: projection.testbed.testbed_digest,
    idempotency_key: command.data.idempotency_key,
  }))}`;
  const planRef = db.collection("captureTaskEvaluationRunPlans").doc(planRecordId);
  const sessionRef = db.collection("captureUploadSessions").doc(owned.record.session_id);
  const existing = await planRef.get();
  const baseRecord = {
    schema_version: "capture_task_evaluation_run_plan_record.v1",
    plan_record_id: planRecordId,
    owner_user_id: user.uid,
    capture_session_id: owned.record.session_id,
    intake_id: owned.record.request.intake_id,
    run_id: runId,
    request_digest: projection.decisionRequest.request_digest,
    testbed_digest: projection.testbed.testbed_digest,
    request_fingerprint_sha256: fingerprint,
    status: "planning",
    created_at_iso: new Date().toISOString(),
  };
  if (existing.exists) {
    const record = existing.data() as Record<string, any>;
    if (record.owner_user_id !== user.uid || record.request_fingerprint_sha256 !== fingerprint) {
      return res.status(409).json({ error: "Task Evaluation Run plan idempotency conflict" });
    }
    if (record.status === "authorization_required" && record.pipeline_preparation) {
      return res.status(200).json({
        schema_version: "capture_task_evaluation_run_plan_receipt.v1",
        already_exists: true,
        status: record.status,
        run_id: runId,
        pipeline_preparation: record.pipeline_preparation,
      });
    }
  } else {
    try {
      await planRef.create(baseRecord);
      await sessionRef.set({ pipeline_task_evaluation_run_plan: baseRecord }, { merge: true });
    } catch {
      return res.status(409).json({ error: "Task Evaluation Run plan idempotency conflict" });
    }
  }
  const forwarded = await forwardTaskEvaluationRunPlanToPipeline({
    captureSessionId: owned.record.session_id,
    intakeId: owned.record.request.intake_id,
    runId,
    request: projection.decisionRequest,
    testbed: projection.testbed,
    idempotencyKey: command.data.idempotency_key,
  });
  const resolved = {
    status: forwarded.status === "forwarded" ? "authorization_required" : "planning_failed",
    pipeline_preparation: forwarded.preparation || null,
    pipeline_forward: {
      status: forwarded.status,
      performed: forwarded.performed,
      required: forwarded.required,
      blocker: forwarded.blocker || null,
      http_status: forwarded.http_status || null,
    },
    updated_at_iso: new Date().toISOString(),
  };
  await planRef.set(resolved, { merge: true });
  await sessionRef.set({
    pipeline_task_evaluation_run_plan: {
      ...(existing.exists ? existing.data() : baseRecord),
      ...resolved,
      run_id: runId,
      request_digest: projection.decisionRequest.request_digest,
      testbed_digest: projection.testbed.testbed_digest,
    },
  }, { merge: true });
  if (forwarded.status !== "forwarded" || !forwarded.preparation) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not plan the Task Evaluation Run",
      blocker: forwarded.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(201).json({
    schema_version: "capture_task_evaluation_run_plan_receipt.v1",
    already_exists: false,
    status: "authorization_required",
    run_id: runId,
    pipeline_preparation: forwarded.preparation,
  });
});

router.post("/:sessionId/task-evaluation-runs/:runId/authorize", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const command = taskEvaluationRunAuthorizationCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Task Evaluation Run authorization command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const planRecord = owned.record.pipeline_task_evaluation_run_plan as Record<string, any> | undefined;
  const currentProjection = siteTaskTestbedProjection(owned.record);
  const controlProjection = taskEvaluationRunControlProjection(owned.record, currentProjection);
  const preparation = controlProjection.preparation;
  if (
    !planRecord || !preparation ||
    planRecord.run_id !== req.params.runId ||
    preparation.run_id !== req.params.runId ||
    preparation.evidence_plan?.plan_digest !== command.data.plan_digest ||
    planRecord.request_digest !== preparation.request?.request_digest ||
    planRecord.testbed_digest !== preparation.evidence_plan?.testbed_digest ||
    !currentProjection.testbed || !currentProjection.decisionRequest ||
    currentProjection.testbed.testbed_digest !== planRecord.testbed_digest ||
    currentProjection.decisionRequest.request_digest !== planRecord.request_digest
  ) {
    return res.status(409).json({ error: "Task Evaluation Run plan is stale or not awaiting authorization" });
  }
  const candidates = Array.isArray(preparation.authorization_candidates)
    ? preparation.authorization_candidates as Array<Record<string, unknown>>
    : [];
  const allowed = new Set(candidates.map((candidate) => String(candidate.adapter_reference || "")));
  const requested = [...new Set(command.data.authorized_adapter_references)].sort();
  if (requested.some((reference) => !allowed.has(reference))) {
    return res.status(409).json({ error: "Authorization includes an adapter not selected by Pipeline" });
  }
  const authorizationFingerprint = `sha256:${sha256Text(stableJson({
    run_id: req.params.runId,
    plan_digest: command.data.plan_digest,
    authorized_adapter_references: requested,
    actor: { role: "customer", identity: `firebase:${user.uid}` },
    idempotency_key: command.data.idempotency_key,
  }))}`;
  if (planRecord.status === "authorized" && planRecord.pipeline_authorization) {
    if (planRecord.authorization_request_fingerprint_sha256 !== authorizationFingerprint) {
      return res.status(409).json({ error: "Task Evaluation Run authorization idempotency conflict" });
    }
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_task_evaluation_run_authorization_receipt.v1",
      already_exists: true,
      status: "authorized",
      run_id: req.params.runId,
      plan_digest: command.data.plan_digest,
      pipeline_authorization: planRecord.pipeline_authorization,
    });
  }
  if (planRecord.status !== "authorization_required" && planRecord.status !== "authorization_failed") {
    return res.status(409).json({ error: "Task Evaluation Run plan is not awaiting authorization" });
  }
  const forwarded = await forwardTaskEvaluationRunAuthorizationToPipeline({
    runId: req.params.runId,
    planDigest: command.data.plan_digest,
    authorizedAdapterReferences: requested,
    actor: { role: "customer", identity: `firebase:${user.uid}` },
    idempotencyKey: command.data.idempotency_key,
  });
  const resolved = {
    ...planRecord,
    status: forwarded.status === "forwarded" ? "authorized" : "authorization_failed",
    authorization_request_fingerprint_sha256: authorizationFingerprint,
    pipeline_authorization: forwarded.authorization || null,
    authorization_forward: {
      status: forwarded.status,
      performed: forwarded.performed,
      required: forwarded.required,
      blocker: forwarded.blocker || null,
      http_status: forwarded.http_status || null,
    },
    updated_at_iso: new Date().toISOString(),
  };
  if (planRecord.plan_record_id) {
    await db.collection("captureTaskEvaluationRunPlans").doc(String(planRecord.plan_record_id))
      .set(resolved, { merge: false });
  }
  await db.collection("captureUploadSessions").doc(owned.record.session_id).set(
    { pipeline_task_evaluation_run_plan: resolved },
    { merge: true },
  );
  if (forwarded.status !== "forwarded" || !forwarded.authorization) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not authorize the Task Evaluation Run",
      blocker: forwarded.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "capture_task_evaluation_run_authorization_receipt.v1",
    already_exists: false,
    status: "authorized",
    run_id: req.params.runId,
    plan_digest: command.data.plan_digest,
    pipeline_authorization: forwarded.authorization,
  });
});

router.post("/:sessionId/task-evaluation-runs/:runId/execute", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const command = taskEvaluationRunExecutionCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Task Evaluation Run execution command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const existingTerminal = taskEvaluationRunProjection(owned.record);
  if (
    existingTerminal.publication?.run_id === req.params.runId &&
    ["decided", "partially_decided", "abstained"].includes(existingTerminal.publication.state)
  ) {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_task_evaluation_run_execution_receipt.v1",
      already_exists: true,
      status: existingTerminal.publication.state,
      run_id: req.params.runId,
      decision_envelope_digest:
        existingTerminal.publication.decision_envelope.decision_envelope_digest,
    });
  }
  const control = taskEvaluationRunControlProjection(owned.record);
  if (
    control.summary.state !== "authorized" ||
    !control.preparation || !control.authorization ||
    control.preparation.run_id !== req.params.runId
  ) {
    return res.status(409).json({
      error: "Task Evaluation Run is not authorized for execution",
      blockers: control.blockers,
    });
  }
  const preparation = control.preparation;
  const forwarded = await forwardTaskEvaluationRunExecutionToPipeline({
    runId: req.params.runId,
    planDigest: preparation.evidence_plan.plan_digest,
    requestDigest: preparation.request.request_digest,
    testbedDigest: preparation.evidence_plan.testbed_digest,
  });
  const planRecord = owned.record.pipeline_task_evaluation_run_plan as Record<string, any>;
  const executionForward = {
    status: forwarded.status,
    performed: forwarded.performed,
    required: forwarded.required,
    blocker: forwarded.blocker || null,
    http_status: forwarded.http_status || null,
    idempotency_key: command.data.idempotency_key,
    result_state: forwarded.result?.state || null,
    decision_envelope_digest:
      forwarded.result?.decision_envelope?.decision_envelope_digest || null,
    updated_at_iso: new Date().toISOString(),
  };
  const resolved = { ...planRecord, execution_forward: executionForward };
  if (planRecord.plan_record_id) {
    await db.collection("captureTaskEvaluationRunPlans").doc(String(planRecord.plan_record_id))
      .set(resolved, { merge: false });
  }
  await db.collection("captureUploadSessions").doc(owned.record.session_id).set(
    { pipeline_task_evaluation_run_plan: resolved },
    { merge: true },
  );
  if (forwarded.status !== "forwarded" || !forwarded.result) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not execute the Task Evaluation Run",
      blocker: forwarded.blocker,
    });
  }
  const refreshed = await readOwnedSession(req.params.sessionId, user.uid);
  const terminal = refreshed.record ? taskEvaluationRunProjection(refreshed.record) : null;
  if (
    !terminal?.publication ||
    terminal.publication.run_id !== req.params.runId ||
    terminal.publication.state !== forwarded.result.state ||
    terminal.publication.decision_envelope.decision_envelope_digest !==
      forwarded.result.decision_envelope.decision_envelope_digest
  ) {
    return res.status(502).json({
      error: "Pipeline execution finished but authoritative terminal publication is pending",
      blocker: "task_evaluation_run_terminal_publication_missing",
      run_id: req.params.runId,
      pipeline_state: forwarded.result.state,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "capture_task_evaluation_run_execution_receipt.v1",
    already_exists: forwarded.result.already_exists,
    status: terminal.publication.state,
    run_id: req.params.runId,
    decision_envelope_digest:
      terminal.publication.decision_envelope.decision_envelope_digest,
  });
});

router.post("/:sessionId/task-decisions", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const review = taskReviewProjection(result.record);
  if (!review.discovery) {
    return res.status(409).json({
      error: "Task candidates are not available for customer review",
      blockers: review.blockers,
    });
  }
  const parsed = taskDecisionCommandSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Task decision command is invalid",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  const command = parsed.data;
  if (command.discovery_digest !== review.discovery.discovery_digest) {
    return res.status(409).json({ error: "Task discovery digest is stale" });
  }
  const matches = review.discovery.task_candidates.filter(
    (candidate) =>
      candidate.task_candidate_id === command.task_candidate_id &&
      candidate.candidate_digest === command.candidate_digest,
  );
  if (matches.length !== 1) {
    return res.status(409).json({ error: "Task candidate binding is stale or invalid" });
  }
  const commandRequestId = `task-command-${sha256Text(
    `${user.uid}\u0000${result.record.session_id}\u0000${command.idempotency_key}`,
  ).slice(0, 32)}`;
  const fingerprint = `sha256:${sha256Text(stableJson({
    user_id: user.uid,
    capture_session_id: result.record.session_id,
    command,
  }))}`;
  const commandRef = db!.collection("captureTaskDecisionCommands").doc(commandRequestId);
  const sessionRef = db!.collection("captureUploadSessions").doc(result.record.session_id);
  const now = new Date().toISOString();
  const pending = {
    schema_version: "task_candidate_decision_command_record.v1",
    command_request_id: commandRequestId,
    requester_user_id: user.uid,
    actor: { role: "customer", identity: `firebase:${user.uid}` },
    capture_session_id: result.record.session_id,
    intake_id: result.record.request.intake_id,
    discovery_digest: command.discovery_digest,
    task_candidate_id: command.task_candidate_id,
    candidate_digest: command.candidate_digest,
    action: command.action,
    rationale: command.rationale,
    edited_task: command.edited_task,
    request_fingerprint_sha256: fingerprint,
    idempotency_key: command.idempotency_key,
    pipeline_approval_status: "pending_pipeline_validation",
    created_at_iso: now,
  };
  type TransactionOutcome =
    | {
        kind: "created";
        receipt: ReturnType<typeof publicTaskDecisionCommand>;
        record: Record<string, unknown>;
      }
    | {
        kind: "replayed";
        receipt: ReturnType<typeof publicTaskDecisionCommand>;
        record: Record<string, unknown>;
      }
    | { kind: "idempotency_conflict" }
    | { kind: "pending_conflict" }
    | { kind: "stale_binding" }
    | { kind: "not_found" };
  let outcome: TransactionOutcome;
  try {
    outcome = await db!.runTransaction<TransactionOutcome>(async (transaction) => {
      // Firestore requires every transaction read to happen before its writes.
      const existing = await transaction.get(commandRef);
      const session = await transaction.get(sessionRef);
      if (!session.exists) return { kind: "not_found" };
      const liveSession = session.data() as SessionRecord;
      if (liveSession.owner_user_id !== user.uid) return { kind: "not_found" };
      if (existing.exists) {
        const record = existing.data() as Record<string, unknown>;
        if (
          record.requester_user_id !== user.uid ||
          record.request_fingerprint_sha256 !== fingerprint
        ) {
          return { kind: "idempotency_conflict" };
        }
        const receipt = publicTaskDecisionCommand(record);
        const projectedCommandId = liveSession.latest_task_decision_command?.command_request_id;
        const liveReview = taskReviewProjection(liveSession);
        const replayStillMatchesDiscovery = Boolean(
          liveReview.discovery &&
          liveReview.discovery.discovery_digest === receipt.discovery_digest &&
          liveReview.discovery.task_candidates.some(
            (candidate) =>
              candidate.task_candidate_id === receipt.task_candidate_id &&
              candidate.candidate_digest === receipt.candidate_digest,
          ),
        );
        if (
          replayStillMatchesDiscovery &&
          (!projectedCommandId || projectedCommandId === receipt.command_request_id)
        ) {
          transaction.set(
            sessionRef,
            { latest_task_decision_command: receipt, updated_at_iso: now },
            { merge: true },
          );
        }
        return { kind: "replayed", receipt, record };
      }
      const liveReview = taskReviewProjection(liveSession);
      if (
        !liveReview.discovery ||
        liveReview.discovery.discovery_digest !== command.discovery_digest ||
        !liveReview.discovery.task_candidates.some(
          (candidate) =>
            candidate.task_candidate_id === command.task_candidate_id &&
            candidate.candidate_digest === command.candidate_digest,
        )
      ) {
        return { kind: "stale_binding" };
      }
      if (
        liveSession.latest_task_decision_command?.pipeline_approval_status ===
        "pending_pipeline_validation"
      ) {
        return { kind: "pending_conflict" };
      }
      const receipt = publicTaskDecisionCommand(pending);
      transaction.create(commandRef, pending);
      transaction.set(
        sessionRef,
        { latest_task_decision_command: receipt, updated_at_iso: now },
        { merge: true },
      );
      return { kind: "created", receipt, record: pending };
    });
  } catch (error) {
    const failure = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: "non-Error transaction failure" };
    logger.error(
      { sessionId: result.record.session_id, commandRequestId, err: failure },
      "Failed to persist task decision transaction",
    );
    return res.status(503).json({ error: "Task decision command store is unavailable" });
  }
  if (outcome.kind === "not_found") {
    return res.status(404).json({ error: "Capture upload not found" });
  }
  if (outcome.kind === "idempotency_conflict") {
    return res.status(409).json({ error: "Task decision idempotency conflict" });
  }
  if (outcome.kind === "stale_binding") {
    return res.status(409).json({ error: "Task discovery changed before command commit" });
  }
  if (outcome.kind === "pending_conflict") {
    return res.status(409).json({
      error: "A task decision command is already pending Pipeline validation",
    });
  }
  let receipt = outcome.receipt;
  let pipelineResolutionPersistenceFailed = false;
  const pipelineForward = receipt.pipeline_approval_status === "pending_pipeline_validation"
    ? await forwardTaskCandidateDecisionToPipeline({
        captureSessionId: result.record.session_id,
        intakeId: result.record.request.intake_id,
        discoveryId: review.discovery.discovery_id,
        sourceCaptureDigest: review.discovery.source_capture.capture_digest,
        command: outcome.record,
      })
    : null;
  if (pipelineForward?.pipeline_result) {
    const pipelineResult = pipelineForward.pipeline_result;
    const { pipeline_result: _pipelineResult, ...forwardAudit } = pipelineForward;
    type ResolutionOutcome =
      | { kind: "resolved"; receipt: ReturnType<typeof publicTaskDecisionCommand> }
      | { kind: "stale" };
    try {
      const resolution = await db!.runTransaction<ResolutionOutcome>(async (transaction) => {
        const commandSnapshot = await transaction.get(commandRef);
        const sessionSnapshot = await transaction.get(sessionRef);
        if (!commandSnapshot.exists || !sessionSnapshot.exists) return { kind: "stale" };
        const liveCommand = commandSnapshot.data() as Record<string, unknown>;
        const liveSession = sessionSnapshot.data() as SessionRecord;
        if (
          liveCommand.request_fingerprint_sha256 !== fingerprint ||
          liveSession.owner_user_id !== user.uid ||
          liveSession.latest_task_decision_command?.command_request_id !== commandRequestId
        ) {
          return { kind: "stale" };
        }
        const resolvedRecord = {
          ...liveCommand,
          pipeline_approval_status: pipelineResult.pipeline_approval_status,
          pipeline_task_decision: pipelineResult.pipeline_task_decision,
          approved_task_definition: pipelineResult.approved_task_definition,
          decision_evidence_request: pipelineResult.decision_evidence_request,
          pipeline_result_proof_boundary: pipelineResult.proof_boundary,
          pipeline_processed_at_iso: pipelineResult.processed_at_iso,
          pipeline_forward: forwardAudit,
        };
        const resolvedReceipt = publicTaskDecisionCommand(resolvedRecord);
        transaction.set(commandRef, resolvedRecord, { merge: false });
        transaction.set(
          sessionRef,
          {
            latest_task_decision_command: resolvedReceipt,
            pipeline_task_decision: pipelineResult.pipeline_task_decision,
            approved_task_definition: pipelineResult.approved_task_definition,
            decision_evidence_request: pipelineResult.decision_evidence_request,
            task_decision_proof_boundary: pipelineResult.proof_boundary,
            updated_at_iso: new Date().toISOString(),
          },
          { merge: true },
        );
        return { kind: "resolved", receipt: resolvedReceipt };
      });
      if (resolution.kind === "resolved") receipt = resolution.receipt;
    } catch (error) {
      pipelineResolutionPersistenceFailed = true;
      const failure = error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: "non-Error transaction failure" };
      logger.error(
        { sessionId: result.record.session_id, commandRequestId, err: failure },
        "Pipeline processed task decision but WebApp could not persist the resolution",
      );
    }
  }
  res.set("Cache-Control", "no-store");
  const pipelineResolved = receipt.pipeline_approval_status !== "pending_pipeline_validation";
  return res.status(pipelineResolved || outcome.kind === "replayed" ? 200 : 202).json({
    ...receipt,
    ...(outcome.kind === "replayed" ? { already_exists: true } : {}),
    ...(pipelineForward
      ? {
          pipeline_forward: {
            status: pipelineForward.status,
            performed: pipelineForward.performed,
            required: pipelineForward.required,
            blocker: pipelineResolutionPersistenceFailed
              ? "pipeline_task_decision_resolution_persistence_failed"
              : pipelineForward.blocker || null,
          },
        }
      : {}),
  });
});

router.post("/:sessionId/reconstructions/plan", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Reconstruction control store is unavailable" });
  const command = reconstructionPlanCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Reconstruction plan command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const record = owned.record;
  const qa = captureQaProjection(record);
  if (qa.publication?.status !== "accepted" || qa.publication.state !== "capture_accepted") {
    return res.status(409).json({ error: "Capture must be accepted before reconstruction planning" });
  }
  if (record.capture_access?.future_processing_allowed === false || record.completed_capture_lifecycle) {
    return res.status(410).json({ error: "Capture is revoked or pending deletion" });
  }
  const intakeReceipt = record.pipeline_capture_intake_receipt as Record<string, any> | undefined;
  const captureDigest = String(intakeReceipt?.capture_digest || "");
  if (
    !intakeReceipt
    || intakeReceipt.capture_session_id !== record.session_id
    || intakeReceipt.intake_id !== record.request.intake_id
    || !/^sha256:[0-9a-f]{64}$/.test(captureDigest)
  ) {
    return res.status(409).json({ error: "A bound completed Pipeline intake receipt is required" });
  }
  const claims = [...new Set(command.data.requested_claim_types)].sort();
  const fingerprint = `sha256:${sha256Text(stableJson({
    capture_session_id: record.session_id,
    intake_id: record.request.intake_id,
    capture_digest: captureDigest,
    requested_claim_types: claims,
    idempotency_key: command.data.idempotency_key,
  }))}`;
  const existing = record.pipeline_reconstruction;
  if (existing?.request_fingerprint_sha256 && existing.request_fingerprint_sha256 !== fingerprint) {
    return res.status(409).json({ error: "Reconstruction plan idempotency conflict" });
  }
  if (existing?.pipeline_plan && ["authorization_required", "abstained"].includes(existing.status)) {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_reconstruction_plan_receipt.v1",
      already_exists: true,
      status: existing.status,
      pipeline_plan: existing.pipeline_plan,
    });
  }
  const forwarded = await forwardReconstructionPlanToPipeline({
    captureSessionId: record.session_id,
    intakeId: record.request.intake_id,
    captureDigest,
    requestedClaimTypes: claims,
    idempotencyKey: command.data.idempotency_key,
  });
  const reconstruction = {
    schema_version: "capture_reconstruction_control_record.v1",
    request_fingerprint_sha256: fingerprint,
    requested_claim_types: claims,
    status: forwarded.value?.state || "planning_failed",
    plan_id: forwarded.value?.plan_id || null,
    pipeline_plan: forwarded.value || null,
    blocker: forwarded.blocker || null,
    updated_at_iso: new Date().toISOString(),
  };
  await db.collection("captureUploadSessions").doc(record.session_id).set(
    { pipeline_reconstruction: reconstruction, updated_at_iso: reconstruction.updated_at_iso },
    { merge: true },
  );
  if (forwarded.status !== "forwarded" || !forwarded.value) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not plan reconstruction",
      blocker: forwarded.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(201).json({
    schema_version: "capture_reconstruction_plan_receipt.v1",
    already_exists: false,
    status: forwarded.value.state,
    pipeline_plan: forwarded.value,
  });
});

router.post("/:sessionId/reconstructions/:planId/authorize", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Reconstruction control store is unavailable" });
  const command = reconstructionAuthorizationCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Reconstruction authorization command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const reconstruction = owned.record.pipeline_reconstruction;
  const plan = reconstruction?.pipeline_plan;
  if (
    !plan
    || plan.plan_id !== req.params.planId
    || plan.reconstruction_plan?.reconstruction_plan_digest !== command.data.reconstruction_plan_digest
    || !["authorization_required", "authorization_failed"].includes(reconstruction.status)
  ) {
    return res.status(409).json({ error: "Reconstruction plan is stale or not awaiting authorization" });
  }
  const allowed = new Set(
    (plan.authorization_candidates || []).map(
      (candidate: Record<string, unknown>) => String(candidate.adapter_reference || ""),
    ),
  );
  const references = [...new Set(command.data.authorized_adapter_references)].sort();
  if (references.some((reference) => !allowed.has(reference))) {
    return res.status(409).json({ error: "Authorization includes an adapter not selected by Pipeline" });
  }
  const authorizationFingerprint = `sha256:${sha256Text(stableJson({
    plan_id: req.params.planId,
    reconstruction_plan_digest: command.data.reconstruction_plan_digest,
    authorized_adapter_references: references,
    actor: { role: "customer", identity: `firebase:${user.uid}` },
    idempotency_key: command.data.idempotency_key,
  }))}`;
  if (reconstruction.pipeline_authorization) {
    if (reconstruction.authorization_request_fingerprint_sha256 !== authorizationFingerprint) {
      return res.status(409).json({ error: "Reconstruction authorization idempotency conflict" });
    }
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_reconstruction_authorization_receipt.v1",
      already_exists: true,
      status: "authorized",
      plan_id: req.params.planId,
      pipeline_authorization: reconstruction.pipeline_authorization,
    });
  }
  const forwarded = await forwardReconstructionAuthorizationToPipeline({
    planId: req.params.planId,
    reconstructionPlanDigest: command.data.reconstruction_plan_digest,
    authorizedAdapterReferences: references,
    actor: { role: "customer", identity: `firebase:${user.uid}` },
    idempotencyKey: command.data.idempotency_key,
  });
  const resolved = {
    ...reconstruction,
    status: forwarded.value ? "authorized" : "authorization_failed",
    authorization_request_fingerprint_sha256: authorizationFingerprint,
    pipeline_authorization: forwarded.value || null,
    blocker: forwarded.blocker || null,
    updated_at_iso: new Date().toISOString(),
  };
  await db.collection("captureUploadSessions").doc(owned.record.session_id).set(
    { pipeline_reconstruction: resolved, updated_at_iso: resolved.updated_at_iso },
    { merge: true },
  );
  if (forwarded.status !== "forwarded" || !forwarded.value) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not authorize reconstruction",
      blocker: forwarded.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "capture_reconstruction_authorization_receipt.v1",
    already_exists: false,
    status: "authorized",
    plan_id: req.params.planId,
    pipeline_authorization: forwarded.value,
  });
});

router.post("/:sessionId/reconstructions/:planId/execute", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Reconstruction control store is unavailable" });
  const command = reconstructionExecutionCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Reconstruction execution command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  if (owned.record.capture_access?.future_processing_allowed === false || owned.record.completed_capture_lifecycle) {
    return res.status(410).json({ error: "Capture is revoked or pending deletion" });
  }
  const reconstruction = owned.record.pipeline_reconstruction;
  const plan = reconstruction?.pipeline_plan;
  const authorization = reconstruction?.pipeline_authorization;
  if (
    !plan
    || !authorization
    || plan.plan_id !== req.params.planId
    || authorization.plan_id !== req.params.planId
    || !["authorized", "execution_failed"].includes(reconstruction.status)
  ) {
    return res.status(409).json({ error: "Reconstruction is not authorized for execution" });
  }
  const executionKeyDigest = `sha256:${sha256Text(command.data.idempotency_key)}`;
  if (
    reconstruction.execution_idempotency_key_digest
    && reconstruction.execution_idempotency_key_digest !== executionKeyDigest
  ) {
    return res.status(409).json({ error: "Reconstruction execution idempotency conflict" });
  }
  if (reconstruction.pipeline_execution) {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_reconstruction_execution_receipt.v1",
      already_exists: true,
      status: reconstruction.pipeline_execution.state,
      plan_id: req.params.planId,
      pipeline_execution: reconstruction.pipeline_execution,
    });
  }
  const forwarded = await forwardReconstructionExecutionToPipeline({
    planId: req.params.planId,
    reconstructionPlanDigest: plan.reconstruction_plan.reconstruction_plan_digest,
    authorizationDigest: authorization.authorization_digest,
  });
  const resolved = {
    ...reconstruction,
    status: forwarded.value?.state || "execution_failed",
    execution_idempotency_key_digest: executionKeyDigest,
    pipeline_execution: forwarded.value || null,
    blocker: forwarded.blocker || null,
    updated_at_iso: new Date().toISOString(),
  };
  await db.collection("captureUploadSessions").doc(owned.record.session_id).set(
    { pipeline_reconstruction: resolved, updated_at_iso: resolved.updated_at_iso },
    { merge: true },
  );
  if (forwarded.status !== "forwarded" || !forwarded.value) {
    return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
      error: "Pipeline could not execute reconstruction",
      blocker: forwarded.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "capture_reconstruction_execution_receipt.v1",
    already_exists: forwarded.value.already_exists,
    status: forwarded.value.state,
    plan_id: req.params.planId,
    pipeline_execution: forwarded.value,
  });
});

router.get("/:sessionId/reconstructions/:planId", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const reconstruction = owned.record.pipeline_reconstruction;
  const receipt = owned.record.pipeline_capture_intake_receipt as Record<string, any> | undefined;
  if (!reconstruction?.pipeline_plan || reconstruction.pipeline_plan.plan_id !== req.params.planId) {
    return res.status(404).json({ error: "Reconstruction plan is not available" });
  }
  const inspected = await inspectReconstructionInPipeline({
    planId: req.params.planId,
    captureSessionId: owned.record.session_id,
    intakeId: owned.record.request.intake_id,
    captureDigest: String(receipt?.capture_digest || ""),
  });
  if (inspected.status !== "forwarded" || !inspected.value) {
    return res.status(inspected.status === "not_configured" || inspected.status === "blocked" ? 503 : 502).json({
      error: "Pipeline reconstruction inspection is unavailable",
      blocker: inspected.blocker,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "capture_reconstruction_inspection.v1",
    session_id: owned.record.session_id,
    intake_id: owned.record.request.intake_id,
    inspection: inspected.value,
  });
});

router.get("/:sessionId/lifecycle", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    schema_version: "completed_capture_lifecycle_inspection.v1",
    session_id: owned.record.session_id,
    intake_id: owned.record.request.intake_id,
    ...completedCaptureLifecycleProjection(owned.record),
  });
});

router.post("/:sessionId/lifecycle", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  if (!db) return res.status(503).json({ error: "Capture lifecycle store is unavailable" });
  const command = completedCaptureLifecycleCommandSchema.safeParse(req.body);
  if (!command.success) return res.status(400).json({ error: "Completed capture lifecycle command is invalid" });
  const owned = await readOwnedSession(req.params.sessionId, user.uid);
  if (!owned.record) return res.status(owned.status).json({ error: "Capture upload not found" });
  const record = owned.record;
  const intakeReceipt = record.pipeline_capture_intake_receipt as Record<string, any> | undefined;
  const captureDigest = String(intakeReceipt?.capture_digest || "");
  const envelopeDigest = String(intakeReceipt?.envelope_digest || "");
  if (
    !intakeReceipt
    || intakeReceipt.capture_session_id !== record.session_id
    || intakeReceipt.intake_id !== record.request.intake_id
    || !/^sha256:[0-9a-f]{64}$/.test(captureDigest)
    || !/^sha256:[0-9a-f]{64}$/.test(envelopeDigest)
  ) {
    return res.status(409).json({ error: "A bound completed Pipeline intake receipt is required" });
  }
  let lifecycle = record.completed_capture_lifecycle
    ? structuredClone(record.completed_capture_lifecycle)
    : null;
  if (lifecycle?.action && lifecycle.action !== command.data.action) {
    return res.status(409).json({ error: "Completed capture already has a different terminal lifecycle action" });
  }
  if (
    lifecycle?.idempotency_key_digest
    && lifecycle.idempotency_key_digest !== `sha256:${sha256Text(command.data.idempotency_key)}`
  ) {
    return res.status(409).json({ error: "Completed capture lifecycle idempotency conflict" });
  }
  const sessionRef = db.collection("captureUploadSessions").doc(record.session_id);
  if (!lifecycle?.pipeline_tombstone) {
    const applied = await applyCompletedCaptureLifecycleToPipeline({
      captureSessionId: record.session_id,
      intakeId: record.request.intake_id,
      captureDigest,
      envelopeDigest,
      action: command.data.action,
      idempotencyKey: command.data.idempotency_key,
    });
    if (applied.status !== "forwarded" || !applied.value) {
      return res.status(applied.status === "not_configured" || applied.status === "blocked" ? 503 : 502).json({
        error: "Pipeline could not apply the completed capture lifecycle action",
        blocker: applied.blocker,
      });
    }
    lifecycle = {
      schema_version: "completed_capture_lifecycle_record.v1",
      action: command.data.action,
      status: "revocation_in_progress",
      idempotency_key_digest: `sha256:${sha256Text(command.data.idempotency_key)}`,
      pipeline_tombstone: applied.value,
      updated_at_iso: new Date().toISOString(),
    };
    await sessionRef.set({
      status: "revocation_in_progress",
      pipeline_capture_state: "revocation_in_progress",
      capture_access: { serve_allowed: false, future_processing_allowed: false },
      completed_capture_lifecycle: lifecycle,
      updated_at_iso: lifecycle.updated_at_iso,
    }, { merge: true });
  }
  if (!lifecycle.storage_deletion_receipt) {
    if (!record.provider_file_id || !record.object_path) {
      lifecycle = {
        ...lifecycle,
        status: "revocation_in_progress",
        blocker: "capture_object_store_binding_missing",
        updated_at_iso: new Date().toISOString(),
      };
      await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
      return res.status(409).json({
        error: "Capture object-store deletion binding is missing",
        blocker: lifecycle.blocker,
      });
    }
    try {
      const providerReceipt = await deleteBackblazeCaptureFile({
        fileId: record.provider_file_id,
        fileName: record.object_path,
      });
      const storageReceipt: Record<string, unknown> = {
        schema_version: "capture_storage_deletion_receipt.v1",
        provider: providerReceipt.provider,
        file_id_digest: `sha256:${sha256Text(providerReceipt.fileId)}`,
        object_path_digest: `sha256:${sha256Text(providerReceipt.fileName)}`,
        deleted_at_iso: providerReceipt.deletedAtIso,
        already_absent: providerReceipt.alreadyAbsent,
        signed_download_access_disabled: true,
      };
      storageReceipt.receipt_digest = canonicalArtifactDigest(storageReceipt, "receipt_digest");
      lifecycle = {
        ...lifecycle,
        storage_deletion_receipt: storageReceipt,
        blocker: null,
        updated_at_iso: new Date().toISOString(),
      };
      await sessionRef.set({
        status: "revoked",
        pipeline_capture_state: "revoked",
        provider_file_id: null,
        object_path: null,
        storage_uri: null,
        completed_capture_lifecycle: lifecycle,
        updated_at_iso: lifecycle.updated_at_iso,
      }, { merge: true });
    } catch (error) {
      logger.error({ sessionId: record.session_id, err: error }, "Failed to delete completed capture from object storage");
      lifecycle = {
        ...lifecycle,
        status: "revocation_in_progress",
        blocker: "capture_object_store_deletion_failed",
        updated_at_iso: new Date().toISOString(),
      };
      await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
      return res.status(502).json({
        error: "Capture object store could not delete the completed upload",
        blocker: lifecycle.blocker,
      });
    }
  }
  if (!lifecycle.webapp_revocation_receipt) {
    const completedAt = new Date().toISOString();
    const webappReceipt: Record<string, unknown> = {
      schema_version: "capture_webapp_revocation_receipt.v1",
      capture_session_id_digest: `sha256:${sha256Text(record.session_id)}`,
      intake_id_digest: `sha256:${sha256Text(record.request.intake_id)}`,
      tombstone_digest: lifecycle.pipeline_tombstone.tombstone_digest,
      action: command.data.action,
      serve_allowed: false,
      future_processing_allowed: false,
      completed_at_iso: completedAt,
    };
    webappReceipt.receipt_digest = canonicalArtifactDigest(webappReceipt, "receipt_digest");
    lifecycle = {
      ...lifecycle,
      webapp_revocation_receipt: webappReceipt,
      updated_at_iso: completedAt,
    };
    await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
  }
  const evidenceRequests = [
    {
      key: "webapp_external_evidence",
      action: "sync_webapp_revocation_verdict" as const,
      targetSystem: "Blueprint-WebApp",
      receipt: lifecycle.webapp_revocation_receipt,
      verificationMethod: "signed_webapp_receipt" as const,
    },
    {
      key: "storage_external_evidence",
      action: "disable_signed_download_access" as const,
      targetSystem: "capture-object-store",
      receipt: lifecycle.storage_deletion_receipt,
      verificationMethod: "storage_access_revocation_receipt" as const,
    },
  ];
  for (const evidence of evidenceRequests) {
    if (lifecycle[evidence.key]) continue;
    const forwarded = await recordCaptureExternalRevocationEvidenceInPipeline({
      captureSessionId: record.session_id,
      intakeId: record.request.intake_id,
      action: evidence.action,
      targetSystem: evidence.targetSystem,
      receiptDigest: String(evidence.receipt.receipt_digest),
      completedAt: String(evidence.receipt.completed_at_iso || evidence.receipt.deleted_at_iso),
      verificationMethod: evidence.verificationMethod,
      idempotencyKey: `external-${sha256Text(
        `${command.data.idempotency_key}\u0000${evidence.action}`,
      ).slice(0, 48)}`,
    });
    if (
      forwarded.status !== "forwarded"
      || !forwarded.value
      || forwarded.value.action !== evidence.action
      || forwarded.value.receipt_digest !== evidence.receipt.receipt_digest
      || forwarded.value.tombstone_digest !== lifecycle.pipeline_tombstone.tombstone_digest
    ) {
      lifecycle = {
        ...lifecycle,
        status: "revocation_in_progress",
        blocker: forwarded.blocker || "pipeline_external_revocation_evidence_binding_mismatch",
        updated_at_iso: new Date().toISOString(),
      };
      await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
      return res.status(forwarded.status === "not_configured" || forwarded.status === "blocked" ? 503 : 502).json({
        error: "Pipeline did not accept external revocation evidence",
        blocker: lifecycle.blocker,
      });
    }
    lifecycle = {
      ...lifecycle,
      [evidence.key]: forwarded.value,
      blocker: null,
      updated_at_iso: new Date().toISOString(),
    };
    await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
  }
  const inspected = await inspectCompletedCaptureLifecycleInPipeline({
    captureSessionId: record.session_id,
    intakeId: record.request.intake_id,
  });
  if (
    inspected.status !== "forwarded"
    || !inspected.value
    || inspected.value.tombstone?.tombstone_digest !== lifecycle.pipeline_tombstone.tombstone_digest
  ) {
    lifecycle = {
      ...lifecycle,
      status: "revocation_in_progress",
      blocker: inspected.blocker || "pipeline_capture_lifecycle_inspection_binding_mismatch",
      updated_at_iso: new Date().toISOString(),
    };
    await sessionRef.set({ completed_capture_lifecycle: lifecycle }, { merge: true });
    return res.status(inspected.status === "not_configured" || inspected.status === "blocked" ? 503 : 502).json({
      error: "Pipeline lifecycle inspection is unavailable",
      blocker: lifecycle.blocker,
    });
  }
  lifecycle = {
    ...lifecycle,
    status: inspected.value.lifecycle_complete ? "revoked" : "revocation_in_progress",
    pipeline_inspection: inspected.value,
    blocker: inspected.value.lifecycle_complete ? null : "capture_lifecycle_external_actions_incomplete",
    updated_at_iso: new Date().toISOString(),
  };
  await sessionRef.set({
    status: lifecycle.status,
    pipeline_capture_state: lifecycle.status,
    completed_capture_lifecycle: lifecycle,
    updated_at_iso: lifecycle.updated_at_iso,
  }, { merge: true });
  const refreshed = await readOwnedSession(record.session_id, user.uid);
  if (!refreshed.record) return res.status(503).json({ error: "Capture lifecycle state could not be reloaded" });
  res.set("Cache-Control", "no-store");
  return res.status(inspected.value.lifecycle_complete ? 200 : 202).json({
    schema_version: "completed_capture_lifecycle_inspection.v1",
    session_id: record.session_id,
    intake_id: record.request.intake_id,
    ...completedCaptureLifecycleProjection(refreshed.record),
  });
});

router.post("/:sessionId/parts/:partNumber/authorize", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const record = result.record;
  const partNumber = Number(req.params.partNumber);
  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > record.expected_part_count
  ) {
    return res.status(400).json({ error: "Capture part number is outside the upload plan" });
  }
  if (!["upload_pending", "uploading"].includes(record.status) || !record.provider_file_id) {
    return res.status(409).json({ error: "Capture upload is not accepting parts" });
  }
  try {
    const authorization = await authorizeBackblazeCapturePart(record.provider_file_id);
    await db!.collection("captureUploadSessions").doc(record.session_id).set(
      { status: "uploading", updated_at_iso: new Date().toISOString() },
      { merge: true },
    );
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "capture_upload_part_authorization.v1",
      session_id: record.session_id,
      part_number: partNumber,
      part_size_bytes: record.part_size_bytes,
      upload_url: authorization.uploadUrl,
      authorization_token: authorization.authorizationToken,
      expires_at_iso: authorization.expiresAtIso,
      required_headers: [
        "Authorization",
        "Content-Length",
        "X-Bz-Part-Number",
        "X-Bz-Content-Sha1",
      ],
    });
  } catch (error) {
    logger.error({ sessionId: record.session_id, partNumber, err: error }, "Failed to authorize capture part");
    return res.status(502).json({ error: "Capture part authorization failed" });
  }
});

function validateProviderParts(record: SessionRecord, parts: StoredCapturePart[], hashes: string[]) {
  const blockers: string[] = [];
  if (parts.length !== record.expected_part_count || hashes.length !== record.expected_part_count) {
    blockers.push("capture_part_count_mismatch");
  }
  let total = 0;
  for (let index = 0; index < record.expected_part_count; index += 1) {
    const part = parts[index];
    const expectedNumber = index + 1;
    const expectedLength = index === record.expected_part_count - 1
      ? record.request.original_file.size_bytes - record.part_size_bytes * index
      : record.part_size_bytes;
    if (!part || part.partNumber !== expectedNumber) {
      blockers.push(`capture_part_missing_or_out_of_order:${expectedNumber}`);
      continue;
    }
    total += part.contentLength;
    if (part.contentLength !== expectedLength) {
      blockers.push(`capture_part_size_mismatch:${expectedNumber}`);
    }
    if (part.contentSha1 !== hashes[index]) {
      blockers.push(`capture_part_sha1_mismatch:${expectedNumber}`);
    }
  }
  if (total !== record.request.original_file.size_bytes) {
    blockers.push("capture_total_size_mismatch");
  }
  return [...new Set(blockers)].sort();
}

router.post("/:sessionId/complete", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const parsed = completionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Capture completion request is invalid" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const record = result.record;
  if (record.status === "uploaded_verification_pending") {
    const processed = await processCompletedCaptureIntake(record);
    return res.status(200).json({ ...publicSession(processed), already_complete: true });
  }
  if (!["upload_pending", "uploading"].includes(record.status) || !record.provider_file_id) {
    return res.status(409).json({ error: "Capture upload cannot be completed from its current state" });
  }
  try {
    const parts = (await listBackblazeCaptureParts(record.provider_file_id))
      .sort((left, right) => left.partNumber - right.partNumber);
    const blockers = validateProviderParts(record, parts, parsed.data.part_sha1_array);
    if (blockers.length) {
      return res.status(422).json({ error: "Capture upload parts are incomplete or mismatched", blockers });
    }
    try {
      await finishBackblazeResumableCapture({
        fileId: record.provider_file_id,
        partSha1Array: parsed.data.part_sha1_array,
      });
    } catch (finishError) {
      const info = await getBackblazeCaptureFileInfo(record.provider_file_id);
      if (
        info.action !== "upload" ||
        info.fileName !== record.object_path ||
        info.contentLength !== record.request.original_file.size_bytes
      ) {
        throw finishError;
      }
    }
    const completed: SessionRecord = {
      ...record,
      status: "uploaded_verification_pending",
      upload_validation: {
        status: "provider_parts_verified",
        part_count: parts.length,
        size_bytes: parts.reduce((sum, part) => sum + part.contentLength, 0),
      },
      malware_content_validation: { status: "pending" },
      content_addressing: { status: "pending_server_sha256_verification" },
      updated_at_iso: new Date().toISOString(),
      error: null,
    };
    await db!.collection("captureUploadSessions").doc(record.session_id).set(completed, { merge: false });
    const processed = await processCompletedCaptureIntake(completed);
    return res.status(200).json(publicSession(processed, parts));
  } catch (error) {
    logger.error({ sessionId: record.session_id, err: error }, "Failed to complete capture upload");
    return res.status(502).json({ error: "Capture storage provider could not finalize the upload" });
  }
});

router.post("/:sessionId/process", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  if (result.record.status !== "uploaded_verification_pending") {
    return res.status(409).json({ error: "Capture upload bytes are not ready for Pipeline intake" });
  }
  const processed = await processCompletedCaptureIntake(result.record);
  return res.status(200).json(publicSession(processed));
});

router.delete("/:sessionId", async (req, res) => {
  const user = authenticatedUser(res);
  if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
  const result = await readOwnedSession(req.params.sessionId, user.uid);
  if (!result.record) return res.status(result.status).json({ error: "Capture upload not found" });
  const record = result.record;
  if (record.status === "cancelled") return res.status(200).json(publicSession(record));
  if (record.status === "uploaded_verification_pending") {
    return res.status(409).json({ error: "Completed capture uploads require the revocation workflow" });
  }
  if (record.provider_file_id) {
    try {
      await cancelBackblazeResumableCapture(record.provider_file_id);
    } catch (error) {
      logger.error({ sessionId: record.session_id, err: error }, "Failed to cancel capture upload");
      return res.status(502).json({ error: "Capture storage provider could not cancel the upload" });
    }
  }
  const cancelled: SessionRecord = {
    ...record,
    status: "cancelled",
    updated_at_iso: new Date().toISOString(),
  };
  await db!.collection("captureUploadSessions").doc(record.session_id).set(cancelled, { merge: false });
  return res.status(200).json(publicSession(cancelled));
});

export default router;
