// @vitest-environment node
/**
 * Sound is removed from site video before it reaches any provider, and when it
 * cannot be, nothing is sent.
 *
 * The fail-closed paths run against an injected runner, so they hold on any
 * machine. The real remux runs against an installed ffmpeg (BLUEPRINT_FFMPEG_PATH
 * or /usr/bin/ffmpeg) and is checked independently with ffprobe; those cases
 * skip where no binary is installed.
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioStripError,
  assertAudioStripAvailable,
  isAudioFreeVideo,
  listedStreamKinds,
  resolveFfmpegBinary,
  stripVideoAudio,
  type FfmpegRunner,
} from "../agents/adapters/video-audio-strip";

function installed(name: string) {
  const candidates = [name === "ffmpeg" ? process.env.BLUEPRINT_FFMPEG_PATH : undefined, `/usr/bin/${name}`, `/usr/local/bin/${name}`];
  return candidates.find((candidate) => {
    if (!candidate) return false;
    try { accessSync(candidate, constants.X_OK); return true; } catch { return false; }
  }) ?? null;
}
const ffmpeg = installed("ffmpeg");
const ffprobe = installed("ffprobe");

let tmpDir: string;
beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "audio-strip-test-")); });
afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); vi.unstubAllEnvs(); });

const source = (contentType = "video/mp4") => {
  const body = Buffer.from("not-really-video");
  return { body, byteLength: body.byteLength, contentType };
};
const listing = (...kinds: string[]) => `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'x':\n${kinds
  .map((kind, index) => `  Stream #0:${index}[0x${index + 1}](und): ${kind}: fixture\n`).join("")}`;
/** Copies input to output on the remux call; lists `kinds` on the read-back call. */
const runner = (kinds: string[], remuxExitCode: number | null = 0): FfmpegRunner & { calls: string[][] } => {
  const calls: string[][] = [];
  const run = (async (_binary, args) => {
    calls.push([...args]);
    if (args.includes("-an")) {
      if (remuxExitCode === 0) await writeFile(args[args.length - 1], await readFile(args[args.indexOf("-i") + 1]));
      return { exitCode: remuxExitCode, stderr: "" };
    }
    return { exitCode: 1, stderr: listing(...kinds) };
  }) as FfmpegRunner & { calls: string[][] };
  run.calls = calls;
  return run;
};
const leftovers = async () => (await readdir(tmpDir)).length;

