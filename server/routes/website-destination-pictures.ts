import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { siteWalkthroughIdentity } from "../utils/siteWalkthrough";
import { fetchDestinationPicture, verifyDestinationPictureTicket } from "../utils/websiteDestinationPicture";
import { loadCurrentTaskTargetChoiceQuestion } from "../utils/websitePreparationStatus";
import { websiteRunClosure } from "../utils/websiteRunClosure";
import { projectWebsiteCaptureRights } from "../utils/websiteCaptureRights";

const router = Router();
const unavailable = { error: "This picture is unavailable. Open it from your job page.", code: "website_destination_picture_unavailable" };

/**
 * The place question's picture (`websiteDestinationPicture.ts`), for the job's own page only, at least as guarded as
 * the scene preview's view route (`website-atlas-preview-views.ts`): opened only by the page, never as a tab; the
 * ticket names this job, capture and picture and lasts 15 minutes; on every request the job's rights, its current
 * capture, its run not closed, and its CURRENT place question (whose picture must be this one) are read again; the
 * bytes are checked against the digest; nothing is cached by the browser, and nothing but the job id is logged.
 */
router.get("/:requestId/:captureId/place.png", async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Open this picture from your job page.", code: "website_destination_picture_view_only" });
  const { requestId, captureId } = req.params as Record<string, string>;
  if (!verifyDestinationPictureTicket(requestId, captureId, req.query.digest, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  const digest = String(req.query.digest);
  if (!db) return res.status(503).json(unavailable);
  let record: Record<string, any> | undefined;
  try { record = (await db.collection("inboundRequests").doc(requestId).get()).data(); }
  catch { return res.status(503).json(unavailable); }
  if (!record || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed
    || siteWalkthroughIdentity(requestId, record).captureId !== captureId) return res.status(404).json(unavailable);
  // A closed run stops the picture at once, whatever ticket was issued before.
  try { if (websiteRunClosure(record, requestId, captureId)) return res.status(404).json(unavailable); }
  catch { return res.status(404).json(unavailable); }
  // The question must still be the current one, with this picture: a replaced or withdrawn one's is not served.
  try {
    const current = await loadCurrentTaskTargetChoiceQuestion(requestId, captureId);
    if (current?.question.kind !== "task_destination_choice" || current.question.picture?.png_sha256 !== digest)
      return res.status(404).json(unavailable);
  } catch { return res.status(503).json(unavailable); }
  try {
    const bytes = await fetchDestinationPicture(requestId, captureId, digest);
    res.set({ "Content-Type": "image/png", "Content-Length": String(bytes.length), "Content-Disposition": "inline" });
    return res.end(bytes);
  } catch (error) {
    logger.warn({ requestId, reason: error instanceof Error ? error.message : "unknown" }, "Destination picture unavailable");
    return res.status(503).json(unavailable);
  }
});

export default router;
