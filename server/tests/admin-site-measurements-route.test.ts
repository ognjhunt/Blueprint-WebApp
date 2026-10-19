// @vitest-environment node
/**
 * The job console's view of a site's measurements, and the source-document
 * export an operator retains as the qualification request's `measurement`.
 *
 * The export is read-only: it returns exact bytes and their sha256 and writes
 * nothing. It takes the request's binding as input because WebApp holds no
 * scene, task-spec, success-contract or robot-model digest before a run.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: router } = await import("../routes/admin-job-console");
const { saveMeasurements } = await import("../utils/siteTaskMeasurements");

const SHA = (digit: string) => `sha256:${digit.repeat(64)}`;
const binding = (requestId: string) => ({
  scene_request_id: requestId, site_id: `site-${requestId}`, task_id: "task-1", capture_id: `walkthrough-${requestId}`,
  source_capture_digest: SHA("1"), testbed_digest_sha256: SHA("2"), scene_revision_digest: SHA("3"),
  task_spec_digest: SHA("4"), success_contract_digest: SHA("5"), robot_model_digest: SHA("6"),
  policy_interface_id: "blueprint_policy_https.v1",
});

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    res.locals.firebaseUser = auth === "Bearer admin" ? { uid: "admin", admin: true }
      : auth === "Bearer user" ? { uid: "user" } : null;
    next();
  });
  app.use("/api/admin/jobs", router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/admin/jobs`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const admin = { Authorization: "Bearer admin", "content-type": "application/json" };

function revokeConsent() {
  sharedFakeFirestoreState.docs.set("inboundRequests/job-1", {
    requestId: "job-1", request: { buyerType: "site_operator" }, capture_rights: { consent_revoked: true },
  });
}

function exportDocs() {
  return [...sharedFakeFirestoreState.docs.keys()].filter((key) => key.startsWith("siteTaskMeasurements/job-1/exports/"));
}

function exportJob1(body: Record<string, unknown> = {}) {
  return fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
    method: "POST", headers: admin,
    body: JSON.stringify({ binding: binding("job-1"), producerId: "site_job:job-1", calibrationSampleIds: [], ...body }),
  });
}

async function recordReadings() {
  await saveMeasurements("job-1", {
    revision: 0, family: "articulated_open_close", articulation: "sliding",
    readings: { handle_height: { value: 80, unit: "cm" }, opening_travel: { value: 45, unit: "cm" } },
    referencePaper: "none", referenceSheetLongEdge: null, measuredBy: "Sam", note: "Bottom drawer.",
  }, { scope: "film" }, new Date("2026-10-17T09:00:00.000Z"));
}

describe("GET /api/admin/jobs/:requestId/site-measurements", () => {
  it("is for admins only", async () => {
    expect((await fetch(`${baseUrl}/job-1/site-measurements`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/job-1/site-measurements`, { headers: { Authorization: "Bearer user" } })).status)
      .toBe(403);
  });

  it("says plainly when a job has no measurements", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ measurements: null, consentRevoked: false, exports: [] });
  });

  it("says when recording consent was withdrawn", async () => {
    await recordReadings();
    revokeConsent();
    const response = await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin });
    expect(await response.json()).toMatchObject({ consentRevoked: true, measurements: { revision: 1 } });
  });

  it("shows SI values, provenance and what the readings cannot fill", async () => {
    await recordReadings();
    const response = await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin });
    const { measurements } = await response.json();
    expect(measurements).toMatchObject({ family: "articulated_open_close", articulation: "sliding", revision: 1,
      note: "Bottom drawer." });
    expect(measurements.readings).toEqual([
      expect.objectContaining({ sampleId: "handle_height", si: 0.8, siUnit: "m", basis: "tape",
        recordedByScope: "film", recordedByName: "Sam" }),
      expect.objectContaining({ sampleId: "opening_travel", si: 0.45 }),
    ]);
    expect(measurements.coverage.missingDimensions).toEqual(["collision", "observation", "scale", "task_dynamics"]);
  });
});

describe("POST /api/admin/jobs/:requestId/site-measurements/source-document", () => {
  it("returns the exact bytes and their digest, and retains an immutable copy and nothing else", async () => {
    await recordReadings();
    const before = JSON.stringify([...sharedFakeFirestoreState.docs.entries()]);
    const response = await exportJob1({ calibrationSampleIds: ["handle_height"] });
    expect(response.status).toBe(200);
    const exported = await response.json();
    expect(exported.fileName).toBe("site-task-measurements-job-1-r1.json");
    expect(exported.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.parse(exported.json)).toMatchObject({ producer_id: "site_job:job-1",
      binding: { scene_request_id: "job-1" } });
    expect(exported.sizeBytes).toBe(Buffer.byteLength(exported.json, "utf8"));
    expect(exported.coverage.missingDimensions)
      .toEqual(["collision", "observation", "registration", "scale", "task_dynamics"]);
    const hex = exported.sha256.slice("sha256:".length);
    expect(exported.retained).toMatchObject({ path: `siteTaskMeasurements/job-1/exports/${hex}`, alreadyRetained: false });
    const retained = sharedFakeFirestoreState.docs.get(`siteTaskMeasurements/job-1/exports/${hex}`) as Record<string, any>;
    expect(retained).toMatchObject({ json: exported.json, sha256: exported.sha256, sizeBytes: exported.sizeBytes,
      revision: 1, producerId: "site_job:job-1", calibrationSampleIds: ["handle_height"], exportedBy: "admin",
      binding: binding("job-1") });
    // Nothing but the retained copy changed.
    sharedFakeFirestoreState.docs.delete(`siteTaskMeasurements/job-1/exports/${hex}`);
    expect(JSON.stringify([...sharedFakeFirestoreState.docs.entries()])).toBe(before);
  });

  it("keeps the first record when the same bytes are exported again", async () => {
    await recordReadings();
    const first = await (await exportJob1()).json();
    const second = await (await exportJob1()).json();
    expect(second.sha256).toBe(first.sha256);
    expect(second.retained).toEqual({ ...first.retained, alreadyRetained: true });
    expect(exportDocs()).toHaveLength(1);
  });

  it("refuses to export once recording consent is withdrawn", async () => {
    await recordReadings();
    revokeConsent();
    const response = await exportJob1();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("capture_processing_not_authorized");
    expect(exportDocs()).toEqual([]);
  });

  it("refuses a binding for another job", async () => {
    await recordReadings();
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-2"), producerId: "site_job:job-1" }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("binding_job_mismatch");
  });

  it("says when there is nothing to export", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-1"), producerId: "site_job:job-1" }),
    });
    expect(response.status).toBe(404);
  });

  it("refuses a malformed body", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-1") }),
    });
    expect(response.status).toBe(400);
  });
});

describe("recovering a retained export", () => {
  it("returns the exact bytes by digest and lists the job's exports", async () => {
    await recordReadings();
    const exported = await (await exportJob1()).json();
    const hex = exported.sha256.slice("sha256:".length);
    const response = await fetch(`${baseUrl}/job-1/site-measurements/exports/${hex}`, { headers: admin });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ json: exported.json, sha256: exported.sha256, requestId: "job-1",
      revision: 1, producerId: "site_job:job-1", binding: binding("job-1") });
    const listed = await (await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin })).json();
    expect(listed.exports).toEqual([expect.objectContaining({ sha256: exported.sha256, revision: 1,
      path: `siteTaskMeasurements/job-1/exports/${hex}` })]);
  });

  it("says when a digest names nothing, and refuses one that is not a digest", async () => {
    expect((await fetch(`${baseUrl}/job-1/site-measurements/exports/${"0".repeat(64)}`, { headers: admin })).status)
      .toBe(404);
    expect((await fetch(`${baseUrl}/job-1/site-measurements/exports/not-a-digest`, { headers: admin })).status).toBe(400);
  });
});
