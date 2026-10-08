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

import { z } from "zod";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import { accessRecordId, getAccessRecordForEmail } from "../utils/robotTeamEarlyAccess";
import { getRobotTeam } from "../utils/robotTeamRegistry";
import { humanDecisionDigest } from "../utils/human-reply-admission";
const router = Router();
const interestSchema = z.object({ state: z.enum(["interested", "declined", "committed"]),
  inputs: z.string().trim().min(4).max(2000), recommendationId: z.string().max(120).optional(),
  authorized: z.literal(true).optional() }).strict();
router.post("/tasks/:taskId/interest", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const input = interestSchema.safeParse(req.body), user = res.locals.firebaseUser;
  if (!input.success) return res.status(400).json({ error: "Give your decision and the proposal inputs you know." });
  if (!user?.email || user.email_verified !== true) return res.status(403).json({ error: "Use your admitted team's verified account." });
  if (!db) return res.status(503).json({ error: "Job unavailable" });
  try {
    const access = await getAccessRecordForEmail(user.email);
    if (access?.status !== "approved") return res.status(403).json({ error: "Manual team admission is required." });
    const taskId = String(req.params.taskId), ref = db.collection("inboundRequests").doc(taskId);
    const source = (await ref.get()).data(), card = source && projectTaskBrowseCard(taskId, source as InboundRequest);
    if (!card || card.opportunity !== "open") return res.status(409).json({ error: "This job is not open to proposals." });
    const recommendation = source!.pilot_recommendation;
    if (input.data.state === "committed") {
      const team = recommendation && await getRobotTeam(recommendation.teamId);
      if (!input.data.authorized || input.data.recommendationId !== recommendation?.id || recommendation.reviewRequired || !team
        || String(team.accountEmail || team.contactEmail || "").toLowerCase() !== user.email.toLowerCase()) return res.status(409).json({ error: "Confirm only the current proposal for your registered team, with authority for its scope, cost and proposed timing." });
    }
    const row = { ...input.data, email: user.email.toLowerCase(), company: access.company, submittedBy: user.uid,
      ...(input.data.state === "committed" ? { proposalDigest: humanDecisionDigest(recommendation), teamId: recommendation.teamId } : {}),
      updatedAtIso: new Date().toISOString() };
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || humanDecisionDigest(current.public_task_listing) !== humanDecisionDigest(source!.public_task_listing)
        || !projectTaskBrowseCard(taskId, current as InboundRequest)
        || (input.data.state === "committed" && humanDecisionDigest(current.pilot_recommendation) !== row.proposalDigest)) throw new Error("job_changed");
      const interestRef = ref.collection("robotTeamInterest").doc(accessRecordId(user.email!));
      const prior = (await tx.get(interestRef)).data();
      if (prior && humanDecisionDigest({ ...prior, updatedAtIso: null }) === humanDecisionDigest({ ...row, updatedAtIso: null })) return;
      tx.set(interestRef, row);
    });
    return res.json({ ok: true, state: input.data.state, nextAction: input.data.state === "committed" ? "Blueprint must still verify the site's agreement, confirmed date and preparation responsibilities." : "Blueprint will review your inputs. Interest reserves no capacity and creates no physical commitment." });
  } catch { return res.status(409).json({ error: "The job changed or your decision could not be saved. Reopen the job before trying again." }); }
});


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
  } catch { return res.status(503).json({ error: "The job library could not be loaded." }); }
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
      note: "Site search is not open to robot teams. Approved teams see the job cards sites share in the job library." });
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
