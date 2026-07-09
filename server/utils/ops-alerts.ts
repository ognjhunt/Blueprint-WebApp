import { sendSlackMessage } from "./slack";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

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

export type BetaOpsFailureKind =
  | "capture_upload_failure"
  | "intake_forwarding_failure"
  | "provider_run_failure"
  | "package_generation_failure"
  | "buyer_artifact_access_failure"
  | "mobile_capture_client_crash"
  | "mobile_capture_client_error"
  | "payout_exception"
  | "payment_dispute"
  | "spend_budget_failure";

type BetaOpsFailureSignal = {
  kind: BetaOpsFailureKind;
  scopeId?: string | null;
  severity?: "warning" | "critical";
  summary: string;
  details?: Record<string, unknown>;
  occurredAt?: string;
};

const DEFAULT_FAILURE_THRESHOLDS: Record<BetaOpsFailureKind, number> = {
  capture_upload_failure: 1,
  intake_forwarding_failure: 1,
  provider_run_failure: 1,
  package_generation_failure: 1,
  buyer_artifact_access_failure: 3,
  mobile_capture_client_crash: 1,
  mobile_capture_client_error: 3,
  payout_exception: 1,
  payment_dispute: 1,
  spend_budget_failure: 1,
};

function stableAlertSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").slice(0, 160);
}

function thresholdForKind(kind: BetaOpsFailureKind) {
  const envKey = `BLUEPRINT_OPS_ALERT_THRESHOLD_${kind.toUpperCase()}`;
  const parsed = Number(process.env[envKey] || "");
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_FAILURE_THRESHOLDS[kind];
}

export async function recordBetaOpsFailureSignal(signal: BetaOpsFailureSignal) {
  if (!db) {
    return { recorded: false, alertOpened: false, reason: "database_not_available" };
  }

  const occurredAt = signal.occurredAt || new Date().toISOString();
  const scopeId = signal.scopeId?.trim() || "global";
  const threshold = thresholdForKind(signal.kind);
  const counterId = `${stableAlertSegment(signal.kind)}:${stableAlertSegment(scopeId)}`;
  const counterRef = db.collection("opsAlertSignals").doc(counterId);
  const counterSnapshot = await counterRef.get();
  const counter = counterSnapshot.exists
    ? ((counterSnapshot.data() || {}) as Record<string, unknown>)
    : {};
  const previousCount =
    typeof counter.event_count === "number" && Number.isFinite(counter.event_count)
      ? counter.event_count
      : 0;
  const eventCount = previousCount + 1;

  await counterRef.set(
    {
      id: counterId,
      kind: signal.kind,
      scope_id: scopeId,
      event_count: eventCount,
      threshold,
      first_seen_at: counter.first_seen_at || occurredAt,
      last_seen_at: occurredAt,
      last_summary: signal.summary,
      last_details: signal.details || {},
      updated_at: occurredAt,
    },
    { merge: true },
  );

  if (eventCount < threshold) {
    return { recorded: true, alertOpened: false, eventCount, threshold };
  }

  const alertRef = db.collection("opsAlerts").doc(counterId);
  const alertSnapshot = await alertRef.get();
  const existingAlert = alertSnapshot.exists
    ? ((alertSnapshot.data() || {}) as Record<string, unknown>)
    : {};
  const alreadyOpen = existingAlert.status === "open";

  await alertRef.set(
    {
      id: counterId,
      status: "open",
      severity: signal.severity || "critical",
      kind: signal.kind,
      scope_id: scopeId,
      summary: signal.summary,
      details: signal.details || {},
      event_count: eventCount,
      threshold,
      source: "webapp_beta_ops_failure_signal",
      opened_at: existingAlert.opened_at || occurredAt,
      last_seen_at: occurredAt,
      updated_at: occurredAt,
      requires_human_review: true,
    },
    { merge: true },
  );

  if (!alreadyOpen) {
    await sendSlackMessage(
      [
        `:rotating_light: Blueprint beta ops alert: ${humanizeWorkerKey(signal.kind)}`,
        `- Scope: ${scopeId}`,
        `- Severity: ${signal.severity || "critical"}`,
        `- Count: ${eventCount}/${threshold}`,
        `- Summary: ${signal.summary}`,
      ].join("\n"),
    );
  }

  return { recorded: true, alertOpened: !alreadyOpen, eventCount, threshold };
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
