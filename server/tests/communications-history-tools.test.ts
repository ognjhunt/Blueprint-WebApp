// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn(), objects: new Map<string, string>(), generation: "1", learning:null as any }));
vi.mock("../../client/src/lib/firebaseAdmin",()=>({dbAdmin:{doc:()=>({get:async()=>({data:()=>({learning:mocks.learning})})})}}));
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
  COMMUNICATIONS_HISTORY_PROFILE, COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST,
  COMMUNICATIONS_GMAIL_READ_PROFILE, COMMUNICATIONS_GMAIL_READ_TOOLS,
  verifiedCommunicationsCurrentSavedAgent } from "../agents/communications-saved-agent";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import { communicationsFixture } from "./fixtures/communications";

// Safe metadata shape retained from the owner's GET; no token or inline auth.
const ownerGmailTool = { type: "mcp", server_label: "gmail",
  credential_id: "credential_eb72b2cdf2ca4845bb9f669f014d8bc2bdf2e8ab63834f09bf",
  transport: { type: "http", server_url: "https://gmailmcp.googleapis.com/mcp/v1", headers: {} },
  request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" };

function fixture(options: { unknownAck?: "accepted" | "pending"; tamper?: "tools" | "profile" | "turn" | "mcp"; single?: boolean; pages?: number; unknownAt?: number; expireDuringSave?: boolean; gmail?: boolean; nativePages?: number } = {}) {
  const { output } = communicationsFixture();
  let stage = 0, unknown = !!options.unknownAck, createBody: any;
  let latest: CommunicationsCheckpoint = { createClaimedAt: null, sessionId: null, turnId: null };
  const saved: CommunicationsCheckpoint[] = [], requests: Array<{ path: string; init: RequestInit }> = [], events: any[] = [];
  const savedAgent: any = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION,
    ...(options.gmail ? { tools: [structuredClone(ownerGmailTool)] } : {}) };
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
    if (path.endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`)) return Response.json(savedAgent);
    if (path.endsWith("/agents/sessions")) {
      createBody = JSON.parse(String(init.body));
      if (options.gmail) {
        expect(latest.gmailMcp?.configuration).toEqual(createBody.agent);
        expect(latest.historyConfigurationDigest).toBe(communicationsDigest(createBody.agent));
        expect(createBody.metadata.blueprint_communications_mcp_profile).toBe(COMMUNICATIONS_GMAIL_READ_PROFILE);
        expect(createBody.vault_ids).toBeUndefined();
      }
      return stream(true);
    }
    if (path.endsWith("/events")) {
      if (init.method !== "POST") return stream(false);
      const body = JSON.parse(String(init.body)), event = body.events[0];
      // The exact immutable event is durable before the provider can receive it.
      const snapshot = latest.historyEvidence ? (await hydrateAgentEvidence(latest.historyEvidence, {collection:"agentCheckpoints",id:"communications-history:job-1:session-1"})).snapshot as any : null;
      const retained = latest.historyToolReceipts ?? (latest.gmailMcp ? snapshot.historyToolReceipts : snapshot);
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
      if (options.tamper === "mcp") agent.tools.at(-1).allowed_tools.push("create_draft");
      const action = stage < actions.length ? structuredClone(actions[stage]) : null;
      if (action && options.tamper === "turn") action.turn_id = "child-turn";
      return Response.json({ id: "session-1", agent, metadata, status: action ? "requires_action" : "idle", required_actions: action ? [action] : [], environment: { type: "none" }, vault_ids: [] });
    }
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: stage < actions.length ? "waiting" : "completed", usage: { input_tokens: 10, output_tokens: 5 } }], has_more: false });
    if (path.includes("/items?")) {
      const final = { id: "final-1", turn_id: "turn-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output) }] };
      if (!options.gmail) return Response.json({ data: [final], has_more: false });
      const page = Number(new URL(String(url)).searchParams.get("after")?.replace("mcp-", "") ?? 0);
      const call = { id: `mcp-${page + 1}`, type: "mcp_call", turn_id: "turn-1", server_label: "gmail", name: "get_message",
        arguments: JSON.stringify({ message_id: `test-message-${page + 1}` }),
        status: page === 1 ? "failed" : "completed", error: page === 1 ? "test read failure" : null,
        output: options.nativePages ? "test-only private content ".padEnd(190000, "x") : "test-only message" };
      const has_more = page + 1 < (options.nativePages ?? 1);
      return Response.json({ data: has_more ? [call] : [call, final], has_more, last_id: call.id });
    }
    throw new Error("unexpected mock route");
  });
  const reserve = vi.fn(async () => undefined), usage = vi.fn(async () => undefined);
  const api = () => new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetch as any, reservePaidDraft: reserve, recordPaidDraftUsage: usage });
  const params = () => ({ input: "trusted research/thread", jobId: "job-1", checkpoint: structuredClone(latest), saveCheckpoint: async (checkpoint: CommunicationsCheckpoint) => { latest = structuredClone(checkpoint); saved.push(structuredClone(checkpoint));
    if(options.expireDuringSave && checkpoint.historyToolReceipts?.at(-1)?.delivery === "prepared") vi.setSystemTime(Date.now()+10000);
  } });
  return { api, params, requests, events, saved, reserve, output, savedAgent, latest: () => structuredClone(latest), mutateAction: (value: object) => { actions[stage].arguments = value as any; } };
}
beforeEach(() => {
  mocks.run.mockReset(); mocks.objects.clear(); mocks.generation="1";mocks.learning={
  version:"blueprint.research-learning-worker.v1",enabled:true,startDate:"2026-10-01",
  binding:{version:"blueprint.research-learning-consumer-binding.v1",principalId:"blueprint-learning-host",role:"daily_research",
    sourceSnapshotId:"a".repeat(64),crmIds:["BP-000001"],prospectIds:[],discoveryCapabilityIds:["summary-capability"],detailCapabilityIds:[],expiresAt:"2099-10-03T00:00:00.000Z"},
  businessScope:{principalId:"blueprint-learning-host",subjectKeys:["blueprint:research-learning"],expiresAt:"2099-10-02T13:00:00.000Z"},
};
  mocks.run.mockImplementation(async (name: string) => name === "search_company_history"
    ? { ok: true, rows: [{ record_id: "history:chosen", source_ref: "company-owned/source", original_checked_at: "2026-10-01" }], next_cursor: null, coverage: ["crm"], semantic: { status: "not_authorized" } }
    : { ok: true, record: { record_id: "history:chosen", source_sha256: "a".repeat(64), content: { evidence: "chosen original" } } });
});

describe("actual communications Agents API history continuation", () => {
  it("freezes the owner's safe Gmail connection before one create, with read-only MCP plus existing history tools", async () => {
    const f = fixture({ gmail: true, single: true }); const result = await f.api().run(f.params());
    const create = JSON.parse(String(f.requests.find(item => item.init.method === "POST" && item.path.endsWith("/agents/sessions"))!.init.body));
    expect(create.agent.tools.map((tool: any) => tool.type)).toEqual(["function", "function", "mcp"]);
    expect(create.agent.tools.at(-1)).toEqual({ ...ownerGmailTool,
      transport: { type: "http", server_url: ownerGmailTool.transport.server_url }, allowed_tools: COMMUNICATIONS_GMAIL_READ_TOOLS });
    expect(f.savedAgent.tools).toEqual([ownerGmailTool]);
    expect(result.checkpoint.gmailMcp).toMatchObject({ profile: COMMUNICATIONS_GMAIL_READ_PROFILE, savedTool: ownerGmailTool,
      configurationDigest: communicationsDigest(create.agent) });
    expect(result.outputSource?.definitionVersion).toBe("blueprint.communications-definition.v6");
    expect(result.checkpoint.nativeMcpItems).toMatchObject([{ type: "mcp_call", name: "get_message", status: "completed" }]);
    expect((result.outputSource as any).nativeMcpEvidence).toMatchObject({ observedCalls: 1,
      callsDigest: communicationsDigest(result.checkpoint.nativeMcpItems), field: "checkpoint" });
    expect(f.reserve).toHaveBeenCalledTimes(1);
  });
  it("recovers the frozen Gmail profile without reading a changed owner definition and retains complete native evidence privately", async () => {
    const f = fixture({ gmail: true, single: true, unknownAck: "pending", nativePages: 3 });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_result_ack_unknown" });
    const frozen = f.latest().gmailMcp;
    f.savedAgent.tools[0].credential_id = "credential_owner_changed_after_create";
    const result = await f.api().run(f.params());
    expect(result.output).toEqual(f.output); expect(result.checkpoint.gmailMcp).toEqual(frozen);
    expect(f.reserve).toHaveBeenCalledTimes(1); expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(f.requests.filter(item => item.path.endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`))).toHaveLength(1);
    expect(f.requests.filter(item => item.init.method === "POST" && item.path.endsWith("/agents/sessions"))).toHaveLength(1);
    expect(result.checkpoint.nativeMcpItems).toBeUndefined(); expect(result.checkpoint.historyToolReceipts).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(result.checkpoint))).toBeLessThan(512000);
    const retained = await hydrateAgentEvidence(result.checkpoint.historyEvidence!, { collection: "agentCheckpoints", id: "communications-history:job-1:session-1" });
    const snapshot = retained.snapshot as any;
    expect(snapshot.historyToolReceipts).toMatchObject([{ delivery: "submitted" }]);
    expect(snapshot.nativeMcpItems).toHaveLength(3);
    expect(snapshot.nativeMcpItems[1]).toMatchObject({ status: "failed", error: "test read failure" });
    expect(snapshot.nativeMcpItems.every((item: any) => item.output.length === 190000)).toBe(true);
    expect((result.outputSource as any).nativeMcpEvidence).toMatchObject({ observedCalls: 3, callsDigest: communicationsDigest(snapshot.nativeMcpItems) });
    const replacement = await f.api().run(f.params());
    expect(replacement.checkpoint.historyEvidence).toEqual(result.checkpoint.historyEvidence);
    const observed = await f.api().reconcileSaved(f.latest(), "job-1");
    expect(observed?.checkpoint.historyEvidence).toEqual(result.checkpoint.historyEvidence);
    expect(observed?.checkpoint.nativeMcpItems).toBeUndefined();
    expect(f.reserve).toHaveBeenCalledTimes(1);
  });
  it("rejects inline auth and a changed session allowlist without provider mutation or history submission", async () => {
    expect(() => verifiedCommunicationsCurrentSavedAgent({ id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION,
      tools: [{ ...ownerGmailTool, transport: { ...ownerGmailTool.transport, headers: { Authorization: "test-only" } } }] })).toThrow("communications_gmail_read_configuration_invalid");
    const f = fixture({ gmail: true, single: true, tamper: "mcp" });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_existing_session_history_binding_mismatch" });
    expect(mocks.run).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
    expect(f.requests.filter(item => item.init.method === "POST")).toHaveLength(1);
  });
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
    expect(mocks.run).toHaveBeenNthCalledWith(1, "search_company_history", { query: "robot workflow Seattle", filters: { city: "Seattle" }, page_size: 2 }, expect.objectContaining({ principalId: "blueprint-learning-host", companyWide: false, prospectIds: [], expiresAt:"2099-10-02T13:00:00.000Z" }));
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
  it("shows a safe denied tool result when retained access expires, without substituting task-kind authority", async () => {
    const f=fixture({single:true});mocks.learning.businessScope.expiresAt="2000-01-01T00:00:00Z";
    const result=await f.api().run(f.params());expect(result.output).toEqual(f.output);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(JSON.parse(f.events[0].event.error)).toMatchObject({status:"control_denied",code:"permission_denied",retryAllowed:false});
  });
  it("does not replay cached sensitive output after its retained read binding expires", async () => {
    const f=fixture({single:true,unknownAck:"pending"});
    await expect(f.api().run(f.params())).rejects.toMatchObject({code:"agents_history_result_ack_unknown"});
    expect(f.latest().historyToolReceipts![0].historyAccessDigest).toMatch(/^[a-f0-9]{64}$/);
    mocks.learning.businessScope.expiresAt="2000-01-01T00:00:00Z";
    await expect(f.api().run(f.params())).rejects.toMatchObject({code:"agents_history_retained_access_changed_or_expired"});
    expect(f.events).toHaveLength(1);expect(mocks.run).toHaveBeenCalledTimes(1);
  });
  it("checks the original retained expiry again after checkpoint persistence and before provider delivery", async () => {
    vi.useFakeTimers();
    try {
      mocks.learning.businessScope.expiresAt=new Date(Date.now()+5000).toISOString();
      const f=fixture({single:true,expireDuringSave:true});
      await expect(f.api().run(f.params())).rejects.toMatchObject({code:"agents_history_retained_access_changed_or_expired"});
      expect(mocks.run).toHaveBeenCalledTimes(1);expect(f.events).toHaveLength(0);
      expect(f.latest().historyToolReceipts![0].delivery).toBe("prepared");
    } finally { vi.useRealTimers(); }
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
    const receipts = Array.isArray(reconstructed.snapshot) ? reconstructed.snapshot : (reconstructed.snapshot as any).historyToolReceipts;
    expect(receipts.map((receipt: any)=>receipt.delivery)).toEqual(Array(6).fill("submitted"));
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
