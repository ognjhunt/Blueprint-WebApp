// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
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
