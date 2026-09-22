/**
 * The rigid and articulated contract modules must not import each other in a
 * cycle: whichever loaded first would see the other's schema as undefined, and
 * the published-contract reader would then throw on every result page.
 * Importing the rigid module first is the order that used to break.
 */
import { describe, expect, it } from "vitest";

import * as rigid from "@/lib/rigidTaskSuccessContract";
import { findPublishedTaskSuccessContract } from "@/lib/articulatedTaskSuccessContract";

const contract = {
  schema_version: "rigid_task_success_contract.v1",
  scope: { site_id: "scene-1", task_id: "relocation" },
  provenance: { author_source: "task_owner", author_id: "owner", confirmation_status: "confirmed", confirmed_by_team_id: "team-1", proposal_digest: null },
  criteria: {
    destination_containment: { mode: "required", position_bounds_world_m: { minimum: [0, 0, 0], maximum: [1, 1, 1] } },
    orientation: { mode: "ignored", reference_xyzw: [0, 0, 0, 1], tolerance_rad: 0.35 },
    support: { height_mode: "required", height_interval_m: [0, 1], contact_mode: "required" },
    terminal_task_contact: { mode: "cleared" },
    gripper_state: { mode: "ignored", threshold_m: null },
    settling: { mode: "required", window_samples: 8, position_tolerance_m: 0.01, orientation_tolerance_rad: 0.08 },
    safety: { mode: "required" },
    motion: { movement_epsilon_m: 0.002, minimum_translation_m: 0.08, minimum_lift_m: null },
    temporal_invariants: { schema_version: "rigid_task_event_ledger_expectation.v1", no_drop: { mode: "ignored", minimum_fall_m: 0.02 }, maximum_task_contact_force_n: null, forbidden_contact_classes: [], containment_excursions: "forbidden", workspace_excursions: "ignored", maximum_retries: null, maximum_regrasps: null },
  },
  contract_digest: `sha256:${"8".repeat(64)}`,
};

describe("task success contract modules", () => {
  it("read a published contract even when the rigid module loads first", () => {
    expect(rigid.rigidTaskSuccessContractSchema.safeParse(contract).success).toBe(true);
    expect(findPublishedTaskSuccessContract({ policy_canary_result: { task_success_contract: contract } }))
      .toMatchObject({ schema_version: "rigid_task_success_contract.v1" });
    expect(findPublishedTaskSuccessContract({ task_success_contract: { schema_version: "unknown" } })).toBeNull();
  });
});
