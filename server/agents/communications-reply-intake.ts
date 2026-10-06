import { communicationsBriefSchema, communicationsEnvelopeSchema, communicationsJobSchema,
  communicationsDigest, communicationsDeliveryKey, correlatedReplies, isOptOut,
  communicationsReplyBindingSchema, verifyCommunicationsReplyBinding,
  communicationsFounderReplyBindingSchema, verifyCommunicationsFounderReplyBinding,
  communicationsSentReceiptIdentity, founderDraftBindingIdentity, founderSentContentSha256, verifyFounderSendObservation,
  verifyCommunicationsHandoff, FOUNDER_MAILBOX, type CommunicationsBrief, type ThreadMessage, type VerifiedThread,
  type FounderSendObservation,
} from "./communications-contract";
import { COMMUNICATIONS_ROOT, prepareCommunicationsEnqueue } from "./communications-store";
import { reviewCommunicationsPayload } from "./communications-review";
import { verifyFirstContactAuthority } from "./communications-first-contact";
import { verifyPublishedResearch, type ResearchSnapshotReader } from "./communications-research";
import { LeadVerificationRequired } from "./lead-verification";
import type { ActionPayload } from "./action-policies";
import { makeReplyFollowup, replyFollowupId, replyFollowupRef } from "./communications-reply-followup";

export type CommunicationsReplyIntakeDependencies = {
  db: FirebaseFirestore.Firestore;
  readResearch: ResearchSnapshotReader;
  readThread: (threadId: string) => Promise<VerifiedThread>;
  isSuppressed: (email: string) => Promise<boolean>;
  suppress: (email: string, reason: string) => Promise<{ persisted: boolean }>;
  now: () => number;
  /** Owner observation direction + durable read capability. Absent: founder-sent
   * threads are never read. It makes no Gmail call itself. */
  founderSentRepliesAllowed?: () => Promise<boolean>;
};

const FOUNDER_THREAD_READ_TIMEOUT = 30000;
async function withTimeout<T>(work: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(code)), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}

function jobIdentity(value: Record<string, unknown>) {
  return communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"]
    .map(key => [key, value[key]])));
}
function validObservation(thread: VerifiedThread, now: number) {
  const observed = Date.parse(thread.fetchedAt);
  if (thread.mailbox !== FOUNDER_MAILBOX || !Number.isFinite(observed) || observed > now
    || thread.messages.some(message => !Number.isFinite(Date.parse(message.receivedAt)) || Date.parse(message.receivedAt) > observed)) {
    throw new Error("reply_thread_observation_invalid");
  }
}

/** No inbox search: the candidate corpus consists solely of our durable sent
 * receipts, backed by the exact original review and immutable research brief. */
