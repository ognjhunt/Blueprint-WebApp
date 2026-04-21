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
}

const GEMINI_INTERACTIONS_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

function getGeminiInteractionsApiKey() {
  return requireConfiguredEnvValue(
    ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"],
    "Gemini Interactions API",
  );
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
  if (!interaction || !Array.isArray(interaction.outputs)) {
    return "";
  }

  return interaction.outputs
    .map((output) => (typeof output?.text === "string" ? output.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
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
    headers: buildRequestHeaders(),
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as GeminiInteraction & {
    error?: { message?: string };
  };

  if (!response.ok) {
    const message =
      payload?.error?.message
      || `Gemini Interactions API create failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function getGeminiInteraction(interactionId: string) {
  const response = await fetch(
    `${GEMINI_INTERACTIONS_BASE_URL}/${encodeURIComponent(interactionId)}`,
    {
      method: "GET",
      headers: buildRequestHeaders(),
    },
  );

  const payload = (await response.json()) as GeminiInteraction & {
    error?: { message?: string };
  };

  if (!response.ok) {
    const message =
      payload?.error?.message
      || `Gemini Interactions API get failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
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
