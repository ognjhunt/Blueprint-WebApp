// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkpointPolicyPackage, validateIntegrationReference } from "../utils/policyIntegration";

const image = `registry.example/robot/policy@sha256:${"a".repeat(64)}`;

describe("controlled policy checkpoint references", () => {
  it("admits only an immutable container and tags it for the controlled executor", () => {
    expect(validateIntegrationReference("container_image", image)).toBe(true);
    expect(validateIntegrationReference("container_image", "registry.example/robot/policy:latest")).toBe(false);
    expect(checkpointPolicyPackage({ runtime: "container_image", reference: image })).toEqual({
      docker_container: { image_ref: image, execution_profile: "controlled_observation_v1" },
    });
    expect(checkpointPolicyPackage({ runtime: "container_image", reference: "registry.example/robot/policy:latest" })).toBeNull();
  });

  it("keeps the controller on its versioned isolated transport", () => {
    expect(checkpointPolicyPackage({ runtime: "controller_adapter", reference: image })).toEqual({
      sim_controller_plugin: {
        image_ref: image, execution_profile: "controlled_observation_v1",
        transport: "isolated_container_http_json_v1",
      },
    });
  });
});
