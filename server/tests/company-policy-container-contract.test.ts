// @vitest-environment node
import {describe, expect, it} from "vitest";

import {
  COMPANY_POLICY_ACTION_ROUTE,
  COMPANY_POLICY_CONTAINER_CLAIM_CEILING,
  COMPANY_POLICY_CONTAINER_SCHEMA_VERSION,
  COMPANY_POLICY_SECURITY_PROFILE,
  normalizeCompanyPolicyContainerContract,
} from "../utils/companyPolicyContainerContract";

function contract() {
  return {
    schema_version: COMPANY_POLICY_CONTAINER_SCHEMA_VERSION,
    policy_id: "acme_widget_grasp_v3",
    company_id: "acme_robotics",
    display_name: "ACME Widget Grasp v3",
    checkpoint_identity: {
      repository: "registry.acme.example/models/widget-grasp",
      revision: "2026.08.1",
      inventory_digest: `sha256:${"a".repeat(64)}`,
    },
    claim_ceiling: COMPANY_POLICY_CONTAINER_CLAIM_CEILING,
    rights: {
      license: "ACME evaluation license 2026-08",
      rights_provenance: "acme_msa_2026_07_appendix_b",
      rights_evidence_uri: "blueprint-rights://acme/widget-grasp/2026-08",
      rights_evidence_digest: `sha256:${"b".repeat(64)}`,
      provider_use_status: "permitted_for_this_evaluation",
      redistribution_status: "weights_remain_in_company_container",
      rights_ready: true as const,
    },
    container: {
      image: `registry.acme.example/widget-grasp@sha256:${"c".repeat(64)}`,
      visibility: "private" as const,
      serve_command: ["python", "-m", "acme_policy.serve", "--port", "8600"],
      port: 8600,
      handshake: {
        kind: "http_json_v1" as const,
        protocol_version: "1.0" as const,
        action_route: COMPANY_POLICY_ACTION_ROUTE,
      },
      run_as_uid: 65532,
      run_as_gid: 65532,
      gpu_required: true,
      resources: {
        cpus: 8,
        memory_mib: 32768,
        pids_limit: 512,
        tmpfs_mib: 2048,
        startup_timeout_seconds: 300,
        request_timeout_ms: 2500,
      },
    },
    robot: {
      embodiment_id: "franka_panda_robotiq_2f85_v1",
      definition_uri: "blueprint-robot://franka-panda-robotiq-2f85/v1",
      definition_digest: `sha256:${"d".repeat(64)}`,
      joint_names: Array.from({length: 7}, (_, index) => `panda_joint${index + 1}`),
      joint_limits: Array.from({length: 7}, (_, index) => ({
        name: `panda_joint${index + 1}`,
        lower: -2,
        upper: 2,
        unit: "radian",
      })),
      gripper: {
        name: "gripper",
        command_interval: [0, 1] as [number, number],
        unit: "normalized_fraction",
        executed_semantics: "clip_then_map_to_parallel_jaw_width",
      },
    },
    observation_schema: {
      cameras: [
        {
          name: "external_rgb",
          width: 320,
          height: 180,
          color_space: "rgb" as const,
          dtype: "uint8" as const,
          layout: "hwc" as const,
          encoding: "lossless_png" as const,
          calibration_uri: "blueprint-calibration://scene/external/v1",
          calibration_digest: `sha256:${"e".repeat(64)}`,
        },
        {
          name: "wrist_rgb",
          width: 320,
          height: 180,
          color_space: "rgb" as const,
          dtype: "uint8" as const,
          layout: "hwc" as const,
          encoding: "lossless_png" as const,
          calibration_uri: "blueprint-calibration://scene/wrist/v1",
          calibration_digest: `sha256:${"f".repeat(64)}`,
        },
      ],
      state_fields: [
        {name: "joint_position", shape: [7], dtype: "float32" as const, unit: "radian"},
        {
          name: "gripper_position",
          shape: [1],
          dtype: "float32" as const,
          unit: "normalized_fraction",
        },
      ],
      prompt: {mode: "text" as const, required: true as const},
      control_frequency_hz: 15,
    },
    action_schema: {
      adapter_id: "absolute_joint_position_gripper_v1",
      chunk_rows: 15,
      channels: [
        ...Array.from({length: 7}, (_, index) => ({
          name: `panda_joint${index + 1}`,
          kind: "bounded_continuous" as const,
          command_interval: [-2, 2] as [number, number],
          raw_accepted_bounds: [-2, 2] as [number, number],
          unit: "radian",
          executed_semantics: "absolute_joint_position",
        })),
        {
          name: "gripper",
          kind: "threshold_scalar" as const,
          command_interval: [0, 1] as [number, number],
          raw_accepted_bounds: [-0.25, 1.25] as [number, number],
          unit: "normalized_fraction",
          executed_semantics: "clip_then_map_to_parallel_jaw_width",
        },
      ],
      normalization: {
        observation: "none",
        action: "none",
        gripper: "raw_envelope_then_clip_to_command_interval",
      },
    },
  };
}

function expectInvalid(value: unknown, fragment: string) {
  const result = normalizeCompanyPolicyContainerContract(value);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join("\n")).toContain(fragment);
}

describe("company policy container contract v2", () => {
  it("matches the exact Pipeline RFC 8785 digest vector", () => {
    const result = normalizeCompanyPolicyContainerContract(contract());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.security_profile).toEqual(COMPANY_POLICY_SECURITY_PROFILE);
    expect(result.contract.contract_digest).toBe(
      "sha256:1337317266b54bade7e6b78511f8da522db8aa284d71425e8cd744035cde10d3",
    );
    expect(normalizeCompanyPolicyContainerContract(result.contract)).toEqual(result);
  });

  it("refuses tags, secrets, mounts, environment, and caller-selected networking", () => {
    const tagged = contract();
    tagged.container.image = "registry.acme.example/widget-grasp:latest";
    expectInvalid(tagged, "container.image:invalid_string");

    for (const [field, value] of [
      ["registry_token", "secret"],
      ["credential_files", ["token"]],
      ["mounts", ["/scene"]],
      ["environment", {TOKEN: "secret"}],
      ["network_mode", "host"],
    ] as const) {
      const candidate = contract() as ReturnType<typeof contract> & Record<string, unknown>;
      (candidate.container as Record<string, unknown>)[field] = value;
      expectInvalid(candidate, "container:unrecognized_keys");
    }
  });

  it("refuses security weakening and digest tampering", () => {
    const weakened = {
      ...contract(),
      security_profile: {...COMPANY_POLICY_SECURITY_PROFILE, network_mode: "host"},
    };
    expectInvalid(weakened, "security_profile.network_mode:invalid_literal");

    const normalized = normalizeCompanyPolicyContainerContract(contract());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expectInvalid({...normalized.contract, contract_digest: `sha256:${"0".repeat(64)}`}, "mismatch");
  });

  it("refuses mismatched embodiment ordering and unsafe action envelopes", () => {
    const wrongOrder = contract();
    wrongOrder.robot.joint_limits[0].name = "panda_joint2";
    expectInvalid(wrongOrder, "joint_order_mismatch");

    const narrow = contract();
    narrow.action_schema.channels[7].raw_accepted_bounds = [0.1, 0.9];
    expectInvalid(narrow, "raw_bounds_narrower_than_command");
  });
});
