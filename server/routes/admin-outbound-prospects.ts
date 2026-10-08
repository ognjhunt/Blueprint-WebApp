/**
 * Running an outbound beta, by hand, on purpose.
 *
 * Record a facility we chose, list what we have, draft the email, send it, and
 * convert a reply into an ordinary inbound request. No discovery crawler, no
 * sequences, no reply classifier, no UI. Twenty facilities can be picked by a
 * person and twenty replies read by a person, and doing it that way first is
 * how you find out what an agent should eventually do. A discovery machine
 * built before anyone has hand-written twenty of these would be automating
 * something nobody has produced once.
 *
 * The send path deliberately goes through `executeAction` rather than calling
 * the mailer, because that is where suppression, the CAN-SPAM footer, content
 * checks, the idempotency ledger and daily caps already live. Outbound gets
 * those by joining the existing lane, not by reimplementing them -- including
 * that lane's approval queue, which is what actually releases the message.
 *
 * `OUTBOUND_PROSPECT_POLICY` never auto-approves. A person reads every cold
 * email in the beta before it leaves.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { hasAnyRole } from "../utils/access-control";
import { executeAction } from "../agents/action-executor";
import { runAgentTask } from "../agents/runtime";
import type {
  OutboundOutreachInput,
  OutboundOutreachOutput,
} from "../agents/tasks/outbound-outreach";
import { OUTBOUND_PROSPECT_POLICY } from "../agents/action-policies";
import { CommunicationsStore } from "../agents/communications-store";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { reconcileCommunicationsDraftSession } from "../agents/communications-draft-budget";
import { communicationsDigest } from "../agents/communications-contract";
import { founderMailboxConnectionPlan } from "../agents/communications-connection";
import { replyFollowupReviewSchema, reviewReplyFollowup } from "../agents/communications-reply-followup";
import { readExistingResearchSnapshot } from "../agents/communications-research";
import { communicationsInprocessRecoverySchema } from "../agents/communications-inprocess-recovery";
import { enqueueSavedRecovery, cancelSavedRecovery, assertSavedRecoveryWorker, SAVED_RECOVERY_REQUESTS, SAVED_RECOVERY_WORKER, SAVED_RECOVERY_FRESH_MS, SAVED_RECOVERY_CONTROLS, type SavedRecoveryReadiness, type SavedRecoveryRequest } from "../agents/communications-saved-recovery-queue";
import { assertCommunicationsRecoveryHeadroom, COMMUNICATIONS_RECOVERY_HEADROOM_BYTES } from "../agents/communications-recovery-memory";
import { verifyFounderMailbox } from "../agents/communications-gmail";
import { requireFounderDraftCapability } from "../agents/communications-oauth-store";
import {
  communicationsResearchInputSchema, previewResearchCommunications, approveResearchCommunications,
} from "../agents/communications-producer";
import {
  outreachConnectionEvidenceSchema,
  outreachCapabilityEvidenceSchema,
  outreachReviewContractSchema,
  reviewOutreachDraft,
} from "../agents/outreach-review";
import {
  buildUnsubscribeUrl,
  normalizeSuppressionEmail,
  recordEmailSuppression,
  isEmailSuppressed,
} from "../utils/email-suppression";
import {
  bindingGateFieldIds,
  isCaptureMode,
  preferredCaptureMode,
} from "../../client/src/data/siteTaskQualification";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import { decideCaptureDispatch, describeCaptureDispatch } from "../utils/captureDispatch";
import {
  convertProspectToRequestPayload,
  guardProspectSend,
  type OutboundProspect,
  type SendBlocker,
} from "../utils/outboundProspects";

const router = Router();
const COLLECTION = "outboundProspects";
// Drafting is not sending. A redraft, or a research-derived prospect while the
// send flag is off, may still be drafted; a hypothesis or a closed prospect may not.
const DRAFTABLE_BLOCKERS = new Set<SendBlocker>(["already_contacted", "communications_sending_disabled"]);

const observationSchema = z.object({
  claim: z.string().trim().min(1).max(240),
  source: z.string().trim().min(1).max(500),
});

const createSchema = z
  .object({
    facilityName: z.string().trim().min(1).max(200),
    facilityAddress: z.string().trim().min(1).max(300),
    contactEmail: z.string().trim().email().max(254),
    observations: z.array(observationSchema).min(1).max(8),
    connectionEvidence: outreachConnectionEvidenceSchema.nullable().optional(),
    teamObservations: z.array(observationSchema).max(8).optional(),
    verifiedCapabilities: z.array(outreachCapabilityEvidenceSchema).max(8).optional(),
    hypothesisedTask: z.string().trim().min(1).max(1200),
    inferredGates: z.record(z.string().trim().max(60)).default({}),
    reasonForContact: z.string().trim().min(1).max(400),
  })
  .strict();

const draftSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2200),
    outreachContract: outreachReviewContractSchema,
  })
  .strict();

const closeSchema = z
  .object({
    reason: z.string().trim().min(1).max(400),
  })
  .strict();

const convertSchema = z
  .object({
    statedGates: z.record(z.string().trim().max(60)),
    taskStatement: z.string().trim().min(1).max(4000),
    captureMode: z.enum(["self_capture", "site_visit"]).optional(),
  })
  .strict();

async function requireOps(res: Response) {
  return hasAnyRole(res, ["admin", "ops"]);
}

async function readProspect(prospectId: string): Promise<OutboundProspect | null> {
  if (!db) return null;
  const snapshot = await db.collection(COLLECTION).doc(prospectId).get();
  if (!snapshot.exists) return null;
  return { prospectId: snapshot.id, ...(snapshot.data() as Omit<OutboundProspect, "prospectId">) };
}

/** Record a facility someone chose, with the sources behind the choice. */
router.post("/", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Prospect is invalid", code: "prospect_invalid" });
  }

  const prospectId = randomUUID();
  // Every gate we filled in ourselves is inferred by definition. Recording that
  // here rather than at send time means there is no path where a guess enters
  // the funnel wearing an operator's provenance.
  const gateAnswerSources = Object.fromEntries(
    Object.keys(parsed.data.inferredGates).map((fieldId) => [fieldId, "inferred" as const]),
  );

  const prospect: OutboundProspect = {
    prospectId,
    ...parsed.data,
    contactEmail: normalizeSuppressionEmail(parsed.data.contactEmail),
    gateAnswerSources,
    stage: "drafted",
    createdAtIso: new Date().toISOString(),
    contactedAtIso: null,
  };

  const { prospectId: _id, ...stored } = prospect;
  await db.collection(COLLECTION).doc(prospectId).set(stored);
  return res.status(201).json({ ok: true, prospect });
});

