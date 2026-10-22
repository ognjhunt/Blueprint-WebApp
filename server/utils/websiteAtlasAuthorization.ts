/** Explicit, source-bound Atlas beta disclosure and allowance. ADP-040 / Day 28. */
import { z } from "zod";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const planner = z.object({
  provider: z.literal("openai"), provider_terms_reference: sha,
  private_processing_authorized: z.literal(true), provider_training_authorized: z.literal(false),
  approval_reference: z.string().min(1),
}).strict();
const authorization = z.object({
  schema_version: z.literal("website_atlas_authorization.v1"),
  request_id: z.string().min(1), capture_id: z.string().min(1),
  task_context_digest: sha, source_video_digest: sha,
  provider_terms_reference: sha,
  accepted_by: z.string().min(1), approval_reference: z.string().min(1),
  private_processing_authorized: z.literal(true),
  provider_training_authorized: z.boolean(),
  provider_retention: z.enum(["account_does_not_retain", "project_library_retention_approved"]),
  maximum_cost_usd: z.number().finite().positive().max(1000),
  maximum_requests: z.number().int().min(1).max(32),
  expires_at_epoch: z.number().finite().positive(),
  claim_scope: z.literal("development_only"),
  planner: planner.optional(),
}).strict();

type GrantChecks = { termsDigest?: string; plannerTermsDigest?: string; planning?: boolean; now: number };
type EnvRowMatch = { requestId: string; captureId: string; taskContextDigest: string; sourceVideoDigest?: string };

function checkedGrant<T extends { expires_at_epoch: number; provider_terms_reference: string;
  planner?: { provider_terms_reference: string } }>(value: T, input: GrantChecks) {
  if (value.expires_at_epoch <= input.now) throw new Error("website_atlas_consent_expired");
  if (!input.termsDigest || input.termsDigest !== value.provider_terms_reference)
    throw new Error("provider_terms_not_configured_or_changed");
  if (input.planning && (!value.planner || !input.plannerTermsDigest
    || value.planner.provider_terms_reference !== input.plannerTermsDigest))
    throw new Error("website_atlas_planner_consent_required");
  return { ...value, authorization_digest: digest(value) };
}

function matchingAuthorizations(input: EnvRowMatch) {
  let values: z.infer<typeof authorization>[];
  try {
    values = z.array(authorization).parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON || "[]"));
  } catch { throw new Error("website_atlas_authorization_invalid"); }
  return values.filter(v => v.request_id === input.requestId && v.capture_id === input.captureId
    && v.task_context_digest === input.taskContextDigest && v.source_video_digest === input.sourceVideoDigest);
}

export function websiteAtlasAuthorization(input: EnvRowMatch & GrantChecks) {
  const rows = matchingAuthorizations(input);
  if (rows.length !== 1) throw new Error("website_atlas_source_consent_required");
  return checkedGrant(rows[0], input);
}

/** Owner exception 2026-10-22 (AGENTS.md): automatic, consented previews within a
 * Blueprint-internal allowance. Unset or invalid configures no automatic grant,
 * and neither creates nor honours a stored one; nothing else reads it. */
const grantPolicy = z.object({
  schema_version: z.literal("website_atlas_grant_policy.v1"),
  maximum_cost_usd: z.number().finite().positive().max(5),
  maximum_requests: z.number().int().min(1).max(32),
  validity_seconds: z.number().int().min(3600).max(1_209_600),
  provider_retention: z.literal("account_does_not_retain"),
  approval_reference: z.string().trim().min(1).max(1000),
  approved_by: z.string().trim().min(1).max(200),
}).strict();
export type WebsiteAtlasGrantPolicy = z.infer<typeof grantPolicy>;

export function websiteAtlasGrantPolicy(): WebsiteAtlasGrantPolicy | null {
  let raw: unknown = null;
  try { raw = JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON || "null"); } catch { return null; }
  const parsed = grantPolicy.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The uploaded raw video's immutable identity. Mutable verification fields are excluded. */
