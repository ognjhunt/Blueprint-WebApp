import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { assertManagedScreeningCaptureCurrent, managedJobTask, readManagedJobSourceSession, readManagedScreeningCapture } from "./jobManagedEvaluation";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { encodeTaskEvaluationRunPublication, publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { parseBetaPolicyScreeningPublication, screeningPublicationTransition, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { isTaskFamilyStrategy, preparationPhaseMatchesTask } from "./taskFamilySceneIntake";
import { buildFinalistContinuations, finalistIdForRequest } from "./betaPolicyFinalist";
import { screeningMoneyMicros } from "./betaPolicyScreeningContract";

export function assertScreeningSceneSource(publication: BetaPolicyScreeningPublication, intake: Record<string, any>,
  scope: ReturnType<typeof managedJobTask>) {
  const source = publication.source;
  const status = intake.pipeline_status;
  const family = isTaskFamilyStrategy(intake.request?.task?.strategy);
  const prepared = preparationPhaseMatchesTask(intake.request, status);
  const selection = family ? intake.request.task.policy_selection : undefined;
  const selectedPolicyMatches = selection === undefined || selection !== null && typeof selection === "object"
    && publication.catalog_digest === selection.catalog_digest
    && publication.candidates.length === 1 && publication.candidates[0].candidate_id === selection.candidate_id
    && publication.candidates[0].configuration_digest === selection.configuration_digest;
  if (!intake.request || !intake.receipt || !intake.website_request_id
    || intake.revocation_requested || intake.state !== "completed" || status?.status !== "completed" || !prepared || !selectedPolicyMatches
    || crossRuntimeDigest(intake.request) !== intake.request_digest
    || intake.receipt.request_digest !== intake.request_digest
    || crossRuntimeArtifactDigest(intake.receipt, "receipt_digest") !== intake.receipt.receipt_digest
    || intake.receipt.intent_id !== source.scene_intent_id || intake.receipt.intent_digest !== source.scene_intent_digest
    || crossRuntimeArtifactDigest(status, "status_digest") !== status.status_digest
    || status.intent_id !== source.scene_intent_id || status.intent_digest !== source.scene_intent_digest
    || status.request_digest !== intake.request_digest || crossRuntimeDigest(status.owner) !== crossRuntimeDigest(intake.request.owner)
    || status.result_reference?.digest !== source.scene_revision_digest
    || intake.request.submission_id !== source.capture_id || intake.request.task?.task_id !== source.task_id
    || intake.source_session_id !== (scope.sourceCaptureSessionId ?? scope.sourceWebsiteCaptureId)
    || source.capture_id !== (scope.sourceCaptureSessionId ?? scope.sourceWebsiteCaptureId)
    || intake.request.owner?.organization_id !== scope.teamNamespace
    || publication.site_id !== `site-${intake.website_request_id}` || source.task_context_digest !== scope.taskContextDigest
    || (scope.taskIds.length > 0 && !scope.taskIds.includes(source.task_id))) {
    throw new Error("screening_scene_source_mismatch");
  }
}

/** Existing immutable scene intake supplies job authority; producer IDs never select an arbitrary job. */
export async function ingestBetaPolicyScreening(publication: BetaPolicyScreeningPublication) {
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  const matches = await store.collection(SCENE_INTAKE_COLLECTION)
    .where("receipt.intent_id", "==", publication.source.scene_intent_id).limit(2).get();
  if (matches.docs.length !== 1) throw new Error("screening_scene_intake_unavailable");
  const intakeRef = matches.docs[0].ref;
  const selected = matches.docs[0].data();
  if (typeof selected.website_request_id !== "string" || typeof selected.source_session_id !== "string")
    throw new Error("screening_scene_intake_unavailable");
  const selectedJob = (await store.collection("inboundRequests").doc(selected.website_request_id).get()).data();
  const screeningCapture = selectedJob?.job_evidence_source ? { captureId: selected.source_session_id }
    : await readManagedScreeningCapture(selected.website_request_id, selected.source_session_id);
  const runRef = store.collection("taskEvaluationPolicyRuns").doc(publication.campaign_id);
  const resultId = `screening-${createHash("sha256").update(publication.campaign_id).digest("hex").slice(0, 32)}`;
  const resultRef = store.collection("captureTaskEvaluationRuns").doc(resultId);
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(intakeRef)).data();
    if (!intake?.website_request_id || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(intake.website_request_id))
      throw new Error("screening_scene_intake_unavailable");
    const jobId = intake.website_request_id;
    if (jobId !== selected.website_request_id || intake.source_session_id !== screeningCapture.captureId)
      throw new Error("screening_scene_source_mismatch");
    const [job, brief, inventory, oldRun, oldResult] = await Promise.all([
      transaction.get(store.collection("inboundRequests").doc(jobId)),
      transaction.get(store.collection("siteTaskBriefs").doc(jobId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(jobId)),
      transaction.get(runRef), transaction.get(resultRef),
    ]);
    if (!brief.exists) throw new Error("job_brief_not_agreed");
    const binding = { job_id: jobId, brief_digest: scientificBriefDigest(brief.data()!) };
    await assertManagedScreeningCaptureCurrent(jobId, screeningCapture, ref => transaction.get(ref));
    const scope = managedJobTask({ binding, record: job.data(), brief: brief.data(), allowProposedScreening: true, screeningCapture,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      sourceSession: await readManagedJobSourceSession(job.data(), ref => transaction.get(ref)) });
    assertScreeningSceneSource(publication, intake, scope);
    const finalist = publication.purpose === "finalist";
    const runKind = finalist ? "beta_policy_finalist" : "beta_policy_screening";
    if (finalist) {
      const retained = oldRun.data();
      const bound = publication.finalist_binding!;
      const request = retained?.finalist_request;
      const authority = retained?.finalist_authority;
      if (!retained || retained.run_kind !== runKind || !request || !authority
        || retained.run_id !== finalistIdForRequest(request) || bound.finalist_id !== retained.run_id
        || bound.screening_campaign_id !== request.campaign_id || bound.screening_publication_digest !== request.publication_digest
        || bound.job_id !== jobId || bound.brief_digest !== binding.brief_digest
        || bound.source_fingerprint !== scope.sourceFingerprint || bound.owner_authority_digest !== retained.finalist_owner_authority_digest
        || crossRuntimeDigest(authority) !== bound.owner_authority_digest
        || publication.candidates[0].candidate_id !== request.candidate_id
        || publication.candidates[0].configuration_digest !== retained.finalist_candidate_configuration_digest
        || screeningMoneyMicros(publication.budget.limit_usd) > BigInt(Math.round(authority.approval.sponsorCapUsd * 1_000_000)))
        throw new Error("screening_finalist_authority_mismatch");
    }
    // No-spend continuation intents are retained in the same transaction as
    // completed screening. Provider execution still requires exact owner authority.
    const continuations = buildFinalistContinuations(publication, { jobId, briefDigest: binding.brief_digest,
      sourceFingerprint: scope.sourceFingerprint, intakeId: intakeRef.id,
      ownerUserId: intake.request.owner.user_id, teamNamespace: scope.teamNamespace, now: new Date().toISOString() });
    const existingContinuations = await Promise.all(continuations.map(row =>
      transaction.get(store.collection("taskEvaluationPolicyRuns").doc(row.run_id))));
    const retainContinuations = () => continuations.forEach((row, index) => {
      if (!existingContinuations[index].exists)
        transaction.set(store.collection("taskEvaluationPolicyRuns").doc(row.run_id), row);
    });
    if (oldResult.exists || oldRun.exists && !finalist) {
      const previous = oldResult.exists ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(oldResult.data()!)) : null;
      if (!previous || oldRun.data()?.run_kind !== runKind
        || oldRun.data()?.result_record_id !== resultId || oldRun.data()?.job_evidence_binding?.job_id !== jobId
        || oldRun.data()?.job_source_fingerprint !== scope.sourceFingerprint)
        throw new Error("screening_campaign_identity_conflict");
      const transition = screeningPublicationTransition(previous, publication);
      if (transition !== "updated") {
        // Recover an intent lost before this integration was deployed; the
        // immutable terminal evidence does not need another scientific run.
        if (transition === "replayed") retainContinuations();
        return { status: transition, run_id: publication.campaign_id,
          publication_digest: previous.publication_digest, revision: previous.revision };
      }
    }
    const now = new Date().toISOString();
    transaction.set(resultRef, { schema_version: "capture_task_evaluation_run_record.v2", record_id: resultId,
      run_id: publication.campaign_id, owner_user_id: intake.request.owner.user_id, organization_id: scope.teamNamespace,
      access_visibility: "private", created_at_iso: oldResult.data()?.created_at_iso ?? now, updated_at_iso: now,
      publication_storage: encodeTaskEvaluationRunPublication(publication) });
    transaction.set(runRef, { ...(finalist ? oldRun.data() : {}),
      run_id: publication.campaign_id, run_kind: runKind, state: publication.status,
      ...(finalist ? { finalist_state: publication.status,
        finalist_forward_pending: !["completed", "blocked"].includes(publication.status) } : {}),
      owner_user_id: intake.request.owner.user_id, team_namespace: scope.teamNamespace,
      source_scene_intent_id: publication.source.scene_intent_id, source_scene_intake_id: intakeRef.id,
      source_scene_revision_digest: publication.source.scene_revision_digest, configuration_digest: publication.plan_digest,
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      publication_digest: publication.publication_digest, publication_revision: publication.revision, result_record_id: resultId,
      screening_execution_observed: oldRun.data()?.screening_execution_observed === true
        || publication.candidates.some(row => ["running", "completed"].includes(row.status) || row.episodes_scored > 0),
      created_at_iso: oldRun.data()?.created_at_iso ?? now, updated_at_iso: now });
    retainContinuations();
    return { status: oldRun.exists ? "updated" : "created", run_id: publication.campaign_id,
      publication_digest: publication.publication_digest, revision: publication.revision };
  });
}
