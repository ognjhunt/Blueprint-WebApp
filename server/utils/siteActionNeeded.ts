/**
 * "Your job needs something from you" (owner, 2026-11-19): the one site email for a job that cannot continue without
 * the site. Never a status or progress email: only an ask the job page itself makes of the site (an outcome whose step
 * is the site's), today
 * - a new video, because the first was too large to process (`website_large_video_ask`), or because the Pipeline could
 *   not build from it (a new-video ask on its Atlas preview or its preparation status);
 * - the job's one sentence, because the Pipeline holds the job for it or the brief gives none.
 *
 * Never for an ending: a job whose window or no-grant clock ran out, whose scene ended (the $40 cap's
 * `spending_cap_reached` included) asks nothing of the site.
 *
 * One short line saying what is needed, and the private link. Once per distinct ask: the outbox document id names the
 * job, the capture and the ask, so the same ask is never sent twice, whatever the trigger. Read again at dispatch: an
 * ask that no longer stands (a new video arrived, the sentence was given, the site withdrew or closed the job) is
 * cancelled, never sent. The sweeps of every site job and each preparation status bring it; nothing else does.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, type OutboxInput } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { finePrintLast } from "./emailLayout";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { websiteRunClosure } from "./websiteRunClosure";
import { atlasPreviewReachedSpendingCap, selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { recordedWebsiteJobNoGrantEnding, recordedWebsiteJobWindowEnding } from "./websiteJobWindowEnding";
import { taskBriefUnclear } from "./siteTaskScope";
import { isRecaptureReason, largeVideoAskOutcome, RECAPTURE_TITLE, recaptureReasonOf, recaptureSentences, TASK_NOT_NAMED_REASON,
  TASK_NOT_NAMED_SENTENCES } from "./taskPreparationOutcome";

export const SITE_ACTION_KIND = "site_action_needed" as const;
export const SITE_ACTION_SUBJECT = "Your job needs something from you";
/** One ask the job page makes of the site: its key names the capture and the ask; its words are the page's own. */
export type SiteAsk = { key: string; title: string; nextStep: string };
type Tx = FirebaseFirestore.Transaction;

const keyPart = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
export const siteActionNoticeKey = (requestId: string, ask: Pick<SiteAsk, "key">) =>
  `${requestId.trim()}:${SITE_ACTION_KIND}:${keyPart(ask.key)}`;

/** What the job cannot continue without, from the site, now; null when nothing (or the site withdrew or closed it). */
export async function currentSiteAsk(requestId: string, record: Record<string, any> | null | undefined, tx?: Tx): Promise<SiteAsk | null> {
  if (!db || !record || record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return null;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  try { if (websiteRunClosure(record, requestId, captureId)) return null; } catch { return null; }
  // A job that has ended (its window or no-grant clock, a terminal scene outcome, the $40 spending cap) asks nothing:
  // its page states the ending, and nothing the site sends would start it again.
  if (recordedWebsiteJobWindowEnding(record) || recordedWebsiteJobNoGrantEnding(record, requestId)
    || atlasPreviewReachedSpendingCap(selectWebsiteAtlasPreview(record, captureId))) return null;
  const { readWebsiteSceneProgression } = await import("./websiteSceneProgression");
  if ((await readWebsiteSceneProgression(requestId, captureId))?.sceneOutcome?.terminal) return null;
  const large = largeVideoAskOutcome(record, requestId, captureId);
  if (large) return { key: `${captureId}.video_too_large.${large.evidence[0]?.digest.slice(7, 23) ?? ""}`, title: large.title, nextStep: large.nextStep };
  const newVideo = (reason: string) => isRecaptureReason(reason)
    ? { key: `${captureId}.${reason}`, title: RECAPTURE_TITLE, nextStep: recaptureSentences(reason).nextStep } : null;
  const previewReason = recaptureReasonOf(selectWebsiteAtlasPreview(record, captureId));
  if (previewReason) return newVideo(previewReason);
  const sessionRef = db.collection("captureUploadSessions").doc(captureId);
  const stored = (tx ? await tx.get(sessionRef) : await sessionRef.get()).data()?.website_preparation;
  const statusReason = stored?.selector?.capture_id === captureId ? stored?.status?.outcome?.reason : undefined;
  const fromStatus = typeof statusReason === "string" ? newVideo(statusReason) : null;
  if (fromStatus) return fromStatus;
  const sentence = { key: `${captureId}.job_sentence`, title: TASK_NOT_NAMED_SENTENCES.title, nextStep: TASK_NOT_NAMED_SENTENCES.nextStep };
  if (taskBriefUnclear(record.site_task_scope)) return sentence;
  if (statusReason === TASK_NOT_NAMED_REASON || selectWebsiteAtlasPreview(record, captureId)?.reason === TASK_NOT_NAMED_REASON) {
    const { jobWaitsForItsSentence } = await import("./jobSentenceWait");
    const { isPlaceholderSummary, TASK_BRIEFS_COLLECTION } = await import("./siteTaskBrief");
    const briefRef = db.collection(TASK_BRIEFS_COLLECTION).doc(requestId);
    const brief = (tx ? await tx.get(briefRef) : await briefRef.get()).data() as { summary?: string | null; confirmedAtIso?: string | null } | undefined;
    if (jobWaitsForItsSentence({ requestId, record, brief: brief ?? null, isPlaceholder: isPlaceholderSummary,
      preparationTaskNotNamed: statusReason === TASK_NOT_NAMED_REASON })) return sentence;
  }
  return null;
}

/** The email for one ask: one short line saying what is needed, and the private link. */
export function buildSiteActionNotification(params: { requestId: string; to: string; ask: SiteAsk; captureUrl?: string }): OutboxInput {
  const url = params.captureUrl ?? captureUploadUrlFor(params.requestId.trim(), "owner");
  return { idempotencyKey: siteActionNoticeKey(params.requestId, params.ask), requestId: params.requestId.trim(), kind: SITE_ACTION_KIND,
    to: params.to, subject: SITE_ACTION_SUBJECT, replyTo: "hello@tryblueprint.io",
    body: finePrintLast(`${params.ask.title}. ${params.ask.nextStep}\n\nOpen your job:\n${url}`) };
}

/** Queue the job's current ask once. Never throws for a job with nothing asked; a repeat of the same ask queues nothing. */
export async function notifySiteActionNeeded(requestId: string, known?: Record<string, any>): Promise<{ enqueued: boolean }> {
  if (!db) return { enqueued: false };
  const record = known ?? (await db.collection("inboundRequests").doc(requestId).get()).data();
  const ask = await currentSiteAsk(requestId, record);
  if (!ask) return { enqueued: false };
  const to = String(await decryptFieldValue(record?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { enqueued: false };
  return enqueueOutbox(buildSiteActionNotification({ requestId, to, ask }));
}

/** At dispatch: the ask this row names is still the job's current ask. */
export async function siteActionNoticeIsCurrent(entry: { requestId: string; idempotencyKey?: string }, tx?: Tx): Promise<boolean> {
  if (!db || !entry.idempotencyKey) return false;
  const ref = db.collection("inboundRequests").doc(entry.requestId);
  const record = (tx ? await tx.get(ref) : await ref.get()).data();
  const ask = await currentSiteAsk(entry.requestId, record, tx);
  return Boolean(ask) && siteActionNoticeKey(entry.requestId, ask!) === entry.idempotencyKey;
}
