import { Request, Response, Router } from "express";
import { getPublicSiteWorldById, listPublicSiteWorlds, resolvePublicSiteWorldExplorerAssetPath } from "../utils/site-worlds";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));
  const items = await listPublicSiteWorlds(limit);
  res.json({
    items,
    count: items.length,
  });
});

router.get("/:siteWorldId/explorer-asset", async (req: Request, res: Response) => {
  const filePath = await resolvePublicSiteWorldExplorerAssetPath(
    String(req.params.siteWorldId || ""),
    String(req.query.path || ""),
  );
  if (!filePath) {
    return res.status(404).json({ error: "Explorer asset not found" });
  }
  return res.sendFile(filePath);
});

router.get("/:siteWorldId", async (req: Request, res: Response) => {
  const item = await getPublicSiteWorldById(String(req.params.siteWorldId || ""));
  if (!item) {
    return res.status(404).json({ error: "Site world not found" });
  }
  return res.json(item);
});

export default router;
