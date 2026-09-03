import { z } from "zod";
import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  rigidTaskSuccessContractSchema,
  type RigidTaskSuccessContract,
} from "@/lib/rigidTaskSuccessContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const reference = z.object({ uri: z.string().min(1), digest }).passthrough();
const readiness = z.object({
  status: z.enum(["verified_runnable", "unavailable"]),
  receipt: reference.nullable(),
  reason: z.string().nullable(),
}).strict();

const candidate = z.object({
  candidate_id: z.string().min(1),
  display_name: z.string().min(1),
  checkpoint: reference,
  adapter_id: z.string().min(1),
  license_id: z.string().min(1),
  compatibility: z.object({
    robot_preset_ids: z.array(z.string()),
    embodiment_ids: z.array(z.string()),
    observation_schema_ids: z.array(z.string()),
    action_schema_ids: z.array(z.string()),
    simulator_runtime_ids: z.array(z.string()),
    task_family_ids: z.array(z.string()),
  }).strict(),
  readiness,
}).strict();

const robotPreset = z.object({
  robot_preset_id: z.string().min(1),
  display_name: z.string().min(1),
  embodiment_id: z.string().min(1),
  task_family_id: z.string().min(1),
  simulator_runtime_id: z.string().min(1),
  runtime_image: reference,
  observation_schema: z.object({
    schema_id: z.string().min(1),
    cameras: z.array(z.string()).min(1),
    modalities: z.array(z.string()).min(1),
  }).strict(),
  action_schema: z.object({
    schema_id: z.string().min(1),
    space: z.string().min(1),
    control_hz: z.number().positive(),
  }).strict(),
  readiness,
  policy_candidates: z.array(candidate).min(2),
}).strict();

const cell = z.object({
  cell_id: z.string().min(1),
  family: z.string().min(1),
  seed: z.number().int().nonnegative(),
  partition: z.enum(["canonical", "stress", "held_out"]),
  label: z.string().min(1),
  cell_digest: digest,
}).strict();

const episodePreset = z.object({
  preset_id: z.enum(["quick_10", "standard_100", "deep_500"]),
  label: z.enum(["Quick", "Standard", "Deep"]),
  episodes_per_policy: z.union([z.literal(10), z.literal(100), z.literal(500)]),
  availability: z.enum(["enabled", "coming_later"]),
  recommended: z.boolean(),
  matrix: z.object({
    matrix_digest: digest,
    resolver_id: z.string().min(1),
    resolver_version: z.string().min(1),
    deterministic: z.literal(true),
    cells: z.array(cell),
    expected_family_counts: z.record(z.string(), z.number().int().nonnegative()),
    coverage_gaps: z.array(z.object({
      family: z.string(),
      code: z.string(),
      explanation: z.string(),
      deterministic_fallback_family: z.string(),
    })),
  }).strict(),
  estimate: z.object({
    duration_minutes: z.object({ minimum: z.number(), maximum: z.number() }).strict(),
    maximum_authorized_cost_usd: z.number().positive(),
    hard_ttl_seconds: z.number().int().positive(),
    basis_digest: digest,
    as_of: z.string(),
  }).strict(),
}).strict();

export const policyCanarySetupViewSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_setup.v1"),
  source_launch_id: z.string().min(1),
  offering_digest: digest,
  scene_revision_digest: digest,
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  registry_digest: digest,
  robot_presets: z.array(robotPreset).min(1),
  episode_presets: z.array(episodePreset).length(3),
  diagnostics: z.object({
    zero_action: z.enum(["nonblocking", "not_configured"]),
    deterministic_scripted_positive: z.enum(["nonblocking", "not_configured"]),
  }).strict(),
  task_success_contract: rigidTaskSuccessContractSchema,
  task_success_contract_digest: digest,
  setup_digest: digest,
  offering: z.object({
    scene_id: z.string(),
    scene_version: z.string(),
    task_id: z.string(),
    task_version: z.string(),
    task_kind: z.string(),
    task_strategy: z.string(),
    controls_status: z.literal("configured_controls_pending"),
  }).strict(),
  notification_recipient_email: z.string().email().nullable(),
  notification_recipient_options: z.array(z.string().email()).min(1),
  task_success_contract_confirmation_team_id: z.string().trim().min(1),
  warning: z.literal("Controls pending — results are unqualified."),
  proof_boundary: z.object({
    controls_qualification_bypassed: z.literal(false),
    result_is_unqualified: z.literal(true),
    official_ranking_permitted: z.literal(false),
    scene_promotion_permitted: z.literal(false),
  }).strict(),
}).strict();

export type PolicyCanarySetupView = z.infer<typeof policyCanarySetupViewSchema>;
export type PolicyCanaryRobotPreset = z.infer<typeof robotPreset>;
export type PolicyCanaryCandidate = z.infer<typeof candidate>;
export type PolicyCanaryEpisodePreset = z.infer<typeof episodePreset>;

