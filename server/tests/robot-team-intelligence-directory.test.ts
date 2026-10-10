import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createFakeFirestore, createFakeFirestoreState } from "./helpers/fake-firestore";
import { RobotTeamDirectory, ROOT, ROBOT_TEAM_TOOLS, directoryDigest } from "../robot-team-intelligence/directory";

const NOW = "2026-10-03T06:00:00.000Z";
const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
// Keep the existing transaction fake; add real document-ID page semantics for
// readQueryPages, including direct-child collection boundaries.
function fixture() {
  const state = createFakeFirestoreState(), base = createFakeFirestore(state);
  const reads: string[] = [];
  function query(path: string, filters: { field: string; value: unknown }[] = [], after = "", count = Infinity): any {
    return { doc: (id: string) => base.collection(path).doc(id),
      where: (field: string, op: string, value: unknown) => {
        if (op !== "==") throw Error("Unsupported fixture query");
        return query(path, [...filters, { field, value }], after, count);
      },
      orderBy: () => query(path, filters, after, count), limit: (n: number) => query(path, filters, after, n),
      startAfter: (snapshot: { id: string }) => query(path, filters, snapshot.id, count),
      get: async () => {
        reads.push(path);
        const docs = [...state.docs.entries()].filter(([key, value]) => key.startsWith(path + "/") && !key.slice(path.length + 1).includes("/")
          && key.slice(path.length + 1) > after && filters.every(f => value[f.field] === f.value))
          .sort(([a], [b]) => a.localeCompare(b)).slice(0, count).map(([key, value]) => ({ id: key.slice(path.length + 1),
            data: () => structuredClone(value), ref: base.collection(path).doc(key.slice(path.length + 1)) }));
        return { docs, size: docs.length, empty: !docs.length };
      } };
  }
  const db = { collection: (path: string) => query(path), runTransaction: base.runTransaction } as unknown as FirebaseFirestore.Firestore;
  const page = { url: "https://acme.example/news", text: "Acme Robotics announced an Atlas product. Atlas reach is 2 meters. Atlas has deployed pilots. Payload is unknown.", truncated: false };
  const fetcher = vi.fn(async (url: string) => ({ ...page, url }));
  const directory = new RobotTeamDirectory(db, fetcher, () => NOW);
  const team = { id: "acme", name: "Acme Robotics", website: "https://acme.example", status: "engaged", accountId: "private-account",
    contactEmail: "private@example.com", apiKey: "secret", capability: { reachM: 1, pathWidthM: 0.8, budgetBand: "private", hardwareMaturity: "prototype" },
    fieldProvenance: { reachM: { grade: "measured", source: "measurement", observedAt: "2025-01-01T00:00:00Z" },
      pathWidthM: { grade: "self_reported", source: "owner form", observedAt: "2025-02-01T00:00:00Z" } },
    public_intelligence: { categories: ["hardware"], tags: { task: ["CNC machine tending"], embodiment: ["wheeled humanoid"], geography: ["US"] } } };
  state.docs.set("robotTeams/acme", team);
  const claim = { field: "product", value: "Atlas", grade: "published", source_url: page.url, quote: "Acme Robotics announced an Atlas product.", publication_date: "2026-09" };
  return { state, db, reads, directory, fetcher, page, team, claim };
}

