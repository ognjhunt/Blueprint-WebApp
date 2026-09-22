/**
 * A site filming its own workcell with the Blueprint app or App Clip.
 *
 * The phone records a Raw Contract V3.2 bundle (ARKit poses, intrinsics,
 * timestamps for every frame, plus depth, confidence and mesh when it has
 * LiDAR) and uploads it through the same capture link the browser recorder
 * uses. The link is the only credential.
 *
 * The split of authority, which everything below exists to hold:
 *
 * - **The phone owns what it observed**: the video, the ARKit sidecars, the
 *   synchronization and retention ledgers, the downstream candidate manifest and
 *   the device fields of the manifest. It uploads those, create-only, straight
 *   to storage.
 * - **The server owns who asked, what was granted and what the task is**:
 *   `manifest.json` (device fields plus request identity, rights, task context
 *   and the `site_self_capture` marker), `rights_consent.json`,
 *   `capture_context.json`, `intake_packet.json`, `task_hypothesis.json`,
 *   `provenance.json`, `hashes.json` and the completion marker. A device may
 *   never write any of these, and a device manifest may never carry a server
 *   field.
 *
 * This module is pure: plan validation, the rights binding, and composition of
 * the server-owned files. Storage and the route live elsewhere.
 */

import { createHash } from "node:crypto";

import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

export const SITE_CAPTURE_BUNDLE_PLAN_SCHEMA = "site_capture_bundle_plan.v1";
export const SITE_CAPTURE_BINDING_SCHEMA = "site_capture_binding.v1";
export const SITE_SELF_CAPTURE_SCHEMA = "site_self_capture.v1";
export const SITE_CAPTURE_COMPLETION_SCHEMA = "site_capture_bundle_completion.v1";

export const BUNDLE_VIDEO_PATH = "walkthrough.mov";
export const COMPLETION_MARKER_PATH = "capture_upload_complete.json";
export const HASHES_PATH = "hashes.json";
export const PROVENANCE_PATH = "provenance.json";
export const DOWNSTREAM_CANDIDATE_MANIFEST_PATH = "downstream_candidate_manifest.json";

/** Written by the server only. A plan naming any of these is refused. */
export const SERVER_OWNED_PATHS = [
  "manifest.json",
  PROVENANCE_PATH,
  "rights_consent.json",
  "capture_context.json",
  "intake_packet.json",
  "task_hypothesis.json",
  HASHES_PATH,
  COMPLETION_MARKER_PATH,
] as const;

const SERVER_OWNED_PATH_SET = new Set<string>(SERVER_OWNED_PATHS);

/**
 * Device files the Raw V3.2 iPhone layout allows, by exact path. Everything a
 * phone may upload is on this list or matches a pattern below; nothing else
 * reaches storage through a signed URL.
 */
const DEVICE_EXACT_PATHS = new Set<string>([
  BUNDLE_VIDEO_PATH,
  "motion.jsonl",
  "recording_session.json",
  "capture_topology.json",
  "route_anchors.json",
  "checkpoint_events.json",
  "relocalization_events.json",
  "overlap_graph.json",
  "video_track.json",
  "video_frame_retention.jsonl",
  DOWNSTREAM_CANDIDATE_MANIFEST_PATH,
  "sync_map.jsonl",
  "semantic_anchor_observations.jsonl",
  "semantic_anchors.json",
  "reconstruction_qualification_request.json",
  "device_calibration.json",
  "arkit/poses.jsonl",
  "arkit/frames.jsonl",
  "arkit/frame_quality.jsonl",
  "arkit/session_intrinsics.json",
  "arkit/intrinsics.json",
  "arkit/per_frame_camera_state.jsonl",
  "arkit/feature_points.jsonl",
  "arkit/plane_observations.jsonl",
  "arkit/light_estimates.jsonl",
  "arkit/depth_manifest.json",
  "arkit/confidence_manifest.json",
  "arkit/mesh_manifest.json",
]);

const DEVICE_PATH_PATTERNS = [
  /^arkit\/depth\/\d{6}\.png$/,
  /^arkit\/confidence\/\d{6}\.png$/,
  /^arkit\/meshes\/mesh-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\.obj$/,
];

/** Always required from the device, on top of the server-owned files. */
const REQUIRED_DEVICE_PATHS = [
  BUNDLE_VIDEO_PATH,
  "recording_session.json",
  "capture_topology.json",
  "route_anchors.json",
  "checkpoint_events.json",
  "relocalization_events.json",
  "overlap_graph.json",
  "video_track.json",
  "video_frame_retention.jsonl",
  DOWNSTREAM_CANDIDATE_MANIFEST_PATH,
  "sync_map.jsonl",
  "semantic_anchor_observations.jsonl",
  "arkit/poses.jsonl",
  "arkit/frames.jsonl",
  "arkit/frame_quality.jsonl",
  "arkit/session_intrinsics.json",
  "arkit/intrinsics.json",
  "arkit/per_frame_camera_state.jsonl",
];

