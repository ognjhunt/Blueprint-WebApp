// @vitest-environment node
/**
 * Withdrawal from the signed owner link. A site with no account holds only
 * this link, so it must reach the same withdrawal the account route performs,
 * with explicit confirmation, idempotently, and with honest deletion states.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } }, storageAdmin: null,
}));
import router from "../routes/self-capture-uploads";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { OWNER_WITHDRAWAL_CONFIRMATION } from "../utils/websiteCaptureWithdrawal";

const token = (scope: "owner" | "film" = "owner", ttlSeconds = 100, ids = { captureId: "walkthrough-fixture", sceneId: "site-fixture" }) =>
  createCaptureUploadToken({ requestId: "fixture", ...ids, scope, ttlSeconds });
let server: Server | undefined;
let origin = "";
beforeEach(async () => {
  state.docs.clear();
  state.docs.set("inboundRequests/fixture", { request: { buyerType: "site_operator", consent_attestation: {
    granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
    briefReviewPending: true, capture_coverage_pending: true });
  state.docs.set("evaluationRuns/queued", { sceneId: "fixture", state: "requested", dispatchPending: true });
  state.docs.set("evaluationRuns/finished", { sceneId: "fixture", state: "completed" });
  const app = express(); app.use(express.json()); app.use("/api/self-capture/uploads", router);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("fixture_listener_missing");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
});
const post = (link: string, body: unknown = { confirm: OWNER_WITHDRAWAL_CONFIRMATION }) =>
  fetch(`${origin}/api/self-capture/uploads/${link}/withdrawal`, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(1500) });
const read = (link: string) => fetch(`${origin}/api/self-capture/uploads/${link}/withdrawal`, { signal: AbortSignal.timeout(1500) });
const stored = () => state.docs.get("inboundRequests/fixture") as any;

it("withdraws through the shared effect and reports uploads stopped with deletion still pending", async () => {
  const response = await post(token());
  expect(response.status).toBe(202);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toMatchObject({ ok: true, created: true, withdrawal: { state: "uploads_stopped_cleanup_pending",
    uploadsStopped: true, taskPaused: true, queuedRunsCancellationRequested: true, pipelineAcknowledged: false,
    deletionConfirmed: false, storageDeletion: { state: "pending", deletedObjectCount: 0 } } });
  expect(stored()).toMatchObject({ consent_revoked: true, future_processing_allowed: false, workspace_task: { paused: true },
    briefReviewPending: false, capture_coverage_pending: false, captureWithdrawalPending: true, captureDeletionPending: true,
    request: { consent_attestation: { granted: false } },
    capture_withdrawal: { requestedBy: "signed_owner_link", requestId: "fixture", sceneId: "site-fixture",
      captureId: "walkthrough-fixture", deletionConfirmed: false, webappDeletion: { phase: "pending" } } });
  expect(state.docs.get("evaluationRuns/queued")).toMatchObject({ cancellationRequested: true, dispatchPending: false,
    cancellationReason: "site_recording_consent_withdrawn" });
  expect(state.docs.get("evaluationRuns/finished")).not.toHaveProperty("cancellationRequested");
});

it("is idempotent: a repeat returns the original withdrawal", async () => {
  const first = await (await post(token())).json();
  const requestedAt = stored().capture_withdrawal.requestedAtIso;
  const second = await post(token());
  expect(second.status).toBe(202);
  const body = await second.json();
  expect(body.created).toBe(false);
  expect(body.withdrawal).toEqual(first.withdrawal);
  expect(stored().capture_withdrawal.requestedAtIso).toBe(requestedAt);
});

it("requires explicit confirmation", async () => {
  for (const body of [{}, { confirm: true }, { confirm: OWNER_WITHDRAWAL_CONFIRMATION, extra: 1 }]) {
    const response = await post(token(), body);
    expect(response.status).toBe(400);
  }
  expect(stored().consent_revoked).toBeUndefined();
});

it("refuses film, supplement, expired and forged links", async () => {
  const supplement = createCaptureUploadToken({ requestId: "fixture", captureId: "supplement-x", sceneId: "site-fixture", scope: "owner", ttlSeconds: 100 });
  for (const [link, status] of [[token("film"), 403], [supplement, 403], [token("owner", -1), 404], ["forged.sig", 404]] as const) {
    expect((await post(link)).status).toBe(status);
    expect((await read(link)).status).toBe(status);
  }
  expect(stored().consent_revoked).toBeUndefined();
});

it("returns 404 for a link to a job that no longer exists", async () => {
  state.docs.delete("inboundRequests/fixture");
  expect((await post(token())).status).toBe(404);
  expect(state.docs.has("inboundRequests/fixture")).toBe(false);
});

it("reports the recorded deletion state on read, including confirmed deletion", async () => {
  expect(await (await read(token())).json()).toEqual({ ok: true, withdrawn: false, withdrawal: null });
  await post(token());
  Object.assign(stored().capture_withdrawal, { pipelineAcknowledged: true,
    webappDeletion: { phase: "deleted", deletedObjectCount: 4, failedObjectCount: 0, completedAtIso: "2026-10-09T00:00:00.000Z", receiptIds: ["r1"] } });
  const body = await (await read(token())).json();
  expect(body).toMatchObject({ ok: true, withdrawn: true, withdrawal: { state: "deletion_confirmed", deletionConfirmed: true,
    storageDeletion: { state: "deleted", deletedObjectCount: 4, completedAtIso: "2026-10-09T00:00:00.000Z", receiptIds: ["r1"] } } });
});

it("stops the owner link's upload routes after withdrawal", async () => {
  await post(token());
  const status = await (await fetch(`${origin}/api/self-capture/uploads/${token()}/status`, { signal: AbortSignal.timeout(1500) })).json();
  expect(status.state).toBe("held");
});
