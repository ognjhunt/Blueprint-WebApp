// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const seams = vi.hoisted(() => ({ retry: vi.fn(), wake: vi.fn() }));
vi.mock("../utils/siteAssessmentQueue", () => ({ retrySiteAssessment: seams.retry, tickSiteAssessments: seams.wake }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } }, storageAdmin: null,
}));
import router from "../routes/self-capture-uploads";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
const jobId = `advisory-${"a".repeat(64)}`, runId = "retained-failed-run";
const body = { expected_job_id: jobId, expected_run_id: runId, retry_identity: "00000000-0000-4000-8000-000000000000" };
const request = () => ({ request: { buyerType: "site_operator", consent_attestation: {
  granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } } });
const token = (scope: "owner" | "film" = "owner", ttlSeconds = 100) => createCaptureUploadToken({
  requestId: "fixture", captureId: "walkthrough-fixture", sceneId: "site-fixture", scope, ttlSeconds });
let server: Server | undefined;
let origin = "";
beforeEach(async () => {
  seams.retry.mockReset(); seams.wake.mockReset().mockResolvedValue(undefined);
  seams.retry.mockImplementation(async (input: any) => { await input.assertAccess(request());
    return { state: "queued", job_id: jobId, run_id: "new-fenced-run" }; });
  const app = express(); app.use(express.json()); app.use("/api/self-capture/uploads", router);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("fixture_listener_missing");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
});
const post = (link: string, input: unknown = body) => fetch(`${origin}/api/self-capture/uploads/${link}/advisory-retry`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(1500) });
it("passes the owner's explicit retry identity to the durable helper and wakes only after its acknowledgment", async () => {
  const response = await post(token());
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true, state: "queued", job_id: jobId, run_id: "new-fenced-run" });
  expect(seams.retry).toHaveBeenCalledWith(expect.objectContaining({ requestId: "fixture", expectedJobId: jobId,
    expectedRunId: runId, retryIdentity: body.retry_identity, assertAccess: expect.any(Function) }));
  expect(seams.wake).toHaveBeenCalledExactlyOnceWith(1);
});
it("refuses film-only, malformed and expired capabilities without a helper call or queue wake", async () => {
  for (const [link, status] of [[token("film"), 403], ["invalid", 404], [token("owner", -1), 404]] as const) {
    const response = await post(link); expect(response.status).toBe(status);
  }
  expect(seams.retry).not.toHaveBeenCalled(); expect(seams.wake).not.toHaveBeenCalled();
});
it("rechecks current consent inside the transaction access callback", async () => {
  seams.retry.mockImplementation(async (input: any) => { await input.assertAccess({ ...request(), consent_revoked: true }); });
  const response = await post(token()); expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "advisory_retry_not_authorized" });
  expect(seams.wake).not.toHaveBeenCalled();
});
it("rechecks token expiry at the transaction boundary", async () => {
  const initial = Date.now(), link = token("owner", 20);
  seams.retry.mockImplementation(async (input: any) => { vi.spyOn(Date, "now").mockReturnValue(initial + 60_000);
    await input.assertAccess(request()); });
  const response = await post(link); expect(response.status).toBe(403); expect(seams.wake).not.toHaveBeenCalled();
});
it("does not accept a forged request scope or missing retry identity", async () => {
  for (const input of [{ ...body, request_id: "another-customer" }, { ...body, retry_identity: "" }]) {
    const response = await post(token(), input); expect(response.status).toBe(400);
  }
  expect(seams.retry).not.toHaveBeenCalled(); expect(seams.wake).not.toHaveBeenCalled();
});
it("contains conflicting source or dependency failures without provider prose or a queue wake", async () => {
  for (const [error, status] of [["advisory_retry_conflict", 409], ["PRIVATE bearer https://secret.invalid", 503]] as const) {
    seams.retry.mockRejectedValueOnce(Error(error)); const response = await post(token()); expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toMatch(/PRIVATE|bearer|secret.invalid/);
  }
  expect(seams.wake).not.toHaveBeenCalled();
});
