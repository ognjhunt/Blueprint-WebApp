import "../config/bootstrap-env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { getOpenAiConfigurationIssue } from "../utils/openaiApiHost";
import { anthropicModelSupported } from "./anthropic-models";
import { isProviderCoolingDown } from "./provider-funds";
import { privacyDecision, type AgentDataClass } from "./provider-privacy";
import type { AgentProvider, AgentTaskKind } from "./types";

export type StructuredProvider = Extract<
  AgentProvider,
  | "openai_responses"
  | "anthropic_agent_sdk"
  | "acp_harness"
  | "openclaw"
  | "codex_local"
>;

const STRUCTURED_PROVIDER_VALUES = new Set<StructuredProvider>([
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
  preview_diagnosis: "PREVIEW_DIAGNOSIS_MODEL",
  operator_thread: "OPERATOR_THREAD_MODEL",
  external_harness_thread: "EXTERNAL_HARNESS_MODEL",
  site_video_evidence: "SITE_VIDEO_EVIDENCE_MODEL",
  robot_capability_extraction: "ROBOT_CAPABILITY_EXTRACTION_MODEL",
  robot_fit_ranking: "ROBOT_FIT_RANKING_MODEL",
  capture_dispatch: "CAPTURE_DISPATCH_MODEL",
  outbound_outreach: "OUTBOUND_OUTREACH_MODEL",
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
export const SITE_ASSESSMENT_MODEL = "gpt-6.1-sol";

const GEMINI_VIDEO_DEFAULT_MODEL = "gemini-3.8-flash";

export function getGeminiVideoModel(): string {
  return (
    process.env.BLUEPRINT_SITE_VIDEO_EVIDENCE_MODEL?.trim() ||
    process.env.GEMINI_VIDEO_MODEL?.trim() ||
    GEMINI_VIDEO_DEFAULT_MODEL
  );
}

/** Keep readiness and actual video dispatch on the same approved runtime binding. */
export function getGeminiVideoApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
    || process.env.GOOGLE_AI_STUDIO_API_KEY?.trim()
    || process.env.GOOGLE_GENAI_API_KEY?.trim()
    || null;
}

export function isGeminiVideoConfigured(): boolean {
  return getGeminiVideoApiKey() !== null;
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
 * "max". On the Responses API reasoning tokens come out of `max_output_tokens`:
 * `inbound_qualification`'s schema
 * declares maxima summing to 8,573 characters (~2,150 tokens) of JSON before a
 * single reasoning token is spent. 4,000 leaves max-effort reasoning almost no
 * room, and 20 seconds is not long enough for it to finish thinking.
 *
 * 16,000 tokens and 120 seconds are ceilings, not reservations: unused output tokens are not
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
 * cheapest GPT-6 variant, so buying the most thinking on the most
 * consequential lane is an easy trade.
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

/**
 * Anthropic: where the calls go, how long they get, how hard they think.
 *
 * The base URL is written here, not read from the environment. The SDK would
 * otherwise obey `ANTHROPIC_BASE_URL`, and the env examples point that name at
 * another company's Anthropic-compatible endpoint, which would send a site's
 * text to a provider the Privacy Policy does not name. Another company's
 * compatible endpoint is its own provider id with its own privacy row.
 */
export const ANTHROPIC_API_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_API_HOST = "api.anthropic.com";

/**
 * Why Anthropic cannot be used here, or null when it can. A deployment whose
 * `ANTHROPIC_BASE_URL` names another host was sending its calls, and its key,
 * to that host; the adapter now sends to Anthropic only, so such a key is
 * presumed to be another company's credential and is never sent anywhere.
 * The value of the variable is never reported, only the reason.
 */
export type AnthropicConfigurationIssue = "anthropic_api_key_missing" | "anthropic_base_url_names_another_host";

export function getAnthropicConfigurationIssue(): AnthropicConfigurationIssue | null {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic_api_key_missing";
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
  if (baseUrl) {
    let host: string | null = null;
    try {
      const parsed = new URL(baseUrl);
      host = parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null;
    } catch {
      host = null;
    }
    if (host !== ANTHROPIC_API_HOST) return "anthropic_base_url_names_another_host";
  }
  return null;
}

/**
 * One per-run inference cost cap and one input ceiling, whichever provider
 * does the work (owner, 2026-11-13: the same caps apply). Read from the
 * settings the OpenAI lane has always used, with the same defaults and
 * ceilings, so a deployment that sets them keeps exactly its value.
 */
export function getAgentMaxInferenceCostUsd(): number {
  return boundedPositiveNumber(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD, 5, 100);
}

export function getAgentMaxInputTokens(): number {
  return Math.floor(boundedPositiveNumber(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS, 100_000, 1_000_000));
}

/**
 * Lanes whose spend is recorded but not gated per run (their accounting lives
 * with the job). Every adapter that enforces the per-run cap reads this one
 * list, and so does the runtime's rolling spend stop.
 */
export const ACCOUNTING_ONLY_TASK_KINDS: ReadonlySet<AgentTaskKind> = new Set<AgentTaskKind>([
  "site_assessment", "capture_coverage", "capture_video_privacy", "inbound_qualification",
]);

/**
 * Same level of model. A lane that runs on OpenAI's small model maps to
 * Anthropic's small one, the top one to the top one. One table; any lane can
 * still be pinned with `ANTHROPIC_<LANE>_MODEL`, and `ANTHROPIC_DEFAULT_MODEL`
 * moves every lane at once ("the top model everywhere" is that one setting).
 * An OpenAI model the table does not know maps to the top tier.
 */
const ANTHROPIC_MODEL_FOR_OPENAI_MODEL: Record<string, string> = {
  "gpt-6-luna": "claude-haiku-5-5",
  "gpt-6.1-sol": "claude-opus-5-5",
};
const ANTHROPIC_TOP_MODEL = "claude-opus-5-5";

export function anthropicModelForOpenAiModel(openAiModel: string | null | undefined): string {
  const normalized = String(openAiModel || "").trim().toLowerCase();
  return ANTHROPIC_MODEL_FOR_OPENAI_MODEL[normalized] || ANTHROPIC_TOP_MODEL;
}

function openAiModelForLane(taskKind: AgentTaskKind | undefined) {
  const suffix = taskKind ? TASK_MODEL_SUFFIXES[taskKind] : null;
  return (suffix ? process.env[`OPENAI_${suffix}`]?.trim() : null)
    || process.env.OPENAI_DEFAULT_MODEL?.trim()
    || DEFAULT_OPENAI_MODEL;
}

/** The Anthropic model a lane gets when nothing pins it for Anthropic. */
export function getDefaultAnthropicModel(taskKind?: AgentTaskKind): string {
  return process.env.ANTHROPIC_DEFAULT_MODEL?.trim()
    || anthropicModelForOpenAiModel(openAiModelForLane(taskKind));
}

/**
 * Output room and deadline for an Anthropic lane. Thinking counts toward
 * `max_tokens`, so the room is sized for thinking plus the reply; requests
 * stream, so a large ceiling does not run into an HTTP timeout. The ceiling is
 * shared by every request of one task (tool rounds and output corrections).
 */
const DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS = 64_000;
const ANTHROPIC_MAX_OUTPUT_TOKENS_CEILING = 128_000;
const DEFAULT_ANTHROPIC_TIMEOUT_MS = 300_000;
const ANTHROPIC_TIMEOUT_CEILING_MS = 600_000;

export function getAnthropicMaxOutputTokens(): number {
  return Math.floor(
    boundedPositiveNumber(
      process.env.BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS,
      DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
      ANTHROPIC_MAX_OUTPUT_TOKENS_CEILING,
    ),
  );
}

export function getAnthropicTimeoutMs(): number {
  return Math.floor(
    boundedPositiveNumber(
      process.env.ANTHROPIC_TIMEOUT_MS,
      DEFAULT_ANTHROPIC_TIMEOUT_MS,
      ANTHROPIC_TIMEOUT_CEILING_MS,
    ),
  );
}

/**
 * Effort per lane, always sent explicitly: the default differs by model.
 * `ANTHROPIC_<LANE>_EFFORT` and `ANTHROPIC_EFFORT` set it for Anthropic;
 * otherwise it is the lane's OpenAI effort, its environment overrides
 * included, so a lane thinks as hard on either provider.
 */
const ANTHROPIC_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type AnthropicEffort = (typeof ANTHROPIC_EFFORTS)[number];

function normalizeAnthropicEffort(value: string | undefined | null): AnthropicEffort | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none") return "low";
  return (ANTHROPIC_EFFORTS as readonly string[]).includes(normalized)
    ? (normalized as AnthropicEffort)
    : null;
}

export function getAnthropicEffort(taskKind: AgentTaskKind | undefined): AnthropicEffort {
  const suffix = taskKind ? TASK_MODEL_SUFFIXES[taskKind] : null;
  const perTask = suffix
    ? normalizeAnthropicEffort(process.env[`ANTHROPIC_${suffix.replace(/_MODEL$/, "")}_EFFORT`])
    : null;
  return (
    perTask
    || normalizeAnthropicEffort(process.env.ANTHROPIC_EFFORT)
    || normalizeAnthropicEffort(getOpenAiReasoningEffort(taskKind))
    || "medium"
  );
}

const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

// Anthropic's default is the tier table above (getDefaultAnthropicModel).
const DEFAULT_MODELS: Record<Exclude<StructuredProvider, "anthropic_agent_sdk">, string> = {
  openai_responses: DEFAULT_OPENAI_MODEL,
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

/**
 * Provider ids that existed before DeepSeek, Z.ai and OpenRouter were removed.
 * A setting naming one is the same as no setting, everywhere: the global
 * preference, the fallback, the shadow provider and every per-lane setting.
 * It is listed by name in the connectivity view and the launch checks.
 */
export const REMOVED_PROVIDER_IDS: ReadonlySet<string> = new Set(["deepseek_chat", "zai_glm", "openrouter"]);

export function isRemovedProviderId(value: string | undefined | null): boolean {
  return REMOVED_PROVIDER_IDS.has(String(value || "").trim());
}

/** The provider settings whose value can name a provider, by name. */
export function listProviderSettingKeys(): string[] {
  const laneKeys = Object.keys(TASK_MODEL_SUFFIXES)
    .map((kind) => getLaneProviderEnvKey(kind as AgentTaskKind))
    .filter((key): key is string => Boolean(key));
  return ["BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
    "BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", ...laneKeys];
}

/** The ordered-list settings (`..._PROVIDERS`), by name. */
export function listProviderListSettingKeys(): string[] {
  return ["BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", ...Object.keys(TASK_MODEL_SUFFIXES)
    .map((kind) => getLaneProvidersEnvKey(kind as AgentTaskKind)).filter((key): key is string => Boolean(key))];
}

/** Settings that still name a removed provider (a single value, or an entry of a list), by name only (never the value). */
export function listRemovedProviderSettings(): string[] {
  return [
    ...listProviderSettingKeys().filter((key) => isRemovedProviderId(process.env[key])),
    ...listProviderListSettingKeys().filter((key) => String(process.env[key] || "").split(",").some((entry) => isRemovedProviderId(entry))),
  ];
}

/** One of the interchangeable text providers a lane's order is made of. */
export function isStructuredProvider(value: unknown): value is StructuredProvider {
  return typeof value === "string" && STRUCTURED_PROVIDER_VALUES.has(value as StructuredProvider);
}

function normalizeProvider(value: string | undefined | null): StructuredProvider | null {
  const normalized = String(value || "").trim() as StructuredProvider;
  return STRUCTURED_PROVIDER_VALUES.has(normalized) ? normalized : null;
}

export function isProviderConfigured(provider: StructuredProvider): boolean {
  switch (provider) {
    case "codex_local":
      return isCodexLocalConfigured();
    case "openai_responses":
      // A key, and OPENAI_BASE_URL unset or OpenAI's own host.
      return getOpenAiConfigurationIssue() === null;
    case "anthropic_agent_sdk":
      return getAnthropicConfigurationIssue() === null;
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
 * another provider along with everything else.
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

/**
 * Lanes that write to a person default to OpenAI.
 *
 * These draft or send email: outbound outreach, waitlist, inbound
 * qualification, support and post-signup scheduling. They run on the OpenAI
 * default model (gpt-6-luna) unless a lane env override says otherwise. When
 * OpenAI is not keyed they fall back to the global chain, and the resolution
 * says so rather than pretending the default held.
 */
const TASK_DEFAULT_PROVIDER: Partial<Record<AgentTaskKind, StructuredProvider>> = {
  outbound_outreach: "openai_responses",
  waitlist_triage: "openai_responses",
  inbound_qualification: "openai_responses",
  support_triage: "openai_responses",
  post_signup_scheduling: "openai_responses",
  // Long context (every research note at once) and careful quoting.
  robot_fit_ranking: "openai_responses",
};

/**
 * Lanes pinned to one provider in their task definition rather than resolved
 * here. The resolution test checks this against the task registry.
 */
export const PINNED_TASK_PROVIDERS: Partial<Record<AgentTaskKind, AgentProvider>> = {
  adp_run_operator: "openai_agents_api",
  external_harness_thread: "acp_harness",
  site_video_evidence: "gemini_video",
  capture_video_privacy: "gemini_video",
  capture_coverage: "gemini_video",
  site_assessment: "openai_responses",
};

/** The lane's own default provider, if it has one (the lanes that write to people, and the ranking). */
export function getLaneDefaultProvider(taskKind: AgentTaskKind): StructuredProvider | null {
  return TASK_DEFAULT_PROVIDER[taskKind] ?? null;
}

/** A setting that names a provider the gate does not permit for the lane's data: refused, never honoured. */
export type ProviderSettingRefusal = {
  env_key: string;
  /** The provider id the setting names (a provider id, never a key or URL). */
  requested: StructuredProvider;
  reason: "privacy_not_permitted";
  /** The kinds of data the provider's Privacy Policy row does not name. */
  blocked_by: AgentDataClass[];
};

export type StructuredProviderResolution = {
  provider: StructuredProvider;
  lane_env_key: string | null;
  lane_request: string | null;
  lane_request_honored: boolean;
  /** The lane setting names a removed provider and is treated as no setting. */
  lane_setting_names_removed_provider: boolean;
  reason:
    | "lane_override"
    | "lane_list"
    | "global_list"
    | "lane_request_not_configured"
    | "lane_request_unrecognized"
    | "lane_request_not_permitted"
    | "lane_default"
    | "lane_default_not_configured"
    | "global_selection";
  /** Settings naming a provider the Privacy Policy does not name for this lane's data. */
  refused_settings: ProviderSettingRefusal[];
  /**
   * Set when no provider that may receive this lane's data is configured: the
   * lane fails closed and sends nothing. `no_permitted_provider`: the policy
   * names no provider here for its data; `permitted_provider_not_configured`:
   * it names one, and that one has no usable key here.
   */
  fails_closed: "no_permitted_provider" | "permitted_provider_not_configured" | null;
  /**
   * Set when Anthropic is keyed and permitted for this lane but the lane's
   * Anthropic model has no request shape or price row here: Anthropic is
   * skipped for the lane (never sent a model the adapter cannot cost), and
   * the model id is reported.
   */
  anthropic_model_not_supported: string | null;
  /** An ordered list setting that applies to this lane, by name, and its entries that are not providers. */
  provider_list: { env_key: string; unrecognized: string[] } | null;
};

/**
 * Configured for this lane: its key (and host), and for Anthropic a lane model
 * with a request shape and a price row (anthropic-models.ts). Privacy is
 * checked separately.
 */
export function providerConfiguredForLane(provider: StructuredProvider, taskKind: AgentTaskKind | undefined): boolean {
  if (!isProviderConfigured(provider)) return false;
  if (provider === "anthropic_agent_sdk" && taskKind) {
    return anthropicModelSupported(getTaskModelByProvider(taskKind).anthropic_agent_sdk);
  }
  return true;
}

function unsupportedAnthropicModel(taskKind: AgentTaskKind | undefined): string | null {
  if (!taskKind || !isProviderConfigured("anthropic_agent_sdk") || !providerPermittedForLane("anthropic_agent_sdk", taskKind)) return null;
  const model = getTaskModelByProvider(taskKind).anthropic_agent_sdk;
  return anthropicModelSupported(model) ? null : model;
}

/** Usable for a lane: permitted for its data, and configured for it. */
function usableForLane(provider: StructuredProvider, taskKind: AgentTaskKind | undefined): boolean {
  return providerPermittedForLane(provider, taskKind) && providerConfiguredForLane(provider, taskKind);
}

/**
 * Ordered provider lists. `BLUEPRINT_<LANE>_PROVIDERS` (for example
 * `openai_responses,anthropic_agent_sdk`) sets one lane's order;
 * `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS` sets it for lanes with neither
 * their own list, their own setting nor a lane default that can serve them.
 * Entries the gate refuses are reported as refused settings; entries that are
 * not providers (a removed provider's id included) are dropped and reported;
 * a list with nothing usable is ignored. The first usable entry serves the
 * lane; the later ones are tried only after a provider answers "no funds".
 */
export function getLaneProvidersEnvKey(taskKind: AgentTaskKind | undefined): string | null {
  const suffix = taskKind ? TASK_MODEL_SUFFIXES[taskKind] : null;
  return suffix ? `BLUEPRINT_${suffix.replace(/_MODEL$/, "")}_PROVIDERS` : null;
}

export const GLOBAL_PROVIDERS_ENV_KEY = "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS";

function readProviderList(envKey: string | null, taskKind: AgentTaskKind | undefined) {
  const raw = envKey ? (process.env[envKey] || "").trim() : "";
  if (!envKey || !raw) return null;
  const providers: StructuredProvider[] = [], unrecognized: string[] = [], refused: ProviderSettingRefusal[] = [];
  for (const entry of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    const provider = normalizeProvider(entry);
    if (!provider) { unrecognized.push(isRemovedProviderId(entry) ? "removed_provider" : "not_a_provider"); continue; }
    const refusal = refuseSetting(envKey, provider, taskKind);
    if (refusal) { refused.push(refusal); continue; }
    if (!providers.includes(provider)) providers.push(provider);
  }
  return { env_key: envKey, usable: providers.filter((provider) => providerConfiguredForLane(provider, taskKind)), unrecognized, refused };
}

/** Whether the gate lets a provider receive this lane's data, under the current Privacy Policy version. */
export function providerPermittedForLane(provider: StructuredProvider, taskKind: AgentTaskKind | undefined): boolean {
  return !taskKind || privacyDecision(provider, taskKind).permitted;
}

function refuseSetting(envKey: string, provider: StructuredProvider | null, taskKind: AgentTaskKind | undefined):
  ProviderSettingRefusal | null {
  if (!provider || !taskKind || providerPermittedForLane(provider, taskKind)) return null;
  return { env_key: envKey, requested: provider, reason: "privacy_not_permitted",
    blocked_by: privacyDecision(provider, taskKind).blocked_by };
}

/**
 * The resolution, not just the answer.
 *
 * Privacy first: the data-class gate (provider-privacy.ts) decides which
 * providers may receive this lane's data at all. A setting that names any
 * other provider (the lane setting, the global preference or the fallback) is
 * refused with its reason and reported, never honoured, and the lane resolves
 * to the next permitted, configured provider. With none, the lane fails
 * closed: `fails_closed` says why, the reported provider is one the policy
 * permits (whose missing key makes its adapter send nothing), and the runtime
 * gate refuses any call the policy does not permit.
 *
 * A lane setting that cannot be honoured for another reason (its provider is
 * not configured, the value is not a provider, or it names a removed provider)
 * is treated as no setting: the lane's own default applies, then the global
 * chain. Falling through silently is how you end up reading another provider
 * in the logs while the config says OpenAI, so the fall-through is reported
 * instead of swallowed, by setting name; a removed provider's id is reported
 * as such and never echoed as a request. `getAgentRuntimeConnectionMetadata`
 * surfaces it.
 */
export function describeStructuredAutomationProvider(
  taskKind?: AgentTaskKind,
): StructuredProviderResolution {
  const laneEnvKey = getLaneProviderEnvKey(taskKind);
  const laneValue = laneEnvKey ? process.env[laneEnvKey]?.trim() || null : null;
  // A lane setting naming a removed provider is the same as no setting.
  const laneRemoved = isRemovedProviderId(laneValue);
  const laneRequest = laneValue && !laneRemoved ? laneValue : null;
  const laneProvider = laneRequest ? normalizeProvider(laneRequest) : null;
  const global = selectGlobalStructuredProvider(taskKind);
  const laneRefusal = laneEnvKey ? refuseSetting(laneEnvKey, laneProvider, taskKind) : null;
  const laneList = readProviderList(getLaneProvidersEnvKey(taskKind), taskKind);
  const globalList = laneList ? null : readProviderList(GLOBAL_PROVIDERS_ENV_KEY, taskKind);
  const list = laneList ?? globalList;
  const refused = [...(laneRefusal ? [laneRefusal] : []), ...(list?.refused ?? []), ...global.refused];
  const base = { lane_env_key: laneEnvKey, lane_request: laneRequest,
    lane_setting_names_removed_provider: laneRemoved, refused_settings: refused,
    anthropic_model_not_supported: unsupportedAnthropicModel(taskKind),
    provider_list: list ? { env_key: list.env_key, unrecognized: list.unrecognized } : null };

  if (laneList?.usable.length) {
    return { ...base, provider: laneList.usable[0], lane_request_honored: !laneRequest, reason: "lane_list", fails_closed: null };
  }

  if (laneProvider && !laneRefusal && providerConfiguredForLane(laneProvider, taskKind)) {
    return { ...base, provider: laneProvider, lane_request_honored: true, reason: "lane_override", fails_closed: null };
  }

  const unhonoredReason = laneRequest
    ? (laneRefusal ? "lane_request_not_permitted" as const
      : laneProvider ? "lane_request_not_configured" as const : "lane_request_unrecognized" as const)
    : null;
  const laneDefault = taskKind ? TASK_DEFAULT_PROVIDER[taskKind] : undefined;
  if (globalList?.usable.length && !(laneDefault && usableForLane(laneDefault, taskKind))) {
    return { ...base, provider: globalList.usable[0], lane_request_honored: !unhonoredReason, reason: unhonoredReason ?? "global_list",
      fails_closed: null };
  }
  if (laneDefault && providerPermittedForLane(laneDefault, taskKind)) {
    const configured = providerConfiguredForLane(laneDefault, taskKind);
    return {
      ...base,
      provider: configured ? laneDefault : global.provider,
      lane_request_honored: !unhonoredReason && configured,
      reason: unhonoredReason ?? (configured ? "lane_default" : "lane_default_not_configured"),
      fails_closed: configured ? null : global.fails_closed,
    };
  }

  return {
    ...base,
    provider: global.provider,
    lane_request_honored: !unhonoredReason,
    reason: unhonoredReason ?? "global_selection",
    fails_closed: global.fails_closed,
  };
}

export function getStructuredAutomationProvider(
  taskKind?: AgentTaskKind,
): StructuredProvider {
  return describeStructuredAutomationProvider(taskKind).provider;
}

/**
 * The global chain for a lane: its first provider that is permitted for the
 * lane's data and configured. With no lane (the global report) it is the
 * chain as configured.
 */
function selectGlobalStructuredProvider(taskKind?: AgentTaskKind): {
  provider: StructuredProvider;
  refused: ProviderSettingRefusal[];
  fails_closed: StructuredProviderResolution["fails_closed"];
} {
  const preferred = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER,
  );
  const fallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );
  const refused = [
    refuseSetting("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", preferred, taskKind),
    refuseSetting("BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", fallback, taskKind),
  ].filter((entry): entry is ProviderSettingRefusal => Boolean(entry));

  const candidates = [
    preferred,
    normalizeProvider(isCodexLocalConfigured() ? "codex_local" : null),
    normalizeProvider(process.env.ACP_HARNESS_URL ? "acp_harness" : null),
    // OpenAI before Anthropic (owner, 2026-11-13: Anthropic goes first only
    // once a paid test run has passed). Until then Anthropic is reached only
    // without OpenAI, or where the preferred or a lane setting names it.
    normalizeProvider(isProviderConfigured("openai_responses") ? "openai_responses" : null),
    // The fallback setting is a fallback: it is consulted after OpenAI, never ahead of it.
    fallback,
    normalizeProvider(getAnthropicConfigurationIssue() === null ? "anthropic_agent_sdk" : null),
    normalizeProvider(process.env.OPENCLAW_BASE_URL ? "openclaw" : null),
    "codex_local" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && array.indexOf(candidate) === index;
  });

  const usable = candidates.find((candidate) => usableForLane(candidate, taskKind));
  if (usable) return { provider: usable, refused, fails_closed: null };
  if (!taskKind) return { provider: candidates.find(isProviderConfigured) || candidates[0], refused, fails_closed: null };
  // Nothing permitted is configured: report a permitted provider (its adapter
  // sends nothing without its key), or, when the policy permits none, keep the
  // chain's answer for the report; the runtime gate refuses the call.
  const permitted = (["openai_responses", ...candidates, "anthropic_agent_sdk"] as StructuredProvider[])
    .find((candidate) => providerPermittedForLane(candidate, taskKind));
  return permitted
    ? { provider: permitted, refused, fails_closed: "permitted_provider_not_configured" }
    : { provider: candidates.find(isProviderConfigured) || candidates[0], refused, fails_closed: "no_permitted_provider" };
}

export function getStructuredAutomationFallbackProvider(
  taskKind?: AgentTaskKind,
): StructuredProvider | null {
  const selected = getStructuredAutomationProvider(taskKind);
  const preferredFallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );

  const candidates = [
    "codex_local" as StructuredProvider,
    // The same order as the default chain: OpenAI before Anthropic, and the
    // fallback setting after OpenAI, never ahead of it.
    "openai_responses" as StructuredProvider,
    preferredFallback,
    "anthropic_agent_sdk" as StructuredProvider,
    "acp_harness" as StructuredProvider,
    "openclaw" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && candidate !== selected && array.indexOf(candidate) === index;
  });

  // Never a provider the gate does not permit for the lane's data.
  return candidates.find((candidate) => usableForLane(candidate, taskKind)) || null;
}

