/** Measure the uploaded file on the server; the browser only transfers bytes. */
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const run = promisify(execFile);

export type CaptureVideoMetadata = {
  widthPx: number;
  heightPx: number;
  fps: number;
  durationSeconds: number;
  recordedAtEpochMs: number;
  recordedAtBasis?: "file_creation_time" | "upload_received" | "client_reported";
};

const positive = (value: unknown): number | null => {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};
const frameRate = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length > 2) return null;
  const numerator = positive(parts[0]), denominator = parts.length === 2 ? positive(parts[1]) : 1;
  return numerator && denominator ? positive(numerator / denominator) : null;
};

export function measuredCaptureVideoMetadata(value: unknown, receivedAtEpochMs: number): CaptureVideoMetadata {
  const data = value as { streams?: Array<Record<string, any>>; format?: Record<string, any> } | null;
  const video = Array.isArray(data?.streams) ? data.streams.find(stream => stream.codec_type === "video"
    && stream.disposition?.attached_pic !== 1) : undefined;
  const widthPx = positive(video?.width), heightPx = positive(video?.height);
  const fps = frameRate(video?.avg_frame_rate) ?? frameRate(video?.r_frame_rate);
  const durationSeconds = positive(video?.duration) ?? positive(data?.format?.duration);
  if (!widthPx || !heightPx || !Number.isInteger(widthPx) || !Number.isInteger(heightPx)
    || !fps || !durationSeconds || !positive(receivedAtEpochMs)) throw new Error("video_probe_unreadable");
  const created = Date.parse(video?.tags?.creation_time ?? data?.format?.tags?.creation_time ?? "");
  const hasCreationTime = Number.isFinite(created) && created > 0;
  return { widthPx, heightPx, fps, durationSeconds,
    recordedAtEpochMs: hasCreationTime ? created : receivedAtEpochMs,
    recordedAtBasis: hasCreationTime ? "file_creation_time" : "upload_received" };
}

/** Fixed MOV/MP4 demuxer, local files only, no shell and bounded runtime/output. */
export async function probeCaptureVideo(filePath: string, receivedAtEpochMs: number): Promise<CaptureVideoMetadata> {
  const { path: binary } = require("@ffprobe-installer/ffprobe") as { path: string };
  let stdout: string;
  try {
    ({ stdout } = await run(binary, ["-v", "error", "-protocol_whitelist", "file", "-f", "mov", "-enable_drefs", "0",
      "-select_streams", "V:0", "-show_entries",
      "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,duration:stream_tags=creation_time:stream_disposition=attached_pic:format=duration:format_tags=creation_time",
      "-of", "json", filePath], { encoding: "utf8", timeout: 30_000, maxBuffer: 512 * 1024, killSignal: "SIGKILL" }));
  } catch (error) {
    throw new Error(["ENOENT", "EACCES", "ENOEXEC"].includes(String((error as NodeJS.ErrnoException).code))
      ? "video_probe_unavailable" : "video_probe_unreadable");
  }
  try { return measuredCaptureVideoMetadata(JSON.parse(stdout), receivedAtEpochMs); }
  catch { throw new Error("video_probe_unreadable"); }
}
