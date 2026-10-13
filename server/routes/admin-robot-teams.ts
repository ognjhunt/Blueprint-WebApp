/**
 * The review queue.
 *
 * A proposal nobody can act on is just a log line. This is the surface where a
 * person turns a model's reading of a public page into a registry value — or
 * declines it, which is the more common and more valuable outcome.
 *
 * Every route here is behind `verifyFirebaseToken` at registration. The accept
 * path records who accepted, because "a person reviewed this" is only a real
 * guarantee if the person is named.
 */
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import { z } from "zod";

import {
  applyProposal,
  getRobotTeam,
  listMatchableRobotTeams,
  listPendingProposals,
} from "../utils/robotTeamRegistry";
import { hasAnyRole } from "../utils/access-control";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxEntry } from "../utils/captureOutbox";
import { buildPilotRecommendationNotification } from "../utils/pilotRecommendationNotifications";
import { decryptFieldValue } from "../utils/field-encryption";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
import { requireAdminRole } from "../middleware/requireAdminRole";
import {
  creditTeam,
  getSpendPolicy,
  getSpendToday,
  getTeamBalance,
  setSpendPolicy,
} from "../utils/robotTeamBalance";
import {
  issueAgentKey,
  listAgentKeys,
  revokeAgentKey,
} from "../utils/robotTeamAgentKeys";

const router = Router();
// Every route here is operator-only. The queue and the registry used to check
// only that a caller was signed in, so any robot team or site with an account
// could list every team.
router.use(requireAdminRole);

import { getBrief } from "../utils/siteTaskBrief";
import { getAccessRecordForEmail } from "../utils/robotTeamEarlyAccess";
import { loadCurrentSiteAssessmentView } from "../utils/siteAssessmentPublic";
import { readPilotCalendarEvent } from "../utils/google-calendar";
import { projectPilotCoordination } from "../utils/pilotCoordination";
import { buildTaskLifecycleNotification } from "../utils/taskLifecycleNotifications";
import { pilotRecommendationEventId, pilotScheduledEventId } from "../utils/pilotRecommendationNotifications";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { projectCurrentSiteJobDecision, siteJobDecisionSourceDigest } from "../utils/siteJobDecision";
import siteJobCommunicationsRouter from "./admin-site-job-communications";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { explicitlyLinked, resolveRobotTeamIdentity } from "../utils/robotTeamIdentity";
import { prepareTeamPilotNotice } from "../utils/robotTeamPilotNotifications";
import type { RobotTeamRecord } from "../types/robot-team-registry";
import {
  EVIDENCE_REFUSAL_MESSAGES,
  SIMULATION_EVIDENCE_BOUNDARY,
  evidenceCapabilityBasis,
  passMarkForJob,
  readEvaluation,
  verifyRecommendationEvidence,
  type EvidenceRefusal,
  type RunWithResult,
} from "../utils/pilotRecommendationEvidence";

router.use(siteJobCommunicationsRouter);

const decisionSchema = z.object({ sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  recommendation: z.string().trim().min(8).max(2000), why: z.string().trim().min(8).max(2000),
  decisiveUncertainty: z.string().trim().max(2000), nextAction: z.string().trim().min(8).max(2000),
  question: z.object({ text: z.string().trim().min(8).max(1000), reason: z.string().trim().min(8).max(1000) }).strict().nullable().default(null),
}).strict();

/** Human judgment is useful before a provider is ready to propose a pilot. */
router.post("/recommendations/:requestId/decision", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body), actor = String(res.locals.firebaseUser?.uid ?? "").trim();
  if (!parsed.success || !actor) return res.status(400).json({ error: "A named reviewer must record the recommendation, why, decisive uncertainty and Blueprint's next action against the current evidence." });
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const requestId = String(req.params.requestId), input = parsed.data;
  try {
    await db.runTransaction(async tx => {
      const ref = db!.collection("inboundRequests").doc(requestId), current = (await tx.get(ref)).data();
      const brief = (await tx.get(db!.collection("siteTaskBriefs").doc(requestId))).data() ?? null;
      if (!current) throw new Error("job_missing");
      const assessment = await loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: current.account_owner_uid ?? null });
      if (siteJobDecisionSourceDigest(current, brief, assessment.decisionAssessment) !== input.sourceDigest) throw new Error("decision_source_changed");
      if (current.customer_decision?.sourceDigest === input.sourceDigest
        && humanDecisionDigest({ recommendation: current.customer_decision.recommendation, why: current.customer_decision.why,
          decisiveUncertainty: current.customer_decision.decisiveUncertainty, nextAction: current.customer_decision.nextAction,
          question: current.customer_decision.question ?? null }) === humanDecisionDigest({ recommendation: input.recommendation,
          why: input.why, decisiveUncertainty: input.decisiveUncertainty, nextAction: input.nextAction, question: input.question })) return;
      tx.update(ref, { customer_decision: { schemaVersion: "site_job_decision.v1", ...input,
        reviewedBy: actor, reviewedAtIso: new Date().toISOString() }, customerAnswerReviewRequired: false,
        customerAnswerNextOwner: "Blueprint", customerAnswerNextAction: input.nextAction });
    });
    return res.json({ ok: true });
  } catch { return res.status(409).json({ error: "The job or assessment changed. Reload the current evidence before recording the decision." }); }
});

const runIdSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const recommendationSchema = z.object({
  briefRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** The completed evaluation of this job the recommendation stands on. Required. */
  evaluationRunId: runIdSchema,
  /** The result the reviewer saw (`resultId` from the evaluations list). Optional, binding when sent. */
  resultId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** Optional: when sent, it must be the same team as the run's (any linked registry row). */
  teamId: z.string().trim().min(1).max(120).optional(),
  purpose: z.string().trim().min(8).max(400),
  siteProvides: z.string().trim().min(4).max(400),
  teamProvides: z.string().trim().min(4).max(400),
  pilotCost: z.string().trim().min(2).max(120),
  window: z.string().trim().min(2).max(120),
  successCondition: z.string().trim().max(1000).default("Not yet agreed — confirm the measurable success condition."),
  exclusions: z.string().trim().max(1000).default("Production deployment, purchases and private footage sharing require separate approval."),
  costBasis: z.string().trim().max(600).default("Set by the robot team; obtain its written quote and applicable terms. Blueprint charges nothing during the beta."),
  sitePreparation: z.string().trim().max(1000).default("Not yet agreed."),
  humanWork: z.string().trim().max(1000).default("Confirm setup, supervision, safety review and operator responsibilities."),
  /** Blank means: stated from the evaluation evidence. */
  capabilityBasis: z.string().trim().max(1000).optional(),
  providerCommitment: z.string().trim().max(600).default("Not confirmed. Interest does not reserve provider capacity."),
  uncertainties: z.string().trim().max(400).default(""),
  alternative: z.string().trim().max(400).default(""),
}).strict();

/**
 * Registry statuses of a team we have talked to. A prospect has not told us
 * it wants the pilot and a declined team said no.
 *
 * `self_registered` is recommendable too, on two conditions, because in the
 * beta the evaluation itself is the measurement: the team is bound to a
 * verified account whose email Blueprint invited (access approved), and it
 * has a passing evaluation of this job, which the route checks separately.
 * Development-only results deliberately never promote a team's registry
 * status (`agentRunResults`), so status alone could never get it here.
 */
const RECOMMENDABLE_STATUSES = new Set(["applied", "engaged"]);

type TeamRefusal = { code: string; error: string };

async function recommendableTeam(runTeamId: string, requestedTeamId?: string):
  Promise<{ ok: true; team: RobotTeamRecord; memberIds: string[] } | ({ ok: false } & TeamRefusal)> {
  const identity = await resolveRobotTeamIdentity(runTeamId);
  if (!identity) return { ok: false, code: "team_not_registered", error: "The evaluated team has no registry record. Recommend a registered team." };
  if (identity.ambiguous || !identity.canonical) {
    return { ok: false, code: "team_identity_ambiguous", error: "The evaluated team's registry records name more than one account. Resolve the split before recommending it." };
  }
  const team = identity.canonical;
  if (requestedTeamId && requestedTeamId !== team.id && !identity.members.some(row => row.id === requestedTeamId)) {
    const requested = await resolveRobotTeamIdentity(requestedTeamId);
    if (requested?.ambiguous || requested?.canonical?.id !== team.id) {
      return { ok: false, code: "evaluation_team_mismatch", error: "That evaluation was run by a different team. The recommended team must be the team whose evaluation passed." };
    }
  }
  // Only rows linked by pointer count against the team: an email-only match
  // could be a typed public intake, and must not be able to take a team out.
  if (identity.members.some(row => row.status === "declined" && explicitlyLinked(team, row))) {
    return { ok: false, code: "team_declined", error: "This team declined. A declined team is not recommended." };
  }
  const bound = typeof team.accountUid === "string" && team.accountUid.length > 0;
  const accessEmail = team.status === "self_registered" ? (bound ? team.accountEmail : null) : team.accountEmail || team.contactEmail;
  const admitted = (await getAccessRecordForEmail(accessEmail))?.status === "approved";
  const statusOk = RECOMMENDABLE_STATUSES.has(team.status) || (team.status === "self_registered" && bound);
  if (!statusOk || !admitted) {
    return { ok: false, code: "team_not_recommendable", error: "Recommend a registered, invitation-approved team. Admission does not establish capability or availability." };
  }
  return { ok: true, team, memberIds: identity.members.map(row => row.id) };
}

