import { describe, expect, it } from "vitest";
import {
  buildManagedIssueSlackCopy,
  cleanIssueTitle,
  formatAgentName,
  formatIssuePriority,
  formatIssueStatus,
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
});
