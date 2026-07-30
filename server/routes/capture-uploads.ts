import { createHash } from "node:crypto";
import path from "node:path";

import { Router, type Response } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  parseVerifiedTaskDiscovery,
  stableJson,
  taskDecisionCommandSchema,
} from "../utils/taskCandidateContract";
import { parseVerifiedMaintainedSiteTaskTestbed } from "../utils/siteTaskTestbedContract";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { forwardTaskCandidateDecisionToPipeline } from "../utils/taskCandidateForwarding";
import {
  authorizeBackblazeCapturePart,
  cancelBackblazeResumableCapture,
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
    intake_id: z.string().trim().min(1).max(128),
    idempotency_key: z.string().trim().min(8).max(256),
    capture_authority_profile: z.enum(webCaptureProfiles),
    source_type: z.enum(webCaptureProfiles),
    scene_id: z.string().trim().min(1).max(128),
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

type SessionRequest = z.infer<typeof sessionRequestSchema>;
type SessionRecord = Record<string, unknown> & {
  session_id: string;
  owner_user_id: string;
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
  const testbed = siteTaskTestbedProjection(record);
  const taskEvaluationRun = taskEvaluationRunProjection(record);
  return {
    schema_version: "capture_upload_session.v1",
    session_id: record.session_id,
    intake_id: record.request.intake_id,
    status: record.status,
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
    task_review: {
      status: taskReview.status,
      candidate_count: taskReview.candidateCount,
      latest_action: record.latest_task_decision_command?.action || null,
    },
    site_task_testbed: testbed.summary,
    task_evaluation_run: taskEvaluationRun.summary,
    claim_boundary: {
      capture_accepted: false,
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
      blockers: [] as string[],
    };
  }
  const parsed = parseVerifiedMaintainedSiteTaskTestbed(stored.testbed);
  if (!parsed.ok) {
    return {
      summary: { state: "pipeline_artifact_invalid" as const },
      testbed: null,
      blockers: parsed.blockers,
    };
  }
  const testbed = parsed.testbed;
  const blockers: string[] = [];
  if (stored.intake_id !== record.request.intake_id) blockers.push("testbed_intake_mismatch");
  if (stored.testbed_id !== testbed.testbed_id) blockers.push("testbed_id_mismatch");
  if (stored.version !== testbed.version) blockers.push("testbed_version_mismatch");
  if (stored.testbed_digest !== testbed.testbed_digest) blockers.push("testbed_digest_mismatch");
  if (stored.approved_task_digest !== testbed.approved_task_definition.digest) {
    blockers.push("testbed_approved_task_mismatch");
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
      proof_boundary: testbed.proof_boundary,
    },
    testbed,
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
    proof_boundary: projection.testbed.proof_boundary,
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
    return res.status(200).json({ ...publicSession(record), already_complete: true });
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
    return res.status(200).json(publicSession(completed, parts));
  } catch (error) {
    logger.error({ sessionId: record.session_id, err: error }, "Failed to complete capture upload");
    return res.status(502).json({ error: "Capture storage provider could not finalize the upload" });
  }
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
