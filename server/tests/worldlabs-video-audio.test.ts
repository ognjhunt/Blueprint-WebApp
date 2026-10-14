// @vitest-environment node
/**
 * World Labs receives site video only as a video-only copy Blueprint uploads.
 * A raw video URI (which World Labs would fetch with its sound) is never sent,
 * and when sound cannot be removed nothing is sent at all.
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ storageAdmin: null, dbAdmin: null, default: {} }));

import { createWorldFromRequestManifest } from "../utils/worldlabs";

function installed(name: string) {
  const candidates = [name === "ffmpeg" ? process.env.BLUEPRINT_FFMPEG_PATH : undefined, `/usr/bin/${name}`, `/usr/local/bin/${name}`];
  return candidates.find((candidate) => {
    if (!candidate) return false;
    try { accessSync(candidate, constants.X_OK); return true; } catch { return false; }
  }) ?? null;
}
const ffmpeg = installed("ffmpeg");
const ffprobe = installed("ffprobe");

let dir: string;
const calls: Array<{ url: string; method: string; body: unknown }> = [];
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "worldlabs-audio-"));
  calls.length = 0;
  vi.stubEnv("WORLDLABS_API_KEY", "synthetic-offline-key");
  vi.stubEnv("WORLDLABS_API_BASE_URL", "https://worldlabs.invalid");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.endsWith("/media-assets:prepare_upload")) {
      return new Response(JSON.stringify({ media_asset: { media_asset_id: "asset-1" },
        upload_info: { upload_url: "https://upload.invalid/asset-1", upload_method: "PUT" } }), { status: 200 });
    }
    if (url === "https://upload.invalid/asset-1") return new Response("", { status: 200 });
    if (url.endsWith("/worlds:generate")) return new Response(JSON.stringify({ operation_id: "op-1" }), { status: 200 });
    throw new Error(`unexpected request ${url}`);
  }));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

const manifest = (selected: string, sourceType?: string) => ({
  scene_id: "scene-1", capture_id: "capture-1", selected_video_uri: selected,
  ...(sourceType ? { generation_source_type: sourceType } : {}),
  generation_request: { model: "marble-test", world_prompt: { video_prompt: { uri: selected } } },
});

it("sends nothing to World Labs when sound cannot be removed", async () => {
  vi.stubEnv("BLUEPRINT_FFMPEG_PATH", path.join(dir, "no-ffmpeg-here"));
  const clip = path.join(dir, "walkthrough.mp4");
  await writeFile(clip, "synthetic");
  await expect(createWorldFromRequestManifest(manifest(clip))).rejects.toMatchObject({ code: "audio_strip_unavailable" });
  expect(calls).toHaveLength(0);
});

describe.skipIf(!ffmpeg)("with the installed ffmpeg", () => {
  it.each([undefined, "video_uri"])("uploads a video-only copy and never the raw URI (requested source: %s)", async (sourceType) => {
    vi.stubEnv("BLUEPRINT_FFMPEG_PATH", ffmpeg!);
    const clip = path.join(dir, "walkthrough.mov");
    execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000",
      "-t", "1", "-c:v", "mpeg4", "-c:a", "aac", "-shortest", "-y", clip]);

    const { generationSourceType, generationRequest } = await createWorldFromRequestManifest(manifest(clip, sourceType));

    expect(generationSourceType).toBe("video_media_asset");
    const videoPrompt = (generationRequest.world_prompt as any).video_prompt;
    expect(videoPrompt).toMatchObject({ source: "media_asset", media_asset_id: "asset-1" });
    expect(videoPrompt).not.toHaveProperty("uri");
    expect(JSON.stringify(calls.map((call) => call.url === "https://upload.invalid/asset-1" ? null : call.body))).not.toContain(clip);
    const prepare = JSON.parse(String(calls.find((call) => call.url.endsWith(":prepare_upload"))!.body));
    expect(prepare).toMatchObject({ extension: "mov", kind: "video", file_name: "walkthrough.mov" });

    const upload = calls.find((call) => call.url === "https://upload.invalid/asset-1")!;
    const sent = path.join(dir, "sent.mov");
    await writeFile(sent, upload.body as Uint8Array);
    if (ffprobe) {
      const kinds = execFileSync(ffprobe, ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", sent], { encoding: "utf8" })
        .trim().split("\n");
      expect(kinds).toEqual(["video"]);
    }
  });
});
