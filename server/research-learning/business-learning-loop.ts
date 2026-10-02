import { readableHistory } from "./readable-history";
import { readQueryPages } from "./query-pages";
import { z } from "zod";
import { authorize, digest, hash, id, instant, LEARNING_ROOT, sectionSchema, validateEvent, type LearningGrant, type SnapshotRequest } from "./contract";
import { readExistingSources } from "./existing-sources";
import { buildSnapshot, verifySnapshot, type LearningSnapshot } from "./snapshot";
import { planResearchLearning } from "./planner";
import { sheetsLearningView, notionLearningSummary } from "./harness";
import { BusinessHistoryStore, businessReadScopeSchema, makeBusinessHistory, validateStoredBusinessHistory, type BusinessHistorySnapshot, type BusinessReadScope } from "./business-history";
import { safeText } from "./prior-research";

export const BUSINESS_LEARNING_CADENCE = {
  sourceCapture: "on_each_verified_business_message_or_event", runSummary: "after_each_terminal_native_run",
  daily: { timezone: "America/Chicago", localTime: "06:45", beforeResearchLocalTime: "07:00" },
  incrementalPaidModelCalls: 0,
} as const;
const focusSchema = z.object({ city: safeText(120), industry: safeText(120) }).strict();
export const runSummaryInputSchema = z.object({ recordId: id, subjectKey: id, principalId: id, runId: id,
  receipt: z.object({ recordRef: z.string().regex(/^blueprint(?:DailyResearch\/sites-first\/(?:runs|workItems)|Communications\/default\/jobs)\/[A-Za-z0-9_.:-]+$/), sourceHash: hash, checkedAt: instant }).strict(),
}).strict();
/** Native source observation after final or paused native work. Pending
 * approval/research is a paused draft/work state, never a send or failure claim.
 * Outcome metrics and research context must
 * come from normalized evidence; a terminal state is never delivery proof. */
