import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { resolveTaskEvaluationLaunchUrl } from "./taskEvaluationLaunchContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const commit = z.string().regex(/^[0-9a-f]{40}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const immutableReference = z.object({
  uri: z.string().regex(/^(gs|s3|https):\/\/\S+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();

export const sceneObjectDiscoveryInputSchema = z.object({
  schema_version: z.literal("scene_object_discovery_request.v1"),
  discovery_id: identifier,
  expected_production_commit: commit,
  team_namespace: identifier,
  scene: z.object({
    identity: z.object({ id: identifier, version: identifier }).strict(),
    source_splat: immutableReference,
    scene_analysis: immutableReference,
    metric_registration: immutableReference,
    renderer_qualification: immutableReference,
    retained_gaussian_count: z.number().int().positive(),
  }).strict(),
  task: z.object({
    kind: z.enum(["rigid_relocation", "articulated_manipulation"]),
    strategy: z.enum(["planar_push", "pick_and_place", "articulated_open_close"]),
    task_statement: z.string().trim().min(1).max(2_000),
    target_hint: z.string().trim().min(1).max(256).optional(),
    workflow_context: z.string().trim().max(2_000).optional(),
  }).strict(),
  analysis: z.object({
    analyzers: z.array(z.enum([
      "publisher_semantics",
      "rendered_scene_agent",
      "sam31",
      "splat_analyzer",
    ])).min(1).max(4),
    prompts: z.array(z.string().trim().min(1).max(256)).min(1).max(64),
    minimum_confidence: z.number().min(0).max(1),
    minimum_task_relevance: z.number().min(0).max(1),
    require_metric_source_object: z.literal(true),
    full_scene_survey_required: z.literal(true),
  }).strict(),
  rights: z.object({
    admission: immutableReference,
    human_authority_record: immutableReference,
    source_bytes_redistributable: z.boolean(),
    provider_disclosure_scope: z.enum(["none", "derived_only", "source_and_derived"]),
  }).strict(),
  execution: z.object({
    mode: z.enum(["qualified_local_runtime", "provider_gpu_after_activation"]),
    selected_provider: z.enum(["vast"]).optional(),
  }).strict(),
  publication: z.object({
    input_namespace: identifier,
    service_account_readback_required: z.literal(true),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (new Set(value.analysis.analyzers).size !== value.analysis.analyzers.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "discovery analyzers must be unique",
  });
  if (new Set(value.analysis.prompts.map((prompt) => prompt.toLowerCase())).size !== value.analysis.prompts.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "discovery prompts must be unique",
  });
  const strategiesByKind = {
    rigid_relocation: new Set(["planar_push", "pick_and_place"]),
    articulated_manipulation: new Set(["articulated_open_close"]),
  } as const;
  if (!strategiesByKind[value.task.kind].has(value.task.strategy as never)) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "discovery task strategy must match task kind",
  });
  if (value.execution.mode === "provider_gpu_after_activation") {
    if (value.execution.selected_provider !== "vast") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "provider discovery requires an admitted selected provider",
    });
    if (
      value.rights.provider_disclosure_scope !== "source_and_derived"
      || value.rights.source_bytes_redistributable !== true
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "provider discovery requires source-byte disclosure authority",
    });
  } else if (value.execution.selected_provider !== undefined) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "local discovery cannot select a provider",
  });
});

export type SceneObjectDiscoveryInput = z.infer<typeof sceneObjectDiscoveryInputSchema>;

export const sceneObjectDiscoverySelectionInputSchema = z.object({
  schema_version: z.literal("scene_object_discovery_selection_request.v1"),
  discovery_id: identifier,
  expected_production_commit: commit,
  request_digest: digest,
  discovery_digest: digest,
  candidate_id: identifier,
  confirm_selection: z.literal(true),
}).strict();

export type SceneObjectDiscoverySelectionInput = z.infer<
  typeof sceneObjectDiscoverySelectionInputSchema
>;

