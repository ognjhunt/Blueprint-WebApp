// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";

const state = vi.hoisted(() => ({ configuration: vi.fn(), reserve: vi.fn(), settle: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "hermetic-time" } } },
  dbAdmin: { collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }) }) },
}));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: async () => null }));
vi.mock("../utils/ownedCaptureAtlasPreparation", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/ownedCaptureAtlasPreparation")>(),
  loadOwnedCaptureAtlasConfiguration: (...args: unknown[]) => state.configuration(...args),
  reserveOwnedCaptureAtlasSpend: (...args: unknown[]) => state.reserve(...args),
  settleOwnedCaptureAtlasSpend: (...args: unknown[]) => state.settle(...args),
}));

const secret = "hermetic-pipeline-source-control-secret";
const capture = "capture-upload-hermetic-1";
const sha = "sha256:" + "a".repeat(64);
const binding = { plan_id: "reconstruction-atlas-" + "b".repeat(24), task_context_digest: sha, source_video_digest: sha };
let server: Server, base: string;
beforeEach(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", secret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  state.configuration.mockReset().mockResolvedValue({ schema_version: "owned_capture_atlas_configuration.v1", dispatch_authorized: false });
  state.reserve.mockReset().mockResolvedValue({ status: "admitted" });
  state.settle.mockReset().mockResolvedValue({ status: "settled" });
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => {
    (req as express.Request & { rawBody?: string }).rawBody = bytes.toString("utf8");
  } }));
  app.use("/api/internal/pipeline", router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

async function post(operation: string, value: unknown, signature: "valid" | "missing" | "invalid" = "valid") {
  // Whitespace is deliberate: verification must cover the exact received bytes.
  const body = JSON.stringify(value, null, 2), timestamp = new Date().toISOString();
  return fetch(`${base}/api/internal/pipeline/owned-captures/${capture}/${operation}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(signature === "missing" ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": "sha256=" + buildPipelineSyncSignature({
        secret: signature === "valid" ? secret : "wrong-secret", timestamp, body }),
    }) }, body,
  });
}

it.each(["missing", "invalid"] as const)("refuses %s signatures before owned grant/reservation helpers", async signature => {
  expect((await post("atlas-configuration", binding, signature)).status).toBe(401);
  expect(state.configuration).not.toHaveBeenCalled(); expect(state.reserve).not.toHaveBeenCalled();
});

it("routes the exact signed owned-source binding without website/site identities", async () => {
  const response = await post("atlas-configuration", { ...binding, create: false });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(state.configuration).toHaveBeenCalledExactlyOnceWith(capture, binding);
});

it("cannot create or renew an allowance through the signed worker configuration route", async () => {
  expect((await post("atlas-configuration", { ...binding, create: true })).status).toBe(400);
  expect((await post("atlas-configuration", { ...binding, request_id: "fake-site", scene_id: "site-fake-site" })).status).toBe(400);
  expect(state.configuration).not.toHaveBeenCalled();
});

it("uses the same signed reservation route for an observed hold and a new bounded request", async () => {
  const spend = { allocation_binding_digest: "sha256:" + "c".repeat(64), task_context_digest: sha,
    source_video_digest: sha, provider: "world_labs_atlas", resource_class: "provider_reconstruction_api",
    maximum_cost_usd: 0.5, request_count: 1 };
  expect((await post("preparation-spend", { ...binding, spend, create: false })).status).toBe(200);
  expect(state.reserve).toHaveBeenLastCalledWith(capture, binding, spend, true);
  expect((await post("preparation-spend", { ...binding, spend })).status).toBe(200);
  expect(state.reserve).toHaveBeenLastCalledWith(capture, binding, spend, false);
});

it("lets only a signed retained settlement reach accounting without granting processing", async () => {
  const settlement = { allocation_binding_digest: "sha256:" + "c".repeat(64), task_context_digest: sha,
    provider: "openai", completed_request_count: 1, provider_charge_amount_usd: 0.2, usage_receipt_digest: sha };
  expect((await post("preparation-settlement", { settlement }, "invalid")).status).toBe(401);
  expect(state.settle).not.toHaveBeenCalled();
  expect((await post("preparation-settlement", { settlement })).status).toBe(200);
  expect(state.settle).toHaveBeenCalledExactlyOnceWith(capture, settlement);
  expect(state.configuration).not.toHaveBeenCalled(); expect(state.reserve).not.toHaveBeenCalled();
});
