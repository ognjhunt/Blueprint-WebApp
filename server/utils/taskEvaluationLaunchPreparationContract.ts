import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { resolveTaskEvaluationLaunchUrl } from "./taskEvaluationLaunchContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const immutableReference = z.object({
  uri: z.string().regex(/^(gs|s3|https):\/\/\S+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();
const versionedIdentity = z.object({ id: identifier, version: identifier }).strict();

const sceneSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("configure_source_scene"),
    identity: versionedIdentity,
    source_manifest: immutableReference,
    appearance: z.object({
      kind: z.enum(["interiorgs", "gaussian_splat", "textured_usd", "other_observed"]),
      representation: immutableReference,
      renderer_qualification: immutableReference,
    }).strict(),
    geometry: z.object({
      kind: z.enum(["sage_derived", "observed_mesh", "qualified_cad", "other_derived"]),
      collision: immutableReference,
      validation: immutableReference,
    }).strict(),
    registration: z.object({
      metric_registration: immutableReference,
      support_plane: immutableReference,
      robot_mount_interface: immutableReference,
      workspace_clearance: immutableReference,
      camera_calibration: immutableReference,
    }).strict(),
    rights: z.object({
      admission: immutableReference,
      evidence: z.array(z.object({
        role: z.enum(["publisher_terms", "publisher_readme", "upstream_license", "human_authority_record"]),
        artifact: immutableReference,
      }).strict()).min(2).max(16),
      source_bytes_redistributable: z.boolean(),
      provider_disclosure_scope: z.enum(["none", "derived_only", "source_and_derived"]),
    }).strict(),
  }).strict(),
  z.object({
    mode: z.literal("reuse_configured_revision"),
    identity: versionedIdentity,
    configured_revision: immutableReference,
  }).strict(),
]);

const constructionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("reuse_configured_scene"),
  }).strict(),
  z.object({
    mode: z.literal("production_recipe"),
    recipe: immutableReference,
    output_identity: versionedIdentity,
  }).strict(),
]);

const taskSubjectSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("supplied_qualified_asset"),
    identity: versionedIdentity,
    representation_kind: z.enum([
      "simready_usd",
      "qualified_rigid_usd",
      "qualified_articulated_usd",
      "other_qualified_physics_asset",
    ]),
    asset: immutableReference,
    physics_validation: immutableReference,
    rights_admission: immutableReference,
    provider_disclosure_allowed: z.literal(true),
  }).strict(),
  z.object({
    mode: z.literal("construct_from_scene_object"),
    identity: versionedIdentity,
    representation_kind: z.enum([
      "simready_usd",
      "qualified_rigid_usd",
      "qualified_articulated_usd",
      "other_qualified_physics_asset",
    ]),
    source_object: immutableReference,
    rights_admission: immutableReference,
    provider_disclosure_allowed: z.literal(true),
  }).strict(),
  z.object({
    mode: z.literal("configured_scene_object"),
    identity: versionedIdentity,
    physics_authority: z.literal("configured_scene_revision"),
  }).strict(),
]);

const taskSchema = z.object({
  identity: versionedIdentity,
  binding_mode: z.enum(["define_configuration_template", "reuse_configured_template"]),
  kind: z.enum(["rigid_relocation", "articulated_manipulation"]),
  strategy: z.enum(["planar_push", "pick_and_place", "articulated_open_close"]),
  configured_scene_revision_digest: digest.optional(),
  subject: taskSubjectSchema,
  definition: immutableReference.optional(),
  success_criteria: immutableReference.optional(),
  execution: immutableReference.optional(),
}).strict().superRefine((value, context) => {
  if (value.binding_mode === "define_configuration_template") {
    if (!value.definition || !value.success_criteria || !value.execution) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "configuration task template requires definition, success criteria, and execution",
    });
    if (value.configured_scene_revision_digest) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "configuration task template cannot bind an existing scene revision",
    });
  } else {
    if (!value.configured_scene_revision_digest) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "configured task binding requires the configured scene revision digest",
    });
    if (value.definition || value.success_criteria || value.execution) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation cannot replace configured task semantics",
    });
  }
});

const runtimeMountSchema = z.object({
  source: immutableReference.optional(),
  container_path: z.string().regex(/^\/[A-Za-z0-9_./-]+$/),
  mode: z.enum(["read_only", "output"]),
}).strict().superRefine((value, context) => {
  if (value.mode === "read_only" && !value.source) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "read_only mount requires an immutable source",
  });
  if (value.mode === "output" && value.source) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "output mount cannot include a source",
  });
});

