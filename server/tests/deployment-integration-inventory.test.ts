// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deploymentCanonicalJson, deploymentEmbodimentCatalog } from "../../client/src/lib/deploymentEmbodimentSupport";
import { deploymentIntegrationEvidence, deploymentIntegrationInventory, registryTeamsNamed } from "../utils/deploymentIntegrationInventory";

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

  it("joins a chosen configuration's recorded companies to registry teams by name only", () => {
    const teams = [{ id: "jacobi", name: "Jacobi Robotics" }, { id: "delta", name: " the Delta-Technology " },
      { id: "oem", name: "FANUC" }, { id: "substring", name: "Jacobi" }, { id: "blank", name: "" }];
    expect(registryTeamsNamed(teams, ["Jacobi Robotics", "Delta Technology"]).map(team => team.id)).toEqual(["jacobi", "delta"]);
    expect(registryTeamsNamed(teams, [])).toEqual([]);
    expect(registryTeamsNamed(teams, [" ", "!"])).toEqual([]);
  });
});
