// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildCritiquePrompt,
  buildSynthesisPrompt,
  slugifyCityName,
} from "../utils/cityLaunchPlanningHarness";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
} from "../utils/deepResearchFileSearch";

describe("city launch planning harness", () => {
  it("slugifies city names for artifact paths", () => {
    expect(slugifyCityName("Austin, TX")).toBe("austin-tx");
    expect(slugifyCityName("San Francisco, CA")).toBe("san-francisco-ca");
  });

  it("builds a critique prompt that audits Blueprint-specific risks", () => {
    const prompt = buildCritiquePrompt("Initial research body");
    expect(prompt).toContain("Blueprint's launch-strategy critique agent");
    expect(prompt).toContain("rights, provenance, privacy, or hosted proof");
    expect(prompt).toContain("Unsupported or weak analogies");
  });

  it("builds an optional file search tool config for deep research", () => {
    expect(buildDeepResearchTools()).toBeUndefined();
    expect(buildDeepResearchTools(["  "])).toBeUndefined();
    expect(buildDeepResearchTools(["fileSearchStores/blueprint-city-launch"])).toEqual([
      {
        type: "file_search",
        file_search_store_names: ["fileSearchStores/blueprint-city-launch"],
      },
    ]);
  });

  it("prefers explicit file search stores over env defaults", () => {
    process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE =
      "fileSearchStores/from-env";

    expect(
      resolveDeepResearchFileSearchStoreNames({
        explicitStoreNames: ["fileSearchStores/from-cli"],
        envKeys: ["BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE"],
      }),
    ).toEqual(["fileSearchStores/from-cli"]);

    delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
  });

  it("falls back to env-configured file search stores", () => {
    process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE =
      "fileSearchStores/store-a, fileSearchStores/store-b";

    expect(resolveDeepResearchFileSearchStoreNames({
      envKeys: ["BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE"],
    })).toEqual([
      "fileSearchStores/store-a",
      "fileSearchStores/store-b",
    ]);

    delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
  });

  it("builds a synthesis prompt that requires an operator-ready playbook", () => {
    const prompt = buildSynthesisPrompt({
      city: "Austin, TX",
      research: "Research body",
      critiqueOutputs: ["Critique 1", "Critique 2"],
    });
    expect(prompt).toContain("single operator-ready city launch playbook");
    expect(prompt).toContain("Human vs agent ownership model");
    expect(prompt).toContain("What not to say publicly yet");
    expect(prompt).toContain("Structured launch data appendix");
    expect(prompt).toContain("```city-launch-records");
  });
});
