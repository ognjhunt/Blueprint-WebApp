/**
 * The job's video for an approved deployment company (package E, E3): `GET /api/company-media/jobs/:jobId/video.mp4`.
 *
 * The page's `<video>` element plays it with the ticket in its address (a media element cannot send the account's
 * token); the ticket is bound to the viewer, the job and the capture and lasts 15 minutes. Every request, including
 * every byte range the player asks for, re-reads the whole sharing rule and the viewer's approval
 * (`companyMediaAllowed`) before anything is fetched, then proxies the one range straight through from the Pipeline's
 * signed read (no copy on the website's disk).
 *
 * What this does NOT do: it does not stop a copy. The ticket is a 15-minute signed URL bound to the job, the capture and
 * the viewer; whoever holds it in that time can fetch the video without signing in, as long as the viewer stays an
 * approved deployment company and the job stays listed (both re-read on every request). A browser's request to open
 * the address as a page is refused and the player hides its download control; both only discourage saving.
 */
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { companyMediaAllowed } from "../utils/companyJobPage";
import { fetchCompanySimulation, storedCompanySimulation, verifyCompanySimulationTicket } from "../utils/websiteCompanySimulation";
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
 * "Download the simulation" (E9 A; `COMPANY_SIMULATION_CONTRACT.md` section 2): the one download a company is offered.
 * Same ticket rule and the same re-check on every request (every range); the zip is proxied straight through as
 * `simulation.zip`, a name that names nothing. A resumed download's range is passed through; the Pipeline's 206 and 416
 * are passed back; its 403 (a configuration fault) is logged and shown as "not available right now".
 */
router.get("/jobs/:jobId/simulation.zip", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const jobId = String(req.params.jobId), captureId = String(req.query.capture ?? ""), viewer = String(req.query.viewer ?? "");
  const unavailable = () => res.status(404).json({ error: "The simulation is not available.", code: "company_simulation_unavailable" });
  if (!verifyCompanySimulationTicket(jobId, captureId, viewer, req.query.expires, req.query.signature)) return unavailable();
  if (!db) return res.status(503).json({ error: "The simulation is not available right now. Try again in a few minutes." });
  try {
    if (!(await companyMediaAllowed(jobId, captureId, viewer))) return unavailable();
    const reference = storedCompanySimulation((await db.collection("captureUploadSessions").doc(captureId).get()).data(), captureId);
    if (!reference) return unavailable();
    const read = await fetchCompanySimulation(jobId, reference, forwardableRange(req.get("range")));
    if (!read.ok) {
      if (read.status === 416) {
        if (read.contentRange) res.set("Content-Range", read.contentRange);
        return res.status(416).end();
      }
      if (read.issuerRefused) logger.error({ jobId, captureId }, "The Pipeline refused the website's signed read of a company simulation");
      if (read.status === 404) return unavailable();
      return res.status(503).json({ error: "The simulation is not available right now. Try again in a few minutes." });
    }
    res.status(read.status).set(read.headers);
    read.body.on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    logger.warn({ error, jobId }, "Company simulation unavailable");
    if (!res.headersSent) return res.status(503).json({ error: "The simulation is not available right now. Try again in a few minutes." });
    res.destroy();
  }
});

export default router;