const externalServiceCapsSchema = z.object({
  openai: z.object({
    maximum_cost_usd: z.number().nonnegative().max(5),
    maximum_requests: z.number().int().nonnegative().max(100),
    stage_max_cost_usd: z.object({
      artifixer_semantic_teacher: z.number().nonnegative().max(5),
      artifixer_visual_review: z.number().nonnegative().max(5),
      content_agents: z.number().nonnegative().max(5),
    }).strict(),
  }).strict(),
}).strict();

export const taskEvaluationLaunchPreparationInputSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_preparation_request.v1"),
  run_mode: z.enum(["scene_configuration", "episode_evaluation"]),
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/),
  preparation_id: identifier,
  team_namespace: identifier,
  run_id: identifier,
  scene: sceneSchema,
  construction: constructionSchema,
  robot: z.object({
    identity: versionedIdentity,
    configuration: immutableReference,
    kinematics: immutableReference,
    joint_bounds: immutableReference,
    base_registration: immutableReference,
    controller_configuration: immutableReference,
  }).strict().optional(),
  controller: z.object({
    identity: versionedIdentity,
    kind: z.enum(["zero_action", "deterministic_scripted", "policy_container"]),
    configuration: immutableReference,
    model_or_asset_rights: immutableReference.optional(),
  }).strict().superRefine((value, context) => {
    if (value.kind === "policy_container" && !value.model_or_asset_rights) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "policy_container requires model_or_asset_rights",
    });
  }).optional(),
  task: taskSchema,
  sensors: z.object({ configuration: immutableReference }).strict(),
  runtime: z.object({
    identity: versionedIdentity,
    oci_image: z.string().regex(/^[^@\s]+@sha256:[0-9a-f]{64}$/),
    entrypoint: z.array(z.string().min(1).max(1024)).min(1).max(32),
    health_protocol: immutableReference,
    requirements: z.object({
      cpu_cores: z.number().int().min(1).max(128),
      memory_gib: z.number().positive().max(1024),
      gpu_count: z.number().int().min(0).max(8),
      disk_gib: z.number().positive().max(4096),
    }).strict(),
    network: z.object({
      default: z.literal("deny"),
      allowlist: z.array(z.string().min(1).max(253)).max(32),
    }).strict(),
    secret_refs: z.array(z.string().regex(/^secret-file:[A-Za-z0-9][A-Za-z0-9_.-]{0,191}$/)).max(32),
    mounts: z.array(runtimeMountSchema).min(1).max(128),
    output_limit_bytes: z.number().int().positive().max(1_099_511_627_776),
  }).strict(),
  execution_adapter: z.object({
    kind: z.enum(["scene_configuration_pipeline", "native_task_arena"]),
    version: z.literal("v1"),
    runtime_source_bundle: immutableReference,
  }).strict(),
  publication: z.object({
    input_namespace: identifier,
    service_account_readback_required: z.literal(true),
  }).strict(),
  spend: z.object({
    maximum_hourly_rate_usd: z.number().positive().max(0.8),
    hard_cap_usd: z.number().positive().max(5),
    hard_ttl_seconds: z.number().int().min(1).max(9000),
    provider_compute_spend_cap_usd: z.number().positive().max(1).optional(),
    external_service_caps: externalServiceCapsSchema.optional(),
    retry_cap: z.literal(0),
    selected_provider: z.enum(["vast", "runpod", "gcp", "aws", "azure"]),
    provider_allowlist: z.array(z.enum(["vast", "runpod", "gcp", "aws", "azure"]))
      .min(1).max(16),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.run_mode === "scene_configuration") {
    if (value.construction.mode !== "production_recipe") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scene configuration requires a production construction recipe",
    });
    if (
      value.scene.mode !== "configure_source_scene"
      || value.task.binding_mode !== "define_configuration_template"
      || value.task.subject.mode !== "construct_from_scene_object"
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scene configuration requires source-scene and task-template inputs",
    });
    if (value.execution_adapter.kind !== "scene_configuration_pipeline") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scene configuration requires the production configuration pipeline",
    });
    if (value.robot || value.controller) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scene configuration cannot carry an evaluation robot or controller",
    });
    if (value.scene.mode === "configure_source_scene" && value.scene.rights.provider_disclosure_scope !== "derived_only") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "production scene construction requires derived-only disclosure",
    });
    const providerComputeCap = value.spend.provider_compute_spend_cap_usd;
    const externalCaps = value.spend.external_service_caps;
    if (providerComputeCap === undefined || externalCaps === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scene configuration requires provider-compute and external-service spend caps",
      });
    } else {
      const openai = externalCaps.openai;
      const stageTotal = Object.values(openai.stage_max_cost_usd)
        .reduce((total, amount) => total + amount, 0);
      if (
        providerComputeCap + openai.maximum_cost_usd > value.spend.hard_cap_usd + 1e-9
        || stageTotal > openai.maximum_cost_usd + 1e-9
        || (openai.maximum_cost_usd === 0) !== (openai.maximum_requests === 0)
      ) context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scene configuration spend caps exceed their parent authority",
      });
    }
  } else {
    if (value.construction.mode !== "reuse_configured_scene") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation must reuse the configured scene revision",
    });
    if (
      value.scene.mode !== "reuse_configured_revision"
      || value.task.binding_mode !== "reuse_configured_template"
      || value.task.subject.mode !== "configured_scene_object"
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation requires configured scene, task, and object bindings",
    });
    if (!value.robot || !value.controller) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation requires configured scene, robot, and controller bindings",
    });
    if (value.execution_adapter.kind !== "native_task_arena") context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation requires production native-Arena compilation",
    });
    if (
      value.spend.provider_compute_spend_cap_usd !== undefined
      || value.spend.external_service_caps !== undefined
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "episode evaluation cannot carry scene-construction service spend caps",
    });
  }
  if (
    value.scene.mode === "configure_source_scene"
    && value.scene.rights.provider_disclosure_scope === "source_and_derived"
    && !value.scene.rights.source_bytes_redistributable
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "source disclosure conflicts with source rights",
  });
  const rightsRoles = value.scene.mode === "configure_source_scene"
    ? new Set(value.scene.rights.evidence.map((row) => row.role))
    : null;
  if (rightsRoles && (!rightsRoles.has("publisher_terms") || !rightsRoles.has("human_authority_record"))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scene rights require publisher terms and human authority bytes",
    });
  }
  if (value.runtime.requirements.gpu_count < 1) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "native Arena preparation requires a GPU runtime",
  });
  const outputMounts = value.runtime.mounts.filter((mount) => mount.mode === "output");
  if (outputMounts.length !== 1) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "runtime requires exactly one output mount",
  });
  const paths = value.runtime.mounts.map((mount) => mount.container_path);
  if (new Set(paths).size !== paths.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "runtime mount paths must be unique",
  });
  for (const [name, values] of [
    ["network allowlist", value.runtime.network.allowlist],
    ["secret refs", value.runtime.secret_refs],
    ["provider allowlist", value.spend.provider_allowlist],
  ] as const) if (new Set(values).size !== values.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `${name} values must be unique`,
  });
  if (!value.spend.provider_allowlist.includes(value.spend.selected_provider)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selected provider must be included in the provider allowlist",
    });
  }
  const strategiesByKind = {
    rigid_relocation: new Set(["planar_push", "pick_and_place"]),
    articulated_manipulation: new Set(["articulated_open_close"]),
  } as const;
  if (!strategiesByKind[value.task.kind].has(value.task.strategy as never)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "task strategy must match the task kind",
    });
  }
});

