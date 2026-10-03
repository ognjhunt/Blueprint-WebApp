// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn(), objects: new Map<string, string>(), generation: "1", learning:null as any }));
vi.mock("../../client/src/lib/firebaseAdmin",()=>({dbAdmin:{doc:()=>({get:async()=>({data:()=>({learning:mocks.learning})})})}}));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({
  bucketName: "mock-existing-private-bucket",
  createOnly: async (name: string, content: string) => { if (!mocks.objects.has(name)) mocks.objects.set(name, content); return "created"; },
  readText: async (name: string) => mocks.objects.get(name) ?? null,
  info: async (name: string) => mocks.objects.has(name) ? { generation: mocks.generation, size: Buffer.byteLength(mocks.objects.get(name)!) } : null,
}) }));
vi.mock("../research-learning/company-history", () => ({ runCompanyHistoryTool: mocks.run }));
import { CommunicationsAgentsAPI, CommunicationsRuntimeError, type CommunicationsCheckpoint } from "../agents/communications-api";
import { communicationsDigest, COMMUNICATIONS_MODEL } from "../agents/communications-contract";
import { COMMUNICATIONS_SAVED_AGENT_ID, COMMUNICATIONS_SAVED_CONFIGURATION,
  COMMUNICATIONS_HISTORY_PROFILE, COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST,
  COMMUNICATIONS_GMAIL_READ_PROFILE, COMMUNICATIONS_GMAIL_READ_TOOLS,
  COMMUNICATIONS_GMAIL_NOTION_READ_PROFILE, COMMUNICATIONS_NOTION_READ_TOOLS, COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION,
  COMMUNICATIONS_GMAIL_READ_DEFINITION, verifiedCommunicationsGmailBinding, verifiedCommunicationsGmailAgent,
  COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_PROFILE, COMMUNICATIONS_FIREBASE_READ_TOOLS, COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION,
  verifiedCommunicationsCurrentMcpBinding, verifiedCommunicationsCurrentMcpAgent, communicationsMcpCallAllowed, communicationsMcpDefinition,
  COMMUNICATIONS_MCP_VAULT_READ_PROFILE, resolveCommunicationsMcpVaultBinding, communicationsMcpVaultIds,
  verifiedCommunicationsCurrentSavedAgent } from "../agents/communications-saved-agent";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import { cancelledContinuationFixture, communicationsFixture } from "./fixtures/communications";
import { getCompanyHistoryAccess } from "../agents/operator-tools";
import { outputTextDigest } from "../agents/communications-output";

