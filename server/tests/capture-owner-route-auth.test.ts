// @vitest-environment node
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { captureOwnerRawBody } from "../utils/captureOwnerRawBody";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";

const calls = vi.hoisted(() => ({ ownerReads: 0 }));
vi.mock("../utils/websiteCaptureOwnerTransport", () => ({
  withWebsiteOwnerDeps: async (_ms: number, action: (deps: object) => Promise<unknown>) => action({}),
}));
vi.mock("../utils/websiteCaptureOwnerObservation", () => ({
  observeWebsiteCaptureOwner: async () => { calls.ownerReads++; return { schema_version: "website_capture_owner_observation.v1" }; },
}));

const body = '{ "request_id":"r1", "scene_id":"site-r1", "completion_marker_generation":"90071992547409931", "remaining_timeout_ms":3000 }';
const path = "/api/internal/pipeline/creator-captures/walkthrough-r1/capture-owner";
let server: Server;
let url: string;

beforeAll(async () => {
  const app = express();
  app.use(captureOwnerRawBody);
  const json = express.json({ limit: "1mb" });
  app.use((req, res, next) => (req as typeof req & { captureOwnerBodyAdmitted?: boolean }).captureOwnerBodyAdmitted
    ? next() : json(req, res, next));
  app.use("/api/internal/pipeline", (await import("../routes/internal-capture-worlds")).default);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no_port");
  url = `http://127.0.0.1:${addr.port}${path}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { calls.ownerReads = 0; process.env.PIPELINE_SYNC_TOKEN = "test-secret";
  process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER = "true"; });

describe("capture owner route requires exact raw HMAC", () => {
  it("accepts signed original whitespace and rejects a legacy bearer even when globally enabled", async () => {
    const timestamp = new Date().toISOString();
    const signature = buildPipelineSyncSignature({ secret: "test-secret", timestamp, body });
    const accepted = await fetch(url, { method: "POST", headers: { "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-signature": signature }, body });
    expect(accepted.status).toBe(200);
    expect(calls.ownerReads).toBe(1);
    const bearer = await fetch(url, { method: "POST", headers: { "content-type": "application/json",
      "x-blueprint-pipeline-token": "test-secret" }, body });
    expect(bearer.status).toBe(401);
    expect(calls.ownerReads).toBe(1);
  });
  it("rejects a changed byte and noncanonical path before any owner read", async () => {
    const timestamp = new Date().toISOString();
    const signature = buildPipelineSyncSignature({ secret: "test-secret", timestamp, body });
    const tampered = await fetch(url, { method: "POST", headers: { "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-signature": signature },
      body: body.replace('{ "request_id"', '{  "request_id"') });
    expect(tampered.status).toBe(401);
    const alias = await fetch(url.replace("walkthrough-r1", "WALKTHROUGH-r1"), { method: "POST",
      headers: { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-signature": signature }, body });
    expect(alias.status).not.toBe(200);
    expect(calls.ownerReads).toBe(0);
  });
});
