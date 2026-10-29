/**
 * View-only access to a site's 3D preview.
 *
 * Owner decision 2026-10-29: Blueprint owns the reconstruction. A site views it in the
 * vendored SuperSplat Viewer (client/public/splat-viewer) and is never offered the file.
 * The viewer fetches the splat once from a short-lived, owner-ticketed, same-origin route;
 * that ticket is domain-separated from the retired download ticket.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { downloadableWebsiteAtlasPreview, websiteAtlasPreviewBundleRequest } from "./websiteAtlasPreview";

const VIEW_TICKET_DOMAIN = "website_atlas_preview_view";
export const WEBSITE_ATLAS_PREVIEW_VIEW_ROUTE = "/api/website-atlas-preview-views";
/** The bundle member the viewer renders. The viewer picks the format from the extension. */
const SPLAT_MEMBER = /(^|\/)splat\/[^/]+\.ply$/;
const FIRST_CAMERA_MEMBER = /(^|\/)views\/000-camera\.json$/;
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;

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

// zlib.crc32 needs Node 20.15+; the deployed runtime is not pinned, so keep the table here.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** One member of a ZIP archive (stored or deflated, no ZIP64), checked against its size and CRC. */
export function extractZipMember(zip: Buffer, matches: (name: string) => boolean): Buffer | null {
  const minimum = Math.max(0, zip.length - 22 - 0xffff);
  let end = -1;
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error("zip_end_of_directory_missing");
  const entries = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  for (let index = 0; index < entries; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("zip_directory_invalid");
    const method = zip.readUInt16LE(cursor + 10), expectedCrc = zip.readUInt32LE(cursor + 16);
    const compressed = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32), local = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!matches(name)) continue;
    if ([compressed, size, local].includes(0xffffffff)) throw new Error("zip64_unsupported");
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error("zip_local_header_invalid");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + compressed);
    const bytes = method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data) : null;
    if (!bytes) throw new Error("zip_method_unsupported");
    if (bytes.length !== size || crc32(bytes) !== expectedCrc) throw new Error("zip_member_corrupt");
    return bytes;
  }
  return null;
}

/**
 * The viewer turns every .ply 180° about Z on load (the COLMAP y-down correction). Atlas
 * splats are already y-up, so turn them the opposite way first: positions and normals
 * negate x and y, and each (w, x, y, z) orientation becomes Rz(180°)·q = (−z, −y, x, w).
 * Only binary float32 splats are accepted; colours and scales are unchanged. Turns the
 * buffer in place: a 93 MB splat must not be copied on a small web instance.
 */
export function orientPlyForViewer(ply: Buffer): Buffer {
  const end = ply.indexOf("end_header\n");
  if (end < 0) throw new Error("ply_header_missing");
  const header = ply.subarray(0, end).toString("latin1").split("\n").map(line => line.trim());
  if (!header.includes("format binary_little_endian 1.0")) throw new Error("ply_format_unsupported");
  const count = Number(/^element vertex (\d+)$/m.exec(header.join("\n"))?.[1]);
  const properties = header.filter(line => line.startsWith("property ")).map(line => line.split(" "));
  if (!Number.isInteger(count) || properties.some(([, type]) => type !== "float"))
    throw new Error("ply_properties_unsupported");
  const index = (name: string) => properties.findIndex(([, , property]) => property === name);
  const [x, y, nx, ny, w, qx, qy, qz] = ["x", "y", "nx", "ny", "rot_0", "rot_1", "rot_2", "rot_3"].map(index);
  if (x < 0 || y < 0 || [w, qx, qy, qz].some(position => position < 0)) throw new Error("ply_properties_unsupported");
  const start = end + "end_header\n".length, stride = properties.length;
  if (ply.length - start !== count * stride * 4) throw new Error("ply_size_mismatch");
  // A DataView, because the header length leaves the vertex block unaligned for a Float32Array.
  const view = new DataView(ply.buffer, ply.byteOffset + start, count * stride * 4);
  const negate = (offset: number) => view.setFloat32(offset, -view.getFloat32(offset, true), true);
  for (let base = 0; base < count * stride * 4; base += stride * 4) {
    negate(base + x * 4); negate(base + y * 4);
    if (nx >= 0 && ny >= 0) { negate(base + nx * 4); negate(base + ny * 4); }
    const qw = view.getFloat32(base + w * 4, true), qi = view.getFloat32(base + qx * 4, true);
    const qj = view.getFloat32(base + qy * 4, true), qk = view.getFloat32(base + qz * 4, true);
    view.setFloat32(base + w * 4, -qk, true); view.setFloat32(base + qx * 4, -qj, true);
    view.setFloat32(base + qy * 4, qi, true); view.setFloat32(base + qz * 4, qw, true);
  }
  return ply;
}

/** The package's defaultSettings() (see client/public/splat-viewer/README.md). */
const DEFAULT_VIEWER_SETTINGS = { version: 2, tonemapping: "linear", highPrecisionRendering: false, background: { color: [0, 0, 0] },
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

/** The bundle is dropped once its two members are read, before the splat is turned. */
async function readViewerMembers(requestId: string, captureId: string, bundle: { digest: string; size_bytes: number },
  digestHex: string) {
  const origin = websiteAtlasPreviewBundleRequest(requestId, captureId, bundle.digest);
  if (!origin) throw new Error("website_atlas_preview_delivery_not_configured");
  const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
  if (!response.ok) throw new Error("website_atlas_preview_bundle_unavailable");
  const zip = Buffer.from(await response.arrayBuffer());
  if (zip.length !== bundle.size_bytes || createHash("sha256").update(zip).digest("hex") !== digestHex)
    throw new Error("website_atlas_preview_bundle_mismatch");
  const splat = extractZipMember(zip, name => SPLAT_MEMBER.test(name));
  if (!splat) throw new Error("website_atlas_preview_splat_missing");
  let camera: unknown = null;
  try {
    camera = JSON.parse(extractZipMember(zip, name => FIRST_CAMERA_MEMBER.test(name))?.toString("utf8") ?? "null");
  } catch { camera = null; }
  return { splat, camera };
}

async function prepareViewerFiles(requestId: string, captureId: string, bundle: { digest: string; size_bytes: number },
  digestHex: string, directory: string, files: { splat: string; settings: string }) {
  const { splat, camera } = await readViewerMembers(requestId, captureId, bundle, digestHex);
  await mkdir(directory, { recursive: true });
  for (const [file, bytes] of [[files.settings, Buffer.from(JSON.stringify(viewerSettingsFromAtlasCamera(camera)))],
    [files.splat, orientPlyForViewer(splat)]] as const) {
    const partial = `${file}.${randomUUID()}.partial`;
    await writeFile(partial, bytes, { mode: 0o600 });
    await rename(partial, file);
  }
  return files;
}
