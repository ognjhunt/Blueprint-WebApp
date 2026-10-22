// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true }),
}));
// The browser-upload assessment the native/Marble lane waits on is never ready here.
vi.mock("../utils/siteAssessmentPublic", () => ({ loadCurrentSiteAdvisory: vi.fn(async () => null) }));

const store = vi.hoisted(() => ({ rows: new Map<string, any>(), writes: [] as string[] }));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (key: string): any => ({ key, get: async () => snapshot(key) });
  const snapshot = (key: string): any => ({ id: key.split("/")[1], exists: store.rows.has(key),
    data: () => structuredClone(store.rows.get(key)), ref: reference(key) });
  return { dbAdmin: {
    collection: (collection: string) => ({ doc: (id: string) => reference(`${collection}/${id}`) }),
    runTransaction: async (callback: any) => callback({
      get: (ref: any) => ref.get(),
      update: (ref: any, value: Record<string, unknown>) => {
        store.writes.push(...Object.keys(value));
        store.rows.set(ref.key, { ...store.rows.get(ref.key), ...structuredClone(value) });
      },
    }),
  } };
});

import { loadWebsiteAtlasConfiguration, reserveWebsitePreparationSpend } from "../utils/websiteSceneSponsorship";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { verifyTaskEvaluationResultDownloadTicket } from "../utils/taskEvaluationResultDownloadTicket";
import { projectWebsiteAtlasPreview, websiteAtlasPreviewDownloadUrl } from "../utils/websiteAtlasPreview";

const sha = (char: string) => `sha256:${char.repeat(64)}`;
const realFetch = globalThis.fetch;
const REQUEST = "inboundRequests/req1", SESSION = "captureUploadSessions/walkthrough-req1";
const terms = {
  world_labs_atlas: { digest: sha("a"), label: "Atlas beta terms", url: "https://atlas-beta.worldlabs.ai/docs" },
  openai: { digest: sha("d"), label: "OpenAI terms", url: "https://openai.com/policies" },
  meta: { digest: sha("e"), label: "Meta terms", url: "https://example.com/terms" },
};
const policy = { schema_version: "website_atlas_grant_policy.v1", maximum_cost_usd: 2, maximum_requests: 4,
  validity_seconds: 3600, provider_retention: "account_does_not_retain",
  approval_reference: "Repo owner approved automatic consented previews 2026-10-22", approved_by: "repo-owner" };
const runtime = { schema_version: "website_atlas_runtime_policy.v1", model: "gpt-6.1-sol", maximum_review_cost_usd: .5,
  pose_input_cost_usd: .01, rgbd_view_cost_usd: .05, rate_card_reference: "https://atlas-beta.worldlabs.ai/docs/billing",
  reviewed_by: "operator", reviewed_on: "2026-10-21" };
const video = { object_name: "scenes/site-req1/captures/walkthrough-req1/raw/walkthrough.mp4",
  generation: "1761134400000001", size_bytes: 1_048_576, crc32c: "AAAAAA==" };

function upload(session: "browser" | "bundle" = "browser") {
  store.rows.set(REQUEST, { account_owner_uid: "site-owner-uid", request: { consent_attestation: { granted: true,
    statement_version: "2026-09-18.v1", recorded_at_iso: new Date(Date.now() - 60_000).toISOString() } } });
  store.rows.set("siteTaskBriefs/req1", { requestId: "req1", summary: "Pick the box", confirmedAtIso: null,
    operatorAnswers: {}, unresolved: [] });
  store.rows.set(SESSION, session === "browser"
    ? { browser_pending_delivery: { schema_version: "website_browser_pending.v1", request_id: "req1", scene_id: "site-req1",
      capture_id: "walkthrough-req1", state: "published", completed_at_iso: "2026-10-22T10:00:00.000Z", video,
      manifest: { ...video, object_name: "scenes/site-req1/captures/walkthrough-req1/raw/manifest.json", sha256: sha("9") } } }
    : { immutable_upload_identity: { raw_bundle_digest: sha("b"), upload_completion_digest: sha("c"),
      raw_manifest_uri: "gs://blueprint-8c1ca.appspot.com/scenes/site-req1/captures/walkthrough-req1/raw/manifest.json",
      verification_status: "pending_pipeline_storage_readback" } });
}
const contextDigest = () => projectWebsiteTaskContext(store.rows.get("siteTaskBriefs/req1"),
  projectWebsiteCaptureRights(store.rows.get(REQUEST)), { captureId: "walkthrough-req1" }).context_digest;
