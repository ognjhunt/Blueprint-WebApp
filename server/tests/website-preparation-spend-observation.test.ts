// @vitest-environment node
// Real signed route, owned in-memory records, no provider or production reads.
import express from "express";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crossRuntimeDigest as digest } from "../utils/crossRuntimeCanonical";
import { assertWebsiteRunOpen } from "../utils/websiteRunClosure";
import { ownerClosure } from "./fixtures/website-run-closure";

vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/rate-limit-redis", () => ({ createRateLimitRedisStore: () => undefined }));
const state = vi.hoisted(() => ({ rows: new Map<string, any>(), reads: [] as string[], writes: [] as string[] }));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (key: string): any => ({ key, get: async () => {
    state.reads.push(key);
    return { exists: state.rows.has(key), data: () => structuredClone(state.rows.get(key)) };
  } });
  const write = (operation: string) => () => { state.writes.push(operation); throw new Error("read_only_write_attempt"); };
  return { default: { firestore: { FieldValue: {} } }, dbAdmin: {
    collection: (collection: string) => ({ doc: (id: string) => reference(`${collection}/${id}`) }),
    runTransaction: async (callback: any) => callback({ get: (ref: any) => ref.get(),
      create: write("create"), update: write("update"), set: write("set"), delete: write("delete") }),
  } };
});

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const REQUEST = "inboundRequests/req1";
const secret = "offline-funding-observation-secret";
const realFetch = globalThis.fetch;
let server: Server | undefined;
let base: string;
const spend = () => ({ task_context_digest: sha("a"), allocation_binding_digest: sha("b"),
  resource_class: "gpu_render", provider: "vast", maximum_cost_usd: 4, request_count: 1 });
function seed(reserved = true) {
  const authority = { schema_version: "website_scene_sponsorship.v1", request_id: "req1", scene_id: "site-req1",
    capture_id: "walkthrough-req1", task_context_digest: sha("a"), expires_at_epoch: 1 };
  const grant = { ...authority, authority_digest: digest(authority) };
  const command = spend();
  const admission = { ...command, schema_version: "paid_lane_admission.v1", status: "admitted", blockers: [],
    external_disclosure_allowed: true, sponsorship_digest: grant.authority_digest, expires_at_epoch: 1 };
  state.rows.set(REQUEST, { website_scene_sponsorship: grant,
    // Expiry/revocation/closure end dispatch, not exact historical accounting.
    request: { consent_revoked: true }, website_run_closures: { "walkthrough-req1": ownerClosure() },
    website_preparation_reservations: reserved ? { ["b".repeat(64)]: { command_digest: digest(command), admission } } : {} });
  return { command, admission };
}
async function post(overrides: Record<string, unknown> = {}, options: { capture?: string; signedBody?: string; sign?: boolean } = {}) {
  const body = JSON.stringify({ request_id: "req1", scene_id: "site-req1", spend: spend(), create: false, ...overrides });
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.sign !== false) {
    headers["X-Blueprint-Pipeline-Timestamp"] = timestamp;
    headers["X-Blueprint-Pipeline-Signature"] = createHmac("sha256", secret)
      .update(`${timestamp}.${options.signedBody ?? body}`).digest("hex");
  }
  const response = await realFetch(`${base}/creator-captures/${options.capture ?? "walkthrough-req1"}/preparation-spend`,
    { method: "POST", headers, body });
  return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
}
beforeEach(async () => {
  state.rows.clear(); state.reads.length = 0; state.writes.length = 0;
  vi.stubEnv("PIPELINE_SYNC_TOKEN", secret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "");
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { (req as any).rawBody = bytes.toString("utf8"); } }));
  app.use((await import("../routes/internal-capture-worlds")).default);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});

it("reads an exact legacy reservation after source expiry/revocation without reserving or granting dispatch", async () => {
  const { command, admission } = seed();
  expect(() => assertWebsiteRunOpen(state.rows.get(REQUEST), "req1", "walkthrough-req1")).toThrow("website_run_closed_by_owner");
  const before = structuredClone([...state.rows]);
  const result = await post();
  expect(result.status).toBe(200);
  expect(result.cache).toBe("no-store");
  expect(result.body).toEqual({ schema_version: "website_preparation_spend_observation.v1", request_id: "req1",
    scene_id: "site-req1", capture_id: "walkthrough-req1", command_digest: digest(command),
    allocation_binding_digest: command.allocation_binding_digest, status: "reserved", dispatch_authorized: false,
    observed_at_epoch: expect.any(Number), admission });
  // Independently generated by Python rfc8785 + hashlib, including numeric values.
  expect(result.body.command_digest).toBe("sha256:1fddeea3827404ca48fca90d6e1d966d36291408fea3ce55100d620051dedc8e");
  expect([...state.rows]).toEqual(before);
  expect(state.writes).toEqual([]);
});

