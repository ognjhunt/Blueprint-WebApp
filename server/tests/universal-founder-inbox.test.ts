// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderHumanBlockerPacketText } from "../utils/human-blocker-packet";
import { buildCityLaunchFounderApprovalPacket } from "../utils/cityLaunchFounderApproval";
import { buildCityLaunchBudgetPolicy } from "../utils/cityLaunchPolicy";

describe("universal founder inbox packet", () => {
  it("renders decision, repo, and policy context when present", () => {
    const rendered = renderHumanBlockerPacketText({
      blockerId: "blocker-1",
      title: "Test blocker",
      summary: "Summary",
      decisionType: "queued_action_approval",
      irreversibleActionClass: "external_send",
      recommendedAnswer: "Approve",
      exactResponseNeeded: "Reply approved",
      whyBlocked: "Blocked for review.",
      alternatives: ["Reject"],
      risk: "Wrong external send.",
      executionOwner: "growth-lead",
      immediateNextAction: "Resume the send.",
      deadline: "Today",
      evidence: ["Queued action exists."],
      nonScope: "No policy changes.",
      repoContext: {
        repo: "Blueprint-WebApp",
        project: "blueprint-webapp",
        issueId: "issue-123",
      },
      policyContext: {
        gateMode: "universal_founder_inbox",
        reasonCategory: "campaign_or_lifecycle_send_requires_review",
        autoExecutionEligible: false,
      },
    });

    expect(rendered).toContain("Decision Context");
    expect(rendered).toContain("Repo Context");
    expect(rendered).toContain("Policy Context");
    expect(rendered).toContain("queued_action_approval");
    expect(rendered).toContain("Blueprint-WebApp");
  });

  it("marks city launch founder packets as universal founder inbox items", () => {
    const packet = buildCityLaunchFounderApprovalPacket({
      city: "Seattle, WA",
      budgetPolicy: buildCityLaunchBudgetPolicy({
        tier: "funded",
        maxTotalApprovedUsd: 15000,
        operatorAutoApproveUsd: 1500,
      }),
    });

    expect(packet.decisionType).toBe("city_launch_activation");
    expect(packet.policyContext?.gateMode).toBe("universal_founder_inbox");
    expect(packet.repoContext?.repo).toBe("Blueprint-WebApp");
  });
});
