import { z } from "zod";

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
 * Beta L5: the Pipeline's Quick-10 policy-canary runtime running ONE admitted
 * team candidate in place of its two frozen policies, for ten episodes the
 * simulator scores against the job's success contract. The only kind of run
 * whose result can back a recommendation (`runResultScoring.ts`).
 */
export const TEAM_CANDIDATE_QUICK10_PROFILE = "policy_canary_quick10_team_candidate_v1";
/** The pi0.5-DROID Franka (Robotiq 2F-85) contract, served by the team's own HTTPS service. */
export const TEAM_CANDIDATE_HTTPS_INTERFACE = "openpi_droid_https.v1";

/**
 * A team's authenticated HTTPS policy as the one candidate of a Quick-10 run.
 * The same URL answers GET with the team's declared identity and POST with
 * actions; the Pipeline checks that identity before every episode. Null for
 * anything else, so nothing unauthenticated or non-HTTPS is ever asked for.
 */
export function teamCandidatePolicyPackage(checkpoint: Record<string, any>): Record<string, unknown> | null {
  const reference = String(checkpoint.reference || "").trim();
  if (!["policy_endpoint", "customer_hosted"].includes(checkpoint.runtime)
    || checkpoint.policyCredential?.kind !== "bearer" || !checkpoint.policyCredential?.ref) return null;
  try {
    const url = new URL(reference);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
  } catch { return null; }
  return { policy_api_endpoint: {
    endpoint_url: reference, execution_profile: TEAM_CANDIDATE_QUICK10_PROFILE,
    policy_interface_id: TEAM_CANDIDATE_HTTPS_INTERFACE,
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
