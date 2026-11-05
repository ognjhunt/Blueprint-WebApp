import { createReadStream } from "node:fs";
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { WEBSITE_ATLAS_REQUEST_ID } from "../utils/websiteAtlasPreview";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import {
  forgetPracticeRunVideos,
  keepSweeping,
  practiceRunVideoFile,
  practiceRunVideoOwner,
  publishedPracticeRunVideo,
  SCREENING_IDENTIFIER,
  SCREENING_VIDEO_ID,
  verifyPracticeRunVideoTicket,
  videoByteRange,
} from "../utils/screeningPracticeRunVideos";

const router = Router();
// Copies an earlier process left behind expire without waiting for someone to watch a video.
keepSweeping();
const unavailable = { error: "This practice-run video is unavailable", code: "screening_practice_run_video_unavailable" };
const notKept = { error: "This practice-run video is no longer kept.", code: "screening_practice_run_video_not_kept" };

/**
 * The job page's video player fetches a practice-run video from here; the site is
 * never offered the file (as the 3D preview's view route, owner decision
 * 2026-10-29). Opening a link directly is refused, a ticket lasts 15 minutes and
 * is bound to the job's owner, and consent, owner and the published video are
 * re-read on every request, including each range the player asks for. When consent or
 * the owner no longer stands, every cached copy of the job's videos goes at once.
 */
router.get("/:requestId/:runId/:candidateId/:file", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { requestId, runId, candidateId, file } = req.params as Record<string, string>;
  const videoId = /^([a-f0-9]{64})\.mp4$/.exec(file)?.[1] ?? "";
  if (req.get("sec-fetch-dest") === "document" || req.get("sec-fetch-mode") === "navigate")
    return res.status(403).json({ error: "Watch practice runs from your job page.", code: "screening_practice_run_video_view_only" });
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || !SCREENING_VIDEO_ID.test(videoId) || !SCREENING_IDENTIFIER.test(runId)
    || !SCREENING_IDENTIFIER.test(candidateId))
    return res.status(404).json(unavailable);
  if (!db) return res.status(503).json({ error: "Practice-run videos are temporarily unavailable" });
  let record: Record<string, any> | undefined;
  try {
    record = (await db.collection("inboundRequests").doc(requestId).get()).data();
  } catch {
    return res.status(503).json({ error: "Practice-run videos are temporarily unavailable" });
  }
  const owner = practiceRunVideoOwner(record);
  const ticketValid = owner !== null
    && verifyPracticeRunVideoTicket(requestId, runId, candidateId, videoId, owner, req.query.expires, req.query.signature);
  const unexpired = Number(req.query.expires) >= Math.floor(Date.now() / 1000);
  // No owner, a lapsed consent, or a live ticket the current owner did not get (the owner changed).
  if (!owner || !projectWebsiteCaptureRights(record).derived_scene_generation_allowed || (!ticketValid && unexpired)) {
    await forgetPracticeRunVideos(requestId).catch(() => undefined);
    return res.status(404).json(unavailable);
  }
  if (!ticketValid) return res.status(404).json(unavailable);
  try {
    const video = await publishedPracticeRunVideo(requestId, runId, candidateId, videoId);
    if (!video) return res.status(404).json(unavailable);
    const path = await practiceRunVideoFile(requestId, video);
    // Consent or the owner may have lapsed while the video was fetched: read them again before serving.
    const current = (await db.collection("inboundRequests").doc(requestId).get()).data();
    if (practiceRunVideoOwner(current) !== owner || !projectWebsiteCaptureRights(current).derived_scene_generation_allowed) {
      await forgetPracticeRunVideos(requestId).catch(() => undefined);
      return res.status(404).json(unavailable);
    }
    const range = videoByteRange(req.get("range"), video.sizeBytes);
    res.set({ "Content-Type": "video/mp4", "Content-Disposition": "inline", "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff" });
    if (range === "invalid") {
      res.set("Content-Range", `bytes */${video.sizeBytes}`);
      return res.status(416).end();
    }
    if (range) {
      res.status(206).set({ "Content-Range": `bytes ${range.start}-${range.end}/${video.sizeBytes}`,
        "Content-Length": String(range.end - range.start + 1) });
    } else res.set("Content-Length", String(video.sizeBytes));
    createReadStream(path, range ?? undefined).on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    if (error instanceof Error && error.message === "screening_practice_run_video_not_kept" && !res.headersSent)
      return res.status(410).json(notKept);
    if (error instanceof Error && error.message === "screening_practice_run_video_forgotten" && !res.headersSent)
      return res.status(404).json(unavailable);
    logger.warn({ error, requestId, runId }, "practice-run video unavailable");
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
