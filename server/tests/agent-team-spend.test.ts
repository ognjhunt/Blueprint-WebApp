// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("measurement outranks the team's own estimate", () => {
  it("puts measured above self_reported in the grade ladder", async () => {
    // The property the whole checkpoint-first change rests on: once a run
    // writes `measured`, mergeCapability stops letting the team's own number
    // win, with no migration and no deletion.
    const { QUOTABLE_GRADES } = await import("../types/robot-team-registry");
    const { mergeCapability } = await import("../utils/robotTeamRegistry");

    const existing = {
      capability: { payloadCapacity: "under_5kg" },
      fieldProvenance: {
        payloadCapacity: {
          grade: "self_reported" as const,
          source: "intake",
          observedAt: "2026-09-01T00:00:00.000Z",
        },
      },
    };

    const merged = mergeCapability(existing, { payloadCapacity: "five_to_20kg" }, {
      grade: "measured",
      source: "evaluationRun:run-1",
    });

    expect(merged.capability.payloadCapacity).toBe("five_to_20kg");
    expect(merged.fieldProvenance.payloadCapacity?.grade).toBe("measured");
    // And a later self-report cannot take it back.
    const reverted = mergeCapability(
      { capability: merged.capability, fieldProvenance: merged.fieldProvenance },
      { payloadCapacity: "under_5kg" },
      { grade: "self_reported", source: "intake-2" },
    );
    expect(reverted.capability.payloadCapacity).toBe("five_to_20kg");
    expect(QUOTABLE_GRADES).toContain("measured");
  });
});

describe("the intake knows which of its questions a run will answer better", () => {
  it("marks exactly the seven an evaluation measures", async () => {
    const { measurableRobotSpecFieldIds } = await import(
      "../../client/src/data/robotTeamQualification"
    );

    expect([...measurableRobotSpecFieldIds()].sort()).toEqual([
      "cycleTime",
      "demonstratedSuccessRate",
      "dutyCycle",
      "humanProximity",
      "lighting",
      "objectHandling",
      "payloadCapacity",
    ]);
  });

  it("leaves the two no episode can settle unmarked", async () => {
    // budgetBand is a commercial fact about the business and taskFamily is a
    // declaration of what the robot is for. No run establishes either, so
    // marking them superseded would promise a measurement we cannot make.
    const { measurableRobotSpecFieldIds } = await import(
      "../../client/src/data/robotTeamQualification"
    );
    const measurable = measurableRobotSpecFieldIds();

    expect(measurable).not.toContain("budgetBand");
    expect(measurable).not.toContain("taskFamily");
  });
});
