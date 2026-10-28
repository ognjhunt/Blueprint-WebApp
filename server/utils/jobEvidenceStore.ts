import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { JobMarketplaceError } from "./jobMarketplaceWorkflow";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { jobEvidenceRequestSchema, jobEvidenceSummary, scientificBriefDigest, scientificContext, jobEvidenceCaptureSessionId, jobEvidenceSourceIsCurrent, verifyJobEvidencePublication, type JobEvidencePublication } from "./jobEvidenceContract";

export async function readJobEvidence(jobId: string, brief: Record<string, any> | null, admin = false) {
  if (!db || !brief?.confirmedAtIso) return { evidence: [], evidenceContext: null };
  const digest = scientificBriefDigest(brief);
  const [requests, job, inventory] = await Promise.all([
    db.collection("inboundRequests").doc(jobId).collection("jobEvidenceRequests").orderBy("createdAtIso", "desc").limit(20).get(),
    db.collection("inboundRequests").doc(jobId).get(),
    db.collection("siteTaskItemInventories").doc(jobId).get(),
  ]);
  const session = await db.collection("captureUploadSessions").doc(jobEvidenceCaptureSessionId(jobId, job.data()!)).get();
  const context = scientificContext(session.exists ? session.data()! : null, { brief, record: job.data()!, inventory: inventory.exists ? inventory.data() as any : null });
  const evidence = requests.docs.map(row => {
    const value = row.data();
    const cancellationConfirmed = value.cancellationRequested && value.cancellationConfirmedAtIso;
    const cancellationPending = value.cancellationRequested && !cancellationConfirmed && value.summary?.state !== "cancelled";
    const cancellationProjection = cancellationConfirmed && value.summary?.state !== "cancelled" ? { state: "cancelled",
      summary: value.cancellationResolution === "already_terminal"
        ? "Further evidence work was cancelled. Pipeline had already completed this question."
        : "This evidence request was cancelled before Pipeline accepted it. No evaluation was created.",
      nextAction: "Use a new question if evidence is still needed. This cancelled request cannot support a new proposal." } : {};
    const inactive = value.cancellationRequested || value.summary?.state === "cancelled"
      || !jobEvidenceSourceIsCurrent(jobId, job.data()!, value);
    if (value.summary) return { ...value.summary, current: !inactive && value.summary.briefDigest === digest && (!value.summary.testbedDigest || value.summary.testbedDigest === context?.testbed.testbed_digest),
      ...(cancellationPending ? { state: "unavailable", summary: "Cancellation was requested. Blueprint is awaiting confirmation that this question has stopped.",
        nextAction: "No further evidence work will be requested for this question. Its earlier result remains available as history." } : {}),
      ...cancellationProjection,
      ...(admin && value.forwardingReason ? { serviceMessage: value.forwardingReason } : {}) };
    const request = value.request;
    return { requestId: request.request_id, publicationDigest: null, briefDigest: request.brief_digest,
      current: !inactive && request.brief_digest === digest && (!request.testbed?.testbed_digest || request.testbed.testbed_digest === context?.testbed.testbed_digest), state: "unavailable", question: request.question,
      summary: value.cancellationRequested ? "Cancellation was requested. Blueprint is awaiting confirmation that this question has stopped."
        : "Your question is saved. Blueprint will resume it when evidence processing is available.",
      nextAction: value.cancellationRequested ? "No further evidence work will be requested for this question."
        : "Return to this job for progress. Blueprint will ask for a specific missing input if needed.", limitations: request.context_limitations ?? [],
      runId: null, decisionDigest: null, planDigest: null, testbedDigest: request.testbed?.testbed_digest ?? null,
      approvedTaskDigest: request.approved_task_digest, claims: [], ...cancellationProjection,
      ...(admin && value.forwardingReason ? { serviceMessage: value.forwardingReason } : {}) };
  });
  return { evidence, ...(admin ? { evidenceContext: { briefDigest: digest, question: context?.decisionRequest.decision_question ?? null,
    testbedDigest: context?.testbed.testbed_digest ?? null } } : {}) };
}

/** Retained publications remain readable history; cancelled requests cannot back a new commercial commitment. */
export async function assertJobEvidenceRequestActive(jobId: string, requestId: string, requestDigest: string,
  transaction?: FirebaseFirestore.Transaction) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const ref = db.collection("inboundRequests").doc(jobId).collection("jobEvidenceRequests").doc(requestId);
  const saved = await (transaction ? transaction.get(ref) : ref.get());
  const value = saved.data();
  if (!value || value.request?.job_id !== jobId || value.request?.request_id !== requestId
    || value.request?.request_digest !== requestDigest) throw new JobMarketplaceError("evidence_scope_changed", "The saved evidence request is unavailable. Review its applicability before using this result.");
  const jobRef = db.collection("inboundRequests").doc(jobId);
  const job = await (transaction ? transaction.get(jobRef) : jobRef.get());
  if (!job.exists || !jobEvidenceSourceIsCurrent(jobId, job.data()!, value))
    throw new JobMarketplaceError("evidence_scope_changed", "This evidence belongs to an earlier recording. Review the current source before using it.");
  if (value.cancellationRequested || value.summary?.state === "cancelled") {
    throw new JobMarketplaceError("evidence_cancelled", "This evidence request was cancelled. Review this proposal against current evidence before proceeding.");
  }
}

