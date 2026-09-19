import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import { createHash } from "node:crypto";
import { listTaskBrowseCards, projectTaskBrowseCard } from "../utils/taskBrowse";
import { Request, Response, Router } from "express";
import { searchPublicSiteWorlds } from "../retrieval/siteWorldSearch";
import { getPublicSiteWorldById, listPublicSiteWorlds } from "../utils/site-worlds";
import {
  getPublicConfiguredSceneOffering,
  listPublicConfiguredSceneOfferings,
} from "../utils/configuredScenePublicOffering";
import { readConfiguredSceneThumbnail } from "../utils/configuredSceneThumbnail";

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

router.get("/tasks/:taskId/thumbnail", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!db) return res.status(503).end();
  try {
    const id = String(req.params.taskId);
    const snap = await db.collection("inboundRequests").doc(id).get();
    const record = snap.data();
    if (!record || !projectTaskBrowseCard(id, record as InboundRequest)?.thumbnailUrl) return res.status(404).end();
    const image = (await db.collection("taskThumbnails").doc(id).get()).data();
    if (!image || image.consentVersion !== "public-task-thumbnail-v1"
      || image.digest !== record.public_task_listing.thumbnailDigest) return res.status(404).end();
    const bytes = Buffer.from(image.pngBase64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== image.digest) return res.status(404).end();
    return res.type("png").send(bytes);
  } catch { return res.status(503).end(); }
});

router.get("/tasks", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try { return res.json({ items: await listTaskBrowseCards() }); }
  catch { return res.status(503).json({ error: "The task library could not be loaded." }); }
});

router.get("/", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));
  const [siteWorlds, configuredScenes] = await Promise.all([
    listPublicSiteWorlds(limit),
    listPublicConfiguredSceneOfferings(limit),
  ]);
  const items = [...configuredScenes, ...siteWorlds].filter(
    (item) => item.dataSource === "pipeline",
  ).slice(0, limit);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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

router.get("/:siteWorldId/thumbnail", async (req: Request, res: Response) => {
  try {
    const resolved = await getPublicConfiguredSceneOffering(
      String(req.params.siteWorldId || ""),
    );
    if (!resolved) return res.status(404).json({ error: "Public thumbnail not found" });
    const buffer = await readConfiguredSceneThumbnail(
      resolved.offering.presentation.task_thumbnail,
    );
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.type("png");
    return res.send(buffer);
  } catch {
    return res.status(503).json({ error: "Public thumbnail is unavailable" });
  }
});

router.get("/:siteWorldId", async (req: Request, res: Response) => {
  const siteWorldId = String(req.params.siteWorldId || "");
  const configuredScene = await getPublicConfiguredSceneOffering(siteWorldId);
  if (configuredScene?.card) {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json(configuredScene.card);
  }
  const item = await getPublicSiteWorldById(siteWorldId);
  if (!item || item.dataSource !== "pipeline") {
    return res.status(404).json({ error: "Site world not found" });
  }
  return res.json(item);
});

export default router;
