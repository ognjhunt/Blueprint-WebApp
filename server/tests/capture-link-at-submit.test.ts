// @vitest-environment node
/**
 * The link a site gets at submit, and what it is allowed to do.
 *
 * ## What changed
 *
 * A capture token used to be minted only after a request had cleared the screen
 * and been dispatched, and it went out by email. So holding a valid token was
 * the same thing as being allowed to use it, and a site that already knew it
 * had passed still had to go and find an inbox for a link that existed a second
 * after it pressed submit.
 *
 * The link is now issued at submit to every site, whatever the screen said. That
 * breaks the old equivalence, and these tests are about the thing that replaces
 * it: the token names a storage destination, and permission is re-read from the
 * request every time the link is used.
 *
 * The security half matters more than the convenience half. If a token issued
 * to a blocked site could be POSTed to, the whole screen would be advisory —
 * so the refusal is tested on the server, not on the page.
 */
import express from "express";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";

// The privacy screen is exercised in its own file; here it only has to be
// controllable, so the marker-writing path can be tested on both answers.
const screenCaptureForPrivacy = vi.hoisted(() =>
  vi.fn(async () => ({ proceed: true, outcome: "cleared", detail: null, evidence: null })),
);
vi.mock("../utils/capturePrivacyScreen", () => ({ screenCaptureForPrivacy }));
vi.mock("../utils/slack", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/slack")>(),
  notifySlackFootageNeedsReview: vi.fn(async () => false),
}));

/** Every object written to the bucket, by path, so the marker can be asserted. */
const written = vi.hoisted(() => new Map<string, string>());
const storedVersions = vi.hoisted(() => new Map<string, { body: Buffer; metadata: Record<string, string> }>());
const generations = vi.hoisted(() => ({ next: 1 }));
const writeGate = vi.hoisted(() => ({ current: null as null | { entered(): void; wait: Promise<void> } }));
const cleanupGate = vi.hoisted(() => ({ current: null as null | { wait: Promise<void> } }));
const writeFault = vi.hoisted(() => ({ manifestOnce: false, markerOnce: false, readUnavailable: false,
  manifestError: null as unknown, manifestResponseSize: undefined as unknown,
  beforeManifestExists: null as null | (() => void) }));

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, unlink: async (path: Parameters<typeof original.unlink>[0]) => {
    const gate = cleanupGate.current;
    if (gate && typeof path === "string" && path.includes("/self-capture-")) await gate.wait;
    return original.unlink(path);
  } };
});

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  const { Writable } = await import("node:stream");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: {
      bucket: () => ({
        getFiles: async ({ prefix }: { prefix: string }) => [[...written.keys()]
          .filter(name => name.startsWith(prefix)).map(name => ({ name }))],
        combine: async (sources: string[], destination: string, options?: { ifGenerationMatch?: number | string }) => {
          const latest = (name: string) => [...storedVersions.entries()].reverse()
            .find(([key]) => key.startsWith(`${name}@`))?.[1];
          if (options?.ifGenerationMatch !== undefined
              && String(options.ifGenerationMatch) !== String(latest(destination)?.metadata.generation ?? 0))
            throw Object.assign(new Error("compose precondition failed"), { code: 412 });
          const body = Buffer.concat(sources.map(name => {
            const stored = latest(name);
            if (!stored) throw new Error("missing_compose_source");
            return stored.body;
          }));
          const metadata = { name: destination, generation: String(generations.next++),
            size: String(body.length), crc32c: "AAAAAA==" };
          storedVersions.set(`${destination}@${metadata.generation}`, { body, metadata });
          written.set(destination, "<binary>");
          return [null, metadata];
        },
        file: (path: string, options?: { generation?: string }) => {
          let responseMetadata: Record<string, string> | undefined;
          let resumableResponse = false;
          const current = () => options?.generation
            ? storedVersions.get(`${path}@${options.generation}`)
            : [...storedVersions.entries()].reverse().find(([key]) => key.startsWith(`${path}@`))?.[1];
          const write = (body: Buffer) => {
            responseMetadata = { name: path, generation: String(generations.next++),
              size: String(body.length), crc32c: "AAAAAA==" };
            storedVersions.set(`${path}@${responseMetadata.generation}`, { body, metadata: responseMetadata });
            written.set(path, path.endsWith("walkthrough.mov") ? "<binary>" : body.toString("utf8"));
          };
          return {
          delete: async () => {
            if (!options?.generation) throw new Error("deletion must bind the exact generation");
            storedVersions.delete(`${path}@${options.generation}`);
            written.delete(path);
          },
          // Storage 7.21 default-resumable writes normalize size to a number.
          // Metadata GET and the non-resumable video stream retain strings.
          get metadata() { return responseMetadata && resumableResponse
            ? { ...responseMetadata, size: writeFault.manifestResponseSize ?? Number(responseMetadata.size) }
            : responseMetadata; },
          save: async (body: unknown, config?: { resumable?: boolean; preconditionOpts?: { ifGenerationMatch?: string | number } }) => {
            if (path.endsWith("/manifest.json")) expect(config?.resumable).toBeUndefined();
            if (path.endsWith("/manifest.json") && writeFault.manifestError) throw writeFault.manifestError;
            if (path.endsWith("/manifest.json") && writeFault.manifestOnce) {
              writeFault.manifestOnce = false;
              throw new Error("injected_manifest_write_failure");
            }
            if (path.endsWith("/capture_upload_complete.json") && writeFault.markerOnce) {
              writeFault.markerOnce = false;
              throw new Error("injected_marker_write_failure");
            }
            const match = config?.preconditionOpts?.ifGenerationMatch;
            if (match !== undefined && String(match) !== String(current()?.metadata.generation ?? 0)) {
              throw Object.assign(new Error("precondition failed"), { code: 412 });
            }
            write(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
            resumableResponse = config?.resumable !== false;
          },
          getMetadata: async () => {
            if (writeFault.readUnavailable) throw new Error("injected_storage_read_failure");
            const value = current();
            if (!value) throw Object.assign(new Error("missing"), { code: 404 });
            return [value.metadata];
          },
          exists: async () => {
            if (path.endsWith("/manifest.json") && writeFault.beforeManifestExists) {
              const inspect = writeFault.beforeManifestExists;
              writeFault.beforeManifestExists = null;
              inspect();
            }
            return [Boolean(current())];
          },
          download: async () => {
            const value = current();
            if (!value) throw Object.assign(new Error("missing"), { code: 404 });
            return [value.body];
          },
          // The route now streams uploads to disk-backed temp files and into
          // storage through a write stream, so the fake has to speak that
          // surface too. The bytes are recorded, not kept.
          createWriteStream: (config?: { resumable?: boolean; preconditionOpts?: { ifGenerationMatch?: number | string } }) => {
            expect(config?.resumable).toBe(false);
            const chunks: Buffer[] = [];
            return new Writable({
              write(chunk, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                callback();
              },
              final(callback) {
                const match = config?.preconditionOpts?.ifGenerationMatch;
                const perform = () => {
                  if ((/\/walkthrough\.(mov|mp4)$/.test(path) && match === undefined)
                      || match !== undefined && String(match) !== String(current()?.metadata.generation ?? 0)) {
                    callback(Object.assign(new Error("write precondition failed"), { code: 412 }));
                    return;
                  }
                  write(Buffer.concat(chunks)); callback();
                };
                const gate = writeGate.current;
                if (!gate) { perform(); return; }
                writeGate.current = null;
                gate.entered();
                gate.wait.then(perform, callback);
              },
            });
          },
        };
        },
      }),
    },
    authAdmin: { verifyIdToken: async () => ({ uid: "nobody" }) },
  };
});

const { captureUploadUrlFor } = await import("../utils/captureUploadToken");
const { authorizeCaptureUpload } = await import("../utils/captureUploadAuthorization");
const { browserPendingDecisionKey, reserveBrowserUpload, releaseBrowserUpload, recordBrowserPending,
  prepareLegacyBrowserFinish } = await import("../utils/websiteBrowserPending");

