import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import {
  confirmedRigidTaskSuccessContractSchema,
  rigidTaskSuccessContractMatchesSelection,
  rigidTaskSuccessContractSchema,
} from "./rigidTaskSuccessContract";

export const INTERNAL_POLICY_CANARY_RUN_KIND = "internal_policy_canary" as const;
export const INTERNAL_POLICY_CANARY_CLAIM_CEILING =
  "diagnostic_policy_execution" as const;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const immutableReference = z.object({
  uri: z.string().min(1),
  digest,
}).passthrough();

export const policyCanaryVariationFamilies = [
  "canonical_anchor",
  "placement_approach",
  "illumination",
  "camera_sensor",
  "bounded_physics",
  "admitted_object_material_cousin",
  "pairwise_stress",
  "held_out_composition",
] as const;

const variationFamilySchema = z.enum(policyCanaryVariationFamilies);
const readinessSchema = z.object({
  status: z.enum(["verified_runnable", "unavailable"]),
  receipt: immutableReference.nullable(),
  reason: z.string().trim().min(1).max(1000).nullable(),
}).strict().superRefine((readiness, context) => {
  if (readiness.status === "verified_runnable" && !readiness.receipt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["receipt"],
      message: "verified runnable option requires a readiness receipt",
    });
  }
  if (readiness.status === "unavailable" && !readiness.reason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "unavailable option requires an exact reason",
    });
  }
});

export const policyCanaryCandidateSchema = z.object({
  candidate_id: identifier,
  display_name: z.string().trim().min(1).max(160),
  checkpoint: immutableReference,
  adapter_id: identifier,
  license_id: z.string().trim().min(1).max(200),
  compatibility: z.object({
    robot_preset_ids: z.array(identifier).min(1),
    embodiment_ids: z.array(identifier).min(1),
    observation_schema_ids: z.array(identifier).min(1),
    action_schema_ids: z.array(identifier).min(1),
    simulator_runtime_ids: z.array(identifier).min(1),
    task_family_ids: z.array(identifier).min(1),
  }).strict(),
  readiness: readinessSchema,
}).strict();

export const policyCanaryRobotPresetSchema = z.object({
  robot_preset_id: identifier,
  display_name: z.string().trim().min(1).max(160),
  embodiment_id: identifier,
  task_family_id: identifier,
  simulator_runtime_id: identifier,
  runtime_image: immutableReference,
  observation_schema: z.object({
    schema_id: identifier,
    cameras: z.array(z.string().trim().min(1).max(160)).min(1),
    modalities: z.array(z.string().trim().min(1).max(160)).min(1),
  }).strict(),
  action_schema: z.object({
    schema_id: identifier,
    space: z.string().trim().min(1).max(240),
    control_hz: z.number().positive().finite(),
  }).strict(),
  readiness: readinessSchema,
  policy_candidates: z.array(policyCanaryCandidateSchema).min(2).max(50),
}).strict();

const policyCanaryCellSchema = z.object({
  cell_id: identifier,
  family: variationFamilySchema,
  seed: z.number().int().nonnegative(),
  partition: z.enum(["canonical", "stress", "held_out"]),
  label: z.string().trim().min(1).max(240),
  cell_digest: digest,
}).strict();

const familyCountsSchema = z.object({
  canonical_anchor: z.number().int().nonnegative(),
  placement_approach: z.number().int().nonnegative(),
  illumination: z.number().int().nonnegative(),
  camera_sensor: z.number().int().nonnegative(),
  bounded_physics: z.number().int().nonnegative(),
  admitted_object_material_cousin: z.number().int().nonnegative(),
  pairwise_stress: z.number().int().nonnegative(),
  held_out_composition: z.number().int().nonnegative(),
}).strict();

const estimateSchema = z.object({
  duration_minutes: z.object({
    minimum: z.number().nonnegative().finite(),
    maximum: z.number().nonnegative().finite(),
  }).strict(),
  maximum_authorized_cost_usd: z.number().positive().finite(),
  hard_ttl_seconds: z.number().int().positive(),
  basis_digest: digest,
  as_of: z.string().datetime({ offset: true }),
}).strict().superRefine((estimate, context) => {
  if (estimate.duration_minutes.maximum < estimate.duration_minutes.minimum) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["duration_minutes", "maximum"],
      message: "maximum duration must not be below minimum duration",
    });
  }
});