function evidenceRefusal(res: Response, refusal: EvidenceRefusal) {
  return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: refusal, error: EVIDENCE_REFUSAL_MESSAGES[refusal] });
}

/**
 * Blueprint's one recommended pilot for a site job. Blueprint does the
 * technical selection; the site's only decision is whether to book it.
 *
 * The recommendation stands on one evaluation of this job: the run is named,
 * and the team is derived from the run, never typed. The server re-reads the
 * run in the same transaction that writes the recommendation, checks that it
 * is this job's, completed and passing the job's pass mark, and stores an
 * immutable evidence snapshot on the recommendation (see
 * `pilotRecommendationEvidence`). Replacing a recommendation gives it a new
 * id, so a booking can never bind text or evidence the site did not see, and
 * a booked pilot is not replaced. The check and write share one transaction
 * with the site notice and the recommended team's notice.
 */
router.post("/recommendations/:requestId", async (req: Request, res: Response) => {
  const parsed = recommendationSchema.safeParse(req.body);
  if (!parsed.success) {
    if (!req.body || typeof req.body !== "object" || !("evaluationRunId" in req.body)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: "evaluation_run_required",
        error: "Choose the completed evaluation of this job the recommendation stands on. A recommendation needs a passing evaluation." });
    }
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Fill in the evaluation, purpose, what each side provides, cost and window." });
  }
  if (!db) return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Store unavailable" });
  const store = db;
  const requestId = String(req.params.requestId);
  const { teamId: requestedTeamId, briefRevision, evaluationRunId, resultId, capabilityBasis, ...rest } = parsed.data;
  try {
    const runRef = store.collection("evaluationRuns").doc(evaluationRunId);
    const preRun = (await runRef.get()).data() as RunWithResult | undefined;
    if (!preRun) return evidenceRefusal(res, "evaluation_run_missing");
    if (preRun.sceneId !== requestId) return evidenceRefusal(res, "evaluation_run_other_job");
    const eligible = await recommendableTeam(preRun.teamId, requestedTeamId);
    if (!eligible.ok) return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, code: eligible.code, error: eligible.error });
    const team = eligible.team;
    const captureUrl = captureUploadUrlFor(requestId, "owner");
    const rows = new Map<string, ReturnType<typeof buildOutboxEntry>>();
    const teamRows = new Map<string, OutboxEntry>();
    const proposedId = `rec_${randomUUID()}`;
    const recommendedAtIso = new Date().toISOString();
    const ref = store.collection("inboundRequests").doc(requestId);
    const outcome = await store.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (!current.exists) return { status: "missing" } as const;
      const record = current.data()!;
      const currentBrief = await transaction.get(store.collection("siteTaskBriefs").doc(requestId));
      const runSnapshot = await transaction.get(runRef);
      if ((briefRevision && briefRevision !== humanDecisionDigest(currentBrief.exists ? currentBrief.data() : null)) || (record.pilot_recommendation?.reviewRequired && !briefRevision)) return { status: "changed" } as const;
      if (record.pilot_booking) return { status: "booked" } as const;
      if (projectWebsiteCaptureRights(record).consent_revoked) return { status: "consent_withdrawn" } as const;
      const run = runSnapshot.data() as RunWithResult | undefined;
      // The team was resolved from this run before the transaction; a run that
      // changed hands since is not the evidence that was reviewed.
      if (run && run.teamId !== preRun.teamId) return { status: "refused", refusal: "evaluation_result_changed" } as const;
      const verified = verifyRecommendationEvidence({ run, requestId,
        passMark: passMarkForJob(record, currentBrief.exists ? currentBrief.data() : null), expectedResultId: resultId ?? null });
      if (!verified.ok) return { status: "refused", refusal: verified.refusal } as const;
      const evidence = verified.evidence;
      const plan = { ...rest, capabilityBasis: capabilityBasis || evidenceCapabilityBasis(evidence) };
      const previous = record.pilot_recommendation;
      const samePlan = !previous?.reviewRequired && typeof previous?.id === "string"
        && previous.evaluationRunId === evidence.runId && previous.evidence?.resultId === evidence.resultId
        && Object.entries({ teamId: team.id, teamName: team.name, ...plan })
          .every(([key, value]) => previous[key] === value);
      // One id per request, stable across Firestore callback retries. A lost
      // HTTP response can also retry an unchanged plan without replacing it.
      const proposed = {
        id: proposedId, teamId: team.id, teamName: team.name, registryTeamIds: eligible.memberIds,
        evaluationRunId: evidence.runId, evidenceScope: evidence.evidenceScope, evidence, ...plan,
        recommendedAtIso,
        recommendedBy: (res.locals?.firebaseUser?.uid as string | undefined) ?? null,
      };
      const recommendation = samePlan ? previous as typeof proposed : proposed;
      const to = String(await decryptFieldValue(record.contact?.email ?? "")).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { status: "contact_missing" } as const;
      const input = buildPilotRecommendationNotification({ requestId, recommendation, to, captureUrl });
      const intentRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(input.idempotencyKey);
      const intent = await transaction.get(intentRef);
      const legacyKey = `${requestId}:pilot_recommended:${recommendation.id}`;
      const legacyRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(legacyKey);
      const legacy = await transaction.get(legacyRef);
      const teamNotice = await prepareTeamPilotNotice(transaction, { kind: "team_pilot_recommended", requestId, recommendation }, teamRows);
      const matches = (existing: OutboxEntry, key: string) =>
        existing.idempotencyKey === key && existing.requestId === requestId
        && existing.kind === "pilot_recommended" && existing.to === to;
      if (intent.exists && !matches(intent.data() as OutboxEntry, input.idempotencyKey)) {
        throw new Error("Recommendation notification identity conflict");
      }
      // The previous writer used only the recommendation ID. Its pending,
      // acknowledged or ambiguous delivery is the SAME authorized event;
      // adding a recipient-hashed copy would send that recommendation twice.
      const reuseLegacy = legacy.exists && matches(legacy.data() as OutboxEntry, legacyKey);
      const existing = (reuseLegacy ? legacy.data() : intent.data()) as OutboxEntry | undefined;
      const existingRef = reuseLegacy ? legacyRef : intentRef;
      // All authoritative reads precede writes. Failure to persist either row
      // aborts the recommendation; no post-commit enqueue can lose the notice.
      if (!samePlan) transaction.update(ref, { pilot_recommendation: recommendation });
      if (!existing) {
        // Old handlers still enqueue this key after their source write. Reserve
        // it atomically when free, including on fresh bookings: an old-handler
        // retry must collide with this intent rather than create a second one.
        // An occupied different-recipient key remains immutable; that recipient
        // correction uses its own bound key and the dispatch source guard.
        const writeInput = legacy.exists ? input : { ...input, idempotencyKey: legacyKey };
        const writeRef = legacy.exists ? intentRef : legacyRef;
        // A Firestore retry may observe a corrected recipient even though the
        // legacy document key stays the same. Never reuse another recipient's
        // cached message merely because its reserved key matches.
        const rowKey = JSON.stringify([writeInput.idempotencyKey, writeInput.to]);
        if (!rows.has(rowKey)) rows.set(rowKey, buildOutboxEntry(writeInput));
        transaction.create(writeRef, rows.get(rowKey)!);
      } else if (existing.status === "cancelled" && existing.attempts === 0) {
        // A→B→A contact correction can restore an event cancelled before any
        // dispatch. Only this explicit, currently authorized admin retry may
        // rearm it; preserve all attempted/ambiguous/acknowledged histories.
        transaction.update(existingRef, { status: "pending", lastError: null });
      }
      teamNotice?.write(transaction);
      return { status: "ok", id: recommendation.id, evidence: recommendation.evidence ?? evidence, teamNotified: Boolean(teamNotice) } as const;
    });
    if (outcome.status === "changed") return res.status(409).json({ error: "The brief changed. Reload and review the proposal against the current job." });
    if (outcome.status === "missing") return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "Job not found" });
    if (outcome.status === "booked") return res.status(HTTP_STATUS.CONFLICT).json({ ok: false, error: "This proposal has already been accepted; reconcile changes with the parties before replacing it." });
    if (outcome.status === "contact_missing") return res.status(HTTP_STATUS.CONFLICT).json({ ok: false, error: "Add a valid site contact email before recommending this pilot." });
    if (outcome.status === "consent_withdrawn") return res.status(HTTP_STATUS.CONFLICT).json({ ok: false, code: "capture_consent_withdrawn", error: "The site withdrew recording permission. Its evaluations cannot back a recommendation." });
    if (outcome.status === "refused") return evidenceRefusal(res, outcome.refusal);
    return res.json({ ok: true, id: outcome.id, teamId: team.id, evidence: outcome.evidence, teamNotified: outcome.teamNotified });
  } catch (error) {
    logger.error({ err: error, requestId }, "Failed to record a pilot recommendation");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Unable to record the recommendation" });
  }
});

