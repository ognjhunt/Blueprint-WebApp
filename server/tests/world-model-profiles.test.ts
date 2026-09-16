// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  azimuthForFrameIndex,
  DEFAULT_WORLD_MODEL,
  resolveWorldModelProfile,
  selectFramesForModel,
  WORLD_MODEL_PROFILES,
  type FrameCandidate,
} from "../utils/worldModelProfiles";

function frames(count: number, sharpnessAt?: Record<number, number>): FrameCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    uri: `gs://bucket/frames/frame-${String(index).padStart(4, "0")}.jpg`,
    timestampSeconds: index * 0.2,
    sharpness: sharpnessAt?.[index],
  }));
}

describe("world model profiles", () => {
  it("defaults to the newest generally-available Marble model, not the API's legacy default", () => {
    // The API defaults to marble-1.0 for back-compat and has said that will
    // change. Pinning means a silent upstream default flip cannot change which
    // model our captures are reconstructed with.
    expect(DEFAULT_WORLD_MODEL).toBe("marble-1.1-plus");
    expect(resolveWorldModelProfile(null).model).toBe("marble-1.1-plus");
  });

  it("maps retired model strings forward so stored manifests keep resolving", () => {
    expect(resolveWorldModelProfile("Marble 0.1-mini").model).toBe("marble-1.0-draft");
    expect(resolveWorldModelProfile("Marble 0.1-plus").model).toBe("marble-1.0");
  });

  it("keeps Atlas unreachable until its real API has been seen", () => {
    const atlas = WORLD_MODEL_PROFILES.atlas;
    expect(atlas.available).toBe(false);
    expect(atlas.maxFrames).toBe(100);
    expect(atlas.note).toMatch(/no published request schema/i);
  });

  it("holds Marble to its published input caps", () => {
    const marble = resolveWorldModelProfile("marble-1.1-plus");
    expect(marble.maxFrames).toBe(8);
    expect(marble.framesWithoutReconstructFlag).toBe(4);
    expect(marble.maxVideoSeconds).toBe(30);
  });

  it("falls back to Marble caps for an unknown model rather than refusing it", () => {
    const future = resolveWorldModelProfile("marble-1.2");
    expect(future.model).toBe("marble-1.2");
    expect(future.maxFrames).toBe(8);
  });
});

describe("frame selection", () => {
  const marble = resolveWorldModelProfile("marble-1.1-plus");
  const atlas = WORLD_MODEL_PROFILES.atlas;

  it("passes every frame through when the walkthrough is already under the cap", () => {
    const selection = selectFramesForModel(frames(3), marble);
    expect(selection.frames).toHaveLength(3);
    expect(selection.droppedForModelCap).toBe(0);
    expect(selection.requiresReconstructFlag).toBe(false);
  });

  it("sets the reconstruction flag only once past four frames", () => {
    expect(selectFramesForModel(frames(4), marble).requiresReconstructFlag).toBe(false);
    expect(selectFramesForModel(frames(5), marble).requiresReconstructFlag).toBe(true);
  });

  it("covers the whole walkthrough rather than the first N frames", () => {
    // A 5 FPS two-minute walk is 600 frames. Taking the first 8 would
    // reconstruct the first 1.6 seconds of the site and nothing else, so the
    // selection has to reach the end of the walk.
    const selection = selectFramesForModel(frames(600), marble);
    expect(selection.frames).toHaveLength(8);
    expect(selection.consideredCount).toBe(600);
    expect(selection.droppedForModelCap).toBe(592);

    const indices = selection.frames.map((frame) =>
      Number(frame.uri.match(/frame-(\d+)\.jpg$/)?.[1]),
    );
    expect(indices[0]).toBeLessThan(75);
    expect(indices.at(-1)).toBeGreaterThan(500);
    // Strictly increasing: capture order is preserved.
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it("prefers the sharpest frame inside each bucket", () => {
    // Two buckets of five. The sharpest frame in each is deliberately not the
    // one an evenly-spaced-only rule would land on.
    const selection = selectFramesForModel(
      frames(10, { 3: 900, 7: 900 }),
      { ...marble, maxFrames: 2, framesWithoutReconstructFlag: 2 },
    );
    const indices = selection.frames.map((frame) =>
      Number(frame.uri.match(/frame-(\d+)\.jpg$/)?.[1]),
    );
    expect(indices).toEqual([3, 7]);
  });

  it("orders frames by capture time even when handed to us shuffled", () => {
    const shuffled = [...frames(6)].reverse();
    const selection = selectFramesForModel(shuffled, marble);
    const times = selection.frames.map((frame) => frame.timestampSeconds);
    expect([...times].sort((a, b) => Number(a) - Number(b))).toEqual(times);
  });

  it("ignores frames with no usable uri", () => {
    const selection = selectFramesForModel(
      [{ uri: "" }, { uri: "   " }, ...frames(2)],
      marble,
    );
    expect(selection.frames).toHaveLength(2);
    expect(selection.consideredCount).toBe(2);
  });

  it("lets the Atlas budget through unchanged, which is the point of the profile", () => {
    const selection = selectFramesForModel(frames(600), atlas);
    expect(selection.frames).toHaveLength(100);
    expect(selection.requiresReconstructFlag).toBe(false);
  });
});

describe("azimuth spread", () => {
  it("spreads frames around the compass instead of stacking them at zero", () => {
    expect(azimuthForFrameIndex(0, 4)).toBe(0);
    expect(azimuthForFrameIndex(1, 4)).toBe(90);
    expect(azimuthForFrameIndex(3, 4)).toBe(270);
  });

  it("leaves a lone frame at zero", () => {
    expect(azimuthForFrameIndex(0, 1)).toBe(0);
  });
});
