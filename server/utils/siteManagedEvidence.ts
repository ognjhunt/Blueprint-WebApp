/**
 * Blueprint's results for a site's job, in the site's view: what its job page
 * shows (`routes/job-workflow.ts`) and what the signed-in workspace's Results
 * tab shows (`routes/workspace.ts`, F-05), from one place.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { withoutRegistryTeams } from "./betaCandidateSelection";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { loadManagedJobEvidenceForWorkspace } from "./jobManagedEvaluation";
import type { ManagedJobEvidenceSummary } from "./managedJobEvidenceSummary";
import { JobMarketplaceError } from "./jobMarketplaceWorkflow";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";

/** A site job whose recording permission still stands; otherwise the refusal the job page gives. */
export function assertSiteJob(record: Record<string, any> | undefined): asserts record is Record<string, any> {
  if (!record || record.request?.buyerType !== "site_operator") throw new JobMarketplaceError("job_not_found", "Site job not found.", 404);
  if (projectWebsiteCaptureRights(record).consent_revoked) throw new JobMarketplaceError("capture_processing_not_authorized",
    "Recording permission was withdrawn. Contact Blueprint to review this job before continuing.");
}

/** A site's view of a run: no registry teams, operator instruction or budget figure, which are Blueprint's own records and controls (F-03). */
export function managedEvidenceForSite(item: ManagedJobEvidenceSummary): ManagedJobEvidenceSummary {
  const { opsNextAction: _operator, ...site } = withoutRegistryTeams(item);
  if (!site.screening?.budget) return site;
  const { budget: _budget, ...screening } = site.screening;
  return { ...site, screening };
}

/** The job's runs in the site's view, read against its current brief. */
export async function readSiteManagedEvidence(requestId: string):
  Promise<{ managedEvidence: ManagedJobEvidenceSummary[]; managedEvidenceUnavailable?: true }> {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job details are temporarily unavailable.", 503);
  const [snapshot, brief] = await Promise.all([db.collection("inboundRequests").doc(requestId).get(),
    db.collection("siteTaskBriefs").doc(requestId).get()]);
  assertSiteJob(snapshot.data());
  if (!brief.exists) return { managedEvidence: [] };
  const managed = await loadManagedJobEvidenceForWorkspace(requestId, scientificBriefDigest(brief.data()!));
  return { ...managed, managedEvidence: managed.managedEvidence.map(managedEvidenceForSite) };
}
