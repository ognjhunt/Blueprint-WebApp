/** Durable commercial decisions, separate from Pipeline-owned evaluation and physical proof. */
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
import { loadManagedJobEvidence, assertManagedJobEvidenceReference } from "../utils/jobManagedEvaluation";
import { buildJobEvidenceRequest, forwardJobEvidence, jobEvidenceId, jobEvidenceQuestionSchema, jobEvidenceDigest, scientificBriefDigest, scientificContext, jobEvidenceSummary } from "../utils/jobEvidenceContract";
import { acceptJobEvidencePublication, readJobEvidence, readJobEvidencePublication } from "../utils/jobEvidenceStore";
import {
  deliveryProposalSchema, JobMarketplaceError, makeProposal, optionsReviewSchema, outcomeSchema, pilotAgreementSchema,
  projectJobMarketplace, proposalIdSchema, requirementsSchema, revisionSchema, selectedProposal, selectProposalSchema,
  storedMarketplace, workflowDigest, proposalScopeRevision, type StoredJobMarketplace,
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
  if (!brief?.confirmedAtIso || !Number.isFinite(Date.parse(brief.confirmedAtIso))) throw new JobMarketplaceError("brief_not_agreed", "Agree the job brief before publishing or selecting a delivery proposal.");
}
function assertCurrentBrief(proposal: { briefRevision: string }, brief: Record<string, any> | null, state: StoredJobMarketplace) {
  assertBrief(brief);
  if (proposal.briefRevision !== proposalScopeRevision(brief, state.requirements)) throw new JobMarketplaceError("brief_changed", "The job brief or buying requirements changed. Blueprint must review this proposal against the current job before you proceed.");
}
async function readWorkflow(requestId: string, admin = false) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const [snapshot, brief, walkthrough] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get(), savedWalkthrough(siteWalkthroughIdentity(requestId))]);
  const record = snapshot.data(); assertJob(record);
  const briefValue = brief.exists ? brief.data()! : null;
  return { ...projectJobMarketplace(record, briefValue, walkthrough?.received ?? null), ...await readJobEvidence(requestId, briefValue, admin),
    managedEvidence: briefValue?.confirmedAtIso ? await loadManagedJobEvidence(requestId, scientificBriefDigest(briefValue)) : [] };
}
async function mutateWorkflow(requestId: string, actor: string, event: string,
  mutate: (state: StoredJobMarketplace, brief: Record<string, any> | null, now: string, record: Record<string, any>) => StoredJobMarketplace) {
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
    // Monotone event timestamps also make successive identical quote edits different revisions.
    const now = new Date(Math.max(Date.now(), (Date.parse(before.updatedAtIso) || 0) + 1)).toISOString();
    const changed = mutate(before, brief, now, record);
    if (workflowDigest(changed) === workflowDigest(before)) return projectJobMarketplace(record, brief, captureReceived);
    if (["options_reviewed", "proposal_published", "proposal_revised", "proposal_selected", "pilot_agreement_recorded"].includes(event)
      && captureReceived !== true) {
      throw new JobMarketplaceError(captureReceived === null ? "capture_status_unavailable" : "video_required",
        captureReceived === null ? "We could not read the saved recording. Try again before continuing this assessment."
          : "Upload or record the work before assessing options or arranging a deployment.", captureReceived === null ? 503 : 409);
    }
    const next = { ...changed, updatedAtIso: now, updatedBy: actor };
    if (Buffer.byteLength(JSON.stringify({ ...record, job_marketplace: next }), "utf8") > 800_000) {
      throw new JobMarketplaceError("proposal_record_limit", "This job's descriptions are too large to save safely. Shorten the proposal descriptions or contact Blueprint to archive its history.");
    }
    transaction.update(ref, { job_marketplace: next });
    // Keep recoverable changed quote versions, not two copies of an ever-growing proposal array.
    const changedProposals = next.proposals.filter(proposal => !before.proposals.some(prior => prior.id === proposal.id && prior.revision === proposal.revision));
    const { proposals: _beforeProposals, ...previousState } = before;
    const { proposals: _nextProposals, ...nextState } = next;
    transaction.set(eventRef, { schemaVersion: "job_marketplace_event.v1", requestId, kind: event, actor,
      atIso: now, previousRevision: workflowDigest(before), nextRevision: workflowDigest(next),
      previousState, nextState, changedProposals });
    return projectJobMarketplace({ ...record, job_marketplace: next }, brief, captureReceived);
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
  const applicability = scopeCurrent ? "Current agreed brief and evidence scope." : "Historical evidence: the current brief, task or source configuration differs, or current applicability could not be established. Review applicability before using this result for a new proposal.";
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  return res.type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Evidence for your job | Blueprint</title><body><main><h1>${safe(projection.question)}</h1><p><strong>${safe(applicability)}</strong></p><p>${safe(projection.state.replace(/_/g, " "))}: ${safe(projection.summary)}</p>${projection.claims.map(claim => `<p>${safe(claim.claimId)}: ${safe(claim.verdict)} — ${safe(claim.rationale)}</p>`).join("")}<h2>Limits</h2>${projection.limitations.map(limit => `<p>${safe(limit)}</p>`).join("")}<h2>Next action</h2><p>${safe(projection.nextAction)}</p><p>Publication: ${safe(publication.publication_digest)}</p><p>Brief: ${safe(publication.brief_digest)}</p>${projection.decisionDigest ? `<p>Decision: ${safe(projection.decisionDigest)}</p>` : ""}<p>This is the exact recorded result for its original scope. It does not select a delivery proposal or authorize physical work.</p></main></body></html>`);
}));
ownerRouter.patch("/owner/:token/requirements", handle(async (req, res) => {
  const input = parse(requirementsSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, "signed_owner_link", "requirements_updated", state => {
    const requirements = { ...state.requirements, ...input };
    if (state.agreement && workflowDigest(requirements) !== workflowDigest(state.requirements)) {
      throw new JobMarketplaceError("pilot_already_agreed", "A pilot agreement is recorded. Contact Blueprint and the delivery partner to agree changes to its scope or buying requirements.");
    }
    return { ...state, requirements };
  }));
}));
ownerRouter.post("/owner/:token/select", handle(async (req, res) => {
  const input = parse(selectProposalSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, "signed_owner_link", "proposal_selected", (state, brief, now, record) => {
    const legacyPilot = record.workspace_task?.pilot;
    if (record.pilot_booking || legacyPilot?.selectedResultId || ["selected", "pilot", "pilot_complete", "deployed"].includes(legacyPilot?.state)) {
      throw new JobMarketplaceError("pilot_selection_conflict", "This job already has a pilot selected through its evaluation. Reconcile that selection with Blueprint before choosing another proposal.");
    }
    const proposal = selectedProposal(state, input.proposalId, input.expectedRevision);
    assertCurrentBrief(proposal, brief, state);
    if (state.agreement && (state.agreement.proposalId !== proposal.id || state.agreement.proposalRevision !== proposal.revision)) {
      throw new JobMarketplaceError("pilot_already_agreed", "A pilot agreement is recorded. Reconcile any change with Blueprint and the delivery partner first.");
    }
    if (state.selection?.proposalId === proposal.id && state.selection.proposalRevision === proposal.revision) return state;
    return { ...state, selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: now } };
  }));
}));
ownerRouter.post("/owner/:token/outcome", handle(async (req, res) => {
  const input = parse(outcomeSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, "signed_owner_link", "customer_outcome_reported", (state, _brief, now) => {
    const proposal = selectedProposal(state, input.proposalId, input.expectedRevision);
    if (!state.agreement || state.agreement.proposalId !== proposal.id || state.agreement.proposalRevision !== proposal.revision) {
      throw new JobMarketplaceError("pilot_agreement_required", "A pilot agreement must be recorded before reporting its outcome.");
    }
    if (state.agreement.outcomeRecordingAuthorized !== true || !state.agreement.outcomeRecordingPermissionReference) {
      throw new JobMarketplaceError("outcome_permission_required", "Both parties' permission to record the operational outcome must be recorded first. Contact Blueprint.");
    }
    const { expectedRevision: _revision, authorized: _authorized, ...report } = input;
    return { ...state, outcome: { ...report, proposalRevision: proposal.revision, source: "customer_reported", recordedAtIso: now } };
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

// No capture, run or team is fabricated when the ordinary options review is sufficient.
router.post("/admin/:requestId/evidence", handle(async (req, res) => {
  const question = parse(jobEvidenceQuestionSchema, req.body).question;
  const key = parse(jobEvidenceId, req.header("Idempotency-Key"));
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const jobId = res.locals.jobWorkflowRequestId;
  const jobRef = db.collection("inboundRequests").doc(jobId);
  const briefRef = db.collection("siteTaskBriefs").doc(jobId);
  const sessionRef = db.collection("captureUploadSessions").doc(`walkthrough-${jobId}`);
  const inventoryRef = db.collection("siteTaskItemInventories").doc(jobId);
  const request = await db.runTransaction(async tx => {
    const [job, brief, session, inventory] = await Promise.all([tx.get(jobRef), tx.get(briefRef), tx.get(sessionRef), tx.get(inventoryRef)]);
    assertJob(job.data()); assertBrief(brief.exists ? brief.data()! : null);
    const value = buildJobEvidenceRequest({ jobId, idempotencyKey: key, uid: res.locals.firebaseUser!.uid,
      question, brief: brief.data()!, record: job.data()!, inventory: inventory.exists ? inventory.data() as any : null, session: session.exists ? session.data()! : null });
    const ref = jobRef.collection("jobEvidenceRequests").doc(value.request_id);
    const previous = await tx.get(ref);
    if (previous.exists && previous.data()!.request.request_digest !== value.request_digest) {
      throw new JobMarketplaceError("idempotency_conflict", "This question request was already used with different scope. Refresh before creating a new question.");
    }
    if (!previous.exists) tx.create(ref, { request: value, createdAtIso: new Date().toISOString(), sequence: -1 });
    return value;
  });
  const forwarded = await forwardJobEvidence(request);
  if (forwarded.ok) await acceptJobEvidencePublication(forwarded.publication);
  else await jobRef.collection("jobEvidenceRequests").doc(request.request_id).update({ forwardingReason: forwarded.reason });
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
  const [job, saved, brief] = await Promise.all([jobRef.get(), ref.get(), db.collection("siteTaskBriefs").doc(jobId).get()]);
  assertJob(job.data());
  if (!saved.exists) throw new JobMarketplaceError("evidence_request_not_found", "Evidence request not found.", 404);
  const request = saved.data()!.request;
  if (action === "execute" && (!brief.exists || request.brief_digest !== scientificBriefDigest(brief.data()!))) {
    throw new JobMarketplaceError("evidence_scope_changed", "The job brief changed. Prepare the question against the current task before running evidence.");
  }
  const body = action === "refresh" ? request : action === "execute"
    ? { request_digest: request.request_digest, authorized_by: { role: "human", identity: res.locals.firebaseUser!.uid } }
    : { request_digest: request.request_digest, cancelled_by: res.locals.firebaseUser!.uid };
  const forwarded = await forwardJobEvidence(body, action === "refresh" ? "" : `/${encodeURIComponent(id)}/${action}`);
  if (forwarded.ok) await acceptJobEvidencePublication(forwarded.publication);
  else await ref.update({ forwardingReason: forwarded.reason });
  return res.json(await readWorkflow(jobId, true));
}));

async function assertProposalEvidence(requestId: string, input: z.infer<typeof deliveryProposalSchema>) {
  if (!input.evidence.some(row => row.reference)) return null;
  const brief = await db!.collection("siteTaskBriefs").doc(requestId).get();
  for (const row of input.evidence) {
    if (!row.reference) continue;
    if (row.reference.kind === "managed_run") {
      if (!brief.exists) throw new JobMarketplaceError("brief_not_agreed", "Agree the job brief before attaching evidence.");
      try { await assertManagedJobEvidenceReference(requestId, scientificBriefDigest(brief.data()!), row.reference); }
      catch { throw new JobMarketplaceError("evidence_scope_changed", "This managed result is unavailable or no longer applies to the current job. Review its exact source before attaching it."); }
      continue;
    }
    const publication = await readJobEvidencePublication(requestId, row.reference.publicationDigest);
    if (publication.testbed_digest) {
      const [session, job, inventory] = await Promise.all([db!.collection("captureUploadSessions").doc(`walkthrough-${requestId}`).get(),
        db!.collection("inboundRequests").doc(requestId).get(), db!.collection("siteTaskItemInventories").doc(requestId).get()]);
      const context = brief.exists ? scientificContext(session.exists ? session.data()! : null, { brief: brief.data()!, record: job.data()!, inventory: inventory.exists ? inventory.data() as any : null }) : null;
      if (context?.testbed.testbed_digest !== publication.testbed_digest) throw new JobMarketplaceError("evidence_scope_changed", "This evidence refers to an earlier task or testbed configuration. Review its applicability before attaching it.");
    }
    if (publication.request_id !== row.reference.requestId || !brief.exists || publication.brief_digest !== scientificBriefDigest(brief.data()!)) {
      throw new JobMarketplaceError("evidence_scope_changed", "This evidence belongs to a different job brief. Review its applicability before attaching it to a current proposal.");
    }
  }
  return brief.exists ? scientificBriefDigest(brief.data()!) : null;
}

router.post("/admin/:requestId/review", handle(async (req, res) => {
  const input = parse(optionsReviewSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "options_reviewed", (state, brief, now) => {
    assertBrief(brief);
    return { ...state, review: { ...input, reviewedAtIso: now, scopeRevision: proposalScopeRevision(brief, state.requirements) } };
  }));
}));
router.post("/admin/:requestId/proposals", handle(async (req, res) => {
  const input = parse(deliveryProposalSchema, req.body);
  const evidenceBriefDigest = await assertProposalEvidence(res.locals.jobWorkflowRequestId, input);
  const suppliedKey = req.header("Idempotency-Key");
  const proposalId = suppliedKey ? parse(proposalIdSchema, suppliedKey) : randomUUID();
  return res.status(201).json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "proposal_published", (state, brief, now) => {
    if (evidenceBriefDigest && (!brief || scientificBriefDigest(brief) !== evidenceBriefDigest)) throw new JobMarketplaceError("evidence_scope_changed", "The job brief changed while evidence was attached. Refresh the current scope.");
    const existing = state.proposals.find(proposal => proposal.id === proposalId);
    if (existing) {
      const previousInput = Object.fromEntries(Object.keys(input).map(key => [key, existing[key as keyof typeof existing]]));
      if (workflowDigest(previousInput) !== workflowDigest(input)) throw new JobMarketplaceError("idempotency_conflict", "This proposal request was already used with different details. Refresh before creating a new proposal.");
      return state;
    }
    assertBrief(brief);
    if (state.proposals.length >= 20) throw new JobMarketplaceError("proposal_limit", "This job already has 20 proposals. Contact engineering to archive its proposal history.");
    if (state.agreement) throw new JobMarketplaceError("pilot_already_agreed", "A pilot is already agreed. Reconcile the existing agreement before adding alternatives.");
    return { ...state, proposals: [...state.proposals, makeProposal(input, proposalId, now, proposalScopeRevision(brief, state.requirements))] };
  }));
}));
router.put("/admin/:requestId/proposals/:proposalId", handle(async (req, res) => {
  const id = parse(proposalIdSchema, req.params.proposalId);
  const input = parse(deliveryProposalSchema.extend({ expectedRevision: revisionSchema }).strict(), req.body);
  const evidenceBriefDigest = await assertProposalEvidence(res.locals.jobWorkflowRequestId, input);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "proposal_revised", (state, brief, now) => {
    assertBrief(brief);
    if (evidenceBriefDigest && (!brief || scientificBriefDigest(brief) !== evidenceBriefDigest)) throw new JobMarketplaceError("evidence_scope_changed", "The job brief changed while evidence was attached. Refresh the current scope.");
    const existing = state.proposals.find(proposal => proposal.id === id);
    if (!existing || existing.revision !== input.expectedRevision) throw new JobMarketplaceError("proposal_changed", "The proposal changed. Refresh before editing.");
    const isSelected = state.selection?.proposalId === id;
    if (state.agreement?.proposalId === id || (isSelected && existing.briefRevision === proposalScopeRevision(brief, state.requirements))) {
      throw new JobMarketplaceError("proposal_selected", "The customer selected this proposal. Reconcile the selection before changing its scope or price.");
    }
    const { expectedRevision: _revision, ...content } = input;
    return { ...state, proposals: state.proposals.map(proposal => proposal.id === id ? makeProposal(content, id, now, proposalScopeRevision(brief, state.requirements), existing) : proposal),
      ...(isSelected ? { selection: null } : {}) };
  }));
}));
router.post("/admin/:requestId/proposals/:proposalId/withdraw", handle(async (req, res) => {
  const id = parse(proposalIdSchema, req.params.proposalId);
  const input = parse(z.object({ expectedRevision: revisionSchema }).strict(), req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "proposal_withdrawn", (state, _brief, now) => {
    const existing = state.proposals.find(proposal => proposal.id === id);
    if (!existing || existing.revision !== input.expectedRevision) throw new JobMarketplaceError("proposal_changed", "The proposal changed. Refresh before withdrawing it.");
    if (state.selection?.proposalId === id) throw new JobMarketplaceError("proposal_selected", "The customer selected this proposal. Reconcile the selection before withdrawing it.");
    const content = { ...existing, status: "withdrawn" as const, updatedAtIso: now };
    return { ...state, proposals: state.proposals.map(proposal => proposal.id === id ? { ...content, revision: workflowDigest(content) } : proposal) };
  }));
}));
router.post("/admin/:requestId/agreement", handle(async (req, res) => {
  const input = parse(pilotAgreementSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "pilot_agreement_recorded", (state, brief, now) => {
    const proposal = selectedProposal(state, input.proposalId, input.expectedRevision);
    assertCurrentBrief(proposal, brief, state);
    if (!state.selection || state.selection.proposalId !== proposal.id || state.selection.proposalRevision !== proposal.revision) {
      throw new JobMarketplaceError("selection_required", "The customer must select this exact proposal first.");
    }
    if (Date.parse(input.agreedAtIso) > Date.parse(now)) throw new JobMarketplaceError("future_agreement", "Record an agreement only after both parties have agreed to it.");
    if (state.agreement) throw new JobMarketplaceError("agreement_already_recorded", "An agreement is already recorded. Preserve it and reconcile any amendment with the parties.");
    const { expectedRevision: _revision, ...agreement } = input;
    return { ...state, agreement: { ...agreement, proposalRevision: proposal.revision, recordedAtIso: now } };
  }));
}));

export default router;
