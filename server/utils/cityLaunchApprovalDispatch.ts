import type { CityLaunchBudgetPolicy } from "./cityLaunchPolicy";
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

  return {
    dispatched: false,
    blockerId: durableApproval.blockerId,
    approvalCount: 0,
    emailSent: false,
    slackMirrored: false,
    alreadyApproved: durableApproval.founderApproved,
    alreadyPending: Boolean(
      existingThread
      && !durableApproval.founderApproved
      && existingThread.status !== "resolved"
      && existingThread.status !== "blocked",
    ),
  };
}
