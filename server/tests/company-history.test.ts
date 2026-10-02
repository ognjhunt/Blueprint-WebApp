import { describe, expect, it, vi } from "vitest";
import { createCompanyHistoryTools, loadCompanyHistory, type CompanyHistoryAccess, type CompanyHistoryRecord } from "../research-learning/company-history";
import { digest, LEARNING_ROOT, makeEvent } from "../research-learning/contract";
import { learningEvent, learningMemoryFirestore, learningSections } from "./fixtures/research-learning";
import { verifySourceSnapshot } from "../research-learning/prior-research";
import { runDailyBusinessAnalysis } from "../research-learning/business-learning-loop";
import { buildSnapshot } from "../research-learning/snapshot";

const now = "2026-10-02T16:00:00.000Z";
const access: CompanyHistoryAccess = { principalId: "company-worker", expiresAt: "2026-10-02T17:00:00.000Z", companyWide: true };
const row = (id: string, statement: string, city = "Chicago"): CompanyHistoryRecord => ({ record_id: id,
  kind: "hypothesis", source_ref: `${LEARNING_ROOT}/businessHistoryEvents/${id}`, source_sha256: digest(statement),
  original_checked_at: "2026-09-30T12:00:00.000Z", city, industry: "Warehouses", task: "material handling", company: "Blueprint",
  current: true, content: { statement } });
const corpus = (records: CompanyHistoryRecord[]) => ({ records, diagnostics: [], coverage: ["fixture_company_history"] });
const emptySettingsDb = { doc: () => ({ get: async () => ({ exists: false }) }) } as any;
const open = (records: CompanyHistoryRecord[], extra: Parameters<typeof createCompanyHistoryTools>[2] = {}) =>
  createCompanyHistoryTools(emptySettingsDb, access, { load: async () => corpus(records), now: () => now, ...extra });

async function storedOverview() {
  const memory = learningMemoryFirestore(), subjectKey = "blueprint:research-learning";
  const scope = { principalId: access.principalId, subjectKeys: [subjectKey], expiresAt: access.expiresAt };
  const grant = { principalId: access.principalId, prospectIds: ["prospect-1"], sections: [...learningSections], expiresAt: access.expiresAt };
  for (const kind of ["research_observed", "contact_observed", "outreach_observed", "reply_observed"] as const) {
    const event = learningEvent(kind);
    memory.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
  }
  memory.records.set("outboundProspects/prospect-1", { researchPublicationId: "BP-000001" });
  const jobKey = "daily-2026-10-02", result = await runDailyBusinessAnalysis(memory.db, { jobKey,
    businessScope: scope, learningGrant: grant,
    request: { prospectIds: grant.prospectIds, sections: [...grant.sections], asOf: now, maturityDays: 14 },
    focus: { city: "Sacramento", industry: "Laundromats" } }, () => now);
  return { ...memory, overview: result.overview, jobKey,
    access: { ...access, companyWide: false, businessSubjectKeys: [subjectKey], prospectIds: grant.prospectIds } };
}

