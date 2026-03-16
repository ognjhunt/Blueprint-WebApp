import path from "node:path";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";
import { parseGsUri } from "./pipeline-dashboard";

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

export async function createWorldFromRequestManifest(requestManifest: Record<string, unknown>) {
  const generationRequest = normalizeGenerationRequest(requestManifest);
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
  operationManifest?: Record<string, unknown> | null;
  worldManifest?: Record<string, unknown> | null;
  requestManifestUri?: string | null;
  operationManifestUri?: string | null;
  worldManifestUri?: string | null;
}): WorldLabsPreviewSummary {
  const requestManifest = params.requestManifest || {};
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
  const spzUrls = Array.isArray(splats?.spz_urls)
    ? (splats?.spz_urls as unknown[]).map((item) => String(item)).filter(Boolean)
    : [];
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
    const rawStatus = firstString(operationManifest.status).toLowerCase();
    status = rawStatus === "queued" || rawStatus === "pending" ? "queued" : "processing";
  } else if (params.requestManifestUri || Object.keys(requestManifest).length > 0) {
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
