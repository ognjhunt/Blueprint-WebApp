/**
 * World Labs world-model capability profiles.
 *
 * Blueprint's whole reconstruction story is one sentence: a capturer walks a
 * site with a phone, and a World Labs world model turns that walkthrough into
 * a navigable 3D scene. We do no reconstruction ourselves.
 *
 * Every profile here is a Marble model on the `worlds:generate` surface. They
 * differ only in *how much of the walkthrough a single request will accept*, so
 * the model is data, not code: pick a profile, and the adapter in
 * `worldlabs.ts` does the rest.
 *
 * World Labs Atlas is not one of these models, and switching to it is not a
 * config change. Its beta (https://atlas-beta.worldlabs.ai/docs, read
 * 2026-10-19) exposes task endpoints on a different API:
 * `tasks:images2PosedRGBD` returns a camera, a linear-depth EXR and a
 * confidence map per frame, in world units with no stated metric scale;
 * `tasks:atlasGenerate` returns RGB views at target cameras. Neither returns a
 * world, splats, a collider or a mesh. So any model name starting with "atlas"
 * resolves to a refused profile, and the WebApp never sends Atlas a request.
 * Atlas calls belong to the Pipeline (see docs/world-model-reconstruction.md).
 *
 * Limits are transcribed from the published World Labs docs.
 *
 * Sources:
 * - Input caps (video 30s/100MB, images 1024px/20MB):
 *   https://docs.worldlabs.ai/marble/create/prompt-guides
 * - Multi-image 4, or 8 with reconstruct_images:
 *   `MultiImagePrompt.reconstruct_images` in
 *   https://docs.worldlabs.ai/api/reference/openapi.yaml
 * - Model names: https://docs.worldlabs.ai/api/models
 * - Atlas task endpoints: https://atlas-beta.worldlabs.ai/docs/api-reference
 */

export interface WorldModelProfile {
  /** Value sent as `model` in the generate request. */
  readonly model: string;
  /** Human label for admin surfaces. */
  readonly label: string;
  /**
   * Whether `worlds:generate` may be called with this model. False only for a
   * name that is not a world-generation model at all, such as Atlas.
   */
  readonly available: boolean;
  /** Most frames this model accepts in one multi-image generate request. */
  readonly maxFrames: number;
  /**
   * Frames allowed before the reconstruction flag has to be set. Marble takes
   * 4 plainly and 8 only with `reconstruct_images: true`; a model with no such
   * split reports the same number as `maxFrames`.
   */
  readonly framesWithoutReconstructFlag: number;
  /** Whether `reconstruct_images` is a field this model understands. */
  readonly supportsReconstructFlag: boolean;
  /** Whether a whole video can be handed over instead of frames. */
  readonly supportsVideoPrompt: boolean;
  /** Published video caps, or null where the model takes no video. */
  readonly maxVideoSeconds: number | null;
  readonly maxVideoBytes: number | null;
  /** Why this profile exists / what is still unknown about it. */
  readonly note: string;
}

/** Recommended long-side pixel size for frames. Source: prompt guidelines. */
export const FRAME_LONG_SIDE_PX = 1024;

/** Hard per-image ceiling. Source: prompt guidelines. */
export const FRAME_MAX_BYTES = 20 * 1024 * 1024;

/** Formats the world models accept for image input. */
export const FRAME_FORMATS = ["png", "jpg", "jpeg", "webp"] as const;

const MARBLE_VIDEO_MAX_SECONDS = 30;
const MARBLE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

function marbleProfile(model: string, label: string): WorldModelProfile {
  return {
    model,
    label,
    available: true,
    maxFrames: 8,
    framesWithoutReconstructFlag: 4,
    supportsReconstructFlag: true,
    supportsVideoPrompt: true,
    maxVideoSeconds: MARBLE_VIDEO_MAX_SECONDS,
    maxVideoBytes: MARBLE_VIDEO_MAX_BYTES,
    note:
      "Marble takes 4 images plainly, 8 with reconstruct_images. Its 30s video cap is " +
      "shorter than a real site walkthrough, which is why frames are the default path.",
  };
}

/**
 * Atlas is refused, not pending. The profile below exists only so a refusal
 * reads as a configuration state (`worldlabs_model_unavailable`) instead of a
 * failed capture. It accepts no frames, and nothing may flip it on: an
 * Atlas-shaped request has to be built against Atlas's own task API, which the
 * Pipeline owns.
 */
function refusedAtlasProfile(model: string): WorldModelProfile {
  return {
    model,
    label: "Atlas (not a world model)",
    available: false,
    maxFrames: 0,
    framesWithoutReconstructFlag: 0,
    supportsReconstructFlag: false,
    supportsVideoPrompt: false,
    maxVideoSeconds: null,
    maxVideoBytes: null,
    note:
      "Atlas is not a worlds:generate model. Its beta exposes tasks:images2PosedRGBD and " +
      "tasks:atlasGenerate, which return posed RGB-D and generated views, not a world. " +
      "The Pipeline owns Atlas calls; the WebApp never sends them.",
  };
}

export const WORLD_MODEL_PROFILES: Readonly<Record<string, WorldModelProfile>> = Object.freeze({
  "marble-1.1-plus": marbleProfile("marble-1.1-plus", "Marble 1.1 Plus"),
  "marble-1.1": marbleProfile("marble-1.1", "Marble 1.1"),
  "marble-1.0": marbleProfile("marble-1.0", "Marble 1.0"),
  "marble-1.0-draft": marbleProfile("marble-1.0-draft", "Marble 1.0 Draft"),
});

