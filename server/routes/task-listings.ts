import { sanitizeTaskThumbnail } from "../utils/taskThumbnail";
import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor, verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { listingConsentVersion, taskListingSchema, taskListingDraft } from "../utils/taskListingDetails";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { getBrief } from "../utils/siteTaskBrief";
import { projectPilotCoordination } from "../utils/pilotCoordination";
import { buildTaskLifecycleNotification, enqueueTaskLifecycleNotification } from "../utils/taskLifecycleNotifications";
import { newJobFanoutIntent } from "../utils/newJobAlerts";
import { enqueueNewTaskAlerts } from "../utils/robotTeamAccessEmails";
import { TERMS_VERSION } from "../../client/src/lib/legalAcceptance";

import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxEntry } from "../utils/captureOutbox";
import { decryptFieldValue } from "../utils/field-encryption";
import { pilotRecommendationEventId } from "../utils/pilotRecommendationNotifications";

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
        recommendation: snap.data()?.pilot_recommendation ?? null,
        booking: snap.data()?.pilot_booking ?? null,
        coordination: projectPilotCoordination(snap.data()),
      });
    } catch { return res.status(503).json({ error: "Listing unavailable" }); }
  })
  .post(async (req, res) => {
    const parsed = grantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Review the public card and approve its text." });
    // Drafting and publishing the reviewed card are free and distinct grants.
    if (!db) return res.status(503).json({ error: "Listing unavailable" });
    try {
      const ref = db.collection("inboundRequests").doc(res.locals.requestId);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.request?.buyerType !== "site_operator") return res.status(404).json({ error: "Site job not found" });
      let thumbnail: ReturnType<typeof sanitizeTaskThumbnail> | null = null;
      try { if (parsed.data.thumbnailPng) thumbnail = sanitizeTaskThumbnail(parsed.data.thumbnailPng); }
      catch { return res.status(400).json({ error: "Choose a valid job image and review its crop." }); }
      const imageRef = db.collection("taskThumbnails").doc(res.locals.requestId);
      let wentLive: string | null = null;
      await db.runTransaction(async transaction => {
        const current = await transaction.get(ref);
        if (!current.exists) throw new Error("Task removed");
        const brief = await transaction.get(db!.collection("siteTaskBriefs").doc(res.locals.requestId));
        const revision = humanDecisionDigest(brief.exists ? brief.data() : null);
        if (parsed.data.enabled && ((parsed.data.expectedBriefRevision && parsed.data.expectedBriefRevision !== revision)
          || (current.data()?.public_task_listing?.reviewRequired && parsed.data.expectedBriefRevision !== revision))) throw new Error("listing_review_changed");
        const previousDigest = current.data()?.public_task_listing?.thumbnailDigest ?? null;
        wentLive = parsed.data.enabled && current.data()?.public_task_listing?.enabled !== true ? new Date().toISOString() : null;
        transaction.update(ref, {
          ...(wentLive ? { newJobAlertFanout: newJobFanoutIntent(wentLive) } : {}),
          public_task_listing: {
          wentLiveIso: wentLive ?? current.data()?.public_task_listing?.wentLiveIso ?? null,
          enabled: parsed.data.enabled, details: parsed.data.details,
          consentVersion: parsed.data.consent ? listingConsentVersion : null, approvedAtIso: parsed.data.consent ? new Date().toISOString() : null,
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
        await enqueueTaskLifecycleNotification({ requestId: res.locals.requestId, milestone: "listing_live", eventId: wentLive })
          .catch(() => undefined);
        // Approved robot teams hear about it too, so a recommendation never waits on a person.
        await enqueueNewTaskAlerts({ requestId: res.locals.requestId, card: parsed.data.details, wentLiveIso: wentLive })
          .catch(() => undefined);
      }
      return res.json({ ok: true });
    } catch (error) { if (error instanceof Error && error.message === "listing_review_changed") return res.status(409).json({ error: "Your job changed. Reopen its public card and review the changes before publishing." }); return res.status(503).json({ error: "The public card was not saved. Try again." }); }
  });

const bookSchema = z.object({ recommendationId: z.string().min(1).max(120), authorized: z.literal(true) }).strict();

/** The existing endpoint records proposal acceptance, not a physical booking. */
router.post("/owner/:token/book", async (req, res) => {
  const token = verifyCaptureUploadToken(String(req.params.token));
  if (!token || token.scope !== "owner") return res.status(403).json({ error: "Use the site owner's link to accept this proposal." });
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Confirm you are authorized to accept this proposal." });
  if (!db) return res.status(503).json({ error: "Acceptance unavailable" });
  const store = db;
  try {
    const ref = store.collection("inboundRequests").doc(token.requestId);
    const bookedAtIso = new Date().toISOString();
    const captureUrl = captureUploadUrlFor(token.requestId, "owner");
    const rows = new Map<string, ReturnType<typeof buildOutboxEntry>>();
    const outcome = await store.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      const record = current.data();
      const recommendation = record?.pilot_recommendation;
      if (!current.exists || !recommendation) return "missing" as const;
      if (recommendation.id !== parsed.data.recommendationId) return "stale" as const;
      if (recommendation.reviewRequired) return "stale" as const;
      const booking = record?.pilot_booking;
      if (booking && booking.recommendationId !== recommendation.id) return "stale" as const;
      const to = String(await decryptFieldValue(record?.contact?.email ?? "")).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return "contact_missing" as const;
      const input = buildTaskLifecycleNotification({ requestId: token.requestId, milestone: "pilot_booked",
        eventId: pilotRecommendationEventId(recommendation.id, to), to, captureUrl,
        detail: !booking || booking.commercialBasis === "invited_beta_free" ? "invited_beta_free" : undefined });
      const intentRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(input.idempotencyKey);
      const intent = await transaction.get(intentRef);
      const legacyKey = `${token.requestId}:pilot_booked:${recommendation.id}`;
      const legacyRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(legacyKey);
      const legacy = await transaction.get(legacyRef);
      const matches = (entry: OutboxEntry, key: string) => entry.idempotencyKey === key
        && entry.requestId === token.requestId && entry.kind === "pilot_booked" && entry.to === to;
      if (intent.exists && !matches(intent.data() as OutboxEntry, input.idempotencyKey)) {
        throw new Error("Booking notification identity conflict");
      }
      const reuseLegacy = legacy.exists && matches(legacy.data() as OutboxEntry, legacyKey);
      const existing = (reuseLegacy ? legacy.data() : intent.data()) as OutboxEntry | undefined;
      // All reads precede writes. Confirmation failure rolls back a new
      // booking; a lost-response retry preserves its price, terms and date.
      if (!booking) transaction.update(ref, { pilot_booking: {
        recommendationId: recommendation.id, amountUsd: 0, termsVersion: TERMS_VERSION, commercialBasis: "invited_beta_free",
        acceptedAtIso: bookedAtIso, acceptedBy: "signed_owner_link", state: "awaiting_coordination",
      } });
      if (!existing) {
        // Old handlers still enqueue this key after their source write. Reserve
        // it atomically when free, including on fresh bookings: an old-handler
        // retry must collide with this intent rather than create a second one.
        // An occupied different-recipient key remains immutable; that recipient
        // correction uses its own bound key and the dispatch source guard.
        const writeInput = legacy.exists ? input : { ...input, idempotencyKey: legacyKey };
        const writeRef = legacy.exists ? intentRef : legacyRef;
        // A Firestore retry may observe a corrected recipient even though the
        // legacy document key stays the same. Never reuse another recipient's
        // cached message merely because its reserved key matches.
        const rowKey = JSON.stringify([writeInput.idempotencyKey, writeInput.to]);
        if (!rows.has(rowKey)) rows.set(rowKey, buildOutboxEntry(writeInput));
        transaction.create(writeRef, rows.get(rowKey)!);
      } else if (existing.status === "cancelled" && existing.attempts === 0) {
        // Only an explicit owner retry can restore a notice cancelled before
        // dispatch when its exact recipient becomes current again.
        transaction.update(reuseLegacy ? legacyRef : intentRef, { status: "pending", lastError: null });
      }
      return "ok" as const;
    });
    if (outcome === "missing") return res.status(404).json({ error: "There is no pilot proposal to accept yet." });
    if (outcome === "stale") return res.status(409).json({ error: "This recommendation has changed. Reopen your job page to see the current one." });
    if (outcome === "contact_missing") return res.status(409).json({ error: "A valid site contact email is needed to confirm acceptance. Contact Blueprint to correct it." });
    return res.json({ ok: true, coordination: projectPilotCoordination((await ref.get()).data()) });
  } catch { return res.status(503).json({ error: "We could not confirm acceptance. Reopen your job page to check before retrying." }); }
});

export default router;
