import type { AgentResult, NormalizedAgentTask } from "../types";

const acpHarnessUrl = process.env.ACP_HARNESS_URL?.trim();
const acpHarnessToken = process.env.ACP_HARNESS_TOKEN?.trim();

export async function runAcpHarnessTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (!acpHarnessUrl) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "ACP_HARNESS_URL is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared ACP harness request",
      harness_url: acpHarnessUrl,
      model: task.model,
    },
  ];
  const response = await fetch(acpHarnessUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(acpHarnessToken ? { Authorization: `Bearer ${acpHarnessToken}` } : {}),
    },
    body: JSON.stringify({
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      kind: task.kind,
      prompt: task.definition.build_prompt(task.input),
      input: task.input,
      session_id: task.session_id,
      session_key: task.session_key,
      metadata: task.metadata || {},
    }),
  });
  traceLogs.push({
    event_type: "provider.response.http",
    status: response.ok ? "success" : "error",
    summary: `ACP harness responded with HTTP ${response.status}`,
    status_code: response.status,
  });

  if (!response.ok) {
    const errorText = await response.text();
    traceLogs.push({
      event_type: "provider.response.failed",
      status: "error",
      summary: "ACP harness request failed",
      error: errorText,
    });
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: `ACP harness failed: ${response.status} ${errorText}`,
      logs: traceLogs,
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const payload = (await response.json()) as {
    status?: string;
    output?: TOutput;
    raw_output_text?: string;
    requires_human_review?: boolean;
    requires_approval?: boolean;
    approval_reason?: string | null;
    error?: string | null;
    logs?: Array<Record<string, unknown>>;
  };
  traceLogs.push({
    event_type: "provider.response.parsed",
    status: "success",
    summary: "Parsed ACP harness JSON response",
    payload_status: payload.status || "completed",
  });

  return {
    status:
      payload.status === "pending_approval"
        ? "pending_approval"
        : payload.status === "failed"
          ? "failed"
          : "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: payload.output,
    raw_output_text: payload.raw_output_text,
    error: payload.error || null,
    logs: [...traceLogs, ...(payload.logs || [])],
    requires_human_review: payload.requires_human_review === true,
    requires_approval: payload.requires_approval === true,
    approval_reason: payload.approval_reason || null,
  };
}
