import { hasCurrentRecordingConsent } from "./recordingConsent";
/**
 * What stays of the capture app's bundle upload (retired 2026-11-11): reading
 * a bundle the app stored, and finishing one whose privacy screen was held once
 * it clears. Starting, uploading and completing a bundle are gone; the
 * original sequence is kept as a test fixture (server/tests/helpers/retiredAppBundle.ts).
 *
 * The original contract, which stored bundles follow:
 *
 * Three calls after the link check: declare the plan, upload straight to
 * storage on the returned targets, complete. Completion keeps the web path's
 * order, which is load-bearing: server-owned files (the manifest first) →
 * `video_received` email → privacy screen → `hashes.json` and the completion
 * marker, last, only when the screen clears. The marker is what starts
 * extraction; nothing may be derived from footage the screen has not cleared.
 *
 * Everything is create-only and idempotent. A phone that crashed, lost its
 * connection or was relaunched calls the same endpoints again and gets the same
 * answer; a second, different plan for the same capture is refused.
 */

import { logger } from "../logger";
import type { PrivacyScreenResult } from "./capturePrivacyScreen";
import type { CapturePrivacyProducerSource, CapturePrivacyScreenClaim } from "./capturePrivacyRecord";
import type { projectWebsiteCaptureRights } from "./websiteTaskContext";
import {
  BUNDLE_VIDEO_PATH,
  COMPLETION_MARKER_PATH,
  DEVICE_MANIFEST_KEYS,
  HASHES_PATH,
  SERVER_OWNED_PATHS,
  bundleCompletionDecisionKey,
  planDigestOf,
  projectSiteCaptureBinding,
  rawPrefixFor,
  uploadRecordPrefixFor,
  type BundleClient,
  type BundleCompletionRecord,
  type BundleLimits,
  type BundlePlanRecord,
  type BundleTarget,
  type SiteTaskBriefSnapshot,
} from "./siteCaptureBundle";
import {
  type BundleStorage,
} from "./siteCaptureBundleStorage";

/** Targets per response. Keeps a 2,000-file bundle to a handful of requests. */
export const TARGETS_PER_RESPONSE = 250;
export const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

export type WebsiteCaptureRights = ReturnType<typeof projectWebsiteCaptureRights>;

export interface StoredPrivacyState {
  eligibility?: string | null;
  proceeded?: boolean | null;
  outcome?: string | null;
  detail?: string | null;
  retryable?: boolean | null;
  producer_source?: CapturePrivacyProducerSource | null;
  screened_at_iso?: string | null;
}

export interface BundleServiceDeps {
  storage: BundleStorage;
  limits: BundleLimits;
  loadAuthority(requestId: string): Promise<{
    captureRights: WebsiteCaptureRights;
    consentAttestation: { granted?: unknown; statement_version?: unknown; recorded_at_iso?: unknown } | null;
  }>;
  loadBrief(requestId: string): Promise<SiteTaskBriefSnapshot | null>;
  notifyVideoReceived(requestId: string): Promise<void>;
  screenForPrivacy(params: { requestId: string; sceneId: string; captureId: string }): Promise<PrivacyScreenResult>;
  claimPrivacyScreen(params: { requestId: string; captureId: string;
    producerSource: CapturePrivacyProducerSource }): Promise<CapturePrivacyScreenClaim | null>;
  releasePrivacyClaim(claim: CapturePrivacyScreenClaim): Promise<void>;
  recordPrivacy(params: { requestId: string; captureId: string; result: PrivacyScreenResult;
    producerSource: CapturePrivacyProducerSource; claim: CapturePrivacyScreenClaim }): Promise<void>;
  loadPrivacyState(requestId: string): Promise<StoredPrivacyState | null>;
  recordUploadIdentity(params: {
    requestId: string;
    target: BundleTarget;
    identity: BundleCompletionRecord["identity"];
    planDigest: string;
    client: BundleClient;
  }): Promise<"recorded" | "conflict">;
  /** Atomic claim of the capture for this plan; what the browser routes check. */
  claimBundle(params: {
    requestId: string;
    target: BundleTarget;
    planDigest: string;
    client: BundleClient;
  }): Promise<"claimed" | "conflict">;
  startCoverageReview(params: { requestId: string; sceneId: string; captureId: string }): void | Promise<void>;
  /**
   * Charge a plan's declared bytes against the durable daily upload caps before
   * any upload target is issued. Once per plan; null admits, a response refuses.
   */
  admitPlannedBytes?(params: { requestId: string; captureId: string; planDigest: string; bytes: number }):
    Promise<ServiceResponse | null>;
  now(): Date;
}