router.get("/", async (_req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const snapshot = await db.collection(COLLECTION).limit(200).get();
  const prospects = snapshot.docs.map((doc) => ({ prospectId: doc.id, ...doc.data() }));
  return res.json({ ok: true, prospects });
});

/** Owner preparation only: no OAuth redirect, token input, API call or write. */
router.get("/communications/connection", async (_req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, connection: founderMailboxConnectionPlan() });
});

router.get("/communications/blocked-jobs", async (_req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  res.setHeader("Cache-Control", "no-store");
  try { return res.json({ ok: true, jobs: await new CommunicationsStore(db).blockedJobs() }); }
  catch { return res.status(503).json({ error: "communications_store_unavailable" }); }
});

/** Research publication plus human context, previewed before any approval write. */
for (const approve of [false, true]) {
  router.post(`/:prospectId/communications/research-${approve ? "approve" : "preview"}`, async (req: Request, res: Response) => {
    if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
    const actor = res.locals.firebaseUser?.uid;
    if (typeof actor !== "string" || !actor.trim()) return res.status(403).json({ error: "operator_identity_missing" });
    if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
    const schema = approve ? communicationsResearchInputSchema.extend({
      previewDigest: z.string().regex(/^[a-f0-9]{64}$/), contextReviewed: z.literal(true),
    }).strict() : communicationsResearchInputSchema;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "research_context_invalid" });
    const prospectId = String(req.params.prospectId || "");
    if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId)) return res.status(400).json({ error: "research_context_invalid" });
    res.setHeader("Cache-Control", "no-store");
    try {
      const prospect = await readProspect(prospectId);
      if (!prospect) return res.status(404).json({ error: "not_found" });
      const input = { date: parsed.data.date, candidateKey: parsed.data.candidateKey, context: parsed.data.context };
      const now = Date.now();
      const preview = previewResearchCommunications(await readExistingResearchSnapshot(db, input.date), prospectId, prospect, input, now);
      if (!approve) return res.json({ ok: true, preview });
      const expectedDigest = "previewDigest" in parsed.data && typeof parsed.data.previewDigest === "string" ? parsed.data.previewDigest : "";
      const approved = await approveResearchCommunications(db, preview, input,
        expectedDigest, actor, now);
      return res.status(approved.created ? 201 : 200).json({ ok: true, ...approved,
        sent: false, gmailDraftCreated: false, sessionCreated: false, jobQueued: false });
    } catch (error) {
      const code = error instanceof Error && /^research_[a-z0-9_:,.-]+$/.test(error.message)
        ? error.message : "research_context_missing_or_invalid";
      return res.status(409).json({ error: code });
    }
  });
}