const configure = (overrides: Record<string, string> = {}) => loadWebsiteAtlasConfiguration("req1", "walkthrough-req1",
  { task_context_digest: contextDigest(), source_video_digest: sha("5"), ...overrides });
const atlasSpend = (overrides: Record<string, unknown> = {}) => ({ task_context_digest: contextDigest(),
  allocation_binding_digest: sha("1"), resource_class: "provider_reconstruction_api" as const,
  provider: "world_labs_atlas" as const, source_video_digest: sha("5"), maximum_cost_usd: 1.5, request_count: 1, ...overrides });

let server: Server | undefined;
async function app() {
  const application = express();
  application.use(express.json());
  application.use("/internal", (await import("../routes/internal-capture-worlds")).default);
  application.use("/api/website-atlas-preview-downloads", (await import("../routes/website-atlas-preview-downloads")).default);
  server = createServer(application);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
async function post(base: string, path: string, body: unknown) {
  const response = await realFetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  store.rows.clear(); store.writes.length = 0;
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify(terms));
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify(runtime));
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
});
afterEach(async () => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});

describe("automatic consented Atlas grant", () => {
  it.each([["unset", ""], ["malformed", "{"], ["over the cap", JSON.stringify({ ...policy, maximum_cost_usd: 6 })],
    ["retaining", JSON.stringify({ ...policy, provider_retention: "project_library_retention_approved" })],
    ["unknown field", JSON.stringify({ ...policy, customer_charge: true })]])(
    "changes nothing while the policy is %s", async (_label, value) => {
      vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", value);
      upload("bundle");
      await expect(configure()).rejects.toThrow("task_brief_missing");
      await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_scene_sponsorship_missing");
      store.rows.get(REQUEST).website_scene_sponsorship = { owner: { user_id: "blueprint-preparation" } };
      await expect(configure()).rejects.toThrow("website_atlas_source_consent_required");
      await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_atlas_source_consent_required");
      // The browser upload's preparation lane still waits on its assessment, as today.
      upload("browser");
      await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_assessment_preparation_pending");
      expect(store.writes).toEqual([]);
    });

  it("creates one grant from the upload's own consent, bound to the site owner and pinned source", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    const first = await configure();
    const stored = store.rows.get(REQUEST).website_atlas_grants["walkthrough-req1"];
    expect(store.rows.get(REQUEST).website_scene_sponsorship).toBeUndefined();
    expect(stored).toEqual({ schema_version: "website_atlas_authorization.v2", request_id: "req1",
      capture_id: "walkthrough-req1", source_video_digest: sha("5"),
      source_video_identity: { kind: "website_browser_video", ...video },
      capture_rights_digest: crossRuntimeDigest(projectWebsiteCaptureRights(store.rows.get(REQUEST))),
      policy_digest: crossRuntimeDigest(policy), provider_terms_reference: sha("a"),
      planner: { provider: "openai", provider_terms_reference: sha("d"), private_processing_authorized: true,
        provider_training_authorized: false, approval_reference: policy.approval_reference },
      accepted_by: "site-owner-uid", approval_reference: policy.approval_reference,
      grant_basis: "automatic_consented_preview", private_processing_authorized: true, provider_training_authorized: false,
      provider_retention: "account_does_not_retain", maximum_cost_usd: 2, maximum_requests: 4,
      created_at_epoch: expect.any(Number), expires_at_epoch: stored.created_at_epoch + 3600, claim_scope: "development_only" });
    expect(stored).not.toHaveProperty("task_context_digest");
    expect(first).toEqual({ schema_version: "website_atlas_configuration.v1",
      authority: { ...stored, authorization_digest: crossRuntimeDigest(stored) }, policy: runtime,
      reserved_or_settled_cost_usd: 0, remaining_cost_usd: 2, remaining_requests: 4,
      task_context_digest: contextDigest(), source_video_digest: sha("5"), dispatch_authorized: false });
    // Byte-stable on resume, created once, and unchanged by a task edit.
    expect(JSON.stringify((await configure()).authority)).toBe(JSON.stringify(first.authority));
    store.rows.get("siteTaskBriefs/req1").summary = "Pick the box and place it on the tray";
    const edited = await configure();
    expect(edited.task_context_digest).not.toBe(first.task_context_digest);
    expect(JSON.stringify(edited.authority)).toBe(JSON.stringify(first.authority));
    expect(store.writes).toEqual(["website_atlas_grants"]);
    // The first call pinned the Pipeline digest and the uploaded object.
    await expect(configure({ source_video_digest: sha("6") })).rejects.toThrow("website_atlas_source_consent_required");
    store.rows.get(SESSION).browser_pending_delivery.video.generation = "1761134400000002";
    await expect(configure()).rejects.toThrow("website_atlas_source_consent_required");
    expect(store.writes).toEqual(["website_atlas_grants"]);
  });

  it("refuses a changed owner, changed terms, expiry and withdrawn consent like an explicit grant", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload("bundle");
    const { authority } = await configure();
    expect(authority.source_video_identity).toEqual({ kind: "site_capture_bundle", raw_bundle_digest: sha("b"),
      upload_completion_digest: sha("c"),
      raw_manifest_uri: "gs://blueprint-8c1ca.appspot.com/scenes/site-req1/captures/walkthrough-req1/raw/manifest.json" });
    // The Pipeline's storage readback updates mutable verification fields only.
    Object.assign(store.rows.get(SESSION).immutable_upload_identity, { verification_status: "pipeline_storage_bytes_verified" });
    expect((await configure()).authority).toEqual(authority);
    store.rows.get(REQUEST).account_owner_uid = "someone-else";
    await expect(configure()).rejects.toThrow("website_atlas_source_owner_mismatch");
    store.rows.get(REQUEST).account_owner_uid = "site-owner-uid";
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms,
      world_labs_atlas: { ...terms.world_labs_atlas, digest: sha("7") } }));
    await expect(configure()).rejects.toThrow("provider_terms_not_configured_or_changed");
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms, openai: { ...terms.openai, digest: sha("7") } }));
    await expect(configure()).rejects.toThrow("website_atlas_planner_consent_required");
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify(terms));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((authority.expires_at_epoch + 1) * 1000);
    await expect(configure()).rejects.toThrow("website_atlas_consent_expired");
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_atlas_consent_expired");
    vi.useRealTimers();
    // Unsetting the policy stops every automatic grant at once.
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
    store.rows.get(REQUEST).website_scene_sponsorship = { owner: { user_id: "blueprint-preparation" } };
    await expect(configure()).rejects.toThrow("website_atlas_source_consent_required");
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    expect((await configure()).authority).toEqual(authority);
    store.rows.get(REQUEST).consent_revoked = true;
    await expect(configure()).rejects.toThrow("source_revoked");
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("source_revoked");
  });

  it("makes no grant for an unclaimed upload, an unfinished source or unconfigured terms", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    delete store.rows.get(REQUEST).account_owner_uid;
    await expect(configure()).rejects.toThrow("website_atlas_source_consent_required");
    upload();
    store.rows.get(SESSION).browser_pending_delivery.state = "held";
    await expect(configure()).rejects.toThrow("website_atlas_source_consent_required");
    upload();
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ openai: terms.openai }));
    await expect(configure()).rejects.toThrow("provider_terms_not_configured_or_changed");
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ world_labs_atlas: terms.world_labs_atlas }));
    await expect(configure()).rejects.toThrow("website_atlas_planner_consent_required");
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify(terms));
    upload();
    store.rows.get(REQUEST).request.consent_attestation.revoked_at_iso = new Date().toISOString();
    await expect(configure()).rejects.toThrow("source_revoked");
    expect(store.writes).toEqual([]);
  });

  it("keeps an exact env row first, with its retained-sponsor signer", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload("bundle");
    store.rows.get(REQUEST).website_scene_sponsorship = { owner: { user_id: "blueprint-preparation" } };
    const row = { schema_version: "website_atlas_authorization.v1", request_id: "req1", capture_id: "walkthrough-req1",
      task_context_digest: contextDigest(), source_video_digest: sha("5"), provider_terms_reference: sha("a"),
      accepted_by: "blueprint-preparation", approval_reference: "owner test", private_processing_authorized: true,
      provider_training_authorized: false, provider_retention: "project_library_retention_approved",
      maximum_cost_usd: 5, maximum_requests: 8, expires_at_epoch: Date.now() / 1000 + 600, claim_scope: "development_only",
      planner: { provider: "openai", provider_terms_reference: sha("d"), private_processing_authorized: true,
        provider_training_authorized: false, approval_reference: "owner planning" } };
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([row]));
    expect((await configure()).authority).toEqual({ ...row, authorization_digest: crossRuntimeDigest(row) });
    expect(await reserveWebsitePreparationSpend("req1", atlasSpend())).toMatchObject({ status: "admitted",
      atlas_authorization_digest: crossRuntimeDigest(row), provider_retention: "project_library_retention_approved" });
    expect(store.writes).toEqual(["website_preparation_reservations"]);
    // Without the retained sponsor an env row has no valid signer.
    delete store.rows.get(REQUEST).website_scene_sponsorship;
    await expect(configure()).rejects.toThrow("website_atlas_source_owner_mismatch");
  });
});