export function bundleProcessingHold(
  authority: Awaited<ReturnType<BundleServiceDeps["loadAuthority"]>>,
  recordingDetail = "Recording permission changed before completion.",
): ServiceResponse | null {
  if (!hasCurrentRecordingConsent(authority.consentAttestation)) {
    return { status: 409, body: { code: "recording_consent_required", error: recordingDetail } };
  }
  if (authority.captureRights.derived_scene_generation_allowed !== true) {
    return { status: 409, body: { code: "capture_processing_not_authorized",
      error: "Processing is on hold until the existing capture rights can be verified." } };
  }
  return null;
}

export interface TokenPayload {
  supplement?: import("./captureUploadToken").CaptureSupplementBinding;
  requestId: string;
  sceneId: string;
  captureId: string;
  scope?: "owner" | "film";
}

export interface ServiceResponse {
  status: number;
  body: Record<string, unknown>;
  /** Sent as Retry-After when a daily cap refuses. */
  retryAfterSeconds?: number;
}

export function targetFor(payload: TokenPayload): BundleTarget {
  return {
    sceneId: payload.sceneId,
    captureId: payload.captureId,
    rawPrefix: rawPrefixFor(payload.sceneId, payload.captureId),
  };
}

export function planObjectName(target: BundleTarget): string {
  return `${uploadRecordPrefixFor(target.sceneId, target.captureId)}/bundle_plan.json`;
}

export function completionObjectName(target: BundleTarget): string {
  return `${uploadRecordPrefixFor(target.sceneId, target.captureId)}/bundle_completion.json`;
}

export async function appBundlePrivacySource(payload: TokenPayload, storage: BundleStorage):
  Promise<CapturePrivacyProducerSource | null> {
  const target = targetFor(payload);
  const completion = await readJson<BundleCompletionRecord>(storage, completionObjectName(target));
  if (!completion) return null;
  if (completion.request_id !== payload.requestId || completion.scene_id !== target.sceneId
      || completion.capture_id !== target.captureId || completion.raw_prefix !== target.rawPrefix) {
    throw new Error("bundle_completion_privacy_source_invalid");
  }
  return { kind: "app_bundle_completion", key: bundleCompletionDecisionKey(completion) };
}

export function rawObjectName(target: BundleTarget, path: string): string {
  return `${target.rawPrefix}/${path}`;
}

export function relativeRawPath(target: BundleTarget, objectName: string): string | null {
  const prefix = `${target.rawPrefix}/`;
  return objectName.startsWith(prefix) ? objectName.slice(prefix.length) : null;
}

export async function readJson<T>(storage: BundleStorage, name: string): Promise<T | null> {
  const text = await storage.readText(name);
  if (text === null) return null;
  return JSON.parse(text) as T;
}

/* ------------------------------------------------------------ link state */

export type BundleLinkState =
  /** Nothing stored for this capture; a recording may start. */
  | "open"
  /** A bundle plan is recorded and its files are still arriving. */
  | "uploading"
  /** Stored and waiting on the privacy screen; nothing derived yet. */
  | "held"
  /** The completion marker exists. */
  | "complete"
  /** Something else occupies the prefix; a new bundle may not be written. */
  | "occupied";

export async function describeBundleLink(payload: TokenPayload, deps: BundleServiceDeps) {
  const target = targetFor(payload);
  const [markerInfo, completion, plan, manifestInfo, anyRaw, authority] = await Promise.all([
    deps.storage.info(rawObjectName(target, COMPLETION_MARKER_PATH)),
    deps.storage.info(completionObjectName(target)),
    deps.storage.info(planObjectName(target)),
    deps.storage.info(rawObjectName(target, "manifest.json")),
    deps.storage.list(`${target.rawPrefix}/`, { maxResults: 1 }),
    deps.loadAuthority(payload.requestId),
  ]);
  const storedKind: "bundle" | "browser" | null = plan
    ? "bundle"
    : anyRaw.length > 0
      ? "browser"
      : null;
  let state: BundleLinkState;
  if (markerInfo) state = "complete";
  else if (completion) state = "held";
  else if (plan) state = "uploading";
  else if (manifestInfo) state = "held";
  else if (anyRaw.length > 0) state = "occupied";
  else state = "open";

  const { binding, binding_digest } = projectSiteCaptureBinding({
    requestId: payload.requestId,
    target,
    captureRights: authority.captureRights,
  });
  return {
    schema_version: "site_capture_bundle_target.v1",
    scene_id: target.sceneId,
    capture_id: target.captureId,
    raw_prefix: target.rawPrefix,
    state,
    stored_kind: storedKind,
    contract: {
      schema_version: "v3",
      capture_schema_version: "3.2.0",
      capture_source: "iphone",
      video_uri: BUNDLE_VIDEO_PATH,
      capture_profiles: ["iphone_arkit_lidar", "iphone_arkit_non_lidar"],
    },
    binding,
    binding_digest,
    device_manifest_keys: [...DEVICE_MANIFEST_KEYS],
    server_owned_paths: [...SERVER_OWNED_PATHS],
    limits: {
      max_files: deps.limits.maxFiles,
      max_total_bytes: deps.limits.maxTotalBytes,
      max_sidecar_bytes: deps.limits.maxSidecarBytes,
      targets_per_response: TARGETS_PER_RESPONSE,
    },
  };
}

