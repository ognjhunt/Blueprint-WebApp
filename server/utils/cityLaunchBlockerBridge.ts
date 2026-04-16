import {
  listCityLaunchActivations,
  readCityLaunchActivation,
} from "./cityLaunchLedgers";
import { dispatchHumanBlocker } from "./human-blocker-dispatch";
import type { HumanBlockerPacket } from "./human-blocker-packet";
import { logger } from "../logger";
import type { CityLaunchTask } from "./cityLaunchExecutionHarness";

export type CityLaunchBlockerBridgeResult = {
  city: string;
  dispatchedBlockers: number;
  skippedNoGate: number;
  skippedAlreadyDispatched: number;
  errors: string[];
};

function buildBlockerPacketFromTask(
  task: CityLaunchTask,
  city: string,
): HumanBlockerPacket | null {
  if (!task.humanGate) {
    return null;
  }

  return {
    title: `[City Launch] ${city}: ${task.title}`,
    summary: `Task ${task.key} in ${city} requires human gate approval: ${task.humanGate}`,
    recommendedAnswer: "Approve and proceed with the gated action.",
    exactResponseNeeded: `Reply APPROVE to proceed with task ${task.key}, or REJECT with reasons.`,
    whyBlocked: task.humanGate,
    alternatives: [
      "APPROVE — proceed with the gated action",
      "REJECT — block the action and keep the task paused",
    ],
    risk: `Without approval, task ${task.key} stays paused and downstream tasks may be blocked.`,
    executionOwner: task.ownerLane,
    immediateNextAction: `After approval, task ${task.key} can proceed to ${task.doneWhen[0] || "completion"}.`,
    deadline: "Within 24 hours — downstream execution lanes are waiting.",
    evidence: task.inputs,
    nonScope: "This approval only covers the specific gated action described; it does not authorize spend beyond policy, public claims, or precedent-setting exceptions.",
  };
}

export async function bridgeCityLaunchHumanGates(input: {
  city: string;
  taskFilter?: string[];
}): Promise<CityLaunchBlockerBridgeResult> {
  const { city, taskFilter } = input;
  const errors: string[] = [];
  let dispatchedBlockers = 0;
  let skippedNoGate = 0;
  let skippedAlreadyDispatched = 0;

  const activation = await readCityLaunchActivation(city).catch(() => null);
  if (!activation) {
    return {
      city,
      dispatchedBlockers: 0,
      skippedNoGate: 0,
      skippedAlreadyDispatched: 0,
      errors: [`No activation found for ${city}`],
    };
  }

  // Get the task issue IDs from the activation record
  const taskIssueIds = activation.taskIssueIds || {};
  const taskKeys = taskFilter || Object.keys(taskIssueIds);

  // Import the execution harness to get the task definitions
  const { buildCityExecutionTasks } = await import("./cityLaunchExecutionHarness");
  const { resolveCityLaunchProfile } = await import("./cityLaunchProfiles");
  const { buildCityLaunchBudgetPolicy } = await import("./cityLaunchPolicy");

  const profile = resolveCityLaunchProfile(city, activation.budgetTier);
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: activation.budgetTier,
    maxTotalApprovedUsd: activation.budgetPolicy.maxTotalApprovedUsd,
    operatorAutoApproveUsd: activation.budgetPolicy.operatorAutoApproveUsd,
  });

  const allTasks = buildCityExecutionTasks(profile);
  const filteredTasks = taskKeys.length > 0
    ? allTasks.filter((task: CityLaunchTask) => taskKeys.includes(task.key))
    : allTasks;

  for (const task of filteredTasks) {
    if (!task.humanGate) {
      skippedNoGate++;
      continue;
    }

    // Check if this blocker was already dispatched (has a thread record)
    const blockerId = `city-launch-${profile.key}-${task.key}`;
    try {
      const { getHumanBlockerThread } = await import("./human-reply-store");
      const existingThread = await getHumanBlockerThread(blockerId);
      if (existingThread && existingThread.status !== "resolved") {
        skippedAlreadyDispatched++;
        continue;
      }
    } catch {
      // If we can't check, proceed with dispatch
    }

    const packet = buildBlockerPacketFromTask(task, city);
    if (!packet) {
      skippedNoGate++;
      continue;
    }

    // Add the blockerId to the packet
    const packetWithId: HumanBlockerPacket = {
      ...packet,
      blockerId,
    };

    try {
      await dispatchHumanBlocker({
        delivery_mode: "send_now",
        packet: packetWithId,
        blocker_kind: "ops_commercial",
        email_target: null, // Uses default APPROVED_HUMAN_REPLY_EMAIL
        mirror_to_slack: true,
        paperclip_issue_id: taskIssueIds[task.key] || null,
      });
      dispatchedBlockers++;
    } catch (error) {
      errors.push(
        `Failed to dispatch blocker for ${task.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info(
    {
      city,
      dispatchedBlockers,
      skippedNoGate,
      skippedAlreadyDispatched,
      errorCount: errors.length,
    },
    "City launch human gate bridge completed",
  );

  return {
    city,
    dispatchedBlockers,
    skippedNoGate,
    skippedAlreadyDispatched,
    errors,
  };
}
