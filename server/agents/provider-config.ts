import "../config/bootstrap-env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { AgentProvider, AgentTaskKind } from "./types";

export type StructuredProvider = Extract<
  AgentProvider,
  | "deepseek_chat"
  | "openai_responses"
  | "anthropic_agent_sdk"
  | "acp_harness"
  | "openclaw"
  | "codex_local"
>;

const STRUCTURED_PROVIDER_VALUES = new Set<StructuredProvider>([
  "deepseek_chat",
  "openai_responses",
  "anthropic_agent_sdk",
  "acp_harness",
  "openclaw",
  "codex_local",
]);

const TASK_MODEL_SUFFIXES: Partial<Record<AgentTaskKind, string>> = {
  waitlist_triage: "WAITLIST_AUTOMATION_MODEL",
  inbound_qualification: "INBOUND_QUALIFICATION_MODEL",
  post_signup_scheduling: "POST_SIGNUP_MODEL",
  support_triage: "SUPPORT_TRIAGE_MODEL",
  payout_exception_triage: "PAYOUT_EXCEPTION_MODEL",
  preview_diagnosis: "PREVIEW_DIAGNOSIS_MODEL",
  operator_thread: "OPERATOR_THREAD_MODEL",
  external_harness_thread: "EXTERNAL_HARNESS_MODEL",
  site_video_evidence: "SITE_VIDEO_EVIDENCE_MODEL",
  robot_capability_extraction: "ROBOT_CAPABILITY_EXTRACTION_MODEL",
};

/**
 * Video understanding is pinned, not selected.
 *
 * `getStructuredAutomationProvider` rotates across whichever text provider is
 * keyed, which is the right behaviour for a lane where the providers are
 * interchangeable. They are not interchangeable here: the other adapters take
 * text. So `gemini_video` stays out of `StructuredProvider` and is resolved on
 * its own, and a task that needs footage fails closed rather than silently
 * falling back to a model that cannot see.
 */
const GEMINI_VIDEO_DEFAULT_MODEL = "gemini-3.8-flash";

export function getGeminiVideoModel(): string {
  return (
    process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_MODEL?.trim() ||
    process.env.GEMINI_VIDEO_MODEL?.trim() ||
    GEMINI_VIDEO_DEFAULT_MODEL
  );
}

export function isGeminiVideoConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GOOGLE_AI_STUDIO_API_KEY?.trim(),
  );
}

/**
 * How much room an OpenAI lane gets, and how long it gets to use it.
 *
 * Shared with the adapter rather than declared inside it, because
 * `getAgentRuntimeConnectionMetadata` reports the timeout to ops and a number
 * that disagrees with the client's is worse than no number.
 *
 * Both defaults were sized for a short chat turn — 4,000 output tokens and a
 * 20-second deadline — and neither survives a lane running at reasoning effort
 * "max". On the Responses API reasoning tokens come out of `max_output_tokens`,
 * the same arithmetic that made DeepSeek return successful, empty responses
 * until its ceiling moved from 2,000 to 16,000: `inbound_qualification`'s schema
 * declares maxima summing to 8,573 characters (~2,150 tokens) of JSON before a
 * single reasoning token is spent. 4,000 leaves max-effort reasoning almost no
 * room, and 20 seconds is not long enough for it to finish thinking.
 *
 * 16,000 tokens and 120 seconds match what the DeepSeek lane already runs with
 * and works. Both are ceilings, not reservations: unused output tokens are not
 * billed, and a request that returns in two seconds still returns in two
 * seconds. The cost of being generous is nothing; the cost of being tight is a
 * lane that never completes.
 */
const DEFAULT_OPENAI_MAX_OUTPUT_TOKENS = 16_000;
const OPENAI_MAX_OUTPUT_TOKENS_CEILING = 128_000;
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;
const OPENAI_TIMEOUT_CEILING_MS = 600_000;

