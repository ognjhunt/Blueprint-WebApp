import type { CityLaunchBudgetPolicy } from "./cityLaunchPolicy";
import { dispatchHumanBlocker } from "./human-blocker-dispatch";
import { getHumanBlockerThread } from "./human-reply-store";
import {
  buildCityLaunchFounderApprovalPacket,
  resolveCityLaunchFounderApprovalFromDurableState,
} from "./cityLaunchFounderApproval";

export type CityLaunchApprovalDispatchResult = {
  dispatched: boolean;
  blockerId: string | null;
  approvalCount: number;
  emailSent: boolean;
  slackMirrored: boolean;
  alreadyApproved: boolean;
  alreadyPending: boolean;
};

export async function dispatchCityLaunchFounderApproval(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
}): Promise<CityLaunchApprovalDispatchResult> {
  const { city, budgetPolicy } = input;
  const durableApproval = await resolveCityLaunchFounderApprovalFromDurableState({
    city,
    budgetPolicy,
  });
  const packet = buildCityLaunchFounderApprovalPacket({
    city,
    budgetPolicy,
  });
  const existingThread = await getHumanBlockerThread(packet.blockerId || "").catch(() => null);
  const alreadyApproved = durableApproval.founderApproved;
  const alreadyPending = Boolean(
    existingThread
    && !alreadyApproved
    && existingThread.status !== "resolved"
    && existingThread.status !== "blocked",
  );

  if (alreadyApproved || alreadyPending) {
    return {
      dispatched: false,
      blockerId: durableApproval.blockerId,
      approvalCount: packet.evidence.length,
      emailSent: false,
      slackMirrored: false,
      alreadyApproved,
      alreadyPending,
    };
  }

  const dispatch = await dispatchHumanBlocker({
    delivery_mode: "send_now",
    blocker_kind: "ops_commercial",
    mirror_to_slack: true,
    routing_owner: "blueprint-chief-of-staff",
    execution_owner: "city-launch-agent",
    sender_owner: "city-launch-agent",
    packet,
  });

  return {
    dispatched: true,
    blockerId: durableApproval.blockerId,
    approvalCount: packet.evidence.length,
    emailSent: dispatch.email_sent === true,
    slackMirrored: dispatch.slack_sent === true,
    alreadyApproved,
    alreadyPending,
  };
}
