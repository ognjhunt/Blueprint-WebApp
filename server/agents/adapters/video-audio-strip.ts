/**
 * Sound never leaves Blueprint with site footage.
 *
 * Phone footage of a workplace records whatever people nearby say, and nothing
 * the Service does needs it. So before video bytes go to any model or 3D
 * provider, the file is remuxed without its audio track (`-map 0:v -c copy
 * -an`: no re-encoding, so frames and timestamps are exactly the uploaded
 * ones), the result is read back and must hold video streams and nothing else,
 * and only that copy may be sent. The original upload stays in Blueprint
 * storage as received.
 *
 * Fail closed: if ffmpeg cannot be found, cannot remux the file, or the result
 * cannot be shown to be audio-free, nothing is sent and the caller gets an
 * `AudioStripError` whose `code` names the reason.
 *
 * The binary is resolved deterministically: `BLUEPRINT_FFMPEG_PATH` when set,
 * otherwise the exact-pinned `ffmpeg-static` package. It is never looked up on
 * PATH, so production cannot quietly depend on whatever a host happens to have.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

const require = createRequire(import.meta.url);

export type AudioStripErrorCode =
  /** No usable ffmpeg binary: a deployment problem, not the site's. */
  | "audio_strip_unavailable"
  /** ffmpeg ran and could not produce a video-only copy of this file. */
  | "audio_strip_failed"
  /** The copy could not be shown to hold video and no audio. */
  | "audio_strip_unverified"
  /** Code tried to send video that did not come from `stripVideoAudio`. */
  | "audio_strip_required";

const CODES = new Set<string>(["audio_strip_unavailable", "audio_strip_failed", "audio_strip_unverified", "audio_strip_required"]);
export function isAudioStripErrorCode(code: unknown): code is AudioStripErrorCode {
  return typeof code === "string" && CODES.has(code);
}

export class AudioStripError extends Error {
  constructor(readonly code: AudioStripErrorCode, message: string) {
    super(message);
    this.name = "AudioStripError";
  }
}

/** The typed reason, if this error means a video was withheld for its sound. */
export function audioStripFailureCode(error: unknown): AudioStripErrorCode | null {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return isAudioStripErrorCode(code) ? code : null;
}

/** The bytes as received: a Buffer, or a stream that is read exactly once. */
export interface VideoBytes {
  body: Uint8Array | ReadableStream<Uint8Array>;
  byteLength: number;
  contentType: string;
}

/** A video-only copy on local disk, safe to send to a provider. */
export interface AudioFreeVideo {
  readonly byteLength: number;
  readonly contentType: string;
  readonly sha256: string;
  readonly videoStreams: number;
  /** A fresh read of the copy; each call opens its own stream. */
  open(): ReadableStream<Uint8Array>;
  readAll(): Promise<Buffer>;
  /** Deletes the copy. Safe to call more than once. */
  cleanup(): Promise<void>;
}

export type FfmpegRunner = (binary: string, args: readonly string[], options: { timeoutMs: number }) =>
  Promise<{ exitCode: number | null; stderr: string }>;

export interface AudioStripOptions {
  /** Resolves the ffmpeg binary; defaults to `resolveFfmpegBinary`. */
  resolveBinary?: () => Promise<string | null>;
  run?: FfmpegRunner;
  tmpDir?: string;
  timeoutMs?: number;
}

/** Demuxer forced on input (no format guessing), muxer for the same container. */
const CONTAINERS: Record<string, { demuxer: string; muxer: string; extension: string; contentType: string }> = {
  "video/mp4": { demuxer: "mov", muxer: "mp4", extension: "mp4", contentType: "video/mp4" },
  "video/x-m4v": { demuxer: "mov", muxer: "mp4", extension: "mp4", contentType: "video/mp4" },
  "video/quicktime": { demuxer: "mov", muxer: "mov", extension: "mov", contentType: "video/quicktime" },
  "video/webm": { demuxer: "matroska", muxer: "webm", extension: "webm", contentType: "video/webm" },
  "video/mpeg": { demuxer: "mpeg", muxer: "mpeg", extension: "mpg", contentType: "video/mpeg" },
};

const DEFAULT_TIMEOUT_MS = 2 * 60_000;
const STDERR_LIMIT = 64 * 1024;

function packagedFfmpegPath(): string | null {
  try {
    const resolved: unknown = require("ffmpeg-static");
    return typeof resolved === "string" ? resolved : null;
  } catch {
    return null;
  }
}

/**
 * `BLUEPRINT_FFMPEG_PATH`, else the `ffmpeg-static` binary. Absolute and
 * executable, or null. PATH is deliberately not consulted.
 */
export async function resolveFfmpegBinary(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const candidate = env.BLUEPRINT_FFMPEG_PATH?.trim() || packagedFfmpegPath();
  if (!candidate || !path.isAbsolute(candidate)) return null;
  try {
    await access(candidate, constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

/** Cheap check before any paid step: is there a binary to strip sound with? */
export async function assertAudioStripAvailable(options: Pick<AudioStripOptions, "resolveBinary"> = {}): Promise<void> {
  if (!(await (options.resolveBinary ?? resolveFfmpegBinary)())) {
    throw new AudioStripError("audio_strip_unavailable", "No ffmpeg binary is available to remove sound from site video");
  }
}

export const runFfmpeg: FfmpegRunner = (binary, args, { timeoutMs }) => new Promise((resolve, reject) => {
  const child = spawn(binary, [...args], { stdio: ["ignore", "ignore", "pipe"], timeout: timeoutMs, killSignal: "SIGKILL" });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-STDERR_LIMIT); });
  child.once("error", reject);
  child.once("close", (exitCode) => resolve({ exitCode, stderr }));
});

