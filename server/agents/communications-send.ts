import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { isEmailSuppressed } from "../utils/email-suppression";
import { communicationsEnvelopeSchema, communicationsBriefSchema, verifyCommunicationsHandoff, communicationsDigest, communicationsDeliveryKey, correlateReply, correlatedReplies, isOptOut,
  verifyCommunicationsReplyBinding, communicationsSentReceiptIdentity } from "./communications-contract";
import { COMMUNICATIONS_ROOT, CommunicationsStore } from "./communications-store";
import { readExistingResearchSnapshot, verifyPublishedResearch } from "./communications-research";
import { verifyFounderMailbox, readFounderThread, findFounderSentMessage, sendFounderMessage, hasFounderPriorContact } from "./communications-gmail";
import { reviewCommunicationsPayload } from "./communications-review";
import type { ActionPayload } from "./action-policies";
import { requireFounderSendCapability } from "./communications-oauth-store";
import { automaticFirstContactEnabled, firstContactDailyLimit, firstContactRecipientKey, firstContactCalendarDay, FIRST_CONTACT_POLICY,
  verifyFirstContactAuthority, verifyFirstContactSource } from "./communications-first-contact";

function exactHumanAuthority(ledger: any, payload: ActionPayload) {
  return !!ledger?.approved_by && ledger.approved_by === ledger.outreach_reviewed_by
    && ledger.outreach_semantic_review?.digest === reviewCommunicationsPayload(payload).digest;
}
async function storedAutomaticAuthority(ledger: any, payload: ActionPayload, historical = false) {
  const authority = verifyFirstContactAuthority(ledger?.first_contact_authority, payload, Date.now(), historical);
  const digest = communicationsDigest(authority);
  const saved = await dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("firstContactAuthorities").doc(digest).get();
  if (ledger.first_contact_authority_digest !== digest || !saved.exists || communicationsDigest(saved.data()) !== digest) {
    throw new Error("first_contact_authority_missing_or_changed");
  }
  return { authority, digest };
}

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
    verifyPublishedResearch(await readExistingResearchSnapshot(dbAdmin, brief.researchOrigin.date, brief.researchOrigin.admissionId), brief, await store.handoff(brief), await store.contactProof(brief));
    const ledger = (await dbAdmin.collection("action_ledger").doc(ledgerId).get()).data();
    if (ledger?.first_contact_authority && !exactHumanAuthority(ledger, payload)) {
      if (!automaticFirstContactEnabled()) return "automatic_first_contact_disabled";
      if (!firstContactDailyLimit()) return "first_contact_daily_limit_not_configured";
      await storedAutomaticAuthority(ledger, payload);
      const provenance = (await dbAdmin.doc(COMMUNICATIONS_ROOT).collection("researchSources").doc(job.briefDigest).get()).data();
      verifyFirstContactSource(provenance, brief, await store.contactProof(brief), payload.recipientGeography);
      if (source.data()?.researchPublicationId !== provenance?.source?.sheetsProspectId) return "first_contact_source_missing_or_changed";
      // Bounded SENT metadata lookup covers prior founder mail outside CRM,
      // including historic casing. It never retrieves unrelated mail bodies.
      if (job.intent === "outreach" && await hasFounderPriorContact(brief.contact.email)) return "recipient_previously_contacted";
    }
    if (await isEmailSuppressed(brief.contact.email, "growth_campaign")) return "recipient_suppressed";
    await requireFounderSendCapability();
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
  if (record.firstContactAuthorityDigest) {
    const { digest } = await storedAutomaticAuthority(ledger, payload, true);
    if (digest !== record.firstContactAuthorityDigest) throw new Error("send_original_approval_missing_or_changed");
  } else if (!exactHumanAuthority(ledger, payload)) throw new Error("send_original_approval_missing_or_changed");
  if (record.state === "sent") return record.receipt;
  const found = await findFounderSentMessage(record.rfcMessageId, sendParameters(payload, record.rfcMessageId));
  if (!found?.id || !found.threadId) throw new Error("gmail_send_requires_reconciliation_no_resend");
  return persistReceipt(payload, { messageId: found.id, threadId: found.threadId, rfcMessageId: record.rfcMessageId });
}

