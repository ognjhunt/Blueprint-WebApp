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
        file: (path: string) => ({
          save: async (body: unknown) => {
            written.set(path, typeof body === "string" ? body : "<binary>");
          },
          // The route now streams uploads to disk-backed temp files and into
          // storage through a write stream, so the fake has to speak that
          // surface too. The bytes are recorded, not kept.
          createWriteStream: () => {
            const chunks: Buffer[] = [];
            return new Writable({
              write(chunk, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                callback();
              },
              final(callback) {
                written.set(path, "<binary>");
                callback();
              },
            });
          },
        }),
      }),
    },
    authAdmin: { verifyIdToken: async () => ({ uid: "nobody" }) },
  };
});

const { captureUploadUrlFor } = await import("../utils/captureUploadToken");
const { authorizeCaptureUpload } = await import("../utils/captureUploadAuthorization");

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
  screenCaptureForPrivacy.mockClear();
  screenCaptureForPrivacy.mockResolvedValue({
    proceed: true,
    outcome: "cleared",
    detail: null,
    evidence: null,
  });
});

/** A well-formed upload for a site that cleared the screen. */
async function uploadFor(baseUrl: string, requestId: string) {
  const token = tokenFrom(captureUploadUrlFor(requestId));
  const form = new FormData();
  form.append("video", new Blob(["x"], { type: "video/quicktime" }), "walk.mov");
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
