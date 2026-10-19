// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateWorldFromFrames } from "../utils/worldlabs";

const frames = Array.from({ length: 3 }, (_, index) => ({
  uri: `gs://bucket/scenes/s1/captures/c1/frames/frame-${index}.jpg`,
  timestampSeconds: index * 0.2,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("World Labs Atlas is never sent a Marble-shaped request", () => {
  // Atlas exposes task endpoints (tasks:images2PosedRGBD, tasks:atlasGenerate)
  // that return posed RGB-D and generated views, not a world. A request built
  // for worlds:generate would be wrong in shape and in what it promises back.
  it("refuses an explicit Atlas model before uploading or calling anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateWorldFromFrames({ frames, model: "atlas" })).rejects.toThrow(
      /^worldlabs_model_unavailable:atlas:/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a configured Atlas default instead of guessing it is a newer Marble", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WORLDLABS_DEFAULT_MODEL", "atlas-beta");
    vi.stubEnv("WORLDLABS_API_KEY", "test-key-not-a-secret");

    await expect(generateWorldFromFrames({ frames })).rejects.toThrow(
      /^worldlabs_model_unavailable:atlas-beta:/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
