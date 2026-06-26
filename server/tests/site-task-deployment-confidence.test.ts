// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildSiteTaskDeploymentConfidencePackage,
  type SiteTaskDeploymentConfidenceInput,
} from "../utils/site-task-deployment-confidence";

function visualReviewFixture(overrides: Partial<SiteTaskDeploymentConfidenceInput> = {}): SiteTaskDeploymentConfidenceInput {
  return {
    identity: {
      siteWorldId: "sw-harborview-robot-01",
      sceneId: "scene-harborview-grocery-annex",
      captureId: "cap-harborview-grocery-annex-v1",
      siteSubmissionId: "site-sub-harborview-grocery-annex",
      buyerRequestId: "buyer-req-humanoid-pick-01",
      captureJobId: "capture-job-harborview-01",
      ...overrides.identity,
    },
    captureProvenance: {
      rawManifestUri: "gs://capture/scene/raw_bundle_manifest.json",
      provenanceUri: "gs://capture/scene/provenance.json",
      rightsConsentUri: "gs://capture/scene/rights_consent.json",
      captureUploadCompleteUri: "gs://capture/scene/capture_upload_complete.json",
      hashesUri: "gs://capture/scene/hashes.json",
      walkthroughVideoUri: "gs://capture/scene/walkthrough.mp4",
      poseEvidence: "gs://capture/scene/poses.json",
      intrinsicsEvidence: "gs://capture/scene/intrinsics.json",
      depthEvidence: "gs://capture/scene/depth.json",
      motionEvidence: "gs://capture/scene/motion.json",
      privacyStatus: "privacy_safe",
      rightsStatus: "derived_generation_allowed",
      ...overrides.captureProvenance,
    },
    pipelinePackage: {
      packageManifestUri: "gs://pipeline/scene/package_manifest.json",
      hostedSessionArtifactUri: "gs://pipeline/scene/hosted_artifact.json",
      geometrySource: "local_sfm",
      fallbackGeometryUsed: false,
      providerNativeGeometryReady: false,
      siteReferenceManifestUri: "gs://pipeline/scene/site_reference_manifest.json",
      privacySafeMediaUri: "gs://pipeline/scene/privacy_safe_media.json",
      ...overrides.pipelinePackage,
    },
    worldModelEval: {
      claimPolicy: "capture_grounded_local_preflight_only",
      providerJobsCalled: false,
      modelDownloadRequired: false,
      cosmos3ReadinessUri: "gs://pipeline/scene/cosmos3_readiness.json",
      heldOutValidationUri: "gs://pipeline/scene/held_out_validation.json",
      actionEvidenceUri: undefined,
      generatedOutputsLabeledDerived: true,
      blockedClaims: [],
      ...overrides.worldModelEval,
    },
    robotTask: {
      taskId: "task-pick-blue-tote",
      taskStatement: "Move from dock staging to shelf bay 3 and pick the blue tote.",
      robotProfileId: "digit-like-biped-v1",
      scenarioId: "scenario-normal-lighting",
      startStateId: "start-dock-staging",
      ...overrides.robotTask,
    },
    deploymentEvidence: {
      simTraceUri: undefined,
      actionLogUri: undefined,
      robotTrialUri: undefined,
      safetyReviewUri: undefined,
      operatorApprovalUri: undefined,
      rightsClearanceUri: undefined,
      hostedRuntimeProofUri: undefined,
      ...overrides.deploymentEvidence,
    },
    claimIntent: overrides.claimIntent || ["visual_review"],
  };
}

