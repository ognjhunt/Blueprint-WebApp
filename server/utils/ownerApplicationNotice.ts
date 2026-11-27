/**
 * The owner's email about a deployment company application (outreach gap 1, 2026-11-27): the second channel beside the
 * Slack bell, so a waiting application is never known by Slack alone. With no Slack webhook set the bell reached nobody
 * (`slack.ts`) and the three-working-day reminder was dropped on every pass (`accessApplicationReminder.ts`).
 *
 * - Two notices: the new-application notice (after the automatic check, or the plain bell for a technology partner) and
 *   the three-working-day reminder.
 * - At most one email per application per notice: the outbox row's id is the notice and the application's record id,
 *   created only if absent (`captureOutbox.ts`), and the outbox sends it through Resend (docs/runbooks/resend-email.md).
 * - Only to the ops address every ops alert already uses (`opsNoticeRecipient`: `CONTACT_TO`, else ops@tryblueprint.io).
 * - Link-only, like the bell: the approvals page and the check's reasons in words. No applicant name, email, company or
 *   website goes in it; those stay behind the admin role.
 * - Never a gate: it is queued after the application is saved and checked, and a failure to queue it is logged and
 *   changes nothing about the application.
 * - A durable daily ceiling (review, 2026-11-27): these emails share the email plan that sites' and companies' emails
 *   use (docs/runbooks/resend-email.md: 100 a day), and the public form has no global cap, so a burst of junk
 *   applications could otherwise use the day's email. At most `OWNER_APPLICATION_EMAIL_DAILY_CAP` rows a UTC day, both
 *   notices together (`durableDailyCaps.ts`, counted once per row id); the last one says no more will be emailed today
 *   and links the approvals page. Past the ceiling nothing is queued ("capped"): the Slack bell still rings, and a
 *   reminder whose marker no channel took is released and tried on a later pass.
 */
import { createHash } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { adjustDailyCap, consumeDailyCaps, readDailyCapUsage, type DailyCapOptions } from "./durableDailyCaps";
import { appBaseUrl, opsNoticeRecipient } from "./intakeOpsNotice";

export type OwnerApplicationNotice = "new_application" | "waiting_reminder";
export const OWNER_APPLICATION_EMAIL_KIND = "ops_access_application" as const;
/** The owner's application emails a UTC day, both notices together: a tenth of the plan's 100, the rest for customers. */
export const OWNER_APPLICATION_EMAIL_DAILY_CAP = 10;
export const OWNER_APPLICATION_EMAIL_CAP_NAME = "ops_access_application_email";
/** Added to the day's last owner email, above its link. */
export const OWNER_APPLICATION_EMAIL_LAST_LINES = [
  `This is the last of these emails today: Blueprint sends at most ${OWNER_APPLICATION_EMAIL_DAILY_CAP} a day, so email stays free for sites and companies.`,
  "More applications or reminders may be waiting and will not be emailed today. Open the approvals page to see them all:",
];

type Store = { collection: (name: string) => { doc: (id: string) => { create: (data: object) => Promise<unknown> } } };

export function ownerApplicationEmailId(notice: OwnerApplicationNotice, recordId: string) {
  return `${OWNER_APPLICATION_EMAIL_KIND}:${notice}:${recordId}`;
}

export function approvalsPageUrl(recordId: string) {
  return `${appBaseUrl()}/admin/robot-team-access?application=${recordId}`;
}

export type OwnerApplicationEmailResult = "queued" | "already_queued" | "not_queued" | "capped";

/**
 * Queue the owner's email for one application and notice. "queued": a row was created now; "already_queued": one exists
 * from before (the once-per-notice rule); "capped": today's ceiling is reached, nothing queued; "not_queued": no store,
 * or the write failed (logged).
 */
