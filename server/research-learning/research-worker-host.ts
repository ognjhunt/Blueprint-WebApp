import { createHash } from "node:crypto";
import { createCompanyHistoryTools, type CompanyHistoryAccess } from "./company-history";
import { z } from "zod";
import { digest, grantSchema, id, instant, sectionSchema } from "./contract";
import { businessReadScopeSchema } from "./business-history";
import { consumerBindingSchema, consumerSelectionSchema } from "./consumer";
import { chicagoDate } from "./business-learning-loop";
import { createNativeLearningHooks, REVIEWED_NATIVE_LEARNING_CONFIG } from "./native-hooks";

const ROOT = "blueprintDailyResearch/sites-first";
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(day =>
  Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0,10) === day);
/** Existing trusted control only. Installing this bridge never grants a scope,
 * extends expiry or enables research, aggregation or sending. */
export const researchLearningControlSchema = z.object({
  version: z.literal("blueprint.research-learning-worker.v1"), enabled: z.literal(true),
  startDate: daySchema, binding: consumerBindingSchema, selection: consumerSelectionSchema,
  // A source-only corpus may have no native joins. That authorizes zero native
  // outcome reads, rather than fabricating a prospect to satisfy a denominator.
  businessScope: businessReadScopeSchema, learningGrant: grantSchema.extend({ prospectIds: z.array(id).max(100)
    .refine(values => new Set(values).size === values.length) }),
  terminalSubjectKey: z.string(),
}).strict().superRefine((value, ctx) => {
  const { binding, businessScope, learningGrant, selection } = value, expected = REVIEWED_NATIVE_LEARNING_CONFIG;
  if (binding.role !== "daily_research" || binding.principalId !== expected.principalId
    || binding.sourceSnapshotId !== expected.sourceSnapshotId
    || digest(businessScope.subjectKeys) !== digest(expected.businessSubjectKeys)
    || value.terminalSubjectKey !== expected.businessSubjectKeys[0]
    || digest(selection.focus) !== digest(expected.focus) || selection.maturityDays !== expected.maturityDays
    || binding.principalId !== businessScope.principalId || binding.principalId !== learningGrant.principalId
    || businessScope.expiresAt > binding.expiresAt || learningGrant.expiresAt > binding.expiresAt
    || !sectionSchema.options.every(section => learningGrant.sections.includes(section))
    || digest([...learningGrant.prospectIds].sort()) !== digest([...binding.prospectIds].sort())
    || selection.crmIds.some(key => !binding.crmIds.includes(key))
    || selection.prospectIds.some(key => !binding.prospectIds.includes(key))
    || selection.capabilityIds.some(key => !binding.detailCapabilityIds.includes(key))) {
    ctx.addIssue({ code: "custom", message: "research_learning_scope_invalid_reconcile_existing_control" });
  }
  if (selection.capabilityIds.length) ctx.addIssue({ code: "custom", message: "research_learning_native_capability_details_not_supported" });
});
export type ResearchLearningControl = z.input<typeof researchLearningControlSchema>;
export const researchHistoryAccessSchema = z.object({
  version: z.literal("blueprint.company-history-access.v1"), principalId: id, expiresAt: instant,
  scope: z.literal("company_business_history"), authorityRef: z.string().trim().min(1).max(512),
}).strict();
/** New profile parses only actual access. Frozen legacy selection/focus/grant
 * stays confined to learning_context and cannot become a relevance prefilter. */
export const researchHistoryControlSchema = z.object({
  version: z.literal("blueprint.research-learning-worker.v1"), enabled: z.literal(true), startDate: daySchema,
  binding: consumerBindingSchema, businessScope: businessReadScopeSchema,
  history_access: researchHistoryAccessSchema.optional(),
}).passthrough().superRefine((value, ctx) => {
  const { binding, businessScope, history_access } = value;
  if (binding.role !== "daily_research" || binding.principalId !== REVIEWED_NATIVE_LEARNING_CONFIG.principalId
    || binding.principalId !== businessScope.principalId || businessScope.expiresAt > binding.expiresAt
    || (history_access && (history_access.principalId !== binding.principalId || history_access.expiresAt > binding.expiresAt))) {
    ctx.addIssue({ code: "custom", message: "research_history_scope_invalid_reconcile_existing_control" });
  }
});

