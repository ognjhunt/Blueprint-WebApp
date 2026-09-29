// @vitest-environment node
import { createServer, request as httpRequest, type Server } from "node:http";
import { readFileSync } from "node:fs";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { captureOwnerRawBody } from "../utils/captureOwnerRawBody";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";

const calls = vi.hoisted(() => ({ ownerReads: 0, hmacVerifies: 0,
  earlyParser: 0, globalJson: 0, captureRawBody: 0, verifiedRawBody: "" }));
vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils/pipelineSyncSecurity")>();
  return { ...original, verifyPipelineSyncRequest: (...args: Parameters<typeof original.verifyPipelineSyncRequest>) => {
    calls.hmacVerifies++;
    calls.verifiedRawBody = (args[0] as typeof args[0] & { rawBody?: string }).rawBody ?? "";
    return original.verifyPipelineSyncRequest(...args);
  } };
});
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
  app.use((req, res, next) => { calls.earlyParser++; captureOwnerRawBody(req, res, next); });
  const json = express.json({ limit: "1mb", verify: () => { calls.captureRawBody++; } });
  app.use((req, res, next) => {
    if ((req as typeof req & { captureOwnerBodyAdmitted?: boolean }).captureOwnerBodyAdmitted) return next();
    calls.globalJson++;
    return json(req, res, next);
  });
  app.use("/api/internal/pipeline", (await import("../routes/internal-capture-worlds")).default);
  app.post("/unrelated", (req, res) => res.json({ size: JSON.stringify(req.body).length }));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no_port");
  url = `http://127.0.0.1:${addr.port}${path}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { calls.ownerReads = 0; calls.hmacVerifies = 0;
  calls.earlyParser = 0; calls.globalJson = 0; calls.captureRawBody = 0;
  calls.verifiedRawBody = "";
  process.env.PIPELINE_SYNC_TOKEN = "test-secret";
  process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER = "true"; });

describe("capture owner route requires exact raw HMAC", () => {
  it("keeps the exact parser ahead of global JSON and route registration in production", () => {
    const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
    const early = source.indexOf("app.use(captureOwnerRawBody);");
    const global = source.indexOf("const defaultJsonBody = express.json(");
    const routes = source.indexOf("registerRoutes(app);");
    expect(early).toBeGreaterThan(0);
    expect(global).toBeGreaterThan(early);
    expect(routes).toBeGreaterThan(global);
    expect(source.slice(early, routes)).toContain("captureOwnerBodyAdmitted");
  });

  it("rejects every early body error before HMAC, store, or global JSON", async () => {
    const failures: Array<[string, RequestInit, number]> = [
      ["length", { method: "POST", headers: { "content-type": "application/json" }, body: " ".repeat(4097) }, 413],
      ["encoding", { method: "POST", headers: { "content-type": "application/json", "content-encoding": "gzip" }, body }, 415],
      ["charset", { method: "POST", headers: { "content-type": "application/json; charset=iso-8859-1" }, body }, 415],
      ["utf8", { method: "POST", headers: { "content-type": "application/json" }, body: Buffer.from([0x7b, 0xc3, 0x28, 0x7d]) }, 400],
      ["duplicate literal", { method: "POST", headers: { "content-type": "application/json" },
        body: body.replace('"request_id":"r1",', '"request_id":"r1", "request_id":"r1",') }, 400],
      ["duplicate escaped", { method: "POST", headers: { "content-type": "application/json" },
        body: body.replace('"request_id":"r1",', '"request_id":"r1", "request\\u005fid":"r1",') }, 400],
      ["nested", { method: "POST", headers: { "content-type": "application/json" },
        body: body.replace('"scene_id":"site-r1"', '"scene_id":{"nested":"site-r1"}') }, 400],
      ["unknown", { method: "POST", headers: { "content-type": "application/json" },
        body: body.replace('"scene_id":"site-r1",', '"scene_id":"site-r1", "other":"x",') }, 400],
      ["trailing", { method: "POST", headers: { "content-type": "application/json" }, body: `${body} true` }, 400],
      ["empty", { method: "POST", headers: { "content-type": "application/json" }, body: "" }, 400],
    ];
    for (const [name, init, status] of failures) {
      const previousParserCalls = calls.earlyParser;
      const response = await fetch(url, init);
      expect(response.status, name).toBe(status);
      expect(calls.earlyParser).toBe(previousParserCalls + 1);
      expect(calls).toMatchObject({ ownerReads: 0, hmacVerifies: 0, globalJson: 0, captureRawBody: 0 });
      expect(calls.verifiedRawBody).toBe("");
    }
    const chunkedStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(url, { method: "POST", headers: {
        "content-type": "application/json", "transfer-encoding": "chunked",
      } }, (response) => { response.resume(); response.on("end", () => resolve(response.statusCode ?? 0)); });
      request.on("error", reject);
      request.write(body.slice(0, 4));
      request.write(" ".repeat(4096));
      request.end(body.slice(4));
    });
    expect(chunkedStatus).toBe(413);
    expect(calls).toMatchObject({ ownerReads: 0, hmacVerifies: 0, globalJson: 0, captureRawBody: 0 });
    const unrelated = await fetch(url.replace(path, "/unrelated"), { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ note: "x".repeat(5000) }) });
    expect(unrelated.status).toBe(200);
    expect(calls).toMatchObject({ ownerReads: 0, hmacVerifies: 0, globalJson: 1, captureRawBody: 1 });
  });
  it("binds HMAC to the transmitted escaped, reordered bytes without global reparse", async () => {
    const original = '{ "scene_id":"site-r1", "request\\u005fid":"r1", "remaining_timeout_ms":3000, "completion_marker_generation":"90071992547409931" }';
    const timestamp = new Date().toISOString();
    const signature = buildPipelineSyncSignature({ secret: "test-secret", timestamp, body: original });
    const headers = { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-signature": signature };
    const accepted = await fetch(url, { method: "POST", headers, body: original });
    expect(accepted.status).toBe(200);
    expect(calls).toMatchObject({ ownerReads: 1, hmacVerifies: 1, globalJson: 0, captureRawBody: 0 });
    expect(calls.verifiedRawBody).toBe(original);
    expect(Buffer.from(calls.verifiedRawBody, "utf8")).toEqual(Buffer.from(original, "utf8"));
    const reserialized = await fetch(url, { method: "POST", headers,
      body: JSON.stringify(JSON.parse(original)) });
    expect(reserialized.status).toBe(401);
    expect(calls).toMatchObject({ ownerReads: 1, hmacVerifies: 2, globalJson: 0, captureRawBody: 0 });
  });
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
