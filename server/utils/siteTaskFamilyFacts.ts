/** Source-bound owner task intent on the existing brief; no measurement or run authority. */
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { FamilyTaskDetail, FamilyTaskQuestion } from "../../client/src/types/siteTaskFamilyFacts";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const text = (limit: number) => z.string().refine(value => Boolean(value.trim()) && [...value].length <= limit);
const requirement = z.object({ requirement_id: text(200), stage_id: text(200).nullable(),
  category: z.enum(["task_fact", "source_measurement", "runtime_integration"]),
  owner: z.enum(["task_owner", "scene_preparation", "runtime_operator"]), status: z.literal("required"),
  question: text(500), quantity: text(200).nullable(), unit: text(48).nullable(),
  authority_created: z.literal(false) }).strict();
export const familyAuthoringStatusSchema = z.object({
  schema_version: z.literal("website_family_authoring_status.v1"), request_id: id, scene_id: id, capture_id: id,
  pipeline_source_commit: z.string().regex(/^[a-f0-9]{40}$/), task_context_digest: sha,
  source_video_digest: sha, task_description_digest: sha, task_success_criteria_digest: sha,
  source_geometry_digest: sha, task_masks_digest: sha, authoring_request_digest: sha,
  operations: z.array(z.object({ operation_id: text(200), order: z.number().int().min(1).max(8),
    task_family: text(48), source_quote: text(1000) }).strict()).max(8),
  source_targets: z.array(z.object({ target_id: text(200), label: text(200) }).strict()).max(32),
  requirements: z.array(requirement).max(64), next_action: requirement.nullable(),
  claim_ceiling: z.literal("development_only"), automatic_paid_execution_authorized: z.literal(false),
  projection_digest: sha,
}).strict().superRefine((value, ctx) => {
  if (Buffer.byteLength(JSON.stringify(value)) > 65536 || value.scene_id !== `site-${value.request_id}`
    || value.operations.some((row, index) => row.order !== index + 1)
    || new Set(value.operations.map(row => row.operation_id)).size !== value.operations.length
    || new Set(value.source_targets.map(row => row.target_id)).size !== value.source_targets.length
    || new Set(value.requirements.map(row => row.requirement_id)).size !== value.requirements.length
    || value.requirements.some(row => row.owner !== ({ task_fact: "task_owner", source_measurement: "scene_preparation",
      runtime_integration: "runtime_operator" } as const)[row.category])
    || value.next_action !== null && !value.requirements.some(row => crossRuntimeDigest(row) === crossRuntimeDigest(value.next_action))
    || crossRuntimeArtifactDigest(value, "projection_digest") !== value.projection_digest)
    ctx.addIssue({ code: "custom", message: "Family authoring source projection mismatch" });
});
export type FamilyAuthoringStatus = z.infer<typeof familyAuthoringStatusSchema>;
const ownerAnswer = z.union([text(200), z.number().finite().min(0).max(86400), z.null()]);
export const familyTaskAnswerSchema = z.union([
  z.object({ authoringDigest: sha, requirementId: text(200), answer: ownerAnswer }).strict(),
  z.object({ authoringDigest: sha, operationId: text(200), field: z.enum(["target", "hold_seconds"]), answer: ownerAnswer }).strict(),
]);
export type FamilyTaskAnswer = z.infer<typeof familyTaskAnswerSchema>;
const operationFact = z.object({ operation_id: text(200), target_id: text(200).optional(),
  minimum_hold_seconds: z.number().finite().min(0).max(86400).optional() }).strict();
const factsSchema = z.object({ schema_version: z.literal("website_family_task_facts.v1"),
  canonicalization: z.literal("rfc8785"), capture_id: id, source_video_digest: sha,
  task_description_digest: sha, task_success_criteria_digest: sha, confirmed: z.literal(true),
  confirmation_reference: z.string().min(1).max(300), operations: z.array(operationFact).min(1).max(8), facts_digest: sha,
}).strict();
export interface FamilyTaskFactConfirmation {
  payload: z.infer<typeof factsSchema>;
  context_basis_digest: string;
  source_fingerprint: string;
  operation_binding_digest: string;
  confirmation_digest: string;
}
export interface FamilyTaskAuthoringRecord { status: FamilyAuthoringStatus; sourceFingerprint: string }
export interface FamilyTaskBriefState {
  familyTaskAuthoring?: FamilyTaskAuthoringRecord | null;
  familyTaskFacts?: FamilyTaskFactConfirmation | null;
  familyTaskDeferred?: { authoringDigest: string; requirementId?: string; operationId?: string;
    field?: "target" | "hold_seconds"; bindingDigest: string } | null;
}
export const familyTaskFactsEnabled = () => process.env.BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED === "true";
export function familyTaskContextBasis(context: Record<string, any>) {
  const { context_digest: _digest, canonicalization: _mode, ...value } = context;
  return { ...value, operator_answers: Object.fromEntries(Object.entries(value.operator_answers ?? {})
    .filter(([key]) => key !== "family_task_facts")) };
}
export const familyTaskOperationBinding = (status: FamilyAuthoringStatus) => crossRuntimeDigest({
  operations: status.operations, source_targets: status.source_targets });