describe("Atlas reservations under an automatic grant", () => {
  it("admit Atlas spend within the grant without a sponsorship or the preparation assessment, and never create one", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_atlas_source_consent_required");
    expect(store.writes).toEqual([]);
    const { authority } = await configure();
    const pose = await reserveWebsitePreparationSpend("req1", atlasSpend());
    expect(pose).toMatchObject({ status: "admitted", provider: "world_labs_atlas", sponsorship_digest: authority.authorization_digest,
      atlas_authorization_digest: authority.authorization_digest, provider_terms_reference: sha("a"),
      provider_retention: "account_does_not_retain", provider_training_authorized: false,
      expires_at_epoch: authority.expires_at_epoch });
    expect(await reserveWebsitePreparationSpend("req1", atlasSpend())).toMatchObject({ status: "already_reserved" });
    const plan = await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2"),
      provider: "openai", resource_class: "openai_api_candidate", maximum_cost_usd: .4 }));
    expect(plan).toMatchObject({ status: "admitted", provider_terms_reference: sha("d"), atlas_authorization_digest: authority.authorization_digest });
    expect((await configure()).remaining_cost_usd).toBeCloseTo(.1);
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("3"), maximum_cost_usd: .2 })))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
      source_video_digest: sha("6"), maximum_cost_usd: .05 }))).rejects.toThrow("website_atlas_source_consent_required");
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
      task_context_digest: sha("8"), maximum_cost_usd: .05 }))).rejects.toThrow("website_scene_sponsorship_binding_invalid");
    expect(store.rows.get(REQUEST).website_scene_sponsorship).toBeUndefined();
    expect(Object.keys(store.rows.get(REQUEST).website_atlas_grants)).toEqual(["walkthrough-req1"]);
    // Non-Atlas preparation keeps its path: this browser upload still waits on its
    // assessment, and an upload without one still needs the existing sponsorship.
    const meta = { task_context_digest: contextDigest(), allocation_binding_digest: sha("4"),
      resource_class: "evaluator_api" as const, provider: "meta" as const, maximum_cost_usd: .05, request_count: 1 };
    await expect(reserveWebsitePreparationSpend("req1", meta)).rejects.toThrow("website_assessment_preparation_pending");
    upload("bundle");
    await expect(reserveWebsitePreparationSpend("req1", meta)).rejects.toThrow("website_scene_sponsorship_missing");
  });

  it("serves configuration and reservations over the signed Pipeline routes", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    const base = await app();
    const path = "/internal/creator-captures/walkthrough-req1";
    const configuration = await post(base, `${path}/atlas-configuration`, { request_id: "req1", scene_id: "site-req1",
      task_context_digest: contextDigest(), source_video_digest: sha("5") });
    expect(configuration.status).toBe(200);
    expect(configuration.body).toMatchObject({ schema_version: "website_atlas_configuration.v1", dispatch_authorized: false,
      authority: { grant_basis: "automatic_consented_preview", accepted_by: "site-owner-uid", provider_retention: "account_does_not_retain" } });
    const spend = await post(base, `${path}/preparation-spend`, { request_id: "req1", scene_id: "site-req1", spend: atlasSpend() });
    expect(spend).toMatchObject({ status: 200, body: { status: "admitted", atlas_authorization_digest: configuration.body.authority.authorization_digest } });
    const changed = await post(base, `${path}/atlas-configuration`, { request_id: "req1", scene_id: "site-req1",
      task_context_digest: contextDigest(), source_video_digest: sha("6") });
    expect(changed).toEqual({ status: 409, body: { code: "website_atlas_source_consent_required" } });
  });
});

