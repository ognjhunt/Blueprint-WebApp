// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { FakeGcsBucket } from "./helpers/fake-gcs-bucket";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { transportStatusCases, TRANSPORT_STATUS_VERSION, type TransportStatusCase } from "./helpers/reliability-transport-status-cases";
const store = vi.hoisted(() => ({ bucket: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => store.bucket }, default: { firestore: { FieldValue: { serverTimestamp: () => "FAKE_TIMESTAMP" } } },
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }) }));
import { composeParts, partPath, savePart, storedPartIndices } from "../utils/captureParts";
import { describeBrowserUpload } from "../utils/websiteBrowserUploadStatus";
import { buildBrowserDelivery, capturedWriteIdentity } from "../utils/websiteCaptureDelivery";
import type { BrowserPending, BrowserStoredUpload } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import uploadsRouter from "../routes/self-capture-uploads";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHashes = Object.fromEntries(["server/utils/captureParts.ts", "server/routes/self-capture-uploads.ts", "server/utils/websiteBrowserUploadStatus.ts", "server/utils/websiteBrowserPending.ts",
  "server/tests/helpers/reliability-transport-status-cases.ts", "server/tests/reliability-program-transport-status.test.ts"].map(p => [p, createHash("sha256").update(readFileSync(p)).digest("hex")]));
const traces: Record<string, unknown>[] = [];
let events: Record<string, unknown>[] = [];
const RAW = "scenes/site-rts/captures/walkthrough-rts/raw", VIDEO = `${RAW}/walkthrough.mp4`;
function bucketHarness(scenario = "") {
  const original = new FakeGcsBucket("fixture-local-capture-bucket");
  const bucket = {
    file(name: string, options?: { generation?: string }) {
      const ref = original.file(name);
      return { ...ref,
        get metadata() { return ref.metadata; },
        getMetadata: async () => { events.push({ event: "metadata", name }); return ref.getMetadata(); },
        download: async () => {
          events.push({ event: "download", name, generation: options?.generation ?? null });
          if (options?.generation && String(original.objects.get(name)?.generation) !== options.generation) throw Object.assign(new Error("fixture stale generation"), { code: 412 });
          return ref.download();
        },
        delete: async () => { original.objects.delete(name); },
      };
    },
    getFiles: (options: { prefix: string }) => original.getFiles(options),
    async combine(sources: string[], destination: string, options?: { ifGenerationMatch: string | number }) {
      const boundary = destination === VIDEO ? "final" : "intermediate";
      events.push({ event: "combine", boundary, sources: [...sources], destination, precondition: options?.ifGenerationMatch ?? null });
      if (scenario === `${boundary}_failure`) throw new Error(`fixture ${boundary} compose unavailable`);
      if (sources.some(name => !original.objects.has(name))) throw Object.assign(new Error("fixture missing compose source"), { code: 404 });
      if (options?.ifGenerationMatch === 0 && original.objects.has(destination)) throw Object.assign(new Error("fixture destination exists"), { code: 412 });
      const bytes = Buffer.concat(sources.map(name => original.objects.get(name)!.data));
      original.seed(destination, bytes, destination === VIDEO ? "video/mp4" : "application/octet-stream");
      return [bucket.file(destination), bucket.file(destination).metadata];
    },
  };
  return { bucket, original };
}
beforeEach(() => { state.docs.clear(); events = []; store.bucket = bucketHarness().bucket; });
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  const dir = resolve(process.env.RELIABILITY_TRANSPORT_STATUS_OUTPUT || "output/reliability-program/transport-status"); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "results.json"), JSON.stringify({ schemaVersion: TRANSPORT_STATUS_VERSION, codeSha: sourceSha, sourceHashes,
    generated: transportStatusCases.length, deduplicated: new Set(transportStatusCases.map(c => c.hash)).size,
    attempted: traces.length, passed: traces.filter(t => t.status === "passed").length, failed: traces.filter(t => t.status === "failed").length,
    skipped: 0, blocked: 0, partiallyExecuted: 0, liveProviderCalls: 0, liveProviderCostUsd: null,
    replay: "npx vitest run server/tests/reliability-program-transport-status.test.ts --maxWorkers=1", cases: transportStatusCases, traces,
    limitation: "Actual business functions with in-memory object/Firebase fakes; no live provider, network interruption, video decoding, browser termination or production latency proof.",
  }, null, 2));
});
async function tracked(c: TransportStatusCase, run: () => Promise<void>) {
  const began = performance.now(); let status = "passed", error: string | null = null;
  try { await run(); } catch (e) { status = "failed"; error = e instanceof Error ? e.message : String(e); throw e; }
  finally { traces.push({ caseId: c.id, semanticHash: c.hash, status, error, elapsedMs: performance.now() - began, layer: c.layer, events }); }
}

