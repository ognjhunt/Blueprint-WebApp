import { createHmac, randomUUID } from "node:crypto";

import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { evaluationReadyPolicyRunSetupSchema } from "./evaluationReadyRunContract";
import { internalPolicyCanarySetupSchema } from "./internalPolicyCanaryContract";

export const CANONICAL_TASK_EVALUATION_ALLOCATOR =
  "python -m blueprint_pipeline.paid_resource_allocator gpu-canary";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const reference = z.object({ uri: z.string().min(1), digest }).passthrough();
const vastInstanceId = z.string().regex(/^[1-9][0-9]{0,18}$/);
const terminalVastLabel = z.string().regex(/^blueprint-adp009d-[1-9][0-9]{9,}$/);
const sourceCommit = z.string().regex(/^[0-9a-f]{40}$/);

export const publishedLaunchProfileSchema = z.object({
  profile_id: identifier,
  profile_digest: digest,
  source_commit: sourceCommit.optional(),
  source_bundle: reference.extend({
    bundle_id: identifier,
    source_kind: z.enum([
      "interiorgs_sage",
      "raw_v3_2_capture",
      "scaniverse_derived",
      "nvidia_simready_warehouse",
    ]),
  }).passthrough(),
  evaluation_run_spec: reference.passthrough(),
  required_controls: z.object({
    canonical_allocator: z.literal(CANONICAL_TASK_EVALUATION_ALLOCATOR),
    secret_profile_id: identifier,
    watchdog_required: z.literal(true),
    artifact_storage_required: z.literal(true),
    teardown_required: z.literal(true),
    provider_zero_required: z.literal(true),
    webapp_status_sync_required: z.literal(true),
    retry_cap: z.literal(0),
  }).strict(),
  execution_admission: z.object({
    live_enabled: z.boolean(),
    readiness_receipt: reference.strict(),
    blockers: z.array(z.string().trim().min(1)).max(100),
  }).strict().superRefine((value, context) => {
    if (value.live_enabled && value.blockers.length > 0) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "live_enabled profile cannot retain readiness blockers",
    });
    if (!value.live_enabled && value.blockers.length === 0) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dry-only profile must retain a readiness blocker",
    });
  }),
  claim_ceiling: z.enum([
    "development_only",
    "partner_run_pending_physical_join",
    "diagnostic_policy_execution",
  ]),
  required_authorization: z.object({
    max_spend_usd: z.number().positive().finite(),
    hard_ttl_seconds: z.number().int().positive(),
  }).strict().optional(),
  task_evaluation_run: z.object({
    run_mode: z.literal("scene_configuration"),
    team_namespace: identifier,
    scene_id: identifier,
    task_id: identifier,
    configuration_run_id: identifier,
    evaluation_episode_executed: z.literal(false),
  }).strict().optional(),
  policy_run_setup: evaluationReadyPolicyRunSetupSchema.optional(),
  internal_policy_canary_setup: internalPolicyCanarySetupSchema.optional(),
}).strict();

export const taskEvaluationLaunchInputSchema = z.object({
  launch_id: identifier,
  run_id: identifier,
  profile_id: identifier,
  profile_digest: digest,
  authorization_issued_at: z.string().datetime({ offset: true }).optional(),
  rights: z.object({
    scope: z.string().trim().min(1).max(1000),
    evidence: reference.strict(),
  }).strict(),
  spend: z.object({
    max_spend_usd: z.number().positive().finite(),
    expires_at: z.string().datetime({ offset: true }),
  }).strict(),
  confirm_execution: z.literal(true),
}).strict();

export const taskEvaluationLaunchWebPreflightReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_web_preflight_receipt.v1"),
  status: z.literal("ready"),
  launch_id: identifier,
  run_id: identifier,
  profile_id: identifier,
  profile_digest: digest,
  authorization_issued_at: z.string().datetime({ offset: true }),
  candidate_request_digest: digest,
  authenticated_client_id: identifier,
  submission_channel: z.literal("production_webapp_service_api"),
  webapp_store_available: z.literal(true),
  webapp_record_persisted: z.literal(false),
  pipeline_request_forwarded: z.literal(false),
  pipeline_queue_created: z.literal(false),
  provider_mutation_performed_inside_web_request: z.literal(false),
  preflight_is_not_execution: z.literal(true),
  receipt_digest: digest,
}).strict();

