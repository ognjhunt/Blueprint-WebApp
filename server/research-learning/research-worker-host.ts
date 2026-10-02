import { createHash } from "node:crypto";
import { z } from "zod";
import { digest, grantSchema, id, instant, sectionSchema } from "./contract";
import { businessReadScopeSchema } from "./business-history";
import { consumerBindingSchema, consumerSelectionSchema, openResearchLearningSession } from "./consumer";
import { chicagoDate, recordTerminalRun, runDailyBusinessAnalysis } from "./business-learning-loop";

const ROOT = "blueprintDailyResearch/sites-first";
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const terminalStates = ["awaiting_review", "reviewed", "completed", "failed", "cancelled"];
/** Host-owned scope, installed only after existing authorization/reconciliation.
 * No default principal, prospect joins, source snapshot or renewed grant. */
export const researchLearningControlSchema = z.object({
  version: z.literal("blueprint.research-learning-worker.v1"), enabled: z.literal(true),
  startDate: daySchema, binding: consumerBindingSchema, selection: consumerSelectionSchema,
  businessScope: businessReadScopeSchema, learningGrant: grantSchema, terminalSubjectKey: id,
}).strict().superRefine((value, ctx) => {
  const { binding, businessScope, learningGrant, selection } = value;
  if (binding.role !== "daily_research" || binding.principalId !== businessScope.principalId
      || binding.principalId !== learningGrant.principalId || businessScope.expiresAt > binding.expiresAt
      || learningGrant.expiresAt > binding.expiresAt || !businessScope.subjectKeys.includes(value.terminalSubjectKey)
      || !sectionSchema.options.every(section => learningGrant.sections.includes(section))
      || digest([...learningGrant.prospectIds].sort()) !== digest([...binding.prospectIds].sort())
      || selection.crmIds.some(key => !binding.crmIds.includes(key))
      || selection.prospectIds.some(key => !binding.prospectIds.includes(key))
      || selection.capabilityIds.some(key => !binding.detailCapabilityIds.includes(key))) {
    ctx.addIssue({ code: "custom", message: "research_learning_scope_invalid" });
  }
});
export type ResearchLearningControl = z.input<typeof researchLearningControlSchema>;

/** 06:45 is unambiguous on both Chicago DST transition days. Noon UTC is
 * always the same Chicago date; adjust its observed local minutes to 06:45. */
export function researchLearningInstant(dayValue: string) {
  const day = daySchema.parse(dayValue), noon = new Date(`${day}T12:00:00.000Z`);
  if (!Number.isFinite(noon.getTime()) || noon.toISOString().slice(0, 10) !== day) throw new Error("research_learning_date_invalid");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(noon);
  const localMinutes = Number(parts.find(part => part.type === "hour")!.value) * 60 + Number(parts.find(part => part.type === "minute")!.value);
  return new Date(noon.getTime() + (405 - localMinutes) * 60000).toISOString();
}
export const researchLearningJobKey = (day: string) => `research-learning:${daySchema.parse(day)}:0645`;

/** This function is loaded into the existing private Firestore bridge, never
 * exposed as an agent tool or network endpoint. The package owns the lease. */