/** Enqueue references only; the communications worker loads authoritative data. */
router.post("/:prospectId/communications", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const parsed = z.object({
    briefId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/),
    intent: z.enum(["outreach", "reply"]),
    inboundMessageId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/).nullable(),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "communications_job_invalid" });
  const prospectId = String(req.params.prospectId || "");
  try {
    const store = new CommunicationsStore(db);
    const brief = await store.brief(parsed.data.briefId);
    if (brief.prospectId !== prospectId || !(await readProspect(prospectId))) return res.status(409).json({ error: "canonical_prospect_mismatch" });
    const job = await store.enqueue({ ...parsed.data, prospectId, briefDigest: communicationsDigest(brief) });
    return res.status(202).json({ ok: true, job, sent: false, gmailDraftCreated: false });
  } catch { return res.status(409).json({ error: "communications_context_missing_or_invalid" }); }
});

/** Owner selects one canonical draft; the existing worker performs inference.
 * This request never grants approval, changes worker flags, or writes Gmail. */
router.post("/:prospectId/communications/generate", async (req: Request, res: Response) => {
  const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
  if (!(await requireOps(res)) || !ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "communications_draft_owner_required" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const parsed = z.object({
    briefId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/), expectedBriefDigest: z.string().regex(/^[a-f0-9]{64}$/),
    expectedSourceCommit: z.string().regex(/^[a-f0-9]{40}$/), sessionSpendLimitCents: z.number().int().positive().max(Math.floor(Number.MAX_SAFE_INTEGER / 10000)),
    regenerationOf: z.string().regex(/^[a-f0-9]{64}$/).optional(), expectedJobDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict().refine(value => Boolean(value.regenerationOf) === Boolean(value.expectedJobDigest)).safeParse(req.body);
  const prospectId = String(req.params.prospectId ?? "");
  if (!parsed.success || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId)) return res.status(400).json({ error: "communications_draft_request_invalid" });
  res.setHeader("Cache-Control", "no-store");
  try {
    if (parsed.data.expectedSourceCommit !== process.env.RENDER_GIT_COMMIT) throw Error("communications_draft_runtime_changed");
    const readiness = (await db.doc(SAVED_RECOVERY_WORKER).get()).data() as SavedRecoveryReadiness | undefined;
    // Outreach controls belong to the worker; its source-bound heartbeat validates them.
    assertSavedRecoveryWorker(readiness, parsed.data.expectedSourceCommit, ownerUid, Date.now());
    if (readiness?.serviceId === process.env.RENDER_SERVICE_ID) throw Error("communications_draft_requires_existing_worker");
    await requireFounderDraftCapability(); await verifyFounderMailbox();
    const { expectedSourceCommit, ...input } = parsed.data;
    const job = await new CommunicationsStore(db).requestDraft({ ...input, prospectId, sourceCommit: expectedSourceCommit }, ownerUid);
    return res.status(202).json({ ok: true, jobId: job.jobId, state: job.state, request: job.manualDraftRequest,
      executionPlacement: "existing_background_worker", sent: false, gmailDraftCreated: false });
  } catch (error) {
    const code = error instanceof Error && /^communications_[a-z_]+$/.test(error.message) ? error.message : "communications_draft_context_unavailable";
    return res.status(409).json({ error: code });
  }
});

router.get("/:prospectId/communications", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const ref = db.collection(COLLECTION).doc(String(req.params.prospectId));
  const prospect = await ref.get();
  if (!prospect.exists) return res.status(404).json({ error: "not_found" });
  const events = await ref.collection("communicationsEvents").limit(30).get();
  const followups = await ref.collection("replyFollowups").get();
  const jobs = await new CommunicationsStore(db).jobsForProspect(String(req.params.prospectId));
  return res.json({ ok: true, jobs, communications: prospect.data()?.communications ?? null,
    replyFollowups: followups.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    events: events.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
});

router.post("/:prospectId/communications/followups/:handoffId/review", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  const actor = res.locals.firebaseUser?.uid;
  if (typeof actor !== "string" || !actor.trim()) return res.status(403).json({ error: "operator_identity_missing" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const input = replyFollowupReviewSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "reply_followup_review_invalid" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const handoff = await reviewReplyFollowup(db, String(req.params.prospectId), String(req.params.handoffId), input.data, actor, Date.now());
    return res.json({ ok: true, handoff, sent: false, sessionCreated: false, gmailDraftCreated: false });
  } catch { return res.status(409).json({ error: "reply_followup_review_conflict" }); }
});

router.get("/:prospectId/communications/followups", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const prospectId = String(req.params.prospectId);
  if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId)) return res.status(400).json({ error: "prospect_invalid" });
  // Owner review remains accessible when the canonical prospect needs repair.
  const rows = await db.collection(COLLECTION).doc(prospectId).collection("replyFollowups").get();
  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, replyFollowups: rows.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
});

