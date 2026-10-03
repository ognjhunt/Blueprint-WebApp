import {
  getConfiguredEnvValue,
  requireConfiguredEnvValue,
} from "../config/env";
import { logger } from "../logger";

export const GEMINI_DEEP_RESEARCH_STANDARD_AGENT = "deep-research-preview-04-2026";
export const GEMINI_DEEP_RESEARCH_MAX_AGENT = "deep-research-max-preview-04-2026";
export const GEMINI_DEEP_RESEARCH_LEGACY_AGENT = "deep-research-pro-preview-12-2025";
export const GEMINI_DEEP_RESEARCH_AGENT = GEMINI_DEEP_RESEARCH_MAX_AGENT;
export const GEMINI_PLANNING_MODEL = "gemini-3.1-pro-preview";

export type GeminiDeepResearchThinkingSummaries = "none" | "auto";
export type GeminiDeepResearchVisualization = "off" | "auto";

export interface GeminiDeepResearchAgentConfig {
  type: "deep-research";
  thinking_summaries: GeminiDeepResearchThinkingSummaries;
  visualization: GeminiDeepResearchVisualization;
  collaborative_planning: boolean;
}

export function resolveGeminiDeepResearchAgent(input?: {
  explicitAgent?: string | null;
  envKeys?: string[];
}) {
  const configuredAgent =
    input?.explicitAgent?.trim()
    || getConfiguredEnvValue(
      ...(input?.envKeys || ["BLUEPRINT_DEEP_RESEARCH_AGENT"]),
    );

  if (!configuredAgent) {
    return GEMINI_DEEP_RESEARCH_AGENT;
  }

  const normalized = configuredAgent.trim().toLowerCase();
  if (
    normalized === "max"
    || configuredAgent === GEMINI_DEEP_RESEARCH_MAX_AGENT
    || configuredAgent === GEMINI_DEEP_RESEARCH_LEGACY_AGENT
  ) {
    return GEMINI_DEEP_RESEARCH_MAX_AGENT;
  }

  if (
    normalized === "standard"
    || normalized === "deep-research"
    || configuredAgent === GEMINI_DEEP_RESEARCH_STANDARD_AGENT
  ) {
    return GEMINI_DEEP_RESEARCH_STANDARD_AGENT;
  }

  return configuredAgent;
}

export function buildGeminiDeepResearchAgentConfig(input?: {
  collaborativePlanning?: boolean;
  thinkingSummaries?: GeminiDeepResearchThinkingSummaries;
  visualization?: GeminiDeepResearchVisualization;
}) {
  return {
    type: "deep-research",
    thinking_summaries: input?.thinkingSummaries ?? "auto",
    visualization: input?.visualization ?? "auto",
    collaborative_planning: input?.collaborativePlanning ?? false,
  } satisfies GeminiDeepResearchAgentConfig;
}

export type GeminiInteractionStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | string;

export interface GeminiInteractionOutput {
  text?: string;
  [key: string]: unknown;
}

export interface GeminiInteraction {
  id: string;
  status: GeminiInteractionStatus;
  error?: unknown;
  outputs?: GeminiInteractionOutput[];
  [key: string]: unknown;
}

export interface CreateGeminiInteractionParams {
  input: string | Array<Record<string, unknown>>;
  agent?: string;
  model?: string;
  previousInteractionId?: string;
  background?: boolean;
  store?: boolean;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  agentConfig?: Record<string, unknown>;
  /** Transport-only bound; never sent as a Google request field. */
  timeoutMs?: number;
}

const GEMINI_INTERACTIONS_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

function getGeminiInteractionsApiKey() {
  return requireConfiguredEnvValue(
    ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"],
    "Gemini Interactions API",
  );
}

export function assertGeminiInteractionsConfigured() {
  getGeminiInteractionsApiKey(); // Presence only: never return or log the key.
}

function buildRequestHeaders() {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": getGeminiInteractionsApiKey(),
  };
}

export function extractGeminiInteractionText(
  interaction: GeminiInteraction | null | undefined,
) {
  if (!interaction) return "";
  // Current Interactions responses use steps[].content; retain compatibility
  // with older outputs[]. Thinking summaries are not research reports.
  const steps = Array.isArray(interaction.steps) ? interaction.steps as any[] : [];
  const current = steps.flatMap(step => step?.type === "model_output" && Array.isArray(step.content)
    ? step.content.filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text) : []);
  const legacy = Array.isArray(interaction.outputs) ? interaction.outputs
    .filter(output => typeof output?.text === "string").map(output => output.text as string) : [];
  return (current.length ? current : legacy).join("\n\n");
}

