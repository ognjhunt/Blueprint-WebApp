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
import type { Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

// The privacy screen is exercised in its own file; here it only has to be
// controllable, so the marker-writing path can be tested on both answers.
const screenCaptureForPrivacy = vi.hoisted(() =>
  vi.fn(async () => ({ proceed: true, outcome: "cleared", detail: null, evidence: null })),
);
vi.mock("../utils/capturePrivacyScreen", () => ({ screenCaptureForPrivacy }));

/** Every object written to the bucket, by path, so the marker can be asserted. */
const written = vi.hoisted(() => new Map<string, string>());
const storedVersions = vi.hoisted(() => new Map<string, { body: Buffer; metadata: Record<string, string> }>());
const generations = vi.hoisted(() => ({ next: 1 }));
const writeGate = vi.hoisted(() => ({ current: null as null | { entered(): void; wait: Promise<void> } }));
const writeFault = vi.hoisted(() => ({ manifestOnce: false }));

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
        combine: async () => { throw new Error("unexpected_compose"); },
        file: (path: string, options?: { generation?: string }) => {
          let responseMetadata: Record<string, string> | undefined;
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
          get metadata() { return responseMetadata; },
          save: async (body: unknown, config?: { preconditionOpts?: { ifGenerationMatch?: string | number } }) => {
            if (path.endsWith("/manifest.json") && writeFault.manifestOnce) {
              writeFault.manifestOnce = false;
              throw new Error("injected_manifest_write_failure");
            }
            const match = config?.preconditionOpts?.ifGenerationMatch;
            if (match !== undefined && String(match) !== String(current()?.metadata.generation ?? 0)) {
              throw Object.assign(new Error("precondition failed"), { code: 412 });
            }
            write(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
          },
          getMetadata: async () => {
            const value = current();
            if (!value) throw Object.assign(new Error("missing"), { code: 404 });
            return [value.metadata];
          },
          exists: async () => [Boolean(current())],
          download: async () => {
            const value = current();
            if (!value) throw Object.assign(new Error("missing"), { code: 404 });
            return [value.body];
          },
          // The route now streams uploads to disk-backed temp files and into
          // storage through a write stream, so the fake has to speak that
          // surface too. The bytes are recorded, not kept.
          createWriteStream: (config?: { preconditionOpts?: { ifGenerationMatch?: number | string } }) => {
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
const { reserveBrowserUpload, releaseBrowserUpload, recordBrowserPending,
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
    request: { buyerType: "site_operator", capture_mode: captureMode, capture_region: "us" },
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
  writeFault.manifestOnce = false;
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
    expect(result.body.state).toBeUndefined();
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
      request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
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