export type TaskEvaluationLaunchPreparationInput = z.infer<
  typeof taskEvaluationLaunchPreparationInputSchema
>;

const preparationIntakeReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_preparation_intake_receipt.v1"),
  status: z.literal("queued_for_no_spend_preparation"),
  accepted: z.literal(true),
  already_exists: z.boolean(),
  preparation_id: identifier,
  run_id: identifier,
  team_namespace: identifier,
  request_digest: digest,
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/),
  provider_mutation_performed_inside_http_request: z.literal(false),
  catalog_mutation_performed_inside_http_request: z.literal(false),
  paid_execution_requested: z.literal(false),
  canonical_allocator_required_for_later_execution: z.literal(true),
  receipt_digest: digest,
}).strict();

export const taskEvaluationLaunchPreparationStatusSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_preparation_status.v1"),
  status: z.enum(["not_found", "pending", "processing", "materialized", "blocked"]),
  preparation_id: identifier,
  run_mode: z.enum(["scene_configuration", "episode_evaluation"]).optional(),
  run_id: identifier.optional(),
  team_namespace: identifier.optional(),
  expected_production_commit: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  request_digest: digest.optional(),
  worker_status: z.string().min(1).max(192).optional(),
  source_commit: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  result_digest: digest.optional(),
  reference_count: z.number().int().nonnegative().optional(),
  full_byte_service_account_readback_passed: z.boolean().optional(),
  blockers: z.array(z.string().min(1).max(1000)).max(100).optional(),
  provider_mutation_performed_by_status_read: z.literal(false),
  provider_mutation_performed_by_worker: z.literal(false).optional(),
  catalog_mutation_performed_by_worker: z.literal(false).optional(),
  paid_execution_requested: z.literal(false).optional(),
  construction_orchestration_id: identifier.optional(),
  construction_queue_envelope_digest: digest.optional(),
  automatic_progression_required: z.literal(true).optional(),
  configured_scene_revision_digest: digest.optional(),
  configured_scene_bundle_digest: digest.optional(),
  episode_compilation_id: identifier.optional(),
  episode_compilation_queue_envelope_digest: digest.optional(),
}).strict();

