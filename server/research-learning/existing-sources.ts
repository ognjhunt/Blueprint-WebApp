import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest,
  communicationsDeliveryKey, verifyCommunicationsHandoff,
  communicationsEnvelopeSchema,
} from "../agents/communications-contract";
import { authorize, entitiesSchema, makeEvent, type LearningEvent, type LearningGrant, type SnapshotRequest } from "./contract";
import { eventSection } from "./snapshot";

const ROOT = "blueprintCommunications/default";
export type ExistingJob = { id: string; record: unknown; brief?: unknown; handoff?: unknown; researchSource?: any; receipt?: any; ledger?: any };
export type ExistingProspectSources = {
  prospectId: string; prospect: any; jobs: ExistingJob[];
  communicationsEvents: { id: string; record: any }[];
};
export type Quarantine = { recordRef: string; reason: string };

/** Consumes only exact Firestore-owned joins. No mailbox search, auth expansion,
 * model classification or source writes. Legacy reply meaning stays unknown. */
export function normalizeExistingSources(sources: ExistingProspectSources[], recordedAt: string) {
  const events: LearningEvent[] = [], quarantine: Quarantine[] = [], observedSourceRefs: string[] = [];
  for (const input of sources) {
    const sourceRef = `outboundProspects/${input.prospectId}`;
    observedSourceRefs.push(sourceRef);
    if (!input.prospect) { quarantine.push({ recordRef: sourceRef, reason: "canonical_prospect_missing" }); continue; }
    for (const bundle of input.jobs) {
      const jobRef = `${ROOT}/jobs/${bundle.id}`;
      observedSourceRefs.push(jobRef);
      const start = events.length;
      try {
        const job = communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"].map(k => [k, (bundle.record as any)?.[k]])));
        // Existing job documents include state/checkpoint fields; parse only
        // their contract-owned identity, not model output or free-form notes.
        if (job.jobId !== bundle.id || job.prospectId !== input.prospectId) throw new Error("join_invalid");
        const brief = communicationsBriefSchema.parse(bundle.brief);
        const handoff = verifyCommunicationsHandoff(bundle.handoff, brief);
        const source = bundle.researchSource?.source;
        if (brief.prospectId !== input.prospectId || job.briefId !== brief.briefId || job.briefDigest !== communicationsDigest(brief)
          || input.prospect.siteId !== brief.siteId || input.prospect.taskId !== brief.taskId
          || input.prospect.caseId !== brief.caseId
          || !source || bundle.researchSource.briefDigest !== job.briefDigest
          || source.version !== "blueprint.communications-research-source.v1" || source.date !== brief.researchOrigin.date
          || source.candidateKey !== brief.researchOrigin.candidateKey || source.packetDigest !== brief.researchOrigin.packetDigest
          || source.rawArtifactDigest !== brief.researchOrigin.rawArtifactDigest
          || brief.researchOrigin.sourceDigest !== communicationsDigest(source)
          || source.sheetsProspectId !== input.prospect.researchPublicationId
          || source.sheetsReceipt !== handoff.sheetsReceipt || source.notionReceipt !== handoff.notionReceipt) throw new Error("join_invalid");
        if (input.prospect.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()) {
          quarantine.push({ recordRef: sourceRef, reason: "historical_contact_change_requires_reconciliation" });
        }
        const entities = entitiesSchema.parse({ prospectId: input.prospectId, crmId: input.prospect.researchPublicationId ?? null,
          companyId: input.prospect.companyId ?? null, siteId: brief.siteId, taskId: brief.taskId,
          caseId: brief.caseId,
          teamIds: brief.teamIds, capabilityIds: brief.capabilityIds });
        const common = { entities, recordedAt, actorId: "firestore-learning-adapter", correctsEventId: null };
        const researchRef = `${ROOT}/researchSources/${job.briefDigest}`;
        observedSourceRefs.push(researchRef);
        events.push(makeEvent({ ...common, writer: "research_adapter", kind: "research_observed", occurredAt: brief.qualityReview.reviewedAt,
          // No industry/geography inference from free text. Missing structured
          // cohort metadata remains explicit until the research owner supplies it.
          data: { city: source.candidate.city ?? "unknown", industry: source.candidate.industry ?? "unknown", factIds: brief.facts.map(f => f.id),
            factChecks: brief.facts.map(f => ({ factId: f.id, sourceHash: communicationsDigest(f), grade: f.evidenceClass,
              sourceCheckedAt: new Date(f.sourceCheckedAt).toISOString() })) },
          evidence: [{ sourceSystem: "firestore", recordRef: researchRef, sourceHash: communicationsDigest(bundle.researchSource),
            checkedAt: brief.qualityReview.reviewedAt, basis: "public_research" }] }));
        events.push(makeEvent({ ...common, writer: "research_adapter", kind: "contact_observed", occurredAt: brief.qualityReview.reviewedAt,
          data: { availability: ["public_business_contact", "reply_requested"].includes(brief.consent.status) ? "verified_business_route" : "unverified" },
          evidence: [{ sourceSystem: "firestore", recordRef: `${ROOT}/briefs/${brief.briefId}`, sourceHash: job.briefDigest,
            checkedAt: new Date(brief.contact.sourceCheckedAt).toISOString(), basis: "contact_proof" }] }));
        if (bundle.receipt) {
          const receipt = bundle.receipt, ledger = bundle.ledger;
          const ref = `${ROOT}/sendReceipts/${communicationsDeliveryKey(job)}`;
          observedSourceRefs.push(ref);
          const envelope = communicationsEnvelopeSchema.parse(ledger?.action_payload?.communications);
          if (receipt.jobId !== job.jobId || !["attempting", "unknown", "sent"].includes(receipt.state)
            || !ledger?.action_payload || communicationsDigest(ledger.action_payload) !== receipt.payloadDigest
            || receipt.approvalLedgerId !== `communications_${job.jobId}`
            || communicationsDigest(envelope.job) !== communicationsDigest(job)
            || communicationsDigest(envelope.brief) !== job.briefDigest
            || ledger.action_payload.to?.toLowerCase() !== brief.contact.email.toLowerCase()
            || ledger.action_payload.subject !== envelope.output.subject || ledger.action_payload.body !== envelope.output.body
            || typeof ledger.action_payload.transportBody !== "string") throw new Error("receipt_join_invalid");
          const status = receipt.state === "sent" ? "accepted" : receipt.state === "attempting" ? "attempted" : "unknown";
          const at = status === "accepted" ? receipt.sentAt : receipt.attemptedAt;
          events.push(makeEvent({ ...common, writer: "communications_adapter", kind: "outreach_observed", occurredAt: at,
            data: { jobId: job.jobId, outreachVersion: "blueprint.outreach.v1", intent: job.intent,
              payloadDigest: receipt.payloadDigest, approvalLedgerId: receipt.approvalLedgerId,
              // Copy controls use the approved pre-footer copy. Full payload
              // and receipt hashes still retain recipient-specific transport evidence.
              messageDigest: communicationsDigest({ subject: envelope.output.subject, body: envelope.output.body }), messageVariant: null,
              messageId: receipt.receipt?.messageId ?? null, threadId: receipt.receipt?.threadId ?? null,
              status, campaignId: null, timingWindow: null },
            evidence: [{ sourceSystem: "firestore", recordRef: ref, sourceHash: communicationsDigest(receipt), checkedAt: at,
              basis: status === "accepted" ? "provider_acceptance" : "send_attempt" }] }));
        }
        for (const item of input.communicationsEvents.filter(e => e.record.type === "reply_received" && e.record.jobId === job.jobId)) {
          const ref = `${sourceRef}/communicationsEvents/${item.id}`;
          observedSourceRefs.push(ref);
          const reply = item.record.message;
          const sentRefs = input.communicationsEvents.filter(e => e.record.type === "sent"
            && e.record.job?.prospectId === input.prospectId && brief.priorConversation?.gmailMessageIds.includes(e.record.receipt?.messageId)
            && e.record.receipt?.threadId === reply?.gmailThreadId);
          if (item.record.untrusted !== true || job.intent !== "reply" || job.inboundMessageId !== reply?.gmailMessageId
            || item.id !== `reply_${job.inboundMessageId}` || !brief.priorConversation
            || reply.gmailThreadId !== brief.priorConversation.gmailThreadId
            || reply.from?.toLowerCase() !== brief.contact.email.toLowerCase()
            || !sentRefs.some(e => e.record.receipt.rfcMessageId && (reply.inReplyTo === e.record.receipt.rfcMessageId || reply.references?.includes(e.record.receipt.rfcMessageId)))
            || !reply.to?.some((to: string) => ["nijel@tryblueprint.io", "hello@tryblueprint.io"].includes(to.toLowerCase()))) throw new Error("reply_join_invalid");
          events.push(makeEvent({ ...common, writer: "communications_adapter", kind: "reply_observed", occurredAt: reply.receivedAt,
            data: { jobId: job.jobId, outreachVersion: "blueprint.outreach.v1", messageId: reply.gmailMessageId, threadId: reply.gmailThreadId,
              classification: { label: "unknown", interest: "unknown", objections: [], confidence: 0, method: "legacy_unknown", uncertain: true } },
            evidence: [{ sourceSystem: "firestore", recordRef: ref, sourceHash: communicationsDigest(item.record),
              checkedAt: reply.receivedAt, basis: "correlated_reply" }] }));
        }
      } catch {
        events.splice(start);
        quarantine.push({ recordRef: jobRef, reason: "source_contract_or_exact_join_invalid" });
      }
    }
  }
  // Repeated brief revisions/jobs can refer to the same research evidence.
  return { events: [...new Map(events.map(e => [e.eventId, e])).values()], quarantine,
    observedSourceRefs: [...new Set(observedSourceRefs)].sort() };
}

