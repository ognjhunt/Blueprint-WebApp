import { describe, expect, it } from "vitest";

import { humanPolicyCanaryEpisodeOutcome } from "./policyCanaryEpisodeOutcome";

describe("humanPolicyCanaryEpisodeOutcome", () => {
  it("calls out a lifted object that finishes toppled outside the target", () => {
    const result = humanPolicyCanaryEpisodeOutcome({
      outcome: "moved_below_success_contract",
      task_succeeded: false,
      measurements: {
        maximum_translation_m: 0.0907708,
        maximum_lift_m: 0.0557627,
        settle_destination_inside: false,
        settle_orientation_ok: false,
        settle_support_height_ok: false,
        released: false,
        native_safety_ok: true,
      },
    });
    expect(result.title).toBe("Dropped or toppled the object");
    expect(result.explanation).toContain("outside the target");
    expect(result.facts).toContainEqual({ label: "Maximum lift", value: "5.6 cm" });
  });

  it("distinguishes reaching the target without releasing", () => {
    const result = humanPolicyCanaryEpisodeOutcome({
      outcome: "release_incomplete",
      task_succeeded: false,
      measurements: {
        settle_destination_inside: true,
        released: false,
      },
    });
    expect(result.title).toBe("Reached the target, but did not release");
    expect(result.explanation).toContain("independently settled");
  });

  it("keeps collision failures distinct from task misses", () => {
    const result = humanPolicyCanaryEpisodeOutcome({
      outcome: "collision_or_containment_failure",
      task_succeeded: false,
      measurements: { native_safety_ok: false },
    });
    expect(result.title).toBe("Collision or workspace violation");
    expect(result.tone).toBe("block");
  });

  it("uses the held-out corrected contract instead of implying an ignored release failed", () => {
    const result = humanPolicyCanaryEpisodeOutcome({
      outcome: "pushed_and_settled",
      task_succeeded: true,
      task_success_contract: {
        criteria: {
          temporal_invariants: { no_drop: { mode: "ignored" } },
          gripper_state: { mode: "ignored" },
          terminal_task_contact: { mode: "cleared" },
        },
      },
      measurements: {
        released: false,
        settle_task_contact_cleared: true,
        settle_destination_inside: true,
      },
      event_ledger: { drop_events: [{ unsupported_started_step: 199, support_recontact_step: 201, fall_m: 0.049927 }] },
    });

    expect(result.title).toBe("Task completed after an unsupported fall");
    expect(result.facts).not.toContainEqual({ label: "Released", value: "No" });
    expect(result.facts).toContainEqual({
      label: "Final robot contact cleared",
      value: "Yes",
    });
    expect(result.facts).toContainEqual({
      label: "Unsupported falls",
      value: "1 unsupported fall · recovery allowed",
    });
    expect(result.facts).toContainEqual({
      label: "Unsupported fall 1",
      value: "5.0 cm · steps 199–201",
    });
  });
});

it("shows observed retreat clearance without inferring a missing measurement", () => {
  const receipt = {
    task_succeeded: false,
    task_success_contract: { criteria: { retreat: { mode: "required" as const, minimum_clearance_m: 0.05 } } },
    measurements: { retreat: { satisfied: false, readback_complete: true, minimum_observed_clearance_m: 0.01 } },
  };
  expect(humanPolicyCanaryEpisodeOutcome(receipt).facts).toEqual(expect.arrayContaining([
    { label: "Gripper retreat verified", value: "No" },
    { label: "Minimum gripper clearance", value: "1.0 cm" },
    { label: "Required gripper clearance", value: "5.0 cm" },
  ]));
  const missing = humanPolicyCanaryEpisodeOutcome({
    ...receipt, measurements: {}, outcome: "native_retreat_readback_missing",
  });
  expect(missing.tone).toBe("warn");
  expect(missing.facts).toContainEqual({ label: "Gripper retreat verified", value: "Not reported" });
});
