import { runAgentTask } from "./runtime";
import { describeStructuredAutomationProvider, isProviderConfigured } from "./provider-config";
import { runtimeDefaultModel } from "./runtime-connectivity";

export async function runAgentRuntimeSmokeTest(params?: {
  model?: string;
}) {
  const startedAt = Date.now();
  // Its own lane of fixed text (tasks/runtime-smoke-test.ts), resolved through
  // the data-class gate on the default order: OpenAI first.
  const lane = describeStructuredAutomationProvider("runtime_smoke_test");
  const connectivity = { provider: lane.provider };

  if (lane.fails_closed || !isProviderConfigured(lane.provider)) {
    throw new Error(`Agent runtime provider ${lane.provider} is not configured for the smoke test`
      + (lane.fails_closed ? ` (${lane.fails_closed})` : ""));
  }

  const result = await runAgentTask<
    Record<string, never>,
    {
      reply: string;
      summary: string;
      suggested_actions: string[];
      requires_human_review: boolean;
    }
  >({
    kind: "runtime_smoke_test",
    provider: connectivity.provider,
    runtime: connectivity.provider,
    model: params?.model?.trim() || runtimeDefaultModel(),
    input: {},
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
