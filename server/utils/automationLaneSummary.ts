import { isAutomationLaneEnabled, isEnvFlagEnabled } from "../config/env";
import { logger } from "../logger";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";

/**
 * Every autonomous lane gated by `isAutomationLaneEnabled`, and therefore
 * switched on wholesale by BLUEPRINT_ALL_AUTOMATION_ENABLED. `where` says what
 * actually executes it: scheduler lanes only run in a process that started the
 * ops automation scheduler; request-path lanes run in the web process whenever
 * the flag is on.
 */
export const AUTONOMOUS_LANES: ReadonlyArray<{ key: string; where: "scheduler" | "request_path" }> = [
  { key: "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_INBOUND_AUTOMATION_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_SUPPORT_TRIAGE_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_PAYOUT_TRIAGE_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_CREATIVE_FACTORY_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_BUYER_LIFECYCLE_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_LIFECYCLE_CADENCE_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_SLA_WATCHDOG_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_NOTION_SYNC_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_ONBOARDING_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_CAPTURER_REMINDER_ENABLED", where: "scheduler" },
  { key: "BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED", where: "request_path" },
];

export function describeAutonomousLanes(options: { schedulerRunsHere: boolean }) {
  const allAutomation = isEnvFlagEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED");
  const enabled = AUTONOMOUS_LANES.filter((lane) => isAutomationLaneEnabled(lane.key));
  const enabledViaAll = enabled
    .filter((lane) => !String(process.env[lane.key] || "").trim())
    .map((lane) => lane.key);
  const active = enabled
    .filter((lane) => lane.where === "request_path" || options.schedulerRunsHere)
    .map((lane) => lane.key);
  const flaggedButIdle = enabled
    .filter((lane) => lane.where === "scheduler" && !options.schedulerRunsHere)
    .map((lane) => lane.key);
  return { allAutomation, enabled: enabled.map((lane) => lane.key), enabledViaAll, active, flaggedButIdle };
}

/**
 * Make a flipped automation switch visible: a loud boot warning when the
 * all-automation switch is on, and one ops alert per boot listing the lanes
 * that will actually run in this process.
 */
export async function announceAutonomousLanesAtBoot(options: {
  processName: "web" | "worker";
  schedulerRunsHere: boolean;
  alert?: (key: string, message: string) => Promise<unknown>;
}) {
  const summary = describeAutonomousLanes({ schedulerRunsHere: options.schedulerRunsHere });
  if (summary.allAutomation) {
    logger.warn(
      {
        event: "all_automation_enabled",
        process: options.processName,
        lanesEnabledByAllSwitch: summary.enabledViaAll,
      },
      `BLUEPRINT_ALL_AUTOMATION_ENABLED is on: it enables ${summary.enabledViaAll.length} autonomous lane(s) that have no explicit per-lane value (${summary.enabledViaAll.join(", ") || "none"})`,
    );
  }
  logger.info(
    { event: "autonomous_lanes_at_boot", process: options.processName, ...summary },
    "Autonomous lane state at boot",
  );
  if (summary.enabled.length === 0) return { alerted: false, summary };
  const alert = options.alert || sendRateLimitedOpsAlert;
  await Promise.resolve(
    alert(
      `autonomous_lanes_boot:${options.processName}`,
      [
        `:gear: Blueprint ${options.processName} booted with autonomous lanes flagged on`,
        `- Active in this process: ${summary.active.join(", ") || "none"}`,
        summary.flaggedButIdle.length
          ? `- Flagged but idle here (scheduler not running in this process): ${summary.flaggedButIdle.join(", ")}`
          : null,
        summary.allAutomation ? "- BLUEPRINT_ALL_AUTOMATION_ENABLED is ON" : null,
      ].filter(Boolean).join("\n"),
    ),
  ).catch(() => undefined);
  return { alerted: true, summary };
}
