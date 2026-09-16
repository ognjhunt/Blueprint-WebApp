// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const worldlabs = vi.hoisted(() => ({
  generateWorldFromFrames: vi.fn(),
  getWorldLabsOperation: vi.fn(),
  getWorldLabsWorld: vi.fn(),
  exportWorldAsset: vi.fn(),
}));

vi.mock("../utils/worldlabs", async () => {
  const actual = await vi.importActual<typeof import("../utils/worldlabs")>("../utils/worldlabs");
  return { ...actual, ...worldlabs };
});

vi.mock("../utils/worldlabsFrames", () => ({
  loadCaptureFrames: vi.fn(async () => []),
}));

import {
  advanceWorldReconstruction,
  startWorldReconstruction,
} from "../utils/worldReconstruction";

const FRAMES_PREFIX = "gs://bucket/scenes/s1/captures/c1/frames";

function frames(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    uri: `gs://bucket/scenes/s1/captures/c1/frames/${String(index + 1).padStart(6, "0")}.jpg`,
    timestampSeconds: index * 0.2,
  }));
}

const READY_WORLD = {
  world: {
    world_id: "world-1",
    model: "marble-1.1-plus",
    world_marble_url: "https://marble.worldlabs.ai/world/world-1",
    assets: {
      caption: "A warehouse aisle",
      thumbnail_url: "https://cdn.worldlabs.ai/thumb.jpg",
      splats: { spz_urls: { "100k": "https://cdn.worldlabs.ai/w-100k.spz" } },
      mesh: { collider_mesh_url: "https://cdn.worldlabs.ai/collider.glb" },
      imagery: { pano_url: "https://cdn.worldlabs.ai/pano.jpg" },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("starting a reconstruction without anyone watching", () => {
  it("records the operation and what was sent", async () => {
    worldlabs.generateWorldFromFrames.mockResolvedValue({
      operation: { operation_id: "op-1" },
      profile: { model: "marble-1.1-plus" },
      frameSelection: {
        submittedCount: 8,
        consideredCount: 600,
        droppedForModelCap: 592,
        reconstructImages: true,
        submittedFrameUris: [],
      },
    });

    const record = await startWorldReconstruction({
      framesPrefixUri: FRAMES_PREFIX,
      loadFrames: async () => frames(600),
    });

    expect(record.state).toBe("generating");
    expect(record.operationId).toBe("op-1");
    expect(record.model).toBe("marble-1.1-plus");
    expect(record.frameSelection).toMatchObject({ submittedCount: 8, droppedForModelCap: 592 });
    expect(record.blocker).toBeNull();
  });

  it("names an empty frame set instead of calling the API with nothing", async () => {
    const record = await startWorldReconstruction({
      framesPrefixUri: FRAMES_PREFIX,
      loadFrames: async () => [],
    });

    expect(record.state).toBe("failed");
    expect(record.blocker).toBe("capture_frames_empty");
    expect(worldlabs.generateWorldFromFrames).not.toHaveBeenCalled();
  });

  it("separates 'we have no access to that model yet' from a bad capture", async () => {
    worldlabs.generateWorldFromFrames.mockRejectedValue(
      new Error("worldlabs_model_unavailable:atlas:early access only"),
    );

    const record = await startWorldReconstruction({
      framesPrefixUri: FRAMES_PREFIX,
      model: "atlas",
      loadFrames: async () => frames(20),
    });

    expect(record.state).toBe("failed");
    expect(record.blocker).toBe("worldlabs_model_unavailable");
    expect(record.failureReason).toContain("atlas");
  });

  it("reports unreadable frames rather than throwing at a background trigger", async () => {
    const record = await startWorldReconstruction({
      framesPrefixUri: FRAMES_PREFIX,
      loadFrames: async () => {
        throw new Error("permission denied");
      },
    });

    expect(record.state).toBe("failed");
    expect(record.blocker).toBe("capture_frames_unreadable");
  });
});

describe("advancing a running reconstruction", () => {
  it("stays in processing while the model is still working", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: false,
      metadata: { progress: { status: "IN_PROGRESS" }, world_id: "world-1" },
    });

    const record = await advanceWorldReconstruction({ operationId: "op-1" });

    expect(record.state).toBe("processing");
    expect(record.preview?.status).toBe("processing");
    expect(worldlabs.getWorldLabsWorld).not.toHaveBeenCalled();
  });

  it("does not export anything by default", async () => {
    // The critical path stops at the world existing. A finished world already
    // carries splats, a collider mesh and a panorama; the HQ mesh is an
    // asynchronous, billed export that nobody should get by accident.
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);

    const record = await advanceWorldReconstruction({ operationId: "op-1" });

    expect(record.state).toBe("ready");
    expect(worldlabs.exportWorldAsset).not.toHaveBeenCalled();
    // What ships with the world is still there, so the Pipeline is not waiting.
    expect(record.assets?.colliderMeshUrl).toBe("https://cdn.worldlabs.ai/collider.glb");
    expect(record.assets?.spzUrlsByDetail).toEqual({
      "100k": "https://cdn.worldlabs.ai/w-100k.spz",
    });
  });

  it("exports only the formats asked for", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);
    worldlabs.exportWorldAsset.mockResolvedValue({ url: "https://cdn.worldlabs.ai/world.ply" });

    const record = await advanceWorldReconstruction({
      operationId: "op-1",
      exports: ["splat_ply"],
    });

    expect(worldlabs.exportWorldAsset).toHaveBeenCalledTimes(1);
    expect(worldlabs.exportWorldAsset).toHaveBeenCalledWith(
      expect.objectContaining({ assetType: "splats", format: "ply" }),
    );
    expect(record.assets?.splatPlyUrl).toBe("https://cdn.worldlabs.ai/world.ply");
    expect(record.state).toBe("ready");
  });

  it("pulls the files out once the world exists", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);
    worldlabs.exportWorldAsset.mockImplementation(async (args: { assetType: string }) =>
      args.assetType === "splats"
        ? { url: "https://cdn.worldlabs.ai/world.ply" }
        : { url: "https://cdn.worldlabs.ai/world.glb" },
    );

    const record = await advanceWorldReconstruction({
      operationId: "op-1",
      exports: ["splat_ply", "mesh_glb"],
    });

    expect(record.state).toBe("ready");
    expect(record.assets).toMatchObject({
      worldId: "world-1",
      colliderMeshUrl: "https://cdn.worldlabs.ai/collider.glb",
      splatPlyUrl: "https://cdn.worldlabs.ai/world.ply",
      meshGlbUrl: "https://cdn.worldlabs.ai/world.glb",
      panoUrl: "https://cdn.worldlabs.ai/pano.jpg",
    });
    expect(record.assets?.spzUrlsByDetail).toEqual({
      "100k": "https://cdn.worldlabs.ai/w-100k.spz",
    });
  });

  it("requests the splat PLY at full resolution by default", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);
    worldlabs.exportWorldAsset.mockResolvedValue({ url: "https://cdn.worldlabs.ai/a" });

    await advanceWorldReconstruction({
      operationId: "op-1",
      exports: ["splat_ply", "mesh_glb"],
    });

    expect(worldlabs.exportWorldAsset).toHaveBeenCalledWith(
      expect.objectContaining({ assetType: "splats", format: "ply", resolution: "full_res" }),
    );
    expect(worldlabs.exportWorldAsset).toHaveBeenCalledWith(
      expect.objectContaining({ assetType: "mesh", format: "glb", meshVariant: "textured" }),
    );
  });

  it("says the mesh is still exporting instead of handing back a silent null", async () => {
    // The HQ mesh export is asynchronous, so the first call returns an
    // operation rather than a URL. That is not "ready".
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);
    worldlabs.exportWorldAsset.mockImplementation(async (args: { assetType: string }) =>
      args.assetType === "splats"
        ? { url: "https://cdn.worldlabs.ai/world.ply" }
        : { operation_id: "mesh-op-9", done: false },
    );

    const record = await advanceWorldReconstruction({
      operationId: "op-1",
      exports: ["splat_ply", "mesh_glb"],
    });

    expect(record.state).toBe("exporting");
    expect(record.assets?.meshGlbUrl).toBeNull();
    expect(record.assets?.meshExportOperationId).toBe("mesh-op-9");
    // The collider mesh always ships, so the Pipeline is not empty-handed.
    expect(record.assets?.colliderMeshUrl).toBe("https://cdn.worldlabs.ai/collider.glb");
  });

  it("still returns the world when a single export fails", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);
    worldlabs.exportWorldAsset.mockRejectedValue(new Error("worldlabs_api_402:no credits"));

    const record = await advanceWorldReconstruction({
      operationId: "op-1",
      exports: ["splat_ply"],
    });

    expect(record.state).toBe("exporting");
    expect(record.blocker).toBe("worldlabs_splat_export_failed");
    expect(record.assets?.worldId).toBe("world-1");
  });

  it("skips exporting when the caller explicitly asks for none", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD);

    const record = await advanceWorldReconstruction({ operationId: "op-1", exports: [] });

    expect(record.state).toBe("ready");
    expect(worldlabs.exportWorldAsset).not.toHaveBeenCalled();
  });

  it("surfaces a failed generation as failed", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      error: { message: "content_policy_violation" },
      metadata: { world_id: "world-1" },
    });

    const record = await advanceWorldReconstruction({ operationId: "op-1" });

    expect(record.state).toBe("failed");
    expect(record.failureReason).toBe("content_policy_violation");
    expect(worldlabs.getWorldLabsWorld).not.toHaveBeenCalled();
  });

  it("reads a world returned without the outer wrapper", async () => {
    worldlabs.getWorldLabsOperation.mockResolvedValue({
      operation_id: "op-1",
      done: true,
      metadata: { world_id: "world-1" },
    });
    worldlabs.getWorldLabsWorld.mockResolvedValue(READY_WORLD.world);

    const record = await advanceWorldReconstruction({ operationId: "op-1" });

    expect(record.assets?.worldId).toBe("world-1");
  });
});
