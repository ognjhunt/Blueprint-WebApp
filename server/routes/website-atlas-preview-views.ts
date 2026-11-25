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
  SCENE_PREVIEW_ADMIN_VIEWER,
  SCENE_PREVIEW_VIEW_SOURCE,
  adminViewableWebsiteScenePreview,
  verifyWebsiteScenePreviewAdminViewTicket,
  verifyWebsiteScenePreviewCompanyViewTicket,
  verifyWebsiteScenePreviewViewTicket,
  viewableWebsiteScenePreview,
  websiteScenePreviewViewerFiles,
} from "../utils/websiteScenePreview";
import { recordSimulationUse } from "../utils/simulationUse";

const router = Router();
const unavailable = { error: "3D preview is unavailable", code: "website_atlas_preview_unavailable" };

/**
 * Owner decision 2026-10-29: the vendored viewer fetches the splat (and its start view)
 * from here to render it; the site is never offered the file. Opening a link directly
 * is refused, the ticket lasts 15 minutes, and consent and readiness are re-read on
 * every request. `source=scene` selects the job page's scene preview (websiteScenePreview.ts)
 * under its own ticket domain, so the viewer and its host page serve both unchanged. A ticket the admin job console
 * mints (`admin=1`) is served on the site's own rule, and refused once the site has withdrawn.
 */
router.get("/:requestId/:captureId/:file(scene.ply|settings.json)", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { requestId, captureId, file: name } = req.params as Record<string, string>;
  const scene = req.query.source === SCENE_PREVIEW_VIEW_SOURCE;
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Open the 3D preview from your job page.", code: "website_atlas_preview_view_only" });
  // A company's ticket (package E, E3) names its viewer; an admin's (the job console) is marked `admin=1` and names no
  // one; the site's own ticket carries neither. Each verifies only under its own domain; a ticket carrying both
  // markers, or any other admin marker, is refused.
  const companyViewer = scene && req.query.viewer !== undefined ? String(req.query.viewer) : null;
  const adminMarked = scene && req.query.admin !== undefined;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    || (companyViewer !== null && adminMarked)
    || (adminMarked && req.query.admin !== SCENE_PREVIEW_ADMIN_VIEWER)
    || !(companyViewer !== null
      ? verifyWebsiteScenePreviewCompanyViewTicket(requestId, captureId, companyViewer, req.query.expires, req.query.signature)
      : adminMarked
        ? verifyWebsiteScenePreviewAdminViewTicket(requestId, captureId, req.query.expires, req.query.signature)
        : (scene ? verifyWebsiteScenePreviewViewTicket : verifyWebsiteAtlasPreviewViewTicket)(
          requestId, captureId, req.query.expires, req.query.signature)))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json({ error: "3D preview store is unavailable" });
  let record: Record<string, any> | undefined;
  let session: Record<string, any> | undefined;
  try {
    record = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (scene) session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
    // Every company request re-reads the whole sharing rule and the company's approval, and the capture must still be
    // the job's current one.
    if (companyViewer !== null) {
      const refusal = await (await import("../utils/companyJobPage")).companyMediaRefusal(requestId, captureId, companyViewer, record);
      if (refusal === "terms_acceptance_required") return res.status(403).json({ code: refusal,
        error: "Before you see jobs, read and agree to our Terms and Privacy Policy." });
      if (refusal) return res.status(404).json(unavailable);
    }
  } catch {
    return res.status(503).json({ error: "3D preview store is unavailable" });
  }
  const scenePreview = !scene ? null : adminMarked ? adminViewableWebsiteScenePreview(record, session, captureId)
    : viewableWebsiteScenePreview(record, session, captureId);
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
    // The owner's count of viewer opens (`simulationUse.ts`): a company's viewer loading the scene; never waited for.
    if (companyViewer !== null && name === "scene.ply" && req.method === "GET") recordSimulationUse(requestId, companyViewer, "viewer_open");
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, requestId, captureId }, "3D preview view unavailable");
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
