import { createHash } from "node:crypto";
import { z } from "zod";
import type { UserRecord } from "firebase-admin/auth";
import type { OutboxEntry, OutboxInput } from "./captureOutbox";
import { brandedEmail, CUSTOMER_JOB_EMAIL_IDENTITY } from "./emailLayout";

const uidSchema = z.string().min(1).max(128).refine(value => !value.includes("/"));
const eligibilitySchema = z.object({
  audience: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing_accounts"), createdBefore: z.string().datetime() }).strict(),
    z.object({ kind: z.literal("account_uids"), uids: z.array(uidSchema).min(1) }).strict(),
  ]),
  reason: z.string().trim().min(1),
  evidenceRef: z.string().trim().min(1),
  emailVerification: z.enum(["required", "not_required"]),
  includeDisabledAccounts: z.boolean(),
  exclusions: z.array(z.object({ uid: uidSchema, reason: z.enum(["test_account", "unrelated"]), evidenceRef: z.string().trim().min(1) }).strict()),
}).strict();
export const accountNoticeSchema = z.object({
  noticeId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
  subject: z.string().refine(value => Boolean(value.trim()) && !/[\r\n]/.test(value)),
  body: z.string().refine(value => Boolean(value.trim())),
  eligibility: eligibilitySchema,
}).strict();
type Notice = z.infer<typeof accountNoticeSchema>;
const contextSchema = z.object({ uid: uidSchema, email: z.string().email(), createdAt: z.string().datetime(), eligibility: eligibilitySchema }).strict();
export type AccountNoticeContext = z.infer<typeof contextSchema>;
export type AccountNoticeRecipient = {
  uid: string; state: "eligible" | "excluded" | "held"; reason: string;
  sourceRecordIds: string[]; accountLinked: boolean; email: string | null;
  emailVerified: boolean | null; accountDisabled: boolean | null; accountCreatedAt: string | null; exclusionEvidenceRef?: string;
};

/** Stable across Firestore map ordering; never bind volatile audit timestamps. */
export function accountNoticeDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, (_key, child) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child) ?? "undefined").digest("hex");
}

/** Auth owns account existence, canonical email and creation time. Profiles are join context only. */
export function assessAccountNoticeRecipient(notice: Notice, uid: string, auth: Pick<UserRecord, "uid" | "email" | "emailVerified" | "disabled" | "metadata"> | null,
  profileExists = false, lookupFailed = false): AccountNoticeRecipient {
  const created = auth ? Date.parse(auth.metadata?.creationTime) : NaN;
  const row: AccountNoticeRecipient = { uid, state: "held", reason: "account_link_unproven",
    sourceRecordIds: [...(auth ? [`firebase_auth/users/${auth.uid}`] : []), ...(profileExists ? [`users/${uid}`] : [])],
    accountLinked: Boolean(auth && auth.uid === uid), email: auth?.email?.trim().toLowerCase() || null,
    emailVerified: typeof auth?.emailVerified === "boolean" ? auth.emailVerified : null,
    accountDisabled: typeof auth?.disabled === "boolean" ? auth.disabled : null,
    accountCreatedAt: Number.isFinite(created) ? new Date(created).toISOString() : null };
  const excluded = notice.eligibility.exclusions.find(item => item.uid === uid);
  if (excluded) return { ...row, state: "excluded", reason: excluded.reason, exclusionEvidenceRef: excluded.evidenceRef };
  if (lookupFailed) return { ...row, reason: "account_lookup_unavailable" };
  if (!row.accountLinked) return row;
  if (row.accountDisabled === null || row.emailVerified === null) return { ...row, reason: "account_status_unproven" };
  if (row.accountDisabled && !notice.eligibility.includeDisabledAccounts) return { ...row, state: "excluded", reason: "account_disabled" };
  const audience = notice.eligibility.audience;
  if (audience.kind === "account_uids" && !audience.uids.includes(uid)) return { ...row, state: "excluded", reason: "outside_notice_scope" };
  if (!row.accountCreatedAt) return { ...row, reason: "account_creation_unproven" };
  if (audience.kind === "existing_accounts" && created >= Date.parse(audience.createdBefore)) return { ...row, state: "excluded", reason: "created_after_notice_cutoff" };
  if (!z.string().email().safeParse(row.email).success) return { ...row, reason: "account_email_unavailable" };
  if (notice.eligibility.emailVerification === "required" && !row.emailVerified) return { ...row, reason: "email_verification_required" };
  return { ...row, state: "eligible", reason: "account_in_notice_scope" };
}

async function accountSources() {
  const { authAdmin: auth, dbAdmin: db } = await import("../../client/src/lib/firebaseAdmin");
  if (!auth || !db) throw new Error("account_notice_sources_unavailable");
  return { auth, db };
}