// Safe metadata shape retained from the owner's GET; no token or inline auth.
const ownerGmailTool = { type: "mcp", server_label: "gmail",
  credential_id: "credential_eb72b2cdf2ca4845bb9f669f014d8bc2bdf2e8ab63834f09bf",
  transport: { type: "http", server_url: "https://gmailmcp.googleapis.com/mcp/v1", headers: {} },
  request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" };
const ownerNotionTool = { type: "mcp", server_label: "notion",
  credential_id: "credential_0fb20a81d43044ff8487beefca0cb4552f09c47375c5418590",
  transport: { type: "http", server_url: "https://mcp.notion.com/mcp", headers: {} },
  request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" };

const ownerFirebaseTool = { type: "mcp", server_label: "firebase", credential_id: "credential_synthetic_firebase_owner",
  transport: { type: "http", server_url: "https://firestore.googleapis.com/mcp", headers: {} },
  request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" };

function fixture(options: { unknownAck?: "accepted" | "pending"; tamper?: "tools" | "profile" | "turn" | "mcp"; single?: boolean; pages?: number; unknownAt?: number; expireDuringSave?: boolean; gmail?: boolean; notion?: boolean; firebase?: boolean; missingVault?: boolean; ambiguousVault?: boolean; extraCredential?: boolean; nativePages?: number } = {}) {
  const { output } = communicationsFixture();
  let stage = 0, unknown = !!options.unknownAck, createBody: any;
  let latest: CommunicationsCheckpoint = { createClaimedAt: null, sessionId: null, turnId: null };
  const saved: CommunicationsCheckpoint[] = [], requests: Array<{ path: string; init: RequestInit }> = [], events: any[] = [];
  const savedAgent: any = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION,
    ...(options.gmail ? { tools: [structuredClone(ownerGmailTool), ...(options.notion ? [structuredClone(ownerNotionTool)] : []), ...(options.firebase ? [structuredClone(ownerFirebaseTool)] : [])] } : {}) };
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
    if (path.startsWith("/v1/vaults?")) return Response.json({ data: ["vault_gmail", "vault_notion", "vault_firebase", "vault_unrelated"].map(id => ({ id, object: "vault", name: "ignored private display metadata" })), has_more: false });
    if (path.includes("/vaults/") && path.includes("/credentials?")) {
      const vaultId = new URL(String(url)).pathname.split("/")[3];
      const credential = vaultId === "vault_gmail" ? options.missingVault ? "credential_unrelated" : ownerGmailTool.credential_id
        : vaultId === "vault_notion" ? ownerNotionTool.credential_id : vaultId === "vault_firebase" ? ownerFirebaseTool.credential_id : options.ambiguousVault ? ownerGmailTool.credential_id : "credential_other";
      return Response.json({ data: [{ id: credential, vault_id: vaultId, object: "vault.credential", auth: { privateMetadata: "never retained" } },
        ...(options.extraCredential && vaultId === "vault_gmail" ? [{ id: "credential_unapproved_neighbor", vault_id: vaultId, object: "vault.credential" }] : [])], has_more: false });
    }
    if (path.endsWith("/agents/sessions")) {
      createBody = JSON.parse(String(init.body));
      if (options.gmail) {
        expect(latest.gmailMcp?.configuration).toEqual(createBody.agent);
        expect(latest.historyConfigurationDigest).toBe(communicationsDigest(createBody.agent));
        expect(createBody.metadata.blueprint_communications_mcp_profile).toBe(COMMUNICATIONS_MCP_VAULT_READ_PROFILE);
        expect(createBody.vault_ids).toEqual(options.firebase ? ["vault_firebase", "vault_gmail", "vault_notion"] : options.notion ? ["vault_gmail", "vault_notion"] : ["vault_gmail"]);
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
      return Response.json({ id: "session-1", agent, metadata, status: action ? "requires_action" : "idle", required_actions: action ? [action] : [], environment: { type: "none" }, vault_ids: createBody.vault_ids ?? [] });
    }
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: stage < actions.length ? "waiting" : "completed", usage: { input_tokens: 10, output_tokens: 5 } }], has_more: false });
    if (path.includes("/items?")) {
      const final = { id: "final-1", turn_id: "turn-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output) }] };
      if (!options.gmail) return Response.json({ data: [final], has_more: false });
      const page = Number(new URL(String(url)).searchParams.get("after")?.replace("mcp-", "") ?? 0);
      const call = { id: `mcp-${page + 1}`, type: "mcp_call", turn_id: "turn-1", server_label: options.firebase ? "firebase" : options.notion ? "notion" : "gmail", name: options.firebase ? "get_database" : options.notion ? "fetch" : "get_message",
        arguments: JSON.stringify({ message_id: `test-message-${page + 1}` }),
        status: page === 1 ? "failed" : "completed", error: page === 1 ? "test read failure" : null,
        output: options.nativePages ? "test-only private content ".padEnd(190000, "x") : options.firebase ? JSON.stringify({ name: "projects/synthetic/databases/(default)", type: "FIRESTORE_NATIVE" }) : options.notion
          ? JSON.stringify({ page_id: "synthetic-page", original_checked_at: "2026-10-01", text: "Company knowledge", truncated: true, unknown_block_ids: ["unread-child"] }) : "test-only message" };
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

describe("owner-authorized cancelled same-session continuation", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime("2026-10-03T00:45:00Z"); });
  afterEach(() => vi.useRealTimers());
  async function cancelled(options: { unknownAck?: boolean; historyAckUnknown?: boolean; historyAckAtDeadline?: boolean; tamper?: "message" | "extra_turn"; usageUnknown?: boolean } = {}) {
    const f = cancelledContinuationFixture(Date.now()), saved = { id: COMMUNICATIONS_SAVED_AGENT_ID,
      ...structuredClone(COMMUNICATIONS_SAVED_CONFIGURATION), tools: [structuredClone(ownerGmailTool)] };
    const mcp = verifiedCommunicationsCurrentSavedAgent(saved).gmailMcp!;
    Object.assign(f.child, { gmailMcp: mcp, historyConfigurationDigest: mcp.configurationDigest, initialTurnId: "cancelled-turn" });
    f.authority.binding.originalCheckpointDigest = communicationsDigest(f.checkpoint);
    f.authority.scope.existingMcpDigest = communicationsDigest(mcp);
    f.authority.scope.existingHistoryBindingDigest = communicationsDigest(await getCompanyHistoryAccess({ kind: "outbound_outreach" }));
    const raw = Buffer.from(JSON.stringify(f.authority)), ref = { ...f.ref, sha256: outputTextDigest(raw.toString()) };
    let posted = false, event: any, latest: any, failRead = false, historyAnswered = false;
    const usage = { input_tokens: 100, output_tokens: 10, total_tokens: 110 };
    const fetch = vi.fn(async (url: any, init: RequestInit = {}) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/events")) {
        if (init.method === "POST") {
          const submitted = JSON.parse(String(init.body)).events[0];
          if (submitted.type === "agent.session.input.tool_result") {
            historyAnswered = true;
            if (options.historyAckAtDeadline) vi.setSystemTime(Date.parse(latest.intent.window.deadlineAt));
            throw new Error("synthetic history ACK loss");
          }
          expect(latest.state).toBe("input_unresolved");
          event = submitted; posted = true;
          if (options.unknownAck) throw new Error("synthetic lost ACK");
        }
        return new Response("");
      }
      if (failRead) throw new CommunicationsRuntimeError("communications_lease_lost");
      if (path.endsWith("/cancelled-session")) return Response.json({ id: "cancelled-session", status: options.historyAckUnknown && posted && !historyAnswered ? "requires_action" : "idle",
        required_actions: options.historyAckUnknown && posted && !historyAnswered ? [{ type: "function_call", call_id: "continuation-history",
          turn_id: "continued-turn", name: "search_company_history", arguments: { query: "prior contact" } }] : [],
        agent: { id: COMMUNICATIONS_SAVED_AGENT_ID, ...mcp.configuration }, vault_ids: [], environment: { type: "none" }, metadata: {
          role: "communications", blueprint_communications_job: f.job.jobId, blueprint_communications_request_digest: f.child.requestDigest,
          blueprint_communications_saved_agent: COMMUNICATIONS_SAVED_AGENT_ID,
          blueprint_communications_configuration_digest: mcp.savedConfigurationDigest,
          blueprint_communications_history_profile: "agent-history-v1", blueprint_communications_history_configuration_digest: mcp.configurationDigest,
          blueprint_communications_mcp_profile: mcp.profile, blueprint_communications_final_repair_profile: "same-session-final-v1" } });
      if (path.endsWith("/turns")) return Response.json({ data: [{ id: "cancelled-turn", agent_id: COMMUNICATIONS_SAVED_AGENT_ID,
        status: "cancelled", usage }, ...(posted ? [{ id: "continued-turn", agent_id: COMMUNICATIONS_SAVED_AGENT_ID,
          status: options.historyAckUnknown && !historyAnswered ? "waiting" : "completed",
          ...(options.usageUnknown ? {} : { usage }) }] : []), ...(posted && options.tamper === "extra_turn"
          ? [{ id: "unbound-turn", agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: "completed", usage }] : [])], has_more: false });
      if (path.endsWith("/items")) return Response.json({ data: posted ? [
        { id: "owner-input", turn_id: "continued-turn", type: "message", role: "user", content: options.tamper === "message"
          ? [{ type: "input_text", text: "different owner text" }] : event.input[0].content },
        { id: "continued-final", turn_id: "continued-turn", type: "message", role: "assistant", phase: "final_answer", status: "completed",
          content: [{ type: "output_text", text: JSON.stringify(f.output) }] }] : [], has_more: false });
      throw new Error("unexpected synthetic provider path");
    });
    const load = vi.fn(async () => ({ bytes: raw, generation: ref.generation })), record = vi.fn(async () => undefined), reserve = vi.fn();
    const api = new CommunicationsAgentsAPI({ apiKey: "synthetic-never-real", allowPaidInference: true, fetch: fetch as any,
      loadContinuationAuthority: load, recordPaidDraftUsage: record, reservePaidDraft: reserve });
    const phase = await api.prepareCancelledContinuation({ ...f.job, checkpoint: f.checkpoint }, ref);
    latest = structuredClone(phase);
    const persist = async (value: any) => { latest = structuredClone(value); };
    const params = () => ({ jobId: f.job.jobId, phase: structuredClone(latest), savePhase: persist, assertWorkAllowed: async () => undefined });
    return { ...f, api, phase, ref, raw, load, fetch, record, reserve, params, latest: () => latest,
      failRead: () => { failRead = true; }, restoreRead: () => { failRead = false; } };
  }
  it("binds one new root and cumulative terminal usage without adding a window to original provider metadata", async () => {
    const f = await cancelled(), original = structuredClone(f.checkpoint);
    const result = await f.api.continueCancelled(f.params());
    expect(result.output).toEqual(f.output); expect(result.usage).toMatchObject({ input_tokens: 200, output_tokens: 20, total_tokens: 220 });
    expect(f.checkpoint).toEqual(original); expect(f.latest().checkpoint.ownerContinuation).toBeUndefined();
    expect(f.latest()).toMatchObject({ state: "submitted", turnId: "continued-turn", checkpoint: { finalRepairSettled: true } });
    const posts = f.fetch.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1); expect(String(posts[0][0])).toContain("/cancelled-session/events");
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.record).toHaveBeenLastCalledWith(f.job.jobId, f.child.requestDigest,
      { input_tokens: 200, output_tokens: 20, total_tokens: 220 });
    expect((result.outputSource as any).ownerContinuation.intentDigest).toBe(f.phase.intentDigest);
  });
  it("GET-reconciles an accepted unknown ACK, never repeating the claimed user input", async () => {
    const f = await cancelled({ unknownAck: true });
    await f.api.continueCancelled(f.params());
    expect(f.latest().state).toBe("input_unresolved");
    await f.api.continueCancelled(f.params());
    expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(f.latest().turnId).toBe("continued-turn");
  });
  it("observes a history-result unknown ACK before settling, keeping the root pending and original checkpoint intact", async () => {
    const f = await cancelled({ historyAckUnknown: true }), running = f.api.continueCancelled(f.params());
    await vi.advanceTimersByTimeAsync(1000);
    const result = await running;
    expect(result.output).toEqual(f.output);
    expect(f.latest().checkpoint.historyToolReceipts).toMatchObject([{ callId: "continuation-history", delivery: "ack_unknown" }]);
    expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2); // One owner input + one exact tool result.
    expect(f.latest().checkpoint.finalRepairSettled).toBe(true);
  });
  it("keeps an unknown history ACK at deadline pending and usage null for the owned watchdog/GET recovery", async () => {
    const f = await cancelled({ historyAckUnknown: true, historyAckAtDeadline: true });
    await expect(f.api.continueCancelled(f.params())).rejects.toThrow("communications_execution_deadline");
    expect(f.latest().checkpoint.finalRepairSettled).toBe(false);
    expect(f.record).toHaveBeenLastCalledWith(f.job.jobId, f.child.requestDigest, null);
    expect(f.latest().checkpoint.historyToolReceipts).toMatchObject([{ delivery: "ack_unknown" }]);
    expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
  });
  it.each(["message", "extra_turn"] as const)("refuses %s rather than binding unrelated paid work", async tamper => {
    const f = await cancelled({ tamper });
    await expect(f.api.continueCancelled(f.params())).rejects.toThrow(tamper === "message" ? "message_proof_mismatch" : "root_turn_ambiguous");
    expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(f.latest().checkpoint.finalRepairSettled).toBe(false);
  });
  it("retains missing terminal usage as unknown, never the original baseline alone", async () => {
    const f = await cancelled({ usageUnknown: true }), result = await f.api.continueCancelled(f.params());
    expect(result.usage).toBeNull(); expect(f.record).toHaveBeenLastCalledWith(f.job.jobId, f.child.requestDigest, null);
  });
  it.each(["raw_hash", "generation", "expired", "scope", "checkpoint", "window"])("refuses changed %s before POST", async kind => {
    const f = await cancelled(), p = f.params();
    if (kind === "raw_hash") f.load.mockResolvedValue({ bytes: Buffer.from("{}"), generation: "1" });
    if (kind === "generation") f.load.mockResolvedValue({ bytes: f.raw, generation: "2" });
    if (kind === "expired") vi.setSystemTime(Date.parse(f.authority.expiresAt));
    if (kind === "scope") p.phase.intent.authority.scope.sendsAuthorized = true;
    if (kind === "checkpoint") p.phase.checkpoint.requestDigest = "9".repeat(64);
    if (kind === "window") p.phase.intent.window.timeoutSeconds = 3600;
    await expect(f.api.continueCancelled(p)).rejects.toThrow();
    expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });
  it("records a known pre-POST lease refusal as not submitted, with no paid work", async () => {
    const f = await cancelled(), p = f.params(); let checks = 0;
    p.assertWorkAllowed = async () => { if (++checks === 2) throw new CommunicationsRuntimeError("communications_lease_lost"); };
    await expect(f.api.continueCancelled(p)).rejects.toThrow("lease_lost");
    expect(f.latest().state).toBe("not_submitted"); expect(f.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });
});