/** Recover an existing session and its usage without inference, queue or send. */
router.post("/:prospectId/communications/:jobId/reconcile-draft", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const requestedBy = typeof res.locals.firebaseUser?.uid === "string" ? res.locals.firebaseUser.uid.trim() : "";
  if (!requestedBy) return res.status(403).json({ error: "operator_identity_missing" });
  const parsed = z.object({ briefDigest: z.string().regex(/^[a-f0-9]{64}$/),
    expectedCheckpointDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sessionId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/) }).strict().safeParse(req.body);
  const prospectId = String(req.params.prospectId || ""), jobId = String(req.params.jobId || "");
  if (!parsed.success || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId) || !/^[a-f0-9]{64}$/.test(jobId)) {
    return res.status(400).json({ error: "communications_draft_recovery_invalid" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const api = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY, allowPaidInference: false });
    const recovery = await reconcileCommunicationsDraftSession(db, api, { prospectId, jobId, ...parsed.data, requestedBy }, Date.now());
    return res.json({ ok: true, ...recovery, sent: false, sessionCreated: false, jobQueued: false });
  } catch { return res.status(409).json({ error: "communications_draft_recovery_not_verified" }); }
});

/** Web reports the execution worker's source-bound, fresh measurement. Missing
 * heartbeat, provider, controls or full cgroup headroom stays unavailable. */
