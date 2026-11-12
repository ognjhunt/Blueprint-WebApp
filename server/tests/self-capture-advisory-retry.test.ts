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
// The per-job site assessment ended (owner decision 2026-11-11): its retry is gone.
it("answers every retry with a typed 410, without a helper call or queue wake", async () => {
  for (const [link, input] of [[token(), body], [token("film"), body], ["invalid", body], [token(), {}]] as const) {
    const response = await post(link, input);
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: false, code: "advisory_retry_retired" });
  }
  expect(seams.retry).not.toHaveBeenCalled(); expect(seams.wake).not.toHaveBeenCalled();
});
