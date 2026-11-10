import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { getOpsAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { readOutboxDeliveryHealth, type OutboxDeliveryHealth } from "./captureOutboxHealth";
import { unknownRowState } from "./captureOutboxRetry";
import { sendEmail } from "./email";
import { appBaseUrl, opsNoticeRecipient, sweepIntakeOpsNotices } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { readWorkerHeartbeat, type WorkerHeartbeatReading } from "./workerHeartbeat";
import { recordedWebsiteJobNoGrantEnding, websiteJobNoGrantClock, WEBSITE_JOB_NO_GRANT_CLOCK_FIELD,
  WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD } from "./websiteJobWindowEnding";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

/**
 * The beta's in-process safety net. It runs in the WEB process by default,
 * because in the deployed topology the ops scheduler runs nowhere (the web
 * process does not start it and the worker is launch-forward-only).
 *
 * Each pass (leader-leased, so one instance at a time):
 *  1. retries/escalates intake ops notices that have not reached a person;
 *  2. alerts once per customer outbox message that failed, and once per
 *     message whose outcome is unknown and that is not sent again automatically
 *     (read-only on the outbox; the alert record lives in its own collection);
 *  3. re-evaluates launch readiness so a not-ready service alerts even when
 *     nothing polls /health/ready;
 *  4. alerts when customer email backs up in the outbox (too many undelivered,
 *     or one undelivered too long), which a stalled pump or provider causes;
 *  5. alerts when the background worker's heartbeat goes stale;
 *  6. alerts once per website capture whose preparation went quiet (no status
 *     since upload, or one state too long) or ended, and once per website
 *     scene that stopped after hand-off (websitePreparationOpsAlerts);
 *  7. alerts once per website job whose site did its part while no grant was
 *     issued, well before the window sweep ends that job as held.
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

export type OutboxBacklogSummary = OutboxDeliveryHealth & { alerting: boolean };

/**
 * Alert when customer email is undelivered in the outbox:
 * BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT (default 50) or more undelivered, or one
 * undelivered longer than BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS (default 30 min).
 * Undelivered is every row the pump still owes a delivery: pending (including
 * rows backing off after a refusal), claimed, dispatching, and rows with an
 * unknown outcome that are being re-sent with their provider key. The pump
 * tries every minute, so either threshold means the pump or the provider has
 * stalled. Reads at most the count threshold of each status; below it, that is
 * all of them, so the oldest age is exact.
 */
export async function scanOutboxBacklog(options: ConditionAlertDeps & {
  store?: OutboxStore | null;
  maxPending?: number;
  maxAgeMs?: number;
} = {}): Promise<OutboxBacklogSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxStore | null) : options.store;
  if (!store) return { pending: 0, undelivered: 0, oldestUndeliveredAgeMs: null, unknownRetrying: 0, unknownNeedsPerson: 0, alerting: false };
  const maxPending = options.maxPending ?? positiveEnv("BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT", 50);
  const maxAgeMs = options.maxAgeMs ?? positiveEnv("BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS", 30 * 60 * 1000);
  const health = await readOutboxDeliveryHealth(store, (options.now || Date.now)(), maxPending);
  const { undelivered, oldestUndeliveredAgeMs, unknownRetrying } = health;
  const alerting = undelivered >= maxPending || (oldestUndeliveredAgeMs !== null && oldestUndeliveredAgeMs >= maxAgeMs);
  const waiting = undelivered >= maxPending ? `${maxPending} or more` : String(undelivered);
  const oldest = oldestUndeliveredAgeMs === null ? "unknown" : `${Math.round(oldestUndeliveredAgeMs / 60_000)} min`;
  const resending = unknownRetrying ? ` (${unknownRetrying} after an unknown outcome, sent again with the same provider key)` : "";
  await reportCondition("capture_outbox_backlog", {
    active: alerting,
    subject: "Customer email is backing up in the outbox",
    message: `Blueprint: customer email is backing up in the outbox: ${waiting} waiting${resending}, the oldest for ${oldest} `
      + `(alerts at ${maxPending} waiting or ${Math.round(maxAgeMs / 60_000)} min). Check the web service logs for the outbox pump, and Resend.`,
    recovered: "Blueprint: the customer email outbox is moving again.",
  }, options);
  return { ...health, alerting };
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

