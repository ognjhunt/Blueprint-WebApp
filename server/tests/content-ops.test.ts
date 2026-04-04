// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  normalizeContentOutcomeReviewInput,
  summarizeContentOutcomeReviews,
} from "../utils/content-ops";

describe("content ops server helpers", () => {
  it("normalizes outcome review input safely", () => {
    const review = normalizeContentOutcomeReviewInput(
      {
        assetKey: "ship-broadcast:webapp:sha",
        issueId: "issue-1",
        assetType: "ship_broadcast",
        channels: ["newsletter", "blog"],
        summary: "The update draft landed well with specific proof.",
        whatWorked: ["Specific proof bullets improved replies"],
        whatDidNot: ["The intro was too broad"],
        nextRecommendation: "Keep the lead tighter next time.",
        evidenceSource: "manual_review",
        confidence: 0.9,
      },
      "2026-04-04T14:00:00.000Z",
      "ops@tryblueprint.io",
    );

    expect(review.assetKey).toBe("ship-broadcast:webapp:sha");
    expect(review.channels).toEqual(["newsletter", "blog"]);
    expect(review.recordedBy).toBe("ops@tryblueprint.io");
    expect(review.confidence).toBe(0.9);
  });

  it("summarizes repeated content review patterns", () => {
    const summary = summarizeContentOutcomeReviews([
      {
        assetKey: "a",
        issueId: "1",
        assetType: "ship_broadcast",
        channels: ["newsletter"],
        summary: "A",
        whatWorked: ["Specific proof bullets improved replies"],
        whatDidNot: ["Intro too broad"],
        nextRecommendation: "Lead with one shipped change.",
        evidenceSource: "manual_review",
        confidence: 0.8,
        recordedAt: "2026-04-04T14:00:00.000Z",
        recordedBy: "ops@tryblueprint.io",
      },
      {
        assetKey: "b",
        issueId: "2",
        assetType: "community_update",
        channels: ["newsletter", "x"],
        summary: "B",
        whatWorked: ["Specific proof bullets improved replies"],
        whatDidNot: ["Intro too broad"],
        nextRecommendation: "Lead with one shipped change.",
        evidenceSource: "campaign_metrics",
        confidence: 0.7,
        recordedAt: "2026-04-05T14:00:00.000Z",
        recordedBy: "ops@tryblueprint.io",
      },
    ]);

    expect(summary.reviewCount).toBe(2);
    expect(summary.workingPatterns[0]).toBe("Specific proof bullets improved replies");
    expect(summary.failingPatterns[0]).toBe("Intro too broad");
    expect(summary.recommendedNextMoves[0]).toBe("Lead with one shipped change.");
  });
});