/** Read-only, complete Auth pagination plus profile IDs, including orphan profiles. No email-address input. */
export async function previewAccountNotices(input: unknown) {
  const notice = accountNoticeSchema.parse(input), { auth, db } = await accountSources();
  const accounts = new Map<string, UserRecord>();
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const account of page.users) accounts.set(account.uid, account);
    pageToken = page.pageToken;
  } while (pageToken);
  const profiles = new Set((await db.collection("users").select().get()).docs.map(doc => doc.id));
  // Include explicitly scoped/identified IDs even if neither current source contains them.
  const uids = new Set([...accounts.keys(), ...profiles, ...notice.eligibility.exclusions.map(item => item.uid),
    ...(notice.eligibility.audience.kind === "account_uids" ? notice.eligibility.audience.uids : [])]);
  const recipients = [...uids].sort().map(uid => assessAccountNoticeRecipient(notice, uid, accounts.get(uid) ?? null, profiles.has(uid)));
  return { schema: "blueprint.account_notice_recipients.v1" as const, capturedAt: new Date().toISOString(),
    noticeDigest: accountNoticeDigest(notice), notice, complete: true as const, recipients };
}

function prepareAccountNotice(notice: Notice, row: AccountNoticeRecipient) {
  if (row.state !== "eligible" || !row.email || !row.accountCreatedAt) throw new Error("account_notice_recipient_review_required");
  const context: AccountNoticeContext = { uid: row.uid, email: row.email, createdAt: row.accountCreatedAt, eligibility: notice.eligibility };
  const entry: OutboxInput = {
    idempotencyKey: `account_notice:${notice.noticeId}:${createHash("sha256").update(row.email).digest("hex")}`,
    requestId: `account-notice:${notice.noticeId}`, kind: "account_notice", to: row.email,
    subject: notice.subject, body: notice.body, replyTo: CUSTOMER_JOB_EMAIL_IDENTITY.replyTo, accountNotice: context,
  };
  return { entry, message: { to: entry.to, subject: entry.subject, ...CUSTOMER_JOB_EMAIL_IDENTITY,
    ...brandedEmail({ subject: entry.subject, text: entry.body }) } };
}

/** Render only eligible rows from the read-only preview; this grants no enqueue authority. */
export function renderAccountNotice(input: unknown, row: AccountNoticeRecipient) {
  return prepareAccountNotice(accountNoticeSchema.parse(input), row).message;
}

/** Re-read Auth immediately before enqueue or dispatch; never retarget reviewed email or recreated identity. */
async function currentRecipient(notice: Notice, uid: string) {
  try { const { auth } = await accountSources(); return assessAccountNoticeRecipient(notice, uid, await auth.getUser(uid)); }
  catch { return assessAccountNoticeRecipient(notice, uid, null, false, true); }
}
export async function accountNoticeDispatchBlocker(entry: OutboxEntry): Promise<string | null> {
  if (entry.kind !== "account_notice") return null;
  const context = contextSchema.safeParse(entry.accountNotice);
  if (!context.success) return "account_notice_provenance_review_required";
  if (typeof entry.requestId !== "string" || !entry.requestId.startsWith("account-notice:")) return "account_notice_provenance_review_required";
  const notice = accountNoticeSchema.safeParse({ noticeId: entry.requestId.replace(/^account-notice:/, ""), subject: entry.subject, body: entry.body, eligibility: context.data.eligibility });
  if (!notice.success) return "account_notice_provenance_review_required";
  const row = await currentRecipient(notice.data, context.data.uid);
  if (row.state !== "eligible") return `account_notice_${row.reason}`;
  if (row.email !== context.data.email || row.email !== entry.to || row.accountCreatedAt !== context.data.createdAt)
    return "account_notice_identity_changed";
  if (prepareAccountNotice(notice.data, row).entry.idempotencyKey !== entry.idempotencyKey) return "account_notice_provenance_review_required";
  return null;
}

/** Explicit send authority is still required. A reviewed preview is never trusted as a live account source. */
export async function enqueueAccountNotice(input: unknown, reviewed: AccountNoticeRecipient) {
  const notice = accountNoticeSchema.parse(input);
  if (reviewed.state !== "eligible") throw new Error("account_notice_recipient_review_required");
  const current = await currentRecipient(notice, uidSchema.parse(reviewed.uid));
  if (current.state !== "eligible" || current.email !== reviewed.email || current.accountCreatedAt !== reviewed.accountCreatedAt)
    throw new Error("account_notice_recipient_review_required");
  const { entry } = prepareAccountNotice(notice, current), { db } = await accountSources();
  const { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const result = await enqueueOutbox(entry);
  const stored = (await db.collection(CAPTURE_OUTBOX_COLLECTION).doc(entry.idempotencyKey).get()).data();
  if (!stored) throw new Error("account_notice_enqueue_unconfirmed");
  if (Object.entries(entry).some(([key, value]) => accountNoticeDigest(stored[key]) !== accountNoticeDigest(value))) throw new Error("account_notice_id_conflict");
  return { ...result, idempotencyKey: entry.idempotencyKey, status: stored.status as string };
}
