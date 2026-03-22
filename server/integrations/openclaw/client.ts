import { z } from "zod";

const openClawBaseUrl = process.env.OPENCLAW_BASE_URL?.trim();
const openClawAuthToken = process.env.OPENCLAW_AUTH_TOKEN?.trim();
const openClawTimeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS ?? 20_000);
const openClawWaitTimeoutMs = Number(process.env.OPENCLAW_WAIT_TIMEOUT_MS ?? 60_000);
const openClawAgentPath = process.env.OPENCLAW_AGENT_PATH?.trim() || "/agent";
const openClawAgentWaitPath =
  process.env.OPENCLAW_AGENT_WAIT_PATH?.trim() || "/agent/wait";
const openClawCancelPathTemplate =
  process.env.OPENCLAW_AGENT_CANCEL_PATH_TEMPLATE?.trim() || "/agent/{run_id}/cancel";
const openClawArtifactsPathTemplate =
  process.env.OPENCLAW_AGENT_ARTIFACTS_PATH_TEMPLATE?.trim() || "/agent/{run_id}/artifacts";

export const openClawModeSchema = z.enum(["sync", "async", "interactive"]);

export const openClawPolicySchema = z.object({
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  requires_approval: z.boolean(),
  allowed_domains: z.array(z.string()).default([]),
  allowed_tools: z.array(z.string()).default([]),
  allowed_skill_ids: z.array(z.string()).default([]),
  forbidden_actions: z.array(z.string()).default([]),
  artifact_retention_policy: z
    .object({
      retain_logs: z.boolean().default(true),
      retain_artifacts: z.boolean().default(true),
      retention_days: z.number().int().positive().default(30),
    })
    .default({
      retain_logs: true,
      retain_artifacts: true,
      retention_days: 30,
    }),
});

export const openClawActionRequestSchema = z.object({
  request_id: z.string().min(1),
  session_key: z.string().min(1),
  task_type: z.string().min(1),
  mode: openClawModeSchema,
  inputs: z.record(z.unknown()),
  startup_context: z.record(z.unknown()).nullable().optional(),
  policy: openClawPolicySchema,
  artifacts_config: z.object({
    artifact_targets: z.array(z.string()).default([]),
    include_logs: z.boolean().default(true),
    include_screenshots: z.boolean().default(false),
  }),
  wait_timeout_ms: z.number().int().positive().optional(),
  model: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
});

export const openClawActionResponseSchema = z.object({
  accepted: z.boolean(),
  openclaw_session_id: z.string().nullish(),
  openclaw_run_id: z.string().nullish(),
  status: z.string(),
  estimated_mode: openClawModeSchema.optional(),
  result: z.unknown().optional(),
  raw_output_text: z.string().optional(),
  artifacts: z.record(z.unknown()).nullish(),
  logs: z.array(z.record(z.unknown())).nullish(),
  error: z.string().nullish(),
});

export type OpenClawActionRequest = z.infer<typeof openClawActionRequestSchema>;
export type OpenClawActionResponse = z.infer<typeof openClawActionResponseSchema>;

function replaceRunId(template: string, runId: string) {
  return template.replace("{run_id}", encodeURIComponent(runId));
}

export function getOpenClawConnectionMetadata() {
  const baseUrl = openClawBaseUrl?.replace(/\/+$/, "") || null;
  return {
    configured: Boolean(baseUrl),
    base_url: baseUrl,
    auth_configured: Boolean(openClawAuthToken),
    timeout_ms: openClawTimeoutMs,
    wait_timeout_ms: openClawWaitTimeoutMs,
    agent_path: openClawAgentPath,
    wait_path: openClawAgentWaitPath,
    cancel_path_template: openClawCancelPathTemplate,
    artifacts_path_template: openClawArtifactsPathTemplate,
    default_model: process.env.OPENCLAW_DEFAULT_MODEL?.trim() || null,
    task_models: {
      waitlist_triage: process.env.OPENCLAW_WAITLIST_AUTOMATION_MODEL?.trim() || null,
      inbound_qualification:
        process.env.OPENCLAW_INBOUND_QUALIFICATION_MODEL?.trim() || null,
      post_signup_scheduling: process.env.OPENCLAW_POST_SIGNUP_MODEL?.trim() || null,
      operator_thread: process.env.OPENCLAW_OPERATOR_THREAD_MODEL?.trim() || null,
      support_triage: process.env.OPENCLAW_SUPPORT_TRIAGE_MODEL?.trim() || null,
      payout_exception_triage:
        process.env.OPENCLAW_PAYOUT_EXCEPTION_MODEL?.trim() || null,
      preview_diagnosis: process.env.OPENCLAW_PREVIEW_DIAGNOSIS_MODEL?.trim() || null,
      external_harness_thread:
        process.env.OPENCLAW_EXTERNAL_HARNESS_MODEL?.trim() || null,
    },
  };
}

function requireBaseUrl() {
  if (!openClawBaseUrl) {
    throw new Error("OPENCLAW_BASE_URL is not configured");
  }
  return openClawBaseUrl.replace(/\/+$/, "");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(openClawAuthToken ? { Authorization: `Bearer ${openClawAuthToken}` } : {}),
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  const raw = text ? (JSON.parse(text) as unknown) : {};
  return openClawActionResponseSchema.parse(raw);
}