async function startRoutes(): Promise<{ server: Server; baseUrl: string }> {
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const app = express();
  app.use(express.json());
  app.use("/api/self-capture/uploads", uploads);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function withRoutes<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const { server, baseUrl } = await startRoutes();
  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

/** The token out of a capture URL, which is what the routes take. */
function tokenFrom(url: string): string {
  return url.split("/capture-upload/")[1];
}

function seedRequest(
  requestId: string,
  triage: Record<string, unknown>,
  captureMode: string | null = "self_capture",
) {
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, {
    requestId,
    contact: { email: "owner@example.com" },
    request: { buyerType: "site_operator", capture_mode: captureMode, capture_region: "us",
      consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
        recorded_at_iso: "2026-09-18T12:00:00.000Z" } },
    site_task_triage: {
      blocking_field_ids: [],
      blockers: [],
      open_questions: [],
      unanswered_field_ids: [],
      incomplete: false,
      evaluated_at: "2026-09-17T00:00:00.000Z",
      ...triage,
    },
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  written.clear();
  storedVersions.clear();
  generations.next = 1;
  writeGate.current = null;
  cleanupGate.current = null;
  writeFault.manifestOnce = false;
  writeFault.markerOnce = false;
  writeFault.readUnavailable = false;
  writeFault.manifestError = null;
  writeFault.manifestResponseSize = undefined;
  writeFault.beforeManifestExists = null;
  screenCaptureForPrivacy.mockClear();
  screenCaptureForPrivacy.mockResolvedValue({
    proceed: true,
    outcome: "cleared",
    detail: null,
    evidence: null,
  });
});

