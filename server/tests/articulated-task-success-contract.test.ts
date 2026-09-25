/**
 * The website accepts, matches and publishes an articulated open/close
 * contract, and still refuses a weakened one or a swapped kind.
 */
import { describe, expect, it } from "vitest";

import {
  articulatedTaskSuccessContractSchema,
  confirmArticulatedTaskSuccessContract,
  confirmedTaskSuccessContractSchema,
  isArticulatedTaskSuccessContract,
  taskSuccessContractMatchesSelection,
  taskSuccessContractSchema,
  type ArticulatedTaskSuccessContract,
} from "../utils/articulatedTaskSuccessContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { normalOwnerControlOmissionMatches } from "../utils/taskEvaluationPublicationScope";

const SITE = "site-capture-drawer";
const TASK = "website-drawer-open";

function criteria() {
  return {
    target_joint: { joint_id: "task_part_joint", joint_ids: ["task_part_joint"] },
    opening: {
      mode: "required" as const,
      success_interval: [0.18, 0.3] as [number, number],
      joint_hard_limits: [0, 0.3] as [number, number],
      reset_position: 0,
    },
    hold: { mode: "required" as const, window_samples: 15, maximum_settled_target_speed: 0.02 },
    locked_joints: {
      mode: "required" as const, joint_ids: ["drawer_0_fixed"], motion_tolerance: 0.01,
    },
    reset: { tolerance: 0.005 },
    motion: { movement_epsilon: 0.003 },
    assembly_root: { mode: "required" as const },
    safety: { mode: "required" as const },
    temporal_invariants: {
      schema_version: "articulated_task_event_ledger_expectation.v1" as const,
      rebound_below_threshold_allowed: false as const,
      forbidden_collision_allowed: false as const,
      joint_limit_violation_allowed: false as const,
      assembly_root_excursion_allowed: false,
    },
  };
}

function seal(overrides: Partial<ArticulatedTaskSuccessContract> = {}) {
  const contract = {
    schema_version: "articulated_task_success_contract.v1" as const,
    scope: { site_id: SITE, task_id: TASK },
    provenance: {
      author_source: "task_owner" as const,
      author_id: "owner",
      confirmation_status: "confirmed" as const,
      confirmed_by_team_id: "team-1",
      proposal_digest: null,
    },
    criteria: criteria(),
    contract_digest: `sha256:${"0".repeat(64)}`,
    ...overrides,
  };
  contract.contract_digest = canonicalArtifactDigest(
    contract as unknown as Record<string, unknown>, "contract_digest",
  );
  return contract as ArticulatedTaskSuccessContract;
}

function reseal(contract: ArticulatedTaskSuccessContract) {
  const next = structuredClone(contract);
  next.contract_digest = canonicalArtifactDigest(
    next as unknown as Record<string, unknown>, "contract_digest",
  );
  return next;
}

