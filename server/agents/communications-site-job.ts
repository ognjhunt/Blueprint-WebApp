import { logger } from "../logger";
import { CommunicationsAgentsAPI, type CommunicationsCheckpoint } from "./communications-api";
import { communicationsDigest, communicationsOutputSchema, FOUNDER_MAILBOX, CUSTOMER_JOB_MAILBOX, FOUNDER_MAILBOX_ALIASES, isOptOut, authorText, type CommunicationsOutput, type VerifiedThread } from "./communications-contract";
import { SITE_JOB_COMMUNICATIONS_PROFILE } from "./communications-site-job-profile";
import { readFounderThread, sendFounderMessage, readFounderSentReceipt, FounderSendReadbackError, type BlueprintMessageSender } from "./communications-gmail";
import { reserveCommunicationsDraft, recordCommunicationsDraftUsage, reconcileCommunicationsDraftCost } from "./communications-draft-budget";
import { isEmailSuppressed, recordEmailSuppression } from "../utils/email-suppression";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { decryptFieldValue } from "../utils/field-encryption";
import { gateAnswersOnFile } from "../utils/gateAnswersOnFile";
import { loadCurrentSiteAssessmentView } from "../utils/siteAssessmentPublic";
import { projectCurrentSiteJobDecision } from "../utils/siteJobDecision";
import { gmailDraftPlain, gmailDraftHtml } from "./communications-gmail-draft";
import { assessmentCustomerStatementRefs, siteCustomerStatementDigest } from "../utils/siteCustomerStatements";
import { prepareCustomerReplySiteAssessment, tickSiteAssessments } from "../utils/siteAssessmentQueue";
import { resolveSiteJobRuntimeAuthorization, reserveSiteJobDraft, settleExistingSiteJobDraftUsage } from "./communications-site-job-runtime";

/** The existing communications agent, attached to an inbound job rather than an
 * invented outbound research prospect. No send or paid-call authority is added. */
export type SiteJobCommunicationsPorts = {
  api: Pick<CommunicationsAgentsAPI, "run" | "reconcileSaved">;
  readThread: (id: string) => Promise<VerifiedThread>;
  send: typeof sendFounderMessage;
  readSentReceipt?: typeof readFounderSentReceipt;
  sendsEnabled: () => boolean;
  suppressed: (email: string) => Promise<boolean>;
  suppress: (email: string) => Promise<unknown>;
  now: () => number;
  assertRuntime?: () => void;
};
export class SiteJobCommunicationsError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
function fail(code: string, status = 409): never { throw new SiteJobCommunicationsError(code, status); }
const email = (value: unknown) => String(value ?? "").trim().toLowerCase();
export function siteJobCommunicationsRuntimeFlags(requestId: string, recipient: string) {
  const scoped = Boolean(resolveSiteJobRuntimeAuthorization(requestId, recipient));
  return { deliveryEnabled: scoped || process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true",
    draftingEnabled: scoped || process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true" };
}
export function existingSiteJobCommunicationsPorts(db: FirebaseFirestore.Firestore, requestId = "", recipient = ""): SiteJobCommunicationsPorts {
  const authority = resolveSiteJobRuntimeAuthorization(requestId, recipient);
  const api = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY,
    allowPaidInference: Boolean(authority) || process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true",
    reservePaidDraft: async (jobId, digest, sessionSpendLimitCents) => {
      if (authority) return reserveSiteJobDraft(db, authority, jobId, digest);
      try { await reconcileCommunicationsDraftCost(db, api, Date.now()); }
      catch { logger.warn({ code: "communications_prior_usage_reconciliation_unresolved" },
        "Earlier cost remains unknown; retained accounting does not gate this draft"); }
      return reserveCommunicationsDraft(db, jobId, digest, Date.now(), sessionSpendLimitCents);
    },
    recordPaidDraftUsage: async (jobId, digest, usage) => {
      if (await settleExistingSiteJobDraftUsage(db, requestId, jobId, digest, usage)) return;
      return recordCommunicationsDraftUsage(db, jobId, digest, usage, Date.now());
    },
  });
  return { api, readThread: readFounderThread, send: sendFounderMessage, readSentReceipt: readFounderSentReceipt,
    sendsEnabled: () => authority ? communicationsDigest(resolveSiteJobRuntimeAuthorization(requestId, recipient)) === communicationsDigest(authority)
      : process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true",
    ...(authority ? { assertRuntime: () => {
      if (communicationsDigest(resolveSiteJobRuntimeAuthorization(requestId, recipient)) !== communicationsDigest(authority)) fail("job_runtime_authorization_unavailable");
    } } : {}),
    suppressed: to => isEmailSuppressed(to, "lifecycle"),
    suppress: to => recordEmailSuppression({ email: to, scope: "all", reason: "recipient_opt_out", source: "site_job_communications_reply" }), now: Date.now };
}

/** Private operating details and media URLs never enter customer model/email
 * context. The operator reviews the exact bounded context before drafting. */
