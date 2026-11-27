/**
 * An account deletion request is told to the owner as it nears and passes its promised time, once per request at each
 * step (outreach playbook fix 11).
 *
 * The Privacy Policy promises to "complete it within 30 calendar days of confirming your identity"
 * (`client/src/pages/Privacy.tsx:119`). A request can only be made within five minutes of a sign-in
 * (`server/utils/accountDeletion.ts`), so identity is confirmed when it is made: the clock starts at `requestedAtIso`.
 * The app has no completed state (`client/src/types/accountDeletion.ts`); completion is done by hand from
 * `docs/runbooks/account-data-deletion.md`. So every stored request is read, whatever its status.
 *
 * At 25 days the owner gets a warning; at 30, an overdue notice. A request already past 30 days when first seen gets
 * the overdue notice only. It is a notice, never a gate: nothing is blocked, changed or deleted. It names only the
 * request's id, status and age, never the account's email or uid. Read-only on the requests.
 *
 * Once per request and step, and never lost: the marker is claimed before the send and marked delivered only after
 * Slack or the ops email took it, as `withdrawalNoticeAlerts` does.
 */
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { ACCOUNT_DELETION_COLLECTION } from "./accountDeletion";
import { automationBatch } from "./automationBatch";
import { sendEmail } from "./email";
import { appBaseUrl, opsNoticeRecipient } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";

const DAY_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_PROMISE_DAYS = 30;
export const ACCOUNT_DELETION_WARNING_DAYS = 25;
export const ACCOUNT_DELETION_AGE_ALERT_COLLECTION = "opsAccountDeletionAgeAlerts";
/** As in `withdrawalNoticeAlerts`: longer than any send, shorter than the monitor's 5-minute pass. */
export const ACCOUNT_DELETION_AGE_ALERT_CLAIM_MS = 4 * 60 * 1000;
const PAGE = 500;

export type AccountDeletionAgeLevel = "warning" | "overdue";
type Aging = { id: string; status: string; ageDays: number; level: AccountDeletionAgeLevel };

const delivered = new Set<string>();
const markerId = (item: Pick<Aging, "id" | "level">) => `${item.id}__${item.level}`;

/** Which notice a request of this age is owed, if any. */
export function accountDeletionAgeLevel(requestedAtIso: unknown, nowMs: number): { level: AccountDeletionAgeLevel; ageDays: number } | null {
  const requestedAtMs = Date.parse(String(requestedAtIso || ""));
  if (!Number.isFinite(requestedAtMs)) return null;
  const ageDays = Math.floor((nowMs - requestedAtMs) / DAY_MS);
  if (ageDays >= ACCOUNT_DELETION_PROMISE_DAYS) return { level: "overdue", ageDays };
  if (ageDays >= ACCOUNT_DELETION_WARNING_DAYS) return { level: "warning", ageDays };
  return null;
}

async function claim(db: FirebaseFirestore.Firestore, item: Aging, nowMs: number): Promise<number> {
  const ref = db.collection(ACCOUNT_DELETION_AGE_ALERT_COLLECTION).doc(markerId(item));
  return db.runTransaction(async tx => {
    const marker = (await tx.get(ref)).data();
    if (marker?.delivered_at_iso) {
      delivered.add(markerId(item));
      return 0;
    }
    if (marker && nowMs - Number(marker.claimed_at_ms || 0) < ACCOUNT_DELETION_AGE_ALERT_CLAIM_MS) return 0;
    const sends = Number(marker?.sends || 0) + 1;
    tx.set(ref, { request_id: item.id, level: item.level, age_days: item.ageDays, claimed_at_ms: nowMs,
      claimed_at_iso: new Date(nowMs).toISOString(), sends }, { merge: true });
    return sends;
  });
}

async function readRequests(db: FirebaseFirestore.Firestore) {
  const query = db.collection(ACCOUNT_DELETION_COLLECTION);
  const head = (await query.limit(PAGE).get()).docs;
  if (head.length < PAGE) return head;
  const seen = new Set(head.map(doc => doc.id));
  const rotated = await automationBatch(db, query as unknown as FirebaseFirestore.Query, "account_deletion_age_alert_scan", PAGE);
  return [...head, ...rotated.docs.filter(doc => !seen.has(doc.id))];
}

