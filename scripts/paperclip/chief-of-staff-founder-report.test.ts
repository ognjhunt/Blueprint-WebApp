import { describe, expect, it } from "vitest";
import { buildReport } from "./chief-of-staff-founder-report.ts";

type Issue = Parameters<typeof buildReport>[2][number];

const assignees = new Map<string, string>([
  ["ceo", "Blueprint CEO"],
  ["finance", "Finance Support Agent"],
  ["ops", "Ops Lead"],
  ["security", "Security Procurement Agent"],
  ["capture", "Capture Codex"],
]);

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

describe("chief of staff founder report", () => {
  it("collapses repeated blocker clusters in weekly gaps output", () => {
    const issues: Issue[] = [
      {
        id: "firebase-1",
        identifier: "BLU-1",
        title: "Provision Firebase Admin credentials for Blueprint Paperclip local heartbeats",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: "ceo",
        updatedAt: "2026-04-01T21:00:00.000Z",
      },
      {
        id: "firebase-2",
        identifier: "BLU-2",
        title: "Restore Firebase Admin access for Paperclip local heartbeats",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: "ceo",
        updatedAt: "2026-04-01T20:00:00.000Z",
      },
      {
        id: "payout-1",
        identifier: "BLU-3",
        title: "Stripe: payout.failed (evt_local_123)",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: "finance",
        updatedAt: "2026-04-01T19:00:00.000Z",
      },
      {
        id: "payout-2",
        identifier: "BLU-4",
        title: "Stripe: payout.failed (evt_local_456)",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: "finance",
        updatedAt: "2026-04-01T18:00:00.000Z",
      },
      {
        id: "security-1",
        identifier: "BLU-5",
        title: "Security Procurement Agent Bootstrap",
        status: "todo",
        priority: "high",
        assigneeAgentId: "security",
        updatedAt: "2026-04-01T17:00:00.000Z",
      },
      {
        id: "bridge-1",
        identifier: "BLU-6",
        title: "Notion Work Queue: Build production bridge from pipeline outputs into inbound request state",
        status: "todo",
        priority: "critical",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T16:00:00.000Z",
      },
    ];

    const report = buildReport("weekly_gaps", "2026-04-01", issues, assignees);

    expect(countOccurrences(report.content, "Paperclip Firebase Admin access remains blocked")).toBe(1);
    expect(countOccurrences(report.content, "Repeated Stripe payout.failed exceptions")).toBe(1);
    expect(report.content).toContain("Security Procurement Agent Bootstrap");
    expect(report.content).toContain("Notion Work Queue: Build production bridge from pipeline outputs into inbound request state");
  });

  it("avoids repeating the same shipped signal across friday recap sections", () => {
    const issues: Issue[] = [
      {
        id: "capture-1",
        identifier: "BLU-10",
        title: "Validate raw capture bundles before upload and honor manifest video URIs in the bridge",
        status: "done",
        priority: "high",
        assigneeAgentId: "capture",
        updatedAt: "2026-04-01T22:00:00.000Z",
        completedAt: "2026-04-01T22:00:00.000Z",
      },
      {
        id: "capture-2",
        identifier: "BLU-11",
        title: "Validate raw capture bundles before upload and honor manifest video URIs in the bridge",
        status: "done",
        priority: "high",
        assigneeAgentId: "capture",
        updatedAt: "2026-03-30T20:00:00.000Z",
        completedAt: "2026-03-30T20:00:00.000Z",
      },
      {
        id: "ops-1",
        identifier: "BLU-12",
        title: "Validate inbound request exchange lifecycle surfaces",
        status: "done",
        priority: "high",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T21:00:00.000Z",
        completedAt: "2026-04-01T21:00:00.000Z",
      },
      {
        id: "blocked-1",
        identifier: "BLU-13",
        title: "Restore Firebase Admin access for Paperclip local heartbeats",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: "ceo",
        updatedAt: "2026-04-01T19:00:00.000Z",
      },
    ];

    const report = buildReport("friday_recap", "2026-04-01", issues, assignees);

    expect(countOccurrences(report.content, "Validate raw capture bundles before upload and honor manifest video URIs in the bridge")).toBe(1);
    expect(report.content).toContain("Validate inbound request exchange lifecycle surfaces");
    expect(report.content).toContain("Paperclip Firebase Admin access remains blocked");
  });

  it("does not count future-dated issues in the requested report window", () => {
    const issues: Issue[] = [
      {
        id: "future-done",
        identifier: "BLU-14",
        title: "Validate raw capture bundles before upload and honor manifest video URIs in the bridge",
        status: "done",
        priority: "high",
        assigneeAgentId: "capture",
        updatedAt: "2026-04-02T04:30:00.000Z",
        completedAt: "2026-04-02T04:30:00.000Z",
      },
      {
        id: "current-done",
        identifier: "BLU-15",
        title: "Validate inbound request exchange lifecycle surfaces",
        status: "done",
        priority: "high",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T21:00:00.000Z",
        completedAt: "2026-04-01T21:00:00.000Z",
      },
    ];

    const report = buildReport("friday_recap", "2026-04-01", issues, assignees);

    expect(report.content).not.toContain("BLU-14");
    expect(report.content).toContain("Validate inbound request exchange lifecycle surfaces");
  });

  it("renders founder decision packets from issue descriptions and falls back when fields are missing", () => {
    const issues: Issue[] = [
      {
        id: "chicago-1",
        identifier: "BLU-20",
        title: "Review Chicago city launch guide and decide launch posture",
        status: "blocked",
        priority: "high",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T20:00:00.000Z",
        description: [
          "## Why This Is Open",
          "Chicago remains in planning and keeps reappearing in founder-facing work.",
          "",
          "## Decision Needed",
          "- Confirm Chicago stays deferred until Austin proof exists.",
          "",
          "## Suggested Owner",
          "- Growth Lead",
        ].join("\n"),
      },
    ];

    const report = buildReport("morning", "2026-04-01", issues, assignees);

    expect(report.content).toContain("### Review Chicago city launch guide and decide launch posture");
    expect(report.content).toContain("Why decision is needed now: Chicago remains in planning");
    expect(report.content).toContain("Recommended answer: Defer Chicago. Keep it plan-only until Austin proof exists or a new Chicago anchor signal changes the evidence.");
    expect(report.content).toContain("Exact approval or info needed: - Confirm Chicago stays deferred until Austin proof exists.");
    expect(report.content).toContain("Who executes immediately after approval: Ops Lead");
    expect(report.content).toContain("Alternatives: Missing alternatives — packet incomplete.");
  });

  it("keeps repo-local blockers out of founder decision packets", () => {
    const issues: Issue[] = [
      {
        id: "repo-local-1",
        identifier: "BLU-30",
        title: "Unblock Solutions Engineering Active Delivery Review",
        status: "blocked",
        priority: "high",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T20:00:00.000Z",
        description: [
          "Auto-created from a blocked issue so the failure turns into tracked follow-through instead of stopping at manager state.",
          "",
          "## Blocker Summary",
          "Missing proof links should be regenerated from repo-local artifacts by the owning agent.",
          "",
          "Routing class: repo_local_no_send",
        ].join("\n"),
      },
      {
        id: "first-send-1",
        identifier: "BLU-31",
        title: "Approve first live buyer send batch for Exact-Site Hosted Review",
        status: "blocked",
        priority: "high",
        assigneeAgentId: "ops",
        updatedAt: "2026-04-01T19:00:00.000Z",
        description: [
          "## Why Decision Is Needed Now",
          "This would create a real external buyer touch.",
          "",
          "## Recommended Answer",
          "Approve the recipient-backed first batch.",
          "",
          "## Decision Needed",
          "Approve or reject the first live buyer send batch.",
        ].join("\n"),
      },
    ];

    const report = buildReport("morning", "2026-04-01", issues, assignees);

    expect(report.content).toContain("[Operations] Unblock Solutions Engineering Active Delivery Review");
    expect(report.content).not.toContain("### Unblock Solutions Engineering Active Delivery Review");
    expect(report.content).toContain("### Approve first live buyer send batch for Exact-Site Hosted Review");
    expect(report.content).toContain("Recommended answer: Approve the recipient-backed first batch.");
  });
});