describe("frozen upload-transport boundaries", () => {
  it.each(transportStatusCases.filter(c => c.family === "upload_transport"))("$id", c => tracked(c, async () => {
    const scenario = String(c.parameters.scenario), count = Number(c.parameters.parts), harness = bucketHarness(scenario);
    const missing = scenario === "missing_first" ? 0 : scenario === "missing_middle" ? Math.floor(count / 2) : scenario === "missing_last" ? count - 1 : null;
    const bytes = Array.from({ length: count }, (_, index) => Buffer.from(`chunk-${String(index).padStart(3, "0")};`));
    const indices = Array.from({ length: count }, (_, index) => index);
    if (scenario === "reordered_arrival") indices.reverse();
    for (const index of indices) {
      if (index === missing) { events.push({ event: "omitted", index }); continue; }
      await savePart({ bucket: harness.bucket, rawPrefix: RAW, index, body: bytes[index]! });
      events.push({ event: "acknowledged-part", index });
    }
    const original = Buffer.concat(bytes);
    let duplicateError: unknown;
    if (scenario.startsWith("duplicate_")) {
      const index = Math.floor(count / 2), body = scenario === "duplicate_identical" ? bytes[index]! : Buffer.alloc(bytes[index]!.length, 0x58);
      events.push({ event: "duplicate-attempt", index, identical: scenario === "duplicate_identical" });
      try { await savePart({ bucket: harness.bucket, rawPrefix: RAW, index, body }); } catch (error) { duplicateError = error; }
      events.push({ event: "duplicate-readback", index, errorCode: duplicateError instanceof Error ? duplicateError.message : null,
        originalSha256: createHash("sha256").update(bytes[index]!).digest("hex"),
        persistedSha256: createHash("sha256").update(harness.original.objects.get(partPath(RAW, index))!.data).digest("hex") });
    }
    if (scenario === "destination_generation_conflict") harness.original.seed(VIDEO, "prior-acknowledged-video", "video/mp4");
    const call = () => composeParts({ bucket: harness.bucket, rawPrefix: RAW, objectPath: VIDEO, expectedParts: count, ifGenerationMatch: 0 });
    if (missing !== null) {
      expect(await call()).toEqual({ ok: false, reason: "missing_parts", missing: [missing] });
      expect(events.some(e => e.event === "combine")).toBe(false); expect(harness.original.objects.has(VIDEO)).toBe(false);
    } else if (["intermediate_failure", "final_failure", "destination_generation_conflict"].includes(scenario)) {
      await expect(call()).rejects.toThrow(/fixture/);
      const target = scenario === "intermediate_failure" ? "intermediate" : "final";
      expect(events.some(e => e.event === "combine" && e.boundary === target)).toBe(true);
      expect(await storedPartIndices(harness.bucket, RAW)).toHaveLength(count);
      expect(harness.original.text(VIDEO)).toBe(scenario === "destination_generation_conflict" ? "prior-acknowledged-video" : null);
    } else {
      const result = await call(); expect(result).toMatchObject({ ok: true, parts: count });
      events.push({ event: "composed-readback", expectedSize: original.length, actualSize: harness.original.objects.get(VIDEO)!.data.length,
        expectedSha256: createHash("sha256").update(original).digest("hex"), actualSha256: createHash("sha256").update(harness.original.objects.get(VIDEO)!.data).digest("hex") });
      expect(harness.original.objects.get(VIDEO)!.data.equals(original)).toBe(true);
      if (result.ok) expect(result.video.size_bytes).toBe(original.length);
      expect(events.filter(e => e.event === "combine").every(e => (e.sources as string[]).length <= 32)).toBe(true);
    }
    if (scenario === "duplicate_conflicting") expect(duplicateError).toBeInstanceOf(Error);
    if (scenario === "duplicate_conflicting") expect((duplicateError as Error).message).toBe("capture_part_conflict");
    if (scenario === "duplicate_identical") expect(duplicateError).toBeUndefined();
    expect(harness.original.names().some(p => p.includes("capture_upload_complete"))).toBe(false);
  }));
});

