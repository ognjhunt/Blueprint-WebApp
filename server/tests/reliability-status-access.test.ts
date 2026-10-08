// @vitest-environment node
/**
 * The account-free status page, past "assessing".
 *
 * The ladder deliberately stopped where the Pipeline gap began, so a site
 * whose scene was being screened by three teams still read "we are preparing
 * it". These pin the two rungs that now follow, and the one moment an account
 * is offered: when there is something behind it to see and nobody owns the
 * site yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHash, createHmac } from "node:crypto";
import catalog from "./fixtures/reliability-status-cases.json";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState, sharedFakeFirestore } from "./helpers/fake-firestore";

const storage = vi.hoisted(() => ({
  objects: new Map<string, { generation: string; size: string; crc32c: string; bytes?: Buffer }>(),
  failure: null as Error | null,
  write: vi.fn(() => { throw new Error("Unexpected storage mutation"); }),
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
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
    storageAdmin: { bucket: () => ({ file: (name: string) => ({
      getMetadata: async () => {
        if (storage.failure) throw storage.failure;
        const metadata = storage.objects.get(name);
        if (!metadata) throw Object.assign(new Error("missing"), { code: 404 });
        return [{ name, ...metadata }];
      },
      exists: async () => {
        if (storage.failure) throw storage.failure;
        return [storage.objects.has(name)];
      },
      download: async () => [storage.objects.get(name)?.bytes ?? Buffer.alloc(0)],
      save: storage.write, delete: storage.write,
    }) }) },
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
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");
const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");

let server: Server;
let baseUrl: string;

const token = () =>
  createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" });

beforeEach(async () => {
  vi.clearAllMocks();
  storage.objects.clear();
  storage.failure = null;
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  // A confirmed brief and a covered capture: everything the ladder needs
  // before a run could exist against the scene.
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {} },
    contact: { email: "ops@acme.example", firstName: "Dana" },
    site_task_brief_confirmed_at: "2026-09-18T00:00:00.000Z",
    capture_coverage: { covers_scene: true, missing_coverage: [], supplement_would_finish: false },
  });
  await saveBrief({
    ...draftBrief({ requestId: "req-1", summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [] }),
    confirmedAtIso: "2026-09-18T00:00:00.000Z",
    confirmedBy: "Dana",
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function status() {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/status`);
  return { code: response.status, body: await response.json() };
}


function candidateToken(kind: string) {
  if (kind === "film") return createCaptureUploadToken({requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope: "film"});
  if (kind === "expired") return createCaptureUploadToken({requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", ttlSeconds: -1});
  if (kind === "missing") return "missing";
  const [payload, signature] = token().split(".");
  if (kind === "forged") return `${payload}.forged`;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (kind === "wrong_kind") parsed.kind = "request_review";
  else parsed.requestId = "other-customer";
  const encoded = Buffer.from(JSON.stringify(parsed)).toString("base64url");
  // A genuine differently scoped credential must fail even with valid HMAC.
  return kind === "wrong_kind"
    ? `${encoded}.${createHmac("sha256", process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim() || process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim() || process.env.PIPELINE_SYNC_TOKEN?.trim() || "blueprint-request-review-dev-secret").update(JSON.stringify(parsed)).digest("base64url")}`
    : `${encoded}.${signature}`;
}

describe("D generated access cases", () => {
  it.each(catalog.filter(c => c.family === "access-consent"))("$caseId", async row => {
    const {token: kind, endpoint} = row.parameters as {token: string; endpoint: string};
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${candidateToken(kind)}/${endpoint}`, {
      method: endpoint === "confirm" ? "POST" : "GET",
      ...(endpoint === "confirm" ? {headers: {"Content-Type":"application/json"},body: JSON.stringify({confirmedBy:"Local test", answers:{}})} : {}),
    });
    const expected = kind === "film" ? endpoint === "status" ? 200 : 403 : 404;
    expect(response.status).toBe(expected);
    const body = await response.json();
    if (expected !== 200) expect(body.summary).toBeUndefined();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(storage.write).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });
});

describe("D generated withdrawal publication cases", () => {
  it.each(catalog.filter(c => c.family === "status-assessment"))("$caseId", async row => {
    const {location, signal, downstream} = row.parameters as {location:string; signal:string; downstream:string};
    const request = structuredClone(sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!) as Record<string, any>;
    request.request.consent_attestation = {granted:true,statement_version:RECORDING_CONSENT_VERSION,recorded_at_iso:"2026-10-01T00:00:00Z"};
    const destination = location === "record" ? request : location === "request" ? request.request
      : location === "attestation" ? request.request.consent_attestation : (request.capture_rights = {});
    destination[signal] = signal === "consent_revoked" ? true : signal === "future_processing_allowed" ? false
      : signal === "consent_status" ? "revoked" : "2026-10-07T00:00:00Z";
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1",request);
    sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-1",{world_reconstruction:{state:"ready",assets:{launchUrl:"https://viewer.example/withdrawn"}}});
    if (downstream !== "scene_preview") sharedFakeFirestoreState.docs.set("evaluationRuns/local-run",{
      runId:"local-run", teamId:"local-team",sceneId:"req-1",state:downstream === "queued_run" ? "requested" : "completed",
      ...(downstream === "observed_result" ? {result:{observed:{episodesRun:10,episodesSucceeded:8}}} : {}),
    });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/status`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.sceneViewUrl).toBeNull();
    expect(body.status.headline).toMatch(/consent was withdrawn/i);
    expect(body.status.headline).not.toMatch(/preview is ready|preparing|screening|results are in/i);
    expect(body.status.operatorAction).toBeNull();
    expect(body.status.missingViews).toEqual([]);
    expect(body.status.stage).toBeNull();
    expect(body.summary).toBeNull();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(storage.write).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });
});

it("renews an expired private link into the same job using only the stored inbox", async () => {
  const expired = createCaptureUploadToken({requestId:"req-1",captureId:"cap-1",sceneId:"scene-1",ttlSeconds:-1});
  expect((await fetch(`${baseUrl}/api/site-task-brief/${expired}/status`)).status).toBe(404);
  const response = await fetch(`${baseUrl}/api/site-task-brief/${expired}/fresh-link`, {method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"attacker@example.test",requestId:"other"})});
  expect(response.status).toBe(202);
  const queued = vi.mocked(enqueueOutbox).mock.calls[0][0];
  expect(queued.requestId).toBe("req-1");
  expect(queued.to).toBe("ops@acme.example");
  const renewedUrl = queued.body.match(/https:\/\/[^\s]+\/capture\/([^\s]+)/)?.[0]
    ?? queued.body.match(/https:\/\/[^\s]+/)?.[0];
  expect(renewedUrl).toBeTruthy();
  const renewed = new URL(renewedUrl!).pathname.split("/").pop()!;
  const reopened = await fetch(`${baseUrl}/api/site-task-brief/${renewed}/status`);
  expect(reopened.status).toBe(200);
  expect((await reopened.json()).summary).toBe("Cartons onto a pallet");
  const receipt = await response.json();
  expect(JSON.stringify(receipt)).not.toContain("acme");
  const invalid = await fetch(`${baseUrl}/api/site-task-brief/forged/fresh-link`,{method:"POST"});
  expect(await invalid.json()).toEqual(receipt);
  expect(enqueueOutbox).toHaveBeenCalledTimes(1);
});

 it("blocks a withdrawn link from reading its retained mixed-source brief", async () => {
   const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
   sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {...request,consent_revoked:true});
   const before = structuredClone([...sharedFakeFirestoreState.docs]);
   const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}`);
   expect(response.status).toBe(409);
   expect(await response.json()).toMatchObject({code:"capture_processing_not_authorized"});
   expect([...sharedFakeFirestoreState.docs]).toEqual(before);
 });

describe("withdrawn links cannot serve or derive mixed-source review", () => {
  it.each(["", "/follow-up", "/items", "/clarification", "/film-link"])("blocks GET %s", async path => {
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {...request,consent_revoked:true});
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}${path}`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"capture_processing_not_authorized"});
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });
  it.each(["/follow-up", "/items", "/clarification", "/confirm", "/film-link/send"])("blocks POST %s", async path => {
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {...request,consent_revoked:true});
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}${path}`, {method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmedBy:"Local test",answer:"restore"})});
    expect(response.status).toBe(409);
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });
});

it("fails safely when current recording authorization cannot be read", async () => {
  const spy = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation(() => { throw new Error("synthetic storage error with private token"); });
  try {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/items`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({code:"capture_authorization_unavailable"});
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  } finally {spy.mockRestore();}
});

it("blocks withdrawn inventory deletion without changing retained evidence", async () => {
  const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {...request,consent_revoked:true});
  const before = structuredClone([...sharedFakeFirestoreState.docs]);
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/items/local-item`,{method:"DELETE"});
  expect(response.status).toBe(409);
  expect([...sharedFakeFirestoreState.docs]).toEqual(before);
});
