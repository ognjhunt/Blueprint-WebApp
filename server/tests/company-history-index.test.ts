import { describe, expect, it, vi } from "vitest";
import { digest } from "../research-learning/contract";
import { createCompanyHistoryTools, type CompanyHistoryRecord } from "../research-learning/company-history";
import { cosineSimilarity, createHistoryEmbedder, embedHistoryQuery, ensureHistoryEmbeddings,
  HISTORY_SEARCH_INDEX_ROOT, HISTORY_SEARCH_SETTINGS_REF, loadHistoryEmbeddingAuthority, readHistoryIndexPage, type HistoryEmbeddingAuthority } from "../research-learning/company-history-index";

const authority: HistoryEmbeddingAuthority = { enabled: true, model: "text-embedding-3-small", dimensions: 3, maxInputCharacters: 10000 };
const source = (id: string, text: string) => ({ id, text, sourceSha256: digest({ id, text }) });
function memoryIndex(onGet?: () => void, onSet?: () => void) {
  const rows = new Map<string, any>(), writes: string[] = [];
  let writeFails = false;
  const makeQuery = (after?: string, size = 100): any => ({ orderBy: () => makeQuery(after, size),
    startAfter: (cursor: string) => makeQuery(cursor, size), limit: (value: number) => makeQuery(after, value),
    get: async () => {
      const docs = [...rows.entries()].filter(([path]) => path.startsWith(HISTORY_SEARCH_INDEX_ROOT + "/"))
        .map(([path, value]) => ({ id: path.split("/").at(-1)!, data: () => structuredClone(value) }))
        .sort((a, b) => a.id.localeCompare(b.id)).filter(row => after === undefined || row.id > after).slice(0, size);
      return { docs, size: docs.length };
    } });
  const db: any = { doc: (path: string) => ({ get: async () => { onGet?.(); return { exists: rows.has(path), data: () => structuredClone(rows.get(path)) }; },
    set: async (value: unknown) => { if (writeFails) throw new Error("private write failure"); rows.set(path, structuredClone(value)); writes.push(path); onSet?.(); },
    collection: () => makeQuery() }) };
  return { db, rows, writes, failWrites: () => { writeFails = true; } };
}
// Deterministic semantic fixture: shared task concepts map paraphrases to the
// same axes. Tests exercise actual dot-product ranking, not a canned result.
const conceptEmbed = vi.fn(async (texts: string[]) => texts.map(text =>
  /fold|linen|textile|garment/i.test(text) ? [1, 0.1, 0] : /warehouse|pallet|freight/i.test(text) ? [0.1, 1, 0] : [0, 0, 1]));

