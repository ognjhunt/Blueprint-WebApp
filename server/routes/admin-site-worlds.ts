import { Router, Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { resolveLiveSiteWorldContext } from "../utils/site-worlds";
import {
  configuredWorldModel,
  createWorldFromRequestManifest,
  generateWorldFromFrames,
  getWorldLabsOperation,
  getWorldLabsWorld,
  readArtifactJson,
  summarizeWorldLabsPreview,
  writeJsonArtifact,
} from "../utils/worldlabs";
import { loadCaptureFrames } from "../utils/worldlabsFrames";
import type { InboundRequest } from "../types/inbound-request";
import { hasAnyRole } from "../utils/access-control";

const router = Router();

function jsonObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return String(value || "").trim();
}

function providerRunStatusFromPreviewStatus(status: string) {
  switch (status) {
    case "ready":
      return "succeeded";
    case "processing":
      return "processing";
    case "queued":
      return "queued";
    case "failed":
      return "failed";
    default:
      return "not_requested";
  }
}

async function persistWorldLabsState(params: {
  requestId: string;
  request: InboundRequest;
  pipelinePrefix: string;
  requestManifestUri: string;
  requestManifest: Record<string, unknown>;
  operation?: Record<string, unknown> | null;
  world?: Record<string, unknown> | null;
  generationSourceType?: string | null;
}) {
  const nowIso = new Date().toISOString();
  const operationPayload =
    params.operation && Object.keys(params.operation).length > 0
      ? {
          ...params.operation,
          operation_id: asString(params.operation.operation_id || params.operation.id),
          generation_source_type: params.generationSourceType || null,
          updated_at: nowIso,
        }
      : null;
  const worldPayload =
    params.world && Object.keys(params.world).length > 0
      ? {
          ...params.world,
          world_id: asString(params.world.world_id || params.world.id),
          generation_source_type: params.generationSourceType || null,
          updated_at: nowIso,
        }
      : null;

  const operationManifestUri = operationPayload
    ? await writeJsonArtifact({
        pipelinePrefix: params.pipelinePrefix,
        relativePath: "worldlabs/worldlabs_operation_manifest.json",
        payload: operationPayload,
      })
    : null;
  const worldManifestUri = worldPayload
    ? await writeJsonArtifact({
        pipelinePrefix: params.pipelinePrefix,
        relativePath: "worldlabs/worldlabs_world_manifest.json",
        payload: worldPayload,
      })
    : null;

  const worldAssets = jsonObject(worldPayload ? (worldPayload as Record<string, unknown>).assets : undefined);
  const splats = jsonObject(worldAssets.splats);
  const mesh = jsonObject(worldAssets.mesh);
  const imagery = jsonObject(worldAssets.imagery);
  const spzManifestPayload = worldPayload
    ? {
        schema_version: "v1",
        world_id: worldPayload.world_id,
        generated_at: nowIso,
        // Keyed by detail level ("100k" / "500k" / "full_res") by the API. A
        // list is tolerated for manifests written before that was understood.
        spz_urls: Array.isArray(splats.spz_urls) ? splats.spz_urls : jsonObject(splats.spz_urls),
        semantics_metadata: jsonObject(splats.semantics_metadata),
      }
    : null;
  const spzManifestUri = spzManifestPayload
    ? await writeJsonArtifact({
        pipelinePrefix: params.pipelinePrefix,
        relativePath: "worldlabs/worldlabs_spz_manifest.json",
        payload: spzManifestPayload,
      })
    : null;

  const preview = summarizeWorldLabsPreview({
    requestManifest: params.requestManifest,
    operationManifest: operationPayload,
    worldManifest: worldPayload,
    requestManifestUri: params.requestManifestUri,
    operationManifestUri,
    worldManifestUri,
  });

  const currentPipeline = jsonObject(params.request.pipeline);
  const currentArtifacts = jsonObject(currentPipeline.artifacts);
  const currentEvaluationReadiness = jsonObject(params.request.evaluation_readiness);
  const currentProviderRun = jsonObject(currentEvaluationReadiness.provider_run);

  const updatedPipeline = {
    ...currentPipeline,
    artifacts: {
      ...currentArtifacts,
      worldlabs_request_manifest_uri: params.requestManifestUri,
      worldlabs_operation_manifest_uri: operationManifestUri,
      worldlabs_world_manifest_uri: worldManifestUri,
      worldlabs_preview_thumbnail_uri: asString(worldAssets.thumbnail_url) || null,
      worldlabs_preview_pano_uri: asString(imagery.pano_url) || null,
      worldlabs_spz_manifest_uri: spzManifestUri,
      worldlabs_collider_mesh_uri: asString(mesh.collider_mesh_url) || null,
      worldlabs_launch_url: preview?.launchUrl || null,
    },
    synced_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const updatedEvaluationReadiness = {
    ...currentEvaluationReadiness,
    provider_run: {
      ...currentProviderRun,
      provider_name: "world_labs",
      provider_model: preview?.model || asString(params.requestManifest.provider_model),
      provider_run_id: preview?.operationId || "",
      operation_id: preview?.operationId || null,
      world_id: preview?.worldId || null,
      worldlabs_launch_url: preview?.launchUrl || null,
      status: providerRunStatusFromPreviewStatus(preview?.status || "not_requested"),
      preview_manifest_uri: worldManifestUri || operationManifestUri || params.requestManifestUri,
      cost_usd: currentProviderRun.cost_usd ?? null,
      latency_ms: currentProviderRun.latency_ms ?? null,
      failure_reason: preview?.failureReason || null,
      provenance: {
        canonical: false,
        derived: true,
        source: "world_labs",
      },
    },
  };

  await db?.collection("inboundRequests").doc(params.requestId).update({
    pipeline: updatedPipeline,
    evaluation_readiness: updatedEvaluationReadiness,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    preview,
    operationManifestUri,
    worldManifestUri,
    spzManifestUri,
  };
}

async function resolveContext(siteWorldId: string) {
  const context = await resolveLiveSiteWorldContext(siteWorldId);
  if (!context) {
    throw new Error("not_found");
  }
  const pipeline = jsonObject(context.request.pipeline);
  const artifacts = jsonObject(pipeline.artifacts);
  const pipelinePrefix = asString(pipeline.pipeline_prefix);
  const requestManifestUri = asString(artifacts.worldlabs_request_manifest_uri);
  if (!pipelinePrefix || !requestManifestUri) {
    throw new Error("missing_worldlabs_request_manifest");
  }
  const requestManifest = await readArtifactJson(requestManifestUri);
  if (!requestManifest) {
    throw new Error("worldlabs_request_manifest_unreadable");
  }
  return {
    ...context,
    pipelinePrefix,
    artifacts,
    requestManifestUri,
    requestManifest,
  };
}

router.get("/:siteWorldId/worldlabs-preview", async (req: Request, res: Response) => {
  try {
    if (!(await hasAnyRole(res, ["admin", "ops"]))) {
      throw new Error("forbidden");
    }
    const context = await resolveContext(String(req.params.siteWorldId || ""));
    const operationManifestUri = asString(context.artifacts.worldlabs_operation_manifest_uri);
    const worldManifestUri = asString(context.artifacts.worldlabs_world_manifest_uri);
    let operationManifest = await readArtifactJson(operationManifestUri);
    let worldManifest = await readArtifactJson(worldManifestUri);

    const shouldRefresh = String(req.query.refresh || "").trim() === "1";
    const operationId = asString(operationManifest?.operation_id || operationManifest?.id);
    if (shouldRefresh && operationId) {
      operationManifest = await getWorldLabsOperation(operationId);
      const refreshedWorldId = asString(operationManifest.world_id || jsonObject(operationManifest.response).world_id);
      if (refreshedWorldId) {
        worldManifest = await getWorldLabsWorld(refreshedWorldId);
      }
      const persisted = await persistWorldLabsState({
        requestId: context.requestId,
        request: context.request,
        pipelinePrefix: context.pipelinePrefix,
        requestManifestUri: context.requestManifestUri,
        requestManifest: context.requestManifest,
        operation: operationManifest,
        world: worldManifest,
        generationSourceType: asString(context.requestManifest.generation_source_type),
      });
      return res.json({
        ok: true,
        preview: persisted.preview,
        operationManifestUri: persisted.operationManifestUri,
        worldManifestUri: persisted.worldManifestUri,
        spzManifestUri: persisted.spzManifestUri,
      });
    }

    const preview = summarizeWorldLabsPreview({
      requestManifest: context.requestManifest,
      operationManifest,
      worldManifest,
      requestManifestUri: context.requestManifestUri,
      operationManifestUri,
      worldManifestUri,
    });
    return res.json({ ok: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "worldlabs_preview_failed";
    const status = message === "forbidden" ? 403 : message === "not_found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

router.post("/:siteWorldId/worldlabs-preview/generate", async (req: Request, res: Response) => {
  try {
    if (!(await hasAnyRole(res, ["admin", "ops"]))) {
      throw new Error("forbidden");
    }
    const context = await resolveContext(String(req.params.siteWorldId || ""));
    const requestManifest: Record<string, unknown> = {
      ...context.requestManifest,
      provider_model:
        asString(req.body?.model) || asString(context.requestManifest.provider_model) || configuredWorldModel(),
    };
    const generationRequest = jsonObject(requestManifest.generation_request);
    generationRequest.model =
      asString(req.body?.model) || asString(generationRequest.model) || configuredWorldModel();
    requestManifest.generation_request = generationRequest;

    const { operation, generationRequest: submittedRequest, generationSourceType } =
      await createWorldFromRequestManifest(requestManifest);
    const operationId = asString(operation.operation_id || operation.id);
    const worldId = asString(operation.world_id || jsonObject(operation.response).world_id);
    const world = worldId ? await getWorldLabsWorld(worldId) : null;

    await writeJsonArtifact({
      pipelinePrefix: context.pipelinePrefix,
      relativePath: "worldlabs/worldlabs_request_manifest.json",
      payload: {
        ...requestManifest,
        generation_request: submittedRequest,
        operation_id: operationId || null,
        generation_source_type: generationSourceType,
        submitted_at: new Date().toISOString(),
      },
    });

    const persisted = await persistWorldLabsState({
      requestId: context.requestId,
      request: context.request,
      pipelinePrefix: context.pipelinePrefix,
      requestManifestUri: context.requestManifestUri,
      requestManifest: {
        ...requestManifest,
        generation_request: submittedRequest,
        operation_id: operationId || null,
        generation_source_type: generationSourceType,
      },
      operation,
      world,
      generationSourceType,
    });

    return res.json({
      ok: true,
      operationId,
      preview: persisted.preview,
      operationManifestUri: persisted.operationManifestUri,
      worldManifestUri: persisted.worldManifestUri,
      spzManifestUri: persisted.spzManifestUri,
    });
  } catch (error) {
    logger.error({ error }, "World Labs generation request failed");
    const message = error instanceof Error ? error.message : "worldlabs_generation_failed";
    const status = message === "forbidden" ? 403 : message === "not_found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * Generate a world from the capture's extracted frames.
 *
 * This is the path a real site goes through. The video prompt caps at 30
 * seconds, which no useful walkthrough fits inside, so frames are what we
 * actually send — and frames are the same input shape Atlas scales to 100+.
 * How many get sent is the model profile's call, not this route's.
 */
router.post("/:siteWorldId/worldlabs-preview/generate-from-frames", async (req: Request, res: Response) => {
  try {
    if (!(await hasAnyRole(res, ["admin", "ops"]))) {
      throw new Error("forbidden");
    }
    const context = await resolveContext(String(req.params.siteWorldId || ""));

    const framesPrefixUri =
      asString(req.body?.framesPrefixUri) ||
      asString(context.artifacts.capture_frames_prefix_uri) ||
      asString(context.requestManifest.frames_prefix_uri);
    if (!framesPrefixUri) {
      return res.status(400).json({ error: "capture_frames_prefix_missing" });
    }

    const frames = await loadCaptureFrames(framesPrefixUri);
    if (!frames.length) {
      return res.status(400).json({ error: "capture_frames_empty" });
    }

    const model = asString(req.body?.model) || configuredWorldModel();
    const generated = await generateWorldFromFrames({
      frames,
      model,
      // Deliberately not the buyer's site name: that field is an
      // EncryptableString and may carry customer PII, and this value is sent
      // to a third party and shown in their dashboard. The capture id is
      // enough to find the world again.
      displayName: `Blueprint capture ${asString(context.requestManifest.capture_id) || context.requestId}`,
      textPrompt: asString(context.requestManifest.text_prompt) || undefined,
      permission: context.requestManifest.permission,
      assetMetadata: {
        scene_id: context.requestManifest.scene_id,
        capture_id: context.requestManifest.capture_id,
        site_submission_id: context.requestManifest.site_submission_id,
      },
    });

    const operationId = asString(generated.operation.operation_id || generated.operation.id);
    const worldId = asString(
      generated.operation.world_id || jsonObject(generated.operation.response).world_id,
    );
    const world = worldId ? await getWorldLabsWorld(worldId) : null;

    const requestManifest: Record<string, unknown> = {
      ...context.requestManifest,
      provider_model: generated.profile.model,
      generation_request: generated.generationRequest,
      generation_source_type: generated.generationSourceType,
      frames_prefix_uri: framesPrefixUri,
      // The artifact trail records what was sent and what was left behind, so
      // a thin-looking world can be traced back to its frame budget rather
      // than guessed at.
      frame_selection: generated.frameSelection,
      operation_id: operationId || null,
      submitted_at: new Date().toISOString(),
    };

    await writeJsonArtifact({
      pipelinePrefix: context.pipelinePrefix,
      relativePath: "worldlabs/worldlabs_request_manifest.json",
      payload: requestManifest,
    });

    const persisted = await persistWorldLabsState({
      requestId: context.requestId,
      request: context.request,
      pipelinePrefix: context.pipelinePrefix,
      requestManifestUri: context.requestManifestUri,
      requestManifest,
      operation: generated.operation,
      world,
      generationSourceType: generated.generationSourceType,
    });

    return res.json({
      ok: true,
      operationId,
      model: generated.profile.model,
      frameSelection: generated.frameSelection,
      preview: persisted.preview,
      operationManifestUri: persisted.operationManifestUri,
      worldManifestUri: persisted.worldManifestUri,
      spzManifestUri: persisted.spzManifestUri,
    });
  } catch (error) {
    logger.error({ error }, "World Labs frame generation request failed");
    const message = error instanceof Error ? error.message : "worldlabs_generation_failed";
    const status = message === "forbidden" ? 403 : message === "not_found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

router.post("/:siteWorldId/worldlabs-preview/refresh", async (req: Request, res: Response) => {
  void req;
  try {
    if (!(await hasAnyRole(res, ["admin", "ops"]))) {
      throw new Error("forbidden");
    }
    const context = await resolveContext(String(req.params.siteWorldId || ""));
    const operationManifestUri = asString(context.artifacts.worldlabs_operation_manifest_uri);
    const operationManifest = await readArtifactJson(operationManifestUri);
    const operationId = asString(operationManifest?.operation_id || operationManifest?.id);
    if (!operationId) {
      return res.status(400).json({ error: "worldlabs_operation_missing" });
    }

    const refreshedOperation = await getWorldLabsOperation(operationId);
    const worldId = asString(refreshedOperation.world_id || jsonObject(refreshedOperation.response).world_id);
    const world = worldId ? await getWorldLabsWorld(worldId) : null;
    const persisted = await persistWorldLabsState({
      requestId: context.requestId,
      request: context.request,
      pipelinePrefix: context.pipelinePrefix,
      requestManifestUri: context.requestManifestUri,
      requestManifest: context.requestManifest,
      operation: refreshedOperation,
      world,
      generationSourceType: asString(context.requestManifest.generation_source_type),
    });

    return res.json({
      ok: true,
      preview: persisted.preview,
      operationManifestUri: persisted.operationManifestUri,
      worldManifestUri: persisted.worldManifestUri,
      spzManifestUri: persisted.spzManifestUri,
    });
  } catch (error) {
    logger.error({ error }, "World Labs preview refresh failed");
    const message = error instanceof Error ? error.message : "worldlabs_refresh_failed";
    const status = message === "forbidden" ? 403 : message === "not_found" ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

export default router;
