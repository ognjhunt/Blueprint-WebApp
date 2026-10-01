// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CommunicationsAgentsAPI, COMMUNICATIONS_INSTRUCTIONS } from "../agents/communications-api";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT } from "../agents/communications-contract";
import { communicationsFixture } from "./fixtures/communications";

function apiFixture(options: { reconnect?: boolean; idle?: boolean; model?: string; noFinal?: boolean; http?: number; failed?: boolean; itemsPage?: boolean; missingMetadata?: boolean } = {}) {
  const { output } = communicationsFixture();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const checkpoints: any[] = [];
  let requestDigest = "a".repeat(64);
  const stream = [{ type: "agent.session.created", session: { id: "session-1" } },
    { type: "agent.session.turn.created", turn_id: "turn-1", turn: { id: "turn-1", subagent_id: null } },
    { type: options.failed ? "agent.session.turn.failed" : "agent.session.turn.completed", turn_id: "turn-1" }];
  const fetchMock = vi.fn(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    calls.push({ path, init });
    if (options.http) return new Response("PRIVATE MUST NOT LEAK", { status: options.http });
    if (path.includes("/models/")) return Response.json({ id: options.model ?? COMMUNICATIONS_MODEL });
    if (path.endsWith("/agents/sessions") || path.endsWith("/events")) {
      if (init.method === "POST" && path.endsWith("/agents/sessions")) requestDigest = JSON.parse(String(init.body)).metadata.blueprint_communications_request_digest;
      return new Response(stream.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    }
    if (path.endsWith("/session-1")) return Response.json({ id: "session-1", status: "idle", agent: { id: "agent-1", model: options.model ?? COMMUNICATIONS_MODEL,
      instructions: COMMUNICATIONS_INSTRUCTIONS, service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: [],
      metadata: options.missingMetadata ? {} : { blueprint_communications_job: "job-1", role: "communications", blueprint_communications_request_digest: requestDigest } });
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", agent_id: "agent-1", status: options.idle ? "running" : "completed", usage: { input_tokens: 3 } }], has_more: false });
    if (path.includes("/items?")) {
      if (options.itemsPage && !path.includes("after=")) return Response.json({ data: [{ id: "item-0", type: "message", role: "assistant", phase: "commentary", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: "UNTRUSTED DELTA" }] }], has_more: true, last_id: "item-0" });
      return Response.json({ data: options.noFinal ? [] : [{ id: "final-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: JSON.stringify(output) }] }], has_more: false });
    }
    throw new Error("unexpected mock path");
  });
  const reservePaidDraft = vi.fn(async () => undefined), recordPaidDraftUsage = vi.fn(async () => undefined);
  const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any, reservePaidDraft, recordPaidDraftUsage });
  const params = { input: "synthetic context", jobId: "job-1", checkpoint: options.reconnect ? { createClaimedAt: "2026-09-30T23:00:00Z", sessionId: "session-1", turnId: "turn-1" } : { createClaimedAt: null, sessionId: null, turnId: null }, saveCheckpoint: async (value: any) => { checkpoints.push(value); } };
  return { api, params, calls, fetchMock, checkpoints, output, reservePaidDraft, recordPaidDraftUsage };
}

describe("portable communications Agents API", () => {
  it("uses exact Luna/Default project, Blueprint infrastructure, no tool or research role", async () => {
    const f = apiFixture();
    expect((await f.api.run(f.params)).output).toEqual(f.output);
    const create = f.calls.find(call => call.init.method === "POST")!;
    const body = JSON.parse(String(create.init.body));
    expect(body).toMatchObject({ agent: { model: "gpt-6-luna", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, stream: true });
    expect(create.init.headers).toMatchObject({ "OpenAI-Project": COMMUNICATIONS_PROJECT });
    expect(f.checkpoints[0]).toMatchObject({ createClaimedAt: expect.any(String), sessionId: null });
    expect(f.checkpoints.at(-1)).toMatchObject({ sessionId: "session-1", turnId: "turn-1" });
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1); expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1);
    expect(body.agent.service_tier).toBe("default");
    expect(body.metadata.blueprint_communications_request_digest).toBe(f.checkpoints[0].requestDigest);
    expect(body.metadata.blueprint_communications_request_digest).toMatch(/^[a-f0-9]{64}$/);
  });
  it("requires a durable admission and refuses a failed reservation before paid POST", async () => {
    const f = apiFixture(); const unguarded = new CommunicationsAgentsAPI({ apiKey: "mock", allowPaidInference: true, fetch: f.fetchMock as any });
    await expect(unguarded.run(f.params)).rejects.toMatchObject({ code: "communications_paid_draft_admission_required" });
    expect(f.calls).toHaveLength(0);
    f.reservePaidDraft.mockRejectedValueOnce(new Error("soft budget unavailable"));
    await expect(f.api.run(f.params)).rejects.toThrow("soft budget unavailable"); expect(f.calls.some(call => call.init.method === "POST")).toBe(false);
  });
  it("observes saved sessions and paginated final items without repeating paid create", async () => {
    const f = apiFixture({ reconnect: true, itemsPage: true });
    expect((await f.api.run(f.params)).output).toEqual(f.output);
    expect(f.calls[0].path).toBe("/v1/agents/sessions/session-1/events");
    expect(f.calls.some(call => call.init.method === "POST")).toBe(false);
    expect(f.calls.some(call => call.path.includes("after=item-0"))).toBe(true);
  });
  it("reconciles expired saved turns with GETs even when new inference is disabled", async () => {
    const f = apiFixture({ reconnect: true });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: f.fetchMock as any });
    expect((await api.reconcileSaved(f.params.checkpoint, "job-1"))?.output).toEqual(f.output);
    expect(f.calls.some(call => call.init.method === "POST" || call.path.endsWith("/events"))).toBe(false);
    expect(f.calls[0].path).toBe("/v1/agents/sessions/session-1");
  });
  it("never interprets idle or streamed deltas as completion", async () => {
    const f = apiFixture({ idle: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_turn_pending", retryable: true });
  });
  it("fails on missing canonical final answer", async () => {
    const f = apiFixture({ noFinal: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_final_answer_missing_or_ambiguous" });
  });
  it("reads bound terminal usage even when the draft has no usable final answer, without creating input", async () => {
    const f = apiFixture({ reconnect: true, noFinal: true });
    expect(await f.api.reconcileUsage(f.params.checkpoint, "job-1")).toEqual({ input_tokens: 3 });
    expect(f.calls.some(call => call.init.method === "POST" || call.path.includes("/items"))).toBe(false);
  });
  it("fails closed on failed terminal event even if saved state claims completion", async () => {
    const f = apiFixture({ failed: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_turn_failed_or_cancelled" });
  });
  it("does not fall back when Luna is absent", async () => {
    const f = apiFixture({ model: "gpt-6-sol" });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "requested_luna_model_unavailable" });
    expect(f.calls.some(call => call.init.method === "POST")).toBe(false);
  });
  it("checks the saved session's exact job binding", async () => {
    const f = apiFixture({ reconnect: true, missingMetadata: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_session_job_binding_mismatch" });
  });
  it("blocks paid inference by default while allowing read-only model discovery", async () => {
    const f = apiFixture(); const api = new CommunicationsAgentsAPI({ apiKey: "mock", allowPaidInference: false, fetch: f.fetchMock as any });
    await expect(api.run(f.params)).rejects.toMatchObject({ code: "communications_inference_disabled" });
    expect(f.calls).toHaveLength(0); expect(await api.preflight()).toMatchObject({ model: "gpt-6-luna" });
  });
  it("requires an existing binding without revealing provider error bodies", async () => {
    const f = apiFixture({ http: 403 });
    await expect(f.api.preflight()).rejects.toThrow("agents_api_http_403");
    const missing = new CommunicationsAgentsAPI({ allowPaidInference: false, fetch: f.fetchMock as any });
    await expect(missing.preflight()).rejects.toMatchObject({ code: "existing_openai_binding_missing" });
  });
  it("never repeats an ambiguous session create", async () => {
    const f = apiFixture(); f.params.checkpoint.createClaimedAt = "2026-09-30T23:00:00Z" as any;
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(f.calls).toHaveLength(0);
  });
  it.each(["timeout", "lost_first_event"])("retains the one-use create claim after %s without repeating POST", async kind => {
    const f = apiFixture();
    const fetchMock = vi.fn(async (url: any) => {
      if (String(url).includes("/models/")) return Response.json({ id: COMMUNICATIONS_MODEL });
      if (kind === "timeout") throw new Error("synthetic connection timeout");
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error("synthetic stream loss")); } }));
    });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any,
      reservePaidDraft: f.reservePaidDraft, recordPaidDraftUsage: f.recordPaidDraftUsage });
    await expect(api.run(f.params)).rejects.toMatchObject({ code: kind === "timeout" ? "agents_api_connection_unknown" : "session_create_requires_reconciliation", retryable: false });
    expect(f.checkpoints[0]).toMatchObject({ createClaimedAt: expect.any(String), requestDigest: expect.stringMatching(/^[a-f0-9]{64}$/), sessionId: null });
    await expect(api.run({ ...f.params, checkpoint: f.checkpoints[0] })).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
    expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
  });
  it("GET-verifies an existing exact session/root turn while paid inference is disabled", async () => {
    const f = apiFixture({ reconnect: true });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: f.fetchMock as any });
    expect(await api.verifyExistingDraftSession(f.params.checkpoint, "job-1", "a".repeat(64))).toEqual({
      sessionId: "session-1", requestDigest: "a".repeat(64), turnId: "turn-1", usage: { input_tokens: 3 },
    });
    expect(f.calls).toHaveLength(2); expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it.each(["job", "digest", "legacy_missing_digest", "model", "session", "tools", "tier", "instructions", "environment", "vault", "root", "pagination", "turn", "agent", "missing_agent", "oversize_session", "oversize_turns"])("rejects unverified existing-session recovery: %s", async kind => {
    const session: any = { id: "session-1", agent: { id: "agent-1", model: COMMUNICATIONS_MODEL, instructions: COMMUNICATIONS_INSTRUCTIONS,
      service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: [],
      metadata: { blueprint_communications_job: "job-1", role: "communications", blueprint_communications_request_digest: "a".repeat(64) } };
    const turns: any = { data: [{ id: "turn-1", agent_id: "agent-1", subagent_id: null, status: "completed", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }], has_more: false };
    if (kind === "job") session.metadata.blueprint_communications_job = "wrong-job";
    if (kind === "digest") session.metadata.blueprint_communications_request_digest = "b".repeat(64);
    if (kind === "legacy_missing_digest") delete session.metadata.blueprint_communications_request_digest;
    if (kind === "model") session.agent.model = "wrong-model";
    if (kind === "session") session.id = "wrong-session";
    if (kind === "tools") session.agent.tools = [{ type: "function" }];
    if (kind === "tier") session.agent.service_tier = "priority";
    if (kind === "instructions") session.agent.instructions = "Changed";
    if (kind === "environment") session.environment.type = "container";
    if (kind === "vault") session.vault_ids = ["synthetic-vault"];
    if (kind === "root") turns.data.push({ id: "other-turn" });
    if (kind === "pagination") turns.has_more = true;
    if (kind === "turn") turns.data[0].id = "other-turn";
    if (kind === "agent") turns.data[0].agent_id = "other-agent";
    if (kind === "missing_agent") delete turns.data[0].agent_id;
    if (kind === "oversize_session") session.metadata.synthetic_padding = "x".repeat(256001);
    if (kind === "oversize_turns") turns.data[0].synthetic_padding = "x".repeat(256001);
    const mock = vi.fn(async (url: any, init: any) => { expect(init.method).not.toBe("POST");
      return Response.json(String(url).includes("/turns?") ? turns : session); });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: mock as any });
    await expect(api.verifyExistingDraftSession({ createClaimedAt: "2026-09-30T23:00:00Z", sessionId: "session-1", turnId: "turn-1" }, "job-1", "a".repeat(64))).rejects.toThrow();
    expect(mock.mock.calls.length).toBeLessThanOrEqual(2);
  });
  it("does not resolve usage from a nonterminal saved root", async () => {
    const f = apiFixture({ reconnect: true, idle: true });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: f.fetchMock as any });
    expect((await api.verifyExistingDraftSession(f.params.checkpoint, "job-1", "a".repeat(64))).usage).toBeNull();
    expect(f.calls).toHaveLength(2); expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it("refuses oversized context and a failed durable create claim before POST", async () => {
    const f = apiFixture(); f.params.input = "a".repeat(64001);
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "communications_input_limit_exceeded" });
    f.params.input = "synthetic"; f.params.saveCheckpoint = async () => { throw new Error("durability unavailable"); };
    await expect(f.api.run(f.params)).rejects.toThrow("durability unavailable");
    expect(f.calls.some(call => call.init.method === "POST")).toBe(false);
  });
  it("requests cancel without deleting artifacts", async () => {
    const f = apiFixture();
    expect(await f.api.cancel({ sessionId: "session-1", turnId: "turn-1", createClaimedAt: "2026-09-30T23:00:00Z" })).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].path).toBe("/v1/agents/sessions/session-1/events");
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ events: [{ type: "agent.session.input.cancel" }] });
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
  });
});