/** A well-formed upload for a site that cleared the screen. */
async function uploadFor(baseUrl: string, requestId: string, bytes = "x") {
  const token = tokenFrom(captureUploadUrlFor(requestId));
  const form = new FormData();
  form.append("video", new Blob([bytes], { type: "video/quicktime" }), "walk.mov");
  form.append(
    "metadata",
    JSON.stringify({
      widthPx: 1920,
      heightPx: 1080,
      durationSeconds: 61,
      fps: 30,
      recordedAtEpochMs: 1_758_000_000_000,
    }),
  );
  const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`, {
    method: "POST",
    body: form,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function uploadStatus(baseUrl: string, requestId: string) {
  const token = tokenFrom(captureUploadUrlFor(requestId));
  const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function retryProcessing(baseUrl: string, requestId: string) {
  const token = tokenFrom(captureUploadUrlFor(requestId));
  const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function waitForUploadRelease(requestId: string) {
  // An HTTP response can arrive while the route still awaits temp-file cleanup.
  // Recovery owns a separate reservation only after the original one is released.
  await vi.waitFor(() => expect(sharedFakeFirestoreState.docs.get(
    `captureUploadSessions/walkthrough-${requestId}`,
  )).toMatchObject({ browser_upload_reservation: null }), { timeout: 5000, interval: 10 });
}

describe("saved footage and processing are separate receipts", () => {
  it("keeps an interrupted upload reserved through cleanup before admitting processing retry", async () => {
    seedRequest("req-cleanup-drain", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    let releaseCleanup!: () => void;
    cleanupGate.current = { wait: new Promise<void>(resolve => { releaseCleanup = resolve; }) };
    try {
      await withRoutes(async baseUrl => {
        expect(await uploadFor(baseUrl, "req-cleanup-drain", "original video"))
          .toMatchObject({ status: 502, body: { captureReceived: true, state: "processing_pending" } });
        const sessionPath = "captureUploadSessions/walkthrough-req-cleanup-drain";
        const originalReservation = sharedFakeFirestoreState.docs.get(sessionPath)?.browser_upload_reservation;
        expect(originalReservation).toMatchObject({ capture_id: "walkthrough-req-cleanup-drain" });
        const versions = [...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"));
        expect(await retryProcessing(baseUrl, "req-cleanup-drain"))
          .toMatchObject({ status: 409, body: { code: "capture_retry_in_progress" } });
        expect(sharedFakeFirestoreState.docs.get(sessionPath)?.browser_upload_reservation).toEqual(originalReservation);
        expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toEqual(versions);
        releaseCleanup();
        await waitForUploadRelease("req-cleanup-drain");
        expect(await retryProcessing(baseUrl, "req-cleanup-drain"))
          .toMatchObject({ status: 200, body: { state: "processing_ready" } });
        expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toEqual(versions);
        await waitForUploadRelease("req-cleanup-drain");
      });
    } finally { releaseCleanup(); cleanupGate.current = null; }
  });

  it("records a numeric-size manifest write response without changing the video generation", async () => {
    seedRequest("req-sdk-manifest", { disposition: "qualified" });
    await withRoutes(async baseUrl => {
      const result = await uploadFor(baseUrl, "req-sdk-manifest", "original video");
      expect(result).toMatchObject({ status: 201, body: { captureReceived: true, uploadState: "processing_ready" } });
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-sdk-manifest") as Record<string, any>;
      const pending = session.browser_pending_delivery;
      const manifestBytes = Buffer.from(written.get(pending.manifest.object_name)!);
      expect(pending.manifest.size_bytes).toBe(manifestBytes.length);
      expect(typeof pending.manifest.generation).toBe("string");
      expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@")))
        .toEqual([`${pending.video.object_name}@${pending.video.generation}`]);
      const markerName = pending.manifest.object_name.replace("manifest.json", "capture_upload_complete.json");
      expect(JSON.parse(written.get(markerName)!).producer_delivery.raw_video_generation).toBe(pending.video.generation);
    });
  });

  it.each([
    { fault: "write", stage: "manifest_write", code: 412 },
    { fault: "unknown", stage: "manifest_write", code: "unknown" },
    { fault: "identity", stage: "manifest_identity", code: "capture_write_identity_unavailable", identityField: "size" },
  ])("records a bounded diagnostic for $fault failure and retains only proven receipt authority", async expected => {
    const { logger } = await import("../logger");
    const log = vi.spyOn(logger, "error");
    seedRequest("req-safe-diagnostic", { disposition: "qualified" });
    if (expected.fault === "write") writeFault.manifestError = Object.assign(new Error("private provider detail"), { code: 412 });
    if (expected.fault === "unknown") writeFault.manifestError = Object.assign(new Error("owner@example.com ?token=secret"),
      { code: "private-code", stack: "private-stack", headers: { authorization: "secret" } });
    if (expected.fault === "identity") writeFault.manifestResponseSize = 1.5;
    try {
      await withRoutes(async baseUrl => {
        expect(await uploadFor(baseUrl, "req-safe-diagnostic", "original video")).toMatchObject({ status: 502,
          body: { captureReceived: true, state: "processing_pending", processingRetryAvailable: true } });
        const record = log.mock.calls.find(call => call[1] === "Self-capture video stored but its exact manifest or pending identity failed");
        const { fault: _fault, ...diagnostic } = expected;
        expect(record?.[0]).toEqual({ captureId: "walkthrough-req-safe-diagnostic", captureWriteFailure: diagnostic });
        expect(JSON.stringify(record)).not.toMatch(/owner@example|token=secret|private-provider|private-stack|authorization/);
        expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
        const versions = [...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"));
        writeFault.manifestError = null;
        writeFault.manifestResponseSize = undefined;
        await waitForUploadRelease("req-safe-diagnostic");
        expect((await retryProcessing(baseUrl, "req-safe-diagnostic")).status).toBe(200);
        expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toEqual(versions);
        await waitForUploadRelease("req-safe-diagnostic");
      });
    } finally { log.mockRestore(); }
  });

  it("recovers an interrupted manifest from the original measured draft without replacing the video", async () => {
    seedRequest("req-manifest-recovery", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    await withRoutes(async baseUrl => {
      const first = await uploadFor(baseUrl, "req-manifest-recovery", "original video");
      expect(first).toMatchObject({ status: 502, body: { state: "processing_pending",
        captureReceived: true, processingRetryAvailable: true } });
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-manifest-recovery") as Record<string, any>;
      const original = structuredClone(session.browser_stored_upload);
      expect(original.manifest_json).toContain('"fps_source": 30');
      const videoBefore = [...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"));
      const markerName = "scenes/site-req-manifest-recovery/captures/walkthrough-req-manifest-recovery/raw/capture_upload_complete.json";
      // Refresh and Back only ask a question; they cannot enqueue processing.
      for (let i = 0; i < 2; i++) expect((await uploadStatus(baseUrl, "req-manifest-recovery")).body)
        .toMatchObject({ state: "ready", uploadState: "processing_pending", captureReceived: true,
          processingRetryAvailable: true });
      expect(written.has(markerName)).toBe(false);
      expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
      expect((await uploadFor(baseUrl, "req-manifest-recovery", "replacement")).status).toBe(409);
      expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toEqual(videoBefore);
      sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-manifest-recovery", { summary: "Changed later", confirmedAtIso: null });
      expect(await retryProcessing(baseUrl, "req-manifest-recovery")).toMatchObject({ status: 200,
        body: { state: "processing_ready", captureReceived: true, processingRetryAvailable: false } });
      const manifestName = original.video.object_name.replace("walkthrough.mov", "manifest.json");
      expect(written.get(manifestName)).toBe(original.manifest_json);
      const finished = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-manifest-recovery") as Record<string, any>;
      expect(finished.browser_stored_upload).toBeNull();
      expect(finished.browser_pending_delivery).toMatchObject({ state: "published", video: original.video,
        completed_at_iso: original.completed_at_iso });
      const versionsBefore = [...storedVersions.keys()];
      expect((await retryProcessing(baseUrl, "req-manifest-recovery")).status).toBe(200);
      expect([...storedVersions.keys()]).toEqual(versionsBefore);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("serializes repeated processing retries of an interrupted manifest", async () => {
    seedRequest("req-retry-concurrent", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-retry-concurrent", "original")).status).toBe(502);
      const results = await Promise.all([retryProcessing(baseUrl, "req-retry-concurrent"), retryProcessing(baseUrl, "req-retry-concurrent")]);
      expect(results.some(result => result.status === 200)).toBe(true);
      expect(results.every(result => [200, 409].includes(result.status))).toBe(true);
      expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toHaveLength(1);
      expect([...storedVersions.keys()].filter(name => name.includes("/capture_upload_complete.json@"))).toHaveLength(1);
      expect((await uploadStatus(baseUrl, "req-retry-concurrent")).body.uploadState).toBe("processing_ready");
    });
  });

  it("keeps composed footage and reports processing failure when the privacy record is interrupted", async () => {
    seedRequest("req-parts-recovery", { disposition: "qualified" });
    screenCaptureForPrivacy.mockImplementationOnce(async () => {
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-parts-recovery") as Record<string, any>;
      request.capture_privacy_screening_claim.id = "interrupted-claim";
      return { proceed: true, eligibility: "unscreened", outcome: "not_reviewed", detail: null, evidence: null };
    });
    await withRoutes(async baseUrl => {
      const token = tokenFrom(captureUploadUrlFor("req-parts-recovery"));
      const part = new FormData();
      part.append("part", new Blob(["original video"]), "part.bin");
      expect((await fetch(`${baseUrl}/api/self-capture/uploads/${token}/parts/0?extension=mov`, {
        method: "PUT", body: part,
      })).status).toBe(200);
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/parts/complete`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parts: 1, extension: "mov", sizeBytes: 14,
          metadata: { widthPx: 1920, heightPx: 1080, fps: 30, durationSeconds: 61,
            recordedAtEpochMs: 1_758_000_000_000 } }),
      });
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ state: "processing_pending", captureReceived: true,
        processingRetryAvailable: true });
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-parts-recovery") as Record<string, any>;
      request.capture_privacy_screening_claim.expires_at_ms = Date.now() - 1;
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
        outcome: "not_reviewed", detail: null, evidence: null });
      expect((await retryProcessing(baseUrl, "req-parts-recovery")).status).toBe(200);
      expect([...storedVersions.keys()].filter(name => name.includes("/walkthrough.mov@"))).toHaveLength(1);
      expect([...storedVersions.keys()].filter(name => name.includes("/capture_upload_complete.json@"))).toHaveLength(1);
    });
  });

  it("keeps a failed processing signal read-only on status and respects revoked consent on explicit retry", async () => {
    seedRequest("req-revoked-retry", { disposition: "qualified" });
    writeFault.markerOnce = true;
    screenCaptureForPrivacy.mockResolvedValue({ proceed: true, eligibility: "unscreened",
      outcome: "not_reviewed", detail: null, evidence: null });
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-revoked-retry", "original")).body).toMatchObject({
        state: "processing_pending", captureReceived: true, processingRetryAvailable: true });
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-revoked-retry") as Record<string, any>;
      request.request.consent_revoked = true;
      const before = [...storedVersions.keys()];
      expect((await uploadStatus(baseUrl, "req-revoked-retry")).body).toMatchObject({ captureReceived: true,
        state: "held", holdReason: "capture_processing_not_authorized",
        uploadState: "processing_pending", processingRetryAvailable: false });
      expect(await retryProcessing(baseUrl, "req-revoked-retry")).toMatchObject({ status: 409,
        body: { state: "held", code: "capture_processing_not_authorized", processingRetryAvailable: false } });
      expect([...storedVersions.keys()]).toEqual(before);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("does not upgrade a retained draft missing original consent even if current consent exists", async () => {
    seedRequest("req-no-original-consent", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-no-original-consent", "original")).status).toBe(502);
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-no-original-consent") as Record<string, any>;
      const originalManifest = JSON.parse(session.browser_stored_upload.manifest_json);
      originalManifest.capture_rights.derived_scene_generation_allowed = false;
      originalManifest.capture_rights.consent_status = "missing";
      session.browser_stored_upload.manifest_json = JSON.stringify(originalManifest, null, 2);
      session.browser_stored_upload.manifest_sha256 = `sha256:${createHash("sha256")
        .update(session.browser_stored_upload.manifest_json).digest("hex")}`;
      const before = [...storedVersions.keys()];
      expect((await uploadStatus(baseUrl, "req-no-original-consent")).body).toMatchObject({
        state: "held", holdReason: "capture_processing_not_authorized", captureReceived: true,
        processingRetryAvailable: false });
      expect((await retryProcessing(baseUrl, "req-no-original-consent")).status).toBe(409);
      expect([...storedVersions.keys()]).toEqual(before);
      expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
    });
  });

  it("keeps the retained original when recording consent is withdrawn after retry admission", async () => {
    seedRequest("req-retry-withdrawal", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-retry-withdrawal", "original")).status).toBe(502);
      const before = [...storedVersions.keys()];
      const transaction = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
      const withdrawal = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementation(async callback => {
        const result = await transaction(callback);
        // The original handler may still be releasing its reservation after
        // sending the response; withdraw only once this retry owns a new lease.
        if (result && typeof result === "object" && "schema_version" in result
            && result.schema_version === "website_browser_write_reservation.v1") {
          sharedFakeFirestoreState.docs.get("inboundRequests/req-retry-withdrawal")!.request.consent_attestation.granted = false;
        }
        return result;
      });
      try {
        expect(await retryProcessing(baseUrl, "req-retry-withdrawal")).toMatchObject({ status: 409,
          body: { state: "held", code: "recording_consent_required", captureReceived: true,
            processingRetryAvailable: false } });
        expect([...storedVersions.keys()]).toEqual(before);
        expect((await uploadStatus(baseUrl, "req-retry-withdrawal")).body).toMatchObject({
          state: "held", captureReceived: true, processingRetryAvailable: false });
        expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
      } finally { withdrawal.mockRestore(); }
    });
  });

  it.each(["consent", "region"])("reports the real %s hold after admission but before processing publication", async kind => {
    const requestId = `req-late-${kind}`;
    const expectedCode = kind === "consent" ? "capture_processing_not_authorized" : "capture_region_unapproved";
    seedRequest(requestId, { disposition: "qualified" });
    screenCaptureForPrivacy.mockImplementationOnce(async () => {
      const request = sharedFakeFirestoreState.docs.get(`inboundRequests/${requestId}`) as Record<string, any>;
      if (kind === "consent") request.request.consent_revoked = true;
      else request.request.capture_region = "non_us";
      return { proceed: true, eligibility: "unscreened", outcome: "not_reviewed", detail: null, evidence: null };
    });
    await withRoutes(async baseUrl => {
      expect(await uploadFor(baseUrl, requestId, "original")).toMatchObject({ status: 409,
        body: { state: "held", captureReceived: true, code: expectedCode,
          processingRetryAvailable: false } });
      expect([...storedVersions.keys()].filter(name => name.includes("/capture_upload_complete.json@"))).toHaveLength(0);
      expect((await uploadStatus(baseUrl, requestId)).body).toMatchObject({ state: "held",
        captureReceived: true, holdReason: expectedCode, processingRetryAvailable: false });
    });
  });

  it("does not retry when current upload authority is withdrawn or the stored source changes", async () => {
    seedRequest("req-source-retry", { disposition: "qualified" });
    writeFault.manifestOnce = true;
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-source-retry", "original")).status).toBe(502);
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-source-retry") as Record<string, any>;
      request.request.capture_region = "non_us";
      expect((await uploadStatus(baseUrl, "req-source-retry")).body).toMatchObject({ state: "held",
        captureReceived: true, processingRetryAvailable: false });
      expect((await retryProcessing(baseUrl, "req-source-retry")).status).toBe(409);
      request.request.capture_region = "us";
      const receipt = (sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-source-retry") as Record<string, any>).browser_stored_upload;
      const changed = Buffer.from("changed");
      storedVersions.set(`${receipt.video.object_name}@999`, { body: changed,
        metadata: { name: receipt.video.object_name, generation: "999", size: String(changed.length), crc32c: "AAAAAA==" } });
      expect((await uploadStatus(baseUrl, "req-source-retry")).body).toMatchObject({ captureReceived: false,
        uploadState: "status_unavailable", processingRetryAvailable: false });
      expect(await retryProcessing(baseUrl, "req-source-retry")).toMatchObject({ status: 409,
        body: { code: "capture_source_unverified", processingRetryAvailable: false } });
      expect([...storedVersions.keys()].filter(name => name.includes("/capture_upload_complete.json@"))).toHaveLength(0);
    });
  });

  it("reports unavailable storage as unknown retention rather than claiming nothing was saved", async () => {
    seedRequest("req-read-failure", { disposition: "qualified" });
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-read-failure", "original")).status).toBe(201);
      writeFault.readUnavailable = true;
      expect((await uploadStatus(baseUrl, "req-read-failure")).body).toMatchObject({ captureReceived: false,
        uploadState: "status_unavailable", processingRetryAvailable: false });
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("does not trust a published row when its exact processing signal changed or republish it as another attempt", async () => {
    seedRequest("req-published-proof", { disposition: "qualified" });
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-published-proof", "original")).status).toBe(201);
      const name = "scenes/site-req-published-proof/captures/walkthrough-req-published-proof/raw/capture_upload_complete.json";
      const changed = Buffer.from('{"different":"processing signal"}');
      storedVersions.set(`${name}@999`, { body: changed, metadata: { name, generation: "999",
        size: String(changed.length), crc32c: "AAAAAA==" } });
      const before = [...storedVersions.keys()];
      expect((await uploadStatus(baseUrl, "req-published-proof")).body).toMatchObject({ state: "held",
        holdReason: "capture_handoff_unverified", captureReceived: true, uploadState: "retained",
        processingRetryAvailable: false });
      expect(await retryProcessing(baseUrl, "req-published-proof")).toMatchObject({ status: 409,
        body: { code: "capture_handoff_unverified", processingRetryAvailable: false } });
      expect([...storedVersions.keys()]).toEqual(before);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("provides a read-only legacy status route without screening or publishing its retained capture", async () => {
    seedRequest("req-readonly-legacy", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Held", evidence: null });
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-readonly-legacy", "original")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-readonly-legacy") as Record<string, any>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      const before = structuredClone([...sharedFakeFirestoreState.docs]);
      const versionsBefore = [...storedVersions.keys()];
      const token = tokenFrom(captureUploadUrlFor("req-readonly-legacy"));
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
        outcome: "not_reviewed", detail: null, evidence: null });
      for (let i = 0; i < 2; i++) {
        const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/status`);
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ captureReceived: true, uploadState: "retained",
          processingRetryAvailable: false });
      }
      expect([...sharedFakeFirestoreState.docs]).toEqual(before);
      expect([...storedVersions.keys()]).toEqual(versionsBefore);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
      // Existing clients retain their authorized recovery contract.
      await uploadStatus(baseUrl, "req-readonly-legacy");
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(2);
      expect([...storedVersions.keys()].filter(name => name.includes("/capture_upload_complete.json@"))).toHaveLength(1);
    });
  });
});

/* -------------------------------------------- looking before we copy */

describe("the privacy question is asked before anything is derived", () => {
  it("reclaims a stale write token without allowing it to finish or release the new claim", async () => {
    const identity = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1" };
    const stale = await reserveBrowserUpload(identity, 1_000_000);
    const current = await reserveBrowserUpload(identity, stale.expires_at_ms + 1);
    const pending = { schema_version: "website_browser_pending.v1" as const, ...identity,
      state: "held" as const, completed_at_iso: "2026-09-29T00:00:00.000Z",
      video: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mov",
        generation: "100", size_bytes: 2, crc32c: "AAAAAA==" },
      manifest: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/manifest.json",
        generation: "101", size_bytes: 2, crc32c: "AAAAAA==",
        sha256: `sha256:${"a".repeat(64)}` } };
    await expect(recordBrowserPending(pending, stale)).rejects.toThrow("browser_pending_changed");
    await releaseBrowserUpload(stale);
    await expect(reserveBrowserUpload(identity, stale.expires_at_ms + 2)).rejects.toThrow("browser_pending_conflict");
    await recordBrowserPending(pending, current);
    await expect(reserveBrowserUpload(identity, current.expires_at_ms + 1)).rejects.toThrow("browser_pending_conflict");
  });
  it("does not overwrite a held V1 video or manifest when V2 is offered", async () => {
    seedRequest("req-held-v1", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-held-v1", "V1")).body.state).toBe("held");
      const prefix = "scenes/site-req-held-v1/captures/walkthrough-req-held-v1/raw";
      const videoName = `${prefix}/walkthrough.mov`;
      const manifestName = `${prefix}/manifest.json`;
      const before = [...storedVersions].filter(([key]) => key.startsWith(`${videoName}@`) || key.startsWith(`${manifestName}@`));
      const next = await uploadFor(baseUrl, "req-held-v1", "V2");
      expect(next.status).toBe(409);
      expect([...storedVersions].filter(([key]) => key.startsWith(`${videoName}@`)
        || key.startsWith(`${manifestName}@`))).toEqual(before);
    });
  });

  it("excludes V2 while V1 is between reservation and its video write", async () => {
    seedRequest("req-writing-v1", { disposition: "qualified" });
    let entered!: () => void;
    let resume!: () => void;
    const firstWriting = new Promise<void>((resolve) => { entered = resolve; });
    const continueWrite = new Promise<void>((resolve) => { resume = resolve; });
    writeGate.current = { entered, wait: continueWrite };
    await withRoutes(async (baseUrl) => {
      const first = uploadFor(baseUrl, "req-writing-v1", "V1");
      await firstWriting;
      const second = await uploadFor(baseUrl, "req-writing-v1", "V2");
      expect(second.status).toBe(409);
      expect(second.body.code).toBe("capture_delivery_held");
      resume();
      expect((await first).status).toBe(201);
    });
  });

  it("an expired writer cannot overwrite a newer completed write or marker", async () => {
    seedRequest("req-expired-write", { disposition: "qualified" });
    let entered!: () => void;
    let resume!: () => void;
    const firstWriting = new Promise<void>((resolve) => { entered = resolve; });
    const continueWrite = new Promise<void>((resolve) => { resume = resolve; });
    writeGate.current = { entered, wait: continueWrite };
    await withRoutes(async (baseUrl) => {
      const stale = uploadFor(baseUrl, "req-expired-write", "V1");
      await firstWriting;
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-expired-write") as
        Record<string, any>;
      session.browser_upload_reservation.expires_at_ms = Date.now() - 1;
      const newer = await uploadFor(baseUrl, "req-expired-write", "V2");
      expect(newer.status).toBe(201);
      const prefix = "scenes/site-req-expired-write/captures/walkthrough-req-expired-write/raw";
      const markerName = `${prefix}/capture_upload_complete.json`;
      const markerBefore = written.get(markerName);
      resume();
      expect((await stale).status).toBe(502);
      expect(written.get(markerName)).toBe(markerBefore);
      const latestVideo = [...storedVersions].reverse().find(([key]) => key.startsWith(`${prefix}/walkthrough.mov@`));
      expect(latestVideo?.[1].body.toString()).toBe("V2");
      expect(JSON.parse(markerBefore ?? "null").producer_delivery.raw_video_generation)
        .toBe(latestVideo?.[1].metadata.generation);
    });
  });

  it("a parts completion cannot cross an in-flight stream writer", async () => {
    seedRequest("req-cross-write", { disposition: "qualified" });
    let entered!: () => void;
    let resume!: () => void;
    const firstWriting = new Promise<void>((resolve) => { entered = resolve; });
    const continueWrite = new Promise<void>((resolve) => { resume = resolve; });
    writeGate.current = { entered, wait: continueWrite };
    await withRoutes(async (baseUrl) => {
      const streaming = uploadFor(baseUrl, "req-cross-write", "V1");
      await firstWriting;
      const token = tokenFrom(captureUploadUrlFor("req-cross-write"));
      const result = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/parts/complete`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parts: 1, extension: "mov", sizeBytes: 2,
          metadata: { widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
            recordedAtEpochMs: 1_758_000_000_000 } }),
      });
      expect(result.status).toBe(409);
      expect((await result.json()).code).toBe("capture_delivery_held");
      resume();
      expect((await streaming).status).toBe(201);
    });
  });

  it("refuses a parts completion before compose when a V1 delivery is held", async () => {
    seedRequest("req-parts-held", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-parts-held", "V1")).body.state).toBe("held");
      const token = tokenFrom(captureUploadUrlFor("req-parts-held"));
      const body = { parts: 1, extension: "mov", sizeBytes: 2,
        metadata: { widthPx: 1920, heightPx: 1080, durationSeconds: 61, fps: 30,
          recordedAtEpochMs: 1_758_000_000_000 } };
      const result = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/parts/complete`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(result.status).toBe(409);
      expect((await result.json()).code).toBe("capture_delivery_held");
    });
  });

  it("finishes a legacy held browser video without qualifying it as an original owner", async () => {
    seedRequest("req-legacy-held", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-held", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-held") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
        outcome: "not_reviewed", detail: null, evidence: null });
      const token = tokenFrom(captureUploadUrlFor("req-legacy-held"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      const markerName = "scenes/site-req-legacy-held/captures/walkthrough-req-legacy-held/raw/capture_upload_complete.json";
      const marker = JSON.parse(written.get(markerName) ?? "null");
      expect(marker).toMatchObject({ scene_id: "site-req-legacy-held", capture_id: "walkthrough-req-legacy-held" });
      expect(marker).not.toHaveProperty("producer_delivery");
      // A pre-receipt capture remains a whole-scene KEEP. Its unversioned
      // marker cannot be replaced safely with a new typed delivery at this ID.
      const markerBefore = written.get(markerName);
      const videoName = "scenes/site-req-legacy-held/captures/walkthrough-req-legacy-held/raw/walkthrough.mov";
      const videoBefore = [...storedVersions].filter(([name]) => name.startsWith(`${videoName}@`));
      expect((await uploadFor(baseUrl, "req-legacy-held", "V2")).status).toBe(409);
      expect(written.get(markerName)).toBe(markerBefore);
      expect([...storedVersions].filter(([name]) => name.startsWith(`${videoName}@`))).toEqual(videoBefore);
    });
  });

  it.each(["root", "request", "capture_rights", "future_processing"])(
    "does not publish a legacy marker when %s authority is withdrawn during screening", async location => {
      const requestId = `req-legacy-withdrawn-${location}`;
      seedRequest(requestId, { disposition: "qualified" });
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
        outcome: "review_unavailable", detail: "Hold", evidence: null });
      await withRoutes(async baseUrl => {
        expect((await uploadFor(baseUrl, requestId, "original")).body.state).toBe("held");
        const session = sharedFakeFirestoreState.docs.get(`captureUploadSessions/walkthrough-${requestId}`) as Record<string, any>;
        delete session.browser_pending_delivery;
        delete session.browser_modern_attempt;
        const before = [...storedVersions.keys()];
        screenCaptureForPrivacy.mockImplementationOnce(async () => {
          const request = sharedFakeFirestoreState.docs.get(`inboundRequests/${requestId}`) as Record<string, any>;
          if (location === "root") request.consent_revoked = true;
          else if (location === "request") request.request.consent_revoked = true;
          else if (location === "capture_rights") request.capture_rights = { consent_revoked: true };
          else request.request.future_processing_allowed = false;
          return { proceed: true, eligibility: "unscreened", outcome: "not_reviewed", detail: null, evidence: null };
        });
        const token = tokenFrom(captureUploadUrlFor(requestId));
        await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
        expect([...storedVersions.keys()]).toEqual(before);
        expect([...written.keys()].some(name => name.endsWith("/capture_upload_complete.json"))).toBe(false);
        expect((await authorizeCaptureUpload(requestId)).allowed).toBe(true);
        const status = await fetch(`${baseUrl}/api/self-capture/uploads/${token}/status`);
        expect(await status.json()).toMatchObject({ state: "held", captureReceived: true,
          uploadState: "retained", holdReason: "capture_processing_not_authorized",
          processingRetryAvailable: false });
        // Current recording attestation still exists; the independent rights
        // withdrawal must stop replay of the now-saved privacy clearance too.
        await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
        expect([...storedVersions.keys()]).toEqual(before);
        expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(2);
      });
    },
  );

  it("rechecks legacy rights after the final asynchronous manifest-presence read", async () => {
    seedRequest("req-legacy-final-rights", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async baseUrl => {
      expect((await uploadFor(baseUrl, "req-legacy-final-rights", "original")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-final-rights") as Record<string, any>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      const before = [...storedVersions.keys()];
      writeFault.beforeManifestExists = () => {
        sharedFakeFirestoreState.docs.get("inboundRequests/req-legacy-final-rights")!.capture_rights = { consent_revoked: true };
      };
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
        outcome: "not_reviewed", detail: null, evidence: null });
      const token = tokenFrom(captureUploadUrlFor("req-legacy-final-rights"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      expect(writeFault.beforeManifestExists).toBeNull();
      expect([...storedVersions.keys()]).toEqual(before);
      expect([...written.keys()].some(name => name.endsWith("/capture_upload_complete.json"))).toBe(false);
      expect((await uploadStatus(baseUrl, "req-legacy-final-rights")).body).toMatchObject({ state: "held",
        captureReceived: true, holdReason: "capture_processing_not_authorized", processingRetryAvailable: false });
    });
  });

  it("does not clear a legacy hold while a modern writer has reserved its canonical source", async () => {
    seedRequest("req-legacy-writing", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-writing", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-writing") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      const reservation = await reserveBrowserUpload({ request_id: "req-legacy-writing",
        scene_id: "site-req-legacy-writing", capture_id: "walkthrough-req-legacy-writing" });
      const token = tokenFrom(captureUploadUrlFor("req-legacy-writing"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      const markerName = "scenes/site-req-legacy-writing/captures/walkthrough-req-legacy-writing/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
      expect((sharedFakeFirestoreState.docs.get("inboundRequests/req-legacy-writing") as Record<string, any>)
        .capture_privacy_screen.eligibility).toBe("pending");
      await releaseBrowserUpload(reservation);
    });
  });

  it("does not publish a legacy marker after a failed modern write replaced the old video", async () => {
    seedRequest("req-legacy-failed", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-failed", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-failed") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      writeFault.manifestOnce = true;
      expect((await uploadFor(baseUrl, "req-legacy-failed", "V2")).status).toBe(502);
      expect(session.browser_upload_reservation).toBeNull();
      const token = tokenFrom(captureUploadUrlFor("req-legacy-failed"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      const markerName = "scenes/site-req-legacy-failed/captures/walkthrough-req-legacy-failed/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
      expect((sharedFakeFirestoreState.docs.get("inboundRequests/req-legacy-failed") as Record<string, any>)
        .capture_privacy_screen.eligibility).toBe("pending");
    });
  });

  it("replays the exact pending browser delivery after privacy was stored but marker creation failed", async () => {
    seedRequest("req-marker-retry", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
      outcome: "not_reviewed", detail: null, evidence: null });
    writeFault.markerOnce = true;
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-marker-retry", "V1")).status).toBe(502);
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-marker-retry") as Record<string, any>;
      expect(request.capture_privacy_screen).toMatchObject({ capture_id: "walkthrough-req-marker-retry",
        eligibility: "unscreened", proceeded: true });
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-marker-retry") as Record<string, any>;
      expect(session.browser_pending_delivery.state).toBe("held");
      const pendingVideoGeneration = session.browser_pending_delivery.video.generation;
      const markerName = "scenes/site-req-marker-retry/captures/walkthrough-req-marker-retry/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
      const token = tokenFrom(captureUploadUrlFor("req-marker-retry"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect((sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-marker-retry") as
        Record<string, any>).browser_pending_delivery.state).toBe("published");
      const marker = JSON.parse(written.get(markerName) ?? "null");
      expect(marker.producer_delivery.raw_video_generation).toBe(pendingVideoGeneration);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("never treats a changed pending identity or incomplete stored privacy as clearance", async () => {
    seedRequest("req-marker-guard", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
      outcome: "not_reviewed", detail: null, evidence: null });
    writeFault.markerOnce = true;
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-marker-guard", "V1")).status).toBe(502);
      const token = tokenFrom(captureUploadUrlFor("req-marker-guard"));
      const markerName = "scenes/site-req-marker-guard/captures/walkthrough-req-marker-guard/raw/capture_upload_complete.json";
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-marker-guard") as Record<string, any>;
      const bound = request.capture_privacy_source_bound_decision;
      const originalKey = bound.producer_source.key;
      expect(originalKey).toMatch(/^sha256:[a-f0-9]{64}$/);
      bound.producer_source.key = `sha256:${"0".repeat(64)}`;
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(written.has(markerName)).toBe(false);
      bound.producer_source.key = originalKey;
      bound.proceeded = false;
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(written.has(markerName)).toBe(false);
      bound.proceeded = true;
      bound.capture_id = "walkthrough-other";
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(written.has(markerName)).toBe(false);
      bound.capture_id = "walkthrough-req-marker-guard";
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-marker-guard") as Record<string, any>;
      session.browser_pending_delivery.scene_id = "site-other";
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(written.has(markerName)).toBe(false);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("replays an already-created exact marker when pending publication was interrupted", async () => {
    seedRequest("req-pending-retry", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
      outcome: "not_reviewed", detail: null, evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-pending-retry", "V1")).status).toBe(201);
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-pending-retry") as Record<string, any>;
      expect(session.browser_pending_delivery.state).toBe("published");
      session.browser_pending_delivery.state = "held";
      const markerName = "scenes/site-req-pending-retry/captures/walkthrough-req-pending-retry/raw/capture_upload_complete.json";
      const markerBefore = written.get(markerName);
      const markerVersionsBefore = [...storedVersions.keys()].filter((name) => name.startsWith(`${markerName}@`));
      const token = tokenFrom(captureUploadUrlFor("req-pending-retry"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect((sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-pending-retry") as
        Record<string, any>).browser_pending_delivery.state).toBe("published");
      expect(written.get(markerName)).toBe(markerBefore);
      expect([...storedVersions.keys()].filter((name) => name.startsWith(`${markerName}@`))).toEqual(markerVersionsBefore);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("never reuses V1's recorded privacy clearance for a newer V2 pending delivery", async () => {
    seedRequest("req-privacy-generation", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
      outcome: "not_reviewed", detail: null, evidence: null });
    let entered!: () => void;
    let resume!: () => void;
    const screening = new Promise<void>((resolve) => { entered = resolve; });
    const continueScreen = new Promise<void>((resolve) => { resume = resolve; });
    screenCaptureForPrivacy.mockImplementationOnce(async () => {
      entered();
      await continueScreen;
      return { proceed: false, eligibility: "pending", outcome: "review_unavailable",
        detail: "Hold", evidence: null };
    });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-privacy-generation", "V1")).status).toBe(201);
      const markerName = "scenes/site-req-privacy-generation/captures/walkthrough-req-privacy-generation/raw/capture_upload_complete.json";
      const firstMarker = written.get(markerName);
      const firstVersions = [...storedVersions.keys()].filter((name) => name.startsWith(`${markerName}@`));
      const second = uploadFor(baseUrl, "req-privacy-generation", "V2");
      await screening;
      try {
        const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-privacy-generation") as Record<string, any>;
        const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-privacy-generation") as
          Record<string, any>;
        expect(stored.capture_privacy_screen.producer_source.key).not.toBe(
          browserPendingDecisionKey(session.browser_pending_delivery));
        const token = tokenFrom(captureUploadUrlFor("req-privacy-generation"));
        await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
        expect(written.get(markerName)).toBe(firstMarker);
        expect([...storedVersions.keys()].filter((name) => name.startsWith(`${markerName}@`))).toEqual(firstVersions);
      } finally {
        resume();
      }
      expect((await second).body.state).toBe("held");
    });
  });

  it("holds browser completion when its privacy record loses the claim and retries the pinned write", async () => {
    seedRequest("req-privacy-record-fault", { disposition: "qualified" });
    let entered!: () => void;
    let resume!: () => void;
    const screening = new Promise<void>((resolve) => { entered = resolve; });
    const continueScreen = new Promise<void>((resolve) => { resume = resolve; });
    screenCaptureForPrivacy.mockImplementationOnce(async () => {
      entered();
      await continueScreen;
      return { proceed: true, eligibility: "approved", outcome: "cleared", detail: null, evidence: null };
    });
    await withRoutes(async (baseUrl) => {
      const first = uploadFor(baseUrl, "req-privacy-record-fault", "V1");
      await screening;
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-privacy-record-fault") as Record<string, any>;
      request.capture_privacy_screening_claim.id = "other-claim";
      resume();
      expect((await first).status).toBe(502);
      const markerName = "scenes/site-req-privacy-record-fault/captures/walkthrough-req-privacy-record-fault/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
      expect(request.capture_privacy_screen).toBeUndefined();
      request.capture_privacy_screening_claim.expires_at_ms = Date.now() - 1;
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "approved",
        outcome: "cleared", detail: null, evidence: null });
      const token = tokenFrom(captureUploadUrlFor("req-privacy-record-fault"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      expect(JSON.parse(written.get(markerName) ?? "null").producer_delivery.raw_video_generation).toMatch(/^\d+$/);
      expect((sharedFakeFirestoreState.docs.get("inboundRequests/req-privacy-record-fault") as Record<string, any>)
        .capture_privacy_screen.producer_source.kind).toBe("browser_pending");
    });
  });

  it("does not use old-worker merged privacy leaves to clear a modern pending write", async () => {
    seedRequest("req-old-worker-merge", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-old-worker-merge", "V1")).body.state).toBe("held");
      // The deployed old writer uses a nested merge into this same map and
      // does not know about the new producer_source key.
      await sharedFakeFirestore.collection("inboundRequests").doc("req-old-worker-merge").set({
        capture_privacy_screen: { proceeded: true, eligibility: "unscreened",
          screened_at_iso: new Date().toISOString() },
      }, { merge: true });
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
        outcome: "review_unavailable", detail: "Hold", evidence: null });
      const token = tokenFrom(captureUploadUrlFor("req-old-worker-merge"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      const markerName = "scenes/site-req-old-worker-merge/captures/walkthrough-req-old-worker-merge/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
    });
  });

  it("serializes concurrent legacy status screens before a plain marker can publish", async () => {
    seedRequest("req-legacy-concurrent", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-concurrent", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-concurrent") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      let entered!: () => void;
      let resume!: () => void;
      const screening = new Promise<void>((resolve) => { entered = resolve; });
      const continueScreen = new Promise<void>((resolve) => { resume = resolve; });
      screenCaptureForPrivacy.mockImplementationOnce(async () => {
        entered();
        await continueScreen;
        return { proceed: true, eligibility: "unscreened", outcome: "not_reviewed", detail: null, evidence: null };
      });
      const token = tokenFrom(captureUploadUrlFor("req-legacy-concurrent"));
      const first = fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      await screening;
      const markerName = "scenes/site-req-legacy-concurrent/captures/walkthrough-req-legacy-concurrent/raw/capture_upload_complete.json";
      try {
        const second = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
        expect(second.status).toBe(200);
        expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(2);
        expect(written.has(markerName)).toBe(false);
      } finally { resume(); }
      await first;
      expect(written.has(markerName)).toBe(true);
    });
  });

  it("does not use an app-kind decision even when its digest equals a held browser write", async () => {
    seedRequest("req-app-to-browser", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-app-to-browser", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-app-to-browser") as Record<string, any>;
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-app-to-browser") as Record<string, any>;
      request.capture_privacy_source_bound_decision = { capture_id: "walkthrough-req-app-to-browser", proceeded: true,
        eligibility: "approved", producer_source: { kind: "app_bundle_completion",
          key: browserPendingDecisionKey(session.browser_pending_delivery) },
        screened_at_iso: new Date().toISOString() };
      const token = tokenFrom(captureUploadUrlFor("req-app-to-browser"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}/processing-retry`, { method: "POST" });
      const markerName = "scenes/site-req-app-to-browser/captures/walkthrough-req-app-to-browser/raw/capture_upload_complete.json";
      expect(written.has(markerName)).toBe(false);
      expect(screenCaptureForPrivacy).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps a legacy claim across a cleared-screen crash and excludes a newer browser write", async () => {
    seedRequest("req-legacy-retry", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-retry", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-retry") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      const identity = { request_id: "req-legacy-retry", scene_id: "site-req-legacy-retry",
        capture_id: "walkthrough-req-legacy-retry" };
      expect(await prepareLegacyBrowserFinish(identity)).toBe("legacy");
      expect((await uploadFor(baseUrl, "req-legacy-retry", "V2")).status).toBe(409);
      // Model a process dying after the privacy result was durable but before
      // it could create the marker. The next poll must finish the old claim.
      const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-legacy-retry") as Record<string, any>;
      request.capture_privacy_screen = { capture_id: identity.capture_id, proceeded: true,
        eligibility: "unscreened" };
      const token = tokenFrom(captureUploadUrlFor("req-legacy-retry"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      const markerName = "scenes/site-req-legacy-retry/captures/walkthrough-req-legacy-retry/raw/capture_upload_complete.json";
      const marker = JSON.parse(written.get(markerName) ?? "null");
      expect(marker).toMatchObject({ scene_id: identity.scene_id, capture_id: identity.capture_id });
      expect(marker).not.toHaveProperty("producer_delivery");
    });
  });

  it("never overwrites a newer typed marker during a legacy held browser resume", async () => {
    seedRequest("req-legacy-race", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: false, eligibility: "pending",
      outcome: "review_unavailable", detail: "Hold", evidence: null });
    await withRoutes(async (baseUrl) => {
      expect((await uploadFor(baseUrl, "req-legacy-race", "V1")).body.state).toBe("held");
      const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-legacy-race") as Record<string, unknown>;
      delete session.browser_pending_delivery;
      delete session.browser_modern_attempt;
      const markerName = "scenes/site-req-legacy-race/captures/walkthrough-req-legacy-race/raw/capture_upload_complete.json";
      const newer = Buffer.from('{"producer_delivery":{"kind":"website_browser_capture_delivery"}}');
      storedVersions.set(`${markerName}@999`, { body: newer, metadata: { name: markerName,
        generation: "999", size: String(newer.length), crc32c: "AAAAAA==" } });
      screenCaptureForPrivacy.mockResolvedValueOnce({ proceed: true, eligibility: "unscreened",
        outcome: "not_reviewed", detail: null, evidence: null });
      const token = tokenFrom(captureUploadUrlFor("req-legacy-race"));
      await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      expect(storedVersions.get(`${markerName}@999`)?.body).toEqual(newer);
      expect([...storedVersions.keys()].filter((key) => key.startsWith(`${markerName}@`))).toEqual([`${markerName}@999`]);
    });
  });
  it("writes no completion marker when the footage is held", async () => {
    // The marker is what starts extraction. Holding it is what keeps frames of
    // identifiable people from being written into our bucket at all -- which
    // the reconstruction-time gate, standing in front of the spending, could
    // not do because the copying had already happened.
    seedRequest("req-privacy", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValue({
      proceed: false,
      outcome: "privacy_hold",
      detail: "The footage appears to centre identifiable people.",
      evidence: null,
    });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-privacy"));

    const paths = [...written.keys()];
    expect(paths.some((path) => path.endsWith("manifest.json"))).toBe(true);
    expect(paths.some((path) => path.endsWith("capture_upload_complete.json"))).toBe(false);

    // And the site is not told its upload failed, because it did not.
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.state).toBe("held");
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-privacy:video_received"))
      .toMatchObject({ kind: "video_received", to: "owner@example.com" });
  });

  it("keeps an uncertain static privacy reading separate and writes no completion marker", async () => {
    seedRequest("req-uncertain", { disposition: "qualified" });
    screenCaptureForPrivacy.mockResolvedValue({
      proceed: false,
      eligibility: "rejected",
      outcome: "privacy_hold",
      retryable: false,
      detail: "The privacy review could not settle the question.",
      evidence: { decision: "uncertain", evidence_seconds: [] },
    });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-uncertain"));

    expect(result.body).toMatchObject({ state: "held", eligibility: "rejected" });
    expect([...written.keys()].some((path) => path.endsWith("capture_upload_complete.json"))).toBe(false);
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-uncertain") as Record<string, unknown>;
    expect(stored.capture_privacy_evidence).toMatchObject({ decision: "uncertain" });
    expect(stored.site_video_evidence).toBeUndefined();
  });

  it("a retried upload repairs the same durable notice without duplicating it", async () => {
    seedRequest("req-retry", { disposition: "qualified" });
    await withRoutes(async (baseUrl) => {
      await uploadFor(baseUrl, "req-retry");
      await uploadFor(baseUrl, "req-retry");
    });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key === "captureOutbox/req-retry:video_received"))
      .toHaveLength(1);
  });

  it("writes the marker once the footage clears", async () => {
    seedRequest("req-clear", { disposition: "qualified" });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-clear"));

    expect([...written.keys()].some((p) => p.endsWith("capture_upload_complete.json"))).toBe(true);
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ state: "processing_ready", uploadState: "processing_ready",
      captureReceived: true, processingRetryAvailable: false });
  });

  it("writes the manifest before the marker, because extraction reads it", async () => {
    seedRequest("req-order", { disposition: "qualified" });

    await withRoutes((baseUrl) => uploadFor(baseUrl, "req-order"));

    const paths = [...written.keys()];
    expect(paths.findIndex((p) => p.endsWith("manifest.json"))).toBeLessThan(
      paths.findIndex((p) => p.endsWith("capture_upload_complete.json")),
    );
  });

  it("never reaches the privacy screen for a site that is not allowed to upload", async () => {
    // Authorization first: a held submission should not cost a model call. A
    // failed screen no longer holds a self-capture, so this uses the hold that
    // still exists -- a site set up for a capturer visit.
    seedRequest("req-unauthorized", { disposition: "not_now" }, "site_visit");

    await withRoutes((baseUrl) => uploadFor(baseUrl, "req-unauthorized"));

    expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
  });
});