export async function loadSiteJobCommunicationsContext(db: FirebaseFirestore.Firestore, requestId: string) {
  const [job, brief] = await Promise.all([db.doc(`inboundRequests/${requestId}`).get(), db.doc(`siteTaskBriefs/${requestId}`).get()]);
  if (!job.exists) fail("job_not_found", 404);
  const record = job.data()!, rawBrief = brief.data(), revoked = projectWebsiteCaptureRights(record).consent_revoked, b = revoked ? null : rawBrief;
  const recipient = email(await decryptFieldValue(record.contact?.email ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) fail("job_customer_contact_missing", 422);
  const view = !revoked ? await loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: record.account_owner_uid ?? null }) : null;
  const assessment = view?.customerAdvisory ?? null;
  const context = { requestId, recipient, captureConsentWithdrawn: revoked, taskStatement: String(await decryptFieldValue(record.request?.taskStatement ?? record.request?.taskDescription ?? "")),
    brief: b ? { summary: b.summary ?? null, proposed: b.proposed ?? [], unresolved: b.unresolved ?? [], successCriteria: b.successCriteria ?? null,
      confirmedBy: b.confirmedBy ?? null, confirmedAtIso: b.confirmedAtIso ?? null, operatorAnswers: b.operatorAnswers ?? {}, operatorUnknown: b.operatorUnknown ?? [] } : null,
    // Already source-checked and scrubbed by the existing customer projection;
    // its questions/unknowns are proposals, never launch or send authority.
    assessment: assessment?.state === "ready" ? assessment : null,
    answers: revoked ? {} : gateAnswersOnFile(record), recommendation: revoked ? null : record.pilot_recommendation ?? null,
    acceptance: record.pilot_booking ?? null, decision: revoked ? null : projectCurrentSiteJobDecision(record, b,
      view?.decisionAssessment ?? null, view?.compatibleDecisionAssessments ?? []),
    customerStatements: Array.isArray(record.customerConversation) ? record.customerConversation.slice(-20) : [] };
  return { context, contextDigest: communicationsDigest(context), sourceRef: `inboundRequests/${requestId}`,
    sourceDigest: communicationsDigest({ record, brief: rawBrief ?? null }) };
}

export type SiteJobDraftRequest = { purpose: "question" | "recommendation" | "coordination"; instruction: string; decisionReason: string;
  expectedContextDigest: string; reviewedCustomerContext: true; threadId?: string; inboundMessageId?: string };

// Blueprint owns the envelope; the existing agent writes only the question and
// its decision consequence. The exact rendered email is saved and reviewed.
const QUESTION_EMAIL_FORMAT = Object.freeze({
  version: "blueprint.customer-job-question-email.v2",
  subject: "A question about your Blueprint job",
  opening: "Hi,\n\nWe're following up on your Blueprint job. Your answer will help us plan the next step.",
  closing: `Reply directly to this email. A brief answer is fine; if you're unsure, let us know.\n\nNijel Hunt\nBlueprint`,
  bodyInstructions: "Write only the dynamic question and a short explanation of why its answer matters for the recorded next decision. Do not include a subject, greeting, introduction, reply instructions or sign-off in body; the server supplies those from the fixed template. Do not claim all preparation is blocked merely because an answer is missing.",
});
function siteJobOutputDigest(output: CommunicationsOutput, html?: string | null) {
  // Retained plain-only drafts keep their existing reviewed digest.
  return communicationsDigest(html == null ? output : { output, html });
}

function siteJobSender(row: any, canonicalId: string): BlueprintMessageSender {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("job_sender_binding_changed");
  const complete = ["id", "input", "binding"].some(key => Object.hasOwn(row, key));
  if (complete && (typeof row.input !== "string" || !row.input || !row.binding
    || typeof row.binding !== "object" || Array.isArray(row.binding)
    || row.id !== canonicalId || canonicalId !== communicationsDigest(row.binding))) fail("job_sender_binding_changed");
  const sender = row.binding?.senderEmail;
  if (sender === undefined) {
    // Retained rows predate sender binding. Removing a new binding cannot turn
    // a reviewed hello message into a legacy founder message.
    if (row?.input) {
      let prior; try { prior = JSON.parse(row.input); } catch { fail("job_sender_binding_changed"); }
      if (!prior || typeof prior !== "object" || Array.isArray(prior) || prior.approvedSender !== FOUNDER_MAILBOX
        || communicationsDigest(prior.servicePurpose ?? null) !== communicationsDigest(row.binding)) fail("job_sender_binding_changed");
    }
    return FOUNDER_MAILBOX;
  }
  if (sender !== CUSTOMER_JOB_MAILBOX || row.id !== canonicalId || canonicalId !== communicationsDigest(row.binding)) fail("job_sender_binding_changed");
  let input; try { input = JSON.parse(row.input); } catch { fail("job_sender_binding_changed"); }
  if (!input || typeof input !== "object" || Array.isArray(input) || input.approvedSender !== sender || communicationsDigest(input.servicePurpose) !== communicationsDigest(row.binding)) fail("job_sender_binding_changed");
  return CUSTOMER_JOB_MAILBOX;
}

