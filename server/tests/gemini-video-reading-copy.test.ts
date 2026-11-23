// @vitest-environment node
/**
 * The video reading reads any video the start form accepts.
 *
 * It refused every video over 64 MB ("video_too_large: Task video is 73MB; the limit is 64MB"), although a link that
 * declares its length (every stored upload's signed URL) is streamed to a temporary file and never held in memory, and
 * a phone records 60 to 400 MB a minute. Now such a video is streamed up to what the start form accepts, and a video
 * over 64 MB is sent as a smaller sound-free reading copy: its first video stream, at most 1280 px on its long side,
 * 4 frames a second (every video task samples at most 2), made from the file on disk and deleted afterwards.
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openVideo, runGeminiVideoTask } from "../agents/adapters/gemini-video";
import { READING_COPY_FPS, stripVideoAudio } from "../agents/adapters/video-audio-strip";
import { captureCoverageTask } from "../agents/tasks/capture-coverage";
import { captureVideoPrivacyTask } from "../agents/tasks/capture-video-privacy";
import { siteVideoEvidenceTask } from "../agents/tasks/site-video-evidence";
import { fakeFfmpeg } from "./helpers/fake-ffmpeg";

const publicVideoFetch = vi.hoisted(() => vi.fn());
vi.mock("../agents/adapters/video-audio-strip", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../agents/adapters/video-audio-strip")>();
  const fake = (await import("./helpers/fake-ffmpeg")).withFakeFfmpeg(actual);
  // The adapter strips with the in-process fake; the real-ffmpeg cases below call the real module themselves.
  return { ...fake, realStripVideoAudio: actual.stripVideoAudio };
});
vi.mock("../agents/adapters/public-video-fetch", () => ({ fetchPublicVideo: publicVideoFetch }));

const MB = 1024 * 1024;
/** A clip served with a declared length, in 1 MB chunks, as storage serves a signed URL. */
function servedClip(bytes: number) {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) { controller.close(); return; }
      const size = Math.min(MB, bytes - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytes) } });
}
const drain = async (body: unknown) => {
  if (Buffer.isBuffer(body)) return body.byteLength;
  let total = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) total += chunk.byteLength;
  return total;
};

let tmpDir: string;
beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), "reading-copy-test-")); fakeFfmpeg.reset(); });
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  fakeFfmpeg.reset();
  publicVideoFetch.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("opening a video over 64 MB", () => {
  it("streams a 73 MB video with a declared length instead of refusing it", async () => {
    const video = await openVideo("https://storage.example.com/raw/walkthrough.mp4", vi.fn(async () => servedClip(73 * MB)));
    expect(Buffer.isBuffer(video.body)).toBe(false);
    expect(video.byteLength).toBe(73 * MB);
    expect(await drain(video.body)).toBe(73 * MB);
    expect(video.receipt().bytes).toBe(73 * MB);
  });

  it("refuses only what the start form would not accept, before reading any of it", async () => {
    await expect(openVideo("https://storage.example.com/raw/walkthrough.mp4",
      vi.fn(async () => servedClip(2 * 1024 * MB + 1)))).rejects.toMatchObject({ code: "video_too_large" });
    vi.stubEnv("SELF_CAPTURE_MAX_UPLOAD_BYTES", String(100 * MB));
    await expect(openVideo("https://storage.example.com/raw/walkthrough.mp4",
      vi.fn(async () => servedClip(100 * MB + 1)))).rejects.toMatchObject({ code: "video_too_large" });
  });
});

