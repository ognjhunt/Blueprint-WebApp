import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { siteWalkthroughIdentity } from "../utils/siteWalkthrough";
import { fetchDestinationPicture, verifyDestinationPictureTicket } from "../utils/websiteDestinationPicture";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";

const router = Router();
const unavailable = { error: "This picture is unavailable. Open it from your job page.", code: "website_destination_picture_unavailable" };

/**
 * The place question's picture (`websiteDestinationPicture.ts`), for the job's own page only: the ticket names this
 * job, capture and picture and lasts 15 minutes; the job's rights and its current capture are re-read on every
 * request; nothing is cached by the browser or logged beyond the job id.
 */
router.get("/:requestId/:captureId/place.png", async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  const { requestId, captureId } = req.params as Record<string, string>;
  if (!verifyDestinationPictureTicket(requestId, captureId, req.query.digest, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json(unavailable);
  let record: Record<string, any> | undefined;
  try { record = (await db.collection("inboundRequests").doc(requestId).get()).data(); }
  catch { return res.status(503).json(unavailable); }
  if (!record || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed
    || siteWalkthroughIdentity(requestId, record).captureId !== captureId) return res.status(404).json(unavailable);
  try {
    const bytes = await fetchDestinationPicture(requestId, captureId, String(req.query.digest));
    res.set({ "Content-Type": "image/png", "Content-Length": String(bytes.length), "Content-Disposition": "inline" });
    return res.end(bytes);
  } catch (error) {
    logger.warn({ requestId, reason: error instanceof Error ? error.message : "unknown" }, "Destination picture unavailable");
    return res.status(503).json(unavailable);
  }
});

export default router;
