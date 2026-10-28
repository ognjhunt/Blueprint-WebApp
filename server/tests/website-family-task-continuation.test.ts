// @vitest-environment node
// Actual pure context/sponsorship functions; no private store, credentials or network.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeDigest as digest } from "../utils/crossRuntimeCanonical";
import { projectWebsiteTaskContext, projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { confirmFamilyTaskAnswer, familyAuthoringStatusSchema, familyTaskContextBasis,
  type FamilyTaskAnswer } from "../utils/siteTaskFamilyFacts";
import { familyTaskFactContinuationMatches, retainFamilyTaskFactContinuation } from "../utils/websiteFamilyTaskContinuation";
import { websiteSceneSponsorship, currentWebsitePreparationStatusContext } from "../utils/websiteSceneSponsorship";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
const sha = (c: string) => `sha256:${c.repeat(64)}`;
const NOW = 1000;
function fixture() {
  const record: any = { request: { consent_attestation: { granted: true, statement_version: "2026-09-18.v1",
    recorded_at_iso: "2026-09-29T00:00:00.000Z" } } };
  const brief: any = { requestId: "continuation", summary: "Press the red button", taskFamily: "general_task",
    proposed: [], unresolved: [], captureMode: "self_capture", draftedAtIso: "2026-09-29T00:00:00.000Z",
    draftedFrom: ["description"], confirmedAtIso: "2026-09-29T00:00:00.000Z", confirmedBy: "Fixture owner",
    operatorAnswers: {}, operatorUnknown: [], successCriteria: { successDefinition: "The button stays pressed",
      successRate: 99, cycleTimeSeconds: 1, unknown: false } };
  const rights = projectWebsiteCaptureRights(record);
  const context = projectWebsiteTaskContext(brief, rights, { purpose: "scene_preparation" });
  const next = { requirement_id: "press:target_id", stage_id: "press", category: "task_fact", owner: "task_owner",
    status: "required", question: "Which captured button?", quantity: "target_id", unit: null, authority_created: false };
  const raw: any = { schema_version: "website_family_authoring_status.v1", request_id: brief.requestId,
    scene_id: `site-${brief.requestId}`, capture_id: `walkthrough-${brief.requestId}`, pipeline_source_commit: "a".repeat(40),
    task_context_digest: context.context_digest, source_video_digest: sha("b"),
    task_description_digest: digest({ description: brief.summary }), task_success_criteria_digest: digest({ success_criteria: brief.successCriteria }),
    source_geometry_digest: sha("c"), task_masks_digest: sha("d"), authoring_request_digest: sha("e"),
    operations: [{ operation_id: "press", order: 1, task_family: "button_press", source_quote: brief.summary }],
    source_targets: [{ target_id: "red", label: "Red button" }], requirements: [next], next_action: next,
    claim_ceiling: "development_only", automatic_paid_execution_authorized: false };
  brief.familyTaskAuthoring = { status: familyAuthoringStatusSchema.parse({ ...raw, projection_digest: digest(raw) }), sourceFingerprint: sha("f") };
  record.website_scene_sponsorship = websiteSceneSponsorship({ requestId: brief.requestId, brief, record, now: NOW,
    purpose: "scene_preparation", expected_task_context_digest: context.context_digest });
  return { brief, record, rights, index: 0 };
}
function context(f: ReturnType<typeof fixture>, evidence: Record<string, unknown> = {}) {
  return projectWebsiteTaskContext(f.brief, projectWebsiteCaptureRights(f.record), { purpose: "scene_preparation", ...evidence });
}
type WithoutAuthoringDigest<T> = T extends unknown ? Omit<T, "authoringDigest"> : never;
function answer(f: ReturnType<typeof fixture>, command: WithoutAuthoringDigest<FamilyTaskAnswer>,
  options: { parentProven?: boolean; mutate?: (brief: any) => void } = {}) {
  const old = context(f);
  const status = f.brief.familyTaskAuthoring.status;
  status.task_context_digest = old.context_digest;
  if ("requirementId" in command) {
    status.next_action = { ...status.requirements[0], requirement_id: command.requirementId,
      quantity: command.requirementId.endsWith("target_id") ? "target_id" : "minimum_hold_seconds" };
    status.requirements = [status.next_action];
  }
  status.projection_digest = crossRuntimeArtifactDigest(status, "projection_digest");
  const previous = structuredClone(f.brief), confirmed = structuredClone(f.brief);
  confirmed.confirmedAtIso = `2026-09-29T00:00:${String(++f.index).padStart(2, "0")}.000Z`;
  options.mutate?.(confirmed);
  const newBasis = projectWebsiteTaskContext({ ...confirmed, familyTaskFacts: null }, f.rights, { purpose: "scene_preparation" });
  confirmed.familyTaskFacts = confirmFamilyTaskAnswer(previous, { authoringDigest: status.authoring_request_digest, ...command } as FamilyTaskAnswer,
    familyTaskContextBasis(newBasis), "Fixture owner", familyTaskContextBasis(old));
  const next = projectWebsiteTaskContext(confirmed, f.rights, { purpose: "scene_preparation" });
  let parentProven = options.parentProven ?? false;
  if (options.parentProven === undefined) parentProven = currentWebsitePreparationStatusContext({ requestId: previous.requestId,
    captureId: old.capture_id, brief: previous, record: f.record }).context_digest === old.context_digest;
  confirmed.familyTaskFactContinuation = retainFamilyTaskFactContinuation({ previousBrief: previous, brief: confirmed,
    previousContext: old, context: next, root: f.record.website_scene_sponsorship, parentContextProven: parentProven });
  f.brief = confirmed;
  return { previous, old, next, proof: confirmed.familyTaskFactContinuation };
}
function currentGrant(f: ReturnType<typeof fixture>, now = NOW + 1) {
  const current = context(f);
  return websiteSceneSponsorship({ requestId: f.brief.requestId, brief: f.brief, record: f.record, now,
    purpose: "scene_preparation", expected_task_context_digest: current.context_digest });
}
beforeEach(() => {
  vi.stubEnv("BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify({ owner: { user_id: "blueprint", organization_id: "blueprint" },
    upstream_max_spend_usd: 10, native_max_spend_usd: 5, max_total_spend_usd: 15, max_paid_attempts: 2,
    ttl_seconds: 3600, provider_terms_reference: sha("9") }));
});
afterEach(() => vi.unstubAllEnvs());

