import { describe, expect, it } from "vitest";

import { siteLibrarySites } from "@/data/siteLibrary";
import { buildRobotEvalJobRequestFromSite } from "@/lib/robotEvalJobRequest";

const REQUIRED_PIPELINE_OUTPUTS = [
  "scenario_eval_matrix.json",
  "policy_ranking_scorecard.json",
  "candidate_selection_report.json",
  "wam_eval_claim_boundary.json",
  "post_training_data_package_export_manifest.json",
  "proof_boundary.json",
  "proof_boundaries.json",
];

describe("robot eval job request artifact contract", () => {
  it("names Pipeline-owned ranking, PTDP, scenario, and proof-boundary outputs", () => {
    const site = siteLibrarySites.find((candidate) => candidate.robotEvalPublication);
    expect(site).toBeTruthy();

    const request = buildRobotEvalJobRequestFromSite(site!, {
      route: "/sites/test",
      surface: "site-detail",
    }) as Record<string, any>;
    const artifactContract = request.execution_request.artifact_contract;

    expect(artifactContract.expected_outputs).toEqual(
      expect.arrayContaining(REQUIRED_PIPELINE_OUTPUTS),
    );
    expect(artifactContract).toMatchObject({
      webapp_queues_and_forwards_only: true,
      pipeline_owns_execution_ranking_and_artifacts: true,
      startup_artifacts_are_advisory_until_owner_runtime_proof: true,
      ranking_outputs_are_advisory_until_owner_system_proof: true,
      ptdp_export_manifest_does_not_prove_delivery_or_training: true,
      simulator_execution_proven_by_webapp: false,
      public_claim_upgrade_allowed: false,
    });
  });
});
