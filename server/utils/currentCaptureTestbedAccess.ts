/** Current applicability only; retained scientific history is never rewritten. */
import { jobEvidenceSourceBindingSchema } from "./reconstructionForwarding";
import { scientificBriefDigest, jobEvidenceTaskInventoryDigest } from "./jobEvidenceContract";
import { stableJson } from "./taskCandidateContract";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

type Snapshot = { exists: boolean; data(): any };
type Read = (collection: string, id: string) => Promise<Snapshot>;
export type CurrentTestbedAccess = "current" | "processing_denied" | "source_mismatch";

/** Use inside the caller's existing transaction before advancing/serving current output. */
export async function currentCaptureTestbedAccess(session: Record<string, any>,
  publication: Record<string, any> | undefined, read: Read): Promise<CurrentTestbedAccess> {
  if (session.capture_access?.future_processing_allowed === false
    || session.capture_access?.serve_allowed === false || session.completed_capture_lifecycle)
    return "processing_denied";
  const bound = session.job_evidence_source_binding;
  if (!Object.hasOwn(session, "job_evidence_source_binding")
    && !publication?.job_id && !publication?.brief_digest) return "current";
  const source = jobEvidenceSourceBindingSchema.safeParse(bound);
  if (!source.success) return "source_mismatch";
  const value = source.data;
  const bundles = publication?.testbed?.source_capture_bundles;
  const matches = Array.isArray(bundles) ? bundles.filter(row => row.bundle_id === value.intake_id) : [];
  if (value.capture_session_id !== session.session_id
    || value.intake_id !== session.request?.intake_id
    || value.approved_task_digest !== session.approved_task_definition?.approved_task_digest
    || publication && (value.capture_session_id !== publication.capture_session_id
      || value.intake_id !== publication.intake_id || value.approved_task_digest !== publication.approved_task_digest
      || publication.job_id && value.job_id !== publication.job_id
      || publication.brief_digest && value.brief_digest !== publication.brief_digest
      || matches.length !== 1 || matches[0].digest !== value.source_capture_digest)
    || session.latest_task_decision_command?.command_request_id !== value.command_request_id
    || session.latest_task_decision_command?.pipeline_approval_status !== "approved") return "source_mismatch";
  const [jobSnapshot, briefSnapshot, inventorySnapshot] = await Promise.all([
    read("inboundRequests", value.job_id), read("siteTaskBriefs", value.job_id),
    read("siteTaskItemInventories", value.job_id),
  ]);
  const job = jobSnapshot.data(), brief = briefSnapshot.data();
  if (!jobSnapshot.exists || job?.request?.buyerType !== "site_operator") return "source_mismatch";
  if (!projectWebsiteCaptureRights(job).derived_scene_generation_allowed) return "processing_denied";
  const current = jobEvidenceSourceBindingSchema.safeParse(job.job_evidence_source);
  if (!current.success || stableJson(current.data) !== stableJson(value)
    || !briefSnapshot.exists || brief?.requestId !== value.job_id || !brief.confirmedAtIso
    || !Number.isFinite(Date.parse(brief.confirmedAtIso))
    || scientificBriefDigest(brief) !== value.brief_digest
    || jobEvidenceTaskInventoryDigest(brief, inventorySnapshot.exists ? inventorySnapshot.data() : null)
      !== value.task_inventory_digest) return "source_mismatch";
  return "current";
}
