// @vitest-environment node
/**
 * Telling the Pipeline at once when a job's permission changes (planner, 2026-11-12, 16:35Z). The call is signed like
 * the website's other calls to the Pipeline and is best effort: one call, never a throw, a slow Pipeline never delays
 * the caller, and a withdrawal makes it too. The Pipeline side is mocked at the signed-request boundary (a local server).
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { askPipelineToRecheckCapture, recheckCaptureInBackground } = await import("../utils/pipelineCompanyRecheck");

let server: Server;
let calls: Array<{ method?: string; url?: string; headers: IncomingMessage["headers"]; body: string }> = [];
let answer: (respond: (status: number, body?: string) => void) => void = respond => respond(202, '{"schema_version":"website_company_recheck.v1","accepted":true}');

beforeEach(async () => {
  calls = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      calls.push({ method: req.method, url: req.url, headers: req.headers, body });
      answer((status, text = "") => { res.writeHead(status, { "content-type": "application/json" }); res.end(text); });
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", `http://127.0.0.1:${(server.address() as { port: number }).port}`);
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-token");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("asking the Pipeline to recheck a capture", () => {
  it("posts once, signed, with an empty body, to the capture's recheck route", async () => {
    expect(await askPipelineToRecheckCapture("req-1", "walkthrough-req-1")).toBe(202);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/live-pipeline/website-company-clips/walkthrough-req-1/recheck?request_id=req-1", body: "" });
    expect(calls[0].headers["x-blueprint-pipeline-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(calls[0].headers["x-blueprint-pipeline-client-id"]).toBe("blueprint-webapp");
  });

  it.each([403, 404, 429, 500])("never throws and never retries on %s", async status => {
    answer = respond => respond(status);
    expect(await askPipelineToRecheckCapture("req-1", "walkthrough-req-1")).toBe(status);
    expect(calls).toHaveLength(1);
  });

  it("never throws when the Pipeline is unreachable or not configured, and refuses odd ids without a call", async () => {
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "http://127.0.0.1:1");
    expect(await askPipelineToRecheckCapture("req-1", "walkthrough-req-1")).toBeNull();
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "");
    expect(await askPipelineToRecheckCapture("req-1", "walkthrough-req-1")).toBeNull();
    expect(await askPipelineToRecheckCapture("../x", "walkthrough-req-1")).toBeNull();
  });

  it("does not hold the caller while a slow Pipeline answers", async () => {
    let release!: () => void;
    answer = respond => { release = () => respond(202); };
    const started = Date.now();
    recheckCaptureInBackground("req-1", "walkthrough-req-1");
    expect(Date.now() - started).toBeLessThan(50);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    release();
  });

  it("is made after a withdrawal is recorded, once", async () => {
    answer = respond => respond(202);
    state.docs.clear();
    state.docs.set("inboundRequests/req-w", { requestId: "req-w", request: { buyerType: "site_operator",
      consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: "2026-11-12T10:00:00.000Z" } } });
    const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
    const first = await recordWebsiteCaptureWithdrawal({ requestId: "req-w", requestedBy: "site", authorize: () => undefined });
    expect(first.created).toBe(true);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/live-pipeline/website-company-clips/walkthrough-req-w/recheck?request_id=req-w");
    await recordWebsiteCaptureWithdrawal({ requestId: "req-w", requestedBy: "site", authorize: () => undefined });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(calls).toHaveLength(1);
  });
});
