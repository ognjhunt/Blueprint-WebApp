// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ownerClosure } from "./fixtures/website-run-closure";

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
  const query = (prefix: string, limit = Infinity): any => ({
    orderBy: () => query(prefix, limit), limit: (count: number) => query(prefix, count),
    get: async () => ({ docs: [...store.rows.keys()].filter(key => key.startsWith(`${prefix}/`)
      && !key.slice(prefix.length + 1).includes("/")).sort().slice(0, limit).map(snapshot) }),
  });
  const reference = (key: string): any => ({ key, get: async () => snapshot(key),
    collection: (child: string) => query(`${key}/${child}`) });
  const snapshot = (key: string): any => ({ id: key.split("/").at(-1), exists: store.rows.has(key),
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

import { loadWebsiteAtlasConfiguration, reserveWebsitePreparationSpend, settleWebsitePreparationSpend } from "../utils/websiteSceneSponsorship";
import { websitePreparationAccounting } from "../utils/websitePreparationAccounting";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { verifyTaskEvaluationResultDownloadTicket } from "../utils/taskEvaluationResultDownloadTicket";
import { projectWebsiteAtlasPreview, websiteAtlasPreviewDownloadUrl } from "../utils/websiteAtlasPreview";
import { crc32, extractZipMember, orientPlyForViewer, viewerSettingsFromAtlasCamera, websiteAtlasPreviewViewerUrl } from "../utils/websiteAtlasPreviewView";
import { deflateRawSync } from "node:zlib";

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
const configure = (overrides: { task_context_digest?: string; source_video_digest?: string; create?: false } = {}) => loadWebsiteAtlasConfiguration("req1", "walkthrough-req1",
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
  application.use("/api/website-atlas-preview-views", (await import("../routes/website-atlas-preview-views")).default);
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
  it.each([["unset", ""], ["malformed", "{"], ["over the cap", JSON.stringify({ ...policy, maximum_cost_usd: 101 })],
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
      // A browser upload no longer waits on its assessment; like any upload it needs a sponsorship.
      upload("browser");
      await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_scene_sponsorship_missing");
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
      // Only providers whose terms are configured now; Google's are not in this fixture.
      auxiliary: { meta: { provider_terms_reference: sha("e"), private_processing_authorized: true,
        provider_training_authorized: false, approval_reference: policy.approval_reference } },
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

  it("retains a guest source grant through account setup without widening source or spending rights", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    const record=store.rows.get(REQUEST);
    delete record.account_owner_uid;
    record.capture_owner_uid="site-job-fixed-source";
    record.capture_owner_bound_at_iso="2026-10-28T00:00:00.000Z";
    const first=await configure();
    expect(first.authority.accepted_by).toBe("site-job-fixed-source");
    store.rows.get(REQUEST).account_owner_uid="verified-owner";
    store.rows.get(REQUEST).claimed_at_iso="2026-10-28T01:00:00.000Z";
    expect((await configure()).authority).toEqual(first.authority);
    store.rows.get(REQUEST).capture_owner_uid="different-source";
    await expect(configure()).rejects.toThrow("website_atlas_source_owner_mismatch");
    store.rows.get(REQUEST).capture_owner_uid="site-job-fixed-source";
    store.rows.get(REQUEST).consent_revoked=true;
    await expect(configure()).rejects.toThrow("source_revoked");
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

describe("non-authorizing Atlas configuration read", () => {
  beforeEach(() => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
  });

  it("never creates a missing grant and preserves the existing creation path", async () => {
    const before = structuredClone(store.rows.get(REQUEST));
    await expect(configure({ create: false })).rejects.toThrow("website_atlas_source_consent_required");
    expect(store.rows.get(REQUEST)).toEqual(before);
    expect(store.writes).toEqual([]);
    const created = await configure();
    expect(created.authority.maximum_cost_usd).toBe(2);
    expect(created).not.toHaveProperty("grant_creation_allowed");
    expect(store.writes).toEqual(["website_atlas_grants"]);
    store.writes.length = 0;
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ ...policy, maximum_cost_usd: 50 }));
    const read = await configure({ create: false });
    expect(read).toMatchObject({ grant_creation_allowed: false, dispatch_authorized: false,
      authority: created.authority, reserved_or_settled_cost_usd: 0, remaining_cost_usd: 2,
      capture_inference_accounting: { schema_version: "website_capture_inference_accounting.v1", request_id: "req1",
        capture_id: "walkthrough-req1", source_video_digest: sha("5"), ledger_status: "missing",
        known_usage_cost_usd: 0, unbounded_unknown_call_count: 1 } });
    expect(store.writes).toEqual([]);
  });

  it("accounts each retained hold or settlement once without exposing raw record fields", async () => {
    const { authority } = await configure();
    await reserveWebsitePreparationSpend("req1", atlasSpend());
    await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2"),
      provider: "openai", resource_class: "openai_api_candidate", maximum_cost_usd: .4 }));
    const ledger = store.rows.get(REQUEST).website_preparation_reservations;
    ledger["2".repeat(64)].settlement = { actual_cost_usd: .2, usage_receipt_digest: sha("f"), private_note: "not returned" };
    ledger["3".repeat(64)] = { admission: { task_context_digest: sha("8"), source_video_digest: sha("6"),
      allocation_binding_digest: sha("3"), provider: "openai", maximum_cost_usd: .3, request_count: 1,
      atlas_authorization_digest: sha("7"), private_note: "not returned" } };
    ledger["4".repeat(64)] = { admission: { task_context_digest: sha("8"), allocation_binding_digest: sha("4"),
      provider: "google", maximum_cost_usd: .12, request_count: 1 } };
    const before = structuredClone(store.rows.get(REQUEST));
    store.writes.length = 0;
    const read = await configure({ create: false });
    expect(read).toMatchObject({ grant_creation_allowed: false, authority,
      reserved_or_settled_cost_usd: 2, remaining_cost_usd: 0, remaining_requests: 1,
      allowance_accounting: { schema_version: "website_atlas_allowance_accounting.v1", source_scope: "request_atlas_allowance",
        settled_cost_usd: .2, held_cost_usd: 1.8, reserved_or_settled_cost_usd: 2, request_count: 3,
        external_capture_assessment_costs: "not_in_preparation_ledger" },
      native_preparation_accounting: { schema_version: "website_native_preparation_accounting.v1",
        source_scope: "request_native_preparation_ledger", held_cost_usd: .12, settled_cost_usd: 0,
        reserved_or_settled_cost_usd: .12, request_count: 1 } });
    expect(read.allowance_accounting!.reservations).toHaveLength(3);
    expect(read.allowance_accounting!.reservations[1]).toEqual({ allocation_binding_digest: sha("2"), provider: "openai",
      maximum_cost_usd: .4, settled_cost_usd: .2, accounted_cost_usd: .2, request_count: 1, status: "settled",
      task_context_digest: contextDigest(), source_video_digest: sha("5"), atlas_authorization_digest: authority.authorization_digest,
      settlement_digest: crossRuntimeDigest(ledger["2".repeat(64)].settlement) });
    expect(read.native_preparation_accounting!.reservations[0].source_video_digest).toBeNull();
    expect(JSON.stringify(read)).not.toContain("not returned");
    expect(store.rows.get(REQUEST)).toEqual(before);
    expect(store.writes).toEqual([]);
  });

  it.each(["revoked", "expired", "source", "generation", "context", "terms"])("keeps %s authority refused without any write", async kind => {
    const { authority } = await configure();
    store.writes.length = 0;
    if (kind === "revoked") store.rows.get(REQUEST).consent_revoked = true;
    if (kind === "expired") {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime((authority.expires_at_epoch + 1) * 1000);
    }
    if (kind === "generation") store.rows.get(SESSION).browser_pending_delivery.video = { ...video,
      generation: String(BigInt(video.generation) + 1n) };
    if (kind === "terms") vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms,
      world_labs_atlas: { ...terms.world_labs_atlas, digest: sha("7") } }));
    const before = structuredClone(store.rows.get(REQUEST));
    await expect(configure({ create: false, ...(kind === "source" ? { source_video_digest: sha("6") } : {}),
      ...(kind === "context" ? { task_context_digest: sha("6") } : {}) })).rejects.toThrow();
    expect(store.rows.get(REQUEST)).toEqual(before);
    expect(store.writes).toEqual([]);
  });

  it("accepts only literal create:false on the existing signed route", async () => {
    const base = await app(), path = "/internal/creator-captures/walkthrough-req1/atlas-configuration";
    const input = { request_id: "req1", scene_id: "site-req1", task_context_digest: contextDigest(), source_video_digest: sha("5") };
    expect(await post(base, path, { ...input, create: false })).toEqual({ status: 409,
      body: { code: "website_atlas_source_consent_required" } });
    for (const create of [true, "false", null, 0]) {
      expect(await post(base, path, { ...input, create })).toEqual({ status: 400, body: { code: "website_scene_request_invalid" } });
    }
    expect(store.writes).toEqual([]);
    expect((await post(base, path, input)).status).toBe(200);
    store.writes.length = 0;
    expect(await post(base, path, { ...input, create: false })).toMatchObject({ status: 200,
      body: { grant_creation_allowed: false, dispatch_authorized: false,
        allowance_accounting: { reservations: [], reserved_or_settled_cost_usd: 0 } } });
    expect(store.writes).toEqual([]);
  });

  it("refuses malformed or oversized ledgers rather than silently omit reservations", () => {
    expect(() => websitePreparationAccounting({ broken: { admission: {} } })).toThrow("website_atlas_reservation_accounting_invalid");
    expect(() => websitePreparationAccounting(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [i, {}]))))
      .toThrow("website_atlas_reservation_summary_too_large");
    const zero = websitePreparationAccounting({ ["1".repeat(64)]: { admission: { allocation_binding_digest: sha("1"),
      task_context_digest: sha("8"), provider: "openai", maximum_cost_usd: .4, request_count: 1,
      atlas_authorization_digest: sha("7") }, settlement: { actual_cost_usd: 0 } } });
    expect(zero.allowance_accounting).toMatchObject({ settled_cost_usd: 0, held_cost_usd: 0,
      reserved_or_settled_cost_usd: 0, reservations: [{ status: "settled", settled_cost_usd: 0 }] });
  });

  it("retains all 128 preparation and 64 inference rows within the bounded read transport", async () => {
    const fixturePolicy = { ...policy, approval_reference: "a".repeat(1000), approved_by: "b".repeat(200) };
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(fixturePolicy));
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify({ ...runtime, model: "m".repeat(100),
      reviewed_by: "r".repeat(200), rate_card_reference: `https://example.com/${"x".repeat(1000)}` }));
    store.rows.get(REQUEST).account_owner_uid = "o".repeat(200);
    store.rows.get(SESSION).browser_pending_delivery.video = { ...video, object_name: "v".repeat(1024) };
    const { authority } = await configure();
    const ledger = Object.fromEntries(Array.from({ length: 128 }, (_, i) => {
      const key = i.toString(16).padStart(64, "0");
      return [key, { admission: { allocation_binding_digest: `sha256:${key}`, task_context_digest: sha("8"),
        provider: "openai", source_video_digest: sha("5"), maximum_cost_usd: 1000, request_count: 32,
        ...(i < 64 ? { atlas_authorization_digest: authority.authorization_digest } : {}) },
        settlement: { actual_cost_usd: 999.999999999, usage_receipt_digest: sha("e") } }];
    }));
    store.rows.get(REQUEST).website_preparation_reservations = ledger;
    const budgetId = `budget-${humanDecisionDigest({ capture_id: "walkthrough-req1" })}`;
    store.rows.set(`captureCoverageReviews/${budgetId}`, { capture_id: "walkthrough-req1", calls: 64 });
    for (let i = 0; i < 64; i++) {
      const id = `${i.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
      store.rows.set(`captureCoverageReviews/${budgetId}/calls/${id}`, { schema_version: "capture_inference_call.v1",
        admission_token: id, request_id: "req1", capture_id: "walkthrough-req1", run_id: `site-assessment-${"a".repeat(64)}`,
        provider: "openai", model: "gpt-6.1-sol", source_digest: sha("8"), context_digest: sha("9"), state: "recorded",
        raw_usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 }, cost_estimate_usd: .0035,
        recorded_at_ms: Date.parse("2026-10-27T13:00:00Z") });
    }
    store.writes.length = 0;
    const read = await configure({ create: false });
    expect(read.allowance_accounting!.reservations).toHaveLength(64);
    expect(read.native_preparation_accounting!.reservations).toHaveLength(64);
    expect(read.capture_inference_accounting!.calls).toHaveLength(64);
    expect(read.capture_inference_accounting!.ledger_status).toBe("complete");
    const bytes = Buffer.byteLength(JSON.stringify(read), "utf8");
    expect(bytes).toBeGreaterThan(100_000);
    expect(bytes).toBeLessThanOrEqual(200_000);
    expect(store.writes).toEqual([]);
  });

  it("refuses an oversized full read without truncation or writes while preserving default configuration", async () => {
    await configure();
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify({ ...runtime, reviewed_by: "x".repeat(200_001) }));
    store.writes.length = 0;
    await expect(configure({ create: false })).rejects.toThrow("website_atlas_accounting_response_too_large");
    expect((await configure()).policy.reviewed_by).toHaveLength(200_001);
    expect(store.writes).toEqual([]);
  });
});

describe("Atlas reservations under an automatic grant", () => {
  it("fences new and reused admissions after owner closure while retaining the grant and prior ledger", async () => {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
    upload();
    await configure();
    await reserveWebsitePreparationSpend("req1", atlasSpend());
    const record = store.rows.get(REQUEST);
    record.website_run_closures = { "walkthrough-req1": ownerClosure() };
    const before = structuredClone(record);
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend())).rejects.toThrow("website_run_closed_by_owner");
    await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2") })))
      .rejects.toThrow("website_run_closed_by_owner");
    expect(store.rows.get(REQUEST)).toEqual(before);
  });
  it("still settles a previously admitted call after closure without reopening the run", async () => {
    upload();
    const record = store.rows.get(REQUEST);
    const closed = ownerClosure();
    record.website_run_closures = { "walkthrough-req1": closed };
    record.website_preparation_reservations = { ["f".repeat(64)]: { admission: { provider: "openai",
      resource_class: "openai_api_candidate", task_context_digest: contextDigest(), request_count: 1, maximum_cost_usd: 0.5 } } };
    const result = await settleWebsitePreparationSpend("req1", { provider: "openai", task_context_digest: contextDigest(),
      allocation_binding_digest: sha("f"), completed_request_count: 1, provider_charge_amount_usd: 0.1, usage_receipt_digest: sha("e") });
    expect(result).toMatchObject({ status: "settled", actual_cost_usd: 0.1 });
    expect(record.website_run_closures["walkthrough-req1"]).toEqual(closed);
  });
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
    // Non-Atlas preparation keeps its path: it needs the existing sponsorship,
    // never a finished assessment.
    const meta = { task_context_digest: contextDigest(), allocation_binding_digest: sha("4"),
      resource_class: "evaluator_api" as const, provider: "meta" as const, maximum_cost_usd: .05, request_count: 1 };
    await expect(reserveWebsitePreparationSpend("req1", meta)).rejects.toThrow("website_scene_sponsorship_missing");
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
const PLY_PROPERTIES = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2",
  "rot_0", "rot_1", "rot_2", "rot_3"];
function plyFixture(rows: number[][]) {
  // A header whose length is not a multiple of 4, as Atlas's is.
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${rows.length}\n`
    + PLY_PROPERTIES.map(name => `property float ${name}\n`).join("") + "end_header\n";
  return Buffer.concat([Buffer.from(header, "latin1"), Buffer.from(new Float32Array(rows.flat()).buffer)]);
}
const splatBytes = plyFixture([[1, 2, 3, 0.1, 0.2, 0.3, 2, -5, -5, -7, 0.9, 0.1, 0.2, 0.3]]);
const firstCamera = { extrinsics: { coordinateSystem: "rub", position: [1, 2, 3], quaternion: [0, 0, 0, 1] },
  intrinsics: { cx: 640, cy: 360, fx: 720, fy: 720, height: 720, width: 1280 } };
