import { z } from "zod";
import { CLASSIFICATION_POLICY, digest, hash, id, instant, LEARNING_ROOT } from "./contract";
import { businessHistoryEventSchema, validateBusinessHistory } from "./business-history";
import { safeText, scopeSourceSnapshot, sourceSnapshotSchema, type SourceSnapshot } from "./prior-research";
import { cachedDiscoveryIndex, searchDiscoveryIndex } from "./retrieval";
import { siteLearningSchema, validateSiteLearning } from "./site-learning";
import type { openResearchLearningSession } from "./consumer";

type Handoff = Awaited<ReturnType<typeof openResearchLearningSession>>["handoff"];
const ids = (max = 100) => z.array(id).max(max).refine(values => new Set(values).size === values.length);
const n = z.number().int().nonnegative();
const pointer = z.string().min(1).max(500).regex(/^[A-Za-z0-9_.:/-]+$/);
const texts = (max = 100) => z.array(safeText(1200)).max(max);
const outcomes = z.enum(["call_held", "evaluation_participation_agreed", "pilot_agreed", "deployment_capacity_confirmed", "pilot_started", "pilot_completed", "lost"]);
const rate = z.object({ numerator: n, denominator: n }).strict().refine(value => value.numerator <= value.denominator);
const counts = z.object({ scopedProspects: n, researchedProspects: n, attemptedTouches: n, acceptedTouches: n,
  verifiedDeliveredTouches: n, bouncedTouches: n, unknownAcknowledgementTouches: n, matureAcceptedProspects: n,
  repliedProspects: n, matureRepliedProspects: n, matureNonresponseProspects: n, replyAcceptanceUnknownProspects: n,
  matureReplyAcceptanceUnknownProspects: n, pendingProspects: n, explicitRejections: n, curiosityReplies: n,
  matureReplyRate: rate, verifiedDeliveryRate: rate, laterOutcomes: z.object({ call_held: n,
    evaluation_participation_agreed: n, pilot_agreed: n, deployment_capacity_confirmed: n, pilot_started: n,
    pilot_completed: n, lost: n }).strict() }).strict();
const contact = z.enum(["verified_business_route", "unverified", "missing", "unknown"]);
const planSchema = z.object({ version: z.literal("blueprint.research-learning-plan.v1"), snapshotId: hash, asOf: instant,
  focus: z.object({ city: safeText(120), industry: safeText(120) }).strict(),
  cohorts: z.array(z.object({ name: z.enum(["focus", "same_industry_other_cities", "other_industries_same_city"]),
    prospectIds: ids(), counts, strata: z.array(z.object({ key: hash, controls: z.object({ taskId: id.nullable(), teamIds: ids(),
      contact, message: id, messageDigest: hash.nullable(), outreachContract: id, campaign: id,
      timing: safeText(120) }).strict(), counts }).strict()).max(100) }).strict()).length(3),
  scopeCounts: counts, confidence: z.literal("descriptive_only"), causalProof: z.literal(false),
  hypotheses: z.array(z.object({ statement: safeText(1200), evidenceSnapshotId: hash, status: z.literal("unconfirmed") }).strict()).max(10),
  confounders: texts(20), allocation: z.object({ replication: z.literal(0.4), comparison: z.literal(0.4), newExploration: z.literal(0.2) }).strict(),
  stopAfterProspectCount: z.null(), rules: texts(20) }).strict();
const rowSchema = z.object({ prospectId: id, crmId: id.nullable(), hasResearch: z.boolean(), city: safeText(120), industry: safeText(120),
  taskId: id.nullable(), teamIds: ids(), contactAvailabilityAtTouch: contact, outreachVersion: id, campaignId: id,
  messageVariant: id, messageDigest: hash.nullable(), timingWindow: safeText(120), attemptedTouches: n, acceptedTouches: n,
  verifiedDeliveredTouches: n, verifiedDeliveredAcceptedTouches: n, bouncedTouches: n, unknownAcknowledgementTouches: n,
  matureAcceptedProspect: z.boolean(), replied: z.boolean(), acceptedWindowReplied: z.boolean(), replyAcceptanceUnknown: z.boolean(),
  windowReplyAcceptanceUnknown: z.boolean(), matureNonresponse: z.boolean(), pending: z.boolean(), explicitRejection: z.boolean(), curiosity: z.boolean(),
  interestSubtype: z.enum(["unknown", "informational_curiosity", "willing_to_talk", "evaluation_interest", "pilot_discussion"]),
  outcome: z.union([outcomes, z.literal("unknown")]), reachedOutcomes: z.array(outcomes).max(7), unknowns: texts(),
  historyCount: n, evidenceIds: z.array(hash).max(5), moreHistoryAvailable: z.boolean() }).strict();
