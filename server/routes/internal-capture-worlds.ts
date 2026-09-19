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
import { getBrief } from "../utils/siteTaskBrief";
import { loadWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { loadWebsiteSceneSponsorship, validateWebsiteSponsoredIntake,
  preparationSpendRequest, reserveWebsitePreparationSpend } from "../utils/websiteSceneSponsorship";
import { SCENE_INTAKE_COLLECTION, sceneDigest, sceneIntakeCommand, validateSceneProviderTerms } from "../utils/taskEvaluationSceneIntake";
import {
  enqueueTaskLifecycleNotification,
  reconstructionIsViewable,
} from "../utils/taskLifecycleNotifications";

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
async function persistReconstruction(
  captureId: string,
  record: WorldReconstructionRecord,
  requestId?: string | null,
) {
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
        ...(requestId ? { notification_request_id: requestId } : {}),
        ...(reconstructionIsViewable(record) ? { scene_notification_pending: true } : {}),
        updated_at_iso: record.updatedAtIso,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function notifySceneReady(captureId: string, record: WorldReconstructionRecord) {
  if (!db || !reconstructionIsViewable(record)) return;
  try {
    const snapshot = await db.collection("captureUploadSessions").doc(captureId).get();
    const requestId = String(snapshot.data()?.notification_request_id ?? "").trim();
    if (!requestId) return;
    await enqueueTaskLifecycleNotification({ requestId, milestone: "scene_ready" });
  } catch (error) {
    // The ready record is authoritative and already persisted. A repeated
    // advance call retries this deterministic enqueue without rebuilding it.
    logger.warn({ error, captureId }, "Could not enqueue scene-ready notice");
  }
}

function guard(req: Request, res: Response, next: () => void) {
  const verified = verifyPipelineSyncRequest(req);
  if (!verified.ok) {
    return res.status(verified.status).json({ error: verified.message, code: verified.code });
  }
  next();
}

const previewUrl = z.string().url().max(4000).refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});

// A viewable reconstruction is an earlier milestone than a runnable testbed.
// The Pipeline owns website reconstruction; this callback never buys a world.
router.post("/creator-captures/:captureId/visual-scene", createPipelineSyncRateLimiter(), guard,
  async (req: Request, res: Response) => {
    const parsed = z.object({
      request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/), scene_id: z.string(),
      task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      world_id: z.string().min(1).max(200), operation_id: z.string().min(1).max(200),
      model: z.string().min(1).max(120), launch_url: previewUrl,
      thumbnail_url: previewUrl.nullable(), pano_url: previewUrl.nullable(),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "website_visual_scene_invalid" });
    const body = parsed.data;
    const captureId = String(req.params.captureId);
    if (captureId !== `walkthrough-${body.request_id}` || body.scene_id !== `site-${body.request_id}`)
      return res.status(409).json({ code: "task_context_capture_mismatch" });
    try {
      const brief = await getBrief(body.request_id);
      if (!brief) return res.status(404).json({ code: "task_brief_missing" });
      const context = projectWebsiteTaskContext(brief, await loadWebsiteCaptureRights(body.request_id));
      if (!context.confirmed || context.context_digest !== body.task_context_digest
          || !context.capture_rights.derived_scene_generation_allowed)
        return res.status(409).json({ code: "website_visual_scene_context_changed" });
      if (!db) return res.status(503).json({ code: "website_visual_scene_store_unavailable" });
      const record: WorldReconstructionRecord = {
        state: "ready", operationId: body.operation_id, worldId: body.world_id, model: body.model,
        preview: null, frameSelection: null, blocker: null, failureReason: null, updatedAtIso: new Date().toISOString(),
        assets: { worldId: body.world_id, model: body.model, launchUrl: body.launch_url,
          thumbnailUrl: body.thumbnail_url, panoUrl: body.pano_url, caption: null, spzUrlsByDetail: {},
          colliderMeshUrl: null, splatPlyUrl: null, meshGlbUrl: null, meshExportOperationId: null },
      };
      await persistReconstruction(captureId, record, body.request_id);
      await notifySceneReady(captureId, record);
      res.setHeader("Cache-Control", "no-store");
      return res.json({ state: "ready", world_id: body.world_id, task_context_digest: body.task_context_digest });
    } catch {
      return res.status(503).json({ code: "website_visual_scene_unavailable" });
    }
  });

const sponsoredSceneRequest = z.object({
  schema_version: z.literal("task_evaluation_scene_intake_request.v1"),
  submission_id: z.string(), owner: z.object({ user_id: z.string(), organization_id: z.string() }).strict(),
  source: z.object({ kind: z.literal("gaussian_splat"), binding_id: z.string(), content_digest: z.string() }).strict(),
  task: sceneIntakeCommand.shape.task, execution: sceneIntakeCommand.shape.execution,
  consent: sceneIntakeCommand.shape.consent.extend({ rights_reference: z.string(),
    accepted_by: z.string(), accepted_at_epoch: z.number().finite().positive() }).strict(),
}).strict();

