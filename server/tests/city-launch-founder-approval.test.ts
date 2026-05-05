// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getHumanBlockerThread = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-store", () => ({
  getHumanBlockerThread,
}));

import {
  buildCityLaunchFounderApprovalPacket,
  getCityLaunchFounderApprovalBlockerId,
  isCityLaunchFounderApprovalResolved,
  resolveCityLaunchFounderApprovalFromDurableState,
} from "../utils/cityLaunchFounderApproval";

describe("city launch founder approval helpers", () => {
  it("uses a stable blocker id per city", () => {
    expect(getCityLaunchFounderApprovalBlockerId("San Jose, CA", "zero_budget")).toBe(
      "city-launch-approval-san-jose-ca",
    );
    expect(getCityLaunchFounderApprovalBlockerId("San Jose, CA", "low_budget")).toBe(
      "city-launch-approval-san-jose-ca",
    );
  });

  it("treats only resolved approval replies as valid founder approval", () => {
    expect(
      isCityLaunchFounderApprovalResolved({
        status: "routed",
        last_classification: "approval",
        last_resolution: "resolved_input",
        resume_action: { kind: "city_launch_activate" },
      }),
    ).toBe(true);

    expect(
      isCityLaunchFounderApprovalResolved({
        status: "awaiting_reply",
        last_classification: null,
        last_resolution: null,
        resume_action: { kind: "city_launch_activate" },
      }),
    ).toBe(false);

    expect(
      isCityLaunchFounderApprovalResolved({
        status: "routed",
        last_classification: "clarification",
        last_resolution: "ambiguous_input",
        resume_action: { kind: "city_launch_activate" },
      }),
    ).toBe(false);
  });

  it("builds a standard blocker packet for city launch approval", () => {
    const packet = buildCityLaunchFounderApprovalPacket({
      city: "San Jose, CA",
      budgetPolicy: {
        tier: "zero_budget",
        label: "Zero Budget",
        maxTotalApprovedUsd: 0,
        operatorAutoApproveUsd: 0,
        allowPaidAcquisition: false,
        allowReferralRewards: false,
        allowTravelReimbursement: false,
        founderApprovalRequiredAboveUsd: 0,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
    });

    expect(packet.blockerId).toBe("city-launch-approval-san-jose-ca");
    expect(packet.resumeAction?.kind).toBe("city_launch_activate");
    expect(packet.executionOwner).toBe("city-launch-agent");
    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.exactResponseNeeded).toContain("Reply APPROVE");
    expect(packet.whyBlocked).toContain("founder-gated");
  });

  it("does not infer founder approval when no durable approval thread exists", async () => {
    getHumanBlockerThread.mockResolvedValue(null);

    const result = await resolveCityLaunchFounderApprovalFromDurableState({
      city: "San Jose, CA",
      budgetPolicy: {
        tier: "zero_budget",
        label: "Zero Budget",
        maxTotalApprovedUsd: 0,
        operatorAutoApproveUsd: 0,
        allowPaidAcquisition: false,
        allowReferralRewards: false,
        allowTravelReimbursement: false,
        founderApprovalRequiredAboveUsd: 0,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
    });

    expect(result.founderApproved).toBe(false);
  });
});
