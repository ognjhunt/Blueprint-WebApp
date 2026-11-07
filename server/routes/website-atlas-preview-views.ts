import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "../utils/websiteAtlasPreview";
import {
  verifyWebsiteAtlasPreviewViewTicket,
  viewableWebsiteAtlasPreview,
  websiteAtlasPreviewViewerFiles,
} from "../utils/websiteAtlasPreviewView";
import {
  SCENE_PREVIEW_VIEW_SOURCE,
  verifyWebsiteScenePreviewViewTicket,
  viewableWebsiteScenePreview,
  websiteScenePreviewViewerFiles,
} from "../utils/websiteScenePreview";

const router = Router();
const unavailable = { error: "3D preview is unavailable", code: "website_atlas_preview_unavailable" };

/**
 * Owner decision 2026-10-29: the vendored viewer fetches the splat (and its start view)
 * from here to render it; the site is never offered the file. Opening a link directly
 * is refused, the ticket lasts 15 minutes, and consent and readiness are re-read on
 * every request. `source=scene` selects the job page's scene preview (websiteScenePreview.ts)
 * under its own ticket domain, so the viewer and its host page serve both unchanged.
 */
router.get("/:requestId/:captureId/:file(scene.ply|settings.json)", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { requestId, captureId, file: name } = req.params as Record<string, string>;
  const scene = req.query.source === SCENE_PREVIEW_VIEW_SOURCE;
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Open the 3D preview from your job page.", code: "website_atlas_preview_view_only" });
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    || !(scene ? verifyWebsiteScenePreviewViewTicket : verifyWebsiteAtlasPreviewViewTicket)(
      requestId, captureId, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json({ error: "3D preview store is unavailable" });
  let record: Record<string, any> | undefined;
  let session: Record<string, any> | undefined;
  try {
    record = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (scene) session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
  } catch {
    return res.status(503).json({ error: "3D preview store is unavailable" });
  }
  const scenePreview = scene ? viewableWebsiteScenePreview(record, session, captureId) : null;
  const preview = scene ? null : viewableWebsiteAtlasPreview(record, captureId);
  if (scene ? !scenePreview : !preview?.bundle) return res.status(404).json(unavailable);
  try {
    const files = scenePreview ? await websiteScenePreviewViewerFiles(requestId, captureId, scenePreview)
      : await websiteAtlasPreviewViewerFiles(requestId, captureId, preview!.bundle!);
    const file = name === "settings.json" ? files.settings : files.splat;
    // The length drives the viewer's progress bar; without it a large splat shows 100% at once.
    const { size } = await stat(file);
    res.set({ "Content-Type": name === "settings.json" ? "application/json" : "application/octet-stream",
      "Content-Length": String(size), "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" });
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, requestId, captureId }, "3D preview view unavailable");
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
