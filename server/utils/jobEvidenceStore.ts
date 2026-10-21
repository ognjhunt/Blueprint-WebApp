import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { JobMarketplaceError } from "./jobMarketplaceWorkflow";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { jobEvidenceRequestSchema, jobEvidenceSummary, scientificBriefDigest, scientificContext, jobEvidenceCaptureSessionId, verifyJobEvidencePublication, type JobEvidencePublication } from "./jobEvidenceContract";

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
    if (value.summary) return { ...value.summary, current: value.summary.briefDigest === digest && (!value.summary.testbedDigest || value.summary.testbedDigest === context?.testbed.testbed_digest), ...(admin && value.forwardingReason ? { serviceMessage: value.forwardingReason } : {}) };
    const request = value.request;
    return { requestId: request.request_id, publicationDigest: null, briefDigest: request.brief_digest,
      current: request.brief_digest === digest && (!request.testbed?.testbed_digest || request.testbed.testbed_digest === context?.testbed.testbed_digest), state: "unavailable", question: request.question,
      summary: value.forwardingReason || "The question is saved. Pipeline has not confirmed its evidence plan.",
      nextAction: "Blueprint can retry this question or continue the options assessment using sufficient existing evidence.", limitations: request.context_limitations ?? [],
      runId: null, decisionDigest: null, planDigest: null, testbedDigest: request.testbed?.testbed_digest ?? null,
      approvedTaskDigest: request.approved_task_digest, claims: [] };
  });
  return { evidence, ...(admin ? { evidenceContext: { briefDigest: digest, question: context?.decisionRequest.decision_question ?? null,
    testbedDigest: context?.testbed.testbed_digest ?? null } } : {}) };
}

export async function acceptJobEvidencePublication(value: unknown) {
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
    if (projectWebsiteCaptureRights(record).consent_revoked) throw new JobMarketplaceError("capture_processing_not_authorized", "Recording permission was withdrawn.");
    if (!requestSnap.exists) throw new JobMarketplaceError("evidence_request_not_found", "The exact job evidence request was not found.", 404);
    const stored = requestSnap.data()!;
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
    if ((stored.sequence ?? -1) >= publication.sequence) throw new JobMarketplaceError("evidence_sequence_conflict", "A newer evidence publication is already recorded.");
    if (stored.summary?.state === "cancelled" && publication.state !== "cancelled") throw new JobMarketplaceError("evidence_cancelled", "This evidence request was cancelled.");
    tx.create(publicationRef, { publication, receivedAtIso: new Date().toISOString() });
    tx.update(requestRef, { sequence: publication.sequence, latestPublicationDigest: publication.publication_digest,
      summary: jobEvidenceSummary(publication, brief.exists ? scientificBriefDigest(brief.data()!) : ""), forwardingReason: null });
    return false;
  });
  return { schema_version: "job_evidence_publication_receipt.v1", request_id: publication.request_id,
    job_id: publication.job_id, request_digest: publication.request_digest, publication_digest: publication.publication_digest,
    status: replayed ? "replayed" : "published" };
}

export async function readJobEvidencePublication(jobId: string, digest: string): Promise<JobEvidencePublication> {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const snapshot = await db.collection("inboundRequests").doc(jobId).collection("jobEvidencePublications").doc(digest.replace(/^sha256:/, "")).get();
  if (!snapshot.exists) throw new JobMarketplaceError("evidence_not_found", "Evidence record not found.", 404);
  return verifyJobEvidencePublication(snapshot.data()!.publication);
}