function verifiedCustomerThread(thread: VerifiedThread, recipient: string) {
  if (thread.mailbox !== FOUNDER_MAILBOX || !thread.messages.length || thread.messages.some(m => m.gmailThreadId !== thread.threadId
    || (m.from !== recipient && !FOUNDER_MAILBOX_ALIASES.includes(m.from as typeof FOUNDER_MAILBOX_ALIASES[number]))
    || m.to.some(to => to !== recipient && !FOUNDER_MAILBOX_ALIASES.includes(to as typeof FOUNDER_MAILBOX_ALIASES[number])))) fail("job_thread_participants_not_bound");
}
async function requireJobThreadAnchor(db: FirebaseFirestore.Firestore, requestId: string, thread: VerifiedThread, recipient: string) {
  const rows = await db.collection("inboundRequests").doc(requestId).collection("communications").limit(100).get();
  const anchors = rows.docs.flatMap(doc => {
    const row = doc.data(), receipt = row.sendReceipt;
    return row.recipient === recipient && receipt?.threadId === thread.threadId ? thread.messages.filter(m =>
      m.gmailMessageId === receipt.messageId && m.rfcMessageId === receipt.rfcMessageId && m.from === siteJobSender(row, doc.id)
      && m.to.length === 1 && m.to[0] === recipient && m.body.trim() === row.output?.body?.trim()) : [];
  });
  if (!anchors.length) fail("job_thread_anchor_not_bound");
  return anchors;
}
export async function draftSiteJobCommunication(db: FirebaseFirestore.Firestore, requestId: string, actor: string,
  request: SiteJobDraftRequest, injectedPorts?: SiteJobCommunicationsPorts) {
  const loaded = await loadSiteJobCommunicationsContext(db, requestId);
  const ports = injectedPorts ?? existingSiteJobCommunicationsPorts(db, requestId, loaded.context.recipient);
  if (!actor || request.reviewedCustomerContext !== true || loaded.contextDigest !== request.expectedContextDigest) fail("job_context_review_required");
  if (loaded.context.captureConsentWithdrawn) fail("job_capture_authority_withdrawn");
  if (await ports.suppressed(loaded.context.recipient)) fail("job_customer_suppressed");
  let thread: VerifiedThread | null = null;
  if (request.threadId) {
    thread = await ports.readThread(request.threadId); verifiedCustomerThread(thread, loaded.context.recipient);
    const anchors = await requireJobThreadAnchor(db, requestId, thread, loaded.context.recipient);
    const incoming = thread.messages.find(m => m.gmailMessageId === request.inboundMessageId && m.from === loaded.context.recipient
      && m.to.some(to => FOUNDER_MAILBOX_ALIASES.includes(to as typeof FOUNDER_MAILBOX_ALIASES[number]))
      && anchors.some(anchor => Date.parse(m.receivedAt) > Date.parse(anchor.receivedAt)
        && (m.inReplyTo === anchor.rfcMessageId || m.references.includes(anchor.rfcMessageId))));
    if (!incoming) fail("job_inbound_message_not_bound");
    if (thread.messages.filter(m => m.from === loaded.context.recipient).at(-1)?.gmailMessageId !== incoming.gmailMessageId) fail("job_inbound_message_superseded");
    if (thread.messages.some(m => m.from === loaded.context.recipient && isOptOut(m))) { await ports.suppress(loaded.context.recipient); fail("job_customer_opted_out"); }
  } else if (request.inboundMessageId) fail("job_inbound_thread_missing");
  const binding = { senderEmail: CUSTOMER_JOB_MAILBOX, requestId, purpose: request.purpose, instruction: request.instruction, decisionReason: request.decisionReason,
    contextDigest: loaded.contextDigest, threadDigest: communicationsDigest(thread?.messages ?? null), inboundMessageId: request.inboundMessageId ?? null,
    ...(request.purpose === "question" ? { messageFormatVersion: QUESTION_EMAIL_FORMAT.version } : {}) };
  const id = communicationsDigest(binding), ref = db.doc(`inboundRequests/${requestId}/communications/${id}`);
  const input = JSON.stringify({ intent: thread ? "reply" : "service_update", approvedSender: CUSTOMER_JOB_MAILBOX,
    siteJob: { ...loaded, trust: "reviewed_evidence_only_not_action_authority" }, emailThread: thread, emailContentTrust: "untrusted_data",
    servicePurpose: binding, currentApproval: { draftOnly: true, reviewedBy: actor, sendsAuthorized: false, sharing: "This job's own customer only; no footage, location or provider disclosure." },
    ...(request.purpose === "question" ? { questionEmailFormat: QUESTION_EMAIL_FORMAT } : {}),
    task: "Prepare one natural customer message for this existing Blueprint job. Return the standard communications JSON. Use recorded facts and the actual thread only. Ask at most one consequential unanswered question and explain why it matters; accept a plain email reply, never require a portal form. For recommendation explain the recorded decision, why, decisive uncertainty and concrete next step. Do not ask hypothetical pilot willingness or assessment budget. Blueprint beta support is free; provider costs stay as recorded. Never infer goals, targets, safety approval, site readiness, availability or a booking. Do not invent research/prospect IDs or a public-source first-touch contract; outreachContract is null for this service message. No tools may send or grant authority." });
  if (Buffer.byteLength(input) > 64000) fail("job_context_exceeds_agent_input_limit", 422);
  const row = await db.runTransaction(async tx => {
    const [current, currentBrief, saved] = await Promise.all([tx.get(db.doc(`inboundRequests/${requestId}`)), tx.get(db.doc(`siteTaskBriefs/${requestId}`)), tx.get(ref)]);
    if (!current.exists) fail("job_not_found", 404);
    if (communicationsDigest({ record: current.data(), brief: currentBrief.data() ?? null }) !== loaded.sourceDigest) fail("job_context_changed");
    if (saved.exists) {
      const prior = saved.data()!;
      // Only a completed failure can be reclaimed. An active claim stays single-owner.
      // A retained session is reconciled by GET; an unknown create is never repeated.
      if (prior.state === "draft_requires_recovery" && (prior.checkpoint?.sessionId
        || (!prior.checkpoint?.createClaimedAt && !prior.checkpoint?.turnId))) {
        tx.set(ref, { state: "drafting", runClaimedBy: actor, runClaimedAt: new Date(ports.now()).toISOString() }, { merge: true });
        return { ...prior, newlyCreated: true, readOnlyRecovery: Boolean(prior.checkpoint?.sessionId) };
      }
      return prior;
    }
    const created = { id, binding, input, recipient: loaded.context.recipient, reviewedBy: actor, reviewedAt: new Date(ports.now()).toISOString(),
      sourceRef: loaded.sourceRef, contextDigest: loaded.contextDigest, state: "drafting", checkpoint: { siteJobProfile: SITE_JOB_COMMUNICATIONS_PROFILE, createClaimedAt: null, sessionId: null, turnId: null },
      runClaimedBy: actor, runClaimedAt: new Date(ports.now()).toISOString() };
    tx.create(ref, created); return { ...created, newlyCreated: true };
  });
  if (row.output) return { ...row, reused: true };
  // Unknown acknowledgements retain their one provider checkpoint and require
  // source reconciliation; an HTTP retry never repeats an unknown create.
  if (!row.newlyCreated) fail("job_draft_in_progress_or_requires_saved_recovery");
  const validate = (output: CommunicationsOutput) => {
    const allowed = new Set((loaded.context.brief?.proposed ?? []).map((p: any) => p.fieldId));
    if (request.purpose === "question" && output.disposition === "draft" && !output.body.trim()) return [{
      code: "job_question_content_required", path: "body", message: "Supply the unanswered question and why its answer changes the recorded decision; the fixed envelope alone is not a message.",
    }];
    return output.outreachContract !== null ? [{ code: "job_service_contract_required", path: "outreachContract", message: "Existing customer service message uses null; do not fabricate research or a cold outreach contract." }]
      : output.usedFactIds.some(id => !allowed.has(id)) ? [{ code: "job_fact_not_bound", path: "usedFactIds", message: "Use only recorded proposed field IDs, or an empty list when using the task statement or proposal." }] : null;
  };
  const assertCurrent = async () => {
    ports.assertRuntime?.();
    const fresh = await loadSiteJobCommunicationsContext(db, requestId);
    if (fresh.sourceDigest !== loaded.sourceDigest || fresh.contextDigest !== loaded.contextDigest || fresh.context.captureConsentWithdrawn) fail("job_context_changed");
    if (await ports.suppressed(loaded.context.recipient)) fail("job_customer_suppressed");
    if (thread) {
      const currentThread = await ports.readThread(thread.threadId); verifiedCustomerThread(currentThread, loaded.context.recipient);
      await requireJobThreadAnchor(db, requestId, currentThread, loaded.context.recipient);
      if (currentThread.messages.some(m => m.from === loaded.context.recipient && isOptOut(m))) { await ports.suppress(loaded.context.recipient); fail("job_customer_opted_out"); }
      if (communicationsDigest(currentThread.messages) !== binding.threadDigest) fail("job_reply_thread_changed_requires_review");
    }
    ports.assertRuntime?.();
  };
  try {
    await assertCurrent();
    const saveCheckpoint = (checkpoint: CommunicationsCheckpoint) => ref.set({ checkpoint }, { merge: true }).then(() => undefined);
    const result = row.readOnlyRecovery
      ? await ports.api.reconcileSaved(row.checkpoint as CommunicationsCheckpoint, id, saveCheckpoint)
      : await ports.api.run({ input, jobId: id, checkpoint: row.checkpoint as CommunicationsCheckpoint,
        saveCheckpoint, validateOutput: validate, assertRepairAllowed: assertCurrent });
    if (!result) fail("job_saved_draft_not_ready");
    if (validate(result.output)?.length) fail("job_agent_output_not_source_bound");
    const agentOutput = communicationsOutputSchema.parse(result.output);
    const rendered = communicationsOutputSchema.parse(request.purpose === "question" && agentOutput.disposition === "draft" ? {
      ...agentOutput,
      subject: thread ? thread.messages.find(m => m.gmailMessageId === request.inboundMessageId)!.subject : QUESTION_EMAIL_FORMAT.subject,
      body: `${QUESTION_EMAIL_FORMAT.opening}\n\n${agentOutput.body.trim()}\n\n${QUESTION_EMAIL_FORMAT.closing}`,
    } : agentOutput);
    const branded = request.purpose === "question" && rendered.disposition === "draft"
      ? { text: gmailDraftPlain({ body: rendered.body, mimeProfile: "multipart-founder-signature-v3" }),
        html: gmailDraftHtml(rendered.body, "multipart-founder-signature-v3") } : null;
    const output = communicationsOutputSchema.parse(branded ? { ...rendered, body: branded.text } : rendered);
    const outputHtml = branded?.html ?? null, outputDigest = siteJobOutputDigest(output, outputHtml);
    await ref.set({ output, outputHtml, outputDigest, checkpoint: result.checkpoint, outputSource: result.outputSource ?? null,
      ...(request.purpose === "question" ? { outputFormatting: { version: QUESTION_EMAIL_FORMAT.version, agentOutputDigest: communicationsDigest(agentOutput) } } : {}),
      state: output.disposition === "draft" ? "needs_review" : "needs_context", completedAt: new Date(ports.now()).toISOString() }, { merge: true });
    return { id, state: output.disposition === "draft" ? "needs_review" : "needs_context", output, outputHtml, outputDigest, contextDigest: loaded.contextDigest };
  } catch (error) {
    await ref.set({ state: "draft_requires_recovery", failureCode: error instanceof Error ? error.message.slice(0, 160) : "agent_draft_failed" }, { merge: true });
    throw error;
  }
}

