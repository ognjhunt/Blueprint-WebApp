import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import type { TaskBrowseCard, TaskCardDetail } from "../../client/src/types/taskBrowse";
import { jobCardAnswerShared, loadJobCardAnswer, loadJobCardAnswerHeadline } from "./jobCardAnswer";
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
    // A free beta evaluation costs the team nothing; the deprecated entry
    // price is never quoted (CLAUDE.md), so an open job reports 0.
    evaluationAvailable: ready, costUsd: ready ? 0 : null,
    publishedAtIso: raw.public_task_listing.approvedAtIso,
    thumbnailUrl: taskThumbnailUrl(id, record) };
}

/**
 * `withAnswerHeadlines` adds the answer's headline to a card whose site chose to share its answer and whose
 * current listing consent still names it (`jobCardAnswerShared`). No answer is composed for any other card.
 */
export async function listTaskBrowseCards(options: { withAnswerHeadlines?: boolean } = {}): Promise<TaskBrowseCard[]> {
  if (!db) throw new Error("Task library unavailable");
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.enabled", "==", true).limit(200).get();
  const cards = await Promise.all(snapshot.docs.map(async doc => {
    const card = projectTaskBrowseCard(doc.id, doc.data() as InboundRequest);
    if (!card || !options.withAnswerHeadlines || !jobCardAnswerShared(doc.data())) return card;
    const headline = await loadJobCardAnswerHeadline(doc.id, doc.data());
    return headline ? { ...card, answerHeadline: headline } : card;
  }));
  return cards.filter((card): card is TaskBrowseCard => card !== null)
    .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));
}

/** One listed card as an approved company opens it, with the answer when the site shared it. Null when not listed. */
export async function readTaskCardDetail(id: string): Promise<TaskCardDetail | null> {
  if (!db) throw new Error("Task library unavailable");
  const record = (await db.collection("inboundRequests").doc(id).get()).data();
  const card = record ? projectTaskBrowseCard(id, record as InboundRequest) : null;
  if (!card) return null;
  const answerSummary = await loadJobCardAnswer(id, record);
  return answerSummary ? { ...card, answerHeadline: answerSummary.headline, answerSummary } : card;
}
