import { z } from "zod";
import { robotEmbodimentSchema, type RobotEmbodiment } from "../../client/src/types/robotEmbodiment";
import { deploymentEmbodimentCatalog } from "../../client/src/lib/deploymentEmbodimentSupport";

/** ADP-011/day 7: integration intent is distinct from execution evidence. */
export const checkpointRuntimes = [
  "policy_endpoint", "container_image", "model_artifact",
  "customer_hosted", "controller_adapter", "skill_trace",
] as const;
const step = z.object({
  skill: z.string().trim().min(1).max(120),
  target: z.string().trim().max(200).optional(),
}).strict();
export const skillTraceSchema = z.object({
  schema_version: z.literal("blueprint.skill_trace.v1"),
  steps: z.array(step).min(1).max(128),
}).strict();
const pinnedImage = /^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/;

export function validateIntegrationReference(runtime: string, reference: string): boolean {
  if (runtime === "customer_hosted") {
    try {
      const url = new URL(reference);
      return url.protocol === "https:" && !url.username && !url.password && !url.hash;
    } catch { return false; }
  }
  if (runtime === "controller_adapter" || runtime === "container_image") {
    return pinnedImage.test(reference);
  }
  if (runtime === "skill_trace") {
    try { return skillTraceSchema.safeParse(JSON.parse(reference)).success; }
    catch { return false; }
  }
  return Boolean(reference.trim());
}

/**
 * Beta L5: a robot team's evaluation of one site job, run by the Pipeline on
 * the job's simulated scene and scored by the simulator against the job's
 * success contract: 200 cells the team has not seen, drawn from the job's
 * bounded variations. It is the only run a recommendation may rest on
 * (`runResultScoring.ts`). There is no practice run: the Pipeline runs the
 * first 25-cell shard alone and stops there when the policy fails at the
 * interface, so a broken endpoint costs one shard, not the evaluation.
 */
export const TEAM_EVALUATION_PROFILE = "team_evaluation_scored_v1";
export const TEAM_EVALUATION_EPISODES = 200;
/** How a run record and the Pipeline's result mark a team evaluation. */
export const TEAM_EVALUATION_PURPOSE = "scored";
export function isTeamEvaluationProfile(profile: unknown): boolean {
  return profile === TEAM_EVALUATION_PROFILE;
}
/** A policy for Blueprint's simulated DROID Franka (Robotiq 2F-85), served by the team over HTTPS. */
export const TEAM_CANDIDATE_HTTPS_INTERFACE = "openpi_droid_https.v1";
/** A policy for the team's own declared robot and cameras (`robotEmbodiment.ts`), served over HTTPS. */
export const TEAM_ROBOT_HTTPS_INTERFACE = "blueprint_policy_https.v1";

/** Whether a job's published execution offer lists the team evaluation. */
export function offersTeamEvaluation(job: unknown): boolean {
  const profiles = (job as { agent_execution_offer?: { policy_execution_profiles?: unknown } } | null | undefined)
    ?.agent_execution_offer?.policy_execution_profiles;
  return Array.isArray(profiles) && profiles.some(isTeamEvaluationProfile);
}

/**
 * The job's evaluation size: 200 when its offer lists the team evaluation,
 * else the offer's own episode count. Null when no offer is published.
 */
export function jobEvaluationEpisodes(job: unknown): number | null {
  if (offersTeamEvaluation(job)) return TEAM_EVALUATION_EPISODES;
  const count = (job as { agent_execution_offer?: { episode_count?: unknown } } | null | undefined)
    ?.agent_execution_offer?.episode_count;
  return Number.isInteger(count) && (count as number) > 0 ? count as number : null;
}

/** Why a policy cannot be a team evaluation's candidate. */
export type TeamPolicyBlocker =
  | "team_evaluation_policy_endpoint_required"
  | "team_evaluation_policy_https_required"
  | "team_evaluation_policy_credential_required"
  | "team_evaluation_policy_credential_expired"
  | "team_evaluation_robot_manifest_invalid"
  | "team_evaluation_robot_binding_mismatch"
  | "team_evaluation_robot_integration_required";

export const TEAM_POLICY_BLOCKER_MESSAGES: Record<TeamPolicyBlocker, string> = {
  team_evaluation_policy_endpoint_required:
    "This job's evaluation calls a hosted policy endpoint. Choose a setup delivered as a hosted endpoint.",
  team_evaluation_policy_https_required:
    "This job's evaluation calls your policy over HTTPS. Use an HTTPS endpoint URL without credentials in it.",
  team_evaluation_policy_credential_required:
    "No policy token is on file for this endpoint. Enter it under Settings → Robots & policies, then request again.",
  team_evaluation_policy_credential_expired:
    "The policy token on file for this endpoint has expired. Enter a new one under Settings → Robots & policies.",
  team_evaluation_robot_manifest_invalid: "The setup's robot manifest is not valid. Fix it under Settings → Robots & policies.",
  team_evaluation_robot_binding_mismatch: "The robot manifest must match the selected robot, its arm count and joints, with independent grippers for two arms.",
  team_evaluation_robot_integration_required: "This robot is a planning option. Bind its exact model, tools, cameras and policy interface to a validated robot manifest before requesting an evaluation.",
};