export async function scanAgingAccountDeletionRequests(options: {
  now?: () => number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
} = {}): Promise<{ warning: number; overdue: number; newlyAlerted: number }> {
  const db = dbAdmin as unknown as FirebaseFirestore.Firestore | null;
  if (!db) return { warning: 0, overdue: 0, newlyAlerted: 0 };
  const nowMs = (options.now || Date.now)();
  const aging: Aging[] = [];
  for (const doc of await readRequests(db)) {
    const record = doc.data() || {};
    const owed = accountDeletionAgeLevel(record.requestedAtIso, nowMs);
    if (owed) aging.push({ id: doc.id, status: String(record.status || "unknown"), ...owed });
  }
  const counts = { warning: aging.filter(item => item.level === "warning").length, overdue: aging.filter(item => item.level === "overdue").length };
  let newlyAlerted = 0;
  for (const level of ["overdue", "warning"] as const) {
    const fresh: Aging[] = [];
    let sends = 1;
    for (const item of aging.filter(entry => entry.level === level)) {
      if (delivered.has(markerId(item))) continue;
      try {
        const send = await claim(db, item, nowMs);
        if (!send) continue;
        sends = Math.max(sends, send);
        fresh.push(item);
      } catch (error) {
        logger.warn({ err: error, requestId: item.id, level }, "Could not claim an account deletion age alert");
      }
    }
    if (!fresh.length) continue;
    // Said as an age (review, 2026-11-27): no stored state says a request was completed by hand, so the title cannot say
    // a request is past the promise, only that it is if it is not completed.
    const one = fresh.length === 1;
    const age = level === "overdue" ? ACCOUNT_DELETION_PROMISE_DAYS : ACCOUNT_DELETION_WARNING_DAYS;
    const title = `${fresh.length} account deletion request${one ? " is" : "s are"} ${age} days old or more; `
      + (one ? "if it is not completed, it " : "any not completed ")
      + (level === "overdue"
        ? `${one ? "is" : "are"} past the ${ACCOUNT_DELETION_PROMISE_DAYS} days the Privacy Policy promises`
        : `${one ? "reaches" : "reach"} the ${ACCOUNT_DELETION_PROMISE_DAYS}-day promise within ${ACCOUNT_DELETION_PROMISE_DAYS - ACCOUNT_DELETION_WARNING_DAYS} days`);
    const lines = fresh.slice(0, 10).map(item => `- ${item.id}: ${item.status}, ${item.ageDays} days since it was made`);
    const more = fresh.length > 10 ? [`- …and ${fresh.length - 10} more`] : [];
    const text = [`${level === "overdue" ? ":rotating_light:" : ":warning:"} Blueprint: ${title}.`, ...lines, ...more,
      `Open ${appBaseUrl()}/admin/jobs, "Account and data deletion requests", and follow docs/runbooks/account-data-deletion.md. `
        + "\"Start privacy review\" deletes nothing; the deletion is done by hand. If it is already done, keep its completion record "
        + "(runbook step 7). This notice comes once for each request at 25 and at 30 days."].join("\n");
    logger.warn({ event: `account_deletion_request_${level}`, count: fresh.length, requestIds: fresh.map(item => item.id) }, title);
    const [slack, mail] = await Promise.all([
      Promise.resolve((options.alert || sendRateLimitedOpsAlert)(`account_deletion_${level}:${fresh[0].id}:${sends}`, text)).catch(() => undefined),
      (options.email || sendEmail)({ to: opsNoticeRecipient(), subject: `[${level === "overdue" ? "ALERT" : "NOTICE"}] ${title}`,
        text: text.replace(/^:\w+: /, "") }).catch(() => undefined),
    ]);
    if ((slack as { sent?: unknown } | undefined)?.sent !== true && (mail as { sent?: unknown } | undefined)?.sent !== true) {
      logger.error({ event: "account_deletion_age_alert_undelivered", level, requestIds: fresh.map(item => item.id) },
        "The account deletion age alert reached neither Slack nor the ops email; the next pass sends it again");
      continue;
    }
    const deliveredAtIso = new Date(nowMs).toISOString();
    await Promise.all(fresh.map(item => db.collection(ACCOUNT_DELETION_AGE_ALERT_COLLECTION).doc(markerId(item))
      .set({ delivered_at_iso: deliveredAtIso }, { merge: true })
      .then(() => { delivered.add(markerId(item)); })
      .catch(error => logger.warn({ err: error, requestId: item.id }, "Could not record a delivered account deletion age alert"))));
    newlyAlerted += fresh.length;
  }
  return { ...counts, newlyAlerted };
}

export function __resetAccountDeletionAgeAlertsForTests() {
  delivered.clear();
}
