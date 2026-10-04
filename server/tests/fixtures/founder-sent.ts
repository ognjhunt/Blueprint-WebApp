import { createHash } from "node:crypto";
import { communicationsFixture, communicationsNow, memoryFirestore } from "./communications";
import { communicationsDigest, communicationsDeliveryKey, type VerifiedThread } from "../../agents/communications-contract";
import { COMMUNICATIONS_ROOT } from "../../agents/communications-store";
import { appendFirstContactFooter } from "../../agents/communications-first-contact-footer";
import { reviewCommunicationsPayload } from "../../agents/communications-review";
import type { FounderSentThreadMessage } from "../../agents/communications-founder-sent-observer";

/** Synthetic, non-deliverable values only: no real mailbox, draft or person. */
export const FOUNDER_DIRECTION_URI = "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/founder-sent-draft-observation-owner-direction.json";
export function founderDirectionFixture(now = communicationsNow): any {
  return { version: "blueprint.communications-founder-sent-observation-direction.v1", owner: "Nijel Hunt",
    approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 7 * 86400000).toISOString(),
    direction: { kind: "founder-sent-draft-observation",
      text: "Synthetic fixture: reply learning may read founder-sent drafts; sending and automatic first contact stay off.",
      sourceRef: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/owner-direction-source.json" },
    binding: { mailbox: "nijel@tryblueprint.io", readScope: "https://www.googleapis.com/auth/gmail.readonly" },
    scope: { readOnly: true, observeFounderSentDrafts: true, replyIntakeAuthorized: true, sendsAuthorized: false,
      automaticFirstContactAuthorized: false, approvalsAuthorized: false, newInferenceAuthorized: false, accessChangesAuthorized: false } };
}
export function founderDirectionRef(raw: string, generation = "1") {
  return { uri: FOUNDER_DIRECTION_URI, generation, sha256: createHash("sha256").update(raw).digest("hex") };
}

