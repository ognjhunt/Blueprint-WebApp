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
 */
import { createHash } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { appBaseUrl, opsNoticeRecipient } from "./intakeOpsNotice";

export type OwnerApplicationNotice = "new_application" | "waiting_reminder";
export const OWNER_APPLICATION_EMAIL_KIND = "ops_access_application" as const;

type Store = { collection: (name: string) => { doc: (id: string) => { create: (data: object) => Promise<unknown> } } };

export function ownerApplicationEmailId(notice: OwnerApplicationNotice, recordId: string) {
  return `${OWNER_APPLICATION_EMAIL_KIND}:${notice}:${recordId}`;
}

export function approvalsPageUrl(recordId: string) {
  return `${appBaseUrl()}/admin/robot-team-access?application=${recordId}`;
}

/**
 * Queue the owner's email for one application and notice. "queued": a row was created now; "already_queued": one exists
 * from before (the once-per-notice rule); "not_queued": no store, or the write failed (logged).
 */
export async function queueOwnerApplicationEmail(options: {
  recordId: string;
  notice: OwnerApplicationNotice;
  subject: string;
  lines: string[];
  store?: Store | null;
}): Promise<"queued" | "already_queued" | "not_queued"> {
  const store = options.store === undefined ? (dbAdmin as unknown as Store | null) : options.store;
  if (!store || !/^[a-f0-9]{64}$/.test(options.recordId)) return "not_queued";
  const id = ownerApplicationEmailId(options.notice, options.recordId);
  try {
    await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(id).create(buildOutboxEntry({ idempotencyKey: id,
      requestId: `ops-access-application:${options.recordId}`, kind: OWNER_APPLICATION_EMAIL_KIND, to: opsNoticeRecipient(),
      subject: options.subject, body: [...options.lines, "", approvalsPageUrl(options.recordId)].join("\n") }));
    return "queued";
  } catch (error) {
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
}): Promise<"queued" | "already_queued" | "not_queued"> {
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
