import { z } from "zod";
import {
  communicationsBriefSchema, communicationsDigest, communicationsDeliveryKey,
  communicationsEnvelopeSchema, communicationsJobSchema, isFounderReplyOrigin, verifyCommunicationsHandoff, outreachReadySendRefusal, OUTREACH_READY_SEND_REFUSAL } from "./communications-contract";
import { parseCommunicationsOutput, CommunicationsOutputValidationError } from "./communications-output";
import { reviewCommunicationsPayload } from "./communications-review";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { appendFirstContactFooter } from "./communications-first-contact-footer";
import { buildUnsubscribeUrl } from "../utils/email-suppression";

export class CommunicationsDraftRevisionError extends Error {
  constructor(message: string, public status = 409, public issues?: unknown) { super(message); }
}
const requestSchema = z.object({
  expectedReviewDigest: z.string().regex(/^[a-f0-9]{64}$/), output: z.record(z.unknown()),
}).strict();

/** Authenticated editing of an unsent human-review draft. Research, original
 * model bytes, usage and delivery identity remain unchanged. This never queues
 * model work, grants approval, creates a Gmail draft or sends a message. */
export async function reviseCommunicationsDraft(db: FirebaseFirestore.Firestore,
  ledgerId: string, requestedBy: string, input: unknown, now = Date.now()) {
  if (!requestedBy.trim() || requestedBy === "unknown-operator") {
    throw new CommunicationsDraftRevisionError("Authenticated operator identity is required", 403);
  }
  if (!/^communications_[a-f0-9]{64}$/.test(ledgerId)) {
    throw new CommunicationsDraftRevisionError("Select a saved communications draft", 400);
  }
  const request = requestSchema.safeParse(input);
  if (!request.success) throw new CommunicationsDraftRevisionError("Supply the current review digest and revised output", 400, request.error.issues);
  let parsed;
  try { parsed = parseCommunicationsOutput(JSON.stringify(request.data.output)); }
  catch (error) {
    if (error instanceof CommunicationsOutputValidationError) {
      throw new CommunicationsDraftRevisionError("Repair the named draft fields and revalidate", 400, error.validationIssues);
    }
    throw error;
  }
  const { output } = parsed;
  if (output.disposition !== "draft") throw new CommunicationsDraftRevisionError("Only a draft can be revised here", 400);
  const root = db.doc(COMMUNICATIONS_ROOT), ledgerRef = db.collection("action_ledger").doc(ledgerId);
  return db.runTransaction(async tx => {
    const ledger = (await tx.get(ledgerRef)).data();
    if (!ledger) throw new CommunicationsDraftRevisionError("Saved draft not found", 404);
    const envelope = communicationsEnvelopeSchema.safeParse(ledger.action_payload?.communications);
    if (!envelope.success) throw new CommunicationsDraftRevisionError("The saved research context is invalid; restore it before editing");
    const { job, brief } = envelope.data;
    const payload = ledger.action_payload;
    const previousRevisionId = ledger.draft_revision_id ?? null;
    if (previousRevisionId !== null && !/^[a-f0-9]{64}$/.test(previousRevisionId)) {
      throw new CommunicationsDraftRevisionError("The saved revision reference changed; restore its audit record");
    }
    const revisionId = communicationsDigest({ ledgerId, previousRevisionId,
      expectedReviewDigest: request.data.expectedReviewDigest, output, requestedBy });
    const revisionRef = root.collection("draftRevisions").doc(revisionId);
    const jobRef = root.collection("jobs").doc(job.jobId), sourceRef = db.collection("outboundProspects").doc(job.prospectId);
    const [savedJob, source, savedBrief, handoff, receipt, firstTouch, previousRevision, proposedRevision, founderSend, founderCheck] = await Promise.all([
      tx.get(jobRef), tx.get(sourceRef), tx.get(root.collection("briefs").doc(job.briefId)),
      tx.get(root.collection("handoffs").doc(job.briefDigest)),
      tx.get(root.collection("sendReceipts").doc(communicationsDeliveryKey(job))),
      tx.get(root.collection("firstTouches").doc(communicationsDeliveryKey(job))),
      previousRevisionId ? tx.get(root.collection("draftRevisions").doc(previousRevisionId)) : Promise.resolve(null), tx.get(revisionRef),
      tx.get(root.collection("founderSendObservations").doc(job.jobId)), tx.get(root.collection("founderSendChecks").doc(job.jobId)),
    ]);
    if (isFounderReplyOrigin(brief.replyOrigin)) {
      throw new CommunicationsDraftRevisionError("Replies on threads the founder sent are recorded for learning only and cannot be drafted or revised.");
    }
    if (founderSend.exists) {
      throw new CommunicationsDraftRevisionError("This draft was already sent from the founder mailbox. Its sent copy is recorded and it cannot be revised.");
    }
    if (founderCheck.data()?.state === "requires_reconciliation") {
      throw new CommunicationsDraftRevisionError("The founder mailbox may already hold a sent copy of this draft. Reconcile it in Gmail before revising.");
    }
    const record = savedJob.data(), prospect = source.data();
    const identity = communicationsJobSchema.safeParse(record && Object.fromEntries(
      Object.keys(job).map(key => [key, record[key]])));
    if (ledgerId !== `communications_${job.jobId}` || ledger.status !== "pending_approval"
      || ledger.action_type !== "send_email" || ledger.action_tier !== 3 || ledger.lane !== "outbound_prospect"
      || ledger.source_collection !== "outboundProspects" || ledger.source_doc_id !== job.prospectId
      || ledger.first_contact_authority || ledger.approved_by || ledger.approved_at || ledger.sent_at
      || ledger.execution_attempts > 0 || ledger.last_execution_at || receipt.exists
      || record?.state !== "pending_approval" || record.ledgerId !== ledgerId
      || !identity.success || communicationsDigest(identity.data) !== communicationsDigest(job)
      || (record.lease?.until ?? 0) > now) {
      throw new CommunicationsDraftRevisionError("Only an unsent, unapproved human-review draft can be revised; delivery recovery must retain its exact message");
    }
    const canonicalBrief = communicationsBriefSchema.safeParse(savedBrief.data());
    if (!canonicalBrief.success || communicationsDigest(canonicalBrief.data) !== job.briefDigest
      || communicationsDigest(brief) !== job.briefDigest || !prospect
      || prospect.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
      || prospect.siteId !== brief.siteId || prospect.taskId !== brief.taskId
      || prospect.communications?.jobId !== job.jobId || prospect.communications?.ledgerId !== ledgerId
      || prospect.communications?.briefDigest !== job.briefDigest
      || (job.intent === "outreach" && firstTouch.exists && firstTouch.data()?.jobId !== job.jobId)
      || ["closed", "converted"].includes(prospect.stage)
      || (job.intent === "outreach" && prospect.stage !== "drafted")
      || ["unknown", "opted_out"].includes(brief.consent.status)
      || communicationsDigest(record.output) !== communicationsDigest(envelope.data.output)) {
      throw new CommunicationsDraftRevisionError("Saved source, permission or draft changed; reload the current record");
    }
    try { verifyCommunicationsHandoff(handoff.data(), brief); }
    catch { throw new CommunicationsDraftRevisionError("The research handoff changed; restore its verified record before editing"); }
    const currentReview = reviewCommunicationsPayload(payload, now);
    let approvedTransport: string | undefined;
    const approvedOutreachTransport = () => {
      if (approvedTransport !== undefined) return approvedTransport;
      try { return approvedTransport = appendFirstContactFooter(output.body, brief.contact.email); }
      catch { throw new CommunicationsDraftRevisionError("The approved outreach mailing footer is unavailable on this server. Restore its existing configuration, then save again; this draft was not changed.", 503); }
    };
    // A repeated acknowledged save is harmless. A different edit must reload
    // the current digest; it cannot silently overwrite another reviewer's work.
    const savedRevision = previousRevision?.data();
    if (previousRevisionId && (!savedRevision || savedRevision.ledgerId !== ledgerId)) {
      throw new CommunicationsDraftRevisionError("The saved revision audit is missing or changed; restore its record");
    }
    if (savedRevision?.expectedReviewDigest === request.data.expectedReviewDigest && savedRevision.requestedBy === requestedBy
      && communicationsDigest(savedRevision.output) === communicationsDigest(output)
      && communicationsDigest(envelope.data.output) === communicationsDigest(output)
      && (request.data.expectedReviewDigest !== currentReview.digest || job.intent !== "outreach"
        || payload.transportBody === approvedOutreachTransport())) {
      return { ledgerId, revisionId: previousRevisionId!, state: "pending_approval", review: currentReview, sent: false, modelSessionCreated: false };
    }
    if (currentReview.digest !== request.data.expectedReviewDigest) {
      throw new CommunicationsDraftRevisionError("The draft changed while you were editing; reload it before saving");
    }
    if (proposedRevision.exists) throw new CommunicationsDraftRevisionError("This revision audit already exists; reload the current draft");
    const oldBody = envelope.data.output.body;
    if (payload.body !== oldBody || typeof payload.transportBody !== "string") {
      throw new CommunicationsDraftRevisionError("The saved message differs from its draft; restore that record before editing");
    }
    let transportBody: string;
    if (job.intent === "outreach") {
      // An explicit authenticated save can repair a legacy footer. Its full
      // prior transport stays in the private immutable audit; client text never
      // supplies the postal identity and deployment alone changes no draft.
      transportBody = approvedOutreachTransport();
    } else {
      if (!payload.transportBody.startsWith(oldBody)) {
        throw new CommunicationsDraftRevisionError("The saved reply transport changed; restore its original footer before editing");
      }
      transportBody = output.body + payload.transportBody.slice(oldBody.length);
    }
    const nextPayload = { ...payload, subject: output.subject, body: output.body,
      transportBody,
      ...(job.intent === "outreach" ? { commercialEmail: true, emailSuppressionScope: "growth_campaign",
        unsubscribeUrl: buildUnsubscribeUrl({ email: brief.contact.email, scope: "all", campaignId: `communications_${job.jobId}` }) } : {}),
      outreachContract: output.outreachContract, communications: { ...envelope.data, output } };
    const review = reviewCommunicationsPayload(nextPayload, now);
    nextPayload.communicationsDraftDiagnostics = review.hardChecksPassed ? null : { blockers: review.blockers };
    const revision = { version: "blueprint.communications-draft-revision.v1", revisionId, ledgerId,
      previousRevisionId,
      jobId: job.jobId, requestedBy, revisedAt: new Date(now).toISOString(),
      expectedReviewDigest: request.data.expectedReviewDigest, previousOutput: envelope.data.output,
      previousPayload: payload, previousPayloadDigest: communicationsDigest(payload),
      footerPolicy: job.intent === "outreach" ? "owner_configured_first_contact" : "preserve_reply_footer",
      previousDiagnostics: payload.communicationsDraftDiagnostics ?? null, previousReview: currentReview,
      submittedOutput: request.data.output, output, review,
      normalizedMetadataPaths: parsed.normalizedMetadataPaths, formatNormalizations: parsed.formatNormalizations,
      sent: false, modelSessionCreated: false };
    tx.create(revisionRef, revision);
    tx.update(ledgerRef, { action_payload: nextPayload,
      draft_output: { ...ledger.draft_output, ...output, requires_human_review: true, category: "communications" },
      outreach_semantic_review: null, outreach_reviewed_by: null, outreach_reviewed_at: null,
      // An outreach-ready hypothesis stays draft only whatever the revision; its diagnostics stay in the payload.
      approval_reason: outreachReadySendRefusal(brief) ? OUTREACH_READY_SEND_REFUSAL
        : review.hardChecksPassed ? "requires_human_review" : `content_validation_failed:${review.blockers.join(",")}`,
      draft_revision_id: revisionId, updated_at: new Date(now) });
    tx.update(jobRef, { output, reviewDigest: review.digest, draftRevisionId: revisionId, updatedAt: now });
    tx.set(sourceRef, { communications: { draft: output, reviewDigest: review.digest,
      draftRevisionId: revisionId, draftOrigin: "authenticated_operator_revision", updatedAt: now } }, { merge: true });
    tx.create(sourceRef.collection("communicationsEvents").doc(`revision_${revisionId}`), {
      type: "draft_revised", ledgerId, jobId: job.jobId, revisionId, requestedBy,
      reviewDigest: review.digest, recordedAt: now, sent: false, modelSessionCreated: false,
    });
    return { ledgerId, revisionId, state: "pending_approval", review, sent: false, modelSessionCreated: false };
  });
}
