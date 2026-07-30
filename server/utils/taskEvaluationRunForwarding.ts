import { createHmac, randomUUID } from "node:crypto";

import {
  parseVerifiedTaskEvaluationRunAuthorization,
  parseVerifiedTaskEvaluationRunExecutionResult,
  parseVerifiedTaskEvaluationRunPreparation,
} from "./taskEvaluationRunContract";

const DEFAULT_TIMEOUT_MS = 10_000;

function text(value: unknown) {
  return String(value || "").trim();
}

export async function forwardTaskEvaluationRunExecutionToPipeline(params: {
  runId: string;
  planDigest: string;
  requestDigest: string;
  testbedDigest: string;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<{
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  result?: Record<string, any>;
}> {
  const configured = text(params.endpointUrl)
    || text(process.env.TASK_EVALUATION_RUN_EXECUTE_URL);
  const endpoint = configured.replace("{run_id}", encodeURIComponent(params.runId));
  const isRequired = required();
  if (!endpoint) return {
    status: "not_configured", performed: false, required: isRequired,
    endpoint_configured: false, blocker: "task_evaluation_run_execute_url_missing",
  };
  const token = text(params.token) || text(process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked", performed: false, required: isRequired,
    endpoint_configured: true, blocker: "task_evaluation_run_forward_token_missing",
  };
  const clientId = text(params.clientId)
    || text(process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID)
    || "blueprint-webapp";
  const body = "";
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-client-id": clientId,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      blocker: "pipeline_task_evaluation_run_execution_rejected",
    };
    const verified = parseVerifiedTaskEvaluationRunExecutionResult({
      value: payload,
      expectedRunId: params.runId,
      expectedPlanDigest: params.planDigest,
      expectedRequestDigest: params.requestDigest,
      expectedTestbedDigest: params.testbedDigest,
    });
    if (!verified.ok) return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      blocker: verified.blockers.join(","),
    };
    return {
      status: "forwarded", performed: true, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      result: verified.result,
    };
  } catch (error) {
    return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      blocker: "task_evaluation_run_execution_forward_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function required() {
  const configured = text(process.env.TASK_EVALUATION_RUN_FORWARD_REQUIRED).toLowerCase();
  if (configured === "true") return true;
  if (configured === "false" && process.env.NODE_ENV !== "production") return false;
  return process.env.NODE_ENV === "production";
}

function timeoutMs() {
  const configured = Number(process.env.TASK_EVALUATION_RUN_FORWARD_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(configured, DEFAULT_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
}

export type TaskEvaluationRunPlanForwardResult = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  preparation?: Record<string, any>;
};

export async function forwardTaskEvaluationRunPlanToPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  runId: string;
  request: Record<string, unknown>;
  testbed: Record<string, unknown>;
  idempotencyKey: string;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<TaskEvaluationRunPlanForwardResult> {
  const endpoint = text(params.endpointUrl) || text(process.env.TASK_EVALUATION_RUN_PLAN_URL);
  const isRequired = required();
  if (!endpoint) return {
    status: "not_configured",
    performed: false,
    required: isRequired,
    endpoint_configured: false,
    blocker: "task_evaluation_run_plan_url_missing",
  };
  const token = text(params.token) || text(process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked",
    performed: false,
    required: isRequired,
    endpoint_configured: true,
    blocker: "task_evaluation_run_forward_token_missing",
  };
  const clientId = text(params.clientId)
    || text(process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID)
    || "blueprint-webapp";
  const submission = {
    schema_version: "task_evaluation_run_plan_submission.v2",
    run_id: params.runId,
    capture_session_id: params.captureSessionId,
    intake_id: params.intakeId,
    decision_evidence_request: params.request,
    testbed: params.testbed,
    idempotency_key: params.idempotencyKey,
  };
  const body = JSON.stringify(submission);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-client-id": clientId,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      blocker: "pipeline_task_evaluation_run_plan_rejected",
    };
    const verified = parseVerifiedTaskEvaluationRunPreparation({
      value: payload,
      expectedCaptureSessionId: params.captureSessionId,
      expectedIntakeId: params.intakeId,
      expectedRunId: params.runId,
      expectedRequestDigest: text(params.request.request_digest),
      expectedTestbed: params.testbed,
    });
    if (!verified.ok) return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      blocker: verified.blockers.join(","),
    };
    return {
      status: "forwarded",
      performed: true,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      preparation: verified.preparation,
    };
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      blocker: "task_evaluation_run_plan_forward_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function forwardTaskEvaluationRunAuthorizationToPipeline(params: {
  runId: string;
  planDigest: string;
  authorizedAdapterReferences: string[];
  actor: Record<string, unknown>;
  idempotencyKey: string;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<{
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  authorization?: Record<string, any>;
}> {
  const configured = text(params.endpointUrl)
    || text(process.env.TASK_EVALUATION_RUN_AUTHORIZE_URL);
  const endpoint = configured.replace("{run_id}", encodeURIComponent(params.runId));
  const isRequired = required();
  if (!endpoint) return {
    status: "not_configured", performed: false, required: isRequired,
    endpoint_configured: false, blocker: "task_evaluation_run_authorize_url_missing",
  };
  const token = text(params.token) || text(process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked", performed: false, required: isRequired,
    endpoint_configured: true, blocker: "task_evaluation_run_forward_token_missing",
  };
  const clientId = text(params.clientId)
    || text(process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID)
    || "blueprint-webapp";
  const submission = {
    schema_version: "task_evaluation_run_authorization_submission.v1",
    plan_digest: params.planDigest,
    authorized_adapter_references: [...new Set(params.authorizedAdapterReferences)].sort(),
    actor: params.actor,
    idempotency_key: params.idempotencyKey,
  };
  const body = JSON.stringify(submission);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-client-id": clientId,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      blocker: "pipeline_task_evaluation_run_authorization_rejected",
    };
    const verified = parseVerifiedTaskEvaluationRunAuthorization({
      value: payload,
      expectedRunId: params.runId,
      expectedPlanDigest: params.planDigest,
      expectedAdapterReferences: submission.authorized_adapter_references,
      expectedActorRole: text(params.actor.role),
      expectedActorIdentity: text(params.actor.identity),
    });
    if (!verified.ok) return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      blocker: verified.blockers.join(","),
    };
    return {
      status: "forwarded", performed: true, required: isRequired,
      endpoint_configured: true, http_status: response.status,
      authorization: verified.authorization,
    };
  } catch (error) {
    return {
      status: "failed", performed: false, required: isRequired,
      endpoint_configured: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      blocker: "task_evaluation_run_authorization_forward_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