const sourceVideoIdentity = z.union([
  z.object({ kind: z.literal("website_browser_video"), object_name: z.string().min(1).max(1024),
    generation: z.string().regex(/^[1-9][0-9]{0,19}$/), size_bytes: z.number().int().positive(),
    crc32c: z.string().min(1).max(64) }).strict(),
  z.object({ kind: z.literal("site_capture_bundle"), raw_bundle_digest: sha,
    raw_manifest_uri: z.string().min(1).max(800), upload_completion_digest: sha }).strict(),
]);

export function websiteAtlasSourceVideoIdentity(session: Record<string, any> | undefined) {
  const pending = session?.browser_pending_delivery, upload = session?.immutable_upload_identity;
  // Exactly one finalized producer may own a capture; ambiguity grants nothing.
  if (Boolean(pending) === Boolean(upload) || pending && pending.state !== "published") return null;
  const parsed = sourceVideoIdentity.safeParse(pending
    ? { kind: "website_browser_video", object_name: pending.video?.object_name, generation: pending.video?.generation,
      size_bytes: pending.video?.size_bytes, crc32c: pending.video?.crc32c }
    : { kind: "site_capture_bundle", raw_bundle_digest: upload.raw_bundle_digest,
      raw_manifest_uri: upload.raw_manifest_uri, upload_completion_digest: upload.upload_completion_digest });
  return parsed.success ? parsed.data : null;
}

/** Stored at `inboundRequests/{requestId}.website_atlas_grants[captureId]`. Deliberately
 * not bound to the task context: a task edit must not change or end the grant. */
const storedGrant = z.object({
  schema_version: z.literal("website_atlas_authorization.v2"),
  request_id: z.string().min(1), capture_id: z.string().min(1),
  source_video_digest: sha, source_video_identity: sourceVideoIdentity,
  capture_rights_digest: sha, policy_digest: sha, provider_terms_reference: sha, planner,
  accepted_by: z.string().min(1), approval_reference: z.string().min(1),
  grant_basis: z.literal("automatic_consented_preview"),
  private_processing_authorized: z.literal(true), provider_training_authorized: z.literal(false),
  provider_retention: z.literal("account_does_not_retain"),
  maximum_cost_usd: z.number().finite().positive().max(5),
  maximum_requests: z.number().int().min(1).max(32),
  created_at_epoch: z.number().int().positive(), expires_at_epoch: z.number().int().positive(),
  claim_scope: z.literal("development_only"),
}).strict();
export type WebsiteAtlasStoredGrant = z.infer<typeof storedGrant>;

/** Whether an Atlas command takes the automatic side lane: a valid policy and no exact
 * env row. Never throws; an invalid env row list keeps today's path and its refusal. */
export function websiteAtlasAutomaticLane(input: EnvRowMatch) {
  if (!websiteAtlasGrantPolicy()) return false;
  try { return matchingAuthorizations(input).length === 0; } catch { return false; }
}

/** The owner a grant must name: the retained Blueprint sponsor for an explicit env
 * row (docs/atlas-beta-integration.md), the site account for an automatic grant. */
export function websiteAtlasGrantOwner(record: Record<string, any>, grant: { accepted_by: string; grant_basis?: string }) {
  const owner = grant.grant_basis === "automatic_consented_preview"
    ? record.account_owner_uid : record.website_scene_sponsorship?.owner?.user_id;
  return typeof owner === "string" && owner ? owner : null;
}

/**
 * One resolution for atlas-configuration and Atlas reservations: an exact env row,
 * else the stored automatic grant, else (configuration only, first writer wins) a
 * new grant derived from the upload's own consent and the Blueprint policy.
 * Terms and expiry are checked exactly as for env rows. The caller writes `created`
 * in the same transaction that read `record`, and checks the owner and rights.
 */
