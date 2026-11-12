/**
 * The job's video for an approved deployment company (package E, E3): `GET /api/company-media/jobs/:jobId/video.mp4`.
 *
 * The page's `<video>` element plays it with the ticket in its address (a media element cannot send the account's
 * token); the ticket is bound to the viewer, the job and the capture and lasts 15 minutes. Every request, including
 * every byte range the player asks for, re-reads the whole sharing rule and the viewer's approval
 * (`companyMediaAllowed`) before anything is fetched, then proxies the one range straight through from the Pipeline's
 * signed read (no copy on the website's disk). Opening the address as a page is refused: view only, no download.
 */
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { companyMediaAllowed } from "../utils/companyJobPage";
import { Readable } from "node:stream";
import { companySimulationPipelineRequest, storedCompanySimulation, verifyCompanySimulationTicket } from "../utils/websiteCompanySimulation";
import { fetchCompanyClip, forwardableRange, storedCompanyClip, verifyCompanyClipTicket } from "../utils/websiteCompanyClip";

const router = Router();

router.get("/jobs/:jobId/video.mp4", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const jobId = String(req.params.jobId), captureId = String(req.query.capture ?? ""), viewer = String(req.query.viewer ?? "");
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Watch the video on the job's page.", code: "company_clip_view_only" });
  if (!verifyCompanyClipTicket(jobId, captureId, viewer, req.query.expires, req.query.signature))
    return res.status(404).json({ error: "The video is not available.", code: "company_clip_unavailable" });
  if (!db) return res.status(503).json({ error: "The video is not available right now." });
  try {
    if (!(await companyMediaAllowed(jobId, captureId, viewer)))
      return res.status(404).json({ error: "The video is not available.", code: "company_clip_unavailable" });
    const clip = storedCompanyClip((await db.collection("captureUploadSessions").doc(captureId).get()).data(), captureId);
    if (!clip) return res.status(404).json({ error: "The video is not available.", code: "company_clip_unavailable" });
    const read = await fetchCompanyClip(jobId, clip, forwardableRange(req.get("range")));
    if (!read.ok) {
      if (read.status === 416) {
        if (read.contentRange) res.set("Content-Range", read.contentRange);
        return res.status(416).end();
      }
      if (read.status === 404) return res.status(404).json({ error: "The site's video is not available.", code: "company_clip_unavailable" });
      return res.status(503).json({ error: "The video is not available right now. Try again in a few minutes." });
    }
    res.status(read.status).set({ ...read.headers, "Content-Disposition": "inline" });
    read.body.on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, jobId }, "Company clip unavailable");
    if (!res.headersSent) return res.status(503).json({ error: "The video is not available right now. Try again in a few minutes." });
    res.destroy();
  }
});

/**
 * "Download the simulation" (E9 A): the one download a company is offered. Same ticket rule and the same re-check on
 * every request; the zip is proxied straight through under a neutral file name that names nothing.
 */
router.get("/jobs/:jobId/simulation.zip", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const jobId = String(req.params.jobId), captureId = String(req.query.capture ?? ""), viewer = String(req.query.viewer ?? "");
  if (!verifyCompanySimulationTicket(jobId, captureId, viewer, req.query.expires, req.query.signature))
    return res.status(404).json({ error: "The simulation is not available.", code: "company_simulation_unavailable" });
  if (!db) return res.status(503).json({ error: "The simulation is not available right now." });
  try {
    if (!(await companyMediaAllowed(jobId, captureId, viewer)))
      return res.status(404).json({ error: "The simulation is not available.", code: "company_simulation_unavailable" });
    const reference = storedCompanySimulation((await db.collection("captureUploadSessions").doc(captureId).get()).data(), captureId);
    const origin = reference ? companySimulationPipelineRequest(jobId, reference) : null;
    if (!reference || !origin) return res.status(404).json({ error: "The simulation is not available.", code: "company_simulation_unavailable" });
    const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
    if (response.status !== 200 || !response.body
      || (response.headers.get("x-blueprint-artifact-sha256") && response.headers.get("x-blueprint-artifact-sha256") !== reference.digest)) {
      await response.body?.cancel().catch(() => undefined);
      return res.status(response.status === 404 ? 404 : 503).json({ error: "The simulation is not available right now." });
    }
    res.status(200).set({ "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="blueprint-job-simulation.zip"',
      ...(response.headers.get("content-length") ? { "Content-Length": String(response.headers.get("content-length")) } : {}) });
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, jobId }, "Company simulation unavailable");
    if (!res.headersSent) return res.status(503).json({ error: "The simulation is not available right now." });
    res.destroy();
  }
});

export default router;
