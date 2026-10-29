import { createHash } from "node:crypto";
import {
  deploymentCanonicalJson,
  deploymentEmbodimentCatalog,
} from "../../client/src/lib/deploymentEmbodimentSupport";
import type { RobotTeamRecord } from "../types/robot-team-registry";

// Case, spacing and a leading article do not change the recorded company name.
// Do not match an OEM, a substring or a capability band to a deployment company.
const companyKey = (name: unknown) => typeof name === "string"
  ? name.trim().toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "") : "";

/** Public integration facts for planning; exact task execution remains Pipeline-owned. */
export function deploymentIntegrationInventory(teams: readonly Pick<RobotTeamRecord, "id" | "name">[]) {
  const catalog = structuredClone(deploymentEmbodimentCatalog);
  const embodiments = catalog.embodiments.map(body => ({
    ...body,
    registry_team_ids: [...new Set(teams.filter(team => body.related_teams.some(name =>
      companyKey(name) === companyKey(team.name))).map(team => team.id))].sort(),
  }));
  return {
    schema_version: "blueprint.deployment_integration_inventory.v1" as const,
    claim_ceiling: catalog.claim_ceiling,
    catalog_digest: `sha256:${createHash("sha256").update(deploymentCanonicalJson(catalog)).digest("hex")}`,
    coverage: "catalogued_configurations_not_complete_robot_universe" as const,
    execution_availability: "not_established_by_catalog" as const,
    execution_status_source: "current_task_pipeline_screening_results" as const,
    selection_policy: "every_compatible_configuration_within_budget_each_result_or_reason" as const,
    policy_routes: catalog.policy_routes,
    embodiments,
    configurations: embodiments.flatMap(body => body.policy_routes.map(route => ({
      configuration_id: `${body.embodiment_id}:${route.route_id}`,
      embodiment_id: body.embodiment_id,
      policy_route_id: route.route_id,
      registry_team_ids: body.registry_team_ids,
      compatibility_evidence: route.evidence,
      compatibility_source_url: route.source_url,
    }))),
  };
}
