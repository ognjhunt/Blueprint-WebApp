// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";
import {
  parseVerifiedTaskEvaluationRunPublication,
  policyCanaryResultDeliverySchema,
} from "../utils/taskEvaluationRunContract";

// A streamed Quick-10 whose provider output arrived but was never ingested has
// no value for these three claims. The Pipeline sends null for them; false
// would claim the policy was never queried and the arm never moved.
const claims = ["candidate_policy_queried", "actions_reached_robot", "arm_moved"] as const;
const nonBooleans = ["false", 0, 1, "not_ingested", {}, []];
const sha = (character: string) => `sha256:${character.repeat(64)}`;

function reseal(value: Record<string, any>) {
  value.result_delivery.delivery_digest = canonicalArtifactDigest(value.result_delivery, "delivery_digest");
  value.policy_canary_result.result_delivery_digest = value.result_delivery.delivery_digest;
  value.policy_canary_result.projection_digest = canonicalArtifactDigest(value.policy_canary_result, "projection_digest");
  return value;
}

function projectedEpisode(overrides: Record<string, unknown> = {}) {
  return {
    episode_id: "episode-not-ingested", candidate_id: "pi05_droid", cell_id: "quick10-00", seed: 7,
    terminal_state: "blocked", candidate_policy_queried: null, actions_reached_robot: null,
    arm_moved: null, policy_outcome_interpretable: false, failure_taxonomy: "provider_output_not_ingested",
    evidence: {
      checkpoint_digest: sha("1"), runtime_identity_digest: sha("2"), reset_state_digest: sha("3"),
      reset_state: null, frame_manifest: null, review_video: null, policy_query_receipt: null,
      action_sequence: null, action_delivery_readback: null, state_trace: null,
      contact_force_trace: null, task_object_trajectory: null, score_receipt: null,
      evidence_gaps: [], typed_media_gap: "stream_provider_output_needed_set_over_budget",
    },
    ...overrides,
  };
}

function publicationWithProjectedEpisode(episode: Record<string, unknown>) {
  const publication = structuredClone(fixture) as Record<string, any>;
  publication.policy_canary_result.episodes = [episode];
  return reseal(publication);
}

const resultArtifact = (character: string, role: string) => ({
  artifact_id: character.repeat(32),
  role,
  relative_path: `${role}.json`,
  sha256: sha(character),
  size_bytes: 64,
  content_type: "application/json",
});

function deliveredEpisode(overrides: {
  policy_query?: Record<string, unknown>;
  action_delivery?: Record<string, unknown>;
} = {}) {
  return {
    episode_id: "scene-1--quick10-00--pi05_droid",
    episode_kind: "learned_candidate",
    subject_id: "pi05_droid",
    policy_candidate_id: "pi05_droid",
    policy_checkpoint_digest: sha("1"),
    robot_preset_id: "franka_robotiq_2f85_droid",
    runtime_identity: sha("2"),
    variation: { cell_id: "quick10-00", family_id: "canonical_anchor", seed: 7, partition: "canonical" },
    reset_state_digest: sha("3"),
    policy_query: { candidate_policy_queried: null, receipt: null, ...overrides.policy_query },
    action_delivery: {
      actions_reached_robot: null,
      arm_moved: null,
      returned_action_sequence: null,
      delivery_readback: null,
      harness_failure_code: "provider_output_not_ingested",
      ...overrides.action_delivery,
    },
    traces: { state: null, contact_force: null, task_object_trajectory: null },
    score: {
      status: "not_scored",
      task_succeeded: null,
      progress_score: null,
      destination_error: null,
      contact_maintenance_rate: null,
      collision: false,
      grader_authority: "deterministic_simulator_state",
      policy_outcome_interpretable: false,
    },
    failure: { code: "provider_output_not_ingested", phase: null, summary: "provider output not ingested" },
    evidence: {
      complete: false,
      lossless_policy_inputs: null,
      frame_manifest: null,
      videos: {},
      typed_media_gap: {
        code: "provider_output_not_ingested",
        explanation: "stream_provider_output_needed_set_over_budget",
      },
      episode_json: resultArtifact("e", "episode_json"),
    },
    wall_time_seconds: 0,
    provider_attribution: "vast",
  };
}

