import { readQueryPages } from "./query-pages";
import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest,
  communicationsDeliveryKey, verifyCommunicationsHandoff,
  communicationsEnvelopeSchema,
} from "../agents/communications-contract";
import { authorize, cohortLabel, entitiesSchema, instant, makeEvent, type LearningEvent, type LearningGrant, type SnapshotRequest } from "./contract";
import { eventSection } from "./snapshot";
import { verifyPublishedResearch } from "../agents/communications-research";
import { REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { projectBriefResearch } from "./brief-projection";

const ROOT = "blueprintCommunications/default";
export type ExistingJob = { id: string; record: unknown; brief?: unknown; handoff?: unknown; researchSource?: any; reviewedSnapshot?: unknown; contactProof?: unknown; receipt?: any; ledger?: any };
export type ExistingProspectSources = {
  prospectId: string; prospect: any; jobs: ExistingJob[];
  communicationsEvents: { id: string; record: any }[];
};
export type Quarantine = { recordRef: string; reason: string };
export function frozenSourceVersionIssue(snapshot: FirebaseFirestore.DocumentSnapshot, asOf: string) {
  if (!snapshot.exists) return "required_source_missing_at_frozen_cutoff";
  const cutoff = Date.parse(asOf), seconds = Math.floor(cutoff/1000), nanos = (cutoff-seconds*1000)*1000000;
  const time = snapshot.updateTime;
  if (!time || !Number.isSafeInteger(time.seconds) || !Number.isSafeInteger(time.nanoseconds)) return "source_version_time_unknown";
  return time.seconds > seconds || (time.seconds === seconds && time.nanoseconds > nanos) ? "source_version_after_frozen_cutoff" : null;
}

/** Consumes only exact Firestore-owned joins. No mailbox search, auth expansion,
 * model classification or source writes. Legacy reply meaning stays unknown. */
export function normalizeExistingSources(sources: ExistingProspectSources[], recordedAt: string) {
  const events: LearningEvent[] = [], quarantine: Quarantine[] = [], observedSourceRefs: string[] = [];
  const researchDetails: ReturnType<typeof projectBriefResearch>[] = [];
  for (const input of sources) {
    const sourceRef = `outboundProspects/${input.prospectId}`;
    observedSourceRefs.push(sourceRef);
    if (!input.prospect) { quarantine.push({ recordRef: sourceRef, reason: "canonical_prospect_missing" }); continue; }
    const communicationsEvents = input.communicationsEvents.filter(item => {
      if (item.record && typeof item.record === "object") return true;
      quarantine.push({ recordRef: `${sourceRef}/communicationsEvents/${item.id}`,
        reason: "communications_event_invalid_reconcile_original_record_identity" });
      return false;
    });
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
          || !["blueprint.communications-research-source.v1", "blueprint.communications-reviewed-source.v1"].includes(source.version) || source.date !== brief.researchOrigin.date
          || source.candidateKey !== brief.researchOrigin.candidateKey || source.packetDigest !== brief.researchOrigin.packetDigest
          || source.rawArtifactDigest !== brief.researchOrigin.rawArtifactDigest
          || brief.researchOrigin.sourceDigest !== communicationsDigest(source)
          || source.sheetsProspectId !== input.prospect.researchPublicationId
          || source.sheetsReceipt !== handoff.sheetsReceipt || source.notionReceipt !== handoff.notionReceipt) throw new Error("join_invalid");
        const reviewed = source.version === "blueprint.communications-reviewed-source.v1";
        if (reviewed) {
          if (!brief.researchOrigin.admissionId || source.admissionId !== brief.researchOrigin.admissionId
            || source.recordReceipt !== handoff.recordReceipt) throw new Error("reviewed_join_invalid");
          verifyPublishedResearch(bundle.reviewedSnapshot, brief, handoff, bundle.contactProof);
        } else if (brief.researchOrigin.admissionId) throw new Error("reviewed_source_missing");
        if (input.prospect.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()) {
          quarantine.push({ recordRef: sourceRef, reason: "historical_contact_change_requires_reconciliation" });
        }
        const entities = entitiesSchema.parse({ prospectId: input.prospectId,
          // Reviewed-report publication keys are Blueprint-owned admission IDs,
          // not invented BP CRM rows. Preserve that distinction in event joins.
          crmId: reviewed ? /^BP-\d{6}$/.test(input.prospect.crmId ?? "") ? input.prospect.crmId : null : input.prospect.researchPublicationId ?? null,
          companyId: input.prospect.companyId ?? null, siteId: brief.siteId, taskId: brief.taskId,
          caseId: brief.caseId,
          teamIds: brief.teamIds, capabilityIds: brief.capabilityIds });
        const common = { entities, recordedAt, actorId: "firestore-learning-adapter", correctsEventId: null };
        const researchRef = `${ROOT}/researchSources/${job.briefDigest}`;
        observedSourceRefs.push(researchRef);
        const cohort: Record<"city" | "industry", string> = { city: "unknown", industry: "unknown" };
        for (const field of ["city", "industry"] as const) {
          const value = source.candidate[field];
          if (value == null) continue;
          const parsed = cohortLabel.safeParse(value);
          if (parsed.success) cohort[field] = parsed.data;
          else quarantine.push({ recordRef: researchRef, reason: `cohort_${field}_invalid_reconcile_public_label` });
        }
        events.push(makeEvent({ ...common, writer: "research_adapter", kind: "research_observed", occurredAt: brief.qualityReview.reviewedAt,
          // No industry/geography inference from free text. Missing structured
          // cohort metadata remains explicit until the research owner supplies it.
          data: { city: cohort.city, industry: cohort.industry, factIds: brief.facts.map(f => f.id),
            factChecks: brief.facts.map(f => ({ factId: f.id, sourceHash: communicationsDigest(f), grade: f.evidenceClass,
              sourceCheckedAt: new Date(f.sourceCheckedAt).toISOString() })) },
          evidence: [{ sourceSystem: "firestore", recordRef: researchRef, sourceHash: communicationsDigest(bundle.researchSource),
            checkedAt: brief.qualityReview.reviewedAt, basis: "public_research" }] }));
        events.push(makeEvent({ ...common, writer: "research_adapter", kind: "contact_observed", occurredAt: brief.qualityReview.reviewedAt,
          data: { availability: ["public_business_contact", "reply_requested"].includes(brief.consent.status) ? "verified_business_route" : "unverified" },
          evidence: [{ sourceSystem: "firestore", recordRef: `${ROOT}/briefs/${brief.briefId}`, sourceHash: job.briefDigest,
            checkedAt: new Date(brief.contact.sourceCheckedAt).toISOString(), basis: "contact_proof" }] }));
        researchDetails.push(projectBriefResearch(brief));
        if (bundle.receipt) {
          const receiptStart = events.length;
          const receiptRef = `${ROOT}/sendReceipts/${communicationsDeliveryKey(job)}`;
          try {
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
          } catch {
            events.splice(receiptStart);
            quarantine.push({ recordRef: receiptRef,
              reason: "receipt_evidence_invalid_reconcile_exact_job_payload_and_gmail_refs" });
          }
        }
        for (const item of communicationsEvents.filter(e => e.record.type === "reply_received" && e.record.jobId === job.jobId)) {
          const ref = `${sourceRef}/communicationsEvents/${item.id}`;
          observedSourceRefs.push(ref);
          try {
            const reply = item.record.message;
            const sentRefs = communicationsEvents.filter(e => e.record.type === "sent"
              && e.record.job?.prospectId === input.prospectId && brief.priorConversation?.gmailMessageIds.includes(e.record.receipt?.messageId)
              && e.record.receipt?.threadId === reply?.gmailThreadId);
            // The worker also records an earlier correlated opt-out under this
            // job. Its own immutable Gmail identity need not be the job trigger.
            if (item.record.untrusted !== true || job.intent !== "reply" || !job.inboundMessageId || !reply
              || item.id !== `reply_${reply.gmailMessageId}` || !brief.priorConversation
              || reply.gmailThreadId !== brief.priorConversation.gmailThreadId
              || reply.from?.toLowerCase() !== brief.contact.email.toLowerCase()
              || !sentRefs.some(e => e.record.receipt.rfcMessageId && (reply.inReplyTo === e.record.receipt.rfcMessageId || reply.references?.includes(e.record.receipt.rfcMessageId)))
              || !reply.to?.some((to: string) => ["nijel@tryblueprint.io", "hello@tryblueprint.io"].includes(to.toLowerCase()))) throw new Error("reply_join_invalid");
            events.push(makeEvent({ ...common, writer: "communications_adapter", kind: "reply_observed", occurredAt: reply.receivedAt,
              data: { jobId: job.jobId, outreachVersion: "blueprint.outreach.v1", messageId: reply.gmailMessageId, threadId: reply.gmailThreadId,
                classification: { label: "unknown", interest: "unknown", objections: [], confidence: 0, method: "legacy_unknown", uncertain: true } },
              evidence: [{ sourceSystem: "firestore", recordRef: ref, sourceHash: communicationsDigest(item.record),
                checkedAt: reply.receivedAt, basis: "correlated_reply" }] }));
          } catch {
            quarantine.push({ recordRef: ref,
              reason: "reply_evidence_invalid_reconcile_exact_message_thread_and_rfc_refs" });
          }
        }
      } catch {
        events.splice(start);
        quarantine.push({ recordRef: jobRef, reason: "source_contract_or_exact_join_invalid" });
      }
    }
  }
  // Repeated brief revisions/jobs can refer to the same research evidence.
  return { events: [...new Map(events.map(e => [e.eventId, e])).values()], researchDetails: [...new Map(researchDetails.map(record => [record.briefHash, record])).values()], quarantine,
    observedSourceRefs: [...new Set(observedSourceRefs)].sort() };
}