export async function recordTerminalRun(db: FirebaseFirestore.Firestore, value: unknown, clock = () => new Date().toISOString()) {
  const input = runSummaryInputSchema.parse(value), now = instant.parse(clock());
  if (input.receipt.checkedAt > now) throw new Error("business_run_receipt_future");
  if (input.receipt.recordRef.split("/").at(-1) !== input.runId) throw new Error("business_run_identity_changed");
  const { checkedAt: _checked, ...receiptIdentity } = input.receipt;
  const requestDigest = digest({ ...input, receipt: receiptIdentity });
  const prior = await db.doc(LEARNING_ROOT).collection("businessHistoryEvents").where("recordId", "==", input.recordId).limit(2).get();
  if (prior.size) {
    if (prior.size !== 1) throw new Error("business_run_history_conflicted");
    const event = validateStoredBusinessHistory(prior.docs[0]);
    if (event.kind !== "run_summary" || event.requestDigest !== requestDigest) throw new Error("business_run_retry_identity_changed");
    return { event, append: "existing" as const };
  }
  const record = await db.doc(input.receipt.recordRef).get(), data = record.data();
  if (!record.exists || digest(data) !== input.receipt.sourceHash) throw new Error("business_run_receipt_missing_or_changed");
  const communications = input.receipt.recordRef.startsWith("blueprintCommunications/");
  const allowed = communications ? ["sent", "no_reply", "opted_out", "failed", "superseded", "pending_approval", "awaiting_research", "blocked", "auto_approved"] : ["completed", "awaiting_review", "reviewed", "failed", "cancelled"];
  if (!allowed.includes(data?.state)) throw new Error("business_run_not_terminal");
  if (communications && data?.jobId !== input.runId) throw new Error("business_run_identity_changed");
  // Native communications updatedAt uses epoch milliseconds. Research remote
  // completion uses epoch seconds and represents the remote turn, explicitly.
  const nativeTime = communications ? data?.updatedAt : data?.remote_completed_at;
  const parsedTime = typeof nativeTime === "number" && Number.isFinite(nativeTime)
    ? new Date(nativeTime * (communications ? 1 : 1000)).toISOString() : null;
  const nativeTimestamp = parsedTime ? instant.parse(parsedTime) : null;
  if (nativeTimestamp && nativeTimestamp > input.receipt.checkedAt) throw new Error("business_run_native_time_future");
  const source = { system: "firestore" as const, ...input.receipt };
  const prospectIds = communications ? [id.parse(data?.prospectId)] : [];
  const event = makeBusinessHistory({ kind: "run_summary", recordId: input.recordId, subjectKey: input.subjectKey,
    contentClass: "blueprint_business_only", occurredAt: nativeTimestamp ?? input.receipt.checkedAt, recordedAt: instant.parse(clock()), capturedBy: input.principalId,
    supersedesEventId: null, sources: [source], runId: input.runId, state: data!.state, requestDigest,
    nativeTimestamp, timeBasis: nativeTimestamp ? communications ? "native_update" : "remote_completion" : "terminal_observation",
    contextHash: null, sourceSnapshotId: null, prospectIds,
    counts: { researchedProspects: null, acceptedTouches: null, verifiedDeliveredTouches: null, repliedProspects: null, matureNonresponseProspects: null, pendingProspects: null },
    unknowns: ["run_context_not_recorded_in_verified_trace", "outcome_counts_require_normalized_evidence", ...(communications ? [] : ["research_run_prospect_joins_require_publication_evidence"]), ...(nativeTimestamp ? [] : ["native_finish_time_unknown"])], paidAnalysisCalls: 0 });
  return { event, append: await new BusinessHistoryStore(db, clock).append(event, { principalId: input.principalId,
    subjectKeys: [input.subjectKey], approvedEventId: event.eventId, verifiedSources: [source] }) };
}
export function chicagoDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant.parse(value)));
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
export function buildBusinessOverview(history: BusinessHistorySnapshot, learning: LearningSnapshot, scope: BusinessReadScope, learningGrant: LearningGrant, focus: { city: string; industry: string }, now: string) {
  const authorized = businessReadScopeSchema.parse(scope), at = instant.parse(now);
  focus = focusSchema.parse(focus);
  if (authorized.expiresAt <= at || history.principalId !== authorized.principalId || history.subjectKeys.some(key => !authorized.subjectKeys.includes(key)) || history.asOf > at) throw new Error("business_overview_scope_denied");
  // Read diagnostics are bound separately into sourceQuarantine; healthy
  // canonical history snapshots retain their original hash and shape.
  const { snapshotId: _id, historyHash: _hash, quarantine: _readDiagnostics, ...content } = history as BusinessHistorySnapshot & { quarantine?: unknown };
  if (digest(content) !== history.snapshotId || digest(history.history) !== history.historyHash) throw new Error("business_overview_history_changed");
  verifySnapshot(learning, learningGrant, at);
  const plan = planResearchLearning(learning, focus), hypotheses = history.current.filter(event => event.kind === "hypothesis");
  const body = { version: "blueprint.business-overview.v1" as const, computedAt: at, asOf: learning.asOf,
    chicagoDate: chicagoDate(at), scope: { principalId: authorized.principalId, subjectKeys: authorized.subjectKeys, prospectIds: learning.scope.prospectIds },
    source: { historySnapshotId: history.snapshotId, historyHash: history.historyHash, outcomeSnapshotId: learning.snapshotId },
    decisions: history.current.filter(event => event.kind === "decision" && event.classification === "explicit_decision").slice(-5),
    inferences: history.current.filter(event => event.kind === "decision" && event.classification === "inference").slice(-5), hypotheses: hypotheses.slice(-5),
    businessCounts: { currentRecords: history.current.length, historyRecords: history.history.length, registeredHypotheses: hypotheses.length },
    moreBusinessHistoryAvailable: history.current.length > 5,
    outcomeAnalysis: plan,
    nextInvestigations: hypotheses.filter(event => event.kind === "hypothesis" && event.status !== "withdrawn").slice(-5).map(event => {
      if (event.kind !== "hypothesis") throw new Error("business_hypothesis_changed");
      return { hypothesisRecordId: event.recordId, evidenceEventId: event.eventId, question: event.nextQuestion,
        proposedTest: event.nextTest, whatWouldChangeBelief: event.whatWouldChangeBelief, confounders: event.confounders };
    }),
    unknowns: [...new Set(learning.rows.flatMap(row => row.unknowns))].sort(),
    rules: ["Hypotheses are provisional; never hard-filter prospects by them.", "Seek counterevidence and unexpected opportunities.",
      "Contactability and response bias differ from interest; interest differs from pilot participation.", "Nonresponse is not rejection; provider acceptance is not delivery.",
      "Sparse, delayed observational outcomes are not causal proof.", "Compare current detailed records with this overview; changed source hashes or age mean stale evidence."],
    sourceChecksRefreshed: false, paidAnalysisCalls: 0 as const, sendsAuthorized: false as const,
  };
  return { ...body, overviewId: digest(body) };
}
export type BusinessOverview = ReturnType<typeof buildBusinessOverview>;
export function verifyBusinessOverview(value: BusinessOverview) {
  const { overviewId, ...body } = value;
  if (digest(body) !== overviewId || body.version !== "blueprint.business-overview.v1" || body.paidAnalysisCalls !== 0 || body.sendsAuthorized !== false) throw new Error("business_overview_changed");
  return value;
}
export function overviewFreshness(value: BusinessOverview, now: string, currentHistoryHash?: string) {
  verifyBusinessOverview(value); const ageHours = (Date.parse(instant.parse(now))-Date.parse(value.computedAt))/3600000;
  const sourceAgeHours = (Date.parse(now)-Date.parse(value.asOf))/3600000;
  return { stale: ageHours < 0 || ageHours > 26 || sourceAgeHours < 0 || sourceAgeHours > 26 || (currentHistoryHash !== undefined && currentHistoryHash !== value.source.historyHash),
    ageHours, sourceAgeHours, sourceChecksRefreshed: false, changedHistory: currentHistoryHash !== undefined && currentHistoryHash !== value.source.historyHash };
}
/** Scheduler/leases remain owned by the existing native runner. One deterministic
 * job key is supplied before execution and reused on retry; immutable result and
 * receipt commit together. No model, mailbox, source or control writes. */
