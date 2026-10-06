// @vitest-environment node
import { describe, expect, it } from "vitest";
import deliveryFixture from "./fixtures/website-browser-delivery-web493.json";

import {
  buildBrowserDelivery,
  capturedWriteIdentity,
  captureWriteFailureDiagnostic,
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
  it("matches the exact cross-repo Capture consumer fixture without rewriting retained bytes", () => {
    const built = buildBrowserDelivery(deliveryFixture.input);
    expect(built.objectName).toBe(deliveryFixture.receipt_object_name);
    expect(built.markerBytes.toString("utf8")).toBe(deliveryFixture.marker_json);
    expect(built.recordBytes.toString("utf8")).toBe(deliveryFixture.receipt_json);
  });
  it.each([7, Number.MAX_SAFE_INTEGER, "7", String(Number.MAX_SAFE_INTEGER)])(
    "accepts only exact safe integer byte counts: %s", size => {
      expect(capturedWriteIdentity(video.object_name, { name: video.object_name,
        generation: video.generation, size, crc32c: video.crc32c }).size_bytes).toBe(Number(size));
    },
  );

  it.each([0, -1, 7.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0", "-1", "7.5", "07",
    "7e0", " 7", "7 ", "9007199254740992", true, null, undefined, {}, new Number(7)])(
    "refuses malformed or inexact byte counts: %s", size => {
      let failure: unknown;
      try { capturedWriteIdentity(video.object_name, { name: video.object_name,
        generation: video.generation, size, crc32c: video.crc32c }); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      expect(captureWriteFailureDiagnostic("manifest_identity", failure)).toEqual({
        stage: "manifest_identity", code: "capture_write_identity_unavailable", identityField: "size" });
    },
  );

  it("reports fixed identity fields without embedding response values", () => {
    for (const [patch, identityField] of [
      [{ name: "private/provider/path" }, "object_name"],
      [{ generation: Number(video.generation) }, "generation"],
      [{ crc32c: "private=checksum" }, "crc32c"],
    ] as const) {
      let failure: unknown;
      try { capturedWriteIdentity(video.object_name, { name: video.object_name,
        generation: video.generation, size: 7, crc32c: video.crc32c, ...patch }); }
      catch (error) { failure = error; }
      expect(captureWriteFailureDiagnostic("manifest_identity", failure)).toEqual({
        stage: "manifest_identity", code: "capture_write_identity_unavailable", identityField });
    }
  });

  it("keeps known bounded codes and drops arbitrary error details", () => {
    expect(captureWriteFailureDiagnostic("pending_record", new Error("browser_pending_changed")))
      .toEqual({ stage: "pending_record", code: "browser_pending_changed" });
    expect(captureWriteFailureDiagnostic("manifest_write", Object.assign(new Error("private message"), { code: 412 })))
      .toEqual({ stage: "manifest_write", code: 412 });
    const privateError = Object.assign(new Error("owner@example.com https://private.invalid/?token=secret"), {
      code: "PRIVATE_VALUE", headers: { authorization: "secret" }, data: { video: "private/path" },
    });
    for (const error of [privateError, "private token", null, { code: 600 }, { code: 1.5 }, { code: "412" }])
      expect(captureWriteFailureDiagnostic("manifest_write", error)).toEqual({ stage: "manifest_write", code: "unknown" });
  });

  it("snapshots changing accessors once and contains throwing diagnostic properties", () => {
    let codeReads = 0;
    let messageReads = 0;
    const changing = { get code() { return ++codeReads === 1 ? 412 : "private token"; },
      get message() { messageReads++; return "private provider URL"; } };
    expect(captureWriteFailureDiagnostic("manifest_write", changing)).toEqual({ stage: "manifest_write", code: 412 });
    expect([codeReads, messageReads]).toEqual([1, 1]);
    messageReads = 0;
    expect(captureWriteFailureDiagnostic("pending_record", {
      get message() { return ++messageReads === 1 ? "browser_pending_changed" : "private token"; },
    })).toEqual({ stage: "pending_record", code: "browser_pending_changed" });
    expect(messageReads).toBe(1);
    for (const key of ["code", "message"]) {
      const throwing = Object.defineProperty({}, key, { get() { throw new Error("private token"); } });
      expect(captureWriteFailureDiagnostic("manifest_write", throwing)).toEqual({ stage: "manifest_write", code: "unknown" });
    }
  });

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
