// @vitest-environment node
import { writeFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeCanonicalJson, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { confirmFamilyTaskAnswer, currentFamilyTaskFacts, familyAuthoringStatusSchema,
  familyTaskAnswerSchema, familyTaskContextBasis, projectFamilyTaskQuestion,
  familyTaskQuestionBinding, projectFamilyTaskDetails,
  type FamilyAuthoringStatus } from "../utils/siteTaskFamilyFacts";
import type { SiteTaskBriefRecord } from "../utils/siteTaskBrief";
import pipelineProjection from "./fixtures/pipeline-family-authoring-status.v1.json";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
const sha = (letter = "a") => "sha256:" + letter.repeat(64);
const rights = { derived_scene_generation_allowed: true, data_licensing_allowed: false,
  capture_contributor_payout_eligible: false, consent_status: "granted", consent_revoked: false,
  consent_scope: ["derived_scene_generation", "robot_evaluation"], statement_version: "fixture",
  recorded_at_iso: "2026-10-28T12:00:00.000Z" };

function fixture() {
  const brief: SiteTaskBriefRecord = { requestId: "family-facts", summary: "Press the red button — café 🦾.",
    taskFamily: "general_task", proposed: [], unresolved: [], captureMode: "self_capture", draftedAtIso: "2026-10-28T12:00:00.000Z",
    draftedFrom: ["description"], confirmedAtIso: "2026-10-28T12:00:00.000Z", confirmedBy: "Site owner",
    operatorAnswers: {}, operatorUnknown: [], successCriteria: {
      successDefinition: "The red button remains pressed — café 🦾.", successRate: 1e-7, cycleTimeSeconds: 1.0, unknown: false } };
  const context = projectWebsiteTaskContext(brief, rights);
  const next = { requirement_id: "operation-001:minimum_hold_seconds", stage_id: "operation-001",
    category: "task_fact" as const, owner: "task_owner" as const, status: "required" as const,
    question: "How long must the pressed state remain stable?", quantity: "minimum_hold_seconds", unit: "s", authority_created: false as const };
  const value = { schema_version: "website_family_authoring_status.v1" as const,
    request_id: brief.requestId, scene_id: `site-${brief.requestId}`, capture_id: `walkthrough-${brief.requestId}`,
    pipeline_source_commit: "a".repeat(40), task_context_digest: context.context_digest,
    source_video_digest: sha("e"), task_description_digest: crossRuntimeDigest({ description: context.description }),
    task_success_criteria_digest: crossRuntimeDigest({ success_criteria: context.success_criteria }),
    source_geometry_digest: sha("b"), task_masks_digest: sha("c"), authoring_request_digest: sha("d"),
    operations: [{ operation_id: "operation-001", order: 1, task_family: "button_press", source_quote: brief.summary }],
    source_targets: [{ target_id: "red", label: "Red button" }], requirements: [next], next_action: next,
    claim_ceiling: "development_only" as const, automatic_paid_execution_authorized: false as const };
  const status = familyAuthoringStatusSchema.parse({ ...value, projection_digest: crossRuntimeDigest(value) });
  brief.familyTaskAuthoring = { status, sourceFingerprint: sha("f") };
  return { brief, context, status };
}
function reseal(status: FamilyAuthoringStatus) {
  status.projection_digest = crossRuntimeArtifactDigest(status, "projection_digest");
  return status;
}
beforeEach(() => vi.stubEnv("BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED", "true"));
afterEach(() => vi.unstubAllEnvs());

it("accepts unchanged bytes emitted by the actual Python family-authoring projection", () => {
  expect(familyAuthoringStatusSchema.parse(pipelineProjection)).toEqual(pipelineProjection);
});

it.each(["digest", "action", "duplicate_operation", "order", "duplicate_target", "owner", "raw_path", "oversized"])(
  "refuses a malformed %s authoring projection before it becomes a question", change => {
    const {status} = fixture(); const value: any = structuredClone(status);
    if (change === "digest") value.source_video_digest = sha("9");
    if (change === "action") value.next_action.question = "An unrelated action";
    if (change === "duplicate_operation") value.operations.push({...value.operations[0], order: 2});
    if (change === "order") value.operations[0].order = 2;
    if (change === "duplicate_target") value.source_targets.push(value.source_targets[0]);
    if (change === "owner") value.requirements[0].owner = "runtime_operator";
    if (change === "raw_path") value.raw_report_path = "/private/source.json";
    if (change === "oversized") value.requirements = Array.from({length: 65}, (_, i) => ({...value.requirements[0], requirement_id: `fact-${i}`}));
    if (change !== "digest") value.projection_digest = crossRuntimeArtifactDigest(value, "projection_digest");
    expect(familyAuthoringStatusSchema.safeParse(value).success).toBe(false);
  });

it("uses the producer's Unicode codepoint bounds for labels rather than rejecting a valid supplementary character", () => {
  const {status} = fixture(); status.source_targets[0].label = "🦾".repeat(200); reseal(status);
  expect(familyAuthoringStatusSchema.safeParse(status).success).toBe(true);
  status.source_targets[0].label += "🦾"; reseal(status);
  expect(familyAuthoringStatusSchema.safeParse(status).success).toBe(false);
});

it("emits the actual flagged WebApp context and exact source-bound facts for Python contract validation", () => {
  const { brief, context, status } = fixture();
  const facts = confirmFamilyTaskAnswer(brief, { authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: 1e-7 }, familyTaskContextBasis(context), "Site owner");
  expect(facts?.payload.operations).toEqual([{ operation_id: "operation-001", minimum_hold_seconds: 1e-7 }]);
  brief.familyTaskFacts = facts;
  const emitted = projectWebsiteTaskContext(brief, rights);
  expect(emitted).toMatchObject({ canonicalization: "rfc8785",
    operator_answers: { family_task_facts: { confirmed: true, canonicalization: "rfc8785" } } });
  expect(emitted.context_digest).toBe(crossRuntimeArtifactDigest(emitted, "context_digest"));
  expect(facts?.payload.facts_digest).toBe(crossRuntimeArtifactDigest(facts!.payload, "facts_digest"));
  const vector = { "😀": "astral", "\uE000": "BMP", "é": "composed", "e\u0301": "decomposed", tiny: 1e-7, integral: 1.0 };
  if (process.env.BLUEPRINT_AUT12_CONTEXT_FIXTURE_PATH) writeFileSync(process.env.BLUEPRINT_AUT12_CONTEXT_FIXTURE_PATH,
    JSON.stringify({ evidence_class: "hermetic_fixture_no_source_or_runtime_admission", context: emitted, facts: facts?.payload,
      canonicalizer_vector: { value: vector, canonical_json: crossRuntimeCanonicalJson(vector), digest: crossRuntimeDigest(vector) } }, null, 2));
});

it("keeps all unflagged legacy context bytes and default rollout behavior unchanged", () => {
  const { brief, context } = fixture();
  vi.stubEnv("BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED", "false");
  const { context_digest, ...body } = context;
  expect(context_digest).toBe(canonicalArtifactDigest(body, "context_digest"));
  expect(projectWebsiteTaskContext(brief, rights)).toEqual(context);
  expect(projectFamilyTaskQuestion(brief, brief.familyTaskAuthoring!.status)).toBeNull();
});

it.each(["source_measurement", "runtime_integration"] as const)("never asks customers an engineering %s question", category => {
  const { brief, status } = fixture();
  status.requirements[0] = { ...status.requirements[0], category,
    owner: category === "source_measurement" ? "scene_preparation" : "runtime_operator" };
  status.next_action = status.requirements[0]; reseal(status);
  expect(projectFamilyTaskQuestion(brief, status)).toBeNull();
});

it.each(["minimum_button_travel_m", "maximum_contact_force_n", "joint_position"])("never asks customers to author %s", quantity => {
  const { brief, status } = fixture();
  status.requirements[0].quantity = quantity; status.next_action = status.requirements[0]; reseal(status);
  expect(projectFamilyTaskQuestion(brief, status)).toBeNull();
});

it.each(["capture", "description", "success", "context", "source", "operations", "targets"])("invalidates confirmed facts after %s changes without deleting history", change => {
  const { brief, context, status } = fixture();
  const record = confirmFamilyTaskAnswer(brief, { authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: 0.2 }, familyTaskContextBasis(context), "Site owner")!;
  brief.familyTaskFacts = record; const original = structuredClone(record);
  const value = familyTaskContextBasis(context);
  if (change === "capture") value.capture_id = "walkthrough-other";
  if (change === "description") value.description += "changed";
  if (change === "success") value.success_criteria.successRate = 99;
  if (change === "context") value.operator_answers.taskShape = "different";
  if (change === "source") brief.familyTaskAuthoring!.sourceFingerprint = sha("1");
  if (change === "operations") status.operations[0].source_quote += "changed";
  if (change === "targets") status.source_targets[0].label = "Different button";
  reseal(status);
  expect(currentFamilyTaskFacts(brief, value)).toBeNull();
  expect(brief.familyTaskFacts).toEqual(original);
});

it.each(["wrong-source", "wrong-target", "engineering-fields"])("refuses %s corrections rather than inventing facts", kind => {
  const { brief, context, status } = fixture();
  const answer: any = { authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: kind === "wrong-target" ? "guessed-target" : 0.2 };
  if (kind === "wrong-source") answer.authoringDigest = sha("9");
  if (kind === "engineering-fields") answer.joint_pose = [0, 0, 0];
  expect(() => confirmFamilyTaskAnswer(brief, answer, familyTaskContextBasis(context), "Site owner")).toThrow();
  expect(brief.familyTaskFacts).toBeUndefined();
});

it("retains confirmed task intent across a new preparation generation with unchanged source operations and targets", () => {
  const {brief, context, status} = fixture();
  brief.familyTaskFacts = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: 0.2}, familyTaskContextBasis(context), "Site owner");
  const emitted = projectWebsiteTaskContext(brief, rights);
  status.authoring_request_digest = sha("1"); status.task_context_digest = emitted.context_digest;
  status.source_geometry_digest = sha("2"); status.task_masks_digest = sha("3"); reseal(status);
  expect(projectWebsiteTaskContext(brief, rights)).toEqual(emitted);
});

