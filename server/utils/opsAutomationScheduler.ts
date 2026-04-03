import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import { isAutomationLaneEnabled } from "../config/env";
import {
  runInboundQualificationLoop,
  runPayoutExceptionTriageLoop,
  runPreviewDiagnosisLoop,
  runSupportTriageLoop,
  runWaitlistAutomationLoop,
} from "../agents";
import {
  flagOverdueFinanceReviews,
  flagOverdueSiteAccessReviews,
  runCapturerReminderLoop,
} from "./field-ops-automation";
import { runBuyerLifecycleCheck } from "./growth-ops";
import { runExperimentAutorollout } from "./experiment-ops";
import { runAutonomousResearchOutboundLoop } from "./autonomous-growth";
import { runCreativeAssetFactoryLoop } from "./creative-factory";
import { maybeAlertOnWorkerStatusTransition } from "./ops-alerts";
import { runSlaWatchdog } from "./sla-enforcement";
import { runNotionBidirectionalSync } from "./notion-sync";
import { runGraduationEvaluation } from "./agent-graduation";
import { runOnboardingWorker } from "./buyer-onboarding";

const WORKER_STATUS_COLLECTION = "opsAutomationWorkerStatus";

type WorkerDefinition = {
  key: string;
  enabledEnv: string;
  intervalEnv: string;
  batchEnv: string;
  startupDelayEnv: string;
  defaultIntervalMs: number;
  defaultBatchSize: number;
  maxBatchSize?: number;
  defaultStartupDelayMs: number;
  run: (params: { limit: number }) => Promise<{ processedCount: number; failedCount: number }>;
};

async function persistWorkerStatus(
  workerKey: string,
  payload: Record<string, unknown>,
) {
  if (!db) {
    return;
  }

  try {
    await db.collection(WORKER_STATUS_COLLECTION).doc(workerKey).set(
      {
        worker_key: workerKey,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        ...payload,
      },
      { merge: true },
    );
  } catch (error) {
    logger.warn({ err: error, worker: workerKey }, "Failed to persist worker status");
  }
}

