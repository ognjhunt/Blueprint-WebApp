// @vitest-environment node
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import {
  verifyPolicyCanaryEpisodeInterpretationSidecar,
} from "../utils/policyCanaryEpisodeInterpretationSidecar";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const recordId = "capture-run-c257ae6e11a18e883637739477e5ded8";

function publication() {
  const value = structuredClone(fixture) as Record<string, any>;
  value.result_status = "completed_unqualified";
  value.result_delivery.result_status = "completed_unqualified";
  value.policy_canary_result.result_status = "completed_unqualified";
  value.policy_canary_result.counts.completed_learned_policy_rollout_count = 20;
  value.policy_canary_result.notification_delivery.terminal_state = "completed";
  value.policy_canary_result.blockers = [];
  value.policy_canary_result.episodes = Array.from({ length: 20 }, (_, index) => {
    const candidate_id = index < 10 ? "pi05_droid" : "groot_n17_droid";
    const cell = index % 10;
    return {
      episode_id: `episode-${index}`,
      candidate_id,
      cell_id: `scene839873.quick10.${String(cell).padStart(2, "0")}.canonical_anchor`,
      seed: 1_000 + cell,
      terminal_state: "completed",
      candidate_policy_queried: true,
      actions_reached_robot: true,
      arm_moved: true,
      policy_outcome_interpretable: true,
      failure_taxonomy: null,
      evidence: {
        checkpoint_digest: "sha256:" + "1".repeat(64),
        runtime_identity_digest: "sha256:" + "2".repeat(64),
        reset_state_digest: "sha256:" + "3".repeat(64),
        reset_state: null,
        frame_manifest: null,
        review_video: null,
        policy_query_receipt: null,
        action_sequence: null,
        action_delivery_readback: null,
        state_trace: null,
        contact_force_trace: null,
        task_object_trajectory: null,
        score_receipt: null,
        evidence_gaps: [],
      },
    };
  });
  value.result_delivery.delivery_digest = canonicalArtifactDigest(
    value.result_delivery,
    "delivery_digest",
  );
  value.policy_canary_result.result_delivery_digest =
    value.result_delivery.delivery_digest;
  value.policy_canary_result.projection_digest = canonicalArtifactDigest(
    value.policy_canary_result,
    "projection_digest",
  );
  const parsed = parsePipelinePolicyCanaryPublication(value);
  if (!parsed.ok) throw new Error(parsed.blockers.join(","));
  return parsed.publication;
}

function sidecar() {
  const source = publication();
  const interpretation = {
    status: "completed" as const,
    abstention_reason: null,
    episode_outcome: "appears_complete" as const,
    summary: "The task appears complete; deterministic scoring remains authoritative.",
    events: [],
    possible_missed_events: [],
    contract_considerations: ["No-drop requirements remain contract-specific."],
    confidence: 0.8,
    deterministic_agreement: "agrees" as const,
    receipt: {
      digest: "sha256:" + "a".repeat(64),
      size_bytes: 512,
      artifact_id: "episode-interpretation-receipt",
    },
    learned_interpretation_only: true as const,
    authoritative_task_success_unchanged: true as const,
    ranking_or_promotion_effect: "none" as const,
  };
  const value = {
    schema_version: "task_evaluation_policy_canary_episode_interpretation_sidecar.v1" as const,
    source_binding: {
      record_id: recordId,
      source_run_id: source.run_id,
      source_projection_digest: source.policy_canary_result.projection_digest,
      source_delivery_digest: source.result_delivery.delivery_digest,
      source_score_correction_sidecar_digest: null,
    },
    summary: {
      schema_version: "policy_canary_episode_interpretation_closeout.v1" as const,
      status: "completed" as const,
      episode_count: 20,
      receipt_count: 20,
      completed_count: 20,
      abstained_count: 0,
      disagreement_count: 0,
      reused_receipt_count: 0,
      provider_call_count: 20,
      provider_invocation_attempt_count: 20,
      input_bundle_unavailable_count: 0,
      interpreter: { model: "gpt-5.6-luna" },
      interpreter_profile_digest: "sha256:" + "b".repeat(64),
      official_cost_completion_error_type: null,
      closeout_error_type: null,
      authoritative_deterministic_result_unchanged: true as const,
      score_overwrite_performed: false as const,
      ranking_or_promotion_effect: "none" as const,
      summary_digest: "sha256:" + "c".repeat(64),
    },
    episodes: source.policy_canary_result.episodes.map((episode) => ({
      episode_id: episode.episode_id,
      candidate_id: episode.candidate_id,
      cell_id: episode.cell_id,
      seed: episode.seed,
      interpretation,
    })),
    audit: {
      original_publication_preserved: true as const,
      deterministic_scores_unchanged: true as const,
      learned_interpretation_only: true as const,
      ranking_or_promotion_effect: "none" as const,
      verified_at_iso: "2026-09-03T22:30:00Z",
    },
    sidecar_digest: "",
  };
  value.sidecar_digest = canonicalArtifactDigest(value, "sidecar_digest");
  return value;
}

describe("policy canary episode interpretation sidecar", () => {
  it("accepts an exact immutable historical backfill", () => {
    expect(verifyPolicyCanaryEpisodeInterpretationSidecar({
      payload: sidecar(), publication: publication(), recordId,
      scoreCorrectionSidecarDigest: null,
    })).toMatchObject({ ok: true });
  });

  it("rejects digest and episode binding tampering", () => {
    const digestTamper = sidecar();
    digestTamper.audit.verified_at_iso = "2026-09-03T22:31:00Z";
    expect(verifyPolicyCanaryEpisodeInterpretationSidecar({
      payload: digestTamper, publication: publication(), recordId,
      scoreCorrectionSidecarDigest: null,
    })).toMatchObject({ ok: false, code: "sidecar_source_binding_invalid" });

    const episodeTamper = sidecar();
    episodeTamper.episodes[0].episode_id = "wrong-episode";
    episodeTamper.sidecar_digest = canonicalArtifactDigest(
      episodeTamper, "sidecar_digest",
    );
    expect(verifyPolicyCanaryEpisodeInterpretationSidecar({
      payload: episodeTamper, publication: publication(), recordId,
      scoreCorrectionSidecarDigest: null,
    })).toMatchObject({ ok: false, code: "sidecar_episode_inventory_invalid" });
  });
});