export const familyTaskQuestionBinding = (source: FamilyTaskAuthoringRecord) => crossRuntimeDigest({
  capture_id: source.status.capture_id, source_video_digest: source.status.source_video_digest,
  task_description_digest: source.status.task_description_digest,
  task_success_criteria_digest: source.status.task_success_criteria_digest,
  operations: familyTaskOperationBinding(source.status), source_fingerprint: source.sourceFingerprint });

/** Same immutable source fields as preparation's existing CAS; processing status is excluded. */
export function familyTaskCaptureFingerprint(session: Record<string, any>) {
  return crossRuntimeDigest({ pending: session.browser_pending_delivery ?? null,
    stored: session.browser_stored_upload ?? null, reservation: session.browser_upload_reservation ?? null,
    identity: session.immutable_upload_identity ?? null, bundle: session.site_capture_bundle ?? null });
}
function sourceMatches(status: FamilyAuthoringStatus, context: Record<string, any>) {
  return status.request_id === context.request_id && status.capture_id === context.capture_id
    && status.task_description_digest === crossRuntimeDigest({ description: context.description })
    && status.task_success_criteria_digest === crossRuntimeDigest({ success_criteria: context.success_criteria ?? null });
}
export function projectFamilyTaskQuestion(brief: FamilyTaskBriefState, status: FamilyAuthoringStatus): FamilyTaskQuestion | null {
  if (!familyTaskFactsEnabled()) return null;
  const next = status.next_action;
  if (!next || next.category !== "task_fact" || next.owner !== "task_owner") return null;
  const kinds: Record<string, FamilyTaskQuestion["kind"]> = {
    target_id: "target", minimum_hold_seconds: "hold_seconds", ordered_operations: "task_intent" };
  const kind = kinds[next.quantity ?? next.requirement_id];
  if (!kind) return null; // Engineering and unsupported facts never become customer questions.
  const operation = status.operations.find(row => row.operation_id === next.stage_id);
  if (kind !== "task_intent" && !operation) return null;
  return { authoringDigest: status.authoring_request_digest, requirementId: next.requirement_id,
    operationId: operation?.operation_id ?? null, operationLabel: operation?.source_quote ?? null,
    kind, question: next.question, targets: kind === "target"
      ? status.source_targets.map(row => ({ targetId: row.target_id, label: row.label })) : [],
    deferred: Boolean(brief.familyTaskAuthoring && (brief.familyTaskDeferred?.requirementId === next.requirement_id
      || brief.familyTaskDeferred?.operationId === operation?.operation_id && brief.familyTaskDeferred?.field === kind)
      && brief.familyTaskDeferred.bindingDigest === familyTaskQuestionBinding({ ...brief.familyTaskAuthoring, status })) };
}
/** Invalid/stale optional facts disappear from current context, but retained history is untouched. */
export function currentFamilyTaskFacts(brief: FamilyTaskBriefState, context: Record<string, any>) {
  if (!familyTaskFactsEnabled()) return null;
  try {
    const record = brief.familyTaskFacts, source = brief.familyTaskAuthoring;
    if (!record || !source || !familyAuthoringStatusSchema.safeParse(source.status).success) return null;
    const payload = factsSchema.parse(record.payload);
    const selected = new Set(payload.operations.map(row => row.operation_id));
    if (selected.size !== payload.operations.length || crossRuntimeDigest(payload.operations.map(row => row.operation_id))
      !== crossRuntimeDigest(source.status.operations.filter(row => selected.has(row.operation_id)).map(row => row.operation_id))
      || payload.operations.some(row => row.target_id !== undefined
        && !source.status.source_targets.some(target => target.target_id === row.target_id))) return null;
    if (!sourceMatches(source.status, context) || !context.confirmed || payload.capture_id !== context.capture_id
      || payload.source_video_digest !== source.status.source_video_digest
      || payload.task_description_digest !== source.status.task_description_digest
      || payload.task_success_criteria_digest !== source.status.task_success_criteria_digest
      || record.source_fingerprint !== source.sourceFingerprint
      || record.operation_binding_digest !== familyTaskOperationBinding(source.status)
      || record.context_basis_digest !== crossRuntimeDigest(context)
      || crossRuntimeArtifactDigest(payload, "facts_digest") !== payload.facts_digest
      || crossRuntimeArtifactDigest(record as unknown as Record<string, unknown>, "confirmation_digest") !== record.confirmation_digest)
      return null;
    return payload;
  } catch { return null; }
}
/** The ordinary confirmation supplies only one known target or hold outcome. */
export function confirmFamilyTaskAnswer(brief: FamilyTaskBriefState, input: FamilyTaskAnswer,
  context: Record<string, any>, confirmedBy: string, previousContext = context): FamilyTaskFactConfirmation | null {
  if (!familyTaskFactsEnabled()) throw new Error("family_task_facts_unavailable");
  const command = familyTaskAnswerSchema.parse(input), source = brief.familyTaskAuthoring;
  if (!source || !familyAuthoringStatusSchema.safeParse(source.status).success || !sourceMatches(source.status, context))
    throw new Error("family_task_facts_source_changed");
  const prior = currentFamilyTaskFacts(brief, previousContext);
  if (command.authoringDigest !== source.status.authoring_request_digest) throw new Error("family_task_facts_source_changed");
  const correction = "operationId" in command;
  const operation = correction ? source.status.operations.find(row => row.operation_id === command.operationId) : null;
  const priorRow = operation ? prior?.operations.find(row => row.operation_id === operation.operation_id) : null;
  if (correction && (!operation || !priorRow || (command.field === "target" ? priorRow.target_id : priorRow.minimum_hold_seconds) === undefined))
    throw new Error("family_task_facts_source_changed");
  const question = correction ? { operationId: operation!.operation_id, kind: command.field,
    targets: source.status.source_targets.map(row => ({targetId: row.target_id, label: row.label})) }
    : projectFamilyTaskQuestion(brief, source.status);
  if (!question || !correction && command.requirementId !== (question as FamilyTaskQuestion).requirementId)
    throw new Error("family_task_facts_source_changed");
  if (command.answer === null && !prior) return null;
  if (question.kind === "task_intent") throw new Error("family_task_facts_use_job_description");
  const addition = command.answer === null ? {} : question.kind === "target"
    ? typeof command.answer === "string" && question.targets.some(row => row.targetId === command.answer)
      ? { target_id: command.answer } : null
    : typeof command.answer === "number" ? { minimum_hold_seconds: command.answer } : null;
  if (!addition || !question.operationId) throw new Error("family_task_facts_answer_invalid");
  const byId = new Map((prior?.operations ?? []).map(row => [row.operation_id, row]));
  if (correction && command.answer === null) {
    const row = {...byId.get(question.operationId)!};
    delete row[question.kind === "target" ? "target_id" : "minimum_hold_seconds"];
    if (row.target_id === undefined && row.minimum_hold_seconds === undefined) byId.delete(question.operationId);
    else byId.set(question.operationId, row);
  } else if (command.answer !== null)
    byId.set(question.operationId, { ...byId.get(question.operationId), operation_id: question.operationId, ...addition });
  const operations = source.status.operations.flatMap(row => byId.has(row.operation_id) ? [byId.get(row.operation_id)!] : []);
  if (!operations.length) return null;
  const value = { schema_version: "website_family_task_facts.v1" as const, canonicalization: "rfc8785" as const,
    capture_id: source.status.capture_id, source_video_digest: source.status.source_video_digest,
    task_description_digest: source.status.task_description_digest,
    task_success_criteria_digest: source.status.task_success_criteria_digest, confirmed: true as const,
    confirmation_reference: `site-task-brief:${context.request_id}:${crossRuntimeDigest({ confirmedBy, operations }).slice(7)}`, operations };
  const payload = factsSchema.parse({ ...value, facts_digest: crossRuntimeDigest(value) });
  const confirmation = { payload, context_basis_digest: crossRuntimeDigest(context),
    source_fingerprint: source.sourceFingerprint, operation_binding_digest: familyTaskOperationBinding(source.status) };
  return { ...confirmation, confirmation_digest: crossRuntimeDigest(confirmation) };
}

export function projectFamilyTaskDetails(brief: FamilyTaskBriefState, context: Record<string, any>, status: FamilyAuthoringStatus): FamilyTaskDetail[] {
  if (brief.familyTaskAuthoring?.status.projection_digest !== status.projection_digest
    || context.context_digest !== status.task_context_digest) return [];
  const payload = currentFamilyTaskFacts(brief, familyTaskContextBasis(context));
  return payload?.operations.map(row => ({authoringDigest: status.authoring_request_digest,
    operationId: row.operation_id, operationLabel: status.operations.find(operation => operation.operation_id === row.operation_id)!.source_quote,
    targetId: row.target_id ?? null, targetLabel: status.source_targets.find(target => target.target_id === row.target_id)?.label ?? null,
    holdSeconds: row.minimum_hold_seconds ?? null,
    targets: status.source_targets.map(target => ({targetId: target.target_id, label: target.label})) })) ?? [];
}