export const policyCanaryEpisodePresetSchema = z.object({
  preset_id: z.enum(["quick_10", "standard_100", "deep_500"]),
  label: z.enum(["Quick", "Standard", "Deep"]),
  episodes_per_policy: z.union([z.literal(10), z.literal(100), z.literal(500)]),
  availability: z.enum(["enabled", "coming_later"]),
  recommended: z.boolean(),
  matrix: z.object({
    matrix_digest: digest,
    resolver_id: identifier,
    resolver_version: z.string().trim().min(1).max(80),
    deterministic: z.literal(true),
    cells: z.array(policyCanaryCellSchema).max(500),
    expected_family_counts: familyCountsSchema,
    coverage_gaps: z.array(z.object({
      family: variationFamilySchema,
      code: identifier,
      explanation: z.string().trim().min(1).max(1000),
      deterministic_fallback_family: variationFamilySchema,
    }).strict()).max(policyCanaryVariationFamilies.length),
  }).strict(),
  estimate: estimateSchema,
}).strict().superRefine((preset, context) => {
  if (canonicalArtifactDigest(
    { ordered_cells: preset.matrix.cells },
    "__no_digest_field__",
  ) !== preset.matrix.matrix_digest) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matrix", "matrix_digest"],
      message: "matrix digest must bind the ordered resolved cells",
    });
  }
  if (preset.availability === "enabled" && preset.matrix.cells.length !== preset.episodes_per_policy) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matrix", "cells"],
      message: "enabled preset must publish one resolved cell per policy episode",
    });
  }
  const ids = new Set(preset.matrix.cells.map((cell) => cell.cell_id));
  if (ids.size !== preset.matrix.cells.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matrix", "cells"],
      message: "resolved matrix cannot silently duplicate a cell",
    });
  }
  if (preset.preset_id === "quick_10") {
    if (
      preset.episodes_per_policy !== 10
      || preset.availability !== "enabled"
      || !preset.recommended
      || preset.matrix.cells.length !== 10
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "quick_10 must be the enabled recommended ten-cell preset",
    });
  }
});

export const internalPolicyCanarySetupSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_setup.v1"),
  source_launch_id: identifier,
  offering_digest: digest,
  scene_revision_digest: digest,
  run_kind: z.literal(INTERNAL_POLICY_CANARY_RUN_KIND),
  claim_ceiling: z.literal(INTERNAL_POLICY_CANARY_CLAIM_CEILING),
  registry_digest: digest,
  robot_presets: z.array(policyCanaryRobotPresetSchema).min(1).max(20),
  episode_presets: z.tuple([
    policyCanaryEpisodePresetSchema,
    policyCanaryEpisodePresetSchema,
    policyCanaryEpisodePresetSchema,
  ]),
  diagnostics: z.object({
    zero_action: z.enum(["nonblocking", "not_configured"]),
    deterministic_scripted_positive: z.enum(["nonblocking", "not_configured"]),
  }).strict(),
  task_success_contract: rigidTaskSuccessContractSchema.optional(),
  task_success_contract_digest: digest.optional(),
  setup_digest: digest,
}).strict().superRefine((setup, context) => {
  if (canonicalArtifactDigest(
    setup as unknown as Record<string, unknown>,
    "setup_digest",
  ) !== setup.setup_digest) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["setup_digest"],
    message: "policy canary setup digest mismatch",
  });
  const presetIds = setup.episode_presets.map((preset) => preset.preset_id);
  if (new Set(presetIds).size !== 3 || !presetIds.includes("quick_10")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["episode_presets"],
      message: "setup must publish Quick, Standard, and Deep exactly once",
    });
  }
  if (
    Boolean(setup.task_success_contract)
      !== Boolean(setup.task_success_contract_digest)
    || (setup.task_success_contract
      && setup.task_success_contract_digest
        !== setup.task_success_contract.contract_digest)
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["task_success_contract_digest"],
    message: "task success contract digest mismatch",
  });
});

