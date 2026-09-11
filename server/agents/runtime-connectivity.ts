import { runAgentTask } from "./runtime";
import type { AgentTaskKind } from "./types";
import {
  describeStructuredAutomationProvider,
  getStructuredAutomationFallbackProvider,
  getOpenAiTimeoutMs,
  getStructuredAutomationProvider,
  getTaskModelByProvider,
  isProviderConfigured,
  type StructuredProvider,
} from "./provider-config";

/**
 * The lanes this metadata speaks for.
 *
 * Provider is now resolved per lane, so reporting one global provider and
 * pairing every lane's model with it would describe a routing that does not
 * exist. Each lane is resolved on its own and reported with the provider that
 * will actually serve it.
 */
const CONNECTIVITY_TASK_KINDS = [
  "waitlist_triage",
  "inbound_qualification",
  "post_signup_scheduling",
  "operator_thread",
  "support_triage",
  "payout_exception_triage",
  "preview_diagnosis",
] as const satisfies readonly AgentTaskKind[];

type ConnectivityTaskKind = (typeof CONNECTIVITY_TASK_KINDS)[number];

function runtimeDefaultModel() {
  const provider = getStructuredAutomationProvider("operator_thread");
  return getTaskModelByProvider("operator_thread")[provider] || "gpt-5.4";
}

export function getAgentRuntimeConnectionMetadata() {
  const provider = getStructuredAutomationProvider();
  const fallbackProvider = getStructuredAutomationFallbackProvider();

  const taskProviders = {} as Record<ConnectivityTaskKind, StructuredProvider>;
  const taskModels = {} as Record<ConnectivityTaskKind, string | null>;
  const unhonoredLaneProviders: Array<{
    task_kind: ConnectivityTaskKind;
    env_key: string;
    requested: string;
    using: StructuredProvider;
    reason: string;
  }> = [];

  for (const taskKind of CONNECTIVITY_TASK_KINDS) {
    const resolution = describeStructuredAutomationProvider(taskKind);
    taskProviders[taskKind] = resolution.provider;
    taskModels[taskKind] = getTaskModelByProvider(taskKind)[resolution.provider] || null;
    if (!resolution.lane_request_honored && resolution.lane_env_key && resolution.lane_request) {
      unhonoredLaneProviders.push({
        task_kind: taskKind,
        env_key: resolution.lane_env_key,
        requested: resolution.lane_request,
        using: resolution.provider,
        reason: resolution.reason,
      });
    }
  }

  return {
    provider,
    fallback_provider: fallbackProvider,
    configured: isProviderConfigured(provider),
    auth_configured: isProviderConfigured(provider),
    timeout_ms: Number(
      provider === "anthropic_agent_sdk"
        ? process.env.ANTHROPIC_TIMEOUT_MS ?? 20_000
        : provider === "deepseek_chat"
          ? process.env.DEEPSEEK_TIMEOUT_MS ?? 120_000
        : provider === "codex_local"
          ? process.env.CODEX_TIMEOUT_MS ?? 120_000
        : provider === "openclaw"
          ? process.env.OPENCLAW_TIMEOUT_MS ?? 20_000
          : getOpenAiTimeoutMs(),
    ),
    default_model: runtimeDefaultModel(),
    task_providers: taskProviders,
    task_models: taskModels,
    unhonored_lane_providers: unhonoredLaneProviders,
  };
}

export async function runAgentRuntimeSmokeTest(params?: {
  model?: string;
}) {
  const startedAt = Date.now();
  const connectivity = getAgentRuntimeConnectionMetadata();

  if (!connectivity.configured) {
    throw new Error(`Primary agent runtime provider ${connectivity.provider} is not configured`);
  }

  const result = await runAgentTask<
    { message: string },
    {
      reply: string;
      summary: string;
      suggested_actions: string[];
      requires_human_review: boolean;
    }
  >({
    kind: "operator_thread",
    provider: connectivity.provider,
    runtime: connectivity.provider,
    model: params?.model?.trim() || runtimeDefaultModel(),
    input: {
      message:
        'Return JSON only with reply="Agent runtime smoke test passed.", summary="Smoke test completed successfully.", suggested_actions=["Continue integration"], requires_human_review=false.',
    },
  });

  return {
    ok: result.status === "completed" && Boolean(result.output),
    duration_ms: Date.now() - startedAt,
    final: {
      status: result.status,
      provider: result.provider,
      runtime: result.runtime,
      model: result.model,
      error: result.error || null,
      result: result.output || null,
    },
  };
}
