/**
 * What a video's own container header says about it, read on the server.
 *
 * A browser upload no longer has to be playable in the browser that sends it:
 * an iPhone HEVC `.MOV` often is not, in Chrome or Firefox on Windows or
 * Android. The spooled file is already on this server's disk, so its header is
 * read here with the same pinned ffmpeg binary that strips audio
 * (`resolveFfmpegBinary`), and nothing is decoded.
 *
 * Best effort and never throws. No binary, a timeout, or a header ffmpeg
 * cannot parse all return `{}`, and the caller records those fields as
 * unknown. Nothing is defaulted.
 */
import { resolveFfmpegBinary, runFfmpeg, type FfmpegRunner } from "../agents/adapters/video-audio-strip";

export type ContainerVideoMetadata = {
  widthPx?: number;
  heightPx?: number;
  fps?: number;
  durationSeconds?: number;
  recordedAtEpochMs?: number;
};

const PROBE_TIMEOUT_MS = 20_000;

function positive(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Parse `ffmpeg -i` stderr for its first input's first video stream. */
export function parseContainerHeader(stderr: string): ContainerVideoMetadata {
  if (!/^Input #0, /m.test(stderr)) return {};
  const out: ContainerVideoMetadata = {};

  const duration = /^\s*Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/m.exec(stderr);
  if (duration) {
    out.durationSeconds = positive(Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]));
  }

  // Container-level creation time precedes the streams; a stream's own tag is
  // the same clock on phone files.
  const created = /^\s*creation_time\s*: (\S+)/m.exec(stderr);
  if (created) out.recordedAtEpochMs = positive(Date.parse(created[1]));

  const streamMatch = /^\s*Stream #0:\d+\S*: Video: .*$/m.exec(stderr);
  if (!streamMatch) return out;
  const stream = streamMatch[0];
  const size = /, (\d{1,5})x(\d{1,5})[ ,]/.exec(stream);
  const fps = /, (\d+(?:\.\d+)?) fps/.exec(stream);
  if (fps) out.fps = positive(Number(fps[1]));
  if (size) {
    let width = Number(size[1]);
    let height = Number(size[2]);
    // ffmpeg prints the encoded size and the display rotation separately; a
    // portrait phone video is stored landscape. Report what the browser would
    // have: the size as displayed.
    const rest = stderr.slice(streamMatch.index + stream.length);
    const nextStream = rest.search(/^\s*Stream #/m);
    const rotation = /displaymatrix: rotation of (-?\d+(?:\.\d+)?) degrees/
      .exec(nextStream === -1 ? rest : rest.slice(0, nextStream));
    if (rotation && Math.abs(Math.round(Number(rotation[1]) / 90)) % 2 === 1) [width, height] = [height, width];
    out.widthPx = positive(width);
    out.heightPx = positive(height);
  }
  return out;
}

export async function probeVideoContainer(
  path: string,
  options: { resolveBinary?: () => Promise<string | null>; run?: FfmpegRunner } = {},
): Promise<ContainerVideoMetadata> {
  try {
    const binary = await (options.resolveBinary ?? resolveFfmpegBinary)();
    if (!binary) return {};
    // No output file: ffmpeg prints the input's header and exits non-zero,
    // which is expected here.
    const { stderr } = await (options.run ?? runFfmpeg)(binary,
      ["-hide_banner", "-nostdin", "-i", path], { timeoutMs: PROBE_TIMEOUT_MS });
    return parseContainerHeader(stderr);
  } catch {
    return {};
  }
}