async function boundSentContext(deps: CommunicationsReplyIntakeDependencies, receiptKey: string) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), receipt = (await root.collection("sendReceipts").doc(receiptKey).get()).data();
  if (!receipt || receipt.state !== "sent") throw new Error("reply_sent_receipt_missing");
  const record = (await root.collection("jobs").doc(receipt.jobId).get()).data();
  if (!record) throw new Error("reply_original_job_missing");
  const job = jobIdentity(record);
  if (job.jobId !== receipt.jobId || communicationsDeliveryKey(job) !== receiptKey
    || receipt.approvalLedgerId !== `communications_${job.jobId}`) throw new Error("reply_sent_identity_changed");
  const ledger = (await deps.db.collection("action_ledger").doc(receipt.approvalLedgerId).get()).data();
  const payload = ledger?.action_payload as ActionPayload | undefined;
  const envelope = communicationsEnvelopeSchema.parse(payload?.communications);
  if (!payload || communicationsDigest(payload) !== receipt.payloadDigest
    || communicationsDigest(envelope.job) !== communicationsDigest(job)
    || payload.emailTransport !== "founder_gmail" || payload.from !== FOUNDER_MAILBOX
    || payload.to !== envelope.brief.contact.email.toLowerCase()) throw new Error("reply_original_payload_changed");
  const review = reviewCommunicationsPayload(payload, deps.now());
  const human = !!ledger?.approved_by && ledger.approved_by === ledger.outreach_reviewed_by
    && ledger.outreach_semantic_review?.digest === review.digest;
  if (!human) {
    const authority = verifyFirstContactAuthority(ledger?.first_contact_authority, payload, deps.now(), true);
    const authorityDigest = communicationsDigest(authority);
    const saved = (await root.collection("firstContactAuthorities").doc(authorityDigest).get()).data();
    if (receipt.firstContactAuthorityDigest !== authorityDigest || ledger?.first_contact_authority_digest !== authorityDigest
      || !saved || communicationsDigest(saved) !== authorityDigest) throw new Error("reply_original_approval_missing");
  }
  const brief = communicationsBriefSchema.parse((await root.collection("briefs").doc(job.briefId).get()).data());
  if (communicationsDigest(brief) !== job.briefDigest || communicationsDigest(envelope.brief) !== job.briefDigest) {
    throw new Error("reply_parent_context_changed");
  }
  const handoff = verifyCommunicationsHandoff((await root.collection("handoffs").doc(job.briefDigest).get()).data(), brief);
  const provenance = (await root.collection("researchSources").doc(job.briefDigest).get()).data();
  const prospect = (await deps.db.collection("outboundProspects").doc(job.prospectId).get()).data();
  if (!receipt.receipt?.threadId || !receipt.receipt?.messageId || !receipt.receipt?.rfcMessageId
    || receipt.receipt.rfcMessageId !== receipt.rfcMessageId) throw new Error("reply_sent_thread_binding_missing");
  return { job, receipt, ledger, payload, brief, handoff, prospect, provenance };
}

/** Founder-authored anchor. The immutable observation, its Gmail draft-copy
 * binding and owner direction digest replace the approval/receipt chain; it
 * carries no send or approval authority and no system receipt is consulted. */
async function founderSentContext(deps: CommunicationsReplyIntakeDependencies, observationId: string) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT);
  let observation: FounderSendObservation;
  try { observation = verifyFounderSendObservation((await root.collection("founderSendObservations").doc(observationId).get()).data()); }
  catch { throw new Error("reply_founder_observation_invalid"); }
  if (observation.jobId !== observationId) throw new Error("reply_founder_observation_invalid");
  const record = (await root.collection("jobs").doc(observation.jobId).get()).data();
  if (!record) throw new Error("reply_original_job_missing");
  const job = jobIdentity(record);
  if (job.jobId !== observation.jobId || job.prospectId !== observation.prospectId || job.briefId !== observation.briefId
    || job.briefDigest !== observation.briefDigest || job.intent !== observation.intent || job.inboundMessageId !== observation.inboundMessageId
    || communicationsDeliveryKey(job) !== observation.deliveryKey || record.ledgerId !== observation.ledgerId) throw new Error("reply_founder_identity_changed");
  const draftBinding = (await root.collection("gmailDraftBindings").doc(observation.jobId).get()).data();
  if (communicationsDigest(founderDraftBindingIdentity(draftBinding)) !== observation.gmailDraftBindingDigest) throw new Error("reply_founder_binding_changed");
  const brief = communicationsBriefSchema.parse((await root.collection("briefs").doc(job.briefId).get()).data());
  if (communicationsDigest(brief) !== job.briefDigest) throw new Error("reply_parent_context_changed");
  if (brief.contact.email.toLowerCase() !== observation.recipient) throw new Error("reply_founder_recipient_changed");
  const handoff = verifyCommunicationsHandoff((await root.collection("handoffs").doc(job.briefDigest).get()).data(), brief);
  const provenance = (await root.collection("researchSources").doc(job.briefDigest).get()).data();
  const prospect = (await deps.db.collection("outboundProspects").doc(job.prospectId).get()).data();
  return { job, observation, draftBinding, brief, handoff, prospect, provenance };
}

type BoundParent = ({ kind: "system_send"; key: string } & Awaited<ReturnType<typeof boundSentContext>>)
  | ({ kind: "founder_send_observed"; key: string } & Awaited<ReturnType<typeof founderSentContext>>);

export async function admitBoundCommunicationsReplies(receiptKey: string, deps: CommunicationsReplyIntakeDependencies) {
  return admitAnchoredReplies({ kind: "system_send", key: receiptKey, ...await boundSentContext(deps, receiptKey) }, deps);
}