/** Private transport diagnosis. Never log payload or headers; callers retain
 * the body in approved company evidence and expose only safe status metadata. */
export class GeminiInteractionHttpError extends Error {
  constructor(message: string, readonly status: number, readonly payload: unknown,
    readonly requestId: string | null) {
    super(message);
    this.name = "GeminiInteractionHttpError";
  }
}

async function interactionPayload(response: Response): Promise<GeminiInteraction> {
  if (response.ok) return await response.json() as GeminiInteraction;
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0, truncated = false;
  if (reader) {
    try {
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        const remaining = 65536 - bytes;
        if (next.value.byteLength > remaining) {
          if (remaining) chunks.push(next.value.slice(0, remaining));
          bytes += remaining; truncated = true; await reader.cancel(); break;
        }
        chunks.push(next.value); bytes += next.value.byteLength;
      }
    } catch { truncated = true; } finally { reader.releaseLock(); }
  }
  const body = Buffer.concat(chunks), text = body.toString("utf8");
  let payload: any;
  try { payload = !truncated ? JSON.parse(text) : null; } catch { payload = null; }
  if (payload === null) payload = { body_text: text, body_base64: body.toString("base64"),
    body_truncated: truncated, retained_body_bytes: bytes };
  const message = typeof payload?.error?.message === "string" ? payload.error.message
    : `Gemini Interactions API failed (${response.status})`;
  throw new GeminiInteractionHttpError(message, response.status, payload,
    response.headers.get("x-goog-request-id") || response.headers.get("x-request-id"));
}

export async function createGeminiInteraction(
  params: CreateGeminiInteractionParams,
) {
  const body: Record<string, unknown> = {
    input: params.input,
    store: params.store ?? true,
  };

  if (params.agent) body.agent = params.agent;
  if (params.model) body.model = params.model;
  if (params.previousInteractionId) {
    body.previous_interaction_id = params.previousInteractionId;
  }
  if (typeof params.background === "boolean") {
    body.background = params.background;
  }
  if (typeof params.stream === "boolean") {
    body.stream = params.stream;
  }
  if (Array.isArray(params.tools) && params.tools.length > 0) {
    body.tools = params.tools;
  }
  if (params.agentConfig && Object.keys(params.agentConfig).length > 0) {
    body.agent_config = params.agentConfig;
  }

  const response = await fetch(GEMINI_INTERACTIONS_BASE_URL, {
    method: "POST",
    ...(params.timeoutMs ? { signal: AbortSignal.timeout(params.timeoutMs) } : {}),
    headers: buildRequestHeaders(),
    body: JSON.stringify(body),
  });

  return interactionPayload(response);
}

export async function getGeminiInteraction(interactionId: string, timeoutMs?: number) {
  const response = await fetch(
    `${GEMINI_INTERACTIONS_BASE_URL}/${encodeURIComponent(interactionId)}`,
    {
      method: "GET",
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      headers: buildRequestHeaders(),
    },
  );

  return interactionPayload(response);
}

export async function pollGeminiInteractionUntilComplete(input: {
  interactionId: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}) {
  const pollIntervalMs = Math.max(1_000, input.pollIntervalMs ?? 10_000);
  const timeoutMs = Math.max(30_000, input.timeoutMs ?? 20 * 60 * 1_000);
  const startedAt = Date.now();

  while (true) {
    const interaction = await getGeminiInteraction(input.interactionId);
    if (interaction.status === "completed") {
      return interaction;
    }
    if (interaction.status === "failed") {
      const message =
        typeof interaction.error === "string"
          ? interaction.error
          : JSON.stringify(interaction.error || {});
      throw new Error(`Gemini interaction failed: ${message}`);
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for Gemini interaction ${input.interactionId} after ${timeoutMs}ms.`,
      );
    }

    logger.info(
      {
        interactionId: input.interactionId,
        status: interaction.status,
        pollIntervalMs,
      },
      "Gemini interaction still running",
    );

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
