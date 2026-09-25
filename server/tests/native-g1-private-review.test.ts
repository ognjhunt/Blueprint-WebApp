// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  nativeG1ReviewArtifacts,
  parseNativeG1PrivateReview,
} from "../utils/nativeG1PrivateReview";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import pythonReview from "./fixtures/native-g1-private-review.v1.json";

describe("private Unitree G1 review handoff", () => {
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
