// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getHumanBlockerThread = vi.hoisted(() => vi.fn());
const dispatchHumanBlocker = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-store", () => ({
  getHumanBlockerThread,
}));

vi.mock("../utils/human-blocker-dispatch", () => ({
  dispatchHumanBlocker,
}));

import {
  buildCityLaunchFounderApprovalPacket,
  dispatchCityLaunchFounderApprovalBlocker,
  getCityLaunchFounderApprovalBlockerId,
  isCityLaunchFounderApprovalResolved,
  resolveCityLaunchFounderApprovalFromDurableState,
} from "../utils/cityLaunchFounderApproval";

describe("city launch founder approval helpers", () => {
  afterEach(() => {
    dispatchHumanBlocker.mockReset();
    getHumanBlockerThread.mockReset();
  });

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
    expect(packet.resumeAction?.metadata?.windowHours).toBe(72);
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

  it("queues a review-required founder approval blocker for durable reply correlation", async () => {
    dispatchHumanBlocker.mockResolvedValue({
      blocker_id: "city-launch-approval-san-jose-ca",
      dispatch_id: "dispatch-approval-1",
      delivery_mode: "review_required",
      delivery_status: "awaiting_review",
      email_sent: false,
      slack_sent: false,
      thread: {
        id: "city-launch-approval-san-jose-ca",
      },
    });
    const packet = buildCityLaunchFounderApprovalPacket({
      city: "San Jose, CA",
      budgetPolicy: {
        tier: "lean",
        label: "Lean",
        maxTotalApprovedUsd: 2500,
        operatorAutoApproveUsd: 500,
        allowPaidAcquisition: true,
        allowReferralRewards: false,
        allowTravelReimbursement: true,
        founderApprovalRequiredAboveUsd: 2500,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
    });

    const result = await dispatchCityLaunchFounderApprovalBlocker({
      packet,
      packetPath: "/tmp/founder-decision-packet.md",
      deliveryMode: "review_required",
    });

    expect(result).toMatchObject({
      queued: true,
      blockerId: "city-launch-approval-san-jose-ca",
      dispatchId: "dispatch-approval-1",
      deliveryMode: "review_required",
      deliveryStatus: "awaiting_review",
      emailSent: false,
      slackSent: false,
      threadId: "city-launch-approval-san-jose-ca",
      error: null,
    });
    expect(dispatchHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "review_required",
        blocker_kind: "ops_commercial",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "city-launch-agent",
        sender_owner: "city-launch-agent",
        mirror_to_slack: false,
        packet: expect.objectContaining({
          blockerId: "city-launch-approval-san-jose-ca",
          resumeAction: expect.objectContaining({
            kind: "city_launch_activate",
          }),
        }),
        report_paths: ["/tmp/founder-decision-packet.md"],
      }),
    );
  });
});