export const taskEvaluationLaunchPublicationReadinessRequestSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_publication_readiness_request.v1"),
  launch_id: identifier,
  run_id: identifier,
  request_digest: digest,
  team_namespace: identifier,
  expected_terminal_receipt_schema_version: z.literal(
    "task_evaluation_launch_receipt.v1",
  ),
  expected_web_sync_receipt_schema_version: z.literal(
    "task_evaluation_launch_web_sync_receipt.v1",
  ),
  expected_configured_scene_offering_schema_version: z.literal(
    "task_evaluation_configured_scene_offering.v1",
  ),
}).strict();

export function parseTaskEvaluationLaunchWebPreflightReceipt(value: unknown) {
  const parsed = taskEvaluationLaunchWebPreflightReceiptSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_web_preflight_receipt_schema_invalid"],
  };
  const receipt = parsed.data;
  if (
    canonicalArtifactDigest(
      receipt as unknown as Record<string, unknown>,
      "receipt_digest",
    ) !== receipt.receipt_digest
  ) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_web_preflight_receipt_digest_mismatch"],
  };
  return { ok: true as const, receipt };
}

// This is a release-only recovery action. It can name one stopped Vast record
// after a website-owned launch is terminally blocked; it cannot restart or
// retry evaluation work.
export const taskEvaluationTerminalResourceReleaseInputSchema = z.object({
  provider: z.literal("vast"),
  instance_id: vastInstanceId,
  expected_label: terminalVastLabel,
  confirm_terminal_resource_release: z.literal(true),
}).strict();

export const taskEvaluationLaunchReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_receipt.v1"),
  status: z.enum(["completed", "dry_run_completed", "blocked"]),
  launch_id: identifier,
  run_id: identifier,
  request_digest: digest,
  launch_profile_digest: digest.nullable(),
  source_commit: sourceCommit.optional(),
  binding_digest: digest,
  canonical_allocator: z.literal(CANONICAL_TASK_EVALUATION_ALLOCATOR),
  allocator_exit_code: z.number().int().nullable(),
  execute_requested: z.boolean(),
  provider_mutation_attempted: z.boolean(),
  terminal_evidence: z.record(z.string(), z.unknown()),
  blockers: z.array(z.string()),
  raw_secret_values_recorded: z.literal(false),
  agent_operator_used: z.literal(false),
  claim_ceiling: z.enum(["development_only", "partner_run_pending_physical_join"]),
  receipt_digest: digest,
}).passthrough();

const taskEvaluationSceneConfigurationPublicationRecoverySchema = z.object({
  schema_version: z.literal(
    "task_evaluation_scene_configuration_publication_recovery.v1",
  ),
  status: z.literal("completed"),
  recovery_source_commit: sourceCommit,
  provider_execution_repeated: z.literal(false),
  paid_execution_requested: z.literal(false),
  provider_mutation_performed: z.literal(false),
  original_configuration_result_digest: digest,
  provider_result_digest: digest,
  original_terminal_receipt_digest: digest,
  recovered_configuration_result_digest: digest,
  queue_finalization_digest: digest,
  recovery_digest: digest,
}).strict();

