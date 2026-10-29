// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

const state = vi.hoisted(() => ({ record: null as any, writes: [] as any[], collections: [] as string[] }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: {
  collection: (name: string) => { state.collections.push(name); return { doc: (id: string) => ({ id }) }; },
  runTransaction: async (callback: any) => callback({
    get: async (ref: any) => ({ data: () => ref.id === state.record?.session_id ? structuredClone(state.record) : undefined }),
    update: (_ref: any, value: any) => { state.writes.push(structuredClone(value)); Object.assign(state.record, structuredClone(value)); },
  }),
} }));
vi.mock("../utils/taskEvaluationSceneIntake", () => ({ sceneProviderTerms: () => ({
  world_labs_atlas: { digest: "sha256:" + "a".repeat(64) }, openai: { digest: "sha256:" + "b".repeat(64) },
}) }));
vi.mock("../utils/websiteAtlasAuthorization", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteAtlasAuthorization")>(),
  websiteAtlasRuntimePolicy: () => ({ fixture_scope: "hermetic_pricing_not_live_admission" }),
}));

import { loadOwnedCaptureAtlasConfiguration, reserveOwnedCaptureAtlasSpend,
  settleOwnedCaptureAtlasSpend } from "../utils/ownedCaptureAtlasPreparation";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-plan.json", import.meta.url), "utf8"));
const hash = (letter: string) => "sha256:" + letter.repeat(64);
let binding: any, authorization: any, company: any;
const configureCompany = () => vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", JSON.stringify([company]));
const authorize = () => loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding,
  { ownerUid: state.record.owner_user_id, command: authorization });
const spend = (key = "c", cost = 1, provider = "world_labs_atlas") => ({
  task_context_digest: binding.task_context_digest, source_video_digest: binding.source_video_digest,
  allocation_binding_digest: hash(key), provider, resource_class: provider === "openai" ? "openai_api_candidate"
    : provider === "world_labs_atlas" ? "provider_reconstruction_api" : "evaluator_api",
  maximum_cost_usd: cost, request_count: 1,
});

beforeEach(() => {
  vi.unstubAllEnvs(); state.writes = []; state.collections = [];
  const value = structuredClone(fixture), plan = value.plan, context = plan.source_context;
  state.record = value.session;
  // This is a derived hermetic admission fixture, never a production approval.
  state.record.request.governance.provider_constraints.external_processing_allowed = true;
  state.record.request.governance.provider_constraints.automatic_model_inference_allowed = false;
  state.record.request.permitted_reconstruction_providers = ["local", "world_labs_atlas", "openai"];
  context.governance = structuredClone(state.record.request.governance);
  context.permitted_reconstruction_providers = [...state.record.request.permitted_reconstruction_providers];
  context.context_digest = crossRuntimeArtifactDigest(context, "context_digest");
  plan.plan_digest = crossRuntimeArtifactDigest(plan, "plan_digest");
  state.record.pipeline_owned_atlas_preparation = {
    schema_version: "capture_owned_atlas_preparation_control.v1", requests: {}, plans: { [plan.plan_id]: plan },
  };
  binding = { plan_id: plan.plan_id, task_context_digest: context.context_digest, source_video_digest: plan.source_video_digest };
  authorization = { ...binding, maximum_cost_usd: 3, maximum_requests: 3,
    provider_identity: { account_id: "acct_hermetic", project_id: "project_hermetic" } };
  company = { schema_version: "website_atlas_authorization.v1", request_id: plan.plan_id,
    capture_id: context.capture_id, task_context_digest: context.context_digest,
    source_video_digest: plan.source_video_digest, provider_terms_reference: hash("a"),
    accepted_by: state.record.owner_user_id, approval_reference: "hermetic-explicit-human-approval-fixture",
    private_processing_authorized: true, provider_training_authorized: false,
    provider_retention: "account_does_not_retain", maximum_cost_usd: 10, maximum_requests: 8,
    expires_at_epoch: Math.floor(Date.now() / 1000) + 3600, claim_scope: "development_only",
    planner: { provider: "openai", provider_terms_reference: hash("b"), private_processing_authorized: true,
      provider_training_authorized: false, approval_reference: "hermetic-planner-approval-fixture" } };
  configureCompany();
});

