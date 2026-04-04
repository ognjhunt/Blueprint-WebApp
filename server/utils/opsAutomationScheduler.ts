import { attachRequestMeta, logger } from "../logger";
import { isEnvFlagEnabled } from "../config/env";
import {
  runInboundQualificationLoop,
  runIntakeStaleScanLoop,
  runPayoutExceptionTriageLoop,
  runPreviewDiagnosisLoop,
  runSupportTriageLoop,
  runWaitlistAutomationLoop,
} from "../agents";

type WorkerDefinition = {
  key: string;
  enabled: () => boolean;
  intervalEnv: string;
  batchEnv: string;
  startupDelayEnv: string;
  defaultIntervalMs: number;
  defaultBatchSize: number;
  defaultStartupDelayMs: number;
  run: (params: { limit: number }) => Promise<{ processedCount: number; failedCount: number }>;
};

const workers: WorkerDefinition[] = [
  {
    key: "waitlist",
    enabled: () => isEnvFlagEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED"),
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
    enabled: () => isEnvFlagEnabled("BLUEPRINT_INBOUND_AUTOMATION_ENABLED"),
    intervalEnv: "BLUEPRINT_INBOUND_AUTOMATION_INTERVAL_MS",
    batchEnv: "BLUEPRINT_INBOUND_AUTOMATION_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_INBOUND_AUTOMATION_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 20 * 1000,
    run: ({ limit }) => runInboundQualificationLoop({ limit }),
  },
  {
    key: "intake_stale_scan",
    enabled: () =>
      isEnvFlagEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED") ||
      isEnvFlagEnabled("BLUEPRINT_INBOUND_AUTOMATION_ENABLED"),
    intervalEnv: "BLUEPRINT_INTAKE_STALE_SCAN_INTERVAL_MS",
    batchEnv: "BLUEPRINT_INTAKE_STALE_SCAN_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_INTAKE_STALE_SCAN_STARTUP_DELAY_MS",
    defaultIntervalMs: 60 * 60 * 1000,
    defaultBatchSize: 25,
    defaultStartupDelayMs: 45 * 1000,
    run: ({ limit }) => runIntakeStaleScanLoop({ limit, ageHours: 24 }),
  },
  {
    key: "support_triage",
    enabled: () => isEnvFlagEnabled("BLUEPRINT_SUPPORT_TRIAGE_ENABLED"),
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
    enabled: () => isEnvFlagEnabled("BLUEPRINT_PAYOUT_TRIAGE_ENABLED"),
    intervalEnv: "BLUEPRINT_PAYOUT_TRIAGE_INTERVAL_MS",
    batchEnv: "BLUEPRINT_PAYOUT_TRIAGE_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_PAYOUT_TRIAGE_STARTUP_DELAY_MS",
    defaultIntervalMs: 10 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 30 * 1000,
    run: ({ limit }) => runPayoutExceptionTriageLoop({ limit }),
  },
  {
    key: "preview_diagnosis",
    enabled: () => isEnvFlagEnabled("BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED"),
    intervalEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_INTERVAL_MS",
    batchEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_BATCH_SIZE",
    startupDelayEnv: "BLUEPRINT_PREVIEW_DIAGNOSIS_STARTUP_DELAY_MS",
    defaultIntervalMs: 5 * 60 * 1000,
    defaultBatchSize: 10,
    defaultStartupDelayMs: 35 * 1000,
    run: ({ limit }) => runPreviewDiagnosisLoop({ limit }),
  },
];

export function startOpsAutomationScheduler() {
  const disposers: Array<() => void> = [];

  for (const worker of workers) {
    if (!worker.enabled()) {
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
      Math.min(25, Number(process.env[worker.batchEnv] ?? worker.defaultBatchSize)),
    );
    const startupDelayMs = Math.max(
      0,
      Number(process.env[worker.startupDelayEnv] ?? worker.defaultStartupDelayMs),
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
        const meta = attachRequestMeta({
          route: "ops-automation-scheduler",
          worker: worker.key,
          runNumber,
          batchSize,
          intervalMs,
        });

        try {
          logger.info(meta, `Starting ${worker.key} automation run`);
          const result = await worker.run({ limit: batchSize });
          logger.info(
            attachRequestMeta({
              ...meta,
              processedCount: result.processedCount,
              failedCount: result.failedCount,
            }),
            `Completed ${worker.key} automation run`,
          );
        } catch (error) {
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