/* --------------------------------------------------- the security boundary */

describe("a link is a destination, not a permission", () => {
  it("lets a site that did not clear the screen record anyway", async () => {
    // Reversed deliberately. This asserted a 409, which was right while the
    // screen stood in front of the video -- and wrong once we noticed the
    // screen was asking a site to describe a room before we would accept a
    // film of the same room. Receiving a video costs us nothing; the money is
    // guarded after this, at reconstruction.
    seedRequest("req-blocked", {
      disposition: "not_now",
      blocking_field_ids: ["sceneStability"],
      blockers: ["You told us the layout changes daily. A scene that moves cannot be reused."],
    });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-blocked"));

    expect(result.status).not.toBe(409);
    expect([...written.keys()].some((p) => p.endsWith("capture_upload_complete.json"))).toBe(true);
  });

  it("lets a site with an unsettled answer record anyway", async () => {
    seedRequest("req-marginal", {
      disposition: "needs_conversation",
      open_questions: ["How often does the pallet position move?"],
    });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-marginal"));

    expect(result.status).not.toBe(409);
  });

  it("still refuses an upload on gates nobody stated", async () => {
    // The guard that is not about cost, and so survives the change: inferred
    // gates mean the operator never contacted us.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-inferred", {
      requestId: "req-inferred",
      request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z" }, capture_mode: "self_capture", capture_region: "us" },
      site_task_gate_sources: { sceneStability: "inferred", taskShape: "inferred" },
      site_task_triage: {
        disposition: "qualified",
        blocking_field_ids: [],
        blockers: [],
        open_questions: [],
        unanswered_field_ids: [],
        incomplete: false,
        evaluated_at: "2026-09-17T00:00:00.000Z",
      },
    });

    const result = await withRoutes((baseUrl) => uploadFor(baseUrl, "req-inferred"));

    expect(result.status).toBe(409);
    expect(result.body.code).toBe("gates_inferred");
  });

  it("refuses an upload when the site was set up for a capturer visit", async () => {
    // Two channels produce different manifests and different costs. The channel
    // was decided once; the link must not be a way around it.
    seedRequest("req-visit", { disposition: "qualified" }, "site_visit");

    const body = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-visit"));
      const form = new FormData();
      form.append("video", new Blob(["x"], { type: "video/quicktime" }), "walk.mov");
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`, {
        method: "POST",
        body: form,
      });
      return (await response.json()) as Record<string, unknown>;
    });

    expect(body.code).toBe("capturer_visit_scheduled");
  });

  it("refuses an upload from a region the beta is not cleared to collect from", async () => {
    // The strongest of the three enforcement points. `siteCaptureUrl` withholds
    // the link and `decideCaptureDispatch` refuses to dispatch, but a link that
    // was issued before the region was asked -- or forwarded by someone -- must
    // still not be able to hand us the footage. Collection is the act the basis
    // has to exist for.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-non-us", {
      requestId: "req-non-us",
      request: {
        buyerType: "site_operator",
        consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z" },
        capture_mode: "self_capture",
        capture_region: "non_us",
      },
      site_task_triage: {
        disposition: "qualified",
        blocking_field_ids: [],
        blockers: [],
        open_questions: [],
        unanswered_field_ids: [],
        incomplete: false,
      },
    });

    const body = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-non-us"));
      const form = new FormData();
      form.append("video", new Blob(["x"], { type: "video/quicktime" }), "walk.mov");
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`, {
        method: "POST",
        body: form,
      });
      return (await response.json()) as Record<string, unknown>;
    });

    expect(body.code).toBe("capture_region_unapproved");
  });

  it("refuses when the submission behind the link cannot be found", async () => {
    const body = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-nobody"));
      const form = new FormData();
      form.append("video", new Blob(["x"], { type: "video/quicktime" }), "walk.mov");
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`, {
        method: "POST",
        body: form,
      });
      return (await response.json()) as Record<string, unknown>;
    });

    expect(body.code).toBe("request_missing");
  });

  it("lets a cleared site through to the upload itself", async () => {
    seedRequest("req-green", { disposition: "qualified" });

    const result = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-green"));
      const form = new FormData();
      form.append("video", new Blob(["x"], { type: "video/quicktime" }), "walk.mov");
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`, {
        method: "POST",
        body: form,
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    });

    // Past authorization and past the file and extension checks, stopped by the
    // metadata this request deliberately omits. That is the next check and a
    // different one, so it proves the gate opened rather than that the upload
    // succeeded; only a 409 would mean it had not.
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("video_metadata_missing");
  });
});