describe("site/task robot deployment confidence package", () => {
  it("builds a local visual world-model review packet without provider jobs or model downloads", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(visualReviewFixture(), {
      generatedAt: "2026-06-02T12:00:00.000Z",
    });

    expect(packet.schema_version).toBe("site_task_robot_deployment_confidence_package.v1");
    expect(packet.generated_at).toBe("2026-06-02T12:00:00.000Z");
    expect(packet.state).toBe("visual_world_model_review_ready");
    expect(packet.no_live_side_effects).toEqual({
      provider_jobs_called: false,
      model_download_required: false,
      deployments_started: false,
      sends_attempted: false,
      payments_attempted: false,
    });
    expect(packet.allowed_claims).toContain(
      "capture-grounded visual world-model review package is ready for human inspection",
    );
    expect(packet.forbidden_claims).toContain("public robot rank-fidelity-scored claim");
    expect(packet.forbidden_claims).toContain("contact, collision, safety, or manipulation readiness claim");
    expect(packet.next_evidence_moves).toContain(
      "Attach simulator traces, action logs, or robot-trial records before deployment confidence claims.",
    );
  });

  it("treats real-site robot eval cards as advisory review evidence without held-out validation", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        worldModelEval: {
          heldOutValidationUri: undefined,
          robotEvalDataset: {
            manifestUri: "gs://pipeline/scene/robot_eval_dataset/robot_eval_dataset_manifest.json",
            siteCardUri: "gs://pipeline/scene/robot_eval_dataset/site_card.json",
            taskCardsUri: "gs://pipeline/scene/robot_eval_dataset/task_cards.json",
            scenarioCardsUri: "gs://pipeline/scene/robot_eval_dataset/scenario_cards.json",
            evalCardsUri: "gs://pipeline/scene/robot_eval_dataset/eval_cards.json",
            annotationBacklogUri: "gs://pipeline/scene/robot_eval_dataset/annotation_backlog.json",
            proofBoundariesUri: "gs://pipeline/scene/robot_eval_dataset/proof_boundaries.json",
            datasetState: "v0_1_card_family_present",
            datasetStatuses: ["capture_grounded_ready", "needs_action_logs"],
          },
        },
      }),
    );

    expect(packet.state).toBe("visual_world_model_review_ready");
    expect(packet.evidence.world_model_eval.present).toContain("robot_eval_card_family_complete");
    expect(packet.allowed_claims).toContain(
      "real-site robot evaluation card workflow is assembled for advisory review",
    );
    expect(packet.forbidden_claims).toContain(
      "Site, Task, Scenario, or Eval Cards as operational robot proof",
    );
    expect(packet.forbidden_claims).toContain("robot action-policy readiness");
    expect(packet.warnings).toContain("Robot eval dataset status: needs_action_logs");
  });

  it("blocks robot eval dataset flags that try to stand in for owner-system proof", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        worldModelEval: {
          robotEvalDataset: {
            manifestUri: "gs://pipeline/scene/robot_eval_dataset/robot_eval_dataset_manifest.json",
            siteCardUri: "gs://pipeline/scene/robot_eval_dataset/site_card.json",
            taskCardsUri: "gs://pipeline/scene/robot_eval_dataset/task_cards.json",
            scenarioCardsUri: "gs://pipeline/scene/robot_eval_dataset/scenario_cards.json",
            evalCardsUri: "gs://pipeline/scene/robot_eval_dataset/eval_cards.json",
            proofBoundariesUri: "gs://pipeline/scene/robot_eval_dataset/proof_boundaries.json",
            simulatorExecutionProven: true,
            robotPolicyExecutionProven: true,
            safetyValidationProven: true,
          },
        },
      }),
    );

    expect(packet.state).toBe("blocked");
    expect(packet.blockers).toContain(
      "WebApp advisory evaluator cannot upgrade robot-eval cards into simulator execution proof.",
    );
    expect(packet.blockers).toContain(
      "WebApp advisory evaluator cannot upgrade robot-eval cards into robot policy execution proof.",
    );
    expect(packet.blockers).toContain(
      "WebApp advisory evaluator cannot upgrade robot-eval cards into off-scope validation proof.",
    );
  });

  it("keeps fallback geometry out of visual world-model and robot policy confidence", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        pipelinePackage: {
          geometrySource: "fallback_geometry",
          fallbackGeometryUsed: true,
        },
      }),
    );

    expect(packet.state).toBe("capture_review_ready");
    expect(packet.blockers).toContain(
      "Fallback geometry cannot support visual world-model or robot action confidence claims.",
    );
    expect(packet.forbidden_claims).toContain("visual world-model or robot policy confidence from fallback geometry");
  });

  it("does not upgrade a visual package into robot action-policy readiness without action or runtime evidence", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        claimIntent: ["robot_action_policy"],
      }),
    );

    expect(packet.state).toBe("visual_world_model_review_ready");
    expect(packet.warnings).toContain(
      "Requested robot action-policy intent needs action evidence and simulator or robot-trial proof.",
    );
    expect(packet.forbidden_claims).toContain("robot action-policy readiness");
  });

  it("blocks packages that are missing capture provenance and rights records", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        captureProvenance: {
          provenanceUri: undefined,
          rightsConsentUri: undefined,
          captureUploadCompleteUri: undefined,
          privacyStatus: "unknown",
          rightsStatus: "unknown",
        },
      }),
    );

    expect(packet.state).toBe("blocked");
    expect(packet.evidence.capture_provenance.status).toBe("blocked");
    expect(packet.blockers).toContain("Capture provenance record is required for site/task confidence.");
    expect(packet.blockers).toContain("Rights and consent record is required before buyer or rank-fidelity claims.");
    expect(packet.blockers).toContain("Capture upload completion proof is required before downstream readiness.");
    expect(packet.forbidden_claims).toContain("rights-cleared public or commercial deployment claim");
  });

  it("rejects rank-fidelity-scored public intent without full owner-system proof", () => {
    const packet = buildSiteTaskDeploymentConfidencePackage(
      visualReviewFixture({
        worldModelEval: {
          actionEvidenceUri: "gs://pipeline/scene/action_evidence.json",
        },
        deploymentEvidence: {
          simTraceUri: "gs://pipeline/scene/sim_trace.json",
          actionLogUri: "gs://pipeline/scene/action_log.json",
        },
        claimIntent: ["public_deployment_ready", "contact_collision_eval"],
      }),
    );

    expect(packet.state).toBe("deployment_confidence_advisory");
    expect(packet.allowed_claims).toContain("site/task deployment confidence advisory is available for human review");
    expect(packet.forbidden_claims).toContain("public robot rank-fidelity-scored claim");
    expect(packet.forbidden_claims).toContain("contact, collision, safety, or manipulation readiness claim");
    expect(packet.warnings).toContain("Requested public rank-fidelity-scored intent is not supported by this packet.");
    expect(packet.warnings).toContain("Requested contact/collision intent needs owner runtime proof.");
  });
});
