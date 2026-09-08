import { createHash } from "node:crypto";
import { Transform, type TransformCallback } from "node:stream";

const SHA256 = /^sha256:[0-9a-f]{64}$/;
export type ResultArtifactMetadata = { sha256: string; size_bytes: number };
export type ResultArtifactMetadataResolution =
  | { status: "known"; metadata: ResultArtifactMetadata }
  | { status: "unlisted" | "invalid" };

/** Resolve only descriptors in the already verified publication, never storage paths. */
export function resultArtifactMetadata(
  publication: Record<string, unknown>,
  artifactId: string,
): ResultArtifactMetadataResolution {
  const pending: unknown[] = [publication.result_delivery, publication.policy_canary_result];
  let digest: string | undefined;
  let size: number | undefined;
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) { pending.push(...value); continue; }
    const row = value as Record<string, unknown>;
    if (row.artifact_id === artifactId) {
      if (row.sha256 !== undefined && row.digest !== undefined && row.sha256 !== row.digest) return { status: "invalid" };
      const nextDigest = row.sha256 ?? row.digest;
      const nextSize = row.size_bytes;
      if (nextDigest !== undefined) {
        if (typeof nextDigest !== "string" || !SHA256.test(nextDigest)
          || (digest !== undefined && digest !== nextDigest)) return { status: "invalid" };
        digest = nextDigest;
      }
      if (nextSize !== undefined) {
        if (typeof nextSize !== "number" || !Number.isSafeInteger(nextSize) || nextSize < 0
          || (size !== undefined && size !== nextSize)) return { status: "invalid" };
        size = nextSize;
      }
    }
    pending.push(...Object.values(row));
  }
  return digest !== undefined && size !== undefined
    ? { status: "known", metadata: { sha256: digest, size_bytes: size } }
    : { status: "unlisted" };
}

type ByteRange = { start: number | null; end: number | null };
export function parseResultArtifactRange(value: string | undefined): ByteRange | null | "invalid" {
  if (value === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if ([start, end].some((item) => item !== null && !Number.isSafeInteger(item))
    || (start === null && end === 0)
    || (start !== null && end !== null && end < start)) return "invalid";
  return { start, end };
}

export type ArtifactResponseIntegrity = {
  contentLength: number | null;
  totalSize: number | null;
  sourceDigest: string;
  payloadDigest: string | null;
  mode: "sha256-on-completion" | "range-length-and-source-digest";
};

/** A partial range cannot be checked against a whole-file hash. Keep that scope explicit. */
export function artifactResponseIntegrity(
  response: Pick<globalThis.Response, "status" | "headers">,
  requestedRange: string | undefined,
  expected?: ResultArtifactMetadata,
): ArtifactResponseIntegrity | null {
  const sourceDigest = response.headers.get("x-blueprint-artifact-sha256") || "";
  const length = response.headers.get("content-length");
  const encoding = response.headers.get("content-encoding");
  if (!SHA256.test(sourceDigest) || (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))
    || (encoding && encoding !== "identity")
    || (expected && expected.sha256 !== sourceDigest)) return null;
  let contentLength = length === null ? null : Number(length);
  let totalSize = contentLength ?? expected?.size_bytes ?? null;
  let fullObject = response.status === 200;
  if (response.status === 206) {
    const range = parseResultArtifactRange(requestedRange);
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") || "");
    if (!range || range === "invalid" || !match) return null;
    const [start, end, total] = match.slice(1).map(Number);
    if (![start, end, total].every(Number.isSafeInteger) || total <= 0
      || start > end || end >= total || (contentLength !== null && contentLength !== end - start + 1)) return null;
    contentLength = end - start + 1;
    const wantedStart = range.start === null ? Math.max(0, total - range.end!) : range.start;
    const wantedEnd = range.start === null || range.end === null ? total - 1 : Math.min(range.end, total - 1);
    if (start !== wantedStart || end !== wantedEnd) return null;
    totalSize = total;
    fullObject = start === 0 && end === total - 1;
  } else if (response.status !== 200 || response.headers.has("content-range")) return null;
  if (expected && expected.size_bytes !== totalSize) return null;
  if (response.status === 200 && contentLength === null && expected) contentLength = expected.size_bytes;
  const rangeDigest = response.headers.get("x-blueprint-range-sha256");
  if (rangeDigest !== null && !SHA256.test(rangeDigest)) return null;
  const payloadDigest = fullObject ? sourceDigest : rangeDigest;
  return { contentLength, totalSize, sourceDigest, payloadDigest,
    mode: payloadDigest ? "sha256-on-completion" : "range-length-and-source-digest" };
}

/** Hold only the final byte so an invalid body cannot finish a Content-Length response. */
export class ResultArtifactIntegrityStream extends Transform {
  private readonly hash = createHash("sha256");
  private length = 0;
  private finalByte: Buffer | null = null;
  constructor(private readonly expected: Pick<ArtifactResponseIntegrity, "contentLength" | "payloadDigest">) { super(); }
  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.length += bytes.length;
    if (this.expected.contentLength !== null && this.length > this.expected.contentLength) return callback(new Error("artifact_size_mismatch"));
    this.hash.update(bytes);
    if (bytes.length) {
      if (this.finalByte) this.push(this.finalByte);
      if (bytes.length > 1) this.push(bytes.subarray(0, -1));
      this.finalByte = Buffer.from(bytes.subarray(-1));
    }
    callback();
  }
  _flush(callback: TransformCallback) {
    const digest = `sha256:${this.hash.digest("hex")}`;
    if ((this.expected.contentLength !== null && this.length !== this.expected.contentLength)
      || (this.expected.payloadDigest && digest !== this.expected.payloadDigest)) {
      return callback(new Error("artifact_integrity_mismatch"));
    }
    if (this.finalByte) this.push(this.finalByte);
    this.finalByte = null;
    callback();
  }
}
