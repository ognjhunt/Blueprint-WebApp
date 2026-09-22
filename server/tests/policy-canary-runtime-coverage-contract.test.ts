// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";

function publicationWithCoverage(gaps?: unknown) {
  const publication = structuredClone(fixture) as Record<string, any>;
  publication.policy_canary_result.episodes = [{
    episode_id: "episode-one", candidate_id: "pi05_droid", cell_id: "physics-cell", seed: 7,
    terminal_state: "blocked", candidate_policy_queried: false, actions_reached_robot: false,
    arm_moved: false, policy_outcome_interpretable: false, failure_taxonomy: "preflight_failed",
    evidence: {
      checkpoint_digest: `sha256:${"1".repeat(64)}`,
      runtime_identity_digest: `sha256:${"2".repeat(64)}`,
      reset_state_digest: `sha256:${"3".repeat(64)}`,
      reset_state: null, frame_manifest: null, review_video: null, policy_query_receipt: null,
      action_sequence: null, action_delivery_readback: null, state_trace: null,
      contact_force_trace: null, task_object_trajectory: null, score_receipt: null,
      evidence_gaps: ["preflight_failed"],
    },
  }];
  if (gaps !== undefined) publication.policy_canary_result.episodes[0].runtime_coverage_gaps = gaps;
  publication.result_delivery.delivery_digest = canonicalArtifactDigest(publication.result_delivery, "delivery_digest");
  publication.policy_canary_result.result_delivery_digest = publication.result_delivery.delivery_digest;
  publication.policy_canary_result.projection_digest = canonicalArtifactDigest(publication.policy_canary_result, "projection_digest");
  return publication;
}

describe("runtime coverage publication", () => {
  it.each([undefined, [], ["unapplied_scenario:bounded_physics"]].map((gaps) => ({ gaps })))(
    "accepts signed coverage without changing episode scores ($gaps)", ({ gaps }) => {
      const publication = publicationWithCoverage(gaps);
      expect(parsePipelinePolicyCanaryPublication(publication)).toMatchObject({ ok: true });
      expect(publication.result_delivery.episodes).toEqual(fixture.result_delivery.episodes);
    },
  );

  it.each([null, [false], [""], ["x".repeat(257)]].map((gaps) => ({ gaps })))("refuses malformed coverage $gaps", ({ gaps }) => {
    expect(parsePipelinePolicyCanaryPublication(publicationWithCoverage(gaps))).toMatchObject({ ok: false });
  });
});