export async function acceptJobEvidencePublication(value: unknown, options: { cancellationTerminalHistory?: true } = {}) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const publication = verifyJobEvidencePublication(value);
  if (Buffer.byteLength(JSON.stringify(publication)) > 750_000) throw new JobMarketplaceError("evidence_too_large", "Retain large evidence in the existing artifact store.", 413);
  const jobRef = db.collection("inboundRequests").doc(publication.job_id);
  const requestRef = jobRef.collection("jobEvidenceRequests").doc(publication.request_id);
  const publicationRef = jobRef.collection("jobEvidencePublications").doc(publication.publication_digest.slice(7));
  const briefRef = db.collection("siteTaskBriefs").doc(publication.job_id);
  const replayed = await db.runTransaction(async tx => {
    const [job, requestSnap, existing, brief] = await Promise.all([tx.get(jobRef), tx.get(requestRef), tx.get(publicationRef), tx.get(briefRef)]);
    const record = job.data();
    if (!record || record.request?.buyerType !== "site_operator") throw new JobMarketplaceError("job_not_found", "Site job not found.", 404);
    if (!requestSnap.exists) throw new JobMarketplaceError("evidence_request_not_found", "The exact job evidence request was not found.", 404);
    const stored = requestSnap.data()!;
    // A cancellation may discover an already completed result. Verify its exact
    // binding without reviving work or changing its scientific verdict.
    const cancellationHistory = options.cancellationTerminalHistory === true && stored.cancellationRequested === true
      && ["decision", "partial_decision", "abstention"].includes(publication.state);
    if (projectWebsiteCaptureRights(record).consent_revoked && publication.state !== "cancelled" && !cancellationHistory) throw new JobMarketplaceError("capture_processing_not_authorized", "Recording permission was withdrawn.");
    const request = jobEvidenceRequestSchema.parse(stored.request);
    if (publication.request_digest !== request.request_digest || publication.brief_digest !== request.brief_digest
      || publication.question !== request.question || publication.approved_task_digest !== request.approved_task_digest
      || publication.decision_request_digest !== (request.decision_evidence_request?.request_digest ?? null)
      || publication.testbed_digest !== (request.testbed?.testbed_digest ?? null)) {
      throw new JobMarketplaceError("evidence_binding_mismatch", "Scientific publication does not match the saved job, brief and task request.");
    }
    if (existing.exists) {
      if (crossRuntimeDigest(existing.data()!.publication) !== crossRuntimeDigest(publication)) throw new JobMarketplaceError("immutable_evidence_conflict", "This immutable evidence identity has different content.");
      return true;
    }
    // Withdrawal still forbids retaining a newly arrived full publication.
    // The cancellation worker may acknowledge the stop using local metadata;
    // Pipeline keeps the authoritative terminal record under its own rights.
    if (cancellationHistory && projectWebsiteCaptureRights(record).consent_revoked) return "not_retained" as const;
    if ((stored.sequence ?? -1) >= publication.sequence) throw new JobMarketplaceError("evidence_sequence_conflict", "A newer evidence publication is already recorded.");
    if ((stored.cancellationRequested || stored.summary?.state === "cancelled") && publication.state !== "cancelled" && !cancellationHistory) throw new JobMarketplaceError("evidence_cancelled", "This evidence request was cancelled.");
    tx.create(publicationRef, { publication, receivedAtIso: new Date().toISOString() });
    tx.update(requestRef, { sequence: publication.sequence, latestPublicationDigest: publication.publication_digest,
      summary: jobEvidenceSummary(publication, brief.exists ? scientificBriefDigest(brief.data()!) : ""), forwardingReason: null });
    return false;
  });
  return { schema_version: "job_evidence_publication_receipt.v1", request_id: publication.request_id,
    job_id: publication.job_id, request_digest: publication.request_digest, publication_digest: publication.publication_digest,
    status: replayed === "not_retained" ? "not_retained" : replayed ? "replayed" : "published" };
}

export async function readJobEvidencePublication(jobId: string, digest: string, transaction?: FirebaseFirestore.Transaction): Promise<JobEvidencePublication> {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const ref = db.collection("inboundRequests").doc(jobId).collection("jobEvidencePublications").doc(digest.replace(/^sha256:/, ""));
  const snapshot = await (transaction ? transaction.get(ref) : ref.get());
  if (!snapshot.exists) throw new JobMarketplaceError("evidence_not_found", "Evidence record not found.", 404);
  return verifyJobEvidencePublication(snapshot.data()!.publication);
}
