import { websitePreparationCaptureId } from "./websitePreparationRevision";
/** Bind managed simulator runs to the agreed job without changing scientific results. */
import { z } from "zod";
import { jobEvidenceSourceBindingSchema, jobEvidenceTaskInventoryDigest, scientificBriefDigest, scientificContext } from "./jobEvidenceContract";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { preparationGrantContextDigest, projectWebsiteTaskContext } from "./websiteTaskContext";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { preparationGrantFollowsBrief } from "./preparationGrantTask";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import type { ConfiguredSceneOffering } from "./configuredSceneOfferingContract";
import { evaluationPreparationBindingSchema, sameArtifactReference } from "./configuredSceneRevisionBinding";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { parsePipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import type { BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { familyNativePreparationReference, preparationPhaseMatchesTask } from "./taskFamilySceneIntake";
import { navigationPreparationReference } from "./navigationSceneIntake";
import { taskTargetSelectionApplies } from "./websiteTaskTargetChoice";
import { jobManagedEvidenceBindingSchema, type JobManagedEvidenceBinding } from "./jobManagedEvidenceBinding";
import type { ManagedJobEvidenceSummary } from "./managedJobEvidenceSummary";

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
    preparationGrantContextDigest: preparationGrantContextDigest(record),
  });
  if (context.context_digest !== sponsorship.task_context_digest && !preparationGrantFollowsBrief(sponsorship,
    { brief: brief as SiteTaskBriefRecord, record, inventory: args.inventory })) throw new Error("job_scene_task_changed");
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
        preparationGrantContextDigest: preparationGrantContextDigest(record),
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

/** Where the Pipeline's launch receipt sync keeps each configured scene's offering. */
const CONFIGURED_SCENE_LAUNCHES = "taskEvaluationLaunches";
const OFFERED_REVISION_FILE_DIGEST = "configured_scene_offering.evaluation_preparation_binding.configured_scene_revision.digest";

/**
 * Stored configured scene offerings that name this intake's prepared revision
 * file. Each was stored from a Pipeline-signed launch receipt the website
 * verified. A family or navigation preparation names its revision digest itself
 * and needs none. Read outside any transaction: a file's bytes fix its self-digest, so
 * what an offering says about one exact revision file never changes.
 */
export async function readPreparedRevisionOfferings(intake: Record<string, any> | undefined): Promise<unknown[]> {
  const reference = intake?.pipeline_status?.result_reference;
  if (!db || familyNativePreparationReference.safeParse(reference).success
    || navigationPreparationReference.safeParse(reference).success || typeof reference?.digest !== "string") return [];
  const rows = await db.collection(CONFIGURED_SCENE_LAUNCHES).where(OFFERED_REVISION_FILE_DIGEST, "==", reference.digest).limit(20).get();
  return rows.docs.map(row => row.data()?.configured_scene_offering);
}

/**
 * The prepared scene revision's own digest, which a screening source names as
 * `scene_revision_digest`. A family preparation's reference states it, and so
 * does a navigation preparation's (the navigation record's scene revision). A
 * configured scene's status names only the revision file (its uri, the sha256
 * of its bytes and its size), never its self-digest; the stored offering's
 * evaluation_preparation_binding binds that exact file to the self-digest.
 * Null when no offering names the file, or offerings disagree.
 */
export function preparedSceneRevisionDigest(status: Record<string, any> | undefined, offerings: readonly unknown[]): string | null {
  const reference = status?.result_reference;
  const family = familyNativePreparationReference.safeParse(reference);
  if (family.success) return family.data.digest;
  const navigation = navigationPreparationReference.safeParse(reference);
  if (navigation.success) return navigation.data.digest;
  const named = new Set<string>();
  for (const offering of offerings) {
    const binding = evaluationPreparationBindingSchema.safeParse((offering as Record<string, unknown> | null)?.evaluation_preparation_binding);
    if (binding.success && sameArtifactReference(reference, binding.data.configured_scene_revision))
      named.add(binding.data.configured_scene_revision_digest);
  }
  return named.size === 1 ? [...named][0] : null;
}

/**
 * The same retained source bytes govern ingestion and current evidence
 * applicability. `revisionOfferings` (`readPreparedRevisionOfferings`) relate
 * a configured scene's revision file to the revision digest the source names.
 */
