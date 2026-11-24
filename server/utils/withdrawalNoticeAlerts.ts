/**
 * A site's withdrawal that has not reached the Pipeline is told to the owner, once per withdrawal.
 *
 * The worker sends each withdrawal to the Pipeline every minute until the Pipeline acknowledges it
 * (`forwardWebsiteCaptureWithdrawals`), and records how the last try went in `captureWithdrawalOutbox`. Nothing else
 * reads that record: a worker with no Pipeline address keeps trying, finishes its passes (so the loop's own heartbeat
 * stays fresh) and the withdrawal waits unseen. This scan, run by the beta ops monitor in the web process, tells the
 * owner on the ops alert route (Slack and one ops email) when a withdrawal is still unacknowledged
 * WITHDRAWAL_NOTICE_ALERT_AFTER_MS after the site's request, naming why ("not configured", "refused", "failed") and how
 * many wait. It names no site: only the job's id, as every ops alert does, never its name, address or contact details.
 *
 * Once per withdrawal: a create-only marker in its own collection, so a restart or two monitor passes cannot repeat it.
 * Read-only on the job record.
 */
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { sendEmail } from "./email";
import { adminLeadUrl, opsNoticeRecipient } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";

/**
 * Fifteen minutes. The worker tries every minute (`nextAttemptAtMs` + 60 s while unacknowledged) with a 10 s timeout,
 * so by then about fourteen tries have failed: a Pipeline restart or deploy is over well within that, and the owner
 * still hears before the website's own deletion pass (35 minutes after the request at the earliest,
 * `websiteCaptureDeletion.ts`) and long before its acknowledgement timeout (2 hours). The monitor runs every 5 minutes,
 * so the alert comes 15 to 20 minutes after the request.
 */
export const WITHDRAWAL_NOTICE_ALERT_AFTER_MS = 15 * 60 * 1000;
export const WITHDRAWAL_NOTICE_ALERT_COLLECTION = "opsWithdrawalNoticeAlerts";
const PAGE = 500;

const alerted = new Set<string>();

type Waiting = { requestId: string; waitedMs: number; cause: string; tries: number; notConfigured: boolean };

/** Why the last try did not get an acknowledgement, in the owner's words. */
export function withdrawalNoticeCause(outbox: Record<string, any> | undefined, blocker: unknown): { cause: string; notConfigured: boolean } {
  const status = outbox?.lastTransportStatus;
  if (!outbox || !Number(outbox.attemptCount)) return { cause: "not tried yet (is the worker running?)", notConfigured: false };
  if (status === "not_configured" || status === "blocked") return { cause: `not configured (${String(blocker || status)})`, notConfigured: true };
  if (status === "failed" && Number.isFinite(Number(outbox.lastHttpStatus)) && outbox.lastHttpStatus !== null)
    return { cause: `refused (HTTP ${Number(outbox.lastHttpStatus)})`, notConfigured: false };
  if (status === "forwarded") return { cause: "refused (its answer was not a valid acknowledgement)", notConfigured: false };
  return { cause: "failed (no answer)", notConfigured: false };
}

async function readPending(db: FirebaseFirestore.Firestore) {
  const query = db.collection("inboundRequests").where("captureWithdrawalPending", "==", true);
  const head = (await query.limit(PAGE).get()).docs;
  if (head.length < PAGE) return head;
  // Every withdrawal stays pending in this field, so past one page rotate through the rest as the outbox scans do.
  const seen = new Set(head.map(doc => doc.id));
  const rotated = await automationBatch(db, query, "withdrawal_notice_alert_scan", PAGE);
  return [...head, ...rotated.docs.filter(doc => !seen.has(doc.id))];
}

export async function scanUnacknowledgedWithdrawals(options: {
  now?: () => number;
  afterMs?: number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
} = {}): Promise<{ waiting: number; newlyAlerted: number }> {
  const db = dbAdmin as unknown as FirebaseFirestore.Firestore | null;
  if (!db) return { waiting: 0, newlyAlerted: 0 };
  const nowMs = (options.now || Date.now)();
  const afterMs = options.afterMs ?? WITHDRAWAL_NOTICE_ALERT_AFTER_MS;
  const waiting: Waiting[] = [];
  for (const doc of await readPending(db)) {
    const record = doc.data() || {};
    const withdrawal = record.capture_withdrawal;
    if (!withdrawal || withdrawal.pipelineAcknowledged === true) continue;
    const requestedAtMs = Date.parse(String(withdrawal.requestedAtIso || ""));
    if (!Number.isFinite(requestedAtMs) || nowMs - requestedAtMs < afterMs) continue;
    const outbox = record.captureWithdrawalOutbox;
    waiting.push({ requestId: doc.id, waitedMs: nowMs - requestedAtMs, tries: Number(outbox?.attemptCount || 0),
      ...withdrawalNoticeCause(outbox, withdrawal.acknowledgementBlocker) });
  }
  const fresh: Waiting[] = [];
  for (const item of waiting) {
    if (alerted.has(item.requestId)) continue;
    try {
      await db.collection(WITHDRAWAL_NOTICE_ALERT_COLLECTION).doc(item.requestId).create({
        request_id: item.requestId, cause: item.cause, alerted_at_iso: new Date(nowMs).toISOString() });
      fresh.push(item);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code !== 6 && code !== "already-exists" && code !== "ALREADY_EXISTS") {
        logger.warn({ err: error, requestId: item.requestId }, "Could not record a withdrawal notice alert marker");
        continue;
      }
    }
    alerted.add(item.requestId);
  }
  if (!fresh.length) return { waiting: waiting.length, newlyAlerted: 0 };
  const total = waiting.length;
  const title = `${total} site withdrawal${total === 1 ? " has" : "s have"} not reached the Pipeline after `
    + `${Math.round(afterMs / 60_000)} min`;
  const lines = fresh.slice(0, 10).map(item => `- ${adminLeadUrl(item.requestId)} waiting ${Math.round(item.waitedMs / 60_000)} min, `
    + `${item.tries} tr${item.tries === 1 ? "y" : "ies"}: ${item.cause}`);
  const more = fresh.length > 10 ? [`- …and ${fresh.length - 10} more`] : [];
  const advice = fresh.some(item => item.notConfigured)
    ? "Not configured: set CAPTURE_LIFECYCLE_PIPELINE_BASE_URL (or CAPTURE_UPLOAD_INTAKE_FORWARD_URL) and "
      + "CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN on the worker service (blueprint-webapp-worker) in Render. The worker keeps trying every minute."
    : "The worker keeps trying every minute. Check the Pipeline's withdrawal route and the worker logs in Render.";
  const text = [`:rotating_light: Blueprint: ${title}. Each job has left every company's view; the Pipeline has not been told.`,
    ...lines, ...more, advice].join("\n");
  logger.error({ event: "website_withdrawal_notice_unacknowledged", waiting: total, newly: fresh.length,
    requestIds: fresh.map(item => item.requestId) }, "Site withdrawals have not reached the Pipeline");
  await Promise.resolve((options.alert || sendRateLimitedOpsAlert)(`website_withdrawal_notice:${fresh[0].requestId}`, text))
    .catch(() => undefined);
  await (options.email || sendEmail)({ to: opsNoticeRecipient(), subject: `[ALERT] ${title}`,
    text: text.replace(/^:rotating_light: /, "") }).catch(() => undefined);
  return { waiting: total, newlyAlerted: fresh.length };
}

export function __resetWithdrawalNoticeAlertsForTests() {
  alerted.clear();
}
