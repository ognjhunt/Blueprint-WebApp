import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const DEFAULT_TIMEOUT_MS = 60_000;

const sourceCaptureSchema = z.object({
  intake_id: z.string().min(1),
  capture_digest: z.string().regex(DIGEST),
  capture_authority_profile: z.string().min(1),
}).strict();

const reconstructionPlanSchema = z.object({
  schema_version: z.literal("reconstruction_plan.v1"),
  source_capture: sourceCaptureSchema,
  requested_claim_types: z.array(z.string().min(1)),
  required_representations: z.array(z.string().min(1)),
  selected_methods: z.array(z.object({
    representations: z.array(z.string().min(1)),
    method_id: z.string().min(1),
    method_version: z.string().min(1),
    method_profile_digest: z.string().regex(DIGEST),
    provider_identity: z.string().min(1),
    adapter_reference: z.string().min(1).optional(),
    expected_cost_usd: z.number().nonnegative(),
  }).strict()),
  missing_representations: z.array(z.record(z.string(), z.unknown())),
  estimated_cost_usd: z.number().nonnegative(),
  status: z.enum(["planned", "partial_plan"]),
  proof_boundary: z.object({
    provider_availability_is_qualification: z.literal(false),
    generated_completion_upgrades_metric_or_physics_claims: z.literal(false),
    physical_task_success_established: z.literal(false),
  }).strict(),
  reconstruction_plan_digest: z.string().regex(DIGEST),
}).strict();