/** Stream kinds ffmpeg lists for its first input, in order. */
export function listedStreamKinds(stderr: string): string[] | null {
  if (!/^Input #0, /m.test(stderr)) return null;
  return [...stderr.matchAll(/^\s*Stream #0:\d+\S*: (Video|Audio|Data|Subtitle|Attachment):/gm)].map((match) => match[1]);
}

const audioFree = new WeakSet<object>();
/** True only for copies made (and not yet cleaned up) by `stripVideoAudio`. */
export function isAudioFreeVideo(value: unknown): value is AudioFreeVideo {
  return typeof value === "object" && value !== null && audioFree.has(value);
}

async function writeSource(body: VideoBytes["body"], file: string) {
  if (body instanceof Uint8Array) {
    await writeFile(file, body, { flag: "wx", mode: 0o600 });
    return;
  }
  await pipeline(Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>), createWriteStream(file, { flags: "wx", mode: 0o600 }));
}

async function sha256Of(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/**
 * Copy the video without its sound and prove the copy has none.
 *
 * Reads the source to the end, so a streamed source's own length and hash
 * checks complete here; a source read error is rethrown as it is. Temporary
 * files live in a private directory that is removed on failure, and by
 * `cleanup()` on success.
 */
export async function stripVideoAudio(video: VideoBytes, options: AudioStripOptions = {}): Promise<AudioFreeVideo> {
  const container = CONTAINERS[video.contentType.split(";")[0].trim().toLowerCase()];
  const binary = container ? await (options.resolveBinary ?? resolveFfmpegBinary)() : null;
  if (!container || !binary) {
    // Nothing will read a streamed source now; release its connection.
    if (!(video.body instanceof Uint8Array)) await video.body.cancel().catch(() => undefined);
    throw container
      ? new AudioStripError("audio_strip_unavailable", "No ffmpeg binary is available to remove sound from site video")
      : new AudioStripError("audio_strip_failed", `Cannot remove sound from ${video.contentType || "an unknown type"}`);
  }
  const run = options.run ?? runFfmpeg;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dir = await mkdtemp(path.join(options.tmpDir ?? os.tmpdir(), "blueprint-video-"));
  const source = path.join(dir, `source.${container.extension}`);
  const output = path.join(dir, `video-only.${container.extension}`);
  const opened = new Set<Readable>();
  let released = false;
  const cleanup = async () => {
    released = true;
    for (const stream of opened) stream.destroy();
    opened.clear();
    await rm(dir, { recursive: true, force: true });
  };
  try {
    await writeSource(video.body, source);
    let remux: Awaited<ReturnType<FfmpegRunner>>;
    try {
      remux = await run(binary, [
        "-hide_banner", "-nostdin", "-loglevel", "error",
        "-protocol_whitelist", "file", "-f", container.demuxer, "-i", source,
        "-map", "0:v", "-c", "copy", "-an", "-sn", "-dn",
        "-f", container.muxer, "-y", output,
      ], { timeoutMs });
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException)?.code === "ENOENT" || (error as NodeJS.ErrnoException)?.code === "EACCES";
      throw new AudioStripError(missing ? "audio_strip_unavailable" : "audio_strip_failed",
        `ffmpeg could not be run to remove sound: ${(error as Error)?.message ?? "unknown error"}`);
    }
    // The original is not needed once the copy exists; do not keep two.
    await rm(source, { force: true });
    if (remux.exitCode !== 0) {
      throw new AudioStripError("audio_strip_failed", `ffmpeg could not make a video-only copy (exit ${remux.exitCode ?? "signal"})`);
    }
    const size = await stat(output).then((info) => info.size, () => 0);
    if (!size) throw new AudioStripError("audio_strip_failed", "ffmpeg produced an empty video-only copy");

    // Read the copy back and list its streams. Any audio, any non-video
    // stream, or a listing that cannot be read means it is not sent.
    let probe: Awaited<ReturnType<FfmpegRunner>>;
    try {
      probe = await run(binary, ["-hide_banner", "-nostdin", "-protocol_whitelist", "file", "-f", container.demuxer, "-i", output], { timeoutMs });
    } catch {
      throw new AudioStripError("audio_strip_unverified", "ffmpeg could not read back the video-only copy");
    }
    const kinds = listedStreamKinds(probe.stderr);
    const videoStreams = kinds?.filter((kind) => kind === "Video").length ?? 0;
    if (!kinds || !videoStreams || kinds.length !== videoStreams) {
      throw new AudioStripError("audio_strip_unverified",
        `The video-only copy could not be verified (streams: ${kinds ? kinds.join(",") || "none" : "unlisted"})`);
    }

    const result: AudioFreeVideo = {
      byteLength: size,
      contentType: container.contentType,
      sha256: await sha256Of(output),
      videoStreams,
      open() {
        if (released) throw new AudioStripError("audio_strip_required", "The video-only copy has been cleaned up");
        const stream = createReadStream(output);
        opened.add(stream);
        stream.once("close", () => opened.delete(stream));
        return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
      },
      async readAll() {
        if (released) throw new AudioStripError("audio_strip_required", "The video-only copy has been cleaned up");
        return readFile(output);
      },
      async cleanup() {
        audioFree.delete(result);
        await cleanup();
      },
    };
    audioFree.add(result);
    return result;
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error;
  }
}
