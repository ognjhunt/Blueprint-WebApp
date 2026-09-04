import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { resolveTaskEvaluationLaunchUrl } from "./taskEvaluationLaunchContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const reference = z.object({
  uri: z.string().regex(/^(gs|s3|https):\/\/\S+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();
const initialLineage = z.object({
  kind: z.literal("initial_project"),
  project_spend_reconciliation: reference,
  initial_provider_zero: reference,
}).strict();
const predecessorLineage = z.object({
  kind: z.literal("predecessor"),
  prior_authority: reference,
  prior_result: reference,
  prior_launch_receipt: reference,
  prior_webapp_sync: reference,
  prior_provider_zero: reference,
  prior_spend_reconciliation: reference,
  construction_result: reference.optional(),
  destination_qualification_result: reference.optional(),
  zero_action_result: reference.optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.construction_result) === Boolean(value.destination_qualification_result)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "predecessor lineage requires exactly one native result",
    });
  }
});

export const taskEvaluationLaunchActivationInputSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_activation_request.v1"),
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/),
  activation_id: identifier,
  team_namespace: identifier,
  run_kind: z.enum(["qualified_evaluation", "internal_policy_canary"]).optional(),
  capture_session_id: identifier.optional(),
  intake_id: identifier.optional(),
  lane: z.enum([
    "task_evaluation_scene_configuration",
    "native_task_arena_construction",
    "native_task_arena_destination_qualification",
    "native_task_arena_construction_after_destination",
    "native_task_arena_controls",
    "native_task_arena_zero_action",
    "native_task_arena_scripted_positive",
    "native_task_arena_policy_evaluation",
  ]),
  preparation: z.object({
    preparation_id: identifier,
    request_digest: digest,
    result_digest: digest,
  }).strict(),
  release_window: reference,
  lineage: z.union([initialLineage, predecessorLineage]),
  authorization: z.object({
    reference: z.string().trim().min(1).max(1000),
    authorized_by: identifier,
    authorized_on: z.string().datetime({ offset: true }),
    standing_authorization_expires_at: z.string().datetime({ offset: true }),
    profile_revision: identifier,
  }).strict(),
  requested_mutations: z.object({
    profile_publication: z.boolean(),
    catalog_synchronization: z.boolean(),
    standing_authorization: z.boolean(),
    policy_campaign_queue: z.boolean().optional(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (
    [
      "task_evaluation_scene_configuration",
      "native_task_arena_construction",
      "native_task_arena_destination_qualification",
    ].includes(
      value.lane,
    )
      ? value.lineage.kind !== "initial_project"
      : value.lineage.kind !== "predecessor"
  ) context.addIssue({ code: z.ZodIssueCode.custom, message: "activation lineage does not match lane" });
  if (
    value.lane === "native_task_arena_scripted_positive"
    && (value.lineage.kind !== "predecessor" || !value.lineage.zero_action_result)
  ) context.addIssue({ code: z.ZodIssueCode.custom, message: "scripted-positive requires zero-action result" });
  if (Date.parse(value.authorization.authorized_on) >= Date.parse(
    value.authorization.standing_authorization_expires_at,
  )) context.addIssue({ code: z.ZodIssueCode.custom, message: "authorization window is invalid" });
  if (value.lane === "native_task_arena_policy_evaluation") {
    if (
      value.run_kind !== "internal_policy_canary"
      || !value.capture_session_id
      || !value.intake_id
      || value.requested_mutations.profile_publication !== false
      || value.requested_mutations.catalog_synchronization !== false
      || value.requested_mutations.standing_authorization !== false
      || value.requested_mutations.policy_campaign_queue !== true
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "policy canary activation must queue only the unqualified policy campaign",
    });
  } else if (
    value.requested_mutations.profile_publication !== true
    || value.requested_mutations.catalog_synchronization !== true
    || value.requested_mutations.standing_authorization !== true
    || value.requested_mutations.policy_campaign_queue !== undefined
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "non-canary activation must publish profile authority only",
  });
  if (value.activation_id === value.preparation.preparation_id) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "activation identity must be independent",
  });
});

export type TaskEvaluationLaunchActivationInput = z.infer<
  typeof taskEvaluationLaunchActivationInputSchema
>;

export function taskEvaluationLaunchActivationRequestDigest(
  request: TaskEvaluationLaunchActivationInput,
) {
  return canonicalArtifactDigest(request as unknown as Record<string, unknown>, "request_digest");
}

const intakeReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_activation_intake_receipt.v1"),
  status: z.literal("queued_for_authority_gated_activation"),
  accepted: z.literal(true),
  already_exists: z.boolean(),
  activation_id: identifier,
  preparation_id: identifier,
  team_namespace: identifier,
  lane: z.enum([
    "task_evaluation_scene_configuration",
    "native_task_arena_construction",
    "native_task_arena_destination_qualification",
    "native_task_arena_construction_after_destination",
    "native_task_arena_controls",
    "native_task_arena_zero_action",
    "native_task_arena_scripted_positive",
    "native_task_arena_policy_evaluation",
  ]),
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/),
  request_digest: digest,
  provider_mutation_performed_inside_http_request: z.literal(false),
  catalog_mutation_performed_inside_http_request: z.literal(false),
  standing_authorization_published_inside_http_request: z.literal(false),
  paid_execution_requested: z.literal(false),
  receipt_digest: digest,
}).strict();

export const taskEvaluationLaunchActivationStatusSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_activation_status.v1"),
  status: z.enum(["not_found", "pending", "processing", "prepared", "blocked"]),
  activation_id: identifier,
  preparation_id: identifier.optional(),
  team_namespace: identifier.optional(),
  lane: z.enum([
    "task_evaluation_scene_configuration",
    "native_task_arena_construction",
    "native_task_arena_destination_qualification",
    "native_task_arena_construction_after_destination",
    "native_task_arena_controls",
    "native_task_arena_zero_action",
    "native_task_arena_scripted_positive",
    "native_task_arena_policy_evaluation",
  ]).optional(),
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  request_digest: digest.optional(),
  worker_status: z.string().min(1).max(192).optional(),
  result_digest: digest.optional(),
  profile_id: identifier.optional(),
  profile_digest: digest.optional(),
  profile_publication_receipt_digest: digest.optional(),
  standing_authorization_digest: digest.optional(),
  blockers: z.array(z.string().min(1).max(1000)).max(100).optional(),
  provider_mutation_performed_by_status_read: z.literal(false),
  provider_mutation_performed_by_worker: z.literal(false).optional(),
  paid_execution_requested: z.literal(false).optional(),
}).strict();

export function resolveTaskEvaluationLaunchActivationUrl(activationId?: string) {
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!launchUrl) return "";
  try {
    const url = new URL(launchUrl);
    url.pathname = activationId
      ? `/api/live-pipeline/task-evaluation-launch-activations/${encodeURIComponent(activationId)}`
      : "/api/live-pipeline/task-evaluation-launch-activations";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function headersFor(body: string, token: string) {
  const timestamp = new Date().toISOString();
  const clientId = "blueprint-webapp";
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  return {
    accept: "application/json",
    "x-blueprint-pipeline-timestamp": timestamp,
    "x-blueprint-pipeline-client-id": clientId,
    "x-blueprint-pipeline-nonce": nonce,
    "x-blueprint-pipeline-signature": `sha256=${signature}`,
  };
}

export async function forwardTaskEvaluationLaunchActivation(params: {
  request: TaskEvaluationLaunchActivationInput;
  endpointUrl?: string;
  token?: string;
}) {
  const endpoint = String(params.endpointUrl || resolveTaskEvaluationLaunchActivationUrl()).trim();
  const token = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!endpoint || !token) return {
    status: "blocked" as const,
    performed: false,
    blocker: !endpoint ? "task_evaluation_launch_activation_url_missing" : "task_evaluation_launch_activation_token_missing",
  };
  const body = JSON.stringify(params.request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headersFor(body, token), "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed" as const, performed: false, http_status: response.status, blocker: "pipeline_task_evaluation_launch_activation_rejected" };
    const parsed = intakeReceiptSchema.safeParse(payload);
    if (
      !parsed.success
      || parsed.data.request_digest !== taskEvaluationLaunchActivationRequestDigest(params.request)
      || parsed.data.receipt_digest !== canonicalArtifactDigest(
        parsed.data as unknown as Record<string, unknown>, "receipt_digest",
      )
    ) return { status: "blocked" as const, performed: false, blocker: "pipeline_task_evaluation_launch_activation_receipt_invalid" };
    return { status: "forwarded" as const, performed: true, receipt: parsed.data };
  } catch (error) {
    return { status: "failed" as const, performed: false, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_task_evaluation_launch_activation_timeout" : "pipeline_task_evaluation_launch_activation_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTaskEvaluationLaunchActivationStatus(params: {
  activationId: string;
  endpointUrl?: string;
  token?: string;
}) {
  const endpoint = String(params.endpointUrl || resolveTaskEvaluationLaunchActivationUrl(params.activationId)).trim();
  const token = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!endpoint || !token) return { ok: false as const, status: 503, blocker: "task_evaluation_launch_activation_status_not_configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, { method: "GET", headers: headersFor("", token), signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, status: response.status, blocker: "pipeline_task_evaluation_launch_activation_status_rejected" };
    const parsed = taskEvaluationLaunchActivationStatusSchema.safeParse(payload);
    return parsed.success
      ? { ok: true as const, status: response.status, activationStatus: parsed.data }
      : { ok: false as const, status: 502, blocker: "pipeline_task_evaluation_launch_activation_status_invalid" };
  } catch (error) {
    return { ok: false as const, status: 503, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_task_evaluation_launch_activation_status_timeout" : "pipeline_task_evaluation_launch_activation_status_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
