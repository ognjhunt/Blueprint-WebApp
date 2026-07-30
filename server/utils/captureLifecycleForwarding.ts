import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 10_000;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

const tombstoneSchema = z.object({
  schema_version: z.literal("capture_lifecycle_tombstone.v1"),
  capture_digest: z.string().regex(DIGEST),
  envelope_digest: z.string().regex(DIGEST),
  action: z.enum(["consent_revoked", "operator_deletion_request", "retention_expired"]),
  tombstone_digest: z.string().regex(DIGEST),
  serve_allowed: z.literal(false),
  future_processing_allowed: z.literal(false),
  local_payload_deletion_complete: z.literal(true),
  external_revocation_complete: z.literal(false),
  already_exists: z.boolean().optional(),
}).passthrough();

const externalEvidenceSchema = z.object({
  schema_version: z.literal("capture_external_revocation_evidence.v1"),
  tombstone_digest: z.string().regex(DIGEST),
  action: z.enum(["sync_webapp_revocation_verdict", "disable_signed_download_access"]),
  target_system: z.string().min(1),
  receipt_digest: z.string().regex(DIGEST),
  external_revocation_evidence_digest: z.string().regex(DIGEST),
}).passthrough();

const inspectionSchema = z.object({
  schema_version: z.literal("capture_lifecycle_inspection.v1"),
  state: z.enum(["tombstoned", "deletion_in_progress_or_retry_required"]),
  tombstone: tombstoneSchema.nullable(),
  provider_deletion_complete: z.boolean(),
  external_revocation_complete: z.boolean(),
  local_payload_deletion_complete: z.boolean(),
  lifecycle_complete: z.boolean(),
  serve_allowed: z.literal(false),
  future_processing_allowed: z.literal(false),
}).passthrough();

export type PipelineCaptureLifecycleTombstone = z.infer<typeof tombstoneSchema>;
export type PipelineCaptureLifecycleInspection = z.infer<typeof inspectionSchema>;

type ForwardResult<T> = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  error_name?: string;
  value?: T;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function baseUrl(explicit?: string) {
  const configured = text(explicit)
    || text(process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL);
  if (configured) return configured.replace(/\/+$/, "");
  return text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL)
    .replace(/\/+$/, "")
    .replace(/\/capture-upload-intakes$/, "");
}

function timeoutMs() {
  const configured = Number(process.env.CAPTURE_LIFECYCLE_FORWARD_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 60_000)
    : DEFAULT_TIMEOUT_MS;
}

async function signedRequest<T>(params: {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  schema: z.ZodType<T>;
  blocker: string;
  endpointBaseUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<ForwardResult<T>> {
  const base = baseUrl(params.endpointBaseUrl);
  if (!base) return {
    status: "not_configured",
    performed: false,
    endpoint_configured: false,
    blocker: "capture_lifecycle_pipeline_base_url_missing",
  };
  const token = text(params.token) || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked",
    performed: false,
    endpoint_configured: true,
    blocker: "capture_lifecycle_forward_token_missing",
  };
  const clientId = text(params.clientId)
    || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_CLIENT_ID)
    || "blueprint-webapp";
  const body = params.body ? JSON.stringify(params.body) : "";
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(`${base}${params.path}`, {
      method: params.method,
      headers: {
        ...(params.body ? { "content-type": "application/json" } : {}),
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-client-id": clientId,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      ...(params.body ? { body } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return {
      status: "failed",
      performed: false,
      endpoint_configured: true,
      http_status: response.status,
      blocker: params.blocker,
    };
    const parsed = params.schema.safeParse(payload);
    if (!parsed.success) return {
      status: "failed",
      performed: false,
      endpoint_configured: true,
      http_status: response.status,
      blocker: `${params.blocker}_receipt_invalid`,
    };
    return {
      status: "forwarded",
      performed: true,
      endpoint_configured: true,
      http_status: response.status,
      value: parsed.data,
    };
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      endpoint_configured: true,
      blocker: `${params.blocker}_forward_failed`,
      error_name: error instanceof Error ? error.name : "UnknownError",
    };
  } finally {
    clearTimeout(timer);
  }
}

function lifecyclePath(captureSessionId: string, intakeId: string) {
  return `/capture-upload-intakes/${encodeURIComponent(captureSessionId)}/${encodeURIComponent(intakeId)}`;
}

export async function applyCompletedCaptureLifecycleToPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  captureDigest: string;
  envelopeDigest: string;
  action: "consent_revoked" | "operator_deletion_request" | "retention_expired";
  idempotencyKey: string;
}) {
  const result = await signedRequest({
    path: `${lifecyclePath(params.captureSessionId, params.intakeId)}/lifecycle`,
    method: "POST",
    body: {
      schema_version: "capture_lifecycle_submission.v1",
      capture_digest: params.captureDigest,
      envelope_digest: params.envelopeDigest,
      action: params.action,
      idempotency_key: params.idempotencyKey,
    },
    schema: tombstoneSchema,
    blocker: "pipeline_capture_lifecycle_rejected",
  });
  if (result.value && (
    result.value.capture_digest !== params.captureDigest
    || result.value.envelope_digest !== params.envelopeDigest
    || result.value.action !== params.action
  )) return { ...result, status: "failed" as const, performed: false, value: undefined,
    blocker: "pipeline_capture_lifecycle_binding_mismatch" };
  return result;
}

export function recordCaptureExternalRevocationEvidenceInPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  action: "sync_webapp_revocation_verdict" | "disable_signed_download_access";
  targetSystem: string;
  receiptDigest: string;
  completedAt: string;
  verificationMethod: "signed_webapp_receipt" | "storage_access_revocation_receipt";
  idempotencyKey: string;
}) {
  return signedRequest({
    path: `${lifecyclePath(params.captureSessionId, params.intakeId)}/external-revocation-evidence`,
    method: "POST",
    body: {
      schema_version: "capture_external_revocation_evidence_submission.v1",
      action: params.action,
      target_system: params.targetSystem,
      receipt_digest: params.receiptDigest,
      completed_at: params.completedAt,
      verification_method: params.verificationMethod,
      idempotency_key: params.idempotencyKey,
    },
    schema: externalEvidenceSchema,
    blocker: "pipeline_external_revocation_evidence_rejected",
  });
}

export function inspectCompletedCaptureLifecycleInPipeline(params: {
  captureSessionId: string;
  intakeId: string;
}) {
  return signedRequest({
    path: `${lifecyclePath(params.captureSessionId, params.intakeId)}/lifecycle`,
    method: "GET",
    schema: inspectionSchema,
    blocker: "pipeline_capture_lifecycle_inspection_rejected",
  });
}
