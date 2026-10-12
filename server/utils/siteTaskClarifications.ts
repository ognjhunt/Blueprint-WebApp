import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { loadCurrentSiteAssessmentView } from "./siteAssessmentPublic";
import { projectCurrentSiteJobDecision } from "./siteJobDecision";
import { advisoryContextDigest } from "./siteAssessmentContext";
import { browserPendingDecisionKey, type BrowserPending } from "./websiteBrowserPending";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { gateFields } from "../../client/src/data/siteTaskQualification";

export type ClarificationMode = "assessment";
export function clarificationRevision(brief: unknown, request: Record<string, any>, advisoryBasis?: unknown, mode?: ClarificationMode) {
  // The existing reviewer passes the retained basis; public callers pass their explicit mode.
  mode ??= (advisoryBasis as { mode?: ClarificationMode } | undefined)?.mode;
  return humanDecisionDigest({ brief, answers: request.siteTaskGates,
    triage: request.site_task_triage, decision: request.customer_decision, confirmed: Boolean(request.site_task_brief_confirmed_at), ...(advisoryBasis ? { advisoryBasis } : {}), ...(mode ? { mode } : {}) });
}

/** Only the already-admitted customer question clauses become answer prompts. */
function assessmentQuestions(assessment: Awaited<ReturnType<typeof loadCurrentSiteAssessmentView>>) {
  const advisory = assessment.customerAdvisory;
  const identity = assessment.decisionAssessment?.decisionEvidence;
  if (advisory?.state !== "ready" || !identity || !/^[a-f0-9]{64}$/.test(identity.packetSha256)) return [];
  return advisory.unknowns.filter(text => text.startsWith("Question to resolve: "))
    .map(text => text.replace(/^Question to resolve:\s*/, ""));
}
function questionContext(value: Record<string, any>, brief: unknown, assessment: Awaited<ReturnType<typeof loadCurrentSiteAssessmentView>>, requestId: string, mode?: ClarificationMode) {
  const decision = projectCurrentSiteJobDecision(value, brief, assessment.decisionAssessment, assessment.compatibleDecisionAssessments);
  const sourceQuestions = assessmentQuestions(assessment);
  const advisoryBasis = sourceQuestions.length ? { requestId, source: value.site_advisory ?? null, ...(mode ? {mode} : {}),
    ownerUid: value.account_owner_uid ?? null, rights: projectWebsiteCaptureRights(value),
    evidence: assessment.decisionAssessment!.decisionEvidence, questions: sourceQuestions } : undefined;
  const questions = [...new Set([
    ...(mode === "assessment" ? [] : decision?.question ? [`${decision.question.text} — ${decision.question.reason}`] : value.site_task_triage?.disposition === "needs_conversation" ? [...(value.site_task_triage?.open_questions || []),
      ...(value.site_task_triage?.unanswered_field_ids || []).flatMap((id: string) => {
        const field = gateFields.find(field => field.id === id);
        return field ? [`${field.question} — Needed before ${field.blocks === "capture" ? "scene preparation" : "robot evaluation"}; it does not establish pilot willingness or authority.`] : [];
      })] : []), ...sourceQuestions,
  ])];
  return { revision: clarificationRevision(brief, value, advisoryBasis, mode), questions,
    ...(mode ? {assessmentState: assessment.customerAdvisory?.state ?? null} : {}),
    needed: mode === "assessment" ? sourceQuestions.length > 0 : Boolean(decision?.question) || sourceQuestions.length > 0 || value.site_task_triage?.disposition === "needs_conversation", advisoryBasis };
}

export async function loadSiteClarificationContext(requestId: string, mode?: ClarificationMode | "legacy") {
  if (!db) throw new Error("clarification_store_unavailable");
  const [request, brief] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get()]);
  if (!request.exists || !brief.exists) throw new Error("clarification_missing");
  const value = request.data()!;
  // Only the internal reviewer infers mode from the saved answer. Public reads select it explicitly.
  const selectedMode = mode === "legacy" ? undefined : mode ?? (value.site_task_clarification?.mode === "assessment" ? "assessment" : undefined);
  const assessment = await loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: value.account_owner_uid ?? null });
  return { ...questionContext(value, brief.data(), assessment, requestId, selectedMode), response: value.site_task_clarification || null };
}

