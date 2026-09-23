/**
 * Pure helpers for scripts/cloud/fetch-media.ts, kept free of I/O so
 * media-lib.test.ts can pin them down.
 */

export type GsLocation = { bucket: string; object: string };

export type MediaSource =
  | { kind: "gs"; bucket: string; object: string }
  | { kind: "https"; url: string };

export type FetchMediaArgs = {
  source?: string;
  sha256?: string;
  outDir?: string;
  help: boolean;
};

const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** `gs://bucket/path/to/object` -> `{ bucket, object }`; anything else throws. */
export function parseGsUrl(url: string): GsLocation {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(url.trim());
  if (!match) throw new Error(`not a gs://bucket/object URL: ${url}`);
  const [, bucket, object] = match;
  if (!BUCKET_NAME.test(bucket)) throw new Error(`invalid bucket name "${bucket}"`);
  if (object.endsWith("/")) throw new Error(`gs:// URL names a folder, not an object: ${url}`);
  return { bucket, object };
}

/** Accepts bare hex or `sha256:hex` (any case) and returns lowercase hex. */
export function normalizeSha256(value: string): string {
  const hex = value.trim().toLowerCase().replace(/^sha256:/, "");
  if (!SHA256_HEX.test(hex)) {
    throw new Error("expected a SHA-256 digest: 64 hex characters, optionally prefixed with sha256:");
  }
  return hex;
}

export function digestMatches(expected: string, actual: string): boolean {
  try {
    return normalizeSha256(expected) === normalizeSha256(actual);
  } catch {
    return false;
  }
}

/**
 * A file name that cannot leave the output directory: only the last path
 * segment survives, control characters and leading dots are dropped, and an
 * empty result falls back to `fallback`.
 */
export function safeOutputName(name: string, fallback = "media"): string {
  const last = name.split(/[\\/]/).pop() ?? "";
  const cleaned = last.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^\.+/, "");
  if (!cleaned) return fallback;
  return cleaned.length > 200 ? cleaned.slice(-200) : cleaned;
}

/** Only gs:// objects and https:// URLs are accepted. */
export function parseMediaSource(source: string): MediaSource {
  const trimmed = source.trim();
  if (trimmed.startsWith("gs://")) return { kind: "gs", ...parseGsUrl(trimmed) };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("source must be a gs://bucket/object or https:// URL");
  }
  if (url.protocol !== "https:") throw new Error("source must be a gs://bucket/object or https:// URL");
  return { kind: "https", url: url.toString() };
}

/**
 * A URL safe to print: signed download URLs carry their token in the query
 * string (and could carry credentials before the host), so both go.
 */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}${url.search ? "?<redacted>" : ""}`;
  } catch {
    return "<unparseable url>";
  }
}

export function describeSource(source: MediaSource): string {
  return source.kind === "gs" ? `gs://${source.bucket}/${source.object}` : redactUrl(source.url);
}

/** Output file name for a source: the object's or URL path's last segment. */
export function sourceFileName(source: MediaSource): string {
  if (source.kind === "gs") return safeOutputName(source.object);
  const segment = new URL(source.url).pathname.split("/").filter(Boolean).pop() ?? "";
  let decoded = segment;
  try {
    // Firebase Storage download URLs encode the object path in one segment.
    decoded = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  return safeOutputName(decoded);
}

export function parseFetchMediaArgs(argv: string[]): FetchMediaArgs {
  const args: FetchMediaArgs = { help: false };
  const takeValue = (flag: string, index: number): string => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg === "--sha256") args.sha256 = takeValue(arg, index++);
    else if (arg.startsWith("--sha256=")) args.sha256 = arg.slice("--sha256=".length);
    else if (arg === "--out") args.outDir = takeValue(arg, index++);
    else if (arg.startsWith("--out=")) args.outDir = arg.slice("--out=".length);
    else if (arg.startsWith("-")) throw new Error(`unknown option ${arg}`);
    else if (args.source === undefined) args.source = arg;
    else throw new Error(`unexpected argument ${arg}`);
  }
  if (!args.help) {
    if (!args.source) throw new Error("missing source (gs://bucket/object or https:// URL)");
    if (!args.sha256) throw new Error("missing --sha256 <hex|sha256:hex>");
    args.sha256 = normalizeSha256(args.sha256);
  }
  return args;
}

export type MediaSummary = {
  format?: string;
  duration_seconds?: number;
  bit_rate?: number;
  streams: number;
  video?: {
    codec?: string;
    width?: number;
    height?: number;
    rotation?: number;
    frame_rate?: string;
    frames?: number;
  };
  audio?: { codec?: string; channels?: number; sample_rate?: number };
};

type ProbeStream = Record<string, unknown> & {
  codec_type?: string;
  side_data_list?: Array<Record<string, unknown>>;
  tags?: Record<string, unknown>;
};

const toNumber = (value: unknown): number | undefined => {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
};
const toText = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

/** Rotation from the display matrix side data, or the legacy `rotate` tag. */
function streamRotation(stream: ProbeStream): number | undefined {
  const matrix = stream.side_data_list?.find((entry) => entry.side_data_type === "Display Matrix");
  return toNumber(matrix?.rotation) ?? toNumber(stream.tags?.rotate);
}

/** Condenses `ffprobe -show_format -show_streams -of json` output. */
export function summarizeFfprobe(probe: unknown): MediaSummary {
  const data = (probe && typeof probe === "object" ? probe : {}) as {
    format?: Record<string, unknown>;
    streams?: ProbeStream[];
  };
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const summary: MediaSummary = {
    format: toText(data.format?.format_name),
    duration_seconds: toNumber(data.format?.duration),
    bit_rate: toNumber(data.format?.bit_rate),
    streams: streams.length,
  };
  const video = streams.find((stream) => stream.codec_type === "video");
  if (video) {
    summary.video = {
      codec: toText(video.codec_name),
      width: toNumber(video.width),
      height: toNumber(video.height),
      rotation: streamRotation(video),
      frame_rate: toText(video.avg_frame_rate),
      frames: toNumber(video.nb_frames),
    };
  }
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (audio) {
    summary.audio = {
      codec: toText(audio.codec_name),
      channels: toNumber(audio.channels),
      sample_rate: toNumber(audio.sample_rate),
    };
  }
  return summary;
}
