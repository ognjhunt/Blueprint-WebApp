// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn(), objects: new Map<string, string>(), generation: "1" }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({
  bucketName: "mock-existing-private-bucket",
  createOnly: async (name: string, content: string) => { if (!mocks.objects.has(name)) mocks.objects.set(name, content); return "created"; },
  readText: async (name: string) => mocks.objects.get(name) ?? null,
  info: async (name: string) => mocks.objects.has(name) ? { generation: mocks.generation, size: Buffer.byteLength(mocks.objects.get(name)!) } : null,
}) }));
vi.mock("../research-learning/company-history", () => ({ runCompanyHistoryTool: mocks.run }));
import { CommunicationsAgentsAPI, type CommunicationsCheckpoint } from "../agents/communications-api";
import { communicationsDigest, COMMUNICATIONS_MODEL } from "../agents/communications-contract";
import { COMMUNICATIONS_SAVED_AGENT_ID, COMMUNICATIONS_SAVED_CONFIGURATION,
  COMMUNICATIONS_HISTORY_PROFILE, COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST } from "../agents/communications-saved-agent";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import { communicationsFixture } from "./fixtures/communications";

function fixture(options: { unknownAck?: "accepted" | "pending"; tamper?: "tools" | "profile" | "turn"; single?: boolean; pages?: number; unknownAt?: number } = {}) {
  const { output } = communicationsFixture();
  let stage = 0, unknown = !!options.unknownAck, createBody: any;
  let latest: CommunicationsCheckpoint = { createClaimedAt: null, sessionId: null, turnId: null };
  const saved: CommunicationsCheckpoint[] = [], requests: Array<{ path: string; init: RequestInit }> = [], events: any[] = [];
  const actions = options.pages ? Array.from({length:options.pages}, (_, i) => ({type:"function_call",name:"search_company_history",arguments:{query:`page ${i}`,page_size:1},call_id:`call-${i+1}`,turn_id:"turn-1"})) : options.single ? [{ type: "function_call", name: "search_company_history", arguments: { query: "robot workflow Seattle", page_size: 2 }, call_id: "call-1", turn_id: "turn-1" }]
    : [{ type: "function_call", name: "search_company_history", arguments: "{broken-json", call_id: "call-1", turn_id: "turn-1" },
      { type: "function_call", name: "search_company_history", arguments: { query: "robot workflow Seattle", filters: { city: "Seattle" }, page_size: 2 }, call_id: "call-2", turn_id: "turn-1" },
      { type: "function_call", name: "fetch_company_history_record", arguments: { record_id: "history:chosen" }, call_id: "call-3", turn_id: "turn-1" }];
  const stream = (fresh: boolean) => {
    const frames: any[] = fresh ? [{ type: "agent.session.created", session: { id: "session-1" } }, { type: "agent.session.turn.created", turn_id: "turn-1", turn: { subagent_id: null } }] : [];
    for (let i = stage; i < actions.length; i++) frames.push({ type: "agent.session.requires_action" });
    frames.push({ type: "agent.session.turn.completed", turn_id: "turn-1" });
    return new Response(frames.map(item => `data: ${JSON.stringify(item)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
  };
  const fetch = vi.fn(async (url: any, init: RequestInit = {}) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search; requests.push({ path, init });
    if (path.includes("/models/")) return Response.json({ id: COMMUNICATIONS_MODEL });
    if (path.endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`)) return Response.json({ id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION });
    if (path.endsWith("/agents/sessions")) { createBody = JSON.parse(String(init.body)); return stream(true); }
    if (path.endsWith("/events")) {
      if (init.method !== "POST") return stream(false);
      const body = JSON.parse(String(init.body)), event = body.events[0];
      // The exact immutable event is durable before the provider can receive it.
      const retained = latest.historyToolReceipts ?? (await hydrateAgentEvidence(latest.historyEvidence!, {collection:"agentCheckpoints",id:"communications-history:job-1:session-1"})).snapshot as any[];
      expect(retained.at(-1)).toMatchObject({ delivery: expect.stringMatching(/prepared|ack_unknown|submitted/), callId: event.call_id });
      events.push({ event, key: (init.headers as Record<string, string>)["Idempotency-Key"] });
      if (unknown && stage === (options.unknownAt ?? 0)) { unknown = false; if (options.unknownAck === "accepted") stage++; throw new Error("PRIVATE connection detail"); }
      stage++; return Response.json({ id: "session-1" });
    }
    if (path.endsWith("/session-1")) {
      const agent = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...structuredClone(createBody.agent) };
      const metadata = { ...createBody.metadata };
      if (options.tamper === "tools") agent.tools[0].name = "send_email";
      if (options.tamper === "profile") metadata.blueprint_communications_history_profile = "untrusted";
      const action = stage < actions.length ? structuredClone(actions[stage]) : null;
      if (action && options.tamper === "turn") action.turn_id = "child-turn";
      return Response.json({ id: "session-1", agent, metadata, status: action ? "requires_action" : "idle", required_actions: action ? [action] : [], environment: { type: "none" }, vault_ids: [] });
    }
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: stage < actions.length ? "waiting" : "completed", usage: { input_tokens: 10, output_tokens: 5 } }], has_more: false });
    if (path.includes("/items?")) return Response.json({ data: [{ id: "final-1", turn_id: "turn-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output) }] }], has_more: false });
    throw new Error("unexpected mock route");
  });
  const reserve = vi.fn(async () => undefined), usage = vi.fn(async () => undefined);
  const api = () => new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetch as any, reservePaidDraft: reserve, recordPaidDraftUsage: usage });
  const params = () => ({ input: "trusted research/thread", jobId: "job-1", checkpoint: structuredClone(latest), saveCheckpoint: async (checkpoint: CommunicationsCheckpoint) => { latest = structuredClone(checkpoint); saved.push(structuredClone(checkpoint)); } });
  return { api, params, requests, events, saved, reserve, output, latest: () => structuredClone(latest), mutateAction: (value: object) => { actions[stage].arguments = value as any; } };
}
beforeEach(() => {
  mocks.run.mockReset(); mocks.objects.clear(); mocks.generation="1";
  mocks.run.mockImplementation(async (name: string) => name === "search_company_history"
    ? { ok: true, rows: [{ record_id: "history:chosen", source_ref: "company-owned/source", original_checked_at: "2026-10-01" }], next_cursor: null, coverage: ["crm"], semantic: { status: "not_authorized" } }
    : { ok: true, record: { record_id: "history:chosen", source_sha256: "a".repeat(64), content: { evidence: "chosen original" } } });
});