/** A named planning robot must never silently use the legacy DROID default. */
export function robotSetupIntegrationBlocker(setup: { robotDescription?: unknown; robotEmbodiment?: unknown }): TeamPolicyBlocker | null {
  const description = setup.robotDescription as { source?: unknown } | null | undefined;
  const parsed = robotEmbodimentSchema.safeParse(setup.robotEmbodiment);
  if ((description?.source === "support_option" || description?.source === "model") && !parsed.success)
    return "team_evaluation_robot_integration_required";
  if (description?.source === "support_option" && parsed.success) {
    const selected = setup.robotDescription as { embodimentId?: unknown };
    const robot = deploymentEmbodimentCatalog.embodiments.find(row => row.embodiment_id === selected.embodimentId);
    const manifest = parsed.data;
    if (!robot || manifest.embodiment_id !== robot.embodiment_id || manifest.base.mode !== "fixed"
      || manifest.form !== (robot.arm_count === 2 ? "bimanual_arm" : "fixed_base_arm")
      || (robot.arm_dof && manifest.joints.length !== robot.arm_dof.reduce((sum, count) => sum + count, 0))
      || (robot.arm_count === 2 && (manifest.schema_version !== "blueprint.robot_embodiment.v2" || manifest.grippers.length !== 2)))
      return "team_evaluation_robot_binding_mismatch";
  }
  return null;
}

/**
 * Null when this checkpoint can be a team evaluation's one candidate: an
 * HTTPS endpoint with a current bearer token on file. Otherwise the reason,
 * so nothing unauthenticated or non-HTTPS reaches the team's one attempt.
 */
export function teamPolicyBlocker(
  checkpoint: Record<string, any>,
  options: { robotEmbodiment?: unknown; robotDescription?: unknown } = {},
): TeamPolicyBlocker | null {
  const integration = robotSetupIntegrationBlocker(options);
  if (integration) return integration;
  if (!["policy_endpoint", "customer_hosted"].includes(checkpoint.runtime)) return "team_evaluation_policy_endpoint_required";
  if (!validateIntegrationReference("customer_hosted", String(checkpoint.reference || "").trim()))
    return "team_evaluation_policy_https_required";
  const credential = checkpoint.policyCredential;
  if (credential?.kind !== "bearer" || !credential?.ref) return "team_evaluation_policy_credential_required";
  if (Date.parse(credential.expiresAtIso) <= Date.now()) return "team_evaluation_policy_credential_expired";
  if (options.robotEmbodiment && !robotEmbodimentSchema.safeParse(options.robotEmbodiment).success)
    return "team_evaluation_robot_manifest_invalid";
  return null;
}

/**
 * A team's authenticated HTTPS policy as the one candidate of a team
 * evaluation. The same URL answers GET with the team's declared identity and
 * POST with actions; the Pipeline checks that identity before every episode.
 * With a declared robot the policy drives the team's own robot; without one, the
 * DROID Franka. Null whenever `teamPolicyBlocker` names a reason.
 */
export function teamCandidatePolicyPackage(
  checkpoint: Record<string, any>,
  options: { robotEmbodiment?: RobotEmbodiment | null } = {},
): Record<string, unknown> | null {
  if (teamPolicyBlocker(checkpoint, options)) return null;
  const reference = String(checkpoint.reference || "").trim();
  const embodiment = options.robotEmbodiment ? robotEmbodimentSchema.safeParse(options.robotEmbodiment) : null;
  if (embodiment && !embodiment.success) return null;
  return { policy_api_endpoint: {
    endpoint_url: reference, execution_profile: TEAM_EVALUATION_PROFILE,
    policy_interface_id: embodiment ? TEAM_ROBOT_HTTPS_INTERFACE : TEAM_CANDIDATE_HTTPS_INTERFACE,
    ...(embodiment ? { robot_embodiment: embodiment.data } : {}),
    credential_ref: checkpoint.policyCredential.ref, credential_kind: "bearer",
  } };
}

export function checkpointPolicyPackage(checkpoint: Record<string, any>): Record<string, unknown> | null {
  const reference = String(checkpoint.reference || "").trim();
  if (!reference) return null;
  const access = checkpoint.policyCredential ? { credential_ref: checkpoint.policyCredential.ref,
    credential_kind: checkpoint.policyCredential.kind } : {};
  if (checkpoint.runtime === "policy_endpoint") return { policy_api_endpoint: {
    endpoint_url: reference, ...access,
    ...(checkpoint.policyCredential ? { execution_profile: "controlled_observation_v1" } : {}),
  } };
  if (checkpoint.runtime === "container_image" && pinnedImage.test(reference)) return {
    docker_container: { image_ref: reference, execution_profile: "controlled_observation_v1", ...access },
  };
  if (checkpoint.runtime === "customer_hosted") return { policy_api_endpoint: {
    endpoint_url: reference, execution_profile: "controlled_observation_v1",
    observation_access: "approved_camera_frames_robot_state_and_instruction", ...access,
  } };
  if (checkpoint.runtime === "controller_adapter") return { sim_controller_plugin: {
    image_ref: reference, execution_profile: "controlled_observation_v1",
    transport: "isolated_container_http_json_v1", ...access,
  } };
  if (checkpoint.runtime === "model_artifact" && checkpoint.modelArtifact
    && checkpoint.modelArtifact.uri === reference
    && checkpoint.modelArtifact.interface?.runner_profile === "onnx_state_mlp_cpu_v1") {
    return { docker_container: { execution_profile: "controlled_observation_v1",
      runner_profile: "onnx_state_mlp_cpu_v1", model_artifact: checkpoint.modelArtifact } };
  }
  // A submitted trace describes intent. It cannot authorize a paid motor-action run.
  // Legacy artifact references without a server-owned upload record stay blocked.
  return null;
}
