import { sendSlackMessage } from "./slack";

type WorkerAlertParams = {
  workerKey: string;
  previousStatus: string | null;
  nextStatus: string;
  intervalMs: number;
  batchSize: number;
  runNumber: number;
  processedCount?: number | null;
  failedCount?: number | null;
  error?: string | null;
};

type LaunchReadinessSnapshot = {
  status: "ready" | "not_ready";
  blockers: string[];
  warnings: string[];
  checks: Record<string, boolean>;
};

const workerFailureAlertState = new Map<string, string>();
let lastLaunchReadinessStatus: LaunchReadinessSnapshot["status"] | null = null;

function humanizeWorkerKey(value: string) {
  return value.replace(/_/g, " ");
}

export async function maybeAlertOnWorkerStatusTransition(params: WorkerAlertParams) {
  const previousStatus = params.previousStatus;
  const nextStatus = params.nextStatus;

  if (nextStatus === "failed" && previousStatus !== "failed") {
    workerFailureAlertState.set(params.workerKey, "failed");
    await sendSlackMessage(
      [
        `:rotating_light: Blueprint worker failure: ${humanizeWorkerKey(params.workerKey)}`,
        `- Run: #${params.runNumber}`,
        `- Interval: ${params.intervalMs} ms`,
        `- Batch: ${params.batchSize}`,
        params.error ? `- Error: ${params.error}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  if (
    previousStatus === "failed"
    && nextStatus !== "failed"
    && workerFailureAlertState.get(params.workerKey) === "failed"
  ) {
    workerFailureAlertState.set(params.workerKey, "recovered");
    await sendSlackMessage(
      [
        `:white_check_mark: Blueprint worker recovered: ${humanizeWorkerKey(params.workerKey)}`,
        `- Run: #${params.runNumber}`,
        params.processedCount !== undefined && params.processedCount !== null
          ? `- Processed: ${params.processedCount}`
          : null,
        params.failedCount !== undefined && params.failedCount !== null
          ? `- Failed: ${params.failedCount}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

export async function maybeAlertOnLaunchReadinessTransition(
  snapshot: LaunchReadinessSnapshot,
) {
  if (lastLaunchReadinessStatus === null) {
    lastLaunchReadinessStatus = snapshot.status;
    return;
  }

  if (lastLaunchReadinessStatus === snapshot.status) {
    return;
  }

  const previousStatus = lastLaunchReadinessStatus;
  lastLaunchReadinessStatus = snapshot.status;

  if (previousStatus === "ready" && snapshot.status === "not_ready") {
    await sendSlackMessage(
      [
        ":rotating_light: Blueprint launch readiness regressed",
        ...snapshot.blockers.slice(0, 8).map((blocker) => `- ${blocker}`),
      ].join("\n"),
    );
    return;
  }

  if (previousStatus === "not_ready" && snapshot.status === "ready") {
    await sendSlackMessage(
      ":white_check_mark: Blueprint launch readiness recovered. `/health/ready` is reporting ready again.",
    );
  }
}
