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
import { createHash } from "node:crypto";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

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
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function status() {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/status`);
  return { code: response.status, body: await response.json() };
}

describe("GET /api/site-task-brief/:token/status", () => {
  function savedRecording(kind: "stored" | "held" | "published", scope: "owner" | "film" = "owner") {
    const identity = { requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1" };
    const objectName = `scenes/${identity.sceneId}/captures/${identity.captureId}/raw/walkthrough.mp4`;
    const video = { object_name: objectName, generation: "17", size_bytes: 5, crc32c: "AAAAAA==" };
    storage.objects.set(objectName, { generation: "17", size: "5", crc32c: "AAAAAA==" });
    const manifest = JSON.stringify({ request_id: identity.requestId, scene_id: identity.sceneId,
      capture_id: identity.captureId, video_uri: objectName,
      capture_rights: { derived_scene_generation_allowed: true, consent_status: "granted", consent_revoked: false } });
    const completed_at_iso = "2026-10-07T00:00:00.000Z";
    const common = { request_id: identity.requestId, scene_id: identity.sceneId,
      capture_id: identity.captureId, completed_at_iso, video };
    sharedFakeFirestoreState.docs.set(`captureUploadSessions/${identity.captureId}`, kind === "stored" ? {
      browser_stored_upload: { ...common, schema_version: "website_browser_stored_upload.v1",
        manifest_json: manifest, manifest_sha256: `sha256:${createHash("sha256").update(manifest).digest("hex")}` },
    } : {
      browser_pending_delivery: { ...common, schema_version: "website_browser_pending.v1", state: kind,
        manifest: { object_name: objectName.replace("walkthrough.mp4", "manifest.json"), generation: "18",
          size_bytes: 20, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } },
    });
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...request, capture_coverage: null,
      request: { ...(request.request as Record<string, unknown>), consent_attestation: {
        granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: completed_at_iso,
      } },
    });
    return { token: createCaptureUploadToken({ ...identity, scope }), objectName };
  }

  it.each(["stored", "held", "published"] as const)("acknowledges %s browser bytes without a processing marker", async (kind) => {
    const saved = savedRecording(kind);
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${saved.token}/status`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ captureReceived: true,
      status: { decision: "footage_received", operatorAction: null } });
    expect(body.status.headline).toContain("Your video is saved.");
    expect(body.status.headline).not.toMatch(/are checking|are preparing|film the work area/i);
    expect(storage.write).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
  });

  it.each(["owner", "film"] as const)("keeps %s receipt polling read-only after withdrawal", async (scope) => {
    const saved = savedRecording("stored", scope);
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1");
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...request, consent_revoked: true });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const response = await fetch(`${baseUrl}/api/site-task-brief/${saved.token}/status`);
    expect(await response.json()).toMatchObject({ captureReceived: true,
      processingHold: { code: "capture_processing_not_authorized" },
      status: { headline: "Your video is saved. Recording consent was withdrawn. Further processing is blocked and the scene preview is unavailable.", operatorAction: null } });
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(storage.write).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });

  it("does not claim active review when a verified published handoff's consent is withdrawn", async () => {
    const saved = savedRecording("stored");
    const session = sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-req-1")!;
    const source = session.browser_stored_upload;
    const bytes = Buffer.from(source.manifest_json);
    const manifest = { object_name: saved.objectName.replace("walkthrough.mp4", "manifest.json"),
      generation: "18", size_bytes: bytes.length, crc32c: "AAAAAA==", sha256: source.manifest_sha256 };
    storage.objects.set(manifest.object_name, { generation: "18", size: String(bytes.length), crc32c: "AAAAAA==", bytes });
    const pending = { ...source, schema_version: "website_browser_pending.v1", state: "published", manifest };
    sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-req-1", { browser_pending_delivery: pending });
    const delivery = buildBrowserDelivery({ requestId: "req-1", sceneId: "site-req-1", captureId: "walkthrough-req-1",
      rawPrefix: saved.objectName.slice(0, saved.objectName.lastIndexOf("/")), video: pending.video,
      manifest, completedAtIso: pending.completed_at_iso });
    for (const [name, content] of [[delivery.objectName, delivery.recordBytes],
      [`${delivery.record.raw_prefix}/capture_upload_complete.json`, delivery.markerBytes]] as const) {
      storage.objects.set(name, { generation: "19", size: String(content.length), crc32c: "AAAAAA==", bytes: content });
    }
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1");
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...request, consent_revoked: true });
    const response = await fetch(`${baseUrl}/api/site-task-brief/${saved.token}/status`);
    expect(await response.json()).toMatchObject({ captureReceived: true, uploadState: "processing_ready",
      processingHold: { code: "capture_processing_not_authorized" },
      status: { headline: "Your video is saved. Recording consent was withdrawn. Further processing is blocked and the scene preview is unavailable.", operatorAction: null } });
    expect(storage.write).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });

  it.each(["generation", "size", "crc32c", "missing"])("does not claim a saved receipt whose %s differs", async (field) => {
    const saved = savedRecording("stored");
    // A stale marker from an earlier write must not override the receipt's
    // contradictory generation/size/checksum (or vanished video).
    storage.objects.set(saved.objectName.replace("walkthrough.mp4", "capture_upload_complete.json"),
      { generation: "3", size: "2", crc32c: "AAAAAA==" });
    if (field === "missing") storage.objects.delete(saved.objectName);
    else Object.assign(storage.objects.get(saved.objectName)!, { [field]: field === "crc32c" ? "AQAAAA==" : "99" });
    const response = await fetch(`${baseUrl}/api/site-task-brief/${saved.token}/status`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "task_status_unavailable" });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("retains the completion-marker fallback for app bundles without a browser walkthrough", async () => {
    storage.objects.set("scenes/scene-1/captures/cap-1/raw/capture_upload_complete.json",
      { generation: "1", size: "2", crc32c: "AAAAAA==" });
    expect((await status()).body).toMatchObject({ captureReceived: true, uploadState: "retained" });
  });

  it("refuses a saved receipt belonging to a different scene", async () => {
    savedRecording("held");
    const wrongSceneToken = createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "wrong-scene" });
    const response = await fetch(`${baseUrl}/api/site-task-brief/${wrongSceneToken}/status`);
    expect(response.status).toBe(503);
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("does not convert a storage outage into instructions to film again", async () => {
    storage.failure = new Error("storage unavailable");
    const { code, body } = await status();
    expect(code).toBe(503);
    expect(body.code).toBe("task_status_unavailable");
    expect(body.captureReceived).toBeUndefined();
    expect(body.status).toBeUndefined();
  });

  it("keeps repeated owner and film status reads free of outbox delivery and writes", async () => {
    sharedFakeFirestoreState.docs.set("captureOutbox/unrelated-pending", {
      requestId: "another-site", state: "pending", attempts: 0,
    });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const filmToken = createCaptureUploadToken({
      requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope: "film",
    });

    expect((await status()).code).toBe(200);
    expect((await status()).code).toBe(200);
    expect((await fetch(`${baseUrl}/api/site-task-brief/${filmToken}/status`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/site-task-brief/invalid-token/status`)).status).toBe(404);

    expect(deliverOutbox).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
  });

  it("does not advance cleanup, restore consent or deliver messages when an existing link is polled after withdrawal", async () => {
    const existingToken = token();
    const record = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      ...record, consent_revoked: true, future_processing_allowed: false,
      request: { ...(record.request as Record<string, unknown>), consent_attestation: { granted: false } },
      capture_withdrawal: { state: "uploads_stopped_cleanup_pending", deletionConfirmed: false },
      captureWithdrawalPending: true,
    });
    sharedFakeFirestoreState.docs.set("captureOutbox/withdrawal-pending", {
      requestId: "req-1", state: "pending", attempts: 0,
    });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);

    for (let read = 0; read < 3; read++) {
      expect((await fetch(`${baseUrl}/api/site-task-brief/${existingToken}/status`)).status).toBe(200);
    }

    expect(deliverOutbox).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
  });

  it("isolates each site's status on replay and rejects a token changed to another request", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-2", {
      requestId: "req-2", request: { buyerType: "site_operator", capture_mode: "self_capture" },
      account_owner_uid: "owner-2", site_task_brief_confirmed_at: "2026-09-18T00:00:00.000Z",
    });
    await saveBrief(draftBrief({ requestId: "req-2", summary: "Second site's private task", captureMode: "self_capture", proposed: [] }));
    sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-2", {
      world_reconstruction: { state: "ready", assets: { launchUrl: "https://viewer.example/second-site" } },
    });
    const ownToken = token();
    const secondToken = createCaptureUploadToken({ requestId: "req-2", captureId: "cap-2", sceneId: "scene-2" });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);

    for (const signedToken of [ownToken, secondToken, ownToken, secondToken]) {
      const response = await fetch(`${baseUrl}/api/site-task-brief/${signedToken}/status`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.summary).toBe(signedToken === ownToken ? "Cartons onto a pallet" : "Second site's private task");
      expect(body.sceneViewUrl).toBe(signedToken === ownToken ? null : "https://viewer.example/second-site");
    }
    const [encoded, signature] = ownToken.split(".");
    const changedPayload = { ...JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")), requestId: "req-2" };
    const changedToken = `${Buffer.from(JSON.stringify(changedPayload)).toString("base64url")}.${signature}`;
    const rejected = await fetch(`${baseUrl}/api/site-task-brief/${changedToken}/status`);
    expect(rejected.status).toBe(404);
    expect(await rejected.json()).toMatchObject({ code: "capture_token_invalid" });
    const expiredToken = createCaptureUploadToken({ requestId: "req-2", captureId: "cap-2", sceneId: "scene-2", ttlSeconds: -1 });
    expect((await fetch(`${baseUrl}/api/site-task-brief/${expiredToken}/status`)).status).toBe(404);

    expect(deliverOutbox).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
  });

  it("reads assessing while nobody has run against the scene, and already offers the claim", async () => {
    const { code, body } = await status();
    expect(code).toBe(200);
    expect(body.status.decision).toBe("assessing");
    expect(body.captureReceived).toBe(false);
    expect(body.claimUrl).toMatch(/\/claim\/.+/);
  });

  it("offers no claim before the brief is confirmed", async () => {
    const record = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    const { site_task_brief_confirmed_at: _confirmed, ...unconfirmed } = record;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", unconfirmed);

    const { body } = await status();

    expect(body.status.decision).toBe("confirm_brief");
    expect(body.claimUrl ?? null).toBeNull();
  });

  it("reads screening once a run is queued, and offers the claim link", async () => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_r1", {
      runId: "run_r1",
      teamId: "team-a",
      sceneId: "req-1",
      state: "requested",
      requestedAtIso: "2026-09-19T00:00:00.000Z",
    });

    const { body } = await status();

    expect(body.status.decision).toBe("screening");
    expect(body.status.headline).toContain("queued for 1 robot team");
    expect(body.status.headline).toContain("Execution has not started");
    expect(body.claimUrl).toMatch(/\/claim\/.+/);
  });

  it("reads results once a run reported without comparing it to other runs", async () => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_r1", {
      runId: "run_r1",
      teamId: "team-a",
      sceneId: "req-1",
      state: "completed",
      result: { observed: { episodesRun: 50, episodesSucceeded: 41, successRate: 0.82, medianCycleSeconds: 40 } },
    });

    const { body } = await status();

    expect(body.status.decision).toBe("results");
    expect(body.status.headline).toContain("Review each run's observed episodes separately");
    expect(body.status.operatorAction).toBe("Review the results.");
  });

  it("offers no claim link once an account owns the site", async () => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_r1", {
      runId: "run_r1",
      teamId: "team-a",
      sceneId: "req-1",
      state: "requested",
    });
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      ...(sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>),
      account_owner_uid: "uid-dana",
    });

    const { body } = await status();

    expect(body.status.decision).toBe("screening");
    expect(body.claimUrl ?? null).toBeNull();
  });

  it("withholds a derived scene preview after recording consent is withdrawn", async () => {
    sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-1", {
      world_reconstruction: { state: "ready", assets: { launchUrl: "https://viewer.example/withdrawn" } },
    });
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...request, consent_revoked: true });
    const before = structuredClone([...sharedFakeFirestoreState.docs]);
    const { body } = await status();
    expect(body.sceneViewUrl).toBeNull();
    expect(body.status.headline).toMatch(/withdrawn/i);
    expect(body.status.headline).not.toMatch(/preview is ready|preparing|screening|results are in/i);
    expect([...sharedFakeFirestoreState.docs]).toEqual(before);
    expect(storage.write).not.toHaveBeenCalled();
    expect(deliverOutbox).not.toHaveBeenCalled();
  });

  it("projects a persisted safe scene viewer only to the owner link", async () => {
    sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-1", {
      world_reconstruction: {
        state: "ready",
        assets: { launchUrl: "https://viewer.example/world-1", panoUrl: null },
      },
    });

    const { body } = await status();
    expect(body.sceneViewUrl).toBe("https://viewer.example/world-1");
    expect(body.status.headline).toBe("Your scene preview is ready. We are preparing the job for simulation.");
    expect(body.claimUrl).toMatch(/\/claim\/.+/);
    expect(body.status.decision).toBe("assessing");

    const filmToken = createCaptureUploadToken({
      requestId: "req-1",
      captureId: "cap-1",
      sceneId: "scene-1",
      scope: "film",
    });
    const filmResponse = await fetch(`${baseUrl}/api/site-task-brief/${filmToken}/status`);
    expect(await filmResponse.json()).toMatchObject({ sceneViewUrl: null, claimUrl: null });

    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...request, account_owner_uid: "uid-dana" });
    expect((await status()).body.claimUrl).toBeNull();
  });
});

describe("task follow-up on the owner link", () => {
  it("offers at most three missing topics and saves an operator target", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const prior = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
      ...prior,
      request: { ...(prior.request as Record<string, unknown>), taskStatement: "Move cartons to a pallet" },
    });
    await saveBrief({
      ...draftBrief({ requestId: "req-1", summary: "Move cartons to a pallet", captureMode: "self_capture", proposed: [] }),
    });

    const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/follow-up`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.questions.length).toBeLessThanOrEqual(3);
    expect(body.questions.map((question: { id: string }) => question.id)).toContain("success_target");
    expect(body.questions.map((question: { id: string }) => question.id)).toContain("item_photos");

    const saved = await fetch(`${baseUrl}/api/site-task-brief/${token()}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "success_target", answer: "At least 40 cartons per hour" }),
    });
    expect(saved.status).toBe(200);
    expect(sharedFakeFirestoreState.docs.get("siteTaskFollowups/req-1")).toMatchObject({
      answers: { success_target: "At least 40 cartons per hour" },
    });
    expect(sharedFakeFirestoreState.docs.get("siteTaskBriefs/req-1")).toMatchObject({
      successCriteria: { successDefinition: "At least 40 cartons per hour" },
    });
  });

  it("does not expose questions or accept answers from a film-only link", async () => {
    const filmToken = createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope: "film" });
    const read = await fetch(`${baseUrl}/api/site-task-brief/${filmToken}/follow-up`);
    const write = await fetch(`${baseUrl}/api/site-task-brief/${filmToken}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "item_weight", answer: "10 kg" }),
    });
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
  });
});
