import { attachRequestMeta, logger } from "../logger";
import { isEnvFlagEnabled } from "../config/env";
import { runWaitlistAutomationLoop } from "./waitlistAutomation";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_STARTUP_DELAY_MS = 15 * 1000;

export function startWaitlistAutomationScheduler() {
  if (!isEnvFlagEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")) {
    logger.info(
      attachRequestMeta({ route: "waitlist-automation-scheduler" }),
      "Waitlist automation scheduler disabled",
    );
    return () => {};
  }

  const intervalMs = Math.max(
    30_000,
    Number(process.env.BLUEPRINT_WAITLIST_AUTOMATION_INTERVAL_MS ?? DEFAULT_INTERVAL_MS),
  );
  const batchSize = Math.max(
    1,
    Math.min(25, Number(process.env.BLUEPRINT_WAITLIST_AUTOMATION_BATCH_SIZE ?? DEFAULT_BATCH_SIZE)),
  );
  const startupDelayMs = Math.max(
    0,
    Number(
      process.env.BLUEPRINT_WAITLIST_AUTOMATION_STARTUP_DELAY_MS ?? DEFAULT_STARTUP_DELAY_MS,
    ),
  );

  let stopped = false;
  let timeoutId: NodeJS.Timeout | null = null;
  let runNumber = 0;

  const scheduleNext = (delayMs: number) => {
    if (stopped) {
      return;
    }

    timeoutId = setTimeout(async () => {
      runNumber += 1;
      const runMeta = attachRequestMeta({
        route: "waitlist-automation-scheduler",
        runNumber,
        intervalMs,
        batchSize,
      });

      try {
        logger.info(runMeta, "Starting scheduled waitlist automation run");
        const result = await runWaitlistAutomationLoop({
          queue: "capturer_beta_review",
          limit: batchSize,
        });
        logger.info(
          attachRequestMeta({
            ...runMeta,
            processedCount: result.processedCount,
            failedCount: result.failedCount,
          }),
          "Completed scheduled waitlist automation run",
        );
      } catch (error) {
        logger.error(
          {
            ...runMeta,
            err: error,
          },
          "Scheduled waitlist automation run failed",
        );
      } finally {
        scheduleNext(intervalMs);
      }
    }, delayMs);
  };

  logger.info(
    attachRequestMeta({
      route: "waitlist-automation-scheduler",
      intervalMs,
      batchSize,
      startupDelayMs,
    }),
    "Waitlist automation scheduler enabled",
  );

  scheduleNext(startupDelayMs);

  return () => {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
