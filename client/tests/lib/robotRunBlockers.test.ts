import { describe, expect, it } from "vitest";

import { describePlanBlockers, describeRunBlockers } from "@/lib/robotRunBlockers";

describe("why a run cannot be paid for yet", () => {
  it("names who has to act, most actionable first", () => {
    expect(describeRunBlockers(["pipeline_execution_offer_missing", "agent_execution_checkpoint_runtime_not_admissible"]))
      .toMatch(/endpoint we can call or a container image/);
    expect(describeRunBlockers(["site_rights_not_cleared"])).toMatch(/site owner hasn't cleared/);
    expect(describeRunBlockers(["scene_not_runnable"])).toMatch(/scene isn't ready for paid runs yet/);
    expect(describeRunBlockers([])).toBeNull();
  });

  it("says each distinct reason once across a plan and never shows a raw code", () => {
    const sentences = describePlanBlockers([
      { sceneId: "a", blockers: ["pipeline_execution_offer_missing"] },
      { sceneId: "b", blockers: ["scene_not_runnable"] },
      { sceneId: "c", blockers: ["site_rights_not_cleared"] },
    ]);
    expect(sentences).toHaveLength(2);
    expect(sentences.join(" ")).not.toMatch(/_/);
  });
});