// The Pipeline credential, current site consent and configured Blueprint cap
// authorize preparation. No robot-team payment or site account is required.
for (const operation of ["scene-sponsorship", "prepared-scene", "preparation-spend"] as const) router.post(
  `/creator-captures/:captureId/${operation}`, createPipelineSyncRateLimiter(), guard,
  async (req: Request, res: Response) => {
    const parsed = z.object({ request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
      scene_id: z.string(), ...(operation === "prepared-scene" ? { request: sponsoredSceneRequest } : {}),
      ...(operation === "preparation-spend" ? { spend: preparationSpendRequest } : {}) })
      .strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "website_scene_request_invalid" });
    const { request_id: requestId, scene_id: sceneId } = parsed.data;
    if (req.params.captureId !== `walkthrough-${requestId}` || sceneId !== `site-${requestId}`)
      return res.status(409).json({ code: "task_context_capture_mismatch" });
    try {
      const authority = await loadWebsiteSceneSponsorship(requestId, operation === "scene-sponsorship");
      res.setHeader("Cache-Control", "no-store");
      if (operation === "scene-sponsorship") return res.json(authority);
      if (operation === "preparation-spend") return res.json(await reserveWebsitePreparationSpend(requestId,
        preparationSpendRequest.parse(req.body.spend)));
      const request = sponsoredSceneRequest.parse(req.body.request);
      validateWebsiteSponsoredIntake(request, authority);
      const { accepted_by: _acceptedBy, accepted_at_epoch: _acceptedAt, ...consent } = request.consent;
      const command = { submission_id: request.submission_id, source_session_id: request.submission_id,
        task: request.task, execution: request.execution, consent };
      validateSceneProviderTerms(command);
      if (!db) throw new Error("website_capture_rights_store_unavailable");
      const id = `scene-${sceneDigest({ owner: request.owner, submission_id: request.submission_id }).slice(7)}`;
      const ref = db.collection(SCENE_INTAKE_COLLECTION).doc(id);
      await db.runTransaction(async transaction => {
        const prior = await transaction.get(ref);
        if (prior.exists) {
          if (prior.data()?.request_digest !== sceneDigest(request)) throw new Error("idempotency_conflict");
          return;
        }
        transaction.create(ref, {
          owner_user_id: request.owner.user_id, organization_id: request.owner.organization_id,
          source_session_id: request.submission_id, website_request_id: requestId,
          sponsorship_digest: authority.authority_digest, command, command_digest: sceneDigest(command),
          request, request_digest: sceneDigest(request), state: "forward_pending",
          forward_attempt_count: 0, next_forward_at_ms: 0, created_at_iso: new Date().toISOString(),
        });
      });
      return res.status(202).json({ id, request_digest: sceneDigest(request), state: "forward_pending" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "website_scene_sponsorship_unavailable";
      const known = /^(website_scene_|website_task_context_|source_revoked$|consent_expired$|task_brief_missing$|idempotency_conflict$|provider_terms_not_configured_or_changed$)/.test(code);
      return res.status(known ? 409 : 503).json({ code: known ? code : "website_scene_sponsorship_unavailable" });
    }
  },
);

// Read at preparation time: the owner may have confirmed after uploading.
// The raw upload manifest remains immutable historical capture evidence.
router.post(
  "/creator-captures/:captureId/task-context",
  createPipelineSyncRateLimiter(),
  guard,
  async (req: Request, res: Response) => {
    const parsed = z.object({ request_id: z.string().trim().min(1).max(200),
      scene_id: z.string().trim().min(1).max(220) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "task_context_request_invalid" });
    const { request_id: requestId, scene_id: sceneId } = parsed.data;
    if (req.params.captureId !== `walkthrough-${requestId}` || sceneId !== `site-${requestId}`) {
      return res.status(409).json({ code: "task_context_capture_mismatch" });
    }
    try {
      const brief = await getBrief(requestId);
      if (!brief) return res.status(404).json({ code: "task_brief_missing" });
      res.setHeader("Cache-Control", "no-store");
      return res.json(projectWebsiteTaskContext(brief, await loadWebsiteCaptureRights(requestId)));
    } catch {
      return res.status(503).json({ code: "task_context_unavailable" });
    }
  },
);

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
    if (captureId.startsWith("walkthrough-")) {
      // The extraction trigger already publishes the Pipeline handoff. This
      // older direct path must not buy a second world from unprepared frames.
      return res.status(409).json({
        code: "website_reconstruction_pipeline_owned",
        error: "Website reconstruction follows confirmed task scene preparation in Pipeline.",
      });
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

      await persistReconstruction(captureId, record, parsed.data.site_submission_id);
      await notifySceneReady(captureId, record);
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
      await notifySceneReady(captureId, record);
      return res.status(200).json({ ok: record.state !== "failed", reconstruction: record });
    } catch (error) {
      logger.error({ error, captureId }, "Autonomous world reconstruction failed to advance");
      return res.status(500).json({ error: "World reconstruction could not be advanced" });
    }
  },
);

export default router;
