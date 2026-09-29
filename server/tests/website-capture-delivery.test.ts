// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildBrowserDelivery,
  capturedWriteIdentity,
  writeBrowserDelivery,
  publishBrowserDelivery,
} from "../utils/websiteCaptureDelivery";

const video = {
  object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mp4",
  generation: "90071992547409931",
  size_bytes: 7,
  crc32c: "AAAAAA==",
};
const manifest = {
  object_name: "scenes/site-r1/captures/walkthrough-r1/raw/manifest.json",
  generation: "90071992547409932",
  size_bytes: 4,
  crc32c: "AAAAAA==",
  sha256: "sha256:" + "a".repeat(64),
};

describe("original browser capture delivery", () => {
  it("takes exact decimal generations from the completed write response", () => {
    expect(capturedWriteIdentity(video.object_name, {
      name: video.object_name, generation: video.generation,
      size: "7", crc32c: video.crc32c,
    })).toEqual(video);
    expect(() => capturedWriteIdentity(video.object_name, {
      name: video.object_name, size: "7", crc32c: video.crc32c,
    })).toThrow();
    expect(() => capturedWriteIdentity(video.object_name, {
      name: "other", generation: video.generation, size: "7", crc32c: video.crc32c,
    })).toThrow();
    expect(() => capturedWriteIdentity(video.object_name, {
      name: video.object_name, generation: Number(video.generation), size: "7", crc32c: video.crc32c,
    })).toThrow();
  });

  it("builds a server-owned exact marker and receipt without an owner claim", () => {
    const result = buildBrowserDelivery({
      requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
      rawPrefix: "scenes/site-r1/captures/walkthrough-r1/raw",
      video, manifest, completedAtIso: "2026-09-29T00:00:00.000Z",
    });
    expect(result.record.schema_version).toBe("website_browser_capture_delivery.v1");
    expect(result.objectName).toBe(
      `scenes/site-r1/captures/walkthrough-r1/upload/producer_deliveries/browser-video-${video.generation}.json`,
    );
    expect(JSON.parse(result.markerBytes.toString("utf8"))).toMatchObject({
      producer_delivery: {
        kind: "website_browser_capture_delivery",
        object_name: result.objectName,
        raw_video_generation: video.generation,
      },
    });
    expect(JSON.stringify(result.record)).not.toMatch(/account_owner_uid|accepted_by|deletion_grant/);
    expect(result.record.marker_sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("refuses fabricated or unbounded source identities and non-UTC completion times", () => {
    const build = (overrides: Record<string, unknown>) => buildBrowserDelivery({
      requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
      rawPrefix: "scenes/site-r1/captures/walkthrough-r1/raw", video, manifest,
      completedAtIso: "2026-09-29T00:00:00.000Z", ...overrides,
    });
    expect(() => build({ video: { ...video, size_bytes: 0 } })).toThrow();
    expect(() => build({ video: { ...video, crc32c: "invalid" } })).toThrow();
    expect(() => build({ manifest: { ...manifest, size_bytes: 0 } })).toThrow();
    expect(() => build({ manifest: { ...manifest, object_name: "other" } })).toThrow();
    expect(() => build({ completedAtIso: "2026-09-29T01:00:00+01:00" })).toThrow();
  });

  it("creates only once and accepts only byte-identical retries", async () => {
    const result = buildBrowserDelivery({
      requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
      rawPrefix: "scenes/site-r1/captures/walkthrough-r1/raw",
      video, manifest, completedAtIso: "2026-09-29T00:00:00.000Z",
    });
    const stored = new Map<string, Buffer>();
    const metadata = new Map<string, { name: string; generation: string; size: string; crc32c: string }>();
    const file = (name: string) => ({
      get metadata() { return metadata.get(name); },
      async save(body: Buffer, options: { preconditionOpts?: { ifGenerationMatch?: number } }) {
        expect(options.preconditionOpts?.ifGenerationMatch).toBe(0);
        if (stored.has(name)) throw Object.assign(new Error("exists"), { code: 412 });
        stored.set(name, Buffer.from(body));
        metadata.set(name, { name, generation: "90071992547409933", size: String(body.length), crc32c: "AAAAAA==" });
      },
      async download() { return [stored.get(name)]; },
      async getMetadata() { return [this.metadata]; },
    });
    const bucket = { file };
    expect(await writeBrowserDelivery(bucket, result)).toBe("created");
    expect(await writeBrowserDelivery(bucket, result)).toBe("matched");
    stored.set(result.objectName, Buffer.from("forged"));
    await expect(writeBrowserDelivery(bucket, result)).rejects.toThrow();
  });

  it("refuses a V1 marker when V2 has replaced the canonical video before privacy resume", async () => {
    const result = buildBrowserDelivery({
      requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
      rawPrefix: "scenes/site-r1/captures/walkthrough-r1/raw", video, manifest,
      completedAtIso: "2026-09-29T00:00:00.000Z",
    });
    const bucket = { file(name: string) {
      return { async getMetadata() { return [{ name, generation: name === video.object_name
        ? "90071992547409999" : manifest.generation, size: name === video.object_name
          ? "7" : "4", crc32c: "AAAAAA==" }]; },
      async save() { throw new Error("marker_must_not_publish"); } };
    } };
    await expect(publishBrowserDelivery(bucket as never, result)).rejects.toThrow("browser_delivery_source_changed");
  });
});