/** Exact human approval or the existing immutable owner-activated policy. */
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
    const recipientRef = dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("recipientFirstTouches").doc(firstContactRecipientKey(brief.contact.email));
    const [previous, ledger, source, currentBrief, handoff, suppression] = await Promise.all([
      tx.get(ref), tx.get(ledgerRef), tx.get(sourceRef), tx.get(briefRef), tx.get(handoffRef), tx.get(suppressionRef),
    ]);
    if (previous.exists) return false;
    const approval = ledger.data();
    if (!approval) throw new Error("communications_exact_human_approval_required");
    let authorityDigest: string | null = null;
    if (!exactHumanAuthority(approval, payload)) {
      if (!automaticFirstContactEnabled() || !approval?.first_contact_authority) throw new Error("communications_exact_human_approval_required");
      const authority = verifyFirstContactAuthority(approval.first_contact_authority, payload, Date.now());
      authorityDigest = communicationsDigest(authority);
      const root = dbAdmin!.doc(COMMUNICATIONS_ROOT);
      const savedAuthority = (await tx.get(root.collection("firstContactAuthorities").doc(authorityDigest))).data();
      const provenance = (await tx.get(root.collection("researchSources").doc(job.briefDigest))).data();
      const contactProof = brief.researchOrigin.contactEvidenceKind === "public_operator_resolution"
        ? (await tx.get(root.collection("contactProofs").doc(brief.researchOrigin.contactEvidenceDigest!))).data() : undefined;
      if (approval.first_contact_authority_digest !== authorityDigest || communicationsDigest(savedAuthority ?? null) !== authorityDigest) throw new Error("first_contact_authority_missing_or_changed");
      if (job.intent === "reply") {
        if (!brief.replyOrigin) throw new Error("reply_parent_context_changed");
        const parent = communicationsBriefSchema.parse((await tx.get(root.collection("briefs").doc(brief.replyOrigin.parentBriefId))).data());
        const binding = verifyCommunicationsReplyBinding((await tx.get(root.collection("replyBindings").doc(job.briefDigest))).data(), brief, parent);
        const receipt = (await tx.get(root.collection("sendReceipts").doc(binding.sendReceiptKey))).data();
        if (communicationsDigest(communicationsSentReceiptIdentity(receipt)) !== binding.sendReceiptDigest
          || receipt?.approvalLedgerId !== binding.approvalLedgerId
          || receipt?.receipt?.threadId !== brief.priorConversation?.gmailThreadId) throw new Error("reply_parent_receipt_or_handoff_changed");
      }
      verifyFirstContactSource(provenance, brief, contactProof, payload.recipientGeography);
      if (source.data()?.researchPublicationId !== provenance?.source?.sheetsProspectId) throw new Error("first_contact_source_missing_or_changed");
    }
    if (communicationsDigest(approval?.action_payload) !== communicationsDigest(payload)
      || !["operator_approved", "auto_approved", "executing", "failed"].includes(approval?.status)
      || (["auto_approved", "failed"].includes(approval.status) && !authorityDigest)) throw new Error("communications_exact_human_approval_required");
    if (source.data()?.communications?.ledgerId !== ledgerId || source.data()?.stage === "closed"
      || source.data()?.contactEmail?.toLowerCase() !== payload.to || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId
      || communicationsDigest(communicationsBriefSchema.parse(currentBrief.data())) !== job.briefDigest
      || (job.intent === "outreach" && source.data()?.stage !== "drafted")) throw new Error("canonical_context_changed");
    verifyCommunicationsHandoff(handoff.data(), brief);
    if (suppression.data()?.global_suppressed || suppression.data()?.suppressed_scopes?.some((scope: string) => ["all", "growth_campaign"].includes(scope))) throw new Error("recipient_suppressed");
    let recipient: FirebaseFirestore.DocumentSnapshot | null = null;
    if (job.intent === "outreach") {
      recipient = await tx.get(recipientRef);
      if (recipient.exists) throw new Error("recipient_first_contact_already_attempted");
      const duplicates = await tx.get(dbAdmin!.collection("outboundProspects").where("contactEmail", "==", brief.contact.email.toLowerCase()).limit(101));
      if (duplicates.size > 100 || duplicates.docs.some(doc => doc.id !== job.prospectId
        && (doc.data().stage !== "drafted" || doc.data().contactedAtIso || doc.data().communications?.receipt))) throw new Error("recipient_first_contact_already_attempted");
    }
    const day = firstContactCalendarDay();
    const dailyRef = dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("firstContactDailyUsage").doc(day);
    const daily = authorityDigest ? (await tx.get(dailyRef)).data() : null;
    const dailyLimit = firstContactDailyLimit();
    if (authorityDigest && (!dailyLimit || !Number.isSafeInteger(daily?.attempts ?? 0)
      || (daily?.attempts ?? 0) < 0 || (daily?.attempts ?? 0) >= dailyLimit)) throw new Error("first_contact_daily_cap_reached");
    tx.create(ref, { state: "attempting", jobId: job.jobId, payloadDigest: communicationsDigest(payload),
      ...(authorityDigest ? { firstContactAuthorityDigest: authorityDigest } : {}),
      rfcMessageId, approvalLedgerId: ledgerId, attemptedAt: new Date().toISOString() });
    if (authorityDigest) tx.update(ledgerRef, { status: "executing", updated_at: new Date() });
    if (job.intent === "outreach") tx.create(recipientRef, { jobId: job.jobId, prospectId: job.prospectId,
      receiptKey: deliveryKey, contactEmail: brief.contact.email.toLowerCase(), payloadDigest: communicationsDigest(payload),
      ...(authorityDigest ? { firstContactAuthorityDigest: authorityDigest } : {}), attemptedAt: new Date().toISOString() });
    if (authorityDigest) tx.set(dailyRef, { day, timezone: FIRST_CONTACT_POLICY.dailyTimezone,
      attempts: (daily?.attempts ?? 0) + 1, limitAtLastReservation: dailyLimit, updatedAt: new Date().toISOString() });
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

