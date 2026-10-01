import { describe, expect, it } from "vitest";
import { digest } from "../research-learning/contract";
import { authorizeSources, cellRowHash, CRM_HEADERS, CRM_SHEET_ID, knowledgeContentHash, originalDate, publicUrl,
  reconcilePriorResearch, scopeSourceSnapshot, verifySourceSnapshot, safeText, type SourceInputs, type SourceGrant, type SourceRequest } from "../research-learning/prior-research";
import { makeSiteLearning, siteLearningHistory, type SiteLearningInput } from "../research-learning/site-learning";
import { ResearchSourceStore, type SiteLearningWriterContext } from "../research-learning/source-store";
import { sharedResearchContext, sheetsPriorResearchView, notionPriorResearchSummary } from "../research-learning/shared-context";
import { learningMemoryFirestore } from "./fixtures/research-learning";
import { cachedDiscoveryIndex, searchDiscoveryIndex, type DiscoveryQuery } from "../research-learning/retrieval";

const now = "2026-10-01T21:00:00.000Z";
function fixture() {
  const rows = [1, 2].map(number => [`BP-${number}`, `Organization ${number}`, "site", `Facility ${number}`,
    "PRIVATE_CONTACT_NAME", "private@example.com", "Needs recheck", "https://example.org/contact", "Vendor hypothesis", "https://example.org/task", "Research", "old-owner",
    "next", "9/29/2026", "Task hypothesis", "https://example.org/capability", "Unverified", "Sacramento", "9/29/2026"]);
  const knowledge: any = { schema_version: "blueprint.knowledge-snapshot.v1", exported_at: "2026-09-30T16:56:24.851365+00:00",
    companies: [1, 2].map(number => ({ company_id: `company-${number}`, name: `Company ${number}`, roles: [], source_page_ids: [`page-${number}`] })),
    source_pages: [1, 2].map(number => ({ page_id: `page-${number}`, url: `https://example.org/page-${number}`, revision: { kind: "page_last_edited_at", value: "2026-09-29T10:00:00Z" } })),
    records: [1, 2].map(number => ({ record_id: `cap-${number}`, company_id: `company-${number}`, record_type: "reviewed_capability", product: { name: `Product ${number}`, version: null },
      task_tags: ["folding"], geography_tags: [], facts: [{ fact_id: `fact-${number}`, field: "task_claim", statement: "Vendor claim; actual site fit remains unknown.",
        status: number === 1 ? "reviewed" : "conflicted", evidence_level: "vendor_claim", confidence: "unknown", freshness_days: 1, task_tags: ["folding"], geography_tags: [], source_page_ids: [`page-${number}`],
        limits: ["Site fit unknown"], conflicts: number === 1 ? [] : ["Conflicting sources"], sources: [{ url: "https://example.org/claim", source_checked_at: "2026-09-29", revalidated_at: null,
          publication_date: null, classification: "vendor", publisher: "Vendor", quote: "excluded private quote" }] }] })) };
  knowledge.content_hash = knowledgeContentHash(knowledge);
  const input: SourceInputs = { crm: { sheet_id: CRM_SHEET_ID, complete: true, captured_at: "2026-10-01T12:00:03.100Z", values: [[], [], [], [], [...CRM_HEADERS], ...rows] },
    crmSourceHash: digest("crm bytes"), knowledge, knowledgeSourceHash: digest("knowledge bytes"), independentHeaders: [...CRM_HEADERS],
    independentRows: rows.map(row => ({ crmId: String(row[0]), rowHash: cellRowHash(row) })), canonical: [],
    researchRuns: [{ date: "2026-10-01", state: "failed", recordRef: "blueprintDailyResearch/sites-first/runs/2026-10-01" }] };
  const grant: SourceGrant = { principalId: "human-1", crmIds: ["BP-1", "BP-2"], capabilityIds: ["cap-1", "cap-2"], sections: ["crm", "capabilities", "site_learning"], expiresAt: "2026-10-02T00:00:00.000Z" };
  const request: SourceRequest = { crmIds: [...grant.crmIds], capabilityIds: [...grant.capabilityIds], sections: [...grant.sections], asOf: now };
  return { input, grant, request };
}
const reconcile = (f = fixture()) => reconcilePriorResearch(f.input, f.grant, f.request, now);
const reseal = (snapshot: any) => { const { snapshotId: _id, contentHash: _hash, ...content } = snapshot; const hash = digest(content); return { ...content, snapshotId: hash, contentHash: hash }; };
function human(changes: Partial<SiteLearningInput> = {}) {
  return makeSiteLearning({ crmId: "BP-1", canonicalProspectId: null, siteId: null, taskId: null, occurredAt: "2026-09-30T10:00:00.000Z", recordedAt: now,
    capturedBy: "human-1", ownerConfirmed: true, correctsEventId: null, statedMotive: null, boundedQuestion: null, decisionChangingEvidence: null,
    statedDecisionOwnerId: "site-owner-1", evidenceOwnerId: null, briefChoice: "later", brief: null, usefulness: "unknown", feedback: null,
    attestation: { recordRef: "humanLearning/capture-1", sourceHash: digest("human source"), attestedBy: "human-1", attestedAt: now }, ...changes });
}

