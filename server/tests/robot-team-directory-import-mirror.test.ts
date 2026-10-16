// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null, default: {} }));
import { importRobotTeamDirectory, prepareDirectoryImport } from "../robot-team-intelligence/import";
import { mirrorRobotTeamToNotion, type MirrorTransport } from "../robot-team-intelligence/notion-mirror";
import { publicRobotTeam, ROOT, RobotTeamDirectory } from "../robot-team-intelligence/directory";

const now = "2026-10-03T14:00:00.000Z", parent = "3eb80154-161d-817a-a3e6-d9b9d7eba938";
const scope = { enabled: true, parentPageId: parent, authorityRef: "actual-owner-mirror-direction" };
function fixture() {
  const rows = new Map<string, any>(), clone = (v: any) => structuredClone(v);
  const doc = (path: string): any => ({ path, id: path.split("/").at(-1), collection: (name: string) => query(`${path}/${name}`),
    get: async () => ({ id: path.split("/").at(-1), exists: rows.has(path), data: () => rows.has(path) ? clone(rows.get(path)) : undefined, ref: doc(path) }) });
  const query = (path: string, after = "", limit = Infinity): any => ({ doc: (id: string) => doc(`${path}/${id}`),
    orderBy: () => query(path, after, limit), startAfter: (snapshot: any) => query(path, snapshot.id, limit),
    limit: (n: number) => query(path, after, n), get: async () => {
      const refs = [...rows.keys()].filter(k => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")
        && k.slice(path.length + 1) > after).sort().slice(0, limit);
      return { size: refs.length, docs: await Promise.all(refs.map(k => doc(k).get())) };
    } });
  const db = { doc, collection: query, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: (ref: any) => ref.get(), set: (ref: any, data: any, options?: any) => writes.push(() =>
      rows.set(ref.path, clone(options?.merge ? { ...rows.get(ref.path), ...data } : data))) });
    writes.forEach(write => write()); return result;
  } } as unknown as FirebaseFirestore.Firestore;
  return { db, rows };
}
function input() {
  return { schema_version: "blueprint.robot-team-directory-import-preview.v1", applied: false,
    source_page_url: `https://app.notion.com/p/${parent.replace(/-/g, "")}`, source_page_last_edited_at: "2026-09-30T22:00:44.179Z",
    source_checks_advanced: false, record_count: 47, records: Array.from({ length: 47 }, (_, i) => ({
      source_record_id: `BP-TEAM-${String(i + 1).padStart(3, "0")}`, title: `Team ${i + 1} · research scope`,
      source_notes: `- Company: Team ${i + 1}\n- Source checked (source_checked_at): 2026-09-30\n- Vendor demo, not independent performance. Interest unknown.` })) };
}
function notion() {
  const pages: any[] = [], blocks: any[] = [], writes: string[] = [], lose = new Set<string>();
  const transport: MirrorTransport = async (method, path, body) => {
    if (path === "search") return { results: pages, has_more: false };
    if (method === "POST" && path === "pages") {
      writes.push("create"); const page = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", parent: { page_id: parent }, properties: body.properties };
      pages.push(page); if (lose.delete("create")) throw Error("network_ack_lost"); return page;
    }
    if (path.startsWith("pages/")) return pages[0];
    if (method === "PATCH") {
      writes.push("append"); blocks.push(...body.children);
      if (lose.delete("append")) throw Error("network_ack_lost"); return { results: body.children };
    }
    const cursor = new URL(`https://notion.example/${path}`).searchParams.get("start_cursor"), offset = Number(cursor ?? 0);
    return { results: blocks.slice(offset, offset + 100), has_more: offset + 100 < blocks.length,
      next_cursor: offset + 100 < blocks.length ? String(offset + 100) : null };
  };
  return { pages, blocks, writes, lose, transport };
}

