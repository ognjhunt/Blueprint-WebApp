import { websiteDevelopmentTestEnvironment } from "./websiteDevelopmentTest";
/** Blueprint funds preparation; capture consent never authorizes a site-owner charge. */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { TASK_BRIEFS_COLLECTION, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { sceneProviderTerms } from "./taskEvaluationSceneIntake";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";

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

/**
 * An owner-approved development test may use an exploratory self-captured site
 * without claiming that site is qualified for a robot-team deployment. The
 * allowlist is scoped to the confirmed task context, never to a user or model.
 * Scene stability and access window may stay unknown for this test; that
 * absence remains in triage and bars captured-room or deployment readiness.
 * It is separate from the allowlist for an authored fixture later in the run.
 */
export function developmentTestSiteEligible(record: Record<string, any>) {
  if (record.request?.capture_mode !== "self_capture") return false;
  const gates = record.siteTaskGates;
  if (!gates || typeof gates !== "object" || gates.deploymentTimeline !== "exploratory") return false;
  const verified = triageGateAnswers(gates, undefined, "self_capture");
  const retained = record.site_task_triage;
  const allowedUnknowns = new Set(["sceneStability", "accessWindow"]);
  const unknowns = verified.unanswered;
  return verified.disposition === "not_now"
    && verified.blockers.length === 1
    && verified.blockers[0].fieldId === "deploymentTimeline"
    && verified.openQuestions.length === 0
    && unknowns.every(field => allowedUnknowns.has(field))
    && retained?.disposition === "not_now"
    && retained.blocking_field_ids?.length === 1
    && retained.blocking_field_ids[0] === "deploymentTimeline"
    && retained.open_question_field_ids?.length === 0
    && Array.isArray(retained.unanswered_field_ids)
    && digest(retained.unanswered_field_ids) === digest(unknowns);
}

function developmentTestSiteAuthorized(record: Record<string, any>, contextDigest: string) {
  let allowed: unknown;
  try { allowed = JSON.parse(process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS || "[]"); }
  catch { return false; }
  return Array.isArray(allowed) && allowed.includes(contextDigest)
    && developmentTestSiteEligible(record);
}

export function websiteSceneSponsorship(input: {
  requestId: string; brief: SiteTaskBriefRecord; record: Record<string, any>; now: number;
}) {
  const configured = policy();
  const rights = projectWebsiteCaptureRights(input.record);
  if (!rights.derived_scene_generation_allowed) throw new Error("source_revoked");
  const context = projectWebsiteTaskContext(input.brief, rights);
  if (!context.confirmed) throw new Error("website_task_context_not_confirmed");
  const developmentSiteTest = developmentTestSiteAuthorized(input.record, context.context_digest);
  const policyDigest = developmentSiteTest
    ? digest({ policy: configured, development_test_site_context_digest: context.context_digest,
      development_test_site_gates: input.record.siteTaskGates,
      development_test_site_triage: {
        disposition: input.record.site_task_triage.disposition,
        blocking_field_ids: input.record.site_task_triage.blocking_field_ids,
        unanswered_field_ids: input.record.site_task_triage.unanswered_field_ids,
      } })
    : digest(configured);
  const previous = input.record.website_scene_sponsorship;
  if (previous) {
    const { authority_digest: retainedDigest, ...payload } = previous;
    if (digest(payload) !== retainedDigest || previous.policy_digest !== policyDigest
      || previous.request_id !== input.requestId || previous.task_context_digest !== context.context_digest)
      throw new Error("website_scene_sponsorship_changed");
    if (previous.expires_at_epoch <= input.now) throw new Error("consent_expired");
    return previous;
  }
  // Blueprint pays for a scene only when our own screen says the site clears:
  // a `not_now` site is blocked by an answer only the site can change, and a
  // `needs_conversation` site builds after the call records its outcome. The
  // refusal is typed so the Pipeline holds the capture and retries rather than
  // failing it. Checked when the grant is first made, never on an existing
  // grant, so spend already authorized still settles.
  if (input.record.site_task_triage?.disposition !== "qualified"
    && !developmentSiteTest) {
    throw new Error("website_scene_site_not_qualified");
  }
  // And only once the site is saved to an account, so we know who we are
  // building it for. Saving happens when the operator confirms the brief; the
  // Pipeline holds and retries the capture until then.
  if (typeof input.record.account_owner_uid !== "string" || !input.record.account_owner_uid) {
    throw new Error("website_scene_site_unclaimed");
  }
  const claudeConsent = input.record.request?.claude_authoring_consent;
  const authoringProvider = claudeConsent ? "anthropic" : "openai";
  if (claudeConsent && (claudeConsent.granted !== true
    || claudeConsent.statement_version !== "2026-09-24.v1"
    || input.record.request?.capture_region !== "us"))
    throw new Error("website_anthropic_disclosure_authority_invalid");
  const anthropicTerms = authoringProvider === "anthropic" ? sceneProviderTerms().anthropic?.digest : null;
  if (authoringProvider === "anthropic" && !anthropicTerms)
    throw new Error("website_anthropic_provider_terms_not_configured");
  const value = {
    schema_version: "website_scene_sponsorship.v1", sponsor: "blueprint",
    request_id: input.requestId, capture_id: context.capture_id, scene_id: context.scene_id,
    task_context_digest: context.context_digest, policy_digest: policyDigest,
    authoring_provider: authoringProvider,
    ...(anthropicTerms ? { anthropic_provider_terms_reference: anthropicTerms } : {}),
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

export const preparationSpendRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  resource_class: z.enum(["evaluator_api", "openai_api_candidate", "provider_reconstruction_api", "gpu_render"]),
  provider: z.enum(["meta", "google", "openai", "world_labs", "vast"]),
  maximum_cost_usd: money, request_count: z.number().int().min(1).max(32),
}).strict().refine(value => (["meta", "google"].includes(value.provider) && value.resource_class === "evaluator_api")
  || (value.provider === "openai" && value.resource_class === "openai_api_candidate")
  || (value.provider === "world_labs" && value.resource_class === "provider_reconstruction_api")
  || (value.provider === "vast" && value.resource_class === "gpu_render"),
  "website_preparation_provider_resource_mismatch");

const completedPreparationSettlement = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("world_labs"), operation_id: z.string().min(1).max(200),
  operation_done: z.literal(true), total_credits: z.number().int().min(0).max(1_250_000),
  provider_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
const rejectedPreparationSettlement = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("world_labs"),
  rejection_code: z.literal("insufficient_api_credits_before_generation"),
  provider_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
const vastSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("vast"), instance_id: z.string().regex(/^[1-9][0-9]{0,17}$/),
  provider_charge_source: z.string().regex(/^instance-[1-9][0-9]{0,17}$/),
  provider_charge_amount_usd: z.number().finite().min(0).max(1000),
  provider_charge_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  execution_result_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  teardown_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider_zero_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().refine(value => value.provider_charge_source === `instance-${value.instance_id}`);
export const preparationSettlementRequest = z.union([
  completedPreparationSettlement, rejectedPreparationSettlement, vastSettlementRequest,
]);

/** Pipeline-signed final provider billing releases only the unused reservation. */
export async function settleWebsitePreparationSpend(requestId: string, input: z.infer<typeof preparationSettlementRequest>) {
  const command = preparationSettlementRequest.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const record = (await transaction.get(ref)).data();
    const key = command.allocation_binding_digest.slice(7);
    const row = record?.website_preparation_reservations?.[key];
    const actualCost = command.provider === "vast" ? command.provider_charge_amount_usd
      : "total_credits" in command ? command.total_credits / 1250 : 0;
    if (!row || row.admission.provider !== command.provider
      || row.admission.resource_class !== (command.provider === "vast" ? "gpu_render" : "provider_reconstruction_api")
      || row.admission.task_context_digest !== command.task_context_digest
      || actualCost > row.admission.maximum_cost_usd)
      throw new Error("website_scene_preparation_settlement_invalid");
    const settlement = { ...command, actual_cost_usd: actualCost, status: "settled" };
    if (row.settlement) {
      if (digest(row.settlement) !== digest(settlement)) throw new Error("idempotency_conflict");
      return row.settlement;
    }
    transaction.update(ref, { website_preparation_reservations: {
      ...record!.website_preparation_reservations, [key]: { ...row, settlement },
    } });
    return settlement;
  }));
}

