import path from "node:path";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";
import { parseGsUri } from "./pipeline-dashboard";
import {
  azimuthForFrameIndex,
  DEFAULT_WORLD_MODEL,
  resolveWorldModelProfile,
  selectFramesForModel,
  type FrameCandidate,
  type WorldModelProfile,
} from "./worldModelProfiles";

export type WorldLabsPreviewStatus = "not_requested" | "queued" | "processing" | "ready" | "failed";

export interface WorldLabsPreviewSummary {
  status: WorldLabsPreviewStatus;
  model?: string | null;
  operationId?: string | null;
  worldId?: string | null;
  launchUrl?: string | null;
  thumbnailUrl?: string | null;
  panoUrl?: string | null;
  caption?: string | null;
  spzUrls?: string[];
  /**
   * Splat downloads keyed by the detail level the API returns them under
   * ("100k", "500k", "full_res"). `spzUrls` stays a flat list for existing
   * consumers; this keeps the level, which is what a renderer actually needs.
   */
  spzUrlsByDetail?: Record<string, string>;
  colliderMeshUrl?: string | null;
  worldManifestUri?: string | null;
  operationManifestUri?: string | null;
  requestManifestUri?: string | null;
  lastUpdatedAt?: string | null;
  failureReason?: string | null;
  generationSourceType?: string | null;
}