/** The global chain's candidates in order (configured or not), for the ordered list. */
function globalChainOrder(): StructuredProvider[] {
  return [normalizeProvider(process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER), "codex_local" as StructuredProvider,
    "acp_harness" as StructuredProvider, "openai_responses" as StructuredProvider,
    normalizeProvider(process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER),
    "anthropic_agent_sdk" as StructuredProvider, "openclaw" as StructuredProvider]
    .filter((candidate, index, array): candidate is StructuredProvider => Boolean(candidate) && array.indexOf(candidate) === index);
}

/**
 * The lane's providers in the order they are tried: the one the lane resolves
 * to first, then the rest of its list (or, with none, of the global chain),
 * each permitted for the lane's data and configured for it.
 */
export function getStructuredProviderOrder(taskKind: AgentTaskKind): StructuredProvider[] {
  const resolution = describeStructuredAutomationProvider(taskKind);
  const laneList = readProviderList(getLaneProvidersEnvKey(taskKind), taskKind);
  const list = laneList?.usable.length ? laneList : (() => {
    const globalList = laneList ? null : readProviderList(GLOBAL_PROVIDERS_ENV_KEY, taskKind);
    return globalList?.usable.length ? globalList : null;
  })();
  const rest = (list ? list.usable : globalChainOrder()).filter((provider) => usableForLane(provider, taskKind));
  const first = resolution.fails_closed ? [] : [resolution.provider];
  return [...first, ...rest].filter((provider, index, array) => array.indexOf(provider) === index);
}

