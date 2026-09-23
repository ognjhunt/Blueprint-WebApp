/**
 * Fetch a scene's source video into a cloud session and prove it is the
 * right bytes.
 *
 *   npx tsx scripts/cloud/fetch-media.ts <gs://bucket/object | https://url> --sha256 <hex|sha256:hex> [--out <dir>]
 *
 * gs:// objects are read with the Firebase service account through
 * client/src/lib/firebaseAdmin.ts (FIREBASE_SERVICE_ACCOUNT_JSON); https://
 * URLs are fetched directly. The bytes stream to <out>/<name>.partial while
 * being hashed. The file is renamed into place only when its SHA-256 matches;
 * on a mismatch the partial file is deleted and the command exits 1. A file
 * already at <out>/<name> with the right digest is reused without a download.
 *
 * The default <out> is <webapp>/.playwright-mcp/ (gitignored). Playwright MCP
 * uploads files only from its allowed roots, so staging the video there lets
 * browser automation attach it to the website's upload form.
 *
 * Prints one JSON object: path, size_bytes, sha256, source (a signed URL's
 * query string is redacted) and an ffprobe summary (duration, codec, width,
 * height, rotation) when ffprobe is installed.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import {
  describeSource,
  digestMatches,
  parseFetchMediaArgs,
  parseMediaSource,
  sourceFileName,
  summarizeFfprobe,
  type MediaSource,
  type MediaSummary,
} from "./media-lib";
import { importFirebaseAdmin, reexecWithEnvProxy, WEBAPP_ROOT } from "./runtime";

const USAGE =
  "usage: npx tsx scripts/cloud/fetch-media.ts <gs://bucket/object | https://url> --sha256 <hex|sha256:hex> [--out <dir>]";
const PROGRESS_INTERVAL_MS = 15_000;

async function hashFile(file: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk as Buffer);
    bytes += (chunk as Buffer).length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function openSource(source: MediaSource): Promise<{ stream: Readable; expectedBytes?: number }> {
  if (source.kind === "gs") {
    const { storageAdmin } = await importFirebaseAdmin();
    if (!storageAdmin) {
      throw new Error("Firebase Admin has no credentials; set FIREBASE_SERVICE_ACCOUNT_JSON to read gs:// objects");
    }
    const file = storageAdmin.bucket(source.bucket).file(source.object);
    const [metadata] = await file.getMetadata();
    const expectedBytes = Number(metadata.size);
    return {
      stream: file.createReadStream(),
      expectedBytes: Number.isFinite(expectedBytes) ? expectedBytes : undefined,
    };
  }
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${describeSource(source)} answered HTTP ${response.status}`);
  }
  const length = Number(response.headers.get("content-length"));
  return {
    stream: Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
    expectedBytes: Number.isFinite(length) && length > 0 ? length : undefined,
  };
}

/** Streams the source to `partialPath`, returning its digest and size. */
async function download(source: MediaSource, partialPath: string) {
  const { stream, expectedBytes } = await openSource(source);
  const hash = createHash("sha256");
  let bytes = 0;
  let lastReport = Date.now();
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      if (Date.now() - lastReport >= PROGRESS_INTERVAL_MS) {
        lastReport = Date.now();
        const total = expectedBytes ? ` of ${(expectedBytes / 2 ** 20).toFixed(1)} MiB` : "";
        console.error(`fetch-media: ${(bytes / 2 ** 20).toFixed(1)} MiB${total}`);
      }
      callback(null, chunk);
    },
  });
  await pipeline(stream, meter, createWriteStream(partialPath, { mode: 0o644 }));
  return { sha256: hash.digest("hex"), bytes, expectedBytes };
}

function probeMedia(file: string): MediaSummary | { error: string } {
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 32 * 2 ** 20,
  });
  if (probe.error) {
    const code = (probe.error as NodeJS.ErrnoException).code;
    return { error: code === "ENOENT" ? "ffprobe is not installed" : `ffprobe failed: ${probe.error.message}` };
  }
  if (probe.status !== 0) {
    return { error: `ffprobe exited ${probe.status}: ${probe.stderr.trim().split("\n")[0] ?? ""}` };
  }
  try {
    return summarizeFfprobe(JSON.parse(probe.stdout));
  } catch {
    return { error: "ffprobe printed unparseable JSON" };
  }
}

async function main(): Promise<number> {
  reexecWithEnvProxy();
  let args: ReturnType<typeof parseFetchMediaArgs>;
  try {
    args = parseFetchMediaArgs(process.argv.slice(2));
    if (args.source) parseMediaSource(args.source);
  } catch (error) {
    console.error(`fetch-media: ${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const expected = args.sha256 as string;
  const source = parseMediaSource(args.source as string);
  const outDir = path.resolve(args.outDir ?? path.join(WEBAPP_ROOT, ".playwright-mcp"));
  mkdirSync(outDir, { recursive: true });
  const finalPath = path.join(outDir, sourceFileName(source));
  const partialPath = `${finalPath}.partial`;

  let sizeBytes: number;
  let reused = false;
  const existing = existsSync(finalPath) ? await hashFile(finalPath) : null;
  if (existing && digestMatches(expected, existing.sha256)) {
    reused = true;
    sizeBytes = existing.bytes;
  } else {
    let result: Awaited<ReturnType<typeof download>>;
    try {
      result = await download(source, partialPath);
    } catch (error) {
      rmSync(partialPath, { force: true });
      throw error;
    }
    if (!digestMatches(expected, result.sha256)) {
      rmSync(partialPath, { force: true });
      console.error(
        `fetch-media: sha256 mismatch for ${describeSource(source)}: expected ${expected}, got ${result.sha256} ` +
          `(${result.bytes} bytes); deleted ${partialPath}`,
      );
      return 1;
    }
    if (result.expectedBytes !== undefined && result.expectedBytes !== result.bytes) {
      console.error(`fetch-media: note: source announced ${result.expectedBytes} bytes, received ${result.bytes}`);
    }
    renameSync(partialPath, finalPath);
    sizeBytes = result.bytes;
  }

  const output = {
    path: finalPath,
    size_bytes: sizeBytes,
    sha256: expected,
    source: describeSource(source),
    reused,
    media: probeMedia(finalPath),
  };
  console.log(JSON.stringify(output, null, 2));
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause ? (error.cause as { code?: unknown }).code ?? error.cause : "";
    // A signed URL echoed back in an error must not print its token.
    const text = `${message}${cause ? ` (${String(cause)})` : ""}`.replace(/(https?:\/\/[^\s?#]+)\?\S*/g, "$1?<redacted>");
    console.error(`fetch-media: ${text}`);
    process.exit(1);
  });
