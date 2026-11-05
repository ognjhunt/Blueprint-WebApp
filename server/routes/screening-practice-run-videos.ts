import { createReadStream } from "node:fs";
import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { WEBSITE_ATLAS_REQUEST_ID } from "../utils/websiteAtlasPreview";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import {
  forgetPracticeRunVideo,
  practiceRunVideoFile,
  practiceRunVideoOwner,
  publishedPracticeRunVideo,
  SCREENING_IDENTIFIER,
  SCREENING_VIDEO_ID,
  verifyPracticeRunVideoTicket,
  videoByteRange,
} from "../utils/screeningPracticeRunVideos";

const router = Router();
const unavailable = { error: "This practice-run video is unavailable", code: "screening_practice_run_video_unavailable" };

/**
 * The job page's video player fetches a practice-run video from here; the site is
 * never offered the file (as the 3D preview's view route, owner decision
 * 2026-10-29). Opening a link directly is refused, a ticket lasts 15 minutes and
 * is bound to the job's owner, and consent, owner and the published video are
 * re-read on every request, including each range the player asks for.
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
  if (!owner || !verifyPracticeRunVideoTicket(requestId, runId, candidateId, videoId, owner, req.query.expires, req.query.signature))
    return res.status(404).json(unavailable);
  if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) {
    await forgetPracticeRunVideo(videoId).catch(() => undefined);
    return res.status(404).json(unavailable);
  }
  try {
    const video = await publishedPracticeRunVideo(requestId, runId, candidateId, videoId);
    if (!video) return res.status(404).json(unavailable);
    const path = await practiceRunVideoFile(requestId, video);
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
    logger.warn({ error, requestId, runId }, "practice-run video unavailable");
    if (!res.headersSent) return res.status(503).json(unavailable);
    res.destroy();
  }
});

export default router;
