/** Atlas preparation for real owned uploads; no website/site consent is invented. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { requireOwnedCaptureAtlasSource } from "./ownedCaptureAtlasContext";
import { ownedCaptureAtlasPreparationPlanSchema } from "./reconstructionForwarding";
import { sceneProviderTerms } from "./taskEvaluationSceneIntake";
import { atlasAllowanceUsage, websiteAtlasAuthorization, websiteAtlasRuntimePolicy } from "./websiteAtlasAuthorization";
import { preparationSpendRequest, preparationSettlementRequest } from "./websiteSceneSponsorship";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { z } from "zod";

const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const providerIdentity = z.object({ account_id: identifier, project_id: identifier }).strict();
const allowanceSchema = z.object({
  schema_version: z.literal("owned_capture_atlas_allowance.v1"), owner_user_id: z.string().min(1),
  capture_id: identifier, source_video_digest: sha,
  maximum_cost_usd: z.number().finite().positive().max(1000),
  maximum_requests: z.number().int().min(1).max(1000),
  created_at_epoch: z.number().finite().positive(), expires_at_epoch: z.number().finite().positive(),
  provider_identity: providerIdentity, company_authorization_digest: sha,
  approval_reference: z.string().min(1),
}).strict();
export const ownedAtlasConfigurationRequest = z.object({
  plan_id: identifier, task_context_digest: sha, source_video_digest: sha,
}).strict();
export const ownedAtlasAuthorizationCommand = ownedAtlasConfigurationRequest.extend({
  maximum_cost_usd: z.number().finite().positive().max(1000),
  maximum_requests: z.number().int().min(1).max(1000),
  provider_identity: providerIdentity,
}).strict();
type ConfigurationRequest = z.infer<typeof ownedAtlasConfigurationRequest>;
type AuthorizationCommand = z.infer<typeof ownedAtlasAuthorizationCommand>;
type PreparationControl = Record<string, any>;

function currentPlan(record: Record<string, any>, input: ConfigurationRequest) {
  const control = record.pipeline_owned_atlas_preparation;
  if (control?.schema_version !== "capture_owned_atlas_preparation_control.v1")
    throw new Error("owned_capture_atlas_plan_required");
  const plan = ownedCaptureAtlasPreparationPlanSchema.parse(control.plans?.[input.plan_id]);
  const context = requireOwnedCaptureAtlasSource({ session: record, ownerUid: record.owner_user_id,
    context: plan.source_context });
  if (context.context_digest !== input.task_context_digest || plan.source_video_digest !== input.source_video_digest)
    throw new Error("owned_capture_atlas_source_or_task_changed");
  if (context.governance.privacy !== "cleared")
    throw new Error("owned_capture_atlas_privacy_restricts_external_processing");
  const constraints = context.governance.provider_constraints as Record<string, unknown> | undefined;
  if (constraints?.external_processing_allowed !== true)
    throw new Error("owned_capture_atlas_external_processing_not_authorized");
  if (!["world_labs_atlas", "openai"].every(provider => context.permitted_reconstruction_providers.includes(provider)))
    throw new Error("owned_capture_atlas_provider_not_authorized");
  return { control: control as PreparationControl, plan, context };
}

function configuration(record: Record<string, any>, input: ConfigurationRequest,
  authorization?: AuthorizationCommand) {
  const { control, context } = currentPlan(record, input);
  const terms = sceneProviderTerms();
  // The existing explicit company authorization format binds arbitrary exact
  // source IDs. The automatic consented-website-preview grant is never consulted.
  const company = websiteAtlasAuthorization({ requestId: input.plan_id, captureId: context.capture_id,
    taskContextDigest: input.task_context_digest, sourceVideoDigest: input.source_video_digest,
    termsDigest: terms.world_labs_atlas?.digest, plannerTermsDigest: terms.openai?.digest,
    planning: true, now: Date.now() / 1000 });
  if (company.accepted_by !== record.owner_user_id || company.provider_training_authorized !== false)
    throw new Error("owned_capture_atlas_source_approval_required");
  const original = control.allowance === undefined ? undefined : allowanceSchema.parse(control.allowance);
  if (!original && !authorization) throw new Error("owned_capture_atlas_authorization_required");
  const requested = authorization ?? original;
  if (!requested) throw new Error("owned_capture_atlas_authorization_required");
  if (requested.maximum_cost_usd > company.maximum_cost_usd || requested.maximum_requests > company.maximum_requests)
    throw new Error("owned_capture_atlas_company_allowance_exceeded");
  if (original && (original.owner_user_id !== record.owner_user_id
    || original.source_video_digest !== input.source_video_digest
    || authorization && (authorization.maximum_cost_usd !== original.maximum_cost_usd
      || authorization.maximum_requests !== original.maximum_requests
      || digest(authorization.provider_identity) !== digest(original.provider_identity))))
    throw new Error("owned_capture_atlas_allowance_binding_conflict");
  const allowance = original ?? { schema_version: "owned_capture_atlas_allowance.v1",
    owner_user_id: record.owner_user_id, capture_id: context.capture_id,
    source_video_digest: input.source_video_digest, maximum_cost_usd: requested.maximum_cost_usd,
    maximum_requests: requested.maximum_requests, created_at_epoch: Math.floor(Date.now() / 1000),
    provider_identity: requested.provider_identity,
    expires_at_epoch: company.expires_at_epoch, company_authorization_digest: company.authorization_digest,
    approval_reference: company.approval_reference };
  if (allowance.schema_version !== "owned_capture_atlas_allowance.v1"
    || allowance.capture_id !== context.capture_id || allowance.expires_at_epoch <= Date.now() / 1000)
    throw new Error("owned_capture_atlas_allowance_expired_or_invalid");
  const authorityValue = { schema_version: "owned_capture_atlas_authorization.v1",
    authorization_basis: "explicit_company_source_approval", request_id: input.plan_id,
    capture_id: context.capture_id, owner_user_id: record.owner_user_id,
    task_context_digest: context.context_digest, source_capture: context.source_capture,
    provider_identity: allowance.provider_identity,
    source_video_digest: input.source_video_digest, company_authorization_digest: company.authorization_digest,
    original_allowance_digest: digest(allowance), approval_reference: company.approval_reference,
    accepted_by: company.accepted_by, private_processing_authorized: true,
    provider_terms_reference: company.provider_terms_reference, provider_training_authorized: false,
    provider_retention: company.provider_retention, planner: company.planner!,
    maximum_cost_usd: Math.min(allowance.maximum_cost_usd, company.maximum_cost_usd),
    maximum_requests: Math.min(allowance.maximum_requests, company.maximum_requests),
    expires_at_epoch: Math.min(allowance.expires_at_epoch, company.expires_at_epoch), claim_scope: "development_only" };
  const authority = { ...authorityValue, authorization_digest: digest(authorityValue) };
  const usage = atlasAllowanceUsage(control.reservations || {});
  return { control, allowance, created: !original,
    value: { schema_version: "owned_capture_atlas_configuration.v1", authority,
      policy: websiteAtlasRuntimePolicy(), task_context_digest: context.context_digest,
      source_video_digest: input.source_video_digest, dispatch_authorized: false,
      grant_creation_allowed: false, reserved_or_settled_cost_usd: usage.cost,
      remaining_cost_usd: Math.max(0, authority.maximum_cost_usd - usage.cost),
      remaining_requests: Math.max(0, authority.maximum_requests - usage.requests) } };
}

/** Only the authenticated owner command can retain the first explicit allowance.
 * Merely inspecting configuration or reserving a call never creates/renews one. */