type OutboxRowAlert = {
  /** Slack headline and ops email subject, for `count` newly reported rows. */
  title: (count: number) => string;
  /** What to do, said once under the list. */
  advice?: string;
  event: string;
  logMessage: string;
  alertKey: string;
};

/**
 * Report each of `docs` once, by Slack and ops email. Read-only on the outbox:
 * the "already alerted" marker is a create-only doc in a separate collection,
 * so concurrent passes cannot double-alert and the outbox contract is untouched.
 */
async function alertOutboxRowsOnce(store: OutboxStore, docs: OutboxDoc[], kind: OutboxRowAlert, options: {
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
}): Promise<number> {
  const fresh: Array<{ key: string; requestId: string; kind: string; lastError: string }> = [];
  for (const doc of docs) {
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
        status: String(data.status || ""),
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
  if (!fresh.length) return 0;
  logger.error({ event: kind.event, count: fresh.length, keys: fresh.map((item) => item.key) }, kind.logMessage);
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
  const title = kind.title(fresh.length);
  const text = [`:rotating_light: Blueprint: ${title}`, ...lines, ...more, ...(kind.advice ? [kind.advice] : [])].join("\n");
  const alert = options.alert || sendRateLimitedOpsAlert;
  // A distinct key per batch: each newly reported set is news, and the marker
  // collection already guarantees an entry is only ever reported once.
  await Promise.resolve(alert(`${kind.alertKey}:${fresh[0].key}`, text)).catch(() => undefined);
  await (options.email || sendEmail)({
    to: opsNoticeRecipient(),
    subject: `[ALERT] ${title}`,
    text: text.replace(/^:rotating_light: /, ""),
  }).catch(() => undefined);
  return fresh.length;
}

/**
 * Rows of one status for an alert scan. An alerted row keeps its status, so it
 * stays in this query for good. Reads the first page; once that page is full,
 * also reads the next page of a durable rotating scan (automationBatch, the
 * same status filter ordered by document id, so no new index), so a full page
 * of rows already reported can never hide a later row that is owed its alert.
 */
async function readOutboxStatus(store: OutboxStore, status: string, requested: number | undefined): Promise<OutboxDoc[]> {
  const limit = Math.max(1, Math.min(requested ?? 200, 500));
  const query = store.collection(CAPTURE_OUTBOX_COLLECTION).where("status", "==", status);
  const head = (await query.limit(limit).get()).docs;
  if (head.length < limit) return head;
  const seen = new Set(head.map((doc) => doc.id));
  const rotated = await automationBatch(store as never, query as never, `capture_outbox_${status}_alert_scan`, limit);
  return [...head, ...(rotated.docs as OutboxDoc[]).filter((doc) => !seen.has(doc.id))];
}

/** Alert once per terminally failed outbox entry. */
export async function scanTerminalOutboxFailures(options: {
  store?: OutboxStore | null;
  limit?: number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
} = {}): Promise<OutboxFailureScanSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxStore | null) : options.store;
  const summary: OutboxFailureScanSummary = { failed: 0, newlyAlerted: 0 };
  if (!store) return summary;
  const docs = await readOutboxStatus(store, "failed", options.limit);
  summary.failed = docs.length;
  summary.newlyAlerted = await alertOutboxRowsOnce(store, docs, {
    title: (count) => `${count} customer email(s) failed permanently`,
    event: "capture_outbox_terminal_failures",
    logMessage: "Customer outbox messages failed and will not be retried",
    alertKey: "capture_outbox_failed",
  }, options);
  return summary;
}

export type OutboxUnknownScanSummary = { unknown: number; needsPerson: number; newlyAlerted: number };