const candidateSchema = z.object({
  candidate_id: identifier,
  label: z.string().min(1).max(512),
  backend: z.enum([
    "publisher_semantics",
    "rendered_scene_agent",
    "sam31",
    "splat_analyzer",
  ]),
  confidence: z.number().min(0).max(1),
  task_match_score: z.number().min(0).max(1),
  eligible_for_automatic_source_object: z.boolean(),
  candidate_claim_boundary: z.string().min(1).max(1_000),
  preview: immutableReference.optional(),
}).strict();

const sourceObjectSchema = z.object({
  object_id: identifier,
  label: z.string().min(1).max(512),
  metric_geometry_authority: z.enum([
    "publisher_metric_label",
    "production_semantic_gaussian_obb",
  ]),
  metric_geometry_evidence_digest: digest,
  source_object_artifact: immutableReference,
}).strict();

const discoveryIntakeReceiptSchema = z.object({
  schema_version: z.literal("scene_object_discovery_intake_receipt.v1"),
  status: z.literal("queued_for_no_spend_discovery_preparation"),
  accepted: z.literal(true),
  already_exists: z.boolean(),
  discovery_id: identifier,
  team_namespace: identifier,
  request_digest: digest,
  expected_production_commit: commit,
  provider_mutation_performed_inside_http_request: z.literal(false),
  paid_execution_requested: z.literal(false),
  canonical_allocator_required_for_provider_execution: z.literal(true),
  receipt_digest: digest,
}).strict();

export const sceneObjectDiscoveryStatusSchema = z.object({
  schema_version: z.literal("scene_object_discovery_status.v1"),
  status: z.enum([
    "not_found",
    "pending",
    "processing",
    "awaiting_activation",
    "discovering_objects",
    "selection_required",
    "ready_auto_selected",
    "metric_refinement_required",
    "abstained_no_candidates",
    "blocked",
  ]),
  discovery_id: identifier,
  team_namespace: identifier.optional(),
  expected_production_commit: commit.optional(),
  request_digest: digest.optional(),
  discovery_digest: digest.optional(),
  source_commit: commit.optional(),
  candidates: z.array(candidateSchema).max(500).optional(),
  selected_candidate_id: identifier.nullable().optional(),
  source_object: sourceObjectSchema.nullable().optional(),
  unseen_regions: z.array(z.string().max(1_000)).max(500).optional(),
  blockers: z.array(z.string().min(1).max(1_000)).max(100).optional(),
  provider_mutation_performed_by_status_read: z.literal(false),
  paid_execution_performed: z.boolean().optional(),
}).strict();

const selectionReceiptSchema = z.object({
  schema_version: z.literal("scene_object_discovery_selection_receipt.v1"),
  status: z.literal("selection_sealed"),
  discovery_id: identifier,
  request_digest: digest,
  discovery_digest: digest,
  candidate_id: identifier,
  selection_digest: digest,
  provider_mutation_performed_inside_http_request: z.literal(false),
  paid_execution_requested: z.literal(false),
  receipt_digest: digest,
}).strict();

export function sceneObjectDiscoveryRequestDigest(request: SceneObjectDiscoveryInput) {
  return canonicalArtifactDigest(request as unknown as Record<string, unknown>, "request_digest");
}

export function sceneObjectDiscoverySelectionDigest(
  request: SceneObjectDiscoverySelectionInput,
) {
  return canonicalArtifactDigest(request as unknown as Record<string, unknown>, "selection_digest");
}

