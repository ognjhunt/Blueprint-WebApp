/**
 * The results page must explain an open/close contract in the operator's own
 * words, and must never describe an estimated stroke as a measurement.
 */
import { describe, expect, it } from "vitest";

import {
  anyTaskSuccessContractSchema,
  describeTaskSuccessContract,
  isArticulatedTaskSuccessContract,
  type ArticulatedTaskSuccessContract,
} from "@/lib/articulatedTaskSuccessContract";

const contract: ArticulatedTaskSuccessContract = {
  schema_version: "articulated_task_success_contract.v1",
  scope: { site_id: "site-capture-drawer", task_id: "website-drawer-open" },
  provenance: {
    author_source: "task_owner",
    author_id: "owner",
    confirmation_status: "confirmed",
    confirmed_by_team_id: "team-1",
    proposal_digest: null,
  },
  criteria: {
    target_joint: { joint_id: "task_part_joint", joint_ids: ["task_part_joint"] },
    opening: {
      mode: "required",
      success_interval: [0.18, 0.3],
      joint_hard_limits: [0, 0.3],
      reset_position: 0,
    },
    hold: { mode: "required", window_samples: 15, maximum_settled_target_speed: 0.02 },
    locked_joints: { mode: "required", joint_ids: ["drawer_0_fixed"], motion_tolerance: 0.01 },
    reset: { tolerance: 0.005 },
    motion: { movement_epsilon: 0.003 },
    assembly_root: { mode: "required" },
    safety: { mode: "required" },
    temporal_invariants: {
      schema_version: "articulated_task_event_ledger_expectation.v1",
      rebound_below_threshold_allowed: false,
      forbidden_collision_allowed: false,
      joint_limit_violation_allowed: false,
      assembly_root_excursion_allowed: false,
    },
  },
  contract_digest: `sha256:${"a".repeat(64)}`,
};

describe("articulated task success contract on the client", () => {
  it("is admitted by the shared reader and recognised by kind", () => {
    const parsed = anyTaskSuccessContractSchema.parse(contract);
    expect(isArticulatedTaskSuccessContract(parsed)).toBe(true);
  });

  it("describes the joint interval, the hold and what had to stay still", () => {
    const rows = describeTaskSuccessContract(contract);
    const labels = rows.map((row) => row.label);
    expect(labels).toEqual([
      "Part opened", "Held open", "Assembly stayed put", "Other parts still",
      "Reset and movement", "Safety", "Whole-episode events",
    ]);
    const opened = rows[0];
    expect(opened.value).toContain("task_part_joint");
    expect(opened.value).toContain("0.180");
    expect(opened.value).toContain("0.300");
    // The travel limits come from footage, and the page has to say so.
    expect(opened.detail).toContain("estimated from footage, not measured");
    expect(rows[3].detail).toContain("drawer_0_fixed");
    expect(rows[6].value).toContain("no forbidden collision");
  });

  it("carries no destination, lift or placement language from the rigid lane", () => {
    const text = describeTaskSuccessContract(contract)
      .map((row) => `${row.label} ${row.value} ${row.detail}`).join(" ").toLowerCase();
    for (const word of ["destination", "lifted", "placement", "released the object"]) {
      expect(text).not.toContain(word);
    }
  });
});
