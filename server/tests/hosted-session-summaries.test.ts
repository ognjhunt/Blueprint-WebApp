// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isRenderableObservationPath,
  normalizeBatchSummary,
  normalizeEpisodeSummary,
} from "../utils/hosted-session-summaries";

describe("isRenderableObservationPath", () => {
  it("accepts http(s), data:image, and known app asset roots", () => {
    expect(isRenderableObservationPath("https://cdn.example/x.png")).toBe(true);
    expect(isRenderableObservationPath("http://cdn.example/x.png")).toBe(true);
    expect(isRenderableObservationPath("data:image/png;base64,AAAA")).toBe(true);
    expect(isRenderableObservationPath("/api/site-worlds/sessions/s1/render")).toBe(true);
    expect(isRenderableObservationPath("/assets/frame.png")).toBe(true);
    expect(isRenderableObservationPath("/images/frame.png")).toBe(true);
    expect(isRenderableObservationPath("/attached_assets/frame.png")).toBe(true);
  });

  it("rejects empty, relative, and non-image data paths", () => {
    expect(isRenderableObservationPath("")).toBe(false);
    expect(isRenderableObservationPath(null)).toBe(false);
    expect(isRenderableObservationPath(undefined)).toBe(false);
    expect(isRenderableObservationPath("relative/path.png")).toBe(false);
    expect(isRenderableObservationPath("/other/frame.png")).toBe(false);
    expect(isRenderableObservationPath("data:text/plain,hi")).toBe(false);
  });
});

describe("normalizeEpisodeSummary", () => {
  it("fills defaults and builds a renderable head_rgb frame path for an empty payload", () => {
    const summary = normalizeEpisodeSummary("sess 1", {});
    expect(summary?.episodeId).toBe("");
    expect(summary?.status).toBe("ready");
    expect(summary?.stepIndex).toBe(0);
    expect(summary?.reward).toBeNull();
    expect(summary?.done).toBe(false);
    expect(summary?.success).toBeNull();
    expect(summary?.observation).toBeNull();
    expect(summary?.observationSummary.framePath).toBe(
      "/api/site-worlds/sessions/sess%201/render?cameraId=head_rgb",
    );
    expect(summary?.observationSummary.frameCount).toBe(1);
    expect(summary?.observationSummary.hasRenderableFrame).toBe(true);
  });

  it("honors a custom render route base and the observation primary camera", () => {
    const summary = normalizeEpisodeSummary(
      "s2",
      { observation: { primaryCameraId: "wrist_cam" } },
      "/custom/base",
    );
    expect(summary?.observationSummary.framePath).toBe("/custom/base/s2/render?cameraId=wrist_cam");
    expect(summary?.observation?.frame_path).toBe("/custom/base/s2/render?cameraId=wrist_cam");
  });

  it("preserves finite numeric reward but nulls non-numeric reward", () => {
    expect(normalizeEpisodeSummary("s", { reward: 0.5 })?.reward).toBe(0.5);
    expect(normalizeEpisodeSummary("s", { reward: "nope" })?.reward).toBeNull();
    expect(normalizeEpisodeSummary("s", { reward: Number.NaN })?.reward).toBeNull();
  });

  it("derives frame count from frame_paths and marks artifact availability", () => {
    const summary = normalizeEpisodeSummary("s", {
      frame_paths: ["a", "b", "c"],
      artifactUris: { actions: "gs://a/actions.json", export_manifest: "gs://a/manifest.json" },
    });
    expect(summary?.observationSummary.frameCount).toBe(3);
    expect(summary?.generatedOutputs.actionTrace.available).toBe(true);
    expect(summary?.generatedOutputs.actionTrace.artifactUri).toBe("gs://a/actions.json");
    expect(summary?.generatedOutputs.exportBundle.available).toBe(true);
    expect(summary?.generatedOutputs.rolloutVideo.available).toBe(false);
  });
});

describe("normalizeBatchSummary", () => {
  it("fills defaults with no export manifest", () => {
    const summary = normalizeBatchSummary({});
    expect(summary?.batchRunId).toBe("");
    expect(summary?.status).toBe("running");
    expect(summary?.numEpisodes).toBe(0);
    expect(summary?.artifactManifestUri).toBeNull();
    expect(summary?.exportBundle.available).toBe(false);
  });

  it("maps counts, failure modes, and export bundle availability", () => {
    const summary = normalizeBatchSummary(
      {
        batchRunId: "batch-1",
        status: "completed",
        numEpisodes: 4,
        numSuccess: 3,
        numFailure: 1,
        successRate: 0.75,
        commonFailureModes: ["timeout", 42],
      },
      { export_manifest: "gs://b/manifest.json" },
    );
    expect(summary?.batchRunId).toBe("batch-1");
    expect(summary?.numEpisodes).toBe(4);
    expect(summary?.successRate).toBe(0.75);
    expect(summary?.commonFailureModes).toEqual(["timeout", "42"]);
    expect(summary?.artifactManifestUri).toBe("gs://b/manifest.json");
    expect(summary?.exportBundle.available).toBe(true);
  });
});