router.get("/communications/recovery-runtime", async (_req: Request, res: Response) => {
  const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
  if (!(await requireOps(res)) || !ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "communications_recovery_owner_required" });
  res.setHeader("Cache-Control", "no-store");
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const worker = (await db.doc(SAVED_RECOVERY_WORKER).get()).data() as SavedRecoveryReadiness | undefined;
  const sourceCommit = process.env.RENDER_GIT_COMMIT ?? null;
  const workerFresh = Boolean(worker?.version === "existing-worker-saved-recovery-v1" && worker.executionPlacement === "existing_background_worker"
    && worker.serviceId && worker.serviceId !== process.env.RENDER_SERVICE_ID && worker.sourceCommit === sourceCommit && worker.ownerUid === ownerUid
    && Number.isSafeInteger(worker.observedAtMs) && worker.observedAtMs <= Date.now() && Date.now() - worker.observedAtMs <= SAVED_RECOVERY_FRESH_MS);
  let headroomAvailable = false;
  try { if (workerFresh && worker?.headroomAvailable && worker.headroomReserveBytes === COMMUNICATIONS_RECOVERY_HEADROOM_BYTES) { assertCommunicationsRecoveryHeadroom(worker.memory); headroomAvailable = true; } } catch { /* Full worker cgroup remains authoritative. */ }
  return res.json({ sourceCommit, existingProcess: true, executionPlacement: "existing_background_worker", workerServiceId: worker?.serviceId ?? null, workerFresh,
    providerKeyConfigured: workerFresh && worker?.providerKeyConfigured === true, founderBindingConfigured: workerFresh && worker?.founderBindingConfigured === true,
    memory: worker?.memory ?? null, headroomAvailable,
    headroomReserveBytes: COMMUNICATIONS_RECOVERY_HEADROOM_BYTES, outreachControlsOff: workerFresh && worker?.outreachControlsOff === true && SAVED_RECOVERY_CONTROLS.every(key => worker?.controls?.[key] === "literal_off"),
    controls: worker?.controls ?? null, sent: false, sessionCreated: false, gmailDraftCreated: false });
});
const recoveryRequestView = (record: SavedRecoveryRequest | undefined) => record ? { actorUid: record.actorUid, requestDigest: record.requestDigest,
  generation: record.generation, state: record.state, expiresAtMs: record.expiresAtMs, cancelRequested: record.cancelRequested,
  expectedSourceCommit: record.input.expectedSourceCommit, sessionId: record.input.sessionId, result: record.result ?? null, error: record.error ?? null } : null;
