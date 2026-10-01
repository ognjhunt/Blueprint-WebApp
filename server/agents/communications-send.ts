import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { isEmailSuppressed } from "../utils/email-suppression";
import { communicationsEnvelopeSchema, communicationsBriefSchema, verifyCommunicationsHandoff, communicationsDigest, communicationsDeliveryKey, correlateReply, correlatedReplies, isOptOut } from "./communications-contract";
import { COMMUNICATIONS_ROOT, CommunicationsStore } from "./communications-store";
import { readExistingResearchSnapshot, verifyPublishedResearch } from "./communications-research";
import { verifyFounderMailbox, readFounderThread, findFounderSentMessage, sendFounderMessage } from "./communications-gmail";
import { reviewCommunicationsPayload } from "./communications-review";
import type { ActionPayload } from "./action-policies";

export function communicationsSendingEnabled() {
  return process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true";
}

/** New-send authority is separate from read-only acknowledgement recovery. */
export async function communicationsSendBlocker(payload: ActionPayload, ledgerId: string): Promise<string | null> {
  if (!communicationsSendingEnabled()) return "communications_sending_disabled";
  if (!dbAdmin) return "communications_store_unavailable";
  try {
    const review = reviewCommunicationsPayload(payload);
    if (!review.hardChecksPassed) return review.blockers.join(",");
    const { job, brief, thread } = communicationsEnvelopeSchema.parse(payload.communications);
    const store = new CommunicationsStore(dbAdmin);
    const [source, currentBrief] = await Promise.all([
      dbAdmin.collection("outboundProspects").doc(job.prospectId).get(), store.brief(job.briefId),
    ]);
    if (!source.exists || source.data()?.contactEmail?.toLowerCase() !== payload.to || source.data()?.stage === "closed"
      || (job.intent === "outreach" && source.data()?.stage !== "drafted")
      || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId
      || source.data()?.communications?.ledgerId !== ledgerId
      || communicationsDigest(currentBrief) !== job.briefDigest) return "communications_approval_context_changed";
    verifyPublishedResearch(await readExistingResearchSnapshot(dbAdmin, brief.researchOrigin.date), brief, await store.handoff(brief), await store.contactProof(brief));
    if (await isEmailSuppressed(brief.contact.email, "growth_campaign")) return "recipient_suppressed";
    await verifyFounderMailbox();
    if (job.intent === "reply") {
      const actual = await readFounderThread(thread!.threadId);
      const replies = correlatedReplies(brief, actual);
      if (replies.some(isOptOut)) return "recipient_opt_out";
      if (communicationsDigest(actual.messages) !== communicationsDigest(thread!.messages)) return "reply_thread_changed_requires_review";
      const incoming = correlateReply(brief, actual, job.inboundMessageId!);
      if (!incoming || replies.at(-1)?.gmailMessageId !== incoming.gmailMessageId) return "reply_correlation_missing_or_superseded";
    }
    return null;
  } catch { return "communications_permission_or_context_unavailable"; }
}

function sendParameters(payload: ActionPayload, rfcMessageId: string) {
  return { to: String(payload.to), subject: String(payload.subject), body: String(payload.transportBody), messageId: rfcMessageId,
    ...(typeof payload.gmailThreadId === "string" ? { threadId: payload.gmailThreadId } : {}),
    ...(typeof payload.inReplyTo === "string" ? { inReplyTo: payload.inReplyTo } : {}) };
}
async function persistReceipt(payload: ActionPayload, receipt: { messageId: string; threadId: string; rfcMessageId: string }) {
  const { job } = communicationsEnvelopeSchema.parse(payload.communications);
  const db = dbAdmin!;
  const receiptRef = db.doc(COMMUNICATIONS_ROOT).collection("sendReceipts").doc(communicationsDeliveryKey(job));
  const sourceRef = db.collection("outboundProspects").doc(job.prospectId);
  await db.runTransaction(async (tx) => {
    const source = await tx.get(sourceRef);
    tx.set(receiptRef, { state: "sent", receipt, sentAt: new Date().toISOString() }, { merge: true });
    tx.set(sourceRef, {
      ...(job.intent === "outreach" && source.data()?.stage === "drafted" ? { stage: "contacted", contactedAtIso: new Date().toISOString() } : {}),
      ...(source.data()?.communications?.jobId === job.jobId ? { communications: { state: "sent", receipt } } : {}),
    }, { merge: true });
    tx.set(sourceRef.collection("communicationsEvents").doc(`sent_${job.jobId}`), {
      type: "sent", job, receipt, payloadDigest: communicationsDigest(payload), approvalLedgerId: `communications_${job.jobId}`,
    });
  });
  return receipt;
}

/** May observe an already attempted, approved send when context/flags changed.
 * It cannot create a send. No search result never licenses repeating Gmail POST. */