export async function queueOwnerApplicationEmail(options: {
  recordId: string;
  notice: OwnerApplicationNotice;
  subject: string;
  lines: string[];
  store?: Store | null;
  caps?: DailyCapOptions;
}): Promise<OwnerApplicationEmailResult> {
  const store = options.store === undefined ? (dbAdmin as unknown as Store | null) : options.store;
  if (!store || !/^[a-f0-9]{64}$/.test(options.recordId)) return "not_queued";
  const id = ownerApplicationEmailId(options.notice, options.recordId);
  // Counted once per row id a day. Not fail-closed: if the counter's store fails, the in-process counter still bounds
  // a burst, and the owner's notice is not lost to a counter.
  const cap = { name: OWNER_APPLICATION_EMAIL_CAP_NAME, limit: OWNER_APPLICATION_EMAIL_DAILY_CAP };
  const decision = await consumeDailyCaps({ scope: OWNER_APPLICATION_EMAIL_CAP_NAME, caps: [cap], idempotencyKey: id,
    failClosed: false }, options.caps).catch((error: unknown) => {
    logger.warn({ err: error, id }, "Could not count the owner's application email; queuing it");
    return null;
  });
  if (decision && !decision.allowed) {
    logger.info({ id, reason: decision.reason }, "Owner's application email not queued: today's ceiling is reached");
    return "capped";
  }
  const usage = decision?.counted ? await readDailyCapUsage({ name: cap.name }, options.caps).catch(() => null) : null;
  const last = usage !== null && usage.used >= OWNER_APPLICATION_EMAIL_DAILY_CAP;
  const tail = last ? ["", ...OWNER_APPLICATION_EMAIL_LAST_LINES, `${appBaseUrl()}/admin/robot-team-access`] : [];
  try {
    await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(id).create(buildOutboxEntry({ idempotencyKey: id,
      requestId: `ops-access-application:${options.recordId}`, kind: OWNER_APPLICATION_EMAIL_KIND, to: opsNoticeRecipient(),
      subject: options.subject, body: [...options.lines, "", approvalsPageUrl(options.recordId), ...tail].join("\n") }));
    return "queued";
  } catch (error) {
    // Nothing was queued now: give back today's unit, so the ceiling counts emails, not attempts.
    if (decision?.counted) await adjustDailyCap({ name: cap.name, day: decision.day, delta: -1 }, options.caps).catch(() => false);
    const code = (error as { code?: unknown })?.code;
    if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") return "already_queued";
    logger.warn({ err: error, id }, "Could not queue the owner's application email");
    return "not_queued";
  }
}

/** The new-application notice, in the bell's words without its emoji. */
export async function queueOwnerNewApplicationEmail(options: {
  recordId: string;
  check?: { outcome: "approved" | "needs_owner"; reasons: string[] };
}): Promise<OwnerApplicationEmailResult> {
  const { companyCheckReasonWords } = await import("../../client/src/lib/companyCheck");
  const why = options.check?.reasons.length ? options.check.reasons.map(companyCheckReasonWords).join(" ") : "";
  const approved = options.check?.outcome === "approved";
  const subject = approved ? "Blueprint: a deployment company was approved automatically"
    : "Blueprint: a deployment company applied and needs you";
  const lines = approved
    ? ["A deployment company was approved automatically: its work email is at its website's domain, and the website shows it deploys robots.", "", "See it:"]
    : [options.check ? "A deployment company applied and needs you." : "A deployment company applied.", ...(why ? ["", why] : []),
      "", "Approve or not yet:"];
  return queueOwnerApplicationEmail({ recordId: options.recordId, notice: "new_application", subject, lines });
}

/**
 * The new-application notice on both channels: the Slack bell and the owner's email. Returns the bell's result, as
 * the bell alone did; the email is queued whether or not the bell was sent, and neither can throw.
 */
export async function notifyOwnerOfApplication(options: {
  email: string;
  autoApproved?: boolean;
  check?: { outcome: "approved" | "needs_owner"; reasons: string[] };
}): Promise<{ sent: boolean; error?: unknown }> {
  const { notifySlackRobotTeamAccessApplication } = await import("./slack");
  // The same id as accessRecordId(): the application's record id, not the email.
  const recordId = createHash("sha256").update(options.email.trim().toLowerCase()).digest("hex");
  const [bell] = await Promise.all([
    notifySlackRobotTeamAccessApplication(options).catch((error: unknown) => ({ sent: false, error })),
    queueOwnerNewApplicationEmail({ recordId, ...(options.check ? { check: options.check } : {}) }).catch(() => "not_queued" as const),
  ]);
  return bell;
}