/**
 * Alert once per outbox entry whose outcome is unknown and that is not sent
 * again automatically: its provider idempotency window closed, the provider
 * refused the repeat, the notice stopped being current, or it was dispatched
 * without a provider key (every entry that was `unknown` before keys existed).
 * Entries still being re-sent with their key are counted, not alerted here;
 * the backlog alert covers them.
 */
export async function scanUnknownOutboxOutcomes(options: {
  store?: OutboxStore | null;
  limit?: number;
  now?: () => number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
} = {}): Promise<OutboxUnknownScanSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as OutboxStore | null) : options.store;
  const summary: OutboxUnknownScanSummary = { unknown: 0, needsPerson: 0, newlyAlerted: 0 };
  if (!store) return summary;
  const docs = await readOutboxStatus(store, "unknown", options.limit);
  const nowMs = (options.now || Date.now)();
  const needsPerson = docs.filter((doc) => unknownRowState(doc.data(), nowMs) !== "retrying");
  summary.unknown = docs.length;
  summary.needsPerson = needsPerson.length;
  summary.newlyAlerted = await alertOutboxRowsOnce(store, needsPerson, {
    title: (count) => `${count} customer email(s) may or may not have been sent, and will not be sent again automatically`,
    advice: "Look each one up in Resend before sending it again by hand: the site may already have it.",
    event: "capture_outbox_unknown_outcomes",
    logMessage: "Customer outbox messages have an unknown outcome and are not sent again automatically",
    alertKey: "capture_outbox_unknown",
  }, options);
  return summary;
}

export type NoGrantWaitScanSummary = {
  /** Waits due their page. "unknown" when the scan read a full page, so more may be due than it read. */
  due: number | "unknown";
  newlyAlerted: number;
};
type NoGrantStore = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      limit: (n: number) => { get: () => Promise<{ docs: Array<{ id: string }> }> };
    };
    doc: (id: string) => unknown;
  };
  runTransaction: <T>(action: (tx: any) => Promise<T>) => Promise<T>;
};

/**
 * Page once per website job that waits on Blueprint with no grant (`websiteJobWindowSweep` starts the
 * clock and sets the page's due time): a grant not issued is our fault or a money wait, and the sweep
 * ends the job as held when the clock has run as long as a grant's window. Each due job is claimed in
 * a transaction that clears its due time and records when it was paged, so it is paged once and leaves
 * the query; a withdrawn job, or one that has a grant or an ending since, is cleared without a page.
 * Like the outbox alerts, the claim comes before the send.
 */