export const internalPolicyCanarySelectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_selection.v1"),
  run_kind: z.literal(INTERNAL_POLICY_CANARY_RUN_KIND),
  claim_ceiling: z.literal(INTERNAL_POLICY_CANARY_CLAIM_CEILING),
  run_id: identifier,
  offering_digest: digest,
  setup_digest: digest,
  scene_revision_digest: digest,
  robot_preset_id: identifier,
  policy_candidate_ids: z.tuple([identifier, identifier]),
  episode_preset_id: z.literal("quick_10"),
  variation_matrix_digest: digest,
  task_success_contract: confirmedRigidTaskSuccessContractSchema,
  notification: z.object({
    email: z.string().trim().email(),
    notify_on: z.tuple([
      z.literal("completed"),
      z.literal("blocked"),
      z.literal("cancelled"),
    ]),
  }).strict(),
  authorization: z.object({
    maximum_cost_usd: z.number().positive().finite(),
    hard_ttl_seconds: z.number().int().positive(),
    maximum_provider_allocations: z.literal(1),
    retry_cap: z.literal(0),
  }).strict(),
  episode_interpretation: z.object({
    enabled: z.literal(true),
    external_disclosure_authorized: z.literal(true),
    provider_training_authorized: z.literal(false),
    public_redistribution_authorized: z.literal(false),
    maximum_cost_usd: z.literal(1.5),
  }).strict(),
  confirm_unqualified_execution: z.literal(true),
}).strict().superRefine((selection, context) => {
  if (selection.policy_candidate_ids[0] === selection.policy_candidate_ids[1]) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["policy_candidate_ids"],
      message: "exactly two different policy candidates are required",
    });
  }
});

export const policyCanaryStages = [
  "queued",
  "preparing",
  "provider_allocating",
  "runtime_starting",
  "policy_a_running",
  "policy_b_running",
  "artifacts_syncing",
  "report_generating",
  "billing_teardown",
  "terminal",
] as const;

export const internalPolicyCanaryStatusProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_status_projection.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  configuration_digest: digest,
  request_digest: digest.optional(),
  run_kind: z.literal(INTERNAL_POLICY_CANARY_RUN_KIND),
  claim_ceiling: z.literal(INTERNAL_POLICY_CANARY_CLAIM_CEILING),
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]).nullable(),
  scene_controls_status: z.literal("configured_controls_pending"),
  state: z.enum(["queued", "running", "aggregating", "results_ready", "blocked", "failed", "cancelled"]),
  stage: z.enum(policyCanaryStages),
  phase: z.string().trim().min(1).max(120).nullable(),
  progress: z.object({
    completed_episodes: z.number().int().nonnegative(),
    total_episodes: z.number().int().positive(),
  }).strict().nullable(),
  completed_learned_episode_count: z.number().int().nonnegative(),
  expected_learned_episode_count: z.literal(20),
  completed_control_episode_count: z.number().int().nonnegative(),
  result_record_id: identifier.nullable().optional(),
  delivery_digest: digest.nullable().optional(),
  policy_run_result_projection: z.record(z.string(), z.unknown()).nullable().optional(),
  notification_delivery: z.object({
    status: z.enum(["pending", "accepted", "delivered", "failed"]),
    attempts: z.number().int().nonnegative(),
  }).passthrough().nullable().optional(),
  error: z.object({
    code: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(500),
  }).strict().nullable().optional(),
  observed_at_iso: z.string().datetime({ offset: true }),
}).strict().superRefine((projection, context) => {
  if (
    projection.completed_learned_episode_count > projection.expected_learned_episode_count
    || (projection.progress
      && projection.progress.completed_episodes > projection.progress.total_episodes)
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["progress"],
    message: "completed episode count exceeds the immutable canary plan",
  });
  if (
    projection.state === "results_ready"
    && (
      projection.result_status !== "completed_unqualified"
      || !projection.result_record_id
      || !projection.delivery_digest
    )
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["result_status"],
    message: "completed canary requires an unqualified digest-bound result record",
  });
  if (
    ["blocked", "failed", "cancelled"].includes(projection.state)
    && !projection.error
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["error"],
    message: "blocked, failed, or cancelled canary requires a bounded error",
  });
});

export type InternalPolicyCanarySetup = z.infer<typeof internalPolicyCanarySetupSchema>;
export type InternalPolicyCanarySelection = z.infer<typeof internalPolicyCanarySelectionSchema>;
export type PolicyCanaryRobotPreset = z.infer<typeof policyCanaryRobotPresetSchema>;
export type PolicyCanaryEpisodePreset = z.infer<typeof policyCanaryEpisodePresetSchema>;

