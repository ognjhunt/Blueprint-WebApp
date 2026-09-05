import type { User as FirebaseUser } from "firebase/auth";
import { z } from "zod";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  policyCanaryRunProjectionSchema,
  type PolicyCanaryRunProjection,
} from "@/lib/policyCanaryRuns";

export const FRANKA_DROID_EMBODIMENT_ID = "franka_panda_robotiq_2f85_v1" as const;
export const POLICY_RUN_CANDIDATE_IDS = ["pi05_droid", "groot_n17_droid"] as const;
export const POLICY_RUN_MATRIX_PROFILE_ID = "franka_rigid_relocation_nested_v1" as const;
export const POLICY_RUN_PRESET_IDS = ["quick_10", "standard_100", "deep_500"] as const;
export const POLICY_RUN_VARIATION_FAMILIES = [
  "canonical_anchor",
  "placement_approach",
  "illumination",
  "camera_sensor",
  "bounded_physics",
  "pairwise",
  "held_out",
] as const;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const variationFamily = z.enum(POLICY_RUN_VARIATION_FAMILIES);
const boundedMetric = z.object({
  attempts: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
}).strict();

export const evaluationReadyResultSummarySchema = z.object({
  canonical: z.record(z.enum(POLICY_RUN_CANDIDATE_IDS), boundedMetric),
  per_family: z.record(
    variationFamily,
    z.record(z.enum(POLICY_RUN_CANDIDATE_IDS), boundedMetric),
  ),
  paired: z.object({
    comparable_pairs: z.number().int().nonnegative(),
    discordant_pairs: z.number().int().nonnegative(),
    summary: z.string().trim().min(1).max(1_000),
  }).strict(),
  degradation: z.array(z.object({
    candidate_id: z.enum(POLICY_RUN_CANDIDATE_IDS),
    family: variationFamily,
    delta_from_canonical: z.number().min(-1).max(1),
  }).strict()),
  failures: z.array(z.object({
    candidate_id: z.enum(POLICY_RUN_CANDIDATE_IDS),
    family: variationFamily,
    count: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
  }).strict()),
  contacts: z.object({
    event_count: z.number().int().nonnegative(),
    summary: z.string().trim().min(1).max(1_000),
  }).strict(),
  evidence_completeness: z.object({
    complete_episode_count: z.number().int().nonnegative(),
    invalid_episode_count: z.number().int().nonnegative(),
    all_policy_inputs_retained: z.boolean(),
    all_frame_manifests_retained: z.boolean(),
    all_review_videos_retained: z.boolean(),
  }).strict(),
}).strict();

const policyFamilyMetric = z.object({
  attempted: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
  degradation_from_canonical: z.number().min(-1).max(1),
}).strict();

const policyCandidateResultBase = z.object({
  episodes_completed: z.number().int().min(0).max(500),
  family_metrics: z.record(variationFamily, policyFamilyMetric),
  failures: z.array(z.object({ code: identifier, count: z.number().int().positive() }).strict()).max(500),
  contacts: z.object({
    contact_count: z.number().int().nonnegative(),
    violation_count: z.number().int().nonnegative(),
  }).strict(),
  evidence: z.object({
    lossless_frame_manifest_count: z.number().int().nonnegative(),
    review_video_count: z.number().int().nonnegative(),
    typed_media_gap_count: z.number().int().nonnegative(),
  }).strict(),
});

export const policyRunResultProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_result_projection.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  configuration_digest: digest,
  plan_digest: digest,
  embodiment_id: z.literal(FRANKA_DROID_EMBODIMENT_ID),
  candidate_ids: z.tuple([
    z.literal(POLICY_RUN_CANDIDATE_IDS[0]),
    z.literal(POLICY_RUN_CANDIDATE_IDS[1]),
  ]),
  state: z.enum(["decided", "partially_decided", "abstained"]),
  matrix: z.object({
    scored_cell_count: z.union([z.literal(10), z.literal(100), z.literal(500)]),
    candidate_episode_count: z.number().int().min(20).max(1_000),
    control_episode_count: z.number().int().min(20).max(1_000),
    expected_episode_count: z.number().int().min(40).max(2_000),
    completed_episode_count: z.number().int().min(0).max(2_000),
    identical_candidate_cells_and_seeds: z.literal(true),
    controls_complete: z.boolean(),
  }).strict(),
  candidate_results: z.tuple([
    policyCandidateResultBase.extend({ candidate_id: z.literal(POLICY_RUN_CANDIDATE_IDS[0]) }).strict(),
    policyCandidateResultBase.extend({ candidate_id: z.literal(POLICY_RUN_CANDIDATE_IDS[1]) }).strict(),
  ]),
  paired_comparison: z.object({
    matched_episode_pairs: z.number().int().min(0).max(500),
    decision: z.enum(["pi05_droid", "groot_n17_droid", "tie", "abstain"]),
    deterministic_non_policy_scoring: z.literal(true),
  }).strict(),
  result_delivery_digest: digest,
  blockers: z.array(z.string().trim().min(1).max(512)).max(128),
  proof_boundary: z.object({
    simulation_is_physical_success: z.literal(false),
    review_video_is_authoritative_evidence: z.literal(false),
    policy_can_grade_itself: z.literal(false),
    cross_team_leaderboard_authorized: z.literal(false),
  }).strict(),
  projection_digest: digest,
}).strict();

