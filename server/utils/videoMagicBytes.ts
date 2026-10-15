/**
 * Whether the first bytes of an upload are a video container we accept.
 *
 * Capture links accept `.mov` and `.mp4` only (the extractor's list, see
 * `ALLOWED_EXTENSIONS`), so the containers checked are the ISO base media
 * file format family: MP4, M4V and QuickTime. Both open with a box header, a
 * 32-bit big-endian size followed by a four-character type:
 *
 * - `ftyp` first, as every MP4 and every modern QuickTime file (iPhone
 *   `qt  `, `isom`, `mp42`, `M4V `, ...) does. Its major brand must be four
 *   printable ASCII characters; the brand list itself is open-ended.
 * - Older QuickTime files may open directly with `moov`, `mdat`, `wide`,
 *   `free`, `skip` or `pnot`.
 *
 * WebM/Matroska (EBML `1A 45 DF A3`) is not accepted because the routes do not
 * accept `.webm`. This is a cheap gate against non-video payloads, not a
 * decoder: a file that passes may still fail to decode downstream.
 */

/** Bytes to read: enough for the box header and the `ftyp` major brand. */
export const VIDEO_SIGNATURE_BYTES = 16;

const QUICKTIME_LEADING_ATOMS = new Set(["moov", "mdat", "wide", "free", "skip", "pnot"]);

function printableAscii(bytes: Buffer): boolean {
  return bytes.length > 0 && [...bytes].every((byte) => byte >= 0x20 && byte <= 0x7e);
}

export function isAcceptedVideoHeader(head: Buffer | Uint8Array): boolean {
  const bytes = Buffer.from(head.buffer, head.byteOffset, head.byteLength);
  if (bytes.length < 12) return false;
  const size = bytes.readUInt32BE(0);
  const type = bytes.toString("latin1", 4, 8);
  if (type === "ftyp") return size >= 16 && printableAscii(bytes.subarray(8, 12));
  // 0 = box runs to end of file, 1 = 64-bit size follows; otherwise at least the header.
  if (QUICKTIME_LEADING_ATOMS.has(type)) return size === 0 || size === 1 || size >= 8;
  return false;
}

export const VIDEO_NOT_RECOGNIZED = {
  code: "video_content_not_recognized",
  error: "This file does not look like a video. Upload the .mov or .mp4 straight from your phone's camera.",
} as const;