it("returns not_reserved only from an exact no-create lookup, without a cancellation or pending-RPC fence", async () => {
  const { command } = seed(false);
  const before = structuredClone([...state.rows]);
  const result = await post();
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ schema_version: "website_preparation_spend_observation.v1", request_id: "req1",
    scene_id: "site-req1", capture_id: "walkthrough-req1", command_digest: digest(command),
    allocation_binding_digest: command.allocation_binding_digest, status: "not_reserved", dispatch_authorized: false,
    observed_at_epoch: expect.any(Number) });
  expect(result.body).not.toHaveProperty("admission");
  expect(result.body).not.toHaveProperty("reservation_fenced");
  expect([...state.rows]).toEqual(before);
  expect(state.writes).toEqual([]);
});

it("reads new exact identity metadata after the mutable source projection changes", async () => {
  const { command } = seed();
  const record = state.rows.get(REQUEST);
  delete record.website_scene_sponsorship;
  record.website_preparation_reservations["b".repeat(64)].observation_binding = {
    request_id: "req1", scene_id: "site-req1", capture_id: "walkthrough-req1",
    command_digest: digest(command), task_context_digest: command.task_context_digest };
  expect((await post()).body).toMatchObject({ status: "reserved", dispatch_authorized: false });
  record.website_preparation_reservations["b".repeat(64)].observation_binding.capture_id = "walkthrough-other";
  expect((await post()).body.code).toBe("website_scene_preparation_observation_source_mismatch");
  expect(state.writes).toEqual([]);
});

it("uses exact retained grant history without renewing or replacing it", async () => {
  seed();
  const record = state.rows.get(REQUEST);
  record.website_scene_sponsorship_history = [record.website_scene_sponsorship];
  delete record.website_scene_sponsorship;
  const before = structuredClone([...state.rows]);
  expect((await post()).body).toMatchObject({ status: "reserved", dispatch_authorized: false });
  expect([...state.rows]).toEqual(before);
  expect(state.writes).toEqual([]);
});

it("does not turn a not_reserved snapshot into cancellation of a later in-flight commit", async () => {
  const { command, admission } = seed(false);
  expect((await post()).body.status).toBe("not_reserved");
  // A previously in-flight create-capable transaction can still commit later.
  state.rows.get(REQUEST).website_preparation_reservations["b".repeat(64)] = { command_digest: digest(command), admission };
  expect((await post()).body).toMatchObject({ status: "reserved", dispatch_authorized: false });
  expect(state.writes).toEqual([]);
});

it("refuses unknown absence instead of treating an expired/revoked source as no reservation", async () => {
  seed(false);
  delete state.rows.get(REQUEST).website_scene_sponsorship;
  const result = await post();
  expect(result.status).toBe(409);
  expect(result.body.code).toBe("website_scene_preparation_observation_source_unknown");
  expect(result.body.status).toBeUndefined();
  expect(state.writes).toEqual([]);
});

it("reads legacy Atlas accounting only for its exact retained capture source bytes", async () => {
  seed();
  const command = { ...spend(), resource_class: "provider_reconstruction_api", provider: "world_labs_atlas", source_video_digest: sha("c") };
  const source = { kind: "site_capture_bundle", raw_bundle_digest: sha("d"), upload_completion_digest: sha("e"),
    raw_manifest_uri: "gs://offline/scenes/site-req1/captures/walkthrough-req1/raw/manifest.json" };
  const atlas = { schema_version: "website_atlas_authorization.v2", request_id: "req1", capture_id: "walkthrough-req1",
    source_video_digest: command.source_video_digest, source_video_identity: source, expires_at_epoch: 1 };
  const record = state.rows.get(REQUEST);
  delete record.website_scene_sponsorship;
  record.website_atlas_grants = { "walkthrough-req1": atlas };
  record.website_preparation_reservations["b".repeat(64)] = { command_digest: digest(command), admission: {
    ...command, schema_version: "paid_lane_admission.v1", status: "admitted", blockers: [], external_disclosure_allowed: true,
    sponsorship_digest: digest(atlas), atlas_authorization_digest: digest(atlas), expires_at_epoch: 1 } };
  const { kind: _kind, ...identity } = source;
  state.rows.set("captureUploadSessions/walkthrough-req1", { immutable_upload_identity: identity });
  expect((await post({ spend: command })).body).toMatchObject({ status: "reserved", dispatch_authorized: false });
  state.rows.get("captureUploadSessions/walkthrough-req1").immutable_upload_identity.raw_bundle_digest = sha("f");
  expect((await post({ spend: command })).body.code).toBe("website_scene_preparation_observation_source_unknown");
  expect(state.writes).toEqual([]);
});

