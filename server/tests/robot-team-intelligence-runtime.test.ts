// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null, default: {} }));
import { dueRobotTeamJobs, intelligenceControlSchema } from "../robot-team-intelligence/contract";
import { RobotAgentsClient, assertRobotSession } from "../robot-team-intelligence/native";
import { directoryDigest, ROOT } from "../robot-team-intelligence/directory";
import { runRobotTeamIntelligenceTick } from "../robot-team-intelligence/worker";
import { createRobotTeamSemanticRanker } from "../robot-team-intelligence/semantic";

function database() {
  const rows = new Map<string, any>(), clone = (value: any) => JSON.parse(JSON.stringify(value));
  const snapshot = (path: string) => ({ id: path.split("/").at(-1), ref: doc(path), exists: rows.has(path), data: () => rows.has(path) ? clone(rows.get(path)) : undefined });
  const doc = (path: string): any => ({ path, id: path.split("/").at(-1), get: async () => snapshot(path),
    set: async (value: any) => rows.set(path, clone(value)), collection: (name: string) => collection(`${path}/${name}`) });
  const collection = (path: string): any => ({ doc: (id: string) => doc(`${path}/${id}`), get: async () => ({
    docs: [...rows.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).map(snapshot) }) });
  const db = { doc, collection, runTransaction: async (fn: any) => {
    const writes: Array<() => void> = [], result = await fn({ get: async (ref: any) => ref.get(),
      set: (ref: any, data: any) => writes.push(() => rows.set(ref.path, clone(data))), delete: (ref: any) => writes.push(() => rows.delete(ref.path)) });
    writes.forEach(write => write()); return result;
  } } as unknown as FirebaseFirestore.Firestore;
  return { db, rows };
}
const now = "2026-10-05T15:00:00.000Z";
const control = intelligenceControlSchema.parse({ schemaVersion: 1, enabled: true, firstDate: "2026-10-05", projectId: "proj_robot",
  agents: { discovery: "agent_discovery", refresh: "agent_refresh" },
  directoryAccess: { authorizationRef: "fixture-owner-directory", expiresAt: "2026-12-01T00:00:00.000Z", read: true, updatePublicEvidence: true },
  budget: { authorizationRef: "fixture-owner-budget", expiresAt: "2026-12-01T00:00:00.000Z", dailySoftUsd: 3, perRunReservationUsd: 1 } });
const binding = { agentId: "agent_discovery", configuration: { model: "gpt-6.1-sol", instructions: "fixture", tools: [], multi_agent: { enabled: false } }, vaultIds: [], digest: "fixture-binding" };
const session = (runId: string, requestDigest: string, required_actions: any[] = []) => ({ id: "sess_fixture", environment: { type: "none" },
  metadata: { blueprint_robot_run: runId, blueprint_robot_request: requestDigest, blueprint_robot_binding: binding.digest },
  agent: binding.configuration, vault_ids: [], required_actions });

