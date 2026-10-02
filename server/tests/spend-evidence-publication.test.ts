// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null }));
import { parseRetainedSpendSnapshot, publishSpendProjection, reconcileEndedSpendWriter, retainSpendSnapshot, spendNotionProperties, unsupportedSpendProperties } from "../utils/spend-evidence-publication";
const key = `sha256:${"a".repeat(64)}`, revision = `sha256:${"b".repeat(64)}`;
const snapshot = () => ({ schema_version: "blueprint.daily_spend_snapshot.v1", generated_at: "2026-10-02T12:00:00Z",
  source_collected_at: "2026-10-02T11:59:00Z", snapshot_digest: `sha256:${"c".repeat(64)}`, rows: [], revision_history: [],
  coverage: { partial: true, all_provider_daily_total: null }, local_metered_calls: {}, notion_projection: { publication_gaps: [{ reason: "unknown_source" }], upserts: [{
    source_key: key, revision_id: revision, properties: { Entry: "Retained cumulative observation", "Source key": key,
      Amount: 42, "Expense MTD": null, Kind: "Coverage gap", "Expense rollup": "Reference only", "Coverage gap": "daily usage unknown",
      "date:Day:start": null, "date:Source observed:start": null }, clear_properties: ["Expense MTD", "date:Day:start"] }] } });
