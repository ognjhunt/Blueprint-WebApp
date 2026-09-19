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
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

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
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");

let server: Server;
let baseUrl: string;

const token = () =>
  createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" });

beforeEach(async () => {
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
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function status() {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token()}/status`);
  return { code: response.status, body: await response.json() };
}

describe("GET /api/site-task-brief/:token/status", () => {
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
    expect(body.status.headline).toContain("1 robot team is");
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

  it("projects a persisted safe scene viewer only to the owner link", async () => {
    sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-1", {
      world_reconstruction: {
        state: "ready",
        assets: { launchUrl: "https://viewer.example/world-1", panoUrl: null },
      },
    });

    const { body } = await status();
    expect(body.sceneViewUrl).toBe("https://viewer.example/world-1");

    const filmToken = createCaptureUploadToken({
      requestId: "req-1",
      captureId: "cap-1",
      sceneId: "scene-1",
      scope: "film",
    });
    const filmResponse = await fetch(`${baseUrl}/api/site-task-brief/${filmToken}/status`);
    expect((await filmResponse.json()).sceneViewUrl).toBeNull();
  });
});
