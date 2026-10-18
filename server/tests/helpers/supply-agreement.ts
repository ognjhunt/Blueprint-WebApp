import { syntheticQualifiedAdmission } from "./recommendation-evidence";
/**
 * A complete, valid supply agreement for fixtures.
 *
 * Synthetic references only. A test team that should be recommendable needs
 * this on its registry row: `status: "engaged"` alone no longer makes a team
 * supply (see `server/utils/robotTeamSupply.ts`).
 */
import {
  SUPPLY_AGREEMENT_SCHEMA_VERSION,
  type RobotTeamSupplyAgreement,
  type SupplyAgreementEntry,
} from "../../types/robot-team-registry";
import { LEGACY_DROID_SUPPLY_INTERFACE_ID } from "../../utils/robotTeamSupply";
import { TEAM_CANDIDATE_HTTPS_INTERFACE, TEAM_EVALUATION_PROFILE } from "../../utils/policyIntegration";
import type { RobotEmbodiment } from "../../../client/src/types/robotEmbodiment";

export function syntheticAgreementEntry(overrides: Partial<SupplyAgreementEntry> = {}): SupplyAgreementEntry {
  return {
    agreedOn: "2026-10-10",
    evidenceRef: "signed-note:synthetic-fixture",
    recordedBy: "synthetic-reviewer",
    recordedAt: "2026-10-11T00:00:00.000Z",
    ...overrides,
  };
}

export function completeSupplyAgreement(supportedInterface: Partial<SupplyAgreementEntry> = {}): RobotTeamSupplyAgreement {
  return {
    schemaVersion: SUPPLY_AGREEMENT_SCHEMA_VERSION,
    terms: {
      supportedInterface: syntheticAgreementEntry({ interfaceId: LEGACY_DROID_SUPPLY_INTERFACE_ID, ...supportedInterface }),
      freeEvaluation: syntheticAgreementEntry(),
      pilotIfPassed: syntheticAgreementEntry(),
    },
    history: [],
  };
}

/** Shape-valid synthetic manifest, never an assertion of a working robot. */
export function syntheticRobotEmbodiment(form: "humanoid" | "wheeled_humanoid" | "mobile_manipulator" = "humanoid"): RobotEmbodiment {
  return {
    schema_version: "blueprint.robot_embodiment.v1", embodiment_id: `fixture-${form}`, form,
    model: { format: "usd", url: "https://models.fixture.example/robot.usd", sha256: `sha256:${"9".repeat(64)}` },
    base: { mode: "free", root_height_m: 0.9, fall_height_m: 0.45, footprint_half_extent_m: [0.3, 0.3], ground_contact_links: ["floor_link"] },
    joints: [{ name: "shoulder", control: "position", lower: -3, upper: 3, max_velocity: 2 }],
    gripper: null, tool_link: "wrist", reset_joint_positions: { shoulder: 0 }, actuator: { stiffness: 400, damping: 40 },
    cameras: [{ name: "wrist_rgb", mount_link: "wrist", position_m: [0, 0.05, 0.02], orientation_xyzw: [0, 0, 0, 1],
      width: 320, height: 240, horizontal_fov_deg: 90 }],
    control_hz: 30, action_chunk_rows: 4,
  };
}

export function syntheticSupplyExecutionAdmission(interfaceId = TEAM_CANDIDATE_HTTPS_INTERFACE, robotEmbodiment?: RobotEmbodiment) {
  const qualified = syntheticQualifiedAdmission("walkthrough-req1", "req1");
  return { ...qualified, envelope: { ...qualified.envelope, canonical_execution_request: { policy_package: {
    policy_api_endpoint: { policy_interface_id: interfaceId, execution_profile: TEAM_EVALUATION_PROFILE,
      ...(robotEmbodiment ? { robot_embodiment: robotEmbodiment } : {}) },
  } } } };
}