const runState = z.enum([
  "queued_for_preparation",
  "preparing",
  "ready_to_activate",
  "queued",
  "running",
  "aggregating",
  "results_ready",
  "abstained",
  "blocked",
  "failed",
]);

export const evaluationReadyRunProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_projection.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  configuration_digest: digest,
  state: runState,
  terminal: z.boolean(),
  phase: z.string().nullable(),
  progress: z.object({
    completed_episodes: z.number().int().nonnegative(),
    total_episodes: z.number().int().nonnegative(),
  }).strict().nullable(),
  episode_counts: z.object({
    learned_episode_count: z.number().int().nonnegative(),
    control_episode_count: z.number().int().nonnegative(),
    total_episode_count: z.number().int().positive(),
  }).strict().nullable(),
  result: z.object({
    record_id: identifier,
    href: z.string().regex(/^\/app\/results\/[A-Za-z0-9%._:-]+$/),
    api_href: z.string().regex(/^\/api\/task-evaluation-results\/[A-Za-z0-9%._:-]+$/),
  }).strict().nullable(),
  result_summary: evaluationReadyResultSummarySchema.nullable(),
  policy_run_result: policyRunResultProjectionSchema.nullable().optional(),
  error: z.object({ code: z.string(), message: z.string() }).strict().nullable(),
  created_at_iso: z.string(),
  updated_at_iso: z.string(),
  proof_boundary: z.object({
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    cross_team_leaderboard_authorized: z.literal(false),
  }).strict(),
}).strict();

const estimateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unavailable") }).strict(),
  z.object({
    status: z.literal("estimated"),
    duration_minutes: z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative() }).strict(),
    cost_usd: z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative() }).strict(),
    basis_digest: digest,
    as_of: z.string().datetime({ offset: true }),
  }).strict(),
]);

const familyCountsSchema = z.object({
  canonical_anchor: z.number().int().nonnegative(),
  placement_approach: z.number().int().nonnegative(),
  illumination: z.number().int().nonnegative(),
  camera_sensor: z.number().int().nonnegative(),
  bounded_physics: z.number().int().nonnegative(),
  pairwise: z.number().int().nonnegative(),
  held_out: z.number().int().nonnegative(),
}).strict();

function presetSchema<PresetId extends typeof POLICY_RUN_PRESET_IDS[number], ScenarioCount extends 10 | 100 | 500>(
  presetId: PresetId,
  label: "Quick" | "Standard" | "Deep",
  scenarioCount: ScenarioCount,
  availability: "enabled" | "coming_later",
  isDefault: boolean,
  parentPresetId: typeof POLICY_RUN_PRESET_IDS[number] | null,
  parentPrefixCount: 0 | 10 | 100,
) {
  return z.object({
    preset_id: z.literal(presetId),
    label: z.literal(label),
    scenario_count_per_policy: z.literal(scenarioCount),
    availability: z.literal(availability),
    default: z.literal(isDefault),
    family_counts: familyCountsSchema,
    scenario_set_digest: digest,
    parent_preset_id: parentPresetId === null ? z.null() : z.literal(parentPresetId),
    parent_scenario_set_digest: parentPresetId === null ? z.null() : digest,
    parent_prefix_count: z.literal(parentPrefixCount),
    nesting_proof_digest: digest,
    estimate: estimateSchema,
    episode_counts: z.object({
      learned_episode_count: z.literal(scenarioCount * 2),
      control_episode_count: z.literal(scenarioCount * 2),
      total_episode_count: z.literal(scenarioCount * 4),
    }).strict(),
  }).strict().superRefine((preset, context) => {
    const familyTotal = Object.values(preset.family_counts).reduce((total, count) => total + count, 0);
    if (familyTotal !== scenarioCount) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["family_counts"],
      message: "family counts must equal scenario_count_per_policy",
    });
  });
}

const evaluationReadySetupProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_setup_projection.v1"),
  source_launch_id: identifier,
  offering_digest: digest,
  offering_status: z.literal("evaluation_ready"),
  setup_digest: digest,
  offering: z.object({
    scene_id: z.string().trim().min(1),
    scene_version: z.string().trim().min(1),
    task_id: z.string().trim().min(1),
    task_version: z.string().trim().min(1),
    task_kind: z.string().trim().min(1),
    task_strategy: z.string().trim().min(1),
  }).strict(),
  launch_profile: z.object({ profile_id: identifier, profile_digest: digest }).strict(),
  robot: z.object({
    embodiment_id: z.literal(FRANKA_DROID_EMBODIMENT_ID),
    label: z.literal("Franka + DROID"),
    locked: z.literal(true),
  }).strict(),
  policy_candidates: z.tuple([
    z.object({ candidate_id: z.literal(POLICY_RUN_CANDIDATE_IDS[0]), label: z.string(), locked: z.literal(true) }).strict(),
    z.object({ candidate_id: z.literal(POLICY_RUN_CANDIDATE_IDS[1]), label: z.string(), locked: z.literal(true) }).strict(),
  ]),
  matrix: z.object({
    profile_id: z.literal(POLICY_RUN_MATRIX_PROFILE_ID),
    preregistration_digest: digest,
    compiler: z.object({
      compiler_id: z.literal("franka_rigid_relocation_nested_prefix"),
      compiler_version: z.literal("v1"),
      selection_rule: z.literal("published_ordered_prefix"),
      outcome_independent: z.literal(true),
      agent_may_select_cells: z.literal(false),
      inventory_seed_digest: digest,
      coverage_recipe_digest: digest,
      cell_seed_rule: z.literal("sha256_inventory_seed_digest_nul_cell_id"),
    }).strict(),
    presets: z.tuple([
      presetSchema("quick_10", "Quick", 10, "enabled", true, null, 0),
      presetSchema("standard_100", "Standard", 100, "coming_later", false, "quick_10", 10),
      presetSchema("deep_500", "Deep", 500, "coming_later", false, "standard_100", 100),
    ]),
  }).strict(),
  notification: z.object({
    email_when_ready: z.literal(true),
    recipient: z.literal("authenticated_account"),
    recipient_email: z.string().email().nullable(),
  }).strict(),
  proof_boundary: z.object({
    setup_is_execution: z.literal(false),
    provider_mutation_performed: z.literal(false),
    paid_execution_requested: z.literal(false),
    simulation_is_physical_success: z.literal(false),
  }).strict(),
}).strict().superRefine((setup, context) => {
  const [quick, standard, deep] = setup.matrix.presets;
  if (
    standard.parent_scenario_set_digest !== quick.scenario_set_digest
    || deep.parent_scenario_set_digest !== standard.scenario_set_digest
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["matrix", "presets"],
    message: "parent scenario-set digests must bind the nested preset chain",
  });
});

export type EvaluationReadyRunProjection = z.infer<typeof evaluationReadyRunProjectionSchema>;

export type EvaluationReadySetupView = {
  sourceLaunchId: string;
  offeringDigest: string;
  setupDigest: string;
  sceneLabel: string;
  taskLabel: string;
  embodimentId: typeof FRANKA_DROID_EMBODIMENT_ID;
  candidateIds: [typeof POLICY_RUN_CANDIDATE_IDS[0], typeof POLICY_RUN_CANDIDATE_IDS[1]];
  matrixProfileId: typeof POLICY_RUN_MATRIX_PROFILE_ID;
  defaultPresetId: typeof POLICY_RUN_PRESET_IDS[number];
  presets: Array<{
    presetId: typeof POLICY_RUN_PRESET_IDS[number];
    label: string;
    scenarioCountPerPolicy: 10 | 100 | 500;
    availability: "available" | "coming_later";
    recommended: boolean;
    familyCoverage: Array<{
      family: typeof POLICY_RUN_VARIATION_FAMILIES[number];
      scenarioCount: number;
    }>;
    episodeCounts: {
      learnedEpisodeCount: number;
      controlEpisodeCount: number;
      totalEpisodeCount: number;
    };
    estimate:
      | {
          status: "estimated";
          durationMinutes: { minimum: number; maximum: number };
          costUsd: { minimum: number; maximum: number };
          basisDigest: string;
          asOf: string;
        }
      | { status: "unavailable" };
  }>;
  notificationRecipient: string | null;
};

export type EvaluationReadyRunInput = {
  schema_version: "task_evaluation_policy_run_selection.v1";
  run_id: string;
  offering_digest: string;
  preset_id: typeof POLICY_RUN_PRESET_IDS[number];
};

