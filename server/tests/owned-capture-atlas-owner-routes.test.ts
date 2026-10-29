// @vitest-environment node
import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ execute: vi.fn(), retry: vi.fn(), inspect: vi.fn(), bundle: vi.fn(), configuration: vi.fn(), stream: vi.fn() }));
vi.mock("../utils/ownedCaptureAtlasExecution", () => ({ executeOwnedAtlas: native.execute,
  retryOwnedAtlas: native.retry, inspectOwnedAtlas: native.inspect, ownedAtlasBundleRequest: native.bundle }));
vi.mock("../utils/ownedCaptureAtlasPreparation", () => ({ loadOwnedCaptureAtlasConfiguration: native.configuration }));
vi.mock("../utils/taskEvaluationResultArtifactProxy", () => ({ streamVerifiedPipelineArtifact: native.stream }));
import { ownedCaptureAtlasExecutionRouter } from "../routes/owned-capture-atlas";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-plan.json", import.meta.url), "utf8"));
const wire = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-execution.json", import.meta.url), "utf8"));
let record: any, execution: any, owner: string, origin: string, server: Server;
const endpoint = () => `${origin}/captures/${record.session_id}/reconstructions/atlas/${fixture.plan.plan_id}`;
const executeBody = { schema_version: "capture_owned_atlas_execute_command.v1", idempotency_key: "owned-execution-1" };
const post = (body = executeBody) => fetch(endpoint() + "/execute", { method: "POST",
  headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(async () => {
  vi.clearAllMocks(); record = structuredClone(fixture.session); owner = record.owner_user_id;
  record.pipeline_owned_atlas_preparation = { schema_version: "capture_owned_atlas_preparation_control.v1",
    plans: { [fixture.plan.plan_id]: fixture.plan }, requests: {} };
  execution = structuredClone(wire.execution);
  native.execute.mockImplementation(async () => execution); native.inspect.mockImplementation(async () => execution);
  native.retry.mockImplementation(async () => execution);
  native.configuration.mockResolvedValue({ grant_creation_allowed: false });
  native.bundle.mockReturnValue({ url: new URL("https://pipeline.example.test/reconstructions/atlas-bundle"),
    headers: { "content-type": "application/json", "x-blueprint-pipeline-signature": "fixture" }, body: "signed-owner-target" });
  native.stream.mockImplementation(async ({ res }) => { res.status(200).send("verified fixture bytes"); });
  const app = express(); app.use(express.json());
  app.use("/captures/:sessionId/reconstructions/atlas", ownedCaptureAtlasExecutionRouter({
    authenticatedUser: () => ({ uid: owner }),
    readOwnedSession: async (id, uid) => ({ status: id === record.session_id && uid === record.owner_user_id ? 200 : 404,
      record: id === record.session_id && uid === record.owner_user_id ? record : undefined }),
  }));
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

it("queues from the actual retained owner plan using a noncreating configuration read", async () => {
  const response = await post(); expect(response.status).toBe(200);
  expect(native.configuration).toHaveBeenCalledWith(record.session_id, { plan_id: fixture.plan.plan_id,
    task_context_digest: fixture.plan.source_context.context_digest, source_video_digest: fixture.plan.source_video_digest });
  expect(native.execute).toHaveBeenCalledWith(fixture.plan, owner, executeBody.idempotency_key);
  expect((await response.json() as any).execution).toEqual(execution);
  expect(record.request).toEqual(fixture.session.request);
});

it.each(["unauthenticated", "other_owner", "revoked", "task_changed", "unapproved"])(
  "does not queue %s sources", async change => {
    if (change === "unauthenticated") owner = "";
    if (change === "other_owner") owner = "different-owner";
    if (change === "revoked") record.capture_access = { future_processing_allowed: false };
    if (change === "task_changed") record.request.known_task_specification.description = "A simpler task";
    if (change === "unapproved") native.configuration.mockRejectedValue(new Error("owned_capture_atlas_authorization_required"));
    const response = await post(); expect([401, 404, 409, 410]).toContain(response.status);
    expect(native.execute).not.toHaveBeenCalled(); expect(native.stream).not.toHaveBeenCalled();
  });

it("rejects client-supplied owner, source or provider grant fields", async () => {
  const response = await post({ ...executeBody, owner_user_id: "forged" } as any);
  expect(response.status).toBe(400); expect(native.configuration).not.toHaveBeenCalled();
  expect(native.execute).not.toHaveBeenCalled();
});

it("requires a distinct explicit retry command while retaining the existing noncreating allowance", async () => {
  const url = endpoint() + "/retry", init = { method: "POST", headers: { "content-type": "application/json" } };
  expect((await fetch(url, { ...init, body: JSON.stringify(executeBody) })).status).toBe(400);
  expect(native.retry).not.toHaveBeenCalled();
  const response = await fetch(url, { ...init, body: JSON.stringify({
    schema_version: "capture_owned_atlas_retry_command.v1", idempotency_key: "owned-retry-1" }) });
  expect(response.status).toBe(200); expect(native.retry).toHaveBeenCalledWith(fixture.plan, owner, "owned-retry-1");
  expect(native.execute).not.toHaveBeenCalled(); expect(native.configuration).toHaveBeenCalledTimes(1);
});

it("inspects without creating/rechecking a processing grant and does not advertise a partial bundle", async () => {
  const response = await fetch(endpoint()); expect(response.status).toBe(200);
  expect((await response.json() as any).download_available).toBe(false);
  expect(native.inspect).toHaveBeenCalledWith(fixture.plan, owner);
  expect(native.configuration).not.toHaveBeenCalled();
  expect((await fetch(endpoint() + "/bundle")).status).toBe(409);
  expect(native.bundle).not.toHaveBeenCalled(); expect(native.stream).not.toHaveBeenCalled();
});

it("delivers a ready bundle through the same digest verifier using signed POST with Range disabled", async () => {
  execution.state = "ready"; execution.bundle = { digest: "sha256:" + "7".repeat(64), size_bytes: 22,
    filename: "fixture.zip", manifest_digest: "sha256:" + "8".repeat(64) };
  const response = await fetch(endpoint() + "/bundle", { headers: { range: "bytes=0-1" } });
  expect(response.status).toBe(200); expect(native.bundle).toHaveBeenCalledWith(fixture.plan.plan_id, owner, execution.bundle.digest);
  expect(native.stream).toHaveBeenCalledWith(expect.objectContaining({ forwardRange: false,
    expected: { sha256: execution.bundle.digest, size_bytes: execution.bundle.size_bytes },
    originRequest: { method: "POST", body: "signed-owner-target" } }));
});