/** Providers whose adapter enforces the per-run inference cost cap: a lane is only ever switched to one of these. */
export const RUN_CAP_ENFORCING_PROVIDERS: ReadonlySet<StructuredProvider> = new Set<StructuredProvider>([
  "openai_responses", "anthropic_agent_sdk",
]);

export type FailoverDecision =
  | { provider: StructuredProvider; skipped: Array<{ provider: StructuredProvider; reason: FailoverSkipReason }> }
  | { provider: null; skipped: Array<{ provider: StructuredProvider; reason: FailoverSkipReason }> };
export type FailoverSkipReason = "run_cap_not_enforced" | "cooling_down_no_funds" | "mutation_reconciliation_unsupported";

/**
 * Where a run goes after its provider answered "no funds": the next provider
 * in the lane's order that the gate permits for the lane's data, that is
 * configured (for Anthropic, with a priced, supported model), that enforces
 * the per-run cap, and that is not itself cooling down after "no funds".
 */
export function chooseFailoverProvider(taskKind: AgentTaskKind, from: AgentProvider,
  options: { mutationReconciliationRequired?: boolean; nowMs?: number } = {}): FailoverDecision {
  const skipped: Array<{ provider: StructuredProvider; reason: FailoverSkipReason }> = [];
  for (const provider of getStructuredProviderOrder(taskKind)) {
    if (provider === from) continue;
    if (!RUN_CAP_ENFORCING_PROVIDERS.has(provider)) { skipped.push({ provider, reason: "run_cap_not_enforced" }); continue; }
    if (options.mutationReconciliationRequired && provider !== "openai_responses") {
      skipped.push({ provider, reason: "mutation_reconciliation_unsupported" }); continue;
    }
    if (isProviderCoolingDown(provider, options.nowMs)) { skipped.push({ provider, reason: "cooling_down_no_funds" }); continue; }
    return { provider, skipped };
  }
  return { provider: null, skipped };
}