export async function runDailyBusinessAnalysis(db: FirebaseFirestore.Firestore, input: { jobKey: string; businessScope: BusinessReadScope;
  learningGrant: LearningGrant; request: SnapshotRequest; focus: { city: string; industry: string } }, clock = () => new Date().toISOString()) {
  const now = instant.parse(clock()), jobKey = id.parse(input.jobKey), businessScope = businessReadScopeSchema.parse(input.businessScope);
  input = { ...input, focus: focusSchema.parse(input.focus) };
  const authorized = authorize(input.learningGrant, input.request, now);
  input = { ...input, learningGrant: authorized.grant, request: authorized.request };
  if (!sectionSchema.options.every(section => authorized.request.sections.includes(section))) throw new Error("business_daily_sections_required");
  if (businessScope.expiresAt <= now || businessScope.principalId !== input.learningGrant.principalId) throw new Error("business_daily_scope_denied");
  const assertCurrentScope = () => {
    const at = instant.parse(clock()); authorize(input.learningGrant, input.request, at);
    if (businessScope.expiresAt <= at) throw new Error("business_daily_scope_expired");
    return at;
  };
  const scopeHash = digest({ businessScope: { principalId: businessScope.principalId, subjectKeys: businessScope.subjectKeys },
    request: authorized.request, focus: input.focus, chicagoDate: chicagoDate(input.request.asOf) });
  const verifyResult = (value: any, expectedId: string) => {
    const overview = verifyBusinessOverview(value as BusinessOverview);
    if (overview.overviewId !== expectedId || value.analysisScopeHash !== scopeHash || overview.scope.principalId !== businessScope.principalId
      || digest([...overview.scope.subjectKeys].sort()) !== digest([...businessScope.subjectKeys].sort())
      || digest([...overview.scope.prospectIds].sort()) !== digest([...authorized.request.prospectIds].sort())
      || overview.asOf !== authorized.request.asOf || digest(overview.outcomeAnalysis.focus) !== digest(input.focus)) throw new Error("business_daily_result_scope_changed");
    return overview;
  };
  const root = db.doc(LEARNING_ROOT), receiptRef = root.collection("businessOverviewRuns").doc(jobKey);
  const finishResult = async (overview: BusinessOverview, replay: boolean) => {
    const linked = await root.collection("snapshots").doc(hash.parse(overview.source.outcomeSnapshotId)).get();
    const at = assertCurrentScope();
    if (!linked.exists) throw new Error("business_daily_outcome_snapshot_missing");
    const snapshot = verifySnapshot(linked.data() as LearningSnapshot, input.learningGrant, at);
    if (snapshot.snapshotId !== linked.id || snapshot.snapshotId !== overview.source.outcomeSnapshotId
      || snapshot.asOf !== authorized.request.asOf || digest([...snapshot.scope.prospectIds].sort()) !== digest([...authorized.request.prospectIds].sort())
      || digest([...snapshot.scope.sections].sort()) !== digest([...authorized.request.sections].sort())
      || snapshot.maturityDays !== authorized.request.maturityDays || digest(planResearchLearning(snapshot, overview.outcomeAnalysis.focus)) !== digest(overview.outcomeAnalysis)) throw new Error("business_daily_outcome_snapshot_changed");
    const reviewExports = { sheets: sheetsLearningView(snapshot, input.learningGrant, at),
      notion: { ...notionLearningSummary(snapshot, input.learningGrant, at, input.focus), overviewId: overview.overviewId,
        businessHistoryHash: overview.source.historyHash,
        decisions: [...overview.decisions, ...overview.inferences].filter(event => event.kind === "decision").map(event => ({ recordId: event.recordId, eventId: event.eventId,
          classification: event.classification, statement: event.statement, recordRef: `${LEARNING_ROOT}/businessHistoryEvents/${event.eventId}` })),
        hypotheses: overview.hypotheses.map(event => ({ recordId: event.recordId, eventId: event.eventId, statement: event.statement,
          status: event.status, uncertainty: event.uncertainty, confounders: event.confounders, evidence: event.evidence,
          whatWouldChangeBelief: event.whatWouldChangeBelief, nextQuestion: event.nextQuestion, nextTest: event.nextTest,
          causalProof: false, hardFilterProspects: false, unexpectedExplorationRequired: true })),
        sourceChecksRefreshed: false, authority: "learning_summary_only" } };
    assertCurrentScope();
    return { overview, replay, reviewExports };
  };
  const replay = await receiptRef.get();
  if (replay.exists) {
    const receipt = replay.data()!;
    if (receipt.scopeHash !== scopeHash) throw new Error("business_daily_job_scope_changed");
    const saved = await root.collection("businessOverviews").doc(receipt.overviewId).get();
    if (!saved.exists) throw new Error("business_daily_replay_missing");
    assertCurrentScope();
    const overview = verifyResult(saved.data(), hash.parse(receipt.overviewId));
    return finishResult(overview, true);
  }
  const history = await new BusinessHistoryStore(db, clock).read(businessScope, input.request.asOf);
  const live = await readExistingSources(db, input.learningGrant, input.request, clock(), { frozenAsOf: input.request.asOf });
  live.quarantine.push(...history.quarantine);
  const events = [...live.events], storedDocuments: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const prospectId of input.request.prospectIds) {
    const rows = await readQueryPages(root.collection("events").where("entities.prospectId", "==", prospectId));
    storedDocuments.push(...rows);
  }
  const readable = readableHistory(storedDocuments, events, input.request);
  live.quarantine.push(...readable.quarantine);
  const learning = buildSnapshot(readable.events, input.learningGrant, input.request, clock());
  if (Buffer.byteLength(JSON.stringify(learning)) > 900000) throw new Error("business_daily_snapshot_export_or_narrow_scope_required");
  const built = buildBusinessOverview(history, learning, businessScope, input.learningGrant, input.focus, clock());
  const overview = { ...built, analysisScopeHash: scopeHash,
    unknowns: [...new Set([...built.unknowns, ...(live.quarantine.length ? ["native_source_coverage_incomplete"] : [])])].sort(),
    sourceQuarantine: live.quarantine.map(record => ({ ...record, recordRef: /^[A-Za-z0-9_.:/-]+$/.test(record.recordRef) ? record.recordRef : "authorized_scope/invalid_record_id" })) };
  // Source quarantine is part of the immutable hash, never silently omitted.
  const { overviewId: _id, ...body } = overview, sealed = { ...body, overviewId: digest(body) };
  if (Buffer.byteLength(JSON.stringify(sealed)) > 900000) throw new Error("business_daily_overview_scope_too_large");
  const overviewRef = root.collection("businessOverviews").doc(sealed.overviewId), snapshotRef = root.collection("snapshots").doc(learning.snapshotId);
  const result = await db.runTransaction(async tx => {
    const existing = await tx.get(receiptRef), saved = await tx.get(overviewRef), source = await tx.get(snapshotRef);
    assertCurrentScope();
    if (existing.exists) { if (existing.data()?.scopeHash !== scopeHash) throw new Error("business_daily_job_scope_changed"); return existing.data()!.overviewId as string; }
    if (source.exists) { const prior = verifySnapshot(source.data() as LearningSnapshot, input.learningGrant, clock());
      if (prior.snapshotId !== source.id || prior.snapshotId !== learning.snapshotId) throw new Error("business_daily_outcome_snapshot_changed");
    } else tx.create(snapshotRef, learning);
    if (!saved.exists) tx.create(overviewRef, sealed);
    tx.create(receiptRef, { version: "blueprint.business-overview-run.v1", jobKey, scopeHash, overviewId: sealed.overviewId, completedAt: clock(), paidAnalysisCalls: 0 });
    return sealed.overviewId;
  });
  const saved = await root.collection("businessOverviews").doc(result).get();
  assertCurrentScope();
  if (!saved.exists || saved.data()?.overviewId !== result) throw new Error("business_daily_replay_missing_or_changed");
  return finishResult(verifyResult(saved.data(), result), result !== sealed.overviewId);
}

