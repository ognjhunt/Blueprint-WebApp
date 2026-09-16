// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storagePayloads: new Map<string, string>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  storageAdmin: {
    bucket: () => ({
      file: (objectPath: string) => ({
        download: async () => {
          const payload = state.storagePayloads.get(objectPath);
          if (!payload) {
            throw new Error(`missing payload for ${objectPath}`);
          }
          return [Buffer.from(payload, "utf-8")];
        },
      }),
    }),
  },
}));

import {
  DEFAULT_WORLDLABS_TEXT_PROMPT,
  readArtifactJson,
  summarizeWorldLabsPreview,
} from "../utils/worldlabs";

describe("World Labs webapp defaults", () => {
  it("keeps the canonical default text prompt available for generation flow", async () => {
    expect(DEFAULT_WORLDLABS_TEXT_PROMPT).toContain("Create a grounded, explorable Marble world");
    expect(DEFAULT_WORLDLABS_TEXT_PROMPT).toContain("Do not invent extra rooms");
  });

  it("can read a stored request manifest without a text prompt", async () => {
    state.storagePayloads.clear();
    state.storagePayloads.set(
      "scenes/demo/captures/cap/pipeline/worldlabs_request_manifest.json",
      JSON.stringify({
        generation_request: {
          model: "Marble 0.1-mini",
          permission: "private",
          world_prompt: {
            type: "video",
            video_prompt: {
              source: "media_asset",
            },
          },
        },
      }),
    );

    const payload = await readArtifactJson(
      "gs://blueprint-8c1ca.appspot.com/scenes/demo/captures/cap/pipeline/worldlabs_request_manifest.json",
    );

    expect(payload).toMatchObject({
      generation_request: {
        model: "Marble 0.1-mini",
      },
    });
  });
});

describe("summarizeWorldLabsPreview", () => {
  const readyWorld = {
    world_id: "world-1",
    world_marble_url: "https://marble.worldlabs.ai/world/world-1",
    assets: {
      caption: "A media room",
      thumbnail_url: "https://cdn.worldlabs.ai/thumb.jpg",
      splats: {
        // The live API keys these by detail level, not a list.
        spz_urls: {
          "100k": "https://cdn.worldlabs.ai/world-100k.spz",
          "500k": "https://cdn.worldlabs.ai/world-500k.spz",
          full_res: "https://cdn.worldlabs.ai/world-full.spz",
        },
      },
      mesh: { collider_mesh_url: "https://cdn.worldlabs.ai/collider.glb" },
      imagery: { pano_url: "https://cdn.worldlabs.ai/pano.jpg" },
    },
  };

  it("reads splat downloads from the object the API actually returns", () => {
    const preview = summarizeWorldLabsPreview({ worldManifest: readyWorld });

    expect(preview.status).toBe("ready");
    expect(preview.spzUrlsByDetail).toEqual({
      "100k": "https://cdn.worldlabs.ai/world-100k.spz",
      "500k": "https://cdn.worldlabs.ai/world-500k.spz",
      full_res: "https://cdn.worldlabs.ai/world-full.spz",
    });
    expect(preview.spzUrls).toHaveLength(3);
    expect(preview.colliderMeshUrl).toBe("https://cdn.worldlabs.ai/collider.glb");
  });

  it("still reads splat downloads out of manifests stored in the older list shape", () => {
    const preview = summarizeWorldLabsPreview({
      worldManifest: {
        ...readyWorld,
        assets: {
          ...readyWorld.assets,
          splats: { spz_urls: ["https://cdn.worldlabs.ai/legacy.spz"] },
        },
      },
    });

    expect(preview.spzUrls).toEqual(["https://cdn.worldlabs.ai/legacy.spz"]);
  });

  it("reports a queued operation as queued, reading the nested progress status", () => {
    // Progress lives at metadata.progress.status. Reading the top level only
    // ever yielded "processing", so a queued job looked like a running one.
    const preview = summarizeWorldLabsPreview({
      operationManifest: {
        operation_id: "op-1",
        done: false,
        metadata: { progress: { status: "QUEUED" }, world_id: "world-1" },
      },
    });

    expect(preview.status).toBe("queued");
    expect(preview.operationId).toBe("op-1");
  });

  it("reports an in-progress operation as processing", () => {
    const preview = summarizeWorldLabsPreview({
      operationManifest: {
        operation_id: "op-2",
        done: false,
        metadata: { progress: { status: "IN_PROGRESS" } },
      },
    });

    expect(preview.status).toBe("processing");
  });

  it("surfaces a failure rather than leaving the capture looking queued", () => {
    const preview = summarizeWorldLabsPreview({
      operationManifest: {
        operation_id: "op-3",
        done: true,
        error: { message: "content_policy_violation" },
      },
    });

    expect(preview.status).toBe("failed");
    expect(preview.failureReason).toBe("content_policy_violation");
  });

  it("stays not_requested when nothing has been submitted", () => {
    expect(summarizeWorldLabsPreview({}).status).toBe("not_requested");
  });
});
