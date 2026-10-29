/** Bind managed simulator runs to the agreed job without changing scientific results. */
import { z } from "zod";
import { jobEvidenceSourceBindingSchema, jobEvidenceTaskInventoryDigest, scientificBriefDigest, scientificContext } from "./jobEvidenceContract";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import type { ConfiguredSceneOffering } from "./configuredSceneOfferingContract";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { parsePipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import { noEstimateReason, parseBetaPolicyScreeningPublication, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { isTaskFamilyStrategy, preparationPhaseMatchesTask } from "./taskFamilySceneIntake";
import { assertWebsiteRunOpen } from "./websiteRunClosure";

export const jobManagedEvidenceBindingSchema = z.object({
  job_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  brief_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export type JobManagedEvidenceBinding = z.infer<typeof jobManagedEvidenceBindingSchema>;

/** Resolve the existing canonical source pointer, never a guessed capture ID. */
export async function readManagedJobSourceSession(record: Record<string, any> | undefined,
  read: (reference: FirebaseFirestore.DocumentReference) => Promise<FirebaseFirestore.DocumentSnapshot>) {
  if (record?.job_evidence_source == null) return null;
  const source = jobEvidenceSourceBindingSchema.safeParse(record.job_evidence_source);
  if (!source.success) throw new Error("job_evaluation_source_binding_invalid");
  if (!db) throw new Error("job_evaluation_store_unavailable");
  const session = await read(db.collection("captureUploadSessions").doc(source.data.capture_session_id));
  if (!session.exists) throw new Error("job_evaluation_source_unavailable");
  return session.data()!;
}

export function managedJobTask(args: {
  binding: JobManagedEvidenceBinding;
  record: Record<string, any> | undefined;
  brief: Record<string, any> | undefined;
  inventory?: TaskItemInventoryRecord | null;
  sourceSession?: Record<string, any> | null;
  /** Only the automatic job evaluation may inspect the exact retained preparation task before the site confirms the brief. */
  allowProposedScreening?: boolean;
  screeningCapture?: { captureId: string; captureBinding?: Record<string, any> };
}) {
  const { binding, record, brief } = args;
  if (!record || record.request?.buyerType !== "site_operator") throw new Error("job_not_found");
  if (!brief || brief.requestId !== binding.job_id || (!brief.confirmedAtIso
    && !(args.allowProposedScreening === true && record.website_scene_sponsorship?.purpose === "scene_preparation")))
    throw new Error("job_brief_not_agreed");
  if (scientificBriefDigest(brief) !== binding.brief_digest) throw new Error("job_brief_changed");
  const rights = projectWebsiteCaptureRights(record);
  if (!rights.derived_scene_generation_allowed) throw new Error("job_capture_processing_not_authorized");
  const sponsorship = record.website_scene_sponsorship;
  if (!sponsorship?.task_context_digest || !sponsorship.owner?.organization_id) {
    throw new Error("job_scene_not_prepared");
  }
  const context = projectWebsiteTaskContext(brief as SiteTaskBriefRecord, rights, {
    inventory: args.inventory,
    ...(sponsorship.purpose ? { purpose: sponsorship.purpose } : {}),
  });
  if (context.context_digest !== sponsorship.task_context_digest) throw new Error("job_scene_task_changed");
  let sourceFingerprint: string;
  let sourceCaptureSessionId: string | null = null;
  let sourceCaptureDigest: string | null = null;
  if (record.job_evidence_source != null) {
    const source = jobEvidenceSourceBindingSchema.safeParse(record.job_evidence_source);
    if (!source.success || source.data.job_id !== binding.job_id) throw new Error("job_evaluation_source_binding_invalid");
    if (!args.sourceSession) throw new Error("job_evaluation_source_unavailable");
    if (args.sourceSession.capture_access?.future_processing_allowed === false || args.sourceSession.completed_capture_lifecycle
      || ["revoked", "revocation_in_progress", "cancelled"].includes(args.sourceSession.status)) {
      throw new Error("job_capture_processing_not_authorized");
    }
    const native = scientificContext(args.sourceSession, { brief, record, inventory: args.inventory });
    if (!native || !native.testbed.source_capture_bundles.some(bundle =>
      bundle.bundle_id === source.data.intake_id && bundle.digest === source.data.source_capture_digest)) {
      throw new Error("job_evaluation_source_changed");
    }
    sourceFingerprint = crossRuntimeDigest({ schema_version: "job_managed_source_binding.v1", job_id: source.data.job_id,
      capture_session_id: source.data.capture_session_id, intake_id: source.data.intake_id,
      source_capture_digest: source.data.source_capture_digest, approved_task_digest: source.data.approved_task_digest,
      brief_digest: source.data.brief_digest, task_inventory_digest: source.data.task_inventory_digest,
      testbed_digest: native.testbed.testbed_digest });
    sourceCaptureSessionId = source.data.capture_session_id;
    sourceCaptureDigest = source.data.source_capture_digest;
  } else {
    // Browser walkthrough storage is immutable. Keep its exact task/capture
    // identity separate from sponsorship expiry, spending limits and quotes.
    sourceFingerprint = crossRuntimeDigest({ schema_version: "job_managed_source_binding.v1", job_id: binding.job_id,
      capture_id: sponsorship.capture_id ?? `walkthrough-${binding.job_id}`, brief_digest: scientificBriefDigest(brief),
      task_inventory_digest: jobEvidenceTaskInventoryDigest(brief, args.inventory) });
  }
  let selectedContext = context;
  let websiteCaptureId = String(sponsorship.capture_id ?? `walkthrough-${binding.job_id}`);
  if (args.screeningCapture) {
    const { captureId, captureBinding } = args.screeningCapture;
    if (!args.allowProposedScreening || (sourceCaptureSessionId && captureId !== sourceCaptureSessionId))
      throw new Error("job_evaluation_source_changed");
    if (!sourceCaptureSessionId && captureId !== websiteCaptureId) {
      if (!captureBinding || captureBinding.capture_id !== captureId
        || captureBinding.original_capture_id !== `walkthrough-${binding.job_id}`) throw new Error("job_evaluation_source_changed");
      selectedContext = projectWebsiteTaskContext(brief as SiteTaskBriefRecord, rights, {
        inventory: args.inventory, captureId, captureBinding, ...(sponsorship.purpose ? { purpose: sponsorship.purpose } : {}),
      });
      sourceFingerprint = crossRuntimeDigest({ schema_version: "job_managed_screening_continuation.v1", job_id: binding.job_id,
        parent_source_fingerprint: sourceFingerprint, capture_id: captureId, capture_binding_digest: crossRuntimeDigest(captureBinding),
        task_context_digest: selectedContext.context_digest });
      websiteCaptureId = captureId;
    }
  }
  return {
    taskIds: sourceCaptureSessionId ? [] : [
      `website-${selectedContext.context_digest.slice(7, 27)}`,
      `website-${selectedContext.context_digest.slice(7, 27)}-development`,
    ],
    teamNamespace: sponsorship.owner.organization_id as string,
    taskContextDigest: selectedContext.context_digest,
    sourceFingerprint,
    sourceCaptureSessionId,
    sourceCaptureDigest,
    sourceWebsiteCaptureId: websiteCaptureId,
  };
}

/** The same retained source bytes govern ingestion and current evidence applicability. */
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

/** Reuse the existing supplementary-capture lineage and immutable upload authority. */
export async function readManagedScreeningCapture(jobId: string, captureId: string): Promise<{ captureId: string; captureBinding?: Record<string, any> }> {
  try { return { captureId, captureBinding: await resolveWebsiteCaptureBinding(jobId, `site-${jobId}`, captureId) }; }
  catch (error) {
    if (error instanceof Error && (/^task_context_capture_mismatch$/.test(error.message)
      || /^website_capture_binding_(lineage_changed|source_changed|source_mismatch|not_finalized|generations_unknown|lineage_limit)$/.test(error.message)))
      throw new Error("job_evaluation_source_changed");
    throw error;
  }
}

export async function assertManagedScreeningCaptureCurrent(jobId: string,
  capture: Awaited<ReturnType<typeof readManagedScreeningCapture>>,
  read: (reference: FirebaseFirestore.DocumentReference) => Promise<FirebaseFirestore.DocumentSnapshot>) {
  try { await assertWebsiteCaptureBindingInTransaction({ get: read }, jobId, capture.captureBinding); }
  catch (error) {
    if (error instanceof Error && /^website_capture_binding_(lineage_changed|source_changed)$/.test(error.message))
      throw new Error("job_evaluation_source_changed");
    throw error;
  }
  if (!capture.captureBinding || !db) return;
  const ids = new Set<string>(capture.captureBinding.lineage.flatMap((entry: any) => [entry.child.capture_id, entry.parent.capture_id]));
  for (const id of ids) {
    const source = (await read(db.collection("captureUploadSessions").doc(id))).data();
    if (!source || source.capture_access?.future_processing_allowed === false || source.completed_capture_lifecycle
      || ["revoked", "revocation_in_progress", "cancelled"].includes(source.status)) throw new Error("job_capture_processing_not_authorized");
  }
}

export function assertManagedOfferingForJob(
  scope: ReturnType<typeof managedJobTask>, offering: ConfiguredSceneOffering,
) {
  if (offering.team_namespace !== scope.teamNamespace || !scope.taskIds.includes(offering.task.identity.id)) {
    throw new Error("job_evaluation_source_mismatch");
  }
}

export type ManagedJobEvidenceSummary = {
  runId: string; state: string; current: boolean; resultDigest: string | null;
  summary: string; nextAction: string; limitations: string[]; href: string;
  screening?: { budget?: { limitUsd: string; committedUpperBoundUsd: string; spentUpperBoundUsd: string; reservedUsd: string };
    candidates: Array<{ candidateId: string; name: string; state: string; planned: number;
    scored: number; succeeded: number; failed: number; void: number; blockers: string[] }> };
};

/** A projection of already accepted publications, never a second report store. */
export function projectManagedJobEvidence(
  runId: string, run: Record<string, any>, result: Record<string, any> | null,
  jobId: string, currentBriefDigest: string, currentTaskContextDigest: string | null,
  currentSourceFingerprint: string | null = null,
): ManagedJobEvidenceSummary | null {
  const binding = jobManagedEvidenceBindingSchema.safeParse(run.job_evidence_binding);
  if (!binding.success || binding.data.job_id !== jobId || run.run_id !== runId) return null;
  const base: ManagedJobEvidenceSummary = {
    runId, state: String(run.state || "unavailable"), current: binding.data.brief_digest === currentBriefDigest
      && currentTaskContextDigest !== null && run.job_task_context_digest === currentTaskContextDigest
      && currentSourceFingerprint !== null && run.job_source_fingerprint === currentSourceFingerprint
      && !(run.run_kind === "beta_policy_screening" && (run.cancellationRequested === true || ["cancelled", "closed"].includes(run.state))),
    resultDigest: null, summary: `Policy run status: ${String(run.state || "unavailable")}. No accepted scientific result is attached.`,
    nextAction: ["blocked", "failed", "cancelled"].includes(run.state)
      ? "Blueprint can inspect the recorded runtime limitation and choose the next useful action. No retry is automatic."
      : "Blueprint can inspect the existing run status before deciding whether any further evidence is needed.",
    limitations: ["A prepared or running setup does not prove task performance or physical delivery."],
    href: `#managed-evidence-${encodeURIComponent(runId)}`,
  };
  if (!result || result.record_id !== run.result_record_id) return base;
  const publication = publicationFromResultRecord(result);
  if (!publication) return base;
  if (publication.schema_version === "beta_policy_screening_publication.v2"
    || publication.schema_version === "beta_policy_screening_publication.v1") {
    // The automatic run under the site's allowance is the job's evaluation
    // (owner decision 2026-10-28). Retained v1 rows read the same way.
    const value = parseBetaPolicyScreeningPublication(publication);
    if (!value || value.campaign_id !== runId || run.run_kind !== "beta_policy_screening"
      || value.publication_digest !== run.publication_digest || value.revision !== run.publication_revision
      || value.plan_digest !== run.configuration_digest || value.source.scene_intent_id !== run.source_scene_intent_id
      || value.source.scene_revision_digest !== run.source_scene_revision_digest
      || value.source.task_context_digest !== run.job_task_context_digest || value.site_id !== `site-${jobId}`) return base;
    const completed = value.candidates.filter(row => row.status === "completed").length;
    const total = value.candidates.length;
    const scored = value.candidates.reduce((sum, row) => sum + row.episodes_scored, 0);
    const notRun = value.candidates.filter(row => ["blocked", "unavailable", "deferred"].includes(row.status)).length;
    const candidates = (count: number) => `${count} candidate${count === 1 ? "" : "s"}`;
    // A run whose candidates finished with no scored episode has no estimate to show.
    const finished = value.status === "completed" && scored === 0 ? "blocked" : value.status;
    // No estimate ends as held only when no candidate can do the job; budget and
    // setup gaps stay in progress for the owner or for us (owner decision 2026-10-28).
    const reason = finished === "blocked" ? noEstimateReason(value.candidates) : null;
    const status = reason === "held" ? "held" : reason === "budget" ? "awaiting_spend_approval" : reason === "setup" ? "setup_repair" : finished;
    return { ...base, state: status, resultDigest: ["completed", "blocked"].includes(finished) ? value.publication_digest : null,
      summary: status === "completed"
        ? `Your job's simulation estimate: ${completed} of ${total} candidates ran, with ${scored} episodes scored against the job's success criteria.`
        : status === "held" ? "Held: we can't simulate this kind of job yet. It counts as demand for what we build next."
        : status === "awaiting_spend_approval" || status === "setup_repair" ? "Simulation evaluation in progress. We'll run your job again and show the estimate here."
          : `Simulation evaluation of your job: ${completed} of ${total} candidates finished; ${scored} episodes scored so far.`,
      nextAction: status === "completed" ? "Blueprint uses this estimate to recommend the next step for your job, then works with a deployment company on any physical pilot."
        : status === "held" ? "Nothing is needed from the site. No candidate Blueprint can run supports this job yet; each row lists why."
        : status === "awaiting_spend_approval" ? "Owner approval needed: this job's candidates need more than the site's simulation budget. Nothing is needed from the site."
        : status === "setup_repair" ? "Fix the setup blockers listed per candidate, then rerun. Nothing is needed from the site."
        : status === "reconciliation_required" ? "Blueprint is reviewing the recorded limitations before any further run."
          : "Candidate progress will update as each test finishes.",
      limitations: [
        ...(scored ? [`A bounded simulation estimate from ${scored} scored episode${scored === 1 ? "" : "s"} across ${candidates(completed)}, for this job's recorded task and simulated conditions only.`] : []),
        "A simulation result is a bounded estimate. It does not certify physical performance or safety.",
        ...(notRun ? [`${candidates(notRun)} did not run; each row lists why.`] : []),
      ],
      screening: { budget: { limitUsd: value.budget.limit_usd, committedUpperBoundUsd: value.budget.committed_upper_bound_usd,
        spentUpperBoundUsd: value.budget.spent_upper_bound_usd, reservedUsd: value.budget.reserved_usd },
        candidates: value.candidates.map(row => ({ candidateId: row.candidate_id, name: row.display_name,
        state: row.status, planned: row.episodes_planned, scored: row.episodes_scored, succeeded: row.episodes_succeeded,
        failed: row.episodes_failed, void: row.episodes_void, blockers: row.blockers })) } };
  }
  if (publication.run_id !== runId) return base;
  if (publication.schema_version === "task_evaluation_run_publication.v4") {
    const verified = parsePipelinePolicyCanaryPublication(publication);
    if (!verified.ok || verified.publication.configuration_digest !== (run.pipeline_configuration_digest || run.configuration_digest)
      || verified.publication.capture_session_id !== run.source_launch_id
      || verified.publication.result_delivery.delivery_digest !== run.delivery_digest) return base;
    const value = verified.publication;
    return { ...base, state: value.result_status, resultDigest: value.policy_canary_result.projection_digest,
      summary: `Diagnostic policy run: ${value.result_status}. No winner or qualified evaluation is declared.`,
      nextAction: "Resolve the diagnostic limitations before using this run to support a performance claim.",
      limitations: ["Unqualified diagnostic execution; this is not a passed evaluation or physical-success evidence.",
        ...value.policy_canary_result.blockers] };
  }
  const verified = parseVerifiedTaskEvaluationRunPublication(publication);
  if (!verified.ok || verified.publication.schema_version !== "task_evaluation_run_publication.v3") return base;
  const value = verified.publication;
  const scientific = value.policy_run_result;
  if (scientific.configuration_digest !== run.configuration_digest || scientific.source_launch_id !== run.source_launch_id
    || scientific.offering_digest !== run.offering_digest || value.result_delivery.delivery_digest !== run.delivery_digest) return base;
  const decision = value.decision_envelope;
  return { ...base, state: value.state, resultDigest: scientific.projection_digest,
    summary: `${decision.decision_question} ${decision.per_claim_verdicts.map(claim => `${claim.claim_id}: ${claim.verdict}. ${claim.rationale}`).join(" ")}`,
    nextAction: decision.next_cheapest_experiment,
    limitations: ["Simulation evidence applies only to the recorded task, configuration and tested conditions; it does not prove physical success, installation or safety.",
      ...decision.unsupported_conditions, ...value.result_delivery.blockers,
      ...(value.result_delivery.claim_class === "development_only" ? ["The producer marks this evidence development_only."] : []),
      ...(decision.physical_evidence_still_required.length ? ["The decision still requires separately authoritative physical evidence."] : [])] };
}

/** Workspace readback and proposal references use the same current screening source. */
async function currentManagedScreeningScope(args: {
  jobId: string; currentBriefDigest: string; run: Record<string, any>;
  result: Record<string, any> | null;
  record: Record<string, any> | undefined; brief: Record<string, any> | undefined;
  inventory: TaskItemInventoryRecord | null; sourceSession: Record<string, any> | null;
  read: (reference: FirebaseFirestore.DocumentReference) => Promise<FirebaseFirestore.DocumentSnapshot>;
}) {
  const { jobId, currentBriefDigest, run, result, record, brief, inventory, sourceSession, read } = args;
  try {
    const publication = result ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(result)) : null;
    if (!result || !publication || result.record_id !== run.result_record_id || result.run_id !== run.run_id
      || publication.campaign_id !== run.run_id || publication.publication_digest !== run.publication_digest
      || publication.revision !== run.publication_revision || publication.plan_digest !== run.configuration_digest) return null;
    const intake = (await read(db!.collection("taskEvaluationSceneIntakes").doc(run.source_scene_intake_id))).data();
    if (!intake || typeof intake.source_session_id !== "string" || intake.website_request_id !== jobId || intake.receipt?.intent_id !== run.source_scene_intent_id
      || intake.request?.owner?.user_id !== run.owner_user_id
      || intake.pipeline_status?.result_reference?.digest !== run.source_scene_revision_digest) return null;
    assertWebsiteRunOpen(record, jobId, intake.source_session_id);
    const capture = sourceSession ? { captureId: intake.source_session_id }
      : await readManagedScreeningCapture(jobId, intake.source_session_id);
    await assertManagedScreeningCaptureCurrent(jobId, capture, read);
    const scope = managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest }, record, brief,
      inventory, sourceSession, allowProposedScreening: true, screeningCapture: capture });
    assertScreeningSceneSource(publication, intake, scope);
    return scope;
  } catch (error) {
    if (!(error instanceof Error) || !(/^job_[a-z_]+$/.test(error.message)
      || ["screening_scene_source_mismatch", "website_run_closed_by_owner", "website_run_capture_superseded"].includes(error.message))) throw error;
    return null;
  }
}