export async function scanWebsiteJobsWaitingOnGrant(options: ConditionAlertDeps & {
  store?: NoGrantStore | null;
  limit?: number;
} = {}): Promise<NoGrantWaitScanSummary> {
  const store = options.store === undefined ? (dbAdmin as unknown as NoGrantStore | null) : options.store;
  if (!store) return { due: 0, newlyAlerted: 0 };
  const now = options.now || Date.now;
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const rows = (await store.collection("inboundRequests").where(WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD, "<=", now())
    .limit(limit).get()).docs;
  const paged: Array<{ requestId: string; sinceIso: string; endsIso: string }> = [];
  for (const row of rows) {
    const ref = store.collection("inboundRequests").doc(row.id);
    try {
      const claimed = await store.runTransaction(async tx => {
        const record = (await tx.get(ref)).data() as Record<string, any> | undefined;
        const due = record?.[WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD];
        if (!record || typeof due !== "number" || due > now()) return null;
        const clock = websiteJobNoGrantClock(record, row.id);
        const owed = clock?.waiting_on === "blueprint" && !clock.paged_at_iso && !record.website_scene_sponsorship
          && !record.capture_withdrawal && !projectWebsiteCaptureRights(record).consent_revoked && !recordedWebsiteJobNoGrantEnding(record, row.id);
        tx.update(ref, { [WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD]: null,
          ...(owed ? { [WEBSITE_JOB_NO_GRANT_CLOCK_FIELD]: { ...clock, paged_at_iso: new Date(now()).toISOString() } } : {}) });
        return owed ? clock : null;
      });
      if (claimed) paged.push({ requestId: row.id, sinceIso: new Date(claimed.since_epoch * 1000).toISOString(),
        endsIso: new Date((claimed.since_epoch + claimed.window_seconds) * 1000).toISOString() });
    } catch (error) {
      logger.warn({ err: error, requestId: row.id }, "Could not claim a no-grant wait page; the next pass reads it again");
    }
  }
  const due = rows.length >= limit ? "unknown" as const : rows.length;
  if (!paged.length) return { due, newlyAlerted: 0 };
  const title = `${paged.length} website job(s) are waiting on a grant Blueprint has not issued`;
  const lines = paged.slice(0, 10).map(item => `- ${item.requestId}: the site did its part by ${item.sinceIso}; `
    + `with no grant the job ends as held at ${item.endsIso}. ${appBaseUrl()}/admin/leads/${encodeURIComponent(item.requestId)}`);
  const more = paged.length > 10 ? [`- …and ${paged.length - 10} more`] : [];
  const text = [`:rotating_light: Blueprint: ${title}`, ...lines, ...more,
    "A grant that is not issued is ours to fix (the sponsorship policy, a money wait, or the Pipeline's request)."].join("\n");
  logger.error({ event: "website_job_no_grant_wait", count: paged.length, requestIds: paged.map(item => item.requestId) }, title);
  await Promise.resolve((options.alert || sendRateLimitedOpsAlert)(`website_job_no_grant_wait:${paged[0].requestId}`, text))
    .catch(() => undefined);
  await (options.email || sendEmail)({ to: opsNoticeRecipient(), subject: `[ALERT] ${title}`,
    text: text.replace(/^:rotating_light: /, "") }).catch(() => undefined);
  return { due, newlyAlerted: paged.length };
}

async function checkLaunchReadiness() {
  const [{ buildLaunchReadinessSnapshot }, { maybeAlertOnLaunchReadinessTransition }] = await Promise.all([
    import("./launch-readiness"),
    import("./ops-alerts"),
  ]);
  await maybeAlertOnLaunchReadinessTransition(buildLaunchReadinessSnapshot());
}

async function scanWebsitePreparations() {
  const { backfillWebsitePreparationWatches, scanWebsitePreparationWatch, scanEndedWebsiteSceneIntakes,
    scanHeldOwnerSuccessThresholds, scanHeldWebsiteEvaluations } = await import("./websitePreparationOpsAlerts");
  // Uploads recorded before the watch existed get one first, so a capture
  // already stuck is reported by the same pass.
  const backfill = await backfillWebsitePreparationWatches();
  return { backfill, watch: await scanWebsitePreparationWatch(), intakes: await scanEndedWebsiteSceneIntakes(),
    // A site owner said the job's success thresholds are wrong: the team reviews them.
    ownerHolds: await scanHeldOwnerSuccessThresholds(),
    // A job evaluation that finished held on our side: it does not restart by itself.
    evaluations: await scanHeldWebsiteEvaluations() };
}

export async function runBetaOpsMonitorPass() {
  const results = await Promise.allSettled([
    sweepIntakeOpsNotices(),
    scanTerminalOutboxFailures(),
    checkLaunchReadiness(),
    scanOutboxBacklog(),
    workerHeartbeatCheckEnabled() ? checkWorkerHeartbeat() : Promise.resolve(null),
    // 6. website captures whose preparation went quiet or ended (beta L3/L6).
    scanWebsitePreparations(),
    scanUnknownOutboxOutcomes(),
    // 7. website jobs whose site did its part while no grant was issued.
    scanWebsiteJobsWaitingOnGrant(),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      logger.warn(
        { err: result.reason, step: ["intake_notice_sweep", "outbox_failure_scan", "readiness_check", "outbox_backlog_scan",
          "worker_heartbeat_check", "website_preparation_scan", "outbox_unknown_scan", "website_job_no_grant_scan"][index] },
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