/**
 * Every evaluation run against one job, read against the job's pass mark, for
 * the reviewer choosing which evaluation a recommendation stands on.
 * Contract: docs/runbooks/pilot-recommendation-evidence.md.
 */
router.get("/jobs/:requestId/evaluations", async (req: Request, res: Response) => {
  if (!db) return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Store unavailable" });
  const requestId = String(req.params.requestId);
  try {
    const record = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (!record) return res.status(HTTP_STATUS.NOT_FOUND).json({ ok: false, error: "Job not found" });
    const brief = (await db.collection("siteTaskBriefs").doc(requestId).get()).data() ?? null;
    const passMark = passMarkForJob(record, brief);
    const snapshot = await db.collection("evaluationRuns").where("sceneId", "==", requestId).limit(200).get();
    const readings = snapshot.docs.map(doc => readEvaluation(doc.data() as RunWithResult, requestId, passMark));
    const teamIds = [...new Set(readings.map(reading => reading.teamId))];
    const teams = new Map(await Promise.all(teamIds.map(async teamId => [teamId, {
      record: await getRobotTeam(teamId), eligibility: await recommendableTeam(teamId),
    }] as const)));
    const consentWithdrawn = projectWebsiteCaptureRights(record).consent_revoked;
    const evaluations = readings.map(reading => {
      const team = teams.get(reading.teamId)!;
      const teamRefusal = team.eligibility.ok ? null : { code: team.eligibility.code, error: team.eligibility.error };
      return {
        ...reading,
        refusals: reading.refusals.map(code => ({ code, error: EVIDENCE_REFUSAL_MESSAGES[code] })),
        teamName: team.record?.name ?? null,
        recommendedTeamId: team.eligibility.ok ? team.eligibility.team.id : null,
        recommendedTeamName: team.eligibility.ok ? team.eligibility.team.name : null,
        teamRefusal,
        recommendable: !consentWithdrawn && reading.refusals.length === 0 && reading.passed === true && !teamRefusal,
      };
    }).sort((left, right) => Number(right.recommendable) - Number(left.recommendable)
      || String(right.evaluatedAtIso ?? right.requestedAtIso ?? "").localeCompare(String(left.evaluatedAtIso ?? left.requestedAtIso ?? "")));
    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, requestId, passMark, consentWithdrawn, boundary: SIMULATION_EVIDENCE_BOUNDARY,
      currentRecommendation: record.pilot_recommendation ? { id: record.pilot_recommendation.id,
        evaluationRunId: record.pilot_recommendation.evaluationRunId ?? null, booked: Boolean(record.pilot_booking) } : null,
      evaluations });
  } catch (error) {
    logger.error({ err: error, requestId }, "Job evaluations unavailable");
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Job evaluations unavailable" });
  }
});

