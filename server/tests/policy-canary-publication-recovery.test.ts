import { describe, expect, it } from "vitest";

import { policyCanaryRecoveredPublicationAllowed } from "../utils/policyCanaryPublicationRecovery";

function identity() {
  return {
    schema_version: "task_evaluation_run_publication.v4",
    capture_session_id: "capture-1",
    intake_id: "intake-1",
    run_id: "run-1",
    request_digest: "sha256:" + "1".repeat(64),
    configuration_digest: "sha256:" + "2".repeat(64),
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
  };
}

function priorPublication() {
  return {
    ...identity(),
    result_status: "blocked",
    result_delivery: {
      episodes: Array.from({ length: 20 }, () => ({
        score: { status: "not_scored", policy_outcome_interpretable: false },
        failure: { code: "before_first_observation" },
        evidence: { videos: {} },
      })),
    },
    policy_canary_result: {
      counts: {
        completed_learned_policy_rollout_count: 0,
        learned_policy_rollout_count: 20,
      },
      blockers: [
        "native_task_arena_policy_canary_session_runtime_result_missing",
        "provider_remote_blocker:output_upload_failed:28",
      ],
    },
  };
}

function recoveredPublication() {
  return {
    ...identity(),
    result_status: "completed_unqualified",
    result_delivery: {
      episodes: Array.from({ length: 20 }, () => ({
        episode_kind: "learned_candidate",
        score: { status: "scored", policy_outcome_interpretable: true },
        evidence: {
          complete: true,
          lossless_policy_inputs: { artifact_id: "lossless-policy-inputs" },
          frame_manifest: { artifact_id: "frames" },
          videos: { external: { artifact_id: "external" }, wrist: { artifact_id: "wrist" } },
        },
        action_delivery: { actions_reached_robot: true, arm_moved: true },
      })),
    },
    policy_canary_result: {
      counts: {
        completed_learned_policy_rollout_count: 20,
        learned_policy_rollout_count: 20,
      },
    },
    proof_boundary: {
      scene_promotion_authorized: false,
      official_policy_ranking_authorized: false,
      winner_selection_authorized: false,
    },
  };
}

describe("policy canary recovered publication", () => {
  it("permits only a complete evidence recovery over the matching transport fallback", () => {
    expect(policyCanaryRecoveredPublicationAllowed(
      priorPublication(), recoveredPublication(),
    )).toBe(true);
  });

  it("keeps ordinary immutable publications immutable", () => {
    const wrongRun = recoveredPublication();
    wrongRun.run_id = "run-2";
    expect(policyCanaryRecoveredPublicationAllowed(priorPublication(), wrongRun)).toBe(false);

    const incomplete = recoveredPublication();
    incomplete.result_delivery.episodes[0].evidence.videos = {};
    expect(policyCanaryRecoveredPublicationAllowed(priorPublication(), incomplete)).toBe(false);

    const missingLosslessPolicyInputs = recoveredPublication();
    delete missingLosslessPolicyInputs.result_delivery.episodes[0].evidence.lossless_policy_inputs;
    expect(policyCanaryRecoveredPublicationAllowed(
      priorPublication(), missingLosslessPolicyInputs,
    )).toBe(false);

    const unrelatedBlocker = priorPublication();
    unrelatedBlocker.policy_canary_result.blockers = ["policy_runtime_failed"];
    expect(policyCanaryRecoveredPublicationAllowed(unrelatedBlocker, recoveredPublication())).toBe(false);
  });
});
