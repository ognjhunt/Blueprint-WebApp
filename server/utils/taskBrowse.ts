import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import type { TaskBrowseCard } from "../../client/src/types/taskBrowse";
import { screeningRunCostUsd } from "./teamEvalCandidates";
import { taskThumbnailUrl, teamJobAccess } from "./teamJobAccess";

/**
 * The job card approved robot teams see in the library. Whether it appears,
 * and whether it offers an evaluation, is `teamJobAccess`: the same answer the
 * opening page and the evaluation request give.
 */
export function projectTaskBrowseCard(id: string, record: InboundRequest): TaskBrowseCard | null {
  const access = teamJobAccess(record);
  if (!access.listed) return null;
  const raw = record as unknown as Record<string, any>;
  const ready = access.evaluationAvailable;
  const captured = Boolean(raw.capture_privacy_screen?.screened_at_iso || raw.capture_coverage
    || record.pipeline?.artifacts?.worldlabs_world_manifest_uri);
  return { ...access.details, id, stage: ready ? "ready" : captured ? "preparing" : "capture",
    evaluationAvailable: ready, costUsd: ready ? screeningRunCostUsd() : null,
    publishedAtIso: raw.public_task_listing.approvedAtIso,
    thumbnailUrl: taskThumbnailUrl(id, record) };
}

export async function listTaskBrowseCards(): Promise<TaskBrowseCard[]> {
  if (!db) throw new Error("Task library unavailable");
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.enabled", "==", true).limit(200).get();
  return snapshot.docs.map(doc => projectTaskBrowseCard(doc.id, doc.data() as InboundRequest))
    .filter((card): card is TaskBrowseCard => card !== null)
    .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));
}
