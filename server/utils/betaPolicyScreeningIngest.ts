import { createHash } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { assertManagedScreeningCaptureCurrent, assertScreeningSceneSource, managedJobTask, readManagedJobSourceSession, readManagedScreeningCapture } from "./jobManagedEvaluation";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { encodeTaskEvaluationRunPublication, publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { betaPolicyScreeningSourceSchema, parseBetaPolicyScreeningPublication, screeningPublicationTransition,
  screeningTerminalCandidateStates, noEstimateReason, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { assertWebsiteRunOpen, websiteRunClosure } from "./websiteRunClosure";
import { parseBetaCandidateSelection, selectionMatchesPublication, type BetaCandidateSelection } from "./betaCandidateSelection";
import { registryTeamsNamed } from "./deploymentIntegrationInventory";

export { assertScreeningSceneSource } from "./jobManagedEvaluation";

const controlId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const controlSha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const controlTime = z.number().int().positive().max(8_640_000_000_000_000);
const executionControlBindingSchema = z.object({
  campaign_id: controlId, site_id: controlId, plan_digest: controlSha, candidate_id: controlId,
  configuration_digest: controlSha, attempt_id: controlId, invocation_id: controlSha,
  prepared_digest: controlSha, authority_digest: controlSha, resource_name: controlId,
  source: betaPolicyScreeningSourceSchema,
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
    const controls = run.screening_execution_controls === undefined ? {} : run.screening_execution_controls;
    if (!controls || typeof controls !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(controls)))
      throw new Error("screening_control_record_unavailable");
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
          || ["screening_scene_source_mismatch", "website_run_closed_by_owner", "website_run_capture_superseded"].includes(code)) stopReason = code;
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
    const ownerClosed = stopReason === "website_run_closed_by_owner";
    // A consumed source/authority stop applies to this campaign even when the
    // source is later repaired. Normal candidate completion only closes its
    // attempt and leaves the recorded estimate applicable.
    const campaignCancelled = stopReason !== null && stopReason !== "screening_candidate_closed";
    const update = { screening_execution_controls: { ...controls, [controlKey]: control },
      ...(campaignCancelled ? { cancellationRequested: true, ...(ownerClosed ? { state: "closed" } : {}) } : {}) };
    transaction.set(runRef, update, { mergeFields: Object.keys(update) });
    return control;
  });
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
    const ownerClosed = Boolean(websiteRunClosure(job.data(), jobId, publication.source.capture_id));
    if (oldRun.exists || oldResult.exists) {
      const previous = oldResult.exists ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(oldResult.data()!)) : null;
      if (!previous || oldRun.data()?.run_kind !== "beta_policy_screening"
        || oldRun.data()?.result_record_id !== resultId || oldRun.data()?.job_evidence_binding?.job_id !== jobId
        || oldRun.data()?.job_source_fingerprint !== scope.sourceFingerprint)
        throw new Error("screening_campaign_identity_conflict");
      const transition = screeningPublicationTransition(previous, publication);
      if (transition !== "updated") {
        // Delivery replay never suppresses a newer durable owner decision.
        if (ownerClosed) transaction.set(runRef, { cancellationRequested: true,
          state: ["cancelled", "closed"].includes(oldRun.data()?.state) ? oldRun.data()!.state : "closed" },
        { mergeFields: ["cancellationRequested", "state"] });
        return { status: transition, run_id: publication.campaign_id,
          publication_digest: previous.publication_digest, revision: previous.revision };
      }
    }
    const now = new Date().toISOString();
    transaction.set(resultRef, { schema_version: "capture_task_evaluation_run_record.v2", record_id: resultId,
      run_id: publication.campaign_id, owner_user_id: intake.request.owner.user_id, organization_id: scope.teamNamespace,
      access_visibility: "private", created_at_iso: oldResult.data()?.created_at_iso ?? now, updated_at_iso: now,
      publication_storage: encodeTaskEvaluationRunPublication(publication) });
    transaction.set(runRef, { ...(oldRun.data()?.screening_execution_controls !== undefined
      ? { screening_execution_controls: oldRun.data()!.screening_execution_controls } : {}),
      // A budget-only revision keeps the choice; the readback rechecks it against each result.
      ...(oldRun.data()?.candidate_selection !== undefined ? { candidate_selection: oldRun.data()!.candidate_selection } : {}),
      ...(oldRun.data()?.cancellationRequested === true || ["cancelled", "closed"].includes(oldRun.data()?.state) || ownerClosed
        ? { cancellationRequested: true } : {}),
      run_id: publication.campaign_id, run_kind: "beta_policy_screening",
      state: ["cancelled", "closed"].includes(oldRun.data()?.state) ? oldRun.data()!.state : ownerClosed ? "closed" : publication.status,
      owner_user_id: intake.request.owner.user_id, team_namespace: scope.teamNamespace,
      source_scene_intent_id: publication.source.scene_intent_id, source_scene_intake_id: intakeRef.id,
      source_scene_revision_digest: publication.source.scene_revision_digest, configuration_digest: publication.plan_digest,
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      publication_digest: publication.publication_digest, publication_revision: publication.revision, result_record_id: resultId,
      episodes_scored: publication.candidates.reduce<number>((sum, row) => sum + row.episodes_scored, 0),
      no_estimate_reason: publication.status === "blocked"
        || publication.status === "completed" && publication.candidates.every(row => row.episodes_scored === 0)
        ? noEstimateReason(publication.candidates) : null,
      screening_execution_observed: oldRun.data()?.screening_execution_observed === true
        || publication.candidates.some(row => ["running", "completed"].includes(row.status) || row.episodes_scored > 0),
      created_at_iso: oldRun.data()?.created_at_iso ?? now, updated_at_iso: now });
    return { status: oldRun.exists ? "updated" : "created", run_id: publication.campaign_id,
      publication_digest: publication.publication_digest, revision: publication.revision };
  });
}