const workers: WorkerDefinition[] = [
  {
    key: "waitlist",
    enabledEnv: "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED",
    intervalEnv: "BLUEPRINT_WAITLIST_AUTOMATION_INTERVAL_MS",
    batchEnv: "BLUEPRINT_WAITLIST_AUTOMATION_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_WAITLIST_AUTOMATION_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 15 * 1000,
    run: ({ limit }) =>
      runWaitlistAutomationLoop({
        queue: "capturer_beta_review",
        limit,
      }),
  },
  {
    key: "inbound_qualification",
    enabledEnv: "BLUEPRINT_INBOUND_AUTOMATION_ENABLED",
    intervalEnv: "BLUEPRINT_INBOUND_AUTOMATION_INTERVAL_MS",
    batchEnv: "BLUEPRINT_INBOUND_AUTOMATION_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_INBOUND_AUTOMATION_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 20 * 1000,
    run: ({ limit }) => runInboundQualificationLoop({ limit }),
  },
  {
    key: "support_triage",
    enabledEnv: "BLUEPRINT_SUPPORT_TRIAGE_ENABLED",
    intervalEnv: "BLUEPRINT_SUPPORT_TRIAGE_INTERVAL_MS",
    batchEnv: "BLUEPRINT_SUPPORT_TRIAGE_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_SUPPORT_TRIAGE_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 25 * 1000,
    run: ({ limit }) => runSupportTriageLoop({ limit }),
  },
  {
    key: "payout_exception",
    enabledEnv: "BLUEPRINT_PAYOUT_TRIAGE_ENABLED",
    intervalEnv: "BLUEPRINT_PAYOUT_TRIAGE_INTERVAL_MS",
    batchEnv: "BLUEPRINT_PAYOUT_TRIAGE_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_PAYOUT_TRIAGE_STARTUP_DELAY_MS",
    defaultIntervalMs: 10 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 30 * 1000,
    run: ({ limit }) => runPayoutExceptionTriageLoop({ limit }),
  },
  {
    key: "capturer_reminders",
    enabledEnv: "BLUEPRINT_CAPTURER_REMINDER_ENABLED",
    intervalEnv: "BLUEPRINT_CAPTURER_REMINDER_INTERVAL_MS",
    batchEnv: "BLUEPRINT_CAPTURER_REMINDER_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_CAPTURER_REMINDER_STARTUP_DELAY_MS",
    defaultIntervalMs: 10 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 40 * 1000,
    run: ({ limit }) => runCapturerReminderLoop({ limit }),
  },
  {
    key: "buyer_lifecycle",
    enabledEnv: "BLUEPRINT_BUYER_LIFECYCLE_ENABLED",
    intervalEnv: "BLUEPRINT_BUYER_LIFECYCLE_INTERVAL_MS",
    batchEnv: "BLUEPRINT_BUYER_LIFECYCLE_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_BUYER_LIFECYCLE_STARTUP_DELAY_MS",
    defaultIntervalMs: 24 * 60 * 60 * 1000,
    defaultBatchSize: 25,
    maxBatchSize: 100,
    defaultStartupDelayMs: 55 * 1000,
    run: ({ limit }) =>
      runBuyerLifecycleCheck({
        daysSinceGrant: Math.max(
          7,
          Number(process.env.BLUEPRINT_BUYER_LIFECYCLE_DAYS_SINCE_GRANT ?? 30),
        ),
        limit,
      }).then((result) => ({
        processedCount: result.count,
        failedCount: 0,
      })),
  },
  {
    key: "experiment_rollout",
    enabledEnv: "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED",
    intervalEnv: "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_INTERVAL_MS",
    batchEnv: "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_STARTUP_DELAY_MS",
    defaultIntervalMs: 60 * 60 * 1000,
    defaultBatchSize: 5000,
    maxBatchSize: 10000,
    defaultStartupDelayMs: 60 * 1000,
    run: ({ limit }) =>
      runExperimentAutorollout({
        lookbackDays: Math.max(
          7,
          Number(process.env.BLUEPRINT_EXPERIMENT_AUTOROLLOUT_LOOKBACK_DAYS ?? 30),
        ),
        minExposuresPerVariant: Math.max(
          10,
          Number(process.env.BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_EXPOSURES ?? 50),
        ),
        minRelativeLift: Math.max(
          0.01,
          Number(process.env.BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_RELATIVE_LIFT ?? 0.1),
        ),
        limit,
      }).then((result) => ({
        processedCount: result.count,
        failedCount: 0,
      })),
  },
  {
    key: "autonomous_research_outbound",
    enabledEnv: "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED",
    intervalEnv: "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_INTERVAL_MS",
    batchEnv: "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_STARTUP_DELAY_MS",
    defaultIntervalMs: 24 * 60 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 65 * 1000,
    run: async () => {
      const result = await runAutonomousResearchOutboundLoop();
      return {
        processedCount: result.count,
        failedCount: 0,
      };
    },
  },
  {
    key: "creative_asset_factory",
    enabledEnv: "BLUEPRINT_CREATIVE_FACTORY_ENABLED",
    intervalEnv: "BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS",
    batchEnv: "BLUEPRINT_CREATIVE_FACTORY_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_CREATIVE_FACTORY_STARTUP_DELAY_MS",
    defaultIntervalMs: 24 * 60 * 60 * 1000,
    defaultBatchSize: 1,
    defaultStartupDelayMs: 75 * 1000,
    run: async () => {
      const result = await runCreativeAssetFactoryLoop();
      return {
        processedCount: result.status === "skipped_existing" ? 0 : 1,
        failedCount: 0,
      };
    },
  },
  {
    key: "site_access_overdue_watchdog",
    enabledEnv: "BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED",
    intervalEnv: "BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_INTERVAL_MS",
    batchEnv: "BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_STARTUP_DELAY_MS",
    defaultIntervalMs: 15 * 60 * 1000,
    defaultBatchSize: 50,
    maxBatchSize: 100,
    defaultStartupDelayMs: 45 * 1000,
    run: ({ limit }) => flagOverdueSiteAccessReviews({ limit }),
  },
  {
    key: "finance_review_overdue_watchdog",
    enabledEnv: "BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED",
    intervalEnv: "BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_INTERVAL_MS",
    batchEnv: "BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_STARTUP_DELAY_MS",
    defaultIntervalMs: 15 * 60 * 1000,
    defaultBatchSize: 50,
    maxBatchSize: 100,
    defaultStartupDelayMs: 50 * 1000,
    run: ({ limit }) => flagOverdueFinanceReviews({ limit }),
  },
  {
    key: "preview_diagnosis",
    enabledEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED",
    intervalEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_INTERVAL_MS",
    batchEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 35 * 1000,
    run: ({ limit }) => runPreviewDiagnosisLoop({ limit }),
  },
  {
    key: "sla_watchdog",
    enabledEnv: "BLUEPRINT_SLA_WATCHDOG_ENABLED",
    intervalEnv: "BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS",
    batchEnv: "BLUEPRINT_SLA_WATCHDOG_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_SLA_WATCHDOG_STARTUP_DELAY_MS",
    defaultIntervalMs: 60 * 60 * 1000,
    defaultBatchSize: 50,
    maxBatchSize: 200,
    defaultStartupDelayMs: 70 * 1000,
    run: ({ limit }) => runSlaWatchdog({ limit }),
  },
  {
    key: "notion_sync",
    enabledEnv: "BLUEPRINT_NOTION_SYNC_ENABLED",
    intervalEnv: "BLUEPRINT_NOTION_SYNC_INTERVAL_MS",
    batchEnv: "BLUEPRINT_NOTION_SYNC_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_NOTION_SYNC_STARTUP_DELAY_MS",
    defaultIntervalMs: 30 * 60 * 1000,
    defaultBatchSize: 50,
    maxBatchSize: 200,
    defaultStartupDelayMs: 80 * 1000,
    run: ({ limit }) => runNotionBidirectionalSync({ limit }),
  },
  {
    key: "graduation_eval",
    enabledEnv: "BLUEPRINT_ALL_AUTOMATION_ENABLED",
    intervalEnv: "BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS",
    batchEnv: "BLUEPRINT_GRADUATION_EVAL_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_GRADUATION_EVAL_STARTUP_DELAY_MS",
    defaultIntervalMs: 24 * 60 * 60 * 1000,
    defaultBatchSize: 20,
    maxBatchSize: 50,
    defaultStartupDelayMs: 90 * 1000,
    run: ({ limit }) => runGraduationEvaluation({ limit }),
  },
  {
    key: "onboarding_sequence",
    enabledEnv: "BLUEPRINT_ONBOARDING_ENABLED",
    intervalEnv: "BLUEPRINT_ONBOARDING_INTERVAL_MS",
    batchEnv: "BLUEPRINT_ONBOARDING_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_ONBOARDING_STARTUP_DELAY_MS",
    defaultIntervalMs: 60 * 60 * 1000,
    defaultBatchSize: 25,
    maxBatchSize: 100,
    defaultStartupDelayMs: 75 * 1000,
    run: ({ limit }) => runOnboardingWorker({ limit }),
  },
];