/** Prepare the existing manual proposal from the same private job; never auto-match or publish. */
router.get("/recommendations/:requestId", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const requestId = String(req.params.requestId);
  try {
    const record = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (!record) return res.status(404).json({ error: "Job not found" });
    const [brief, teams, assessment, interests] = await Promise.all([getBrief(requestId),
      listMatchableRobotTeams({ statuses: ["applied", "engaged"] }),
      loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: record.account_owner_uid ?? null }),
      db.collection("inboundRequests").doc(requestId).collection("robotTeamInterest").limit(100).get()]);
    const admitted = (await Promise.all(teams.map(async team => (await getAccessRecordForEmail(team.accountEmail || team.contactEmail))?.status === "approved" ? team : null))).filter(Boolean);
    const terms = brief?.successCriteria;
    res.set("Cache-Control", "no-store");
    return res.json({ requestId, recommendation: record.pilot_recommendation ?? null,
      decision: projectCurrentSiteJobDecision(record, brief, assessment.decisionAssessment, assessment.compatibleDecisionAssessments), decisionSourceDigest: siteJobDecisionSourceDigest(record, brief, assessment.decisionAssessment),
      customerConversation: Array.isArray(record.customerConversation) ? record.customerConversation : [],
      customerClarification: record.site_task_clarification ?? null,
      coordination: projectPilotCoordination(record), assessment: assessment.customerAdvisory,
      teams: admitted.map(team => ({ id: team!.id, name: team!.name, capabilityDescription: team!.capabilityDescription ?? "No demonstrated capability recorded" })),
      interests: interests.docs.map(doc => doc.data()),
      draft: { purpose: brief?.summary ?? String(await decryptFieldValue(record.request?.taskStatement ?? "")),
        successCondition: terms?.successDefinition ? `${terms.successDefinition}${terms.successRate != null ? `; at least ${terms.successRate}% successful cycles` : ""}${terms.cycleTimeSeconds != null ? `; no more than ${terms.cycleTimeSeconds} seconds per cycle` : ""}` : "",
        siteProvides: "", teamProvides: "", pilotCost: "", window: "", sitePreparation: "", humanWork: "", costBasis: "", capabilityBasis: "", providerCommitment: "", exclusions: "Production deployment, purchases and private footage sharing require separate approval.", uncertainties: "", alternative: "" },
      briefRevision: humanDecisionDigest(brief),
      sources: { purpose: brief ? `siteTaskBriefs/${requestId}:summary` : `inboundRequests/${requestId}:request.taskStatement`, successCondition: terms?.successDefinition ? `siteTaskBriefs/${requestId}:successCriteria (site targets)` : null },
      evaluations: { route: `/api/admin/robot-teams/jobs/${encodeURIComponent(requestId)}/evaluations` },
      communications: { route: `/api/admin/robot-teams/jobs/${encodeURIComponent(requestId)}/communications`,
        draftingEnabled: process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true", deliveryEnabled: process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true" } });
  } catch (error) { logger.error({ err: error, requestId }, "Proposal draft unavailable"); return res.status(503).json({ error: "Proposal draft unavailable" }); }
});

