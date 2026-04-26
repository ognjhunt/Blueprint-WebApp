// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
  resolveDeepResearchMcpServers,
} from "../utils/deepResearchFileSearch";

afterEach(() => {
  delete process.env.BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE;
  delete process.env.BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE;
  delete process.env.BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON;
});

describe("deep research file search helpers", () => {
  it("builds the default Deep Research tool suite and appends file search when configured", () => {
    expect(buildDeepResearchTools()).toEqual([
      {
        type: "google_search",
      },
      {
        type: "url_context",
      },
      {
        type: "code_execution",
      },
    ]);
    expect(
      buildDeepResearchTools({
        fileSearchStoreNames: ["fileSearchStores/example"],
      }),
    ).toEqual([
      {
        type: "google_search",
      },
      {
        type: "url_context",
      },
      {
        type: "code_execution",
      },
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

  it("parses env-configured remote MCP servers for Deep Research", () => {
    process.env.BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON = JSON.stringify([
      {
        name: "blueprint-market-data",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer token",
        },
        allowed_tools: {
          mode: "validated",
          tools: ["search_company", "get_contact_page"],
        },
      },
    ]);

    expect(resolveDeepResearchMcpServers()).toEqual([
      {
        type: "mcp_server",
        name: "blueprint-market-data",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer token",
        },
        allowed_tools: {
          mode: "validated",
          tools: ["search_company", "get_contact_page"],
        },
      },
    ]);
  });

  it("strips allowed_tools from MCP servers when building Gemini-compatible tools", () => {
    const mcpServers = [
      {
        type: "mcp_server" as const,
        name: "test-server",
        url: "https://example.com/mcp",
        allowed_tools: {
          mode: "validated" as const,
          tools: ["tool1"],
        },
      },
    ];

    const tools = buildDeepResearchTools({ mcpServers });
    expect(tools).toEqual([
      { type: "google_search" },
      { type: "url_context" },
      { type: "code_execution" },
      {
        type: "mcp_server",
        name: "test-server",
        url: "https://example.com/mcp",
        // allowed_tools should be stripped for Gemini compatibility
      },
    ]);
    // Explicitly verify allowed_tools is not present
    const mcpTool = tools?.find(t => t.type === "mcp_server") as Record<string, unknown>;
    expect(mcpTool).toBeDefined();
    expect(mcpTool.allowed_tools).toBeUndefined();
  });
});