/**
 * The shadow lanes' provider. `BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER` names it;
 * an unset, unrecognised or removed value is no setting, which means the ACP
 * harness. The gate applies as everywhere: a provider the policy does not
 * name for the lane's data is refused, and the shadow run is skipped (it is a
 * comparison, never the lane's answer).
 */
const AUTOAGENT_SHADOW_DEFAULT_PROVIDER: StructuredProvider = "acp_harness";

export type ShadowProviderResolution = {
  provider: StructuredProvider;
  env_key: "BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER";
  setting_names_removed_provider: boolean;
  /** Set when the shadow run is skipped: its provider may not receive the lane's data. */
  refused: { reason: "privacy_not_permitted"; blocked_by: AgentDataClass[] } | null;
};

export function describeAutoAgentShadowProvider(taskKind: AgentTaskKind): ShadowProviderResolution {
  const value = (process.env.BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER || "").trim();
  const named = (["openai_responses", "anthropic_agent_sdk", "openclaw", "acp_harness"] as StructuredProvider[])
    .find((provider) => provider === value) ?? null;
  const provider = named ?? AUTOAGENT_SHADOW_DEFAULT_PROVIDER;
  const decision = privacyDecision(provider, taskKind);
  return { provider, env_key: "BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", setting_names_removed_provider: isRemovedProviderId(value),
    refused: decision.permitted ? null : { reason: "privacy_not_permitted", blocked_by: decision.blocked_by } };
}

export function getTaskModelByProvider(taskKind: AgentTaskKind) {
  const suffix = TASK_MODEL_SUFFIXES[taskKind];
  return {
    codex_local:
      (suffix ? process.env[`CODEX_${suffix}`]?.trim() : null)
      || process.env.CODEX_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.codex_local,
    openai_responses:
      (suffix ? process.env[`OPENAI_${suffix}`]?.trim() : null)
      || process.env.OPENAI_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openai_responses,
    anthropic_agent_sdk:
      (suffix ? process.env[`ANTHROPIC_${suffix}`]?.trim() : null)
      || getDefaultAnthropicModel(taskKind),
    acp_harness:
      process.env.ACP_DEFAULT_HARNESS?.trim()
      || DEFAULT_MODELS.acp_harness,
    openclaw:
      (suffix ? process.env[`OPENCLAW_${suffix}`]?.trim() : null)
      || process.env.OPENCLAW_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openclaw,
  } satisfies Partial<Record<AgentProvider, string>>;
}
