import { createHash } from "node:crypto";
import path from "node:path";

import { Router, type Response } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
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