export function parseTaskEvaluationLaunchReceipt(value: unknown) {
  const parsed = taskEvaluationLaunchReceiptSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_receipt_schema_invalid"],
  };
  const receipt = parsed.data;
  if (
    canonicalArtifactDigest(
      receipt as unknown as Record<string, unknown>,
      "receipt_digest",
    ) !== receipt.receipt_digest
  ) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_receipt_digest_mismatch"],
  };
  const recoveryValue = (
    receipt as unknown as Record<string, unknown>
  ).publication_recovery;
  if (recoveryValue !== undefined) {
    const recovery = taskEvaluationSceneConfigurationPublicationRecoverySchema
      .safeParse(recoveryValue);
    const terminal = receipt.terminal_evidence as Record<string, unknown>;
    if (
      !recovery.success
      || receipt.status !== "completed"
      || canonicalArtifactDigest(
        recovery.success
          ? recovery.data as unknown as Record<string, unknown>
          : {},
        "recovery_digest",
      ) !== (recovery.success ? recovery.data.recovery_digest : "")
      || typeof terminal.publication_recovery !== "object"
      || terminal.publication_recovery === null
      || (terminal.publication_recovery as Record<string, unknown>).recovery_digest
        !== (recovery.success ? recovery.data.recovery_digest : "")
    ) return {
      ok: false as const,
      blockers: ["task_evaluation_launch_publication_recovery_invalid"],
    };
  }
  return { ok: true as const, receipt };
}

export const taskEvaluationDirectExecutionAdoptionReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_native_direct_execution_adoption.v1"),
  status: z.literal("blocked"),
  launch_id: identifier,
  run_id: identifier,
  request_digest: digest,
  launch_profile_id: identifier,
  launch_profile_digest: digest,
  binding_digest: digest,
  original_launch_receipt_digest: digest,
  direct_execution_kind: z.literal("canonical_allocator_manual_rescue_adopted"),
  paid_execution_performed: z.literal(true),
  retry_cap: z.literal(0),
  continuing_spend_from_this_run: z.literal(false),
  provider_instance_id: z.number().int().positive(),
  construction_gate_qualified: z.literal(false),
  controls_qualified: z.literal(false),
  evaluation_ready: z.literal(false),
  blockers: z.array(z.string().trim().min(1)).min(1),
  website_projection: z.object({
    configured_scene_offering_status: z.literal("configured_controls_pending"),
    native_construction_status: z.literal("blocked"),
    native_construction_blockers: z.array(z.string().trim().min(1)).min(1),
    controls_qualified: z.literal(false),
    evaluation_ready: z.literal(false),
    qualification_upgrade_performed: z.literal(false),
  }).strict(),
  source_receipts: z.record(z.string(), z.object({
    path: z.string().trim().min(1),
    size_bytes: z.number().int().positive(),
    sha256: digest,
    schema_version: z.string().nullable().optional(),
    status: z.string().optional(),
  }).passthrough()),
  history_overwritten: z.literal(false),
  automatic_retry_performed: z.literal(false),
  provider_mutation_performed_by_adoption: z.literal(false),
  raw_secret_values_recorded: z.literal(false),
  receipt_digest: digest,
}).passthrough();

export function parseTaskEvaluationDirectExecutionAdoptionReceipt(value: unknown) {
  const parsed = taskEvaluationDirectExecutionAdoptionReceiptSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["task_evaluation_direct_execution_adoption_schema_invalid"],
  };
  const receipt = parsed.data;
  if (
    receipt.run_id !== receipt.launch_id
    || receipt.website_projection.native_construction_blockers.length
      !== receipt.blockers.length
    || receipt.website_projection.native_construction_blockers.some(
      (blocker, index) => blocker !== receipt.blockers[index],
    )
    || canonicalArtifactDigest(
      receipt as unknown as Record<string, unknown>,
      "receipt_digest",
    ) !== receipt.receipt_digest
  ) return {
    ok: false as const,
    blockers: ["task_evaluation_direct_execution_adoption_digest_invalid"],
  };
  return { ok: true as const, receipt };
}