/* ----------------------------------------------- what the page is told */

describe("one link, two pages", () => {
  it("reports held with the site's own words when something really is in the way", async () => {
    // A capturer visit is still gated, so the held page still has a job. The
    // screen verdict no longer produces it; the channel does.
    seedRequest(
      "req-held",
      {
        disposition: "not_now",
        blockers: ["You told us there is no access window. A capture needs 40 minutes in the space."],
      },
      "site_visit",
    );

    const body = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-held"));
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      expect(response.status).toBe(200);
      return (await response.json()) as Record<string, unknown>;
    });

    expect(body.state).toBe("held");
    expect(body.holdReason).toBe("not_qualified");
    expect(String(body.blockers)).toContain("no access window");
  });

  it("reports ready for a cleared site", async () => {
    seedRequest("req-ready", { disposition: "qualified" });

    const body = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-ready"));
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      return (await response.json()) as Record<string, unknown>;
    });

    expect(body.state).toBe("ready");
    expect(body.holdReason).toBeNull();
  });

  it("never names the site or the buyer, whatever the state", async () => {
    // A held link carries more text than a ready one, so it is the one worth
    // checking: a forwarded link must not tell its recipient who the customer
    // is.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-private", {
      requestId: "req-private",
      request: {
        buyerType: "site_operator",
        consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z" },
        capture_mode: "self_capture",
        capture_region: "us",
        siteName: "Acme Cold Storage, 40 Mill Road",
      },
      contact: { email: "ops@acme.example", firstName: "Dana" },
      site_task_triage: {
        disposition: "not_now",
        blocking_field_ids: ["accessWindow"],
        blockers: ["You told us there is no access window."],
        open_questions: [],
        unanswered_field_ids: [],
        incomplete: false,
        evaluated_at: "2026-09-17T00:00:00.000Z",
      },
    });

    const raw = await withRoutes(async (baseUrl) => {
      const token = tokenFrom(captureUploadUrlFor("req-private"));
      const response = await fetch(`${baseUrl}/api/self-capture/uploads/${token}`);
      return await response.text();
    });

    expect(raw).not.toContain("Acme");
    expect(raw).not.toContain("ops@acme.example");
    expect(raw).not.toContain("Dana");
  });

  it("turns the same link live when the thing in the way resolves", async () => {
    // The whole reason a held link is worth issuing: nobody sends a second one.
    // Shown on the visit path, which is where a hold still comes from.
    seedRequest("req-flip", { disposition: "needs_conversation" }, "site_visit");
    const url = captureUploadUrlFor("req-flip");

    await expect(authorizeCaptureUpload("req-flip")).resolves.toMatchObject({ allowed: false });

    seedRequest("req-flip", { disposition: "qualified" }, "self_capture");

    await expect(authorizeCaptureUpload("req-flip")).resolves.toMatchObject({ allowed: true });
    // Same URL throughout.
    expect(captureUploadUrlFor("req-flip")).toBe(url);
  });
});

