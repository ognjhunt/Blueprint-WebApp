import { randomUUID } from "node:crypto";
import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest,
  type CommunicationsBrief, type CommunicationsJob, type CommunicationsOutput, type CommunicationsHandoff,
  verifyCommunicationsHandoff, communicationsDeliveryKey,
  verifyCommunicationsReplyBinding,
  communicationsSentReceiptIdentity,
  type ThreadMessage,
} from "./communications-contract";
import type { CommunicationsCheckpoint, CommunicationsRejectedCreateRecovery,
  CommunicationsRejectedCreateRecoveryIntent } from "./communications-api";
import type { ActionPayload } from "./action-policies";
import { automaticFirstContactEnabled, firstContactAuthority, verifyFirstContactSource, ROUTINE_COMMUNICATIONS_POLICY,
  routineCommunicationsContentBlockers } from "./communications-first-contact";
import { firstContactPostalLine } from "./communications-first-contact-footer";
import { reviewCommunicationsPayload } from "./communications-review";

export const COMMUNICATIONS_ROOT = "blueprintCommunications/default";
export const COMMUNICATIONS_JOB_STATES = Object.freeze(["queued", "running", "retry", "blocked", "awaiting_research",
  "pending_approval", "auto_approved", "sent", "failed", "no_reply", "opted_out", "superseded"] as const);
export type CommunicationsJobRecord = CommunicationsJob & {
  state: typeof COMMUNICATIONS_JOB_STATES[number];
  attempts: number; checkpoint: CommunicationsCheckpoint; output?: CommunicationsOutput;
  lease?: { owner: string; until: number }; nextAttemptAt?: number; reason?: string;
  automationPolicyVersion?: string;
};

/** Read before the caller writes. The stable first-touch claim also covers
 * legacy queue records and prevents duplicate model work across brief revisions. */
export async function prepareCommunicationsEnqueue(tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore, input: Omit<CommunicationsJob, "jobId">, now: number) {
  const job = communicationsJobSchema.parse({ ...input, jobId: communicationsDigest(input) });
  const root = db.doc(COMMUNICATIONS_ROOT), ref = root.collection("jobs").doc(job.jobId);
  const existing = await tx.get(ref);
  const claimRef = root.collection("firstTouches").doc(communicationsDeliveryKey(job));
  if (job.intent === "outreach") {
    const claim = await tx.get(claimRef);
    const legacy = await tx.get(root.collection("jobs").where("prospectId", "==", job.prospectId).limit(101));
    const previous = legacy.docs.filter(doc => doc.data().intent === "outreach" && doc.id !== job.jobId && doc.data().state !== "superseded");
    if (legacy.size > 100) throw new Error("communications_first_touch_already_requested");
    const replaced: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const doc of previous) {
      const data = doc.data() as CommunicationsJobRecord;
      // Only proven pre-inference research/context failures can be replaced.
      // Unknown session ACKs, drafts, active jobs, opt-outs and sends remain fenced.
      const safeState = data.state === "awaiting_research" || (data.state === "blocked"
        && /^(?:research_|brief_fact_|canonical_)/.test(data.reason ?? ""));
      if (!safeState || data.checkpoint?.createClaimedAt || data.checkpoint?.sessionId || data.checkpoint?.turnId
        || data.output || (data.lease?.until ?? 0) > now) throw new Error("communications_first_touch_already_requested");
      const ledger = await tx.get(db.collection("action_ledger").doc(`communications_${doc.id}`));
      if (ledger.exists) throw new Error("communications_first_touch_already_requested");
      replaced.push(doc);
    }
    if (claim.exists && claim.data()?.jobId !== job.jobId && !replaced.some(doc => doc.id === claim.data()?.jobId)) {
      throw new Error("communications_first_touch_already_requested");
    }
    const receipt = await tx.get(root.collection("sendReceipts").doc(communicationsDeliveryKey(job)));
    if (!existing.exists && receipt.exists) throw new Error("communications_first_touch_already_requested");
    const record = existing.exists ? existing.data() as CommunicationsJobRecord : { ...job, state: "queued" as const,
      attempts: 0, checkpoint: { createClaimedAt: null, sessionId: null, turnId: null } };
    return { record, commit: () => {
      if (!claim.exists) tx.create(claimRef, { jobId: job.jobId, prospectId: job.prospectId, createdAt: now });
      else if (claim.data()?.jobId !== job.jobId) tx.set(claimRef, { jobId: job.jobId, prospectId: job.prospectId, createdAt: now });
      for (const doc of replaced) {
        tx.update(doc.ref, { state: "superseded", reason: "verified_research_replaced_before_inference", replacedBy: job.jobId, updatedAt: now });
        tx.set(root.collection("refreshRequests").doc(doc.id), { state: "resolved", resolvedBy: job.jobId, resolvedAt: now }, { merge: true });
      }
      if (!existing.exists) tx.create(ref, { ...record, createdAt: now, updatedAt: now });
    } };
  }
  const record = existing.exists ? existing.data() as CommunicationsJobRecord : { ...job, state: "queued" as const,
    attempts: 0, checkpoint: { createClaimedAt: null, sessionId: null, turnId: null } };
  return { record, commit: () => { if (!existing.exists) tx.create(ref, { ...record, createdAt: now, updatedAt: now }); } };
}