const preparationLimitAmendment = z.object({
  authority_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  max_requests: z.number().int().min(1).max(64),
  approved_by: z.string().trim().min(1),
  approval_reference: z.string().trim().min(1).max(1000),
}).strict();

function preparationRequestLimit(record: Record<string, any>, authority: Record<string, any>) {
  const amendment = record.website_preparation_limit_amendment;
  if (!amendment) return authority.max_paid_attempts;
  const { amendment_digest, approved_at_epoch, ...raw } = amendment;
  const value = preparationLimitAmendment.parse(raw);
  if (digest({ ...value, approved_at_epoch }) !== amendment_digest
    || !Number.isFinite(approved_at_epoch)
    || value.authority_digest !== authority.authority_digest
    || value.approved_by !== authority.owner.user_id
    || value.max_requests < authority.max_paid_attempts)
    throw new Error("website_preparation_amendment_invalid");
  const extension = record.website_preparation_limit_extension;
  if (!extension) return value.max_requests;
  const { extension_digest, approved_at_epoch: extendedAt, prior_amendment_digest, ...extendedRaw } = extension;
  const extended = preparationLimitAmendment.parse(extendedRaw);
  if (digest({ ...extended, approved_at_epoch: extendedAt, prior_amendment_digest }) !== extension_digest
    || !Number.isFinite(extendedAt) || prior_amendment_digest !== amendment_digest
    || extended.authority_digest !== authority.authority_digest
    || extended.approved_by !== authority.owner.user_id
    || extended.max_requests <= value.max_requests)
    throw new Error("website_preparation_amendment_invalid");
  return extended.max_requests;
}

