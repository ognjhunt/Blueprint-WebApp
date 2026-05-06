// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const getHumanBlockerThread = vi.hoisted(() => vi.fn());
const dispatchHumanBlocker = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-store", () => ({
  getHumanBlockerThread,
}));

vi.mock("../utils/human-blocker-dispatch", () => ({
  dispatchHumanBlocker,
}));

afterEach(() => {
  getHumanBlockerThread.mockReset();
  dispatchHumanBlocker.mockReset();
  vi.resetModules();
});

const budgetPolicy = {
  tier: "zero_budget" as const,
  label: "Zero Budget",
  maxTotalApprovedUsd: 0,
  operatorAutoApproveUsd: 0,
  allowPaidAcquisition: false,
  allowReferralRewards: false,
  allowTravelReimbursement: false,
  founderApprovalRequiredAboveUsd: 0,
  founderApprovalTriggers: [],
  operatorLane: "growth-lead" as const,
};

describe("city launch approval dispatch", () => {
  it("dispatches the standard blocker packet when approval is not already durable", async () => {
    getHumanBlockerThread.mockResolvedValue(null);
    dispatchHumanBlocker.mockResolvedValue({
      blocker_id: "city-launch-approval-san-jose-ca",
      email_sent: true,
      slack_sent: true,
    });

    const { dispatchCityLaunchFounderApproval } = await import("../utils/cityLaunchApprovalDispatch");
    const result = await dispatchCityLaunchFounderApproval({
      city: "San Jose, CA",
      budgetPolicy,
    });

    expect(dispatchHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "send_now",
        blocker_kind: "ops_commercial",
        mirror_to_slack: true,
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "city-launch-agent",
        packet: expect.objectContaining({
          blockerId: "city-launch-approval-san-jose-ca",
          resumeAction: expect.objectContaining({
            kind: "city_launch_activate",
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      dispatched: true,
      blockerId: "city-launch-approval-san-jose-ca",
      emailSent: true,
      slackMirrored: true,
      alreadyApproved: false,
      alreadyPending: false,
    });
  });

  it("does not redispatch when a pending durable approval thread exists", async () => {
    getHumanBlockerThread.mockResolvedValue({
      status: "awaiting_reply",
      last_classification: null,
      last_resolution: null,
      resume_action: {
        kind: "city_launch_activate",
      },
    });

    const { dispatchCityLaunchFounderApproval } = await import("../utils/cityLaunchApprovalDispatch");
    const result = await dispatchCityLaunchFounderApproval({
      city: "San Jose, CA",
      budgetPolicy,
    });

    expect(dispatchHumanBlocker).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dispatched: false,
      alreadyApproved: false,
      alreadyPending: true,
    });
  });
});