function zipFixture(members: { name: string; data: Buffer; deflate?: boolean }[]) {
  const locals: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const member of members) {
    const body = member.deflate ? deflateRawSync(member.data) : member.data, name = Buffer.from(member.name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(member.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(member.data), 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(member.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(member.deflate ? 8 : 0, 10);
    entry.writeUInt32LE(crc32(member.data), 16); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(member.data.length, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, name, body); central.push(entry, name); offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(members.length, 8); end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const bundleBytes = zipFixture([{ name: "atlas-scene-fixture/views/000-image.jpg", data: Buffer.from("jpeg bytes"), deflate: true },
  { name: "atlas-scene-fixture/views/000-camera.json", data: Buffer.from(JSON.stringify(firstCamera)), deflate: true },
  { name: "atlas-scene-fixture/splat/atlas_depth_splat.ply", data: splatBytes }]);
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
      state: "ready", statusText: "Your 3D preview is ready. Blueprint keeps the model for your job.", developmentOnly: true,
      splatAvailable: true, meshAvailable: true, sizeBytes: bundleBytes.length,
      updatedAtIso: new Date(1_761_138_000_000).toISOString(), downloadAvailable: false, viewAvailable: true });
    // A tampered entry is never shown.
    record.website_atlas_previews["walkthrough-req1"] = { ...ready(), mesh_available: false };
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
    record.website_atlas_previews["walkthrough-req1"] = ready();
    record.consent_revoked = true;
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
  });

  it("shows the selected update's progress instead of an older ready preview", () => {
    upload();
    const record = store.rows.get(REQUEST), child = `supplement-${"a".repeat(40)}`;
    const original = ready();
    record.active_capture_id = child;
    record.website_atlas_previews = { "walkthrough-req1": original,
      [child]: preview({ capture_id: child, state: "processing", revision: 1 }) };
    expect(projectWebsiteAtlasPreview(record)).toMatchObject({ captureId: child,
      state: "processing", downloadAvailable: false });
    expect(record.website_atlas_previews["walkthrough-req1"]).toEqual(original);
    record.consent_revoked = true;
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
  });

  it("keeps the old preview historical while a selected update has no preview yet", () => {
    upload();
    const record = store.rows.get(REQUEST);
    record.website_atlas_previews = { "walkthrough-req1": ready() };
    record.active_capture_id = `supplement-${"a".repeat(40)}`;
    expect(projectWebsiteAtlasPreview(record)).toBeNull();
    delete record.active_capture_id;
    expect(projectWebsiteAtlasPreview(record)).toMatchObject({ captureId: "walkthrough-req1", state: "ready" });
  });
});

