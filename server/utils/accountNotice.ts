import { createHash } from "node:crypto";
import { z } from "zod";
import type { OutboxInput } from "./captureOutbox";
import { brandedEmail, CUSTOMER_JOB_EMAIL_IDENTITY } from "./emailLayout";

const accountNoticeSchema = z.object({
  noticeId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
  to: z.string().trim().email().transform(value => value.toLowerCase()),
  subject: z.string().refine(value => Boolean(value.trim()) && !/[\r\n]/.test(value)),
  body: z.string().refine(value => Boolean(value.trim())),
}).strict();

/** One reviewed notice for one account. No HTML or sender overrides. */
export function prepareAccountNotice(input: unknown) {
  const notice = accountNoticeSchema.parse(input);
  const recipientDigest = createHash("sha256").update(notice.to).digest("hex");
  const entry: OutboxInput = {
    idempotencyKey: `account_notice:${notice.noticeId}:${recipientDigest}`,
    requestId: `account-notice:${notice.noticeId}`,
    kind: "account_notice",
    to: notice.to,
    subject: notice.subject,
    body: notice.body,
    replyTo: CUSTOMER_JOB_EMAIL_IDENTITY.replyTo,
  };
  return { entry, message: {
    to: entry.to, subject: entry.subject, ...CUSTOMER_JOB_EMAIL_IDENTITY,
    ...brandedEmail({ subject: entry.subject, text: entry.body }),
  } };
}

/** Enqueue only under explicit send authority. Preview never loads live services. */
export async function enqueueAccountNotice(input: unknown) {
  const { entry } = prepareAccountNotice(input);
  const { dbAdmin: db } = await import("../../client/src/lib/firebaseAdmin");
  if (!db) throw new Error("account_notice_store_unavailable");
  const { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const result = await enqueueOutbox(entry);
  // The existing enqueue API returns false for duplicates and storage failures.
  // Read back the exact intent before claiming success, including on a retry.
  const stored = (await db.collection(CAPTURE_OUTBOX_COLLECTION).doc(entry.idempotencyKey).get()).data();
  if (!stored) throw new Error("account_notice_enqueue_unconfirmed");
  if (Object.entries(entry).some(([key, value]) => stored[key] !== value))
    throw new Error("account_notice_id_conflict");
  return { ...result, idempotencyKey: entry.idempotencyKey, status: stored.status as string };
}