it("retains an earlier confirmed target when the next hold fact is unknown, without inventing its duration", () => {
  const {brief, context, status} = fixture();
  const original = status.requirements[0];
  status.requirements[0] = {...original, requirement_id: "operation-001:target_id", quantity: "target_id"};
  status.next_action = status.requirements[0]; reseal(status);
  brief.familyTaskFacts = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action.requirement_id, answer: "red"}, familyTaskContextBasis(context), "Site owner");
  status.requirements[0] = original; status.next_action = original; reseal(status);
  const retained = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: original.requirement_id, answer: null}, familyTaskContextBasis(context), "Site owner");
  expect(retained?.payload.operations).toEqual([{operation_id: "operation-001", target_id: "red"}]);
});

it("does not repeat an unknown task fact merely because preparation generated a new receipt", () => {
  const {brief, status} = fixture();
  brief.familyTaskDeferred = {authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, bindingDigest: familyTaskQuestionBinding(brief.familyTaskAuthoring!)};
  status.authoring_request_digest = sha("1"); status.task_context_digest = sha("2"); reseal(status);
  expect(projectFamilyTaskQuestion(brief, status)?.deferred).toBe(true);
  status.source_video_digest = sha("3"); reseal(status);
  expect(projectFamilyTaskQuestion(brief, status)?.deferred).toBe(false);
});

