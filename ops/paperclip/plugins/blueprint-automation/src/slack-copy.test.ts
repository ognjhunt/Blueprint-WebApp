import { describe, expect, it } from "vitest";
import {
  buildAgentConversationSlackCopy,
  buildManagerIssueSlackCopy,
  buildManagedIssueSlackCopy,
  cleanIssueTitle,
  formatAgentName,
  formatIssuePriority,
  formatIssueStatus,
  shouldPostManagerIssueEventToSlack,
} from "./slack-copy.js";

describe("slack alert copy", () => {
  it("formats repo drift alerts in plain English", () => {
    const copy = buildManagedIssueSlackCopy({
      event: "opened",
      sourceType: "repo-dirty",
      issueTitle: "blueprint-webapp local worktree drift",
      projectName: "blueprint-webapp",
      assignee: "webapp-codex",
      priority: "medium",
      status: "todo",
    });

    expect(copy.title).toBe("Shared workspace has local changes in blueprint-webapp");
    expect(copy.summary).toContain(
      "What happened: The shared blueprint-webapp workspace has local changes and needs a quick review before more automation runs there.",
    );
    expect(copy.summary).toContain("Owner: webapp codex");
    expect(copy.summary).not.toContain(expect.stringContaining("Fingerprint"));
  });

  it("formats recovered CI alerts without internal plumbing terms", () => {
    const copy = buildManagedIssueSlackCopy({
      event: "resolved",
      sourceType: "github-workflow",
      issueTitle: "blueprint-capture-pipeline CI failure: CI",
      projectName: "blueprint-capture-pipeline",
      status: "done",
      signalUrl: "https://example.com/run",
    });

    expect(copy.title).toBe("CI recovered in blueprint-capture-pipeline");
    expect(copy.summary).toContain(
      "What happened: The latest GitHub Actions run passed in blueprint-capture-pipeline.",
    );
    expect(copy.summary).toContain("Status: Done");
    expect(copy.summary).toContain("Link: https://example.com/run");
  });

  it("normalizes helper labels used by Slack summaries", () => {
    expect(cleanIssueTitle("[Handoff] work-request: QA review")).toBe("work-request: QA review");
    expect(formatAgentName("pipeline-claude")).toBe("pipeline claude");
    expect(formatIssuePriority("high")).toBe("High");
    expect(formatIssueStatus("in_review")).toBe("In review");
  });

  it("formats agent coordination comments in plain English", () => {
    const copy = buildAgentConversationSlackCopy({
      kind: "comment",
      actor: "growth-lead",
      target: "conversion-agent",
      issueIdentifier: "BLU-585",
      issueTitle: "Chief of Staff Continuous Loop",
      bodySnippet: "Please turn this into a concrete experiment plan for next week",
    });

    expect(copy.title).toBe("growth lead commented on BLU-585");
    expect(copy.summary).toContain(
      "What happened: growth lead left a coordination note for conversion agent.",
    );
    expect(copy.summary).toContain(
      "Comment: Please turn this into a concrete experiment plan for next week.",
    );
  });

  it("formats structured handoff requests without raw JSON", () => {
    const copy = buildAgentConversationSlackCopy({
      kind: "handoff_request",
      actor: "blueprint-chief-of-staff",
      target: "ops-lead",
      issueIdentifier: "BLU-585",
      issueTitle: "[Handoff] Route stale work",
      summary: "The queue has blocked items with no owner.",
      expectedOutcome: "Assign owners and close anything already done",
      priority: "high",
    });

    expect(copy.title).toBe("Handoff: blueprint chief of staff -> ops lead");
    expect(copy.summary).toContain("Requested outcome: Assign owners and close anything already done.");
    expect(copy.summary).toContain("Priority: High");
  });

  it("keeps manager issue alerts exception-only", () => {
    expect(
      shouldPostManagerIssueEventToSlack({
        eventType: "issue.created",
        status: "todo",
        priority: "high",
        assigneeAgentId: "webapp-codex",
      }),
    ).toBe(false);

    expect(
      shouldPostManagerIssueEventToSlack({
        eventType: "issue.created",
        status: "todo",
        priority: "low",
        assigneeAgentId: null,
      }),
    ).toBe(true);

    expect(
      shouldPostManagerIssueEventToSlack({
        eventType: "issue.updated",
        status: "blocked",
        priority: "medium",
        assigneeAgentId: "webapp-codex",
      }),
    ).toBe(true);
  });

  it("formats manager issue alerts around ownership and next move", () => {
    const copy = buildManagerIssueSlackCopy({
      eventType: "issue.updated",
      issueTitle: "WebApp Codex Bootstrap",
      status: "blocked",
      priority: "high",
      owner: "webapp codex",
    });

    expect(copy.title).toBe("Manager update: issue is blocked");
    expect(copy.summary).toContain("What happened: An active Paperclip issue is now blocked.");
    expect(copy.summary).toContain("Task: WebApp Codex Bootstrap");
    expect(copy.summary).toContain("Owner: webapp codex");
    expect(copy.summary).toContain("Next move: Create the unblock path or delegate the blocker explicitly.");
  });
});
