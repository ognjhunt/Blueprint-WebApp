/**
 * View-only access to a site's 3D preview.
 *
 * Owner decision 2026-10-29: Blueprint owns the reconstruction. A site views it in the
 * vendored SuperSplat Viewer (client/public/splat-viewer) and is never offered the file.
 * The viewer fetches the splat once from a short-lived, owner-ticketed, same-origin route;
 * that ticket is domain-separated from the retired download ticket.
 *
 * Memory stays flat whatever the bundle's size: the bundle streams to a private temporary
 * file while it is hashed, and only then is the splat streamed out of it, inflated, checked
 * and turned. Holding a 232 MB bundle in memory took ~700 MB and got the 512 MB web
 * instance killed on every first view (2026-11-05).
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform, Writable, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { downloadableWebsiteAtlasPreview, websiteAtlasPreviewBundleRequest } from "./websiteAtlasPreview";

const VIEW_TICKET_DOMAIN = "website_atlas_preview_view";
export const WEBSITE_ATLAS_PREVIEW_VIEW_ROUTE = "/api/website-atlas-preview-views";
/** The bundle member the viewer renders. The viewer picks the format from the extension. */
const SPLAT_MEMBER = /(^|\/)splat\/[^/]+\.ply$/;
const FIRST_CAMERA_MEMBER = /(^|\/)views\/000-camera\.json$/;
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
/** A start view is a few hundred bytes; anything far larger is not one. */
const MAX_CAMERA_BYTES = 1024 * 1024;
const MAX_PLY_HEADER_BYTES = 64 * 1024;

/** A ready preview whose bundle holds a splat; consent is re-read by the caller's record. */
export function viewableWebsiteAtlasPreview(record: Record<string, any> | undefined, captureId?: string) {
  const preview = downloadableWebsiteAtlasPreview(record, captureId);
  return preview?.splat_available ? preview : null;
}

/** The viewer page with a 15-minute view ticket for exactly this preview. */
export function websiteAtlasPreviewViewerUrl(requestId: string, captureId: string, nowSeconds?: number) {
  const ticket = createSignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId], nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ expires: String(ticket.expires), signature: ticket.signature });
  const content = `${WEBSITE_ATLAS_PREVIEW_VIEW_ROUTE}/${encodeURIComponent(requestId)}/${encodeURIComponent(captureId)}/scene.ply?${query}`;
  return `/splat-viewer/index.html?${new URLSearchParams({ content })}`;
}

export function verifyWebsiteAtlasPreviewViewTicket(requestId: string, captureId: string,
  expires: unknown, signature: unknown, nowSeconds?: number) {
  return verifySignedDownloadTicket([VIEW_TICKET_DOMAIN, requestId, captureId], expires, signature, nowSeconds);
}

