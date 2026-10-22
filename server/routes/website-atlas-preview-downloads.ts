import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { streamVerifiedPipelineArtifact } from "../utils/taskEvaluationResultArtifactProxy";
import {
  downloadableWebsiteAtlasPreview,
  verifyWebsiteAtlasPreviewDownloadTicket,
  WEBSITE_ATLAS_CAPTURE_ID,
  WEBSITE_ATLAS_REQUEST_ID,
  websiteAtlasPreviewBundleRequest,
} from "../utils/websiteAtlasPreview";

const router = Router();
const unavailable = { error: "3D preview download is unavailable" };

/**
 * A short-lived owner ticket, then a fresh read: withdrawn consent or a preview
 * that is no longer ready refuses even a valid ticket. The whole bundle is always
 * fetched and verified against the stored digest and size; Range is not forwarded.
 */
router.get("/:requestId/:captureId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { requestId, captureId } = req.params;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !WEBSITE_ATLAS_CAPTURE_ID.test(captureId)
    || !verifyWebsiteAtlasPreviewDownloadTicket(requestId, captureId, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json({ error: "3D preview store is unavailable" });
  let record: Record<string, any> | undefined;
  try {
    record = (await db.collection("inboundRequests").doc(requestId).get()).data();
  } catch {
    return res.status(503).json({ error: "3D preview store is unavailable" });
  }
  const preview = downloadableWebsiteAtlasPreview(record, captureId);
  if (!preview?.bundle) return res.status(404).json(unavailable);
  const origin = websiteAtlasPreviewBundleRequest(requestId, captureId, preview.bundle.digest);
  if (!origin) return res.status(503).json({ error: "3D preview delivery is not configured", code: "website_atlas_preview_delivery_not_configured" });
  try {
    await streamVerifiedPipelineArtifact({ endpoint: origin.url, headers: origin.headers, req, res,
      expected: { sha256: preview.bundle.digest, size_bytes: preview.bundle.size_bytes }, forwardRange: false,
      label: "3D preview", forcedHeaders: { "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="atlas-preview-${captureId}.zip"` } });
  } catch {
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