export function buildEvaluationReadyRunInput(params: {
  runId: string;
  offeringDigest: string;
  presetId: typeof POLICY_RUN_PRESET_IDS[number];
}): EvaluationReadyRunInput {
  if (!identifier.safeParse(params.runId).success) throw new Error("Run ID is invalid");
  if (!digest.safeParse(params.offeringDigest).success) throw new Error("Offering digest is invalid");
  if (!POLICY_RUN_PRESET_IDS.includes(params.presetId)) throw new Error("Evaluation preset is invalid");
  return {
    schema_version: "task_evaluation_policy_run_selection.v1",
    run_id: params.runId,
    offering_digest: params.offeringDigest,
    preset_id: params.presetId,
  };
}

export async function createEvaluationReadyRun(params: {
  currentUser: FirebaseUser;
  sourceLaunchId: string;
  input: EvaluationReadyRunInput;
}) {
  const headers = await withFirebaseAuthHeaders(
    params.currentUser,
    await withCsrfHeader({
      "Content-Type": "application/json",
      "Idempotency-Key": params.input.run_id,
    }),
  );
  const response = await fetch(
    `/api/configured-scene-offerings/${encodeURIComponent(params.sourceLaunchId)}/evaluation-runs`,
    { method: "POST", credentials: "include", headers, body: JSON.stringify(params.input) },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.code || `Evaluation setup failed (${response.status})`);
  const parsed = z.object({
    schema_version: z.literal("task_evaluation_policy_run_web_receipt.v1"),
    run: evaluationReadyRunProjectionSchema,
  }).passthrough().safeParse(payload);
  if (!parsed.success) throw new Error("Evaluation run receipt did not match the Website contract");
  return parsed.data;
}

export async function fetchEvaluationReadySetup(
  currentUser: FirebaseUser,
  sourceLaunchId: string,
): Promise<EvaluationReadySetupView> {
  const response = await fetch(
    `/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/evaluation-setup`,
    { credentials: "include", headers: await withFirebaseAuthHeaders(currentUser) },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.code || `Evaluation setup is unavailable (${response.status})`);
  const parsed = evaluationReadySetupProjectionSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Evaluation setup did not match the Website contract");
  const setup = parsed.data;
  return {
    sourceLaunchId: setup.source_launch_id,
    offeringDigest: setup.offering_digest,
    setupDigest: setup.setup_digest,
    sceneLabel: `${setup.offering.scene_id} · ${setup.offering.scene_version}`,
    taskLabel: `${setup.offering.task_id} · ${setup.offering.task_strategy.replaceAll("_", " ")}`,
    embodimentId: setup.robot.embodiment_id,
    candidateIds: [
      setup.policy_candidates[0].candidate_id,
      setup.policy_candidates[1].candidate_id,
    ],
    matrixProfileId: setup.matrix.profile_id,
    defaultPresetId: setup.matrix.presets.find((preset) => preset.default)?.preset_id
      ?? "quick_10",
    presets: setup.matrix.presets.map((preset) => ({
      presetId: preset.preset_id,
      label: preset.preset_id === "quick_10" ? "Quick test" : preset.label,
      scenarioCountPerPolicy: preset.scenario_count_per_policy,
      availability: preset.availability === "enabled" ? "available" as const : "coming_later" as const,
      recommended: preset.default,
      familyCoverage: POLICY_RUN_VARIATION_FAMILIES.map((family) => ({
        family,
        scenarioCount: preset.family_counts[family],
      })),
      episodeCounts: {
        learnedEpisodeCount: preset.episode_counts.learned_episode_count,
        controlEpisodeCount: preset.episode_counts.control_episode_count,
        totalEpisodeCount: preset.episode_counts.total_episode_count,
      },
      estimate: preset.estimate.status === "estimated" ? {
        status: "estimated" as const,
        durationMinutes: preset.estimate.duration_minutes,
        costUsd: preset.estimate.cost_usd,
        basisDigest: preset.estimate.basis_digest,
        asOf: preset.estimate.as_of,
      } : { status: "unavailable" as const },
    })),
    notificationRecipient: setup.notification.recipient_email,
  };
}

export async function fetchEvaluationReadyRun(
  currentUser: FirebaseUser,
  runId: string,
): Promise<EvaluationReadyRunProjection | PolicyCanaryRunProjection | null> {
  const response = await fetch(
    `/api/task-evaluation-runs/${encodeURIComponent(runId)}/status`,
    { credentials: "include", headers: await withFirebaseAuthHeaders(currentUser) },
  );
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Evaluation run status is unavailable (${response.status})`);
  const payload = await response.json();
  if (payload?.run_kind === "internal_policy_canary") {
    const canary = policyCanaryRunProjectionSchema.safeParse(payload);
    if (!canary.success) throw new Error("Policy canary status did not match the Website contract");
    return canary.data;
  }
  const parsed = evaluationReadyRunProjectionSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Evaluation run status did not match the Website contract");
  return parsed.data;
}
