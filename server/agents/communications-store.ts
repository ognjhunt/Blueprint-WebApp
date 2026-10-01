import { randomUUID } from "node:crypto";
import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest,
  type CommunicationsBrief, type CommunicationsJob, type CommunicationsOutput,
  verifyCommunicationsHandoff, communicationsDeliveryKey,
} from "./communications-contract";
import type { CommunicationsCheckpoint } from "./communications-api";
import type { ActionPayload } from "./action-policies";

export const COMMUNICATIONS_ROOT = "blueprintCommunications/default";
export type CommunicationsJobRecord = CommunicationsJob & {
  state: "queued" | "running" | "retry" | "blocked" | "awaiting_research" | "pending_approval" | "no_reply" | "opted_out" | "superseded";
  attempts: number; checkpoint: CommunicationsCheckpoint; output?: CommunicationsOutput;
  lease?: { owner: string; until: number }; nextAttemptAt?: number; reason?: string;
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
  async handoff(brief: CommunicationsBrief) {
    const snapshot = await this.db.doc(COMMUNICATIONS_ROOT).collection("handoffs").doc(communicationsDigest(brief)).get();
    return verifyCommunicationsHandoff(snapshot.data(), brief);
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
    const snapshot = await this.jobs().where("state", "==", "blocked").limit(20).get();
    return snapshot.docs.map(doc => {
      const record = doc.data() as CommunicationsJobRecord;
      return { jobId: doc.id, prospectId: record.prospectId, briefDigest: record.briefDigest,
        attempts: record.attempts, reason: record.reason ?? "communications_blocked", leaseUntil: record.lease?.until ?? 0 };
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
  async update(jobId: string, update: Partial<CommunicationsJobRecord>) {
    const ref = this.jobs().doc(jobId);
    await this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
      if (!data || data.lease?.owner !== this.owner || data.lease.until <= this.now()) throw new Error("communications_lease_lost");
      tx.update(ref, { ...update, updatedAt: this.now() });
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
  async recordReply(job: CommunicationsJob, message: unknown) {
    await this.db.collection("outboundProspects").doc(job.prospectId).collection("communicationsEvents").doc(`reply_${job.inboundMessageId}`).set({
      type: "reply_received", jobId: job.jobId, message, untrusted: true,
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
      type: state, job, reason, recordedAt: this.now(), sent: false,
    });
  }
  async commitDraft(job: CommunicationsJob, output: CommunicationsOutput, payload: ActionPayload, reviewDigest: string, usage: unknown) {
    const jobRef = this.jobs().doc(job.jobId);
    const ledgerId = `communications_${job.jobId}`;
    const ledgerRef = this.db.collection("action_ledger").doc(ledgerId);
    const sourceRef = this.db.collection("outboundProspects").doc(job.prospectId);
    const briefRef = this.db.doc(COMMUNICATIONS_ROOT).collection("briefs").doc(job.briefId);
    await this.db.runTransaction(async (tx) => {
      const [current, existing, source, brief] = await Promise.all([tx.get(jobRef), tx.get(ledgerRef), tx.get(sourceRef), tx.get(briefRef)]);
      const record = current.data() as CommunicationsJobRecord | undefined;
      if (!record || record.lease?.owner !== this.owner || record.lease.until <= this.now()) throw new Error("communications_lease_lost");
      if (!source.exists || source.data()?.contactEmail?.toLowerCase() !== payload.to
        || source.data()?.stage === "closed" || (job.intent === "outreach" && source.data()?.stage !== "drafted")
        || communicationsDigest(communicationsBriefSchema.parse(brief.data())) !== job.briefDigest) throw new Error("canonical_context_changed");
      if (existing.exists && communicationsDigest(existing.data()?.action_payload) !== communicationsDigest(payload)) throw new Error("draft_idempotency_conflict");
      const now = new Date(this.now());
      if (!existing.exists) tx.create(ledgerRef, {
        idempotency_key: `communications:${job.jobId}`, lane: "outbound_prospect", action_type: "send_email", action_tier: 3,
        source_collection: "outboundProspects", source_doc_id: job.prospectId,
        action_payload: payload, draft_output: { ...output, requires_human_review: true, category: "communications" },
        status: "pending_approval", approval_reason: "communications_sending_disabled",
        auto_approve_reason: null, approved_by: null, approved_at: null, rejected_by: null, rejected_reason: null,
        execution_attempts: 0, last_execution_error: null, last_execution_at: null, sent_at: null, created_at: now, updated_at: now,
      });
      tx.update(jobRef, { state: "pending_approval", output, usage, ledgerId, reviewDigest, updatedAt: this.now() });
      tx.set(sourceRef, { communications: { jobId: job.jobId, ledgerId, briefId: job.briefId, briefDigest: job.briefDigest,
        state: "pending_approval", draft: output, reviewDigest, gmailDraftId: null, updatedAt: this.now() } }, { merge: true });
      tx.set(sourceRef.collection("communicationsEvents").doc(job.jobId), {
        type: "draft_persisted", job, output, ledgerId, reviewDigest, sent: false, gmailDraftCreated: false, recordedAt: this.now(),
      });
    });
    return ledgerId;
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
