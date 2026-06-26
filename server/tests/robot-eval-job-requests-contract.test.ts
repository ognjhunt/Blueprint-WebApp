// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildRobotEvalJobRequest,
  validateRobotEvalJobRequest,
} from "../utils/robotEvalJobRequests";

const REQUIRED_PIPELINE_OUTPUTS = [
  "scenario_eval_matrix.json",
  "policy_ranking_scorecard.json",
  "candidate_selection_report.json",
  "wam_eval_claim_boundary.json",
  "post_training_data_package_export_manifest.json",
  "proof_boundary.json",
  "proof_boundaries.json",
];

function buildValidRequest() {
  return buildRobotEvalJobRequest({
    sitePackage: {
      siteSlug: "sw-chi-01",
      siteId: "site-sw-chi-01",
      siteName: "Harborview Grocery Distribution Annex",
      siteSubmissionId: "site-submission-sw-chi-01",
      captureJobId: "capture-job-sw-chi-01",
      captureId: "capture-sw-chi-01",
      captureRoot: "gs://blueprint/site-packages/sw-chi-01",
      accessState: "request_gated",
      artifactUris: {
        manifestUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json",
        taskThresholdsUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_thresholds.json",
        publicationReadinessUri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/publication_readiness.json",
      },
      publication: {
        readyToEvaluatePublishable: true,
        publicationLabel: "Ready to evaluate",
      },
    },
    selection: {
      taskId: "place_return_in_bin",
      scenarioId: "scenario_place_return_in_bin_mobile",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "policy-api-fixture",
    },
    robotTeam: {
      customerId: "robot-team-a",
      companyName: "Robot Team A",
    },
    entitlement: {
      accessState: "request_gated",
      approved: true,
    },
    policySubmission: {
      policy_api_endpoint: {
        endpoint_url: "https://robot-team.example/policy",
        observation_schema_ref: "gs://robot-team/schemas/obs.json",
        action_schema_ref: "gs://robot-team/schemas/action.json",
      },
    },
    source: {
      route: "/sites/sw-chi-01",
      surface: "sites",
    },
  }) as Record<string, any>;
}

describe("robot eval job request artifact contract validation", () => {
  it("emits the Pipeline-owned ranking, PTDP, scenario, and proof-boundary outputs", () => {
    const request = buildValidRequest();
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
    expect(validateRobotEvalJobRequest(request)).toEqual({ ok: true, errors: [] });
  });

  it("rejects missing Pipeline outputs and unsafe artifact-contract boundaries", () => {
    const request = buildValidRequest();
    request.execution_request.artifact_contract.expected_outputs =
      request.execution_request.artifact_contract.expected_outputs.filter(
        (output: string) => output !== "policy_ranking_scorecard.json",
      );
    request.execution_request.artifact_contract.webapp_queues_and_forwards_only = false;
    request.execution_request.artifact_contract.pipeline_owns_execution_ranking_and_artifacts =
      false;
    request.execution_request.artifact_contract.ranking_outputs_are_advisory_until_owner_system_proof =
      false;
    request.execution_request.artifact_contract.ptdp_export_manifest_does_not_prove_delivery_or_training =
      false;

    const validation = validateRobotEvalJobRequest(request);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "execution_request.artifact_contract.expected_outputs must include policy_ranking_scorecard.json",
        "execution_request.artifact_contract.webapp_queues_and_forwards_only must be true",
        "execution_request.artifact_contract.pipeline_owns_execution_ranking_and_artifacts must be true",
        "execution_request.artifact_contract.ranking_outputs_are_advisory_until_owner_system_proof must be true",
        "execution_request.artifact_contract.ptdp_export_manifest_does_not_prove_delivery_or_training must be true",
      ]),
    );
  });

  it("rejects requests that omit the execution artifact contract", () => {
    const missingExecutionRequest = buildValidRequest();
    delete missingExecutionRequest.execution_request;

    expect(validateRobotEvalJobRequest(missingExecutionRequest)).toEqual({
      ok: false,
      errors: ["execution_request is required"],
    });

    const missingArtifactContract = buildValidRequest();
    delete missingArtifactContract.execution_request.artifact_contract;

    const validation = validateRobotEvalJobRequest(missingArtifactContract);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "execution_request.artifact_contract is required when execution_request is provided",
    );
  });
});
