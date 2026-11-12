// @vitest-environment node
/**
 * The place question's picture (2026-11-12): a frame of the site's private video, delivered only to the job's own page
 * through a 15-minute ticket for exactly this job, capture and picture; every request re-reads the job's rights, its
 * current capture, its run, and its CURRENT place question, and the bytes are checked as a bounded PNG of that digest.
 */
import { createHash } from "node:crypto";
import { createServer, request as httpRequest, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

const seam = vi.hoisted(() => ({ question: null as unknown }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/websitePreparationStatus", () => ({
  loadCurrentTaskTargetChoiceQuestion: async () => seam.question,
}));
const { destinationPictureUrl, fetchDestinationPicture, MAX_DESTINATION_PICTURE_BYTES, verifyDestinationPictureTicket } =
  await import("../utils/websiteDestinationPicture");
const { default: router } = await import("../routes/website-destination-pictures");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("picture bytes")]);
const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const DIGEST = sha(PNG);
const placeQuestion = (digest = DIGEST) => ({ selector: {}, question: { kind: "task_destination_choice", picture: { png_sha256: digest, frame_id: "f" } } });
const job = (extra: Record<string, unknown> = {}) => ({ account_owner_uid: "owner1", request: { buyerType: "site_operator",
  capture_mode: "self_capture", consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
    recorded_at_iso: "2026-09-29T00:00:00.000Z" } }, ...extra });
function closed(requestId: string, captureId: string) {
  const value = { schema_version: "website_run_closure.v1", request_id: requestId, capture_id: captureId,
    decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: `sha256:${"1".repeat(64)}`,
    closed_at_iso: "2026-11-12T00:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true,
    physical_validation: false };
  return { website_run_closures: { [captureId]: { ...value, closure_digest: crossRuntimeDigest(value) } } };
}
let server: Server | null = null;
let base = "";
const realFetch = globalThis.fetch;
let pipelineBody: () => Response = () => new Response(PNG, { headers: { "content-length": String(PNG.length) } });
let pipelineCalls = 0;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  pipelineCalls = 0;
  seam.question = placeQuestion();
  pipelineBody = () => new Response(PNG, { headers: { "content-length": String(PNG.length) } });
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "isolated-ticket-secret");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "isolated-read-token");
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).startsWith("https://pipeline.invalid/")) { pipelineCalls++; return pipelineBody(); }
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
const open = (url: string, headers: Record<string, string> = { "sec-fetch-dest": "image" }) => realFetch(`${base}${url}`, { headers });

describe("the place question's picture route", () => {
  it("is delivered to the job's own page, private and uncached, from the signed Pipeline read", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    const url = destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!;
    expect(url).toMatch(/^\/api\/website-destination-pictures\/r1\/walkthrough-r1\/place\.png\?digest=sha256%3A[a-f0-9]{64}&expires=\d+&signature=[a-f0-9]{64}$/);
    const response = await open(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
    expect(pipelineCalls).toBe(1);
  });
  it("is refused for another job, an expired, forged or swapped ticket, ended rights, or a capture no longer the job's", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    sharedFakeFirestoreState.docs.set("inboundRequests/r2", job());
    const url = new URL(destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!, "http://x");
    expect((await open(`/api/website-destination-pictures/r2/walkthrough-r2/place.png${url.search}`)).status).toBe(404);
    const past = Math.floor(Date.now() / 1000) - 20 * 60;
    expect((await open(destinationPictureUrl("r1", "walkthrough-r1", DIGEST, past)!)).status).toBe(404);
    expect(verifyDestinationPictureTicket("r1", "walkthrough-r1", DIGEST, url.searchParams.get("expires"), "0".repeat(64))).toBe(false);
    expect((await open(`${url.pathname}?digest=${encodeURIComponent(DIGEST)}&expires=${url.searchParams.get("expires")}&signature=${"0".repeat(64)}`)).status).toBe(404);
    expect((await open(`${url.pathname}?digest=${encodeURIComponent(`sha256:${"9".repeat(64)}`)}&expires=${url.searchParams.get("expires")}&signature=${url.searchParams.get("signature")}`)).status).toBe(404);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job({ active_capture_id: `supplement-${"a".repeat(40)}` }));
    expect((await open(`${url.pathname}${url.search}`)).status).toBe(404);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job({ capture_rights: { consent_revoked: true } }));
    expect((await open(`${url.pathname}${url.search}`)).status).toBe(404);
    expect(pipelineCalls).toBe(0);
  });
  it("refuses being opened as a page in a tab", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    const url = destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!;
    // Sent raw: fetch drops the browser's own Sec-Fetch headers.
    const raw = (headers: Record<string, string>) => new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${base}${url}`, { headers }, response => { response.resume(); resolve(response.statusCode ?? 0); });
      request.on("error", reject); request.end();
    });
    expect(await raw({ "sec-fetch-dest": "document" })).toBe(403);
    expect(await raw({ "sec-fetch-mode": "navigate" })).toBe(403);
    expect(await raw({ "sec-fetch-dest": "image" })).toBe(200);
    pipelineCalls = 0;
    expect(await raw({ "sec-fetch-dest": "document" })).toBe(403);
    expect(pipelineCalls).toBe(0);
  });
  it("serves only the CURRENT place question's picture: a replaced or withdrawn question's stops at once", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    const url = destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!;
    seam.question = placeQuestion(`sha256:${"8".repeat(64)}`);
    expect((await open(url)).status).toBe(404);
    seam.question = null;
    expect((await open(url)).status).toBe(404);
    seam.question = { selector: {}, question: { kind: "task_target_choice" } };
    expect((await open(url)).status).toBe(404);
    seam.question = placeQuestion();
    expect((await open(url)).status).toBe(200);
  });
  it("stops at once when the site closes the job's run, whatever ticket was issued before", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job());
    const url = destinationPictureUrl("r1", "walkthrough-r1", DIGEST)!;
    expect((await open(url)).status).toBe(200);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", job(closed("r1", "walkthrough-r1")));
    expect((await open(url)).status).toBe(404);
  });
});

describe("the picture's own checks on the bytes", () => {
  const get = (response: () => Response, digest = DIGEST) => {
    pipelineBody = response;
    return fetchDestinationPicture("r1", "walkthrough-r1", digest);
  };
  it("accepts exactly the PNG the digest names", async () => {
    await expect(get(() => new Response(PNG))).resolves.toEqual(PNG);
  });
  it("refuses bytes that are not a PNG, even with their own digest", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
    await expect(get(() => new Response(jpeg), sha(jpeg))).rejects.toThrow("website_destination_picture_mismatch");
  });
  it("refuses a PNG whose sha256 is not the ticket's", async () => {
    const other = Buffer.concat([PNG, Buffer.from("x")]);
    await expect(get(() => new Response(other))).rejects.toThrow("website_destination_picture_mismatch");
  });
  it("refuses a body over the limit, with no length declared", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_DESTINATION_PICTURE_BYTES)]);
    await expect(get(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(big)); controller.close(); } })),
      sha(big))).rejects.toThrow("website_destination_picture_unavailable");
  });
  it("refuses a declared length over the limit before reading it", async () => {
    await expect(get(() => new Response(PNG, { headers: { "content-length": String(MAX_DESTINATION_PICTURE_BYTES + 1) } })))
      .rejects.toThrow("website_destination_picture_unavailable");
  });
});