const planResultSchema = z.object({
  schema_version: z.literal("reconstruction_control_plane_plan_result.v1"),
  plan_id: z.string().min(1),
  state: z.enum(["authorization_required", "abstained"]),
  context_digest: z.string().regex(DIGEST),
  reconstruction_plan: reconstructionPlanSchema,
  authorization_candidates: z.array(z.object({
    method_id: z.string().min(1),
    method_profile_digest: z.string().regex(DIGEST),
    adapter_reference: z.string().min(1),
    execution_authorized: z.literal(false),
  }).strict()),
  next_cheapest_experiments: z.array(z.string()),
  proof_boundary: z.object({
    plan_is_execution_authorization: z.literal(false),
    derived_reconstruction_upgrades_raw_capture: z.literal(false),
    physical_task_success_established: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
}).strict();

const authorizationSchema = z.object({
  schema_version: z.literal("reconstruction_execution_authorization.v1"),
  plan_id: z.string().min(1),
  reconstruction_plan_digest: z.string().regex(DIGEST),
  context_digest: z.string().regex(DIGEST),
  authorized_adapter_references: z.array(z.string().min(1)),
  actor: z.record(z.string(), z.unknown()),
  idempotency_key: z.string().min(1),
  live_provider_execution: z.literal(false),
  paid_compute_authorized: z.literal(false),
  physical_robot_run_authorized: z.literal(false),
  proof_boundary: z.object({
    authorization_is_method_qualification: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
  authorization_digest: z.string().regex(DIGEST),
}).strict();

const executionSchema = z.object({
  schema_version: z.literal("reconstruction_control_plane_execution_result.v1"),
  plan_id: z.string().min(1),
  state: z.enum(["completed", "partial", "abstained"]),
  reconstruction_plan_digest: z.string().regex(DIGEST),
  authorization_digest: z.string().regex(DIGEST),
  context_digest: z.string().regex(DIGEST),
  results: z.array(z.record(z.string(), z.unknown())),
  errors: z.array(z.record(z.string(), z.unknown())),
  missing_representations: z.array(z.string()),
  next_cheapest_experiments: z.array(z.string()),
  cost_usd: z.number().nonnegative(),
  proof_boundary: z.object({
    execution_was_local_and_explicitly_authorized: z.literal(true),
    derived_reconstruction_upgrades_raw_capture: z.literal(false),
    physical_task_success_established: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
  already_exists: z.boolean(),
  execution_result_digest: z.string().regex(DIGEST),
}).strict();

const inspectionSchema = z.object({
  schema_version: z.literal("reconstruction_control_plane_inspection.v1"),
  plan_id: z.string().min(1),
  state: z.enum(["authorization_required", "completed", "partial", "abstained"]),
  source_binding: z.object({
    capture_session_id: z.string().min(1),
    intake_id: z.string().min(1),
    capture_digest: z.string().regex(DIGEST),
    envelope_digest: z.string().regex(DIGEST),
    qa_report_digest: z.string().regex(DIGEST),
    object_manifest_digest: z.string().regex(DIGEST),
    context_digest: z.string().regex(DIGEST),
  }).strict(),
  reconstruction_plan: reconstructionPlanSchema,
  execution_authorization: authorizationSchema.nullable(),
  execution_result: executionSchema.nullable(),
  proof_boundary: z.object({
    inspection_recomputes_scientific_truth: z.literal(false),
    physical_task_success_established: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
}).strict();

const testbedCompilationSchema = z.object({
  schema_version: z.literal("site_task_testbed_compilation_response.v1"),
  status: z.literal("testbed_ready"),
  capture_session_id: z.string().min(1),
  intake_id: z.string().min(1),
  testbed_id: z.string().min(1),
  version: z.string().min(1),
  testbed_digest: z.string().regex(DIGEST),
  already_exists: z.boolean(),
  artifact_reference: z.object({
    uri: z.string().min(1),
    digest: z.string().regex(DIGEST),
  }).strict(),
  testbed: z.record(z.string(), z.unknown()),
  decision_evidence_request: z.record(z.string(), z.unknown()).nullable(),
  decision_evidence_request_artifact: z.record(z.string(), z.unknown()).nullable(),
  webapp_sync: z.record(z.string(), z.unknown()),
  proof_boundary: z.object({
    appearance_is_collision_truth: z.literal(false),
    generated_completion_is_observed_truth: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).strict(),
}).strict();

export type ReconstructionPlanResult = z.infer<typeof planResultSchema>;
export type ReconstructionExecutionAuthorization = z.infer<typeof authorizationSchema>;
export type ReconstructionExecutionResult = z.infer<typeof executionSchema>;
export type ReconstructionInspection = z.infer<typeof inspectionSchema>;
export type TestbedCompilationResult = z.infer<typeof testbedCompilationSchema>;

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

function baseUrl() {
  const configured = text(process.env.RECONSTRUCTION_PIPELINE_BASE_URL)
    || text(process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL);
  if (configured) return configured.replace(/\/+$/, "");
  return text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL)
    .replace(/\/+$/, "")
    .replace(/\/capture-upload-intakes$/, "");
}

function timeoutMs() {
  const configured = Number(process.env.RECONSTRUCTION_FORWARD_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 30 * 60 * 1000)
    : DEFAULT_TIMEOUT_MS;
}

async function signedRequest<T>(params: {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  schema: z.ZodType<T>;
  blocker: string;
}): Promise<ForwardResult<T>> {
  const base = baseUrl();
  if (!base) return {
    status: "not_configured", performed: false, endpoint_configured: false,
    blocker: "reconstruction_pipeline_base_url_missing",
  };
  const token = text(process.env.RECONSTRUCTION_FORWARD_TOKEN)
    || text(process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN);
  if (!token) return {
    status: "blocked", performed: false, endpoint_configured: true,
    blocker: "reconstruction_forward_token_missing",
  };
  const clientId = text(process.env.RECONSTRUCTION_FORWARD_CLIENT_ID)
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
      status: "failed", performed: false, endpoint_configured: true,
      http_status: response.status, blocker: params.blocker,
    };
    const parsed = params.schema.safeParse(payload);
    if (!parsed.success) return {
      status: "failed", performed: false, endpoint_configured: true,
      http_status: response.status, blocker: `${params.blocker}_artifact_invalid`,
    };
    return {
      status: "forwarded", performed: true, endpoint_configured: true,
      http_status: response.status, value: parsed.data,
    };
  } catch (error) {
    return {
      status: "failed", performed: false, endpoint_configured: true,
      blocker: `${params.blocker}_forward_failed`,
      error_name: error instanceof Error ? error.name : "UnknownError",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function forwardReconstructionPlanToPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  captureDigest: string;
  requestedClaimTypes: string[];
  idempotencyKey: string;
}) {
  const result = await signedRequest({
    path: "/reconstructions/plan",
    method: "POST",
    body: {
      schema_version: "reconstruction_plan_submission.v1",
      capture_session_id: params.captureSessionId,
      intake_id: params.intakeId,
      requested_claim_types: [...new Set(params.requestedClaimTypes)].sort(),
      idempotency_key: params.idempotencyKey,
    },
    schema: planResultSchema,
    blocker: "pipeline_reconstruction_plan_rejected",
  });
  const plan = result.value?.reconstruction_plan;
  const claims = [...new Set(params.requestedClaimTypes)].sort();
  if (plan && (
    plan.source_capture.intake_id !== params.intakeId
    || plan.source_capture.capture_digest !== params.captureDigest
    || JSON.stringify(plan.requested_claim_types) !== JSON.stringify(claims)
  )) return { ...result, status: "failed" as const, performed: false, value: undefined,
    blocker: "pipeline_reconstruction_plan_binding_mismatch" };
  return result;
}

export async function forwardReconstructionAuthorizationToPipeline(params: {
  planId: string;
  reconstructionPlanDigest: string;
  authorizedAdapterReferences: string[];
  actor: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const references = [...new Set(params.authorizedAdapterReferences)].sort();
  const result = await signedRequest({
    path: `/reconstructions/${encodeURIComponent(params.planId)}/authorize`,
    method: "POST",
    body: {
      schema_version: "reconstruction_authorization_submission.v1",
      reconstruction_plan_digest: params.reconstructionPlanDigest,
      authorized_adapter_references: references,
      actor: params.actor,
      idempotency_key: params.idempotencyKey,
    },
    schema: authorizationSchema,
    blocker: "pipeline_reconstruction_authorization_rejected",
  });
  const authorization = result.value;
  if (authorization && (
    authorization.plan_id !== params.planId
    || authorization.reconstruction_plan_digest !== params.reconstructionPlanDigest
    || JSON.stringify(authorization.authorized_adapter_references) !== JSON.stringify(references)
    || JSON.stringify(authorization.actor) !== JSON.stringify(params.actor)
    || authorization.idempotency_key !== params.idempotencyKey
  )) return { ...result, status: "failed" as const, performed: false, value: undefined,
    blocker: "pipeline_reconstruction_authorization_binding_mismatch" };
  return result;
}

export async function forwardReconstructionExecutionToPipeline(params: {
  planId: string;
  reconstructionPlanDigest: string;
  authorizationDigest: string;
}) {
  const result = await signedRequest({
    path: `/reconstructions/${encodeURIComponent(params.planId)}/execute`,
    method: "POST",
    schema: executionSchema,
    blocker: "pipeline_reconstruction_execution_rejected",
  });
  const execution = result.value;
  if (execution && (
    execution.plan_id !== params.planId
    || execution.reconstruction_plan_digest !== params.reconstructionPlanDigest
    || execution.authorization_digest !== params.authorizationDigest
  )) return { ...result, status: "failed" as const, performed: false, value: undefined,
    blocker: "pipeline_reconstruction_execution_binding_mismatch" };
  return result;
}

export async function inspectReconstructionInPipeline(params: {
  planId: string;
  captureSessionId: string;
  intakeId: string;
  captureDigest: string;
}) {
  const result = await signedRequest({
    path: `/reconstructions/${encodeURIComponent(params.planId)}`,
    method: "GET",
    schema: inspectionSchema,
    blocker: "pipeline_reconstruction_inspection_rejected",
  });
  const inspection = result.value;
  if (inspection && (
    inspection.plan_id !== params.planId
    || inspection.source_binding.capture_session_id !== params.captureSessionId
    || inspection.source_binding.intake_id !== params.intakeId
    || inspection.source_binding.capture_digest !== params.captureDigest
  )) return { ...result, status: "failed" as const, performed: false, value: undefined,
    blocker: "pipeline_reconstruction_inspection_binding_mismatch" };
  return result;
}

export async function forwardTestbedCompilationToPipeline(params: {
  captureSessionId: string;
  intakeId: string;
  testbedId: string;
  version: string;
  approvedTaskDigest: string;
  reconstructionPlanId: string;
  reconstructionExecutionResultDigest: string;
  robotBinding: Record<string, unknown>;
  decisionRequestConstraints: Record<string, unknown>;
}) {
  const result = await signedRequest({
    path: "/testbeds/compile",
    method: "POST",
    body: {
      schema_version: "site_task_testbed_compilation_submission.v2",
      capture_session_id: params.captureSessionId,
      intake_id: params.intakeId,
      testbed_id: params.testbedId,
      version: params.version,
      approved_task_digest: params.approvedTaskDigest,
      reconstruction_plan_id: params.reconstructionPlanId,
      reconstruction_execution_result_digest: params.reconstructionExecutionResultDigest,
      robot_binding: params.robotBinding,
      decision_request_constraints: params.decisionRequestConstraints,
    },
    schema: testbedCompilationSchema,
    blocker: "pipeline_testbed_compilation_rejected",
  });
  const compilation = result.value;
  const approved = compilation?.testbed.approved_task_definition as
    | Record<string, unknown>
    | undefined;
  if (compilation && (
    compilation.capture_session_id !== params.captureSessionId
    || compilation.intake_id !== params.intakeId
    || compilation.testbed_id !== params.testbedId
    || compilation.version !== params.version
    || compilation.testbed_digest !== compilation.artifact_reference.digest
    || approved?.digest !== params.approvedTaskDigest
  )) return {
    ...result,
    status: "failed" as const,
    performed: false,
    value: undefined,
    blocker: "pipeline_testbed_compilation_binding_mismatch",
  };
  return result;
}