it("inspection and reservations never create the first source allowance", async () => {
  await expect(loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding)).rejects.toThrow("authorization_required");
  await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend())).rejects.toThrow("authorization_required");
  expect(state.writes).toEqual([]);
  expect(state.collections.every(name => name === "captureUploadSessions")).toBe(true);
});

it("retains an explicit finite source allowance without changing source consent or automatic inference", async () => {
  const original = structuredClone(state.record.request), result = await authorize();
  expect(result.dispatch_authorized).toBe(false);
  expect(result.authority.authorization_basis).toBe("explicit_company_source_approval");
  expect(result.authority.provider_identity).toEqual(authorization.provider_identity);
  expect(result.authority.maximum_cost_usd).toBe(3);
  expect(state.record.request).toEqual(original);
  expect(state.record.request.governance.provider_constraints.automatic_model_inference_allowed).toBe(false);
  await authorize(); expect(state.writes).toHaveLength(1);
});

it.each(["missing", "automatic_only", "training", "terms", "other_owner"])(
  "refuses %s company authority instead of borrowing a website preview grant", async reason => {
    if (reason === "missing" || reason === "automatic_only") vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "[]");
    if (reason === "automatic_only") vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", JSON.stringify({
      schema_version: "website_atlas_grant_policy.v1", maximum_cost_usd: 100, maximum_requests: 32,
      validity_seconds: 3600, provider_retention: "account_does_not_retain", approved_by: "fixture",
      approval_reference: "unrelated-automatic-website-policy" }));
    if (reason === "training") { company.provider_training_authorized = true; configureCompany(); }
    if (reason === "terms") { company.provider_terms_reference = hash("f"); configureCompany(); }
    if (reason === "other_owner") { company.accepted_by = "another-owner"; configureCompany(); }
    await expect(authorize()).rejects.toThrow(); expect(state.writes).toEqual([]);
  });

it("does not let another caller issue an owner's allowance or exceed the company cap", async () => {
  await expect(loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding,
    { ownerUid: "another-owner", command: authorization })).rejects.toThrow("owner_mismatch");
  await expect(loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding,
    { ownerUid: state.record.owner_user_id, command: { ...authorization, maximum_cost_usd: 10.000001 } }))
    .rejects.toThrow("company_allowance_exceeded");
  expect(state.writes).toEqual([]);
});

it("never silently expands, renews, or moves an existing allowance to another provider project", async () => {
  await authorize(); const original = structuredClone(state.record.pipeline_owned_atlas_preparation.allowance);
  for (const changed of [{ maximum_cost_usd: 4 }, { maximum_requests: 4 },
    { provider_identity: { account_id: "acct_other", project_id: "project_other" } }]) {
    await expect(loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding,
      { ownerUid: state.record.owner_user_id, command: { ...authorization, ...changed } }))
      .rejects.toThrow("allowance_binding_conflict");
  }
  expect(state.record.pipeline_owned_atlas_preparation.allowance).toEqual(original);
  state.record.pipeline_owned_atlas_preparation.allowance.expires_at_epoch = Date.now() / 1000 - 1;
  company.expires_at_epoch += 7200; configureCompany();
  await expect(authorize()).rejects.toThrow("allowance_expired_or_invalid");
  expect(state.writes).toHaveLength(1);
});

it("reserves exactly once and holds the entire uncertain cost against the same source cap", async () => {
  await authorize();
  expect((await reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("c", 1.8))).status).toBe("admitted");
  expect((await reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("c", 1.8))).status).toBe("already_reserved");
  await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("c", 1.7))).rejects.toThrow("idempotency_conflict");
  await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("d", 1.3))).rejects.toThrow("budget_exhausted");
  const current = await loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding);
  expect(current.reserved_or_settled_cost_usd).toBe(1.8); expect(current.remaining_cost_usd).toBeCloseTo(1.2);
  expect(state.writes).toHaveLength(2);
});

