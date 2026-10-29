// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { deploymentCanonicalJson, deploymentEmbodimentCatalog } from "../../client/src/lib/deploymentEmbodimentSupport";
import { deploymentIntegrationEvidence, deploymentIntegrationInventory } from "../utils/deploymentIntegrationInventory";
import { createSiteAssessmentAgent, renderSourceBoundAssessment, type SiteAssessment } from "../agents/site-assessment";

describe("company-led simulation integration inventory", () => {
  it("preserves every body-policy route and its source without a fixed candidate quota", () => {
    const inventory = deploymentIntegrationInventory([]);
    const expected = deploymentEmbodimentCatalog.embodiments.flatMap(body => body.policy_routes.map(route =>
      `${body.embodiment_id}:${route.route_id}`));
    expect(inventory.configurations.map(row => row.configuration_id)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(10);
    expect(new Set(expected).size).toBe(expected.length);
    expect(inventory.configurations.every(row => row.compatibility_source_url.startsWith("https://"))).toBe(true);
    expect(inventory.catalog_digest).toBe(`sha256:${createHash("sha256").update(deploymentCanonicalJson(deploymentEmbodimentCatalog)).digest("hex")}`);
    expect(inventory).toMatchObject({ claim_ceiling: "planning_only", execution_availability: "not_established_by_catalog",
      execution_status_source: "current_task_pipeline_screening_results", coverage: "catalogued_configurations_not_complete_robot_universe" });
  });

  it("links actual registry names to recorded company associations without inventing OEM or private-policy access", () => {
    const inventory = deploymentIntegrationInventory([
      { id: "dream", name: "DreamLabs" }, { id: "trlc", name: "Robot Learning Company" },
      { id: "oem", name: "Universal Robots" }, { id: "substring", name: "Dream" },
    ]);
    const dreamBodies = inventory.embodiments.filter(body => body.registry_team_ids.includes("dream"));
    expect(dreamBodies.map(body => body.embodiment_id).sort()).toEqual([
      "agilex_piper_bimanual", "franka_research_3_bimanual", "i2rt_yam_bimanual", "kinova_gen3_bimanual",
      "ufactory_xarm7_bimanual", "universal_robots_ur5e_bimanual",
    ]);
    expect(inventory.embodiments.find(body => body.embodiment_id === "trlc_dk1_bimanual")?.registry_team_ids).toEqual(["trlc"]);
    expect(inventory.configurations.some(row => row.registry_team_ids.some(id => ["oem", "substring"].includes(id)))).toBe(false);
    // Bodies not associated with the currently returned teams are still considered.
    expect(inventory.embodiments.find(body => body.embodiment_id === "kuka_lbr_iiwa_14")?.registry_team_ids).toEqual([]);
    expect(inventory.policy_routes.find(route => route.route_id === "pi_api")?.model_id).toBeNull();
    expect(inventory.policy_routes.find(route => route.route_id === "pi_api")?.required_artifacts).toContain("authorized_access_and_usage_terms");
  });

  it("makes the complete inventory available in the real SDK tool loop without promoting it into measured registry facts", async () => {
    let turn = 0;
    const catalogSource = deploymentIntegrationEvidence(deploymentIntegrationInventory([]));
    const assessment: SiteAssessment = {
      status: "assessment", job: [], objects_motions_conditions_variations: [], operator_success: [],
      known: [{ text: "Dream's policy has already run this task.", basis: "published", evidence: [{
        source_id: catalogSource.source_id, at_seconds: null,
        selector: { kind: "qualified_field", observation_index: null,
          field_path: ["configuration_statements", "i2rt_yam_bimanual:dreamlabs_dream1"] },
      }] }],
      estimates: [], missing: [], approaches: [], questions: [],
      next_action: { kind: "research", action: "Bind compatible configurations to the task.",
        why: { text: "Runtime availability remains to be determined.", basis: "unknown", evidence: [] } },
    };
    const model: Model = {
      async getResponse(request): Promise<ModelResponse> {
        turn++;
        if (turn === 1) return { usage: new Usage(), output: [
          { type: "function_call", callId: "registry", name: "read_robot_registry", arguments: "{}" },
        ] };
        expect(JSON.stringify(request.input)).toContain("i2rt_yam_bimanual:dreamlabs_dream1");
        expect(JSON.stringify(request.input)).toContain("not_established_by_catalog");
        return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
          content: [{ type: "output_text", text: JSON.stringify(assessment) }] }] };
      },
      async *getStreamedResponse() { throw new Error("stream_not_used"); },
    };
    const instance = await createSiteAssessmentAgent({ request_id: "fixture",
      operator_messages: [{ id: "owner", text: "Compare compatible robots.", source_ref: "synthetic/operator" }],
      video: null, site_requirement: { spec: {}, serviceArea: null,
        location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
    { model, history_access: null, authorize_model_call: async () => {}, read_robot_teams: async () => [
      { id: "dream", name: " DreamLabs ", status: "prospect", capability: {}, fieldProvenance: {},
        createdAt: "2026-10-29", updatedAt: "2026-10-29" },
      { id: "trlc", name: "Robot Learning Company", status: "prospect", capability: {}, fieldProvenance: {},
        createdAt: "2026-10-29", updatedAt: "2026-10-29" },
    ] });
    const result = await instance.run();
    const receipt = result.tool_receipts.find(row => row.tool === "read_robot_registry")?.result as {
      rows: Array<{ team: { willing_supply: boolean }; integration_configuration_ids: string[] }>;
      integration_inventory: ReturnType<typeof deploymentIntegrationInventory>;
    };
    expect(receipt.rows[0].team.willing_supply).toBe(false);
    expect(receipt.rows[0].integration_configuration_ids).toContain("i2rt_yam_bimanual:dreamlabs_dream1");
    expect(receipt.rows[1].integration_configuration_ids).toContain("trlc_dk1_bimanual:customer_controller");
    expect(receipt.rows[1].integration_configuration_ids).not.toContain("i2rt_yam_bimanual:dreamlabs_dream1");
    expect(receipt.integration_inventory.configurations.length).toBeGreaterThan(10);
    const source = result.sources.find(row => row.source_id === "robotTeam:dream");
    expect(source?.content).not.toHaveProperty("integration_inventory");
    expect(source?.content).toMatchObject({ capability: {}, fieldProvenance: {}, willing_supply: false });
    expect(result.sources.find(row => row.source_id === catalogSource.source_id)).toEqual(catalogSource);
    expect(result.assessment.known[0]).toMatchObject({ basis: "published", verification_status: "source_bound" });
    expect(result.assessment.known[0].text).toContain("Planning only:");
    expect(result.assessment.known[0].text).toContain("does not establish task compatibility, policy access, runtime availability or an executed outcome");
    expect(result.assessment.known[0].text).not.toContain("has already run this task");
    expect(result.raw_model_assessment.known[0].text).toBe("Dream's policy has already run this task.");
    const measured = structuredClone(assessment);
    measured.known[0].basis = "measured";
    expect(renderSourceBoundAssessment(measured, new Map(result.sources.map(row => [row.source_id, row])), null)
      .assessment.known[0]).toMatchObject({ basis: "unknown", verification_status: "unverified" });
    expect(JSON.stringify(receipt).length).toBeLessThan(150_000);
  });
});