/** Operator-only amendment: never exposed as a public or Pipeline API. */
export async function amendWebsitePreparationRequestLimit(
  requestId: string, input: z.infer<typeof preparationLimitAmendment>, apply = false,
) {
  const command = preparationLimitAmendment.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const snapshot = await transaction.get(ref);
    const record = snapshot.data();
    const authority = record?.website_scene_sponsorship;
    if (!authority) throw new Error("website_scene_sponsorship_missing");
    const { authority_digest, ...payload } = authority;
    if (digest(payload) !== authority_digest || command.authority_digest !== authority_digest
      || authority.request_id !== requestId || command.approved_by !== authority.owner.user_id)
      throw new Error("website_scene_sponsorship_binding_invalid");
    if (authority.expires_at_epoch <= Date.now() / 1000) throw new Error("consent_expired");
    if (!projectWebsiteCaptureRights(record!).derived_scene_generation_allowed) throw new Error("source_revoked");
    const previous = record!.website_preparation_limit_amendment;
    const current = preparationRequestLimit(record!, authority);
    if (previous) {
      const extension = record!.website_preparation_limit_extension;
      if (extension?.max_requests === command.max_requests && extension.approval_reference === command.approval_reference)
        return extension;
      if (!extension && previous.max_requests === command.max_requests && previous.approval_reference === command.approval_reference)
        return previous;
      if (extension || command.max_requests <= current) throw new Error("website_preparation_amendment_conflict");
      const value = { ...command, approved_at_epoch: Date.now() / 1000,
        prior_amendment_digest: previous.amendment_digest };
      const receipt = { ...value, extension_digest: digest(value) };
      if (apply) transaction.update(ref, { website_preparation_limit_extension: receipt });
      return receipt;
    }
    if (command.max_requests <= current) throw new Error("website_preparation_limit_not_increased");
    const value = { ...command, approved_at_epoch: Date.now() / 1000 };
    const receipt = { ...value, amendment_digest: digest(value) };
    if (apply) transaction.update(ref, { website_preparation_limit_amendment: receipt });
    return receipt;
  }));
}