export async function loadManagedJobEvidence(jobId: string, currentBriefDigest: string): Promise<ManagedJobEvidenceSummary[]> {
  if (!db) return [];
  const store = db;
  const [job, brief, inventory] = await Promise.all([
    store.collection("inboundRequests").doc(jobId).get(), store.collection("siteTaskBriefs").doc(jobId).get(),
    store.collection("siteTaskItemInventories").doc(jobId).get(),
  ]);
  let taskContextDigest: string | null = null;
  let sourceFingerprint: string | null = null;
  let sourceSession: Record<string, any> | null = null;
  try { sourceSession = await readManagedJobSourceSession(job.data(), reference => reference.get()); }
  catch (error) {
    if (!(error instanceof Error) || !/^job_[a-z_]+$/.test(error.message)) throw error;
  }
  try {
    const scope = managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest },
      record: job.data(), brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      sourceSession });
    taskContextDigest = scope.taskContextDigest; sourceFingerprint = scope.sourceFingerprint;
  }
  catch (error) {
    // A known source/scope refusal ends current applicability while preserving
    // history. An unrelated storage failure must not be hidden as empty proof.
    if (!(error instanceof Error) || !/^job_[a-z_]+$/.test(error.message)) throw error;
  }
  const snapshot = await store.collection("taskEvaluationPolicyRuns").where("job_evidence_binding.job_id", "==", jobId)
    .orderBy("created_at_iso", "desc").limit(20).get();
  const rows = await Promise.all(snapshot.docs.map(async document => {
    const run = document.data();
    const result = typeof run.result_record_id === "string"
      ? await store.collection("captureTaskEvaluationRuns").doc(run.result_record_id).get() : null;
    const scientificResult = result?.exists ? result.data()! : null;
    let screeningScope: ReturnType<typeof managedJobTask> | null = null;
    if (run.run_kind === "beta_policy_screening" && typeof run.source_scene_intake_id === "string") {
      screeningScope = await currentManagedScreeningScope({
        jobId, currentBriefDigest, run, result: scientificResult, record: job.data(), brief: brief.data(),
        inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
        sourceSession, read: reference => reference.get() });
    }
    return projectManagedJobEvidence(document.id, run, scientificResult, jobId, currentBriefDigest,
      run.run_kind === "beta_policy_screening" ? screeningScope?.taskContextDigest ?? null : taskContextDigest,
      run.run_kind === "beta_policy_screening" ? screeningScope?.sourceFingerprint ?? null : sourceFingerprint);
  }));
  return rows.filter((row): row is ManagedJobEvidenceSummary => row !== null);
}