/**
 * Manifest keys the device reports. The server returns this list with the link
 * so the phone filters its manifest to it; anything outside it is refused
 * rather than silently dropped.
 */
export const DEVICE_MANIFEST_KEYS = [
  "schema_version",
  "capture_schema_version",
  "scene_id",
  "capture_id",
  "video_uri",
  "device_model",
  "device_model_marketing",
  "os_version",
  "ios_version",
  "ios_build",
  "app_version",
  "app_build",
  "hardware_model_identifier",
  "fps_source",
  "width",
  "height",
  "capture_start_epoch_ms",
  "has_lidar",
  "depth_supported",
  "capture_source",
  "capture_tier_hint",
  "recording_session_id",
  "coordinate_frame_session_id",
  "scale_hint_m_per_unit",
  "site_type",
  "site_type_source",
  "intended_space_type",
  "device_health",
  "site_extent",
  "site_extent_status",
  "site_extent_source",
  "approx_floor_area_m2",
  "ceiling_height_m",
  "floor_count",
  "dominant_aisle_width_m",
  "site_scale_class",
  "exposure_samples",
  "camera_intrinsics",
  "exposure_settings",
  "device_camera",
  "device_imu_unavailable_reason",
  "capture_modality",
  "capture_profile_id",
  "scaffolding_used",
  "coverage_plan",
  "calibration_assets",
  "scaffolding_validation",
  "uncertainty_priors",
  "scene_memory_capture",
  "capture_evidence",
  "capture_capabilities",
  "capture_topology",
  "device_calibration_uri",
  "reconstruction_qualification_request_uri",
  "downstream_candidate_manifest_uri",
  "arkit_mesh_manifest_uri",
  "color_space",
  "video_codec",
] as const;

const DEVICE_MANIFEST_KEY_SET = new Set<string>(DEVICE_MANIFEST_KEYS);

const ALLOWED_PROFILES = new Set(["iphone_arkit_lidar", "iphone_arkit_non_lidar"]);
const DEVICE_IMU_UNAVAILABLE_REASONS = new Set(["app_clip_runtime"]);

export const SITE_CAPTURE_REQUESTED_OUTPUTS = ["qualification"];

export type BundleClient = "ios_app_clip" | "ios_app";

export interface BundleFileEntry {
  path: string;
  bytes: number;
  /** Lowercase hex, as `hashes.json` records it. */
  sha256: string;
  /** Base64 of the 16-byte digest, as Cloud Storage reports `md5Hash`. */
  md5: string;
}

export interface BundleLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxSidecarBytes: number;
}

export interface BundleTarget {
  sceneId: string;
  captureId: string;
  rawPrefix: string;
}

export function bundleLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): BundleLimits {
  const positive = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  };
  return {
    maxFiles: positive(env.SELF_CAPTURE_MAX_BUNDLE_FILES, 20_000),
    maxTotalBytes: positive(env.SELF_CAPTURE_MAX_BUNDLE_BYTES, 2 * 1024 * 1024 * 1024),
    maxSidecarBytes: positive(env.SELF_CAPTURE_MAX_BUNDLE_SIDECAR_BYTES, 256 * 1024 * 1024),
  };
}

export function rawPrefixFor(sceneId: string, captureId: string): string {
  return `scenes/${sceneId}/captures/${captureId}/raw`;
}

/** Where the immutable plan and completion record live: beside raw/, never in it. */
export function uploadRecordPrefixFor(sceneId: string, captureId: string): string {
  return `scenes/${sceneId}/captures/${captureId}/upload`;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function md5Base64(data: string | Buffer): string {
  return createHash("md5").update(data).digest("base64");
}

/* ------------------------------------------------------------ paths */

export function isServerOwnedPath(path: string): boolean {
  return SERVER_OWNED_PATH_SET.has(path);
}

/** Why a path may not be uploaded by a device, or null when it may. */
export function devicePathViolation(path: unknown): string | null {
  if (typeof path !== "string" || !path) return "path_missing";
  if (path.length > 200) return "path_too_long";
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return "path_not_relative";
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return "path_traversal";
  }
  if (segments.some((segment) => segment.startsWith("."))) return "path_hidden";
  if (isServerOwnedPath(path)) return "path_server_owned";
  if (DEVICE_EXACT_PATHS.has(path)) return null;
  if (DEVICE_PATH_PATTERNS.some((pattern) => pattern.test(path))) return null;
  return "path_not_in_raw_v32_layout";
}