/** Replies on a founder-sent thread. Requires the same owner direction and
 * read capability as observation; founder edits to the copy are allowed. */
export async function admitFounderSentCommunicationsReplies(observationId: string, deps: CommunicationsReplyIntakeDependencies) {
  if (!deps.founderSentRepliesAllowed || !await deps.founderSentRepliesAllowed()) throw new Error("founder_sent_reply_intake_not_authorized");
  return admitFounderSentReplies(observationId, deps);
}
async function admitFounderSentReplies(observationId: string, deps: CommunicationsReplyIntakeDependencies) {
  return admitAnchoredReplies({ kind: "founder_send_observed", key: observationId, ...await founderSentContext(deps, observationId) }, deps);
}

async function admitAnchoredReplies(parent: BoundParent, deps: CommunicationsReplyIntakeDependencies) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), founder = parent.kind === "founder_send_observed";
  const sentThreadId = parent.kind === "system_send" ? parent.receipt.receipt.threadId : parent.observation.sent.threadId;
  // A hung founder-thread read must not hold intake; system threads keep the existing reader.
  const thread = founder ? await withTimeout(deps.readThread(sentThreadId), FOUNDER_THREAD_READ_TIMEOUT, "reply_founder_thread_timeout")
    : await deps.readThread(sentThreadId);
  validObservation(thread, deps.now());
  const outgoing = thread.messages.find(message => message.gmailMessageId === (parent.kind === "system_send"
    ? parent.receipt.receipt.messageId : parent.observation.sent.gmailMessageId));
  const normalize = (body: string) => body.replace(/\r\n/g, "\n");
  if (parent.kind === "system_send") {
    if (thread.threadId !== parent.receipt.receipt.threadId || !outgoing || outgoing.gmailThreadId !== thread.threadId
      || outgoing.rfcMessageId !== parent.receipt.rfcMessageId || outgoing.from !== FOUNDER_MAILBOX
      || outgoing.to.join() !== parent.brief.contact.email.toLowerCase() || outgoing.subject !== parent.payload.subject
      || normalize(outgoing.body) !== normalize(String(parent.payload.transportBody))) throw new Error("reply_sent_thread_content_changed");
  } else {
    // The observed founder bytes, not the Blueprint draft, anchor this thread.
    const sent = parent.observation.sent;
    if (thread.threadId !== sent.threadId || !outgoing || outgoing.gmailThreadId !== thread.threadId
      || outgoing.rfcMessageId !== sent.rfcMessageId || outgoing.from !== FOUNDER_MAILBOX
      || outgoing.to.join() !== parent.observation.recipient || outgoing.to.join() !== parent.brief.contact.email.toLowerCase()
      || founderSentContentSha256(outgoing.subject) !== sent.subjectSha256
      || founderSentContentSha256(outgoing.body) !== sent.bodySha256) throw new Error("reply_founder_sent_thread_content_changed");
  }
  const replyOrigin: NonNullable<CommunicationsBrief["replyOrigin"]> = parent.kind === "system_send"
    ? { parentBriefId: parent.brief.briefId, parentBriefDigest: parent.job.briefDigest, sendReceiptKey: parent.key }
    : { origin: "founder_send_observed", parentBriefId: parent.brief.briefId, parentBriefDigest: parent.job.briefDigest,
      founderSendObservationId: parent.key, founderSendObservationDigest: parent.observation.evidenceDigest };
  const brief = communicationsBriefSchema.parse({ ...parent.brief,
    briefId: communicationsDigest(parent.kind === "system_send" ? { parentBriefDigest: parent.job.briefDigest, receiptKey: parent.key }
      : { parentBriefDigest: parent.job.briefDigest, founderSendObservationId: parent.key }),
    replyOrigin, priorConversation: { gmailThreadId: thread.threadId, gmailMessageIds: [outgoing.gmailMessageId] } });
  const replies = correlatedReplies(brief, thread);
  if (!replies.length) return { state: "no_reply" as const };
  const optOut = replies.find(isOptOut), incoming = optOut ?? replies.at(-1)!;
  let verificationGap: LeadVerificationRequired["verification"] | null = null;
  const contextMissing = !parent.prospect || parent.prospect.contactEmail?.toLowerCase() !== parent.brief.contact.email.toLowerCase()
    || parent.prospect.siteId !== parent.brief.siteId || parent.prospect.taskId !== parent.brief.taskId;
  if (!optOut) {
    // Only new drafting requires current research/canonical context. A real
    // opt-out still protects the originally verified recipient when it drifts.
    if (parent.brief.researchOrigin.sourceDigest && (!parent.provenance || parent.provenance.briefDigest !== parent.job.briefDigest
      || communicationsDigest(parent.provenance.source ?? null) !== parent.brief.researchOrigin.sourceDigest)) throw new Error("reply_parent_research_source_changed");
    if (contextMissing && !founder) throw new Error("reply_canonical_context_changed");
    // A founder-thread reply is learning-only: no drafting follows, so it
    // needs no current research verification.
    if (!founder) {
      const proof = parent.brief.researchOrigin.contactEvidenceKind === "public_operator_resolution"
        ? (await root.collection("contactProofs").doc(parent.brief.researchOrigin.contactEvidenceDigest!).get()).data() : undefined;
      try {
        verifyPublishedResearch(await deps.readResearch(parent.brief.researchOrigin.date, parent.brief.researchOrigin.admissionId),
          parent.brief, parent.handoff, proof, deps.now());
      } catch (error) {
        if (!(error instanceof LeadVerificationRequired)) throw error;
        // A correlated observed reply is durable untrusted evidence. Current
        // qualification gates new inference/outreach, without erasing the reply
        // or pretending that reception refreshed the original source dates.
        verificationGap = error.verification;
      }
    }
  }
  const input = { prospectId: brief.prospectId, briefId: brief.briefId, briefDigest: communicationsDigest(brief),
    intent: "reply" as const, inboundMessageId: incoming.gmailMessageId };
  const job = { ...input, jobId: communicationsDigest(input) };
  const followupId = replyFollowupId(brief.prospectId, parent.job.briefDigest, thread.threadId);
  const followupRef = replyFollowupRef(deps.db, brief.prospectId, followupId);
  const claimRef = root.collection("replyIntake").doc(communicationsDeliveryKey(job));
  const binding = parent.kind === "system_send"
    ? communicationsReplyBindingSchema.parse({ version: "blueprint.communications-reply-binding.v1",
      briefDigest: job.briefDigest, parentBriefId: parent.brief.briefId, parentBriefDigest: parent.job.briefDigest,
      sendReceiptKey: parent.key, sendReceiptDigest: communicationsDigest(communicationsSentReceiptIdentity(parent.receipt)),
      approvalLedgerId: parent.receipt.approvalLedgerId, outgoingMessageId: outgoing.gmailMessageId,
      outgoingRfcMessageId: outgoing.rfcMessageId })
    : communicationsFounderReplyBindingSchema.parse({ version: "blueprint.communications-reply-binding.v2",
      replyOrigin: "founder_send_observed", briefDigest: job.briefDigest, parentBriefId: parent.brief.briefId,
      parentBriefDigest: parent.job.briefDigest, founderSendObservationId: parent.key,
      founderSendObservationDigest: parent.observation.evidenceDigest, gmailDraftBindingDigest: parent.observation.gmailDraftBindingDigest,
      directionDigest: parent.observation.directionDigest, ledgerId: parent.observation.ledgerId,
      outgoingMessageId: outgoing.gmailMessageId, outgoingRfcMessageId: outgoing.rfcMessageId,
      outgoingBodySha256: parent.observation.sent.bodySha256, sendsAuthorized: false, approvalGranted: false });
  if (binding.version === "blueprint.communications-reply-binding.v1") verifyCommunicationsReplyBinding(binding, brief, parent.brief);
  else verifyCommunicationsFounderReplyBinding(binding, brief, parent.brief);
  if (optOut) {
    // Suppression must be durable before a queued job can reach the paid gate.
    const result = await deps.suppress(brief.contact.email, `Correlated opt-out reply ${incoming.gmailMessageId}`);
    if (!result.persisted) throw new Error("opt_out_suppression_not_persisted");
  } else if (parent.prospect?.stage === "closed" || ["unknown", "opted_out"].includes(brief.consent.status)
    || await deps.isSuppressed(brief.contact.email)) return { state: "suppressed" as const };
  return deps.db.runTransaction(async tx => {
    const sourceRef = deps.db.collection("outboundProspects").doc(job.prospectId);
    // Anchor documents are re-read so a changed receipt/approval or
    // observation/draft binding cannot be attached by a stale read.
    const anchorRefs = parent.kind === "system_send"
      ? [root.collection("sendReceipts").doc(parent.key), deps.db.collection("action_ledger").doc(parent.receipt.approvalLedgerId)]
      : [root.collection("founderSendObservations").doc(parent.key), root.collection("gmailDraftBindings").doc(parent.key)];
    const [claim, anchor, anchorSupport, source, savedParent, originalHandoff, savedBrief, savedBinding, savedHandoff,
      originalProvenance, savedProvenance, legacy] = await Promise.all([
      tx.get(claimRef), tx.get(anchorRefs[0]), tx.get(anchorRefs[1]), tx.get(sourceRef),
      tx.get(root.collection("briefs").doc(parent.brief.briefId)), tx.get(root.collection("handoffs").doc(parent.job.briefDigest)),
      tx.get(root.collection("briefs").doc(brief.briefId)), tx.get(root.collection("replyBindings").doc(job.briefDigest)),
      tx.get(root.collection("handoffs").doc(job.briefDigest)),
      tx.get(root.collection("researchSources").doc(parent.job.briefDigest)), tx.get(root.collection("researchSources").doc(job.briefDigest)),
      tx.get(root.collection("jobs").where("inboundMessageId", "==", incoming.gmailMessageId)),
    ]);
    const anchorChanged = parent.kind === "system_send"
      ? binding.version !== "blueprint.communications-reply-binding.v1"
        || communicationsDigest(communicationsSentReceiptIdentity(anchor.data())) !== binding.sendReceiptDigest
        || communicationsDigest(anchorSupport.data() ?? null) !== communicationsDigest(parent.ledger)
      : (() => {
        try { return verifyFounderSendObservation(anchor.data()).evidenceDigest !== parent.observation.evidenceDigest; }
        catch { return true; }
      })() || communicationsDigest(founderDraftBindingIdentity(anchorSupport.data())) !== parent.observation.gmailDraftBindingDigest;
    if (anchorChanged || communicationsDigest(savedParent.data() ?? null) !== parent.job.briefDigest
      || communicationsDigest(originalProvenance.data() ?? null) !== communicationsDigest(parent.provenance ?? null)
      || communicationsDigest(originalHandoff.data() ?? null) !== communicationsDigest(parent.handoff)
      || !optOut && !founder && (source.data()?.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
        || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId)) throw new Error("reply_bound_context_changed");
    const derivedHandoff = { ...parent.handoff, briefDigest: job.briefDigest };
    const validProvenance = parent.provenance?.briefDigest === parent.job.briefDigest
      && communicationsDigest(parent.provenance.source ?? null) === parent.brief.researchOrigin.sourceDigest;
    const derivedProvenance = validProvenance ? { ...parent.provenance, briefDigest: job.briefDigest } : null;
    if (savedBrief.exists && communicationsDigest(savedBrief.data()) !== job.briefDigest
      || savedHandoff.exists && communicationsDigest(savedHandoff.data()) !== communicationsDigest(derivedHandoff)
      || derivedProvenance && savedProvenance.exists && communicationsDigest(savedProvenance.data()) !== communicationsDigest(derivedProvenance)
      || savedBinding.exists && communicationsDigest(savedBinding.data()) !== communicationsDigest(binding)) throw new Error("reply_immutable_context_changed");
    const events = await Promise.all(replies.map(message => tx.get(sourceRef.collection("communicationsEvents").doc(`reply_${message.gmailMessageId}`))));
    const savedFollowup = await tx.get(followupRef);
    const canonicalMissing = !source.exists || source.data()?.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
      || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId;
    for (let index = 0; index < replies.length; index++) {
      const saved = events[index].data();
      if (saved && (saved.type !== "reply_received" || saved.untrusted !== true
        || communicationsDigest(saved.message) !== communicationsDigest(replies[index]))) throw new Error("communications_reply_source_changed");
    }
    const previous = legacy.docs.filter(row => row.data().prospectId === job.prospectId && row.data().intent === "reply");
    if (previous.length > 1) throw new Error("reply_existing_jobs_require_reconciliation");
    const writeObservations = (identity: ReturnType<typeof jobIdentity>) => {
      for (let index = 0; index < replies.length; index++) if (!events[index].exists) {
        const message: ThreadMessage = replies[index];
        tx.create(events[index].ref, { version: "blueprint.communications-reply-observation.v1", type: "reply_received",
          jobId: identity.jobId, prospectId: identity.prospectId, briefId: identity.briefId, briefDigest: identity.briefDigest,
          message, messageHash: communicationsDigest(message), untrusted: true,
          originalObservedAt: thread.fetchedAt, observedAt: thread.fetchedAt, recordedAt: deps.now() });
      }
      const followup = makeReplyFollowup({ brief, parentBriefDigest: parent.job.briefDigest, threadId: thread.threadId,
        replies, observedAt: thread.fetchedAt, now: deps.now(), optOut: !!optOut, contextMissing: canonicalMissing }, savedFollowup.data());
      // Exact replay retains the handoff and any owner's review byte-for-byte.
      if (!savedFollowup.exists || savedFollowup.data()?.evidenceDigest !== followup.evidenceDigest
        || followup.state === "opted_out" && savedFollowup.data()?.state !== "opted_out"
        || savedFollowup.data()?.contextMissing !== canonicalMissing) tx.set(followupRef, followup);
    };
    if (claim.exists || previous.length) {
      if (claim.exists && claim.data()?.messageHash !== communicationsDigest(incoming)) throw new Error("communications_reply_source_changed");
      if (!previous.length || claim.exists && claim.data()?.jobId !== previous[0].id) throw new Error("reply_existing_claim_job_missing_or_changed");
      // Dedupe prevents another answer; it must not discard earlier messages
      // that Gmail exposes later in the same verified thread.
      writeObservations(jobIdentity(previous[0].data()));
      if (optOut && source.data()?.contactEmail?.toLowerCase() === brief.contact.email.toLowerCase()) tx.set(sourceRef, { stage: "closed", closedReason: "recipient_opt_out",
        closedAtIso: source.data()?.closedAtIso ?? new Date(deps.now()).toISOString() }, { merge: true });
      return { state: optOut ? "opted_out" as const : "existing" as const,
        jobId: claim.data()?.jobId ?? previous[0].id, followupId };
    }
    // Read all queue state before writing: Firestore transactions cannot read
    // after writes, and the original delivery claim remains stable on restart.
    const queued = await prepareCommunicationsEnqueue(tx, deps.db, input, deps.now());
    if (!optOut && source.data()?.stage === "closed") throw new Error("recipient_suppressed");
    writeObservations(job);
    if (!savedBrief.exists) tx.create(root.collection("briefs").doc(brief.briefId), brief);
    if (!savedBinding.exists) tx.create(root.collection("replyBindings").doc(job.briefDigest), binding);
    if (!savedHandoff.exists) tx.create(root.collection("handoffs").doc(job.briefDigest), derivedHandoff);
    if (derivedProvenance && !savedProvenance.exists) tx.create(root.collection("researchSources").doc(job.briefDigest), derivedProvenance);
    queued.commit();
    // The owner direction authorizes reading and learning only: a founder-thread
    // reply job is terminal at creation and is never drafted, approved or sent.
    if (founder && !optOut) tx.update(root.collection("jobs").doc(job.jobId), { state: "learning_only",
      reason: "founder_thread_reply_learning_only", updatedAt: deps.now() });
    if (verificationGap) tx.update(root.collection("jobs").doc(job.jobId), { state: "awaiting_research",
      reason: "lead_verification_required", leadVerification: verificationGap, updatedAt: deps.now() });
    if (optOut) {
      tx.update(root.collection("jobs").doc(job.jobId), { state: "opted_out", reason: "recipient_opt_out", updatedAt: deps.now() });
      if (source.data()?.contactEmail?.toLowerCase() === brief.contact.email.toLowerCase()) {
        tx.set(sourceRef, { stage: "closed", closedReason: "recipient_opt_out",
          closedAtIso: source.data()?.closedAtIso ?? new Date(deps.now()).toISOString() }, { merge: true });
      }
    }
    const state = optOut ? "opted_out" as const : founder ? "learning_only" as const
      : verificationGap ? "awaiting_research" as const : "queued" as const;
    tx.create(claimRef, founder
      ? { version: "blueprint.communications-reply-intake.v2", replyOrigin: "founder_send_observed", jobId: job.jobId,
        messageHash: communicationsDigest(incoming), parentBriefDigest: parent.job.briefDigest,
        founderSendObservationId: parent.key, state, observedAt: thread.fetchedAt }
      : { version: "blueprint.communications-reply-intake.v1", jobId: job.jobId,
        messageHash: communicationsDigest(incoming), parentBriefDigest: parent.job.briefDigest,
        sendReceiptKey: parent.key, state, observedAt: thread.fetchedAt });
    return { state, jobId: job.jobId, followupId };
  });
}