/** A missing composite index is an unavailable projection, never proof that no runs exist. */
export async function loadManagedJobEvidenceForWorkspace(jobId: string, currentBriefDigest: string) {
  try { return { managedEvidence: await loadManagedJobEvidence(jobId, currentBriefDigest) }; }
  catch (error) {
    const value = error as { code?: unknown; message?: unknown; details?: unknown };
    const code = String(value?.code ?? "").toLowerCase().replace(/_/g, "-");
    if (["9", "failed-precondition"].includes(code) && /index/i.test(`${value?.message ?? ""} ${value?.details ?? ""}`)) {
      return { managedEvidence: [], managedEvidenceUnavailable: true as const };
    }
    throw error;
  }
}

export async function assertManagedJobEvidenceReference(jobId: string, currentBriefDigest: string,
  reference: { runId: string; resultDigest: string }, transaction?: FirebaseFirestore.Transaction) {
  if (!db) throw new Error("job_evaluation_store_unavailable");
  const store = db;
  const read = (ref: FirebaseFirestore.DocumentReference) => transaction ? transaction.get(ref) : ref.get();
  const [snapshot, job, brief, inventory] = await Promise.all([
    read(store.collection("taskEvaluationPolicyRuns").doc(reference.runId)),
    read(store.collection("inboundRequests").doc(jobId)), read(store.collection("siteTaskBriefs").doc(jobId)),
    read(store.collection("siteTaskItemInventories").doc(jobId)),
  ]);
  const run = snapshot.data();
  if (!run || run.job_evidence_binding?.job_id !== jobId || typeof run.result_record_id !== "string") {
    throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  }
  const sourceSession = await readManagedJobSourceSession(job.data(), read);
  const result = await read(store.collection("captureTaskEvaluationRuns").doc(run.result_record_id));
  const scope = run.run_kind === "beta_policy_screening"
    ? await currentManagedScreeningScope({ jobId, currentBriefDigest, run, result: result.exists ? result.data()! : null,
      record: job.data(), brief: brief.data(),
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null, sourceSession, read })
    : managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest }, record: job.data(),
      brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null, sourceSession });
  if (!scope) throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  const row = projectManagedJobEvidence(snapshot.id, run, result.exists ? result.data()! : null,
    jobId, currentBriefDigest, scope.taskContextDigest, scope.sourceFingerprint);
  if (!row || !row.current || row.resultDigest !== reference.resultDigest) throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  return row;
}
