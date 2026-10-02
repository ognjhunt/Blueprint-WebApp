import { describe, expect, it, vi } from "vitest";
import { createCompanyHistoryTools, loadCompanyHistory, type CompanyHistoryAccess, type CompanyHistoryRecord } from "../research-learning/company-history";
import { digest, LEARNING_ROOT, makeEvent } from "../research-learning/contract";
import { learningEvent, learningMemoryFirestore } from "./fixtures/research-learning";
import { verifySourceSnapshot } from "../research-learning/prior-research";

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

describe("agent-selected company history", () => {
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
