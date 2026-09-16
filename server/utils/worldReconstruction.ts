/**
 * The hands-off path from an uploaded walkthrough to a world the Pipeline can
 * configure a robot against.
 *
 * A capturer is paid to walk a site and upload one video. Nothing after that
 * should need a person:
 *
 *   video uploaded
 *     -> frames extracted        (BlueprintCapture cloud/extract-frames)
 *     -> world generated         (here: start)
 *     -> operation polled        (here: advance)
 *     -> assets exported         (here: advance, on completion)
 *     -> package handed to the Pipeline, which configures the robot, spawns it
 *        and runs policies against the scene
 *
 * The admin routes in `admin-site-worlds.ts` drive the same adapter by hand.
 * This module is what runs without anyone watching, so its job is to be
 * resumable and honest: every step records what it did, a step that cannot
 * proceed says which blocker stopped it rather than looking finished, and
 * calling it twice does not generate a second world.
 *
 * It does not judge whether a *site* is worth reconstructing — that is settled
 * by the gates long before an upload link is issued. What it does now check,
 * when a caller supplies a reviewer, is whether the footage in hand actually
 * shows the task, because the gates cannot screen a video that did not exist
 * when they ran. See `captureReviewGate`.
 */

import { logger } from "../logger";
import {
  exportWorldAsset,
  generateWorldFromFrames,
  getWorldLabsOperation,
  getWorldLabsWorld,
  summarizeWorldLabsPreview,
  type WorldLabsPreviewSummary,
} from "./worldlabs";
import { loadCaptureFrames } from "./worldlabsFrames";
import {
  decideReconstructionFromReview,
  describeReconstructionReview,
} from "./captureReviewGate";
import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";
import type { FrameCandidate } from "./worldModelProfiles";

export type WorldReconstructionState =
  | "generating"
  | "processing"
  | "exporting"
  | "ready"
  | "failed";

/**
 * Everything downstream needs to configure a robot against this scene.
 *
 * Splats are what a human reviews; the collider mesh is what a physics engine
 * loads. Both are kept because the Pipeline needs the geometry and the buyer
 * needs the look, and re-deriving either later costs another export.
 */
export interface WorldAssetPackage {
  worldId: string;
  model: string;
  launchUrl: string | null;
  thumbnailUrl: string | null;
  panoUrl: string | null;
  caption: string | null;
  /** Splat downloads keyed by detail level, straight from the world object. */
  spzUrlsByDetail: Record<string, string>;
  /** Coarse collision geometry that ships with every world. */
  colliderMeshUrl: string | null;
  /** Exported on demand by `advance`. */
  splatPlyUrl: string | null;
  meshGlbUrl: string | null;
  /** Set when an HQ mesh export is still running. */
  meshExportOperationId: string | null;
}

export interface WorldReconstructionRecord {
  state: WorldReconstructionState;
  operationId: string | null;
  worldId: string | null;
  model: string | null;
  preview: WorldLabsPreviewSummary | null;
  assets: WorldAssetPackage | null;
  frameSelection: {
    submittedCount: number;
    consideredCount: number;
    droppedForModelCap: number;
    reconstructImages: boolean;
  } | null;
  blocker: string | null;
  failureReason: string | null;
  updatedAtIso: string;
}

function nowIso() {
  return new Date().toISOString();
}

function blocked(blocker: string, partial: Partial<WorldReconstructionRecord> = {}): WorldReconstructionRecord {
  return {
    state: "failed",
    operationId: null,
    worldId: null,
    model: null,
    preview: null,
    assets: null,
    frameSelection: null,
    failureReason: null,
    ...partial,
    blocker,
    updatedAtIso: nowIso(),
  };
}

export interface StartWorldReconstructionParams {
  /** gs:// prefix holding `index.jsonl` and the frame JPEGs. */
  framesPrefixUri: string;
  /** Model override; omitted means the configured default (Marble today). */
  model?: string | null;
  /** Non-identifying label shown in the provider's dashboard. */
  displayName?: string | null;
  textPrompt?: string | null;
  permission?: unknown;
  assetMetadata?: Record<string, unknown>;
  /** Injectable for tests. Defaults to reading the capture's frame index. */
  loadFrames?: (framesPrefixUri: string) => Promise<FrameCandidate[]>;
  /**
   * Read the walkthrough before paying to reconstruct it.
   *
   * Optional, and absent means no review — which keeps every existing caller,
   * including the iOS capture path, behaving exactly as it did. When supplied
   * it runs after the frames load (free) and before generation (not), and it
   * can only ever stop a reconstruction, never start one.
   *
   * Returning `null` is a failure, not an abstention: a reviewer that was asked
   * and did not answer blocks, because the alternative is spending on footage
   * nothing has confirmed shows the task.
   */
  reviewCapture?: () => Promise<SiteVideoEvidenceOutput | null>;
  /** Gates that bind for this submission, so a contradiction is scored honestly. */
  bindingFieldIds?: readonly string[];
}