/** Existing authorized host chooses the immutable daily job key. Subject and
 * prospect grants are checked before any stored overview escapes to an agent. */
export async function readBusinessOverview(db: FirebaseFirestore.Firestore, jobKeyValue: string, scopeValue: BusinessReadScope, prospectIds: string[], now: string, historyHash?: string, clock = () => new Date().toISOString()) {
  const jobKey = id.parse(jobKeyValue), scope = businessReadScopeSchema.parse(scopeValue);
  if (scope.expiresAt <= instant.parse(now) || scope.expiresAt <= instant.parse(clock())) throw new Error("business_overview_scope_expired");
  const root = db.doc(LEARNING_ROOT), receipt = await root.collection("businessOverviewRuns").doc(jobKey).get();
  if (!receipt.exists) { if (scope.expiresAt <= instant.parse(clock())) throw new Error("business_overview_scope_expired"); return null; }
  const overviewId = hash.parse(receipt.data()?.overviewId), saved = await root.collection("businessOverviews").doc(overviewId).get();
  if (!saved.exists) throw new Error("business_overview_missing");
  const overview = verifyBusinessOverview(saved.data() as BusinessOverview);
  if (scope.expiresAt <= instant.parse(clock())) throw new Error("business_overview_scope_expired");
  if (overview.overviewId !== overviewId || overview.scope.principalId !== scope.principalId || overview.scope.subjectKeys.some(key => !scope.subjectKeys.includes(key))
    || overview.scope.prospectIds.some(prospectId => !prospectIds.includes(prospectId))) throw new Error("business_overview_scope_denied");
  const sourceId = hash.parse(overview.source.outcomeSnapshotId), linked = await root.collection("snapshots").doc(sourceId).get();
  const at = instant.parse(clock());
  if (scope.expiresAt <= at) throw new Error("business_overview_scope_expired");
  if (!linked.exists) throw new Error("business_overview_outcome_snapshot_missing");
  const snapshot = verifySnapshot(linked.data() as LearningSnapshot, { principalId: scope.principalId,
    prospectIds: overview.scope.prospectIds, sections: [...sectionSchema.options], expiresAt: scope.expiresAt }, at);
  if (snapshot.snapshotId !== linked.id || snapshot.snapshotId !== sourceId || snapshot.asOf !== overview.asOf
    || digest([...snapshot.scope.prospectIds].sort()) !== digest([...overview.scope.prospectIds].sort())
    || digest(planResearchLearning(snapshot, overview.outcomeAnalysis.focus)) !== digest(overview.outcomeAnalysis)) throw new Error("business_overview_outcome_snapshot_changed");
  return structuredClone({ overview, freshness: overviewFreshness(overview, at, historyHash), requiresDetailedHistoryReview: true });
}
