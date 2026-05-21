// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { BLUEPRINT_MCP_TOOLS, callBlueprintMcpTool } from "./blueprint-mcp-server";

describe("Blueprint MCP server", () => {
  it("publishes stable tool schemas for the headless workflow", () => {
    const toolNames = BLUEPRINT_MCP_TOOLS.map((tool) => tool.name);

    expect(toolNames).toEqual([
      "blueprint.catalog.search",
      "blueprint.siteWorld.get",
      "blueprint.session.create",
      "blueprint.session.reset",
      "blueprint.session.step",
      "blueprint.session.runBatch",
      "blueprint.session.renderExplorer",
      "blueprint.session.export",
    ]);
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.session.create")?.inputSchema.required).toEqual([
      "siteWorldId",
      "robotProfileId",
      "taskId",
      "scenarioId",
      "startStateId",
    ]);
  });

  it("routes tool calls through the same API client and returns JSON text content", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [{ id: "siteworld-f5fd54898cfb" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await callBlueprintMcpTool("blueprint.catalog.search", { limit: 1 }, {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds?limit=1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse(result.content[0].text)).toEqual({ items: [{ id: "siteworld-f5fd54898cfb" }] });
  });
});
