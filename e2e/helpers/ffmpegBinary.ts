import ffmpegStatic from "ffmpeg-static";

/**
 * The ffmpeg the specs make their synthetic test videos with: the binary the app itself ships and uses
 * (`ffmpeg-static`, `server/agents/adapters/video-audio-strip.ts`), so a CI job downloads no system package for it.
 */
export const FFMPEG_BINARY: string = (() => {
  if (!ffmpegStatic) throw new Error("ffmpeg-static has no binary for this platform");
  return ffmpegStatic as unknown as string;
})();