function boundedPositiveNumber(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function getOpenAiMaxOutputTokens(): number {
  return Math.floor(
    boundedPositiveNumber(
      process.env.BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS,
      DEFAULT_OPENAI_MAX_OUTPUT_TOKENS,
      OPENAI_MAX_OUTPUT_TOKENS_CEILING,
    ),
  );
}

export function getOpenAiTimeoutMs(): number {
  return Math.floor(
    boundedPositiveNumber(
      process.env.OPENAI_TIMEOUT_MS,
      DEFAULT_OPENAI_TIMEOUT_MS,
      OPENAI_TIMEOUT_CEILING_MS,
    ),
  );
}

/**
 * How hard the OpenAI models think, per lane.
 *
 * `reasoning.effort` is a request parameter, not part of the model id, so
 * picking a model and picking an effort are two separate decisions. The adapter
 * used to hardcode "medium" for everything, which meant a lane could not be
 * tuned without editing it.
 *
 * `inbound_qualification` defaults to "max" deliberately. It is the lane that
 * reads a real operator's description against their own dropdown answers and
 * decides whether a site moves forward, and the cost of getting that wrong is a
 * wasted visit or a company told no for the wrong reason. Luna is the
 * cheapest 5.6 variant, so buying the most thinking on the most consequential
 * lane is an easy trade.
 *
 * Everything else stays at "medium" — the default the adapter already used, so
 * no other lane changes behaviour.
 */
const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export type OpenAiReasoningEffort = (typeof REASONING_EFFORTS)[number];

const TASK_REASONING_EFFORT: Partial<Record<AgentTaskKind, OpenAiReasoningEffort>> = {
  inbound_qualification: "max",
};

function normalizeEffort(value: string | undefined | null): OpenAiReasoningEffort | null {
  const normalized = String(value || "").trim().toLowerCase();
  return (REASONING_EFFORTS as readonly string[]).includes(normalized)
    ? (normalized as OpenAiReasoningEffort)
    : null;
}

export function getOpenAiReasoningEffort(
  taskKind: AgentTaskKind | undefined,
): OpenAiReasoningEffort {
  const suffix = taskKind ? TASK_MODEL_SUFFIXES[taskKind] : null;
  const perTask = suffix
    ? normalizeEffort(process.env[`OPENAI_${suffix.replace(/_MODEL$/, "")}_REASONING_EFFORT`])
    : null;
  return (
    perTask ||
    normalizeEffort(process.env.OPENAI_REASONING_EFFORT) ||
    (taskKind ? TASK_REASONING_EFFORT[taskKind] : null) ||
    "medium"
  );
}

const DEFAULT_MODELS: Record<StructuredProvider, string> = {
  deepseek_chat: "deepseek-v4-pro",
  openai_responses: "gpt-5.6-luna",
  anthropic_agent_sdk: "claude-sonnet-4-5",
  acp_harness: "codex",
  openclaw: "gpt-5.4",
  codex_local: "gpt-5.4-mini",
};

let codexAvailability: boolean | null = null;

function isCodexLocalConfigured() {
  const forced = (process.env.CODEX_LOCAL_AVAILABLE || "").trim().toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes" || forced === "on") {
    codexAvailability = true;
    return codexAvailability;
  }
  if (forced === "0" || forced === "false" || forced === "no" || forced === "off") {
    codexAvailability = false;
    return codexAvailability;
  }

  if (codexAvailability !== null) {
    return codexAvailability;
  }

  const authPath = process.env.CODEX_AUTH_FILE?.trim() || path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(authPath)) {
    codexAvailability = false;
    return codexAvailability;
  }

  const probe = spawnSync(
    process.env.CODEX_LOCAL_COMMAND?.trim() || "codex",
    ["--version"],
    { stdio: "ignore" },
  );
  codexAvailability = probe.status === 0;
  return codexAvailability;
}

function normalizeProvider(value: string | undefined | null): StructuredProvider | null {
  const normalized = String(value || "").trim() as StructuredProvider;
  return STRUCTURED_PROVIDER_VALUES.has(normalized) ? normalized : null;
}

export function isProviderConfigured(provider: StructuredProvider): boolean {
  switch (provider) {
    case "codex_local":
      return isCodexLocalConfigured();
    case "deepseek_chat":
      return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
    case "openai_responses":
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case "anthropic_agent_sdk":
      return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    case "acp_harness":
      return Boolean(process.env.ACP_HARNESS_URL?.trim());
    case "openclaw":
      return Boolean(process.env.OPENCLAW_BASE_URL?.trim());
  }
}

/**
 * Which env var moves a single lane, and why one exists at all.
 *
 * The model was already per-lane (`OPENAI_INBOUND_QUALIFICATION_MODEL` and
 * friends); the provider was not. Every structured task called
 * `getStructuredAutomationProvider()` with no argument, so
 * `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER` was the only lever and it moved
 * all seven lanes together. That is how `openai_responses: "gpt-5.6-luna"`
 * could ship and still never run: the lane it was meant for was routed to
 * DeepSeek along with everything else.
 *
 * The key mirrors the model override it sits beside, so
 * `OPENAI_INBOUND_QUALIFICATION_MODEL` picks the model and
 * `BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER` picks who serves it. Lanes with no
 * model suffix registered have no per-lane provider either — there is nothing
 * to name them with.
 */
export function getLaneProviderEnvKey(
  taskKind: AgentTaskKind | undefined,
): string | null {
  const suffix = taskKind ? TASK_MODEL_SUFFIXES[taskKind] : null;
  return suffix ? `BLUEPRINT_${suffix.replace(/_MODEL$/, "")}_PROVIDER` : null;
}