function fixture() {
  const records = new Map<string, any>(), objects = new Map<string, Buffer>();
  const snap = (path: string) => ({ exists: records.has(path), data: () => records.get(path) });
  const ref = (path: string): any => ({ path, collection: (s: string) => ref(`${path}/${s}`), doc: (s: string) => ref(`${path}/${s}`),
    set: async (v: any, opts: any) => records.set(path, opts?.merge ? { ...records.get(path), ...v } : v) });
  const db: any = { collection: ref, runTransaction: async (fn: any) => fn({ get: (r: any) => Promise.resolve(snap(r.path)),
    create: (r: any, v: any) => records.set(r.path, v), set: (r: any, v: any) => records.set(r.path, v) }) };
  const storage: any = { bucket: (bucket: string) => ({ file: (name: string) => ({
    save: async (bytes: Buffer) => { const path = `${bucket}/${name}`; if (objects.has(path)) throw { code: 412 }; objects.set(path, bytes); },
    download: async () => [objects.get(`${bucket}/${name}`)] }) }) };
  const pages = new Map<string, any>();
  const notion = { dataSources: { query: vi.fn(async () => ({ results: [...pages.values()], has_more: false })) }, pages: {
    create: vi.fn(async (params: any) => { const p = { id: "page-1", properties: params.properties }; pages.set(p.id, p); return p; }),
    update: vi.fn(async (params: any) => { const p = { id: params.page_id, properties: params.properties }; pages.set(p.id, p); return p; }),
    retrieve: vi.fn(async ({ page_id }: any) => pages.get(page_id)) } };
  return { records, objects, db, storage, pages, notion };
}
afterEach(() => vi.unstubAllEnvs());
describe("retained spend publication", () => {
  it("archives exact source bytes and reimports without duplicating canonical records", async () => {
    const f = fixture(), bytes = Buffer.from(JSON.stringify(snapshot())), provenance = { sourceRef: "host:retained.json", sourceVersion: "reviewed-sha" };
    const one = await retainSpendSnapshot(bytes, provenance, f), two = await retainSpendSnapshot(bytes, provenance, f);
    expect(one.artifactSha256).toBe(two.artifactSha256); expect(f.objects.size).toBe(1); expect(f.records.size).toBe(1);
    expect([...f.objects.values()][0].equals(bytes)).toBe(true);
    expect([...f.records.values()][0]).toMatchObject({ publicationStatus: "pending_owner_resumption", coverage: { all_provider_daily_total: null } });
  });
  it("clears corrected values without making funding or cumulative evidence daily consumption", () => {
    const properties = spendNotionProperties(snapshot().notion_projection.upserts[0]);
    expect(properties.Amount).toEqual({ number: 42 }); expect(properties["Expense MTD"]).toEqual({ number: null });
    expect(properties.Day).toEqual({ date: null }); expect(properties.Kind).toEqual({ select: { name: "Coverage gap" } });
    expect(properties["Expense rollup"]).toEqual({ select: { name: "Reference only" } });
  });
  it("stays stopped without making any remote call", async () => {
    const f = fixture(); expect((await publishSpendProjection(snapshot(), f)).reason).toBe("spend_publication_stopped");
    expect(f.notion.dataSources.query).not.toHaveBeenCalled(); expect(f.records.size).toBe(0);
  });
  it("reconciles an accepted create whose acknowledgment was lost rather than creating a duplicate", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture(), create = f.notion.pages.create;
    create.mockImplementationOnce(async (params: any) => {
      f.pages.set("page-1", { id: "page-1", properties: params.properties }); throw new Error("response_lost");
    });
    await expect(publishSpendProjection(snapshot(), f)).rejects.toThrow("response_lost");
    expect((await publishSpendProjection(snapshot(), f)).published).toBe(1); expect(create).toHaveBeenCalledTimes(1);
  });
  it("blocks unknown create, duplicate source keys and stale revisions", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture();
    f.notion.pages.create.mockRejectedValueOnce(new Error("response_lost"));
    await expect(publishSpendProjection(snapshot(), f)).rejects.toThrow("response_lost");
    await expect(publishSpendProjection(snapshot(), f)).rejects.toThrow("publication_unknown");
    expect(f.notion.pages.create).toHaveBeenCalledTimes(1);
    const g = fixture(); g.notion.dataSources.query.mockResolvedValueOnce({ results: [{}, {}], has_more: false });
    await expect(publishSpendProjection(snapshot(), g)).rejects.toThrow("identity_ambiguous");
    const h = fixture(); await publishSpendProjection(snapshot(), h);
    const older = snapshot(); older.source_collected_at = "2026-10-01T11:59:00Z"; older.notion_projection.upserts[0].properties.Amount = 1;
    expect((await publishSpendProjection(older, h)).published).toBe(0); expect(h.notion.pages.update).not.toHaveBeenCalled();
  });
  it("fences a pending older writer against a newer revision and then reconciles without another write", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture();
    let started!: () => void, complete!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    const finished = new Promise<void>(resolve => { complete = resolve; });
    f.notion.pages.create.mockImplementationOnce(async (params: any) => {
      started(); await finished;
      const p = { id: "page-1", properties: params.properties }; f.pages.set(p.id, p); return p;
    });
    const active = publishSpendProjection(snapshot(), f); await began;
    const newer = snapshot(); newer.source_collected_at = "2026-10-02T12:01:00Z";
    newer.notion_projection.upserts[0].revision_id = `sha256:${"d".repeat(64)}`;
    newer.notion_projection.upserts[0].properties.Amount = 99;
    await expect(publishSpendProjection(newer, f)).rejects.toThrow("writer_active");
    complete(); await active;
    expect((await publishSpendProjection(snapshot(), f)).published).toBe(1);
    expect(f.notion.pages.create).toHaveBeenCalledTimes(1); expect(f.notion.pages.update).not.toHaveBeenCalled();
    await publishSpendProjection(newer, f);
    expect(f.notion.pages.update).toHaveBeenCalledTimes(1);
    expect(f.pages.get("page-1").properties.Amount.number).toBe(99);
  });
  it("requires exact ended-process evidence before releasing a crashed writer into unknown-result reconciliation", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture();
    const path = `blueprintSpendEvidence/default/notionBindings/${key.slice(7)}`;
    f.records.set(path, { status: "publication_writing", attemptId: "crashed-attempt", revisionId: revision });
    await expect(reconcileEndedSpendWriter({ sourceKey: key, attemptId: "wrong", actor: "operator", processEndedEvidenceRef: "host:process-ended" }, f.db)).rejects.toThrow("stale");
    const input = { sourceKey: key, attemptId: "crashed-attempt", actor: "operator", processEndedEvidenceRef: "host:process-ended" };
    expect((await reconcileEndedSpendWriter(input, f.db)).reason).toBe("external_result_unknown");
    expect((await reconcileEndedSpendWriter(input, f.db)).reason).toBe("duplicate");
    await expect(publishSpendProjection(snapshot(), f)).rejects.toThrow("publication_unknown");
    expect(f.notion.pages.create).not.toHaveBeenCalled();
  });
  it("does not mark a date-range projection verified when the returned end differs", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture(), value = snapshot();
    Object.assign(value.notion_projection.upserts[0].properties, { "date:Day:start": "2026-10-01", "date:Day:end": "2026-10-02" });
    f.notion.pages.retrieve.mockImplementationOnce(async ({ page_id }: any) => ({ ...f.pages.get(page_id), properties:
      { ...f.pages.get(page_id).properties, Day: { date: { start: "2026-10-01", end: "2026-10-03" } } } }));
    await expect(publishSpendProjection(value, f)).rejects.toThrow("readback_failed:Day");
    expect([...f.records.values()][0].status).toBe("publication_unknown");
  });
  it("quarantines an unsupported projection while retaining its original bytes and publishing unaffected entries", async () => {
    vi.stubEnv("BLUEPRINT_SPEND_PUBLICATION_ENABLED", "true"); const f = fixture(), value = snapshot();
    Object.assign(value.notion_projection.upserts[0].properties, { "Unsupported admin field": "untrusted" });
    expect(unsupportedSpendProperties(value.notion_projection.upserts[0])).toEqual(["Unsupported admin field"]);
    const result = await publishSpendProjection(value, f);
    expect(result.quarantined).toEqual([key]); expect(f.notion.dataSources.query).not.toHaveBeenCalled();
    expect(value.notion_projection.upserts[0].properties).toHaveProperty("Unsupported admin field", "untrusted");
  });
  it.skipIf(!process.env.BLUEPRINT_SPEND_RETAINED_REPLAY_FILE)("projects actual retained host snapshot without inventing totals", () => {
    const actual = parseRetainedSpendSnapshot(readFileSync(process.env.BLUEPRINT_SPEND_RETAINED_REPLAY_FILE!));
    expect(actual.rows.length).toBeGreaterThan(1400); expect(actual.notion_projection.publication_gaps.length).toBeGreaterThan(1400);
    for (const entry of actual.notion_projection.upserts) {
      const projected = spendNotionProperties(entry);
      expect(unsupportedSpendProperties(entry)).toEqual([]);
      expect(projected["Source key"].rich_text.map((part: any) => part.text.content).join("")).toBe(entry.source_key);
      expect(projected["Expense MTD"].number).toBeNull();
      expect(projected["Expense rollup"].select.name).toBe("Reference only");
    }
    expect(actual.coverage.partial).toBe(true);
  });
});
