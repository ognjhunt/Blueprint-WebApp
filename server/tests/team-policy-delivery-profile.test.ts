// @vitest-environment node
import { expect, it } from "vitest";

import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { makeTeamPolicyDeliveryProfile } from "../utils/teamPolicyDeliveryProfile";

const owner = { user_id: "team-member", organization_id: "team-1" };
const robot = {
  robot_preset_id: "unitree_g1_dex3_sonic_v1",
  embodiment_id: "unitree_g1_dex3_v1",
  observation_schema: { schema_id: "humanoidarena_head_rgb_state64_v1" },
  action_schema: { schema_id: "humanoidarena_semantic_v3" },
};
const setup = {
  setup_digest: `sha256:${"a".repeat(64)}`,
  scene_id: "interiorgs-841757",
  task_id: "scene-841757-book-to-marked-area",
  robot_presets: [robot],
};
const base = { setup_digest: setup.setup_digest, robot_preset_id: robot.robot_preset_id,
  label: "Team policy v1" };

it("binds endpoint, container, and noncontainer profiles to the same exact team and robot interface", () => {
  const deliveries = [
    { mode: "authenticated_endpoint", endpoint_url: "https://policy.example.com/v1/action",
      auth_secret_ref: "secretref:team-1/policy-v1", timeout_ms: 5000 },
    { mode: "container", image_ref: `registry.example.com/team/policy@sha256:${"b".repeat(64)}`,
      protocol: "jsonl_observation_action_v1" },
    { mode: "noncontainer_artifact", artifact_uri: "https://files.example.com/policy.tar.gz",
      artifact_sha256: `sha256:${"c".repeat(64)}`, entrypoint: "policy/run.py",
      protocol: "jsonl_observation_action_v1" },
  ];
  for (const delivery of deliveries) {
    const profile = makeTeamPolicyDeliveryProfile({ ...base, delivery }, setup, owner);
    expect(profile).toMatchObject({ owner, embodiment_id: robot.embodiment_id,
      observation_schema_id: robot.observation_schema.schema_id,
      action_schema_id: robot.action_schema.schema_id, status: "registered_for_runtime_review",
      claim_ceiling: "planning_only", provider_mutation_performed: false,
      public_redistribution_authorized: false });
    expect(crossRuntimeArtifactDigest(profile, "profile_digest")).toBe(profile.profile_digest);
  }
});

it("rejects changed setup, private or credential-bearing endpoint, unpinned image, and unsafe entrypoint", () => {
  const endpoint = { mode: "authenticated_endpoint", endpoint_url: "https://policy.example.com/v1/action",
    auth_secret_ref: "secretref:team-1/policy-v1", timeout_ms: 5000 };
  expect(() => makeTeamPolicyDeliveryProfile({ ...base, setup_digest: `sha256:${"f".repeat(64)}`,
    delivery: endpoint }, setup, owner)).toThrow("team_policy_delivery_setup_mismatch");
  for (const endpoint_url of ["http://policy.example.com", "https://127.0.0.1/action",
    "https://[::1]/action",
    "https://user:password@policy.example.com/action", "https://localhost/action"]) {
    expect(() => makeTeamPolicyDeliveryProfile({ ...base, delivery: { ...endpoint, endpoint_url } },
      setup, owner)).toThrow();
  }
  expect(() => makeTeamPolicyDeliveryProfile({ ...base,
    delivery: { mode: "container", image_ref: "registry.example.com/team/policy:latest",
      protocol: "jsonl_observation_action_v1" } }, setup, owner)).toThrow();
  expect(() => makeTeamPolicyDeliveryProfile({ ...base,
    delivery: { mode: "noncontainer_artifact", artifact_uri: "https://files.example.com/policy.tar.gz",
      artifact_sha256: `sha256:${"c".repeat(64)}`, entrypoint: "../run.sh",
      protocol: "jsonl_observation_action_v1" } }, setup, owner)).toThrow();
});
