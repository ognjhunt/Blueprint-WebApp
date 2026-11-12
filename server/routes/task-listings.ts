import { sanitizeTaskThumbnail } from "../utils/taskThumbnail";
import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { LISTING_CONSENT_VERSIONS, listingConsentVersion, taskListingSchema, taskListingDraft } from "../utils/taskListingDetails";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { getBrief } from "../utils/siteTaskBrief";
import { enqueueTaskLifecycleNotification, notifyIfOpenForEvaluations } from "../utils/taskLifecycleNotifications";
import { SUPPORTED_TASK_SCOPE } from "../utils/siteTaskScope";

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
const grantSchema = z.object({ enabled: z.boolean(), consent: z.boolean(), details: taskListingSchema, expectedBriefRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(), thumbnailPng: z.string().max(800_000).nullable().optional(), thumbnailConsent: z.literal(true).optional() }).strict().refine(value => (!value.enabled || value.consent) && (!value.thumbnailPng || value.thumbnailConsent === true));

router.route("/owner/:token")
  .all((req, res, next) => {
    const token = verifyCaptureUploadToken(String(req.params.token));
    if (!token || token.scope !== "owner") return res.status(403).json({ error: "Use the site owner's link to manage the public card." });
    res.locals.requestId = token.requestId;
    next();
  })
  .get(async (_req, res) => {
    if (!db) return res.status(503).json({ error: "Listing unavailable" });
    try {
      const snap = await db.collection("inboundRequests").doc(res.locals.requestId).get();
      if (!snap.exists) return res.status(404).json({ error: "Job not found" });
      res.set("Cache-Control", "no-store");
      const image = await db.collection("taskThumbnails").doc(res.locals.requestId).get();
      const brief = await getBrief(res.locals.requestId);
      return res.json({
        briefRevision: humanDecisionDigest(brief),
        requestId: res.locals.requestId,
        draft: taskListingDraft(brief),
        listing: snap.data()?.public_task_listing ?? null,
        thumbnailPng: image.data()?.pngBase64 ?? null,
      });
    } catch { return res.status(503).json({ error: "Listing unavailable" }); }
  })
  .post(async (req, res) => {
    const parsed = grantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Review the public card and approve its text." });
    // Drafting and publishing the reviewed card are free and distinct grants.
    if (!db) return res.status(503).json({ error: "Listing unavailable" });
    try {
      // Publishing from the job page follows the job's outlook: a card goes live only once the job has an answer, and
      // an outlook that cannot be read for certain is "not yet". Hiding never waits, and a card already live may be
      // edited. The one exception is the start form's explicit sharing consent, which publishes at intake
      // (`inbound-request.ts`), before any answer.
      if (parsed.data.enabled && (await db.collection("inboundRequests").doc(res.locals.requestId).get()).data()?.public_task_listing?.enabled !== true) {
        const { loadJobOutlookDecision, outlookHasAnswer } = await import("../utils/jobOutlook");
        const decision = await loadJobOutlookDecision(res.locals.requestId).catch(() => null);
        if (!decision || !decision.certain || !outlookHasAnswer(decision.outlook))
          return res.status(409).json({ code: "share_waits_for_answer", phase: decision?.outlook.phase ?? "building",
            error: "You can share your job once its job packet is ready." });
      }
      await applyOwnerTaskListing(res.locals.requestId, parsed.data);
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "site_job_not_found") return res.status(404).json({ error: "Site job not found" });
      if (error instanceof Error && error.message === "thumbnail_invalid") return res.status(400).json({ error: "Choose a valid job image and review its crop." });
      if (error instanceof Error && error.message === "task_not_yet_supported") return res.status(409).json({ code: "task_not_yet_supported",
        error: `We have your job and are preparing an evaluation for its kind, so its card cannot go into the job library yet. ${SUPPORTED_TASK_SCOPE}` });
      if (error instanceof Error && error.message === "listing_review_changed") return res.status(409).json({ error: "Your job changed. Reopen its public card and review the changes before publishing." }); return res.status(503).json({ error: "The public card was not saved. Try again." }); }
  });