/** Harmless reads through the existing Firestore binding. Never reads Gmail or
 * OAuth documents. The caller must authorize the explicit prospect list first. */
export async function readExistingSources(db: FirebaseFirestore.Firestore, grant: LearningGrant, request: SnapshotRequest, now: string,
  options?: { frozenAsOf: string }) {
  const { request: authorized } = authorize(grant, request, now);
  const inputs: ExistingProspectSources[] = [], readQuarantine: Quarantine[] = [];
  if (options && instant.parse(options.frozenAsOf) !== authorized.asOf) throw new Error("learning_source_cutoff_changed");
  const cutoff = options ? Date.parse(authorized.asOf) : undefined;
  // A daily result has a durable cutoff. Project native evidence at that cutoff
  // only when Firestore proves the exact document version already existed.
  // Never backdate a newly created/updated record from its reported event time.
  // Missing version metadata stays unknown; stored learning events retain their
  // original recordedAt and are filtered independently by buildSnapshot.
  const admit = (snapshot: FirebaseFirestore.DocumentSnapshot, recordRef: string) => {
    if (cutoff === undefined) return true;
    const reason = frozenSourceVersionIssue(snapshot, authorized.asOf);
    if (reason) {
      readQuarantine.push({ recordRef, reason });
      return false;
    }
    return true;
  };
  for (const prospectId of authorized.prospectIds) {
    entitiesSchema.shape.prospectId.parse(prospectId);
    const prospectRef = db.collection("outboundProspects").doc(prospectId);
    const prospect = await prospectRef.get();
    if (!admit(prospect, prospectRef.path)) continue;
    const jobs = await readQueryPages(db.doc(ROOT).collection("jobs").where("prospectId", "==", prospectId));
    let communications: FirebaseFirestore.QueryDocumentSnapshot[] | undefined;
    try {
      communications = authorized.sections.includes("replies") ? await readQueryPages(prospectRef.collection("communicationsEvents")) : undefined;
    } catch {
      readQuarantine.push({ recordRef: `${prospectRef.path}/communicationsEvents`,
        reason: "communications_events_read_unavailable_retry_authorized_prospect" });
    }
    const bundles: ExistingJob[] = [];
    for (const job of jobs) {
      try {
        if (!admit(job, `${ROOT}/jobs/${job.id}`)) continue;
        const record = job.data();
        const identity = communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"].map(k => [k, record[k]])));
        const brief = await db.doc(ROOT).collection("briefs").doc(identity.briefId).get();
        const handoff = await db.doc(ROOT).collection("handoffs").doc(identity.briefDigest).get();
        const source = await db.doc(ROOT).collection("researchSources").doc(identity.briefDigest).get();
        if (!admit(brief, `${ROOT}/briefs/${identity.briefId}`)
          || !admit(handoff, `${ROOT}/handoffs/${identity.briefDigest}`)
          || !admit(source, `${ROOT}/researchSources/${identity.briefDigest}`)) continue;
        const parsedBrief = communicationsBriefSchema.parse(brief.data());
        const admissionId = parsedBrief.researchOrigin.admissionId;
        const reviewed = admissionId ? await db.collection(REVIEWED_RESEARCH_ROOT).doc(admissionId).get() : undefined;
        if (reviewed && !admit(reviewed, `${REVIEWED_RESEARCH_ROOT}/${admissionId}`)) continue;
        const contactDigest = parsedBrief.researchOrigin.contactEvidenceDigest;
        const contact = parsedBrief.researchOrigin.contactEvidenceKind === "public_operator_resolution" && contactDigest
          ? await db.doc(ROOT).collection("contactProofs").doc(contactDigest).get() : undefined;
        if (contact && !admit(contact, `${ROOT}/contactProofs/${contactDigest}`)) continue;
        const receiptRef = `${ROOT}/sendReceipts/${communicationsDeliveryKey(identity)}`;
        let receipt: FirebaseFirestore.DocumentSnapshot | undefined, ledger: FirebaseFirestore.DocumentSnapshot | undefined;
        let ledgerEligible = false;
        try {
          const receiptRead = authorized.sections.includes("outreach") ? await db.doc(receiptRef).get() : undefined;
          receipt = receiptRead?.exists && admit(receiptRead, receiptRef) ? receiptRead : undefined;
          const receiptJobId = receipt?.data()?.jobId;
          if (receipt?.exists && !jobs.some(job => job.id === receiptJobId)) {
            readQuarantine.push({ recordRef: receiptRef, reason: "orphan_or_legacy_receipt_requires_reconciliation" });
          }
          ledger = receipt?.exists && receiptJobId === identity.jobId ? await db.collection("action_ledger").doc(`communications_${identity.jobId}`).get() : undefined;
          ledgerEligible = !!ledger && admit(ledger, `action_ledger/communications_${identity.jobId}`);
        } catch {
          receipt = undefined; ledger = undefined;
          readQuarantine.push({ recordRef: receiptRef, reason: "receipt_read_unavailable_retry_exact_receipt_and_ledger" });
        }
        bundles.push({ id: job.id, record: identity, brief: brief.data(), handoff: handoff.data(), researchSource: source.data(),
          reviewedSnapshot: reviewed?.data(), contactProof: contact?.data(),
          receipt: receipt?.data()?.jobId === identity.jobId && ledgerEligible ? receipt?.data() : undefined,
          ledger: ledgerEligible ? ledger?.data() : undefined });
      } catch {
        // A stale or malformed job must not suppress valid sibling history.
        // Retain only the exact record reference, never private parse errors.
        readQuarantine.push({ recordRef: `${ROOT}/jobs/${job.id}`, reason: "source_contract_or_exact_join_invalid" });
      }
    }
    inputs.push({ prospectId, prospect: prospect.data(), jobs: bundles, communicationsEvents: communications?.filter(doc => admit(doc, `${prospectRef.path}/communicationsEvents/${doc.id}`)).map(doc => ({ id: doc.id, record: doc.data() })) ?? [] });
  }
  const normalized = normalizeExistingSources(inputs, options?.frozenAsOf ?? now);
  // The public reader boundary returns structured authorized events only.
  return { ...normalized, researchDetails: authorized.sections.includes("research") ? normalized.researchDetails : [],
    quarantine: [...readQuarantine, ...normalized.quarantine], events: normalized.events.filter(e => authorized.sections.includes(eventSection(e))) };
}