// Owner decision 2026-10-29: Blueprint owns the reconstruction; the site may view it, never download it.
describe("owner Atlas preview download", () => {
  beforeEach(() => vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret"));

  it("serves nothing, even for a validly signed ticket to a ready preview", async () => {
    upload();
    store.rows.get(REQUEST).website_atlas_previews = { "walkthrough-req1": ready() };
    const origin = vi.fn();
    vi.stubGlobal("fetch", origin);
    const base = await app();
    const url = websiteAtlasPreviewDownloadUrl("req1", "walkthrough-req1")!;
    const response = await realFetch(`${base}${url}`);
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: "website_atlas_preview_download_retired" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(origin).not.toHaveBeenCalled();
  });
});

it("charges source-bound SAM/review auxiliaries to Atlas while retaining their own disclosure", async () => {
  const { websiteSceneSponsorship } = await import("../utils/websiteSceneSponsorship");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
  const nativePolicy = { owner: { user_id: "site-owner-uid", organization_id: "blueprint" },
    upstream_max_spend_usd: 50, native_max_spend_usd: 50, max_total_spend_usd: 100,
    max_paid_attempts: 32, ttl_seconds: 3600, provider_terms_reference: sha("e") };
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify(nativePolicy));
  upload();
  store.rows.get("siteTaskBriefs/req1").confirmedAtIso = new Date().toISOString();
  store.rows.get(REQUEST).site_task_triage = { disposition: "qualified" };
  store.rows.get(REQUEST).website_scene_sponsorship = websiteSceneSponsorship({ requestId: "req1",
    record: store.rows.get(REQUEST), brief: store.rows.get("siteTaskBriefs/req1"), now: Date.now() / 1000 });
  // A grant made before the auxiliary terms were configured carries no consent of its
  // own for them, so the native sponsorship's disclosure check still decides.
  const { meta: _meta, ...withoutAuxiliary } = terms;
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify(withoutAuxiliary));
  expect((await configure()).authority).not.toHaveProperty("auxiliary");
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms,
    google: { digest: sha("e"), label: "Accepted auxiliary terms", url: "https://example.com/terms" } }));
  await reserveWebsitePreparationSpend("req1", atlasSpend());
  const auxiliary = await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .4, atlas_auxiliary: true }));
  expect(auxiliary).toMatchObject({ status: "admitted", provider: "meta", provider_terms_reference: sha("e"),
    provider_training_authorized: false, atlas_authorization_digest: expect.stringMatching(/^sha256:/) });
  expect((await configure()).remaining_cost_usd).toBeCloseTo(.1);
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("3"),
    provider: "google", resource_class: "evaluator_api", maximum_cost_usd: .2, atlas_auxiliary: true })))
    .rejects.toThrow("website_scene_preparation_budget_exhausted");
  // Atlas's still-valid grant cannot renew the auxiliary provider's expired consent.
  store.rows.get(REQUEST).website_scene_sponsorship.expires_at_epoch = 1;
  const authority = store.rows.get(REQUEST).website_scene_sponsorship;
  const { authority_digest: _old, ...payload } = authority;
  authority.authority_digest = crossRuntimeDigest(payload);
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .01, atlas_auxiliary: true }))).rejects.toThrow("consent_expired");
});