describe("articulated task success contract", () => {
  it("binds a website controls omission to the saved confirmed drawer contract", () => {
    const contract = seal();
    const policyRun = {
      task_success_contract: contract,
      task_success_contract_digest: contract.contract_digest,
    };
    const publication = {
      policy_canary_result: {
        control_omission: { authority_digest: `sha256:${"a".repeat(64)}` },
        task_success_contract: contract,
      },
    } as Parameters<typeof normalOwnerControlOmissionMatches>[1];
    expect(normalOwnerControlOmissionMatches(policyRun, publication)).toBe(true);
    expect(normalOwnerControlOmissionMatches({
      ...policyRun, task_success_contract_digest: `sha256:${"b".repeat(64)}`,
    }, publication)).toBe(false);
    expect(normalOwnerControlOmissionMatches(policyRun, {
      ...publication,
      policy_canary_result: {
        ...publication.policy_canary_result,
        task_success_contract: seal({ scope: { site_id: SITE, task_id: "other-drawer" } }),
      },
    })).toBe(false);
  });

  it("parses a sealed contract and reads its kind", () => {
    const contract = seal();
    expect(articulatedTaskSuccessContractSchema.parse(contract)).toEqual(contract);
    expect(taskSuccessContractSchema.safeParse(contract).success).toBe(true);
    expect(confirmedTaskSuccessContractSchema.safeParse(contract).success).toBe(true);
    expect(isArticulatedTaskSuccessContract(contract)).toBe(true);
  });

  it("refuses an interval that contains the closed start or leaves the qualified limits", () => {
    const openAtRest = structuredClone(seal());
    openAtRest.criteria.opening.success_interval = [0, 0.3];
    expect(articulatedTaskSuccessContractSchema.safeParse(reseal(openAtRest)).success).toBe(false);
    const past = structuredClone(seal());
    past.criteria.opening.success_interval = [0.18, 0.45];
    expect(articulatedTaskSuccessContractSchema.safeParse(reseal(past)).success).toBe(false);
  });

  it("refuses a relaxed safety or event ledger and an unsealed digest", () => {
    const unsafe = structuredClone(seal());
    (unsafe.criteria.safety as { mode: string }).mode = "ignored";
    expect(articulatedTaskSuccessContractSchema.safeParse(reseal(unsafe)).success).toBe(false);
    const permissive = structuredClone(seal());
    (permissive.criteria.temporal_invariants as { forbidden_collision_allowed: boolean })
      .forbidden_collision_allowed = true;
    expect(articulatedTaskSuccessContractSchema.safeParse(reseal(permissive)).success).toBe(false);
    const tampered = structuredClone(seal());
    tampered.criteria.motion.movement_epsilon = 0.05;
    expect(articulatedTaskSuccessContractSchema.safeParse(tampered).success).toBe(false);
  });

  it("confirms exactly the published proposal and rejects altered criteria", () => {
    const proposal = seal({
      provenance: {
        author_source: "agent_proposal", author_id: "agent",
        confirmation_status: "proposal_only", confirmed_by_team_id: null, proposal_digest: null,
      },
    });
    const confirmed = confirmArticulatedTaskSuccessContract(proposal, "team-1");
    expect(confirmed.provenance.proposal_digest).toBe(proposal.contract_digest);
    expect(taskSuccessContractMatchesSelection({
      published: proposal, selected: confirmed,
      expectedSiteId: SITE, expectedTaskId: TASK, expectedTeamId: "team-1",
    })).toBe(true);
    const altered = structuredClone(confirmed);
    altered.criteria.opening.success_interval = [0.25, 0.3];
    expect(taskSuccessContractMatchesSelection({
      published: proposal, selected: reseal(altered),
      expectedSiteId: SITE, expectedTaskId: TASK, expectedTeamId: "team-1",
    })).toBe(false);
  });

  it("never matches a selection that swaps the contract kind", async () => {
    const { sealRigidTaskSuccessContract } = await import("../utils/rigidTaskSuccessContract");
    const rigid = sealRigidTaskSuccessContract({
      siteId: SITE, taskId: TASK, authorSource: "task_owner", authorId: "owner",
      confirmationStatus: "confirmed", confirmedByTeamId: "team-1",
      criteria: {
        destination_containment: {
          mode: "required",
          position_bounds_world_m: { minimum: [0, 0, 0], maximum: [1, 1, 1] },
        },
        orientation: { mode: "ignored", reference_xyzw: [0, 0, 0, 1], tolerance_rad: 0 },
        support: { height_mode: "ignored", height_interval_m: [0, 1], contact_mode: "ignored" },
        terminal_task_contact: { mode: "cleared" },
        gripper_state: { mode: "released", threshold_m: 0.01 },
        settling: {
          mode: "required", window_samples: 20,
          position_tolerance_m: 0.005, orientation_tolerance_rad: 0.03,
        },
        safety: { mode: "required" },
        motion: { movement_epsilon_m: 0.005, minimum_translation_m: 0.1, minimum_lift_m: 0.05 },
        temporal_invariants: {
          schema_version: "rigid_task_event_ledger_expectation.v1",
          no_drop: { mode: "required", minimum_fall_m: 0.02 },
          maximum_task_contact_force_n: 20,
          forbidden_contact_classes: [],
          containment_excursions: "forbidden",
          workspace_excursions: "forbidden",
          maximum_retries: 0,
          maximum_regrasps: 0,
        },
      },
    });
    expect(taskSuccessContractMatchesSelection({
      published: rigid, selected: seal(),
      expectedSiteId: SITE, expectedTaskId: TASK, expectedTeamId: "team-1",
    })).toBe(false);
  });
});