const events = z.array(businessHistoryEventSchema).max(5);
const businessContext = z.object({ version: z.literal("blueprint.business-history-context.v1"), snapshotId: hash,
  historyHash: hash, asOf: instant, subjectKeys: ids(10), currentCount: n, historyCount: n, explicitDecisions: events,
  inferences: events, hypotheses: events, recentRunSummaries: events, moreHistoryAvailable: z.boolean(), paidAnalysisAuthority: z.literal(false) }).strict();
const quarantine = z.array(z.object({ recordRef: pointer, reason: safeText(200) }).strict()).max(5000);
const overviewSchema = z.object({ version: z.literal("blueprint.business-overview.v1"), computedAt: instant, asOf: instant,
  chicagoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), scope: z.object({ principalId: id, subjectKeys: ids(10), prospectIds: ids() }).strict(),
  source: z.object({ historySnapshotId: hash, historyHash: hash, outcomeSnapshotId: hash }).strict(), decisions: events,
  inferences: events, hypotheses: events, businessCounts: z.object({ currentRecords: n, historyRecords: n, registeredHypotheses: n }).strict(),
  moreBusinessHistoryAvailable: z.boolean(), outcomeAnalysis: planSchema,
  nextInvestigations: z.array(z.object({ hypothesisRecordId: id, evidenceEventId: hash, question: safeText(600), proposedTest: safeText(600),
    whatWouldChangeBelief: texts(10), confounders: texts(20) }).strict()).max(5), unknowns: texts(), rules: texts(20),
  sourceChecksRefreshed: z.literal(false), paidAnalysisCalls: z.literal(0), sendsAuthorized: z.literal(false), overviewId: hash,
  analysisScopeHash: hash.optional(), sourceQuarantine: quarantine.optional() }).strict();
const handoffSchema = z.object({ version: z.literal("blueprint.research-learning-consumer.v1"), trust: z.literal("untrusted_evidence_only"),
  role: z.enum(["daily_research", "communications"]), asOf: instant, expiresAt: instant,
  scope: z.object({ principalId: id, crmIds: ids(10), prospectIds: ids(20), detailCapabilityIds: z.array(id).length(0) }).strict(),
  source: z.object({ snapshotId: hash, scopedSnapshotId: hash, recordRef: pointer, provenance: sourceSnapshotSchema.shape.source }).strict(),
  priorResearch: z.object({ crmRows: sourceSnapshotSchema.shape.crmRows,
    capabilityDetails: z.object({ snapshot: z.null(), missingCapabilityIds: z.array(id).length(0), absenceMeans: z.literal("unknown_not_incompatible") }).strict(),
    sourceChecksRefreshed: z.literal(false), nativeResearchHash: hash,
    nativeResearchSubjects: z.array(z.object({ prospectId: id, briefCount: n }).strict()).max(20) }).strict(),
  canonicalJoins: z.array(z.object({ crmId: id, prospectId: id, siteId: id.nullable(), taskId: id.nullable(), caseId: id.nullable(),
    recordRef: pointer, sourceHash: hash, observedAt: instant }).strict()).max(10),
  priorContactAndOutcomes: z.object({ snapshotId: hash.nullable(), coverage: z.enum(["partial_authorized_scope", "authorized_records_only"]),
    prospects: z.array(rowSchema).max(20), planner: planSchema.nullable(), missingRecordsMean: z.literal("unknown_not_no_contact_no_reply_or_rejection") }).strict(),
  siteLearning: z.object({ recent: z.array(siteLearningSchema).max(5), currentCount: n, historyCount: n, historyHash: hash, moreHistoryAvailable: z.boolean(),
    subjects: z.array(z.object({ crmId: id, historyCount: n }).strict()).max(10) }).strict(),
  // This whole immutable projection must equal a directory rebuilt from the
  // verified host source below; it cannot carry arbitrary nested fields.
  discovery: z.unknown(),
  provenance: z.object({ outcomeEvidenceSourceRefs: z.array(pointer).max(10), totalOutcomeEvidenceSourceRefs: n,
    moreSourceRefsAvailableInHistory: z.boolean(), quarantine }).strict(), unknowns: texts(),
  classificationPolicy: z.object({ model: z.literal(CLASSIFICATION_POLICY.model), enabled: z.literal(false) }).strict(),
  businessHistory: businessContext.optional(), businessOverview: z.object({ overview: overviewSchema,
    freshness: z.object({ stale: z.boolean(), ageHours: z.number().finite(), sourceAgeHours: z.number().finite(),
      sourceChecksRefreshed: z.literal(false), changedHistory: z.boolean() }).strict(), requiresDetailedHistoryReview: z.literal(true) }).strict().optional(),
  operations: z.tuple([z.literal("search_directory"), z.literal("fetch_capability_details"), z.literal("fetch_prospect_history"),
    z.literal("fetch_site_learning_history"), z.literal("fetch_native_research_details"), z.literal("fetch_business_history")]),
  instructions: texts(10), contextHash: hash }).strict();