/* ------------------------------------------------------------ binding */

/**
 * The server values the phone must bind into device files before it hashes
 * them: the downstream candidate manifest's use scope carries rights, requested
 * outputs and privacy limits. Snapshotted at plan time; a plan made against a
 * different binding is refused so the phone can re-finalize before uploading.
 */
export function projectSiteCaptureBinding(input: {
  requestId: string;
  target: BundleTarget;
  captureRights: ReturnType<typeof projectWebsiteCaptureRights>;
}) {
  const binding = {
    schema_version: SITE_CAPTURE_BINDING_SCHEMA,
    request_id: input.requestId,
    scene_id: input.target.sceneId,
    capture_id: input.target.captureId,
    requested_outputs: [...SITE_CAPTURE_REQUESTED_OUTPUTS],
    capture_rights: {
      derived_scene_generation_allowed: input.captureRights.derived_scene_generation_allowed === true,
      data_licensing_allowed: input.captureRights.data_licensing_allowed === true,
      redaction_required: true,
    },
    privacy_security_limits: [] as string[],
  };
  return { binding, binding_digest: crossRuntimeDigest(binding) };
}

export type SiteCaptureBinding = ReturnType<typeof projectSiteCaptureBinding>["binding"];

/* ------------------------------------------------------------ plan */

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
  files: BundleFileEntry[];
  totalBytes: number;
}

const HEX64 = /^[0-9a-f]{64}$/;
const MD5_BASE64 = /^[A-Za-z0-9+/]{22}==$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * The declared-absence rule for the device IMU, identical to the Raw V3.2
 * validators: motion.jsonl is required unless the manifest declares the IMU
 * unavailable with an allowed reason, and then it must be absent.
 */
function deviceImuRequiresMotion(
  capabilities: Record<string, unknown>,
  errors: string[],
): boolean {
  const declared = capabilities.device_imu;
  if (declared !== undefined && typeof declared !== "boolean") {
    errors.push("device_imu_capability_invalid");
    return true;
  }
  if (declared !== false) {
    if (capabilities.device_imu_unavailable_reason !== undefined
      && capabilities.device_imu_unavailable_reason !== null) {
      errors.push("device_imu_unavailable_reason_without_declaration");
    }
    return true;
  }
  const reason = capabilities.device_imu_unavailable_reason;
  if (typeof reason !== "string" || !DEVICE_IMU_UNAVAILABLE_REASONS.has(reason)) {
    errors.push("device_imu_unavailable_reason_invalid");
  }
  if (capabilities.motion === true || capabilities.motion_authoritative === true) {
    errors.push("false_claim:motion_with_device_imu_unavailable");
  }
  if (capabilities.motion_samples !== undefined && capabilities.motion_samples !== null
    && capabilities.motion_samples !== 0) {
    errors.push("false_claim:motion_samples_with_device_imu_unavailable");
  }
  return false;
}

export function validateDeviceManifest(
  manifest: unknown,
  target: BundleTarget,
): { ok: boolean; errors: string[]; manifest: Record<string, unknown>; motionRequired: boolean; depthDeclared: boolean } {
  const errors: string[] = [];
  const record = asRecord(manifest);
  if (!record) {
    return { ok: false, errors: ["device_manifest_missing"], manifest: {}, motionRequired: true, depthDeclared: false };
  }
  const unknownKeys = Object.keys(record).filter((key) => !DEVICE_MANIFEST_KEY_SET.has(key)).sort();
  for (const key of unknownKeys) errors.push(`device_manifest_key_not_allowed:${key}`);

  if (record.schema_version !== "v3") errors.push("device_manifest_schema_version_not_v3");
  if (record.capture_schema_version !== "3.2.0") errors.push("device_manifest_capture_schema_not_3_2_0");
  if (record.capture_source !== "iphone") errors.push("device_manifest_capture_source_not_iphone");
  if (!ALLOWED_PROFILES.has(String(record.capture_profile_id))) {
    errors.push("device_manifest_capture_profile_invalid");
  }
  if (record.scene_id !== target.sceneId) errors.push("device_manifest_scene_id_mismatch");
  if (record.capture_id !== target.captureId) errors.push("device_manifest_capture_id_mismatch");
  if (record.video_uri !== BUNDLE_VIDEO_PATH) errors.push("device_manifest_video_uri_invalid");
  for (const key of [
    "coordinate_frame_session_id",
    "capture_tier_hint",
    "app_version",
    "app_build",
    "ios_version",
    "ios_build",
    "hardware_model_identifier",
    "device_model_marketing",
  ]) {
    if (!nonEmptyString(record[key])) errors.push(`device_manifest_missing_string:${key}`);
  }
  for (const key of ["capture_start_epoch_ms", "width", "height"]) {
    if (!positiveInteger(record[key])) errors.push(`device_manifest_missing_integer:${key}`);
  }
  if (!(typeof record.fps_source === "number" && Number.isFinite(record.fps_source) && record.fps_source > 0)) {
    errors.push("device_manifest_missing_number:fps_source");
  }
  for (const key of ["has_lidar", "depth_supported"]) {
    if (typeof record[key] !== "boolean") errors.push(`device_manifest_missing_boolean:${key}`);
  }
  if (record.capture_profile_id === "iphone_arkit_lidar" && record.has_lidar !== true) {
    errors.push("device_manifest_lidar_profile_without_lidar");
  }
  const capabilities = asRecord(record.capture_capabilities);
  if (!capabilities) errors.push("device_manifest_missing_object:capture_capabilities");
  const motionRequired = deviceImuRequiresMotion(capabilities ?? {}, errors);
  if (motionRequired && record.device_imu_unavailable_reason !== undefined) {
    errors.push("device_imu_unavailable_reason_without_declaration");
  }
  const depthDeclared = record.depth_supported === true || capabilities?.depth === true;
  return { ok: errors.length === 0, errors, manifest: record, motionRequired, depthDeclared };
}

