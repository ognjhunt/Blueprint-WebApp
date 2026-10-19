// @vitest-environment node
/**
 * The measurements a site records through its private job link.
 *
 * Owner and film-only links can both record (founder decision, 2026-10-19):
 * measuring is capture, and the colleague holding the tape at the work area is
 * often the one with the film link. What this pins is the route's side of
 * that: either link saves, each reading says which link saved it, a stale page
 * cannot overwrite a newer save, and a withdrawn recording consent closes the
 * route like every other capture-derived operation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    contact: { email: "ops@acme.example" },
  });
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function tokenFor(scope: "owner" | "film") {
  return createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope });
}

const body = (revision: number, readings: Record<string, { value: number; unit: string }>) => ({
  revision,
  family: "rigid_pick_place",
  articulation: null,
  readings,
  referencePaper: "letter",
  referenceSheetLongEdge: null,
  measuredBy: "Dana",
  note: null,
});

function put(token: string, payload: unknown) {
  return fetch(`${baseUrl}/api/site-task-brief/${token}/measurements`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("GET /:token/measurements", () => {
  it("gives a job without measurements an empty form", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}/measurements`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, scope: "film", revision: 0, family: null, readings: {} });
  });

  it("refuses a link that is not ours", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/not-a-token/measurements`);
    expect(response.status).toBe(404);
  });
});

describe("PUT /:token/measurements", () => {
  it("saves from an owner link and returns what the page shows", async () => {
    const response = await put(tokenFor("owner"), body(0, { pick_surface_height: { value: 30, unit: "in" } }));
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved).toMatchObject({ ok: true, revision: 1, family: "rigid_pick_place", referencePaper: "letter",
      readings: { pick_surface_height: { value: 30, unit: "in", recordedByScope: "owner" } } });
    const stored = sharedFakeFirestoreState.docs.get("siteTaskMeasurements/req-1") as Record<string, any>;
    expect(stored.readings.pick_surface_height.si).toBe(0.762);
    expect(stored.readings.reference_sheet_long_edge).toMatchObject({ si: 0.2794, basis: "paper_standard" });
  });

  it("saves from a film-only link and records that it did", async () => {
    await put(tokenFor("owner"), body(0, { pick_surface_height: { value: 30, unit: "in" } }));
    const response = await put(tokenFor("film"), body(1, {
      pick_surface_height: { value: 30, unit: "in" },
      object_mass: { value: 2, unit: "kg" },
    }));
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.readings.pick_surface_height.recordedByScope).toBe("owner");
    expect(saved.readings.object_mass.recordedByScope).toBe("film");
  });

  it("refuses a page that did not see the latest save, and returns that save", async () => {
    await put(tokenFor("owner"), body(0, { pick_surface_height: { value: 30, unit: "in" } }));
    const response = await put(tokenFor("film"), body(0, { pick_surface_height: { value: 31, unit: "in" } }));
    expect(response.status).toBe(409);
    const conflict = await response.json();
    expect(conflict).toMatchObject({ code: "measurements_changed", revision: 1,
      readings: { pick_surface_height: { value: 30 } } });
  });

  it("explains a reading the catalog refuses", async () => {
    const response = await put(tokenFor("owner"), body(0, { pick_surface_height: { value: 400, unit: "cm" } }));
    expect(response.status).toBe(400);
    const refused = await response.json();
    expect(refused.code).toBe("measurements_invalid");
    expect(refused.error).toContain("Check the units");
    expect(sharedFakeFirestoreState.docs.has("siteTaskMeasurements/req-1")).toBe(false);
  });

  it("refuses a body with fields it does not know", async () => {
    const response = await put(tokenFor("owner"), { ...body(0, {}), robot: "franka" });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("measurements_invalid");
  });

  it("is closed to reads too once recording consent is withdrawn", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      requestId: "req-1", request: { buyerType: "site_operator" }, capture_rights: { consent_revoked: true },
    });
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}/measurements`);
    expect(response.status).toBe(409);
  });

  it("is closed once recording consent is withdrawn", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      requestId: "req-1",
      request: { buyerType: "site_operator" },
      capture_rights: { consent_revoked: true },
    });
    const response = await put(tokenFor("owner"), body(0, { pick_surface_height: { value: 30, unit: "in" } }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("capture_processing_not_authorized");
  });
});