it("returns an exact retained settlement without refreshing its admission", async () => {
  const { command } = seed();
  const settlement = { task_context_digest: command.task_context_digest,
    allocation_binding_digest: command.allocation_binding_digest, provider: "vast", allocation_status: "not_created",
    provider_create_attempted: false, provider_mutations_performed: 0, provider_instance_ids: [], provider_charge_amount_usd: 0,
    all_staged_objects_absent: true, continuing_spend_from_this_run: false, execution_result_digest: sha("1"),
    adapter_result_digest: sha("2"), teardown_receipt_digest: sha("3"), staged_object_absence_digest: sha("4"),
    watchdog_receipt_digest: sha("5"), actual_cost_usd: 0, status: "settled" };
  state.rows.get(REQUEST).website_preparation_reservations["b".repeat(64)].settlement = settlement;
  const result = await post();
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ status: "reserved", dispatch_authorized: false, settlement });
  expect(result.body.admission.expires_at_epoch).toBe(1);
  expect(state.writes).toEqual([]);
  state.rows.get(REQUEST).website_preparation_reservations["b".repeat(64)].settlement.actual_cost_usd = 1;
  expect((await post()).body.code).toBe("website_scene_preparation_observation_invalid");
  expect(state.writes).toEqual([]);
});

it.each(["cost", "task", "source", "provider"])("refuses a mismatched %s under the same allocation key", async field => {
  seed();
  const command = { ...spend(), ...(field === "cost" ? { maximum_cost_usd: 5 } : field === "task"
    ? { task_context_digest: sha("c") } : field === "source" ? { source_video_digest: sha("c") }
      : { provider: "openai", resource_class: "openai_api_candidate" }) };
  const result = await post({ spend: command });
  expect(result.status).toBe(409);
  expect(result.body.code).toBe("idempotency_conflict");
  expect(state.writes).toEqual([]);
});

it.each(["wrong_capture", "wrong_scene", "wrong_request", "unknown_source", "corrupt_ledger", "null_ledger", "null_row", "corrupt_admission"])(
  "never turns %s into absence", async damage => {
    seed();
    if (damage === "unknown_source") delete state.rows.get(REQUEST).website_scene_sponsorship;
    if (damage === "corrupt_ledger") state.rows.get(REQUEST).website_preparation_reservations = [];
    if (damage === "null_ledger") state.rows.get(REQUEST).website_preparation_reservations = null;
    if (damage === "null_row") state.rows.get(REQUEST).website_preparation_reservations["b".repeat(64)] = null;
    if (damage === "corrupt_admission") state.rows.get(REQUEST).website_preparation_reservations["b".repeat(64)].admission.maximum_cost_usd = 1;
    const result = await post(damage === "wrong_scene" ? { scene_id: "site-other" }
      : damage === "wrong_request" ? { request_id: "other", scene_id: "site-other" } : {},
    damage === "wrong_capture" ? { capture: "walkthrough-other" } : {});
    expect(result.status).toBe(409);
    expect(result.body.status).toBeUndefined();
    expect(state.writes).toEqual([]);
  });

it.each(["missing", "tampered"])("keeps the existing signed route authentication for %s authentication", async kind => {
  seed();
  const result = await post({}, kind === "missing" ? { sign: false } : { signedBody: "{}" });
  expect(result.status).toBe(401);
  expect(state.reads).toEqual([]);
  expect(state.writes).toEqual([]);
});

it("rejects create:true rather than interpreting it as a read", async () => {
  seed();
  expect((await post({ create: true })).status).toBe(400);
  expect(state.reads).toEqual([]);
  expect(state.writes).toEqual([]);
});
