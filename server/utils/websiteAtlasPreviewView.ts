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
 * The preview's splat as a local file: the bundle is fetched once through the signed
 * Pipeline read, verified against its stored digest and size, and only its splat kept,
 * cached by bundle digest.
 */
export async function websiteAtlasPreviewSplatFile(requestId: string, captureId: string,
  bundle: { digest: string; size_bytes: number }) {
  const digestHex = /^sha256:([a-f0-9]{64})$/.exec(bundle.digest)?.[1];
  if (!digestHex || !(bundle.size_bytes > 0 && bundle.size_bytes <= MAX_BUNDLE_BYTES)) throw new Error("website_atlas_preview_bundle_invalid");
  const directory = path.join(tmpdir(), "blueprint-atlas-preview-views");
  const file = path.join(directory, `${digestHex}.ply`);
  if ((await stat(file).catch(() => null))?.isFile()) return file;
  const origin = websiteAtlasPreviewBundleRequest(requestId, captureId, bundle.digest);
  if (!origin) throw new Error("website_atlas_preview_delivery_not_configured");
  const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
  if (!response.ok) throw new Error("website_atlas_preview_bundle_unavailable");
  const zip = Buffer.from(await response.arrayBuffer());
  if (zip.length !== bundle.size_bytes || createHash("sha256").update(zip).digest("hex") !== digestHex)
    throw new Error("website_atlas_preview_bundle_mismatch");
  const splat = extractZipMember(zip, name => SPLAT_MEMBER.test(name));
  if (!splat) throw new Error("website_atlas_preview_splat_missing");
  await mkdir(directory, { recursive: true });
  const partial = `${file}.${randomUUID()}.partial`;
  await writeFile(partial, splat, { mode: 0o600 });
  await rename(partial, file);
  return file;
}
