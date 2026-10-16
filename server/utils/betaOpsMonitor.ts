import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { getOpsAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { sendEmail } from "./email";
import { appBaseUrl, opsNoticeRecipient, sweepIntakeOpsNotices } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { readWorkerHeartbeat, type WorkerHeartbeatReading } from "./workerHeartbeat";

/**
 * The beta's in-process safety net. It runs in the WEB process by default,
 * because in the deployed topology the ops scheduler runs nowhere (the web
 * process does not start it and the worker is launch-forward-only).
 *
 * Each pass (leader-leased, so one instance at a time):
 *  1. retries/escalates intake ops notices that have not reached a person;
 *  2. alerts on customer outbox messages that exhausted their retries
 *     (read-only on the outbox; the alert record lives in its own collection);
 *  3. re-evaluates launch readiness so a not-ready service alerts even when
 *     nothing polls /health/ready;
 *  4. alerts when customer email backs up in the outbox (too many waiting, or
 *     one waiting too long), which a stalled pump or provider causes;
 *  5. alerts when the background worker's heartbeat goes stale.
 */

const CAPTURE_OUTBOX_COLLECTION = "captureOutbox";
const OUTBOX_ALERT_COLLECTION = "opsOutboxFailureAlerts";

type OutboxDoc = { id: string; data: () => Record<string, unknown> | undefined };
type OutboxStore = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      limit: (n: number) => { get: () => Promise<{ docs: OutboxDoc[] }> };
    };
    doc: (id: string) => {
      get: () => Promise<{ exists: boolean }>;
      create: (data: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

export type OutboxFailureScanSummary = { failed: number; newlyAlerted: number };

/** Per-process cache of keys already reported, so steady state costs one query. */
const alertedOutboxKeys = new Set<string>();

/** Ongoing conditions (backlog, stale worker) currently alerted, by key. */
const activeConditions = new Map<string, { lastAlertAtMs: number }>();
const CONDITION_REMINDER_MS = 60 * 60 * 1000;

export function __resetBetaOpsMonitorForTests() {
  alertedOutboxKeys.clear();
  activeConditions.clear();
}

type ConditionAlertDeps = {
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
  now?: () => number;
};

/**
 * Alert when an ongoing condition starts (Slack and one ops email), remind on
 * Slack hourly while it lasts, and say on Slack when it clears. Email goes once
 * per incident: a reminder every pass would spend the Resend daily cap that
 * customer email depends on.
 */
async function reportCondition(
  key: string,
  condition: { active: boolean; subject: string; message: string; recovered: string },
  deps: ConditionAlertDeps,
): Promise<"ok" | "alerted" | "reminded" | "suppressed" | "recovered"> {
  const nowMs = (deps.now || Date.now)();
  const previous = activeConditions.get(key);
  const alert = deps.alert || sendRateLimitedOpsAlert;
  if (!condition.active) {
    if (!previous) return "ok";
    activeConditions.delete(key);
    logger.info({ event: `${key}_recovered` }, condition.recovered);
    await Promise.resolve(alert(`${key}:recovered`, `:white_check_mark: ${condition.recovered}`)).catch(() => undefined);
    return "recovered";
  }
  if (previous && nowMs - previous.lastAlertAtMs < CONDITION_REMINDER_MS) return "suppressed";
  activeConditions.set(key, { lastAlertAtMs: nowMs });
  logger.error({ event: key }, condition.message);
  await Promise.resolve(alert(key, `:rotating_light: ${condition.message}`)).catch(() => undefined);
  if (previous) return "reminded";
  await (deps.email || sendEmail)({
    to: opsNoticeRecipient(),
    subject: `[ALERT] ${condition.subject}`,
    text: condition.message,
  }).catch(() => undefined);
  return "alerted";
}

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export type OutboxBacklogSummary = { pending: number; oldestPendingAgeMs: number | null; alerting: boolean };

/**
 * Alert when customer email waits in the outbox: BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT
 * (default 50) or more pending, or one pending longer than
 * BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS (default 30 min). The pump sends every
 * minute and gives up after six attempts, so either means delivery has
 * stalled. Reads at most the count threshold of pending entries; below it,
 * that is all of them, so the oldest age is exact.
 */
export async function scanOutboxBacklog(options: ConditionAlertDeps & {
  store?: OutboxStore | null;
  maxPending?: number;
  maxAgeMs?: number;
} = {}): Promise<OutboxBacklogSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxStore | null) : options.store;
  if (!store) return { pending: 0, oldestPendingAgeMs: null, alerting: false };
  const maxPending = options.maxPending ?? positiveEnv("BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT", 50);
  const maxAgeMs = options.maxAgeMs ?? positiveEnv("BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS", 30 * 60 * 1000);
  const snapshot = await store.collection(CAPTURE_OUTBOX_COLLECTION).where("status", "==", "pending").limit(maxPending).get();
  const nowMs = (options.now || Date.now)();
  const created = snapshot.docs
    .map((doc) => Date.parse(String(doc.data()?.createdAtIso || "")))
    .filter((value) => Number.isFinite(value));
  const oldestPendingAgeMs = created.length ? Math.max(0, nowMs - Math.min(...created)) : null;
  const pending = snapshot.docs.length;
  const alerting = pending >= maxPending || (oldestPendingAgeMs !== null && oldestPendingAgeMs >= maxAgeMs);
  const waiting = pending >= maxPending ? `${maxPending} or more` : String(pending);
  const oldest = oldestPendingAgeMs === null ? "unknown" : `${Math.round(oldestPendingAgeMs / 60_000)} min`;
  await reportCondition("capture_outbox_backlog", {
    active: alerting,
    subject: "Customer email is backing up in the outbox",
    message: `Blueprint: customer email is backing up in the outbox: ${waiting} waiting, the oldest for ${oldest} `
      + `(alerts at ${maxPending} waiting or ${Math.round(maxAgeMs / 60_000)} min). Check the web service logs for the outbox pump, and Resend.`,
    recovered: "Blueprint: the customer email outbox is moving again.",
  }, options);
  return { pending, oldestPendingAgeMs, alerting };
}