export type PolicyCanarySelectionResolution =
  | {
      ok: true;
      robot: PolicyCanaryRobotPreset;
      candidates: [
        z.infer<typeof policyCanaryCandidateSchema>,
        z.infer<typeof policyCanaryCandidateSchema>,
      ];
      preset: PolicyCanaryEpisodePreset;
    }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export function resolveInternalPolicyCanarySelection(
  setup: InternalPolicyCanarySetup,
  selection: InternalPolicyCanarySelection,
  expectedScope?: { siteId: string; taskId: string; teamId: string },
): PolicyCanarySelectionResolution {
  if (
    selection.offering_digest !== setup.offering_digest
    || selection.setup_digest !== setup.setup_digest
    || selection.scene_revision_digest !== setup.scene_revision_digest
  ) return {
    ok: false,
    code: "POLICY_CANARY_SETUP_CHANGED",
    message: "The configured scene or policy registry changed. Review the exact plan again.",
  };
  if (!setup.task_success_contract) return {
    ok: false,
    code: "TASK_SUCCESS_CONTRACT_NOT_PUBLISHED",
    message: "The task/site team has not published an exact success contract for this run.",
  };
  if (!rigidTaskSuccessContractMatchesSelection({
      published: setup.task_success_contract,
      selected: selection.task_success_contract,
      expectedSiteId: expectedScope?.siteId || setup.task_success_contract.scope.site_id,
      expectedTaskId: expectedScope?.taskId || setup.task_success_contract.scope.task_id,
      expectedTeamId: expectedScope?.teamId
        || selection.task_success_contract.provenance.confirmed_by_team_id
        || "",
    })) return {
    ok: false,
    code: "TASK_SUCCESS_CONTRACT_CHANGED",
    message: "The confirmed success criteria do not match the published task/site contract.",
  };
  const robot = setup.robot_presets.find(
    (candidate) => candidate.robot_preset_id === selection.robot_preset_id,
  );
  if (!robot) return {
    ok: false,
    code: "ROBOT_PRESET_NOT_FOUND",
    message: "The selected robot preset is no longer in the canonical registry.",
  };
  if (robot.readiness.status !== "verified_runnable") return {
    ok: false,
    code: "ROBOT_PRESET_UNAVAILABLE",
    message: robot.readiness.reason || "The selected robot preset is unavailable.",
  };
  const selected = selection.policy_candidate_ids.map((candidateId) => (
    robot.policy_candidates.find((candidate) => candidate.candidate_id === candidateId)
  ));
  if (!selected[0] || !selected[1]) return {
    ok: false,
    code: "POLICY_NOT_FOUND",
    message: "A selected policy is no longer in the canonical registry for this robot.",
  };
  const selectedCandidates = [selected[0], selected[1]] as const;
  for (const candidate of selectedCandidates) {
    if (candidate.readiness.status !== "verified_runnable") return {
      ok: false,
      code: "POLICY_NOT_RUNNABLE",
      message: candidate.readiness.reason || `${candidate.display_name} is not runnable.`,
      details: { candidate_id: candidate.candidate_id },
    };
    const compatibility = candidate.compatibility;
    const compatible = compatibility.robot_preset_ids.includes(robot.robot_preset_id)
      && compatibility.embodiment_ids.includes(robot.embodiment_id)
      && compatibility.observation_schema_ids.includes(robot.observation_schema.schema_id)
      && compatibility.action_schema_ids.includes(robot.action_schema.schema_id)
      && compatibility.simulator_runtime_ids.includes(robot.simulator_runtime_id)
      && compatibility.task_family_ids.includes(robot.task_family_id);
    if (!compatible) return {
      ok: false,
      code: "POLICY_INCOMPATIBLE",
      message: `${candidate.display_name} is not compatible with ${robot.display_name}.`,
      details: {
        candidate_id: candidate.candidate_id,
        robot_preset_id: robot.robot_preset_id,
        embodiment_id: robot.embodiment_id,
        observation_schema_id: robot.observation_schema.schema_id,
        action_schema_id: robot.action_schema.schema_id,
        simulator_runtime_id: robot.simulator_runtime_id,
        task_family_id: robot.task_family_id,
      },
    };
  }
  const preset = setup.episode_presets.find(
    (candidate) => candidate.preset_id === selection.episode_preset_id,
  );
  if (!preset || preset.availability !== "enabled") return {
    ok: false,
    code: "EPISODE_PRESET_UNAVAILABLE",
    message: "The selected episode preset is not available.",
  };
  if (preset.matrix.matrix_digest !== selection.variation_matrix_digest) return {
    ok: false,
    code: "VARIATION_MATRIX_CHANGED",
    message: "The deterministic variation matrix changed. Review the cells and seeds again.",
  };
  if (
    selection.authorization.maximum_cost_usd !== preset.estimate.maximum_authorized_cost_usd
    || selection.authorization.hard_ttl_seconds !== preset.estimate.hard_ttl_seconds
  ) return {
    ok: false,
    code: "POLICY_CANARY_AUTHORITY_MISMATCH",
    message: "The cost ceiling or runtime authority does not match the published Quick plan.",
  };
  return {
    ok: true,
    robot,
    candidates: [...selectedCandidates],
    preset,
  };
}