export const policyCanaryRunProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_projection.v1"),
  run_id: z.string().min(1),
  source_launch_id: z.string().min(1),
  offering_digest: digest,
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]).nullable(),
  scene_controls_status: z.literal("configured_controls_pending"),
  state: z.string().min(1),
  terminal: z.boolean(),
  stage: z.string().min(1),
  phase: z.string().nullable(),
  progress: z.object({ completed_episodes: z.number(), total_episodes: z.number() }).nullable(),
  episode_counts: z.object({
    learned_episode_count: z.number(),
    control_episode_count: z.number(),
    total_episode_count: z.number(),
  }).nullable(),
  completed_learned_episode_count: z.number(),
  expected_learned_episode_count: z.literal(20),
  completed_control_episode_count: z.number(),
  robot_preset_id: z.string().nullable(),
  policy_candidate_ids: z.array(z.string()).length(2),
  episode_plan: z.record(z.string(), z.unknown()).nullable(),
  notification_delivery: z.record(z.string(), z.unknown()).nullable(),
  result: z.object({ record_id: z.string(), href: z.string(), api_href: z.string() }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  warning: z.literal("Controls pending — results are unqualified."),
}).passthrough();

export type PolicyCanaryRunProjection = z.infer<typeof policyCanaryRunProjectionSchema>;

export type PolicyCanarySelection = {
  schema_version: "task_evaluation_policy_canary_selection.v1";
  run_kind: "internal_policy_canary";
  claim_ceiling: "diagnostic_policy_execution";
  run_id: string;
  offering_digest: string;
  setup_digest: string;
  scene_revision_digest: string;
  robot_preset_id: string;
  policy_candidate_ids: [string, string];
  episode_preset_id: "quick_10";
  variation_matrix_digest: string;
  task_success_contract: RigidTaskSuccessContract;
  notification: {
    email: string;
    notify_on: ["completed", "blocked", "cancelled"];
  };
  authorization: {
    maximum_cost_usd: number;
    hard_ttl_seconds: number;
    maximum_provider_allocations: 1;
    retry_cap: 0;
  };
  episode_interpretation: {
    enabled: true;
    external_disclosure_authorized: true;
    provider_training_authorized: false;
    public_redistribution_authorized: false;
    maximum_cost_usd: 1.5;
  };
  confirm_unqualified_execution: true;
};

async function payload(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>;
}

function apiError(data: Record<string, any>, fallback: string) {
  return String(data?.error?.message || data?.error || data?.code || fallback);
}

export async function fetchPolicyCanarySetup(
  currentUser: FirebaseUser,
  sourceLaunchId: string,
) {
  const response = await fetch(
    `/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/policy-canary-setup`,
    { credentials: "include", headers: await withFirebaseAuthHeaders(currentUser) },
  );
  const data = await payload(response);
  if (!response.ok) throw new Error(apiError(data, `Policy canary setup unavailable (${response.status})`));
  const parsed = policyCanarySetupViewSchema.safeParse(data);
  if (!parsed.success) throw new Error("Policy canary setup did not match the Website contract");
  return parsed.data;
}

export async function createPolicyCanaryRun(params: {
  currentUser: FirebaseUser;
  sourceLaunchId: string;
  input: PolicyCanarySelection;
}) {
  const response = await fetch(
    `/api/configured-scene-offerings/${encodeURIComponent(params.sourceLaunchId)}/policy-canary-runs`,
    {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        params.currentUser,
        await withCsrfHeader({
          "Content-Type": "application/json",
          "Idempotency-Key": params.input.run_id,
        }),
      ),
      body: JSON.stringify(params.input),
    },
  );
  const data = await payload(response);
  if (!response.ok) throw new Error(apiError(data, `Policy canary submission failed (${response.status})`));
  if (data.schema_version !== "task_evaluation_policy_canary_web_receipt.v1") {
    throw new Error("Policy canary receipt did not match the Website contract");
  }
  return data as { run: { run_id: string }; already_exists: boolean; status: string };
}

export async function fetchPolicyCanaryRun(
  currentUser: FirebaseUser,
  runId: string,
) {
  const response = await fetch(
    `/api/task-evaluation-runs/${encodeURIComponent(runId)}/status`,
    { credentials: "include", headers: await withFirebaseAuthHeaders(currentUser) },
  );
  if (response.status === 403 || response.status === 404) return null;
  const data = await payload(response);
  if (!response.ok) throw new Error(apiError(data, `Policy canary status unavailable (${response.status})`));
  if (
    data.run_kind !== "internal_policy_canary"
    || data.claim_ceiling !== "diagnostic_policy_execution"
  ) throw new Error("Run is not an internal policy canary");
  return data;
}
