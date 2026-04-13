// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runDeepResearchBrief } from "../utils/deepResearchBriefHarness";
import { resolveDeepResearchFileSearchStoreNames } from "../utils/deepResearchFileSearch";

describe("deep research brief harness module", () => {
  it("exports a callable harness", () => {
    expect(typeof runDeepResearchBrief).toBe("function");
  });

  it("can resolve a generic env-backed file search store for brief runs", () => {
    process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE = "fileSearchStores/briefs";
    expect(resolveDeepResearchFileSearchStoreNames()).toEqual(["fileSearchStores/briefs"]);
    delete process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE;
  });
});
