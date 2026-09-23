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
import { libraryAccessForRequest } from "../utils/robotTeamLibraryAccess";

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

// Site task cards are for robot teams in early access. Anyone else gets no
// items and the access state, which the page turns into the application.
router.get("/tasks", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  try {
    const access = await libraryAccessForRequest(req);
    if (!access.allowed) return res.json({ items: [], access });
    return res.json({ items: await listTaskBrowseCards(), access });
  } catch { return res.status(503).json({ error: "The task library could not be loaded." }); }
});

/**
 * Site-world records built from site requests carry the site's own name and
 * address, and the site never agreed to show either. They are staff-only.
 * Robot teams see sites through the task cards a site approves (`/tasks`);
 * configured-scene offerings stay public because the Pipeline publishes them
 * as public on purpose.
 */
router.get("/", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));
  const access = await libraryAccessForRequest(req);
  const [siteWorlds, configuredScenes] = await Promise.all([
    access.staff ? listPublicSiteWorlds(limit) : Promise.resolve([]),
    listPublicConfiguredSceneOfferings(limit),
  ]);
  const items = [...configuredScenes, ...siteWorlds].filter(
    (item) => item.dataSource === "pipeline",
  ).slice(0, limit);
  res.set("Vary", "Authorization");
  res.set("Cache-Control", access.staff ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300");
  res.json({
    items,
    count: items.length,
  });
});

router.get("/search", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 100));
  const access = await libraryAccessForRequest(req);
  if (!access.staff) {
    res.set("Vary", "Authorization");
    return res.json({ query: queryString(req.query.q), results: [], count: 0, access,
      note: "Site search is not open to robot teams. Approved teams see the task cards sites share in the task library." });
  }
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
  const access = await libraryAccessForRequest(req);
  const item = access.staff ? await getPublicSiteWorldById(siteWorldId) : null;
  if (!item || item.dataSource !== "pipeline") {
    return res.status(404).json({ error: "Site world not found" });
  }
  return res.json(item);
});

export default router;
