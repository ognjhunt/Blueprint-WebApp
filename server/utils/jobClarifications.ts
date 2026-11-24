import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { COMPANY_RESPONSE_STATEMENT_VERSIONS, COMPANY_QUESTION_LIMIT, SITE_CLARIFICATION_LIMIT,
  isCompanyResponseState } from "../../client/src/lib/companyResponses";
import { REMOVED, removeIdentifyingDetails, removeNamesNotHeld } from "../../client/src/lib/contactRedaction";
import { type OutboxEntry } from "./captureOutbox";
import { companyMaySeeJobs } from "./companyTerms";
import { companyJobUrl, COMPANY_RESPONSES_COLLECTION, siteReasonOf, knownCompanyIdentity, storedAliases } from "./jobCompanies";
import { knownSiteIdentity } from "./siteIdentity";
import type { KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { accessRecordId, ROBOT_TEAM_ACCESS_COLLECTION } from "./robotTeamEarlyAccess";

type Data = FirebaseFirestore.DocumentData;
type ClarificationNotice = Pick<OutboxEntry, "kind" | "to" | "requestId" | "idempotencyKey">;

export function questionOnReply(reply: Data | undefined): { id: string; text: string } | null {
  if (reply?.recordedBy !== "company" || !COMPANY_RESPONSE_STATEMENT_VERSIONS.includes(String(reply.statementVersion))
    || !isCompanyResponseState(reply.state) || reply.state === "declined") return null;
  const value = reply.state === "needs_something" ? reply.inputs : reply.details?.question;
  const text = typeof value === "string" ? value.trim().slice(0, reply.state === "needs_something" ? 2000 : COMPANY_QUESTION_LIMIT) : "";
  if (!text) return null;
  if (typeof reply.updatedAtIso !== "string") return null;
  const id = typeof reply.questionId === "string" && /^[a-f0-9]{64}$/.test(reply.questionId)
    ? reply.questionId : createHash("sha256").update(`legacy-question:${reply.updatedAtIso}`).digest("hex");
  return { id, text };
}

export function clarificationOnReply(reply: Data | undefined, questionId: string): string | undefined {
  const saved = reply?.siteClarification;
  return saved?.questionId === questionId && typeof saved.text === "string" ? saved.text : undefined;
}

/** The company's email when the site answers its question: the answer stays on the job page. */
export const CLARIFICATION_SUBJECT = "The site answered your question";
export const clarificationEmailBody = (jobUrl: string) => `Read it on the job page.\n\nOpen the job:\n${jobUrl}`;

const noticeKey = (jobId: string, companyId: string, questionId: string) =>
  `job_clarification:${jobId}:${companyId}:${questionId}`;

/**
 * The site's reply to a company's question, saved once (2026-11-24: then screened). The reply is stored after the
 * deterministic pass with the site's identity; the company reads it only once the model pass over that stored text has
 * succeeded (`siteReplyForCompany`). The pass runs right after the save, waiting at most `SCREENING_WAIT_MS`, so the
 * site is answered with its reply exactly as the company reads it, or `null` while the pass has not finished (the next
 * read of either page starts it again).
 */
export async function answerCompanyQuestion(input: { jobId: string; alias: string; questionId: string; answer: string }) {
  if (!db) throw new Error("firestore_unavailable");
  const store = db;
  const { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  let known: KnownSiteIdentity | null = null;
  const saved = await store.runTransaction(async tx => {
    const { record, access } = await loadCompanyJobAccess(input.jobId, undefined, tx);
    if (!record || !access.listed) return { status: "closed" } as const;
    const companyId = Object.entries(storedAliases(record)).find(([, letter]) => letter === input.alias)?.[0];
    if (!companyId) return { status: "changed" } as const;
    const replyRef = store.collection("inboundRequests").doc(input.jobId).collection(COMPANY_RESPONSES_COLLECTION).doc(companyId);
    const [replySnap, companySnap] = await Promise.all([
      tx.get(replyRef), tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId)),
    ]);
    const reply = replySnap.data(), company = companySnap.data();
    const question = questionOnReply(reply);
    if (!companyMaySeeJobs(company) || !question || question.id !== input.questionId
      || !siteReasonOf({ ...reply, inputs: question.text }, knownCompanyIdentity(company, reply)))
      return { status: "changed" } as const;
    known = await knownSiteIdentity(record);
    const existing = clarificationOnReply(reply, question.id);
    if (existing) return { status: "saved", answer: existing } as const;
    const sanitized = removeNamesNotHeld(removeIdentifyingDetails(input.answer, known))
      .trim().slice(0, SITE_CLARIFICATION_LIMIT);
    if (sanitized.split(REMOVED).join("").replace(/\bthe site\b/gi, "").replace(/[^\p{L}\p{N}]+/gu, "").length < 2)
      // A reply that was only contact details ("612 345 678") is said so: the company would read nothing of it.
      return { status: sanitized.includes(REMOVED) ? "only_contact_details" : "needs_detail" } as const;
    const email = String(company?.email ?? "").trim().toLowerCase();
    const key = noticeKey(input.jobId, companyId, question.id);
    const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key);
    const alreadyQueued = (await tx.get(outboxRef)).exists;
    tx.update(replyRef, { siteClarification: { questionId: question.id, text: sanitized, answeredAtIso: new Date().toISOString() } });
    if (!alreadyQueued && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      tx.create(outboxRef, buildOutboxEntry({ idempotencyKey: key, requestId: input.jobId, kind: "job_clarification",
        to: email, subject: CLARIFICATION_SUBJECT, body: clarificationEmailBody(companyJobUrl(input.jobId)) }));
    }
    return { status: "saved", answer: sanitized } as const;
  });
  if (saved.status !== "saved") return saved;
  const { screenText, screeningsFrom, screeningKey, siteReplyForCompany, SCREENING_WAIT_MS } = await import("./freeTextScreening");
  const screened = await screenText(input.jobId, "site", saved.answer, { waitMs: SCREENING_WAIT_MS });
  const shown = screened === null ? null
    : siteReplyForCompany(saved.answer, known, screeningsFrom(new Map([[screeningKey("site", saved.answer), screened]])));
  return { status: "saved", answer: shown } as const;
}

/** Recheck sharing, approval and the same answered question before a notice can leave the outbox. */
export async function clarificationNoticeIsCurrent(entry: ClarificationNotice, tx: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== "job_clarification") return true;
  if (!db) return false;
  const email = entry.to.trim().toLowerCase();
  const companyId = accessRecordId(email);
  const store = db;
  const [{ access }, company, replySnap, suppression] = await Promise.all([
    loadCompanyJobAccess(entry.requestId, undefined, tx),
    tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId)),
    tx.get(store.collection("inboundRequests").doc(entry.requestId).collection(COMPANY_RESPONSES_COLLECTION).doc(companyId)),
    tx.get(store.collection("email_suppressions").doc(email)),
  ]);
  const reply = replySnap.data(), question = questionOnReply(reply);
  const blocked = suppression.data();
  return blocked?.global_suppressed !== true && !(Array.isArray(blocked?.suppressed_scopes) && blocked.suppressed_scopes.includes("all"))
    && access.listed && companyMaySeeJobs(company.data()) && String(company.data()?.email ?? "").trim().toLowerCase() === email
    && !!question && !!clarificationOnReply(reply, question.id)
    && entry.idempotencyKey === noticeKey(entry.requestId, companyId, question.id);
}