const agreementSchema = z.object({ agreedBy: z.string().trim().min(3).max(200), evidenceRef: z.string().url().max(1000).refine(value => value.startsWith("https://")) }).strict();
const coordinationSchema = z.object({ recommendationId: z.string().min(1).max(120), calendarEventId: z.string().regex(/^[a-zA-Z0-9_-]{5,200}$/),
  providerAgreement: agreementSchema, siteAgreement: agreementSchema, sitePreparation: z.string().trim().min(10).max(2000),
  verifiedAgreements: z.literal(true) }).strict();

/** Reconcile a changed brief without silently amending an accepted agreement. */
router.post("/recommendations/:requestId/reconcile", async (req, res) => {
  const parsed = z.object({ recommendationId: z.string().min(1).max(120), briefRevision: z.string().regex(/^[a-f0-9]{64}$/),
    providerAgreement: agreementSchema, siteAgreement: agreementSchema, verifiedUnchangedScope: z.literal(true) }).strict().safeParse(req.body);
  const actor = res.locals.firebaseUser?.uid;
  if (!parsed.success || !actor) return res.status(400).json({ error: "A named reviewer must verify both parties' evidence that the accepted scope, cost and terms still cover the updated job. Changed agreements need their applicable new approval." });
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const requestId = String(req.params.requestId), input = parsed.data;
  try {
    await db.runTransaction(async tx => {
      const ref = db!.collection("inboundRequests").doc(requestId), current = (await tx.get(ref)).data();
      const brief = (await tx.get(db!.collection("siteTaskBriefs").doc(requestId))).data();
      if (!current || current.pilot_booking?.recommendationId !== input.recommendationId || current.pilot_recommendation?.id !== input.recommendationId
        || humanDecisionDigest(brief ?? null) !== input.briefRevision) throw new Error("reconciliation_changed");
      if (!current.pilot_recommendation.reviewRequired) return;
      tx.update(ref, { pilot_recommendation: { ...current.pilot_recommendation, reviewRequired: false,
        reconciliation: { ...input, recordedBy: actor, recordedAtIso: new Date().toISOString() } } });
    });
    return res.json({ ok: true });
  } catch { return res.status(409).json({ error: "The job changed or the accepted scope could not be reconciled. Reload before recording agreement evidence." }); }
});