export async function loadOwnedCaptureAtlasConfiguration(captureId: string, input: ConfigurationRequest,
  ownerAuthorization?: { ownerUid: string; command: AuthorizationCommand }) {
  identifier.parse(captureId);
  const command = ownedAtlasConfigurationRequest.parse(input);
  if (!db) throw new Error("owned_capture_atlas_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("captureUploadSessions").doc(captureId);
    const record = (await transaction.get(ref)).data();
    if (!record || record.session_id !== captureId) throw new Error("owned_capture_atlas_source_missing");
    if (ownerAuthorization && ownerAuthorization.ownerUid !== record.owner_user_id)
      throw new Error("owned_capture_atlas_owner_mismatch");
    const authorized = ownerAuthorization && ownedAtlasAuthorizationCommand.parse(ownerAuthorization.command);
    if (authorized && (authorized.plan_id !== command.plan_id
      || authorized.task_context_digest !== command.task_context_digest
      || authorized.source_video_digest !== command.source_video_digest))
      throw new Error("owned_capture_atlas_source_or_task_changed");
    const prepared = configuration(record, command, authorized || undefined);
    if (prepared.created) transaction.update(ref, { pipeline_owned_atlas_preparation: {
      ...prepared.control, allowance: prepared.allowance } });
    return prepared.value;
  }));
}