export type StructuredProviderResolution = {
  provider: StructuredProvider;
  lane_env_key: string | null;
  lane_request: string | null;
  lane_request_honored: boolean;
  reason:
    | "lane_override"
    | "lane_request_not_configured"
    | "lane_request_unrecognized"
    | "global_selection";
};

/**
 * The resolution, not just the answer.
 *
 * A lane override that names an unkeyed provider falls through to the global
 * chain rather than taking the lane offline — the qualification lane going
 * quiet is worse than it running on the cheaper model. But falling through
 * silently is how you end up reading `provider: "deepseek_chat"` in the logs
 * while the config says OpenAI, so the fall-through is reported instead of
 * swallowed. `getAgentRuntimeConnectionMetadata` surfaces it.
 */
export function describeStructuredAutomationProvider(
  taskKind?: AgentTaskKind,
): StructuredProviderResolution {
  const laneEnvKey = getLaneProviderEnvKey(taskKind);
  const laneRequest = laneEnvKey
    ? process.env[laneEnvKey]?.trim() || null
    : null;
  const laneProvider = laneRequest ? normalizeProvider(laneRequest) : null;
  const globalProvider = selectGlobalStructuredProvider();

  if (laneProvider && isProviderConfigured(laneProvider)) {
    return {
      provider: laneProvider,
      lane_env_key: laneEnvKey,
      lane_request: laneRequest,
      lane_request_honored: true,
      reason: "lane_override",
    };
  }

  if (laneRequest) {
    return {
      provider: globalProvider,
      lane_env_key: laneEnvKey,
      lane_request: laneRequest,
      lane_request_honored: false,
      reason: laneProvider
        ? "lane_request_not_configured"
        : "lane_request_unrecognized",
    };
  }

  return {
    provider: globalProvider,
    lane_env_key: laneEnvKey,
    lane_request: null,
    lane_request_honored: true,
    reason: "global_selection",
  };
}

export function getStructuredAutomationProvider(
  taskKind?: AgentTaskKind,
): StructuredProvider {
  return describeStructuredAutomationProvider(taskKind).provider;
}

function selectGlobalStructuredProvider(): StructuredProvider {
  const preferred = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER,
  );
  const fallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );

  const candidates = [
    preferred,
    fallback,
    normalizeProvider(process.env.DEEPSEEK_API_KEY ? "deepseek_chat" : null),
    normalizeProvider(isCodexLocalConfigured() ? "codex_local" : null),
    normalizeProvider(process.env.ACP_HARNESS_URL ? "acp_harness" : null),
    normalizeProvider(process.env.ANTHROPIC_API_KEY ? "anthropic_agent_sdk" : null),
    normalizeProvider(process.env.OPENAI_API_KEY ? "openai_responses" : null),
    normalizeProvider(process.env.OPENCLAW_BASE_URL ? "openclaw" : null),
    "codex_local" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && array.indexOf(candidate) === index;
  });

  return candidates.find(isProviderConfigured) || candidates[0];
}

export function getStructuredAutomationFallbackProvider(
  taskKind?: AgentTaskKind,
): StructuredProvider | null {
  const selected = getStructuredAutomationProvider(taskKind);
  const preferredFallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );

  const candidates = [
    preferredFallback,
    "codex_local" as StructuredProvider,
    "deepseek_chat" as StructuredProvider,
    "anthropic_agent_sdk" as StructuredProvider,
    "openai_responses" as StructuredProvider,
    "acp_harness" as StructuredProvider,
    "openclaw" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && candidate !== selected && array.indexOf(candidate) === index;
  });

  return candidates.find(isProviderConfigured) || null;
}

export function getTaskModelByProvider(taskKind: AgentTaskKind) {
  const suffix = TASK_MODEL_SUFFIXES[taskKind];
  return {
    codex_local:
      (suffix ? process.env[`CODEX_${suffix}`]?.trim() : null)
      || process.env.CODEX_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.codex_local,
    deepseek_chat:
      (suffix ? process.env[`DEEPSEEK_${suffix}`]?.trim() : null)
      || process.env.DEEPSEEK_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.deepseek_chat,
    openai_responses:
      (suffix ? process.env[`OPENAI_${suffix}`]?.trim() : null)
      || process.env.OPENAI_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openai_responses,
    anthropic_agent_sdk:
      (suffix ? process.env[`ANTHROPIC_${suffix}`]?.trim() : null)
      || process.env.ANTHROPIC_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.anthropic_agent_sdk,
    acp_harness:
      process.env.ACP_DEFAULT_HARNESS?.trim()
      || DEFAULT_MODELS.acp_harness,
    openclaw:
      (suffix ? process.env[`OPENCLAW_${suffix}`]?.trim() : null)
      || process.env.OPENCLAW_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openclaw,
  } satisfies Partial<Record<AgentProvider, string>>;
}