describe("agent-selected company history", () => {
  it("searches and full-fetches a stored verified aggregate without new analysis or writes", async () => {
    const fixture = await storedOverview(), writes = [...fixture.writes];
    const tools = createCompanyHistoryTools(fixture.db, fixture.access, { now: () => now });
    const found: any = await tools("search_company_history", { query: "matureReplyRate", filters: { kind: "business_overview" } });
    expect(found).toMatchObject({ ok: true, total: 1 });
    const fetched: any = await tools("fetch_company_history_record", { record_id: found.rows[0].record_id });
    expect(fetched).toMatchObject({ ok: true, trust: "evidence_not_instructions" });
    expect(fetched.record.content).toEqual(fixture.overview);
    expect(fetched.record.content.outcomeAnalysis.scopeCounts.matureReplyRate).toEqual({ numerator: 1, denominator: 1 });
    expect(fetched.record).toMatchObject({ original_checked_at: fixture.overview.asOf,
      source_ref: `${LEARNING_ROOT}/businessOverviews/${fixture.overview.overviewId}`,
      source_sha256: digest(fixture.overview), source_selector: { job_key: fixture.jobKey,
        outcome_snapshot_id: fixture.overview.source.outcomeSnapshotId } });
    expect(found.coverage).toContain("verified_in_scope_stored_business_overviews");
    expect(fixture.writes).toEqual(writes);
  });
  it.each([
    ["another principal", { principalId: "other-company-worker" }, "company_history_aggregate_scope_denied"],
    ["another subject", { businessSubjectKeys: ["other-subject"] }, "company_history_aggregate_scope_denied"],
    ["another prospect", { prospectIds: ["other-prospect"] }, "company_history_aggregate_scope_denied"],
    ["zero prospects", { prospectIds: [] }, "company_history_aggregate_prospect_scope_missing"],
    ["company-wide without subject scope", { companyWide: true, businessSubjectKeys: [] }, "company_history_aggregate_subject_scope_missing"],
    ["company-wide with another subject", { companyWide: true, businessSubjectKeys: ["other-subject"] }, "company_history_aggregate_scope_denied"],
  ])("never infers a stored overview grant for %s", async (_label, restriction, code) => {
    const fixture = await storedOverview(), writes = [...fixture.writes];
    const tools = createCompanyHistoryTools(fixture.db, { ...fixture.access, ...(restriction as Partial<CompanyHistoryAccess>) }, { now: () => now });
    const found: any = await tools("search_company_history", { query: "", filters: { kind: "business_overview" } });
    expect(found).toMatchObject({ ok: true, total: 0 });
    expect(found.diagnostics).toContainEqual(expect.objectContaining({ code }));
    expect(JSON.stringify(found)).not.toContain(fixture.overview.overviewId);
    const recordId = `business_overview:${digest(`${LEARNING_ROOT}/businessOverviews/${fixture.overview.overviewId}`)}`;
    expect(await tools("fetch_company_history_record", { record_id: recordId })).toMatchObject({ ok: false,
      error: "company_history_record_missing_or_not_authorized" });
    expect(fixture.writes).toEqual(writes);
  });
  it.each(["overview", "receipt", "missing snapshot", "changed snapshot", "valid contradictory snapshot"])(
    "quarantines %s while keeping independent authorized history readable", async invalid => {
      const fixture = await storedOverview(), overviewRef = `${LEARNING_ROOT}/businessOverviews/${fixture.overview.overviewId}`;
      const receiptRef = `${LEARNING_ROOT}/businessOverviewRuns/${fixture.jobKey}`;
      const snapshotRef = `${LEARNING_ROOT}/snapshots/${fixture.overview.source.outcomeSnapshotId}`;
      if (invalid === "overview") fixture.records.set(overviewRef, { ...fixture.overview, unknowns: ["TAMPERED_PRIVATE_SENTINEL"] });
      else if (invalid === "receipt") fixture.records.set(receiptRef, { ...fixture.records.get(receiptRef), jobKey: "wrong-job" });
      else if (invalid === "missing snapshot") fixture.records.delete(snapshotRef);
      else if (invalid === "changed snapshot") fixture.records.set(snapshotRef, { ...fixture.records.get(snapshotRef), asOf: "2026-10-01T16:00:00.000Z" });
      else {
        const original = fixture.records.get(snapshotRef), grant = { principalId: fixture.access.principalId,
          prospectIds: fixture.access.prospectIds, sections: [...learningSections], expiresAt: fixture.access.expiresAt };
        const swapped = buildSnapshot(original.rows.flatMap((item: any) => item.history), grant,
          { prospectIds: grant.prospectIds, sections: grant.sections, asOf: now, maturityDays: 90 }, now);
        fixture.records.set(`${LEARNING_ROOT}/snapshots/${swapped.snapshotId}`, swapped);
        const { overviewId: _id, ...body } = fixture.overview;
        const changed = { ...body, source: { ...body.source, outcomeSnapshotId: swapped.snapshotId } };
        const wrong = { ...changed, overviewId: digest(changed) };
        fixture.records.set(`${LEARNING_ROOT}/businessOverviews/${wrong.overviewId}`, wrong);
        fixture.records.set(receiptRef, { ...fixture.records.get(receiptRef), overviewId: wrong.overviewId });
      }
      const writes = [...fixture.writes], loaded = await loadCompanyHistory(fixture.db, fixture.access, () => now);
      expect(loaded.records.some(item => item.kind === "business_overview")).toBe(false);
      expect(loaded.records.some(item => item.kind === "research_observed")).toBe(true);
      expect(loaded.diagnostics).toContainEqual(expect.objectContaining({ code: expect.stringMatching(/^company_history_aggregate_/) }));
      expect(loaded.coverage).toContain("stored_business_overview_coverage_partial");
      expect(JSON.stringify(loaded)).not.toContain("TAMPERED_PRIVATE_SENTINEL");
      expect(fixture.writes).toEqual(writes);
    });
  it("returns no aggregate or sibling content if access expires during the linked snapshot read", async () => {
    const fixture = await storedOverview(), getRecord = fixture.records.get.bind(fixture.records);
    const snapshotRef = `${LEARNING_ROOT}/snapshots/${fixture.overview.source.outcomeSnapshotId}`;
    let time = now;
    vi.spyOn(fixture.records, "get").mockImplementation(path => {
      const result = getRecord(path);
      if (path === snapshotRef) time = fixture.access.expiresAt;
      return result;
    });
    const tools = createCompanyHistoryTools(fixture.db, fixture.access, { now: () => time }), writes = [...fixture.writes];
    const found = await tools("search_company_history", { query: "", filters: { kind: "business_overview" } });
    expect(found).toMatchObject({ ok: false, error: "company_history_access_expired" });
    expect(found).not.toHaveProperty("rows");
    expect(JSON.stringify(found)).not.toContain(fixture.overview.overviewId);
    expect(fixture.writes).toEqual(writes);
  });
  it("lets the agent repair a bad argument, search another city, and fetch the full original evidence", async () => {
    const text = "Material handling correction: inspect collision geometry before choosing a pallet route. ".repeat(30);
    const tool = open([row("r-1", text, "Houston"), row("r-2", "Laundry machines", "Sacramento")]);
    expect(await tool("search_company_history", { city: "Houston" })).toMatchObject({ ok: false, error: "company_history_arguments_invalid" });
    const found: any = await tool("search_company_history", { query: "collision geometry", filters: { city: "Houston" } });
    expect(found).toMatchObject({ ok: true, total: 1, semantic: { status: "unavailable_no_embedding_authority" } });
    expect(found.rows[0].excerpt_is_complete).toBe(false);
    const original: any = await tool("fetch_company_history_record", { record_id: found.rows[0].record_id });
    expect(original.record.content.statement).toBe(text);
    expect(original.record.original_checked_at).toBe("2026-09-30T12:00:00.000Z");
  });
  it("allows an empty query and pages ALL results beyond100 without a permanent result quota", async () => {
    const records = Array.from({ length: 127 }, (_, index) => row(`r-${index.toString().padStart(3, "0")}`, `finding${index}`));
    const tool = open(records), seen: string[] = []; let cursor: string | undefined;
    do {
      const page: any = await tool("search_company_history", { query: "", page_size: 17, ...(cursor ? { cursor } : {}) });
      expect(page.ok).toBe(true); seen.push(...page.rows.map((item: any) => item.record_id)); cursor = page.next_cursor ?? undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(127);
  });
  it("semantic similarity finds different wording across cities and retains nonmatches for later pages", async () => {
    const records = [row("related", "A manipulator needs clearance around the obstacle", "Tokyo"), row("other", "Municipal laundromat permits", "Sacramento")];
    const authority = { enabled: true, model: "test", dimensions: 2, maxInputCharacters: 5000 };
    const tool = createCompanyHistoryTools({} as any, { ...access, embeddingAuthority: authority }, {
      load: async () => corpus(records), now: () => now,
      ensureEmbeddings: vi.fn(async () => ({ records: records.map((item, index) => ({ schemaVersion: 1 as const, id: item.record_id,
        sourceSha256: item.source_sha256, textSha256: digest(item.content), model: "test", dimensions: 2,
        vector: index ? [0, 1] : [1, 0], updatedAt: now })), diagnostics: [] })),
      embedQuery: vi.fn(async () => ({ vector: [1, 0] })),
    });
    const first: any = await tool("search_company_history", { query: "robot collision safety", page_size: 1 });
    expect(first.rows[0]).toMatchObject({ record_id: "related", semantic_similarity: 1 });
    expect(first.semantic.status).toBe("available"); expect(first.next_cursor).toBeTruthy();
    const second: any = await tool("search_company_history", { query: "robot collision safety", page_size: 1, cursor: first.next_cursor });
    expect(second.rows[0].record_id).toBe("other");
  });
  it("returns provider failures visibly while keyword search and original fetch remain usable", async () => {
    const tool = createCompanyHistoryTools({} as any, { ...access, embeddingAuthority: { enabled: true, model: "test", dimensions: 2, maxInputCharacters: 5000 } }, {
      load: async () => corpus([row("r-1", "collision clearance")]), now: () => now,
      ensureEmbeddings: vi.fn(async () => ({ records: [], diagnostics: [] })),
      embedQuery: vi.fn(async () => ({ error: { code: "history_embedding_provider_failed", action: "Use keyword search" } })),
    });
    const result: any = await tool("search_company_history", { query: "collision" });
    expect(result).toMatchObject({ ok: true, semantic: { status: "failed_keyword_and_browse_available", error: "history_embedding_provider_failed" } });
    expect(result.rows[0].keyword_score).toBe(1);
    expect(await tool("fetch_company_history_record", { record_id: "r-1" })).toMatchObject({ ok: true });
  });
  it("rejects stale cursors after source changes or a changed query rather than skipping evidence", async () => {
    const records = [row("r-1", "original"), row("r-2", "unrelated")], tool = open(records);
    const first: any = await tool("search_company_history", { query: "", page_size: 1 });
    expect(await tool("search_company_history", { query: "different", cursor: first.next_cursor })).toMatchObject({ ok: false, error: "company_history_cursor_changed" });
    records[0] = row("r-1", "corrected");
    expect(await tool("search_company_history", { query: "", cursor: first.next_cursor })).toMatchObject({ ok: false, error: "company_history_cursor_changed" });
  });
  it("never treats model arguments as access grants or arbitrary Firestore paths", async () => {
    const tool = open([row("r-1", "public finding")]);
    expect(await tool("search_company_history", { query: "", companyWide: true, principalId: "admin" })).toMatchObject({ ok: false, error: "company_history_arguments_invalid" });
    expect(await tool("fetch_company_history_record", { record_id: "secrets/private/credentials" })).toMatchObject({ ok: false, error: "company_history_record_missing_or_not_authorized" });
  });
  it("checks access again after a slow read and exposes no content after expiration", async () => {
    let time = now;
    const tool = createCompanyHistoryTools({} as any, access, { now: () => time, load: async () => {
      time = "2026-10-02T18:00:00.000Z"; return corpus([row("r-1", "private finding")]);
    } });
    expect(await tool("fetch_company_history_record", { record_id: "r-1" })).toMatchObject({ ok: false, error: "company_history_access_expired" });
  });
  it("loads all company-owned learning events across regions, even after a prospect is archived", async () => {
    const memory = learningMemoryFirestore(), original = learningEvent("research_observed");
    for (const [index, city] of ["Tokyo", "Houston"].entries()) {
      const { eventId: _id, version: _version, ...input } = original;
      const event = makeEvent({ ...input, entities: { ...input.entities, prospectId: `archived-${index}` },
        data: { ...original.data, city, industry: "Warehouses" } } as any);
      memory.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
    }
    const loaded = await loadCompanyHistory(memory.db, access, () => now);
    expect(loaded.records.filter(item => item.kind === "research_observed").map(item => item.city).sort()).toEqual(["Houston", "Tokyo"]);
    expect(loaded.diagnostics).toContainEqual(expect.objectContaining({ code: "company_history_source_snapshot_missing" }));
  });
  it("a narrower access grant cannot retrieve another prospect's events", async () => {
    const memory = learningMemoryFirestore(), original = learningEvent("research_observed");
    memory.records.set(`${LEARNING_ROOT}/events/${original.eventId}`, original);
    const loaded = await loadCompanyHistory(memory.db, { ...access, companyWide: false, prospectIds: ["other"] }, () => now);
    expect(loaded.records).toEqual([]);
    expect(JSON.stringify(loaded)).not.toContain(original.eventId);
  });
  it("searches archived source snapshots as well as new ones, preserving dates, revisions and document provenance", async () => {
    const memory = learningMemoryFirestore();
    const snapshot = (asOf: string, city: string) => {
      const content = { version: "blueprint.research-learning-source-snapshot.v1", asOf,
        scope: { principalId: "source-owner", crmIds: ["BP-000001"], capabilityIds: [], sections: ["crm"] },
        source: { crm: { recordRef: "source/crm", sourceHash: digest("crm"), capturedAt: asOf },
          knowledge: { recordRef: "source/knowledge", sourceHash: digest("knowledge"), capturedAt: asOf },
          knowledgeContentHash: digest("knowledge"), reconciliationHash: digest("reconciled") },
        crmRows: [{ crmId: "BP-000001", organization: "Company", prospectType: "site", siteLabel: "Facility",
          taskHypothesis: "Pallet movement", geography: city, sourceCheckedDate: "2026-09-01", verification: "unknown",
          evidenceMaturity: "unknown", inventoryStage: "Research", publicEvidenceUrls: [], rowHash: digest(city),
          canonical: { prospectId: null, siteId: null, taskId: null, caseId: null } }],
        companies: [], capabilities: [], sourcePages: [], researchRuns: [], unknowns: [], parentSnapshotId: null };
      return verifySourceSnapshot({ ...content, snapshotId: digest(content), contentHash: digest(content) });
    };
    const old = snapshot("2026-09-15T12:00:00.000Z", "Houston"), fresh = snapshot("2026-10-01T12:00:00.000Z", "Tokyo");
    memory.records.set(`${LEARNING_ROOT}/sourceSnapshots/${old.snapshotId}`, old);
    memory.records.set(`${LEARNING_ROOT}/sourceSnapshots/${fresh.snapshotId}`, fresh);
    memory.records.set(`${LEARNING_ROOT}/sourceSnapshots/invalid`, { SECRET: "must not leak" });
    const result = await loadCompanyHistory(memory.db, { ...access, sourceSnapshotId: fresh.snapshotId }, () => now);
    const rows = result.records.filter(item => item.kind === "crm_research");
    expect(rows).toHaveLength(2);
    expect(rows.find(item => item.city === "Houston")).toMatchObject({ current: false, original_checked_at: "2026-09-01",
      source_ref: `${LEARNING_ROOT}/sourceSnapshots/${old.snapshotId}`, source_document_sha256: old.contentHash,
      source_selector: { crm_id: "BP-000001" } });
    expect(rows.find(item => item.city === "Tokyo")?.current).toBe(true);
    expect(JSON.stringify(result)).not.toContain("must not leak");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "company_history_source_snapshot_invalid" }));
    const bounded = await loadCompanyHistory(memory.db, { ...access, companyWide: false, crmIds: ["BP-000001"], prospectIds: [], sourceSnapshotId: fresh.snapshotId }, () => now);
    expect(bounded.records).toHaveLength(1);
    expect(bounded.records[0].kind).toBe("crm_research");
    expect(bounded.records[0].city).toBe("Tokyo");
  });
  it("uses only trusted stored embedding authority and preserves unknown paid-usage diagnostics", async () => {
    const memory = learningMemoryFirestore();
    const authority = { enabled: true, model: "test", dimensions: 2, maxInputCharacters: 5000 };
    memory.records.set(`${LEARNING_ROOT}/historySearchSettings/current`, { schemaVersion: 1,
      authorizationRef: "existing-owner-budget", expiresAt: access.expiresAt, authority });
    const records = [row("r-1", "manipulator clearance")], ensure = vi.fn(async () => ({ records: [{ schemaVersion: 1 as const,
      id: "r-1", sourceSha256: records[0].source_sha256, textSha256: digest(records[0].content), model: "test", dimensions: 2,
      vector: [1, 0], updatedAt: now }], diagnostics: [] }));
    const embed = vi.fn(async () => ({ vector: [1, 0], diagnostics: [{ code: "history_embedding_paid_usage_unknown", action: "Retain accounting as unknown" }] }));
    const tool = createCompanyHistoryTools(memory.db, access, { load: async () => corpus(records), now: () => now, ensureEmbeddings: ensure, embedQuery: embed });
    const result: any = await tool("search_company_history", { query: "robot collision safety" });
    expect(result.semantic).toMatchObject({ status: "available", diagnostics: [expect.objectContaining({ code: "history_embedding_paid_usage_unknown" })] });
    expect(embed.mock.calls[0][1]).toMatchObject({ ...authority, authorizationRef: "existing-owner-budget" });
    memory.records.get(`${LEARNING_ROOT}/historySearchSettings/current`).expiresAt = "2026-10-01T00:00:00.000Z";
    const expired: any = await tool("search_company_history", { query: "robot collision safety" });
    expect(expired.semantic.status).toBe("unavailable_invalid_embedding_authority");
    expect(embed).toHaveBeenCalledTimes(1);
  });
});