describe("source-preserving robot-directory import", () => {
  it("imports all 47 without changing test records or source dates, and retries observe the same import", async () => {
    const { db, rows } = fixture(), original = input();
    for (let i = 0; i < 6; i++) rows.set(`robotTeams/test${i}`, { name: `Rehearsal ${i}`, contactEmail: "private@example.com" });
    const a = await importRobotTeamDirectory(db, original, "owner-direction", () => now);
    const b = await importRobotTeamDirectory(db, original, "owner-direction", () => "2026-10-04T14:00:00.000Z");
    expect(a).toEqual(b); expect(a.records).toHaveLength(47); expect(a.readbackVerified).toBe(true);
    expect([...rows.keys()].filter(k => k.startsWith("robotTeams/"))).toHaveLength(53);
    const row = rows.get("robotTeams/team_directory_bp-team-001");
    expect(row.capability).toEqual({}); expect(row.public_intelligence.retained_directory.original_checked_at).toBe("2026-09-30");
    expect(publicRobotTeam(row.id, row).retained_directory.notes).toContain("Interest unknown");
    expect(rows.get("robotTeams/test0").contactEmail).toBe("private@example.com");
  });
  it("preserves existing measured capability and contact fields on a matching canonical team", async () => {
    const { db, rows } = fixture(); rows.set("robotTeams/original", { name: "Team 1", status: "engaged",
      contactEmail: "private@example.com", capability: { reachM: 2 }, fieldProvenance: { reachM: { grade: "measured" } } });
    await importRobotTeamDirectory(db, input(), "owner-direction", () => now);
    expect(rows.get("robotTeams/original").capability.reachM).toBe(2);
    expect(rows.has("robotTeams/team_directory_bp-team-001")).toBe(false);
    expect(JSON.stringify(publicRobotTeam("original", rows.get("robotTeams/original")))).not.toContain("private@example.com");
  });
  it("refuses a partial/duplicate batch and an active worker without mutation", async () => {
    const value = input(); value.records[46] = value.records[0]; expect(() => prepareDirectoryImport(value)).toThrow(/duplicate/);
    const { db, rows } = fixture(); rows.set(ROOT, { enabled: true });
    await expect(importRobotTeamDirectory(db, input(), "owner-direction", () => now)).rejects.toThrow(/paused/);
    expect(rows.size).toBe(1);
  });
});

describe("agent-owned Notion mirror receipts", () => {
  it.each(["create", "append"])("reconciles an accepted %s after ACK loss without submitting another write", async phase => {
    const { db, rows } = fixture(), provider = notion();
    rows.set("robotTeams/team1", { name: "Real team", contactEmail: "private@example.com", public_intelligence: { summary: "Vendor claim; interest unknown" } });
    provider.lose.add(phase);
    await expect(mirrorRobotTeamToNotion(db, "team1", scope, { transport: provider.transport, clock: () => now })).rejects.toThrow(/ack_lost/);
    const receipt = await mirrorRobotTeamToNotion(db, "team1", scope, { transport: provider.transport, clock: () => now });
    expect(receipt.readback_verified).toBe(true); expect(provider.writes).toEqual(["create", "append"]);
    await mirrorRobotTeamToNotion(db, "team1", scope, { transport: provider.transport, clock: () => now });
    expect(provider.writes).toEqual(["create", "append"]);
    expect(JSON.stringify(provider.blocks)).not.toContain("private@example.com");
  });
  it("retains complete large notes across batches and versions, with no replacement of prior evidence", async () => {
    const { db, rows } = fixture(), provider = notion();
    const original = { name: "Real team", public_intelligence: { retained_directory: { notes: "Original 🙂 dated evidence. ".repeat(12000), original_checked_at: "2026-09-30" } } };
    rows.set("robotTeams/team1", original);
    const receipt = await mirrorRobotTeamToNotion(db, "team1", scope, { transport: provider.transport, clock: () => now });
    expect(receipt.batches).toBeGreaterThan(1);
    const count = provider.blocks.length;
    rows.set("robotTeams/team1", { ...original, public_intelligence: { ...original.public_intelligence, summary: "New source-backed interpretation" } });
    const next = await mirrorRobotTeamToNotion(db, "team1", scope, { transport: provider.transport, clock: () => now });
    expect(next.page_id).toBe(receipt.page_id); expect(provider.pages).toHaveLength(1); expect(provider.blocks.length).toBeGreaterThan(count);
    expect(provider.blocks[0].paragraph.rich_text[0].text.content).toContain(receipt.canonical_source_sha256);
  });
  it("keeps the mirror disabled without retained direction and available as an agent tool", async () => {
    const { db } = fixture(), provider = notion();
    await expect(mirrorRobotTeamToNotion(db, "team1", undefined, { transport: provider.transport })).rejects.toThrow(/not_enabled/);
    expect(provider.writes).toEqual([]);
    const mirror = vi.fn(async () => ({ ok: true, readback_verified: true })), directory = new RobotTeamDirectory(db, undefined, () => now, { mirror });
    expect((await directory.call("mirror_robot_team_to_notion", { team_id: "team1" })).readback_verified).toBe(true);
    expect(mirror).toHaveBeenCalledWith("team1");
  });
});
