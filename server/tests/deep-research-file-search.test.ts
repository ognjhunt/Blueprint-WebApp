// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
} from "../utils/deepResearchFileSearch";

afterEach(() => {
  delete process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE;
  delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
});

describe("deep research file search helpers", () => {
  it("builds file search tool config only when store names exist", () => {
    expect(buildDeepResearchTools()).toBeUndefined();
    expect(buildDeepResearchTools(["fileSearchStores/example"])).toEqual([
      {
        type: "file_search",
        file_search_store_names: ["fileSearchStores/example"],
      },
    ]);
  });

  it("prefers explicit store names over env values", () => {
    process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE = "fileSearchStores/from-env";

    expect(
      resolveDeepResearchFileSearchStoreNames({
        explicitStoreNames: ["fileSearchStores/from-cli"],
      }),
    ).toEqual(["fileSearchStores/from-cli"]);
  });

  it("supports env precedence for city-specific and generic deep research stores", () => {
    process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE = "fileSearchStores/from-city-env";
    process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE = "fileSearchStores/from-generic-env";

    expect(
      resolveDeepResearchFileSearchStoreNames({
        envKeys: [
          "BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE",
          "BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE",
        ],
      }),
    ).toEqual(["fileSearchStores/from-city-env"]);
  });

  it("falls back to the generic deep research env store", () => {
    process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE =
      "fileSearchStores/store-a, fileSearchStores/store-b";

    expect(resolveDeepResearchFileSearchStoreNames()).toEqual([
      "fileSearchStores/store-a",
      "fileSearchStores/store-b",
    ]);
  });
});
