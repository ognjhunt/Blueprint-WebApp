/**
 * Dedicated background worker entrypoint (SCALE2-02).
 *
 * Runs the background loops outside the HTTP web process so a large batch
 * write can never compete for event-loop time with live traffic. Deployed as
 * the `blueprint-webapp-worker` Render worker service (`npm run
 * start:worker`); the web service (`npm start`) serves HTTP only.
 */
import { pathToFileURL } from "node:url";

import { validateEnv } from "./config/env";
import { attachRequestMeta, logger } from "./logger";
import { startTaskEvaluationLaunchForwardWorker } from "./utils/taskEvaluationLaunchForwardWorker";
import { startWebsiteCaptureWithdrawalWorker } from "./utils/websiteCaptureWithdrawal";
import { startWebsiteCaptureDeletionWorker } from "./utils/websiteCaptureDeletion";
import { startWebsiteJobWindowSweepWorker } from "./utils/websiteJobWindowSweep";
import { installProcessErrorHandlers } from "./utils/opsProcessAlerts";
import { startWorkerHeartbeat } from "./utils/workerHeartbeat";
import { startAutomaticSendWorker } from "./utils/jobAutoSend";
import { startJobOutcomeQuestionWorker } from "./utils/jobOutcomes";

export type WorkerHandle = {
  stop: () => Promise<void>;
};

export function startWorker(): WorkerHandle {
  validateEnv();

  logger.info(
    attachRequestMeta({ route: "worker" }),
    "Blueprint worker starting: Task Evaluation launch forwarder and job workers",
  );
  const stopTaskEvaluationLaunchForwarder = startTaskEvaluationLaunchForwardWorker();
  const stopWebsiteWithdrawals = startWebsiteCaptureWithdrawalWorker();
  // Deletion must not wait on the ops scheduler.
  const stopWebsiteDeletions = startWebsiteCaptureDeletionWorker();
  // A job whose window ran out is ended and its site told even when the Pipeline is unreachable and the ops scheduler is off.
  const stopWebsiteJobWindowSweep = startWebsiteJobWindowSweepWorker();
  // Every listed job goes to every approved deployment company once (package E, E4); the sweep catches a missed moment.
  const stopAutomaticSends = startAutomaticSendWorker();
  // The timed outcome questions after an introduction (package E, E8).
  const stopJobOutcomeQuestions = startJobOutcomeQuestionWorker();
  // The web process alerts when this goes stale (betaOpsMonitor, /health/worker).
  const stopHeartbeat = startWorkerHeartbeat();

  let stopPromise: Promise<void> | undefined;
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
    stopHeartbeat();
    stopTaskEvaluationLaunchForwarder();
    stopWebsiteWithdrawals();
    stopWebsiteDeletions();
    stopWebsiteJobWindowSweep();
    stopAutomaticSends();
    stopJobOutcomeQuestions();
    logger.info(attachRequestMeta({ route: "worker" }), "Blueprint worker stopped");
    })();
    return stopPromise;
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
  installProcessErrorHandlers({ processName: "worker" });
  const handle = startWorker();
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      logger.info(attachRequestMeta({ route: "worker" }), `Worker received ${signal}, stopping`);
      void handle.stop().then(() => process.exit(0));
    });
  }
}
