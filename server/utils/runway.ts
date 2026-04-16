import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_VIDEO_API_VERSION = "videos/v1";
const DEFAULT_OPENROUTER_VIDEO_MODEL = "bytedance/seedance-2.0-fast";

type RunwayTaskStatus =
  | "PENDING"
  | "THROTTLED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | string;

export interface RunwayTaskRecord {
  id: string;
  status: RunwayTaskStatus;
  createdAt?: string | null;
  failure?: string | null;
  output?: Array<string | { url?: string | null }> | null;
  progress?: number | null;
  model?: string | null;
}

function configuredVideoModel() {
  return (
    getConfiguredEnvValue(
      "BLUEPRINT_OPENROUTER_VIDEO_MODEL",
      "BLUEPRINT_RUNWAY_VIDEO_MODEL",
    ) || DEFAULT_OPENROUTER_VIDEO_MODEL
  );
}

export function getRunwayStatus() {
  return {
    configured: Boolean(getConfiguredEnvValue("OPENROUTER_API_KEY")),
    baseUrl:
      getConfiguredEnvValue("OPENROUTER_BASE_URL") || DEFAULT_OPENROUTER_BASE_URL,
    version: OPENROUTER_VIDEO_API_VERSION,
    provider: "openrouter",
    defaultModel: configuredVideoModel(),
  };
}

function runwayBaseUrl() {
  return (
    getConfiguredEnvValue("OPENROUTER_BASE_URL") || DEFAULT_OPENROUTER_BASE_URL
  ).replace(/\/+$/, "");
}

function runwayHeaders() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireConfiguredEnvValue(["OPENROUTER_API_KEY"], "OpenRouter video generation")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Title": "Blueprint-WebApp",
  };

  const publicAppUrl = getConfiguredEnvValue("VITE_PUBLIC_APP_URL");
  if (publicAppUrl) {
    headers["HTTP-Referer"] = publicAppUrl;
  }

  return headers;
}

async function runwayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runwayBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...runwayHeaders(),
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text.trim().length > 0 ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : text.slice(0, 300) || "OpenRouter video request failed";
    throw new Error(`OpenRouter ${response.status}: ${message}`);
  }

  return payload as T;
}

function normalizePromptImage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeVideoSizeOrAspectRatio(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return { size: "1280x720", aspectRatio: null };
  }

  const exactSizeMatch = normalized.match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (exactSizeMatch) {
    return {
      size: `${exactSizeMatch[1]}x${exactSizeMatch[2]}`,
      aspectRatio: null,
    };
  }

  const colonMatch = normalized.match(/^(\d+)\s*:\s*(\d+)$/);
  if (colonMatch) {
    const left = Number(colonMatch[1]);
    const right = Number(colonMatch[2]);
    if (Number.isFinite(left) && Number.isFinite(right)) {
      if (left > 32 && right > 32) {
        return {
          size: `${left}x${right}`,
          aspectRatio: null,
        };
      }

      return {
        size: null,
        aspectRatio: `${left}:${right}`,
      };
    }
  }

  return { size: null, aspectRatio: normalized };
}

function mapRunwayTaskStatus(status: string | null | undefined): RunwayTaskStatus {
  switch ((status || "").trim().toLowerCase()) {
    case "pending":
      return "PENDING";
    case "in_progress":
      return "RUNNING";
    case "completed":
      return "SUCCEEDED";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    default:
      return ((status || "PENDING").trim().toUpperCase() as RunwayTaskStatus);
  }
}

function mapOpenRouterVideoJob(
  payload: Record<string, unknown>,
  fallbackModel: string | null,
): RunwayTaskRecord {
  const unsignedUrls = Array.isArray(payload.unsigned_urls)
    ? payload.unsigned_urls.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  return {
    id: firstString(payload.id, payload.generation_id) || "",
    status: mapRunwayTaskStatus(firstString(payload.status)),
    createdAt: firstString(payload.created_at, payload.createdAt),
    failure: firstString(
      payload.error,
      typeof payload.error === "object" && payload.error
        ? (payload.error as Record<string, unknown>).message
        : null,
      payload.message,
    ),
    output: unsignedUrls.length > 0 ? unsignedUrls : null,
    progress:
      typeof payload.progress === "number" && Number.isFinite(payload.progress)
        ? payload.progress
        : null,
    model: firstString(payload.model, fallbackModel),
  };
}

export async function startRunwayImageToVideoTask(params: {
  promptText: string;
  promptImage?: string | null;
  model?: string | null;
  ratio?: string | null;
  duration?: number | null;
  seed?: number | null;
}) {
  const promptText = params.promptText.trim();
  if (!promptText) {
    throw new Error("OpenRouter video generation requires promptText.");
  }

  const promptImage = normalizePromptImage(params.promptImage);
  if (!promptImage) {
    throw new Error("OpenRouter video generation requires a proof-led prompt image.");
  }

  const requestedModel = params.model?.trim() || configuredVideoModel();
  const normalizedVideo = normalizeVideoSizeOrAspectRatio(params.ratio);
  const payload = {
    model: requestedModel,
    prompt: promptText,
    frame_images: [
      {
        type: "image_url",
        image_url: { url: promptImage },
        frame_type: "first_frame",
      },
    ],
    size: normalizedVideo.size || undefined,
    aspect_ratio: normalizedVideo.aspectRatio || undefined,
    duration: params.duration ?? 5,
    seed: Number.isFinite(params.seed) ? params.seed : undefined,
    generate_audio: false,
  };

  const result = await runwayRequest<Record<string, unknown>>("/videos", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapOpenRouterVideoJob(result, requestedModel);
}

export async function getRunwayTask(taskId: string) {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    throw new Error("OpenRouter video task id is required.");
  }

  const result = await runwayRequest<Record<string, unknown>>(
    `/videos/${encodeURIComponent(normalizedTaskId)}`,
    {
      method: "GET",
    },
  );

  return mapOpenRouterVideoJob(result, null);
}