export type OwnerTaskListingGrant = z.infer<typeof grantSchema>;

/**
 * The owner's grant for the job card, recorded under the card's consent
 * statement version, and what follows it going live. "Manage opportunity
 * sharing" and the job page's "Share my job" both record it here, so consent
 * is recorded one way.
 *
 * No outside company is emailed when the card goes live (frame of 2026-11-12:
 * every approach to an outside company needs the owner's go-ahead, so the
 * automatic "New site job" email to opted-in companies no longer sends). The
 * card is listed in the job library only. The site's own `listing_live` notice
 * and the open-for-evaluations notice still go to the site.
 */
export async function applyOwnerTaskListing(requestId: string, grant: OwnerTaskListingGrant,
  options: { consentVersion?: string } = {}): Promise<{ wentLive: string | null }> {
  const consentVersion = options.consentVersion && LISTING_CONSENT_VERSIONS.includes(options.consentVersion)
    ? options.consentVersion : listingConsentVersion;
  const parsed = grantSchema.safeParse(grant);
  if (!parsed.success) throw new Error("listing_grant_invalid");
  if (!db) throw new Error("listing_unavailable");
  const ref = db.collection("inboundRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.request?.buyerType !== "site_operator") throw new Error("site_job_not_found");
  let thumbnail: ReturnType<typeof sanitizeTaskThumbnail> | null = null;
  try { if (parsed.data.thumbnailPng) thumbnail = sanitizeTaskThumbnail(parsed.data.thumbnailPng); }
  catch { throw new Error("thumbnail_invalid"); }
  const imageRef = db.collection("taskThumbnails").doc(requestId);
  let wentLive: string | null = null;
  await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists) throw new Error("Task removed");
    const brief = await transaction.get(db!.collection("siteTaskBriefs").doc(requestId));
    const revision = humanDecisionDigest(brief.exists ? brief.data() : null);
    if (parsed.data.enabled && ((parsed.data.expectedBriefRevision && parsed.data.expectedBriefRevision !== revision)
      || (current.data()?.public_task_listing?.reviewRequired && parsed.data.expectedBriefRevision !== revision))) throw new Error("listing_review_changed");
    // Card consent is independent of native evaluator coverage. Execution
    // remains held by teamJobAccess until the job can actually be scored.
    const previousDigest = current.data()?.public_task_listing?.thumbnailDigest ?? null;
    wentLive = parsed.data.enabled && current.data()?.public_task_listing?.enabled !== true ? new Date().toISOString() : null;
    transaction.update(ref, {
      public_task_listing: {
      wentLiveIso: wentLive ?? current.data()?.public_task_listing?.wentLiveIso ?? null,
      enabled: parsed.data.enabled, details: parsed.data.details,
      consentVersion: parsed.data.consent ? consentVersion : null, approvedAtIso: parsed.data.consent ? new Date().toISOString() : null,
      reviewRequired: !parsed.data.enabled && current.data()?.public_task_listing?.reviewRequired === true,
      briefRevision: revision,
      approvedBy: "signed_owner_link",
      thumbnailDigest: parsed.data.thumbnailPng === null ? null : thumbnail?.digest ?? previousDigest,
    } });
    if (thumbnail) transaction.set(imageRef, { ...thumbnail, approvedAtIso: new Date().toISOString(), consentVersion: "public-task-thumbnail-v1" });
    else if (parsed.data.thumbnailPng === null) transaction.delete(imageRef);
  });
  // The site hears the moment its card goes live, once per time it is switched on.
  if (wentLive) {
    await enqueueTaskLifecycleNotification({ requestId, milestone: "listing_live", eventId: wentLive })
      .catch(() => undefined);
    // Publishing can be what opens a runnable job to evaluations.
    try { await notifyIfOpenForEvaluations(requestId); } catch { /* best-effort */ }
  }
  return { wentLive };
}

export default router;