export async function readSiteClarification(requestId: string, mode?: ClarificationMode) {
  const { advisoryBasis: _privateBasis, ...publicContext } = await loadSiteClarificationContext(requestId, mode ?? "legacy");
  return publicContext;
}

export async function assertClarificationPacketCurrent(tx: FirebaseFirestore.Transaction, value: Record<string, any>,
  basis: ReturnType<typeof questionContext>["advisoryBasis"], brief: Record<string, any> | null) {
  if (!basis) return;
  const captureId = `walkthrough-${basis.requestId}`;
  const session = (await tx.get(db!.collection("captureUploadSessions").doc(captureId))).data();
  const pending = session?.browser_pending_delivery as BrowserPending | undefined;
  const privacy = value.capture_privacy_source_bound_decision;
  if (!projectWebsiteCaptureRights(value).derived_scene_generation_allowed
    || advisoryContextDigest(value, brief) !== basis.source?.context_digest
    || !pending || pending.state !== "published" || pending.request_id !== basis.requestId
    || pending.capture_id !== captureId || pending.scene_id !== `site-${basis.requestId}`
    || session?.browser_upload_reservation || session?.browser_stored_upload
    || browserPendingDecisionKey(pending) !== basis.source?.source_key
    || !privacy?.proceeded || !["approved", "unscreened"].includes(privacy.eligibility)
    || privacy.capture_id !== captureId || privacy.producer_source?.kind !== "browser_pending"
    || privacy.producer_source.key !== basis.source?.source_key) throw new Error("clarification_revision_changed");
  const job = value.site_advisory?.job_id ? (await tx.get(db!.collection("siteAssessmentJobs").doc(value.site_advisory.job_id))).data() : null;
  if (!job || job.schema_version !== "site_assessment_job.v1" || job.state !== "completed" || job.request_id !== basis.requestId
    || job.source_key !== basis.source?.source_key || job.context_digest !== basis.source?.context_digest
    || job.packet_sha256 !== basis.evidence!.packetSha256)
    throw new Error("clarification_revision_changed");
}

/** Owner evidence is retained for the existing reviewer; prose never clears a gate. */
export async function submitSiteClarification(requestId: string, revision: string, explanation: string, mode?: ClarificationMode) {
  if (!db) throw new Error("clarification_store_unavailable");
  if (!/^[a-f0-9]{64}$/.test(revision) || explanation.trim().length < 1 || explanation.length > 4000) {
    throw new Error("clarification_invalid");
  }
  const ref = db.collection("inboundRequests").doc(requestId);
  const id = humanDecisionDigest({ requestId, revision, explanation: explanation.trim() });
  const currentOwner = (await ref.get()).data()?.account_owner_uid ?? null;
  const assessment = await loadCurrentSiteAssessmentView(requestId, `walkthrough-${requestId}`, { expectedOwnerUid: currentOwner });
  return db.runTransaction(async tx => {
    const responseRef = ref.collection("clarifications").doc(id);
    const [request, brief, prior] = await Promise.all([tx.get(ref),
      tx.get(db!.collection("siteTaskBriefs").doc(requestId)), tx.get(responseRef)]);
    if (prior.exists) return { id, state: prior.data()!.state };
    const value = request.data();
    const context = value && brief.exists ? questionContext(value, brief.data(), assessment, requestId, mode) : null;
    if (!context || context.revision !== revision) throw new Error("clarification_revision_changed");
    if (!context.needed) throw new Error("clarification_not_needed");
    // Track the packet authority in the write transaction too.
    await assertClarificationPacketCurrent(tx, value!, context.advisoryBasis, brief.data() ?? null);
    const response = { id, revision, questions: context.questions, ...(mode ? { mode } : {}), explanation: explanation.trim(), state: "review_required",
      submitted_by: "owner_link", submitted_at: new Date().toISOString() };
    tx.create(responseRef, { ...response, ...(context.advisoryBasis ? { assessment_basis: context.advisoryBasis } : {}) });
    tx.set(ref, { site_task_clarification: response,
      ops: { next_step: "Review the owner's written clarification under Screening; record the outcome without requiring a call." } }, { merge: true });
    return { id, state: response.state };
  });
}