it.each(["revocation", "task", "provider", "malformed_allowance"])(
  "reopens %s before returning even an existing reservation", async reason => {
    await authorize(); await reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend());
    if (reason === "revocation") state.record.capture_access = { future_processing_allowed: false };
    if (reason === "task") state.record.request.known_task_specification.description += " skip the stopping step";
    if (reason === "provider") state.record.request.permitted_reconstruction_providers = ["local"];
    if (reason === "malformed_allowance") state.record.pipeline_owned_atlas_preparation.allowance.maximum_cost_usd = "1000000";
    await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend())).rejects.toThrow();
    expect(state.writes).toHaveLength(2);
  });

it("cannot inherit Meta or Google disclosure from the Atlas/OpenAI source approval", async () => {
  await authorize();
  for (const provider of ["meta", "google"])
    await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding,
      { ...spend("c", 1, provider), atlas_auxiliary: true })).rejects.toThrow("provider_not_authorized");
  expect(state.writes).toHaveLength(1);
});

it.each(["authorization", "reservation"])(
  "local-only privacy overrides external-processing/provider flags during %s", async operation => {
    if (operation === "reservation") await authorize();
    const plan = state.record.pipeline_owned_atlas_preparation.plans[binding.plan_id];
    state.record.request.governance.privacy = "restricted_local_only";
    plan.source_context.governance.privacy = "restricted_local_only";
    plan.source_context.context_digest = crossRuntimeArtifactDigest(plan.source_context, "context_digest");
    plan.plan_digest = crossRuntimeArtifactDigest(plan, "plan_digest");
    binding.task_context_digest = plan.source_context.context_digest;
    authorization.task_context_digest = binding.task_context_digest;
    company.task_context_digest = binding.task_context_digest; configureCompany();
    const writes = state.writes.length;
    await expect(operation === "authorization" ? authorize()
      : reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend()))
      .rejects.toThrow("privacy_restricts_external_processing");
    expect(state.writes).toHaveLength(writes);
  });

it("settles completed admitted inference after revocation without granting any new processing", async () => {
  await authorize(); await reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("c", 1.5, "openai"));
  state.record.capture_access = { future_processing_allowed: false };
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "[]");
  const command = { task_context_digest: binding.task_context_digest, allocation_binding_digest: hash("c"),
    provider: "openai" as const, completed_request_count: 1, provider_charge_amount_usd: 0.25, usage_receipt_digest: hash("d") };
  expect((await settleOwnedCaptureAtlasSpend(state.record.session_id, command)).actual_cost_usd).toBe(0.25);
  await settleOwnedCaptureAtlasSpend(state.record.session_id, command); expect(state.writes).toHaveLength(3);
  await expect(settleOwnedCaptureAtlasSpend(state.record.session_id, { ...command, provider_charge_amount_usd: 0.3 }))
    .rejects.toThrow("idempotency_conflict");
  await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("e"))).rejects.toThrow();
});

it("does not replenish the source allowance when another compatible task plan is retained", async () => {
  await authorize(); await reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("c", 2.5));
  const plan = structuredClone(fixture.plan);
  plan.plan_id = "reconstruction-atlas-" + "f".repeat(24);
  plan.source_context = structuredClone(state.record.pipeline_owned_atlas_preparation.plans[binding.plan_id].source_context);
  plan.source_context.request_id = plan.plan_id; plan.requested_claim_types = ["task_discovery", "navigation_clearance"];
  plan.source_context.context_digest = crossRuntimeArtifactDigest(plan.source_context, "context_digest");
  plan.plan_digest = crossRuntimeArtifactDigest(plan, "plan_digest");
  state.record.pipeline_owned_atlas_preparation.plans[plan.plan_id] = plan;
  binding = { ...binding, plan_id: plan.plan_id, task_context_digest: plan.source_context.context_digest };
  company.request_id = binding.plan_id; company.task_context_digest = binding.task_context_digest; configureCompany();
  const result = await loadOwnedCaptureAtlasConfiguration(state.record.session_id, binding);
  expect(result.remaining_cost_usd).toBe(0.5); expect(result.remaining_requests).toBe(2);
  await expect(reserveOwnedCaptureAtlasSpend(state.record.session_id, binding, spend("d", 0.6))).rejects.toThrow("budget_exhausted");
  expect(state.writes).toHaveLength(2);
});