describe("prospective communications Gmail and Notion read binding", () => {
  const saved = () => ({ id: COMMUNICATIONS_SAVED_AGENT_ID, ...structuredClone(COMMUNICATIONS_SAVED_CONFIGURATION),
    tools: [structuredClone(ownerGmailTool), structuredClone(ownerNotionTool)] });
  it("admits the exact safe owner connection metadata with only three prefixed Notion read capabilities", () => {
    const original = saved(), checked = verifiedCommunicationsCurrentSavedAgent(original), binding = checked.gmailMcp!;
    expect(binding.profile).toBe(COMMUNICATIONS_GMAIL_NOTION_READ_PROFILE);
    expect(binding.configuration.instructions).toBe(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION.instructions);
    expect(communicationsMcpDefinition(binding).version).toBe("blueprint.communications-definition.v7");
    expect(binding.savedConfigurationDigest).toBe(communicationsDigest({ ...COMMUNICATIONS_SAVED_CONFIGURATION, tools: original.tools }));
    expect(binding.configuration.tools.filter(tool => tool.type === "mcp")).toMatchObject([
      { server_label: "gmail", credential_id: ownerGmailTool.credential_id, allowed_tools: COMMUNICATIONS_GMAIL_READ_TOOLS },
      { server_label: "notion", credential_id: ownerNotionTool.credential_id, allowed_tools: COMMUNICATIONS_NOTION_READ_TOOLS },
    ]);
    expect(original.tools.every(tool => tool.allowed_tools === null)).toBe(true);
    expect(verifiedCommunicationsCurrentMcpBinding(binding)).toEqual(binding);
    const agent = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...binding.configuration };
    expect(verifiedCommunicationsCurrentMcpAgent(agent, binding)).toEqual(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION);
  });
  it("keeps the charged Gmail v6 profile byte-identical and callable after new Notion is attached", () => {
    const old = verifiedCommunicationsCurrentSavedAgent({ ...saved(), tools: [structuredClone(ownerGmailTool)] }).gmailMcp!;
    expect(old.profile).toBe(COMMUNICATIONS_GMAIL_READ_PROFILE);
    if (old.profile !== COMMUNICATIONS_GMAIL_READ_PROFILE) throw Error("fixture profile");
    const digest = communicationsDigest(old);
    verifiedCommunicationsCurrentSavedAgent(saved());
    expect(verifiedCommunicationsGmailBinding(old)).toEqual(old);
    expect(verifiedCommunicationsGmailAgent({ ...old.configuration }, old)).toEqual(COMMUNICATIONS_GMAIL_READ_DEFINITION);
    expect(communicationsDigest(old)).toBe(digest);
    expect(communicationsMcpDefinition(old)).toEqual(COMMUNICATIONS_GMAIL_READ_DEFINITION);
    expect(communicationsMcpCallAllowed(old, "notion", "fetch")).toBe(false);
  });
  it.each(["notion-get-tool-access", "notion-search", "notion-fetch", "search", "fetch"])("accepts only documented read capability or alias %s", name => {
    const binding = verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!;
    expect(communicationsMcpCallAllowed(binding, "notion", name)).toBe(true);
    expect(communicationsMcpCallAllowed(binding, "gmail", name)).toBe(false);
  });
  it.each(["notion-create-pages", "notion-update-page", "notion-move-pages", "notion-create-comment", "notion-ai-search", "ai-search", "get-tool-access", "query_data_sources", "send_email"])("does not infer an additional capability from %s", name => {
    expect(communicationsMcpCallAllowed(verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!, "notion", name)).toBe(false);
  });
  it.each(["label", "url", "auth", "metadata", "origin", "tool", "duplicate", "credential"])("rejects altered %s without substituting a connection", field => {
    const value: any = saved();
    if (field === "label") value.tools[1].server_label = "other";
    if (field === "url") value.tools[1].transport.server_url = "https://mcp.notion.com/mcp?token=private";
    if (field === "auth") value.tools[1].transport.headers.Authorization = "synthetic-never-token";
    if (field === "metadata") value.tools[1].request_metadata.access = "broader";
    if (field === "origin") value.tools[1].connection_origin = "sandbox";
    if (field === "tool") value.tools[1].allowed_tools = ["notion-create-pages"];
    if (field === "duplicate") value.tools[1] = value.tools[0];
    if (field === "credential") value.tools[1].credential_id = value.tools[0].credential_id;
    expect(() => verifiedCommunicationsCurrentSavedAgent(value)).toThrow();
  });
  it("accepts documented aliases and harmless tool order while preserving the original saved binding", () => {
    const binding = verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!;
    const agent: any = structuredClone(binding.configuration);
    agent.tools = [...agent.tools.filter((tool: any) => tool.type === "function"), ...agent.tools.filter((tool: any) => tool.type === "mcp").reverse()];
    agent.tools.find((tool: any) => tool.server_label === "notion").allowed_tools = ["fetch", "notion-get-tool-access", "search"];
    expect(verifiedCommunicationsCurrentMcpAgent(agent, binding)).toEqual(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION);
    expect((binding.configuration.tools.find(tool => tool.type === "mcp" && tool.server_label === "notion") as any)?.allowed_tools).toEqual(COMMUNICATIONS_NOTION_READ_TOOLS);
  });
  it("does not accept a changed credential, added write or modified frozen new profile", () => {
    const binding = verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!;
    const changed: any = structuredClone(binding); changed.configuration.tools.at(-1).allowed_tools.push("notion-update-page");
    expect(() => verifiedCommunicationsCurrentMcpBinding(changed)).toThrow("binding_changed");
    const agent: any = structuredClone(binding.configuration); agent.tools.at(-1).credential_id = "credential_different_owner";
    expect(() => verifiedCommunicationsCurrentMcpAgent(agent, binding)).toThrow("agent_changed");
  });
  it("resolves complete paginated catalogs and attaches only the credential-owning vaults without retaining auth metadata", async () => {
    const base = verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!;
    const read = vi.fn(async (path: string) => {
      if (path === "/vaults?order=asc&limit=100") return { data: [{ id: "vault_gmail", object: "vault" }], has_more: true, last_id: "vault_gmail" };
      if (path === "/vaults?order=asc&limit=100&after=vault_gmail") return { data: [{ id: "vault_notion", object: "vault" }, { id: "vault_unrelated", object: "vault" }], has_more: false };
      if (path === "/vaults/vault_gmail/credentials?order=asc&limit=100") return { data: [{ id: ownerGmailTool.credential_id, vault_id: "vault_gmail", object: "vault.credential", auth: { secretNeverStored: "synthetic" } }], has_more: false };
      if (path === "/vaults/vault_unrelated/credentials?order=asc&limit=100") return { data: [{ id: "credential_earlier", vault_id: "vault_unrelated", object: "vault.credential" }], has_more: true, last_id: "credential_earlier" };
      if (path === "/vaults/vault_unrelated/credentials?order=asc&limit=100&after=credential_earlier") return { data: [{ id: "credential_other", vault_id: "vault_unrelated", object: "vault.credential" }], has_more: false };
      if (path === "/vaults/vault_notion/credentials?order=asc&limit=100") return { data: [{ id: ownerNotionTool.credential_id, vault_id: "vault_notion", object: "vault.credential" }], has_more: false };
      return { data: [], has_more: false };
    });
    const resolved = await resolveCommunicationsMcpVaultBinding(base, read);
    expect(resolved.profile).toBe(COMMUNICATIONS_MCP_VAULT_READ_PROFILE);
    expect(resolved.baseBinding).toEqual(base); expect(resolved.baseBindingDigest).toBe(communicationsDigest(base));
    expect(communicationsMcpVaultIds(base)).toEqual([]); expect(communicationsMcpVaultIds(resolved)).toEqual(["vault_gmail", "vault_notion"]);
    expect(JSON.stringify(resolved)).not.toContain("secretNeverStored"); expect(JSON.stringify(resolved)).not.toContain("vault_unrelated");
    expect(communicationsMcpDefinition(resolved)).toEqual(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION);
    expect(verifiedCommunicationsCurrentMcpAgent(resolved.configuration, resolved)).toEqual(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION);
    expect(communicationsMcpCallAllowed(resolved, "notion", "fetch")).toBe(true);
    const retained = vi.fn(); expect(await resolveCommunicationsMcpVaultBinding(resolved, retained)).toEqual(resolved); expect(retained).not.toHaveBeenCalled();
    const tampered = structuredClone(resolved); tampered.vaultIds.push("vault_unrelated");
    expect(() => verifiedCommunicationsCurrentMcpBinding(tampered)).toThrow("vault_binding_changed");
    tampered.vaultIds = resolved.vaultIds; tampered.credentialVaultMappings[0].vaultId = "vault_wrong";
    expect(() => verifiedCommunicationsCurrentMcpBinding(tampered)).toThrow("vault_binding_changed");
  });
  it.each(["missing", "ambiguous", "parent", "object", "cursor"])("refuses %s vault proof instead of attaching arbitrary IDs", async failure => {
    const base = verifiedCommunicationsCurrentSavedAgent(saved()).gmailMcp!;
    const read = vi.fn(async (path: string) => {
      if (path.startsWith("/vaults?")) return { data: [{ id: "vault_one", object: "vault" }, { id: "vault_two", object: "vault" }], has_more: false };
      const vaultId = path.includes("vault_one") ? "vault_one" : "vault_two";
      const credentialId = vaultId === "vault_one" ? ownerGmailTool.credential_id : failure === "ambiguous" ? ownerGmailTool.credential_id : ownerNotionTool.credential_id;
      return { data: failure === "missing" ? [] : [{ id: credentialId, object: failure === "object" ? "other" : "vault.credential", vault_id: failure === "parent" ? "vault_wrong" : vaultId }],
        has_more: failure === "cursor", last_id: failure === "cursor" ? "not_the_last_id" : undefined };
    });
    await expect(resolveCommunicationsMcpVaultBinding(base, read)).rejects.toThrow("communications_mcp_vault_");
  });
});

