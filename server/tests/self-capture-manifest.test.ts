// @vitest-environment node
import { describe, expect, it } from "vitest";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";

import {
  ALLOWED_EXTENSIONS,
  buildBrowserCaptureManifest,
  parseVideoMetadata,
  withContainerMeasurements,
} from "../routes/self-capture-uploads";
import { parseContainerHeader, probeVideoContainer } from "../utils/videoContainerProbe";

/**
 * Copied from `validateManifest` in BlueprintCapture's `cloud/extract-frames`.
 *
 * Duplicated deliberately: the two repos deploy separately and nothing type
 * checks across them, so the alternative to restating the list is discovering a
 * mismatch as a blocked capture in production. If the extractor's required
 * fields change, this fails and names the field.
 */
const EXTRACTOR_REQUIRED_STRINGS = ["scene_id", "video_uri", "device_model", "os_version"];
const EXTRACTOR_REQUIRED_NUMBERS = [
  "fps_source",
  "width",
  "height",
  "capture_start_epoch_ms",
];
const EXTRACTOR_REQUIRED_BOOLEANS = ["has_lidar"];

const HINT = {
  widthPx: 1920,
  heightPx: 1080,
  fps: 29.97,
  durationSeconds: 47.2,
  recordedAtEpochMs: 1_757_980_800_000,
};
const VIDEO = parseVideoMetadata(HINT);

function manifest() {
  return buildBrowserCaptureManifest({
    payload: { sceneId: "site-req-1", captureId: "walkthrough-req-1", requestId: "req-1" },
    objectPath: "scenes/site-req-1/captures/walkthrough-req-1/raw/walkthrough.mp4",
    video: VIDEO,
    sizeBytes: 184_000_000,
  });
}

describe("a browser capture produces a bundle the extractor will actually process", () => {
  it("leaves collection-time retention unresolved rather than applying a seven-year minimum", () => {
    expect(manifest().retention).toMatchObject({ policy_id: "website_capture_retention_review.v1",
      first_received_at_iso: null, collection_policy_version: null,
      extension_authorized: false, minimum_retention_floor_days_if_delete_is_ever_introduced: null });
  });
  it("carries the owner's task and confirmation without inventing confirmation", () => {
    const built = buildBrowserCaptureManifest({
      payload: { sceneId: "site-req-1", captureId: "walkthrough-req-1", requestId: "req-1" },
      objectPath: "scenes/site-req-1/captures/walkthrough-req-1/raw/walkthrough.mp4",
      video: VIDEO, sizeBytes: 100,
      taskContext: { description: "Pick a small rigid object from the table", confirmed: false, confirmed_at: null },
    });
    expect(built.site_task_context).toEqual({
      schema_version: "website_site_task_context.v1", request_id: "req-1",
      description: "Pick a small rigid object from the table", confirmed: false, confirmed_at: null,
    });
  });
  it("satisfies every field the extractor requires", () => {
    // A manifest missing any of these produces a blocked report rather than a
    // scene, and from the site's side that looks identical to a successful
    // upload: they filmed it, we said thanks, and nothing ever ran.
    const built = manifest();

    for (const field of EXTRACTOR_REQUIRED_STRINGS) {
      expect(typeof built[field], `${field} must be a non-empty string`).toBe("string");
      expect(String(built[field]).length).toBeGreaterThan(0);
    }
    for (const field of EXTRACTOR_REQUIRED_NUMBERS) {
      expect(Number.isFinite(built[field] as number), `${field} must be a number`).toBe(true);
    }
    for (const field of EXTRACTOR_REQUIRED_BOOLEANS) {
      expect(typeof built[field], `${field} must be a boolean`).toBe("boolean");
    }
  });

  it("does not claim the v3 on-device contract", () => {
    // Declaring v3 pulls in coordinate_frame_session_id, capture_profile_id and
    // the rest of the ARKit bundle, none of which exists for a video filmed in
    // a browser. Claiming that shape would describe a capture we did not make.
    const built = manifest();
    expect(built.schema_version).toBe("v1");
    expect(String(built.capture_schema_version ?? "")).not.toMatch(/^3\./);
  });

  it("names the submission behind it, because an untraceable capture is blocked", () => {
    // The extractor pushes `missing_site_submission_id` into blockReasons
    // unless a global toggle is on. Self-capture genuinely has a submission, so
    // it carries one -- and the id must not equal the capture id, which the
    // extractor treats as a placeholder.
    const built = manifest();
    expect(built.site_submission_id).toBe("req-1");
    expect(built.site_submission_id).not.toBe(built.capture_id);
  });

  it("carries no capture job id, because nobody was dispatched", () => {
    // Deliberately absent rather than minted. A capture job is the marketplace
    // record of who was sent and who gets paid; inventing one for a site that
    // filmed its own room would be fabricating a dispatch that never happened.
    // `isSelfServeCapture` in the extractor is what keeps that absence a
    // warning instead of a block.
    const built = manifest();
    expect(built.capture_job_id).toBeUndefined();
    expect(built.capture_source).toBe("browser_self_capture");
  });

  it("says what the capture actually was rather than naming a handset", () => {
    const built = manifest();
    expect(built.device_model).toBe("browser_self_capture");
    expect(built.has_lidar).toBe(false);
    expect(built.capture_tier_hint).toBe("video_only");
  });

  it("carries the measurements through unrounded", () => {
    const built = manifest();
    expect(built.fps_source).toBe(29.97);
    expect(built.width).toBe(1920);
    expect(built.height).toBe(1080);
    expect(built.capture_start_epoch_ms).toBe(HINT.recordedAtEpochMs);
    expect(built.video_metadata_sources).toEqual({ fps_source: "browser_reported", width: "browser_reported",
      height: "browser_reported", capture_start_epoch_ms: "browser_reported", duration_seconds: "browser_reported" });
  });

  it("records unknown values as null with no source when nobody could read them", () => {
    const built = buildBrowserCaptureManifest({
      payload: { sceneId: "s", captureId: "c", requestId: "r" },
      objectPath: "raw/walkthrough.mov", video: parseVideoMetadata(undefined), sizeBytes: 100,
    });
    for (const field of EXTRACTOR_REQUIRED_NUMBERS) {
      expect(built[field]).toBeNull();
      expect((built.video_metadata_sources as Record<string, unknown>)[field]).toBeNull();
    }
  });
});