describe("the reading of a video over 64 MB", () => {
  const google = () => {
    const uploadUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=u1";
    const file = { name: "files/abc", uri: "https://generativelanguage.googleapis.com/v1beta/files/abc", mimeType: "video/mp4", state: "ACTIVE" };
    return vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith("/upload/v1beta/files")) return new Response("{}", { status: 200, headers: { "x-goog-upload-url": uploadUrl } });
      if (url === uploadUrl) {
        await drain(init.body);
        return new Response(JSON.stringify({ file }), { status: 200 });
      }
      if (url.endsWith("/v1beta/files/abc")) return new Response("{}", { status: 200 });
      if (url.includes(":generateContent")) return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP",
        content: { parts: [{ text: '{"decision":"clear","evidence_seconds":[]}' }] } }], usageMetadata: { totalTokenCount: 17 } }), { status: 200 });
      throw new Error(`unexpected ${url}`);
    });
  };
  async function read(bytes: number) {
    const provider = google();
    const fetcher = vi.fn(async (url: string, init: RequestInit = {}) =>
      url === "https://storage.example.com/raw/walkthrough.mp4" ? servedClip(bytes) : provider(url, init));
    vi.stubGlobal("fetch", fetcher);
    publicVideoFetch.mockImplementation((url, options) => fetcher(url, { signal: options.signal }));
    for (const name of ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "GOOGLE_GENAI_API_KEY"]) vi.stubEnv(name, "");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    return runGeminiVideoTask({ kind: "capture_video_privacy", model: "gemini-3.8-flash",
      input: { taskVideoUrl: "https://storage.example.com/raw/walkthrough.mp4" },
      definition: captureVideoPrivacyTask, tool_policy: { mode: "api" } } as never);
  }

  it("reads it, sending a smaller sound-free reading copy made from the file on disk", async () => {
    const result = await read(73 * MB);
    expect(result.error).toBeNull();
    expect(result.status).toBe("completed");
    expect(result.artifacts).toMatchObject({ video_bytes: 73 * MB,
      provider_video: { audio: "removed", content_type: "video/mp4", reading_copy: true } });
    const copy = fakeFfmpeg.calls.find(args => args.includes("-an"))!;
    expect(copy).toEqual(expect.arrayContaining(["-map", "0:v:0", "-an", "libx264", "-threads", "1"]));
    expect(copy[copy.indexOf("-vf") + 1]).toMatch(/^fps=4,scale='min\(1280,iw\)':'min\(1280,ih\)'/);
    expect(copy[copy.indexOf("-i") + 1]).toMatch(/source\.mp4$/);
  });

  it("sends a video of 64 MB or less as uploaded, without its sound, as before", async () => {
    const result = await read(2 * MB);
    expect(result.status).toBe("completed");
    expect(result.artifacts).toMatchObject({ provider_video: { reading_copy: false } });
    const copy = fakeFfmpeg.calls.find(args => args.includes("-an"))!;
    expect(copy).toEqual(expect.arrayContaining(["-map", "0:v", "-c", "copy"]));
    expect(copy).not.toContain("libx264");
  });
});

describe("what the reading copy keeps", () => {
  it("keeps every frame instant each video task samples", () => {
    for (const task of [captureCoverageTask, captureVideoPrivacyTask, siteVideoEvidenceTask]) {
      expect(task.video_processing_mode).toBe("STATIC");
      // Without a rate the provider samples 1 frame a second.
      const sampled = task.video_sampling_fps ?? 1;
      expect(READING_COPY_FPS % sampled).toBe(0);
    }
  });

  const ffmpeg = ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find(candidate => {
    try { accessSync(candidate, constants.X_OK); return true; } catch { return false; }
  });
  const ffprobe = ffmpeg && ffmpeg.replace(/ffmpeg$/, "ffprobe");
  it.skipIf(!ffmpeg)("is a real sound-free H.264 copy at 4 frames a second and at most 1280 px, and leaves nothing behind", async () => {
    const source = path.join(tmpDir, "phone.mp4");
    execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30",
      "-f", "lavfi", "-i", "sine=frequency=440", "-t", "3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest", "-y", source]);
    const { realStripVideoAudio } = await import("../agents/adapters/video-audio-strip") as unknown as { realStripVideoAudio: typeof stripVideoAudio };
    const { createReadStream } = await import("node:fs");
    const { Readable } = await import("node:stream");
    const work = path.join(tmpDir, "work");
    await (await import("node:fs/promises")).mkdir(work);
    const copy = await realStripVideoAudio({ body: Readable.toWeb(createReadStream(source)) as unknown as ReadableStream<Uint8Array>,
      byteLength: 1, contentType: "video/mp4" }, { resolveBinary: async () => ffmpeg!, tmpDir: work, readingCopyAboveBytes: 1 });
    try {
      expect(copy.readingCopy).toBe(true);
      expect(copy.contentType).toBe("video/mp4");
      const written = path.join(work, (await readdir(work))[0], "reading-copy.mp4");
      const streams = execFileSync(ffprobe!, ["-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate",
        "-of", "compact=p=0:nk=1", written], { encoding: "utf8" }).trim().split("\n");
      expect(streams).toEqual(["h264|video|1280|720|4/1"]);
    } finally { await copy.cleanup(); }
    expect(await readdir(work)).toEqual([]);
  });
});