describe("prospective Firebase database metadata binding", () => {
  const saved = () => ({ id: COMMUNICATIONS_SAVED_AGENT_ID, ...structuredClone(COMMUNICATIONS_SAVED_CONFIGURATION),
    tools: [structuredClone(ownerNotionTool), structuredClone(ownerFirebaseTool), structuredClone(ownerGmailTool)] });
  it("preserves owner connection order and limits the new profile to database metadata", () => {
    const original = saved(), binding = verifiedCommunicationsCurrentSavedAgent(original).gmailMcp!;
    expect(binding.profile).toBe(COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_PROFILE);
    expect(binding.savedConfigurationDigest).toBe(communicationsDigest({ ...COMMUNICATIONS_SAVED_CONFIGURATION, tools: original.tools }));
    expect(binding.configuration.tools.filter(tool => tool.type === "mcp").map((tool: any) => tool.server_label)).toEqual(["notion", "firebase", "gmail"]);
    expect(binding.configuration.tools.find((tool: any) => tool.server_label === "firebase")).toMatchObject({ allowed_tools: COMMUNICATIONS_FIREBASE_READ_TOOLS });
    expect(communicationsMcpDefinition(binding)).toEqual(COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION);
    expect(communicationsMcpCallAllowed(binding, "firebase", "get_database")).toBe(true);
    const agent: any = structuredClone(binding.configuration);
    agent.tools = [...agent.tools.filter((tool: any) => tool.type === "function"), ...agent.tools.filter((tool: any) => tool.type === "mcp").reverse()];
    expect(verifiedCommunicationsCurrentMcpAgent(agent, binding)).toEqual(COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION);
    const old = verifiedCommunicationsCurrentSavedAgent({ ...saved(), tools: [ownerGmailTool, ownerNotionTool] }).gmailMcp!;
    const digest = communicationsDigest(old);
    verifiedCommunicationsCurrentSavedAgent(saved());
    expect(verifiedCommunicationsCurrentMcpBinding(old)).toEqual(old); expect(communicationsDigest(old)).toBe(digest);
    expect(communicationsMcpDefinition(old)).toEqual(COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION);
    expect(communicationsMcpCallAllowed(old, "firebase", "get_database")).toBe(false);
  });
  it.each(["get_document", "run_query", "list_documents", "list_collections", "create_document", "update_document", "delete_document", "list_databases"])("rejects %s instead of bypassing history scope", name => {
    const value = saved(), binding = verifiedCommunicationsCurrentSavedAgent(value).gmailMcp!;
    expect(communicationsMcpCallAllowed(binding, "firebase", name)).toBe(false);
    (value.tools[1] as any).allowed_tools = [name];
    expect(() => verifiedCommunicationsCurrentSavedAgent(value)).toThrow("firebase_read_configuration_invalid");
    const agent: any = structuredClone(binding.configuration); agent.tools.find((tool: any) => tool.server_label === "firebase").allowed_tools.push(name);
    expect(() => verifiedCommunicationsCurrentMcpAgent(agent, binding)).toThrow();
  });
  it.each(["endpoint", "label", "credential", "auth", "metadata", "origin"])("rejects changed Firebase %s", field => {
    const value: any = saved(), tool = value.tools[1];
    if (field === "endpoint") tool.transport.server_url = "https://firebase.google.com/mcp";
    if (field === "label") tool.server_label = "other";
    if (field === "credential") tool.credential_id = ownerGmailTool.credential_id;
    if (field === "auth") tool.transport.headers.Authorization = "synthetic";
    if (field === "metadata") tool.request_metadata.scope = "company-wide";
    if (field === "origin") tool.connection_origin = "sandbox";
    expect(() => verifiedCommunicationsCurrentSavedAgent(value)).toThrow();
  });
  it("creates and replaces an actual scoped session with the third singleton vault and original metadata receipt", async () => {
    const f = fixture({ gmail: true, notion: true, firebase: true, single: true, unknownAck: "pending" });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_result_ack_unknown" });
    const frozen = f.latest().gmailMcp!, reads = f.requests.filter(item => item.path.startsWith("/v1/vaults")).length;
    const create = JSON.parse(String(f.requests.find(item => item.path.endsWith("/agents/sessions"))!.init.body));
    expect(create.vault_ids).toEqual(["vault_firebase", "vault_gmail", "vault_notion"]);
    expect(create.metadata.blueprint_communications_mcp_binding_digest).toBe(communicationsDigest(frozen));
    expect(create.agent.tools.find((tool: any) => tool.server_label === "firebase").allowed_tools).toEqual(["get_database"]);
    f.savedAgent.tools.find((tool: any) => tool.server_label === "firebase").credential_id = "credential_changed_after_charge";
    const result = await f.api().run(f.params());
    expect(result.outputSource?.definitionVersion).toBe("blueprint.communications-definition.v8");
    expect(f.requests.filter(item => item.path.startsWith("/v1/vaults"))).toHaveLength(reads);
    expect(f.reserve).toHaveBeenCalledTimes(1);
    expect(result.checkpoint.gmailMcp).toEqual(frozen);
    expect(result.checkpoint.nativeMcpItems).toMatchObject([{ server_label: "firebase", name: "get_database", output: expect.stringContaining("FIRESTORE_NATIVE") }]);
    expect((result.outputSource as any).nativeMcpEvidence.callsDigest).toBe(communicationsDigest(result.checkpoint.nativeMcpItems));
  });
});