/** Named staff record agreements already obtained under applicable authority. This sends no calendar invitations; it queues one scheduled notice to the site and one to the recommended team. */
router.post("/recommendations/:requestId/coordination", async (req, res) => {
  const parsed = coordinationSchema.safeParse(req.body);
  const recordedBy = res.locals.firebaseUser?.uid;
  if (!parsed.success || !recordedBy) return res.status(400).json({ error: "Supply the exact accepted proposal, existing Calendar event, both parties' agreement evidence and agreed preparation responsibilities. A named reviewer must verify authority and agreement to this date and scope." });
  if (!db) return res.status(503).json({ error: "Store unavailable" });
  const store = db, requestId = String(req.params.requestId), input = parsed.data;
  try {
    const ref = store.collection("inboundRequests").doc(requestId);
    const current = (await ref.get()).data();
    if (!current?.pilot_booking || current.pilot_booking.recommendationId !== input.recommendationId || current.pilot_recommendation?.id !== input.recommendationId || current.pilot_recommendation.reviewRequired) return res.status(409).json({ error: "The current proposal must be accepted and reconciled first." });
    const existing = current.pilot_booking.coordination;
    const digest = humanDecisionDigest(input);
    if (existing && existing.agreementDigest !== digest) return res.status(409).json({ error: "A commitment is already recorded. Resolve amendments with both parties before changing it." });
    const calendar = await readPilotCalendarEvent(input.calendarEventId);
    if (existing && (existing.startsAt !== calendar.startsAt || existing.endsAt !== calendar.endsAt)) return res.status(409).json({ error: "The Calendar date changed. Reconcile it with both parties; the existing commitment has not been overwritten." });
    const agreement = { ...input, ...calendar, state: "scheduled", recordedBy, verifiedAt: new Date().toISOString(), agreementDigest: digest };
    const teamRows = new Map<string, OutboxEntry>();
    const outcome = await store.runTransaction(async tx => {
      const snap = await tx.get(ref), record = snap.data();
      if (!record || humanDecisionDigest({ proposal: record.pilot_recommendation, booking: record.pilot_booking }) !== humanDecisionDigest({ proposal: current.pilot_recommendation, booking: current.pilot_booking })) throw new Error("pilot_agreement_changed");
      const to = String(await decryptFieldValue(record.contact?.email ?? "")).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("site_contact_missing");
      const notification = buildTaskLifecycleNotification({ requestId, milestone: "pilot_scheduled", eventId: pilotScheduledEventId(input.calendarEventId, to), to, captureUrl: captureUploadUrlFor(requestId, "owner") });
      const noticeRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(notification.idempotencyKey), notice = await tx.get(noticeRef);
      // The recommended team hears the same scheduled date, in the same commit.
      const teamNotice = typeof record.pilot_recommendation?.teamId === "string"
        ? await prepareTeamPilotNotice(tx, { kind: "team_pilot_scheduled", requestId, recommendation: record.pilot_recommendation,
          calendarEventId: input.calendarEventId, startsAt: (existing ?? agreement).startsAt }, teamRows)
        : null;
      if (!record.pilot_booking.coordination) tx.update(ref, { pilot_booking: { ...record.pilot_booking, coordination: agreement } });
      if (!notice.exists) tx.create(noticeRef, buildOutboxEntry(notification));
      teamNotice?.write(tx);
      return projectPilotCoordination({ ...record, pilot_booking: { ...record.pilot_booking, coordination: existing ?? agreement } });
    });
    return res.json({ ok: true, coordination: outcome });
  } catch (error) { logger.warn({ err: error, requestId }, "Pilot coordination evidence could not be verified"); return res.status(503).json({ error: "Calendar or agreement evidence could not be verified. The pilot remains in its recorded state; no new commitment or notice was created." }); }
});

/** The queue, oldest proposals first so nothing rots at the bottom. */
router.get("/proposals", async (_req: Request, res: Response) => {
  try {
    const proposals = await listPendingProposals();
    return res.json({
      ok: true,
      proposals: proposals.sort((left, right) =>
        left.proposedAt.localeCompare(right.proposedAt),
      ),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list capability proposals");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to list proposals" });
  }
});

/**
 * Accept or decline one proposal.
 *
 * `accept` is required rather than defaulted. A missing field should not mean
 * "yes" on the one route in this system that turns an inferred figure into
 * something a site operator may eventually read.
 */
router.post("/proposals/:proposalId", async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const accept = req.body?.accept;
  if (typeof accept !== "boolean") {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ ok: false, error: "accept must be true or false" });
  }

  // The auth middleware sets `firebaseUser`; this read `res.locals.user`,
  // which nothing sets, so every review was refused as anonymous.
  const reviewedBy =
    (res.locals?.firebaseUser?.email as string | undefined) ||
    (res.locals?.firebaseUser?.uid as string | undefined) ||
    null;
  if (!reviewedBy) {
    return res
      .status(401)
      .json({ ok: false, error: "A named reviewer is required" });
  }

  try {
    const record = await applyProposal({ proposalId, reviewedBy, accept });
    return res.json({ ok: true, accepted: accept, robotTeam: record });
  } catch (error) {
    logger.error({ err: error, proposalId }, "Failed to apply a capability proposal");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to apply proposal" });
  }
});

/** The registry itself, for an operator checking what a match ran against. */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const teams = await listMatchableRobotTeams({
      statuses: ["applied", "engaged", "prospect", "declined"],
    });
    return res.json({ ok: true, teams });
  } catch (error) {
    logger.error({ err: error }, "Failed to list robot teams");
    return res
      .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ ok: false, error: "Unable to list robot teams" });
  }
});


/* ------------------------------------------------- the agent's account */

