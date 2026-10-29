/** The site's planning details and Blueprint's options review, separate from Pipeline-owned evaluation. */
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { savedWalkthrough, siteWalkthroughIdentity } from "../utils/siteWalkthrough";
import { logger } from "../logger";
import { loadManagedJobEvidenceForWorkspace } from "../utils/jobManagedEvaluation";
import { buildJobEvidenceRequest, jobEvidenceId, jobEvidenceQuestionSchema, jobEvidenceDigest, scientificBriefDigest, jobEvidenceSummary, jobEvidenceCaptureSessionId } from "../utils/jobEvidenceContract";
import { readJobEvidence, readJobEvidencePublication } from "../utils/jobEvidenceStore";
import { assertJobEvidenceVideo, deliverJobEvidenceRequest, jobEvidenceDeliveryIntent, jobEvidenceQueueMarker, queueJobEvidenceAction } from "../utils/jobEvidenceForwardWorker";
import {
  JobMarketplaceError, optionsReviewSchema, projectJobMarketplace, requirementsSchema,
  storedMarketplace, workflowDigest, reviewScopeRevision, type StoredJobMarketplace,
} from "../utils/jobMarketplaceWorkflow";

const router = Router();
const ownerRouter = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false }));
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const requestIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
function refusal(res: Response, error: unknown) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Review the highlighted fields and try again.",
    fields: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
  if (error instanceof JobMarketplaceError) return res.status(error.status).json({ code: error.code, error: error.message });
  logger.error({ err: error }, "Job commercial workflow unavailable");
  return res.status(503).json({ error: "Your job could not be updated. Try again shortly.", code: "job_workflow_unavailable" });
}
const handle = (work: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { return await work(req, res); } catch (error) { return refusal(res, error); }
};

function assertJob(record: Record<string, any> | undefined): asserts record is Record<string, any> {
  if (!record || record.request?.buyerType !== "site_operator") throw new JobMarketplaceError("job_not_found", "Site job not found.", 404);
  if (projectWebsiteCaptureRights(record).consent_revoked) throw new JobMarketplaceError("capture_processing_not_authorized",
    "Recording permission was withdrawn. Contact Blueprint to review this job before continuing.");
}
function assertBrief(brief: Record<string, any> | null) {
  if (!brief?.confirmedAtIso || !Number.isFinite(Date.parse(brief.confirmedAtIso))) throw new JobMarketplaceError("brief_not_agreed", "Agree the job brief before reviewing options or requesting evidence.");
}
async function readWorkflow(requestId: string, admin = false) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const [snapshot, brief, walkthrough] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get(), savedWalkthrough(siteWalkthroughIdentity(requestId))]);
  const record = snapshot.data(); assertJob(record);
  const briefValue = brief.exists ? brief.data()! : null;
  return { ...projectJobMarketplace(record, briefValue, walkthrough?.received ?? null), jobId: requestId, ...await readJobEvidence(requestId, briefValue, admin),
    ...(briefValue ? await loadManagedJobEvidenceForWorkspace(requestId, scientificBriefDigest(briefValue)) : { managedEvidence: [] }) };
}
async function mutateWorkflow(requestId: string, actor: string, event: string,
  mutate: (state: StoredJobMarketplace, brief: Record<string, any> | null, now: string) => StoredJobMarketplace) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const store = db;
  const ref = store.collection("inboundRequests").doc(requestId);
  const briefRef = store.collection("siteTaskBriefs").doc(requestId);
  const eventRef = ref.collection("jobWorkflowEvents").doc(randomUUID());
  const walkthrough = await savedWalkthrough(siteWalkthroughIdentity(requestId));
  const captureReceived = walkthrough?.received ?? null;
  await store.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const briefSnap = await transaction.get(briefRef);
    const record = snapshot.data(); assertJob(record);
    const brief = briefSnap.exists ? briefSnap.data()! : null;
    const before = storedMarketplace(record);
    // Monotone event timestamps also make successive identical edits different revisions.
    const now = new Date(Math.max(Date.now(), (Date.parse(before.updatedAtIso) || 0) + 1)).toISOString();
    const changed = mutate(before, brief, now);
    if (workflowDigest(changed) === workflowDigest(before)) return projectJobMarketplace(record, brief, captureReceived);
    if (event === "options_reviewed" && captureReceived !== true) {
      throw new JobMarketplaceError(captureReceived === null ? "capture_status_unavailable" : "video_required",
        captureReceived === null ? "We could not read the saved recording. Try again before continuing this assessment."
          : "Upload or record the work before assessing options.", captureReceived === null ? 503 : 409);
    }
    const next = { ...changed, updatedAtIso: now, updatedBy: actor };
    // Fields from the retired delivery-proposal flow stay exactly as stored.
    const legacy = record.job_marketplace && typeof record.job_marketplace === "object" ? record.job_marketplace : {};
    transaction.update(ref, { job_marketplace: { ...legacy, ...next } });
    transaction.set(eventRef, { schemaVersion: "job_marketplace_event.v1", requestId, kind: event, actor,
      atIso: now, previousRevision: workflowDigest(before), nextRevision: workflowDigest(next),
      previousState: before, nextState: next });
    return projectJobMarketplace({ ...record, job_marketplace: { ...legacy, ...next } }, brief, captureReceived);
  });
  return readWorkflow(requestId, actor !== "signed_owner_link");
}

