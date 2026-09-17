/**
 * Machine-driven world reconstruction.
 *
 * `admin-site-worlds.ts` exposes the same adapter to an operator who wants to
 * push the button themselves. These routes are the ones nothing human touches:
 * a trigger calls `world/reconstruct` when a capture's frames land, then calls
 * `world/advance` until the world and its files are in hand, and the result is
 * written onto the capture so the Pipeline can pick it up and configure,
 * spawn and run policies against the scene.
 *
 * Authentication is the Pipeline sync credential rather than an admin role,
 * because no session exists on this path.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  createPipelineSyncRateLimiter,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import {
  advanceWorldReconstruction,
  startWorldReconstruction,
  type WorldReconstructionRecord,
} from "../utils/worldReconstruction";
import { buildCaptureFootageReviewer } from "../utils/captureFootageReview";

const router = Router();

const reconstructBody = z
  .object({
    frames_prefix_uri: z.string().trim().min(1).max(1600),
    model: z.string().trim().min(1).max(120).optional(),
    text_prompt: z.string().trim().max(8000).optional(),
    scene_id: z.string().trim().max(200).optional(),
    site_submission_id: z.string().trim().max(200).optional(),
  })
  .strict();

const advanceBody = z
  .object({
    operation_id: z.string().trim().min(1).max(200),
    /**
     * Download formats to produce. Omitted means none: a finished world already
     * carries splats, a collider mesh and a panorama, and the HQ mesh is a slow
     * billed export nobody should get by accident.
     */
    exports: z.array(z.enum(["splat_ply", "mesh_glb"])).max(2).optional(),
    splat_resolution: z.enum(["full_res", "500k", "150k", "100k"]).optional(),
  })
  .strict();

/**
 * Persist the reconstruction state onto the capture.
 *
 * Written under a single key so a reader never sees half a transition, and
 * always with the blocker, so a capture that stalled is distinguishable from
 * one still working.
 */
async function persistReconstruction(captureId: string, record: WorldReconstructionRecord) {
  if (!db) {
    return;
  }
  await db
    .collection("captureUploadSessions")
    .doc(captureId)
    .set(
      {
        world_reconstruction: {
          state: record.state,
          operation_id: record.operationId,
          world_id: record.worldId,
          model: record.model,
          assets: record.assets,
          frame_selection: record.frameSelection,
          blocker: record.blocker,
          failure_reason: record.failureReason,
          updated_at_iso: record.updatedAtIso,
        },
        updated_at_iso: record.updatedAtIso,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

function guard(req: Request, res: Response, next: () => void) {
  const verified = verifyPipelineSyncRequest(req);
  if (!verified.ok) {
    return res.status(verified.status).json({ error: verified.message, code: verified.code });
  }
  next();
}

router.post(
  "/creator-captures/:captureId/world/reconstruct",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = reconstructBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "World reconstruction request is invalid",
        code: "world_reconstruction_request_invalid",
      });
    }
    const captureId = String(req.params.captureId || "").trim();
    if (!captureId) {
      return res.status(400).json({ error: "Capture id is required" });
    }

    try {
      // Read the walkthrough before paying to reconstruct it. Null means no
      // review is possible — the lane is off, or the video is not where we
      // expect — and the call then behaves exactly as it did before the gate
      // existed. A reviewer that is built and then fails is a different thing,
      // and blocks; see `captureReviewGate`.
      const reviewer = parsed.data.site_submission_id
        ? await buildCaptureFootageReviewer({
            requestId: parsed.data.site_submission_id,
            sceneId: parsed.data.scene_id || "",
            captureId,
          })
        : null;

      const record = await startWorldReconstruction({
        framesPrefixUri: parsed.data.frames_prefix_uri,
        model: parsed.data.model,
        textPrompt: parsed.data.text_prompt,
        reviewCapture: reviewer?.review,
        bindingFieldIds: reviewer?.bindingFieldIds,
        // Not the buyer's site name: this is shown in a third party's
        // dashboard, and the capture id is enough to find the world again.
        displayName: `Blueprint capture ${captureId}`,
        assetMetadata: {
          capture_id: captureId,
          scene_id: parsed.data.scene_id || null,
          site_submission_id: parsed.data.site_submission_id || null,
        },
      });

      await persistReconstruction(captureId, record);
      // A blocker is a real outcome the trigger has to see, but it is not a
      // transport error: the call succeeded and the state is recorded.
      return res.status(record.blocker ? 409 : 202).json({ ok: !record.blocker, reconstruction: record });
    } catch (error) {
      logger.error({ error, captureId }, "Autonomous world reconstruction failed to start");
      return res.status(500).json({ error: "World reconstruction could not be started" });
    }
  },
);

router.post(
  "/creator-captures/:captureId/world/advance",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = advanceBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "World advance request is invalid",
        code: "world_advance_request_invalid",
      });
    }
    const captureId = String(req.params.captureId || "").trim();
    if (!captureId) {
      return res.status(400).json({ error: "Capture id is required" });
    }

    try {
      const record = await advanceWorldReconstruction({
        operationId: parsed.data.operation_id,
        exports: parsed.data.exports,
        splatResolution: parsed.data.splat_resolution,
      });

      await persistReconstruction(captureId, record);
      return res.status(200).json({ ok: record.state !== "failed", reconstruction: record });
    } catch (error) {
      logger.error({ error, captureId }, "Autonomous world reconstruction failed to advance");
      return res.status(500).json({ error: "World reconstruction could not be advanced" });
    }
  },
);

export default router;
