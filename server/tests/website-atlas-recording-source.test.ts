// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import vector from "./fixtures/website-additional-views-vector.json";
import { resolveWebsiteAtlasGrant, websiteAtlasProcessingSourceIdentity, websiteAtlasSourceVideoIdentity } from "../utils/websiteAtlasAuthorization";

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;
function fixture() {
  const binding = structuredClone(vector.context.capture_binding);
  const source = binding.lineage[0].child;
  const session = { immutable_upload_identity: source };
  return { binding, session };
}
afterEach(() => vi.unstubAllEnvs());

it("binds the method input to both verified originals and keeps single-upload identity compatible", () => {
  const { binding, session } = fixture();
  expect(websiteAtlasSourceVideoIdentity(session)).toMatchObject({ kind: "site_capture_bundle" });
  const identity = websiteAtlasProcessingSourceIdentity(session, binding);
  expect(identity).toMatchObject({ kind: "website_recording_set", recordings: [
    { capture_id: "walkthrough-req1", raw_video: { generation: "123" } },
    { capture_id: binding.capture_id, raw_video: { generation: "123" } },
  ] });
  expect(websiteAtlasProcessingSourceIdentity(session)).toEqual(websiteAtlasSourceVideoIdentity(session));
});

it.each(["drop_original", "reorder", "different_current", "downgrade"])("refuses an incomplete %s method-source identity", fault => {
  const { binding, session } = fixture();
  if (fault === "drop_original") binding.recording_capture_ids.shift();
  else if (fault === "reorder") binding.recording_capture_ids.reverse();
  else if (fault === "different_current") session.immutable_upload_identity = { ...session.immutable_upload_identity, raw_bundle_digest: sha("0") };
  else (binding as any).schema_version = "website_capture_continuation.v1";
  expect(websiteAtlasProcessingSourceIdentity(session, binding)).toBeNull();
});

it("reuses one unchanged grant and refuses changed original identity or method bytes without renewing it", async () => {
  const { binding, session } = fixture();
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "[]");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({ schema_version: "website_atlas_grant_policy.v1",
    maximum_cost_usd: 2, maximum_requests: 4, validity_seconds: 3600, provider_retention: "account_does_not_retain",
    approval_reference: "synthetic existing owner policy", approved_by: "synthetic owner" }));
  const record: Record<string, any> = { account_owner_uid: "owner-1" };
  const input = { requestId: "req1", captureId: binding.capture_id, taskContextDigest: vector.context.context_digest,
    sourceVideoDigest: sha("9"), termsDigest: sha("a"), plannerTermsDigest: sha("b"), now: 1_793_214_000,
    record, captureRights: { derived_scene_generation_allowed: true, consent_revoked: false }, create: true,
    captureBinding: binding, readSession: async () => session };
  const first = await resolveWebsiteAtlasGrant(input);
  expect(first.created).toMatchObject({ source_video_identity: { kind: "website_recording_set" },
    maximum_cost_usd: 2, maximum_requests: 4 });
  record.website_atlas_grants = { [binding.capture_id]: structuredClone(first.created) };
  const original = structuredClone(record);
  const reopened = await resolveWebsiteAtlasGrant({ ...input, now: input.now + 1, create: false });
  expect(reopened.created).toBeNull();
  expect(reopened.grant).toEqual(first.grant);
  const enriched = structuredClone(binding);
  enriched.lineage[0].parent.verification_status = "verified";
  enriched.lineage[0].child.verification_status = "verified";
  expect((await resolveWebsiteAtlasGrant({ ...input, captureBinding: enriched, create: false })).grant).toEqual(first.grant);
  await expect(resolveWebsiteAtlasGrant({ ...input, sourceVideoDigest: sha("8"), create: false }))
    .rejects.toThrow("website_atlas_source_consent_required");
  const changed = structuredClone(binding);
  changed.lineage[0].parent.raw_video.generation = "124";
  await expect(resolveWebsiteAtlasGrant({ ...input, captureBinding: changed, create: false }))
    .rejects.toThrow("website_atlas_source_consent_required");
  expect(record).toEqual(original);
});