describe("nothing about the video is guessed, and nothing missing refuses it", () => {
  const unknown = { widthPx: null, heightPx: null, fps: null, durationSeconds: null, recordedAtEpochMs: null, sources: {} };

  it("accepts a complete set of browser values and names their source", () => {
    expect(VIDEO).toMatchObject(HINT);
    expect(VIDEO.sources.fps).toBe("browser_reported");
  });

  it("leaves a missing frame rate unknown rather than defaulting it", () => {
    const { fps: _fps, ...withoutFps } = HINT;
    const parsed = parseVideoMetadata(withoutFps);
    expect(parsed.fps).toBeNull();
    expect(parsed.sources.fps).toBeUndefined();
    expect(parsed.widthPx).toBe(1920);
  });

  it("treats zero, negative and non-numeric values as unknown, not as measurements", () => {
    expect(parseVideoMetadata({ ...HINT, fps: 0, widthPx: -1920, heightPx: "tall" }))
      .toMatchObject({ fps: null, widthPx: null, heightPx: null });
  });

  it("treats anything that is not an object as no metadata at all", () => {
    for (const input of [null, "1920x1080", undefined]) expect(parseVideoMetadata(input)).toEqual(unknown);
  });

  it("takes numbers that arrived as strings, since multipart fields are text", () => {
    expect(parseVideoMetadata({ ...HINT, fps: "29.97" })).toEqual(VIDEO);
  });

  it("fills only the gaps from the server's container read, and says so", () => {
    const merged = withContainerMeasurements(parseVideoMetadata({ widthPx: 1080, heightPx: 1920 }),
      { widthPx: 1920, heightPx: 1080, fps: 29.97, durationSeconds: 12.5 });
    expect(merged).toMatchObject({ widthPx: 1080, heightPx: 1920, fps: 29.97, durationSeconds: 12.5, recordedAtEpochMs: null });
    expect(merged.sources).toEqual({ widthPx: "browser_reported", heightPx: "browser_reported",
      fps: "server_container_probe", durationSeconds: "server_container_probe" });
  });
});

describe("the server reads the container header a browser could not", () => {
  const header = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/tmp/self-capture-x':",
    "  Metadata:",
    "    creation_time   : 2026-10-01T12:00:00.000000Z",
    "  Duration: 00:01:02.50, start: 0.000000, bitrate: 9000 kb/s",
    "  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv, bt709), 1920x1080, 8000 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)",
    "      Metadata:",
    "        handler_name    : Core Media Video",
    "      Side data:",
    "        displaymatrix: rotation of -90.00 degrees",
    "  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono, fltp, 96 kb/s (default)",
    "At least one output file must be specified",
  ].join("\n");

  it("reads an iPhone HEVC portrait header as displayed", () => {
    expect(parseContainerHeader(header)).toEqual({ widthPx: 1080, heightPx: 1920, fps: 29.97,
      durationSeconds: 62.5, recordedAtEpochMs: Date.parse("2026-10-01T12:00:00Z") });
  });

  it("reads nothing from output that is not a parsed input", () => {
    expect(parseContainerHeader("/tmp/x: Invalid data found when processing input")).toEqual({});
  });

  it("returns nothing, rather than throwing, when no ffmpeg is available or it fails", async () => {
    expect(await probeVideoContainer("/tmp/x", { resolveBinary: async () => null })).toEqual({});
    expect(await probeVideoContainer("/tmp/x", { resolveBinary: async () => "/bin/ffmpeg",
      run: async () => { throw new Error("spawn failed"); } })).toEqual({});
  });
});

describe("we only accept containers the extractor can open", () => {
  it("takes the two the extractor matches", () => {
    expect([...ALLOWED_EXTENSIONS].sort()).toEqual(["mov", "mp4"]);
  });

  it("no longer accepts m4v", () => {
    // It used to. `captureObjectKind` matches only walkthrough.mov and
    // walkthrough.mp4, so an accepted .m4v was stored, ignored forever, and
    // reported to the site as received.
    expect(ALLOWED_EXTENSIONS.has("m4v")).toBe(false);
  });
});

it("preserves a recorded scene-building grant without granting resale rights", () => {
  const captureRights = projectWebsiteCaptureRights({ request: { consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-19T00:00:00Z",
  } } });
  const built = buildBrowserCaptureManifest({ payload: { sceneId: "s", captureId: "c", requestId: "r" },
    objectPath: "raw/video.mov", video: VIDEO, sizeBytes: 100, captureRights });
  expect(built.capture_rights).toMatchObject({ derived_scene_generation_allowed: true, data_licensing_allowed: false });
  expect(manifest().capture_rights).toMatchObject({ derived_scene_generation_allowed: false });
});
