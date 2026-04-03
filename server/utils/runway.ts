import { getConfiguredEnvValue, requireConfiguredEnvValue } from "../config/env";

const DEFAULT_RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

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

export function getRunwayStatus() {
  return {
    configured: Boolean(getConfiguredEnvValue("RUNWAY_API_KEY")),
    baseUrl: getConfiguredEnvValue("RUNWAY_BASE_URL") || DEFAULT_RUNWAY_BASE_URL,
    version: RUNWAY_API_VERSION,
  };
}

function runwayBaseUrl() {
  return (
    getConfiguredEnvValue("RUNWAY_BASE_URL") ||
    DEFAULT_RUNWAY_BASE_URL
  ).replace(/\/+$/, "");
}

function runwayHeaders() {
  return {
    Authorization: `Bearer ${requireConfiguredEnvValue(["RUNWAY_API_KEY"], "Runway video generation")}`,
    "X-Runway-Version": RUNWAY_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
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
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : text.slice(0, 300) || "Runway request failed";
    throw new Error(`Runway ${response.status}: ${message}`);
  }

  return payload as T;
}

function normalizePromptImage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
    throw new Error("Runway video generation requires promptText.");
  }

  const promptImage = normalizePromptImage(params.promptImage);
  if (!promptImage) {
    throw new Error("Runway video generation requires a proof-led prompt image.");
  }

  const payload = {
    model: params.model?.trim() || "gen4_turbo",
    promptText,
    promptImage,
    ratio: params.ratio?.trim() || "1280:720",
    duration: params.duration ?? 5,
    seed: Number.isFinite(params.seed) ? params.seed : undefined,
  };

  return runwayRequest<RunwayTaskRecord>("/image_to_video", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRunwayTask(taskId: string) {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    throw new Error("Runway task id is required.");
  }

  return runwayRequest<RunwayTaskRecord>(`/tasks/${encodeURIComponent(normalizedTaskId)}`, {
    method: "GET",
  });
}