describe("portable company history semantic index", () => {
  it("ranks paraphrased task relevance across cities above unrelated local history", async () => {
    const db = memoryIndex();
    const result = await ensureHistoryEmbeddings(db.db, [source("chicago-laundry", "Chicago textile preparation before opening"),
      source("sacramento-freight", "Sacramento warehouse pallet transport"), source("sacramento-laundry", "Sacramento garment folding")], authority, conceptEmbed);
    const query = await embedHistoryQuery("Can a robot handle linens?", authority, conceptEmbed);
    const ranked = result.records.map(row => ({ id: row.id, score: cosineSimilarity(query.vector!, row.vector) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    expect(ranked.map(row => row.id)).toEqual(["chicago-laundry", "sacramento-laundry", "sacramento-freight"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "history_embedding_paid_usage_unknown" })]);
    expect(query.diagnostics?.[0].code).toBe("history_embedding_paid_usage_unknown");
    expect([...db.rows.keys()].every(path => path.startsWith(HISTORY_SEARCH_INDEX_ROOT + "/"))).toBe(true);
  });

  it("reuses exact vectors, invalidates both changed canonical source and changed projection text", async () => {
    const db = memoryIndex(), embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const original = source("BP.company / résumé", "Garment folding");
    await ensureHistoryEmbeddings(db.db, [original], authority, embed);
    await ensureHistoryEmbeddings(db.db, [original], authority, embed);
    expect(embed).toHaveBeenCalledTimes(1);
    const textChanged = { ...original, text: "Freight pallet transport" };
    const unavailable = await ensureHistoryEmbeddings(db.db, [textChanged], { ...authority, enabled: false }, embed);
    expect(unavailable.records).toEqual([]);
    expect(unavailable.diagnostics.map(item => item.code)).toContain("history_embedding_cached_source_changed_or_invalid");
    const sourceChanged = { ...original, sourceSha256: digest("corrected history") };
    await ensureHistoryEmbeddings(db.db, [sourceChanged], authority, embed);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(db.rows.get(HISTORY_SEARCH_INDEX_ROOT + "/" + digest(original.id)).sourceSha256).toBe(sourceChanged.sourceSha256);
  });

  it("requires explicit authority even when a credential is present, and refuses model mismatches", async () => {
    vi.stubEnv("OPENAI_API_KEY", "never-a-real-test-key");
    try {
      const embed = vi.fn(), db = memoryIndex();
      const disabled = await ensureHistoryEmbeddings(db.db, [source("a", "Folding")], { ...authority, enabled: false }, embed);
      const query = await embedHistoryQuery("Folding", { ...authority, enabled: false }, embed);
      expect(disabled.records).toEqual([]); expect(query.error?.code).toBe("history_embedding_authority_disabled");
      expect(embed).not.toHaveBeenCalled(); expect(db.writes).toEqual([]);
      await expect(createHistoryEmbedder({ ...authority, model: "different-model" })(["Folding"]))
        .rejects.toThrow("history_embedding_model_configuration_mismatch");
    } finally { vi.unstubAllEnvs(); }
  });

  it("preserves valid cached siblings and sanitized fallback on provider failure", async () => {
    const db = memoryIndex(), first = source("first", "Folding");
    await ensureHistoryEmbeddings(db.db, [first], authority, conceptEmbed);
    const fail = vi.fn(async () => { throw new Error("SECRET provider request with private content"); });
    const result = await ensureHistoryEmbeddings(db.db, [first, source("second", "Pallets")], authority, fail);
    expect(result.records.map(row => row.id)).toEqual(["first"]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ id: "second", code: "history_embedding_provider_failed", action: expect.stringContaining("browse") })]);
    const query = await embedHistoryQuery("private query", authority, fail);
    expect(query.error?.code).toBe("history_embedding_provider_failed");
    expect(JSON.stringify([result, query])).not.toContain("SECRET");
  });

  it.each([[], [[1, 0]], [[0, 0, 0]], [[Infinity, 0, 0]], [[NaN, 0, 0]], [[1, 0, 0], [0, 1, 0]]])("rejects malformed provider vectors %j", async vectors => {
    const db = memoryIndex(), result = await ensureHistoryEmbeddings(db.db, [source("a", "Folding")], authority, async () => vectors);
    expect(result.records).toEqual([]); expect(result.diagnostics[0].code).toBe("history_embedding_response_invalid"); expect(db.writes).toEqual([]);
  });

  it("does not return a new vector as canonical when index persistence fails", async () => {
    const db = memoryIndex(); db.failWrites();
    const result = await ensureHistoryEmbeddings(db.db, [source("a", "Folding")], authority, conceptEmbed);
    expect(result.records).toEqual([]); expect(result.diagnostics.map(row => row.code)).toContain("history_embedding_cache_write_failed");
  });

  it("bounds new embedding input without truncating records or hiding later pages", async () => {
    const db = memoryIndex(), embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const settings = { ...authority, maxInputCharacters: 10 };
    const result = await ensureHistoryEmbeddings(db.db, [source("too-large", "More than ten characters"), source("small", "fold")], settings, embed);
    expect(result.records.map(row => row.id)).toEqual(["small"]);
    expect(result.diagnostics[0]).toMatchObject({ id: "too-large", code: "history_embedding_input_limit" });
    expect(embed).toHaveBeenCalledWith(["fold"]);
    expect((await embedHistoryQuery("More than ten characters", settings, embed)).error?.code).toBe("history_embedding_input_limit");
  });

  it("pages the complete index and advances across malformed siblings", async () => {
    const db = memoryIndex();
    const result = await ensureHistoryEmbeddings(db.db, Array.from({ length: 205 }, (_, index) => source("company-" + index, "Folding")), authority, conceptEmbed);
    expect(result.records).toHaveLength(205);
    const ordered = [...db.rows.keys()].sort();
    db.rows.set(ordered[3], { ...db.rows.get(ordered[3]), schemaVersion: 2 });
    const records: string[] = [], diagnostics: unknown[] = []; let cursor: string | undefined;
    do {
      const page = await readHistoryIndexPage(db.db, cursor);
      records.push(...page.records.map(row => row.id)); diagnostics.push(...page.diagnostics);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(records).size).toBe(204); expect(diagnostics).toHaveLength(1);
    expect(records).toContain("company-204");
    await expect(readHistoryIndexPage(db.db, "invalid")).rejects.toThrow("history_embedding_cursor_invalid");
  });

  it("rejects cache identity/model/dimension tampering and returns finite stable cosine scores", async () => {
    const db = memoryIndex(), original = source("a", "Folding");
    await ensureHistoryEmbeddings(db.db, [original], authority, conceptEmbed);
    const path = HISTORY_SEARCH_INDEX_ROOT + "/" + digest(original.id), canonical = db.rows.get(path);
    for (const changed of [{ id: "other" }, { model: "other" }, { dimensions: 2 }, { sourceSha256: digest("other") }, { vector: [0, 0, 0] }]) {
      db.rows.set(path, { ...canonical, ...changed });
      const result = await ensureHistoryEmbeddings(db.db, [original], { ...authority, enabled: false }, conceptEmbed);
      expect(result.records).toEqual([]);
    }
    expect(cosineSimilarity([1e300, 1e300], [1e300, 1e300])).toBeCloseTo(1);
    expect(cosineSimilarity([1e308, 1e308, 1e308], [1e308, 1e308, 1e308])).toBeCloseTo(1);
    expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow("history_embedding_vector_invalid");
  });

  it("defaults absent company settings to disabled without writes or provider calls", async () => {
    const db = memoryIndex();
    expect(await loadHistoryEmbeddingAuthority(db.db, "2026-10-02T00:00:00Z")).toEqual({});
    expect(db.writes).toEqual([]);
  });
  it.each([{ schemaVersion: 2 }, { authorizationRef: " " }, { unexpected: true }, { authority: { ...authority, dimensions: 0 } }])("rejects malformed settings %j", async changed => {
    const db = memoryIndex(); db.rows.set(HISTORY_SEARCH_SETTINGS_REF, { schemaVersion: 1, authorizationRef: "approved/embedding-policy", expiresAt: "2099-01-01T00:00:00Z", authority, ...changed });
    expect((await loadHistoryEmbeddingAuthority(db.db, "2026-10-02T00:00:00Z")).diagnostic?.code).toBe("history_embedding_settings_invalid");
    expect(db.writes).toEqual([]);
  });
  it("rejects expired settings and rechecks loaded expiry immediately before provider work", async () => {
    const db = memoryIndex(), embed = vi.fn();
    db.rows.set(HISTORY_SEARCH_SETTINGS_REF, { schemaVersion: 1, authorizationRef: "approved/embedding-policy", expiresAt: "2026-10-01T00:00:00Z", authority });
    expect((await loadHistoryEmbeddingAuthority(db.db, "2026-10-02T00:00:00Z")).diagnostic?.code).toBe("history_embedding_authority_expired");
    await expect(createHistoryEmbedder({ ...authority, authorizationRef: "approved/embedding-policy", expiresAt: "2026-10-01T00:00:00Z" }, embed)(["fold"])).rejects.toThrow("history_embedding_authority_expired");
    expect(embed).not.toHaveBeenCalled();
  });
  it("loads strict existing company authority with retained approval reference and expiry", async () => {
    const db = memoryIndex();
    db.rows.set(HISTORY_SEARCH_SETTINGS_REF, { schemaVersion: 1, authorizationRef: "approved/embedding-policy", expiresAt: "2099-01-01T00:00:00Z", authority });
    expect(await loadHistoryEmbeddingAuthority(db.db, "2026-10-02T00:00:00Z")).toEqual({ authority: { ...authority,
      authorizationRef: "approved/embedding-policy", expiresAt: "2099-01-01T00:00:00.000Z" } });
    expect(db.writes).toEqual([]);
  });

  it.each(["cache_read", "provider", "first_cache_write", "query"] as const)("real history service stops paid/write work when access expires during %s", async phase => {
    let time = "2026-10-02T16:00:00.000Z";
    const expire = () => { time = "2026-10-02T18:00:00.000Z"; };
    const db = memoryIndex(phase === "cache_read" ? expire : undefined, phase === "first_cache_write" ? expire : undefined);
    const records: CompanyHistoryRecord[] = ["one", "two"].map(id => ({ record_id: id, kind: "hypothesis", source_ref: "company/history/" + id,
      source_sha256: digest(id), original_checked_at: null, city: "Tokyo", industry: null, task: "folding", company: "Blueprint", current: true, content: { text: "Folding" } }));
    const provider = vi.fn(async (texts: string[]) => { if (phase === "provider") expire(); return texts.map(() => [1, 0, 0]); });
    const query = vi.fn(async () => [ [1, 0, 0] ]);
    const tools = createCompanyHistoryTools(db.db, { principalId: "authorized-worker", companyWide: true,
      expiresAt: "2026-10-02T17:00:00.000Z", embeddingAuthority: authority }, {
      now: () => time, load: async () => ({ records, diagnostics: [], coverage: ["mock_company_history"] }),
      ensureEmbeddings: (database, sources, settings, _embed, beforeAction) => ensureHistoryEmbeddings(database, sources, settings, provider, beforeAction),
      embedQuery: async (text, settings, _embed, beforeAction) => {
        if (phase === "query") expire();
        return embedHistoryQuery(text, settings, query, beforeAction);
      },
    });
    expect(await tools("search_company_history", { query: "robot laundry" })).toMatchObject({ ok: false, error: "company_history_access_expired" });
    expect(provider).toHaveBeenCalledTimes(phase === "cache_read" ? 0 : 1);
    expect(db.writes).toHaveLength(phase === "query" ? 2 : phase === "first_cache_write" ? 1 : 0);
    expect(query).not.toHaveBeenCalled();
  });
});
