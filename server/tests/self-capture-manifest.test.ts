// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ALLOWED_EXTENSIONS,
  buildBrowserCaptureManifest,
  parseVideoMetadata,
} from "../routes/self-capture-uploads";

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

const VIDEO = {
  widthPx: 1920,
  heightPx: 1080,
  fps: 29.97,
  durationSeconds: 47.2,
  recordedAtEpochMs: 1_757_980_800_000,
};

function manifest() {
  return buildBrowserCaptureManifest({
    payload: { sceneId: "site-req-1", captureId: "walkthrough-req-1", requestId: "req-1" },
    objectPath: "scenes/site-req-1/captures/walkthrough-req-1/raw/walkthrough.mp4",
    video: VIDEO,
    sizeBytes: 184_000_000,
  });
}

describe("a browser capture produces a bundle the extractor will actually process", () => {
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
    expect(built.capture_start_epoch_ms).toBe(VIDEO.recordedAtEpochMs);
  });
});

describe("nothing about the video is guessed", () => {
  it("accepts a complete set of measurements", () => {
    expect(parseVideoMetadata(VIDEO)).toEqual(VIDEO);
  });

  it("refuses rather than defaulting a missing frame rate", () => {
    // The tempting alternative is 30. A number nobody measured would then sit
    // in the capture record looking exactly like one somebody did.
    const { fps: _fps, ...withoutFps } = VIDEO;
    expect(parseVideoMetadata(withoutFps)).toBeNull();
  });

  it.each(["widthPx", "heightPx", "durationSeconds", "recordedAtEpochMs"])(
    "refuses when %s is missing",
    (field) => {
      const partial: Record<string, number> = { ...VIDEO };
      delete partial[field];
      expect(parseVideoMetadata(partial)).toBeNull();
    },
  );

  it("refuses zero and negative values, which are not measurements", () => {
    expect(parseVideoMetadata({ ...VIDEO, fps: 0 })).toBeNull();
    expect(parseVideoMetadata({ ...VIDEO, widthPx: -1920 })).toBeNull();
  });

  it("refuses anything that is not an object", () => {
    expect(parseVideoMetadata(null)).toBeNull();
    expect(parseVideoMetadata("1920x1080")).toBeNull();
    expect(parseVideoMetadata(undefined)).toBeNull();
  });

  it("takes numbers that arrived as strings, since multipart fields are text", () => {
    expect(parseVideoMetadata({ ...VIDEO, fps: "29.97" })).toEqual(VIDEO);
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