export async function sendReviewedSiteJobCommunication(db: FirebaseFirestore.Firestore, requestId: string, id: string, actor: string,
  approval: { expectedOutputDigest: string; expectedContextDigest: string; reviewedSend: true }, injectedPorts?: SiteJobCommunicationsPorts) {
  const loaded = await loadSiteJobCommunicationsContext(db, requestId);
  const ports = injectedPorts ?? existingSiteJobCommunicationsPorts(db, requestId, loaded.context.recipient);
  if (!ports.sendsEnabled()) fail("communications_send_disabled", 503);
  if (!actor || approval.reviewedSend !== true || loaded.contextDigest !== approval.expectedContextDigest) fail("job_context_review_required");
  if (loaded.context.captureConsentWithdrawn) fail("job_capture_authority_withdrawn");
  if (await ports.suppressed(loaded.context.recipient)) fail("job_customer_suppressed");
  const ref = db.doc(`inboundRequests/${requestId}/communications/${id}`);
  const prospective = (await ref.get()).data();
  if (!prospective) fail("job_communication_not_found", 404);
  siteJobSender(prospective, id);
  const frozen = JSON.parse(prospective.input), thread = frozen.emailThread as VerifiedThread | null;
  const incoming = thread?.messages.find(m => m.gmailMessageId === prospective.binding.inboundMessageId);
  if (thread) {
    const fresh = await ports.readThread(thread.threadId); verifiedCustomerThread(fresh, loaded.context.recipient);
    await requireJobThreadAnchor(db, requestId, fresh, loaded.context.recipient);
    if (fresh.messages.some(m => m.from === loaded.context.recipient && isOptOut(m))) { await ports.suppress(loaded.context.recipient); fail("job_customer_opted_out"); }
    if (communicationsDigest(fresh.messages) !== prospective.binding.threadDigest
      || fresh.messages.filter(m => m.from === loaded.context.recipient).at(-1)?.gmailMessageId !== incoming?.gmailMessageId) fail("job_reply_thread_changed_requires_review");
  }
  const row = await db.runTransaction(async tx => {
    const [savedSnap, currentJob, currentBrief] = await Promise.all([tx.get(ref), tx.get(db.doc(`inboundRequests/${requestId}`)), tx.get(db.doc(`siteTaskBriefs/${requestId}`))]);
    const saved = savedSnap.data();
    if (communicationsDigest({ record: currentJob.data(), brief: currentBrief.data() ?? null }) !== loaded.sourceDigest) fail("job_context_changed");
    if (!saved || saved.recipient !== loaded.context.recipient || saved.contextDigest !== loaded.contextDigest
      || saved.outputDigest !== approval.expectedOutputDigest || siteJobOutputDigest(saved.output, saved.outputHtml) !== saved.outputDigest) fail("job_send_binding_changed");
    if (siteJobSender(saved, id) !== siteJobSender(prospective, id)) fail("job_sender_binding_changed");
    if (saved.sendReceipt) return { ...saved, alreadySent: true };
    if (saved.sendClaim) fail("job_send_requires_thread_reconciliation");
    if (saved.state !== "needs_review" || saved.output.disposition !== "draft" || !saved.output.subject || !saved.output.body) fail("job_sendable_draft_required");
    tx.set(ref, { state: "send_claimed", sendClaim: { approvedBy: actor, approvedAt: new Date(ports.now()).toISOString(), outputDigest: saved.outputDigest } }, { merge: true });
    return saved;
  });
  if (row.alreadySent) return { sent: true, reused: true, receipt: row.sendReceipt };
  if (!ports.sendsEnabled() || await ports.suppressed(loaded.context.recipient)
    || (await loadSiteJobCommunicationsContext(db, requestId)).contextDigest !== loaded.contextDigest) fail("job_send_control_changed");
  if (thread) {
    const fresh = await ports.readThread(thread.threadId); verifiedCustomerThread(fresh, loaded.context.recipient);
    if (fresh.messages.some(m => m.from === loaded.context.recipient && isOptOut(m))) { await ports.suppress(loaded.context.recipient); fail("job_customer_opted_out"); }
    if (communicationsDigest(fresh.messages) !== row.binding.threadDigest
      || fresh.messages.filter(m => m.from === loaded.context.recipient).at(-1)?.gmailMessageId !== incoming?.gmailMessageId) fail("job_reply_thread_changed_requires_review");
  }
  if (!ports.sendsEnabled()) fail("job_send_control_changed");
  ports.assertRuntime?.();
  try {
    const receipt = await ports.send({ sender: siteJobSender(row, id), verifySentReceipt: true, to: row.recipient, subject: row.output.subject, body: row.output.body,
      ...(row.outputHtml != null ? { html: row.outputHtml } : {}),
      assertSendAllowed: () => { if (!ports.sendsEnabled()) fail("job_send_control_changed"); ports.assertRuntime?.(); },
      messageId: `<blueprint-job-${id}@tryblueprint.io>`, ...(thread ? { threadId: thread.threadId, inReplyTo: incoming!.rfcMessageId } : {}) });
    await ref.set({ state: "sent", sendReceipt: receipt, sentAt: new Date(ports.now()).toISOString() }, { merge: true });
    return { sent: true, receipt };
  } catch (error) {
    await ref.set({ state: "send_ack_unknown", ...(error instanceof FounderSendReadbackError ? { sendAcknowledgement: error.acknowledgement } : {}) }, { merge: true });
    throw error;
  }
}

