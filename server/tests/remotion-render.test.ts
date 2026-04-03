// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFile, writeFile } from "node:fs/promises";

const bundle = vi.hoisted(() => vi.fn());
const selectComposition = vi.hoisted(() => vi.fn());
const renderMedia = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());

vi.mock("@remotion/bundler", () => ({
  bundle,
}));

vi.mock("@remotion/renderer", () => ({
  selectComposition,
  renderMedia,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  storageAdmin: {
    bucket(bucketName: string) {
      return {
        name: bucketName,
        file(objectPath: string) {
          return {
            save,
            objectPath,
          };
        },
      };
    },
  },
}));

import { renderProductReel } from "../utils/remotion-render";

beforeEach(() => {
  bundle.mockResolvedValue("https://serve-url.test");
  selectComposition.mockResolvedValue({
    id: "BlueprintProductReel",
    durationInFrames: 360,
    fps: 30,
    width: 1280,
    height: 720,
  });
  renderMedia.mockImplementation(async ({ outputLocation }: { outputLocation: string }) => {
    await writeFile(outputLocation, "fake-mp4");
  });
  save.mockResolvedValue(undefined);
});

describe("renderProductReel", () => {
  it("rejects empty storyboard input", async () => {
    await expect(
      renderProductReel({
        storyboard: [],
        images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,AAA" }],
        fps: 30,
        width: 1280,
        height: 720,
      }),
    ).rejects.toThrow("non-empty storyboard");
  });

  it("rejects empty image input", async () => {
    await expect(
      renderProductReel({
        storyboard: [
          {
            startFrame: 0,
            durationFrames: 90,
            title: "Title",
            copy: "Copy",
            visual: "Visual",
          },
        ],
        images: [],
        fps: 30,
        width: 1280,
        height: 720,
      }),
    ).rejects.toThrow("at least one generated image");
  });

  it("bundles the composition, selects metadata, and renders media", async () => {
    const result = await renderProductReel({
      storyboard: [
        {
          startFrame: 0,
          durationFrames: 90,
          title: "Title",
          copy: "Copy",
          visual: "Visual",
        },
        {
          startFrame: 90,
          durationFrames: 90,
          title: "Title 2",
          copy: "Copy 2",
          visual: "Visual 2",
        },
      ],
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,AAA" }],
      runwayVideoUrl: "https://cdn.runway.test/output.mp4",
      fps: 30,
      width: 1280,
      height: 720,
      storageObjectPath: "creative-factory/run-1/product-reel.mp4",
    });

    expect(bundle).toHaveBeenCalledOnce();
    expect(selectComposition).toHaveBeenCalledWith(
      expect.objectContaining({
        serveUrl: "https://serve-url.test",
        id: "BlueprintProductReel",
      }),
    );
    expect(renderMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        serveUrl: "https://serve-url.test",
        codec: "h264",
      }),
    );
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        resumable: false,
        contentType: "video/mp4",
      }),
    );
    expect(result.durationSeconds).toBe(12);
    expect(result.frames).toBe(360);
    expect(result.outputPath).toContain("product-reel.mp4");
    expect(result.storageUri).toBe(
      "gs://blueprint-8c1ca.appspot.com/creative-factory/run-1/product-reel.mp4",
    );
    expect(await readFile(result.outputPath)).toBeTruthy();
  });
});