describe("bounded prior-research reconciliation", () => {
  it("preserves CRM IDs, missing native joins, original checks, conflicts and failed run", () => {
    const result = reconcile();
    expect(result).toMatchObject({ errors: [], readyForStagedAppend: true, readyForCutover: false,
      counts: { crmRows: 2, companies: 2, capabilityRecords: 2, capabilityFacts: 2, joinedCanonicalProspects: 0, normalizedOutcomeEvents: 0 } });
    expect(result.snapshot.crmRows[0]).toMatchObject({ crmId: "BP-1", sourceCheckedDate: "9/29/2026", canonical: { prospectId: null } });
    expect(result.snapshot.capabilities[1].facts[0]).toMatchObject({ status: "conflicted", evidenceLevel: "vendor_claim", confidence: "unknown" });
    expect(result.snapshot.source.knowledge.capturedAt).toBe("2026-09-30T16:56:24.851365+00:00");
    expect(result.snapshot.unknowns).toContain("failed_run_is_not_completed_research");
    const serialized = JSON.stringify(result.snapshot);
    for (const marker of ["private@example.com", "PRIVATE_CONTACT_NAME", "excluded private quote", "old-owner"]) expect(serialized).not.toContain(marker);
    expect(verifySourceSnapshot(result.snapshot)).toEqual(result.snapshot);
  });
  it.each(["headers", "incomplete", "wrongSheet", "knowledgeHash"])("fails closed on invalid %s source", kind => {
    const f = fixture();
    if (kind === "headers") f.input.independentHeaders[0] = "Other ID";
    if (kind === "incomplete") f.input.crm.complete = false;
    if (kind === "wrongSheet") f.input.crm.sheet_id = "other";
    if (kind === "knowledgeHash") f.input.knowledge.records[0].facts[0].statement = "Changed without matching source hash";
    expect(() => reconcile(f)).toThrow();
  });
  it.each(["missing", "duplicate", "changed"])("blocks staging when independent CRM rows are %s", kind => {
    const f = fixture();
    if (kind === "missing") f.input.independentRows.pop();
    if (kind === "duplicate") f.input.independentRows.push(f.input.independentRows[0]);
    if (kind === "changed") f.input.independentRows[0].rowHash = digest("changed row");
    const result = reconcile(f); expect(result.readyForStagedAppend).toBe(false); expect(result.counts.proposedSourceSnapshots).toBe(0); expect(result.errors.length).toBeGreaterThan(0);
  });
  it("blocks ambiguous canonical joins and retains exact supplied native IDs", () => {
    const f = fixture(); f.input.canonical = [{ crmId: "BP-1", prospectId: "native-1", siteId: "site-1", taskId: "task-1", caseId: "case-1" }];
    expect(reconcile(f).snapshot.crmRows[0].canonical).toEqual({ prospectId: "native-1", siteId: "site-1", taskId: "task-1", caseId: "case-1" });
    f.input.canonical.push({ ...f.input.canonical[0], prospectId: "competing-native" });
    expect(reconcile(f).errors).toContain("canonical_join_ambiguous");
  });
  it.each(["2026-02-30", "2026-13-01", "2/30/2026", "2026-01-01Tbad"])("rejects invalid original date %s", value => expect(originalDate.safeParse(value).success).toBe(false));
  it.each(["https://example.org/?email=private%40example.com", "https://example.org/?contact=private%2540example.com", "https://example.org/?password=secret", "https://example.org/?apiKey=secret", "https://example.org/?client-secret=secret", "https://example.org/?token=secret", "https://example.org/?sign%2561ture=secret", "https://example.org/?%2574oken=secret", "https://user:password@example.org", "https://example.org/%ZZ", "http://example.org"])("rejects private or malformed URL %s", value => expect(publicUrl.safeParse(value).success).toBe(false));
  it("rejects privacy contamination and future source checks", () => {
    const f = fixture(); f.input.knowledge.records[0].facts[0].statement = "Contact private@example.com"; f.input.knowledge.content_hash = knowledgeContentHash(f.input.knowledge);
    expect(() => reconcile(f)).toThrow("learning_private_text");
    const future = fixture(); future.input.knowledge.records[0].facts[0].sources[0].source_checked_at = "2026-10-02"; future.input.knowledge.content_hash = knowledgeContentHash(future.input.knowledge);
    expect(() => reconcile(future)).toThrow("date_invalid");
  });
  it.each(["authorization=private", "token=private", "OPENAI_API_KEY=private", "APP_ACCESS_TOKEN=private", "AWS_ACCESS_KEY_ID=private", "AWS_SECRET_ACCESS_KEY=private", '{"access_token":"private"}', '{"api_key":"private"}', '{"authorization":"private"}', "-----BEGIN PRIVATE KEY-----", "credentials: private", "signature=private", "See https://example.org/?token=private", "See https://example.org/?%2574oken=private"])("rejects private free-text evidence %s", value => expect(safeText().safeParse(value).success).toBe(false));
  it.each(["company", "page"])("reports duplicated %s IDs even when a missing join offsets the count", kind => {
    const f = fixture();
    if (kind === "company") f.input.knowledge.companies = [f.input.knowledge.companies[0], f.input.knowledge.companies[0]];
    else f.input.knowledge.source_pages = [f.input.knowledge.source_pages[0], f.input.knowledge.source_pages[0]];
    f.input.knowledge.content_hash = knowledgeContentHash(f.input.knowledge);
    const result = reconcile(f); expect(result.readyForStagedAppend).toBe(false); expect(result.errors).toHaveLength(2);
  });
  it("scopes every company, capability, CRM row and source page to explicit grants", () => {
    const f = fixture(), value = reconcile(f).snapshot;
    const request = { ...f.request, crmIds: ["BP-1"], capabilityIds: ["cap-1"] }, grant = { ...f.grant, principalId: "agent-1", crmIds: ["BP-1"], capabilityIds: ["cap-1"] };
    const result = scopeSourceSnapshot(value, grant, request, now);
    expect(result.crmRows.map(row => row.crmId)).toEqual(["BP-1"]); expect(result.capabilities.map(row => row.capabilityId)).toEqual(["cap-1"]);
    expect(result.companies.map(row => row.companyId)).toEqual(["company-1"]); expect(result.sourcePages.map(row => row.pageId)).toEqual(["page-1"]);
    expect(result.parentSnapshotId).toBe(value.snapshotId); expect(result.scope.principalId).toBe("agent-1");
    expect(scopeSourceSnapshot(result, grant, request, now)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("Facility 2"); expect(verifySourceSnapshot(result)).toEqual(result);
    expect(() => scopeSourceSnapshot(value, grant, f.request, now)).toThrow("scope_denied");
    expect(() => authorizeSources({ ...grant, expiresAt: now }, request, now)).toThrow("scope_denied");
    expect(() => authorizeSources(grant, { ...request, asOf: "2027-01-01T00:00:00Z" }, now)).toThrow("scope_denied");
  });
  it("rejects tampering and self-hashed unauthorized rows or broken joins", () => {
    const value = reconcile().snapshot;
    expect(() => verifySourceSnapshot({ ...value, crmRows: [] })).toThrow("hash_mismatch");
    expect(() => verifySourceSnapshot(reseal({ ...value, scope: { ...value.scope, crmIds: ["BP-1"] } }))).toThrow("join_invalid");
    expect(() => verifySourceSnapshot(reseal({ ...value, companies: [] }))).toThrow("join_invalid");
    expect(() => verifySourceSnapshot(reseal({ ...value, sourcePages: [] }))).toThrow("join_invalid");
  });
});

describe("additive source staging and human site learning", () => {
  it("creates once, reads back with scope, and cannot write a source or pointer", async () => {
    const f = fixture(), report = reconcile(f), snapshot = report.snapshot, mem = learningMemoryFirestore(), store = new ResearchSourceStore(mem.db, () => now);
    expect(await store.stage(report, f.grant, f.request)).toBe("created"); expect(await store.stage(report, f.grant, f.request)).toBe("existing");
    const view = await store.read(snapshot.snapshotId, f.grant, { ...f.request, crmIds: ["BP-1"], capabilityIds: ["cap-1"] });
    expect(view.crmRows).toHaveLength(1); expect(mem.writes).toEqual([`blueprintResearchLearning/default/sourceSnapshots/${snapshot.snapshotId}`]);
    await expect(store.stage(report, { ...f.grant, principalId: "other" }, f.request)).rejects.toThrow("stage_invalid");
    await expect(store.read(snapshot.snapshotId, { ...f.grant, crmIds: [] }, f.request)).rejects.toThrow("scope_denied");
    mem.records.set(`blueprintResearchLearning/default/sourceSnapshots/${snapshot.snapshotId}`, scopeSourceSnapshot(snapshot, f.grant, f.request, now));
    await expect(store.stage(report, f.grant, f.request)).rejects.toThrow("stage_conflict");
  });
  it("retains later/no as brief choices and unknown usefulness without fake responses", () => {
    const f = fixture();
    const result = sharedResearchContext(reconcile(f).snapshot, [human(), human({ crmId: "BP-2", briefChoice: "no" })], f.grant, f.request, now);
    expect(result.siteLearning.current.map(event => event.briefChoice).sort()).toEqual(["later", "no"]);
    expect(result.siteLearning.current.every(event => event.usefulness === "unknown")).toBe(true); expect(result.classificationPolicy.enabled).toBe(false);
    expect(result.siteLearning.current[0].capturedBy).not.toBe(result.siteLearning.current[0].statedDecisionOwnerId);
  });
  it("requires the exact successful private reconciliation before staging", async () => {
    const f = fixture(), report = reconcile(f), mem = learningMemoryFirestore(), store = new ResearchSourceStore(mem.db, () => now);
    await expect(store.stage(structuredClone(report), f.grant, f.request)).rejects.toThrow("reconciliation_required");
    const invalid = fixture(); invalid.input.independentRows[0].rowHash = digest("different row");
    const badReport = reconcile(invalid); badReport.errors = []; badReport.readyForStagedAppend = true;
    await expect(store.stage(badReport, f.grant, f.request)).rejects.toThrow("reconciliation_required");
    report.snapshot = reseal({ ...report.snapshot, unknowns: ["changed"] });
    await expect(store.stage(report, f.grant, f.request)).rejects.toThrow("reconciliation_required");
    expect(mem.writes).toEqual([]);
  });
  it("exports only the selected prior-research review rows and counted playbook facts", () => {
    const f = fixture(), snapshot = reconcile(f).snapshot, request = { ...f.request, crmIds: ["BP-1"], capabilityIds: ["cap-1"] };
    const sheet = sheetsPriorResearchView(snapshot, f.grant, request, now), summary = notionPriorResearchSummary(snapshot, f.grant, request, now);
    expect(sheet.rows).toHaveLength(1); expect(sheet.rows[0].slice(0, 5)).toEqual(["BP-1", "unknown", "unknown", "unknown", "9/29/2026"]);
    expect(summary.counts).toMatchObject({ crmRows: 1, exactNativeJoins: 0, companies: 1, capabilities: 1, facts: 1, reviewedFacts: 1, conflictedFacts: 0 });
    expect(JSON.stringify([sheet, summary])).not.toContain("private@example.com"); expect(JSON.stringify(summary)).not.toContain("company-2");
  });
  it.each(["helped", "did_not_help", "pending"] as const)("requires exact brief and attributed feedback for %s", usefulness => expect(() => human({ usefulness })).toThrow());
  it("rejects raw private text, forged attestation and future feedback", () => {
    expect(() => human({ statedMotive: "private@example.com" })).toThrow("learning_private_text");
    expect(() => human({ attestation: { ...human().attestation, attestedBy: "other" } })).toThrow("attestation_invalid");
    expect(() => human({ statedMotive: "password=private" })).toThrow("learning_private_text");
    expect(() => human({ attestation: { ...human().attestation, attestedAt: "2026-09-29T10:00:00Z" } })).toThrow("attestation_invalid");
    expect(() => human({ feedback: { feedbackId: "feedback-1", attributedToId: "site-owner-1", summary: "Requested feedback", observedAt: "2026-09-30T10:00:00Z", requestedAt: "2026-09-30T11:00:00Z" } })).toThrow("feedback_request_future");
    expect(() => human({ feedback: { feedbackId: "feedback-1", attributedToId: "site-owner-1", summary: "Late feedback", observedAt: "2026-10-01T10:00:00Z", requestedAt: null } })).toThrow("feedback_request_future");
  });
  it("appends human observations only against an exact authorized source subject and binding", async () => {
    const f = fixture(), report = reconcile(f), snapshot = report.snapshot, mem = learningMemoryFirestore(), store = new ResearchSourceStore(mem.db, () => now), event = human();
    await store.stage(report, f.grant, f.request);
    const context: SiteLearningWriterContext = { grant: f.grant, request: f.request, sourceSnapshotId: snapshot.snapshotId, attestation: event.attestation, briefBinding: null };
    expect(await store.appendSiteLearning(event, context)).toBe("created"); expect(await store.appendSiteLearning(event, context)).toBe("existing");
    expect((await store.readSiteLearning(f.grant, { ...f.request, crmIds: ["BP-1"] })).current).toEqual([event]);
    await expect(store.appendSiteLearning(human({ siteId: "invented-site" }), context)).rejects.toThrow("subject_join_changed");
    await expect(store.appendSiteLearning(event, { ...context, attestation: { ...event.attestation, sourceHash: digest("other") } })).rejects.toThrow("writer_scope_denied");
    const withBrief = human({ brief: { recordRef: "humanBrief/brief-1", briefId: "brief-1", version: "blueprint.site-brief.v1", revision: 1, contentHash: digest("actual brief") },
      usefulness: "helped", feedback: { feedbackId: "feedback-1", attributedToId: "site-owner-1", summary: "Answered the bounded question", observedAt: "2026-09-30T10:00:00Z", requestedAt: null } });
    await expect(store.appendSiteLearning(withBrief, context)).rejects.toThrow("writer_scope_denied");
    expect(await store.appendSiteLearning(withBrief, { ...context, briefBinding: withBrief.brief })).toBe("created");
  });
  it("preserves correction history, rejects changed joins/siblings, and uses earliest duplicate capture", () => {
    const f = fixture(), original = human(), correction = human({ briefChoice: "brief", correctsEventId: original.eventId });
    expect(siteLearningHistory([correction, original], f.grant, f.request, now).current).toEqual([correction]);
    expect(() => siteLearningHistory([correction], f.grant, f.request, now)).toThrow("missing_or_conflicted");
    expect(() => siteLearningHistory([original, correction, human({ correctsEventId: original.eventId, briefChoice: "no" })], f.grant, f.request, now)).toThrow("missing_or_conflicted");
    expect(() => siteLearningHistory([original, human({ correctsEventId: original.eventId, siteId: "changed" })], f.grant, f.request, now)).toThrow("join_changed");
    const later = { ...original, recordedAt: "2026-10-01T21:01:00Z" };
    expect(siteLearningHistory([later, original], f.grant, { ...f.request, asOf: "2026-10-01T21:01:00Z" }, "2026-10-01T21:02:00Z").history).toEqual([original]);
  });
});

describe("progressive agent-directed research retrieval", () => {
  const query: DiscoveryQuery = { taskTags: ["unlisted-task"], regionTags: ["Sacramento"], companyIds: [], capabilityIds: [], pageSize: 1, cursor: null };
  function discovery() {
    const f = fixture(), snapshot = reconcile(f).snapshot, index = cachedDiscoveryIndex(snapshot, f.grant, f.request, now);
    return { f, snapshot, index, grant: { principalId: "research-agent", indexHash: index.indexHash, expiresAt: "2026-10-02T00:00:00Z" } };
  }
  it("starts with a compact cached index and explicitly does not claim full Firestore directory coverage", () => {
    const d = discovery(), first = searchDiscoveryIndex(d.index, d.grant, query, now);
    expect(first).toMatchObject({ coverage: "cached_capabilities_only", completeForSource: false, totalIndexed: 2, capabilityAbsenceIsEvidenceOfIncompatibility: false });
    expect(first.rows).toHaveLength(1); expect(first.rows[0].teamId).toBeNull();
    for (const excluded of ["Vendor claim;", "private@example.com", "PRIVATE_CONTACT_NAME", '"facts"']) expect(JSON.stringify(first)).not.toContain(excluded);
    expect(first.source.sourceHash).toBe(d.snapshot.snapshotId);
    const scoped = scopeSourceSnapshot(d.snapshot, d.f.grant, { ...d.f.request, capabilityIds: ["cap-1"] }, now);
    const narrowedIndex = cachedDiscoveryIndex(scoped, d.f.grant, { ...d.f.request, capabilityIds: ["cap-1"] }, now);
    expect(narrowedIndex.source.recordRef).toContain(d.snapshot.snapshotId); expect(narrowedIndex.source.sourceHash).toBe(d.snapshot.snapshotId);
    expect(sharedResearchContext(d.snapshot, [], d.f.grant, d.f.request, now).retrieval.liveDirectoryReaderEnabled).toBe(false);
  });
  it("keeps nonmatching and unknown entries reachable through paging and broadening", () => {
    const d = discovery(), first = searchDiscoveryIndex(d.index, d.grant, query, now), second = searchDiscoveryIndex(d.index, d.grant, { ...query, cursor: first.nextCursor }, now);
    expect([...first.rows, ...second.rows].map(row => row.entryId).sort()).toEqual(["cap-1", "cap-2"]);
    expect(first.rows[0].taskMatch).toBe("other_indexed_tasks"); expect(first.rows[0].regionMatch).toBe("unknown"); expect(second.nextCursor).toBeNull();
    expect(searchDiscoveryIndex(d.index, d.grant, { ...first.broaden, pageSize: 25 }, now).rows).toHaveLength(2);
  });
  it("lets agents rank by company or capability without permanently removing alternatives", () => {
    const d = discovery(), focused = searchDiscoveryIndex(d.index, d.grant, { ...query, companyIds: ["company-2"], capabilityIds: ["cap-2"], pageSize: 25 }, now);
    expect(focused.rows.map(row => row.entryId)).toEqual(["cap-2", "cap-1"]); expect(focused.rows[0].hasConflicts).toBe(true);
    expect(focused.detailAuthority).toContain("separate_host");
  });
  it("does not let directory access broaden an existing detail grant", () => {
    const d = discovery(), first = searchDiscoveryIndex(d.index, d.grant, query, now);
    expect(first.totalIndexed).toBe(2);
    expect(() => scopeSourceSnapshot(d.snapshot, { ...d.f.grant, capabilityIds: ["cap-1"] }, { ...d.f.request, capabilityIds: ["cap-2"] }, now)).toThrow("scope_denied");
  });
  it("keeps exact capability ID identity while text tags may ignore case", () => {
    const f = fixture(); f.input.knowledge.records[1].record_id = "CAP-1";
    f.grant.capabilityIds = ["cap-1", "CAP-1"]; f.request.capabilityIds = [...f.grant.capabilityIds]; f.input.knowledge.content_hash = knowledgeContentHash(f.input.knowledge);
    const index = cachedDiscoveryIndex(reconcile(f).snapshot, f.grant, f.request, now);
    const result = searchDiscoveryIndex(index, { principalId: "research-agent", indexHash: index.indexHash, expiresAt: "2026-10-02T00:00:00Z" },
      { ...query, taskTags: ["FOLDING"], capabilityIds: ["cap-1"], pageSize: 25 }, now);
    expect(result.rows.find(row => row.entryId === "cap-1")!.score).toBe(2); expect(result.rows.find(row => row.entryId === "CAP-1")!.score).toBe(1);
  });
  it("compacts more than twenty valid original check dates without dropping details", () => {
    const f = fixture(), fact = f.input.knowledge.records[0].facts[0];
    fact.sources = Array.from({ length: 20 }, (_, index) => ({ ...fact.sources[0], source_checked_at: `2026-09-${String(index + 1).padStart(2, "0")}` }));
    f.input.knowledge.records[0].facts.push({ ...fact, fact_id: "second-fact", sources: [{ ...fact.sources[0], source_checked_at: "2026-09-21" }] });
    f.input.knowledge.content_hash = knowledgeContentHash(f.input.knowledge);
    const snapshot = reconcile(f).snapshot, index = cachedDiscoveryIndex(snapshot, f.grant, f.request, now);
    expect(index.entries[0].sourceCheckRange).toEqual({ earliest: "2026-09-01", latest: "2026-09-21", uniqueDateCount: 21 });
    expect(snapshot.capabilities[0].facts[0].sources).toHaveLength(20);
  });
  it("marks empty evidence and unknown confidence as unknown", () => {
    const f = fixture(); f.input.knowledge.records[0].facts = []; f.input.knowledge.content_hash = knowledgeContentHash(f.input.knowledge);
    expect(cachedDiscoveryIndex(reconcile(f).snapshot, f.grant, f.request, now).entries[0].hasUnknowns).toBe(true);
    expect(discovery().index.entries[0].hasUnknowns).toBe(true);
  });
  it("rejects stale/forged indices, expired grants and cross-query cursor reuse", () => {
    const d = discovery(), first = searchDiscoveryIndex(d.index, d.grant, query, now);
    expect(() => searchDiscoveryIndex({ ...d.index, entries: [] }, d.grant, query, now)).toThrow("scope_or_hash_invalid");
    expect(() => searchDiscoveryIndex(d.index, { ...d.grant, indexHash: digest("other") }, query, now)).toThrow("scope_or_hash_invalid");
    expect(() => searchDiscoveryIndex(d.index, { ...d.grant, expiresAt: now }, query, now)).toThrow("scope_or_hash_invalid");
    expect(() => searchDiscoveryIndex(d.index, d.grant, { ...query, taskTags: ["new-task"], cursor: first.nextCursor }, now)).toThrow("cursor_invalid");
  });
});
