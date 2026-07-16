// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildRobotAgentOpenApiContract } from "../utils/robot-agent-contract";

describe("robot agent OpenAPI contract", () => {
  it("publishes the headless site-world and hosted-session workflow", () => {
    const contract = buildRobotAgentOpenApiContract();

    expect(contract.openapi).toBe("3.1.0");
    expect(contract.info.title).toContain("Blueprint Robot-Team Agent API");
    expect(contract.paths).toHaveProperty("/api/agent-access");
    expect(contract.paths).toHaveProperty("/api/site-worlds");
    expect(contract.paths).toHaveProperty("/api/site-worlds/search");
    expect(contract.paths).toHaveProperty("/api/site-worlds/{siteWorldId}");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/launch-readiness");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/reset");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/step");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/run-batch");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/control");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/explorer-render");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/export");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/quote");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/dry-run-checkout");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/orders/{orderId}");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/entitlements/{entitlementId}");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/entitlement-readiness");
    expect(contract.paths).toHaveProperty("/api/agent-access/ask");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/live-checkout");
    expect(contract.paths).toHaveProperty("/api/agent-access/commerce/live-orders/{orderId}");

    expect(contract.components.schemas).toHaveProperty("RobotProfile");
    expect(contract.components.schemas).toHaveProperty("SiteWorldSearchResponse");
    expect(contract.components.schemas).toHaveProperty("TaskCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("ScenarioCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("StartStateCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("CreateHostedSessionRequest");
    expect(contract.components.schemas).toHaveProperty("AgentCommerceQuote");
    expect(contract.components.schemas).toHaveProperty("AgentDryRunCheckoutRequest");
    expect(contract.components.schemas).toHaveProperty("AgentDryRunOrderResponse");
    expect(contract.components.schemas).toHaveProperty("AgentEntitlementReadiness");
    expect(contract.components.schemas).toHaveProperty("AgentAskResponse");
    expect(contract.components.schemas).toHaveProperty("AgentLiveCheckoutRequest");
    expect(contract.components.schemas).toHaveProperty("AgentLiveCheckoutResponse");
    expect(contract.components.schemas).toHaveProperty("AgentLiveCheckoutBlockedResponse");
    expect(contract.components.schemas).toHaveProperty("AgentLiveOrderStatus");
    expect(contract.components.schemas).toHaveProperty("AgentAccessManifest");
    expect(contract.components.schemas).toHaveProperty("TruthLabel");
    expect(contract.components.schemas).toHaveProperty("StatusLabel");
    expect(contract.components.securitySchemes).toHaveProperty("BlueprintBearer");
  });

  it("documents explainable public site-world catalog search", () => {
    const contract = buildRobotAgentOpenApiContract();
    const searchOperation = contract.paths["/api/site-worlds/search"].get;

    expect(searchOperation.security).toEqual([{}]);
    expect(searchOperation.operationId).toBe("searchSiteWorlds");
    expect(JSON.stringify(searchOperation.parameters)).toContain("objectTags");
    expect(JSON.stringify(searchOperation.parameters)).toContain("warehouse tote");
    expect(JSON.stringify(contract.components.schemas.SiteWorldSearchResult)).toContain("matchedAliases");
    expect(JSON.stringify(contract.components.schemas.SiteWorldSearchResponse)).toContain("requestCandidate");
    expect(JSON.stringify(contract.components.schemas.SiteWorldSearchRequestCandidate)).toContain("source");
    expect(JSON.stringify(searchOperation)).toContain("blueprint.siteWorld.search");
    expect(JSON.stringify(searchOperation)).toContain("does not grant hosted-session access");
  });

  it("keeps protected write endpoints behind bearer auth while documenting public demo eligibility", () => {
    const contract = buildRobotAgentOpenApiContract();
    const createOperation = contract.paths["/api/site-worlds/sessions"].post;
    const protectedOperation = contract.paths["/api/site-worlds/sessions/{sessionId}/reset"].post;

    expect(createOperation.security).toContainEqual({ BlueprintBearer: [] });
    expect(createOperation["x-blueprint-public-demo"]).toBe(true);
    expect(protectedOperation.security).toEqual([{ BlueprintBearer: [] }]);
    expect(JSON.stringify(contract)).toContain("public_demo_eligible");
    expect(JSON.stringify(contract)).toContain("capture_grounded");
    expect(JSON.stringify(contract)).toContain("provider_derived");
  });

  it("labels commerce endpoints as dry-run only and entitlement backed", () => {
    const contract = buildRobotAgentOpenApiContract();
    const quoteOperation = contract.paths["/api/agent-access/commerce/quote"].get;
    const checkoutOperation = contract.paths["/api/agent-access/commerce/dry-run-checkout"].post;
    const readinessOperation = contract.paths["/api/agent-access/commerce/entitlement-readiness"].get;

    expect(quoteOperation.tags).toContain("Agent commerce");
    expect(checkoutOperation["x-blueprint-dry-run-only"]).toBe(true);
    expect(checkoutOperation.summary).toMatch(/dry-run/i);
    expect(readinessOperation.summary).toMatch(/entitlement/i);
    expect(JSON.stringify(contract)).toContain("dry_run_order");
    expect(JSON.stringify(contract)).toContain("hosted_session_rental");
    expect(JSON.stringify(contract)).toContain("site_world_package");
  });

  it("documents live agent commerce with budget guard and ask as grounded public endpoints", () => {
    const contract = buildRobotAgentOpenApiContract();
    const liveCheckoutOperation = contract.paths["/api/agent-access/commerce/live-checkout"].post;
    const liveOrderOperation = contract.paths["/api/agent-access/commerce/live-orders/{orderId}"].get;
    const askOperation = contract.paths["/api/agent-access/ask"].get;

    expect(liveCheckoutOperation.tags).toContain("Live agent commerce");
    expect(liveCheckoutOperation["x-blueprint-live-stripe"]).toBe(true);
    expect(JSON.stringify(liveCheckoutOperation)).toContain("budgetCents");
    expect(JSON.stringify(liveCheckoutOperation)).toContain("pipeline-backed");
    expect(liveOrderOperation["x-blueprint-live-stripe"]).toBe(true);
    expect(askOperation.security).toEqual([{}]);
    expect(JSON.stringify(askOperation)).toContain("blueprint.ask");
    expect(JSON.stringify(contract)).toContain("live_checkout");
    expect(JSON.stringify(contract.components.schemas.AgentLiveCheckoutBlocker)).toContain("budget_exceeded");
  });

  it("documents the credential-free discovery/search/mock-demo path and all truth labels", () => {
    const contract = buildRobotAgentOpenApiContract();
    const discoveryOperation = contract.paths["/api/agent-access"].get;

    expect(discoveryOperation.security).toEqual([{}]);
    expect(discoveryOperation.operationId).toBe("discoverAgentAccess");
    expect(JSON.stringify(discoveryOperation)).toContain("blueprint.siteWorld.search");
    expect(JSON.stringify(discoveryOperation)).toContain("without credentials");
    expect(JSON.stringify(contract.components.schemas.AgentAccessManifest)).toContain("publicDemo");
    expect(JSON.stringify(contract.components.schemas.AgentAccessManifest)).toContain("credentiallessWorkflow");
    expect(contract["x-blueprint-truth-labels"]).toEqual([
      "capture_grounded",
      "provider_derived",
      "generated",
      "sample_demo",
      "public_demo_eligible",
      "request_gated",
      "protected_robot_team",
      "dry_run_order",
      "live_checkout",
    ]);
  });
});
