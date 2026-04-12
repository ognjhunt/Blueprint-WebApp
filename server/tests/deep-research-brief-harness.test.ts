// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runDeepResearchBrief } from "../utils/deepResearchBriefHarness";

describe("deep research brief harness module", () => {
  it("exports a callable harness", () => {
    expect(typeof runDeepResearchBrief).toBe("function");
  });
});