describe("failing closed", () => {
  it("does not promise retention when the authority store cannot be read", async () => {
    const read = vi.spyOn(sharedFakeFirestore, "collection").mockImplementationOnce(() => {
      throw new Error("injected_authority_read_failure");
    });
    try {
      const result = await authorizeCaptureUpload("req-unreadable-authority");
      expect(result).toMatchObject({ allowed: false, holdReason: "store_unavailable" });
      expect(result.detail).toContain("Keep your original video");
      expect(result.detail).not.toMatch(/nothing.*lost|nothing.*saved/i);
    } finally { read.mockRestore(); }
  });

  it("holds rather than allows when the store cannot be read", async () => {
    const collection = sharedFakeFirestoreState.docs;
    seedRequest("req-throw", { disposition: "qualified" });
    // Simulate a read failure by removing the document mid-flight.
    collection.delete("inboundRequests/req-throw");

    await expect(authorizeCaptureUpload("req-throw")).resolves.toMatchObject({
      allowed: false,
      holdReason: "request_missing",
    });
  });
});

describe("a site that asked for a visit can film it itself instead", () => {
  const status = (baseUrl: string, url: string) =>
    fetch(`${baseUrl}/api/self-capture/uploads/${tokenFrom(url)}`).then(
      (response) => response.json() as Promise<Record<string, unknown>>,
    );
  const switchMode = (baseUrl: string, url: string) =>
    fetch(`${baseUrl}/api/self-capture/uploads/${tokenFrom(url)}/self-capture`, { method: "POST" });

  it("turns a link held for a visit into an upload page, with nobody booking anything", async () => {
    seedRequest("req-switch", { disposition: "qualified" }, "site_visit");
    const url = captureUploadUrlFor("req-switch");

    const result = await withRoutes(async (baseUrl) => {
      const before = await status(baseUrl, url);
      const response = await switchMode(baseUrl, url);
      return { before, after: (await response.json()) as Record<string, unknown>, code: response.status };
    });

    expect(result.before).toMatchObject({
      state: "held",
      holdReason: "capturer_visit_scheduled",
      selfCaptureSwitchAvailable: true,
    });
    expect(result.code).toBe(200);
    expect(result.after).toMatchObject({ switched: true, state: "ready", selfCaptureSwitchAvailable: false });
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-switch") as Record<string, any>;
    expect(stored.request.capture_mode).toBe("self_capture");
    expect(stored.capture_mode_switch).toMatchObject({ from: "site_visit", to: "self_capture", by: "site_owner_link" });
  });

  it("clears the visit-only service-area block, and keeps what a call already settled", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-far", {
      requestId: "req-far",
      request: {
        buyerType: "site_operator",
        consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z" },
        capture_mode: "site_visit",
        capture_region: "us",
        siteTaskGates: { serviceArea: "outside_texas" },
      },
      site_task_triage: {
        disposition: "not_now",
        blocking_field_ids: ["serviceArea"],
        blockers: ["Outside Texas — a visit cannot reach it"],
        open_questions: [],
        unanswered_field_ids: [],
        incomplete: false,
        evaluated_at: "2026-09-17T00:00:00.000Z",
        call_resolution: {
          cleared_field_ids: [], answered_field_ids: [], resolved_by: "ops",
          resolved_at: "2026-09-18T00:00:00.000Z", note: "called",
        },
      },
    });
    const url = captureUploadUrlFor("req-far");

    const after = await withRoutes(async (baseUrl) => {
      expect(await status(baseUrl, url)).toMatchObject({ holdReason: "not_qualified", selfCaptureSwitchAvailable: true });
      return (await (await switchMode(baseUrl, url)).json()) as Record<string, unknown>;
    });

    expect(after.state).toBe("ready");
    const triage = (sharedFakeFirestoreState.docs.get("inboundRequests/req-far") as Record<string, any>).site_task_triage;
    expect(triage.blocking_field_ids).not.toContain("serviceArea");
    expect(triage.call_resolution).toMatchObject({ note: "called" });
  });

  it("is the site owner's decision, and goes one way only", async () => {
    seedRequest("req-own", { disposition: "qualified" }, "site_visit");
    seedRequest("req-self", { disposition: "qualified" }, "self_capture");

    const codes = await withRoutes(async (baseUrl) => {
      const filmer = await switchMode(baseUrl, captureUploadUrlFor("req-own", "film"));
      const filmerStatus = await status(baseUrl, captureUploadUrlFor("req-own", "film"));
      const already = await switchMode(baseUrl, captureUploadUrlFor("req-self"));
      return {
        filmer: filmer.status,
        filmerOffer: filmerStatus.selfCaptureSwitchAvailable,
        already: (await already.json()) as Record<string, unknown>,
      };
    });

    expect(codes.filmer).toBe(403);
    expect(codes.filmerOffer).toBe(false);
    expect(codes.already).toMatchObject({ switched: false, state: "ready" });
    expect((sharedFakeFirestoreState.docs.get("inboundRequests/req-own") as Record<string, any>).request.capture_mode)
      .toBe("site_visit");
  });
});

