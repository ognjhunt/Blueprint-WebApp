// @vitest-environment node
/**
 * A film-only link can record. It cannot attest.
 *
 * The gap this closes was mine: the same signed link opened the camera and
 * confirmed the brief, and confirming is the attestation that writes gate
 * answers as `operator_stated`. So an owner who forwarded the QR to a colleague
 * meant only to film handed them authority to state operating facts on the
 * site's behalf. This is the boundary at the route: film scope is refused at
 * confirm, owner scope is allowed.
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

// The outbox delivery the confirm route fires must not reach a real provider.
vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    contact: { email: "ops@acme.example", firstName: "Dana" },
  });
  await saveBrief(
    draftBrief({
      requestId: "req-1",
      summary: "Cartons from a conveyor onto a pallet",
      captureMode: "self_capture",
      proposed: [],
    }),
  );
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function tokenFor(scope: "owner" | "film") {
  return createCaptureUploadToken({
    requestId: "req-1",
    captureId: "cap-1",
    sceneId: "scene-1",
    scope,
  });
}

async function confirm(token: string) {
  return fetch(`${baseUrl}/api/site-task-brief/${token}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmedBy: "Dana Okafor",
      successCriteria: { successDefinition: "Carton reaches pallet intact", successRate: null, cycleTimeSeconds: null, unknown: false } }),
  });
}

describe("confirming the brief needs an owner link", () => {
  it("refuses a film-only link with a clear reason", async () => {
    const response = await confirm(tokenFor("film"));
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("capture_token_film_only");

    // And it did not confirm: the request carries no confirmation timestamp.
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    expect(stored.site_task_brief_confirmed_at).toBeUndefined();
  });

  it("allows an owner link", async () => {
    const response = await confirm(tokenFor("owner"));
    expect(response.status).toBe(200);
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    expect(stored.site_task_brief_confirmed_at).toBeTruthy();
  });
});

describe("the brief GET tells the client its scope", () => {
  it("reports film scope, so the client hides the confirm UI", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}`);
    const body = (await response.json()) as { scope?: string; ready?: boolean };
    expect(body.scope).toBe("film");
    expect(body.ready).toBe(true);
  });
});

describe("only an owner link can mint a record-only link", () => {
  it("issues a film URL from an owner link", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("owner")}/film-link`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { filmUrl?: string };
    expect(body.filmUrl).toMatch(/\/capture-upload\//);
  });

  it("refuses to let a film link mint another", async () => {
    const response = await fetch(`${baseUrl}/api/site-task-brief/${tokenFor("film")}/film-link`);
    expect(response.status).toBe(403);
  });
});