/** Explicit owner intent; Web needs no model key and runs no model consumer. */
router.post("/:prospectId/communications/:jobId/recover-saved-draft", async (req: Request, res: Response) => {
  const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
  if (!(await requireOps(res)) || !ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "communications_recovery_owner_required" });
  if (!db) return res.status(503).json({ error: "communications_recovery_runtime_unavailable" });
  const parsed = communicationsInprocessRecoverySchema.safeParse(req.body);
  const prospectId = String(req.params.prospectId ?? ""), jobId = String(req.params.jobId ?? "");
  if (!parsed.success || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId) || !/^[a-f0-9]{64}$/.test(jobId)) return res.status(400).json({ error: "communications_saved_recovery_input_invalid" });
  res.setHeader("Cache-Control", "no-store");
  try {
    await requireFounderDraftCapability(); await verifyFounderMailbox();
    const request = await enqueueSavedRecovery(db, { prospectId, jobId, ...parsed.data }, ownerUid, Date.now());
    return res.status(202).json({ ok: true, state: request.state, request: recoveryRequestView(request), executionPlacement: "existing_background_worker",
      sessionCreated: false, sent: false, gmailDraftCreated: false, existingProcess: true });
  } catch (error) {
    const code = error instanceof Error && /^communications_[a-z_]+$/.test(error.message) ? error.message : "communications_saved_recovery_not_verified";
    return res.status(409).json({ error: code, sent: false, sessionCreated: false, gmailDraftCreated: false });
  }
});
router.get("/:prospectId/communications/:jobId/saved-recovery", async (req: Request, res: Response) => {
  const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
  if (!(await requireOps(res)) || !ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "communications_recovery_owner_required" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const jobId = String(req.params.jobId ?? ""), prospectId = String(req.params.prospectId ?? "");
  if (!/^[a-f0-9]{64}$/.test(jobId)) return res.status(400).json({ error: "communications_saved_recovery_input_invalid" });
  const record = (await db.doc(`${SAVED_RECOVERY_REQUESTS}/${jobId}`).get()).data() as SavedRecoveryRequest | undefined;
  if (record && (record.actorUid !== ownerUid || record.input.prospectId !== prospectId)) return res.status(409).json({ error: "communications_saved_recovery_intent_binding_changed" });
  res.setHeader("Cache-Control", "no-store"); return res.json({ ok: true, request: recoveryRequestView(record), sent: false, gmailDraftCreated: false, sessionCreated: false });
});
router.post("/:prospectId/communications/:jobId/saved-recovery/cancel", async (req: Request, res: Response) => {
  const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
  if (!(await requireOps(res)) || !ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "communications_recovery_owner_required" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const parsed = z.object({ generation: z.number().int().positive(), requestDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
  const jobId = String(req.params.jobId ?? "");
  if (!parsed.success || !/^[a-f0-9]{64}$/.test(jobId)) return res.status(400).json({ error: "communications_saved_recovery_input_invalid" });
  try {
    const prior = (await db.doc(`${SAVED_RECOVERY_REQUESTS}/${jobId}`).get()).data() as SavedRecoveryRequest | undefined;
    if (!prior || prior.input.prospectId !== String(req.params.prospectId ?? "")) throw Error("communications_saved_recovery_intent_binding_changed");
    const request = await cancelSavedRecovery(db, jobId, ownerUid, parsed.data.generation, parsed.data.requestDigest, Date.now());
    res.setHeader("Cache-Control", "no-store"); return res.json({ ok: true, request: recoveryRequestView(request), sent: false, gmailDraftCreated: false, sessionCreated: false });
  } catch { return res.status(409).json({ error: "communications_saved_recovery_cancel_not_verified" }); }
});

/** Requeue one blocked job after repair; retain its create claim and budget. */
router.post("/:prospectId/communications/:jobId/retry", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "communications_store_unavailable" });
  const user = res.locals.firebaseUser;
  const requestedBy = typeof user?.uid === "string" ? user.uid.trim() : "";
  if (!requestedBy) return res.status(403).json({ error: "operator_identity_missing" });
  const parsed = z.object({ briefDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
  const prospectId = String(req.params.prospectId || ""), jobId = String(req.params.jobId || "");
  if (!parsed.success || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(prospectId) || !/^[a-f0-9]{64}$/.test(jobId)) {
    return res.status(400).json({ error: "communications_retry_invalid" });
  }
  try {
    const job = await new CommunicationsStore(db).retryBlocked({ prospectId, jobId, ...parsed.data, requestedBy });
    return res.status(202).json({ ok: true, job, sent: false, sessionCreated: false });
  } catch { return res.status(409).json({ error: "communications_retry_not_eligible" }); }
});

/**
 * Draft the email, without sending it.
 *
 * Separate from `/send` on purpose. The agent proposes; a person reads, edits
 * and then approves that exact text by posting it back. One route that drafted
 * and sent would mean nobody ever saw what went out, which is the failure mode
 * an outbound beta exists to avoid.
 */
router.post("/:prospectId/draft", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  // Checked before spending a model call: a prospect with no sourced
  // observations has nothing specific to say, and a generic cold email is
  // worse than none -- it burns the address and teaches nothing.
  const guard = await guardProspectSend(prospect);
  if (!guard.send && !DRAFTABLE_BLOCKERS.has(guard.blocker)) {
    return res.status(409).json({ ok: false, blocker: guard.blocker, detail: guard.detail });
  }

  try {
    const result = await runAgentTask<OutboundOutreachInput, OutboundOutreachOutput>({
      kind: "outbound_outreach",
      input: {
        prospectId,
        facilityName: prospect.facilityName,
        facilityAddress: prospect.facilityAddress,
        observations: prospect.observations,
        hypothesisedTask: prospect.hypothesisedTask,
        inferredGates: prospect.inferredGates,
        connectionEvidence: prospect.connectionEvidence ?? null,
        teamObservations: prospect.teamObservations ?? [],
        verifiedCapabilities: prospect.verifiedCapabilities ?? [],
      },
      session_key: `outbound:${prospectId}`,
      metadata: { prospect_id: prospectId },
    });

    if (result.status !== "completed" || !result.output) {
      return res.status(502).json({ error: result.error || "Draft could not be written" });
    }

    return res.json({
      ok: true,
      draft: result.output,
      outreachReview: reviewOutreachDraft({
        to: prospect.contactEmail,
        subject: result.output.subject,
        body: result.output.body,
        contract: result.output.outreach_contract,
        context: {
          observations: prospect.observations, connectionEvidence: prospect.connectionEvidence ?? null,
          teamObservations: prospect.teamObservations ?? [], verifiedCapabilities: prospect.verifiedCapabilities ?? [],
        },
      }),
      note: "Review the five outreach rules and discovery workflow before sending. Send edited text with outreachContract; the action-queue approval requires a separate semantic review of that exact draft.",
    });
  } catch (error) {
    logger.error({ error, prospectId }, "Outbound outreach draft failed");
    return res.status(502).json({ error: "Draft could not be written" });
  }
});

/**
 * Send the approved draft.
 *
 * The draft arrives in the request body rather than being generated here: a
 * person has read it, possibly edited it, and is now approving that exact text.
 * Generating and sending in one call would mean nobody ever saw what went out.
 *
 * Note that this **queues**. `OUTBOUND_PROSPECT_POLICY.alwaysHumanReview` puts
 * every send at tier 3, so `executeAction` writes a ledger entry and returns
 * `pending_approval`; the mailer is not called until someone releases it at
 * `/api/admin/leads/action-queue/:ledgerId/approve`. The response says so
 * outright, because an operator who reads a 202 as "sent" would conclude that
 * twenty facilities ignored them when in fact nothing was ever sent.
 *
 * This route is not gated by the communications send flag for hand-chosen
 * prospects. It refuses outreach-ready hypotheses always, and research-derived
 * prospects while BLUEPRINT_COMMUNICATIONS_SEND_ENABLED is off; approval
 * re-applies both refusals before the mailer runs.
 */
router.post("/:prospectId/send", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Draft is invalid", code: "draft_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  const guard = await guardProspectSend(prospect);
  if (!guard.send) {
    // A refusal is a real outcome worth reading, not a transport error.
    return res.status(409).json({ ok: false, blocker: guard.blocker, detail: guard.detail });
  }

  const outreachContext = {
    observations: prospect.observations, connectionEvidence: prospect.connectionEvidence ?? null,
    teamObservations: prospect.teamObservations ?? [], verifiedCapabilities: prospect.verifiedCapabilities ?? [],
  };
  const outreachReview = reviewOutreachDraft({
    to: guard.email, subject: parsed.data.subject, body: parsed.data.body,
    contract: parsed.data.outreachContract, context: outreachContext,
  });
  if (!outreachReview.hardChecksPassed) {
    return res.status(409).json({ ok: false, blocker: "outreach_quality_failed", outreachReview });
  }

  const unsubscribeUrl = buildUnsubscribeUrl({
    email: guard.email,
    scope: "growth_campaign",
    campaignId: `outbound_prospect_${prospectId}`,
  });

  try {
    const action = await executeAction({
      sourceCollection: COLLECTION,
      sourceDocId: prospectId,
      actionType: "send_email",
      actionPayload: {
        type: "send_email",
        to: guard.email,
        subject: parsed.data.subject,
        body: parsed.data.body,
        outreachContract: parsed.data.outreachContract,
        outreachContext,
        commercialEmail: true,
        emailSuppressionScope: "growth_campaign",
        unsubscribeUrl,
        sendGridCategories: ["blueprint_outbound_prospect"],
      },
      safetyPolicy: OUTBOUND_PROSPECT_POLICY,
      draftOutput: {
        recommendation: "outbound_prospect_touch",
        confidence: 0.5,
        // Always true for this lane. Stated here as well so the record of why
        // it needed a person survives independently of the policy object.
        requires_human_review: true,
        category: "outbound_prospect",
        facility_name: prospect.facilityName,
        reason_for_contact: prospect.reasonForContact,
      },
      idempotencyKey: `outbound_prospect_send:${prospectId}`,
    });

    if (db) {
      await db.collection(COLLECTION).doc(prospectId).set(
        { stage: "contacted", contactedAtIso: new Date().toISOString() },
        { merge: true },
      );
    }

    // `alwaysHumanReview` means this is queued, not sent. Saying so in the
    // response -- with the exact route that releases it -- is the difference
    // between a beta that sent twenty emails and one where the operator
    // believed they had. A 202 alone reads like "sent".
    const pending = action.state === "pending_approval";

    return res.status(202).json({
      ok: true,
      action,
      outreachReview,
      sent: !pending,
      ...(pending
        ? {
            nextStep: `Not sent yet. Release it with POST /api/admin/leads/action-queue/${action.ledgerDocId}/approve (admin role required).`,
          }
        : {}),
    });
  } catch (error) {
    logger.error({ error, prospectId }, "Outbound prospect send failed");
    return res.status(502).json({ error: "The send did not complete" });
  }
});

/**
 * A reply, turned into an ordinary inbound request.
 *
 * Only the gates the operator actually addressed become `operator_stated`.
 * Everything they did not mention stays inferred and continues to hold capture
 * dispatch, so a warm reply cannot silently ratify five guesses.
 */
router.post("/:prospectId/convert", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Conversion is invalid", code: "conversion_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  const payload = convertProspectToRequestPayload({
    prospect,
    statedGates: parsed.data.statedGates,
    taskStatement: parsed.data.taskStatement,
    captureMode: parsed.data.captureMode ?? null,
  });

  // Run the real decision rather than describing it. The operator's next move
  // is a follow-up email, and what that email should ask is exactly the hold
  // reason: "still resting on sceneStability, accessWindow" is two questions,
  // where "some gates remain inferred" is a shrug. Same functions the inbound
  // path uses, so the preview cannot disagree with the eventual dispatch.
  const captureMode = isCaptureMode(payload.captureMode) ? payload.captureMode : preferredCaptureMode;
  const triage = triageGateAnswers(payload.siteTaskGates, undefined, captureMode);
  const dispatch = decideCaptureDispatch({
    disposition: triage.disposition,
    captureMode,
    unanswered: triage.unanswered,
    bindingFieldIds: bindingGateFieldIds(captureMode),
    gateAnswerSources: payload.gateAnswerSources,
  });

  await db.collection(COLLECTION).doc(prospectId).set({ stage: "converted" }, { merge: true });

  // Returned rather than posted onward: during the beta a person carries this
  // into the intake so the conversion is observed at least twenty times before
  // anything does it unattended.
  return res.status(200).json({
    ok: true,
    requestPayload: payload,
    dispatch,
    dispatchSummary: describeCaptureDispatch(dispatch),
    note: "Gates the operator did not state remain inferred and will hold capture dispatch.",
  });
});

