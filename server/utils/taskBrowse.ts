import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import type { TaskBrowseCard } from "../../client/src/types/taskBrowse";
import { approvedTaskDetails } from "./taskListingDetails";
import { isRunnableTask, screeningRunCostUsd } from "./teamEvalCandidates";
import { operatorListingPaused } from "./operatorListing";

export function projectTaskBrowseCard(id: string, record: InboundRequest): TaskBrowseCard | null {
  const details = approvedTaskDetails(record);
  // A grant is for these text fields only. It never authorizes footage or raw intake.
  if (!details || operatorListingPaused(record) || record.request?.buyerType !== "site_operator"
      || record.debug?.autoCreatedByPipeline === true) return null;
  const raw = record as unknown as Record<string, any>;
  if (raw.evidence_tier === "development_only" || raw.pipeline?.evidence_tier === "development_only"
      || raw.pipeline?.rights_review_status === "blocked" || raw.pipeline?.rights_review_status === "needs_review"
      || raw.capture_privacy_screen?.eligibility === "rejected") return null;
  const ready = isRunnableTask(record);
  const captured = Boolean(raw.capture_privacy_screen?.screened_at_iso || raw.capture_coverage
    || record.pipeline?.artifacts?.worldlabs_world_manifest_uri);
  return { ...details, id, stage: ready ? "ready" : captured ? "preparing" : "capture",
    evaluationAvailable: ready, costUsd: ready ? screeningRunCostUsd() : null,
    publishedAtIso: raw.public_task_listing.approvedAtIso,
    thumbnailUrl: /^[a-f0-9]{64}$/.test(raw.public_task_listing.thumbnailDigest ?? "")
      ? `/api/site-worlds/tasks/${encodeURIComponent(id)}/thumbnail` : null };
}

export async function listTaskBrowseCards(): Promise<TaskBrowseCard[]> {
  if (!db) throw new Error("Task library unavailable");
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.enabled", "==", true).limit(200).get();
  return snapshot.docs.map(doc => projectTaskBrowseCard(doc.id, doc.data() as InboundRequest))
    .filter((card): card is TaskBrowseCard => card !== null)
    .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));
}