// zlib.crc32 needs Node 20.15+; the deployed runtime is not pinned, so keep the table too.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const nativeCrc32 = (zlib as { crc32?: (data: Uint8Array, value?: number) => number }).crc32;
/** CRC-32 of `bytes`, continuing from `previous` (the CRC of everything before them). */
export function crc32(bytes: Uint8Array, previous = 0) {
  if (nativeCrc32) return nativeCrc32(bytes, previous) >>> 0;
  let value = (previous ^ 0xffffffff) >>> 0;
  for (let index = 0; index < bytes.length; index += 1) value = CRC_TABLE[(value ^ bytes[index]!) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

type ZipMember = { name: string; method: number; crc: number; compressed: number; size: number; local: number };

async function readAt(handle: FileHandle, position: number, length: number) {
  const bytes = Buffer.alloc(length);
  const { bytesRead } = await handle.read(bytes, 0, length, position);
  if (bytesRead !== length) throw new Error("zip_truncated");
  return bytes;
}

/** The central directory of a ZIP file of `size` bytes (no ZIP64). */
async function zipMembers(handle: FileHandle, size: number): Promise<ZipMember[]> {
  const tailLength = Math.min(size, 22 + 0xffff), tailStart = size - tailLength;
  const tail = await readAt(handle, tailStart, tailLength);
  let end = -1;
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error("zip_end_of_directory_missing");
  const entries = tail.readUInt16LE(end + 10), directorySize = tail.readUInt32LE(end + 12);
  const directoryStart = tail.readUInt32LE(end + 16);
  if (directoryStart === 0xffffffff || directorySize === 0xffffffff) throw new Error("zip64_unsupported");
  if (directoryStart + directorySize > tailStart + end) throw new Error("zip_directory_invalid");
  const directory = await readAt(handle, directoryStart, directorySize);
  const members: ZipMember[] = [];
  let cursor = 0;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error("zip_directory_invalid");
    const nameLength = directory.readUInt16LE(cursor + 28), extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    members.push({ name: directory.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"),
      method: directory.readUInt16LE(cursor + 10), crc: directory.readUInt32LE(cursor + 16),
      compressed: directory.readUInt32LE(cursor + 20), size: directory.readUInt32LE(cursor + 24),
      local: directory.readUInt32LE(cursor + 42) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return members;
}

/** A member's bytes as a stream (stored or deflated), failing unless their size and CRC match. */
async function zipMemberStream(handle: FileHandle, file: string, member: ZipMember) {
  if ([member.compressed, member.size, member.local].includes(0xffffffff)) throw new Error("zip64_unsupported");
  if (member.method !== 0 && member.method !== 8) throw new Error("zip_method_unsupported");
  if (member.method === 0 && member.compressed !== member.size) throw new Error("zip_member_corrupt");
  const local = await readAt(handle, member.local, 30);
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error("zip_local_header_invalid");
  const start = member.local + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  const raw = member.compressed === 0 ? Readable.from([]) : createReadStream(file, { start, end: start + member.compressed - 1 });
  let received = 0, crc = 0;
  const checked = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      // An inflated member never grows past its stated size.
      if (received > member.size) return done(new Error("zip_member_corrupt"));
      crc = crc32(chunk, crc);
      done(null, chunk);
    },
    flush(done) {
      done(received === member.size && crc === member.crc ? null : new Error("zip_member_corrupt"));
    },
  });
  return member.method === 8 ? [raw, zlib.createInflateRaw(), checked] : [raw, checked];
}

/** A small member (the start view) read whole. */
async function readZipMember(handle: FileHandle, file: string, member: ZipMember) {
  const chunks: Buffer[] = [];
  await pipeline([...await zipMemberStream(handle, file, member),
    new Writable({ write(chunk: Buffer, _encoding, done) { chunks.push(chunk); done(); } })]);
  return Buffer.concat(chunks);
}

/** One run of same-sized records in a PLY body, and how to turn a whole number of them in place. */
type PlySection = { recordBytes: number; records: number; turn: (records: Buffer) => void };
type PlyLayout = { bodyBytes: number; sections: PlySection[] };
type FloatPlyLayout = { recordBytes: number; x: number; y: number; nx: number; ny: number;
  w: number; qx: number; qy: number; qz: number };

/**
 * PlayCanvas's compressed PLY as the vendored viewer reads it (isCompressedPly and
 * readCompressedPly in client/public/splat-viewer/index.js), without spherical harmonics:
 * 18 float bounds per chunk of 256 consecutive splats, then 4 packed uints per splat.
 */
const COMPRESSED_CHUNK_PROPERTIES = ["min_x", "min_y", "min_z", "max_x", "max_y", "max_z", "min_scale_x", "min_scale_y",
  "min_scale_z", "max_scale_x", "max_scale_y", "max_scale_z", "min_r", "min_g", "min_b", "max_r", "max_g", "max_b"];
const COMPRESSED_VERTEX_PROPERTIES = ["packed_position", "packed_rotation", "packed_scale", "packed_color"];
const COMPRESSED_CHUNK_SPLATS = 256;

function plyLayout(headerText: string): PlyLayout {
  const header = headerText.split("\n").map(line => line.trim());
  if (!header.includes("format binary_little_endian 1.0")) throw new Error("ply_format_unsupported");
  if (header.some(line => /^element chunk( |$)/.test(line))) return compressedPlyLayout(header);
  const count = Number(/^element vertex (\d+)$/m.exec(header.join("\n"))?.[1]);
  const properties = header.filter(line => line.startsWith("property ")).map(line => line.split(" "));
  if (!Number.isInteger(count) || properties.some(([, type]) => type !== "float"))
    throw new Error("ply_properties_unsupported");
  const index = (name: string) => properties.findIndex(([, , property]) => property === name) * 4;
  const [x, y, nx, ny, w, qx, qy, qz] = ["x", "y", "nx", "ny", "rot_0", "rot_1", "rot_2", "rot_3"].map(index);
  if (x < 0 || y < 0 || [w, qx, qy, qz].some(position => position < 0)) throw new Error("ply_properties_unsupported");
  const layout: FloatPlyLayout = { recordBytes: properties.length * 4, x, y, nx, ny, w, qx, qy, qz };
  return { bodyBytes: count * layout.recordBytes,
    sections: [{ recordBytes: layout.recordBytes, records: count, turn: records => turnFloatRecords(records, layout) }] };
}

/** Exactly the chunk element, then the vertex element of four packed uints; anything else is refused. */
function compressedPlyLayout(header: string[]): PlyLayout {
  const elements: { name: string; count: number; properties: string[] }[] = [];
  // The header text runs up to "end_header", so it ends with the newline before it.
  const lines = header.slice(1, header.at(-1) === "" ? -1 : undefined);
  for (const line of lines) {
    const words = line.split(" ");
    if (words[0] === "comment") continue;
    if (line === "format binary_little_endian 1.0") continue;
    if (words[0] === "element" && words.length === 3 && /^\d+$/.test(words[2]!))
      elements.push({ name: words[1]!, count: Number(words[2]), properties: [] });
    else if (words[0] === "property" && words.length === 3 && elements.length)
      elements[elements.length - 1]!.properties.push(`${words[1]} ${words[2]}`);
    else throw new Error("ply_properties_unsupported");
  }
  const [chunk, vertex] = elements;
  const same = (properties: string[], type: string, names: string[]) =>
    properties.length === names.length && names.every((name, position) => properties[position] === `${type} ${name}`);
  if (elements.length !== 2 || chunk?.name !== "chunk" || vertex?.name !== "vertex"
    || !same(chunk.properties, "float", COMPRESSED_CHUNK_PROPERTIES)
    || !same(vertex.properties, "uint", COMPRESSED_VERTEX_PROPERTIES) || !Number.isSafeInteger(vertex.count)
    // The viewer finds a splat's chunk as index / 256 within ceil(count / 256) chunks.
    || chunk.count !== Math.ceil(vertex.count / COMPRESSED_CHUNK_SPLATS))
    throw new Error("ply_properties_unsupported");
  const sections = [
    { recordBytes: COMPRESSED_CHUNK_PROPERTIES.length * 4, records: chunk.count, turn: turnCompressedChunks },
    { recordBytes: COMPRESSED_VERTEX_PROPERTIES.length * 4, records: vertex.count, turn: turnCompressedVertices },
  ];
  return { bodyBytes: sections.reduce((total, section) => total + section.recordBytes * section.records, 0), sections };
}

function turnFloatRecords(records: Buffer, layout: FloatPlyLayout) {
  const { recordBytes, x, y, nx, ny, w, qx, qy, qz } = layout;
  // A DataView, because the header length leaves the records unaligned for a Float32Array.
  const view = new DataView(records.buffer, records.byteOffset, records.length);
  const negate = (offset: number) => view.setFloat32(offset, -view.getFloat32(offset, true), true);
  for (let base = 0; base < records.length; base += recordBytes) {
    negate(base + x); negate(base + y);
    if (nx >= 0 && ny >= 0) { negate(base + nx); negate(base + ny); }
    const qw = view.getFloat32(base + w, true), qi = view.getFloat32(base + qx, true);
    const qj = view.getFloat32(base + qy, true), qk = view.getFloat32(base + qz, true);
    view.setFloat32(base + w, -qk, true); view.setFloat32(base + qx, -qj, true);
    view.setFloat32(base + qy, qi, true); view.setFloat32(base + qz, qw, true);
  }
}

/** A chunk's x and y bounds negate, so each axis's min and max swap. Scale and colour bounds stay. */
function turnCompressedChunks(records: Buffer) {
  const view = new DataView(records.buffer, records.byteOffset, records.length);
  for (let base = 0; base < records.length; base += COMPRESSED_CHUNK_PROPERTIES.length * 4) {
    const minX = view.getFloat32(base, true), minY = view.getFloat32(base + 4, true);
    const maxX = view.getFloat32(base + 12, true), maxY = view.getFloat32(base + 16, true);
    view.setFloat32(base, -maxX, true); view.setFloat32(base + 12, -minX, true);
    view.setFloat32(base + 4, -maxY, true); view.setFloat32(base + 16, -minY, true);
  }
}

/** Rz(180°)·q for q = (w, x, y, z) = (rot_0..rot_3), as a signed permutation: component j is sign · q[from]. */
const TURNED_QUATERNION = [[3, -1], [2, -1], [1, 1], [0, 1]] as const;
/**
 * The same turn on the viewer's smallest-three rotation, for each stored largest index: the
 * turned largest index, and for each turned slot the stored slot it takes and whether it is
 * negated (a stored 10-bit u decodes to (u / 1023 − 0.5)·√2, so 1023 − u is exactly its negative).
 * The viewer rebuilds the largest as non-negative; when it turns negative, all three negate.
 */
const TURNED_ROTATION = [0, 1, 2, 3].map(largest => {
  const turnedLargest = TURNED_QUATERNION.findIndex(([from]) => from === largest);
  const flip = TURNED_QUATERNION[turnedLargest]![1];
  const stored = [0, 1, 2, 3].filter(index => index !== largest);
  return { largest: turnedLargest, slots: [0, 1, 2, 3].filter(index => index !== turnedLargest).map(index => {
    const [from, sign] = TURNED_QUATERNION[index]!;
    return { from: stored.indexOf(from), negate: sign * flip < 0 };
  }) };
});

/**
 * Each splat's packed fields, turned exactly: within the swapped chunk bounds an 11-bit x
 * becomes 2047 − x and a 10-bit y 1023 − y, z stays, and the rotation is permuted as above.
 * Scale and colour stay.
 */
function turnCompressedVertices(records: Buffer) {
  const view = new DataView(records.buffer, records.byteOffset, records.length);
  for (let base = 0; base < records.length; base += COMPRESSED_VERTEX_PROPERTIES.length * 4) {
    const position = view.getUint32(base, true);
    view.setUint32(base, (((2047 - (position >>> 21)) << 21) | ((1023 - ((position >>> 11) & 1023)) << 11)
      | (position & 2047)) >>> 0, true);
    const rotation = view.getUint32(base + 4, true);
    const turn = TURNED_ROTATION[rotation >>> 30]!;
    let turned = turn.largest << 30;
    for (let slot = 0; slot < 3; slot += 1) {
      const { from, negate } = turn.slots[slot]!;
      const stored = (rotation >>> (20 - 10 * from)) & 1023;
      turned |= (negate ? 1023 - stored : stored) << (20 - 10 * slot);
    }
    view.setUint32(base + 4, turned >>> 0, true);
  }
}

/**
 * The viewer turns every .ply 180° about Z on load (the COLMAP y-down correction). Atlas
 * splats are already y-up, so turn them the opposite way first: positions and normals
 * negate x and y, and each (w, x, y, z) orientation becomes Rz(180°)·q = (−z, −y, x, w).
 * Binary float32 splats and PlayCanvas's compressed splats (no spherical harmonics) are
 * accepted; colours and scales are unchanged. Chunks are turned in place as they pass, so
 * a splat of any size is never held or copied whole.
 */
class PlyViewerOrientation {
  private pendingHeader: Buffer | null = Buffer.alloc(0);
  private layout: PlyLayout | null = null;
  private carry = Buffer.alloc(0);
  private bodySeen = 0;
  /** The section the next body byte belongs to, and how many of its records have passed. */
  private section = 0;
  private recordsDone = 0;

  /** The bytes to pass on for `chunk`, turned in place where whole records allow. */
  write(chunk: Buffer): Buffer[] {
    if (this.pendingHeader) {
      const combined = this.pendingHeader.length ? Buffer.concat([this.pendingHeader, chunk]) : chunk;
      const end = combined.indexOf("end_header\n");
      if (end < 0) {
        if (combined.length > MAX_PLY_HEADER_BYTES) throw new Error("ply_header_missing");
        this.pendingHeader = combined;
        return [];
      }
      this.layout = plyLayout(combined.subarray(0, end).toString("latin1"));
      this.pendingHeader = null;
      this.advance(0);
      const start = end + "end_header\n".length;
      return [combined.subarray(0, start), ...this.body(combined.subarray(start))];
    }
    return this.body(chunk);
  }

  end() {
    if (this.pendingHeader) throw new Error("ply_header_missing");
    if (this.carry.length || this.bodySeen !== this.layout!.bodyBytes) throw new Error("ply_size_mismatch");
  }

  /** Count `records` as passed, moving past every section they finish (and any empty one). */
  private advance(records: number) {
    const { sections } = this.layout!;
    this.recordsDone += records;
    while (this.section < sections.length && this.recordsDone === sections[this.section]!.records) {
      this.section += 1;
      this.recordsDone = 0;
    }
  }

  private body(chunk: Buffer): Buffer[] {
    const layout = this.layout!;
    this.bodySeen += chunk.length;
    if (this.bodySeen > layout.bodyBytes) throw new Error("ply_size_mismatch");
    const out: Buffer[] = [];
    while (chunk.length) {
      const section = layout.sections[this.section]!;
      if (this.carry.length) {
        const needed = section.recordBytes - this.carry.length;
        if (chunk.length < needed) {
          this.carry = Buffer.concat([this.carry, chunk]);
          return out;
        }
        const record = Buffer.concat([this.carry, chunk.subarray(0, needed)]);
        section.turn(record);
        out.push(record);
        chunk = chunk.subarray(needed);
        this.carry = Buffer.alloc(0);
        this.advance(1);
        continue;
      }
      const records = Math.min(section.records - this.recordsDone, Math.floor(chunk.length / section.recordBytes));
      if (!records) {
        this.carry = Buffer.from(chunk);
        return out;
      }
      const whole = records * section.recordBytes;
      section.turn(chunk.subarray(0, whole));
      out.push(chunk.subarray(0, whole));
      chunk = chunk.subarray(whole);
      this.advance(records);
    }
    return out;
  }
}

/** Turns a whole splat in place (see PlyViewerOrientation). */
export function orientPlyForViewer(ply: Buffer): Buffer {
  const orientation = new PlyViewerOrientation();
  orientation.write(ply);
  orientation.end();
  return ply;
}

/** The same turn as a stream, for a splat too large to hold. */
export function plyViewerOrientationStream() {
  const orientation = new PlyViewerOrientation();
  return new Transform({
    transform(chunk: Buffer, _encoding, done: TransformCallback) {
      try {
        for (const bytes of orientation.write(chunk)) this.push(bytes);
        done();
      } catch (error) { done(error as Error); }
    },
    flush(done: TransformCallback) {
      try { orientation.end(); done(); } catch (error) { done(error as Error); }
    },
  });
}

/** The package's defaultSettings() (see client/public/splat-viewer/README.md). */
export const DEFAULT_VIEWER_SETTINGS = { version: 2, tonemapping: "linear", highPrecisionRendering: false, background: { color: [0, 0, 0] },
  postEffectSettings: { sharpness: { enabled: false, amount: 0 }, bloom: { enabled: false, intensity: 0.1, blurLevel: 2 },
    grading: { enabled: false, brightness: 1, contrast: 1, saturation: 1, tint: [1, 1, 1] },
    vignette: { enabled: false, intensity: 0.5, inner: 0.3, outer: 0.75, curvature: 1 }, fringing: { enabled: false, intensity: 0.5 } },
  animTracks: [], cameras: [{ initial: { position: [0, 2, 0], target: [2, 2, 0], fov: 85 } }], annotations: [], startMode: "default" };

/** Start where the recording starts: Atlas's first posed view (right-up-back, quaternion x,y,z,w). */
export function viewerSettingsFromAtlasCamera(camera: unknown) {
  const pose = camera as { extrinsics?: { coordinateSystem?: string; position?: number[]; quaternion?: number[] };
    intrinsics?: { fy?: number; height?: number } } | null;
  const position = pose?.extrinsics?.position, quaternion = pose?.extrinsics?.quaternion;
  const fy = pose?.intrinsics?.fy, height = pose?.intrinsics?.height;
  if (pose?.extrinsics?.coordinateSystem !== "rub" || position?.length !== 3 || quaternion?.length !== 4
    || ![...position, ...quaternion, fy, height].every(value => typeof value === "number" && Number.isFinite(value))
    || !(fy! > 0 && height! > 0)) return DEFAULT_VIEWER_SETTINGS;
  const [qx, qy, qz, qw] = quaternion;
  // The camera looks down its own −Z: forward = −(third column of the rotation).
  const forward = [-(2 * (qx! * qz! + qy! * qw!)), -(2 * (qy! * qz! - qx! * qw!)), -(1 - 2 * (qx! * qx! + qy! * qy!))];
  const fov = Math.min(75, Math.max(40, (2 * Math.atan(height! / 2 / fy!) * 180) / Math.PI));
  return { ...DEFAULT_VIEWER_SETTINGS, cameras: [{ initial: { position,
    target: position.map((value, axis) => value + 2 * forward[axis]!), fov: Math.round(fov * 10) / 10 } }] };
}

/**
 * The preview's splat (turned for the viewer) and its start view as local files: the
 * bundle is fetched once through the signed Pipeline read, verified against its stored
 * digest and size, and only the splat and first camera kept, cached by bundle digest.
 */
export async function websiteAtlasPreviewViewerFiles(requestId: string, captureId: string,
  bundle: { digest: string; size_bytes: number }) {
  const digestHex = /^sha256:([a-f0-9]{64})$/.exec(bundle.digest)?.[1];
  if (!digestHex || !(bundle.size_bytes > 0 && bundle.size_bytes <= MAX_BUNDLE_BYTES)) throw new Error("website_atlas_preview_bundle_invalid");
  const directory = path.join(tmpdir(), "blueprint-atlas-preview-views");
  // Versioned: a splat cached before it was turned for the viewer is never reused.
  const files = { splat: path.join(directory, `${digestHex}.viewer-v2.ply`),
    settings: path.join(directory, `${digestHex}.viewer-v2.settings.json`) };
  if ((await stat(files.splat).catch(() => null))?.isFile() && (await stat(files.settings).catch(() => null))?.isFile()) return files;
  // One preparation per bundle: the viewer asks for the splat and its start view at once,
  // and two parallel 80 MB bundles exhausted the web instance's memory (2026-10-29).
  const pending = preparing.get(digestHex);
  if (pending) return pending;
  const job = prepareViewerFiles(requestId, captureId, bundle, digestHex, directory, files)
    .finally(() => preparing.delete(digestHex));
  preparing.set(digestHex, job);
  return job;
}

const preparing = new Map<string, Promise<{ splat: string; settings: string }>>();

/**
 * The bundle, streamed to `archive` through the signed Pipeline read and checked against its
 * stored size and digest on the way. It is never held in memory.
 */
async function downloadVerifiedBundle(requestId: string, captureId: string,
  bundle: { digest: string; size_bytes: number }, digestHex: string, archive: string) {
  const origin = websiteAtlasPreviewBundleRequest(requestId, captureId, bundle.digest);
  if (!origin) throw new Error("website_atlas_preview_delivery_not_configured");
  const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("website_atlas_preview_bundle_unavailable");
  }
  const hash = createHash("sha256");
  let received = 0;
  await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      if (received > bundle.size_bytes) return done(new Error("website_atlas_preview_bundle_mismatch"));
      hash.update(chunk);
      done(null, chunk);
    },
  }), createWriteStream(archive, { flags: "wx", mode: 0o600 }));
  if (received !== bundle.size_bytes || hash.digest("hex") !== digestHex)
    throw new Error("website_atlas_preview_bundle_mismatch");
}

