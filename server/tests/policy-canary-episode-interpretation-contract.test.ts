// @vitest-environment node
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";

describe("policy canary episode interpretation contract", () => {
  it("accepts a non-authoritative closeout summary without changing scoring authority", () => {
    const publication = structuredClone(fixture) as Record<string, any>;
    publication.result_delivery.delivery_digest = canonicalArtifactDigest(
      publication.result_delivery,
      "delivery_digest",
    );
    publication.policy_canary_result.result_delivery_digest =
      publication.result_delivery.delivery_digest;
    publication.policy_canary_result.episode_interpretation = {
      schema_version: "policy_canary_episode_interpretation_closeout.v1",
      status: "abstained",
      episode_count: 0,
      receipt_count: 0,
      completed_count: 0,
      abstained_count: 0,
      disagreement_count: 0,
      reused_receipt_count: 0,
      provider_call_count: 0,
      provider_invocation_attempt_count: 0,
      input_bundle_unavailable_count: 0,
      interpreter: null,
      interpreter_profile_digest: null,
      official_cost_completion_error_type: null,
      authoritative_deterministic_result_unchanged: true,
      score_overwrite_performed: false,
      ranking_or_promotion_effect: "none",
      summary_digest: "sha256:" + "a".repeat(64),
    };
    publication.policy_canary_result.projection_digest = canonicalArtifactDigest(
      publication.policy_canary_result,
      "projection_digest",
    );

    expect(parsePipelinePolicyCanaryPublication(publication)).toMatchObject({ ok: true });
  });

  it("rejects any learned interpretation claim that can change ranking", () => {
    const publication = structuredClone(fixture) as Record<string, any>;
    publication.result_delivery.delivery_digest = canonicalArtifactDigest(
      publication.result_delivery,
      "delivery_digest",
    );
    publication.policy_canary_result.result_delivery_digest =
      publication.result_delivery.delivery_digest;
    publication.policy_canary_result.episode_interpretation = {
      schema_version: "policy_canary_episode_interpretation_closeout.v1",
      status: "completed",
      episode_count: 0,
      receipt_count: 0,
      completed_count: 0,
      abstained_count: 0,
      disagreement_count: 0,
      reused_receipt_count: 0,
      provider_call_count: 0,
      provider_invocation_attempt_count: 0,
      input_bundle_unavailable_count: 0,
      authoritative_deterministic_result_unchanged: true,
      score_overwrite_performed: false,
      ranking_or_promotion_effect: "winner_selected",
      summary_digest: "sha256:" + "b".repeat(64),
    };
    publication.policy_canary_result.projection_digest = canonicalArtifactDigest(
      publication.policy_canary_result,
      "projection_digest",
    );

    expect(parsePipelinePolicyCanaryPublication(publication)).toMatchObject({
      ok: false,
      blockers: ["policy_canary_publication_schema_invalid"],
    });
  });
});
