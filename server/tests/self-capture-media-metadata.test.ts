// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveFfmpegBinary } from "../agents/adapters/video-audio-strip";
import { probeCaptureVideo, probeStoredCaptureVideo } from "../utils/selfCaptureMediaMetadata";

let directory: string;
let binary: string;
let video: string;
beforeAll(async () => {
  const resolved = await resolveFfmpegBinary();
  if (!resolved) throw new Error("Pinned ffmpeg is required for the real-media regression");
  binary = resolved;
  directory = await mkdtemp(path.join(os.tmpdir(), "capture-metadata-test-"));
  video = path.join(directory, "fractional.mp4");
  execFileSync(binary, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
    "testsrc2=size=160x120:rate=30000/1001", "-frames:v", "30", "-c:v", "mpeg4", video]);
});
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

describe("real uploaded media, independently of browser decoding", () => {
  it("reads source dimensions, rational sample timing and fractional FPS without rounding", async () => {
    const before = await readFile(video);
    const result = await probeCaptureVideo(video, { receivedAtEpochMs: 1_798_000_000_000 });
    expect(result).toMatchObject({ widthPx: 160, heightPx: 120,
      recordedAtEpochMs: 1_798_000_000_000, captureStartBasis: "server_upload_received",
      probe: { method: "ffmpeg_source_samples.v1", sample_count: 30,
        time_base_numerator: 1, time_base_denominator: 30000,
        first_presentation_timestamp: 0, last_presentation_end_timestamp: 30030 } });
    expect(result.durationSeconds).toBeCloseTo(1.001, 12);
    expect(result.fps).toBeCloseTo(30000 / 1001, 12);
    expect(await readFile(video)).toEqual(before); // The retained original is never rewritten.
  });

  it("probes a generation-selected composed stream without relying on submitted metadata", async () => {
    const bytes = await readFile(video);
    const identity = { object_name: "capture/parts/selected.mp4", generation: "17",
      size_bytes: bytes.length, crc32c: "AAAAAA==" };
    const result = await probeStoredCaptureVideo(identity, () => Readable.from([bytes.subarray(0, 100), bytes.subarray(100)]));
    expect(result.widthPx).toBe(160);
    expect(result.fps).toBeCloseTo(30000 / 1001, 12);
    await expect(probeStoredCaptureVideo({ ...identity, size_bytes: bytes.length - 1 }, () => Readable.from([bytes])))
      .rejects.toMatchObject({ code: "video_unreadable" });
    await expect(probeStoredCaptureVideo(identity, () => Readable.from([bytes.subarray(0, 100)])))
      .rejects.toMatchObject({ code: "video_unreadable" });
  });

  it("rejects signature-only, truncated and audio-only files instead of inventing metadata", async () => {
    const signatureOnly = path.join(directory, "invalid.mp4");
    await writeFile(signatureOnly, Buffer.from("0000001866747970717420200000000071742020", "hex"));
    await expect(probeCaptureVideo(signatureOnly)).rejects.toMatchObject({ code: "video_unreadable" });
    const truncated = path.join(directory, "truncated.mp4");
    const bytes = await readFile(video);
    await writeFile(truncated, bytes.subarray(0, Math.floor(bytes.length / 2)));
    await expect(probeCaptureVideo(truncated)).rejects.toMatchObject({ code: "video_unreadable" });
    const audio = path.join(directory, "audio-only.mp4");
    execFileSync(binary, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "sine=frequency=440:sample_rate=8000", "-t", "0.1", "-c:a", "aac", audio]);
    await expect(probeCaptureVideo(audio)).rejects.toMatchObject({ code: "video_unreadable" });
  });

  it("labels a missing probe runtime as an operational error", async () => {
    await expect(probeCaptureVideo(video, { resolveBinary: async () => null }))
      .rejects.toMatchObject({ code: "video_probe_unavailable" });
  });
  it("does not download a retained original when the probe runtime is unavailable", async () => {
    let opened = false;
    await expect(probeStoredCaptureVideo({ object_name: "capture/original.mov", generation: "17",
      size_bytes: 7, crc32c: "AAAAAA==" }, () => { opened = true; return Readable.from([Buffer.from("stored")]); },
    { resolveBinary: async () => null })).rejects.toMatchObject({ code: "video_probe_unavailable" });
    expect(opened).toBe(false);
  });
  it("bounds a stalled retained-video read and closes its stream", async () => {
    const source = new Readable({ read() {} });
    await expect(probeStoredCaptureVideo({ object_name: "capture/original.mov", generation: "17",
      size_bytes: 7, crc32c: "AAAAAA==" }, () => source, { timeoutMs: 10, resolveBinary: async () => binary }))
      .rejects.toMatchObject({ code: "video_probe_timeout" });
    expect(source.destroyed).toBe(true);
  });
});
