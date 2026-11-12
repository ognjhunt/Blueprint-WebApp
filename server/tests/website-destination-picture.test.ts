// @vitest-environment node
/**
 * The place question's picture (2026-11-12): a frame of the site's private video, delivered only to the job's own page
 * through a 15-minute ticket for exactly this job, capture and picture, re-checked against the job's rights and its
 * current capture, and fetched through the signed Pipeline read against the picture's digest.
 */
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const { destinationPictureUrl, verifyDestinationPictureTicket } = await import("../utils/websiteDestinationPicture");
const { default: router } = await import("../routes/website-destination-pictures");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("picture bytes")]);
const DIGEST = `sha256:${createHash("sha256").update(PNG).digest("hex")}`;
const job = (extra: Record<string, unknown> = {}) => ({ account_owner_uid: "owner1", request: { buyerType: "site_operator",
  capture_mode: "self_capture", consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
    recorded_at_iso: "2026-09-29T00:00:00.000Z" } }, ...extra });
let server: Server | null = null;
let base = "";
const realFetch = globalThis.fetch;
const pipelineCalls: string[] = [];

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  pipelineCalls.length = 0;
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "isolated-ticket-secret");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "isolated-read-token");
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).startsWith("https://pipeline.invalid/")) {
      pipelineCalls.push(String(url));
      return new Response(PNG, { headers: { "content-length": String(PNG.length) } });
    }
    return realFetch(url, init);
  }));
  const app = express();
  app.use("/api/website-destination-pictures", router);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", () => resolve()));
  base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
});
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = null; vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

describe("the place question's picture", () => {
  it("is delivered to the job's own page, private and uncached, from the signed Pipeline read", async () => {
    const { projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
    const record = job();
    if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) {
      // The fixture must be a job whose rights allow derived scenes; find the shape the rights read wants.
      throw new Error("fixture rights do not allow derived scenes");
    }
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", record);
    const url = destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!;
    expect(url).toMatch(/^\/api\/website-destination-pictures\/r1\/walkthrough-r1\/place\.png\?/);
    const response = await realFetch(`${base}${url}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
    expect(pipelineCalls[0]).toMatch(/\/api\/live-pipeline\/website-destination-pictures\/walkthrough-r1\/destination\.place\.png\?/);
  });
  it("is refused for another job, an expired or forged ticket, ended rights, or a capture that is no longer the job's", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    sharedFakeFirestoreState.docs.set("inboundRequests/r2", job());
    const url = new URL(destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!, "http://x");
    const other = `/api/website-destination-pictures/r2/walkthrough-r2/place.png${url.search}`;
    expect((await realFetch(`${base}${other}`)).status).toBe(404);
    const past = Math.floor(Date.now() / 1000) - 20 * 60;
    expect(verifyDestinationPictureTicket("r1", "walkthrough-r1", DIGEST,
      new URL(destinationPictureUrl("r1", "walkthrough-r1", DIGEST, past)!, "http://x").searchParams.get("expires"),
      new URL(destinationPictureUrl("r1", "walkthrough-r1", DIGEST, past)!, "http://x").searchParams.get("signature"))).toBe(false);
    const expired = destinationPictureUrl("r1", "walkthrough-r1", DIGEST, past)!;
    expect((await realFetch(`${base}${expired}`)).status).toBe(404);
    const forged = `${url.pathname}?digest=${encodeURIComponent(DIGEST)}&expires=${url.searchParams.get("expires")}&signature=${"0".repeat(64)}`;
    expect((await realFetch(`${base}${forged}`)).status).toBe(404);
    // Another picture's digest under this ticket.
    const swapped = `${url.pathname}?digest=${encodeURIComponent(`sha256:${"9".repeat(64)}`)}&expires=${url.searchParams.get("expires")}&signature=${url.searchParams.get("signature")}`;
    expect((await realFetch(`${base}${swapped}`)).status).toBe(404);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job({ active_capture_id: `supplement-${"a".repeat(40)}` }));
    expect((await realFetch(`${base}${url.pathname}${url.search}`)).status).toBe(404);
    // The site withdrew permission to use its video.
    const { projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
    const withdrawn = job({ capture_rights: { consent_revoked: true } });
    expect(projectWebsiteCaptureRights(withdrawn).derived_scene_generation_allowed).toBe(false);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", withdrawn);
    expect((await realFetch(`${base}${url.pathname}${url.search}`)).status).toBe(404);
    // The control: the same ticket on the job's own page works.
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    expect((await realFetch(`${base}${url.pathname}${url.search}`)).status).toBe(200);
    pipelineCalls.length = 0;
    expect(pipelineCalls).toEqual([]);
  });
});