export function taskEvaluationLaunchPreparationRequestDigest(
  request: TaskEvaluationLaunchPreparationInput,
) {
  return canonicalArtifactDigest(request as unknown as Record<string, unknown>, "request_digest");
}

export function resolveTaskEvaluationLaunchPreparationUrl(preparationId?: string): string {
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!launchUrl) return "";
  try {
    const url = new URL(launchUrl);
    url.pathname = preparationId
      ? `/api/live-pipeline/task-evaluation-launch-preparations/${encodeURIComponent(preparationId)}`
      : "/api/live-pipeline/task-evaluation-launch-preparations";
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
    timestamp,
    headers: {
      accept: "application/json",
      "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": clientId,
      "x-blueprint-pipeline-nonce": nonce,
      "x-blueprint-pipeline-signature": `sha256=${signature}`,
    },
  };
}

export type PreparationForwardResult = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  blocker?: string;
  http_status?: number;
  receipt?: z.infer<typeof preparationIntakeReceiptSchema>;
};

export async function forwardTaskEvaluationLaunchPreparation(params: {
  request: TaskEvaluationLaunchPreparationInput;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<PreparationForwardResult> {
  const endpoint = String(params.endpointUrl || resolveTaskEvaluationLaunchPreparationUrl()).trim();
  if (!endpoint) return { status: "not_configured", performed: false, blocker: "task_evaluation_launch_preparation_url_missing" };
  const token = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!token) return { status: "blocked", performed: false, blocker: "task_evaluation_launch_preparation_token_missing" };
  const body = JSON.stringify(params.request);
  const signed = signedHeaders(body, token, params.clientId || "blueprint-webapp");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...signed.headers, "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: "failed", performed: false, http_status: response.status, blocker: "pipeline_task_evaluation_launch_preparation_rejected" };
    const parsed = preparationIntakeReceiptSchema.safeParse(payload);
    if (
      !parsed.success
      || parsed.data.request_digest !== taskEvaluationLaunchPreparationRequestDigest(params.request)
      || parsed.data.receipt_digest !== canonicalArtifactDigest(
        parsed.data as unknown as Record<string, unknown>,
        "receipt_digest",
      )
    ) {
      return { status: "blocked", performed: false, blocker: "pipeline_task_evaluation_launch_preparation_receipt_invalid" };
    }
    return { status: "forwarded", performed: true, http_status: response.status, receipt: parsed.data };
  } catch (error) {
    return { status: "failed", performed: false, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_task_evaluation_launch_preparation_timeout" : "pipeline_task_evaluation_launch_preparation_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTaskEvaluationLaunchPreparationStatus(params: {
  preparationId: string;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}) {
  const endpoint = String(params.endpointUrl || resolveTaskEvaluationLaunchPreparationUrl(params.preparationId)).trim();
  const token = String(params.token || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "").trim();
  if (!endpoint || !token) return { ok: false as const, status: 503, blocker: !endpoint ? "task_evaluation_launch_preparation_url_missing" : "task_evaluation_launch_preparation_token_missing" };
  const signed = signedHeaders("", token, params.clientId || "blueprint-webapp");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, { method: "GET", headers: signed.headers, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, status: response.status, blocker: "pipeline_task_evaluation_launch_preparation_status_rejected" };
    const parsed = taskEvaluationLaunchPreparationStatusSchema.safeParse(payload);
    return parsed.success
      ? { ok: true as const, status: response.status, preparationStatus: parsed.data }
      : { ok: false as const, status: 502, blocker: "pipeline_task_evaluation_launch_preparation_status_invalid" };
  } catch (error) {
    return { ok: false as const, status: 503, blocker: error instanceof Error && error.name === "AbortError" ? "pipeline_task_evaluation_launch_preparation_status_timeout" : "pipeline_task_evaluation_launch_preparation_status_transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