/**
 * The operator's view of a team's account, and the levers for a team that asks
 * us to do it for them.
 *
 * ## None of this is on the critical path any more
 *
 * It used to be all of it. A team could not get a key, funds or a policy
 * without one of these routes, so the agent surface was autonomous downstream
 * of four manual steps. A team can now register itself, fund itself and set its
 * own policy; these remain for support, for teams invoiced off-platform, and
 * for correcting our own mistakes.
 *
 * ## What actually bounds an agent
 *
 * Not these routes — an earlier version of this comment claimed an agent
 * "cannot raise its own limit or top up its own balance", and both halves were
 * wrong. `PUT /api/agent-team/policy` has always let a team's key change its
 * own limits, and funding is now self-serve too.
 *
 * The real ceiling is the balance, and it is a hard one: the only entry that
 * increases it is a `credit`, and a credit comes from a real payment landing or
 * an operator here. An agent cannot credit itself by asking. The policy is
 * pacing on top of that — self-imposed, changeable by the team at any moment,
 * and useful precisely because it is not the thing stopping a runaway.
 */

async function requireOps(res: Response) {
  return hasAnyRole(res, ["admin", "ops"]);
}

/** Balance, policy and today's spend for one team. */
router.get("/:teamId/account", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const teamId = String(req.params.teamId || "").trim();
  const [balance, policy, spentToday, keys] = await Promise.all([
    getTeamBalance(teamId),
    getSpendPolicy(teamId),
    getSpendToday(teamId),
    listAgentKeys(teamId),
  ]);

  return res.json({
    teamId,
    balance,
    policy,
    spentTodayUsd: spentToday,
    // Hashes only. We do not hold the keys, so there is nothing else to show.
    keys: keys.map((key) => ({
      keyHash: key.keyHash,
      label: key.label,
      createdAtIso: key.createdAtIso,
      lastUsedAtIso: key.lastUsedAtIso,
      revokedAtIso: key.revokedAtIso,
    })),
  });
});

const creditSchema = z
  .object({
    amountUsd: z.number().finite().positive().max(1_000_000),
    reason: z.string().trim().min(1).max(400),
    /**
     * The payment, invoice or agreement this credit corresponds to. Doubles as
     * the idempotency key, so replaying the same funding event cannot credit
     * twice.
     */
    externalReference: z.string().trim().min(3).max(200),
  })
  .strict();

router.post("/:teamId/credit", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Credit is invalid",
      code: "credit_invalid",
      why: "An externalReference is required so the same funding event cannot be credited twice.",
    });
  }

  const teamId = String(req.params.teamId || "").trim();
  const balance = await creditTeam({
    teamId,
    amountUsd: parsed.data.amountUsd,
    reason: parsed.data.reason,
    idempotencyKey: `credit:${parsed.data.externalReference}`,
  });

  return res.status(201).json({ ok: true, teamId, balance });
});

const policySchema = z
  .object({
    dailyLimitUsd: z.number().finite().min(0).max(100_000),
    perRunLimitUsd: z.number().finite().min(0).max(100_000),
    agentSpendEnabled: z.boolean(),
  })
  .strict();

router.put("/:teamId/policy", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Policy is invalid", code: "policy_invalid" });
  }

  const teamId = String(req.params.teamId || "").trim();
  return res.json({ ok: true, policy: await setSpendPolicy({ teamId, ...parsed.data }) });
});

const keySchema = z.object({ label: z.string().trim().min(1).max(120) }).strict();

/**
 * Issue an agent key. The plaintext is in this response and nowhere else.
 *
 * We store a SHA-256 and cannot show it again, which is the same reason a
 * password hash exists and matters more here because this credential moves
 * money. A team that loses it issues another.
 */
router.post("/:teamId/agent-keys", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A label is required", code: "key_label_required" });
  }

  const teamId = String(req.params.teamId || "").trim();
  const issued = await issueAgentKey({ teamId, label: parsed.data.label });
  if (!issued) {
    return res.status(503).json({ error: "Key store is unavailable", code: "key_store_unavailable" });
  }

  return res.status(201).json({
    ok: true,
    teamId,
    key: issued.key,
    keyHash: issued.record.keyHash,
    warning:
      "This is the only time this key is shown. Blueprint stores a hash and cannot recover it.",
    usage: "Authorization: Bearer <key> against /api/agent-team/*",
  });
});

router.post("/:teamId/agent-keys/:keyHash/revoke", async (req: Request, res: Response) => {
  if (!(await requireOps(res))) return res.status(403).json({ error: "forbidden" });

  const revoked = await revokeAgentKey(String(req.params.keyHash || "").trim());
  return revoked
    ? res.json({ ok: true, revoked: true })
    : res.status(404).json({ error: "not_found" });
});

export default router;

