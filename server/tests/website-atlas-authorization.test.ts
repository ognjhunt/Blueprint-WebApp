// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { websiteAtlasAuthorization, atlasAllowanceUsage, websiteAtlasRuntimePolicy, websiteAtlasGrantPolicy,
  websiteAtlasSourceVideoIdentity } from "../utils/websiteAtlasAuthorization";

const sha = (s: string) => `sha256:${s.repeat(64)}`;
const input = { requestId: "r", captureId: "c", taskContextDigest: sha("1"), sourceVideoDigest: sha("2"),
  termsDigest: sha("3"), now: 100 };
const consent = { schema_version: "website_atlas_authorization.v1", request_id: "r", capture_id: "c",
  task_context_digest: sha("1"), source_video_digest: sha("2"), provider_terms_reference: sha("3"),
  accepted_by: "source-owner", approval_reference: "explicit owner beta acceptance",
  private_processing_authorized: true, provider_training_authorized: false,
  provider_retention: "project_library_retention_approved", maximum_cost_usd: 5, maximum_requests: 16,
  expires_at_epoch: 200, claim_scope: "development_only" };
afterEach(() => vi.unstubAllEnvs());

it("requires Atlas-specific terms and exact capture, task and source", () => {
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([consent]));
  expect(websiteAtlasAuthorization(input)).toMatchObject({ maximum_cost_usd: 5, authorization_digest: expect.stringMatching(/^sha256:/) });
  for (const changed of [{ sourceVideoDigest: sha("4") }, { captureId: "different" }, { taskContextDigest: sha("4") }])
    expect(() => websiteAtlasAuthorization({ ...input, ...changed })).toThrow("source_consent_required");
  expect(() => websiteAtlasAuthorization({ ...input, termsDigest: sha("4") })).toThrow("provider_terms_not_configured_or_changed");
  expect(() => websiteAtlasAuthorization({ ...input, now: 201 })).toThrow("consent_expired");
});

it("requires explicit planner disclosure and shares the cap with retained Atlas reservations", () => {
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([consent]));
  expect(() => websiteAtlasAuthorization({ ...input, planning: true, plannerTermsDigest: sha("4") }))
    .toThrow("planner_consent_required");
  const planner = { provider: "openai", provider_terms_reference: sha("4"), private_processing_authorized: true,
    provider_training_authorized: false, approval_reference: "source owner requests production agent planning" };
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([{ ...consent, planner }]));
  expect(websiteAtlasAuthorization({ ...input, planning: true, plannerTermsDigest: sha("4") })).toHaveProperty("planner");
  expect(() => websiteAtlasAuthorization({ ...input, planning: true, plannerTermsDigest: sha("5") })).toThrow("planner_consent_required");
  expect(atlasAllowanceUsage({ pose: { admission: { provider: "world_labs_atlas", maximum_cost_usd: .24, request_count: 4 } },
    plan: { admission: { provider: "openai", atlas_authorization_digest: "prior-grant", maximum_cost_usd: .5, request_count: 1 },
      settlement: { actual_cost_usd: .1 } },
    legacy: { admission: { provider: "openai", maximum_cost_usd: 10, request_count: 10 } },
  })).toEqual({ cost: .34, requests: 5 });
  expect(() => websiteAtlasRuntimePolicy()).toThrow("runtime_policy_required");
});

it("never treats missing, duplicated or malformed authority as consent", () => {
  expect(() => websiteAtlasAuthorization(input)).toThrow("source_consent_required");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([consent, consent]));
  expect(() => websiteAtlasAuthorization(input)).toThrow("source_consent_required");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([{ ...consent, private_processing_authorized: false }]));
  expect(() => websiteAtlasAuthorization(input)).toThrow("authorization_invalid");
});