it("refuses a missing recording grant before writing any uploaded bytes", async () => {
  seedRequest("req-no-consent", { disposition: "qualified" });
  delete sharedFakeFirestoreState.docs.get("inboundRequests/req-no-consent")!.request.consent_attestation;
  const result = await withRoutes(base => uploadFor(base, "req-no-consent"));
  expect(result.status).toBe(409);
  expect(result.body.code).toBe("recording_consent_required");
  expect(storedVersions.size).toBe(0);
  expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
});
it("removes the exact new video generation when consent is withdrawn during its write", async () => {
  seedRequest("req-withdraw-during-write", { disposition: "qualified" });
  let entered!: () => void, resume!: () => void;
  const writing = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { resume = resolve; });
  writeGate.current = { entered, wait };
  await withRoutes(async base => {
    const upload = uploadFor(base, "req-withdraw-during-write");
    await writing;
    sharedFakeFirestoreState.docs.get("inboundRequests/req-withdraw-during-write")!.request.consent_attestation.granted = false;
    resume();
    const result = await upload;
    expect(result.status).toBe(409);
    expect(storedVersions.size).toBe(0);
    expect(screenCaptureForPrivacy).not.toHaveBeenCalled();
    expect([...written.keys()].some(key => key.endsWith("capture_upload_complete.json"))).toBe(false);
  });
});