it("continues sequential answers, corrections, last-fact unknown and a later answer under the exact immutable root", () => {
  const f = fixture(), root = structuredClone(f.record.website_scene_sponsorship), history: any[] = [];
  const commands = [ { requirementId: "press:target_id", answer: "red" },
    { requirementId: "press:minimum_hold_seconds", answer: 0.2 },
    { operationId: "press", field: "hold_seconds", answer: 0.4 },
    { operationId: "press", field: "target", answer: null },
    { operationId: "press", field: "hold_seconds", answer: null },
    { requirementId: "press:target_id", answer: "red" } ] as const;
  for (const command of commands) {
    const prior = history.at(-1), { proof, old, next } = answer(f, command);
    history.push(structuredClone(proof));
    expect(proof.parent_task_context_digest).toBe(old.context_digest);
    expect(proof.task_context_digest).toBe(next.context_digest);
    expect(proof.parent_transition_digest).toBe(prior?.transition_digest ?? null);
    expect(proof.origin.authority_digest).toBe(root.authority_digest);
    expect(proof.origin.task_context_digest).toBe(root.task_context_digest);
    expect(currentGrant(f)).toMatchObject({ task_context_digest: next.context_digest,
      expires_at_epoch: root.expires_at_epoch, max_paid_attempts: root.max_paid_attempts,
      upstream_max_spend_usd: root.upstream_max_spend_usd, max_total_spend_usd: root.max_total_spend_usd,
      assessment_parent_authority_digest: root.authority_digest });
    expect(currentWebsitePreparationStatusContext({ requestId: f.brief.requestId, captureId: next.capture_id,
      brief: f.brief, record: f.record })).toEqual(next);
    expect(f.record.website_scene_sponsorship).toEqual(root);
  }
  expect(history[4].facts_digest).toBeNull();
  expect(history[4].fact_confirmation_digest).toBeNull();
  expect(f.brief.familyTaskFacts.payload.operations).toEqual([{ operation_id: "press", target_id: "red" }]);
});

it("does not manufacture ancestry for an unverified parent or a legacy fact version", () => {
  const f = fixture();
  answer(f, { requirementId: "press:target_id", answer: "red" }, { parentProven: false });
  expect(f.brief.familyTaskFactContinuation.origin).toBeNull();
  expect(() => currentGrant(f)).toThrow("website_scene_sponsorship_changed");
  delete f.brief.familyTaskFactContinuation;
  const next = answer(f, { requirementId: "press:minimum_hold_seconds", answer: 0.2 }, { parentProven: true });
  expect(next.proof.origin).toBeNull();
  expect(() => currentGrant(f)).toThrow("website_scene_sponsorship_changed");
});