export function researchLearningHost(db: FirebaseFirestore.Firestore, clock = () => new Date().toISOString()) {
  return async (request: { op: string; day?: string; as_of?: string }, value: unknown) => {
    const control = researchLearningControlSchema.parse(value), now = instant.parse(clock());
    if ([control.binding.expiresAt, control.businessScope.expiresAt, control.learningGrant.expiresAt].some(expiry => expiry <= now)) {
      throw new Error("research_learning_scope_expired");
    }
    const terminal = async (dayValue: string) => {
      const day = daySchema.parse(dayValue);
      if (day < control.startDate || day > chicagoDate(clock())) return { state: "learning_outside_scope" };
      const ref = `${ROOT}/runs/${day}`, snap = await db.doc(ref).get(), data = snap.data();
      if (!snap.exists || data?.date !== day || data?.metadata?.run_key !== `blueprint-researcher:${day}`
          || !terminalStates.includes(data.state)) return { state: "learning_not_terminal" };
      const sourceHash = digest(data);
      if (control.businessScope.expiresAt <= instant.parse(clock())) throw new Error("research_learning_scope_expired");
      // Each immutable native terminal observation has its own sourced record.
      // QA/publication/cleanup transitions never impersonate the prior state.
      const result = await recordTerminalRun(db, {
        recordId: `BP-RUN-research:${day}:${data.state}:${sourceHash}`, subjectKey: control.terminalSubjectKey,
        principalId: control.binding.principalId, runId: day,
        receipt: { recordRef: ref, sourceHash, checkedAt: clock() },
      }, clock);
      return { state: "learning_terminal_recorded", eventId: result.event.eventId, append: result.append, paidAnalysisCalls: 0 };
    };
    if (request.op === "learning_terminal") return terminal(request.day!);
    if (request.op === "learning_reconcile") {
      // Bounded once per daily/recovery attempt, never a minute-wise full ledger
      // poll. This reads projections only, not provider sessions or row blobs.
      const rows = await db.collection(`${ROOT}/runs`).where("date", ">=", control.startDate).limit(101).get();
      if (rows.size > 100) throw new Error("research_learning_terminal_export_required");
      let observed = 0;
      for (const row of rows.docs) if (terminalStates.includes(row.data().state)) { await terminal(row.id); observed++; }
      return { state: "learning_reconciled", observed, paidAnalysisCalls: 0 };
    }
    const day = daySchema.parse(request.day), asOf = researchLearningInstant(day);
    if (day < control.startDate || asOf > now) throw new Error("research_learning_not_due");
    const jobKey = researchLearningJobKey(day);
    if (request.op === "learning_daily") {
      if (instant.parse(request.as_of) !== asOf) throw new Error("research_learning_schedule_changed");
      const result = await runDailyBusinessAnalysis(db, {
        jobKey, businessScope: control.businessScope, learningGrant: control.learningGrant,
        request: { prospectIds: control.learningGrant.prospectIds, sections: control.learningGrant.sections,
          asOf, maturityDays: control.selection.maturityDays }, focus: control.selection.focus,
      }, clock);
      return { state: "learning_completed", date: day, overviewId: result.overview.overviewId,
        replay: result.replay, paidAnalysisCalls: 0, sendsAuthorized: false };
    }
    if (request.op !== "learning_context") throw new Error("research_learning_operation_invalid");
    const session = await openResearchLearningSession(db, control.binding, control.selection, clock,
      { businessHistory: control.businessScope, businessOverviewJobKey: jobKey });
    if (!session.handoff.businessOverview) throw new Error("research_learning_overview_required");
    if (session.handoff.scope.prospectIds.some(key => !control.learningGrant.prospectIds.includes(key))) {
      throw new Error("research_learning_join_outside_scope");
    }
    // Relevant details are captured from this one immutable read closure before
    // the prompt/create intent. Pages remain bounded and expose continuation
    // explicitly instead of claiming a complete directory or full history.
    const capturePages = (read: (cursor: any) => any) => {
      const pages: any[] = []; let cursor: any = null;
      do { const page = read(cursor); pages.push(page); cursor = page.nextCursor; } while (cursor && pages.length < 20);
      return { pages, complete: cursor === null };
    };
    const businessHistory = control.businessScope.subjectKeys.map(subjectKey => ({ subjectKey,
      history: session.handoff.businessHistory ? capturePages(cursor => session.decisionHistory(subjectKey, { pageSize: 25, cursor })) : null }));
    const prospectHistory = session.handoff.scope.prospectIds.map(prospectId => ({ prospectId,
      outcomes: capturePages(cursor => session.history(prospectId, { pageSize: 25, cursor })),
      research: capturePages(cursor => session.researchDetails(prospectId, { pageSize: 25, cursor })) }));
    const siteHistory = control.selection.crmIds.map(crmId => ({ crmId,
      history: capturePages(cursor => session.siteHistory(crmId, { pageSize: 25, cursor })) }));
    const content = { version: "blueprint.research-learning-input.v1", date: day, overviewJobKey: jobKey,
      capturedAt: clock(), handoff: session.handoff, relevantHistory: { businessHistory, prospectHistory, siteHistory },
      unknowns: [...session.handoff.unknowns, ...(businessHistory.some(row => row.history && !row.history.complete)
        || prospectHistory.some(row => !row.outcomes.complete || !row.research.complete)
        || siteHistory.some(row => !row.history.complete) ? ["relevant_history_has_more_pages"] : [])],
      paidAnalysisCalls: 0, sendsAuthorized: false };
    const content_json = JSON.stringify(content);
    if (Buffer.byteLength(content_json) > 600000) throw new Error("research_learning_input_export_or_narrow_scope_required");
    if ([control.binding.expiresAt, control.businessScope.expiresAt, control.learningGrant.expiresAt].some(expiry => expiry <= instant.parse(clock()))) {
      throw new Error("research_learning_scope_expired");
    }
    return { version: content.version, date: day, paidAnalysisCalls: 0, sendsAuthorized: false, content_json,
      bindingHash: digest(value),
      inputHash: createHash("sha256").update(content_json).digest("hex") };
  };
}