/** Reuse the retained host grant; never derive access from task kind or renew it. */
export function boundResearchHistoryControl(value: unknown, clock = () => new Date().toISOString()) {
  const control = researchHistoryControlSchema.parse(value);
  const now = instant.parse(clock());
  const expiresAt = [control.binding.expiresAt, control.businessScope.expiresAt,
    ...(control.history_access ? [control.history_access.expiresAt] : [])].sort()[0];
  if (expiresAt <= now) throw new Error("research_learning_scope_expired");
  if (chicagoDate(now) < control.startDate) throw new Error("research_learning_outside_scope");
  const access: CompanyHistoryAccess = { principalId: control.binding.principalId, expiresAt,
    sourceSnapshotId: control.binding.sourceSnapshotId, companyWide: !!control.history_access,
    businessSubjectKeys: control.businessScope.subjectKeys,
    ...(!control.history_access ? { prospectIds: control.binding.prospectIds, crmIds: control.binding.crmIds,
      capabilityIds: control.binding.detailCapabilityIds, discoveryCapabilityIds: control.binding.discoveryCapabilityIds } : {}) };
  return { control, access };
}


export function boundResearchLearningHooks(db: FirebaseFirestore.Firestore, value: unknown,
  clock = () => new Date().toISOString()) {
  const control = researchLearningControlSchema.parse(value);
  const expiresAt = [control.binding.expiresAt, control.businessScope.expiresAt, control.learningGrant.expiresAt].sort()[0];
  const checkedClock = () => {
    const now = instant.parse(clock());
    if (expiresAt <= now) throw new Error("research_learning_scope_expired");
    return now;
  };
  checkedClock();
  return { control, hooks: createNativeLearningHooks(db, REVIEWED_NATIVE_LEARNING_CONFIG, checkedClock,
    { binding: { ...control.binding, expiresAt }, selection: control.selection }) };
}

/** Loaded by the actual private Python/Firestore pipe. There is one TS-owned
 * 06:45 scheduler and one BP-RUN source-hash writer. No timer lives here. */
export function researchLearningHost(db: FirebaseFirestore.Firestore, clock = () => new Date().toISOString()) {
  return async (request: { op: string; day?: string; allow_create?: boolean; query?: unknown; filters?: unknown; page_size?: unknown; cursor?: unknown; record_id?: unknown }, value: unknown) => {
    if (request.op === "history_search" || request.op === "history_fetch") {
      const { control, access } = boundResearchHistoryControl(value, clock);
      const day = daySchema.parse(request.day), now = instant.parse(clock());
      if (day < control.startDate || day > chicagoDate(now)) throw new Error("research_learning_outside_scope");
      // Whole-company access requires an explicit trusted owner grant. Without
      // it, use the entire existing binding (never model filters/selection).
      const tools = createCompanyHistoryTools(db, access, { now: clock });
      return request.op === "history_search"
        ? tools("search_company_history", { query: request.query, ...(request.filters !== undefined ? { filters: request.filters } : {}),
            ...(request.page_size !== undefined ? { page_size: request.page_size } : {}), ...(request.cursor !== undefined ? { cursor: request.cursor } : {}) })
        : tools("fetch_company_history_record", { record_id: request.record_id });
    }
    const { control, hooks } = boundResearchLearningHooks(db, value, clock);
    const day = daySchema.parse(request.day);
    if (day < control.startDate || day > chicagoDate(clock())) throw new Error("research_learning_outside_scope");
    if (request.op !== "learning_context") throw new Error("research_learning_operation_invalid");
    if (typeof request.allow_create !== "boolean") throw new Error("research_learning_allow_create_required");
    const allowCreate = request.allow_create === true;
    // Recovery can observe the existing frozen input, never create a new
    // history session, daily manifest, aggregate or inference request.
    if (allowCreate) await hooks.daily();
    const prepared = await hooks.prepareNativeJob("daily_research", `${ROOT}/runs/${day}`, [], { allowCreate });
    if (!prepared) return { state: "learning_existing_context_unavailable", date: day,
      paidAnalysisCalls: 0, sendsAuthorized: false };
    const content = { version: "blueprint.research-learning-input.v1", date: day,
      capturedAt: prepared.preparedAt, nativeInputHash: prepared.inputHash, nativeInputRef: prepared.recordRef,
      handoff: prepared.handoff, relevantHistory: prepared.relevantHistory ?? null,
      unknowns: prepared.unknown ? [prepared.unknown] : prepared.handoff?.unknowns ?? [],
      paidAnalysisCalls: 0, sendsAuthorized: false };
    const content_json = JSON.stringify(content);
    if (Buffer.byteLength(content_json) > 600000) throw new Error("research_learning_input_export_or_narrow_scope_required");
    return { version: content.version, date: day, paidAnalysisCalls: 0, sendsAuthorized: false,
      content_json, bindingHash: digest(control), inputHash: createHash("sha256").update(content_json).digest("hex") };
  };
}
