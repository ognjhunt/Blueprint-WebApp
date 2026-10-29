import { createReadStream } from "node:fs";
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "../utils/websiteAtlasPreview";
import {
  verifyWebsiteAtlasPreviewViewTicket,
  viewableWebsiteAtlasPreview,
  websiteAtlasPreviewSplatFile,
} from "../utils/websiteAtlasPreviewView";

const router = Router();
const unavailable = { error: "3D preview is unavailable", code: "website_atlas_preview_unavailable" };

/**
 * Owner decision 2026-10-29: the vendored viewer fetches the splat from here to render
 * it; the site is never offered the file. Opening the link directly is refused, the
 * ticket lasts 15 minutes, and consent and readiness are re-read on every request.
 */
router.get("/:requestId/:captureId/scene.ply", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { requestId, captureId } = req.params;
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Open the 3D preview from your job page.", code: "website_atlas_preview_view_only" });
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    || !verifyWebsiteAtlasPreviewViewTicket(requestId, captureId, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json({ error: "3D preview store is unavailable" });
  let record: Record<string, any> | undefined;
  try {
    record = (await db.collection("inboundRequests").doc(requestId).get()).data();
  } catch {
    return res.status(503).json({ error: "3D preview store is unavailable" });
  }
  const preview = viewableWebsiteAtlasPreview(record, captureId);
  if (!preview?.bundle) return res.status(404).json(unavailable);
  try {
    const file = await websiteAtlasPreviewSplatFile(requestId, captureId, preview.bundle);
    res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" });
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, requestId, captureId }, "3D preview view unavailable");
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