describe("actual communications Agents API history continuation", () => {
  it("freezes only matching singleton Gmail/Notion vaults and retains native fetch alias proof on replacement", async () => {
    const f = fixture({ gmail: true, notion: true, single: true, unknownAck: "pending" });
    await expect(f.api().run(f.params())).rejects.toMatchObject({ code: "agents_history_result_ack_unknown" });
    const frozen = f.latest().gmailMcp, vaultReads = f.requests.filter(item => item.path.startsWith("/v1/vaults")).length;
    const create = JSON.parse(String(f.requests.find(item => item.path.endsWith("/agents/sessions"))!.init.body));
    expect(create.vault_ids).toEqual(["vault_gmail", "vault_notion"]);
    expect(create.metadata.blueprint_communications_mcp_binding_digest).toBe(communicationsDigest(frozen));
    expect(create.agent.tools.find((tool: any) => tool.server_label === "notion").allowed_tools).toEqual(COMMUNICATIONS_NOTION_READ_TOOLS);
    f.savedAgent.tools[1].credential_id = "credential_owner_changed_later";
    const result = await f.api().run(f.params());
    expect(result.outputSource?.definitionVersion).toBe("blueprint.communications-definition.v7");
    expect(result.checkpoint.gmailMcp).toEqual(frozen);
    expect(result.checkpoint.nativeMcpItems).toMatchObject([{ server_label: "notion", name: "fetch", output: expect.stringContaining("unread-child") }]);
    expect(f.requests.filter(item => item.path.startsWith("/v1/vaults"))).toHaveLength(vaultReads);
    expect(f.reserve).toHaveBeenCalledTimes(1);
  });
  it.each(["missingVault", "ambiguousVault", "extraCredential"] as const)("refuses %s before reserving or creating paid work", async field => {
    const f = fixture({ gmail: true, notion: true, single: true, [field]: true });
    await expect(f.api().run(f.params())).rejects.toThrow("communications_mcp_vault_");
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.requests.every(item => item.init.method !== "POST")).toBe(true);
  });
  it("freezes the owner's safe Gmail connection before one create, with read-only MCP plus existing history tools", async () => {
    const f = fixture({ gmail: true, single: true }); const result = await f.api().run(f.params());
    const create = JSON.parse(String(f.requests.find(item => item.init.method === "POST" && item.path.endsWith("/agents/sessions"))!.init.body));
    expect(create.agent.tools.map((tool: any) => tool.type)).toEqual(["function", "function", "mcp"]);
    expect(create.agent.tools.at(-1)).toEqual({ ...ownerGmailTool,
      transport: { type: "http", server_url: ownerGmailTool.transport.server_url }, allowed_tools: COMMUNICATIONS_GMAIL_READ_TOOLS });
    expect(f.savedAgent.tools).toEqual([ownerGmailTool]);
    expect(result.checkpoint.gmailMcp).toMatchObject({ profile: COMMUNICATIONS_MCP_VAULT_READ_PROFILE, baseBinding: { profile: COMMUNICATIONS_GMAIL_READ_PROFILE, savedTool: ownerGmailTool },
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
