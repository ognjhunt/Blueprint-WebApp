import { Request, Response, Router } from "express";
import { searchPublicSiteWorlds } from "../retrieval/siteWorldSearch";
import { getPublicSiteWorldById, listPublicSiteWorlds, resolvePublicSiteWorldExplorerAssetPath } from "../utils/site-worlds";

const router = Router();

function queryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
}

function queryList(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item || "").split(",")).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

router.get("/", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));
  const items = await listPublicSiteWorlds(limit);
  res.json({
    items,
    count: items.length,
  });
});

router.get("/search", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 100));
  const payload = await searchPublicSiteWorlds({
    query: queryString(req.query.q),
    limit,
    filters: {
      category: queryString(req.query.category) || null,
      industry: queryString(req.query.industry) || null,
      city: queryString(req.query.city) || null,
      state: queryString(req.query.state) || null,
      siteType: queryString(req.query.siteType) || null,
      taskLane: queryString(req.query.taskLane) || null,
      objectTags: queryList(req.query.objectTags),
      robot: queryString(req.query.robot) || null,
      availability: queryString(req.query.availability) || null,
      readiness: queryString(req.query.readiness) || null,
      sort: queryString(req.query.sort) as never,
    },
  });
  res.json(payload);
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