export async function resolveWebsiteAtlasGrant(input: EnvRowMatch & GrantChecks & {
  record: Record<string, any>; readSession: () => Promise<Record<string, any> | undefined>;
  captureRights: { derived_scene_generation_allowed: boolean; consent_revoked: boolean };
  create?: boolean;
}) {
  const rows = matchingAuthorizations(input);
  if (rows.length > 1) throw new Error("website_atlas_source_consent_required");
  if (rows.length === 1) return { grant: checkedGrant(rows[0], input), created: null };
  const policy = websiteAtlasGrantPolicy();
  if (!policy) throw new Error("website_atlas_source_consent_required");
  const identity = websiteAtlasSourceVideoIdentity(await input.readSession());
  const stored = input.record.website_atlas_grants?.[input.captureId];
  if (stored !== undefined) {
    const parsed = storedGrant.safeParse(stored);
    if (!parsed.success || parsed.data.request_id !== input.requestId || parsed.data.capture_id !== input.captureId)
      throw new Error("website_atlas_authorization_invalid");
    // The first configuration call pinned the Pipeline digest and the uploaded object.
    if (parsed.data.source_video_digest !== input.sourceVideoDigest || !identity
      || digest(identity) !== digest(parsed.data.source_video_identity))
      throw new Error("website_atlas_source_consent_required");
    return { grant: checkedGrant(parsed.data, input), created: null };
  }
  const owner = input.record.account_owner_uid;
  if (!input.create || !input.sourceVideoDigest || !identity || typeof owner !== "string" || !owner.trim()
    || !input.captureRights.derived_scene_generation_allowed || input.captureRights.consent_revoked)
    throw new Error("website_atlas_source_consent_required");
  if (!input.termsDigest) throw new Error("provider_terms_not_configured_or_changed");
  if (!input.plannerTermsDigest) throw new Error("website_atlas_planner_consent_required");
  const createdAt = Math.floor(input.now);
  const grant = storedGrant.parse({
    schema_version: "website_atlas_authorization.v2", request_id: input.requestId, capture_id: input.captureId,
    source_video_digest: input.sourceVideoDigest, source_video_identity: identity,
    capture_rights_digest: digest(input.captureRights), policy_digest: digest(policy),
    provider_terms_reference: input.termsDigest,
    planner: { provider: "openai", provider_terms_reference: input.plannerTermsDigest,
      private_processing_authorized: true, provider_training_authorized: false,
      approval_reference: policy.approval_reference },
    accepted_by: owner, approval_reference: policy.approval_reference,
    grant_basis: "automatic_consented_preview",
    private_processing_authorized: true, provider_training_authorized: false,
    provider_retention: policy.provider_retention,
    maximum_cost_usd: policy.maximum_cost_usd, maximum_requests: policy.maximum_requests,
    created_at_epoch: createdAt, expires_at_epoch: createdAt + policy.validity_seconds,
    claim_scope: "development_only",
  });
  return { grant: checkedGrant(grant, input), created: grant };
}

const runtimePolicy = z.object({
  schema_version: z.literal("website_atlas_runtime_policy.v1"),
  model: z.string().min(1), maximum_review_cost_usd: z.number().finite().positive().max(5),
  pose_input_cost_usd: z.number().finite().positive(), rgbd_view_cost_usd: z.number().finite().positive(),
  mesh_export_cost_usd: z.number().finite().positive().optional(),
  rate_card_reference: z.string().url().startsWith("https://"), reviewed_by: z.string().min(1),
  reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export function websiteAtlasRuntimePolicy() {
  try { return runtimePolicy.parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON || "null")); }
  catch { throw new Error("website_atlas_runtime_policy_required"); }
}

export function atlasAllowanceUsage(reservations: Record<string, any>) {
  // Old Atlas rows remain held after adding planner consent to the same grant.
  const rows = Object.values(reservations).filter(row => row.admission.provider === "world_labs_atlas"
    || Boolean(row.admission.atlas_authorization_digest));
  return { cost: rows.reduce((sum, row) => sum + Math.ceil((row.settlement?.actual_cost_usd
    ?? row.admission.maximum_cost_usd) * 1_000_000), 0) / 1_000_000,
    requests: rows.reduce((sum, row) => sum + row.admission.request_count, 0) };
}