function preview(overrides: Record<string, unknown> = {}) {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-req1", revision: 1,
    state: "processing", reason: null, updated_at_epoch: 1_761_134_400, bundle: null, splat_available: false,
    mesh_available: false, claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units", ...overrides };
  return { ...value, preview_digest: crossRuntimeDigest(value) };
}
const bundleBytes = Buffer.from("PK\u0003\u0004 fixture atlas preview bundle");
const bundleDigest = `sha256:${createHash("sha256").update(bundleBytes).digest("hex")}`;
const ready = (revision = 2) => preview({ revision, state: "ready", updated_at_epoch: 1_761_138_000,
  bundle: { digest: bundleDigest, size_bytes: bundleBytes.length, filename: "atlas-preview-walkthrough-req1.zip" },
  splat_available: true, mesh_available: true });

describe("Pipeline Atlas preview status", () => {
  it("accepts only strict, digest-verified, monotonic previews and only withdrawal after consent ends", async () => {
    upload();
    const base = await app();
    const path = "/internal/creator-captures/walkthrough-req1/atlas-preview";
    const push = (value: unknown, extra: Record<string, unknown> = {}) =>
      post(base, path, { request_id: "req1", scene_id: "site-req1", preview: value, ...extra });
    for (const invalid of [{ ...preview(), extra: true }, preview({ bundle: ready().bundle }), preview({ state: "ready" }),
      preview({ reason: "Upstream Detail" }), preview({ revision: 0 }), preview({ claim_ceiling: "measured" })])
      expect(await push(invalid)).toEqual({ status: 400, body: { code: "website_atlas_preview_invalid" } });
    expect(await push(preview(), { purpose: "x" })).toEqual({ status: 400, body: { code: "website_atlas_preview_invalid" } });
    expect(await push({ ...preview(), preview_digest: sha("f") })).toEqual({ status: 400, body: { code: "website_atlas_preview_digest_mismatch" } });
    expect(await post(base, path, { request_id: "req1", scene_id: "site-other", preview: preview() }))
      .toEqual({ status: 409, body: { code: "task_context_capture_mismatch" } });
    expect(await push(preview({ capture_id: "walkthrough-other" })))
      .toEqual({ status: 409, body: { code: "task_context_capture_mismatch" } });
    const first = preview();
    const accepted = { schema_version: "website_atlas_preview_acceptance.v1", accepted: true };
    expect(await push(first)).toEqual({ status: 200, body: { ...accepted, revision: 1, preview_digest: first.preview_digest } });
    expect(await push(first)).toEqual({ status: 200, body: { ...accepted, revision: 1, preview_digest: first.preview_digest } });
    expect(await push(preview({ reason: "different_bytes" }))).toEqual({ status: 409, body: { code: "idempotency_conflict" } });
    expect(await push(ready())).toEqual({ status: 200, body: { ...accepted, revision: 2, preview_digest: ready().preview_digest } });
    expect(await push(first)).toEqual({ status: 409, body: { code: "website_atlas_preview_stale" } });
    expect(store.rows.get(REQUEST).website_atlas_previews).toEqual({ "walkthrough-req1": ready() });
    store.rows.get(REQUEST).consent_revoked = true;
    expect(await push(preview({ revision: 3, state: "failed", reason: "provider_failed" })))
      .toEqual({ status: 409, body: { code: "source_revoked" } });
    const withdrawn = preview({ revision: 3, state: "withdrawn" });
    expect(await push(withdrawn)).toEqual({ status: 200, body: { ...accepted, revision: 3, preview_digest: withdrawn.preview_digest } });
    expect(store.rows.get(REQUEST).website_atlas_previews["walkthrough-req1"]).toEqual(withdrawn);
    expect(await post(base, "/internal/creator-captures/walkthrough-req2/atlas-preview", { request_id: "req2", scene_id: "site-req2",
      preview: preview({ capture_id: "walkthrough-req2" }) })).toEqual({ status: 404, body: { code: "website_atlas_preview_request_missing" } });
  });

  it("projects plain owner copy, never a reason code, and nothing once consent ends", () => {
    upload();
    const record = store.rows.get(REQUEST);
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
    record.website_atlas_previews = { "walkthrough-req1": preview({ state: "failed", reason: "atlas_input_rejected" }) };
    const failed = projectWebsiteAtlasPreview(record);
    expect(failed).toMatchObject({ state: "failed", statusText: "A 3D preview could not be made from this recording.",
      downloadAvailable: false, developmentOnly: true, label: "3D preview (beta, unscaled)" });
    expect(JSON.stringify(failed)).not.toContain("atlas_input_rejected");
    record.website_atlas_previews["walkthrough-req1"] = ready();
    expect(projectWebsiteAtlasPreview(record)).toEqual({ captureId: "walkthrough-req1", label: "3D preview (beta, unscaled)",
      state: "ready", statusText: "Your 3D preview is ready to download.", developmentOnly: true, splatAvailable: true,
      meshAvailable: true, sizeBytes: bundleBytes.length, updatedAtIso: new Date(1_761_138_000_000).toISOString(),
      downloadAvailable: true });
    // A tampered entry is never shown.
    record.website_atlas_previews["walkthrough-req1"] = { ...ready(), mesh_available: false };
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
    record.website_atlas_previews["walkthrough-req1"] = ready();
    record.consent_revoked = true;
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
  });
});