export function buildInternalPolicyCanaryLaunchRequest(params: {
  selection: InternalPolicyCanarySelection;
  setup: InternalPolicyCanarySetup;
  profile: Record<string, any>;
  actor: { id: string; role: "admin" | "ops" | "team_member" };
  teamNamespace: string;
  controlsStatusAtSubmission: "configured_controls_pending" | "evaluation_ready";
  authorizedAt: string;
}) {
  const resolved = resolveInternalPolicyCanarySelection(
    params.setup,
    params.selection,
    {
      siteId: String(params.setup.task_success_contract?.scope.site_id || ""),
      taskId: String(params.setup.task_success_contract?.scope.task_id || ""),
      teamId: params.teamNamespace,
    },
  );
  if (!resolved.ok) throw new Error(resolved.code);
  const cells = resolved.preset.matrix.cells;
  const interpretationIdentity = {
    interpreter_id: "openai_multimodal_episode_interpreter_v1",
    principal_kind: "independent_interpreter",
    provider_id: "openai",
    execution_site: "external_provider",
    runtime: "openai_agents_sdk",
    model: "gpt-5.6-luna",
    model_version: "gpt-5.6-luna",
  };
  const sourceRightsAdmission: Record<string, unknown> = {
    schema_version: "policy_canary_episode_interpretation_source_rights_admission.v1",
    run_id: params.selection.run_id,
    team_namespace: params.teamNamespace,
    accepted_by: params.actor.id,
    accepted_on: params.authorizedAt,
    external_disclosure_authorized: true,
    disclosed_artifact_roles: [
      "contact_force_trace",
      "deterministic_score",
      "frame_manifest",
      "lossless_frame",
      "review_video",
      "state_trace",
      "task_success_contract",
    ],
    provider_training_authorized: false,
    public_redistribution_authorized: false,
    admission_digest: "",
  };
  sourceRightsAdmission.admission_digest = canonicalArtifactDigest(
    sourceRightsAdmission,
    "admission_digest",
  );
  const interpretationAuthority: Record<string, unknown> = {
    schema_version: "policy_canary_episode_interpretation_batch_authority.v1",
    status: "approved",
    run_id: params.selection.run_id,
    interpreter: interpretationIdentity,
    interpreter_profile_digest: "sha256:eca3944e331b60cc08fdb1548d753be7c1b513b7b703ad5fce8401b09eb83baf",
    allowed_artifact_roles: sourceRightsAdmission.disclosed_artifact_roles,
    external_disclosure_authorized: true,
    provider_training_authorized: false,
    public_redistribution_authorized: false,
    maximum_cost_usd: params.selection.episode_interpretation.maximum_cost_usd,
    source_rights_admission_digest: sourceRightsAdmission.admission_digest,
    accepted_by: params.actor.id,
    accepted_on: params.authorizedAt,
    authority_reference: `website:${params.selection.run_id}`,
    authority_digest: "",
  };
  interpretationAuthority.authority_digest = canonicalArtifactDigest(
    interpretationAuthority,
    "authority_digest",
  );
  const request: Record<string, unknown> = {
    schema_version: "task_evaluation_launch_request.v1",
    launch_id: params.selection.run_id,
    run_id: params.selection.run_id,
    source_launch_id: params.setup.source_launch_id,
    offering_digest: params.selection.offering_digest,
    setup_digest: params.selection.setup_digest,
    preset_id: params.selection.episode_preset_id,
    run_kind: INTERNAL_POLICY_CANARY_RUN_KIND,
    claim_ceiling: INTERNAL_POLICY_CANARY_CLAIM_CEILING,
    launch_profile_id: params.profile.profile_id,
    launch_profile_digest: params.profile.profile_digest,
    source_bundle: params.profile.source_bundle,
    evaluation_run_spec: params.profile.evaluation_run_spec,
    scene_revision_digest: params.selection.scene_revision_digest,
    scene_controls_status_at_submission: params.controlsStatusAtSubmission,
    task_success_contract: params.selection.task_success_contract,
    task_success_contract_digest: params.selection.task_success_contract.contract_digest,
    episode_interpretation_source_rights_admission: sourceRightsAdmission,
    episode_interpretation_authority: interpretationAuthority,
    team_namespace: params.teamNamespace,
    robot_preset_id: resolved.robot.robot_preset_id,
    policy_candidate_ids: params.selection.policy_candidate_ids,
    episode_plan: {
      preset: resolved.preset.preset_id,
      episodes_per_policy: resolved.preset.episodes_per_policy,
      policy_count: 2,
      learned_policy_rollout_count: resolved.preset.episodes_per_policy * 2,
      variation_matrix_digest: resolved.preset.matrix.matrix_digest,
      resolved_cells: cells,
      resolved_seeds: cells.map((cell) => cell.seed),
      coverage_gaps: resolved.preset.matrix.coverage_gaps,
      diagnostic_control_rollouts: {
        zero_action_count: resolved.preset.episodes_per_policy,
        deterministic_scripted_positive_count: resolved.preset.episodes_per_policy,
        total_count: resolved.preset.episodes_per_policy * 2,
        blocking_for_policy_execution: false,
      },
    },
    notification: params.selection.notification,
    authorization: {
      actor: params.actor,
      authorized_at: params.authorizedAt,
      spend: {
        approved: true,
        currency: "USD",
        max_spend_usd: params.selection.authorization.maximum_cost_usd,
        hard_ttl_seconds: params.selection.authorization.hard_ttl_seconds,
      },
      execution: { approved: true },
    },
    required_controls: {
      ...params.profile.required_controls,
      maximum_provider_allocations: 1,
      retry_cap: 0,
    },
    idempotency_key: params.selection.run_id,
    controls_qualification_bypassed: false,
    scene_promotion_permitted: false,
    official_ranking_permitted: false,
  };
  if (params.profile.source_commit) request.source_commit = params.profile.source_commit;
  request.request_digest = canonicalArtifactDigest(request, "request_digest");
  return request;
}