export async function reconcileCommunicationsSend(payload: ActionPayload) {
  if (!dbAdmin) throw new Error("communications_store_unavailable");
  const { job } = communicationsEnvelopeSchema.parse(payload.communications);
  const ref = dbAdmin.doc(COMMUNICATIONS_ROOT).collection("sendReceipts").doc(communicationsDeliveryKey(job));
  const previous = await ref.get();
  if (!previous.exists) return null;
  const record = previous.data()!;
  if (record.jobId !== job.jobId || record.payloadDigest !== communicationsDigest(payload)) throw new Error("send_already_reserved_for_recipient_or_reply");
  const ledger = (await dbAdmin.collection("action_ledger").doc(`communications_${job.jobId}`).get()).data();
  if (!ledger?.approved_by || ledger.approved_by !== ledger.outreach_reviewed_by
    || ledger.outreach_semantic_review?.digest !== reviewCommunicationsPayload(payload).digest) throw new Error("send_original_approval_missing_or_changed");
  if (record.state === "sent") return record.receipt;
  const found = await findFounderSentMessage(record.rfcMessageId, sendParameters(payload, record.rfcMessageId));
  if (!found?.id || !found.threadId) throw new Error("gmail_send_requires_reconciliation_no_resend");
  return persistReceipt(payload, { messageId: found.id, threadId: found.threadId, rfcMessageId: record.rfcMessageId });
}

/** Existing authenticated approve/retry flow is the sole caller. */
export async function executeCommunicationsSend(payload: ActionPayload) {
  const recovered = await reconcileCommunicationsSend(payload);
  if (recovered) return recovered;
  if (!communicationsSendingEnabled() || !dbAdmin) throw new Error("communications_sending_disabled");
  const { job, brief } = communicationsEnvelopeSchema.parse(payload.communications);
  const ledgerId = `communications_${job.jobId}`;
  const blocker = await communicationsSendBlocker(payload, ledgerId);
  if (blocker) throw new Error(blocker);
  const deliveryKey = communicationsDeliveryKey(job);
  const ref = dbAdmin.doc(COMMUNICATIONS_ROOT).collection("sendReceipts").doc(deliveryKey);
  const ledgerRef = dbAdmin.collection("action_ledger").doc(ledgerId);
  const sourceRef = dbAdmin.collection("outboundProspects").doc(job.prospectId);
  const rfcMessageId = `<blueprint.communications.${deliveryKey}@tryblueprint.io>`;
  const claimed = await dbAdmin.runTransaction(async (tx) => {
    const briefRef = dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("briefs").doc(job.briefId);
    const handoffRef = dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("handoffs").doc(job.briefDigest);
    const suppressionRef = dbAdmin!.collection("email_suppressions").doc(brief.contact.email.toLowerCase());
    const [previous, ledger, source, currentBrief, handoff, suppression] = await Promise.all([
      tx.get(ref), tx.get(ledgerRef), tx.get(sourceRef), tx.get(briefRef), tx.get(handoffRef), tx.get(suppressionRef),
    ]);
    if (previous.exists) return false;
    const approval = ledger.data();
    if (!approval?.approved_by || approval.approved_by !== approval.outreach_reviewed_by
      || approval.outreach_semantic_review?.digest !== reviewCommunicationsPayload(payload).digest
      || communicationsDigest(approval.action_payload) !== communicationsDigest(payload)
      || !["operator_approved", "executing"].includes(approval.status)) throw new Error("communications_exact_human_approval_required");
    if (source.data()?.communications?.ledgerId !== ledgerId || source.data()?.stage === "closed"
      || source.data()?.contactEmail?.toLowerCase() !== payload.to || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId
      || communicationsDigest(communicationsBriefSchema.parse(currentBrief.data())) !== job.briefDigest
      || (job.intent === "outreach" && source.data()?.stage !== "drafted")) throw new Error("canonical_context_changed");
    verifyCommunicationsHandoff(handoff.data(), brief);
    if (suppression.data()?.global_suppressed || suppression.data()?.suppressed_scopes?.some((scope: string) => ["all", "growth_campaign"].includes(scope))) throw new Error("recipient_suppressed");
    tx.create(ref, { state: "attempting", jobId: job.jobId, payloadDigest: communicationsDigest(payload),
      rfcMessageId, approvalLedgerId: ledgerId, attemptedAt: new Date().toISOString() });
    return true;
  });
  if (!claimed) return reconcileCommunicationsSend(payload);
  let receipt;
  try { receipt = await sendFounderMessage(sendParameters(payload, rfcMessageId)); }
  catch {
    await ref.set({ state: "unknown", lastError: "gmail_send_acknowledgement_unknown" }, { merge: true });
    throw new Error("gmail_send_requires_reconciliation_no_resend");
  }
  return persistReceipt(payload, receipt);
}