// A launch runs for roughly twenty-five minutes and the terminal receipt only
// arrives at the very end, so this is the non-terminal channel that reports
// boot, dependency, scene, and runtime phases while they happen.
//
// Strict, where the terminal receipt is `.passthrough()`. The receipt must keep
// unknown keys because `receipt_digest` covers its whole canonical object, so
// dropping a field would break verification. Progress carries no digest and is
// nothing to verify against — it is merged verbatim into the durable launch
// record the control room reads. Strict keeps that write bounded to these known
// keys, so a newer or misbuilt Pipeline cannot widen an unverified observation
// into the launch record, least of all with anything resembling `state`.
export const taskEvaluationLaunchProgressSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_progress.v1"),
  launch_id: identifier,
  run_id: identifier,
  request_digest: digest,
  // The worker authors these labels in its runtime phase log, so they stay
  // bounded free-form strings: an enum would fail closed on the first new
  // phase name and silently lose the visibility this channel exists to give.
  phase: z.string().trim().min(1).max(120),
  phase_status: z.string().trim().min(1).max(120),
  observed_at_iso: z.string().datetime({ offset: true }),
  elapsed_seconds: z.number().nonnegative().finite(),
  // Absent until an instance is observable, and null-valued while the provider
  // reports no age or rate yet. The cost is derived from observed rate x age —
  // an estimate, never the billed figure, which only the receipt carries.
  provider: z.object({
    instance_state: z.string().trim().min(1).max(120),
    instance_age_seconds: z.number().nonnegative().finite().nullable(),
    estimated_cost_usd: z.number().nonnegative().finite().nullable(),
  }).strict().optional(),
}).strict();

export function parseTaskEvaluationLaunchProgress(value: unknown) {
  const parsed = taskEvaluationLaunchProgressSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_progress_schema_invalid"],
  };
  return { ok: true as const, progress: parsed.data };
}

export const taskEvaluationLaunchSupervisionSchema = z.object({
  schema_version: z.literal("task_evaluation_launch_supervision.v1"),
  status: z.enum(["completed", "blocked"]),
  snapshot_digest: digest,
  agent_invoked: z.boolean(),
  provider_mutation_performed: z.literal(false),
  allocator_invoked: z.literal(false),
  automatic_retry_performed: z.literal(false),
  authority_granted: z.literal(false),
  supervision_digest: digest,
}).passthrough();

export function parseTaskEvaluationLaunchSupervision(value: unknown) {
  const parsed = taskEvaluationLaunchSupervisionSchema.safeParse(value);
  if (!parsed.success) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_supervision_schema_invalid"],
  };
  const supervision = parsed.data;
  if (
    canonicalArtifactDigest(
      supervision as unknown as Record<string, unknown>,
      "supervision_digest",
    ) !== supervision.supervision_digest
  ) return {
    ok: false as const,
    blockers: ["task_evaluation_launch_supervision_digest_mismatch"],
  };
  return { ok: true as const, supervision };
}

export type PublishedLaunchProfile = z.infer<typeof publishedLaunchProfileSchema>;
export type PublishedLaunchProfileCatalog = {
  profiles: PublishedLaunchProfile[];
  blocker?: string;
};

