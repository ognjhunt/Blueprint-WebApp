import { describe, expect, it } from "vitest";
import { planBlockedIssueFollowUp } from "./blocked-followups.js";

const ROUTING_CONFIG = {
  chiefOfStaffAgent: "blueprint-chief-of-staff",
  ctoAgent: "blueprint-cto",
  executiveOpsProjectName: "blueprint-executive-ops",
  repoCatalog: [
    { key: "webapp", projectName: "blueprint-webapp", githubRepo: "Blueprint-WebApp", implementationAgent: "webapp-codex", reviewAgent: "webapp-review" },
    { key: "pipeline", projectName: "blueprint-capture-pipeline", githubRepo: "BlueprintCapturePipeline", implementationAgent: "pipeline-codex", reviewAgent: "pipeline-review" },
    { key: "capture", projectName: "blueprint-capture", githubRepo: "BlueprintCapture", implementationAgent: "capture-codex", reviewAgent: "capture-review" },
  ],
  opsAgents: {
    opsLead: "ops-lead",
    intake: "buyer-success-agent",
    captureQa: "capture-qa-agent",
    fieldOps: "field-ops-agent",
    financeSupport: "finance-support-agent",
  },
  growthAgents: {
    growthLead: "growth-lead",
    conversionOptimizer: "conversion-agent",
    analytics: "analytics-agent",
    communityUpdates: "community-updates-agent",
    marketIntel: "market-intel-agent",
    demandIntel: "demand-intel-agent",
    robotTeamGrowth: "robot-team-growth-agent",
    siteOperatorPartnership: "site-operator-partnership-agent",
    cityDemand: "city-demand-agent",
  },
} as const;

describe("blocked issue follow-up planning", () => {
  it("routes blocked repo-review work into the implementation lane", () => {
    const plan = planBlockedIssueFollowUp(
      {
        identifier: "BLU-16",
        title: "blueprint-capture local worktree drift",
        status: "blocked",
        projectName: "blueprint-capture",
        currentAssignee: "capture-review",
        blockerSummary: "Needs capture-codex to reconcile validator compatibility.",
      },
      ROUTING_CONFIG,
    );

    expect(plan).toMatchObject({
      title: "Implement unblock path for blueprint-capture local worktree drift",
      projectName: "blueprint-capture",
      assignee: "capture-codex",
    });
  });

  it("routes blocked repo-implementation work back to review", () => {
    const plan = planBlockedIssueFollowUp(
      {
        title: "Fix analytics verification runtime env audit",
        status: "blocked",
        projectName: "blueprint-webapp",
        currentAssignee: "webapp-codex",
        blockerSummary: "Needs review on the release gating expectations before landing.",
      },
      ROUTING_CONFIG,
    );

    expect(plan).toMatchObject({
      title: "Review unblock path for Fix analytics verification runtime env audit",
      projectName: "blueprint-webapp",
      assignee: "webapp-review",
    });
  });

  it("routes blocked departmental specialists up to their lead", () => {
    const plan = planBlockedIssueFollowUp(
      {
        title: "Demand Intel Weekly Digest - buyer proof synthesis",
        status: "blocked",
        projectName: "blueprint-executive-ops",
        currentAssignee: "demand-intel-agent",
        blockerSummary: "Missing decision on which demand proof lane to prioritize.",
      },
      ROUTING_CONFIG,
    );

    expect(plan).toMatchObject({
      assignee: "growth-lead",
      projectName: "blueprint-executive-ops",
    });
  });

  it("routes blocked chief-of-staff issues to the specialized owner when a route exists", () => {
    const plan = planBlockedIssueFollowUp(
      {
        title: "Security procurement active review for hosted-review buyer",
        status: "blocked",
        projectName: "blueprint-executive-ops",
        currentAssignee: "blueprint-chief-of-staff",
        blockerSummary: "Needs the security packet owner to finish the response.",
      },
      ROUTING_CONFIG,
    );

    expect(plan).toMatchObject({
      assignee: "security-procurement-agent",
      projectName: "blueprint-executive-ops",
    });
  });

  it("does not create another follow-up when one is already active", () => {
    const plan = planBlockedIssueFollowUp(
      {
        title: "blueprint-webapp branch drift",
        status: "blocked",
        projectName: "blueprint-webapp",
        currentAssignee: "webapp-review",
        blockerSummary: "Needs preserve-and-switch work.",
        hasOpenChild: true,
      },
      ROUTING_CONFIG,
    );

    expect(plan).toBeNull();
  });
});