it.each(["description", "success", "gates", "unknown_gates", "rights", "inventory", "source", "operation", "target", "capture"])(
  "refuses a retained proof after %s changes without rewriting its root or held data", change => {
    const f = fixture(); answer(f, { requirementId: "press:target_id", answer: "red" });
    f.record.website_preparation_reservations = { unknown: { admission: { maximum_cost_usd: 4 }, pending: true } };
    const root = structuredClone(f.record.website_scene_sponsorship), reservations = structuredClone(f.record.website_preparation_reservations);
    let evidence: any = {};
    if (change === "description") f.brief.summary += " then repeat";
    if (change === "success") f.brief.successCriteria.successRate = 98;
    if (change === "gates") f.brief.operatorAnswers.workload = "changed";
    if (change === "unknown_gates") f.brief.operatorUnknown = ["workload"];
    if (change === "rights") f.record.request.consent_attestation.revoked_at_iso = "2026-10-28T00:00:00Z";
    if (change === "inventory") evidence = { inventory: { items: [{ itemId: "new", label: "New object", locationNote: "tray",
      quantityHint: null, basis: "owner_stated", images: [] }] } };
    if (change === "source") f.brief.familyTaskAuthoring.sourceFingerprint = sha("1");
    if (change === "operation") f.brief.familyTaskAuthoring.status.operations[0].source_quote += " twice";
    if (change === "target") f.brief.familyTaskAuthoring.status.source_targets[0].label = "Blue button";
    if (change === "capture") evidence = { captureId: "walkthrough-other" };
    const source = f.brief.familyTaskAuthoring.status;
    source.projection_digest = crossRuntimeArtifactDigest(source, "projection_digest");
    const current = context(f, evidence);
    expect(familyTaskFactContinuationMatches(f.brief, current, f.record.website_scene_sponsorship)).toBe(false);
    expect(() => websiteSceneSponsorship({ requestId: f.brief.requestId, brief: f.brief, record: f.record,
      inventory: evidence.inventory, captureId: evidence.captureId, now: NOW + 1, purpose: "scene_preparation",
      expected_task_context_digest: current.context_digest })).toThrow();
    expect(f.record.website_scene_sponsorship).toEqual(root);
    expect(f.record.website_preparation_reservations).toEqual(reservations);
  });

it.each(["root", "origin_context", "parent", "current", "basis", "facts", "confirmation", "source", "operation"])(
  "refuses re-sealed malformed %s ancestry", fault => {
    const f = fixture(); answer(f, { requirementId: "press:target_id", answer: "red" });
    const proof = f.brief.familyTaskFactContinuation;
    if (fault === "root") proof.origin.authority_digest = sha("1");
    if (fault === "origin_context") proof.origin.context.operator_answers = { workload: "fabricated" };
    if (fault === "parent") proof.parent_task_context_digest = sha("1");
    if (fault === "current") proof.task_context_digest = sha("1");
    if (fault === "basis") proof.non_fact_context_digest = sha("1");
    if (fault === "facts") proof.facts_digest = sha("1");
    if (fault === "confirmation") proof.fact_confirmation_digest = sha("1");
    if (fault === "source") proof.source_fingerprint = sha("1");
    if (fault === "operation") proof.operation_binding_digest = sha("1");
    proof.transition_digest = crossRuntimeArtifactDigest(proof, "transition_digest");
    expect(familyTaskFactContinuationMatches(f.brief, context(f), f.record.website_scene_sponsorship)).toBe(false);
    expect(() => currentGrant(f)).toThrow("website_scene_sponsorship_changed");
  });

it("does not rebind a genuine gate edit and keeps original expiry after a valid fact change", () => {
  const f = fixture();
  const changed = answer(f, { requirementId: "press:target_id", answer: "red" }, {
    mutate: brief => { brief.operatorAnswers.workload = "changed"; } });
  expect(changed.proof.origin).toBeNull();
  expect(() => currentGrant(f)).toThrow("website_scene_sponsorship_changed");
  const valid = fixture(); answer(valid, { requirementId: "press:target_id", answer: "red" });
  expect(() => currentGrant(valid, valid.record.website_scene_sponsorship.expires_at_epoch)).toThrow("consent_expired");
  expect(currentWebsitePreparationStatusContext({ requestId: valid.brief.requestId, captureId: context(valid).capture_id,
    brief: valid.brief, record: valid.record })).toEqual(context(valid));
});

it("does not infer the missing legacy root context body or enable the optional contract", () => {
  const f = fixture();
  answer(f, { requirementId: "press:target_id", answer: "red" });
  delete f.brief.familyTaskFactContinuation.origin.context;
  expect(familyTaskFactContinuationMatches(f.brief, context(f), f.record.website_scene_sponsorship)).toBe(false);
  const valid = fixture(); answer(valid, { requirementId: "press:target_id", answer: "red" });
  vi.stubEnv("BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED", "false");
  expect(familyTaskFactContinuationMatches(valid.brief, context(valid), valid.record.website_scene_sponsorship)).toBe(false);
});

it("returns a bounded source-conflict code for malformed private source metadata", () => {
  const f = fixture();
  f.brief.familyTaskAuthoring.sourceFingerprint = "invalid-private-source-metadata";
  expect(() => answer(f, { requirementId: "press:target_id", answer: "red" }, { parentProven: false }))
    .toThrow("family_task_facts_source_changed");
});
