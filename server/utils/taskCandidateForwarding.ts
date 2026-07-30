import { createHmac, randomUUID } from "node:crypto";

import {
  parseVerifiedPipelineTaskDecisionResult,
  stableJson,
  type PipelineTaskDecisionProcessingResult,
} from "./taskCandidateContract";

const DEFAULT_TIMEOUT_MS = 10_000;
const FORWARD_URL_ENV = "TASK_CANDIDATE_DECISION_FORWARD_URL";
const FORWARD_TOKEN_ENV = "TASK_CANDIDATE_DECISION_FORWARD_TOKEN";
const FORWARD_CLIENT_ID_ENV = "TASK_CANDIDATE_DECISION_FORWARD_CLIENT_ID";

function text(value: unknown) {
  return String(value || "").trim();
}

function required() {
  const configured = text(process.env.TASK_CANDIDATE_DECISION_FORWARD_REQUIRED).toLowerCase();
  if (configured === "true") return true;
  if (configured === "false" && process.env.NODE_ENV !== "production") return false;
  return process.env.NODE_ENV === "production";
}

function timeoutMs() {
  const configured = Number(process.env.TASK_CANDIDATE_DECISION_FORWARD_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(configured, DEFAULT_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
}

export type TaskCandidateDecisionForwardResult = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  pipeline_result?: PipelineTaskDecisionProcessingResult;
};

export async function forwardTaskCandidateDecisionToPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  discoveryId: string;
  sourceCaptureDigest: string;
  command: Record<string, unknown>;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<TaskCandidateDecisionForwardResult> {
  const endpoint = text(params.endpointUrl) || text(process.env[FORWARD_URL_ENV]);
  const isRequired = required();
  if (!endpoint) {
    return {
      status: "not_configured",
      performed: false,
      required: isRequired,
      endpoint_configured: false,
      blocker: "task_candidate_decision_forward_url_missing",
    };
  }
  const token = text(params.token) || text(process.env[FORWARD_TOKEN_ENV]);
  if (!token) {
    return {
      status: "blocked",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      blocker: "task_candidate_decision_forward_token_missing",
    };
  }
  const clientId =
    text(params.clientId) || text(process.env[FORWARD_CLIENT_ID_ENV]) || "blueprint-webapp";
  const submission = {
    schema_version: "task_candidate_decision_submission.v1",
    capture_session_id: params.captureSessionId,
    intake_id: params.intakeId,
    command: params.command,
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
    if (!response.ok) {
      return {
        status: "failed",
        performed: false,
        required: isRequired,
        endpoint_configured: true,
        http_status: response.status,
        blocker: "pipeline_task_decision_rejected",
      };
    }
    const verified = parseVerifiedPipelineTaskDecisionResult(payload);
    if (!verified.ok) {
      return {
        status: "failed",
        performed: false,
        required: isRequired,
        endpoint_configured: true,
        http_status: response.status,
        blocker: verified.blockers.join(","),
      };
    }
    const result = verified.result;
    const decision = result.pipeline_task_decision;
    const action = params.command.action;
    const expectedStatus = action === "approve" || action === "edit_and_approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : "recapture_requested";
    if (
      result.capture_session_id !== params.captureSessionId ||
      result.intake_id !== params.intakeId ||
      result.command_request_id !== params.command.command_request_id ||
      result.pipeline_approval_status !== expectedStatus ||
      decision.discovery_id !== params.discoveryId ||
      decision.discovery_digest !== params.command.discovery_digest ||
      decision.task_candidate_id !== params.command.task_candidate_id ||
      decision.candidate_digest !== params.command.candidate_digest ||
      decision.action !== action ||
      decision.idempotency_key !== params.command.idempotency_key ||
      decision.rationale !== params.command.rationale ||
      stableJson(decision.actor) !== stableJson(params.command.actor) ||
      stableJson(decision.edited_task) !== stableJson(params.command.edited_task) ||
      (result.approved_task_definition?.source_capture.intake_id ?? params.intakeId) !==
        params.intakeId ||
      (result.approved_task_definition?.source_capture.capture_digest ??
        params.sourceCaptureDigest) !== params.sourceCaptureDigest
    ) {
      return {
        status: "failed",
        performed: false,
        required: isRequired,
        endpoint_configured: true,
        http_status: response.status,
        blocker: "pipeline_task_decision_response_binding_mismatch",
      };
    }
    return {
      status: "forwarded",
      performed: true,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      pipeline_result: result,
    };
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      blocker: "pipeline_task_decision_forward_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
