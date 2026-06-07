import { describe, expect, it } from "vitest";
import {
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
} from "@/lib/robotTeamTestSubmission";

describe("robotTeamTestSubmission", () => {
  it("normalizes all six modalities and keeps references inside proof boundaries", () => {
    const submission = normalizeRobotTeamTestSubmission({
      submissionId: "submission-1",
      siteWorldId: "siteworld-f5fd54898cfb",
      taskId: "task-1",
      scenarioId: "scenario-1",
      robotProfileId: "robot-1",
      modalities: {
        policy_api_endpoint: {
          selected: true,
          fields: {
            endpointUrl: "https://robot-team.example/policy",
            authHandling: "secret ref only",
            observationSchemaRef: "gs://robot-team/schemas/obs.json",
            actionSchemaRef: "gs://robot-team/schemas/action.json",
            runtimeConstraints: "200 ms p95",
            callbackLogUri: "gs://robot-team/logs/",
            ownerContact: "owner@example.com",
          },
        },
        docker_container: {
          selected: true,
          fields: {
            imageRef: "registry.example.com/team/policy:latest",
          },
        },
      },
    });

    expect(submission?.schemaVersion).toBe("blueprint.robot_team_test_submission.v1");
    expect(Object.keys(submission?.modalities || {})).toHaveLength(
      ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.length,
    );
    expect(submission?.selectedModalities).toEqual([
      "policy_api_endpoint",
      "docker_container",
    ]);
    expect(submission?.modalities.policy_api_endpoint.reviewStatus).toBe("ready_for_review");
    expect(submission?.modalities.docker_container.reviewStatus).toBe("missing_required_refs");
    expect(submission?.missingEvidenceStatuses).toEqual(["needs_docker_container_ref"]);
    expect(submission?.pipelineDatasetSchemaRefs).toContain(
      "robot_team_test_submission_modalities.v0.1",
    );
    expect(submission?.proofBoundary.submittedArtifactsAre).toBe("artifact_references_only");
    expect(submission?.proofBoundary.blockedClaimUpgrades).toContain(
      "policy_execution_passed_claim",
    );
    expect(submission?.proofBoundary.operationalReadinessRequires).toContain(
      "robot profile with geometry, sensors, controllers, and control level, or a clear site-feasibility-only scope",
    );
  });
});