it("gives an automatic preview its own SAM and review consent, pinned to their terms", async () => {
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
  const google = { digest: sha("f"), label: "Google terms", url: "https://example.com/google-terms" };
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms, google }));
  upload();
  const { authority } = await configure();
  const consent = (reference: string) => ({ provider_terms_reference: reference, private_processing_authorized: true,
    provider_training_authorized: false, approval_reference: policy.approval_reference });
  expect(authority.auxiliary).toEqual({ meta: consent(sha("e")), google: consent(sha("f")) });
  // No native sponsorship and no preparation assessment: the upload's own grant admits
  // both, charged to the Atlas cap and expiring with it.
  const sam = await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("2"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .4, atlas_auxiliary: true }));
  expect(sam).toMatchObject({ status: "admitted", provider: "meta", provider_terms_reference: sha("e"),
    provider_retention: "accepted_auxiliary_provider_terms", provider_training_authorized: false,
    atlas_authorization_digest: authority.authorization_digest, auxiliary_consent_digest: authority.authorization_digest,
    expires_at_epoch: authority.expires_at_epoch });
  const review = await reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("3"),
    provider: "google", resource_class: "evaluator_api", maximum_cost_usd: .2, atlas_auxiliary: true }));
  expect(review).toMatchObject({ status: "admitted", provider: "google", provider_terms_reference: sha("f") });
  expect(await configure()).toMatchObject({ remaining_cost_usd: expect.closeTo(1.4), remaining_requests: 2 });
  expect(store.rows.get(REQUEST).website_scene_sponsorship).toBeUndefined();
  // Changed terms refuse: the grant pinned the ones in force when it was made.
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms, google: { ...google, digest: sha("7") } }));
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
    provider: "google", resource_class: "evaluator_api", maximum_cost_usd: .1, atlas_auxiliary: true })))
    .rejects.toThrow("provider_terms_not_configured_or_changed");
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON", JSON.stringify({ ...terms, google }));
  // Only Atlas preview work reaches this consent; ordinary Meta work keeps its own path.
  await expect(reserveWebsitePreparationSpend("req1", { task_context_digest: contextDigest(),
    allocation_binding_digest: sha("4"), resource_class: "evaluator_api", provider: "meta",
    maximum_cost_usd: .05, request_count: 1 })).rejects.toThrow("website_scene_sponsorship_missing");
  // Withdrawn consent stops them like every other preview call.
  store.rows.get(REQUEST).consent_revoked = true;
  await expect(reserveWebsitePreparationSpend("req1", atlasSpend({ allocation_binding_digest: sha("4"),
    provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: .1, atlas_auxiliary: true })))
    .rejects.toThrow("source_revoked");
});