/**
 * The Pipeline's choice from an accepted terminal result, kept on its run.
 * Exact replay is a no-op; only a choice from a newer revision replaces it.
 */
export async function ingestBetaCandidateSelection(selection: BetaCandidateSelection) {
  if (!parseBetaCandidateSelection(selection)) throw new Error("screening_selection_invalid");
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  // A recorded company or related team joins a registry row by name only.
  const { listMatchableRobotTeams } = await import("./robotTeamRegistry");
  const registryTeams = selection.chosen ? registryTeamsNamed(await listMatchableRobotTeams(),
    [...selection.chosen.deployment_companies, ...selection.chosen.related_teams]).map(({ id, name }) => ({ id, name })) : [];
  const runRef = store.collection("taskEvaluationPolicyRuns").doc(selection.campaign_id);
  return store.runTransaction(async transaction => {
    const run = (await transaction.get(runRef)).data();
    const result = run?.run_kind === "beta_policy_screening" && typeof run.result_record_id === "string"
      ? await transaction.get(store.collection("captureTaskEvaluationRuns").doc(run.result_record_id)) : null;
    const publication = result?.exists ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(result.data()!)) : null;
    if (!run || !publication || publication.campaign_id !== run.run_id || publication.publication_digest !== run.publication_digest
      || publication.revision !== run.publication_revision || selection.publication_digest !== publication.publication_digest
      || selection.publication_revision !== publication.revision || !selectionMatchesPublication(selection, publication))
      throw new Error("screening_selection_publication_mismatch");
    const previous = parseBetaCandidateSelection(run.candidate_selection?.record);
    const receipt = (status: "created" | "updated" | "replayed") => ({ status, run_id: selection.campaign_id,
      publication_revision: selection.publication_revision, selection_digest: selection.selection_digest });
    if (previous?.selection_digest === selection.selection_digest) return receipt("replayed");
    if (previous && previous.publication_revision >= selection.publication_revision) throw new Error("screening_selection_conflict");
    transaction.set(runRef, { candidate_selection: { record: selection, registry_teams: registryTeams,
      received_at_iso: new Date().toISOString() } }, { mergeFields: ["candidate_selection"] });
    return receipt(run.candidate_selection === undefined ? "created" : "updated");
  });
}
