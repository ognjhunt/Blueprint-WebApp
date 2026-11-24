/**
 * The reply window on a company's question (owner, 2026-11-23, after freight marketplaces: a pending step carries its
 * date, and a reminder goes before it is missed). When a company asks the site a question (a "Need more details" note,
 * or the question with an application), the site is asked to reply within three days (`REPLY_WINDOW_MS`). At that date,
 * if the question is still the company's current one and still unanswered, one email reminds the site. Nothing is held
 * or closed: the site can still reply and the company can still change its answer (only privacy, rights and money stop
 * anything).
 *
 * A window is recorded where the question is first asked (`site-worlds.ts`, the answer route's transaction), in
 * `siteReplyWindows/{jobId}__{companyId}`, so the sweep reads open windows rather than every job's answers.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { replyByIso } from "../../client/src/lib/companyResponses";
import { logger } from "../logger";
import type { OutboxEntry } from "./captureOutbox";
import { clarificationOnReply, questionOnReply } from "./jobClarifications";
import { loadCompanyJobAccess } from "./teamJobAccess";

export const SITE_REPLY_WINDOWS = "siteReplyWindows";
export const SITE_REPLY_REMINDER_KIND = "site_reply_reminder";
export const siteReplyReminderKey = (jobId: string, questionId: string) => `${jobId}:${SITE_REPLY_REMINDER_KIND}:${questionId}`;
const RESPONSES = "robotTeamInterest";
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
const PER_PASS = 10;

/** The reminder's words: no company's name or words, only that one is waiting, and the private link. */
export function siteReplyReminderCopy(url: string): { subject: string; body: string } {
  return { subject: "A company is waiting for your reply",
    body: "A deployment company asked a question about your job three days ago and is waiting for your reply. "
      + `Answer it on your job page.\n\nThis link opens your job without a password, so please don't forward it.\n\nOpen your job:\n${url}` };
}

/** The window for a question asked now: written in the answer route's transaction, after its reads. */
export function recordReplyWindow(tx: FirebaseFirestore.Transaction, input: { jobId: string; companyId: string; questionId: string;
  askedAtIso: string }) {
  if (!db) return;
  tx.set(db.collection(SITE_REPLY_WINDOWS).doc(`${input.jobId}__${input.companyId}`), { schemaVersion: 1, jobId: input.jobId,
    companyId: input.companyId, questionId: input.questionId, askedAtIso: input.askedAtIso, replyByIso: replyByIso(input.askedAtIso),
    state: "open" });
}

/**
 * The ops monitor's pass (`betaOpsMonitor.ts`, step 11): every open window whose date has come, at most ten a pass,
 * the earliest first. A question no longer current, answered, or on a job no longer shown to companies closes its window
 * with no email. Returns how many reminders were queued.
 */
