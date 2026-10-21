// @vitest-environment node
import { describe, expect, it } from "vitest";
import { policyAdapterSchema, samePolicyAdapter } from "../../client/src/types/policyAdapter";
import { robotEmbodimentSchema, actionWidth } from "../../client/src/types/robotEmbodiment";
import { checkpointPolicyPackage, teamCandidatePolicyPackage, teamPolicyBlocker } from "../utils/policyIntegration";

import { dreamRobotFixture } from "./helpers/dream-robot";

const policyConfig = { policy_interface_id: "dreamlabs_dream1.v1", model_id: "dreamlabs/dream-1",
  camera_roles: { overhead: "overview", wrist_l: "left_wrist", wrist_r: "right_wrist" } };
const checkpoint = { runtime: "policy_endpoint", reference: "https://api.dreamlabs.ai/v1/get_action", policyConfig,
  policyCredential: { kind: "bearer", ref: "protected-reference", expiresAtIso: "2100-01-01T00:00:00Z" } };

describe("Dream execution adapter", () => {
  it("retains independent arms and tools through the saved manifest and canonical package", () => {
    const robotEmbodiment = dreamRobotFixture();
    expect(actionWidth(robotEmbodiment)).toBe(4);
    expect(teamPolicyBlocker(checkpoint, { robotEmbodiment })).toBeNull();
    const endpoint = teamCandidatePolicyPackage(checkpoint, { robotEmbodiment })!.policy_api_endpoint as Record<string, unknown>;
    expect(endpoint.policy_interface_id).toBe("dreamlabs_dream1.v1");
    expect(endpoint.policy_config).toEqual({ model_id: policyConfig.model_id, camera_roles: policyConfig.camera_roles });
    expect(endpoint.robot_embodiment).toEqual(robotEmbodiment);
    expect(JSON.stringify(endpoint)).not.toContain("bearer_token");
  });
  it.each(["robot", "rate", "arms", "camera", "endpoint", "token"])("refuses missing or mismatched %s before request creation", kind => {
    const manifest = dreamRobotFixture(), candidate = structuredClone(checkpoint);
    if (kind === "rate") manifest.control_hz = 30;
    if (kind === "arms") manifest.arms = undefined;
    if (kind === "camera") candidate.policyConfig.camera_roles.wrist_l = "unknown_camera";
    if (kind === "endpoint") candidate.reference = "https://unrelated.example/get_action";
    if (kind === "token") candidate.policyCredential.expiresAtIso = "2000-01-01T00:00:00Z";
    expect(teamCandidatePolicyPackage(candidate, { robotEmbodiment: kind === "robot" ? null : manifest })).toBeNull();
  });
  it("binds each checkpoint to an exact model and camera map even at the same URL", () => {
    expect(checkpointPolicyPackage(checkpoint)).toBeNull();
    expect(samePolicyAdapter(undefined, undefined)).toBe(true);
    expect(samePolicyAdapter(undefined, policyConfig)).toBe(false);
    expect(samePolicyAdapter(policyConfig, { ...policyConfig, model_id: "dreamlabs/dream-1-beta" })).toBe(false);
    expect(samePolicyAdapter(policyConfig, { ...policyConfig, camera_roles: { ...policyConfig.camera_roles, overhead: "other" } })).toBe(false);
    expect(samePolicyAdapter(policyConfig, policyConfig)).toBe(true);
    expect(policyAdapterSchema.safeParse({ ...policyConfig, api_key: "never-in-settings" }).success).toBe(false);
  });
  it("rejects overlapping arm groups and malformed TCP transforms", () => {
    const manifest = dreamRobotFixture();
    manifest.arms![1].joint_names = ["left_joint"];
    expect(robotEmbodimentSchema.safeParse(manifest).success).toBe(false);
    manifest.arms![1].joint_names = ["right_joint"];
    manifest.arms![1].tool_from_tcp.orientation_xyzw = [0, 0, 0, 0];
    expect(robotEmbodimentSchema.safeParse(manifest).success).toBe(false);
  });
});
