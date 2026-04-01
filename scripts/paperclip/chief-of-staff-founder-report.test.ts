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
});
