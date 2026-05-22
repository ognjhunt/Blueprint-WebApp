// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { BLUEPRINT_MCP_TOOLS, callBlueprintMcpTool } from "./blueprint-mcp-server";

describe("Blueprint MCP server", () => {
  it("publishes stable tool schemas for the headless workflow", () => {
    const toolNames = BLUEPRINT_MCP_TOOLS.map((tool) => tool.name);

    expect(toolNames).toEqual([
      "blueprint.siteWorld.search",
      "blueprint.catalog.search",
      "blueprint.siteWorld.get",
      "blueprint.siteWorld.launchReadiness",
      "blueprint.commerce.quote",
      "blueprint.commerce.checkoutDryRun",
      "blueprint.commerce.order.get",
      "blueprint.commerce.entitlement.get",
      "blueprint.session.create",
      "blueprint.session.reset",
      "blueprint.session.step",
      "blueprint.session.runBatch",
      "blueprint.session.control",
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
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.siteWorld.search")?.inputSchema.properties).toHaveProperty("q");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.siteWorld.search")?.inputSchema.properties).toHaveProperty("objectTags");
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

  it("routes query/filter catalog search through the site-world search endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [{ siteWorld: { id: "sw-chi-01" }, matchedAliases: ["whole foods -> grocery retail"] }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await callBlueprintMcpTool("blueprint.catalog.search", {
      q: "whole foods",
      limit: 5,
      objectTags: ["shelf"],
    }, {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/search?q=whole+foods&limit=5&objectTags=shelf",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(result.content[0].text).results[0].siteWorld.id).toBe("sw-chi-01");
  });

  it("exposes first-class site-world search with request-candidate semantics", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        results: [{ siteWorld: { id: "sw-chi-01" }, matchedAliases: ["whole foods -> grocery retail"] }],
        matchSemantics: {
          exactMatch: false,
          noExactScannedPackage: true,
          message: "No scanned package for this exact place yet.",
        },
        requestCandidate: {
          buyerType: "robot_team",
          source: "site-worlds",
          requestPath: "new-capture",
          requestUrl: "/contact?source=site-worlds&buyerType=robot_team&path=new-capture",
          inboundRequestDraft: {
            buyerType: "robot_team",
            commercialRequestPath: "capture_access",
            requestedLanes: ["deeper_evaluation"],
          },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await callBlueprintMcpTool("blueprint.siteWorld.search", {
      q: "Whole Foods near Durham",
      limit: 5,
    }, {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/search?q=Whole+Foods+near+Durham&limit=5",
      expect.objectContaining({ method: "GET" }),
    );
    const payload = JSON.parse(result.content[0].text);
    expect(payload.matchSemantics.noExactScannedPackage).toBe(true);
    expect(payload.requestCandidate.requestUrl).toContain("source=site-worlds");
    expect(payload.requestCandidate.requestUrl).toContain("buyerType=robot_team");
    expect(payload.requestCandidate.inboundRequestDraft).not.toHaveProperty("entitlementId");
    expect(payload.requestCandidate.inboundRequestDraft).not.toHaveProperty("paymentStatus");
    expect(payload.requestCandidate.inboundRequestDraft).not.toHaveProperty("hostedSessionId");
  });

  it("routes commerce tools through quote and dry-run checkout client methods", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const payload = url.pathname.endsWith("/quote")
        ? { quote: { sku: "hosted-session-sw-chi-01", product: "hosted_session_rental" } }
        : { order: { id: "dry-order-1", status: "fulfilled" }, entitlement: { id: "dry-ent-1" } };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await callBlueprintMcpTool("blueprint.commerce.quote", { siteWorldId: "sw-chi-01", product: "hosted_session_rental" }, {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
    });
    const checkout = await callBlueprintMcpTool("blueprint.commerce.checkoutDryRun", { siteWorldId: "sw-chi-01", product: "hosted_session_rental" }, {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://agent.example/api/agent-access/commerce/quote?siteWorldId=sw-chi-01&product=hosted_session_rental",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://agent.example/api/agent-access/commerce/dry-run-checkout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(checkout.content[0].text)).toMatchObject({
      entitlement: { id: "dry-ent-1" },
    });
  });
});