function delivery(episode: Record<string, unknown>) {
  return {
    schema_version: "task_evaluation_result_delivery.v2",
    run_id: "scene-1-quick10",
    result_status: "blocked",
    status: "blocked",
    claim_ceiling: "diagnostic_policy_execution",
    stages: ["validate", "seal", "project", "package", "publish"].map((stage) => ({ stage, status: "complete" })),
    blockers: ["policy_canary_episode_failure:provider_output_not_ingested"],
    summary: {
      episode_count: 1,
      learned_candidate_episode_count: 1,
      control_episode_count: 0,
      successful_episode_count: 0,
      interpretable_episode_count: 0,
    },
    episodes: [episode],
    artifacts: [resultArtifact("e", "episode_json")],
    proof_boundary: {
      review_video_is_authoritative_evidence: false,
      simulation_is_physical_success: false,
      cross_team_leaderboard_authorized: false,
      result_is_unqualified: true,
      official_ranking_contribution: false,
    },
    delivery_digest: sha("f"),
  };
}

describe("projected episodes: enforced by parsePipelinePolicyCanaryPublication", () => {
  it("admits a projected episode whose three execution claims were never ingested", () => {
    expect(parsePipelinePolicyCanaryPublication(publicationWithProjectedEpisode(projectedEpisode())))
      .toMatchObject({ ok: true });
  });

  it.each(claims.flatMap((claim) => nonBooleans.map((value) => ({ claim, value }))))(
    "still refuses a projected $claim of $value",
    ({ claim, value }) => {
      expect(parsePipelinePolicyCanaryPublication(
        publicationWithProjectedEpisode(projectedEpisode({ [claim]: value })),
      )).toEqual({ ok: false, blockers: ["policy_canary_publication_schema_invalid"] });
    },
  );

  it.each(claims)("still requires the projected %s to be reported", (claim) => {
    const episode: Record<string, unknown> = projectedEpisode();
    delete episode[claim];
    expect(parsePipelinePolicyCanaryPublication(publicationWithProjectedEpisode(episode)))
      .toMatchObject({ ok: false });
  });
});

// policyCanaryResultDeliverySchema documents the delivered shape. Production
// does not enforce it on v4 publications: their result_delivery passes through
// parsePipelinePolicyCanaryPublication (see the last test), and a real Pipeline
// delivery fails this strict schema on unrelated fields. These cases keep the
// documented shape honest; they are not a production guarantee.
describe("delivered episodes: documented shape only, not enforced on v4 publications", () => {
  it("documents a delivered episode whose three execution claims are null", () => {
    expect(policyCanaryResultDeliverySchema.safeParse(delivery(deliveredEpisode())).success).toBe(true);
  });

  it("documents the delivered booleans", () => {
    const episode = deliveredEpisode({
      policy_query: { candidate_policy_queried: false },
      action_delivery: { actions_reached_robot: false, arm_moved: false },
    });
    expect(policyCanaryResultDeliverySchema.safeParse(delivery(episode)).success).toBe(true);
  });

  it.each(nonBooleans.flatMap((value) => [
    { claim: "candidate_policy_queried", value, episode: deliveredEpisode({ policy_query: { candidate_policy_queried: value } }) },
    { claim: "actions_reached_robot", value, episode: deliveredEpisode({ action_delivery: { actions_reached_robot: value } }) },
    { claim: "arm_moved", value, episode: deliveredEpisode({ action_delivery: { arm_moved: value } }) },
  ]))("documents that a delivered $claim of $value is not the shape", ({ episode }) => {
    expect(policyCanaryResultDeliverySchema.safeParse(delivery(episode)).success).toBe(false);
  });
});

describe("the production parse of a v4 publication", () => {
  it("stores delivered episodes with null claims as they arrive (result_delivery passes through)", () => {
    const publication = structuredClone(fixture) as Record<string, any>;
    publication.result_delivery.episodes = [deliveredEpisode()];
    const verified = parseVerifiedTaskEvaluationRunPublication(reseal(publication));
    expect(verified).toMatchObject({ ok: true });
    const stored = (verified as { publication: Record<string, any> }).publication.result_delivery.episodes[0];
    expect(stored.policy_query.candidate_policy_queried).toBeNull();
    expect(stored.action_delivery).toMatchObject({ actions_reached_robot: null, arm_moved: null });
  });
});
