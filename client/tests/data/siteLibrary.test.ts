import { describe, expect, it } from "vitest";
import { siteLibrarySites } from "@/data/siteLibrary";

describe("siteLibrary robot eval publication gate", () => {
  it("requires a complete robot-eval publication package before a site is labeled ready", () => {
    const readySites = siteLibrarySites.filter((site) => site.readiness === "Ready to evaluate");

    expect(readySites.length).toBeGreaterThan(0);
    for (const site of readySites) {
      expect(site.robotEvalPublication?.readyToEvaluatePublishable).toBe(true);
      expect(site.robotEvalPublication?.publicationLabel).toBe("Ready to evaluate");
      expect(site.robotEvalPublication?.taskThresholdSummary.taskThresholdCount).toBeGreaterThan(0);
      expect(site.robotEvalPublication?.artifactUris).toEqual(
        expect.objectContaining({
          manifestUri: expect.stringContaining("/robot_eval_dataset_manifest.json"),
          siteCardUri: expect.stringContaining("/site_card.json"),
          taskCardsUri: expect.stringContaining("/task_cards.json"),
          scenarioCardsUri: expect.stringContaining("/scenario_cards.json"),
          evalCardsUri: expect.stringContaining("/eval_cards.json"),
          proofBoundariesUri: expect.stringContaining("/proof_boundaries.json"),
          taskOntologyUri: expect.stringContaining("/task_ontology_v1.json"),
          scenarioFamilyLibraryUri: expect.stringContaining("/scenario_family_library.json"),
          scoringMethodologyUri: expect.stringContaining("/scoring_methodology.json"),
          taskThresholdsUri: expect.stringContaining("/task_thresholds.json"),
          publicationReadinessUri: expect.stringContaining("/publication_readiness.json"),
          sceneAssetInspectionUri: expect.stringContaining("/scene_asset_inspection.json"),
          sceneFrameEstimateUri: expect.stringContaining("/scene_frame_estimate.json"),
          cpuPreflightScorecardUri: expect.stringContaining("/cpu_preflight_scorecard.json"),
          episodeSpecManifestUri: expect.stringContaining("/episode_spec_manifest.json"),
          cpuSimulatorPreflightManifestUri: expect.stringContaining(
            "/cpu_simulator_preflight_manifest.json",
          ),
        }),
      );
      expect(site.robotEvalPublication?.preflightSummary).toEqual(
        expect.objectContaining({
          episodeSpecLabel: "Episode specs review-required",
          cpuSimulatorLabel: "CPU setup manifests",
          localCpuSmokeRan: false,
          proofBoundaryLabel: "No simulator execution or robot readiness claim",
        }),
      );
      expect(site.defaultRobotEvalSelection).toEqual(
        expect.objectContaining({
          taskId: expect.any(String),
          scenarioId: expect.any(String),
          robotProfileId: expect.any(String),
          policyId: expect.any(String),
        }),
      );
      expect(site.captureLineage).toEqual(
        expect.objectContaining({
          siteSubmissionId: expect.stringContaining(site.slug),
          captureJobId: expect.stringContaining(site.slug),
          captureId: expect.stringContaining(site.slug),
          pipelinePrefix: expect.stringContaining(`/sites/${site.slug}/pipeline`),
        }),
      );
    }
  });
});
