// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  docs: [] as Array<{ id: string; data: () => Record<string, unknown> }>,
  storagePayloads: new Map<string, string>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: () => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ docs: state.docs }),
        }),
      }),
    }),
  },
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

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (value: Record<string, unknown>) => value,
}));

import { getPublicSiteWorldById } from "../utils/site-worlds";

describe("live site-world World Labs projection", () => {
  it("surfaces a ready World Labs preview from pipeline artifacts", async () => {
    state.storagePayloads.clear();
    state.docs = [
      {
        id: "req-live-1",
        data: () => ({
          requestId: "req-live-1",
          site_submission_id: "req-live-1",
          status: "qualified_ready",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          request: {
            siteName: "World Labs Test Site",
            siteLocation: "100 Example Ave, Chicago, IL",
            taskStatement: "Inspect the loading shelf",
            targetRobotTeam: "Unitree G1",
          },
          pipeline: {
            scene_id: "scene-worldlabs",
            capture_id: "capture-worldlabs",
            pipeline_prefix: "scenes/scene-worldlabs/captures/capture-worldlabs/pipeline",
            artifacts: {
              worldlabs_request_manifest_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_request_manifest.json",
              worldlabs_operation_manifest_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_operation_manifest.json",
              worldlabs_world_manifest_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_world_manifest.json",
            },
          },
        }),
      },
    ];

    state.storagePayloads.set(
      "scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_request_manifest.json",
      JSON.stringify({
        schema_version: "v1",
        provider_model: "Marble 0.1-mini",
        generation_source_type: "video_media_asset",
      }),
    );
    state.storagePayloads.set(
      "scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_operation_manifest.json",
      JSON.stringify({
        operation_id: "operation-123",
        status: "succeeded",
        done: true,
        world_id: "world-456",
      }),
    );
    state.storagePayloads.set(
      "scenes/scene-worldlabs/captures/capture-worldlabs/pipeline/worldlabs/worldlabs_world_manifest.json",
      JSON.stringify({
        world_id: "world-456",
        model: "Marble 0.1-mini",
        world_marble_url: "https://marble.worldlabs.ai/worlds/world-456",
        assets: {
          caption: "Generated from the walkthrough video.",
          thumbnail_url: "https://cdn.worldlabs.ai/thumb.jpg",
          imagery: {
            pano_url: "https://cdn.worldlabs.ai/pano.jpg",
          },
          mesh: {
            collider_mesh_url: "https://cdn.worldlabs.ai/collider.glb",
          },
          splats: {
            spz_urls: ["https://cdn.worldlabs.ai/world.spz"],
          },
        },
      }),
    );

    const record = await getPublicSiteWorldById("sw-req-live-1");

    expect(record?.worldLabsPreview).toMatchObject({
      status: "ready",
      model: "Marble 0.1-mini",
      worldId: "world-456",
      launchUrl: "https://marble.worldlabs.ai/worlds/world-456",
      panoUrl: "https://cdn.worldlabs.ai/pano.jpg",
      colliderMeshUrl: "https://cdn.worldlabs.ai/collider.glb",
    });
    expect(record?.artifactExplorer?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "World Labs world manifest" }),
        expect.objectContaining({ label: "World Labs launch URL" }),
      ]),
    );
  });

  it("prefers a live pipeline-backed record over the static demo entry", async () => {
    state.storagePayloads.clear();
    state.docs = [
      {
        id: "req-live-demo",
        data: () => ({
          requestId: "req-live-demo",
          site_submission_id: "9483414B-8776-4F68-AC80-D3B3BA774A90:6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
          status: "qualified_ready",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          request: {
            siteName: "Media Room Demo Walkthrough",
            siteLocation: "Blueprint hosted runtime demo",
            taskStatement: "Media room",
            targetRobotTeam: "Mobile manipulator with head and wrist cameras",
          },
          pipeline: {
            scene_id: "9483414B-8776-4F68-AC80-D3B3BA774A90",
            capture_id: "6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
            pipeline_prefix:
              "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline",
            artifacts: {
              worldlabs_request_manifest_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_request_manifest.json",
              worldlabs_input_manifest_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_input/worldlabs_input_manifest.json",
              worldlabs_input_video_uri:
                "gs://blueprint-8c1ca.appspot.com/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_input/worldlabs_input.mp4",
            },
          },
        }),
      },
    ];

    state.storagePayloads.set(
      "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_request_manifest.json",
      JSON.stringify({
        schema_version: "v1",
        provider_model: "Marble 0.1-mini",
        status: "ready_for_manual_generation",
        generation_source_type: "video_media_asset",
      }),
    );
    state.storagePayloads.set(
      "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_input/worldlabs_input_manifest.json",
      JSON.stringify({
        schema_version: "v1",
        status: "ready",
        output_video_uri:
          "gs://blueprint-8c1ca.appspot.com/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_input/worldlabs_input.mp4",
      }),
    );

    const record = await getPublicSiteWorldById("siteworld-f5fd54898cfb");

    expect(record?.dataSource).toBe("pipeline");
    expect(record?.worldLabsPreview).toMatchObject({
      status: "queued",
      model: "Marble 0.1-mini",
      requestManifestUri:
        "gs://blueprint-8c1ca.appspot.com/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/worldlabs_request_manifest.json",
    });
    expect(record?.worldLabsPreview?.generationSourceType).toBe("video_media_asset");
  });
});
