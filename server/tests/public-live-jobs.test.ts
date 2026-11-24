// @vitest-environment node
/**
 * The public live-jobs list after a withdrawal (stress test round 2, 2026-11-24: a withdrawn job stayed on it for up to
 * six minutes, a one-minute server read cache plus `max-age=300` in browsers). OFFLINE: the real withdrawal against the
 * fake Firestore, and the real route with its listing scripted.
 */
import express from "express";
import http, { type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/pipelineCompanyRecheck", () => ({ recheckCaptureInBackground: vi.fn(), askPipelineToRecheckCapture: vi.fn() }));
const listed = vi.hoisted(() => ({ jobs: [{ ref: "l-one", kind: "Pick and place", kindKey: "pick", country: null, postedOn: "2026-11-24",
  simulationReady: false }] as Array<Record<string, unknown>>, reads: 0 }));
vi.mock("../utils/taskBrowse", () => ({ listPublicLiveJobs: vi.fn(async () => { listed.reads += 1; return listed.jobs; }) }));

const router = (await import("../routes/public-live-jobs")).default;
const { resetPublicLiveJobsCache } = await import("../routes/public-live-jobs");
const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");

let server: Server;
let base = "";
beforeAll(async () => {
  const app = express();
  app.use("/api/public/live-jobs", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/public/live-jobs`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => {
  state.docs.clear();
  resetPublicLiveJobsCache();
  listed.reads = 0;
  listed.jobs = [{ ref: "l-one", kind: "Pick and place", kindKey: "pick", country: null, postedOn: "2026-11-24", simulationReady: false }];
});

describe("the public live-jobs list", () => {
  it("is never kept by a browser without asking again, and answers an unchanged list with 304", async () => {
    const first = await fetch(base);
    expect(first.headers.get("cache-control")).toBe("private, no-cache");
    const tag = first.headers.get("etag");
    expect(tag).toBeTruthy();
    // A browser's revalidation, as a plain request (fetch keeps a 304 from its caller).
    const status = await new Promise<number>((resolve, reject) => http.get(base, { headers: { "If-None-Match": tag! } },
      response => { response.resume(); resolve(response.statusCode ?? 0); }).on("error", reject));
    expect(status).toBe(304);
  });

  it("reads the jobs at most once a minute, until a withdrawal empties the cache", async () => {
    await fetch(base);
    await fetch(base);
    expect(listed.reads).toBe(1);
    state.docs.set("inboundRequests/req-wd", { requestId: "req-wd", request: { buyerType: "site_operator",
      consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: "2026-11-12T10:00:00.000Z" } } });
    await recordWebsiteCaptureWithdrawal({ requestId: "req-wd", requestedBy: "signed_owner_link", authorize: () => undefined });
    listed.jobs = [];
    expect(await (await fetch(base)).json()).toEqual({ jobs: [] });
    expect(listed.reads).toBe(2);
  });
});
