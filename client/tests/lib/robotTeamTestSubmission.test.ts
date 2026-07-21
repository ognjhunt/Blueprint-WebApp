import { describe, expect, it } from "vitest";

import {
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
} from "@/lib/robotTeamTestSubmission";

describe("robotTeamTestSubmission", () => {
  it("keeps submitted policy references inside explicit review boundaries", () => {
    const submission = normalizeRobotTeamTestSubmission({
      submissionId: "submission-1",
      siteWorldId: "pipeline-site-1",
      taskId: "task-1",
      scenarioId: "scenario-1",
      robotProfileId: "robot-1",
      modalities: {
        policy_api_endpoint: {
          selected: true,
          fields: {
            endpointUrl: "https://policy.example.com/v1/action",
            authHandling: "Owner-managed secret reference",
            observationSchemaRef: "gs://owner/schemas/observation.json",
            actionSchemaRef: "gs://owner/schemas/action.json",
            runtimeConstraints: "200 ms p95",
            callbackLogUri: "gs://owner/callbacks/",
            ownerContact: "owner@example.com",
          },
        },
      },
    });

    expect(ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS).toHaveLength(7);
    expect(submission.selectedModalities).toEqual(["policy_api_endpoint"]);
    expect(submission.proofBoundary).toEqual(expect.objectContaining({
      submittedArtifactsAre: "artifact_references_only",
      submittedArtifactsDoNotProve: expect.arrayContaining([
        "simulator run completion",
        "policy pass/fail outcome",
      ]),
    }));
  });
});