it("preserves the exact declared order when two operation facts are answered in reverse order", () => {
  const {brief, context, status} = fixture();
  status.operations.push({operation_id: "operation-002", order: 2, task_family: "button_press", source_quote: "Press the green button"});
  status.source_targets.push({target_id: "green", label: "Green button"});
  const first = status.requirements[0], second = {...first, requirement_id: "operation-002:minimum_hold_seconds", stage_id: "operation-002"};
  status.requirements.push(second); status.next_action = second; reseal(status);
  brief.familyTaskFacts = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: second.requirement_id, answer: 0.4}, familyTaskContextBasis(context), "Site owner");
  status.next_action = first; reseal(status);
  const result = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: first.requirement_id, answer: 0.2}, familyTaskContextBasis(context), "Site owner");
  expect(result?.payload.operations).toEqual([
    {operation_id: "operation-001", minimum_hold_seconds: 0.2}, {operation_id: "operation-002", minimum_hold_seconds: 0.4}]);
});

it("corrects a previously confirmed outcome through the same source-bound flow after missing requirements are complete", () => {
  const {brief, context, status} = fixture();
  brief.familyTaskFacts = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: 0.2}, familyTaskContextBasis(context), "Site owner");
  const original = structuredClone(brief.familyTaskFacts);
  const expected = projectWebsiteTaskContext(brief, rights);
  status.requirements = []; status.next_action = null; status.authoring_request_digest = sha("1");
  status.task_context_digest = expected.context_digest; reseal(status);
  const current = projectWebsiteTaskContext(brief, rights);
  expect(projectFamilyTaskQuestion(brief, status)).toBeNull();
  expect(projectFamilyTaskDetails(brief, current, status)).toMatchObject([{operationId: "operation-001", holdSeconds: 0.2}]);
  const corrected = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    operationId: "operation-001", field: "hold_seconds", answer: 0.4}, familyTaskContextBasis(current), "Site owner");
  expect(corrected?.payload.operations).toEqual([{operation_id: "operation-001", minimum_hold_seconds: 0.4}]);
  expect(brief.familyTaskFacts).toEqual(original);
  expect(() => confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    operationId: "operation-001", field: "target", answer: "red"}, familyTaskContextBasis(current), "Site owner"))
    .toThrow("family_task_facts_source_changed");
});

it("can correct a previously confirmed outcome to unknown without replacing it with a numeric default", () => {
  const {brief, context, status} = fixture();
  brief.familyTaskFacts = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    requirementId: status.next_action!.requirement_id, answer: 0.2}, familyTaskContextBasis(context), "Site owner");
  const original = structuredClone(brief.familyTaskFacts);
  const unknown = confirmFamilyTaskAnswer(brief, {authoringDigest: status.authoring_request_digest,
    operationId: "operation-001", field: "hold_seconds", answer: null}, familyTaskContextBasis(context), "Site owner");
  expect(unknown).toBeNull(); expect(brief.familyTaskFacts).toEqual(original);
});

it("rejects a command that mixes a missing-fact answer with an unrelated correction", () => {
  expect(familyTaskAnswerSchema.safeParse({authoringDigest: sha(), requirementId: "known",
    operationId: "operation-001", field: "hold_seconds", answer: 0.2}).success).toBe(false);
});

it.each([NaN, Infinity, -1, 86401])( "refuses invalid hold duration %s", answer => {
  expect(familyTaskAnswerSchema.safeParse({ authoringDigest: sha(), requirementId: "known", answer }).success).toBe(false);
});