/** Reserve the full quote once; retries never replenish the preparation cap. */
export async function reserveWebsitePreparationSpend(requestId: string, input: z.infer<typeof preparationSpendRequest>) {
  const command = preparationSpendRequest.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief] = await Promise.all([
      transaction.get(ref), transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
    ]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    const record = request.data()!;
    if (!record.website_scene_sponsorship) throw new Error("website_scene_sponsorship_missing");
    const authority = websiteSceneSponsorship({ requestId, record,
      brief: brief.data() as SiteTaskBriefRecord, now: Date.now() / 1000 });
    if (command.task_context_digest !== authority.task_context_digest)
      throw new Error("website_scene_sponsorship_binding_invalid");
    if (sceneProviderTerms()[command.provider]?.digest !== authority.consent.provider_terms_reference)
      throw new Error("provider_terms_not_configured_or_changed");
    const reservations: Record<string, any> = record.website_preparation_reservations || {};
    const key = command.allocation_binding_digest.slice(7);
    if (reservations[key]) {
      if (reservations[key].command_digest !== digest(command)) throw new Error("idempotency_conflict");
      // Only the first transaction may dispatch. A retry on another worker
      // cannot spend again just because it lacks the first worker's files.
      return { ...reservations[key].admission, status: "already_reserved" };
    }
    const previous = Object.values(reservations);
    const micros = (amount: number) => Math.ceil(amount * 1_000_000);
    const reserved = previous.reduce((sum, row) => sum + micros(row.settlement?.actual_cost_usd ?? row.admission.maximum_cost_usd), 0);
    const attempts = previous.reduce((sum, row) => sum + row.admission.request_count, 0);
    if (reserved + micros(command.maximum_cost_usd) > Math.floor(authority.upstream_max_spend_usd * 1_000_000)
        || attempts + command.request_count > preparationRequestLimit(record, authority))
      throw new Error("website_scene_preparation_budget_exhausted");
    const admission = { ...command, schema_version: "paid_lane_admission.v1", status: "admitted",
      blockers: [], external_disclosure_allowed: true, sponsorship_digest: authority.authority_digest,
      expires_at_epoch: authority.expires_at_epoch };
    transaction.update(ref, { website_preparation_reservations: { ...reservations,
      [key]: { command_digest: digest(command), admission } } });
    return admission;
  }));
}

export function validateWebsiteSponsoredIntake(request: Record<string, any>, authority: Record<string, any>) {
  const test = request.task?.subject?.test_environment;
  const development = test !== undefined;
  if (development) {
    const parsed = websiteDevelopmentTestEnvironment.safeParse(test);
    let allowed: unknown;
    try { allowed = JSON.parse(process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS || "[]"); }
    catch { throw new Error("website_scene_development_test_not_authorized"); }
    if (!parsed.success || !Array.isArray(allowed) || !allowed.includes(authority.task_context_digest)
      || test.source_task_context_digest !== authority.task_context_digest)
      throw new Error("website_scene_development_test_not_authorized");
  }
  const prefix = development ? "website-development-" : "website-splat-";

  if (request.submission_id !== authority.capture_id
    || digest(request.owner) !== digest(authority.owner)
    || digest(request.consent) !== digest(authority.consent)
    || request.source?.kind !== (development ? "mesh" : "gaussian_splat")
    || typeof request.source?.binding_id !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(request.source?.content_digest || "")
    || request.source.binding_id !== `${prefix}${request.source.content_digest.slice(7, 39)}`
    || request.task?.task_id !== `website-${authority.task_context_digest.slice(7, 27)}${development ? "-development" : ""}`
    || request.task?.subject?.geometry_origin !== "removed_before_reconstruction"
    || request.execution?.max_total_spend_usd !== authority.max_total_spend_usd
    || request.execution?.max_paid_attempts !== authority.max_paid_attempts
    || request.execution?.expires_at_epoch !== authority.expires_at_epoch
    || request.execution?.max_retries !== 0
    || request.execution?.claim_scope !== "development_only"
    || digest(request.execution?.allowed_providers) !== digest(authority.authoring_provider === "anthropic"
      ? ["vast", "openai", "anthropic"] : ["vast", "openai"]))
    throw new Error("website_scene_sponsorship_binding_invalid");
}

/** Sponsored Claude disclosure has its own signed terms reference. */
export function validateWebsiteSponsoredProviderTerms(
  command: { execution: { allowed_providers: string[] }; consent: { provider_terms_reference: string } },
  authority: Record<string, any>,
) {
  const terms = sceneProviderTerms();
  if (!command.execution.allowed_providers.every(provider => provider === "anthropic"
    ? authority.authoring_provider === "anthropic"
      && terms.anthropic?.digest === authority.anthropic_provider_terms_reference
    : terms[provider]?.digest === command.consent.provider_terms_reference))
    throw new Error("provider_terms_not_configured_or_changed");
}