/** A content hash proves identity, never authorization. Validate every mutable
 * structured section, then bind all scopes and immutable source projections to
 * the trusted host configuration before a persisted input can reach an agent. */
export async function validateNativeHandoff(value: unknown, expected: { role: Handoff["role"]; principalId: string;
  subjectKeys: string[]; selectedProspectIds: string[]; source: SourceSnapshot; companyProspectIds: string[];
  focus: { city: string; industry: string }; preparedAt: string; now: string }, db: FirebaseFirestore.Firestore): Promise<Handoff> {
  const handoff = handoffSchema.parse(value), { contextHash, ...content } = handoff;
  const fail = () => { throw new Error("native_learning_input_context_changed"); };
  const same = (a: unknown, b: unknown) => { if (digest(a) !== digest(b)) fail(); };
  const subset = (a: string[], b: string[]) => { if (a.some(item => !b.includes(item))) fail(); };
  if (digest(content) !== contextHash || handoff.role !== expected.role || handoff.scope.principalId !== expected.principalId
    || handoff.asOf > expected.preparedAt || handoff.expiresAt <= handoff.asOf) fail();
  const crmIds = expected.role === "daily_research" ? expected.source.scope.crmIds.slice(0,10) : [];
  same(handoff.scope.crmIds, crmIds);
  const grant = { principalId: expected.principalId, crmIds, capabilityIds: expected.source.scope.capabilityIds,
    sections: ["crm", "capabilities"] as ("crm" | "capabilities")[], expiresAt: new Date(Date.parse(expected.now)+60000).toISOString() };
  const request = { crmIds, capabilityIds: grant.capabilityIds, sections: grant.sections, asOf: handoff.asOf };
  const source = scopeSourceSnapshot(expected.source, grant, request, expected.now);
  same(handoff.source, { snapshotId: expected.source.snapshotId, scopedSnapshotId: source.snapshotId,
    recordRef: `${LEARNING_ROOT}/sourceSnapshots/${expected.source.snapshotId}`, provenance: source.source });
  same(handoff.priorResearch.crmRows, source.crmRows);
  const index = cachedDiscoveryIndex(source, grant, request, expected.now);
  same(handoff.discovery, { indexHash: index.indexHash, coverage: index.coverage, completeDirectory: false,
    firstPage: searchDiscoveryIndex(index, { principalId: expected.principalId, indexHash: index.indexHash, expiresAt: grant.expiresAt },
      { taskTags: [], regionTags: [], companyIds: [], capabilityIds: [], pageSize: 5, cursor: null }, expected.now) });
  subset(handoff.scope.prospectIds, expected.companyProspectIds);
  for (const join of handoff.canonicalJoins) {
    if (!crmIds.includes(join.crmId) || !handoff.scope.prospectIds.includes(join.prospectId)
      || join.recordRef !== `outboundProspects/${join.prospectId}` || join.observedAt !== handoff.asOf) fail();
    const rows = await db.collection("outboundProspects").where("researchPublicationId", "==", join.crmId).limit(2).get();
    if (rows.size !== 1 || rows.docs[0].id !== join.prospectId) fail();
    // Reauthorize the CRM identity, while retaining the captured optional IDs
    // if the live record's task/site details were legitimately updated later.
    same(join.sourceHash, digest({ prospectId: join.prospectId, crmId: join.crmId,
      siteId: join.siteId, taskId: join.taskId, caseId: join.caseId }));
  }
  same([...handoff.scope.prospectIds].sort(), [...new Set([...expected.selectedProspectIds, ...handoff.canonicalJoins.map(join => join.prospectId)])].sort());
  if (new Set(handoff.canonicalJoins.map(join => join.crmId)).size !== handoff.canonicalJoins.length) fail();
  same(handoff.priorResearch.nativeResearchSubjects.map(row => row.prospectId).sort(), [...handoff.scope.prospectIds].sort());
  same(handoff.priorContactAndOutcomes.prospects.map(row => row.prospectId).sort(), [...handoff.scope.prospectIds].sort());
  same(handoff.siteLearning.subjects.map(row => row.crmId), crmIds);
  for (const event of handoff.siteLearning.recent) {
    validateSiteLearning(event); if (!crmIds.includes(event.crmId) || event.recordedAt > handoff.asOf) fail();
    if (event.canonicalProspectId) subset([event.canonicalProspectId], expected.companyProspectIds);
  }
  const checkPlan = (plan: z.infer<typeof planSchema>, allowed: string[]) => {
    same(plan.focus, expected.focus);
    for (const cohort of plan.cohorts) { subset(cohort.prospectIds, allowed); if (cohort.counts.scopedProspects !== cohort.prospectIds.length) fail(); }
    if (plan.scopeCounts.scopedProspects !== allowed.length) fail();
  };
  if (handoff.priorContactAndOutcomes.planner) {
    checkPlan(handoff.priorContactAndOutcomes.planner, handoff.scope.prospectIds);
    if (handoff.priorContactAndOutcomes.planner.snapshotId !== handoff.priorContactAndOutcomes.snapshotId
      || handoff.priorContactAndOutcomes.planner.asOf !== handoff.asOf) fail();
  } else if (handoff.scope.prospectIds.length || handoff.priorContactAndOutcomes.snapshotId !== null) fail();
  const checkEvents = (values: z.infer<typeof events>) => { for (const event of values) {
    validateBusinessHistory(event); subset([event.subjectKey], expected.subjectKeys);
    if (event.recordedAt > expected.preparedAt) fail();
    if (event.kind === "run_summary") subset(event.prospectIds, expected.companyProspectIds);
  } };
  if (handoff.businessHistory) {
    same(handoff.businessHistory.subjectKeys, expected.subjectKeys);
    if (handoff.businessHistory.asOf !== handoff.asOf) fail();
    [handoff.businessHistory.explicitDecisions, handoff.businessHistory.inferences, handoff.businessHistory.hypotheses, handoff.businessHistory.recentRunSummaries].forEach(checkEvents);
  }
  if (handoff.businessOverview) {
    const overview = handoff.businessOverview.overview, { overviewId, ...body } = overview;
    if (digest(body) !== overviewId || overview.scope.principalId !== expected.principalId
      || overview.computedAt > expected.preparedAt || overview.asOf > expected.preparedAt) fail();
    subset(overview.scope.subjectKeys, expected.subjectKeys); subset(overview.scope.prospectIds, expected.companyProspectIds);
    [overview.decisions, overview.inferences, overview.hypotheses].forEach(checkEvents);
    checkPlan(overview.outcomeAnalysis, overview.scope.prospectIds);
    const saved = await db.doc(LEARNING_ROOT).collection("businessOverviews").doc(overviewId).get();
    if (!saved.exists) fail(); same(saved.data(), overview);
  }
  return structuredClone(handoff) as unknown as Handoff;
}
