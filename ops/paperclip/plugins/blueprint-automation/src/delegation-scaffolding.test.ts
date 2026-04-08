import { describe, expect, it } from "vitest";
import {
  isLikelySmokeArtifact,
  planChiefOwnedBacklogDelegation,
  shouldQuarantineSmokeArtifact,
} from "./delegation-scaffolding.js";

const CONFIG = {
  chiefOfStaffAgent: "blueprint-chief-of-staff",
  ctoAgent: "blueprint-cto",
  executiveOpsProjectName: "Blueprint Executive Ops",
  repoCatalog: [
    { key: "webapp", projectName: "blueprint-webapp", githubRepo: "Blueprint-WebApp", implementationAgent: "webapp-codex", reviewAgent: "webapp-review" },
    { key: "pipeline", projectName: "blueprint-capture-pipeline", githubRepo: "BlueprintCapturePipeline", implementationAgent: "pipeline-codex", reviewAgent: "pipeline-review" },
    { key: "capture", projectName: "blueprint-capture", githubRepo: "BlueprintCapture", implementationAgent: "capture-codex", reviewAgent: "capture-review" },
  ],
  opsAgents: {
    opsLead: "ops-lead",
    intake: "intake-agent",
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
    capturerGrowth: "capturer-growth-agent",
  },
} as const;

describe("delegation scaffolding", () => {
  it("detects smoke artifacts from title and source", () => {
    expect(isLikelySmokeArtifact({ title: "Smoke CI issue" })).toBe(true);
    expect(isLikelySmokeArtifact({
      title: "Stripe: payout.failed (evt_smoke_smoke-1775614156)",
      source: { sourceType: "ops-stripe", sourceId: "evt_smoke_smoke-1775614156" },
    })).toBe(true);
  });

  it("quarantines stale smoke artifacts and children of resolved smoke parents", () => {
    expect(shouldQuarantineSmokeArtifact({
      title: "Smoke blocker follow-up",
      status: "backlog",
      parentStatus: "done",
    }, "2026-04-08T03:00:00.000Z")).toBe(true);

    expect(shouldQuarantineSmokeArtifact({
      title: "Smoke CI issue",
      status: "backlog",
      updatedAt: "2026-04-08T02:40:00.000Z",
    }, "2026-04-08T03:00:00.000Z")).toBe(true);
  });

  it("plans a child execution issue for chief-owned market intel backlog", () => {
    const plan = planChiefOwnedBacklogDelegation(
      {
        identifier: "BLU-1587",
        title: "Notion Work Queue: Market Intel Daily Digest - 2026-03-30",
        status: "backlog",
        projectName: "Blueprint Executive Ops",
        currentAssignee: "blueprint-chief-of-staff",
      },
      CONFIG,
    );

    expect(plan).toMatchObject({
      title: "Follow through: Notion Work Queue: Market Intel Daily Digest - 2026-03-30",
      assignee: "market-intel-agent",
      projectName: "Blueprint Executive Ops",
    });
  });

  it("plans a repo implementation child for chief-owned capture sync backlog", () => {
    const plan = planChiefOwnedBacklogDelegation(
      {
        identifier: "BLU-1586",
        title: "Notion Work Queue: Keep BlueprintCapture platform context synced with bridge and GPU contracts",
        status: "backlog",
        projectName: "blueprint-capture",
        currentAssignee: "blueprint-chief-of-staff",
      },
      CONFIG,
    );

    expect(plan).toMatchObject({
      assignee: "capture-codex",
      projectName: "blueprint-capture",
    });
  });

  it("does not create child execution issues for smoke backlog or when one already exists", () => {
    expect(planChiefOwnedBacklogDelegation(
      {
        title: "Smoke CI issue",
        status: "backlog",
        projectName: "Blueprint WebApp",
        currentAssignee: "blueprint-chief-of-staff",
      },
      CONFIG,
    )).toBeNull();

    expect(planChiefOwnedBacklogDelegation(
      {
        title: "Routine follow-through: Analytics Daily",
        status: "backlog",
        projectName: "Blueprint Executive Ops",
        currentAssignee: "blueprint-chief-of-staff",
        hasOpenChild: true,
      },
      CONFIG,
    )).toBeNull();
  });
});
