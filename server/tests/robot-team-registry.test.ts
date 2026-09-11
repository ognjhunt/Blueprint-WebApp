/**
 * Provenance.
 *
 * Two rules carry the weight here, and both exist to stop a number nobody
 * stands behind reaching a site operator:
 *
 * 1. A worse-graded reading never overwrites a better-graded one, so a
 *    scheduled refresh cannot erode a measured result.
 * 2. An inferred figure is removed entirely before matching, so a model's
 *    reading of a press release shows up as "we do not know" rather than as a
 *    capability.
 */
import { describe, expect, it } from "vitest";

import { mergeCapability, quotableCapability } from "../utils/robotTeamRegistry";
import type { RobotTeamRecord } from "../types/robot-team-registry";

function record(
  capability: RobotTeamRecord["capability"] = {},
  fieldProvenance: RobotTeamRecord["fieldProvenance"] = {},
): Pick<RobotTeamRecord, "capability" | "fieldProvenance"> {
  return { capability, fieldProvenance };
}

describe("grade precedence", () => {
  it("lets a team's own answer replace something inferred", () => {
    const before = record(
      { payloadCapacity: "two_to_ten" },
      {
        payloadCapacity: {
          grade: "inferred",
          source: "https://example.com/press",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    );
    const after = mergeCapability(
      before,
      { payloadCapacity: "ten_to_twentyfive" },
      { grade: "self_reported", source: "inboundRequest:req-1" },
    );
    expect(after.capability.payloadCapacity).toBe("ten_to_twentyfive");
    expect(after.changed).toContain("payloadCapacity");
  });

  it("refuses to let a press release overwrite a measured result", () => {
    const before = record(
      { demonstratedSuccessRate: "ninetyfive" },
      {
        demonstratedSuccessRate: {
          grade: "measured",
          source: "evaluationRun:run-9",
          observedAt: "2026-05-01T00:00:00.000Z",
        },
      },
    );
    const after = mergeCapability(
      before,
      { demonstratedSuccessRate: "ninetynine_plus" },
      { grade: "published", source: "https://example.com/blog" },
    );
    // The registry must get more true the longer it runs, not less.
    expect(after.capability.demonstratedSuccessRate).toBe("ninetyfive");
    expect(after.changed).toHaveLength(0);
  });

  it("refuses to let a team's claim overwrite a measured result", () => {
    const before = record(
      { demonstratedSuccessRate: "ninety" },
      {
        demonstratedSuccessRate: {
          grade: "measured",
          source: "evaluationRun:run-9",
          observedAt: "2026-05-01T00:00:00.000Z",
        },
      },
    );
    const after = mergeCapability(
      before,
      { demonstratedSuccessRate: "ninetynine" },
      { grade: "self_reported", source: "inboundRequest:req-2" },
    );
    expect(after.capability.demonstratedSuccessRate).toBe("ninety");
  });

  it("records stronger evidence for a value it already held", () => {
    const before = record(
      { payloadCapacity: "ten_to_twentyfive" },
      {
        payloadCapacity: {
          grade: "inferred",
          source: "https://example.com",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    );
    const after = mergeCapability(
      before,
      { payloadCapacity: "ten_to_twentyfive" },
      { grade: "self_reported", source: "inboundRequest:req-3" },
    );
    expect(after.fieldProvenance.payloadCapacity?.grade).toBe("self_reported");
    // The value did not move, so it is not reported as a change.
    expect(after.changed).toHaveLength(0);
  });

  it("ignores empty incoming values rather than blanking what is known", () => {
    const before = record(
      { payloadCapacity: "ten_to_twentyfive" },
      {
        payloadCapacity: {
          grade: "self_reported",
          source: "inboundRequest:req-1",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    );
    const after = mergeCapability(
      before,
      { payloadCapacity: "", humanProximity: null },
      { grade: "measured", source: "evaluationRun:run-1" },
    );
    expect(after.capability.payloadCapacity).toBe("ten_to_twentyfive");
    expect(after.capability.humanProximity).toBeUndefined();
  });
});

describe("what may reach a site operator", () => {
  const mixed = record(
    {
      payloadCapacity: "ten_to_twentyfive",
      cycleTime: "under_30s",
      demonstratedSuccessRate: "ninetynine",
    },
    {
      payloadCapacity: {
        grade: "self_reported",
        source: "inboundRequest:req-1",
        observedAt: "2026-01-01T00:00:00.000Z",
      },
      // A model read this off a marketing page. Useful for prioritising
      // outreach; not something to put in front of a site.
      cycleTime: {
        grade: "inferred",
        source: "https://example.com/product",
        observedAt: "2026-01-01T00:00:00.000Z",
        proposedBy: "site_capability_extraction:run-1",
      },
      demonstratedSuccessRate: {
        grade: "measured",
        source: "evaluationRun:run-9",
        observedAt: "2026-05-01T00:00:00.000Z",
      },
    },
  );

  it("drops inferred figures entirely rather than annotating them", () => {
    const quotable = quotableCapability(mixed);
    expect(quotable.payloadCapacity).toBe("ten_to_twentyfive");
    expect(quotable.demonstratedSuccessRate).toBe("ninetynine");
    // Removed, so the matcher sees "unknown" and the team reads as provisional
    // rather than as a claim nobody made.
    expect(quotable.cycleTime).toBeUndefined();
  });

  it("drops a value with no provenance at all", () => {
    const orphan = record({ payloadCapacity: "over_25kg" }, {});
    expect(quotableCapability(orphan).payloadCapacity).toBeUndefined();
  });
});