export async function startActionSession(
  request: OpenClawActionRequest,
): Promise<OpenClawActionResponse> {
  const response = await fetch(`${requireBaseUrl()}${openClawAgentPath}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(openClawActionRequestSchema.parse(request)),
    signal: AbortSignal.timeout(Math.max(1_000, openClawTimeoutMs)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenClaw agent request failed: ${response.status} ${errorText}`);
  }

  return parseResponse(response);
}

export async function waitForActionResult(params: {
  openclaw_run_id: string;
  wait_timeout_ms?: number;
}): Promise<OpenClawActionResponse> {
  const response = await fetch(`${requireBaseUrl()}${openClawAgentWaitPath}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      openclaw_run_id: params.openclaw_run_id,
      wait_timeout_ms: params.wait_timeout_ms || openClawWaitTimeoutMs,
    }),
    signal: AbortSignal.timeout(
      Math.max(1_000, params.wait_timeout_ms || openClawWaitTimeoutMs),
    ),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenClaw wait request failed: ${response.status} ${errorText}`);
  }

  return parseResponse(response);
}

export async function cancelActionSession(openclawRunId: string) {
  const response = await fetch(
    `${requireBaseUrl()}${replaceRunId(openClawCancelPathTemplate, openclawRunId)}`,
    {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(Math.max(1_000, openClawTimeoutMs)),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenClaw cancel request failed: ${response.status} ${errorText}`);
  }

  return parseResponse(response);
}

export async function listSessionArtifacts(openclawRunId: string) {
  const response = await fetch(
    `${requireBaseUrl()}${replaceRunId(openClawArtifactsPathTemplate, openclawRunId)}`,
    {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(Math.max(1_000, openClawTimeoutMs)),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenClaw artifact request failed: ${response.status} ${errorText}`);
  }

  return parseResponse(response);
}

export async function extractPdf(
  request: Omit<OpenClawActionRequest, "task_type">,
): Promise<OpenClawActionResponse> {
  return startActionSession({
    ...request,
    task_type: "pdf_extraction",
  });
}

export async function runBrowserFlow(
  request: Omit<OpenClawActionRequest, "task_type">,
): Promise<OpenClawActionResponse> {
  return startActionSession({
    ...request,
    task_type: "browser_flow",
  });
}

export async function executeSkill(
  request: Omit<OpenClawActionRequest, "task_type"> & { skill_id: string },
): Promise<OpenClawActionResponse> {
  return startActionSession({
    ...request,
    task_type: `skill:${request.skill_id}`,
  });
}

export async function runOpenClawSmokeTest(params?: {
  model?: string;
  includeArtifactProbe?: boolean;
}) {
  const startedAt = Date.now();
  const metadata = getOpenClawConnectionMetadata();
  if (!metadata.configured) {
    throw new Error("OPENCLAW_BASE_URL is not configured");
  }

  const initial = await startActionSession({
    request_id: `openclaw-smoke-${Date.now()}`,
    session_key: `smoke:${Date.now()}`,
    task_type: "operator_thread",
    mode: "sync",
    inputs: {
      message: "Return the exact operator-thread JSON shape for a connectivity smoke test.",
    },
    startup_context: null,
    policy: {
      risk_level: "low",
      requires_approval: false,
      allowed_domains: [],
      allowed_tools: ["api"],
      allowed_skill_ids: [],
      forbidden_actions: [],
      artifact_retention_policy: {
        retain_logs: true,
        retain_artifacts: true,
        retention_days: 1,
      },
    },
    artifacts_config: {
      artifact_targets: ["json_result", "text_summary", "skill_log"],
      include_logs: true,
      include_screenshots: false,
    },
    wait_timeout_ms: openClawWaitTimeoutMs,
    model:
      params?.model ||
      process.env.OPENCLAW_OPERATOR_THREAD_MODEL?.trim() ||
      process.env.OPENCLAW_DEFAULT_MODEL?.trim() ||
      "openai/gpt-5.4",
    prompt: `You are a connectivity smoke test for Blueprint.

Return JSON only with this exact shape:
{
  "reply": "OpenClaw connectivity smoke test passed.",
  "summary": "Smoke test completed successfully.",
  "suggested_actions": ["Continue integration"],
  "requires_human_review": false
}`,
  });

  const final =
    initial.openclaw_run_id &&
    initial.status !== "completed" &&
    initial.status !== "failed"
      ? await waitForActionResult({
          openclaw_run_id: initial.openclaw_run_id,
          wait_timeout_ms: openClawWaitTimeoutMs,
        })
      : initial;

  let artifactProbe: OpenClawActionResponse | null = null;
  if (params?.includeArtifactProbe && final.openclaw_run_id) {
    try {
      artifactProbe = await listSessionArtifacts(final.openclaw_run_id);
    } catch {
      artifactProbe = null;
    }
  }

  return {
    ok: final.accepted && final.status === "completed",
    duration_ms: Date.now() - startedAt,
    connection: metadata,
    initial,
    final,
    artifact_probe: artifactProbe,
  };
}