it("accepts an optional reviewed mesh export price and still refuses unknown or non-positive policy fields", () => {
  const policy = { schema_version: "website_atlas_runtime_policy.v1", model: "gpt-6.1-sol", maximum_review_cost_usd: .5,
    pose_input_cost_usd: .01, rgbd_view_cost_usd: .05, rate_card_reference: "https://atlas-beta.worldlabs.ai/docs/billing",
    reviewed_by: "operator", reviewed_on: "2026-10-21" };
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify(policy));
  expect(websiteAtlasRuntimePolicy()).not.toHaveProperty("mesh_export_cost_usd");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify({ ...policy, mesh_export_cost_usd: .5 }));
  expect(websiteAtlasRuntimePolicy()).toMatchObject({ mesh_export_cost_usd: .5 });
  for (const changed of [{ mesh_export_cost_usd: 0 }, { splat_cost_usd: 1 }]) {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON", JSON.stringify({ ...policy, ...changed }));
    expect(() => websiteAtlasRuntimePolicy()).toThrow("runtime_policy_required");
  }
});

it("reads the automatic grant policy strictly and never throws", () => {
  const policy = { schema_version: "website_atlas_grant_policy.v1", maximum_cost_usd: 2, maximum_requests: 16,
    validity_seconds: 604800, provider_retention: "account_does_not_retain", approval_reference: "owner 2026-10-22",
    approved_by: "repo-owner" };
  expect(websiteAtlasGrantPolicy()).toBeNull();
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify(policy));
  expect(websiteAtlasGrantPolicy()).toEqual(policy);
  // A high safety ceiling (accuracy over cost) is accepted; only a typo-sized one is refused.
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ ...policy, maximum_cost_usd: 25 }));
  expect(websiteAtlasGrantPolicy()?.maximum_cost_usd).toBe(25);
  for (const changed of [{ maximum_cost_usd: 0 }, { maximum_cost_usd: 100.01 }, { maximum_requests: 33 }, { validity_seconds: 3599 },
    { validity_seconds: 1209601 }, { provider_retention: "project_library_retention_approved" }, { approved_by: " " }, { charge: 1 }]) {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ ...policy, ...changed }));
    expect(websiteAtlasGrantPolicy()).toBeNull();
  }
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "{not json");
  expect(websiteAtlasGrantPolicy()).toBeNull();
});

it("pins only one finalized upload's immutable identity", () => {
  const video = { object_name: "scenes/site-r/captures/walkthrough-r/raw/walkthrough.mov", generation: "17", size_bytes: 9, crc32c: "AAAAAA==" };
  const bundle = { raw_bundle_digest: sha("1"), raw_manifest_uri: "gs://bucket/scenes/site-r/captures/c/raw/manifest.json",
    upload_completion_digest: sha("2") };
  expect(websiteAtlasSourceVideoIdentity({ browser_pending_delivery: { state: "published", video } }))
    .toEqual({ kind: "website_browser_video", ...video });
  expect(websiteAtlasSourceVideoIdentity({ immutable_upload_identity: { ...bundle, verification_status: "pipeline_storage_bytes_verified",
    verified_capture_digest: sha("1") } })).toEqual({ kind: "site_capture_bundle", ...bundle });
  for (const session of [undefined, {}, { browser_pending_delivery: { state: "held", video } },
    { browser_pending_delivery: { state: "published", video }, immutable_upload_identity: bundle },
    { browser_pending_delivery: { state: "published", video: { ...video, generation: "0" } } }])
    expect(websiteAtlasSourceVideoIdentity(session)).toBeNull();
});


it("allows an explicit cumulative multi-run request quota without resetting dollars or prior calls", () => {
  const renewed = { ...consent, maximum_cost_usd: 29.939948, maximum_requests: 1000 };
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([renewed]));
  const grant = websiteAtlasAuthorization(input);
  const usage = atlasAllowanceUsage({
    historical: { admission: { provider: "world_labs_atlas", maximum_cost_usd: 4.939948, request_count: 16 } },
    current: { admission: { provider: "openai", atlas_authorization_digest: "earlier-grant", maximum_cost_usd: 1.752431, request_count: 7 } },
  });
  expect(grant.maximum_cost_usd - usage.cost).toBeCloseTo(23.247569, 6);
  expect(usage.requests).toBe(23);
  expect(grant.maximum_requests - usage.requests).toBeGreaterThanOrEqual(14);
  for (const maximum_requests of [0, 1.5, 1001]) {
    vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([{ ...renewed, maximum_requests }]));
    expect(() => websiteAtlasAuthorization(input)).toThrow("authorization_invalid");
  }
});