export function validateBundlePlan(input: {
  files: unknown;
  limits: BundleLimits;
  motionRequired: boolean;
  depthDeclared: boolean;
}): PlanValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(input.files) || input.files.length === 0) {
    return { ok: false, errors: ["plan_files_missing"], files: [], totalBytes: 0 };
  }
  if (input.files.length > input.limits.maxFiles) {
    return { ok: false, errors: ["plan_too_many_files"], files: [], totalBytes: 0 };
  }
  const files: BundleFileEntry[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const raw of input.files) {
    const entry = asRecord(raw);
    const path = entry?.path;
    const violation = devicePathViolation(path);
    if (violation) {
      errors.push(`${violation}:${typeof path === "string" ? path.slice(0, 200) : "?"}`);
      continue;
    }
    const filePath = path as string;
    if (seen.has(filePath)) {
      errors.push(`path_duplicate:${filePath}`);
      continue;
    }
    seen.add(filePath);
    const bytes = entry!.bytes;
    if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0) {
      errors.push(`file_bytes_invalid:${filePath}`);
      continue;
    }
    if (filePath === BUNDLE_VIDEO_PATH ? bytes <= 0 : bytes > input.limits.maxSidecarBytes) {
      errors.push(`file_bytes_out_of_range:${filePath}`);
      continue;
    }
    const sha256 = entry!.sha256;
    const md5 = entry!.md5;
    if (typeof sha256 !== "string" || !HEX64.test(sha256)) {
      errors.push(`file_sha256_invalid:${filePath}`);
      continue;
    }
    if (typeof md5 !== "string" || !MD5_BASE64.test(md5)) {
      errors.push(`file_md5_invalid:${filePath}`);
      continue;
    }
    totalBytes += bytes;
    files.push({ path: filePath, bytes, sha256, md5 });
  }
  if (totalBytes > input.limits.maxTotalBytes) errors.push("plan_too_large");
  for (const required of REQUIRED_DEVICE_PATHS) {
    if (!seen.has(required)) errors.push(`required_file_missing:${required}`);
  }
  if (input.motionRequired && !seen.has("motion.jsonl")) {
    errors.push("required_file_missing:motion.jsonl");
  }
  if (!input.motionRequired && seen.has("motion.jsonl")) {
    errors.push("device_imu_declared_unavailable_but_motion_present");
  }
  if (input.depthDeclared) {
    for (const required of ["arkit/depth_manifest.json", "arkit/confidence_manifest.json"]) {
      if (!seen.has(required)) errors.push(`required_file_missing:${required}`);
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { ok: errors.length === 0, errors, files, totalBytes };
}

/**
 * The immutable plan record. Its digest is what a repeated `POST /bundle` must
 * match: the same files with the same bytes, the same device manifest and the
 * same binding. Anything else is a different upload and is refused.
 */
export function buildPlanRecord(input: {
  requestId: string;
  target: BundleTarget;
  client: BundleClient;
  files: BundleFileEntry[];
  deviceManifest: Record<string, unknown>;
  binding: SiteCaptureBinding;
  bindingDigest: string;
  linkScope: "owner" | "film";
  /**
   * Rights as they stood when the plan was accepted — the moment the phone
   * bound them into its files. Recorded beside the plan, not inside its
   * digest, so a retried identical plan stays identical. The bundle states
   * rights at capture; downstream still checks the latest status.
   */
  authoritySnapshot: {
    captureRights: ReturnType<typeof projectWebsiteCaptureRights>;
    consentAttestation: { granted?: unknown; statement_version?: unknown; recorded_at_iso?: unknown } | null;
  };
  createdAtIso: string;
}) {
  const plan = {
    schema_version: SITE_CAPTURE_BUNDLE_PLAN_SCHEMA,
    request_id: input.requestId,
    scene_id: input.target.sceneId,
    capture_id: input.target.captureId,
    raw_prefix: input.target.rawPrefix,
    client: input.client,
    files: input.files,
    device_manifest: input.deviceManifest,
    binding: input.binding,
    binding_digest: input.bindingDigest,
  };
  const planDigest = crossRuntimeDigest(plan);
  return {
    ...plan,
    plan_digest: planDigest,
    link_scope: input.linkScope,
    authority_snapshot: {
      capture_rights: input.authoritySnapshot.captureRights,
      consent_attestation: input.authoritySnapshot.consentAttestation
        ? {
            granted: input.authoritySnapshot.consentAttestation.granted === true,
            statement_version: input.authoritySnapshot.consentAttestation.statement_version ?? null,
            recorded_at_iso: input.authoritySnapshot.consentAttestation.recorded_at_iso ?? null,
          }
        : null,
    },
    created_at_iso: input.createdAtIso,
  };
}

export type BundlePlanRecord = ReturnType<typeof buildPlanRecord>;

export function planDigestOf(record: BundlePlanRecord): string {
  const {
    plan_digest: _digest,
    link_scope: _scope,
    authority_snapshot: _authority,
    created_at_iso: _created,
    ...plan
  } = record;
  return crossRuntimeDigest(plan);
}

/* ------------------------------------------------------------ downstream candidate manifest */

/**
 * The downstream candidate manifest is a device file, but it carries server
 * values in its use scope. Verify they are exactly the plan's binding before
 * anything server-authored is written next to it.
 */
export function downstreamCandidateBindingErrors(
  candidateManifest: unknown,
  binding: SiteCaptureBinding,
): string[] {
  const record = asRecord(candidateManifest);
  if (!record) return ["downstream_candidate_manifest_unreadable"];
  const errors: string[] = [];
  if (record.scene_id !== binding.scene_id) errors.push("downstream_candidate_scene_id_mismatch");
  if (record.capture_id !== binding.capture_id) errors.push("downstream_candidate_capture_id_mismatch");
  if (record.source_video_uri !== BUNDLE_VIDEO_PATH) {
    errors.push("downstream_candidate_source_video_uri_mismatch");
  }
  const scope = asRecord(record.allowed_use_scope);
  if (!scope) return [...errors, "downstream_candidate_use_scope_missing"];
  if (scope.derived_processing_allowed !== binding.capture_rights.derived_scene_generation_allowed) {
    errors.push("downstream_candidate_derived_processing_binding_mismatch");
  }
  if (scope.data_licensing_allowed !== binding.capture_rights.data_licensing_allowed) {
    errors.push("downstream_candidate_data_licensing_binding_mismatch");
  }
  if (scope.redaction_required_before_derived_use !== true) {
    errors.push("downstream_candidate_redaction_binding_mismatch");
  }
  if (crossRuntimeDigest(scope.requested_outputs ?? null) !== crossRuntimeDigest(binding.requested_outputs)) {
    errors.push("downstream_candidate_requested_outputs_binding_mismatch");
  }
  if (crossRuntimeDigest(scope.privacy_security_limits ?? null)
    !== crossRuntimeDigest(binding.privacy_security_limits)) {
    errors.push("downstream_candidate_privacy_limits_binding_mismatch");
  }
  return errors;
}

/* ------------------------------------------------------------ server-owned files */

export interface SiteTaskBriefSnapshot {
  summary: string;
  confirmedAtIso: string | null;
}

export interface CompletionInput {
  plan: BundlePlanRecord;
  /** Read at completion: a site may confirm its brief after it uploads. */
  brief: SiteTaskBriefSnapshot | null;
  bucket: string;
  completedAtIso: string;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isoFromEpochMs(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

/**
 * What the site told us the job is. A confirmed brief is the site's own
 * attestation and makes a complete intake: the confirmed one-line task as the
 * workflow and its single step, owned by the site operator. An unconfirmed
 * brief stays honestly incomplete — nothing is filled in to pass a gate.
 */
export function projectSiteIntake(brief: SiteTaskBriefSnapshot | null) {
  const confirmed = Boolean(brief?.confirmedAtIso && brief.summary.trim());
  const summary = brief?.summary.trim() ?? "";
  const intake = {
    schema_version: "v1",
    workflow_name: confirmed ? summary : null,
    task_steps: confirmed ? [summary] : [],
    target_kpi: null,
    zone: null,
    shift: null,
    owner: confirmed ? "site_operator" : null,
    required_coverage_areas: [] as string[],
    privacy_security_limits: [] as string[],
    capture_restrictions: [] as string[],
    source: confirmed
      ? "confirmed_site_task_brief"
      : brief
        ? "unconfirmed_site_task_brief"
        : "no_site_task_brief",
    confirmed_at: confirmed ? brief!.confirmedAtIso : null,
  };
  const hypothesis = {
    schema_version: "v1",
    workflow_name: intake.workflow_name,
    task_steps: intake.task_steps,
    target_kpi: null,
    zone: null,
    owner: intake.owner,
    confidence: null,
    source: confirmed ? "authoritative" : "unconfirmed_site_task_brief",
    model: null,
    fps: null,
    warnings: confirmed ? [] : ["site_task_brief_not_confirmed"],
    status: confirmed ? "accepted" : "needs_confirmation",
  };
  return { confirmed, intake, hypothesis };
}

function consentStatusFor(rights: ReturnType<typeof projectWebsiteCaptureRights>): string {
  if (rights.consent_status === "granted") return "documented";
  if (rights.consent_status === "revoked") return "revoked";
  return "unknown";
}

function rightsProfileFor(rights: ReturnType<typeof projectWebsiteCaptureRights>): string {
  return rights.consent_status === "granted"
    ? `website_site_operator_attestation:${rights.statement_version}`
    : "website_site_operator_attestation_absent";
}

/**
 * Compose every server-owned file, the hash manifest and the marker.
 *
 * Deterministic in its inputs: a held capture that clears later has its
 * `hashes.json` and marker written from this same composition, byte for byte.
 * `hashes.json` covers every raw file but itself, the marker included, with
 * bare hex digests; the upload identity is `sha256:`-prefixed.
 */
export function composeServerFiles(input: CompletionInput) {
  const { plan } = input;
  const binding = plan.binding;
  const requestId = plan.request_id;
  const sceneId = plan.scene_id;
  const captureId = plan.capture_id;
  const device = plan.device_manifest;
  const rights = plan.authority_snapshot.capture_rights;
  const { confirmed, intake, hypothesis } = projectSiteIntake(input.brief);
  const lidarProfile = device.capture_profile_id === "iphone_arkit_lidar";
  const evidenceTier = lidarProfile && confirmed ? "qualified_metric_capture" : "pre_screen_video";
  const upstreamHandoff = {
    site_submission_id: requestId,
    buyer_request_id: null,
    capture_job_id: null,
    site_submission_id_present: true,
    buyer_request_id_present: false,
    capture_job_id_present: false,
    hosted_review_truth_state: "blocked_missing_upstream_ids",
    blockers: ["missing_buyer_request_id", "missing_capture_job_id"],
  };
  const siteSelfCapture = {
    schema_version: SITE_SELF_CAPTURE_SCHEMA,
    authored_by: "blueprint_webapp",
    site_filmed_itself: true,
    capture_job_exists: false,
    request_id: requestId,
    client: plan.client,
    link_scope: plan.link_scope,
  };
  const captureRights = {
    ...rights,
    derived_scene_generation_allowed: binding.capture_rights.derived_scene_generation_allowed,
    data_licensing_allowed: binding.capture_rights.data_licensing_allowed,
    redaction_required: true,
    mobile_app_direct_provider_upload_allowed: false,
    third_party_provider_upload_authorized: false,
    provider_selection_authority: "blueprint_pipeline",
    latest_revocation_check_required_before_downstream_use: true,
  };
  const siteTaskContext = {
    schema_version: "website_site_task_context.v1",
    request_id: requestId,
    description: input.brief?.summary ?? "",
    confirmed,
    confirmed_at: confirmed ? input.brief!.confirmedAtIso : null,
  };

  const manifest = {
    ...device,
    site_submission_id: requestId,
    request_id: requestId,
    buyer_request_id: null,
    capture_job_id: null,
    upstream_handoff: upstreamHandoff,
    rights_profile: rightsProfileFor(rights),
    requested_outputs: [...binding.requested_outputs],
    capture_rights: captureRights,
    site_task_context: siteTaskContext,
    site_self_capture: siteSelfCapture,
    evidence_tier: evidenceTier,
    task_text_hint: intake.workflow_name,
    task_steps: intake.task_steps,
    target_kpi: null,
    zone: null,
    shift: null,
    owner: intake.owner,
    capture_profile: {
      facility_template: null,
      required_coverage_areas: [],
      benchmark_stations: [],
      adjacent_systems: [],
      privacy_security_limits: [],
      known_blockers: [],
      non_routine_modes: [],
      people_traffic_notes: [],
      capture_restrictions: [],
    },
    environment_variability: {
      lighting_windows: [],
      shift_traffic_windows: [],
      movable_obstacles: [],
      floor_condition_notes: [],
      reflective_surface_notes: [],
      access_rules: [],
    },
  };

  const attestation = plan.authority_snapshot.consent_attestation;
  const granted = rights.consent_status === "granted";
  const attestationRecord = granted && attestation
    ? {
        granted: attestation.granted === true,
        statement_version: attestation.statement_version ?? null,
        recorded_at_iso: attestation.recorded_at_iso ?? null,
      }
    : null;
  const rightsConsent = {
    schema_version: "v1",
    scene_id: sceneId,
    capture_id: captureId,
    consent_status: consentStatusFor(rights),
    capture_basis: granted ? "site_operator_permission" : "unknown",
    derived_scene_generation_allowed: binding.capture_rights.derived_scene_generation_allowed,
    data_licensing_allowed: binding.capture_rights.data_licensing_allowed,
    capture_contributor_payout_eligible: false,
    permission_document_uri: attestationRecord
      ? `firestore://inboundRequests/${requestId}#request.consent_attestation`
      : null,
    permission_document_sha256: attestationRecord ? sha256Hex(stableJson(attestationRecord)) : null,
    permission_document_kind: attestationRecord ? "website_site_operator_consent_attestation" : null,
    consent_scope: rights.consent_scope,
    consent_notes: [],
    redaction_required: true,
    retention_policy: "standard_blueprint_site_capture",
    privacy_processing: {
      redaction_required: true,
      privacy_security_limits: [],
      restricted_capture_areas: [],
      raw_media_contains_unredacted_observations: true,
      derived_use_requires_privacy_preprocessing: true,
      privacy_authority: "website_upload_privacy_screen_and_downstream_policy",
    },
    provider_upload: {
      mobile_app_direct_provider_upload_allowed: false,
      third_party_provider_upload_authorized: false,
      allowed_mobile_destination_class: "blueprint_first_party_capture_storage_only",
      provider_selection_authority: "blueprint_pipeline",
      provider_authorization_status: "separate_downstream_gate_required",
      capture_manifest_cannot_authorize_provider: true,
    },
    retention: {
      policy_id: "blueprint_raw_capture_lifecycle_2026-07-09",
      policy_reference: "BlueprintCapture docs/STORAGE_RETENTION_POLICY_2026-07-09.md",
      review_window_days: 30,
      archive_after_days: 365,
      routine_delete_rule_present: false,
      minimum_retention_floor_days_if_delete_is_ever_introduced: 2555,
      raw_truth_preserved: true,
      live_enforcement_proven_by_bundle: false,
    },
    revocation: {
      status_at_capture: rights.consent_revoked ? "revoked" : "no_revocation_record_at_capture",
      revocation_requested_at: null,
      revocation_effective_at: null,
      latest_status_check_required_before_downstream_use: true,
      revocation_authority: "blueprint_backend_and_authoritative_rights_records",
      provider_upload_blocked_until_latest_status_check: true,
      raw_retention_effect: "subject_to_authoritative_policy_and_legal_process",
    },
  };

  const captureContext = {
    schema_version: "v1",
    scene_id: sceneId,
    capture_id: captureId,
    site_submission_id: requestId,
    buyer_request_id: null,
    capture_job_id: null,
    upstream_handoff: upstreamHandoff,
    region_id: null,
    capture_source: "iphone",
    requested_outputs: [...binding.requested_outputs],
    capture_modality: device.capture_modality ?? null,
    capture_profile_id: device.capture_profile_id,
    evidence_tier: evidenceTier,
    intake_present: confirmed,
    intake_source: intake.source,
    task_hypothesis_status: hypothesis.status,
    task_text_hint: intake.workflow_name,
    task_steps: intake.task_steps,
    scene_memory_capture: device.scene_memory_capture ?? {},
    capture_evidence: device.capture_evidence ?? {},
    capture_capabilities: device.capture_capabilities ?? {},
    capture_topology: device.capture_topology ?? null,
    capture_rights: {
      consent_status: rightsConsent.consent_status,
      derived_scene_generation_allowed: rightsConsent.derived_scene_generation_allowed,
      data_licensing_allowed: rightsConsent.data_licensing_allowed,
      capture_contributor_payout_eligible: false,
      redaction_required: true,
    },
    site_self_capture: siteSelfCapture,
    captured_at: isoFromEpochMs(device.capture_start_epoch_ms),
  };

  const serverFiles: Record<string, string> = {
    "manifest.json": stableJson(manifest),
    "rights_consent.json": stableJson(rightsConsent),
    "capture_context.json": stableJson(captureContext),
    "intake_packet.json": stableJson(intake),
    "task_hypothesis.json": stableJson(hypothesis),
  };

  const artifactHashes: Record<string, string> = {};
  for (const file of plan.files) artifactHashes[file.path] = file.sha256;
  for (const [path, content] of Object.entries(serverFiles)) artifactHashes[path] = sha256Hex(content);

  // Provenance names the bundle as it stood without itself and the hash
  // manifest, and says so, rather than a digest over a file that contains it.
  const provenanceScopeDigest = bundleDigest(artifactHashes);
  const provenance = {
    schema_version: "v1",
    scene_id: sceneId,
    capture_id: captureId,
    capture_source: "iphone",
    captured_by_user_id: null,
    uploaded_by_user_id: null,
    captured_by_principal: {
      kind: "website_capture_link",
      request_id: requestId,
      link_scope: plan.link_scope,
    },
    capture_client: plan.client,
    capture_app_build: device.app_build ?? null,
    capture_app_version: device.app_version ?? null,
    device_installation_id: null,
    bundle_created_at: isoFromEpochMs(device.capture_start_epoch_ms),
    upload_completed_at: input.completedAtIso,
    upload_channel: "website_capture_link_bundle",
    bundle_sha256: provenanceScopeDigest,
    bundle_sha256_scope: "all_raw_files_except_provenance_json_hashes_json_and_completion_marker",
    plan_digest: plan.plan_digest,
  };
  serverFiles[PROVENANCE_PATH] = stableJson(provenance);
  artifactHashes[PROVENANCE_PATH] = sha256Hex(serverFiles[PROVENANCE_PATH]);

  const marker = stableJson({
    schema_version: "v1",
    scene_id: sceneId,
    capture_id: captureId,
    raw_prefix: plan.raw_prefix,
    completed_at: input.completedAtIso,
    status: "complete",
    capture_source: "iphone",
    video_uri: BUNDLE_VIDEO_PATH,
    upload_channel: "website_capture_link_bundle",
  });
  artifactHashes[COMPLETION_MARKER_PATH] = sha256Hex(marker);

  const sortedArtifacts = Object.fromEntries(
    Object.entries(artifactHashes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const hashesBundleDigest = bundleDigest(sortedArtifacts);
  const hashes = stableJson({
    schema_version: "v1",
    bundle_sha256: hashesBundleDigest,
    artifacts: sortedArtifacts,
  });

  const identity = {
    raw_bundle_digest: `sha256:${hashesBundleDigest}`,
    raw_manifest_uri: `gs://${input.bucket}/${plan.raw_prefix}/manifest.json`,
    upload_completion_digest: `sha256:${artifactHashes[COMPLETION_MARKER_PATH]}`,
  };

  return {
    serverFiles,
    marker,
    hashes,
    bundleSha256: hashesBundleDigest,
    identity,
    evidenceTier,
    intakeComplete: confirmed,
  };
}

export type ServerComposition = ReturnType<typeof composeServerFiles>;

/** `sha256("\n".join(f"{path}:{hex}"))` over sorted paths, as hashes.json defines it. */
export function bundleDigest(artifacts: Record<string, string>): string {
  const canonical = Object.keys(artifacts)
    .sort()
    .map((path) => `${path}:${artifacts[path]}`)
    .join("\n");
  return sha256Hex(canonical);
}

/**
 * The record kept beside raw/ so a held capture can finish later with exactly
 * the bytes it would have finished with now.
 */
export function buildCompletionRecord(plan: BundlePlanRecord, composition: ServerComposition, completedAtIso: string) {
  return {
    schema_version: SITE_CAPTURE_COMPLETION_SCHEMA,
    request_id: plan.request_id,
    scene_id: plan.scene_id,
    capture_id: plan.capture_id,
    raw_prefix: plan.raw_prefix,
    plan_digest: plan.plan_digest,
    completed_at_iso: completedAtIso,
    server_file_sha256: Object.fromEntries(
      Object.entries(composition.serverFiles).map(([path, content]) => [path, sha256Hex(content)]),
    ),
    hashes_json: composition.hashes,
    completion_marker_json: composition.marker,
    bundle_sha256: composition.bundleSha256,
    identity: composition.identity,
  };
}

export type BundleCompletionRecord = ReturnType<typeof buildCompletionRecord>;
