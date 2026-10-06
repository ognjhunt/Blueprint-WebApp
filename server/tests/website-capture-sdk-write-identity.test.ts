// @vitest-environment node
import { CRC32C, Storage } from "@google-cloud/storage";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";
import { capturedWriteIdentity } from "../utils/websiteCaptureDelivery";

const require = createRequire(import.meta.url);
const name = "scenes/site-synthetic/captures/walkthrough-synthetic/raw/manifest.json";
const generation = "90071992547409931";
const bytes = Buffer.from('{"synthetic":"manifest"}');
function metadata(objectName = name) {
  const checksum = new CRC32C();
  checksum.update(bytes);
  return { name: objectName, generation, size: String(bytes.length), crc32c: checksum.toString() };
}
function offlineStorage() {
  return new Storage({ projectId: "offline-synthetic", retryOptions: { autoRetry: false, maxRetries: 0 } });
}

describe("installed Storage SDK completed-write identity", () => {
  it("accepts the numeric size emitted by an actual default-resumable manifest save", async () => {
    const installed = JSON.parse(await readFile(resolve(dirname(require.resolve("@google-cloud/storage")),
      "../../../package.json"), "utf8"));
    const locked = JSON.parse(await readFile(resolve(process.cwd(), "package-lock.json"), "utf8"));
    expect(installed.version).toBe(locked.packages["node_modules/@google-cloud/storage"].version);
    expect(installed.version).toBe("7.21.0");
    const storage = offlineStorage();
    const calls: string[] = [];
    // Replace only the HTTP/auth boundary. File.save, its resumable upload,
    // CRC validation and completed-response metadata handling are the real SDK.
    Object.defineProperty(storage.authClient, "request", { value: async (options: {
      method: string; params?: Record<string, unknown>; body?: AsyncIterable<Uint8Array>;
    }) => {
      calls.push(options.method);
      if (options.method === "POST") {
        expect(options.params).toMatchObject({ name, uploadType: "resumable", ifGenerationMatch: 0 });
        return { status: 200, headers: { location: "https://storage.googleapis.com/synthetic-session" }, data: {} };
      }
      expect(options.method).toBe("PUT");
      const received: Buffer[] = [];
      for await (const chunk of options.body!) received.push(Buffer.from(chunk));
      expect(Buffer.concat(received)).toEqual(bytes);
      return { status: 200, headers: {}, data: metadata() };
    } });
    const file = storage.bucket("synthetic-bucket").file(name);
    await file.save(bytes, { contentType: "application/json", preconditionOpts: { ifGenerationMatch: 0 } });
    expect(calls).toEqual(["POST", "PUT"]);
    expect(file.metadata.size).toBe(bytes.length);
    expect(capturedWriteIdentity(name, file.metadata)).toEqual({ object_name: name,
      generation, size_bytes: bytes.length, crc32c: metadata().crc32c });
  });

  it("retains string size on the actual non-resumable whole-video stream", async () => {
    const storage = offlineStorage();
    const videoName = name.replace("manifest.json", "walkthrough.mov");
    const file = storage.bucket("synthetic-bucket").file(videoName);
    let requests = 0;
    Object.defineProperty(file, "request", { value: (options: {
      qs: Record<string, unknown>; multipart: { body: AsyncIterable<Uint8Array> }[];
    }, callback: (error: null, body: unknown, response: unknown) => void) => {
      requests++;
      expect(options.qs).toMatchObject({ uploadType: "multipart", ifGenerationMatch: 0 });
      void (async () => {
        const received: Buffer[] = [];
        for await (const chunk of options.multipart[1].body) received.push(Buffer.from(chunk));
        expect(Buffer.concat(received)).toEqual(bytes);
        callback(null, metadata(videoName), { statusCode: 200 });
      })();
    } });
    await pipeline(Readable.from(bytes), file.createWriteStream({ resumable: false,
      contentType: "video/quicktime", preconditionOpts: { ifGenerationMatch: 0 } }));
    expect(requests).toBe(1);
    expect(file.metadata.size).toBe(String(bytes.length));
    expect(capturedWriteIdentity(videoName, file.metadata).generation).toBe(generation);
  });
});