export async function remindUnansweredQuestions(nowMs = Date.now()): Promise<number> {
  if (!db) return 0;
  const store = db;
  const due: Array<{ id: string; jobId: string; companyId: string; questionId: string; replyByIso: string }> = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = store.collection(SITE_REPLY_WINDOWS).where("state", "==", "open").orderBy("__name__").limit(PAGE_SIZE);
    if (after) query = query.startAfter(after);
    const { docs } = await query.get();
    for (const doc of docs) {
      const row = doc.data();
      if (typeof row.replyByIso === "string" && Date.parse(row.replyByIso) <= nowMs) due.push({ id: doc.id, jobId: String(row.jobId),
        companyId: String(row.companyId), questionId: String(row.questionId), replyByIso: row.replyByIso });
    }
    if (docs.length < PAGE_SIZE) break;
    after = docs[docs.length - 1].id;
  }
  // Read at call time: the outbox imports this module for its dispatch check.
  const { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  let queued = 0, decided = 0;
  for (const window of due.sort((a, b) => a.replyByIso.localeCompare(b.replyByIso))) {
    if (decided >= PER_PASS) break;
    try {
      const sent = await store.runTransaction(async (tx): Promise<boolean | "not_shown"> => {
        const windowRef = store.collection(SITE_REPLY_WINDOWS).doc(window.id);
        const replyRef = store.collection("inboundRequests").doc(window.jobId).collection(RESPONSES).doc(window.companyId);
        const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(siteReplyReminderKey(window.jobId, window.questionId));
        // The window as it stands now: a company that asked a new question since the sweep read it has a new window
        // under the same id, which this pass leaves alone (its own date comes).
        const current = (await tx.get(windowRef)).data();
        if (current?.state !== "open" || current.questionId !== window.questionId) return false;
        const { record, access } = await loadCompanyJobAccess(window.jobId, undefined, tx);
        const reply = (await tx.get(replyRef)).data();
        const already = (await tx.get(outboxRef)).exists;
        const question = questionOnReply(reply);
        const open = Boolean(record) && access.listed && question?.id === window.questionId && !clarificationOnReply(reply, window.questionId);
        if (!open || already) {
          tx.set(windowRef, { state: "closed", closedAtIso: new Date(nowMs).toISOString() }, { merge: true });
          return false;
        }
        // The site sees a company's question only once names and contact details are out of it (`companyWordsForSite`):
        // it is never reminded about one it cannot read. The window stays open, and a later pass reminds it once shown.
        if (!await questionShownToSite(tx, window.jobId, window.companyId, reply!, question!.text)) return "not_shown";
        const { decryptFieldValue } = await import("./field-encryption");
        const to = String(await decryptFieldValue(record!.contact?.email ?? "")).trim();
        const atIso = new Date(nowMs).toISOString();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          const { captureUploadUrlFor } = await import("./captureUploadToken");
          const { subject, body } = siteReplyReminderCopy(captureUploadUrlFor(window.jobId, "owner"));
          tx.create(outboxRef, buildOutboxEntry({ idempotencyKey: outboxRef.id, requestId: window.jobId, kind: SITE_REPLY_REMINDER_KIND,
            to, subject, body }));
          tx.set(replyRef, { replyReminder: { questionId: window.questionId, queuedAtIso: atIso } }, { merge: true });
        } else {
          logger.warn({ requestId: window.jobId }, "The site has no usable email; its reply reminder is not queued");
        }
        tx.set(windowRef, { state: "reminded", remindedAtIso: atIso }, { merge: true });
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
      });
      if (sent !== "not_shown") decided += 1;
      if (sent === true) queued += 1;
    } catch (error) {
      logger.warn({ error, requestId: window.jobId }, "Could not remind the site about a company's question");
    }
  }
  return queued;
}

/**
 * Whether the site's page shows this company's question: its words through the deterministic pass with the company's
 * held identity, and the model pass over them succeeded (`companyWordsForSite`). Reads only, inside the transaction.
 */
async function questionShownToSite(tx: FirebaseFirestore.Transaction, jobId: string, companyId: string,
  reply: FirebaseFirestore.DocumentData, questionText: string): Promise<boolean> {
  const [{ knownCompanyIdentity, siteReasonOf }, { FREE_TEXT_SCREENING_COLLECTION, needsScreening, screeningKey }, { ROBOT_TEAM_ACCESS_COLLECTION }] =
    await Promise.all([import("./jobCompanies"), import("./freeTextScreening"), import("./robotTeamEarlyAccess")]);
  const company = (await tx.get(db!.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId))).data();
  const input = siteReasonOf({ ...reply, inputs: questionText }, knownCompanyIdentity(company, reply));
  if (!input) return false;
  if (!needsScreening(input)) return true;
  const row = (await tx.get(db!.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION)
    .doc(screeningKey("company", input)))).data();
  return row?.status === "done";
}

/**
 * At dispatch: a reply reminder is still true only while the job is shown to companies and the company's question it
 * names is still current and unanswered. Every other kind is not this check's to decide.
 */
export async function replyReminderIsCurrent(entry: Pick<OutboxEntry, "kind" | "requestId" | "idempotencyKey">,
  tx: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== SITE_REPLY_REMINDER_KIND) return true;
  if (!db || !entry.requestId) return false;
  const prefix = `${entry.requestId}:${SITE_REPLY_REMINDER_KIND}:`;
  if (!entry.idempotencyKey.startsWith(prefix)) return false;
  const questionId = entry.idempotencyKey.slice(prefix.length);
  const { record, access } = await loadCompanyJobAccess(entry.requestId, undefined, tx);
  if (!record || !access.listed) return false;
  const replies = await tx.get(db.collection("inboundRequests").doc(entry.requestId).collection(RESPONSES)
    .where("questionId", "==", questionId).limit(1));
  const reply = replies.docs[0]?.data();
  const question = questionOnReply(reply);
  return question?.id === questionId && !clarificationOnReply(reply, questionId);
}