describe("robot team intelligence directory tools", () => {
  it("pages the complete >200 directory with aliases, filters and safe projections", async () => {
    const f = fixture();
    for (let i = 0; i < 235; i++) f.state.docs.set(`robotTeams/team_${String(i).padStart(3, "0")}`, { ...f.team, id: `team_${i}` });
    const ids: string[] = []; let cursor: string | undefined;
    do {
      const result = await f.directory.call("search_robot_teams", { query: "mobile manipulator machine tending", filters: { categories: ["hardware"], task: "CNC", embodiment: "mobile manipulator" }, page_size: 80, ...(cursor ? { cursor } : {}) });
      expect(result.ok).toBe(true); expect(result.coverage).toEqual({ directory_records: 236, matching_records: 236, complete: true });
      ids.push(...result.rows.map((r: any) => r.team_id)); cursor = result.next_cursor || undefined;
      expect(JSON.stringify(result)).not.toMatch(/private-account|private@example|secret|budgetBand/);
    } while (cursor);
    expect(new Set(ids).size).toBe(236); expect(f.reads.filter(p => p === "robotTeams").length).toBe(9);
    expect((await f.directory.call("search_robot_teams", { filters: { geography: "CNC" } })).rows).toEqual([]);
  });

  it("ranks semantic-only candidates from the entire filtered corpus and falls back on errors", async () => {
    const f = fixture();
    const callback = vi.fn(async (_query: string, docs: any[]) => { expect(docs).toHaveLength(1); expect(docs[0].source_sha256).toMatch(/^[a-f0-9]{64}$/);
      return { scores: { acme: 0.9 }, mode: "semantic" as const, model: "existing-authorized-model", diagnostics: [] }; });
    const directory = new RobotTeamDirectory(f.db, f.fetcher, () => NOW, { semanticSearch: callback });
    const result = await directory.call("search_robot_teams", { query: "precision production automation" });
    expect(result.rows[0].team_id).toBe("acme"); expect(result.semantic.mode).toBe("semantic");
    directory.semanticSearch = async () => { throw Error("transport failure"); };
    const fallback = await directory.call("search_robot_teams", { query: "CNC" });
    expect(fallback.rows).toHaveLength(1); expect(fallback.semantic.diagnostics[0].code).toBe("semantic_reader_unavailable");
  });

  it("independently verifies sources, saves valid siblings and preserves protected fields/status/account", async () => {
    const f = fixture();
    const result = await f.directory.call("save_robot_team_update", { update: { team_id: "acme", event_type: "product_release", summary: "Atlas released; payload remains unknown.", claims: [f.claim,
      { ...f.claim, field: "reachM", value: 50, quote: "Payload is unknown." },
      { ...f.claim, field: "reachM", value: 2, quote: "Atlas reach is 2 meters." },
      { ...f.claim, field: "pathWidthM", value: 0.8, grade: "inferred", rationale: "Unchanged owner-provided path width" },
      { ...f.claim, field: "hardwareMaturity", value: "deployed", quote: "Atlas has deployed pilots." },
      { ...f.claim, field: "accountId", value: "override" }] } });
    expect(result.ok).toBe(true); expect(result.readback_verified).toBe(true);
    expect(result.issues.map((i: any) => i.code)).toContain("published_value_not_quoted");
    expect(result.issues.map((i: any) => i.code)).toContain("field_not_public");
    expect(result.protected_fields.sort()).toEqual(["hardwareMaturity", "pathWidthM", "reachM"]);
    const current: any = f.state.docs.get("robotTeams/acme");
    expect(current.status).toBe("engaged"); expect(current.accountId).toBe("private-account"); expect(current.capability).toEqual(f.team.capability);
    expect(current.fieldProvenance).toEqual(f.team.fieldProvenance); expect(f.fetcher).toHaveBeenCalledTimes(1);
    const change: any = f.state.docs.get(result.record_ref);
    expect(result.source_sha256).toBe(directoryDigest(change)); expect(change.claims[0].publication_date).toBe("2026-09");
    const source = change.sources[0], retained: any = f.state.docs.get(`${source.source_ref}/chunks/0`);
    expect(Buffer.from(retained.bytes, "base64").toString()).toBe(f.page.text); expect(source.raw_sha256).toBe(hash(f.page.text));
  });

  it("does not accept absent quotes, empty normalized quotes or fabricated published values", async () => {
    const f = fixture();
    for (const claim of [{ ...f.claim, quote: "Not present" }, { ...f.claim, quote: "<script>secret</script>" },
      { ...f.claim, value: "Nonexistent" }, { ...f.claim, grade: "inferred", value: "interpretation" }]) {
      const result = await f.directory.call("save_robot_team_update", { update: { team_id: "acme", claims: [claim] } });
      expect(result.ok).toBe(false); expect(result.error.code).toBe("robot_team_no_supported_claims");
    }
    expect([...f.state.docs.keys()].some(k => k.startsWith(ROOT + "/changes/"))).toBe(false);
  });

  it("content-addresses idempotent updates and retains original evidence dates across checks/history", async () => {
    const f = fixture(), input = { update: { team_id: "acme", claims: [f.claim] } };
    const first = await f.directory.call("save_robot_team_update", input);
    const retry = await new RobotTeamDirectory(f.db, f.fetcher, () => "2026-10-04T06:00:00.000Z").call("save_robot_team_update", input);
    expect(retry.change_id).toBe(first.change_id); expect(retry.source_sha256).toBe(first.source_sha256);
    const check = await f.directory.call("record_robot_team_check", { team_id: "acme", checked_at: NOW, summary: "No new published claims; payload unknown." });
    expect(check.ok).toBe(true);
    const history = await f.directory.call("read_robot_team_history", { team_id: "acme", page_size: 1 });
    const next = await f.directory.call("read_robot_team_history", { team_id: "acme", page_size: 1, cursor: history.next_cursor });
    expect(history.rows.length + next.rows.length).toBe(2); expect(next.next_cursor).toBeNull();
    const change = [...history.rows, ...next.rows].find(r => r.kind === "change");
    expect(change.claims[0].evidence.checked_at).toBe(NOW); expect(change.claims[0].publication_date).toBe("2026-09");
    const record = await f.directory.call("fetch_robot_team", { team_id: "acme" });
    expect(record.content_sha256).toBe(directoryDigest(record.record));
    expect((await f.directory.call("record_robot_team_check", { team_id: "acme", checked_at: "2027-01-01T00:00:00Z", summary: "future" })).ok).toBe(false);
  });

  it("creates a sourced domain prospect once and reuses the original ID for aliases", async () => {
    const f = fixture();
    const input = { update: { organization: { name: "New Robotics", website: "https://new.example", aliases: ["NewCo"] }, categories: ["robot_policy"],
      claims: [{ ...f.claim, source_url: "https://new.example/news", value: "Nova", quote: "New Robotics announced Nova." }] } };
    f.fetcher.mockImplementation(async url => ({ url, text: "New Robotics announced Nova. NewCo is our brand.", truncated: false }));
    const first = await f.directory.call("save_robot_team_update", input);
    expect(first.ok).toBe(true); expect(first.record.status).toBe("prospect");
    const alias = await f.directory.call("save_robot_team_update", { update: { ...input.update, organization: { name: "NewCo", website: "https://www.new.example", aliases: ["New Robotics"] } } });
    expect(alias.ok).toBe(true); expect(alias.team_id).toBe(first.team_id); expect(alias.record.name).toBe("New Robotics");
    expect(alias.record.aliases).toContain("NewCo"); expect([...f.state.docs.keys()].filter(k => /^robotTeams\//.test(k))).toHaveLength(2);
  });

  it("quarantines unrelated sources and foreign corrections without losing valid siblings", async () => {
    const f = fixture();
    f.state.docs.set(`${ROOT}/changes/foreign`, { team_id: "another" });
    f.fetcher.mockImplementation(async url => ({ url, text: url.includes("foreign") ? "OtherOrg announced Atlas." : f.page.text, truncated: false }));
    const result = await f.directory.call("save_robot_team_update", { update: { team_id: "acme", claims: [f.claim,
      { ...f.claim, field: "announcement", supersedes: "foreign" },
      { ...f.claim, field: "research", source_url: "https://foreign.example/news", quote: "OtherOrg announced Atlas." }] } });
    expect(result.ok).toBe(true); expect(result.record.claims).toHaveLength(1);
    expect(result.issues.map((i: any) => i.code)).toEqual(expect.arrayContaining(["source_team_unbound", "correction_unbound"]));
  });

  it("detects retained source tampering before applying an update", async () => {
    const f = fixture(), input = { update: { team_id: "acme", claims: [f.claim] } };
    const first = await f.directory.call("save_robot_team_update", input);
    const source: any = f.state.docs.get(first.record_ref);
    f.state.docs.set(`${source.sources[0].source_ref}/chunks/0`, { bytes: Buffer.from("changed").toString("base64") });
    const result = await f.directory.call("save_robot_team_update", { update: { ...input.update, summary: "second attempt" } });
    expect(result.ok).toBe(false); expect(result.error.code).toBe("robot_team_no_supported_claims");
    expect([...f.state.docs.keys()].filter(k => k.startsWith(ROOT + "/changes/"))).toHaveLength(1);
  });

  it("accepts an independently name-bound source for an existing team whose website is unknown", async () => {
    const f = fixture();
    f.state.docs.set("robotTeams/acme", { ...f.team, website: null });
    const result = await f.directory.call("save_robot_team_update", { update: { team_id: "acme", claims: [f.claim] } });
    expect(result.ok).toBe(true); expect(result.record.website).toBeNull(); expect(result.record.status).toBe("engaged");
    expect(result.record.claims[0].evidence.source_url).toBe(f.page.url);
  });

  it("returns recoverable argument/cursor issues with no writes", async () => {
    const f = fixture(), before = f.state.docs.size;
    expect(ROBOT_TEAM_TOOLS.map(t => t.name)).toHaveLength(5);
    expect((await f.directory.call("search_robot_teams", { page_size: "25" })).error.issues[0].path).toBe("/page_size");
    expect((await f.directory.call("search_robot_teams", { cursor: "wrong" })).error.code).toBe("robot_team_cursor_stale_or_invalid");
    expect((await f.directory.call("fetch_robot_team", { team_id: "missing" })).error.code).toBe("robot_team_not_found");
    expect(f.state.docs.size).toBe(before);
  });

  it("accepts the actual JSON-string tool ABI and returns malformed JSON as repair feedback", async () => {
    const f = fixture();
    const result = await f.directory.call("save_robot_team_update", JSON.stringify({ update: { team_id: "acme", claims: [f.claim] } }));
    expect(result.ok).toBe(true);
    expect((await f.directory.call("fetch_robot_team", '{"team_id":"acme"}')).ok).toBe(true);
    expect((await f.directory.call("fetch_robot_team", '{"team_id":')).error.issues[0].code).toBe("invalid_json");
  });

  it("fences archive and canonical mutation after slow source reads without applying a stale action", async () => {
    const f = fixture(); let allowed = true;
    const guard = vi.fn(async () => { if (!allowed) throw Error("robot_team_authority_changed"); });
    const slow = async (url: string) => { allowed = false; return { ...f.page, url }; };
    const directory = new RobotTeamDirectory(f.db, slow, () => NOW, { mutationGuard: guard });
    const blocked = await directory.call("save_robot_team_update", { update: { team_id: "acme", claims: [f.claim] } });
    expect(blocked.ok).toBe(false); expect([...f.state.docs.keys()].filter(k => k.startsWith(ROOT))).toEqual([]);
    expect(f.state.docs.get("robotTeams/acme")).toEqual(f.team);
    allowed = true;
    // Pre-retained source is GET-only; the separate canonical fence is still mandatory.
    await f.directory.call("save_robot_team_update", { update: { team_id: "acme", claims: [f.claim] } });
    const guarded = new RobotTeamDirectory(f.db, f.fetcher, () => NOW, { mutationGuard: async () => { throw Error("robot_team_authority_changed"); } });
    const stopped = await guarded.call("save_robot_team_update", { update: { team_id: "acme", claims: [f.claim], summary: "new decision" } });
    expect(stopped.error.code).toBe("robot_team_authority_changed");
    const check = await guarded.call("record_robot_team_check", { team_id: "acme", checked_at: NOW, summary: "new check" });
    expect(check.error.code).toBe("robot_team_authority_changed");
    expect([...f.state.docs.keys()].filter(k => k.startsWith(ROOT + "/changes/"))).toHaveLength(1);
    expect([...f.state.docs.keys()].filter(k => k.startsWith(ROOT + "/checks/"))).toHaveLength(0);
  });

  it("recovers a committed tool action before fetching changed sources after a lost worker checkpoint", async () => {
    const f = fixture(), operationKey = hash("exact-session/turn/call/request");
    const input = { update: { team_id: "acme", claims: [f.claim, { ...f.claim, field: "research", value: "Unpublished", quote: "Not present" }] } };
    const first = await f.directory.call("save_robot_team_update", input, { operationKey });
    expect(first.ok).toBe(true); expect(first.issues).toHaveLength(1);
    // The first canonical tx committed, but its caller lost the returned result.
    // A replacement sees different public content supporting the old bad sibling.
    f.fetcher.mockImplementation(async url => ({ url, text: "Acme Robotics announced an Atlas product. Not present Unpublished.", truncated: false }));
    const reads = f.fetcher.mock.calls.length;
    const replacement = new RobotTeamDirectory(f.db, f.fetcher, () => "2026-10-04T06:00:00.000Z", { mutationGuard: async () => { throw Error("robot_team_authority_changed"); } });
    const recovered = await replacement.call("save_robot_team_update", JSON.stringify(input), { operationKey });
    expect(recovered).toEqual(first); expect(f.fetcher.mock.calls.length).toBe(reads);
    expect([...f.state.docs.keys()].filter(k => k.startsWith(ROOT + "/changes/"))).toHaveLength(1);
    const mapping: any = f.state.docs.get(`${ROOT}/operations/${operationKey}`);
    expect(mapping.result_ref).toBe(first.record_ref); expect(mapping.result_sha256).toBe(first.source_sha256);
    expect((await replacement.call("save_robot_team_update", { update: { ...input.update, summary: "altered request" } }, { operationKey })).error.code).toBe("robot_team_operation_binding_changed");
  });

  it("pins check operation receipts and denies tampered/missing completion rather than resubmitting", async () => {
    const f = fixture(), operationKey = hash("check-action"), input = { team_id: "acme", checked_at: NOW, summary: "Unknown payload" };
    const first = await f.directory.call("record_robot_team_check", input, { operationKey });
    expect((await f.directory.call("record_robot_team_check", JSON.stringify(input), { operationKey }))).toEqual(first);
    f.state.docs.delete(first.record_ref);
    const unknown = await f.directory.call("record_robot_team_check", input, { operationKey });
    expect(unknown.error.code).toBe("robot_team_operation_receipt_unavailable");
    expect(f.state.docs.has(first.record_ref)).toBe(false);
  });
});
