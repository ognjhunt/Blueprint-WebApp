/** Blueprint funds preparation; capture consent never authorizes a site-owner charge. */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { TASK_BRIEFS_COLLECTION, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";

const money = z.number().finite().positive().max(1000);
const policySchema = z.object({
  owner: z.object({ user_id: z.string().trim().min(1), organization_id: z.string().trim().min(1) }).strict(),
  upstream_max_spend_usd: money,
  native_max_spend_usd: money,
  max_total_spend_usd: money,
  max_paid_attempts: z.number().int().min(1).max(32),
  ttl_seconds: z.number().int().min(60).max(86400),
  provider_terms_reference: z.string().regex(/^sha256:[0-9a-f]{64}$/),
}).strict().refine(p => p.upstream_max_spend_usd + p.native_max_spend_usd <= p.max_total_spend_usd);

function policy() {
  try { return policySchema.parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON || "null")); }
  catch { throw new Error("website_scene_sponsorship_not_configured"); }
}

export function websiteSceneSponsorship(input: {
  requestId: string; brief: SiteTaskBriefRecord; record: Record<string, any>; now: number;
}) {
  const configured = policy();
  const rights = projectWebsiteCaptureRights(input.record);
  if (!rights.derived_scene_generation_allowed) throw new Error("source_revoked");
  const context = projectWebsiteTaskContext(input.brief, rights);
  if (!context.confirmed) throw new Error("website_task_context_not_confirmed");
  const previous = input.record.website_scene_sponsorship;
  if (previous) {
    const { authority_digest: retainedDigest, ...payload } = previous;
    if (digest(payload) !== retainedDigest || previous.policy_digest !== digest(configured)
      || previous.request_id !== input.requestId || previous.task_context_digest !== context.context_digest)
      throw new Error("website_scene_sponsorship_changed");
    if (previous.expires_at_epoch <= input.now) throw new Error("consent_expired");
    return previous;
  }
  const value = {
    schema_version: "website_scene_sponsorship.v1", sponsor: "blueprint",
    request_id: input.requestId, capture_id: context.capture_id, scene_id: context.scene_id,
    task_context_digest: context.context_digest, policy_digest: digest(configured),
    owner: configured.owner,
    // These are disjoint caps, not two authorizations for the whole budget.
    preparation_max_total_spend_usd: configured.max_total_spend_usd,
    upstream_max_spend_usd: configured.upstream_max_spend_usd,
    max_total_spend_usd: configured.native_max_spend_usd,
    max_paid_attempts: configured.max_paid_attempts,
    expires_at_epoch: input.now + configured.ttl_seconds,
    consent: {
      rights_reference: digest(rights), provider_terms_reference: configured.provider_terms_reference,
      accepted_by: configured.owner.user_id, accepted_at_epoch: input.now,
      private_processing_authorized: true, provider_training_authorized: false,
      task_confirmed: true, spend_authorized: true,
    },
  };
  return { ...value, authority_digest: digest(value) };
}

/** One retained grant per upload. Replays never renew its clock or its budget. */
export async function loadWebsiteSceneSponsorship(requestId: string, create = false) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief] = await Promise.all([
      transaction.get(ref), transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
    ]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    const record = request.data()!;
    if (!create && !record.website_scene_sponsorship) throw new Error("website_scene_sponsorship_missing");
    const authority = websiteSceneSponsorship({ requestId, record,
      brief: brief.data() as SiteTaskBriefRecord, now: Date.now() / 1000 });
    if (!record.website_scene_sponsorship) transaction.update(ref, { website_scene_sponsorship: authority });
    return authority;
  }));
}

export function validateWebsiteSponsoredIntake(request: Record<string, any>, authority: Record<string, any>) {
  if (request.submission_id !== authority.capture_id
    || digest(request.owner) !== digest(authority.owner)
    || digest(request.consent) !== digest(authority.consent)
    || request.source?.kind !== "gaussian_splat"
    || !/^website-splat-[0-9a-f]{32}$/.test(request.source?.binding_id || "")
    || !/^sha256:[0-9a-f]{64}$/.test(request.source?.content_digest || "")
    || request.source.binding_id !== `website-splat-${request.source.content_digest.slice(7, 39)}`
    || request.task?.task_id !== `website-${authority.task_context_digest.slice(7, 27)}`
    || request.task?.subject?.geometry_origin !== "removed_before_reconstruction"
    || request.execution?.max_total_spend_usd !== authority.max_total_spend_usd
    || request.execution?.max_paid_attempts !== authority.max_paid_attempts
    || request.execution?.expires_at_epoch !== authority.expires_at_epoch
    || request.execution?.max_retries !== 0
    || request.execution?.claim_scope !== "development_only"
    || digest(request.execution?.allowed_providers) !== digest(["vast", "openai"]))
    throw new Error("website_scene_sponsorship_binding_invalid");
}