/** Private worker path; never upgrades another lane or existing operator decision.
 * Recovery may observe an existing receipt even when new-send flags are off. */
export async function executeAutomaticFirstContact(ledgerId: string): Promise<{ state: "sent" | "auto_approved" | "failed"; reason?: string }> {
  if (!dbAdmin) return { state: "auto_approved", reason: "communications_store_unavailable" };
  const ref = dbAdmin.collection("action_ledger").doc(ledgerId);
  const data = (await ref.get()).data();
  const payload = data?.action_payload as ActionPayload;
  const envelope = communicationsEnvelopeSchema.safeParse(payload?.communications);
  if (!envelope.success || ledgerId !== `communications_${envelope.data.job.jobId}`
    || data?.lane !== "outbound_prospect" || data?.source_collection !== "outboundProspects"
    || data?.source_doc_id !== envelope.data.job.prospectId || data?.action_type !== "send_email"
    || !data?.first_contact_authority || !["auto_approved", "executing", "failed", "sent"].includes(data.status)) {
    return { state: "failed", reason: "first_contact_authority_missing_or_changed" };
  }
  try {
    await storedAutomaticAuthority(data, payload, true);
    const recovered = await reconcileCommunicationsSend(payload);
    if (!recovered) {
      const blocker = await communicationsSendBlocker(payload, ledgerId);
      if (blocker) return { state: "auto_approved", reason: blocker };
      // The durable receipt reservation is the only execution claim. Ledger
      // executing is committed in that same transaction, so a restart before
      // reservation can resume; any attempted/unknown receipt forbids reposting.
      await executeCommunicationsSend(payload);
    }
    await ref.update({ status: "sent", sent_at: new Date(), last_execution_at: new Date(), updated_at: new Date() });
    return { state: "sent" };
  } catch (error) {
    const reason = error instanceof Error && /^[a-z_][a-z0-9_]*$/.test(error.message) ? error.message : "first_contact_execution_requires_review";
    const resumable = ["first_contact_daily_cap_reached", "gmail_send_requires_reconciliation_no_resend"].includes(reason);
    const job = envelope.data.job;
    const alreadySent = await dbAdmin.runTransaction(async tx => {
      const receipt = (await tx.get(dbAdmin!.doc(COMMUNICATIONS_ROOT).collection("sendReceipts").doc(communicationsDeliveryKey(job)))).data();
      if (receipt?.state === "sent") { tx.update(ref, { status: "sent", updated_at: new Date() }); return true; }
      tx.update(ref, { status: resumable && reason === "first_contact_daily_cap_reached" ? "auto_approved" : "failed",
        last_execution_error: reason, updated_at: new Date() });
      return false;
    });
    if (alreadySent) return { state: "sent" };
    return { state: resumable ? "auto_approved" : "failed", reason };
  }
}