/** One pending human-review outreach draft whose Gmail copy was verified. */
export function founderDraftFixture(db = memoryFirestore()) {
  const f = communicationsFixture(), root = COMMUNICATIONS_ROOT, ledgerId = `communications_${f.job.jobId}`;
  const payload: any = { type: "send_email", from: "nijel@tryblueprint.io", replyTo: "nijel@tryblueprint.io",
    to: f.brief.contact.email.toLowerCase(), emailTransport: "founder_gmail", subject: f.output.subject, body: f.output.body,
    transportBody: appendFirstContactFooter(f.output.body, f.brief.contact.email), commercialEmail: true,
    emailSuppressionScope: "growth_campaign", outreachContext: f.brief.outreachContext, outreachContract: f.output.outreachContract,
    communications: { version: "blueprint.communications.v1", job: f.job, brief: f.brief, thread: null, output: f.output, approvalState: "pending_approval" } };
  const reviewDigest = reviewCommunicationsPayload(payload, communicationsNow).digest!;
  const verifiedAt = communicationsNow - 3 * 3600000, sentAt = verifiedAt + 3600000, threadId = "founder-thread-1";
  const content = { jobId: f.job.jobId, reviewDigest, payloadDigest: communicationsDigest(payload), to: payload.to,
    subject: payload.subject, body: payload.transportBody, messageId: `<blueprint-draft-${f.job.jobId}@tryblueprint.io>`,
    mimeProfile: "multipart-alternative-v1" };
  const binding = { version: "blueprint.communications-gmail-draft-binding.v1", jobId: f.job.jobId, ledgerId, prospectId: f.job.prospectId,
    state: "verified", attemptId: "synthetic-attempt-1", content, deliveryKey: communicationsDeliveryKey(f.job), revisionId: null,
    requestedBy: "Nijel Hunt (retained recurring copy direction)", claimedAt: verifiedAt - 2000, draftId: "r-synthetic-draft-1",
    confirmedContent: null, confirmedReceipt: null, sent: false, approved: false, providerAcceptedAt: verifiedAt - 1000, providerWriteSubmitted: true,
    receipt: { draftId: "r-synthetic-draft-1", messageId: "synthetic-draft-message-1", threadId,
      authoredRfcMessageId: content.messageId, observedRfcMessageId: "<synthetic-rewritten-draft@mail.gmail.example>" },
    verifiedAt };
  db.records.set(`action_ledger/${ledgerId}`, { status: "pending_approval", action_type: "send_email", action_tier: 3, lane: "outbound_prospect",
    source_collection: "outboundProspects", source_doc_id: f.job.prospectId, idempotency_key: `communications:${f.job.jobId}`,
    action_payload: payload, draft_output: f.output, approved_by: null, approved_at: null, sent_at: null, execution_attempts: 0,
    last_execution_at: null, draft_revision_id: null, created_at: new Date(verifiedAt - 3600000) });
  db.records.set(`${root}/jobs/${f.job.jobId}`, { ...f.job, state: "pending_approval", attempts: 1, ledgerId, output: f.output, reviewDigest,
    checkpoint: { createClaimedAt: "2026-09-30T19:00:00Z", sessionId: "synthetic-session", turnId: "synthetic-turn" } });
  db.records.set(`${root}/briefs/${f.brief.briefId}`, f.brief);
  db.records.set(`${root}/handoffs/${f.job.briefDigest}`, f.handoff);
  db.records.set(`${root}/gmailDraftBindings/${f.job.jobId}`, binding);
  db.records.set(`outboundProspects/${f.job.prospectId}`, { contactEmail: f.brief.contact.email, siteId: f.brief.siteId, taskId: f.brief.taskId,
    caseId: f.brief.caseId, stage: "drafted", communications: { jobId: f.job.jobId, ledgerId, briefDigest: f.job.briefDigest, state: "pending_approval" } });
  const sentMessage: FounderSentThreadMessage = { gmailMessageId: "founder-sent-1", threadId, labelIds: ["SENT"], internalDate: sentAt,
    from: ["nijel@tryblueprint.io"], to: [payload.to], cc: [], bcc: [], rfcMessageIds: ["<founder-sent-1@mail.gmail.example>"],
    subject: payload.subject, body: payload.transportBody, blueprintJobIds: [f.job.jobId] };
  /** The reply-intake view of the same thread, as readFounderThread returns it. */
  const verifiedThread = (body = "I would like to understand packing options.", outgoingBody = payload.transportBody): VerifiedThread => ({
    mailbox: "nijel@tryblueprint.io", threadId, fetchedAt: "2026-09-30T22:59:00Z", messages: [
      { gmailMessageId: sentMessage.gmailMessageId, rfcMessageId: sentMessage.rfcMessageIds[0], gmailThreadId: threadId,
        from: "nijel@tryblueprint.io", to: [payload.to], subject: payload.subject, body: outgoingBody,
        receivedAt: new Date(sentAt).toISOString(), inReplyTo: null, references: [] },
      { gmailMessageId: "founder-reply-in-1", rfcMessageId: "<founder-reply-in-1@facility.example>", gmailThreadId: threadId,
        from: payload.to, to: ["nijel@tryblueprint.io"], subject: "Re: Packing", body, receivedAt: "2026-09-30T22:30:00Z",
        inReplyTo: sentMessage.rfcMessageIds[0], references: [sentMessage.rfcMessageIds[0]] },
    ] });
  return { ...f, db, root, ledgerId, payload, reviewDigest, binding, verifiedAt, sentAt, threadId, sentMessage, verifiedThread };
}

/** Additional verified copies used only to exercise bounded paging. */
export function extraVerifiedBinding(index: number) {
  const jobId = createHash("sha256").update(`synthetic-job-${index}`).digest("hex");
  return { jobId, binding: { version: "blueprint.communications-gmail-draft-binding.v1", jobId, ledgerId: `communications_${jobId}`,
    prospectId: `synthetic-prospect-${index}`, state: "verified", deliveryKey: createHash("sha256").update(`synthetic-delivery-${index}`).digest("hex"),
    draftId: `r-synthetic-draft-${index}`, revisionId: null, verifiedAt: communicationsNow - 3600000,
    content: { jobId, reviewDigest: "a".repeat(64), payloadDigest: "b".repeat(64), to: `synthetic-${index}@facility.example`, subject: "Synthetic", body: "Synthetic body" },
    receipt: { draftId: `r-synthetic-draft-${index}`, messageId: `synthetic-draft-message-${index}`, threadId: `synthetic-thread-${index}` } } };
}