/** A rotating page revisits bound threads, including old threads with newly
 * arrived replies. A bad binding is visible without starving later receipts.
 * A second gated cursor reads founder-sent observations the same way. */
export async function runCommunicationsReplyIntake(deps: CommunicationsReplyIntakeDependencies) {
  const root = deps.db.doc(COMMUNICATIONS_ROOT), cursorRef = root.collection("intakeState").doc("boundReplies");
  const cursor = (await cursorRef.get()).data()?.cursor;
  let query = root.collection("sendReceipts").where("state", "==", "sent").orderBy("__name__").limit(5);
  if (typeof cursor === "string") query = query.startAfter(cursor);
  const page = await query.get(), outcomes: { receiptKey?: string; observationId?: string; state: string; reason?: string }[] = [];
  const blocked = async (id: string, error: unknown, label: { receiptKey: string } | { observationId: string }) => {
    const reason = error instanceof Error && /^[a-z_][a-z0-9_]*$/.test(error.message) ? error.message : "reply_bound_context_unavailable";
    const outcome = { ...label, state: "blocked", reason };
    await root.collection("replyIntakeErrors").doc(id).set({ ...outcome, observedAt: deps.now(), sent: false, sessionCreated: false });
    return outcome;
  };
  for (const row of page.docs) {
    try { outcomes.push({ receiptKey: row.id, ...await admitBoundCommunicationsReplies(row.id, deps) }); }
    catch (error) { outcomes.push(await blocked(row.id, error, { receiptKey: row.id })); }
    await cursorRef.set({ cursor: row.id });
  }
  if (page.size < 5) await cursorRef.set({ cursor: null });
  let founderAllowed = false;
  try { founderAllowed = !!deps.founderSentRepliesAllowed && await deps.founderSentRepliesAllowed(); }
  catch { founderAllowed = false; }
  const founderCursorRef = root.collection("intakeState").doc("founderSentReplies");
  if (!founderAllowed) {
    // Founder-thread opt-out intake stops with the owner gate; say so visibly.
    if (!(await root.collection("founderSendObservations").limit(1).get()).empty) {
      await founderCursorRef.set({ paused: true, reason: "founder_sent_reply_gate_closed", pausedAt: deps.now() }, { merge: true });
    }
    return outcomes;
  }
  await founderCursorRef.set({ paused: false, reason: null }, { merge: true });
  const founderCursor = (await founderCursorRef.get()).data()?.cursor;
  let founderQuery = root.collection("founderSendObservations").where("state", "==", "observed").orderBy("__name__").limit(5);
  if (typeof founderCursor === "string") founderQuery = founderQuery.startAfter(founderCursor);
  const observations = await founderQuery.get();
  for (const row of observations.docs) {
    try { outcomes.push({ observationId: row.id, ...await admitFounderSentReplies(row.id, deps) }); }
    catch (error) { outcomes.push(await blocked(`founder_${row.id}`, error, { observationId: row.id })); }
    await founderCursorRef.set({ cursor: row.id });
  }
  if (observations.size < 5) await founderCursorRef.set({ cursor: null });
  return outcomes;
}
