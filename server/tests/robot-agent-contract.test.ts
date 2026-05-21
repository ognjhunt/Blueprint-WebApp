// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildRobotAgentOpenApiContract } from "../utils/robot-agent-contract";

describe("robot agent OpenAPI contract", () => {
  it("publishes the headless site-world and hosted-session workflow", () => {
    const contract = buildRobotAgentOpenApiContract();

    expect(contract.openapi).toBe("3.1.0");
    expect(contract.info.title).toContain("Blueprint Robot-Team Agent API");
    expect(contract.paths).toHaveProperty("/api/site-worlds");
    expect(contract.paths).toHaveProperty("/api/site-worlds/{siteWorldId}");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/launch-readiness");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/reset");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/step");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/run-batch");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/control");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/explorer-render");
    expect(contract.paths).toHaveProperty("/api/site-worlds/sessions/{sessionId}/export");

    expect(contract.components.schemas).toHaveProperty("RobotProfile");
    expect(contract.components.schemas).toHaveProperty("TaskCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("ScenarioCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("StartStateCatalogEntry");
    expect(contract.components.schemas).toHaveProperty("CreateHostedSessionRequest");
    expect(contract.components.schemas).toHaveProperty("TruthLabel");
    expect(contract.components.schemas).toHaveProperty("StatusLabel");
    expect(contract.components.securitySchemes).toHaveProperty("BlueprintBearer");
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
});
