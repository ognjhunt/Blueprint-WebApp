// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const seams = vi.hoisted(() => ({ describe: vi.fn(), wake: vi.fn(), advisory: vi.fn() }));
vi.mock("../utils/siteAssessmentQueue", () => ({ describeSiteAssessmentRetry: seams.describe, tickSiteAssessments: seams.wake }));
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAdvisory: seams.advisory }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: vi.fn(async () => null), confirmBrief: vi.fn() }));
vi.mock("../utils/websiteBrowserUploadStatus", () => ({ describeBrowserUpload: vi.fn(async () => ({ captureReceived: true, uploadState: "processing_ready" })) }));
vi.mock("../utils/agentEvalRuns", () => ({ loadSceneScreening: vi.fn(async () => null) }));
vi.mock("../utils/captureOutbox", () => ({ enqueueOutbox: vi.fn(), deliverOutbox: vi.fn() }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } } }));
import router from "../routes/site-task-brief";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
const job = `advisory-${"a".repeat(64)}`, run = "failed-retained-run";
const raw = () => ({ request: { buyerType: "site_operator", consent_attestation: { granted: true,
  statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } } });
let server: Server, origin: string;
const link = (scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId: "fixture", captureId: "walkthrough-fixture", sceneId: "site-fixture", scope });
const read = (token = link()) => fetch(`${origin}/api/site-task-brief/${token}/status`);
beforeEach(async () => {
  vi.clearAllMocks(); seams.describe.mockReset(); seams.advisory.mockReset();
  seams.advisory.mockResolvedValue({ state: "needs_review", sections: [], correlationId: "safe-correlation" });
  seams.describe.mockImplementation(async (_id: string, access: (r: any) => any) => { await access(raw()); return { available: true, job_id: job, run_id: run }; });
  sharedFakeFirestoreState.docs.clear(); sharedFakeFirestoreState.docs.set("inboundRequests/fixture", raw());
  const app = express(); app.use(express.json()); app.use("/api/site-task-brief", router);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address(); if (!addr || typeof addr === "string") throw Error("fixture_listener_missing");
  origin = `http://127.0.0.1:${addr.port}`;
});
afterEach(async () => { vi.restoreAllMocks(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
it("exposes only authoritative owner retry availability without mutating or waking a failed job", async () => {
  const before = structuredClone([...sharedFakeFirestoreState.docs]); const response = await read(); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ assessment_retry_available: true, assessment_job_id: job, assessment_run_id: run });
  expect(seams.describe).toHaveBeenCalledExactlyOnceWith("fixture", expect.any(Function));
  expect(seams.wake).not.toHaveBeenCalled(); expect([...sharedFakeFirestoreState.docs]).toEqual(before);
});
it("does not expose retry identifiers to film links or completed reports", async () => {
  const film = await (await read(link("film"))).json(); expect(film).toMatchObject({ assessment_retry_available: false, assessment_job_id: null, assessment_run_id: null });
  seams.advisory.mockResolvedValue({ state: "ready", sections: [] });
  expect(await (await read()).json()).toMatchObject({ assessment_retry_available: false, assessment_job_id: null, assessment_run_id: null });
  expect(seams.describe).not.toHaveBeenCalled(); expect(seams.wake).not.toHaveBeenCalled();
});
it("contains dependency failure and does not leak private helper details", async () => {
  seams.describe.mockRejectedValue(Error("PRIVATE bearer provider message")); const response = await read(); expect(response.status).toBe(200);
  const body = await response.json(); expect(body).toMatchObject({ assessment_retry_available: false, assessment_job_id: null, assessment_run_id: null });
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE|bearer|provider message/); expect(seams.wake).not.toHaveBeenCalled();
});
it.each(["withdrawn", "changed-owner", "expired"])("rechecks %s authority during the read-only transaction", async mode => {
  const initial = Date.now(), token = link();
  seams.describe.mockImplementation(async (_id: string, access: (r: any) => any) => {
    if (mode === "expired") vi.spyOn(Date, "now").mockReturnValue(initial + 30 * 86400000);
    await access({ ...raw(), ...(mode === "withdrawn" ? { consent_revoked: true } : mode === "changed-owner" ? { account_owner_uid: "different-owner" } : {}) });
    return { available: true, job_id: job, run_id: run };
  });
  const response = await read(token); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ assessment_retry_available: false, assessment_job_id: null, assessment_run_id: null });
  expect(seams.wake).not.toHaveBeenCalled();
});