/**
 * They asked us to stop.
 *
 * The one route an outbound program cannot be run without. A footer
 * unsubscribe link handles the person who clicks it; almost nobody does. What
 * actually arrives is a one-line reply saying take us off your list, read by a
 * person, and without somewhere to put it that request lives in someone's
 * memory until it does not.
 *
 * So closing writes the suppression entry, not just the stage. Suppression is
 * scoped to `growth_campaign`, which is the promise being made: we will not
 * approach you again. If this facility later becomes a customer, the lifecycle
 * mail it has asked for is a different scope and is untouched.
 */
router.post("/:prospectId/close", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });
  if (!db) return res.status(503).json({ error: "Prospect store is unavailable" });

  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A reason is required to close a prospect", code: "close_invalid" });
  }

  const prospectId = String(req.params.prospectId || "").trim();
  const prospect = await readProspect(prospectId);
  if (!prospect) return res.status(404).json({ error: "not_found" });

  // Suppression first. If the stage write succeeded and this failed, the
  // prospect would look handled while still being sendable, which is the one
  // ordering that can produce a second email to someone who declined.
  const suppression = await recordEmailSuppression({
    email: prospect.contactEmail,
    scope: "growth_campaign",
    reason: parsed.data.reason,
    source: "outbound_prospect_close",
    campaignId: `outbound_prospect_${prospectId}`,
  });

  if (!suppression.persisted) {
    return res.status(503).json({
      error: "The opt-out could not be recorded, so the prospect stays open rather than looking handled.",
      code: "suppression_unavailable",
    });
  }

  await db.collection(COLLECTION).doc(prospectId).set(
    { stage: "closed", closedReason: parsed.data.reason, closedAtIso: new Date().toISOString() },
    { merge: true },
  );

  return res.json({ ok: true, stage: "closed", suppressedEmail: suppression.email });
});

export default router;
