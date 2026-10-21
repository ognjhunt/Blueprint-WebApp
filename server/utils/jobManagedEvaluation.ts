/** Bind managed simulator runs to the agreed job without changing scientific results. */
import { z } from "zod";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import type { ConfiguredSceneOffering } from "./configuredSceneOfferingContract";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { parsePipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";

export const jobManagedEvidenceBindingSchema = z.object({
  job_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
  brief_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export type JobManagedEvidenceBinding = z.infer<typeof jobManagedEvidenceBindingSchema>;

export function managedJobTask(args: {
  binding: JobManagedEvidenceBinding;
  record: Record<string, any> | undefined;
  brief: Record<string, any> | undefined;
  inventory?: TaskItemInventoryRecord | null;
}) {
  const { binding, record, brief } = args;
  if (!record || record.request?.buyerType !== "site_operator") throw new Error("job_not_found");
  if (!brief?.confirmedAtIso || brief.requestId !== binding.job_id) throw new Error("job_brief_not_agreed");
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
  return {
    taskIds: [
      `website-${context.context_digest.slice(7, 27)}`,
      `website-${context.context_digest.slice(7, 27)}-development`,
    ],
    teamNamespace: sponsorship.owner.organization_id as string,
    taskContextDigest: context.context_digest,
  };
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
};

/** A projection of already accepted publications, never a second report store. */
export function projectManagedJobEvidence(
  runId: string, run: Record<string, any>, result: Record<string, any> | null,
  jobId: string, currentBriefDigest: string, currentTaskContextDigest: string | null,
): ManagedJobEvidenceSummary | null {
  const binding = jobManagedEvidenceBindingSchema.safeParse(run.job_evidence_binding);
  if (!binding.success || binding.data.job_id !== jobId || run.run_id !== runId) return null;
  const base: ManagedJobEvidenceSummary = {
    runId, state: String(run.state || "unavailable"), current: binding.data.brief_digest === currentBriefDigest
      && currentTaskContextDigest !== null && run.job_task_context_digest === currentTaskContextDigest,
    resultDigest: null, summary: `Policy run status: ${String(run.state || "unavailable")}. No accepted scientific result is attached.`,
    nextAction: ["blocked", "failed", "cancelled"].includes(run.state)
      ? "Blueprint can inspect the recorded runtime limitation and choose the next useful action. No retry is automatic."
      : "Blueprint can inspect the existing run status before deciding whether any further evidence is needed.",
    limitations: ["A prepared or running setup does not prove task performance or physical delivery."],
    href: `#managed-evidence-${encodeURIComponent(runId)}`,
  };
  if (!result || result.record_id !== run.result_record_id) return base;
  const publication = publicationFromResultRecord(result);
  if (!publication || publication.run_id !== runId) return base;
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

export async function loadManagedJobEvidence(jobId: string, currentBriefDigest: string): Promise<ManagedJobEvidenceSummary[]> {
  if (!db) return [];
  const store = db;
  const [job, brief, inventory] = await Promise.all([
    store.collection("inboundRequests").doc(jobId).get(), store.collection("siteTaskBriefs").doc(jobId).get(),
    store.collection("siteTaskItemInventories").doc(jobId).get(),
  ]);
  let taskContextDigest: string | null = null;
  try { taskContextDigest = managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest },
    record: job.data(), brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null }).taskContextDigest; }
  catch { /* Historical results remain readable when their current applicability ends. */ }
  const snapshot = await store.collection("taskEvaluationPolicyRuns").where("job_evidence_binding.job_id", "==", jobId)
    .orderBy("created_at_iso", "desc").limit(20).get();
  const rows = await Promise.all(snapshot.docs.map(async document => {
    const run = document.data();
    const result = typeof run.result_record_id === "string"
      ? await store.collection("captureTaskEvaluationRuns").doc(run.result_record_id).get() : null;
    return projectManagedJobEvidence(document.id, run, result?.exists ? result.data()! : null, jobId, currentBriefDigest, taskContextDigest);
  }));
  return rows.filter((row): row is ManagedJobEvidenceSummary => row !== null);
}

export async function assertManagedJobEvidenceReference(jobId: string, currentBriefDigest: string,
  reference: { runId: string; resultDigest: string }) {
  if (!db) throw new Error("job_evaluation_store_unavailable");
  const store = db;
  const [snapshot, job, brief, inventory] = await Promise.all([
    store.collection("taskEvaluationPolicyRuns").doc(reference.runId).get(),
    store.collection("inboundRequests").doc(jobId).get(), store.collection("siteTaskBriefs").doc(jobId).get(),
    store.collection("siteTaskItemInventories").doc(jobId).get(),
  ]);
  const scope = managedJobTask({ binding: { job_id: jobId, brief_digest: currentBriefDigest }, record: job.data(),
    brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null });
  const run = snapshot.data();
  if (!run || run.job_evidence_binding?.job_id !== jobId || typeof run.result_record_id !== "string") {
    throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  }
  const result = await store.collection("captureTaskEvaluationRuns").doc(run.result_record_id).get();
  const row = projectManagedJobEvidence(snapshot.id, run, result.exists ? result.data()! : null,
    jobId, currentBriefDigest, scope.taskContextDigest);
  if (!row || !row.current || row.resultDigest !== reference.resultDigest) throw new Error("job_managed_evidence_reference_unavailable_or_stale");
  return row;
}
