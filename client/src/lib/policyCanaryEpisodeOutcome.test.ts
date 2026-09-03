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
});