/** Production only: elsewhere no deployed worker writes a heartbeat to read. */
export function workerHeartbeatCheckEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (["0", "false", "no", "off"].includes(String(env.BLUEPRINT_WORKER_HEARTBEAT_CHECK_ENABLED || "").trim().toLowerCase())) return false;
  return env.NODE_ENV === "production";
}

/**
 * Alert when blueprint-webapp-worker stops writing its heartbeat. An
 * unreadable heartbeat is not reported as a dead worker: a Firestore outage
 * already fails readiness.
 */
export async function checkWorkerHeartbeat(options: ConditionAlertDeps & {
  read?: () => Promise<WorkerHeartbeatReading>;
} = {}): Promise<WorkerHeartbeatReading> {
  const reading = await (options.read || readWorkerHeartbeat)();
  if (reading.status === "unavailable") return reading;
  const last = reading.ageMs === null
    ? "it has no heartbeat on record"
    : `its last heartbeat was ${Math.round(reading.ageMs / 60_000)} min ago`;
  await reportCondition("worker_heartbeat_stale", {
    active: reading.status !== "fresh",
    subject: "Background worker has stopped reporting",
    message: `Blueprint: the background worker (blueprint-webapp-worker) has stopped reporting: ${last} `
      + `(stale after ${Math.round(reading.staleAfterMs / 60_000)} min). Evaluation launch forwarding, recording `
      + "withdrawals and deletions, and the other worker lanes are not running. Check the worker in Render.",
    recovered: "Blueprint: the background worker is reporting again.",
  }, options);
  return reading;
}

/**
 * Alert once per terminally failed outbox entry. Read-only on the outbox:
 * the "already alerted" marker is a create-only doc in a separate collection,
 * so concurrent passes cannot double-alert and the outbox contract is untouched.
 */
