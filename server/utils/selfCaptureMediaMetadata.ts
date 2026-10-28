/** Local media inspection; browser playback support never decides upload eligibility. */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveFfmpegBinary } from "../agents/adapters/video-audio-strip";
import type { WrittenObject } from "./websiteCaptureDelivery";

export class VideoProbeError extends Error {
  constructor(readonly code: "video_probe_unavailable" | "video_probe_timeout" | "video_unreadable") {
    super(code);
    this.name = "VideoProbeError";
  }
}

export type VideoProbe = {
  method: "ffmpeg_source_samples.v1";
  dimensions_basis: "coded_stream";
  fps_basis: "average_source_samples";
  sample_count: number;
  time_base_numerator: number;
  time_base_denominator: number;
  first_presentation_timestamp: number;
  last_presentation_end_timestamp: number;
};

export type ProbedVideoMetadata = {
  widthPx: number;
  heightPx: number;
  fps: number;
  durationSeconds: number;
  /** Compatibility anchor for a video without a known recording clock. */
  recordedAtEpochMs: number;
  captureStartBasis: "server_upload_received";
  probe: VideoProbe;
};

type ProbeOptions = {
  receivedAtEpochMs?: number;
  resolveBinary?: () => Promise<string | null>;
  timeoutMs?: number;
};

/**
 * Framehash's machine-readable headers carry dimensions and rational timebase;
 * its rows carry original presentation timestamps and sample durations. Copying
 * the first video stream avoids playback, resampling, re-encoding and rounded
 * human-readable FPS. The output is consumed incrementally, never retained.
 */
export async function probeCaptureVideo(filePath: string, options: ProbeOptions = {}): Promise<ProbedVideoMetadata> {
  const binary = await (options.resolveBinary ?? resolveFfmpegBinary)();
  if (!binary) throw new VideoProbeError("video_probe_unavailable");
  const receivedAtEpochMs = options.receivedAtEpochMs ?? Date.now();
  if (!Number.isSafeInteger(receivedAtEpochMs) || receivedAtEpochMs <= 0) throw new VideoProbeError("video_unreadable");

  return new Promise((resolve, reject) => {
    // The input is a private local file, never a URL or a caller-selected
    // protocol. No provider receives these bytes, their audio or probe output.
    const child = spawn(binary, ["-hide_banner", "-nostdin", "-v", "error", "-xerror",
      "-protocol_whitelist", "file", "-f", "mov", "-enable_drefs", "0", "-use_absolute_path", "0", "-i", filePath,
      "-map", "0:v:0", "-an", "-sn", "-dn", "-c:v", "copy", "-copyts",
      "-f", "framehash", "-hash", "sha256", "pipe:1"],
    { stdio: ["ignore", "pipe", "pipe"] });
    let failed: VideoProbeError | null = null;
    const timeout = setTimeout(() => {
      failed = new VideoProbeError("video_probe_timeout");
      child.kill("SIGKILL");
    }, options.timeoutMs ?? 120_000);
    let lineBuffer = "";
    let width = 0, height = 0, numerator = 0, denominator = 0, count = 0;
    let first = Infinity, lastEnd = -Infinity;
    const invalidate = () => {
      failed ??= new VideoProbeError("video_unreadable");
      child.kill("SIGKILL");
    };
    const consume = (line: string) => {
      if (failed) return;
      let match = /^#tb 0:\s*(\d+)\/(\d+)\s*$/.exec(line);
      if (match) { numerator = Number(match[1]); denominator = Number(match[2]); return; }
      match = /^#dimensions 0:\s*(\d+)x(\d+)\s*$/.exec(line);
      if (match) { width = Number(match[1]); height = Number(match[2]); return; }
      if (!line.trim() || line.startsWith("#")) return;
      // Each row is exactly one video sample from the MOV/MP4 sample table.
      match = /^0,\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+),\s*[a-f0-9]{64}\s*$/.exec(line);
      if (!match) { invalidate(); return; }
      const pts = Number(match[2]), duration = Number(match[3]), size = Number(match[4]);
      if (![pts, duration, size, pts + duration].every(Number.isSafeInteger) || duration <= 0 || size <= 0) {
        invalidate(); return;
      }
      count += 1;
      first = Math.min(first, pts);
      lastEnd = Math.max(lastEnd, pts + duration);
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      lineBuffer += chunk;
      let end: number;
      while ((end = lineBuffer.indexOf("\n")) !== -1) {
        consume(lineBuffer.slice(0, end).replace(/\r$/, ""));
        lineBuffer = lineBuffer.slice(end + 1);
      }
      if (lineBuffer.length > 4096) invalidate();
    });
    // Drain diagnostics without exposing paths, embedded metadata or contents.
    child.stderr.resume();
    child.once("error", () => { clearTimeout(timeout); reject(new VideoProbeError("video_probe_unavailable")); });
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      if (lineBuffer) consume(lineBuffer);
      if (failed) { reject(failed); return; }
      const durationSeconds = (lastEnd - first) * numerator / denominator;
      const fps = count / durationSeconds;
      if (exitCode !== 0 || ![width, height, numerator, denominator, count].every(v => Number.isSafeInteger(v) && v > 0)
        || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(fps) || fps <= 0) {
        reject(new VideoProbeError("video_unreadable")); return;
      }
      resolve({ widthPx: width, heightPx: height, fps, durationSeconds, recordedAtEpochMs: receivedAtEpochMs,
        captureStartBasis: "server_upload_received", probe: { method: "ffmpeg_source_samples.v1",
          dimensions_basis: "coded_stream", fps_basis: "average_source_samples", sample_count: count,
          time_base_numerator: numerator, time_base_denominator: denominator,
          first_presentation_timestamp: first, last_presentation_end_timestamp: lastEnd } });
    });
  });
}

/** Probe exactly the completed compose generation, with bounded disk-backed I/O. */
export async function probeStoredCaptureVideo(video: WrittenObject, open: () => Readable,
  options: ProbeOptions = {}): Promise<ProbedVideoMetadata> {
  const binary = await (options.resolveBinary ?? resolveFfmpegBinary)();
  if (!binary) throw new VideoProbeError("video_probe_unavailable");
  const directory = await mkdtemp(path.join(os.tmpdir(), "self-capture-probe-"));
  const filePath = path.join(directory, "source.mov");
  let bytes = 0;
  try {
    const download = new AbortController();
    const deadline = setTimeout(() => download.abort(), options.timeoutMs ?? 120_000);
    try {
      await pipeline(open(), new Transform({ transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(bytes > video.size_bytes ? new VideoProbeError("video_unreadable") : null, chunk);
      } }), createWriteStream(filePath, { flags: "wx", mode: 0o600 }), { signal: download.signal });
    } catch (error) {
      if (download.signal.aborted) throw new VideoProbeError("video_probe_timeout");
      throw error;
    } finally { clearTimeout(deadline); }
    if (bytes !== video.size_bytes) throw new VideoProbeError("video_unreadable");
    return await probeCaptureVideo(filePath, { ...options, resolveBinary: async () => binary });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
