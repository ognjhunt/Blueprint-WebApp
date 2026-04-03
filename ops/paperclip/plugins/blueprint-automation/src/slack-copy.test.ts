import { describe, expect, it } from "vitest";
import {
  buildAgentRunFailureSlackCopy,
  buildAgentConversationSlackCopy,
  buildManagerIssueSlackCopy,
  buildManagedIssueSlackCopy,
  cleanIssueTitle,
  formatAgentName,
  formatIssuePriority,
  formatIssueStatus,
  formatOwnerLabel,
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
    expect(copy.summary).toContain("Owner: WebApp Codex");
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
    expect(formatAgentName("pipeline-review")).toBe("Pipeline Review");
    expect(formatOwnerLabel("345f4810-a187-4e0e-8381-1da3f953fbaf")).toBe("Assigned owner");
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
      owner: "webapp-codex",
    });

    expect(copy.title).toBe("Manager update: issue is blocked");
    expect(copy.summary).toContain("What happened: An active Paperclip issue is now blocked.");
    expect(copy.summary).toContain("Task: WebApp Codex Bootstrap");
    expect(copy.summary).toContain("Owner: WebApp Codex");
    expect(copy.summary).toContain("Next move: Create the unblock path or delegate the blocker explicitly.");
  });

  it("adds a fresh-thread recommendation for context-window failures", () => {
    const copy = buildAgentRunFailureSlackCopy({
      failedAgentId: "webapp-codex",
      issueId: "19bea205-c75d-47c4-8eaa-298a5c36aa4f",
      error: "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
    });

    expect(copy.title).toBe("Manager update: agent run failed");
    expect(copy.summary).toContain("What happened: WebApp Codex hit a run failure while working an issue.");
    expect(copy.summary).toContain("Issue: 19bea205-c75d-47c4-8eaa-298a5c36aa4f");
    expect(copy.summary).toContain(
      "Next move: Start a fresh thread with a compressed handoff, retry once there, then split or reroute the work if it fails again.",
    );
  });

  it("adds a fresh-thread recommendation for max-output-token failures", () => {
    const copy = buildAgentRunFailureSlackCopy({
      failedAgentId: "webapp-codex",
      issueId: "75c3b5a5-bc51-46ee-8c19-dada7adf166f",
      error: "stream disconnected before completion: Incomplete response returned, reason: max_output_tokens",
    });

    expect(copy.summary).toContain(
      "Next move: Start a fresh thread with a compressed handoff, retry once there, then split or reroute the work if it fails again.",
    );
  });

  it("keeps generic next steps for other agent run failures", () => {
    const copy = buildAgentRunFailureSlackCopy({
      failedAgentId: "pipeline-review",
      error: "Provider timeout while waiting for tool output",
    });

    expect(copy.summary).toContain(
      "Next move: Decide whether to retry, reroute, or surface a blocker issue before the work stalls.",
    );
  });
});