export function assertScreeningSceneSource(publication: Pick<BetaPolicyScreeningPublication, "source" | "site_id">, intake: Record<string, any>,
  scope: ReturnType<typeof managedJobTask>, revisionOfferings: readonly unknown[]) {
  const source = publication.source;
  const status = intake.pipeline_status;
  const prepared = preparationPhaseMatchesTask(intake.request, status);
  const revision = prepared ? preparedSceneRevisionDigest(status, revisionOfferings) : null;
  // A prepared scene whose revision file no stored offering binds: the
  // launch's publication sync has not reached the website yet.
  if (prepared && revision === null) throw new Error("screening_scene_revision_unbound");
  // A family preparation's policy_selection records its compilation seed.
  // Pipeline evaluates every compatible configuration against these exact
  // prepared task/scene bytes; its signed campaign owns that candidate set.
  // The seed remains bound by the immutable request and preparation checks.
  if (!intake.request || !intake.receipt || !intake.website_request_id
    || intake.revocation_requested || intake.state !== "completed" || status?.status !== "completed" || !prepared
    || crossRuntimeDigest(intake.request) !== intake.request_digest
    || intake.receipt.request_digest !== intake.request_digest
    || crossRuntimeArtifactDigest(intake.receipt, "receipt_digest") !== intake.receipt.receipt_digest
    || intake.receipt.intent_id !== source.scene_intent_id || intake.receipt.intent_digest !== source.scene_intent_digest
    || crossRuntimeArtifactDigest(status, "status_digest") !== status.status_digest
    || status.intent_id !== source.scene_intent_id || status.intent_digest !== source.scene_intent_digest
    || status.request_digest !== intake.request_digest || crossRuntimeDigest(status.owner) !== crossRuntimeDigest(intake.request.owner)
    || revision !== source.scene_revision_digest
    || websitePreparationCaptureId(intake.request) !== source.capture_id || intake.request.task?.task_id !== source.task_id
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
      && currentSourceFingerprint !== null && run.job_source_fingerprint === currentSourceFingerprint,
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

export async function loadManagedJobEvidence(jobId: string, currentBriefDigest: string,
  options: { pageAll?: boolean } = {}): Promise<ManagedJobEvidenceSummary[]> {
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
  const query = store.collection("taskEvaluationPolicyRuns").where("job_evidence_binding.job_id", "==", jobId)
    .orderBy("created_at_iso", "desc").limit(20);
  let snapshot = await query.get();
  const documents = [...snapshot.docs];
  while (options.pageAll && snapshot.docs.length === 20) {
    snapshot = await query.startAfter(snapshot.docs[snapshot.docs.length - 1]).get();
    documents.push(...snapshot.docs);
  }
  const selectionSession = sourceSession ?? (await store.collection('captureUploadSessions')
    .doc(job.data()?.active_capture_id || `walkthrough-${jobId}`).get()).data();
  const uncorrectedSelectionApplies = taskTargetSelectionApplies(selectionSession);
  // Blueprint's own early trial is no longer shown to anyone: its runs stay stored until deleted, and are skipped here.
  const rows = await Promise.all(documents.filter(document => document.data().run_kind !== "beta_policy_screening").map(async document => {
    const run = document.data();
    const result = typeof run.result_record_id === "string"
      ? await store.collection("captureTaskEvaluationRuns").doc(run.result_record_id).get() : null;
    const scientificResult = result?.exists ? result.data()! : null;
    return projectManagedJobEvidence(document.id, run, scientificResult, jobId, currentBriefDigest,
      uncorrectedSelectionApplies ? taskContextDigest : null, sourceFingerprint);
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
  if (!run || run.job_evidence_binding?.job_id !== jobId || typeof run.result_record_id !== "string"
    || run.run_kind === "beta_policy_screening") {
    throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  }
  const sourceSession = await readManagedJobSourceSession(job.data(), read);
  const selectionSession = sourceSession ?? (await read(store.collection('captureUploadSessions')
    .doc(job.data()?.active_capture_id || `walkthrough-${jobId}`))).data();
  if (!taskTargetSelectionApplies(selectionSession)) throw new Error('job_managed_evidence_reference_unavailable_or_stale');
  const result = await read(store.collection("captureTaskEvaluationRuns").doc(run.result_record_id));
  const scope = managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest }, record: job.data(),
    brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null, sourceSession });
  if (!scope) throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  const row = projectManagedJobEvidence(snapshot.id, run, result.exists ? result.data()! : null,
    jobId, currentBriefDigest, scope.taskContextDigest, scope.sourceFingerprint);
  if (!row || !row.current || row.resultDigest !== reference.resultDigest) throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  return row;
}