export async function scanTerminalOutboxFailures(options: {
  store?: OutboxStore | null;
  limit?: number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
} = {}): Promise<OutboxFailureScanSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxStore | null) : options.store;
  const summary: OutboxFailureScanSummary = { failed: 0, newlyAlerted: 0 };
  if (!store) return summary;
  const limit = Math.max(1, Math.min(options.limit ?? 200, 500));
  const snapshot = await store.collection(CAPTURE_OUTBOX_COLLECTION).where("status", "==", "failed").limit(limit).get();
  summary.failed = snapshot.docs.length;
  if (snapshot.docs.length >= limit) {
    logger.warn(
      { event: "capture_outbox_failed_scan_truncated", limit },
      "More terminally failed outbox entries exist than one scan reads; clear or cancel handled entries",
    );
  }
  const fresh: Array<{ key: string; requestId: string; kind: string; lastError: string }> = [];
  for (const doc of snapshot.docs) {
    if (alertedOutboxKeys.has(doc.id)) continue;
    const data = doc.data() || {};
    const marker = store.collection(OUTBOX_ALERT_COLLECTION).doc(doc.id);
    try {
      if ((await marker.get()).exists) {
        alertedOutboxKeys.add(doc.id);
        continue;
      }
      await marker.create({
        outbox_key: doc.id,
        request_id: String(data.requestId || ""),
        kind: String(data.kind || ""),
        alerted_at_iso: new Date().toISOString(),
      });
      alertedOutboxKeys.add(doc.id);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") {
        alertedOutboxKeys.add(doc.id);
        continue;
      }
      logger.warn({ err: error, key: doc.id }, "Could not record an outbox failure alert marker");
      continue;
    }
    fresh.push({
      key: doc.id,
      requestId: String(data.requestId || ""),
      kind: String(data.kind || "unknown"),
      lastError: String(data.lastError || "unknown").slice(0, 120),
    });
  }
  if (!fresh.length) return summary;
  summary.newlyAlerted = fresh.length;
  logger.error(
    { event: "capture_outbox_terminal_failures", count: fresh.length, keys: fresh.map((item) => item.key) },
    "Customer outbox messages exhausted their retries",
  );
  // Recovery references only: recipient and message body stay in Firestore.
  const lines = fresh.slice(0, 10).map((item) => {
    // Account notices have no inbound lead. Identify the exact recipient's
    // durable intent and receipts rather than manufacturing a lead URL.
    const recovery = item.kind === "account_notice"
      ? `Firestore: ${CAPTURE_OUTBOX_COLLECTION}/${item.key} (inspect deliveryReceipts)`
      : item.requestId ? `${appBaseUrl()}/admin/leads/${encodeURIComponent(item.requestId)}` : "";
    return `- ${item.kind} for ${item.requestId || "unknown request"} (${item.lastError}) ${recovery}`.trim();
  });
  const more = fresh.length > 10 ? [`- …and ${fresh.length - 10} more`] : [];
  const text = [
    `:rotating_light: Blueprint: ${fresh.length} customer email(s) failed permanently`,
    ...lines,
    ...more,
  ].join("\n");
  const alert = options.alert || sendRateLimitedOpsAlert;
  // A distinct key per batch: each newly failed set is news, and the marker
  // collection already guarantees an entry is only ever reported once.
  await Promise.resolve(alert(`capture_outbox_failed:${fresh[0].key}`, text)).catch(() => undefined);
  await (options.email || sendEmail)({
    to: opsNoticeRecipient(),
    subject: `[ALERT] ${fresh.length} customer email(s) failed permanently`,
    text: text.replace(/^:rotating_light: /, ""),
  }).catch(() => undefined);
  return summary;
}

async function checkLaunchReadiness() {
  const [{ buildLaunchReadinessSnapshot }, { maybeAlertOnLaunchReadinessTransition }] = await Promise.all([
    import("./launch-readiness"),
    import("./ops-alerts"),
  ]);
  await maybeAlertOnLaunchReadinessTransition(buildLaunchReadinessSnapshot());
}

export async function runBetaOpsMonitorPass() {
  const results = await Promise.allSettled([
    sweepIntakeOpsNotices(),
    scanTerminalOutboxFailures(),
    checkLaunchReadiness(),
    scanOutboxBacklog(),
    workerHeartbeatCheckEnabled() ? checkWorkerHeartbeat() : Promise.resolve(null),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      logger.warn(
        { err: result.reason, step: ["intake_notice_sweep", "outbox_failure_scan", "readiness_check", "outbox_backlog_scan", "worker_heartbeat_check"][index] },
        "Beta ops monitor step failed",
      );
    }
  }
  return results;
}

/** Start the monitor on an interval. Returns a stop function. */
export function startBetaOpsMonitor(options: {
  intervalMs?: number;
  lease?: AutomationLeaderLease;
  pass?: () => Promise<unknown>;
} = {}): () => void {
  if (process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true") {
    logger.info({ event: "preview_beta_ops_monitor_disabled" }, "Beta ops monitor disabled in pull request preview");
    return () => undefined;
  }
  if (["0", "false", "no", "off"].includes(String(process.env.BLUEPRINT_BETA_OPS_MONITOR_ENABLED || "").trim().toLowerCase())) {
    logger.warn({ event: "beta_ops_monitor_disabled" }, "Beta ops monitor disabled by BLUEPRINT_BETA_OPS_MONITOR_ENABLED");
    return () => undefined;
  }
  const envInterval = Number(process.env.BLUEPRINT_BETA_OPS_MONITOR_INTERVAL_MS);
  const intervalMs = Math.max(30_000, options.intervalMs ?? (Number.isFinite(envInterval) && envInterval > 0 ? envInterval : 5 * 60 * 1000));
  const lease = options.lease || getOpsAutomationLeaderLease();
  const pass = options.pass || runBetaOpsMonitorPass;
  lease.start();
  let running = false;
  const timer = setInterval(() => {
    if (running || !lease.isLeader()) return;
    running = true;
    void Promise.resolve()
      .then(pass)
      .catch((error) => logger.warn({ err: error }, "Beta ops monitor pass failed"))
      .finally(() => { running = false; });
  }, intervalMs);
  timer.unref?.();
  logger.info({ event: "beta_ops_monitor_started", intervalMs }, "Beta ops monitor started");
  return () => clearInterval(timer);
}