describe("robot team periodic agent lifecycle", () => {
  it("uses stable local week/month periods across DST and catches missed weekly work without daily duplication", () => {
    const october = { ...control, firstDate: "2026-10-01" };
    expect(dueRobotTeamJobs(october, new Date("2026-10-05T13:59:00Z")).map(job => job.kind)).toEqual(["monthly_review"]);
    expect(dueRobotTeamJobs(october, new Date("2026-10-05T14:00:00Z")).map(job => job.kind)).toEqual(["monthly_review", "weekly_discovery", "weekly_refresh"]);
    expect(dueRobotTeamJobs(october, new Date("2026-10-09T14:00:00Z"))[1].id).toBe("weekly_discovery-2026-10-05");
    expect(dueRobotTeamJobs(october, new Date("2026-11-02T14:59:00Z")).map(job => job.kind)).toEqual(["monthly_review"]);
    expect(dueRobotTeamJobs(october, new Date("2026-11-02T15:00:00Z"))[1].id).toBe("weekly_discovery-2026-11-02");
  });
  it("an unknown create survives replacement observation without another POST or zero spend", async () => {
    const store = database(); store.rows.set(ROOT, control);
    const create = vi.fn(async () => { throw Error("lost acceptance"); }), reconcileCreate = vi.fn(async () => null);
    const client = { binding: async () => binding, create, reconcileCreate } as unknown as RobotAgentsClient;
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    expect(create).toHaveBeenCalledTimes(1); expect(reconcileCreate).toHaveBeenCalledTimes(2);
    const run = store.rows.get(`${ROOT}/runs/weekly_discovery-2026-10-05`);
    expect(run.state).toBe("create_pending"); expect(run.billing).toMatchObject({ reservationUsd: 1, complete: false, invoiceVerified: false });
  });
  it("accepts provider-added defaults but rejects a changed frozen tool/model identity", () => {
    const saved = session("run", "request");
    expect(() => assertRobotSession({ ...saved, agent: { ...saved.agent, text: { verbosity: "medium" } } }, "run", "request", binding)).not.toThrow();
    expect(() => assertRobotSession({ ...saved, agent: { ...saved.agent, model: "different" } }, "run", "request", binding)).toThrow("binding_changed");
    expect(() => assertRobotSession({ ...saved, vault_ids: ["vault_extra"] }, "run", "request", binding)).toThrow("binding_changed");
  });
  it("a late preparation refuses a paid create", async () => {
    const store = database(); store.rows.set(ROOT, { ...control, executionWindowMs: 60000 });
    let current = now;
    const create = vi.fn();
    const client = { binding: async () => { current = "2026-10-05T15:02:00.000Z"; return binding; }, create } as unknown as RobotAgentsClient;
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => current });
    expect(create).not.toHaveBeenCalled();
  });
  it("a stopped existing session is observed and retained without executing actions or creating again", async () => {
    const store = database(); store.rows.set(ROOT, control);
    let capturedRun = "", capturedRequest = "";
    const create = vi.fn(async (id: string, _binding: any, _input: string, request: string) => { capturedRun = id; capturedRequest = request; return { id: "sess_fixture" }; });
    let terminal = false;
    const client = { binding: async () => binding, create, json: async () => session(capturedRun, capturedRequest),
      list: async (path: string) => path.includes("/turns") ? [{ id: "turn_fixture", status: terminal ? "completed" : "waiting", usage: null }] : [] } as unknown as RobotAgentsClient;
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    store.rows.set(ROOT, { ...control, enabled: false }); terminal = true;
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    expect(create).toHaveBeenCalledTimes(1);
    expect(store.rows.get(`${ROOT}/runs/${capturedRun}`)).toMatchObject({ state: "incomplete", billing: { complete: false, reservationUsd: 1 } });
  });
  it("observes an accepted tool result after ACK loss, retaining one canonical check and one original create", async () => {
    const store = database(); store.rows.set(ROOT, control);
    store.rows.set("robotTeams/team_actual", { name: "Actual", status: "prospect", capability: {}, fieldProvenance: {} });
    const action = { type: "function_call", turn_id: "turn_actual", call_id: "call_check", name: "record_robot_team_check",
      arguments: JSON.stringify({ team_id: "team_actual", checked_at: now, summary: "Checked official announcements" }) };
    let runId = "", request = "", observed: any;
    const create = vi.fn(async (id: string, _b: any, _i: string, digest: string) => { runId = id; request = digest; return { id: "sess_fixture" }; });
    const result = vi.fn(async (_id: string, original: any, _success: boolean, output: any) => {
      observed = { type: "function_call_output", call_id: original.call_id, turn_id: original.turn_id, output: JSON.stringify(output), status: "completed" };
      throw Error("Accepted response lost");
    });
    const client = { binding: async () => binding, create, result, json: async () => session(runId, request, [action]),
      list: async (path: string) => path.includes("/turns") ? [{ id: "turn_actual", status: "waiting" }] : observed ? [observed] : [] } as unknown as RobotAgentsClient;
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    await runRobotTeamIntelligenceTick({ db: store.db, client, clock: () => now });
    expect(create).toHaveBeenCalledTimes(1); expect(result).toHaveBeenCalledTimes(1);
    expect([...store.rows.keys()].filter(path => path.startsWith(`${ROOT}/checks/`))).toHaveLength(1);
    const retained = store.rows.get(`agentCheckpoints/robot-intelligence-${runId}`).snapshot;
    expect(Object.values(retained.receipts)[0]).toMatchObject({ delivery: "acknowledged", action });
  });
  it("attaches only the existing singleton vault and explicit public-read MCP subset", async () => {
    const calls: string[] = [];
    const client = new RobotAgentsClient({ apiKey: "fixture-not-real", projectId: "proj_robot", fetch: (async (url: any) => {
      const path = new URL(url).pathname; calls.push(path);
      const data = path === "/v1/agents/agent_discovery" ? { id: "agent_discovery", model: "gpt-6.1-sol", instructions: "fixture", tools: [
        { type: "mcp", server_label: "notion", transport: { type: "http", server_url: "https://mcp.notion.com/mcp", headers: {} },
          connection_origin: "service", credential_id: "credential_owned", allowed_tools: null }] }
        : path === "/v1/vaults" ? { data: [{ id: "vault_owned" }], has_more: false }
          : { data: [{ id: "credential_owned" }], has_more: false };
      return new Response(JSON.stringify(data), { status: 200 });
    }) as typeof fetch });
    await expect(client.binding(control, "discovery")).rejects.toThrow("public_read_tools_required");
    const checked = await client.binding({ ...control, mcpReadTools: { notion: ["notion-search", "notion-fetch"] } }, "discovery");
    expect(checked.vaultIds).toEqual(["vault_owned"]);
    expect(checked.configuration.tools[0].allowed_tools).toEqual(["notion-search", "notion-fetch"]);
    expect(calls.every(path => !path.includes("sessions"))).toBe(true);
  });
});

describe("robot team semantic index reuse", () => {
  it("reuses unchanged vectors, reindexes changed public projections and never turns missing settings into paid calls", async () => {
    const store = database(), embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 0]));
    const authority = { enabled: true, model: "fixture-model", dimensions: 2, maxInputCharacters: 10000 };
    const rank = createRobotTeamSemanticRanker(store.db, { assertAccess: () => {}, authority, embed });
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const team = { team_id: "team_a", source_sha256: sha("original"), text: "Mobile manipulation" };
    expect((await rank("CNC tending", [team])).scores.team_a).toBe(1);
    await rank("CNC tending", [team]); expect(embed).toHaveBeenCalledTimes(2); // One query + one record.
    await rank("CNC tending", [{ ...team, text: "Updated capability", source_sha256: sha("changed") }]);
    expect(embed).toHaveBeenCalledTimes(3);
    const disabled = createRobotTeamSemanticRanker(store.db, { assertAccess: () => {}, embed });
    expect((await disabled("CNC tending", [team])).mode).toBe("keyword"); expect(embed).toHaveBeenCalledTimes(3);
  });
});
