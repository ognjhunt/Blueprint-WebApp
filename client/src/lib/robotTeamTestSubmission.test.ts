import { describe, expect, it } from "vitest";
import {
  buildRobotTeamSubmissionInput,
  normalizeRobotTeamTestSubmission,
} from "./robotTeamTestSubmission";

describe("robot-team test submission", () => {
  it("normalizes run setup fields and model checkpoint modality", () => {
    const submission = normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        siteWorldId: "siteworld-1",
        taskId: "task-1",
        scenarioId: "scenario-1",
        robotProfileId: "robot-1",
        policyLabels: [
          " primary ",
          "",
          "baseline",
          "primary",
          "ablation",
          "ignored",
        ],
        episodeCount: "custom",
        customEpisodeCount: "250",
        validationMode: "comparative_policy_eval",
        hardwareIntegrationMode: "private_asset_hosted_by_blueprint",
        siteIpProtectionLevel: "blueprint_hosted",
        robotEmbodimentPackRef: "s3://team/private/embodiment-pack.json",
        observationSchemaRef: "gs://team/schemas/obs.json",
        actionSchemaRef: "gs://team/schemas/action.json",
        controlFrequency: "20 Hz",
        robotEmbodiment: "mobile manipulator",
        gripper: "parallel jaw",
        cameraSetup: "wrist RGB-D + mast stereo",
        intrinsicsExtrinsicsRef: "gs://team/calibration/cameras.json",
        sitePackageTarget: "cold-storage package",
        taskInstruction: "pick tote from shelf",
        startStateConstraints: "robot starts at aisle entry",
        successCriteria: "tote placed without safety event",
        modalities: {
          model_checkpoint: {
            selected: true,
            fields: {
              artifactUri: "gs://team/checkpoints/policy.pt",
              digestChecksum: "sha256:checkpoint",
              frameworkRuntime: "PyTorch 2.4 / CUDA 12.4",
              modelCardPolicyInterfaceNotes: "gs://team/cards/policy.md",
              observationSchemaRef: "gs://team/schemas/obs.json",
              actionSchemaRef: "gs://team/schemas/action.json",
              ownerContact: "owner@example.com",
            },
          },
        },
      }),
    );

    expect(submission?.policyLabels).toEqual([
      "primary",
      "baseline",
      "ablation",
    ]);
    expect(submission?.episodeCount).toBe("custom");
    expect(submission?.customEpisodeCount).toBe("250");
    expect(submission?.validationMode).toBe("comparative_policy_eval");
    expect(submission?.hardwareIntegrationMode).toBe("private_asset_hosted_by_blueprint");
    expect(submission?.siteIpProtectionLevel).toBe("blueprint_hosted");
    expect(submission?.robotEmbodimentPackRef).toBe(
      "s3://team/private/embodiment-pack.json",
    );
    expect(submission?.privateHardwareIntegration.customerHardwareControls).toMatchObject({
      customerPrivateRobotAssetsRequiredByBlueprint: true,
      blueprintHostsCustomerRobotAsset: true,
      customerPrivateRobotModelMayRemainCustomerSide: false,
    });
    expect(submission?.privateHardwareIntegration.blueprintIpControls).toMatchObject({
      rawCaptureBundleSharedWithCustomer: false,
      fullResolutionSceneMeshSharedByDefault: false,
      fullScoringHarnessSharedByDefault: false,
    });
    expect(submission?.observationSchemaRef).toBe("gs://team/schemas/obs.json");
    expect(submission?.actionSchemaRef).toBe("gs://team/schemas/action.json");
    expect(submission?.controlFrequency).toBe("20 Hz");
    expect(submission?.robotEmbodiment).toBe("mobile manipulator");
    expect(submission?.gripper).toBe("parallel jaw");
    expect(submission?.cameraSetup).toBe("wrist RGB-D + mast stereo");
    expect(submission?.intrinsicsExtrinsicsRef).toBe(
      "gs://team/calibration/cameras.json",
    );
    expect(submission?.sitePackageTarget).toBe("cold-storage package");
    expect(submission?.taskInstruction).toBe("pick tote from shelf");
    expect(submission?.startStateConstraints).toBe(
      "robot starts at aisle entry",
    );
    expect(submission?.successCriteria).toBe(
      "tote placed without safety event",
    );
    expect(submission?.selectedModalities).toEqual(["model_checkpoint"]);
    expect(submission?.modalities.model_checkpoint.reviewStatus).toBe(
      "ready_for_review",
    );
    expect(submission?.requestedOutputs).toEqual([
      "observation_frames",
      "action_trace",
      "success_failure",
      "export_bundle",
    ]);
  });
});
