// @vitest-environment node
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { measuredCaptureVideoMetadata, probeCaptureVideo } from "../utils/captureVideoMetadata";

const received = Date.parse("2026-10-28T12:00:00Z");
const observation = () => ({ streams: [{ codec_type: "video", width: 160, height: 120,
  avg_frame_rate: "30000/1001", r_frame_rate: "30/1" }], format: { duration: "0.1001" } });

describe("server measurement of retained original video", () => {
  it("reads the actual packaged binary and a real synthetic MP4 without browser metadata", async () => {
    const measured = await probeCaptureVideo(fileURLToPath(new URL("./fixtures/capture-video-metadata.mp4", import.meta.url)), received);
    expect(measured).toMatchObject({ widthPx: 160, heightPx: 120, recordedAtBasis: "file_creation_time",
      recordedAtEpochMs: Date.parse("2026-10-27T12:00:00Z") });
    expect(measured.fps).toBeCloseTo(30000 / 1001, 8);
    expect(measured.durationSeconds).toBeCloseTo(0.1001, 3);
  });
  it("marks receipt time explicitly when the file contains no creation timestamp", () => {
    expect(measuredCaptureVideoMetadata(observation(), received)).toMatchObject({ recordedAtEpochMs: received,
      recordedAtBasis: "upload_received", fps: 30000 / 1001 });
  });
  it.each([null, {}, { streams: [], format: { duration: 1 } }, { ...observation(), format: {} },
    { ...observation(), streams: [{ ...observation().streams[0], width: 0 }] },
    { ...observation(), streams: [{ ...observation().streams[0], avg_frame_rate: "0/0", r_frame_rate: "0/0" }] },
    { ...observation(), streams: [{ ...observation().streams[0], disposition: { attached_pic: 1 } }] }])
  ("refuses unknown or incomplete media measurements without fabricated defaults", value => {
    expect(() => measuredCaptureVideoMetadata(value, received)).toThrow("video_probe_unreadable");
  });
});