export function resolveSceneObjectDiscoveryUrl(
  discoveryId?: string,
  action?: "selection",
): string {
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!launchUrl) return "";
  try {
    const url = new URL(launchUrl);
    url.pathname = discoveryId
      ? `/api/live-pipeline/scene-object-discoveries/${encodeURIComponent(discoveryId)}${action === "selection" ? "/selection" : ""}`
      : "/api/live-pipeline/scene-object-discoveries";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function signedHeaders(body: string, token: string, clientId: string) {
  const timestamp = new Date().toISOString();
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

function forwardingConfiguration(endpointUrl?: string, token?: string) {
  const endpoint = String(endpointUrl || resolveSceneObjectDiscoveryUrl()).trim();
  const secret = String(token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  return { endpoint, secret };
}

export async function forwardSceneObjectDiscovery(params: {
  request: SceneObjectDiscoveryInput;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}) {
  const { endpoint, secret } = forwardingConfiguration(params.endpointUrl, params.token);
  if (!endpoint || !secret) return {
    status: "blocked" as const,
    performed: false,
    blocker: !endpoint ? "scene_object_discovery_url_missing" : "scene_object_discovery_token_missing",
  };
  const body = JSON.stringify(params.request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...signedHeaders(body, secret, params.clientId || "blueprint-webapp"), "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed" as const, performed: false, http_status: response.status, blocker: "pipeline_scene_object_discovery_rejected" };
    const parsed = discoveryIntakeReceiptSchema.safeParse(payload);
    if (
      !parsed.success
      || parsed.data.request_digest !== sceneObjectDiscoveryRequestDigest(params.request)
      || parsed.data.receipt_digest !== canonicalArtifactDigest(parsed.data as unknown as Record<string, unknown>, "receipt_digest")
    ) return { status: "blocked" as const, performed: false, blocker: "pipeline_scene_object_discovery_receipt_invalid" };
    return { status: "forwarded" as const, performed: true, http_status: response.status, receipt: parsed.data };
  } catch (error) {
    return { status: "failed" as const, performed: false, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_scene_object_discovery_timeout" : "pipeline_scene_object_discovery_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSceneObjectDiscoveryStatus(params: {
  discoveryId: string;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}) {
  const endpoint = String(params.endpointUrl || resolveSceneObjectDiscoveryUrl(params.discoveryId)).trim();
  const secret = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!endpoint || !secret) return { ok: false as const, status: 503, blocker: !endpoint ? "scene_object_discovery_url_missing" : "scene_object_discovery_token_missing" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, { method: "GET", headers: signedHeaders("", secret, params.clientId || "blueprint-webapp"), signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, status: response.status, blocker: "pipeline_scene_object_discovery_status_rejected" };
    const parsed = sceneObjectDiscoveryStatusSchema.safeParse(payload);
    return parsed.success
      ? { ok: true as const, status: response.status, discoveryStatus: parsed.data }
      : { ok: false as const, status: 502, blocker: "pipeline_scene_object_discovery_status_invalid" };
  } catch (error) {
    return { ok: false as const, status: 503, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_scene_object_discovery_status_timeout" : "pipeline_scene_object_discovery_status_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function forwardSceneObjectDiscoverySelection(params: {
  request: SceneObjectDiscoverySelectionInput;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}) {
  const endpoint = String(params.endpointUrl || resolveSceneObjectDiscoveryUrl(params.request.discovery_id, "selection")).trim();
  const secret = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!endpoint || !secret) return { status: "blocked" as const, performed: false, blocker: !endpoint ? "scene_object_discovery_url_missing" : "scene_object_discovery_token_missing" };
  const body = JSON.stringify(params.request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...signedHeaders(body, secret, params.clientId || "blueprint-webapp"), "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed" as const, performed: false, http_status: response.status, blocker: "pipeline_scene_object_discovery_selection_rejected" };
    const parsed = selectionReceiptSchema.safeParse(payload);
    if (
      !parsed.success
      || parsed.data.selection_digest !== sceneObjectDiscoverySelectionDigest(params.request)
      || parsed.data.receipt_digest !== canonicalArtifactDigest(parsed.data as unknown as Record<string, unknown>, "receipt_digest")
    ) return { status: "blocked" as const, performed: false, blocker: "pipeline_scene_object_discovery_selection_receipt_invalid" };
    return { status: "forwarded" as const, performed: true, http_status: response.status, receipt: parsed.data };
  } catch (error) {
    return { status: "failed" as const, performed: false, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_scene_object_discovery_selection_timeout" : "pipeline_scene_object_discovery_selection_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
