// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import type { SiteTaskBriefRecord } from "../utils/siteTaskBrief";

const state = vi.hoisted(() => ({ authorized: true, brief: null as SiteTaskBriefRecord | null, consent: null as Record<string, unknown> | null, persisted: [] as Record<string, unknown>[] }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => state.brief }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } }, dbAdmin: {
  collection: () => ({ doc: () => ({ set: async (value: Record<string, unknown>) => { state.persisted.push(value); }, get: async () => ({ exists: true, data: () => ({ request: { consent_attestation: state.consent }, notification_request_id: "req1" }) }) }) }),
} }));
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => state.authorized ? { ok: true } : { ok: false, status: 401, code: "unauthorized" },
}));

function brief(confirmed: boolean): SiteTaskBriefRecord {
  return { requestId: "req1", summary: "Move the carton onto the pallet", proposed: [], unresolved: ["cycle"],
    captureMode: "site_walkthrough" as SiteTaskBriefRecord["captureMode"], draftedAtIso: "2026-09-19T00:00:00Z",
    draftedFrom: ["description"], confirmedAtIso: confirmed ? "2026-09-19T01:00:00Z" : null,
    confirmedBy: "private owner identity", operatorAnswers: confirmed ? { item_rigidity: "rigid" } : null,
    operatorUnknown: confirmed ? ["cycle"] : null };
}
afterEach(() => { state.authorized = true; state.brief = null; state.consent = null; state.persisted = []; });

it("binds task content and confirmation without disclosing owner identity", () => {
  const draft = projectWebsiteTaskContext(brief(false));
  const confirmed = projectWebsiteTaskContext(brief(true));
  expect(draft.confirmed).toBe(false);
  expect(confirmed.context_digest).not.toBe(draft.context_digest);
  expect(confirmed.operator_answers).toEqual({ item_rigidity: "rigid" });
  expect(JSON.stringify(confirmed)).not.toContain("private owner identity");
});

it("reads confirmation after upload and rejects unsigned or mismatched capture requests", async () => {
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express(); app.use(express.json()); app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("bind failed");
  const post = (capture = "walkthrough-req1") => fetch(`http://127.0.0.1:${address.port}/creator-captures/${capture}/task-context`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req1", scene_id: "site-req1" }),
  });
  try {
    expect((await post()).status).toBe(404);
    state.brief = brief(false);
    expect(await (await post()).json()).toMatchObject({ confirmed: false });
    state.brief = brief(true);
    const response = await post();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ confirmed: true, capture_id: "walkthrough-req1" });
    state.consent = grant;
    const allowed = await (await post()).json();
    expect(allowed.capture_rights.derived_scene_generation_allowed).toBe(true);
    state.consent = { ...grant, granted: false };
    const revoked = await (await post()).json();
    expect(revoked.capture_rights.derived_scene_generation_allowed).toBe(false);
    expect(revoked.context_digest).not.toBe(allowed.context_digest);
    expect((await post("walkthrough-other")).status).toBe(409);
    const reconstruction = await fetch(`http://127.0.0.1:${address.port}/creator-captures/walkthrough-req1/world/reconstruct`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames_prefix_uri: "gs://capture/unedited/frames" }),
    });
    expect(reconstruction.status).toBe(409);
    expect(await reconstruction.json()).toMatchObject({ code: "website_reconstruction_pipeline_owned" });
    state.authorized = false;
    expect((await post()).status).toBe(401);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

const grant = { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-19T00:00:00Z" };
it("forwards only the recorded scene-building grant, never data resale or a revoked grant", () => {
  expect(projectWebsiteCaptureRights({ request: { consent_attestation: grant } })).toMatchObject({
    derived_scene_generation_allowed: true, data_licensing_allowed: false, consent_status: "granted",
  });
  for (const record of [undefined, { request: {} }, { request: { consent_attestation: { ...grant, granted: false } } },
    { request: { consent_attestation: { ...grant, statement_version: "unknown" } } },
    { request: { consent_attestation: grant }, consent_revoked: true },
    { request: { consent_attestation: grant }, future_processing_allowed: false }]) {
    expect(projectWebsiteCaptureRights(record).derived_scene_generation_allowed).toBe(false);
  }
});


it("publishes a first visual scene without claiming evaluation readiness and rejects stale consent", async () => {
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express(); app.use(express.json()); app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("bind failed");
  state.brief = brief(true); state.consent = grant;
  const context = projectWebsiteTaskContext(state.brief, projectWebsiteCaptureRights({ request: { consent_attestation: grant } }));
  const body = { request_id: "req1", scene_id: "site-req1", task_context_digest: context.context_digest,
    world_id: "world-1", operation_id: "operation-1", model: "marble-1.1-plus",
    launch_url: "https://marble.worldlabs.ai/world/world-1", thumbnail_url: "https://cdn.example.com/thumbnail.png", pano_url: null };
  const post = (changes = {}) => fetch(`http://127.0.0.1:${address.port}/creator-captures/walkthrough-req1/visual-scene`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...changes }),
  });
  try {
    expect((await post()).status).toBe(200);
    expect(state.persisted[0]).toMatchObject({ world_reconstruction: { state: "ready", world_id: "world-1",
      assets: { launchUrl: body.launch_url, thumbnailUrl: body.thumbnail_url } }, notification_request_id: "req1" });
    expect(JSON.stringify(state.persisted)).not.toContain("simulator_ready");
    state.persisted = [];
    expect((await post({ task_context_digest: `sha256:${"0".repeat(64)}` })).status).toBe(409);
    expect((await post({ launch_url: "javascript:alert(1)" })).status).toBe(400);
    state.consent = { ...grant, granted: false };
    expect((await post()).status).toBe(409);
    state.authorized = false;
    expect((await post()).status).toBe(401);
    expect(state.persisted).toEqual([]);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

it("stores the Pipeline's execution offer only for the signed, matching capture", async () => {
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express(); app.use(express.json()); app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("bind failed");
  const offer = (patch: Record<string, unknown> = {}) => ({
    schema_version: "blueprint.agent_execution_offer.v1", scene_id: "site-req1", capture_id: "walkthrough-req1",
    capture_root: "/srv/partition/scenes/site-req1/captures/walkthrough-req1", scenario_id: "capture_observed",
    episode_count: 50, episode_specs_sha256: `sha256:${"e".repeat(64)}`, ...patch,
  });
  const post = (body: unknown, capture = "walkthrough-req1") => fetch(`http://127.0.0.1:${address.port}/creator-captures/${capture}/agent-execution-offer`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    expect((await post({ request_id: "req1", scene_id: "site-req1", offer: offer() })).status).toBe(200);
    expect(state.persisted.at(-1)).toMatchObject({ agent_execution_offer: { scenario_id: "capture_observed", episode_count: 50 } });

    // A root for another capture, or one that climbs out of the partition, is refused.
    expect((await post({ request_id: "req1", scene_id: "site-req1", offer: offer({ capture_root: "/srv/partition/scenes/site-req1/captures/other" }) })).status).toBe(409);
    expect((await post({ request_id: "req1", scene_id: "site-req1", offer: offer({ capture_root: "/srv/../etc/scenes/site-req1/captures/walkthrough-req1" }) })).status).toBe(409);
    expect((await post({ request_id: "req1", scene_id: "site-req1", offer: offer() }, "walkthrough-other")).status).toBe(409);
    state.authorized = false;
    expect((await post({ request_id: "req1", scene_id: "site-req1", offer: offer() })).status).toBe(401);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
