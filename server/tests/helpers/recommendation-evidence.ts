/** Synthetic qualified-scene metadata for local tests only. Never publish as proof. */
import { qualifiedReceipt } from "./siteTaskQualificationReceipt";
import type { RunWithResult } from "../../utils/pilotRecommendationEvidence";

export function syntheticQualifiedAdmission(captureId = "capture-fixture", requestId = "req1") {
  const receipt = qualifiedReceipt({ binding: { capture_id: captureId, scene_request_id: requestId } });
  return { digestSha256: `sha256:${"a".repeat(64)}`, envelope: {
    evidence_scope: "simulation", site_task_qualification: receipt.qualification,
    site_task_qualification_receipt: receipt,
    binding: { capture_id: captureId, scene_request_id: requestId, site_id: receipt.binding.site_id,
      task_id: receipt.binding.task_id, capture_digest_sha256: receipt.binding.source_capture_digest,
      testbed_digest_sha256: receipt.binding.testbed_digest_sha256 },
  } };
}

export function syntheticSiteTaskQualification(captureId = "capture-fixture", requestId = "req1") {
  const q = syntheticQualifiedAdmission(captureId, requestId).envelope.site_task_qualification;
  return { evidenceScope: "simulation" as const, captureId: q.capture_id,
    sceneRevisionDigest: q.scene_revision_digest, registrationReceiptDigest: q.registration_receipt_digest,
    fidelityReviewReceiptDigest: q.fidelity_review_receipt_digest };
}

export function syntheticEpisodeOutcomes(scored = 200, succeeded = 190) {
  return Array.from({ length: 200 }, (_, index) => ({ cell_id: `fixture-${index}`, family: "placement_approach",
    outcome: index < succeeded ? "success" as const : index < scored ? "failure" as const : "void" as const,
    reason: index < succeeded ? "task_succeeded" : index < scored ? "task_not_completed" : "media_failure" }));
}

export function syntheticQualifiedRun(requestId = "req1", runId = "run-qualified-fixture"): RunWithResult {
  return { runId, sceneId: requestId, teamId: "team-qualified-fixture", checkpointId: "checkpoint-fixture", reservationId: "free-qualified-fixture",
    evaluationPurpose: "pilot", teamEvaluationPurpose: "scored", taskFamily: "rigid_pick_place", executionCaptureId: "capture-fixture",
    executionAdmission: syntheticQualifiedAdmission("capture-fixture", requestId),
    quotedUsd: 0, quotedEpisodes: 200, state: "completed", episodesRun: 200, moneyResolved: true,
    requestedAtIso: "2026-10-01T00:00:00Z", resolvedAtIso: "2026-10-02T00:00:00Z", note: null,
    result: { runId, sceneId: requestId, teamId: "team-qualified-fixture", checkpointId: "checkpoint-fixture", evidenceScope: "simulation",
      episodeOutcomes: syntheticEpisodeOutcomes(), scoring: { schemaVersion: "blueprint.agent_run_result_scoring.v1", runtime: "team_evaluation_scored",
        successSource: "simulator_scored", scoredEpisodeCount: 200, successContractDigest: `sha256:${"1".repeat(64)}`,
        sceneRevisionDigest: `sha256:${"2".repeat(64)}`, robotFreeProbeReceiptDigest: `sha256:${"3".repeat(64)}`,
        teamCandidateAdmissionDigest: `sha256:${"4".repeat(64)}`, sessionResultDigest: `sha256:${"5".repeat(64)}`,
        claimCeiling: "site_task_simulation", siteTaskQualification: syntheticSiteTaskQualification("capture-fixture", requestId) },
      observed: { episodesRun: 200, episodesSucceeded: 190, successRate: 0.95, medianCycleSeconds: null },
      claimed: { demonstratedSuccessRate: "ninety", cycleTime: null }, note: null, artifactUri: null, reportedAtIso: "2026-10-02T00:00:00Z" } };
}
