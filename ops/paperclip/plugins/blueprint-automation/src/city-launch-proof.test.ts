import { describe, expect, it } from "vitest";
import {
  assessCityLaunchCompletion,
  expectedCityLaunchArtifactPath,
  findLatestCityLaunchCloseout,
  slugifyCityName,
} from "./city-launch-proof.js";

describe("city launch completion proof", () => {
  it("parses the latest structured closeout comment", () => {
    const closeout = findLatestCityLaunchCloseout([
      {
        id: "comment-old",
        createdAt: "2026-04-02T12:00:00.000Z",
        body: [
          "Selected city: Austin, TX",
          "Artifact: ops/paperclip/playbooks/city-launch-austin-tx.md",
          "Movement: target row updated and capture ask created",
          "Evidence: stale",
          "Other cities touched: none",
        ].join("\n"),
      },
      {
        id: "comment-new",
        createdAt: "2026-04-02T13:00:00.000Z",
        body: [
          "Selected city: Chicago, IL",
          "Artifact: ops/paperclip/playbooks/city-launch-chicago-il.md",
          "Movement: recipient-backed contact added to target ledger",
          "Evidence: supply and demand evidence moved this week",
          "Other cities touched: none",
        ].join("\n"),
      },
    ]);

    expect(closeout?.commentId).toBe("comment-new");
    expect(closeout?.selectedCity).toBe("Chicago, IL");
    expect(closeout?.selectedCitySlug).toBe("chicago-il");
  });

  it("recognizes every material city-launch movement label", () => {
    const closeout = findLatestCityLaunchCloseout([
      {
        id: "comment-1",
        createdAt: "2026-04-02T13:00:00.000Z",
        body: [
          "Selected city: Chicago, IL",
          `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
          "Movement: target, contact, send, reply, proof, hosted-review, capture-ask, intake, call",
          "Evidence: Movement labels are explicit.",
          "Other cities touched: none",
        ].join("\n"),
      },
    ]);

    expect(closeout?.movementKinds).toEqual([
      "target",
      "recipient_contact",
      "send",
      "reply",
      "proof_artifact",
      "hosted_review",
      "capture_ask",
      "structured_intake",
      "qualified_call",
    ]);
  });

  it("accepts a weekly closeout with one city and a durable artifact", () => {
    const result = assessCityLaunchCompletion({
      routineType: "weekly",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-02T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Movement: target ledger gained recipient-backed contact evidence",
            "Evidence: Chicago now has the clearest missing-guide gap and current research support.",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: null,
      issueId: "issue-weekly",
      nowIso: "2026-04-02T13:05:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.nextSelection?.city).toBe("Chicago, IL");
    expect(result.nextSelection?.citySlug).toBe(slugifyCityName("Chicago, IL"));
  });

  it("rejects a weekly closeout that touches more than one city", () => {
    const result = assessCityLaunchCompletion({
      routineType: "weekly",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-02T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Movement: target selected for next proof artifact",
            "Evidence: Chicago is the cleanest next guide.",
            "Other cities touched: Austin, TX and San Francisco, CA",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: null,
      issueId: "issue-weekly",
      nowIso: "2026-04-02T13:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("Other cities touched");
  });

  it("rejects a refresh closeout that switches away from the weekly city", () => {
    const result = assessCityLaunchCompletion({
      routineType: "refresh",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-03T13:00:00.000Z",
          body: [
            "Selected city: Boston, MA",
            `Artifact: ${expectedCityLaunchArtifactPath("Boston, MA")}`,
            "Outcome: updated",
            "Movement: reply received on buyer target",
            "Evidence delta: A new supply lead changed the posture.",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        artifactRef: expectedCityLaunchArtifactPath("Chicago, IL"),
        issueId: "weekly-issue",
        validatedAt: "2026-04-02T13:05:00.000Z",
      },
      issueId: "refresh-issue",
      nowIso: "2026-04-03T13:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("weekly city");
  });

  it("accepts a truthful refresh no-change closeout for the weekly city", () => {
    const result = assessCityLaunchCompletion({
      routineType: "refresh",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-03T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Outcome: no_change",
            "Movement: none",
            "Evidence delta: none",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        artifactRef: expectedCityLaunchArtifactPath("Chicago, IL"),
        issueId: "weekly-issue",
        validatedAt: "2026-04-02T13:05:00.000Z",
      },
      issueId: "refresh-issue",
      nowIso: "2026-04-03T13:05:00.000Z",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a refresh no-change closeout without explicit no-movement evidence", () => {
    const result = assessCityLaunchCompletion({
      routineType: "refresh",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-03T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Outcome: no_change",
            "Evidence delta: none",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        artifactRef: expectedCityLaunchArtifactPath("Chicago, IL"),
        issueId: "weekly-issue",
        validatedAt: "2026-04-02T13:05:00.000Z",
      },
      issueId: "refresh-issue",
      nowIso: "2026-04-03T13:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Movement line");
  });

  it("rejects a refresh no-change closeout without explicit evidence-delta evidence", () => {
    const result = assessCityLaunchCompletion({
      routineType: "refresh",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-03T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Outcome: no_change",
            "Movement: none",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: {
        city: "Chicago, IL",
        citySlug: "chicago-il",
        artifactRef: expectedCityLaunchArtifactPath("Chicago, IL"),
        issueId: "weekly-issue",
        validatedAt: "2026-04-02T13:05:00.000Z",
      },
      issueId: "refresh-issue",
      nowIso: "2026-04-03T13:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Evidence delta line");
  });

  it("rejects a weekly narrative closeout without material movement", () => {
    const result = assessCityLaunchCompletion({
      routineType: "weekly",
      comments: [
        {
          id: "comment-1",
          createdAt: "2026-04-02T13:00:00.000Z",
          body: [
            "Selected city: Chicago, IL",
            `Artifact: ${expectedCityLaunchArtifactPath("Chicago, IL")}`,
            "Evidence: Chicago feels promising based on the weekly synthesis.",
            "Other cities touched: none",
          ].join("\n"),
        },
      ],
      documentKeys: [],
      artifactExists: true,
      currentSelection: null,
      issueId: "issue-weekly",
      nowIso: "2026-04-02T13:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Movement line");
  });
});