/**
 * The model we call when nothing else is configured. Marble 1.1 Plus is the
 * best generally-available reconstruction model; the API's own default is the
 * older `marble-1.0`, which the docs say will change, so we pin it explicitly
 * rather than inherit a moving target.
 */
export const DEFAULT_WORLD_MODEL = "marble-1.1-plus";

/**
 * Legacy `model` strings the API still accepts but has announced it will drop.
 * Mapped forward so stored manifests written before the rename keep working.
 * Source: https://docs.worldlabs.ai/api/models
 */
const LEGACY_MODEL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "marble 0.1-plus": "marble-1.0",
  "marble 0.1-mini": "marble-1.0-draft",
});

/** Resolve a model string to its profile, tolerating legacy and unknown names. */
export function resolveWorldModelProfile(model?: string | null): WorldModelProfile {
  const requested = String(model || "").trim();
  if (!requested) {
    return WORLD_MODEL_PROFILES[DEFAULT_WORLD_MODEL];
  }

  // Checked before the unknown-model fallback below, which would otherwise
  // treat "atlas-beta" as a newer Marble and send it a Marble-shaped request.
  if (/^atlas/i.test(requested)) {
    return refusedAtlasProfile(requested);
  }

  const direct = WORLD_MODEL_PROFILES[requested];
  if (direct) {
    return direct;
  }

  const aliased = LEGACY_MODEL_ALIASES[requested.toLowerCase()];
  if (aliased && WORLD_MODEL_PROFILES[aliased]) {
    return WORLD_MODEL_PROFILES[aliased];
  }

  // An unrecognised model is most likely a newer Marble release, so fall back
  // to Marble's caps rather than refusing outright — but keep the caller's
  // string so the API, not us, decides whether it is real.
  return { ...marbleProfile(requested, requested), note: "Unrecognised model; assuming Marble input caps." };
}

export interface FrameCandidate {
  /** Where the frame bytes live (gs:// or https://). */
  readonly uri: string;
  /** Seconds from the start of the walkthrough. Used for even spacing. */
  readonly timestampSeconds?: number | null;
  /**
   * Optional sharpness / focus score, higher is better. When present, the
   * sharpest frame in each time bucket wins, which keeps motion-blurred frames
   * out of the request.
   */
  readonly sharpness?: number | null;
}

export interface FrameSelection {
  readonly frames: FrameCandidate[];
  /** Frames available before selection. */
  readonly consideredCount: number;
  /** Whether `reconstruct_images` must be set for this many frames. */
  readonly requiresReconstructFlag: boolean;
  /** Set when frames were dropped, for the artifact trail. */
  readonly droppedForModelCap: number;
}

/**
 * Choose which extracted frames actually go to the model.
 *
 * A walkthrough yields far more frames than any model accepts — 5 FPS over two
 * minutes is 600 — so the selection has to be deliberate rather than "first N",
 * which would reconstruct only the first few seconds of the site.
 *
 * Even temporal spacing keeps coverage of the whole walk. Within each bucket
 * the sharpest frame wins when a sharpness score is available, so we spend the
 * tiny frame budget on frames the model can actually use. The first and last
 * frames anchor the ends of the walk.
 */
export function selectFramesForModel(
  candidates: readonly FrameCandidate[],
  profile: WorldModelProfile,
): FrameSelection {
  const usable = candidates.filter((frame) => String(frame?.uri || "").trim());
  const ordered = [...usable].sort(
    (a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0),
  );

  if (ordered.length <= profile.maxFrames) {
    return {
      frames: ordered,
      consideredCount: usable.length,
      requiresReconstructFlag:
        profile.supportsReconstructFlag && ordered.length > profile.framesWithoutReconstructFlag,
      droppedForModelCap: 0,
    };
  }

  // Split the walkthrough into `maxFrames` equal buckets by position, then take
  // the best frame from each. Position rather than timestamp keeps this correct
  // when frames carry no timing at all.
  const picked: FrameCandidate[] = [];
  const bucketSize = ordered.length / profile.maxFrames;

  for (let bucket = 0; bucket < profile.maxFrames; bucket += 1) {
    const start = Math.floor(bucket * bucketSize);
    const end = bucket === profile.maxFrames - 1 ? ordered.length : Math.floor((bucket + 1) * bucketSize);
    const slice = ordered.slice(start, Math.max(end, start + 1));
    if (!slice.length) {
      continue;
    }

    const best = slice.reduce((winner, frame) => {
      const frameScore = typeof frame.sharpness === "number" ? frame.sharpness : Number.NEGATIVE_INFINITY;
      const winnerScore = typeof winner.sharpness === "number" ? winner.sharpness : Number.NEGATIVE_INFINITY;
      return frameScore > winnerScore ? frame : winner;
    }, slice[0]);

    picked.push(best);
  }

  return {
    frames: picked,
    consideredCount: usable.length,
    requiresReconstructFlag:
      profile.supportsReconstructFlag && picked.length > profile.framesWithoutReconstructFlag,
    droppedForModelCap: usable.length - picked.length,
  };
}

/**
 * Spread frames around the compass so the model has a hint about how the views
 * relate. A walkthrough is a path, not a turntable, so this is a weak prior —
 * but it beats leaving every frame at the same azimuth, which reads as "all
 * these views face the same way".
 */
export function azimuthForFrameIndex(index: number, total: number): number {
  if (total <= 1) {
    return 0;
  }
  return Math.round(((index * 360) / total) * 100) / 100;
}
