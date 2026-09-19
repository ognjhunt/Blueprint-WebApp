import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as { PNG: { sync: {
  read: (bytes: Buffer, options?: object) => { width: number; height: number; data: Buffer };
  write: (image: { width: number; height: number; data: Buffer }, options?: object) => Buffer;
} } };

/** Accept only small raster previews. Re-encode pixels; discard EXIF, text and other metadata. */
export function sanitizeTaskThumbnail(base64: string): { pngBase64: string; digest: string } {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 800_000) throw new Error("Use a smaller task image.");
  const input = Buffer.from(base64, "base64");
  if (input.length < 33 || !input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || input.toString("ascii", 12, 16) !== "IHDR") throw new Error("Use a PNG preview.");
  // Check dimensions before decompression, not after allocating a caller-sized raster.
  const width = input.readUInt32BE(16), height = input.readUInt32BE(20);
  if (!width || !height || width > 480 || height > 300) throw new Error("Use a preview no larger than 480 by 300 pixels.");
  const decoded = PNG.sync.read(input, { checkCRC: true });
  const bytes = PNG.sync.write({ width: decoded.width, height: decoded.height, data: decoded.data });
  if (bytes.length > 600_000) throw new Error("Use a smaller task image.");
  return { pngBase64: bytes.toString("base64"), digest: createHash("sha256").update(bytes).digest("hex") };
}