export function policyCanaryError(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return { error: { code, message, details } };
}

function normalizedEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function policyCanaryNotificationRecipientOptions(params: {
  authenticatedEmail: string | null;
  isAdmin: boolean;
  isOps: boolean;
  configuredAllowlist?: string;
  approvedInternalEmail?: string;
}) {
  const recipients = new Set<string>();
  const authenticated = normalizedEmail(params.authenticatedEmail);
  if (authenticated) recipients.add(authenticated);
  if (params.isAdmin || params.isOps) {
    for (const entry of String(
      params.configuredAllowlist
        ?? process.env.BLUEPRINT_POLICY_CANARY_NOTIFICATION_EMAIL_ALLOWLIST
        ?? "",
    ).split(",")) {
      const email = normalizedEmail(entry);
      if (email) recipients.add(email);
    }
    const approved = normalizedEmail(
      params.approvedInternalEmail
        ?? process.env.BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL
        ?? "",
    );
    if (approved) recipients.add(approved);
  }
  return [...recipients].sort();
}

export function policyCanaryNotificationRecipientAllowed(params: {
  requestedEmail: string;
  authenticatedEmail: string | null;
  isAdmin: boolean;
  isOps: boolean;
  configuredAllowlist?: string;
  approvedInternalEmail?: string;
}) {
  return policyCanaryNotificationRecipientOptions(params).includes(
    normalizedEmail(params.requestedEmail),
  );
}
