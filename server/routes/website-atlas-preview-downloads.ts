import { Router } from "express";

const router = Router();

/**
 * Owner decision 2026-10-29: Blueprint owns the 3D reconstruction. A site may
 * view its preview but never download it, so even a ticket issued before this
 * change no longer serves the bundle.
 */
router.get("/:requestId/:captureId", (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  return res.status(410).json({ error: "3D previews can be viewed but not downloaded.",
    code: "website_atlas_preview_download_retired" });
});

export default router;
