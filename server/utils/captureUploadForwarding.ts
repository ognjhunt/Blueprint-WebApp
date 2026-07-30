import { createHash, createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { stableJson } from "./taskCandidateContract";
import type { CaptureDownloadGrant } from "./storage-provider";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const receiptSchema = z.object({
  schema_version: z.literal("capture_upload_intake_receipt.v1"),
  capture_session_id: z.string().min(1),
  intake_id: z.string().min(1),
  request_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  envelope_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  capture_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  size_bytes: z.number().int().positive(),
  admission_status: z.enum(["accepted", "recapture_required", "rejected"]),
  state: z.enum(["capture_accepted", "rejected_or_recapture_required", "failed"]),
  claim_ceiling: z.record(z.string(), z.unknown()),
  artifact_reference: z.object({
    uri: z.string().min(1),
    envelope_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }).strict(),
  malware_content_validation: z.object({
    status: z.literal("passed"),
    scanner: z.string().min(1),
  }).passthrough(),
  already_exists: z.boolean(),
  proof_boundary: z.object({
    server_sha256_verified: z.literal(true),
    raw_input_content_addressed: z.literal(true),
    capture_qa_completed: z.literal(false),
    task_success_established: z.literal(false),
    physical_task_success_established: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
}).strict();

export type CaptureUploadIntakeReceipt = z.infer<typeof receiptSchema>;

export type CaptureUploadForwardResult = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  receipt?: CaptureUploadIntakeReceipt;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function required() {
  const configured = text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_REQUIRED).toLowerCase();
  if (configured === "true") return true;
  if (configured === "false" && process.env.NODE_ENV !== "production") return false;
  return process.env.NODE_ENV === "production";
}

export function captureUploadIntakeForwardingReadiness() {
  return {
    endpointConfigured: Boolean(text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL)),
    tokenConfigured: Boolean(text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN)),
    required: required(),
  };
}

function timeoutMs() {
  const configured = Number(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 10_000
    ? Math.min(configured, 30 * 60 * 1000)
    : DEFAULT_TIMEOUT_MS;
}

function digest(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export async function forwardCaptureUploadToPipeline(params: {
  captureSessionId: string;
  customerId: string;
  organizationId: string;
  request: Record<string, unknown>;
  transfer: CaptureDownloadGrant;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<CaptureUploadForwardResult> {
  const endpoint = text(params.endpointUrl)
    || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL);
  const isRequired = required();
  if (!endpoint) return {
    status: "not_configured",
    performed: false,
    required: isRequired,
    endpoint_configured: false,
    blocker: "capture_upload_intake_forward_url_missing",
  };
  const token = text(params.token) || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked",
    performed: false,
    required: isRequired,
    endpoint_configured: true,
    blocker: "capture_upload_intake_forward_token_missing",
  };
  const clientId = text(params.clientId)
    || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID)
    || "blueprint-webapp";
  const submission = {
    schema_version: "capture_upload_transfer_submission.v1",
    capture_session_id: params.captureSessionId,
    customer_id: params.customerId,
    organization_id: params.organizationId,
    request: params.request,
    transfer: {
      provider: params.transfer.provider,
      url: params.transfer.url,
      authorization: params.transfer.authorizationToken,
      expires_at_iso: params.transfer.expiresAtIso,
    },
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
      blocker: "pipeline_capture_upload_intake_rejected",
    };
    const parsed = receiptSchema.safeParse(payload);
    if (!parsed.success) return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      blocker: "pipeline_capture_upload_receipt_invalid",
    };
    const receipt = parsed.data;
    const expectedRequestDigest = digest({
      capture_session_id: params.captureSessionId,
      customer_id: params.customerId,
      organization_id: params.organizationId,
      request: params.request,
    });
    const expectedState = {
      accepted: "capture_accepted",
      recapture_required: "rejected_or_recapture_required",
      rejected: "failed",
    }[receipt.admission_status];
    if (
      receipt.capture_session_id !== params.captureSessionId
      || receipt.intake_id !== text(params.request.intake_id)
      || receipt.request_digest !== expectedRequestDigest
      || receipt.size_bytes !== Number((params.request.original_file as any)?.size_bytes)
      || receipt.artifact_reference.envelope_digest !== receipt.envelope_digest
      || receipt.state !== expectedState
    ) return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      blocker: "pipeline_capture_upload_receipt_binding_mismatch",
    };
    return {
      status: "forwarded",
      performed: true,
      required: isRequired,
      endpoint_configured: true,
      http_status: response.status,
      receipt,
    };
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      required: isRequired,
      endpoint_configured: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      blocker: "capture_upload_intake_forward_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
