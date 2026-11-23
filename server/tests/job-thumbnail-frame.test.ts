// @vitest-environment node
/**
 * The frame a job's thumbnail is made from (`jobThumbnail.ts`): where in the clip it is looked for, and that the real
 * ffmpeg arguments give one PNG that fits 480 by 300 and passes `sanitizeTaskThumbnail`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { frameArguments, frameSearchStart } from "../utils/jobThumbnail";
import { sanitizeTaskThumbnail } from "../utils/taskThumbnail";
import { resolveFfmpegBinary } from "../agents/adapters/video-audio-strip";

describe("the thumbnail's frame", () => {
  it("looks a third of the way in, at least a second before the end, and from the start when the length is unknown", () => {
    expect(frameSearchStart(12)).toBe(4);
    expect(frameSearchStart(1.2)).toBeCloseTo(0.2);
    expect(frameSearchStart(0.5)).toBe(0);
    expect(frameSearchStart(null)).toBe(0);
    expect(frameSearchStart(Number.NaN)).toBe(0);
  });

  it("gives one PNG that fits 480 by 300 from a real clip", async () => {
    const binary = await resolveFfmpegBinary();
    if (!binary) return; // No ffmpeg on this machine: the stubbed tests cover the rest.
    const folder = mkdtempSync(path.join(os.tmpdir(), "thumbnail-frame-"));
    try {
      const clip = path.join(folder, "clip.mp4");
      expect(spawnSync(binary, ["-hide_banner", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=15", "-t", "3",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", clip]).status).toBe(0);
      const frame = spawnSync(binary, frameArguments(clip, frameSearchStart(3)), { maxBuffer: 4 * 1024 * 1024 });
      expect(frame.status).toBe(0);
      const png = frame.stdout as Buffer;
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([480, 270]);
      expect(sanitizeTaskThumbnail(png.toString("base64")).digest).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 30_000);
});