describe("owner Atlas preview download", () => {
  beforeEach(() => {
    vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  });
  const pipeline = (headers: Record<string, string> = {}, bytes = bundleBytes) => vi.fn(async (_url: unknown, _init?: RequestInit) =>
    new Response(bytes, { status: 200, headers: { "content-type": "application/zip", "content-length": String(bytes.length),
      "content-disposition": 'attachment; filename="atlas-preview-walkthrough-req1.zip"',
      "x-blueprint-artifact-sha256": bundleDigest, "cache-control": "private, no-store", ...headers } }));

  it("streams the whole verified bundle through a signed Pipeline read, without forwarding Range", async () => {
    upload();
    store.rows.get(REQUEST).website_atlas_previews = { "walkthrough-req1": ready() };
    const origin = pipeline();
    vi.stubGlobal("fetch", origin);
    const base = await app();
    const url = websiteAtlasPreviewDownloadUrl("req1", "walkthrough-req1")!;
    expect(url).toMatch(/^\/api\/website-atlas-preview-downloads\/req1\/walkthrough-req1\?expires=\d+&signature=[0-9a-f]{64}$/);
    const response = await realFetch(`${base}${url}`, { headers: { range: "bytes=0-3" } });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bundleBytes);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="atlas-preview-walkthrough-req1.zip"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-blueprint-artifact-verification")).toBe("sha256-on-completion");
    const [target, init] = origin.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string> }];
    expect(String(target)).toBe("https://pipeline.invalid/api/live-pipeline/website-atlas-previews/walkthrough-req1/bundle"
      + `?request_id=req1&digest=${encodeURIComponent(bundleDigest)}`);
    expect(init.redirect).toBe("error");
    expect(init.headers).not.toHaveProperty("range");
    const signed = init.headers;
    expect(signed["x-blueprint-pipeline-client-id"]).toBe("blueprint-webapp");
    expect(signed["x-blueprint-pipeline-signature"]).toBe(`sha256=${createHmac("sha256", "fixture-read-token")
      .update(`${signed["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${signed["x-blueprint-pipeline-nonce"]}.`).digest("hex")}`);
    // Domain-separated: the same fields never sign a result-download URL.
    const ticket = new URL(url, "https://webapp.invalid").searchParams;
    expect(verifyTaskEvaluationResultDownloadTicket("website_atlas_preview", "req1", ticket.get("expires"), ticket.get("signature"))).toBe(false);
  });

  it("refuses bad tickets, withdrawn consent, unready previews and mismatched bytes", async () => {
    upload();
    store.rows.get(REQUEST).website_atlas_previews = { "walkthrough-req1": ready() };
    const origin = pipeline({ "x-blueprint-artifact-sha256": sha("0") });
    vi.stubGlobal("fetch", origin);
    const base = await app();
    const url = websiteAtlasPreviewDownloadUrl("req1", "walkthrough-req1")!;
    const read = async (target: string) => {
      const response = await realFetch(`${base}${target}`);
      return { status: response.status, body: await response.json() };
    };
    expect((await read(url.replace(/signature=([0-9a-f])/, (_match, first: string) =>
      `signature=${first === "0" ? "1" : "0"}`))).status).toBe(404);
    expect((await read(url.replace("/req1/", "/req2/"))).status).toBe(404);
    expect((await read(websiteAtlasPreviewDownloadUrl("req1", "walkthrough-other")!)).status).toBe(404);
    expect(origin).not.toHaveBeenCalled();
    expect(await read(url)).toEqual({ status: 502,
      body: { error: "3D preview stream was interrupted or failed integrity verification; retry the download" } });
    store.rows.get(REQUEST).website_atlas_previews["walkthrough-req1"] = preview({ revision: 3 });
    expect((await read(url)).status).toBe(404);
    store.rows.get(REQUEST).website_atlas_previews["walkthrough-req1"] = ready(4);
    store.rows.get(REQUEST).consent_revoked = true;
    expect((await read(url)).status).toBe(404);
    expect(origin).toHaveBeenCalledTimes(1);
  });
});

