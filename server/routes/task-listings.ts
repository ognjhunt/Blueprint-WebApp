import { sanitizeTaskThumbnail } from "../utils/taskThumbnail";
import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { listingConsentVersion, taskListingSchema } from "../utils/taskListingDetails";
import { csrfProtection } from "../middleware/csrf";

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
const grantSchema = z.object({ enabled: z.boolean(), consent: z.literal(true), details: taskListingSchema, thumbnailPng: z.string().max(800_000).nullable().optional(), thumbnailConsent: z.literal(true).optional() }).strict().refine(value => !value.thumbnailPng || value.thumbnailConsent === true);

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
      if (!snap.exists) return res.status(404).json({ error: "Task not found" });
      res.set("Cache-Control", "no-store");
      const image = await db.collection("taskThumbnails").doc(res.locals.requestId).get();
      return res.json({ listing: snap.data()?.public_task_listing ?? null, thumbnailPng: image.data()?.pngBase64 ?? null });
    } catch { return res.status(503).json({ error: "Listing unavailable" }); }
  })
  .post(async (req, res) => {
    const parsed = grantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Review the public card and approve its text." });
    if (!db) return res.status(503).json({ error: "Listing unavailable" });
    try {
      const ref = db.collection("inboundRequests").doc(res.locals.requestId);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.request?.buyerType !== "site_operator") return res.status(404).json({ error: "Site task not found" });
      let thumbnail: ReturnType<typeof sanitizeTaskThumbnail> | null = null;
      try { if (parsed.data.thumbnailPng) thumbnail = sanitizeTaskThumbnail(parsed.data.thumbnailPng); }
      catch { return res.status(400).json({ error: "Choose a valid task image and review its crop." }); }
      const imageRef = db.collection("taskThumbnails").doc(res.locals.requestId);
      await db.runTransaction(async transaction => {
        const current = await transaction.get(ref);
        if (!current.exists) throw new Error("Task removed");
        const previousDigest = current.data()?.public_task_listing?.thumbnailDigest ?? null;
        transaction.update(ref, { public_task_listing: {
          enabled: parsed.data.enabled, details: parsed.data.details,
          consentVersion: listingConsentVersion, approvedAtIso: new Date().toISOString(),
          approvedBy: "signed_owner_link",
          thumbnailDigest: parsed.data.thumbnailPng === null ? null : thumbnail?.digest ?? previousDigest,
        } });
        if (thumbnail) transaction.set(imageRef, { ...thumbnail, approvedAtIso: new Date().toISOString(), consentVersion: "public-task-thumbnail-v1" });
        else if (parsed.data.thumbnailPng === null) transaction.delete(imageRef);
      });
      return res.json({ ok: true });
    } catch { return res.status(503).json({ error: "The public card was not saved. Try again." }); }
  });

const interestSchema = z.object({
  email: z.string().trim().email().max(320), taskFamily: z.string().trim().max(60),
  region: z.string().trim().max(80), siteType: z.string().trim().max(80),
  mayContact: z.boolean(),
}).strict();
router.post("/interests", csrfProtection, async (req, res) => {
  const parsed = interestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and task preference." });
  if (!db) return res.status(503).json({ error: "Preferences unavailable" });
  try {
    const email = parsed.data.email.toLowerCase();
    const id = createHash("sha256").update(email).digest("hex");
    await db.collection("taskInterests").doc(id).set({ ...parsed.data, email, updatedAtIso: new Date().toISOString() });
    return res.json({ ok: true });
  } catch { return res.status(503).json({ error: "Your preferences were not saved. Try again." }); }
});
export default router;