/** Harmless reads through the existing Firestore binding. Never reads Gmail or
 * OAuth documents. The caller must authorize the explicit prospect list first. */
export async function readExistingSources(db: FirebaseFirestore.Firestore, grant: LearningGrant, request: SnapshotRequest, now: string) {
  const { request: authorized } = authorize(grant, request, now);
  const inputs: ExistingProspectSources[] = [], readQuarantine: Quarantine[] = [];
  for (const prospectId of authorized.prospectIds) {
    entitiesSchema.shape.prospectId.parse(prospectId);
    const prospectRef = db.collection("outboundProspects").doc(prospectId);
    const prospect = await prospectRef.get();
    const jobs = await db.doc(ROOT).collection("jobs").where("prospectId", "==", prospectId).limit(101).get();
    const communications = authorized.sections.includes("replies") ? await prospectRef.collection("communicationsEvents").limit(501).get() : undefined;
    if (jobs.size > 100 || (communications?.size ?? 0) > 500) throw new Error("learning_source_export_required");
    const bundles: ExistingJob[] = [];
    for (const job of jobs.docs) {
      const record = job.data();
      const identity = communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"].map(k => [k, record[k]])));
      const brief = await db.doc(ROOT).collection("briefs").doc(identity.briefId).get();
      const handoff = await db.doc(ROOT).collection("handoffs").doc(identity.briefDigest).get();
      const source = await db.doc(ROOT).collection("researchSources").doc(identity.briefDigest).get();
      const receipt = authorized.sections.includes("outreach") ? await db.doc(ROOT).collection("sendReceipts").doc(communicationsDeliveryKey(identity)).get() : undefined;
      if (receipt?.exists && !jobs.docs.some(job => job.id === receipt.data()?.jobId)) {
        readQuarantine.push({ recordRef: `${ROOT}/sendReceipts/${communicationsDeliveryKey(identity)}`, reason: "orphan_or_legacy_receipt_requires_reconciliation" });
      }
      const ledger = receipt?.exists && receipt.data()?.jobId === identity.jobId ? await db.collection("action_ledger").doc(`communications_${identity.jobId}`).get() : undefined;
      bundles.push({ id: job.id, record: identity, brief: brief.data(), handoff: handoff.data(), researchSource: source.data(),
        receipt: receipt?.data()?.jobId === identity.jobId ? receipt?.data() : undefined, ledger: ledger?.data() });
    }
    inputs.push({ prospectId, prospect: prospect.data(), jobs: bundles, communicationsEvents: communications?.docs.map(doc => ({ id: doc.id, record: doc.data() })) ?? [] });
  }
  const normalized = normalizeExistingSources(inputs, now);
  // The public reader boundary returns structured authorized events only.
  return { ...normalized, quarantine: [...readQuarantine, ...normalized.quarantine], events: normalized.events.filter(e => authorized.sections.includes(eventSection(e))) };
}
