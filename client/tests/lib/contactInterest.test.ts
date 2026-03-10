import { describe, expect, it } from "vitest";
import {
  CANONICAL_CONTACT_INTEREST_BY_LANE,
  normalizeInterestToLane,
} from "@/lib/contactInterest";

describe("contact interest mapping", () => {
  it("keeps canonical public interests stable", () => {
    expect(CANONICAL_CONTACT_INTEREST_BY_LANE.qualification).toBe("site-qualification");
    expect(CANONICAL_CONTACT_INTEREST_BY_LANE.deeper_evaluation).toBe("deeper-evaluation");
    expect(CANONICAL_CONTACT_INTEREST_BY_LANE.managed_tuning).toBe("managed-tuning");
  });

  it("maps canonical values to requested lanes", () => {
    expect(normalizeInterestToLane("site-qualification")).toBe("qualification");
    expect(normalizeInterestToLane("deeper-evaluation")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("managed-tuning")).toBe("managed_tuning");
  });

  it("keeps legacy aliases working", () => {
    expect(normalizeInterestToLane("evaluation-run")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("adaptation-data-pack")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("exclusive-dataset")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("private-twin-buyout")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("enterprise")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("egocentric-video")).toBe("deeper_evaluation");
    expect(normalizeInterestToLane("managed-adaptation")).toBe("managed_tuning");
  });

  it("does not silently map unknown interest values", () => {
    expect(normalizeInterestToLane("something-else")).toBeNull();
    expect(normalizeInterestToLane("")).toBeNull();
    expect(normalizeInterestToLane(null)).toBeNull();
  });
});