describe("fail closed", () => {
  it("refuses without a binary, before writing anything", async () => {
    const run = runner(["Video"]);
    await expect(stripVideoAudio(source(), { resolveBinary: async () => null, run, tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_unavailable" });
    expect(run.calls).toHaveLength(0);
    expect(await leftovers()).toBe(0);
    await expect(assertAudioStripAvailable({ resolveBinary: async () => null })).rejects.toBeInstanceOf(AudioStripError);
  });

  it("releases an unread streamed source when it refuses", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull() { /* never yields */ }, cancel });
    await expect(stripVideoAudio({ body, byteLength: 10, contentType: "video/mp4" }, { resolveBinary: async () => null, tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_unavailable" });
    expect(cancel).toHaveBeenCalled();
  });

  it("treats a binary that cannot be started as unavailable", async () => {
    const run: FfmpegRunner = async () => { throw Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }); };
    await expect(stripVideoAudio(source(), { resolveBinary: async () => "/missing/ffmpeg", run, tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_unavailable" });
    expect(await leftovers()).toBe(0);
  });

  it.each([
    ["the remux fails", runner(["Video"], 1), "audio_strip_failed"],
    ["the remux is killed", runner(["Video"], null), "audio_strip_failed"],
    ["the copy still lists audio", runner(["Video", "Audio"]), "audio_strip_unverified"],
    ["the copy lists a data stream", runner(["Video", "Data"]), "audio_strip_unverified"],
    ["the copy lists no video", runner(["Audio"]), "audio_strip_unverified"],
  ] as const)("withholds the video when %s, and removes its temporary files", async (_label, run, code) => {
    await expect(stripVideoAudio(source(), { resolveBinary: async () => "/fake/ffmpeg", run, tmpDir }))
      .rejects.toMatchObject({ code });
    expect(await leftovers()).toBe(0);
  });

  it("withholds the video when the read-back cannot be parsed", async () => {
    const run: FfmpegRunner = async (_binary, args) => {
      if (args.includes("-an")) { await writeFile(args[args.length - 1], "copy"); return { exitCode: 0, stderr: "" }; }
      return { exitCode: 1, stderr: "something unexpected" };
    };
    await expect(stripVideoAudio(source(), { resolveBinary: async () => "/fake/ffmpeg", run, tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_unverified" });
    expect(await leftovers()).toBe(0);
  });

  it("refuses a container it cannot strip", async () => {
    await expect(stripVideoAudio(source("video/x-msvideo"), { resolveBinary: async () => "/fake/ffmpeg", run: runner(["Video"]), tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_failed" });
  });

  it("forces the demuxer, drops every non-video stream and does not re-encode", async () => {
    const run = runner(["Video"]);
    const copy = await stripVideoAudio(source("video/quicktime"), { resolveBinary: async () => "/fake/ffmpeg", run, tmpDir });
    try {
      const [remux, probe] = run.calls;
      expect(remux).toEqual(expect.arrayContaining(["-protocol_whitelist", "file", "-f", "mov", "-map", "0:v", "-c", "copy", "-an", "-sn", "-dn"]));
      expect(remux.slice(remux.indexOf("-i") - 2, remux.indexOf("-i"))).toEqual(["-f", "mov"]);
      expect(probe).not.toContain("-an");
      expect(copy).toMatchObject({ contentType: "video/quicktime", videoStreams: 1 });
      expect(isAudioFreeVideo(copy)).toBe(true);
      // Only the video-only copy remains; the source was removed once copied.
      const [dir] = await readdir(tmpDir);
      expect(await readdir(path.join(tmpDir, dir))).toEqual(["video-only.mov"]);
    } finally {
      await copy.cleanup();
    }
    expect(isAudioFreeVideo(copy)).toBe(false);
    expect(() => copy.open()).toThrow(AudioStripError);
    await expect(copy.readAll()).rejects.toMatchObject({ code: "audio_strip_required" });
    expect(await leftovers()).toBe(0);
    await copy.cleanup();
  });
});

describe("resolving the binary", () => {
  it("uses an absolute, executable override and never a bare name from PATH", async () => {
    const fake = path.join(tmpDir, "ffmpeg");
    await writeFile(fake, "#!/bin/sh\nexit 0\n");
    await chmod(fake, 0o755);
    expect(await resolveFfmpegBinary({ BLUEPRINT_FFMPEG_PATH: fake })).toBe(fake);
    expect(await resolveFfmpegBinary({ BLUEPRINT_FFMPEG_PATH: "ffmpeg" })).toBeNull();
    expect(await resolveFfmpegBinary({ BLUEPRINT_FFMPEG_PATH: path.join(tmpDir, "missing") })).toBeNull();
    await chmod(fake, 0o644);
    expect(await resolveFfmpegBinary({ BLUEPRINT_FFMPEG_PATH: fake })).toBeNull();
  });

  it("reads stream kinds from ffmpeg's input listing only", () => {
    expect(listedStreamKinds([
      "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/tmp/x/video-only.mov':",
      "  Metadata:", "    major_brand     : qt  ",
      "  Duration: 00:00:01.00, start: 0.000000, bitrate: 120 kb/s",
      "  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 160x120, 10 fps",
      "  Stream #0:1(eng): Audio: aac (LC) (mp4a / 0x6134706D), 8000 Hz, mono",
      "At least one output file must be specified",
    ].join("\n"))).toEqual(["Video", "Audio"]);
    expect(listedStreamKinds("Stream #0:0: Video: h264")).toBeNull();
  });
});

describe.skipIf(!ffmpeg)("with the installed ffmpeg", () => {
  function makeClip(name: string) {
    const file = path.join(tmpDir, name);
    execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000",
      "-t", "1", "-c:v", "mpeg4", "-c:a", "aac", "-shortest", "-y", file]);
    return file;
  }
  function streamKinds(file: string) {
    if (ffprobe) {
      return execFileSync(ffprobe, ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file], { encoding: "utf8" })
        .trim().split("\n").filter(Boolean);
    }
    let stderr = "";
    try { execFileSync(ffmpeg!, ["-hide_banner", "-i", file], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] }); }
    catch (error) { stderr = String((error as { stderr?: string }).stderr ?? ""); }
    return (listedStreamKinds(stderr) ?? []).map((kind) => kind.toLowerCase());
  }

  it.each([["clip.mp4", "video/mp4"], ["clip.mov", "video/quicktime"]] as const)(
    "removes the audio track from a %s and keeps the video as recorded", async (name, contentType) => {
      const clip = makeClip(name);
      expect(streamKinds(clip).sort()).toEqual(["audio", "video"]);
      const body = await readFile(clip);
      const copy = await stripVideoAudio({ body, byteLength: body.byteLength, contentType },
        { resolveBinary: async () => ffmpeg, tmpDir });
      const out = path.join(tmpDir, "sent.bin");
      try {
        await writeFile(out, await copy.readAll());
        expect(streamKinds(out)).toEqual(["video"]);
        expect(copy).toMatchObject({ contentType, videoStreams: 1 });
        expect(copy.byteLength).toBeLessThan(body.byteLength);
        // Copied, not re-encoded: the same codec comes back out.
        if (ffprobe) {
          const codec = (file: string) => execFileSync(ffprobe, ["-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,nb_frames", "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
          expect(codec(out)).toBe(codec(clip));
        }
      } finally {
        await copy.cleanup();
      }
      expect((await readdir(tmpDir)).sort()).toEqual([name, "sent.bin"].sort());
    });

  it("reads a streamed source to the end before copying it", async () => {
    const clip = makeClip("streamed.mp4");
    const body = await readFile(clip);
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= body.byteLength) { controller.close(); return; }
        controller.enqueue(body.subarray(offset, offset + 4096));
        offset += 4096;
      },
    });
    const copy = await stripVideoAudio({ body: stream, byteLength: body.byteLength, contentType: "video/mp4" },
      { resolveBinary: async () => ffmpeg, tmpDir });
    try {
      expect(offset).toBeGreaterThanOrEqual(body.byteLength);
      const chunks: Uint8Array[] = [];
      const reader = copy.open().getReader();
      for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); }
      expect(Buffer.concat(chunks)).toEqual(await copy.readAll());
    } finally {
      await copy.cleanup();
    }
  });

  it("refuses a file ffmpeg cannot read as the declared container", async () => {
    await expect(stripVideoAudio(source("video/mp4"), { resolveBinary: async () => ffmpeg, tmpDir }))
      .rejects.toMatchObject({ code: "audio_strip_failed" });
    expect(existsSync(tmpDir) && (await readdir(tmpDir)).length).toBe(0);
  });
});
