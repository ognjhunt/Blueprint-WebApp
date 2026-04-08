import { runAgentTask } from "./runtime";
import {
  getStructuredAutomationFallbackProvider,
  getStructuredAutomationProvider,
  getTaskModelByProvider,
  isProviderConfigured,
} from "./provider-config";

function runtimeDefaultModel() {
  const provider = getStructuredAutomationProvider();
  return getTaskModelByProvider("operator_thread")[provider] || "gpt-5.4";
}

export function getAgentRuntimeConnectionMetadata() {
  const provider = getStructuredAutomationProvider();
  const fallbackProvider = getStructuredAutomationFallbackProvider();
  const taskModels = {
    waitlist_triage: getTaskModelByProvider("waitlist_triage")[provider] || null,
    inbound_qualification:
      getTaskModelByProvider("inbound_qualification")[provider] || null,
    post_signup_scheduling:
      getTaskModelByProvider("post_signup_scheduling")[provider] || null,
    operator_thread: getTaskModelByProvider("operator_thread")[provider] || null,
    support_triage: getTaskModelByProvider("support_triage")[provider] || null,
    payout_exception_triage:
      getTaskModelByProvider("payout_exception_triage")[provider] || null,
    preview_diagnosis: getTaskModelByProvider("preview_diagnosis")[provider] || null,
  };

  return {
    provider,
    fallback_provider: fallbackProvider,
    configured: isProviderConfigured(provider),
    auth_configured: isProviderConfigured(provider),
    timeout_ms: Number(
      provider === "anthropic_agent_sdk"
        ? process.env.ANTHROPIC_TIMEOUT_MS ?? 20_000
        : provider === "codex_local"
          ? process.env.CODEX_TIMEOUT_MS ?? 120_000
        : provider === "openclaw"
          ? process.env.OPENCLAW_TIMEOUT_MS ?? 20_000
          : process.env.OPENAI_TIMEOUT_MS ?? 20_000,
    ),
    default_model: runtimeDefaultModel(),
    task_models: taskModels,
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
