/**
 * Dedicated background worker entrypoint (SCALE2-02).
 *
 * Runs the ~20 ops automation lanes outside the HTTP web process so a slow
 * Notion sync or large batch write can never compete for event-loop time with
 * live buyer/creator traffic. Deployed as the `blueprint-webapp-worker`
 * Render worker service (`npm run start:worker`); the web service
 * (`npm start`) serves HTTP only.
 *
 * The ops automation leader lease stays active here: if Render ever scales
 * this worker beyond one instance — or the web-process escape hatch
 * (BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1) is enabled during a transition —
 * only the lease holder actually runs lanes.
 */
import { pathToFileURL } from "node:url";

import { validateEnv } from "./config/env";
import { attachRequestMeta, logger } from "./logger";
import { startOpsAutomationScheduler } from "./utils/opsAutomationScheduler";
import { startStripeWebhookQueueProcessor } from "./utils/stripeWebhookQueue";
import { startTaskEvaluationLaunchForwardWorker } from "./utils/taskEvaluationLaunchForwardWorker";

const launchForwardOnly = () =>
  ["1", "true", "yes", "on"].includes(
    String(
      process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER || "",
    ).trim().toLowerCase(),
  );

export type WorkerHandle = {
  stop: () => Promise<void>;
};

export function startWorker(): WorkerHandle {
  validateEnv();

  const taskEvaluationLaunchOnly = launchForwardOnly();

  logger.info(
    attachRequestMeta({
      route: "worker",
      taskEvaluationLaunchOnly,
    }),
    taskEvaluationLaunchOnly
      ? "Blueprint worker starting: Task Evaluation launch forwarder only"
      : "Blueprint worker starting: ops automation scheduler + Stripe webhook queue processor + Task Evaluation launch forwarder",
  );
  const stopScheduler = taskEvaluationLaunchOnly
    ? () => undefined
    : startOpsAutomationScheduler();
  const stopQueueProcessor = taskEvaluationLaunchOnly
    ? () => undefined
    : startStripeWebhookQueueProcessor();
  const stopTaskEvaluationLaunchForwarder = startTaskEvaluationLaunchForwardWorker();

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    stopQueueProcessor();
    stopTaskEvaluationLaunchForwarder();
    stopScheduler();
    logger.info(attachRequestMeta({ route: "worker" }), "Blueprint worker stopped");
  };

  return { stop };
}

const isMainModule = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const handle = startWorker();
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      logger.info(attachRequestMeta({ route: "worker" }), `Worker received ${signal}, stopping`);
      void handle.stop().then(() => process.exit(0));
    });
  }
}
