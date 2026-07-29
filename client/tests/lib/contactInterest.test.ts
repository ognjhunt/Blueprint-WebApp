import { describe, expect, it } from "vitest";
import {
  CANONICAL_CONTACT_INTEREST_BY_LANE,
  normalizeInterestToLane,
} from "@/lib/contactInterest";

describe("contact interest mapping", () => {
  it("emits one canonical public Task Evaluation Run interest", () => {
    expect(new Set(Object.values(CANONICAL_CONTACT_INTEREST_BY_LANE))).toEqual(
      new Set(["task-evaluation-run"]),
    );
  });

  it("maps canonical values to requested lanes", () => {
    expect(normalizeInterestToLane("task-evaluation-run")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("site-review")).toBe("qualification");
    expect(normalizeInterestToLane("site-qualification")).toBe("qualification");
    expect(normalizeInterestToLane("site-access-review")).toBe("qualification");
    expect(normalizeInterestToLane("world-model")).toBe("data_licensing");
    expect(normalizeInterestToLane("world-model-package")).toBe("data_licensing");
    expect(normalizeInterestToLane("post-training-data-package")).toBe("data_licensing");
    expect(normalizeInterestToLane("policy-improvement-run")).toBe("data_licensing");
    expect(normalizeInterestToLane("policy-lift")).toBe("data_licensing");
    expect(normalizeInterestToLane("data-package")).toBe("data_licensing");
    expect(normalizeInterestToLane("capture-access")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("hosted-evaluation")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("evaluation-package")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("deeper-evaluation")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("managed-tuning")).toBe("managed_tuning");
  });

  it("keeps legacy aliases working", () => {
    expect(normalizeInterestToLane("evaluation-run")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("hosted-session")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("adaptation-data-pack")).toBe("data_licensing");
    expect(normalizeInterestToLane("exclusive-dataset")).toBe("data_licensing");
    expect(normalizeInterestToLane("scene-package")).toBe("data_licensing");
    expect(normalizeInterestToLane("private-twin-buyout")).toBe("preview_simulation");
    expect(normalizeInterestToLane("enterprise")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("egocentric-video")).toBe("preview_simulation");
    expect(normalizeInterestToLane("managed-adaptation")).toBe("managed_tuning");
  });

  it("does not silently map unknown interest values", () => {
    expect(normalizeInterestToLane("something-else")).toBeNull();
    expect(normalizeInterestToLane("")).toBeNull();
    expect(normalizeInterestToLane(null)).toBeNull();
  });
});
