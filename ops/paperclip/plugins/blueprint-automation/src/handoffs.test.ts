import { describe, expect, it } from "vitest";
import { buildHandoffAnalytics, parseHandoffComment } from "./handoffs.js";

describe("handoff analytics", () => {
  it("parses structured handoff request comments", () => {
    const parsed = parseHandoffComment(
      JSON.stringify({
        handoff: {
          version: "1.0",
          from: "ops-lead",
          to: "capture-qa-agent",
          type: "work-request",
          priority: "high",
          context: { summary: "Review the latest capture." },
          expectedOutcome: "QA verdict",
        },
      }),
    );

    expect(parsed?.kind).toBe("request");
  });

  it("computes stuck and bounced handoff metrics", () => {
    const analytics = buildHandoffAnalytics({
      generatedAt: "2026-03-30T18:00:00.000Z",
      issues: [
        {
          id: "handoff-1",
          title: "[Handoff] work-request: QA review",
          projectName: "blueprint-webapp",
          parentId: null,
          status: "todo",
          priority: "high",
          assigneeAgentId: "agent-finance",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
        {
          id: "handoff-2",
          title: "[Handoff] escalation: payout exception",
          projectName: "blueprint-webapp",
          parentId: null,
          status: "done",
          priority: "medium",
          assigneeAgentId: "agent-qa",
          updatedAt: "2026-03-30T14:00:00.000Z",
        },
      ] as any,
      commentsByIssueId: new Map([
        [
          "handoff-1",
          [
            {
              id: "comment-1",
              companyId: "company-1",
              issueId: "handoff-1",
              authorAgentId: "agent-qa",
              authorUserId: null,
              body: JSON.stringify({
                handoff: {
                  version: "1.0",
                  from: "ops-lead",
                  to: "capture-qa-agent",
                  type: "work-request",
                  priority: "high",
                  context: { summary: "Review the latest capture." },
                  expectedOutcome: "QA verdict",
                },
              }),
              createdAt: new Date("2026-03-30T09:00:00.000Z"),
              updatedAt: new Date("2026-03-30T09:00:00.000Z"),
            },
          ],
        ],
        [
          "handoff-2",
          [
            {
              id: "comment-2",
              companyId: "company-1",
              issueId: "handoff-2",
              authorAgentId: "agent-qa",
              authorUserId: null,
              body: JSON.stringify({
                handoff: {
                  version: "1.0",
                  from: "ops-lead",
                  to: "capture-qa-agent",
                  type: "escalation",
                  priority: "medium",
                  context: { summary: "Handle the payout exception." },
                  expectedOutcome: "Resolved disposition",
                },
              }),
              createdAt: new Date("2026-03-30T11:00:00.000Z"),
              updatedAt: new Date("2026-03-30T11:00:00.000Z"),
            },
            {
              id: "comment-3",
              companyId: "company-1",
              issueId: "handoff-2",
              authorAgentId: "agent-qa",
              authorUserId: null,
              body: JSON.stringify({
                handoff_response: {
                  version: "1.0",
                  from: "capture-qa-agent",
                  to: "ops-lead",
                  sourceHandoffIssueId: "handoff-2",
                  outcome: "done",
                  proofLinks: ["https://example.com/proof"],
                },
              }),
              createdAt: new Date("2026-03-30T13:00:00.000Z"),
              updatedAt: new Date("2026-03-30T13:00:00.000Z"),
            },
          ],
        ],
      ]),
      agentKeyById: new Map([
        ["agent-finance", "finance-support-agent"],
        ["agent-qa", "capture-qa-agent"],
      ]),
    });

    expect(analytics.summary.openCount).toBe(1);
    expect(analytics.summary.stuckCount).toBe(1);
    expect(analytics.summary.resolvedCount).toBe(1);
    expect(analytics.summary.avgLatencyHours).toBe(2);
    expect(analytics.summary.bounceRate).toBeGreaterThan(0);
    expect(analytics.stuckHandoffs[0]?.isBounced).toBe(true);
  });
});
