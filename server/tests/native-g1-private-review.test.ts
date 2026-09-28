// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  nativeG1ReviewArtifacts,
  parseNativeG1PrivateReview,
} from "../utils/nativeG1PrivateReview";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import pythonReview from "./fixtures/native-g1-private-review.v1.json";
import selectedReview from "./fixtures/native-g1-team-private-review.v1.json";

describe("private Unitree G1 review handoff", () => {
  it("accepts the Python-sealed selected episode without claiming four-policy proof", () => {
    const parsed = parseNativeG1PrivateReview(selectedReview);
    expect(parsed).not.toBeNull();
    expect(parsed?.schema_version).toBe("native_g1_team_private_review.v1");
    expect(parsed?.episodes).toHaveLength(1);
    expect(parsed?.episodes[0].score.outcome).toBe("failure");
    expect(nativeG1ReviewArtifacts(parsed!)).toHaveLength(3);
  });

  it.each(["count", "candidate", "prefix", "delivery", "physical", "score"])(
    "rejects a resealed selected record with invalid %s", (change) => {
      const value = structuredClone(selectedReview);
      if (change === "count") value.episodes.push(structuredClone(value.episodes[0]));
      if (change === "candidate") value.episodes[0].candidate_id = "team_policy_" + "0".repeat(64);
      if (change === "prefix") value.episodes[0].frame_manifest.relative_path = "movement_pair/frames.json";
      if (change === "delivery") value.policy_delivery_mode = "unknown";
      if (change === "physical") value.physical_outcome_claimed = true;
      if (change === "score") value.episodes[0].score.outcome = "success";
      value.review_digest = crossRuntimeArtifactDigest(value, "review_digest");
      expect(parseNativeG1PrivateReview(value)).toBeNull();
    },
  );
  it("verifies the Python-sealed four-policy manifest after JSON number parsing", () => {
    const parsed = parseNativeG1PrivateReview(pythonReview);
    expect(parsed).not.toBeNull();
    expect(parsed?.episodes[0].score.progress_score).toBe(1);
    expect(parsed?.episodes.map((row) => row.objective_id)).toEqual([
      "task_success", "task_success", "g1_navigation_goal", "g1_navigation_goal",
    ]);
    const artifacts = nativeG1ReviewArtifacts(parsed!);
    expect(artifacts).toHaveLength(12);
    expect(new Set(artifacts.map((row) => row.artifact_id)).size).toBe(12);
    expect(artifacts.every((row) => /^[0-9a-f]{32}$/.test(row.artifact_id))).toBe(true);
  });

  it("rejects score edits, claim upgrades, reordered policies, and unsafe paths", () => {
    const changedScore = structuredClone(pythonReview);
    changedScore.episodes[0].score.outcome = "task_failed";
    expect(parseNativeG1PrivateReview(changedScore)).toBeNull();

    const changedClaim = structuredClone(pythonReview);
    changedClaim.public_redistribution_authorized = true;
    expect(parseNativeG1PrivateReview(changedClaim)).toBeNull();

    const reordered = structuredClone(pythonReview);
    reordered.episodes.reverse();
    expect(parseNativeG1PrivateReview(reordered)).toBeNull();

    const traversal = structuredClone(pythonReview);
    traversal.episodes[0].review_videos.head.relative_path = "../secret.mp4";
    expect(parseNativeG1PrivateReview(traversal)).toBeNull();

    const reusedMedia = structuredClone(pythonReview);
    reusedMedia.episodes[1].review_videos.head = structuredClone(reusedMedia.episodes[0].review_videos.head);
    reusedMedia.review_digest = crossRuntimeArtifactDigest(reusedMedia, "review_digest");
    expect(parseNativeG1PrivateReview(reusedMedia)).toBeNull();
  });
});