// Buyer links and admin accounts use separate authorization namespaces.
ownerRouter.use("/owner/:token", (req, res, next) => {
  const token = verifyCaptureUploadToken(String(req.params.token));
  if (!token || token.scope !== "owner") return res.status(403).json({ error: "Open the site owner's job link to review these details.", code: "owner_link_required" });
  res.locals.jobWorkflowRequestId = token.requestId;
  next();
});
ownerRouter.get("/owner/:token", handle(async (_req, res) => res.json(await readWorkflow(res.locals.jobWorkflowRequestId))));
ownerRouter.get("/owner/:token/evidence/:publicationDigest", handle(async (req, res) => {
  const jobId = res.locals.jobWorkflowRequestId;
  const digest = parse(jobEvidenceDigest, req.params.publicationDigest);
  const currentWorkflow = await readWorkflow(jobId); // Same owner, current access and revoked-consent boundary.
  const publication = await readJobEvidencePublication(jobId, digest);
  const brief = await db!.collection("siteTaskBriefs").doc(jobId).get();
  const projection = jobEvidenceSummary(publication, brief.exists ? scientificBriefDigest(brief.data()!) : "");
  const currentEvidence = currentWorkflow.evidence.find(item => item.requestId === publication.request_id);
  const scopeCurrent = projection.current && currentEvidence?.current === true && currentEvidence.testbedDigest === publication.testbed_digest;
  const applicability = scopeCurrent ? "Current agreed brief and evidence scope." : "Historical evidence: the current brief, task or source configuration differs, or current applicability could not be established. Review applicability before relying on this result.";
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  return res.type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Evidence for your job | Blueprint</title><body><main><h1>${safe(projection.question)}</h1><p><strong>${safe(applicability)}</strong></p><p>${safe(projection.state.replace(/_/g, " "))}: ${safe(projection.summary)}</p>${projection.claims.map(claim => `<p>${safe(claim.claimId)}: ${safe(claim.verdict)} — ${safe(claim.rationale)}</p>`).join("")}<h2>Limits</h2>${projection.limitations.map(limit => `<p>${safe(limit)}</p>`).join("")}<h2>Next action</h2><p>${safe(projection.nextAction)}</p><p>Publication: ${safe(publication.publication_digest)}</p><p>Brief: ${safe(publication.brief_digest)}</p>${projection.decisionDigest ? `<p>Decision: ${safe(projection.decisionDigest)}</p>` : ""}<p>This is the exact recorded result for its original scope. It does not authorize physical work.</p></main></body></html>`);
}));
ownerRouter.patch("/owner/:token/requirements", handle(async (req, res) => {
  const input = parse(requirementsSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, "signed_owner_link", "requirements_updated", state => {
    return { ...state, requirements: { ...state.requirements, ...input } };
  }));
}));
router.use(ownerRouter);
router.use("/admin/:requestId", verifyFirebaseToken, requireAdminRole, (req, res, next) => {
  const requestId = requestIdSchema.safeParse(req.params.requestId);
  if (!requestId.success) return res.status(400).json({ error: "Invalid job id." });
  res.locals.jobWorkflowRequestId = requestId.data;
  next();
});
router.get("/admin/:requestId", handle(async (_req, res) => res.json(await readWorkflow(res.locals.jobWorkflowRequestId, true))));

// A retained recording precedes assessment; missing scientific inputs remain explicit.
router.post("/admin/:requestId/evidence", handle(async (req, res) => {
  const question = parse(jobEvidenceQuestionSchema, req.body).question;
  const key = parse(jobEvidenceId, req.header("Idempotency-Key"));
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const jobId = res.locals.jobWorkflowRequestId;
  const jobRef = db.collection("inboundRequests").doc(jobId);
  const briefRef = db.collection("siteTaskBriefs").doc(jobId);
  const inventoryRef = db.collection("siteTaskItemInventories").doc(jobId);
  const request = await db.runTransaction(async tx => {
    const [job, brief, inventory] = await Promise.all([tx.get(jobRef), tx.get(briefRef), tx.get(inventoryRef)]);
    assertJob(job.data()); assertBrief(brief.exists ? brief.data()! : null);
    const session = await tx.get(db!.collection("captureUploadSessions").doc(jobEvidenceCaptureSessionId(jobId, job.data()!)));
    await assertJobEvidenceVideo(jobId, job.data()!, brief.data()!, session.exists ? session.data()! : null, inventory.exists ? inventory.data() as any : null);
    const value = buildJobEvidenceRequest({ jobId, idempotencyKey: key, uid: res.locals.firebaseUser!.uid,
      question, brief: brief.data()!, record: job.data()!, inventory: inventory.exists ? inventory.data() as any : null, session: session.exists ? session.data()! : null });
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > 750_000) throw new JobMarketplaceError("evidence_too_large", "Retain large scientific artifacts in the existing object store before requesting evidence.", 413);
    const ref = jobRef.collection("jobEvidenceRequests").doc(value.request_id);
    const previous = await tx.get(ref);
    if (previous.exists && previous.data()!.request.request_digest !== value.request_digest) {
      throw new JobMarketplaceError("idempotency_conflict", "This question request was already used with different scope. Refresh before creating a new question.");
    }
    if (!previous.exists || !previous.data()!.deliveryState) {
      const intent = jobEvidenceDeliveryIntent("submit", res.locals.firebaseUser!.uid);
      if (!previous.exists) tx.create(ref, { request: value, createdAtIso: new Date().toISOString(), sequence: -1, ...intent });
      else tx.update(ref, intent);
      tx.update(jobRef, jobEvidenceQueueMarker(intent.deliveryId, intent.deliveryCreatedAtMs));
    }
    return value;
  });
  await deliverJobEvidenceRequest(jobId, request.request_id);
  return res.json(await readWorkflow(jobId, true));
}));

router.post("/admin/:requestId/evidence/:evidenceId/:action", handle(async (req, res) => {
  const id = parse(jobEvidenceId, req.params.evidenceId);
  const action = parse(z.enum(["refresh", "execute", "cancel"]), req.params.action);
  parse(z.object({}).strict(), req.body);
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const jobId = res.locals.jobWorkflowRequestId;
  const jobRef = db.collection("inboundRequests").doc(jobId);
  const ref = jobRef.collection("jobEvidenceRequests").doc(id);
  const [job, saved, brief, inventory] = await Promise.all([jobRef.get(), ref.get(), db.collection("siteTaskBriefs").doc(jobId).get(),
    db.collection("siteTaskItemInventories").doc(jobId).get()]);
  if (action === "cancel") {
    if (!job.exists || job.data()!.request?.buyerType !== "site_operator") throw new JobMarketplaceError("job_not_found", "Site job not found.", 404);
  } else assertJob(job.data());
  if (!saved.exists) throw new JobMarketplaceError("evidence_request_not_found", "Evidence request not found.", 404);
  const request = saved.data()!.request;
  if (action !== "cancel") {
    assertBrief(brief.exists ? brief.data()! : null);
    const session = await db.collection("captureUploadSessions").doc(jobEvidenceCaptureSessionId(jobId, job.data()!)).get();
    await assertJobEvidenceVideo(jobId, job.data()!, brief.data()!, session.exists ? session.data()! : null, inventory.exists ? inventory.data() as any : null);
  }
  if (action === "execute" && (!brief.exists || request.brief_digest !== scientificBriefDigest(brief.data()!))) {
    throw new JobMarketplaceError("evidence_scope_changed", "The job brief changed. Prepare the question against the current task before running evidence.");
  }
  if (action === "execute" && request.testbed) {
    const current = await readJobEvidence(jobId, brief.exists ? brief.data()! : null, true);
    if (!current.evidence.some(item => item.requestId === id && item.current && item.testbedDigest === request.testbed.testbed_digest)) {
      throw new JobMarketplaceError("evidence_scope_changed", "The task, source configuration or source permission changed. Refresh the current evidence before executing.");
    }
  }
  const principal = res.locals.firebaseUser!;
  await queueJobEvidenceAction(jobId, id, action, principal.uid, principal.tenantId || principal.tenant_id || principal.firebase?.tenant);
  await deliverJobEvidenceRequest(jobId, id);
  if (action === "cancel" && projectWebsiteCaptureRights(job.data()!).consent_revoked) return res.json({ requestId: id, status: "cancellation_requested" });
  return res.json(await readWorkflow(jobId, true));
}));

router.post("/admin/:requestId/review", handle(async (req, res) => {
  const input = parse(optionsReviewSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "options_reviewed", (state, brief, now) => {
    assertBrief(brief);
    return { ...state, review: { ...input, reviewedAtIso: now, scopeRevision: reviewScopeRevision(brief, state.requirements) } };
  }));
}));

export default router;