export async function reserveOwnedCaptureAtlasSpend(captureId: string, input: ConfigurationRequest,
  request: z.infer<typeof preparationSpendRequest>, observeOnly = false) {
  identifier.parse(captureId);
  const binding = ownedAtlasConfigurationRequest.parse(input), command = preparationSpendRequest.parse(request);
  if (!db) throw new Error("owned_capture_atlas_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("captureUploadSessions").doc(captureId);
    const record = (await transaction.get(ref)).data();
    if (!record || record.session_id !== captureId) throw new Error("owned_capture_atlas_source_missing");
    const { control, value } = configuration(record, binding);
    const { authority } = value;
    if (command.task_context_digest !== binding.task_context_digest || command.source_video_digest !== binding.source_video_digest)
      throw new Error("owned_capture_atlas_spend_binding_invalid");
    if (!(command.provider === "world_labs_atlas" && command.resource_class === "provider_reconstruction_api"
      || command.provider === "openai" && command.resource_class === "openai_api_candidate") || command.atlas_auxiliary)
      throw new Error("owned_capture_atlas_provider_not_authorized");
    const reservations = control.reservations || {}, key = command.allocation_binding_digest.slice(7);
    if (reservations[key]) {
      if (reservations[key].command_digest !== digest(command)) throw new Error("idempotency_conflict");
      return { ...reservations[key].admission, status: "already_reserved" };
    }
    if (observeOnly) throw new Error("owned_capture_atlas_reservation_missing");
    const usage = atlasAllowanceUsage(reservations);
    if (Math.ceil(usage.cost * 1e6) + Math.ceil(command.maximum_cost_usd * 1e6) > Math.floor(authority.maximum_cost_usd * 1e6)
      || usage.requests + command.request_count > authority.maximum_requests)
      throw new Error("owned_capture_atlas_budget_exhausted");
    const admission = { ...command, schema_version: "paid_lane_admission.v1", status: "admitted", blockers: [],
      external_disclosure_allowed: true, sponsorship_digest: authority.authorization_digest,
      atlas_authorization_digest: authority.authorization_digest,
      provider_terms_reference: command.provider === "openai" ? authority.planner.provider_terms_reference : authority.provider_terms_reference,
      provider_retention: command.provider === "openai" ? "accepted_provider_terms" : authority.provider_retention,
      provider_training_authorized: false, expires_at_epoch: authority.expires_at_epoch };
    transaction.update(ref, { pipeline_owned_atlas_preparation: { ...control,
      reservations: { ...reservations, [key]: { command_digest: digest(command), admission } } } });
    return admission;
  }));
}

/** Accounting for an admitted inference survives revocation and expired terms.
 * Atlas holds stay fully reserved until a supported provider-billing receipt exists. */
export async function settleOwnedCaptureAtlasSpend(captureId: string,
  request: z.infer<typeof preparationSettlementRequest>) {
  identifier.parse(captureId);
  const command = preparationSettlementRequest.parse(request);
  if (!db) throw new Error("owned_capture_atlas_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("captureUploadSessions").doc(captureId);
    const record = (await transaction.get(ref)).data();
    const control = record?.pipeline_owned_atlas_preparation, key = command.allocation_binding_digest.slice(7);
    const row = control?.reservations?.[key];
    if (command.provider !== "openai" || !row || row.admission.provider !== "openai"
      || row.admission.resource_class !== "openai_api_candidate"
      || row.admission.task_context_digest !== command.task_context_digest
      || command.completed_request_count !== row.admission.request_count
      || command.provider_charge_amount_usd > row.admission.maximum_cost_usd)
      throw new Error("owned_capture_atlas_settlement_invalid");
    const settlement = { ...command, actual_cost_usd: command.provider_charge_amount_usd, status: "settled" };
    if (row.settlement) {
      if (digest(row.settlement) !== digest(settlement)) throw new Error("idempotency_conflict");
      return row.settlement;
    }
    transaction.update(ref, { pipeline_owned_atlas_preparation: { ...control,
      reservations: { ...control.reservations, [key]: { ...row, settlement } } } });
    return settlement;
  }));
}