function parsePublishedLaunchProfiles(value: unknown): PublishedLaunchProfile[] {
  const result = z.array(publishedLaunchProfileSchema).safeParse(value);
  if (!result.success) return [];
  const seen = new Set<string>();
  return result.data.filter((profile) => {
    const key = `${profile.profile_id}:${profile.profile_digest}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function loadPublishedLaunchProfiles(
  raw = process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON,
): PublishedLaunchProfile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw || "[]"));
  } catch {
    return [];
  }
  return parsePublishedLaunchProfiles(parsed);
}

function derivePipelineEndpoint(pathname: string): string {
  const configured = String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL || "").trim();
  if (!configured) return "";
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") return "";
    if (!url.pathname.endsWith("/api/live-pipeline/job-requests")) return "";
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function resolveTaskEvaluationLaunchUrl(): string {
  return String(
    process.env.TASK_EVALUATION_LAUNCH_URL
      || derivePipelineEndpoint("/api/live-pipeline/task-evaluation-launches"),
  ).trim();
}

export function resolveTaskEvaluationTerminalResourceReleaseUrl(): string {
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!launchUrl) return "";
  try {
    const url = new URL(launchUrl);
    url.pathname = "/api/live-pipeline/task-evaluation-terminal-resource-releases";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function resolveTaskEvaluationProfileCatalogUrl(): string {
  const configured = String(process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL || "").trim();
  if (configured) return configured;
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!launchUrl) return "";
  try {
    const url = new URL(launchUrl);
    url.pathname = "/api/live-pipeline/task-evaluation-launch-profiles";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Resolve the only profile catalog that can authorize a paid launch.  Keep the
 * upstream failure typed so the WebApp never turns a dead Pipeline connection
 * into an indistinguishable empty catalog.
 */
export async function resolvePublishedLaunchProfileCatalog(): Promise<PublishedLaunchProfileCatalog> {
  const configured = loadPublishedLaunchProfiles();
  const endpoint = resolveTaskEvaluationProfileCatalogUrl();
  if (!endpoint) return configured.length > 0
    ? { profiles: configured }
    : {
        profiles: [],
        blocker: "task_evaluation_launch_profile_catalog_url_missing",
      };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return {
      profiles: [],
      blocker: `task_evaluation_launch_profile_catalog_http_${response.status}`,
    };
    const payload = await response.json().catch(() => null);
    if (
      !payload
      || payload.schema_version !== "task_evaluation_launch_profile_catalog.v1"
    ) return {
      profiles: [],
      blocker: "task_evaluation_launch_profile_catalog_schema_invalid",
    };
    const profiles = parsePublishedLaunchProfiles(payload.profiles);
    return profiles.length > 0
      ? { profiles }
      : {
        profiles: [],
        blocker: "task_evaluation_launch_profile_catalog_empty",
      };
  } catch (error) {
    return {
      profiles: [],
      blocker: error instanceof Error && error.name === "AbortError"
        ? "task_evaluation_launch_profile_catalog_timeout"
        : "task_evaluation_launch_profile_catalog_transport_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolvePublishedLaunchProfiles(): Promise<PublishedLaunchProfile[]> {
  return (await resolvePublishedLaunchProfileCatalog()).profiles;
}

export function buildTaskEvaluationLaunchRequest(params: {
  input: z.infer<typeof taskEvaluationLaunchInputSchema>;
  profile: PublishedLaunchProfile;
  actorId: string;
  actorRole: "admin" | "ops";
  authorizedAt: string;
}) {
  const request: Record<string, any> = {
    schema_version: "task_evaluation_launch_request.v1",
    launch_id: params.input.launch_id,
    run_id: params.input.run_id,
    launch_profile_id: params.profile.profile_id,
    launch_profile_digest: params.profile.profile_digest,
    source_bundle: params.profile.source_bundle,
    evaluation_run_spec: params.profile.evaluation_run_spec,
    authorization: {
      actor: { id: params.actorId, role: params.actorRole },
      authorized_at: params.authorizedAt,
      rights: {
        approved: true,
        scope: params.input.rights.scope,
        evidence: params.input.rights.evidence,
      },
      spend: {
        approved: true,
        currency: "USD",
        max_spend_usd: params.input.spend.max_spend_usd,
        expires_at: params.input.spend.expires_at,
      },
      execution: { approved: true },
    },
    required_controls: params.profile.required_controls,
    claim_ceiling: params.profile.claim_ceiling,
    idempotency_key: params.input.launch_id,
  };
  if (params.profile.source_commit) request.source_commit = params.profile.source_commit;
  request.request_digest = canonicalArtifactDigest(request, "request_digest");
  return request;
}

export function buildTaskEvaluationTerminalResourceReleaseRequest(params: {
  launchRecord: Record<string, any>;
  input: z.infer<typeof taskEvaluationTerminalResourceReleaseInputSchema>;
  actorId: string;
  actorRole: "admin" | "ops";
  authorizedAt: string;
}) {
  const blocker = params.launchRecord.control_plane_terminal_blocker;
  if (
    params.launchRecord.state !== "control_plane_terminal_blocked"
    || !blocker
    || blocker.schema_version !== "task_evaluation_launch_control_plane_blocker.v1"
    || blocker.status !== "blocked"
    || blocker.code !== "control_plane_terminal_receipt_missing_after_spend_authority_expiry"
    || blocker.launch_id !== params.launchRecord.launch_id
    || blocker.run_id !== params.launchRecord.run_id
    || blocker.request_digest !== params.launchRecord.request_digest
    || blocker.pipeline_terminal_receipt_observed !== false
    || blocker.provider_mutation_performed_by_webapp !== false
    || blocker.paid_execution_retry_performed !== false
    || blocker.execution_result !== "not_observed"
    || blocker.scripted_positive_controls_result !== "not_observed"
    || blocker.learned_policy_result !== "not_observed"
    || params.launchRecord.terminal_receipt_present !== false
    || params.launchRecord.provider_mutation_observed !== false
    || params.launchRecord.paid_execution_retry_performed !== false
  ) throw new Error("terminal_resource_release_launch_not_eligible");

  const request: Record<string, any> = {
    schema_version: "task_evaluation_terminal_resource_release_request.v1",
    release_id: `${params.launchRecord.launch_id}-vast-${params.input.instance_id}`,
    launch_id: params.launchRecord.launch_id,
    run_id: params.launchRecord.run_id,
    request_digest: params.launchRecord.request_digest,
    control_plane_terminal_blocker: {
      schema_version: blocker.schema_version,
      status: blocker.status,
      code: blocker.code,
      launch_id: blocker.launch_id,
      run_id: blocker.run_id,
      request_digest: blocker.request_digest,
      spend_authority_expires_at: blocker.spend_authority_expires_at,
      observed_at_iso: blocker.observed_at_iso,
      pipeline_terminal_receipt_observed: false,
      provider_mutation_performed_by_webapp: false,
      paid_execution_retry_performed: false,
      execution_result: "not_observed",
      scripted_positive_controls_result: "not_observed",
      learned_policy_result: "not_observed",
    },
    provider: params.input.provider,
    instance_id: params.input.instance_id,
    expected_label: params.input.expected_label,
    authorization: {
      actor: { id: params.actorId, role: params.actorRole },
      authorized_at: params.authorizedAt,
      action: "terminal_provider_record_release",
      approved: true,
      max_additional_spend_usd: 0,
      retry_cap: 0,
    },
    provider_mutation_performed_inside_web_request: false,
    automatic_retry_performed: false,
    claim_ceiling: "operational_resource_release_only",
  };
  request.terminal_resource_release_digest = canonicalArtifactDigest(
    request,
    "terminal_resource_release_digest",
  );
  return request;
}

export type LaunchForwardResult = {
  status: "forwarded" | "not_configured" | "blocked" | "failed";
  performed: boolean;
  required: boolean;
  endpoint_configured: boolean;
  http_status?: number;
  blocker?: string;
  queue_receipt?: Record<string, unknown>;
  pipeline_intake_status?: "accepted" | "queued_dispatch_blocked";
};

export async function forwardTaskEvaluationLaunch(params: {
  request: Record<string, unknown>;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<LaunchForwardResult> {
  const endpoint = String(
    params.endpointUrl || resolveTaskEvaluationLaunchUrl(),
  ).trim();
  const required = process.env.NODE_ENV === "production"
    || String(process.env.TASK_EVALUATION_LAUNCH_FORWARD_REQUIRED || "").toLowerCase() === "true";
  if (!endpoint) return {
    status: "not_configured", performed: false, required,
    endpoint_configured: false, blocker: "task_evaluation_launch_url_missing",
  };
  const token = String(
    params.token
      || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN
      || "",
  ).trim();
  if (!token) return {
    status: "blocked", performed: false, required,
    endpoint_configured: true, blocker: "task_evaluation_launch_forward_token_missing",
  };
  const clientId = String(
    params.clientId || "blueprint-webapp",
  ).trim();
  const body = JSON.stringify(params.request);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const timeoutMs = Math.max(
    10_000,
    Number(process.env.TASK_EVALUATION_RUN_FORWARD_TIMEOUT_MS || 10_000),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      status: "failed", performed: false, required, endpoint_configured: true,
      http_status: response.status, blocker: "pipeline_task_evaluation_launch_rejected",
    };
    const queueReceipt = payload?.queue;
    if (
      !payload || payload.schema_version !== "task_evaluation_launch_intake_receipt.v1"
      || payload.provider_mutation_performed_inside_http_request !== false
      || !queueReceipt
      || queueReceipt.schema_version !== "task_evaluation_launch_queue_receipt.v1"
      || queueReceipt.request_digest !== params.request.request_digest
      || queueReceipt.launch_id !== params.request.launch_id
      || queueReceipt.provider_mutation_performed !== false
    ) return {
      status: "failed", performed: false, required, endpoint_configured: true,
      http_status: response.status, blocker: "pipeline_task_evaluation_launch_receipt_invalid",
    };
    return {
      status: "forwarded", performed: true, required, endpoint_configured: true,
      http_status: response.status, queue_receipt: queueReceipt,
      pipeline_intake_status: payload.status,
    };
  } catch (error) {
    return {
      status: "failed", performed: false, required, endpoint_configured: true,
      blocker: error instanceof Error && error.name === "AbortError"
        ? "task_evaluation_launch_forward_timeout"
        : "task_evaluation_launch_forward_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Forward an already-durable, release-only request to Pipeline.  This is kept
 * separate from the launch forwarder so a valid launch-intake receipt cannot
 * accidentally be interpreted as permission to release a provider record.
 */
export async function forwardTaskEvaluationTerminalResourceRelease(params: {
  request: Record<string, unknown>;
  endpointUrl?: string;
  token?: string;
  clientId?: string;
}): Promise<LaunchForwardResult> {
  const endpoint = String(
    params.endpointUrl || resolveTaskEvaluationTerminalResourceReleaseUrl(),
  ).trim();
  if (!endpoint) return {
    status: "not_configured", performed: false, required: true,
    endpoint_configured: false, blocker: "task_evaluation_terminal_resource_release_url_missing",
  };
  const token = String(
    params.token
      || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN
      || "",
  ).trim();
  if (!token) return {
    status: "blocked", performed: false, required: true,
    endpoint_configured: true, blocker: "task_evaluation_terminal_resource_release_forward_token_missing",
  };
  const clientId = String(params.clientId || "blueprint-webapp").trim();
  const body = JSON.stringify(params.request);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${clientId}.${nonce}.${body}`)
    .digest("hex");
  const timeoutMs = Math.max(
    10_000,
    Number(process.env.TASK_EVALUATION_RUN_FORWARD_TIMEOUT_MS || 10_000),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      status: "failed", performed: false, required: true, endpoint_configured: true,
      http_status: response.status, blocker: "pipeline_task_evaluation_terminal_resource_release_rejected",
    };
    const queueReceipt = payload?.queue;
    if (
      !payload
      || payload.schema_version !== "task_evaluation_terminal_resource_release_intake_receipt.v1"
      || payload.provider_mutation_performed_inside_http_request !== false
      || !queueReceipt
      || queueReceipt.schema_version !== "task_evaluation_terminal_resource_release_queue_receipt.v1"
      || queueReceipt.release_id !== params.request.release_id
      || queueReceipt.terminal_resource_release_digest
        !== params.request.terminal_resource_release_digest
      || queueReceipt.provider_mutation_performed !== false
    ) return {
      status: "failed", performed: false, required: true, endpoint_configured: true,
      http_status: response.status,
      blocker: "pipeline_task_evaluation_terminal_resource_release_receipt_invalid",
    };
    return {
      status: "forwarded", performed: true, required: true, endpoint_configured: true,
      http_status: response.status, queue_receipt: queueReceipt,
      pipeline_intake_status: "accepted",
    };
  } catch (error) {
    return {
      status: "failed", performed: false, required: true, endpoint_configured: true,
      blocker: error instanceof Error && error.name === "AbortError"
        ? "task_evaluation_terminal_resource_release_forward_timeout"
        : "task_evaluation_terminal_resource_release_forward_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
