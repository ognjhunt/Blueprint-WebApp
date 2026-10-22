// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { websiteAtlasAuthorization } from "../utils/websiteAtlasAuthorization";

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

it("never treats missing, duplicated or malformed authority as consent", () => {
  expect(() => websiteAtlasAuthorization(input)).toThrow("source_consent_required");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([consent, consent]));
  expect(() => websiteAtlasAuthorization(input)).toThrow("source_consent_required");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([{ ...consent, private_processing_authorized: false }]));
  expect(() => websiteAtlasAuthorization(input)).toThrow("authorization_invalid");
});
