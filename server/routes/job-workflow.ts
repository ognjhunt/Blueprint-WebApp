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
import { logger } from "../logger";
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
async function readWorkflow(requestId: string) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const [snapshot, brief] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(), db.collection("siteTaskBriefs").doc(requestId).get()]);
  const record = snapshot.data(); assertJob(record);
  return projectJobMarketplace(record, brief.exists ? brief.data()! : null);
}
async function mutateWorkflow(requestId: string, actor: string, event: string,
  mutate: (state: StoredJobMarketplace, brief: Record<string, any> | null, now: string, record: Record<string, any>) => StoredJobMarketplace) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const store = db;
  const ref = store.collection("inboundRequests").doc(requestId);
  const briefRef = store.collection("siteTaskBriefs").doc(requestId);
  const eventRef = ref.collection("jobWorkflowEvents").doc(randomUUID());
  return store.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const briefSnap = await transaction.get(briefRef);
    const record = snapshot.data(); assertJob(record);
    const brief = briefSnap.exists ? briefSnap.data()! : null;
    const before = storedMarketplace(record);
    // Monotone event timestamps also make successive identical quote edits different revisions.
    const now = new Date(Math.max(Date.now(), (Date.parse(before.updatedAtIso) || 0) + 1)).toISOString();
    const changed = mutate(before, brief, now, record);
    if (workflowDigest(changed) === workflowDigest(before)) return projectJobMarketplace(record, brief);
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
    return projectJobMarketplace({ ...record, job_marketplace: next }, brief);
  });
}

// Buyer links and admin accounts use separate authorization namespaces.
ownerRouter.use("/owner/:token", (req, res, next) => {
  const token = verifyCaptureUploadToken(String(req.params.token));
  if (!token || token.scope !== "owner") return res.status(403).json({ error: "Open the site owner's job link to review these details.", code: "owner_link_required" });
  res.locals.jobWorkflowRequestId = token.requestId;
  next();
});
ownerRouter.get("/owner/:token", handle(async (_req, res) => res.json(await readWorkflow(res.locals.jobWorkflowRequestId))));
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
router.get("/admin/:requestId", handle(async (_req, res) => res.json(await readWorkflow(res.locals.jobWorkflowRequestId))));
router.post("/admin/:requestId/review", handle(async (req, res) => {
  const input = parse(optionsReviewSchema, req.body);
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "options_reviewed", (state, brief, now) => {
    assertBrief(brief);
    return { ...state, review: { ...input, reviewedAtIso: now, scopeRevision: proposalScopeRevision(brief, state.requirements) } };
  }));
}));
router.post("/admin/:requestId/proposals", handle(async (req, res) => {
  const input = parse(deliveryProposalSchema, req.body);
  const suppliedKey = req.header("Idempotency-Key");
  const proposalId = suppliedKey ? parse(proposalIdSchema, suppliedKey) : randomUUID();
  return res.status(201).json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "proposal_published", (state, brief, now) => {
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
  return res.json(await mutateWorkflow(res.locals.jobWorkflowRequestId, res.locals.firebaseUser!.uid, "proposal_revised", (state, brief, now) => {
    assertBrief(brief);
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
