import { describe, expect, it } from "vitest";
import {
  buildContentBriefMarkdown,
  buildShipBroadcastIssueSpec,
  formatContentOutcomeReviewIssueComment,
  normalizeContentBrief,
  normalizeContentOutcomeReview,
} from "./content-ops.js";

describe("content ops helpers", () => {
  it("normalizes a content brief with Blueprint-safe defaults", () => {
    const brief = normalizeContentBrief(
      {
        sourceEvidence: ["Closed issue BLU-1", "Deployment smoke passed"],
      },
      "community-updates-agent",
    );

    expect(brief.wedge).toBe("Exact-Site Hosted Review");
    expect(brief.owner).toBe("community-updates-agent");
    expect(brief.channels).toContain("newsletter");
    expect(brief.blockedClaims.some((entry) => entry.includes("invented traction"))).toBe(true);
  });

  it("builds a ship broadcast issue spec with a content brief and commit details", () => {
    const spec = buildShipBroadcastIssueSpec({
      repoKey: "webapp",
      repoName: "Blueprint-WebApp",
      projectName: "blueprint-webapp",
      branch: "main",
      afterSha: "abcdef1234567890",
      compareUrl: "https://github.com/example/compare",
      headCommitMessage: "Improve hosted review CTA",
      commitMessages: [
        "Improve hosted review CTA",
        "Tighten buyer onboarding copy",
      ],
      changedFiles: ["client/src/pages/Home.tsx", "server/routes/admin-growth.ts"],
      owner: "community-updates-agent",
    });

    expect(spec.assetKey).toBe("ship-broadcast:webapp:abcdef1234567890");
    expect(spec.title).toContain("Improve hosted review CTA");
    expect(spec.description).toContain("## Content Brief");
    expect(spec.description).toContain("## Commit Headlines");
    expect(spec.brief.proofLinks).toContain("https://github.com/example/compare");
  });

  it("renders the content brief markdown cleanly", () => {
    const markdown = buildContentBriefMarkdown(
      normalizeContentBrief(
        {
          wedge: "Exact-Site Hosted Review",
          audience: "robot teams",
          channels: ["newsletter", "blog"],
        },
        "growth-lead",
      ),
    );

    expect(markdown).toContain("## Content Brief");
    expect(markdown).toContain("- Channels: newsletter, blog");
  });

  it("normalizes a content outcome review and formats an issue comment", () => {
    const review = normalizeContentOutcomeReview(
      {
        assetKey: "ship-broadcast:webapp:sha",
        issueId: "issue-1",
        assetType: "ship-broadcast",
        channels: ["newsletter", "x"],
        summary: "The newsletter draft worked, but the social cutdown overreached.",
        whatWorked: ["Specific shipped bullets improved clarity"],
        whatDidNot: ["The social draft sounded broader than the proof"],
        nextRecommendation: "Lead with one shipped buyer-visible change next time.",
        evidenceSource: "campaign_metrics_and_manual_review",
        confidence: 0.76,
      },
      "2026-04-04T12:00:00.000Z",
    );

    const comment = formatContentOutcomeReviewIssueComment(review);
    expect(review.assetType).toBe("ship_broadcast");
    expect(review.channels).toEqual(["newsletter", "x"]);
    expect(comment).toContain("Structured content outcome review recorded.");
    expect(comment).toContain("What worked:");
    expect(comment).toContain("What did not:");
  });
});
