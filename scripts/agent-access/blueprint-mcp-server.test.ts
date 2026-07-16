// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { BLUEPRINT_MCP_TOOLS, callBlueprintMcpTool } from "./blueprint-mcp-server";

function collectObjectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== "object") return keys;
  Object.keys(value as Record<string, unknown>).forEach((key) => keys.add(key));
  Object.values(value as Record<string, unknown>).forEach((entry) => {
    if (entry && typeof entry === "object") collectObjectKeys(entry, keys);
  });
  return keys;
}

describe("Blueprint MCP server", () => {
  it("publishes stable tool schemas for the headless workflow", () => {
    const toolNames = BLUEPRINT_MCP_TOOLS.map((tool) => tool.name);

    expect(toolNames).toEqual([
      "blueprint.siteWorld.search",
      "blueprint.catalog.search",
      "blueprint.ask",
      "blueprint.request.locationDraft",
      "blueprint.siteWorld.get",
      "blueprint.siteWorld.launchReadiness",
      "blueprint.commerce.quote",
      "blueprint.commerce.checkoutDryRun",
      "blueprint.commerce.checkoutLive",
      "blueprint.commerce.liveOrder.get",
      "blueprint.commerce.order.get",
      "blueprint.commerce.entitlement.get",
      "blueprint.commerce.entitlementReadiness",
      "blueprint.session.create",
      "blueprint.session.reset",
      "blueprint.session.step",
      "blueprint.session.runBatch",
      "blueprint.session.control",
      "blueprint.session.renderExplorer",
      "blueprint.session.export",
    ]);
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.ask")?.inputSchema.required).toEqual(["q"]);
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.commerce.checkoutLive")?.inputSchema.properties).toHaveProperty("budgetCents");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.commerce.checkoutLive")?.description).toContain("REAL Stripe Checkout Session");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.session.create")?.inputSchema.required).toEqual([
      "siteWorldId",
      "robotProfileId",
      "taskId",
      "scenarioId",
      "startStateId",
    ]);
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.siteWorld.search")?.inputSchema.properties).toHaveProperty("q");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.siteWorld.search")?.inputSchema.properties).toHaveProperty("objectTags");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.request.locationDraft")?.inputSchema.properties).toHaveProperty("location");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.request.locationDraft")?.description).toContain("intake-only");
    expect(BLUEPRINT_MCP_TOOLS.find((tool) => tool.name === "blueprint.commerce.entitlementReadiness")?.inputSchema.required).toEqual([
      "siteWorldId",
      "entitlementId",
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

  it("builds a request-location draft locally without access, payment, provider, or hosted proof fields", async () => {
    const fetchMock = vi.fn();

    const result = await callBlueprintMcpTool(
      "blueprint.request.locationDraft",
      {
        location: "Whole Foods near Durham",
        siteClass: "grocery retail",
        workflow: "shelf restocking",
        message: "Need a new scan request, not access.",
      },
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      mode: "dry_run",
      action: "request_location_draft",
      contactUrl: expect.stringContaining("/contact/robot-team?"),
      inboundRequestDraft: {
        buyerType: "robot_team",
        commercialRequestPath: "capture_access",
        requestedLanes: ["deeper_evaluation"],
        siteLocation: "Whole Foods near Durham",
        targetSiteType: "grocery retail",
        proofPathPreference: "exact_site_required",
      },
      missingRequiredFields: expect.arrayContaining(["firstName", "lastName", "company", "roleTitle", "email", "budgetBucket"]),
      submitInstructions: {
        explicitSubmitRequired: true,
        defaultWrites: false,
      },
    });
    const contactUrl = new URL(payload.contactUrl, "https://tryblueprint.io");
    expect(contactUrl.searchParams.get("path")).toBe("new-capture");
    expect(contactUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect([...contactUrl.searchParams.keys()]).not.toEqual(
      expect.arrayContaining(["entitlementId", "paymentStatus", "providerRunId", "hostedSessionId"]),
    );
    expect([...collectObjectKeys(payload)]).not.toEqual(
      expect.arrayContaining(["entitlementId", "paymentStatus", "providerRunId", "hostedSessionId"]),
    );
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

  it("routes entitlement readiness through the dry-run agent-access endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        mode: "dry_run",
        entitled: true,
        launchable: true,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await callBlueprintMcpTool(
      "blueprint.commerce.entitlementReadiness",
      {
        siteWorldId: "sw-chi-01",
        entitlementId: "dry-ent-1",
        buyerUserId: "agent-dry-run-buyer",
      },
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/agent-access/commerce/entitlement-readiness?siteWorldId=sw-chi-01&entitlementId=dry-ent-1&buyerUserId=agent-dry-run-buyer",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      mode: "dry_run",
      entitled: true,
      launchable: true,
    });
  });
});