describe("frozen status/publication proof dependencies", () => {
  it.each(transportStatusCases.filter(c => c.family === "status_publication"))("$id", c => tracked(c, async () => {
    const scenario = String(c.parameters.scenario), form = String(c.parameters.state), harness = bucketHarness(); store.bucket = harness.bucket;
    harness.original.seed(VIDEO, "synthetic-whole-video", "video/mp4");
    const manifestJson = JSON.stringify({ request_id: "rts", scene_id: "site-rts", capture_id: "walkthrough-rts", video_uri: VIDEO,
      capture_rights: { derived_scene_generation_allowed: scenario !== "original_grant_absent", consent_status: "granted", consent_revoked: false } });
    const manifestName = `${RAW}/manifest.json`; harness.original.seed(manifestName, manifestJson, "application/json");
    const video = capturedWriteIdentity(VIDEO, harness.bucket.file(VIDEO).metadata), manifest = { ...capturedWriteIdentity(manifestName, harness.bucket.file(manifestName).metadata), sha256: `sha256:${createHash("sha256").update(manifestJson).digest("hex")}` };
    const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "rts", scene_id: "site-rts", capture_id: "walkthrough-rts",
      state: form === "published" ? "published" : "held", completed_at_iso: "2026-10-01T00:00:00.000Z", video, manifest };
    const stored: BrowserStoredUpload = { schema_version: "website_browser_stored_upload.v1", request_id: "rts", scene_id: "site-rts", capture_id: "walkthrough-rts",
      completed_at_iso: pending.completed_at_iso, video, manifest_json: manifestJson, manifest_sha256: manifest.sha256 };
    const delivery = buildBrowserDelivery({ requestId: "rts", sceneId: "site-rts", captureId: "walkthrough-rts", rawPrefix: RAW,
      video, manifest, completedAtIso: pending.completed_at_iso });
    if (form === "published") { harness.original.seed(`${RAW}/capture_upload_complete.json`, delivery.markerBytes, "application/json"); harness.original.seed(delivery.objectName, delivery.recordBytes, "application/json"); }
    state.docs.set("inboundRequests/rts", { request: { consent_attestation: { granted: scenario !== "current_consent_withdrawn",
      statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } } });
    if (scenario === "video_absent") harness.original.objects.delete(VIDEO);
    if (scenario === "video_generation_changed") harness.original.seed(VIDEO, "synthetic-new-generation", "video/mp4");
    if (scenario === "video_size_mismatch") video.size_bytes += 1;
    if (scenario === "video_crc_mismatch") video.crc32c = "AQIDBA==";
    if (scenario === "cross_request") { pending.request_id = "different-request"; stored.request_id = "different-request"; }
    if (scenario === "manifest_missing") harness.original.objects.delete(manifestName);
    if (scenario === "manifest_changed") harness.original.seed(manifestName, "changed-manifest", "application/json");
    if (scenario === "marker_missing") harness.original.objects.delete(`${RAW}/capture_upload_complete.json`);
    if (scenario === "receipt_changed") harness.original.seed(delivery.objectName, Buffer.from('{"forged":true}'), "application/json");
    if (scenario === "saved_manifest_hash_changed") stored.manifest_sha256 = `sha256:${"0".repeat(64)}`;
    state.docs.set("captureUploadSessions/walkthrough-rts", form === "stored" ? { browser_stored_upload: stored } : { browser_pending_delivery: pending });
    events.push({ event: "fault-injected", form, scenario });
    const status = await describeBrowserUpload({ requestId: "rts", sceneId: "site-rts", captureId: "walkthrough-rts" }, scenario !== "disallowed_actor");
    events.push({ event: "customer-status", ...status });
    const invalidSource = ["video_absent", "video_generation_changed", "video_size_mismatch", "video_crc_mismatch", "cross_request", "saved_manifest_hash_changed"].includes(scenario);
    if (invalidSource) expect(status).toMatchObject({ captureReceived: false, uploadState: "status_unavailable", processingRetryAvailable: false });
    else if (form === "published" && ["manifest_missing", "manifest_changed", "marker_missing", "receipt_changed"].includes(scenario)) expect(status).toMatchObject({ captureReceived: true, uploadState: "retained", processingRetryAvailable: false, processingHold: { code: "capture_handoff_unverified" } });
    else {
      const healthyRetry = !["manifest_missing", "manifest_changed", "current_consent_withdrawn", "original_grant_absent", "disallowed_actor"].includes(scenario);
      expect(status).toMatchObject({ captureReceived: true, uploadState: form === "published" ? "processing_ready" : "processing_pending", processingRetryAvailable: form !== "published" && healthyRetry });
      if (["current_consent_withdrawn", "original_grant_absent"].includes(scenario)) expect(status.processingHold?.code).toBe("capture_processing_not_authorized");
    }
    if (!["cross_request", "saved_manifest_hash_changed"].includes(scenario)) expect(events.some(e => e.event === "metadata" && e.name === VIDEO)).toBe(true);
    if (["manifest_missing", "manifest_changed"].includes(scenario)) expect(events.some(e => e.event === "metadata" && e.name === manifestName)).toBe(true);
    if (["marker_missing", "receipt_changed"].includes(scenario)) expect(events.some(e => e.event === "metadata" && e.name === (scenario === "marker_missing" ? `${RAW}/capture_upload_complete.json` : delivery.objectName))).toBe(true);
  }));
});