it("charges source-bound SAM/review auxiliaries to Atlas while retaining their own disclosure", async () => {
  const { websiteSceneSponsorship } = await import("../utils/websiteSceneSponsorship");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
  const nativePolicy = { owner: { user_id: "site-owner-uid", organization_id: "blueprint" },
    upstream_max_spend_usd: 50, native_max_spend_usd: 50, max_total_spend_usd: 100,
    max_paid_attempts: 32, ttl_seconds: 3600, provider_terms_reference: sha("e") };
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify(nativePolicy));
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms,
    google: { digest: sha("e"), label: "Accepted auxiliary terms", url: "https://example.com/terms" } }));
  upload();
  store.rows.get("siteTaskBriefs/req1").confirmedAtIso = new Date().toISOString();
  store.rows.get(REQUEST).site_task_triage = { disposition: "qualified" };
  store.rows.get(REQUEST).website_scene_sponsorship = websiteSceneSponsorship({ requestId: "req1",
    record: store.rows.get(REQUEST), brief: store.rows.get("siteTaskBriefs/req1"), now: Date.now() / 1000 });
  await configure();
  await reserveWebsitePreparationSpend("req1", atlasSpend());
  const auxiliary = await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .4 }));
  expect(auxiliary).toMatchObject({ status: "admitted", provider: "meta", provider_terms_reference: sha("e"),
    provider_training_authorized: false, atlas_authorization_digest: expect.stringMatching(/^sha256:/) });
  expect((await configure()).remaining_cost_usd).toBeCloseTo(.1);
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("3"),
    provider: "google", resource_class: "evaluator_api", maximum_cost_usd: .2 })))
    .rejects.toThrow("website_scene_preparation_budget_exhausted");
  // Atlas's still-valid grant cannot renew the auxiliary provider's expired consent.
  store.rows.get(REQUEST).website_scene_sponsorship.expires_at_epoch = 1;
  const authority = store.rows.get(REQUEST).website_scene_sponsorship;
  const { authority_digest: _old, ...payload } = authority;
  authority.authority_digest = crossRuntimeDigest(payload);
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .01 }))).rejects.toThrow("consent_expired");
});
