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

export function checkpointPolicyPackage(checkpoint: Record<string, any>): Record<string, unknown> | null {
  const reference = String(checkpoint.reference || "").trim();
  if (!reference) return null;
  const access = checkpoint.policyCredential ? { credential_ref: checkpoint.policyCredential.ref,
    credential_kind: checkpoint.policyCredential.kind } : {};
  if (checkpoint.runtime === "policy_endpoint") return { policy_api_endpoint: { endpoint_url: reference, ...access } };
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