describe("actual communications Agents API history continuation", () => {
  it("declares exact new-only tools and repairs JSON in the same root turn before selecting/fetching records", async () => {
    const f = fixture(); const result = await f.api().run(f.params());
    expect(result.output).toEqual(f.output);
    expect(result.outputSource?.definitionVersion).toBe("blueprint.communications-definition.v5");
    expect(result.checkpoint).toMatchObject({ historyProfile: COMMUNICATIONS_HISTORY_PROFILE, historyConfigurationDigest: COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST });
    expect(result.checkpoint.historyToolReceipts).toHaveLength(3);
    expect(f.events).toHaveLength(3);
    expect(JSON.parse(f.events[0].event.error)).toMatchObject({ code: "tool_arguments_json_invalid", issues: [{ path: "/", code: "invalid_json" }] });
    expect(f.events.slice(1).every(item => item.event.success && item.event.type === "agent.session.input.tool_result" && item.event.turn_id === "turn-1")).toBe(true);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    expect(mocks.run).toHaveBeenNthCalledWith(1, "search_company_history", { query: "robot workflow Seattle", filters: { city: "Seattle" }, page_size: 2 }, expect.objectContaining({ principalId: "blueprint-company-agent-runtime", companyWide: true }));
    expect(mocks.run).toHaveBeenNthCalledWith(2, "fetch_company_history_record", { record_id: "history:chosen" }, expect.any(Object));
    expect(f.requests.filter(item => item.init.method === "POST" && item.path.endsWith("/agents/sessions"))).toHaveLength(1);
    expect(f.requests.filter(item => item.init.method === "POST").every(item => !String(item.init.body).includes("agent.session.input.message"))).toBe(true);
    expect(COMMUNICATIONS_SAVED_CONFIGURATION.tools).toEqual([]); expect(f.reserve).toHaveBeenCalledTimes(1);
  });
  it.each(["accepted", "pending"] as const)("recovers %s unknown result acknowledgment with persisted bytes and no repeat read/new paid create", async unknownAck => {
    const f = fixture({ unknownAck, single: true });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_result_ack_unknown", retryable: true });
    const before = f.latest(); expect(before.historyToolReceipts?.[0].delivery).toBe("ack_unknown");
    const result = await f.api().run(f.params());
    expect(result.output).toEqual(f.output); expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(f.reserve).toHaveBeenCalledTimes(1);
    expect(f.requests.filter(item => item.init.method === "POST" && item.path.endsWith("/agents/sessions"))).toHaveLength(1);
    expect(f.events).toHaveLength(unknownAck === "accepted" ? 1 : 2);
    if (unknownAck === "pending") { expect(f.events[1]).toEqual(f.events[0]); expect(f.events[1].key).toBe(`communications-history-${before.historyToolReceipts![0].requestDigest}`); }
    expect(result.checkpoint.historyToolReceipts?.[0].delivery).toBe("submitted");
  });
  it("returns structured field/type failure to the native agent, preserving successful continuation", async () => {
    const f = fixture({ single: true });
    mocks.run.mockResolvedValueOnce({ ok: false, error: "company_history_arguments_invalid", issues: [{ field: "page_size", code: "too_big", message: "must be <= 50" }], action: "Correct the fields and call this tool again." });
    await f.api().run(f.params());
    expect(JSON.parse(f.events[0].event.error)).toMatchObject({ ok: false, issues: [{ field: "page_size", code: "too_big" }] });
  });
  it.each(["tools", "profile", "turn"] as const)("refuses altered %s provenance before any history result submission", async tamper => {
    const f = fixture({ tamper, single: true });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: tamper === "turn" ? "agents_history_action_provenance_invalid" : "agents_existing_session_history_binding_mismatch" });
    expect(mocks.run).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
  });
  it("refuses a redefined native call and forged retained result before resubmission", async () => {
    const f = fixture({ unknownAck: "pending", single: true });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_result_ack_unknown" });
    f.mutateAction({ query: "changed" });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_call_redefined" });
    expect(mocks.run).toHaveBeenCalledTimes(1); expect(f.events).toHaveLength(1);
    const params = f.params(); params.checkpoint.historyToolReceipts![0].output = JSON.stringify({ ok: true, record: "forged" });
    await expect(f.api().run(params)).rejects.toMatchObject({ code: "agents_history_receipt_binding_mismatch" });
    expect(f.events).toHaveLength(1);
  });
  it("pages beyond the old cumulative checkpoint ceiling and replacement hydrates complete private proof before unknown-ACK continuation", async () => {
    const f = fixture({pages:6,unknownAt:5,unknownAck:"pending"});
    mocks.run.mockImplementation(async (_name:string,args:{query:string})=>({ok:true,rows:[{record_id:args.query,excerpt:"x".repeat(190000)}],semantic:{status:"not_authorized"}}));
    await expect(f.api().run(f.params())).rejects.toMatchObject({code:"agents_history_result_ack_unknown"});
    const compact = f.latest(); expect(compact.historyToolReceipts).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(compact))).toBeLessThan(512000);
    expect(compact.historyEvidence?.agent_evidence_ref).toMatchObject({collection:"agentCheckpoints",id:"communications-history:job-1:session-1",bucket:"mock-existing-private-bucket",generation:"1"});
    const original = await hydrateAgentEvidence(compact.historyEvidence!, {collection:"agentCheckpoints",id:"communications-history:job-1:session-1"});
    expect(original.snapshot).toHaveLength(6); expect(JSON.parse((original.snapshot as any[])[0].output).rows[0].excerpt).toHaveLength(190000);
    const result = await f.api().run(f.params()); expect(result.output).toEqual(f.output);
    expect(mocks.run).toHaveBeenCalledTimes(6); expect(f.events).toHaveLength(7); expect(f.events[6]).toEqual(f.events[5]);
    expect(f.reserve).toHaveBeenCalledTimes(1);
    const reconstructed = await hydrateAgentEvidence(result.checkpoint.historyEvidence!, {collection:"agentCheckpoints",id:"communications-history:job-1:session-1"});
    expect((reconstructed.snapshot as any[]).map(receipt=>receipt.delivery)).toEqual(Array(6).fill("submitted"));
    const before = f.requests.length; mocks.objects.clear();
    await expect(f.api().run(f.params())).rejects.toMatchObject({code:"agent_evidence_object_missing"});
    expect(f.requests).toHaveLength(before); expect(mocks.run).toHaveBeenCalledTimes(6);
  });
  it("binds every persisted native result to session, root turn, original request and exact output", async () => {
    const f = fixture({ single: true }); const result = await f.api().run(f.params());
    const receipt = result.checkpoint.historyToolReceipts![0];
    expect(receipt.requestDigest).toBe(communicationsDigest({ sessionId: "session-1", turnId: "turn-1", callId: receipt.callId, name: receipt.name, arguments: receipt.arguments }));
    expect(receipt.resultDigest).toBe(communicationsDigest({ success: receipt.success, output: receipt.output }));
    expect(JSON.parse(receipt.output).rows[0].record_id).toBe("history:chosen");
  });
});