export function startOpsAutomationScheduler() {
  const disposers: Array<() => void> = [];

  for (const worker of workers) {
    if (!isAutomationLaneEnabled(worker.enabledEnv)) {
      void persistWorkerStatus(worker.key, {
        enabled: false,
        status: "disabled",
        interval_ms: null,
        batch_size: null,
        startup_delay_ms: null,
        last_error: null,
      });
      logger.info(
        attachRequestMeta({ route: "ops-automation-scheduler", worker: worker.key }),
        `Ops automation worker ${worker.key} disabled`,
      );
      continue;
    }

    const intervalMs = Math.max(
      30_000,
      Number(process.env[worker.intervalEnv] ?? worker.defaultIntervalMs),
    );
    const batchSize = Math.max(
      1,
      Math.min(
        worker.maxBatchSize ?? Math.max(worker.defaultBatchSize, 25),
        Number(process.env[worker.batchEnv] ?? worker.defaultBatchSize),
      ),
    );
    const startupDelayMs = Math.max(
      0,
      Number(process.env[worker.startupDelayEnv] ?? worker.defaultStartupDelayMs),
    );

    void persistWorkerStatus(worker.key, {
      enabled: true,
      status: "scheduled",
      interval_ms: intervalMs,
      batch_size: batchSize,
      startup_delay_ms: startupDelayMs,
      last_error: null,
    });

    let stopped = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let runNumber = 0;
    let lastKnownStatus: string | null = "scheduled";

    const scheduleNext = (delayMs: number) => {
      if (stopped) {
        return;
      }
      timeoutId = setTimeout(async () => {
        runNumber += 1;
        const runStartedAt = Date.now();
        const runStartedAtIso = new Date(runStartedAt).toISOString();
        const meta = attachRequestMeta({
          route: "ops-automation-scheduler",
          worker: worker.key,
          runNumber,
          batchSize,
          intervalMs,
        });

        try {
          await persistWorkerStatus(worker.key, {
            enabled: true,
            status: "running",
            interval_ms: intervalMs,
            batch_size: batchSize,
            startup_delay_ms: startupDelayMs,
            last_run_number: runNumber,
            last_run_started_at_iso: runStartedAtIso,
            last_run_started_at: admin.firestore.FieldValue.serverTimestamp(),
            last_error: null,
          });
          logger.info(meta, `Starting ${worker.key} automation run`);
          const result = await worker.run({ limit: batchSize });
          await persistWorkerStatus(worker.key, {
            enabled: true,
            status: "idle",
            interval_ms: intervalMs,
            batch_size: batchSize,
            startup_delay_ms: startupDelayMs,
            last_run_number: runNumber,
            last_run_started_at_iso: runStartedAtIso,
            last_run_completed_at_iso: new Date().toISOString(),
            last_run_completed_at: admin.firestore.FieldValue.serverTimestamp(),
            last_run_duration_ms: Date.now() - runStartedAt,
            last_processed_count: result.processedCount,
            last_failed_count: result.failedCount,
            last_error: null,
          });
          await maybeAlertOnWorkerStatusTransition({
            workerKey: worker.key,
            previousStatus: lastKnownStatus,
            nextStatus: "idle",
            intervalMs,
            batchSize,
            runNumber,
            processedCount: result.processedCount,
            failedCount: result.failedCount,
            error: null,
          });
          lastKnownStatus = "idle";
          logger.info(
            attachRequestMeta({
              ...meta,
              processedCount: result.processedCount,
              failedCount: result.failedCount,
            }),
            `Completed ${worker.key} automation run`,
          );
        } catch (error) {
          await persistWorkerStatus(worker.key, {
            enabled: true,
            status: "failed",
            interval_ms: intervalMs,
            batch_size: batchSize,
            startup_delay_ms: startupDelayMs,
            last_run_number: runNumber,
            last_run_started_at_iso: runStartedAtIso,
            last_run_completed_at_iso: new Date().toISOString(),
            last_run_completed_at: admin.firestore.FieldValue.serverTimestamp(),
            last_run_duration_ms: Date.now() - runStartedAt,
            last_error: error instanceof Error ? error.message : String(error),
          });
          await maybeAlertOnWorkerStatusTransition({
            workerKey: worker.key,
            previousStatus: lastKnownStatus,
            nextStatus: "failed",
            intervalMs,
            batchSize,
            runNumber,
            error: error instanceof Error ? error.message : String(error),
          });
          lastKnownStatus = "failed";
          logger.error({ ...meta, err: error }, `${worker.key} automation run failed`);
        } finally {
          scheduleNext(intervalMs);
        }
      }, delayMs);
    };

    logger.info(
      attachRequestMeta({
        route: "ops-automation-scheduler",
        worker: worker.key,
        intervalMs,
        batchSize,
        startupDelayMs,
      }),
      `Ops automation worker ${worker.key} enabled`,
    );

    scheduleNext(startupDelayMs);

    disposers.push(() => {
      stopped = true;
      void persistWorkerStatus(worker.key, {
        enabled: false,
        status: "stopped",
      });
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