describe("neighboring duplicate transport recovery", () => {
  it("returns actionable409 from the actual part handler while preserving original bytes", async () => {
    const harness = bucketHarness(); store.bucket = harness.bucket;
    const original = Buffer.from("original-chunk");
    await savePart({ bucket: harness.bucket, rawPrefix: RAW, index: 0, body: original });
    const route = (uploadsRouter as any).stack.find((layer: any) => layer.route?.path === "/:token/parts/:index").route;
    const response = { statusCode: 200, body: undefined as any,
      status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    await route.stack.at(-1).handle({
      params: { token: createCaptureUploadToken({ requestId: "rts", sceneId: "site-rts", captureId: "walkthrough-rts" }), index: "0" },
      query: { extension: "mp4" }, file: { originalname: "part", buffer: Buffer.alloc(original.length, 0x58), size: original.length },
    }, response);
    expect(response.statusCode).toBe(409); expect(response.body).toMatchObject({ code: "capture_part_conflict", retryAllowed: false });
    expect(response.body.error).toContain("original video");
    expect(harness.original.objects.get(partPath(RAW, 0))!.data.equals(original)).toBe(true);
  });

  it("rejects generation replacement during an otherwise identical duplicate readback", async () => {
    const harness = bucketHarness(); const bytes = Buffer.from("original-chunk"), name = partPath(RAW, 0);
    await savePart({ bucket: harness.bucket, rawPrefix: RAW, index: 0, body: bytes });
    const originalFile = harness.bucket.file.bind(harness.bucket);
    vi.spyOn(harness.bucket, "file").mockImplementation((path: string, options?: { generation?: string }) => {
      const ref = originalFile(path, options);
      return options?.generation ? { ...ref, download: async () => {
        const result = await ref.download(); harness.original.seed(path, "successor-chunk"); return result;
      } } : ref;
    });
    await expect(savePart({ bucket: harness.bucket, rawPrefix: RAW, index: 0, body: bytes })).rejects.toThrow("capture_part_conflict");
    expect(harness.original.text(name)).toBe("successor-chunk");
  });
});
