import { readFileSync } from "node:fs";

/** Playable synthetic video; a free box gives source-identity tests distinct bytes. */
export function captureVideoFixture(content: string | Buffer = ""): Buffer {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const free = Buffer.alloc(8);
  free.writeUInt32BE(bytes.length + 8); free.write("free", 4);
  return Buffer.concat([readFileSync(new URL("../fixtures/capture-video-metadata.mp4", import.meta.url)), free, bytes]);
}
