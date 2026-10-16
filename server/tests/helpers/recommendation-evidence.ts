/** Synthetic qualified-scene metadata for local tests only. Never publish as proof. */
import type { RunWithResult } from "../../utils/pilotRecommendationEvidence";

export function syntheticSiteTaskQualification(captureId = "capture-fixture") {
  return { evidenceScope: "simulation" as const, captureId,
    sceneRevisionDigest: `sha256:${"2".repeat(64)}`,
    registrationReceiptDigest: `sha256:${"6".repeat(64)}`,
    fidelityReviewReceiptDigest: `sha256:${"7".repeat(64)}` };
}

export function syntheticEpisodeOutcomes(scored = 200, succeeded = 190) {
  return Array.from({ length: 200 }, (_, index) => ({ cell_id: `fixture-${index}`, family: "placement_approach",
    outcome: index < succeeded ? "success" as const : index < scored ? "failure" as const : "void" as const,
    reason: index < succeeded ? "task_succeeded" : index < scored ? "task_not_completed" : "media_failure" }));
}

export function syntheticQualifiedRun(requestId = "req1", runId = "run-qualified-fixture"): RunWithResult {
  return { runId, sceneId: requestId, teamId: "team-qualified-fixture", checkpointId: "checkpoint-fixture", reservationId: "free-qualified-fixture",
    evaluationPurpose: "pilot", teamEvaluationPurpose: "scored", taskFamily: "rigid_pick_place", executionCaptureId: "capture-fixture",
    quotedUsd: 0, quotedEpisodes: 200, state: "completed", episodesRun: 200, moneyResolved: true,
    requestedAtIso: "2026-10-01T00:00:00Z", resolvedAtIso: "2026-10-02T00:00:00Z", note: null,
    result: { runId, sceneId: requestId, teamId: "team-qualified-fixture", checkpointId: "checkpoint-fixture", evidenceScope: "simulation",
      episodeOutcomes: syntheticEpisodeOutcomes(), scoring: { schemaVersion: "blueprint.agent_run_result_scoring.v1", runtime: "team_evaluation_scored",
        successSource: "simulator_scored", scoredEpisodeCount: 200, successContractDigest: `sha256:${"1".repeat(64)}`,
        sceneRevisionDigest: `sha256:${"2".repeat(64)}`, robotFreeProbeReceiptDigest: `sha256:${"3".repeat(64)}`,
        teamCandidateAdmissionDigest: `sha256:${"4".repeat(64)}`, sessionResultDigest: `sha256:${"5".repeat(64)}`,
        claimCeiling: "site_task_simulation", siteTaskQualification: syntheticSiteTaskQualification() },
      observed: { episodesRun: 200, episodesSucceeded: 190, successRate: 0.95, medianCycleSeconds: null },
      claimed: { demonstratedSuccessRate: "ninety", cycleTime: null }, note: null, artifactUri: null, reportedAtIso: "2026-10-02T00:00:00Z" } };
}