/* ------------------------------------------------------------ plan */

async function writeCreateOnlyExact(
  storage: BundleStorage,
  name: string,
  content: string,
): Promise<"written" | "matched" | "conflict"> {
  const outcome = await storage.createOnly(name, content, "application/json");
  if (outcome === "created") return "written";
  const existing = await storage.readText(name);
  return existing === content ? "matched" : "conflict";
}

/** A completion record is an intent; every server-owned input must exist before its marker. */
export async function materializeCompletionServerFiles(
  target: BundleTarget,
  completion: BundleCompletionRecord,
  storage: BundleStorage,
): Promise<"ready" | "conflict"> {
  const files = (completion as BundleCompletionRecord & { server_files?: unknown }).server_files;
  const expected = SERVER_OWNED_PATHS.filter((path) => path !== HASHES_PATH && path !== COMPLETION_MARKER_PATH);
  if (!files || typeof files !== "object" || Array.isArray(files)) return "conflict";
  const serverFiles = files as Record<string, unknown>;
  if (Object.keys(serverFiles).sort().join("\0") !== [...expected].sort().join("\0")
      || expected.some((path) => typeof serverFiles[path] !== "string")) return "conflict";
  for (const path of ["manifest.json", ...expected.filter((name) => name !== "manifest.json").sort()]) {
    if (await writeCreateOnlyExact(storage, rawObjectName(target, path), serverFiles[path] as string) === "conflict")
      return "conflict";
  }
  return "ready";
}

/** hashes.json, then the marker, last. Both create-only and byte-exact. */
export async function finishBundle(
  target: BundleTarget,
  completion: BundleCompletionRecord,
  storage: BundleStorage,
): Promise<"finished" | "conflict"> {
  // Older held completions predate device generation recording. Preserve their
  // original byte-exact finish path; the owner-read endpoint cannot qualify
  // them for retirement without that independent historical source proof.
  const hashes = await writeCreateOnlyExact(storage, rawObjectName(target, HASHES_PATH), completion.hashes_json);
  if (hashes === "conflict") return "conflict";
  const marker = await writeCreateOnlyExact(
    storage,
    rawObjectName(target, COMPLETION_MARKER_PATH),
    completion.completion_marker_json,
  );
  return marker === "conflict" ? "conflict" : "finished";
}

/**
 * A held bundle whose privacy screen cleared on a later retry. Called from the
 * status poll with the same answer the web path acts on; writes `hashes.json`
 * and the marker from the completion record, byte for byte.
 */
export async function finishClearedBundle(
  payload: TokenPayload,
  deps: BundleServiceDeps,
  expectedSource: CapturePrivacyProducerSource,
): Promise<"finished" | "not_a_bundle" | "conflict"> {
  if (bundleProcessingHold(await deps.loadAuthority(payload.requestId))) return "conflict";
  const target = targetFor(payload);
  const storage = deps.storage;
  const completion = await readJson<BundleCompletionRecord>(storage, completionObjectName(target));
  if (!completion) return "not_a_bundle";
  if (expectedSource.kind !== "app_bundle_completion"
      || bundleCompletionDecisionKey(completion) !== expectedSource.key) return "conflict";
  const plan = await readJson<BundlePlanRecord>(storage, planObjectName(target));
  if (!plan || planDigestOf(plan) !== plan.plan_digest
      || plan.plan_digest !== completion.plan_digest
      || plan.request_id !== payload.requestId || plan.scene_id !== target.sceneId
      || plan.capture_id !== target.captureId || plan.raw_prefix !== target.rawPrefix) return "conflict";
  if (await materializeCompletionServerFiles(target, completion, storage) === "conflict") return "conflict";
  if (await deps.recordUploadIdentity({ requestId: payload.requestId, target,
    identity: completion.identity, planDigest: plan.plan_digest, client: plan.client }) === "conflict") return "conflict";
  const currentSource = await appBundlePrivacySource(payload, storage);
  if (currentSource?.kind !== expectedSource.kind || currentSource.key !== expectedSource.key) return "conflict";
  if (bundleProcessingHold(await deps.loadAuthority(payload.requestId))) return "conflict";
  await deps.startCoverageReview({ requestId: payload.requestId, sceneId: target.sceneId, captureId: target.captureId });
  return finishBundle(target, completion, storage);
}