/** Reads only the thread proved by the real agent-authored sent message. Replies
 * are customer statements, not inferred acceptance or safety attestations. */
export async function refreshSiteJobReplies(db: FirebaseFirestore.Firestore, requestId: string, id: string, actor: string,
  ports = existingSiteJobCommunicationsPorts(db)) {
  if (!actor) fail("named_operator_required", 403);
  const ref = db.doc(`inboundRequests/${requestId}/communications/${id}`);
  let row: FirebaseFirestore.DocumentData = (await ref.get()).data() ?? fail("job_sent_thread_required");
  const loaded = await loadSiteJobCommunicationsContext(db, requestId);
  if (!row || !(row.sendReceipt || row.sendAcknowledgement) || row.recipient !== loaded.context.recipient) fail("job_sent_thread_required");
  // Freeze the old canonical evidence before any awaited provider read.
  const previousReceiptDigest = communicationsDigest(row.sendReceipt ?? null), previousAcknowledgementDigest = communicationsDigest(row.sendAcknowledgement ?? null);
  const outputDigest = row.outputDigest, contextDigest = row.contextDigest, sendClaimDigest = communicationsDigest(row.sendClaim ?? null);
  const expected = { sender: siteJobSender(row, id), to: row.recipient, subject: row.output.subject, body: row.output.body,
    ...(row.outputHtml != null ? { html: row.outputHtml } : {}) };
  const acknowledgement = row.sendReceipt ? { messageId: row.sendReceipt.messageId, threadId: row.sendReceipt.threadId,
    requestedRfcMessageId: row.sendReceipt.requestedRfcMessageId ?? row.sendReceipt.rfcMessageId } : row.sendAcknowledgement;
  const thread = await ports.readThread(acknowledgement.threadId); verifiedCustomerThread(thread, row.recipient);
  const findAnchor = (receipt: any) => thread.messages.find(m => m.gmailMessageId === receipt.messageId && m.gmailThreadId === receipt.threadId
    && m.rfcMessageId === receipt.rfcMessageId && m.from === expected.sender && m.to.length === 1 && m.to[0] === expected.to
    && m.subject === expected.subject && m.body.replace(/\r\n/g, "\n") === expected.body.replace(/\r\n/g, "\n"));
  let anchor = row.sendReceipt && findAnchor(row.sendReceipt);
  if (!anchor) {
    const frozenThread = row.input ? JSON.parse(row.input).emailThread as VerifiedThread | null : null;
    const incoming = frozenThread?.messages.find(message => message.gmailMessageId === row.binding.inboundMessageId);
    if (!row.input || !ports.readSentReceipt || loaded.context.captureConsentWithdrawn || !row.sendClaim
      || row.sendClaim.outputDigest !== outputDigest || siteJobOutputDigest(row.output, row.outputHtml) !== outputDigest
      || (frozenThread && (!incoming || acknowledgement.threadId !== frozenThread.threadId))) fail("job_sent_message_not_verified");
    const receipt = await ports.readSentReceipt(acknowledgement, { ...expected, ...(incoming ? { inReplyTo: incoming.rfcMessageId } : {}) });
    anchor = findAnchor(receipt);
    if (!anchor || receipt.messageId !== acknowledgement.messageId || receipt.threadId !== acknowledgement.threadId
      || receipt.requestedRfcMessageId !== acknowledgement.requestedRfcMessageId) fail("job_sent_message_not_verified");
    row = await db.runTransaction(async tx => {
      const [saved, job, brief, statements] = await Promise.all([tx.get(ref), tx.get(db.doc(`inboundRequests/${requestId}`)),
        tx.get(db.doc(`siteTaskBriefs/${requestId}`)), tx.get(db.collection(`inboundRequests/${requestId}/customerStatements`).where("communicationId", "==", id).limit(1))]);
      const current = saved.data();
      if (communicationsDigest({ record: job.data(), brief: brief.data() ?? null }) !== loaded.sourceDigest) fail("job_context_changed");
      if (!current || siteJobSender(current, id) !== expected.sender || current.recipient !== expected.to || current.contextDigest !== contextDigest || current.outputDigest !== outputDigest
        || communicationsDigest(current.sendClaim ?? null) !== sendClaimDigest || current.sendClaim?.outputDigest !== outputDigest || siteJobOutputDigest(current.output, current.outputHtml) !== outputDigest
        || communicationsDigest(current.sendReceipt ?? null) !== previousReceiptDigest
        || communicationsDigest(current.sendAcknowledgement ?? null) !== previousAcknowledgementDigest) fail("job_sent_message_not_verified");
      // A retained statement's receipt binding is immutable, including legacy
      // conversation copies. Never repair an anchor underneath admitted evidence.
      if (!statements.empty || job.data()?.customerConversation?.some((statement: any) => statement.communicationId === id)) fail("job_sent_receipt_already_bound");
      const update = { state: "sent", sendReceipt: receipt, sendReceiptReconciledAt: new Date(ports.now()).toISOString() };
      tx.set(ref, update, { merge: true });
      return { ...current, ...update };
    });
  }
  if (!anchor) fail("job_sent_message_not_verified");
  const replies = thread.messages.filter(m => m.from === row.recipient && Date.parse(m.receivedAt) > Date.parse(anchor.receivedAt)
    && (m.inReplyTo === anchor.rfcMessageId || m.references.includes(anchor.rfcMessageId)));
  let saved = 0;
  let assessmentContinuation: string = "no_new_reply";
  const verified: Array<{ statement_id: string; digest: string }> = [];
  for (const reply of replies) {
    if (isOptOut(reply)) await ports.suppress(row.recipient);
    const statement = { messageId: reply.gmailMessageId, text: authorText(reply.body), rawBody: reply.body, receivedAt: reply.receivedAt, from: reply.from,
      source: `gmail:${thread.threadId}:${reply.gmailMessageId}`, communicationId: id, trust: "customer_statement_requires_interpretation_not_commitment",
      assessmentBinding: { schema_version: "site_customer_statement_binding.v1", thread_id: thread.threadId,
        anchor_rfc_message_id: anchor.rfcMessageId, send_receipt_digest: communicationsDigest(row.sendReceipt) } };
    if (!statement.text.trim()) continue;
    const ingested = await db.runTransaction(async tx => {
      const statementRef = db.doc(`inboundRequests/${requestId}/customerStatements/${communicationsDigest({ messageId: reply.gmailMessageId })}`), jobRef = db.doc(`inboundRequests/${requestId}`);
      const [existing, job] = await Promise.all([tx.get(statementRef), tx.get(jobRef)]);
      const current = job.data();
      if (!current) fail("job_not_found", 404);
      const currentRecipient = email(await decryptFieldValue(current.contact?.email ?? ""));
      if (currentRecipient !== row.recipient) fail("job_customer_changed");
      // Recheck the exact sent anchor before writing canonical email evidence.
      const currentCommunication = (await tx.get(ref)).data();
      if (!currentCommunication?.sendReceipt || communicationsDigest(currentCommunication.sendReceipt) !== communicationsDigest(row.sendReceipt)
        || currentCommunication?.recipient !== row.recipient || siteJobSender(currentCommunication, id) !== expected.sender) fail("job_sent_message_not_verified");
      const prior = existing.data();
      if (prior?.assessmentBinding) {
        // One immutable Gmail message can reference several sent anchors.
        // Reopening it through another question must not rebind active evidence.
        const fields = ["messageId", "text", "rawBody", "receivedAt", "from", "source", "trust"];
        if (communicationsDigest(fields.map(key => prior[key])) !== communicationsDigest(fields.map(key => statement[key]))
          || prior.assessmentBinding.schema_version !== "site_customer_statement_binding.v1"
          || !/^[a-f0-9]{64}$/.test(prior.communicationId ?? "")) fail("job_sent_message_not_verified");
        const retainedCommunication = (await tx.get(db.doc(`inboundRequests/${requestId}/communications/${prior.communicationId}`))).data();
        const receipt = retainedCommunication?.sendReceipt, retainedAnchor = receipt && thread.messages.find(message =>
          message.gmailMessageId === receipt.messageId && message.rfcMessageId === receipt.rfcMessageId
          && message.from === siteJobSender(retainedCommunication, prior.communicationId) && message.to.length === 1 && message.to[0] === row.recipient
          && message.body.trim() === retainedCommunication?.output?.body?.trim());
        if (!retainedAnchor || retainedCommunication?.recipient !== row.recipient || receipt.threadId !== thread.threadId
          || prior.assessmentBinding.thread_id !== thread.threadId || communicationsDigest(receipt) !== prior.assessmentBinding.send_receipt_digest
          || retainedAnchor.rfcMessageId !== prior.assessmentBinding.anchor_rfc_message_id
          || Date.parse(reply.receivedAt) <= Date.parse(retainedAnchor.receivedAt)
          || !(reply.inReplyTo === retainedAnchor.rfcMessageId || reply.references.includes(retainedAnchor.rfcMessageId)))
          fail("job_sent_message_not_verified");
        tx.set(ref, { answerReceived: true, lastReplyAt: Date.parse(currentCommunication.lastReplyAt) >= Date.parse(reply.receivedAt)
          ? currentCommunication.lastReplyAt : reply.receivedAt }, { merge: true });
        return { saved: false, statementRef: { statement_id: statementRef.id, digest: siteCustomerStatementDigest(prior) } };
      }
      // Upgrade legacy records only from a fresh verified thread read, and
      // never overwrite a row already admitted to an assessment's context.
      if (prior?.assessmentAdmission || assessmentCustomerStatementRefs(current).some(value => value.statement_id === statementRef.id)) fail("job_sent_message_not_verified");
      tx.set(statementRef, statement);
      const conversation = Array.isArray(current.customerConversation) ? current.customerConversation : [];
      const update: Record<string, unknown> = { customerConversation: [...conversation.filter(value => value?.messageId !== statement.messageId).slice(-19), statement],
        customerAnswerReviewRequired: true, customerAnswerNextOwner: "Blueprint", customerAnswerNextAction: "Read the customer's answer and continue the job; request another fact only if it changes the decision." };
      tx.set(jobRef, update, { merge: true });
      tx.set(ref, { lastReplyAt: reply.receivedAt, answerReceived: true }, { merge: true });
      return { saved: true, statementRef: { statement_id: statementRef.id, digest: siteCustomerStatementDigest(statement) } };
    });
    if (ingested.saved) saved++;
    verified.push(ingested.statementRef);
  }
  if (verified.length && !replies.some(isOptOut) && !(await ports.suppressed(row.recipient))) {
    const selected = verified.slice(-20);
    assessmentContinuation = await db.runTransaction(async tx => {
      const [job, currentCommunication, ...statements] = await Promise.all([
        tx.get(db.doc(`inboundRequests/${requestId}`)), tx.get(ref),
        ...selected.map(value => tx.get(db.doc(`inboundRequests/${requestId}/customerStatements/${value.statement_id}`))),
      ]);
      const current = job.data();
      if (!current || email(await decryptFieldValue(current.contact?.email ?? "")) !== row.recipient) fail("job_customer_changed");
      if (currentCommunication.data()?.recipient !== row.recipient || !currentCommunication.data()?.sendReceipt
        || communicationsDigest(currentCommunication.data()?.sendReceipt) !== communicationsDigest(row.sendReceipt)
        || statements.some((value, index) => !value.exists || siteCustomerStatementDigest(value.data()!) !== selected[index].digest))
        fail("job_sent_message_not_verified");
      const continuation = await prepareCustomerReplySiteAssessment(db, tx, requestId, current, selected);
      continuation.commit();
      return continuation.state;
    });
  } else if (verified.length) {
    assessmentContinuation = "customer_suppressed";
  }
  // Only the ordinary production worker consumes the durable new job. Tests
  // and local assessment experiments never call this email-ingestion path.
  if (assessmentContinuation === "queued") void tickSiteAssessments(1);
  return { saved, nextOwner: "Blueprint", reviewRequired: saved > 0, assessmentContinuation };
}