async function prepareViewerFiles(requestId: string, captureId: string, bundle: { digest: string; size_bytes: number },
  digestHex: string, directory: string, files: { splat: string; settings: string }) {
  await mkdir(directory, { recursive: true });
  // Everything is written under temporary names and renamed only once all of it checks out,
  // so the cache never holds a partial splat; the bundle itself is only a step and is removed.
  const attempt = randomUUID();
  const archive = path.join(directory, `${digestHex}.${attempt}.bundle.partial`);
  const partial = { splat: `${files.splat}.${attempt}.partial`, settings: `${files.settings}.${attempt}.partial` };
  try {
    await downloadVerifiedBundle(requestId, captureId, bundle, digestHex, archive);
    const handle = await open(archive, "r");
    try {
      const members = await zipMembers(handle, bundle.size_bytes);
      const splat = members.find(member => SPLAT_MEMBER.test(member.name));
      if (!splat) throw new Error("website_atlas_preview_splat_missing");
      const cameraMember = members.find(member => FIRST_CAMERA_MEMBER.test(member.name));
      let camera: unknown = null;
      try {
        if (cameraMember && cameraMember.size <= MAX_CAMERA_BYTES)
          camera = JSON.parse((await readZipMember(handle, archive, cameraMember)).toString("utf8"));
      } catch { camera = null; }
      await pipeline([...await zipMemberStream(handle, archive, splat), plyViewerOrientationStream(),
        createWriteStream(partial.splat, { flags: "wx", mode: 0o600 })]);
      await writeFile(partial.settings, JSON.stringify(viewerSettingsFromAtlasCamera(camera)), { flag: "wx", mode: 0o600 });
    } finally {
      await handle.close();
    }
    await rename(partial.settings, files.settings);
    await rename(partial.splat, files.splat);
  } finally {
    await Promise.all([archive, partial.splat, partial.settings].map(file => rm(file, { force: true })));
  }
  return files;
}