/**
 * Kick off generation for a capture whose frames are ready.
 *
 * Returns a record rather than throwing for the expected failures — an empty
 * frame set, a model that is not callable yet — because the caller is a
 * background trigger that needs to write the reason down, not a user who can
 * read a stack trace.
 */
export async function startWorldReconstruction(
  params: StartWorldReconstructionParams,
): Promise<WorldReconstructionRecord> {
  const loadFrames = params.loadFrames || loadCaptureFrames;

  let frames: FrameCandidate[];
  try {
    frames = await loadFrames(params.framesPrefixUri);
  } catch (error) {
    return blocked("capture_frames_unreadable", {
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }

  if (!frames.length) {
    return blocked("capture_frames_empty");
  }

  // The last thing before money moves. Frames are already in our bucket and
  // cost nothing to have loaded; the generation below is billed. So this is
  // where a video that does not show the task gets stopped, rather than after
  // it has produced a scene that looks like a result.
  if (params.reviewCapture) {
    let evidence: SiteVideoEvidenceOutput | null = null;
    try {
      evidence = await params.reviewCapture();
    } catch (error) {
      logger.warn(
        { error, framesPrefixUri: params.framesPrefixUri },
        "Capture footage review failed; holding reconstruction rather than spending",
      );
      evidence = null;
    }

    const review = decideReconstructionFromReview({
      evidence,
      bindingFieldIds: params.bindingFieldIds,
    });

    if (!review.reconstruct) {
      return blocked(review.blocker, {
        failureReason: describeReconstructionReview(review),
      });
    }
  }

  try {
    const generated = await generateWorldFromFrames({
      frames,
      model: params.model,
      displayName: params.displayName,
      textPrompt: params.textPrompt,
      permission: params.permission,
      assetMetadata: params.assetMetadata,
    });

    const operationId = String(
      generated.operation.operation_id || generated.operation.id || "",
    ).trim();

    return {
      state: operationId ? "generating" : "failed",
      operationId: operationId || null,
      worldId: null,
      model: generated.profile.model,
      preview: null,
      assets: null,
      frameSelection: {
        submittedCount: generated.frameSelection.submittedCount,
        consideredCount: generated.frameSelection.consideredCount,
        droppedForModelCap: generated.frameSelection.droppedForModelCap,
        reconstructImages: generated.frameSelection.reconstructImages,
      },
      blocker: operationId ? null : "worldlabs_operation_id_missing",
      failureReason: null,
      updatedAtIso: nowIso(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A model we have not been given access to yet is a configuration state,
    // not a broken capture, and is worth naming separately so it does not read
    // as a failed walkthrough.
    const blocker = message.startsWith("worldlabs_model_unavailable")
      ? "worldlabs_model_unavailable"
      : "worldlabs_generation_failed";
    return blocked(blocker, { failureReason: message });
  }
}

function assetPackageFromWorld(
  world: Record<string, unknown>,
  preview: WorldLabsPreviewSummary,
): WorldAssetPackage {
  return {
    worldId: preview.worldId || String(world.world_id || world.id || ""),
    model: preview.model || "",
    launchUrl: preview.launchUrl ?? null,
    thumbnailUrl: preview.thumbnailUrl ?? null,
    panoUrl: preview.panoUrl ?? null,
    caption: preview.caption ?? null,
    spzUrlsByDetail: preview.spzUrlsByDetail || {},
    colliderMeshUrl: preview.colliderMeshUrl ?? null,
    splatPlyUrl: null,
    meshGlbUrl: null,
    meshExportOperationId: null,
  };
}

/** Downloadable formats a caller can ask for once a world exists. */
export type WorldExportFormat =
  /** Gaussian-splat PLY. Synchronous and cached, so it settles immediately. */
  | "splat_ply"
  /** Textured triangle mesh. Asynchronous, slow, and billed per export. */
  | "mesh_glb";

export interface AdvanceWorldReconstructionParams {
  operationId: string;
  /**
   * Extra formats to export. Empty by default, and deliberately so.
   *
   * A finished world already carries splats, a collider mesh and a panorama,
   * which is everything needed to start evaluating. The two formats here are
   * *download conveniences*: the PLY is cheap but redundant with the splats,
   * and the HQ mesh is asynchronous, documented at up to an hour, and billed
   * per export.
   *
   * Requesting both on every capture put a slow paid artifact nobody had asked
   * for in the blocking path of every reconstruction. Now a caller that wants a
   * file asks for it, and the critical path stops at the world existing.
   */
  exports?: readonly WorldExportFormat[];
  /** PLY resolution to convert. full_res unless a caller wants it cheaper. */
  splatResolution?: "full_res" | "500k" | "150k" | "100k";
}

/**
 * Poll a running generation and, once the world exists, pull the files out.
 *
 * Safe to call repeatedly — that is how a background trigger uses it. The PLY
 * splat export is synchronous and cached, so re-requesting it costs nothing;
 * the HQ mesh export is an async job, so its operation id is recorded and the
 * caller is told it is still running rather than being handed a null URL with
 * no explanation.
 */
export async function advanceWorldReconstruction(
  params: AdvanceWorldReconstructionParams,
): Promise<WorldReconstructionRecord> {
  let operation: Record<string, unknown>;
  try {
    operation = await getWorldLabsOperation(params.operationId);
  } catch (error) {
    return blocked("worldlabs_operation_unreadable", {
      operationId: params.operationId,
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }

  const metadata =
    operation.metadata && typeof operation.metadata === "object"
      ? (operation.metadata as Record<string, unknown>)
      : {};
  const response =
    operation.response && typeof operation.response === "object"
      ? (operation.response as Record<string, unknown>)
      : {};
  const worldId = String(
    metadata.world_id || response.world_id || operation.world_id || "",
  ).trim();

  if (!operation.done) {
    const preview = summarizeWorldLabsPreview({ operationManifest: operation });
    return {
      state: "processing",
      operationId: params.operationId,
      worldId: worldId || null,
      model: preview.model ?? null,
      preview,
      assets: null,
      frameSelection: null,
      blocker: null,
      failureReason: null,
      updatedAtIso: nowIso(),
    };
  }

  if (operation.error || !worldId) {
    const preview = summarizeWorldLabsPreview({ operationManifest: operation });
    return {
      state: "failed",
      operationId: params.operationId,
      worldId: worldId || null,
      model: preview.model ?? null,
      preview,
      assets: null,
      frameSelection: null,
      blocker: worldId ? "worldlabs_generation_failed" : "worldlabs_world_id_missing",
      failureReason: preview.failureReason ?? null,
      updatedAtIso: nowIso(),
    };
  }

  let world: Record<string, unknown>;
  try {
    world = await getWorldLabsWorld(worldId);
  } catch (error) {
    return blocked("worldlabs_world_unreadable", {
      operationId: params.operationId,
      worldId,
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }

  // `worlds/{id}` answers with the world nested under `world`; tolerate both.
  const worldObject =
    world.world && typeof world.world === "object"
      ? (world.world as Record<string, unknown>)
      : world;

  const preview = summarizeWorldLabsPreview({
    operationManifest: operation,
    worldManifest: worldObject,
  });
  const assets = assetPackageFromWorld(worldObject, preview);

  const requestedExports = params.exports ?? [];
  if (!requestedExports.length) {
    return {
      state: "ready",
      operationId: params.operationId,
      worldId,
      model: preview.model ?? null,
      preview,
      assets,
      frameSelection: null,
      blocker: null,
      failureReason: null,
      updatedAtIso: nowIso(),
    };
  }

  let exportBlocker: string | null = null;

  // Splat PLY: synchronous and cached, so this settles on the first call.
  if (requestedExports.includes("splat_ply")) {
  try {
    const splatExport = await exportWorldAsset({
      worldId,
      assetType: "splats",
      format: "ply",
      resolution: params.splatResolution || "full_res",
    });
    assets.splatPlyUrl = exportedAssetUrl(splatExport);
  } catch (error) {
    exportBlocker = "worldlabs_splat_export_failed";
    assets.splatPlyUrl = null;
    void error;
  }
  }

  // HQ mesh GLB: a real async job. Record the operation and report honestly
  // that it is still running rather than implying we have the file.
  if (requestedExports.includes("mesh_glb")) {
  try {
    const meshExport = await exportWorldAsset({
      worldId,
      assetType: "mesh",
      format: "glb",
      meshVariant: "textured",
    });
    const meshUrl = exportedAssetUrl(meshExport);
    if (meshUrl) {
      assets.meshGlbUrl = meshUrl;
    } else {
      assets.meshExportOperationId =
        String(meshExport.operation_id || meshExport.id || "").trim() || null;
    }
  } catch (error) {
    exportBlocker = exportBlocker || "worldlabs_mesh_export_failed";
    void error;
  }
  }

  const exportsSettled = requestedExports.every((format) =>
    format === "splat_ply" ? Boolean(assets.splatPlyUrl) : Boolean(assets.meshGlbUrl),
  );

  return {
    state: exportsSettled ? "ready" : "exporting",
    operationId: params.operationId,
    worldId,
    model: preview.model ?? null,
    preview,
    assets,
    frameSelection: null,
    // The collider mesh ships with every world, so the Pipeline always has
    // geometry to work with even while the HQ mesh is still exporting.
    blocker: exportBlocker,
    failureReason: null,
    updatedAtIso: nowIso(),
  };
}

/** Pull the download URL out of an export response, whichever shape it takes. */
function exportedAssetUrl(payload: Record<string, unknown>): string | null {
  const direct = String(payload.url || "").trim();
  if (direct) {
    return direct;
  }
  const response =
    payload.response && typeof payload.response === "object"
      ? (payload.response as Record<string, unknown>)
      : null;
  if (response) {
    const nested = String(response.url || "").trim();
    if (nested) {
      return nested;
    }
    const result =
      response.result && typeof response.result === "object"
        ? (response.result as Record<string, unknown>)
        : null;
    if (result) {
      const resultUrl = String(result.url || "").trim();
      if (resultUrl) {
        return resultUrl;
      }
    }
  }
  return null;
}
