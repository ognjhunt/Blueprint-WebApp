import { runAgentTask } from "./runtime";

function runtimeDefaultModel() {
  return process.env.OPENAI_DEFAULT_MODEL?.trim()
    || process.env.OPENAI_OPERATOR_THREAD_MODEL?.trim()
    || "gpt-5.4";
}

export function getAgentRuntimeConnectionMetadata() {
  return {
    provider: "openai_responses" as const,
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    auth_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    timeout_ms: Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000),
    default_model: runtimeDefaultModel(),
    task_models: {
      waitlist_triage: process.env.OPENAI_WAITLIST_AUTOMATION_MODEL?.trim() || null,
      inbound_qualification: process.env.OPENAI_INBOUND_QUALIFICATION_MODEL?.trim() || null,
      post_signup_scheduling: process.env.OPENAI_POST_SIGNUP_MODEL?.trim() || null,
      operator_thread: process.env.OPENAI_OPERATOR_THREAD_MODEL?.trim() || null,
      support_triage: process.env.OPENAI_SUPPORT_TRIAGE_MODEL?.trim() || null,
      payout_exception_triage:
        process.env.OPENAI_PAYOUT_EXCEPTION_MODEL?.trim() || null,
      preview_diagnosis: process.env.OPENAI_PREVIEW_DIAGNOSIS_MODEL?.trim() || null,
    },
  };
}

export async function runAgentRuntimeSmokeTest(params?: {
  model?: string;
}) {
  const startedAt = Date.now();
  const connectivity = getAgentRuntimeConnectionMetadata();

  if (!connectivity.configured) {
    throw new Error("OPENAI_API_KEY is not configured");
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
    provider: "openai_responses",
    runtime: "openai_responses",
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