// Owner decision 2026-10-29: the site views its preview in the vendored viewer, never downloads it.
describe("owner Atlas preview view", () => {
  beforeEach(() => {
    vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  });

  it("reads one zip member, stored or deflated, and refuses a corrupt one", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(extractZipMember(bundleBytes, name => name.endsWith("/splat/atlas_depth_splat.ply"))).toEqual(splatBytes);
    expect(extractZipMember(bundleBytes, name => name.endsWith(".jpg"))).toEqual(Buffer.from("jpeg bytes"));
    expect(extractZipMember(bundleBytes, name => name.endsWith(".glb"))).toBeNull();
    const corrupt = Buffer.from(bundleBytes);
    corrupt[bundleBytes.indexOf(splatBytes)] ^= 0xff;
    expect(() => extractZipMember(corrupt, name => name.endsWith(".ply"))).toThrow("zip_member_corrupt");
  });

  it("turns an Atlas splat so the viewer's 180-degree load rotation leaves it upright", () => {
    const turned = orientPlyForViewer(splatBytes);
    const header = splatBytes.indexOf("end_header\n") + "end_header\n".length;
    expect(turned.subarray(0, header)).toEqual(splatBytes.subarray(0, header));
    const row = Array.from(new Float32Array(new Uint8Array(turned.subarray(header)).buffer));
    // x, y negate; colour, opacity and scale stay; (w, x, y, z) becomes (-z, -y, x, w).
    expect(row.map(value => Number(value.toFixed(4)))).toEqual([-1, -2, 3, 0.1, 0.2, 0.3, 2, -5, -5, -7, -0.3, -0.2, 0.1, 0.9]);
    expect(() => orientPlyForViewer(Buffer.from("ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"))).toThrow("ply_format_unsupported");
    expect(() => orientPlyForViewer(Buffer.from("ply\nformat binary_little_endian 1.0\nelement vertex 1\nproperty uchar x\nend_header\n\u0000")))
      .toThrow("ply_properties_unsupported");
  });

  it("starts the viewer at the recording's first posed view, else the package defaults", () => {
    expect(viewerSettingsFromAtlasCamera(firstCamera).cameras).toEqual([{ initial: { position: [1, 2, 3], target: [1, 2, 1], fov: 53.1 } }]);
    expect(viewerSettingsFromAtlasCamera({ ...firstCamera, extrinsics: { ...firstCamera.extrinsics, coordinateSystem: "rdf" } }).cameras)
      .toEqual([{ initial: { position: [0, 2, 0], target: [2, 2, 0], fov: 85 } }]);
    expect(viewerSettingsFromAtlasCamera(null)).toMatchObject({ version: 2, startMode: "default" });
  });

  it("lets only the viewer fetch the splat of a ready preview, for the right ticket and current consent", async () => {
    upload();
    store.rows.get(REQUEST).website_atlas_previews = { "walkthrough-req1": ready() };
    const origin = vi.fn(async () => new Response(bundleBytes, { status: 200 }));
    vi.stubGlobal("fetch", origin);
    const base = await app();
    const viewer = websiteAtlasPreviewViewerUrl("req1", "walkthrough-req1")!;
    expect(viewer).toMatch(/^\/splat-viewer\/index\.html\?content=/);
    const content = new URL(viewer, "https://webapp.invalid").searchParams.get("content")!;
    expect(content).toMatch(/^\/api\/website-atlas-preview-views\/req1\/walkthrough-req1\/scene\.ply\?expires=\d+&signature=[0-9a-f]{64}$/);
    const viewed = await realFetch(`${base}${content}`, { headers: { "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" } });
    expect(viewed.status).toBe(200);
    expect(Buffer.from(await viewed.arrayBuffer())).toEqual(orientPlyForViewer(splatBytes));
    const settings = await realFetch(`${base}${content.replace("/scene.ply?", "/settings.json?")}`, { headers: { "sec-fetch-dest": "empty" } });
    expect(settings.status).toBe(200);
    expect((await settings.json()).cameras).toEqual([{ initial: { position: [1, 2, 3], target: [1, 2, 1], fov: 53.1 } }]);
    expect(viewed.headers.get("cache-control")).toBe("private, no-store");
    expect(viewed.headers.get("content-disposition")).toBe("inline");
    // Pasting the link into the address bar is not a way to save the file.
    const opened = await realFetch(`${base}${content}`, { headers: { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" } });
    expect(opened.status).toBe(403);
    // A retired download ticket never opens the view route, nor does a forged one.
    const download = new URL(websiteAtlasPreviewDownloadUrl("req1", "walkthrough-req1")!, "https://webapp.invalid").searchParams;
    expect((await realFetch(`${base}/api/website-atlas-preview-views/req1/walkthrough-req1/scene.ply?${download}`)).status).toBe(404);
    store.rows.get(REQUEST).consent_revoked = true;
    expect((await realFetch(`${base}${content}`, { headers: { "sec-fetch-dest": "empty" } })).status).toBe(404);
  });
});
