/**
 * "Your job needs something from you" (owner, 2026-11-19): the one site email for a job that cannot continue without
 * the site, sent exactly when its job page shows a blocking ask (an outcome whose step is the site's, or the naming
 * form), and only then: a new video (too large to process, or one the Pipeline cannot build from), or the job's one
 * sentence. Never a status or progress email, never after a withdrawal or the site closing the job, and never for an
 * ending (a window or no-grant ending, a terminal scene outcome, the $40 cap's `spending_cap_reached`).
 *
 * The first video is the one ask the job link email already carries, so it is asked again once, a day into the site's
 * week (owner, 2026-11-20): the reminder, with the date the job stays open until.
 *
 * One short line saying what is needed, and the private link. Once per distinct ask: the outbox document id names the
 * job, the capture and the ask's own words, so the same ask is never sent twice, whatever the trigger. Read again at
 * dispatch by the same rule: an ask that no longer stands is cancelled, never sent. The sweep of every site job and
 * each new preparation status bring it; nothing else does.
 */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, type OutboxInput } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { finePrintLast } from "./emailLayout";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { websiteRunClosure } from "./websiteRunClosure";
import { atlasPreviewReachedSpendingCap, selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { noGrantClockEndsAtEpoch, recordedWebsiteJobNoGrantEnding, recordedWebsiteJobWindowEnding,
  websiteJobNoGrantClock } from "./websiteJobWindowEnding";
import { largeVideoAskOutcome, projectAtlasPreparationOutcome, TASK_NOT_NAMED_SENTENCES } from "./taskPreparationOutcome";
import { pageAskedOutcome, safeSceneViewUrl } from "./taskStatusProjection";

export const SITE_ACTION_KIND = "site_action_needed" as const;
export const SITE_ACTION_SUBJECT = "Your job needs something from you";
/** One ask the job page makes of the site: its key names the capture and the ask; its words are the page's own. */
export type SiteAsk = { key: string; title: string; nextStep: string };
type Tx = FirebaseFirestore.Transaction;

const keyPart = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
export const siteActionNoticeKey = (requestId: string, ask: Pick<SiteAsk, "key">) =>
  `${requestId.trim()}:${SITE_ACTION_KIND}:${keyPart(ask.key)}`;

/** How long into the site's wait for its first video the one reminder goes: a day, after the job link email. */
export const FIRST_VIDEO_REMINDER_AFTER_SECONDS = 86400;
export const FIRST_VIDEO_REMINDER_TITLE = "Your job is waiting for its video";
/** The reminder's next step, with the day the job stays open until (UTC, as every date in a site email). */
export const firstVideoReminderNextStep = (endsAtEpoch: number) => "Film or upload one full round of the job from "
  + `this link. Your job stays open until ${new Date(endsAtEpoch * 1000).toLocaleDateString("en-US",
    { month: "long", day: "numeric", timeZone: "UTC" })}.`;

/** One ask, keyed by the capture and the ask's own words: the same ask is the same key, another ask another. */
function askOf(captureId: string, title: string, nextStep: string): SiteAsk {
  return { key: `${captureId}.${createHash("sha256").update(`${title}\n${nextStep}`).digest("hex").slice(0, 16)}`, title, nextStep };
}

/**
 * What the job cannot continue without, from the site, now: exactly what its job page asks (one source of truth), or
 * null. The naming form by the page's own predicate (`taskStatementNeeded`); else the outcome the page states
 * (`pageAskedOutcome`) from the Pipeline's preparation status, verified current for this source and task context
 * (`loadCurrentWebsitePreparationStatus`, so a failure retained for an earlier context asks nothing), and from the job's
 * own record, when that outcome's step is the site's. Null after a withdrawal, the site closing the job, or an ending.
 */
export async function currentSiteAsk(requestId: string, record: Record<string, any> | null | undefined, tx?: Tx,
  nowMs = Date.now()): Promise<SiteAsk | null> {
  if (!db || !record || record.capture_withdrawal) return null;
  const rights = projectWebsiteCaptureRights(record);
  if (rights.consent_revoked) return null;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  try { if (websiteRunClosure(record, requestId, captureId)) return null; } catch { return null; }
  // A job that has ended (its window or no-grant clock, a terminal scene outcome, the $40 spending cap) asks nothing:
  // its page states the ending, and nothing the site sends would start it again.
  const preview = rights.derived_scene_generation_allowed ? selectWebsiteAtlasPreview(record, captureId) : null;
  if (recordedWebsiteJobWindowEnding(record) || recordedWebsiteJobNoGrantEnding(record, requestId)
    || atlasPreviewReachedSpendingCap(preview)) return null;
  const { readWebsiteSceneProgression } = await import("./websiteSceneProgression");
  const sceneProgression = await readWebsiteSceneProgression(requestId, captureId);
  if (sceneProgression?.sceneOutcome?.terminal) return null;
  const { getBrief, isPlaceholderSummary } = await import("./siteTaskBrief");
  const brief = await getBrief(requestId);
  const { taskStatementNeeded } = await import("./jobSentenceWait");
  if (await taskStatementNeeded(requestId, record, brief)) {
    return askOf(captureId, TASK_NOT_NAMED_SENTENCES.title, TASK_NOT_NAMED_SENTENCES.nextStep);
  }
  const sessionRef = db.collection("captureUploadSessions").doc(captureId);
  const session = (tx ? await tx.get(sessionRef) : await sessionRef.get()).data();
  const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
  const preparationStatus = session?.website_preparation ? await loadCurrentWebsitePreparationStatus(requestId, captureId) : null;
  const reconstruction = session?.world_reconstruction as { state?: string; assets?: { launchUrl?: unknown; panoUrl?: unknown } } | undefined;
  const outcome = pageAskedOutcome({ preparationStatus,
    preparationOutcome: largeVideoAskOutcome(record, requestId, captureId) ?? projectAtlasPreparationOutcome(preview),
    scenePreviewReady: reconstruction?.state === "ready"
      && Boolean(safeSceneViewUrl(reconstruction.assets?.launchUrl) || safeSceneViewUrl(reconstruction.assets?.panoUrl)),
    sceneProgression: preparationStatus?.state === "handed_off" ? sceneProgression : null,
    siteNamedTask: Boolean(brief) && !isPlaceholderSummary(brief!.summary) });
  if (outcome?.actionOwner === "site") return askOf(captureId, outcome.title, outcome.nextStep);
  if (outcome) return null;
  return firstVideoReminder(requestId, record, captureId, nowMs);
}

/**
 * The page's "A video of the job is the next step", asked again once: while the site's clock for this capture has run
 * a day and no recording is saved. The ask names the clock's end, so it is fixed for the clock and sent once.
 */
async function firstVideoReminder(requestId: string, record: Record<string, any>, captureId: string, nowMs: number): Promise<SiteAsk | null> {
  if (record.website_scene_sponsorship) return null;
  const clock = websiteJobNoGrantClock(record, requestId);
  if (!clock || clock.waiting_on !== "site" || (clock.capture_id !== undefined && clock.capture_id !== captureId)) return null;
  const nowEpoch = Math.floor(nowMs / 1000);
  const endsAt = noGrantClockEndsAtEpoch(clock);
  if (nowEpoch < clock.since_epoch + FIRST_VIDEO_REMINDER_AFTER_SECONDS || nowEpoch >= endsAt) return null;
  const { savedWalkthrough } = await import("./siteWalkthrough");
  const walkthrough = await savedWalkthrough(siteWalkthroughIdentity(requestId, record));
  if (!walkthrough || walkthrough.received) return null;
  return askOf(captureId, FIRST_VIDEO_REMINDER_TITLE, firstVideoReminderNextStep(endsAt));
}

/** The email for one ask: one short line saying what is needed, and the private link. */
export function buildSiteActionNotification(params: { requestId: string; to: string; ask: SiteAsk; captureUrl?: string }): OutboxInput {
  const url = params.captureUrl ?? captureUploadUrlFor(params.requestId.trim(), "owner");
  return { idempotencyKey: siteActionNoticeKey(params.requestId, params.ask), requestId: params.requestId.trim(), kind: SITE_ACTION_KIND,
    to: params.to, subject: SITE_ACTION_SUBJECT, replyTo: "hello@tryblueprint.io",
    body: finePrintLast(`${params.ask.title}. ${params.ask.nextStep}\n\nOpen your job:\n${url}`) };
}

/** Queue the job's current ask once. Never throws for a job with nothing asked; a repeat of the same ask queues nothing. */
export async function notifySiteActionNeeded(requestId: string, known?: Record<string, any>,
  nowMs = Date.now()): Promise<{ enqueued: boolean }> {
  if (!db) return { enqueued: false };
  const record = known ?? (await db.collection("inboundRequests").doc(requestId).get()).data();
  const ask = await currentSiteAsk(requestId, record, undefined, nowMs);
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