interface WorldLabsApiOptions {
  path: string;
  method?: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

const DEFAULT_BASE_URL = "https://api.worldlabs.ai";
export const DEFAULT_WORLDLABS_TEXT_PROMPT = `Create a grounded, explorable Marble world from this walkthrough video of a real indoor media-room / office-like environment.

Requirements:
- Preserve the real room layout, scale, walkable floor area, and major object placement from the video.
- Treat this as a practical, cluttered working room, not a stylized showroom.
- Keep desks, office chairs, printers, shelving, boxes, monitors, TVs, fireplace, doorways, walls, and window-blind surfaces where they appear in the walkthrough.
- Respect the captured camera path and inferred spatial relationships from the video.
- Favor physical plausibility over visual embellishment.
- Do not invent extra rooms, extra corridors, or dramatic architectural changes.
- Do not clean up clutter unless the video clearly shows open space.
- Avoid fantasy, cinematic, game-like, or exaggerated design choices.
- Maintain a neutral, realistic material palette and ordinary indoor lighting.
- Output should feel like a believable reconstruction of the same site for interactive review and navigation.
- Prioritize navigability, stable geometry, and faithful scene structure over decorative detail.
- If any region is ambiguous, infer the simplest continuation consistent with the walkthrough instead of hallucinating new features.`;

function worldLabsBaseUrl() {
  return (
    getConfiguredEnvValue("WORLDLABS_API_BASE_URL") ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

function worldLabsApiKey() {
  return requireConfiguredEnvValue(["WORLDLABS_API_KEY"], "World Labs API");
}

function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

function normalizeUrlPath(pathname: string) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

async function worldLabsApiRequest<T = Record<string, unknown>>({
  path: requestPath,
  method = "GET",
  body,
  extraHeaders = {},
}: WorldLabsApiOptions): Promise<T> {
  const response = await fetch(`${worldLabsBaseUrl()}${normalizeUrlPath(requestPath)}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": worldLabsApiKey(),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail?: unknown }).detail || "")
        : rawText;
    throw new Error(`worldlabs_api_${response.status}:${detail || "request_failed"}`);
  }

  return (payload || {}) as T;
}

export async function readArtifactJson(uri?: string | null): Promise<Record<string, unknown> | null> {
  const normalized = String(uri || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    if (normalized.startsWith("gs://")) {
      if (!storageAdmin) {
        return null;
      }
      const { bucket, objectPath } = parseGsUri(normalized);
      const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
      const payload = JSON.parse(buffer.toString("utf-8"));
      return typeof payload === "object" && payload ? (payload as Record<string, unknown>) : null;
    }

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      const response = await fetch(normalized);
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as Record<string, unknown>;
      return payload && typeof payload === "object" ? payload : null;
    }

    const fs = await import("node:fs/promises");
    const payload = JSON.parse(await fs.readFile(normalized, "utf-8"));
    return typeof payload === "object" && payload ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readBinaryFromUri(uri: string): Promise<Uint8Array> {
  if (uri.startsWith("gs://")) {
    if (!storageAdmin) {
      throw new Error("storage_unavailable_for_worldlabs_upload");
    }
    const { bucket, objectPath } = parseGsUri(uri);
    const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
    return new Uint8Array(buffer);
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`worldlabs_source_fetch_failed:${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  const fs = await import("node:fs/promises");
  return new Uint8Array(await fs.readFile(uri));
}

function extensionFromUri(uri: string, fallback = "mp4") {
  const parsed = path.extname(new URL(uri, "file:///").pathname).replace(/^\./, "").trim();
  return parsed || fallback;
}

function fileNameFromUri(uri: string, fallback = "capture-video.mp4") {
  try {
    const pathname = new URL(uri, "file:///").pathname;
    return path.basename(pathname) || fallback;
  } catch {
    return fallback;
  }
}

function mimeTypeForExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    case "mp4":
    default:
      return "video/mp4";
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Read `assets.splats.spz_urls` into a {detail level -> url} map.
 *
 * The live API keys these by resolution. A list shape is also accepted because
 * manifests written by earlier revisions of this file stored one; those get
 * positional keys so nothing is lost.
 */
function normalizeSpzUrls(value: unknown): Record<string, string> {
  const record = jsonRecord(value);
  if (record) {
    const entries = Object.entries(record)
      .map(([key, url]) => [key, String(url || "").trim()] as const)
      .filter(([, url]) => url);
    return Object.fromEntries(entries);
  }

  if (Array.isArray(value)) {
    const entries = value
      .map((url, index) => [`legacy_${index}`, String(url || "").trim()] as const)
      .filter(([, url]) => url);
    return Object.fromEntries(entries);
  }

  return {};
}

export function configuredWorldModel() {
  return getConfiguredEnvValue("WORLDLABS_DEFAULT_MODEL") || DEFAULT_WORLD_MODEL;
}

export async function prepareWorldLabsMediaAssetUpload(params: {
  fileName: string;
  extension: string;
  kind: "image" | "video";
  metadata?: Record<string, unknown>;
}) {
  return worldLabsApiRequest<Record<string, unknown>>({
    path: "/marble/v1/media-assets:prepare_upload",
    method: "POST",
    body: {
      file_name: params.fileName,
      extension: params.extension,
      kind: params.kind,
      metadata: params.metadata || {},
    },
  });
}

async function uploadPreparedMediaAsset(params: {
  uploadInfo: Record<string, unknown>;
  contentType: string;
  bytes: Uint8Array;
}) {
  const uploadUrl = firstString(params.uploadInfo.upload_url);
  if (!uploadUrl) {
    throw new Error("worldlabs_upload_url_missing");
  }
  const requiredHeaders =
    params.uploadInfo.required_headers && typeof params.uploadInfo.required_headers === "object"
      ? (params.uploadInfo.required_headers as Record<string, string>)
      : {};

  const response = await fetch(uploadUrl, {
    method: firstString(params.uploadInfo.upload_method, "PUT"),
    headers: {
      "Content-Type": params.contentType,
      ...requiredHeaders,
    },
    body: params.bytes,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`worldlabs_upload_failed:${response.status}:${detail}`);
  }
}

function normalizeGenerationRequest(requestManifest: Record<string, unknown>) {
  const generationRequest =
    requestManifest.generation_request && typeof requestManifest.generation_request === "object"
      ? JSON.parse(JSON.stringify(requestManifest.generation_request))
      : {};
  return generationRequest as Record<string, unknown>;
}

function ensureWorldPrompt(generationRequest: Record<string, unknown>) {
  const worldPrompt =
    generationRequest.world_prompt && typeof generationRequest.world_prompt === "object"
      ? (generationRequest.world_prompt as Record<string, unknown>)
      : {};
  const rawTextPrompt = firstString(worldPrompt.text_prompt);
  worldPrompt.text_prompt = rawTextPrompt || DEFAULT_WORLDLABS_TEXT_PROMPT;
  generationRequest.world_prompt = worldPrompt;
  return generationRequest;
}

function normalizePermission(value: unknown) {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  const normalized = firstString(value).toLowerCase();
  if (normalized === "public") {
    return {
      public: true,
      allow_id_access: true,
      allowed_readers: [],
      allowed_writers: [],
    };
  }

  return {
    public: false,
    allow_id_access: false,
    allowed_readers: [],
    allowed_writers: [],
  };
}

function mimeTypeForImageExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}

/** Upload one frame and return the media asset id the prompt will reference. */
async function uploadFrameAsMediaAsset(params: {
  frame: FrameCandidate;
  index: number;
  metadata: Record<string, unknown>;
}) {
  const extension = extensionFromUri(params.frame.uri, "jpg");
  const fileName = fileNameFromUri(params.frame.uri, `frame-${params.index}.${extension}`);
  const uploadPayload = await prepareWorldLabsMediaAssetUpload({
    fileName,
    extension,
    kind: "image",
    metadata: params.metadata,
  });

  const mediaAsset = jsonRecord(uploadPayload.media_asset) || {};
  const uploadInfo = jsonRecord(uploadPayload.upload_info) || {};
  const bytes = await readBinaryFromUri(params.frame.uri);

  await uploadPreparedMediaAsset({
    uploadInfo,
    contentType: mimeTypeForImageExtension(extension),
    bytes,
  });

  const mediaAssetId = firstString(mediaAsset.id, mediaAsset.media_asset_id);
  if (!mediaAssetId) {
    throw new Error("worldlabs_media_asset_id_missing");
  }
  return mediaAssetId;
}

export interface GenerateWorldFromFramesParams {
  /** Every frame pulled from the walkthrough, in capture order. */
  frames: readonly FrameCandidate[];
  model?: string | null;
  displayName?: string | null;
  textPrompt?: string | null;
  permission?: unknown;
  /** Carried onto each uploaded asset so uploads stay traceable to a capture. */
  assetMetadata?: Record<string, unknown>;
}

export interface GenerateWorldFromFramesResult {
  operation: Record<string, unknown>;
  generationRequest: Record<string, unknown>;
  generationSourceType: "frames_media_assets";
  profile: WorldModelProfile;
  /** What was sent vs. what existed, for the artifact trail. */
  frameSelection: {
    submittedCount: number;
    consideredCount: number;
    droppedForModelCap: number;
    reconstructImages: boolean;
    submittedFrameUris: string[];
  };
}

/**
 * Turn a site walkthrough into a world by sending frames, not the video.
 *
 * This is the path Blueprint runs on. The video prompt caps at 30 seconds,
 * which is far shorter than a real walkthrough, so handing over selected frames
 * is the only way to cover a whole site — and it is the same shape Atlas scales
 * to 100+ frames. The frame budget comes from the model profile, so moving to
 * Atlas is a model string, not a rewrite.
 */
export async function generateWorldFromFrames(
  params: GenerateWorldFromFramesParams,
): Promise<GenerateWorldFromFramesResult> {
  const profile = resolveWorldModelProfile(params.model || configuredWorldModel());

  if (!profile.available) {
    // Atlas lands here until someone has seen the real spec. Failing loudly
    // beats shipping a request built on a guessed schema.
    throw new Error(
      `worldlabs_model_unavailable:${profile.model}:${profile.note}`,
    );
  }

  const selection = selectFramesForModel(params.frames, profile);
  if (!selection.frames.length) {
    throw new Error("worldlabs_no_frames_available");
  }

  const assetMetadata = params.assetMetadata || {};
  const multiImagePrompt: Record<string, unknown>[] = [];

  for (const [index, frame] of selection.frames.entries()) {
    const mediaAssetId = await uploadFrameAsMediaAsset({
      frame,
      index,
      metadata: { ...assetMetadata, frame_index: index },
    });
    multiImagePrompt.push({
      azimuth: azimuthForFrameIndex(index, selection.frames.length),
      content: { source: "media_asset", media_asset_id: mediaAssetId },
    });
  }

  const worldPrompt: Record<string, unknown> = {
    type: "multi-image",
    multi_image_prompt: multiImagePrompt,
    text_prompt: firstString(params.textPrompt) || DEFAULT_WORLDLABS_TEXT_PROMPT,
  };

  // Marble needs this flag to accept more than four images, and reconstruction
  // mode is what we want regardless: these frames are of one real room.
  if (profile.supportsReconstructFlag) {
    worldPrompt.reconstruct_images = true;
  }

  const generationRequest: Record<string, unknown> = {
    model: profile.model,
    world_prompt: worldPrompt,
    permission: normalizePermission(params.permission),
  };
  const displayName = firstString(params.displayName);
  if (displayName) {
    generationRequest.display_name = displayName;
  }

  const operation = await worldLabsApiRequest<Record<string, unknown>>({
    path: "/marble/v1/worlds:generate",
    method: "POST",
    body: generationRequest,
  });

  return {
    operation,
    generationRequest,
    generationSourceType: "frames_media_assets",
    profile,
    frameSelection: {
      submittedCount: selection.frames.length,
      consideredCount: selection.consideredCount,
      droppedForModelCap: selection.droppedForModelCap,
      reconstructImages: Boolean(worldPrompt.reconstruct_images),
      submittedFrameUris: selection.frames.map((frame) => frame.uri),
    },
  };
}

/** PLY splat resolutions the export endpoint accepts. */
export type SplatExportResolution = "full_res" | "500k" | "150k" | "100k";

/** HQ mesh variants. `textured` is ~600k triangles, `vertex_colored` ~1M. */
export type MeshExportVariant = "textured" | "vertex_colored";

export interface ExportWorldAssetParams {
  worldId: string;
  assetType: "splats" | "mesh";
  format: "ply" | "glb";
  /** Only meaningful for splats -> ply. Defaults to full_res, as the API does. */
  resolution?: SplatExportResolution;
  /** Only meaningful for mesh -> glb. */
  meshVariant?: MeshExportVariant;
}

/**
 * Export a finished world as a file we hold, rather than a link into someone
 * else's viewer.
 *
 * Two different shapes hide behind one endpoint. A PLY splat export is
 * converted synchronously and comes back already done; an HQ mesh export is a
 * real async job and comes back in progress, so the caller has to poll it like
 * a generation. `done` on the response tells them apart.
 *
 * Note that a splat PLY is a Gaussian-splat PLY, not triangle geometry — the
 * thing to hand a physics engine is the GLB.
 */
export async function exportWorldAsset(params: ExportWorldAssetParams) {
  const body: Record<string, unknown> = {
    asset_type: params.assetType,
    format: params.format,
  };
  if (params.assetType === "splats" && params.format === "ply") {
    body.resolution = params.resolution || "full_res";
  }
  if (params.assetType === "mesh" && params.format === "glb" && params.meshVariant) {
    body.mesh_variant = params.meshVariant;
  }

  return worldLabsApiRequest<Record<string, unknown>>({
    path: `/marble/v1/worlds/${encodeURIComponent(params.worldId)}:export`,
    method: "POST",
    body,
  });
}

/** Remaining API credits, so an operator can see a 402 coming. */
export async function getWorldLabsCredits() {
  return worldLabsApiRequest<Record<string, unknown>>({ path: "/marble/v1/credits" });
}

export async function createWorldFromRequestManifest(requestManifest: Record<string, unknown>) {
  const generationRequest = ensureWorldPrompt(normalizeGenerationRequest(requestManifest));
  generationRequest.permission = normalizePermission(generationRequest.permission);
  const selectedVideoUri = firstString(requestManifest.selected_video_uri);
  const requestedSourceType = firstString(requestManifest.generation_source_type);
  const worldPrompt =
    generationRequest.world_prompt && typeof generationRequest.world_prompt === "object"
      ? (generationRequest.world_prompt as Record<string, unknown>)
      : {};
  const videoPrompt =
    worldPrompt.video_prompt && typeof worldPrompt.video_prompt === "object"
      ? (worldPrompt.video_prompt as Record<string, unknown>)
      : {};

  let generationSourceType = requestedSourceType || "video_media_asset";
  if (selectedVideoUri && generationSourceType !== "video_uri") {
    const extension = extensionFromUri(selectedVideoUri);
    const fileName = fileNameFromUri(selectedVideoUri, `capture-video.${extension}`);
    const uploadPayload = await prepareWorldLabsMediaAssetUpload({
      fileName,
      extension,
      kind: "video",
      metadata: {
        scene_id: requestManifest.scene_id,
        capture_id: requestManifest.capture_id,
        site_submission_id: requestManifest.site_submission_id,
      },
    });
    const mediaAsset =
      uploadPayload.media_asset && typeof uploadPayload.media_asset === "object"
        ? (uploadPayload.media_asset as Record<string, unknown>)
        : {};
    const uploadInfo =
      uploadPayload.upload_info && typeof uploadPayload.upload_info === "object"
        ? (uploadPayload.upload_info as Record<string, unknown>)
        : {};
    const bytes = await readBinaryFromUri(selectedVideoUri);
    await uploadPreparedMediaAsset({
      uploadInfo,
      contentType: mimeTypeForExtension(extension),
      bytes,
    });
    videoPrompt.source = "media_asset";
    videoPrompt.media_asset_id = firstString(mediaAsset.media_asset_id, mediaAsset.id);
    delete videoPrompt.uri;
    generationSourceType = "video_media_asset";
  } else if (selectedVideoUri) {
    videoPrompt.source = "uri";
    videoPrompt.uri = selectedVideoUri;
    delete videoPrompt.media_asset_id;
    generationSourceType = "video_uri";
  }

  worldPrompt.video_prompt = videoPrompt;
  generationRequest.world_prompt = worldPrompt;

  const operation = await worldLabsApiRequest<Record<string, unknown>>({
    path: "/marble/v1/worlds:generate",
    method: "POST",
    body: generationRequest,
  });

  return {
    operation,
    generationRequest,
    generationSourceType,
  };
}

export async function getWorldLabsOperation(operationId: string) {
  return worldLabsApiRequest<Record<string, unknown>>({
    path: `/marble/v1/operations/${encodeURIComponent(operationId)}`,
  });
}

export async function getWorldLabsWorld(worldId: string) {
  return worldLabsApiRequest<Record<string, unknown>>({
    path: `/marble/v1/worlds/${encodeURIComponent(worldId)}`,
  });
}

export function summarizeWorldLabsPreview(params: {
  requestManifest?: Record<string, unknown> | null;
  inputManifest?: Record<string, unknown> | null;
  operationManifest?: Record<string, unknown> | null;
  worldManifest?: Record<string, unknown> | null;
  requestManifestUri?: string | null;
  inputManifestUri?: string | null;
  inputVideoUri?: string | null;
  operationManifestUri?: string | null;
  worldManifestUri?: string | null;
}): WorldLabsPreviewSummary {
  const requestManifest = params.requestManifest || {};
  const inputManifest = params.inputManifest || {};
  const operationManifest = params.operationManifest || {};
  const worldManifest = params.worldManifest || {};

  const operationDone = Boolean(operationManifest.done);
  const worldId = firstString(worldManifest.world_id, worldManifest.id, operationManifest.world_id);
  const operationId = firstString(
    operationManifest.operation_id,
    operationManifest.id,
    requestManifest.operation_id,
  );
  const model = firstString(worldManifest.model, operationManifest.model, requestManifest.provider_model);
  const launchUrl = firstString(
    worldManifest.world_marble_url,
    operationManifest.world_marble_url,
  );
  const thumbnailUrl = firstString(
    (worldManifest.assets as Record<string, unknown> | undefined)?.thumbnail_url,
    worldManifest.thumbnail_url,
  );
  const imagery =
    worldManifest.assets && typeof worldManifest.assets === "object"
      ? ((worldManifest.assets as Record<string, unknown>).imagery as Record<string, unknown> | undefined)
      : undefined;
  const mesh =
    worldManifest.assets && typeof worldManifest.assets === "object"
      ? ((worldManifest.assets as Record<string, unknown>).mesh as Record<string, unknown> | undefined)
      : undefined;
  const splats =
    worldManifest.assets && typeof worldManifest.assets === "object"
      ? ((worldManifest.assets as Record<string, unknown>).splats as Record<string, unknown> | undefined)
      : undefined;
  // The API returns `spz_urls` as an object keyed by detail level —
  // {"100k": url, "500k": url, "full_res": url} — not a list. Older stored
  // manifests in this repo were written assuming a list, so read both shapes
  // rather than silently dropping every splat URL we have ever recorded.
  const spzUrlsByDetail = normalizeSpzUrls(splats?.spz_urls);
  const spzUrls = Object.values(spzUrlsByDetail);
  const failureReason = firstString(
    operationManifest.failure_reason,
    (operationManifest.error as Record<string, unknown> | undefined)?.message,
    worldManifest.failure_reason,
  );

  let status: WorldLabsPreviewStatus = "not_requested";
  if (launchUrl && worldId) {
    status = "ready";
  } else if (failureReason || operationManifest.error) {
    status = "failed";
  } else if (operationId && !operationDone) {
    // Live operations report progress at `metadata.progress.status`, not at the
    // top level. Reading the top level only ever produced "processing".
    const progress = jsonRecord(jsonRecord(operationManifest.metadata)?.progress);
    const rawStatus = firstString(progress?.status, operationManifest.status).toLowerCase();
    status = rawStatus === "queued" || rawStatus === "pending" ? "queued" : "processing";
  } else if (
    params.requestManifestUri ||
    params.inputManifestUri ||
    params.inputVideoUri ||
    Object.keys(requestManifest).length > 0 ||
    Object.keys(inputManifest).length > 0
  ) {
    status = "queued";
  }

  return {
    status,
    model: model || null,
    operationId: operationId || null,
    worldId: worldId || null,
    launchUrl: launchUrl || null,
    thumbnailUrl: thumbnailUrl || null,
    panoUrl: firstString(imagery?.pano_url) || null,
    caption: firstString((worldManifest.assets as Record<string, unknown> | undefined)?.caption, worldManifest.caption) || null,
    spzUrls,
    spzUrlsByDetail,
    colliderMeshUrl: firstString(mesh?.collider_mesh_url) || null,
    worldManifestUri: params.worldManifestUri || null,
    operationManifestUri: params.operationManifestUri || null,
    requestManifestUri: params.requestManifestUri || null,
    lastUpdatedAt: firstString(worldManifest.updated_at, operationManifest.updated_at, requestManifest.generated_at) || null,
    failureReason: failureReason || null,
    generationSourceType: firstString(
      worldManifest.generation_source_type,
      operationManifest.generation_source_type,
      requestManifest.generation_source_type,
      inputManifest.generation_source_type,
    ) || null,
  };
}

export async function writeJsonArtifact(params: {
  pipelinePrefix: string;
  relativePath: string;
  payload: Record<string, unknown>;
}) {
  if (!storageAdmin) {
    throw new Error("storage_unavailable_for_worldlabs_artifacts");
  }
  const bucket = storageBucketName();
  const objectPath = `${String(params.pipelinePrefix || "").replace(/\/+$/, "")}/${params.relativePath.replace(/^\/+/, "")}`;
  await storageAdmin
    .bucket(bucket)
    .file(objectPath)
    .save(JSON.stringify(params.payload, null, 2), {
      contentType: "application/json; charset=utf-8",
      resumable: false,
    });
  return `gs://${bucket}/${objectPath}`;
}