/** Small private Firestore namespace; research/scheduler leases are never touched. */
export class CommunicationsStore {
  constructor(public db: FirebaseFirestore.Firestore, private now = () => Date.now(), private owner = randomUUID()) {}
  private jobs() { return this.db.doc(COMMUNICATIONS_ROOT).collection("jobs"); }
  async brief(briefId: string): Promise<CommunicationsBrief> {
    const snapshot = await this.db.doc(COMMUNICATIONS_ROOT).collection("briefs").doc(briefId).get();
    const brief = communicationsBriefSchema.parse(snapshot.data());
    await this.handoff(brief);
    return brief;
  }
  async handoff(brief: CommunicationsBrief, lineage = new Set<string>()): Promise<CommunicationsHandoff> {
    const digest = communicationsDigest(brief), root = this.db.doc(COMMUNICATIONS_ROOT);
    if (lineage.has(digest)) throw new Error("reply_parent_lineage_cycle");
    lineage.add(digest);
    const snapshot = await root.collection("handoffs").doc(digest).get();
    const handoff = verifyCommunicationsHandoff(snapshot.data(), brief);
    if (brief.replyOrigin) {
      const parent = communicationsBriefSchema.parse((await root.collection("briefs").doc(brief.replyOrigin.parentBriefId).get()).data());
      const binding = verifyCommunicationsReplyBinding((await root.collection("replyBindings").doc(digest).get()).data(), brief, parent);
      const parentHandoff = await this.handoff(parent, lineage);
      const receipt = (await root.collection("sendReceipts").doc(binding.sendReceiptKey).get()).data();
      if (!receipt || receipt.state !== "sent" || communicationsDigest(communicationsSentReceiptIdentity(receipt)) !== binding.sendReceiptDigest
        || receipt.approvalLedgerId !== binding.approvalLedgerId || receipt.receipt?.messageId !== binding.outgoingMessageId
        || receipt.receipt?.rfcMessageId !== binding.outgoingRfcMessageId || receipt.receipt?.threadId !== brief.priorConversation?.gmailThreadId
        || communicationsDigest(handoff) !== communicationsDigest({ ...parentHandoff, briefDigest: digest })) {
        throw new Error("reply_parent_receipt_or_handoff_changed");
      }
    }
    return handoff;
  }
  async contactProof(brief: CommunicationsBrief) {
    if (brief.researchOrigin.contactEvidenceKind !== "public_operator_resolution") return undefined;
    const snapshot = await this.db.doc(COMMUNICATIONS_ROOT).collection("contactProofs").doc(brief.researchOrigin.contactEvidenceDigest!).get();
    if (!snapshot.exists || communicationsDigest(snapshot.data()) !== brief.researchOrigin.contactEvidenceDigest) throw new Error("research_contact_proof_missing_or_changed");
    return snapshot.data();
  }
  async enqueue(input: Omit<CommunicationsJob, "jobId">) {
    return this.db.runTransaction(async (tx) => {
      const queued = await prepareCommunicationsEnqueue(tx, this.db, input, this.now());
      queued.commit();
      return queued.record;
    });
  }
  async claim(jobId: string): Promise<CommunicationsJobRecord | null> {
    const ref = this.jobs().doc(jobId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return null;
      const record = snapshot.data() as CommunicationsJobRecord;
      if (record.attempts >= 3 && ["queued", "retry", "running"].includes(record.state) && (record.lease?.until ?? 0) <= this.now()) {
        tx.update(ref, { state: "blocked", reason: "communications_recovery_exhausted", updatedAt: this.now() });
        return null;
      }
      if (!["queued", "retry", "running"].includes(record.state) || record.attempts >= 3
        || (record.nextAttemptAt ?? 0) > this.now() || (record.lease?.until ?? 0) > this.now()) return null;
      const claimed = { ...record, state: "running" as const, attempts: record.attempts + 1,
        lease: { owner: this.owner, until: this.now() + 180000 } };
      tx.update(ref, claimed);
      return claimed;
    });
  }
  async jobsForProspect(prospectId: string) {
    const snapshot = await this.jobs().where("prospectId", "==", prospectId).limit(20).get();
    return snapshot.docs.map(doc => doc.data() as CommunicationsJobRecord);
  }
  async blockedJobs() {
    const root = this.db.doc(COMMUNICATIONS_ROOT);
    const [blocked, budget] = await Promise.all([this.jobs().where("state", "==", "blocked").limit(20).get(),
      root.collection("draftBudgetState").doc("current").get()]);
    // Prioritize the one global accounting hold. An older bounded page of
    // unrelated blocked jobs must not hide a crashed unknown-create owner.
    const recovery: FirebaseFirestore.DocumentSnapshot[] = [];
    const active = budget.data()?.activeAdmissionId;
    if (typeof active === "string" && /^[a-f0-9]{64}$/.test(active)) {
      const admission = (await root.collection("draftBudgetAdmissions").doc(active).get()).data();
      if (admission?.jobId && communicationsDigest({ jobId: admission.jobId }) === active) {
        const saved = await this.jobs().doc(admission.jobId).get(), row = saved.data() as CommunicationsJobRecord | undefined;
        if (saved.exists && row && COMMUNICATIONS_JOB_STATES.includes(row.state) && (row.lease?.until ?? 0) <= this.now()) recovery.push(saved);
      }
    }
    return [...recovery, ...blocked.docs.filter(doc => !recovery.some(saved => saved.id === doc.id))].slice(0, 20).map(doc => {
      const record = doc.data() as CommunicationsJobRecord;
      return { jobId: doc.id, prospectId: record.prospectId, briefDigest: record.briefDigest, state: record.state,
        attempts: record.attempts, reason: record.reason ?? "communications_blocked", leaseUntil: record.lease?.until ?? 0,
        expectedCheckpointDigest: communicationsDigest(record.checkpoint), sessionId: record.checkpoint.sessionId,
        sessionReconciliationRequired: Boolean(record.checkpoint.createClaimedAt && !record.checkpoint.sessionId) };
    });
  }
  /** Explicit operator recovery; retain identity, create claim and attempt budget. */
  async retryBlocked(input: { jobId: string; prospectId: string; briefDigest: string; requestedBy: string }) {
    if (!input.requestedBy.trim()) throw new Error("operator_identity_missing");
    const ref = this.jobs().doc(input.jobId);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      const record = existing.data() as CommunicationsJobRecord | undefined;
      if (!record || record.prospectId !== input.prospectId || record.briefDigest !== input.briefDigest) throw new Error("communications_retry_identity_mismatch");
      if (record.state !== "blocked" || (record.lease?.until ?? 0) > this.now()) throw new Error("communications_retry_state_or_lease_conflict");
      if (record.attempts >= 3) throw new Error("communications_recovery_exhausted");
      if (record.checkpoint.createClaimedAt && !record.checkpoint.sessionId) throw new Error("session_create_requires_reconciliation");
      const sourceRef = this.db.collection("outboundProspects").doc(record.prospectId);
      const source = await tx.get(sourceRef);
      const brief = communicationsBriefSchema.parse((await tx.get(this.db.doc(COMMUNICATIONS_ROOT).collection("briefs").doc(record.briefId))).data());
      if (brief.prospectId !== record.prospectId || communicationsDigest(brief) !== record.briefDigest
        || !source.exists || source.data()?.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
        || source.data()?.siteId !== brief.siteId || source.data()?.taskId !== brief.taskId
        || source.data()?.stage === "closed" || source.data()?.stage === "converted"
        || (record.intent === "outreach" && source.data()?.stage !== "drafted")
        || ["unknown", "opted_out"].includes(brief.consent.status)) throw new Error("communications_retry_context_changed");
      verifyCommunicationsHandoff((await tx.get(this.db.doc(COMMUNICATIONS_ROOT).collection("handoffs").doc(record.briefDigest))).data(), brief);
      const update = { state: "queued" as const, reason: "operator_retry_requested", nextAttemptAt: this.now(),
        lease: { owner: this.owner, until: 0 }, retryRequestedBy: input.requestedBy, retryRequestedAt: this.now(), updatedAt: this.now() };
      tx.update(ref, update);
      tx.set(sourceRef.collection("communicationsEvents").doc(`retry_${record.jobId}_${record.attempts}`), {
        type: "operator_retry_requested", jobId: record.jobId, requestedBy: input.requestedBy,
        recordedAt: this.now(), sent: false, sessionCreated: false,
      });
      return { ...record, ...update };
    });
  }
  /** Lease the same rejected job for an explicitly verified corrected-create
   * action. The original claim and accounting are never cleared or replaced. */
  async claimRejectedCreate(jobId: string, expectedCheckpointDigest: string) {
    const ref = this.jobs().doc(jobId);
    return this.db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!record || record.state !== "blocked" || record.reason !== "agents_api_http_400"
        || !record.checkpoint.createClaimedAt || !record.checkpoint.requestDigest
        || record.checkpoint.sessionId || record.checkpoint.turnId || record.checkpoint.rejectedCreateRecovery
        || communicationsDigest(record.checkpoint) !== expectedCheckpointDigest
        || record.attempts >= 3 || (record.lease?.until ?? 0) > this.now()) {
        throw new Error("communications_rejected_create_binding_changed");
      }
      const claimed = { ...record, state: "running" as const, attempts: record.attempts + 1,
        lease: { owner: this.owner, until: this.now() + 180000 } };
      tx.update(ref, { ...claimed, updatedAt: this.now() });
      return claimed;
    });
  }
  async assertRejectedCreateRecovery(jobId: string, original: CommunicationsCheckpoint,
    intent: CommunicationsRejectedCreateRecoveryIntent) {
    const record = (await this.jobs().doc(jobId).get()).data() as CommunicationsJobRecord | undefined;
    const saved = record?.checkpoint && { ...record.checkpoint };
    if (saved) delete saved.rejectedCreateRecovery;
    if (!record || record.state !== "running" || record.reason !== "agents_api_http_400"
      || record.lease?.owner !== this.owner || record.lease.until <= this.now()
      || record.briefDigest !== intent.briefDigest || communicationsDeliveryKey(record) !== intent.deliveryKey
      || communicationsDigest(saved) !== communicationsDigest(original)) {
      throw new Error("communications_rejected_create_binding_changed");
    }
  }
  /** The caller's trusted direction/proof verification runs before and after
   * this transaction. The existing admission and child checkpoint claim commit
   * together, before the one permitted provider POST. */
  async commitRejectedCreateRecovery(jobId: string, original: CommunicationsCheckpoint,
    recovery: CommunicationsRejectedCreateRecovery,
    claimBudget: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) {
    const ref = this.jobs().doc(jobId);
    await this.db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!record || record.state !== "running" || record.reason !== "agents_api_http_400"
        || record.lease?.owner !== this.owner || record.lease.until <= this.now()
        || record.checkpoint.rejectedCreateRecovery || record.checkpoint.sessionId || record.checkpoint.turnId
        || recovery.originalCheckpointDigest !== communicationsDigest(record.checkpoint)
        || communicationsDigest(record.checkpoint) !== communicationsDigest(original)
        || record.briefDigest !== recovery.intent.briefDigest || communicationsDeliveryKey(record) !== recovery.intent.deliveryKey) {
        throw new Error("communications_rejected_create_binding_changed");
      }
      await claimBudget(tx);
      tx.update(ref, { checkpoint: { ...original, rejectedCreateRecovery: recovery }, updatedAt: this.now() });
    });
  }
  async update(jobId: string, update: Partial<CommunicationsJobRecord>) {
    const ref = this.jobs().doc(jobId);
    await this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!data || data.lease?.owner !== this.owner || data.lease.until <= this.now()) throw new Error("communications_lease_lost");
      tx.update(ref, { ...update, updatedAt: this.now() });
    });
  }
  /** The execution window is immutable; only its current owner's short lease renews. */
  async renewLease(jobId: string, executionWindow: NonNullable<CommunicationsCheckpoint["executionWindow"]>) {
    const ref = this.jobs().doc(jobId);
    return this.db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!record || record.state !== "running" || record.lease?.owner !== this.owner || record.lease.until <= this.now()
        || record.checkpoint.rejectedCreateRecovery
        || communicationsDigest(record.checkpoint.executionWindow ?? null) !== communicationsDigest(executionWindow)
        || Date.parse(executionWindow.deadlineAt) <= this.now()) throw new Error("communications_lease_lost");
      const lease = { owner: this.owner, until: this.now() + 180000 };
      tx.update(ref, { lease });
      return lease;
    });
  }
  async approvalState(prospectId: string) {
    const source = await this.db.collection("outboundProspects").doc(prospectId).get();
    if (!source.exists) throw new Error("canonical_prospect_missing");
    const ledgerId = source.data()?.communications?.ledgerId;
    if (!ledgerId) return { state: "not_requested", ledgerId: null, approvedBy: null, digest: null };
    const ledger = await this.db.collection("action_ledger").doc(ledgerId).get();
    if (!ledger.exists) throw new Error("current_approval_record_missing");
    const data = ledger.data()!;
    return { state: data.status, ledgerId, approvedBy: data.approved_by ?? null,
      digest: data.outreach_semantic_review?.digest ?? null };
  }
  /** Budget holds happen before a fresh session POST and do not consume the
   * recovery-attempt budget or discard discovered prospects. */
  async deferDraftForBudget(jobId: string, reason: string) {
    const ref = this.jobs().doc(jobId);
    await this.db.runTransaction(async tx => {
      const row = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!row || row.lease?.owner !== this.owner || row.checkpoint.createClaimedAt || row.checkpoint.sessionId) throw new Error("communications_budget_hold_context_changed");
      tx.update(ref, { state: "queued", reason, attempts: Math.max(0, row.attempts - 1),
        nextAttemptAt: this.now() + 15 * 60000, lease: { owner: this.owner, until: 0 }, updatedAt: this.now() });
    });
  }
  async recordReply(job: CommunicationsJob, message: ThreadMessage, fetchedAt = new Date(this.now()).toISOString()) {
    const identity = communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"]
      .map(key => [key, (job as any)[key]]))), received = Date.parse(message.receivedAt), observed = Date.parse(fetchedAt);
    if (identity.intent !== "reply" || identity.inboundMessageId !== message.gmailMessageId
      || !Number.isFinite(received) || !Number.isFinite(observed) || received > observed || observed > this.now()) {
      throw new Error("communications_reply_observation_invalid");
    }
    const messageHash = communicationsDigest(message), ref = this.db.collection("outboundProspects").doc(job.prospectId)
      .collection("communicationsEvents").doc(`reply_${message.gmailMessageId}`);
    return this.db.runTransaction(async tx => {
      const previous = await tx.get(ref);
      if (previous.exists) {
        const saved = previous.data()!;
        if (saved.type !== "reply_received" || saved.untrusted !== true || communicationsDigest(saved.message) !== messageHash
          || (saved.messageHash !== undefined && saved.messageHash !== messageHash)) throw new Error("communications_reply_source_changed");
        return "existing";
      }
      tx.create(ref, { version: "blueprint.communications-reply-observation.v1", type: "reply_received",
        jobId: job.jobId, prospectId: job.prospectId, briefId: job.briefId, briefDigest: job.briefDigest,
        message, messageHash, untrusted: true, originalObservedAt: fetchedAt,
        observedAt: new Date(observed).toISOString(), recordedAt: this.now() });
      return "created";
    });
  }
  async requestRefresh(job: CommunicationsJob, reasons: string[]) {
    const ref = this.db.doc(COMMUNICATIONS_ROOT).collection("refreshRequests").doc(job.jobId);
    await ref.set({ job, reasons, owner: "blueprint-research-agent", state: "pending",
      scope: "relevant_claims_only", observerReceiptRequired: false, requestedAt: this.now() });
    await this.finish(job, "awaiting_research", "research_refresh_required");
  }
  async finish(job: CommunicationsJob, state: CommunicationsJobRecord["state"], reason: string) {
    await this.update(job.jobId, { state, reason });
    await this.db.collection("outboundProspects").doc(job.prospectId).collection("communicationsEvents").doc(job.jobId).set({
      type: state, job, reason, recordedAt: this.now(), sent: state === "sent",
    });
  }
  /** Project the authoritative automatic ledger/receipt after execution or a
   * restart. The inference lease does not own send-result persistence: send
   * reservation is separately atomic, and no send can be created here. */
  async finishAutomatic(job: CommunicationsJob, outcome: { state: "sent" | "auto_approved" | "failed"; reason?: string }) {
    const identity = communicationsJobSchema.parse({ jobId: job.jobId, prospectId: job.prospectId,
      briefId: job.briefId, briefDigest: job.briefDigest, intent: job.intent, inboundMessageId: job.inboundMessageId });
    const ref = this.jobs().doc(identity.jobId), ledgerId = `communications_${identity.jobId}`;
    const root = this.db.doc(COMMUNICATIONS_ROOT), sourceRef = this.db.collection("outboundProspects").doc(identity.prospectId);
    return this.db.runTransaction(async tx => {
      const [saved, ledger, receipt] = await Promise.all([tx.get(ref), tx.get(this.db.collection("action_ledger").doc(ledgerId)),
        tx.get(root.collection("sendReceipts").doc(communicationsDeliveryKey(identity)))]);
      const row = saved.data(), action = ledger.data(), delivery = receipt.data();
      const boundJob = action?.action_payload?.communications?.job;
      if (!row || !["auto_approved", "sent", "failed"].includes(row.state)
        || row.prospectId !== identity.prospectId || row.briefDigest !== identity.briefDigest || row.ledgerId !== ledgerId
        || !action?.first_contact_authority || action.lane !== "outbound_prospect" || action.source_collection !== "outboundProspects"
        || action.source_doc_id !== identity.prospectId || action.action_type !== "send_email"
        || communicationsDigest(boundJob ?? null) !== communicationsDigest(identity)) throw new Error("communications_automatic_result_context_changed");
      const sent = action.status === "sent" && delivery?.state === "sent" && delivery.jobId === identity.jobId
        && delivery.approvalLedgerId === ledgerId && delivery.payloadDigest === communicationsDigest(action.action_payload)
        && !!delivery.receipt?.messageId && !!delivery.receipt?.threadId;
      const state = sent ? "sent" as const : outcome.state;
      if (!sent && (state === "sent" || row.state === "sent"
        || (state === "failed" && action.status !== "failed")
        || (state === "auto_approved" && !["auto_approved", "executing", "failed"].includes(action.status)))) {
        throw new Error("communications_automatic_result_unverified");
      }
      const reason = sent ? "sent" : outcome.reason ?? state;
      tx.update(ref, { state, reason, updatedAt: this.now() });
      tx.set(sourceRef.collection("communicationsEvents").doc(identity.jobId), {
        type: state, job: identity, reason, ledgerId, recordedAt: this.now(), sent,
      });
      return { state, reason };
    });
  }
  async commitDraft(job: CommunicationsJob, output: CommunicationsOutput, payload: ActionPayload, reviewDigest: string, usage: unknown) {
    const jobRef = this.jobs().doc(job.jobId);
    const ledgerId = `communications_${job.jobId}`;
    const ledgerRef = this.db.collection("action_ledger").doc(ledgerId);
    const sourceRef = this.db.collection("outboundProspects").doc(job.prospectId);
    const briefRef = this.db.doc(COMMUNICATIONS_ROOT).collection("briefs").doc(job.briefId);
    const proposedAuthority = automaticFirstContactEnabled() ? firstContactAuthority(payload, this.now()) : null;
    await this.db.runTransaction(async (tx) => {
      const [current, existing, source, brief] = await Promise.all([tx.get(jobRef), tx.get(ledgerRef), tx.get(sourceRef), tx.get(briefRef)]);
      const record = current.data() as CommunicationsJobRecord | undefined;
      if (!record || record.lease?.owner !== this.owner || record.lease.until <= this.now()) throw new Error("communications_lease_lost");
      if (!source.exists || source.data()?.contactEmail?.toLowerCase() !== payload.to
        || source.data()?.stage === "closed" || (job.intent === "outreach" && source.data()?.stage !== "drafted")
        || communicationsDigest(communicationsBriefSchema.parse(brief.data())) !== job.briefDigest) throw new Error("canonical_context_changed");
      if (existing.exists && communicationsDigest(existing.data()?.action_payload) !== communicationsDigest(payload)) throw new Error("draft_idempotency_conflict");
      let authority = proposedAuthority;
      if (record.automationPolicyVersion !== ROUTINE_COMMUNICATIONS_POLICY.version) authority = null;
      const prospective = record.automationPolicyVersion === ROUTINE_COMMUNICATIONS_POLICY.version && !existing.exists;
      let refusal: string | null = null;
      if (prospective && !authority) {
        const quality = reviewCommunicationsPayload(payload, this.now());
        refusal = !automaticFirstContactEnabled() ? "automatic_first_contact_disabled"
          : !firstContactPostalLine() ? "first_contact_postal_footer_unavailable"
          : !quality.hardChecksPassed ? `draft_quality_failed:${quality.blockers.join(",")}`
          : (payload.recipientGeography as any)?.countryCode !== "US" ? "routine_recipient_geography_not_authorized"
          : routineCommunicationsContentBlockers(output, job.intent)[0] ?? "routine_source_scope_or_evidence_not_authorized";
      }
      if (authority) {
        const approvedBrief = communicationsBriefSchema.parse(brief.data());
        const root = this.db.doc(COMMUNICATIONS_ROOT);
        const provenance = (await tx.get(root.collection("researchSources").doc(job.briefDigest))).data();
        const handoff = (await tx.get(root.collection("handoffs").doc(job.briefDigest))).data();
        const proof = approvedBrief.researchOrigin.contactEvidenceKind === "public_operator_resolution"
          ? (await tx.get(root.collection("contactProofs").doc(approvedBrief.researchOrigin.contactEvidenceDigest!))).data() : undefined;
        try {
          verifyCommunicationsHandoff(handoff, approvedBrief);
          if (job.intent === "reply") {
            if (!approvedBrief.replyOrigin) throw new Error("reply_parent_context_changed");
            const parent = communicationsBriefSchema.parse((await tx.get(root.collection("briefs").doc(approvedBrief.replyOrigin.parentBriefId))).data());
            const binding = verifyCommunicationsReplyBinding((await tx.get(root.collection("replyBindings").doc(job.briefDigest))).data(), approvedBrief, parent);
            const receipt = (await tx.get(root.collection("sendReceipts").doc(binding.sendReceiptKey))).data();
            if (communicationsDigest(communicationsSentReceiptIdentity(receipt)) !== binding.sendReceiptDigest
              || receipt?.approvalLedgerId !== binding.approvalLedgerId
              || receipt?.receipt?.threadId !== approvedBrief.priorConversation?.gmailThreadId) throw new Error("reply_parent_receipt_or_handoff_changed");
          }
          verifyFirstContactSource(provenance, approvedBrief, proof, payload.recipientGeography, this.now());
          if (source.data()?.researchPublicationId !== provenance?.source?.sheetsProspectId
            || authority.reviewDigest !== reviewDigest) throw new Error("first_contact_source_missing_or_changed");
        } catch (error) {
          authority = null;
          refusal = error instanceof Error && /^[a-z_][a-z0-9_:,.-]*$/.test(error.message)
            ? error.message === "first_contact_geography_requires_review" ? "routine_recipient_geography_not_authorized" : error.message
            : "routine_source_scope_or_evidence_not_authorized";
        }
      }
      const authorityDigest = authority ? communicationsDigest(authority) : null;
      const authorityRef = authorityDigest ? this.db.doc(COMMUNICATIONS_ROOT).collection("firstContactAuthorities").doc(authorityDigest) : null;
      const savedAuthority = authorityRef ? await tx.get(authorityRef) : null;
      if (savedAuthority?.exists && communicationsDigest(savedAuthority.data()) !== authorityDigest) throw new Error("first_contact_authority_immutable_conflict");
      // Existing approvals/rejections are never silently promoted or rewritten.
      const automatic = !existing.exists ? !!authority : !!existing.data()?.first_contact_authority;
      const policyBlocked = prospective && !automatic;
      const state = automatic ? "auto_approved" : policyBlocked ? "blocked" : "pending_approval";
      const now = new Date(this.now());
      if (!existing.exists) tx.create(ledgerRef, {
        idempotency_key: `communications:${job.jobId}`, lane: "outbound_prospect", action_type: "send_email", action_tier: automatic ? 1 : 3,
        source_collection: "outboundProspects", source_doc_id: job.prospectId,
        action_payload: payload, draft_output: { ...output, requires_human_review: !prospective, category: "communications" },
        status: policyBlocked ? "failed" : state, approval_reason: policyBlocked ? refusal : automatic ? null : "requires_human_review",
        auto_approve_reason: automatic ? authority?.kind : null,
        ...(automatic ? { first_contact_authority: authority, first_contact_authority_digest: authorityDigest } : {}),
        approved_by: null, approved_at: null, rejected_by: null, rejected_reason: null,
        execution_attempts: 0, last_execution_error: policyBlocked ? refusal : null, last_execution_at: null, sent_at: null, created_at: now, updated_at: now,
      });
      if (authority && !existing.exists && authorityRef && !savedAuthority?.exists) tx.create(authorityRef, authority);
      tx.update(jobRef, { state, output, usage, ledgerId, reviewDigest, ...(policyBlocked ? { reason: refusal } : {}), updatedAt: this.now() });
      tx.set(sourceRef, { communications: { jobId: job.jobId, ledgerId, briefId: job.briefId, briefDigest: job.briefDigest,
        state, draft: output, reviewDigest, gmailDraftId: null, updatedAt: this.now() } }, { merge: true });
      tx.set(sourceRef.collection("communicationsEvents").doc(job.jobId), {
        type: "draft_persisted", job, output, ledgerId, reviewDigest, state, ...(policyBlocked ? { reason: refusal } : {}),
        ...(automatic ? { firstContactAuthorityDigest: authorityDigest } : {}), sent: false, gmailDraftCreated: false, recordedAt: this.now(),
      });
    });
    return ledgerId;
  }
  async automaticDraft(ledgerId: string) {
    const ledger = (await this.db.collection("action_ledger").doc(ledgerId).get()).data();
    return !!ledger?.first_contact_authority && ledger.status === "auto_approved";
  }
  async automaticJobs(limit = 5, afterJobId?: string) {
    const query = this.jobs().where("state", "==", "auto_approved").orderBy("__name__");
    let snapshot = await (afterJobId ? query.startAfter(afterJobId) : query).limit(limit).get();
    // Retained uncertain acknowledgements and long-lived holds cannot occupy
    // every page. Wrap only at the end of a bounded ordered recovery pass.
    if (snapshot.empty && afterJobId) snapshot = await query.limit(limit).get();
    return snapshot.docs.map(doc => doc.data() as CommunicationsJobRecord);
  }
  async dueJobIds(limit = 5) {
    const snapshot = await this.jobs().where("state", "in", ["queued", "retry", "running"]).limit(100).get();
    const due: string[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if ((data.nextAttemptAt ?? 0) > this.now() || (data.lease?.until ?? 0) > this.now()) continue;
      if (data.attempts >= 3) { await this.claim(doc.id); continue; }
      if (due.length < limit) due.push(doc.id);
    }
    return due;
  }
}
