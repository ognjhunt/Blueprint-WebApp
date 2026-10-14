/**
 * An in-process stand-in for ffmpeg, for tests whose "video" bytes are not
 * real video. The remux call copies its input to its output; the read-back
 * call lists the configured streams (one video stream by default). The real
 * stripping module still runs around it (temporary files, read-back check,
 * cleanup, the upload guard), so these tests keep exercising the only route
 * video takes to a provider.
 *
 * Real ffmpeg behaviour is covered by video-audio-strip.test.ts.
 *
 * Use as:
 *   vi.mock("../agents/adapters/video-audio-strip", async (importOriginal) =>
 *     (await import("./helpers/fake-ffmpeg")).withFakeFfmpeg(await importOriginal()));
 */
import { copyFile } from "node:fs/promises";

import type * as AudioStrip from "../../agents/adapters/video-audio-strip";

/** Mutable per test; call `reset()` in a hook or `finally`. */
export const fakeFfmpeg = {
  available: true,
  remuxExitCode: 0 as number | null,
  listedKinds: ["Video"] as string[],
  calls: [] as string[][],
  reset() {
    this.available = true; this.remuxExitCode = 0; this.listedKinds = ["Video"]; this.calls.length = 0;
  },
};

export const fakeFfmpegRunner: AudioStrip.FfmpegRunner = async (_binary, args) => {
  fakeFfmpeg.calls.push([...args]);
  const input = args[args.indexOf("-i") + 1];
  if (args.includes("-an")) {
    if (fakeFfmpeg.remuxExitCode === 0) await copyFile(input, args[args.length - 1]);
    return { exitCode: fakeFfmpeg.remuxExitCode, stderr: "" };
  }
  const streams = fakeFfmpeg.listedKinds.map((kind, index) => `  Stream #0:${index}[0x${index + 1}](und): ${kind}: fixture\n`).join("");
  return { exitCode: 1, stderr: `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '${input}':\n${streams}At least one output file must be specified\n` };
};

/** The real module, with stripping run by the fake binary. */
export function withFakeFfmpeg(actual: typeof AudioStrip): typeof AudioStrip {
  const resolveBinary = async () => (fakeFfmpeg.available ? "/fake/ffmpeg" : null);
  return {
    ...actual,
    assertAudioStripAvailable: (options = {}) => actual.assertAudioStripAvailable({ resolveBinary, ...options }),
    stripVideoAudio: (video, options = {}) => actual.stripVideoAudio(video, { resolveBinary, run: fakeFfmpegRunner, ...options }),
  };
}
