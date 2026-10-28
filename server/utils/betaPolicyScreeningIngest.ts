import { createHash } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { assertManagedScreeningCaptureCurrent, managedJobTask, readManagedJobSourceSession, readManagedScreeningCapture } from "./jobManagedEvaluation";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { encodeTaskEvaluationRunPublication, publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { betaPolicyScreeningPublicationSchema, parseBetaPolicyScreeningPublication, screeningPublicationTransition,
  screeningTerminalCandidateStates, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { isTaskFamilyStrategy, preparationPhaseMatchesTask } from "./taskFamilySceneIntake";
import { assertWebsiteRunOpen } from "./websiteRunClosure";

const controlId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const controlSha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const controlTime = z.number().int().positive().max(8_640_000_000_000_000);
const executionControlBindingSchema = z.object({
  campaign_id: controlId, site_id: controlId, plan_digest: controlSha, candidate_id: controlId,
  configuration_digest: controlSha, attempt_id: controlId, invocation_id: controlSha,
  prepared_digest: controlSha, authority_digest: controlSha, resource_name: controlId,
  source: betaPolicyScreeningPublicationSchema.shape.source,
}).strict();
const executionControlRequestSchema = executionControlBindingSchema.extend({
  schema_version: z.literal("blueprint.beta_policy_screening_execution_control_request.v1"),
  execution_deadline_at_ms: controlTime.optional(),
}).strict();
export type BetaScreeningExecutionControlRequest = z.infer<typeof executionControlRequestSchema>;
const executionControlSchema = z.object({
  schema_version: z.literal("blueprint.beta_policy_screening_execution_control.v1"),
  binding: executionControlBindingSchema, binding_digest: controlSha,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), status: z.enum(["current", "stopped"]),
  cancellation_requested: z.boolean(), stop_reason: z.string().regex(/^[a-z_]+$/).nullable(),
  execution_deadline_at_ms: controlTime, observed_at_iso: z.string().datetime(), next_check_at_ms: controlTime,
  new_execution_authorized: z.literal(false), read_only_closeout_allowed: z.literal(true),
  applicability: z.enum(["current", "historical_only"]), control_digest: controlSha,
}).strict().superRefine((value, ctx) => {
  if (value.binding_digest !== crossRuntimeDigest(value.binding)
    || value.control_digest !== crossRuntimeArtifactDigest(value, "control_digest")
    || value.cancellation_requested !== (value.status === "stopped")
    || (value.status === "stopped") !== (value.stop_reason !== null)
    || value.applicability !== (value.status === "stopped" ? "historical_only" : "current"))
    ctx.addIssue({ code: "custom", message: "Screening execution control integrity mismatch" });
});

export function parseBetaScreeningExecutionControlRequest(value: unknown): BetaScreeningExecutionControlRequest | null {
  const parsed = executionControlRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A signed control-plane observation of an existing run, never launch/spending authority or a GPU credential. */
export async function observeBetaScreeningExecutionControl(request: BetaScreeningExecutionControlRequest) {
  // Keep the exported helper safe for non-HTTP callers too.
  if (!parseBetaScreeningExecutionControlRequest(request)) throw new Error("screening_control_request_invalid");
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  const { schema_version: _schema, execution_deadline_at_ms: requestedDeadline, ...binding } = request;
  const bindingDigest = crossRuntimeDigest(binding), controlKey = bindingDigest.slice(7);
  const runRef = store.collection("taskEvaluationPolicyRuns").doc(binding.campaign_id);
  return store.runTransaction(async transaction => {
    const run = (await transaction.get(runRef)).data();
    if (!run || run.run_kind !== "beta_policy_screening" || run.run_id !== binding.campaign_id
      || run.configuration_digest !== binding.plan_digest || run.source_scene_intent_id !== binding.source.scene_intent_id
      || run.source_scene_revision_digest !== binding.source.scene_revision_digest
      || run.job_task_context_digest !== binding.source.task_context_digest
      || !controlId.safeParse(run.source_scene_intake_id).success || !controlId.safeParse(run.result_record_id).success
      || !controlId.safeParse(run.job_evidence_binding?.job_id).success
      || binding.site_id !== `site-${run.job_evidence_binding.job_id}`)
      throw new Error("screening_control_identity_conflict");
    const controls = run.screening_execution_controls ?? {};
    if (!controls || typeof controls !== "object" || Array.isArray(controls)) throw new Error("screening_control_record_unavailable");
    // The same attempt, allocator invocation, or owned resource cannot be rebound
    // to a different preparation, authority, candidate, or source on restart.
    for (const [key, value] of Object.entries(controls)) {
      const parsed = executionControlSchema.safeParse(value);
      if (!parsed.success || key !== parsed.data.binding_digest.slice(7)) throw new Error("screening_control_record_unavailable");
      if (key !== controlKey && (parsed.data.binding.attempt_id === binding.attempt_id
        || parsed.data.binding.invocation_id === binding.invocation_id || parsed.data.binding.resource_name === binding.resource_name))
        throw new Error("screening_control_identity_conflict");
    }
    const previous = controls[controlKey] as z.infer<typeof executionControlSchema> | undefined;
    // Restart may always read a retained stop to finish its own teardown. It
    // cannot regain processing authority by repairing or replacing the source.
    if (previous?.status === "stopped") return previous;
    const jobId = run.job_evidence_binding.job_id as string;
    const [result, intakeSnapshot, jobSnapshot, brief, inventory, capture] = await Promise.all([
      transaction.get(store.collection("captureTaskEvaluationRuns").doc(run.result_record_id)),
      transaction.get(store.collection(SCENE_INTAKE_COLLECTION).doc(run.source_scene_intake_id)),
      transaction.get(store.collection("inboundRequests").doc(jobId)),
      transaction.get(store.collection("siteTaskBriefs").doc(jobId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(jobId)),
      transaction.get(store.collection("captureUploadSessions").doc(binding.source.capture_id)),
    ]);
    const publication = result.exists ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(result.data()!)) : null;
    const candidate = publication?.candidates.find(row => row.candidate_id === binding.candidate_id);
    if (!publication || publication.campaign_id !== binding.campaign_id || publication.site_id !== binding.site_id
      || publication.plan_digest !== binding.plan_digest || publication.publication_digest !== run.publication_digest
      || publication.revision !== run.publication_revision || crossRuntimeDigest(publication.source) !== crossRuntimeDigest(binding.source)
      || candidate?.configuration_digest !== binding.configuration_digest
      || result.data()?.run_id !== binding.campaign_id || result.data()?.record_id !== run.result_record_id
      || result.data()?.owner_user_id !== run.owner_user_id || result.data()?.organization_id !== run.team_namespace)
      throw new Error("screening_control_identity_conflict");
    const intake = intakeSnapshot.data(), job = jobSnapshot.data(), retainedCapture = capture.data();
    const expiry = intake?.request?.execution?.expires_at_epoch;
    const sourceDeadline = typeof expiry === "number" ? Math.floor(expiry * 1000) : NaN;
    // A missing expiry is uncertainty, not an unlimited grant. No decision is
    // written and the existing bounded monitor grace must expire closed.
    if (!controlTime.safeParse(sourceDeadline).success) throw new Error("screening_control_authority_unavailable");
    const deadline = Math.min(sourceDeadline, requestedDeadline ?? sourceDeadline,
      previous?.execution_deadline_at_ms ?? sourceDeadline);
    const now = Date.now();
    let stopReason: string | null = null;
    if (run.cancellationRequested === true || ["cancelled", "closed"].includes(run.state)) stopReason = "screening_run_cancelled";
    else if (screeningTerminalCandidateStates.has(candidate!.status)) stopReason = "screening_candidate_closed";
    else if (deadline <= now) stopReason = "screening_authority_expired";
    else if (intake?.revocation_requested || ["revoked", "closeout_pending", "cancelled"].includes(intake?.state))
      stopReason = "screening_scene_authority_revoked";
    else if (job?.capture_withdrawal || job?.workspace_task?.paused === true
      || retainedCapture?.capture_access?.future_processing_allowed === false || retainedCapture?.completed_capture_lifecycle
      || ["revoked", "revocation_in_progress", "cancelled"].includes(retainedCapture?.status))
      stopReason = "job_capture_processing_not_authorized";
    if (!stopReason) {
      try {
        assertWebsiteRunOpen(job, jobId, binding.source.capture_id);
        const screeningCapture = job?.job_evidence_source ? { captureId: binding.source.capture_id }
          : await readManagedScreeningCapture(jobId, binding.source.capture_id);
        await assertManagedScreeningCaptureCurrent(jobId, screeningCapture, ref => transaction.get(ref));
        const scope = managedJobTask({ binding: run.job_evidence_binding, record: job, brief: brief.data(),
          allowProposedScreening: true, screeningCapture,
          inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
          sourceSession: await readManagedJobSourceSession(job, ref => transaction.get(ref)) });
        if (!intake || intake.website_request_id !== jobId || intake.request?.owner?.user_id !== run.owner_user_id
          || scope.teamNamespace !== run.team_namespace || scope.sourceFingerprint !== run.job_source_fingerprint)
          throw new Error("screening_scene_source_mismatch");
        assertScreeningSceneSource(publication, intake, scope);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        // Only known current-source refusals are durable stops. Unknown storage,
        // malformed closure and transient service errors stay unproven (503).
        if (/^job_(not_found|brief_not_agreed|brief_changed|capture_processing_not_authorized|scene_not_prepared|scene_task_changed|evaluation_source_(binding_invalid|unavailable|changed))$/.test(code)
          || ["screening_scene_source_mismatch", "website_run_closed_by_owner"].includes(code)) stopReason = code;
        else throw error;
      }
    }
    const value = { schema_version: "blueprint.beta_policy_screening_execution_control.v1" as const,
      binding, binding_digest: bindingDigest, revision: (previous?.revision ?? 0) + 1,
      status: stopReason ? "stopped" as const : "current" as const, cancellation_requested: Boolean(stopReason), stop_reason: stopReason,
      execution_deadline_at_ms: deadline, observed_at_iso: new Date(now).toISOString(), next_check_at_ms: now + 60_000,
      new_execution_authorized: false as const, read_only_closeout_allowed: true as const,
      applicability: stopReason ? "historical_only" as const : "current" as const };
    const control = executionControlSchema.parse({ ...value, control_digest: crossRuntimeDigest(value) });
    transaction.set(runRef, { screening_execution_controls: { ...controls, [controlKey]: control } }, { mergeFields: ["screening_execution_controls"] });
    return control;
  });
}

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
    if (oldRun.exists || oldResult.exists) {
      const previous = oldResult.exists ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(oldResult.data()!)) : null;
      if (!previous || oldRun.data()?.run_kind !== "beta_policy_screening"
        || oldRun.data()?.result_record_id !== resultId || oldRun.data()?.job_evidence_binding?.job_id !== jobId
        || oldRun.data()?.job_source_fingerprint !== scope.sourceFingerprint)
        throw new Error("screening_campaign_identity_conflict");
      const transition = screeningPublicationTransition(previous, publication);
      if (transition !== "updated") return { status: transition, run_id: publication.campaign_id,
        publication_digest: previous.publication_digest, revision: previous.revision };
    }
    const now = new Date().toISOString();
    transaction.set(resultRef, { schema_version: "capture_task_evaluation_run_record.v2", record_id: resultId,
      run_id: publication.campaign_id, owner_user_id: intake.request.owner.user_id, organization_id: scope.teamNamespace,
      access_visibility: "private", created_at_iso: oldResult.data()?.created_at_iso ?? now, updated_at_iso: now,
      publication_storage: encodeTaskEvaluationRunPublication(publication) });
    transaction.set(runRef, { ...(oldRun.data()?.screening_execution_controls !== undefined
      ? { screening_execution_controls: oldRun.data()!.screening_execution_controls } : {}),
      ...(oldRun.data()?.cancellationRequested === true ? { cancellationRequested: true } : {}),
      run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: publication.status,
      owner_user_id: intake.request.owner.user_id, team_namespace: scope.teamNamespace,
      source_scene_intent_id: publication.source.scene_intent_id, source_scene_intake_id: intakeRef.id,
      source_scene_revision_digest: publication.source.scene_revision_digest, configuration_digest: publication.plan_digest,
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      publication_digest: publication.publication_digest, publication_revision: publication.revision, result_record_id: resultId,
      episodes_scored: publication.candidates.reduce<number>((sum, row) => sum + row.episodes_scored, 0),
      screening_execution_observed: oldRun.data()?.screening_execution_observed === true
        || publication.candidates.some(row => ["running", "completed"].includes(row.status) || row.episodes_scored > 0),
      created_at_iso: oldRun.data()?.created_at_iso ?? now, updated_at_iso: now });
    return { status: oldRun.exists ? "updated" : "created", run_id: publication.campaign_id,
      publication_digest: publication.publication_digest, revision: publication.revision };
  });
}
