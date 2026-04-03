import { describe, expect, it } from "vitest";
import {
  buildAnalyticsFollowUpIssues,
  type AnalyticsFollowUpIssue,
} from "./analytics-followups.js";

const ROUTING_CONFIG = {
  repoCatalog: [
    { key: "webapp", projectName: "blueprint-webapp", implementationAgent: "webapp-codex", reviewAgent: "webapp-review" },
    { key: "pipeline", projectName: "blueprint-capture-pipeline", implementationAgent: "pipeline-codex", reviewAgent: "pipeline-review" },
    { key: "capture", projectName: "blueprint-capture", implementationAgent: "capture-codex", reviewAgent: "capture-review" },
  ],
  opsAgents: {
    opsLead: "ops-lead",
    financeSupportAgent: "finance-support-agent",
  },
  growthAgents: {
    conversionOptimizer: "conversion-agent",
  },
  executiveOpsProjectName: "blueprint-executive-ops",
};

describe("analytics follow-up routing", () => {
  it("turns recommended follow-ups into routed repo issues", () => {
    const issues = buildAnalyticsFollowUpIssues(
      ["Run npm run check locally to diagnose type errors before committing."],
      [],
      ROUTING_CONFIG,
    );

    expect(issues).toEqual([
      {
        kind: "owner_ready",
        title: "Run npm run check locally to diagnose type errors before committing",
        description: "Run npm run check locally to diagnose type errors before committing.\n\nAuto-generated from the analytics snapshot recommended follow-ups.",
        projectName: "blueprint-webapp",
        assignee: "webapp-codex",
        priority: "high",
      },
    ] satisfies AnalyticsFollowUpIssue[]);
  });

  it("routes runtime credential work to ops instead of finance", () => {
    const issues = buildAnalyticsFollowUpIssues(
      ["Add GA4, Stripe, Firestore env vars to Paperclip runtime if analytics completeness required."],
      [],
      ROUTING_CONFIG,
    );

    expect(issues[0]?.projectName).toBe("blueprint-executive-ops");
    expect(issues[0]?.assignee).toBe("ops-lead");
    expect(issues[0]?.priority).toBe("high");
  });

  it("keeps explicit overrides and skips duplicate auto-generated issues", () => {
    const explicitIssues: AnalyticsFollowUpIssue[] = [
      {
        kind: "blocker",
        title: "Fix Analytics Daily CI failures",
        description: "Fix CI: address failing tests in ops-automation-scheduler, pipeline-routes, waitlist-automation-loop.",
        projectName: "blueprint-webapp",
        assignee: "webapp-review",
        priority: "high",
      },
    ];

    const issues = buildAnalyticsFollowUpIssues(
      [
        "Fix CI: address failing tests in ops-automation-scheduler, pipeline-routes, waitlist-automation-loop.",
        "Commit or add to .gitignore: .agents/skills/, .opencode/, ops/paperclip/docs/, ops/paperclip/playbooks/.",
      ],
      explicitIssues,
      ROUTING_CONFIG,
    );

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual(explicitIssues[0]);
    expect(issues[1]?.assignee).toBe("webapp-codex");
    expect(issues[1]?.projectName).toBe("blueprint-webapp");
  });
});
