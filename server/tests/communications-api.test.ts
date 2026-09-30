// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT } from "../agents/communications-contract";
import { communicationsFixture } from "./fixtures/communications";

function apiFixture(options: { reconnect?: boolean; idle?: boolean; model?: string; noFinal?: boolean; http?: number; failed?: boolean; itemsPage?: boolean; missingMetadata?: boolean } = {}) {
  const { output } = communicationsFixture();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const checkpoints: any[] = [];
  const stream = [{ type: "agent.session.created", session: { id: "session-1" } },
    { type: "agent.session.turn.created", turn_id: "turn-1", turn: { id: "turn-1", subagent_id: null } },
    { type: options.failed ? "agent.session.turn.failed" : "agent.session.turn.completed", turn_id: "turn-1" }];
  const fetchMock = vi.fn(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    calls.push({ path, init });
    if (options.http) return new Response("PRIVATE MUST NOT LEAK", { status: options.http });
    if (path.includes("/models/")) return Response.json({ id: options.model ?? COMMUNICATIONS_MODEL });
    if (path.endsWith("/agents/sessions") || path.endsWith("/events")) return new Response(stream.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    if (path.endsWith("/session-1")) return Response.json({ status: "idle", agent: { model: options.model ?? COMMUNICATIONS_MODEL }, metadata: options.missingMetadata ? {} : { blueprint_communications_job: "job-1", role: "communications" } });
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", status: options.idle ? "running" : "completed", usage: { input_tokens: 3 } }], has_more: false });
    if (path.includes("/items?")) {
      if (options.itemsPage && !path.includes("after=")) return Response.json({ data: [{ id: "item-0", type: "message", role: "assistant", phase: "commentary", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: "UNTRUSTED DELTA" }] }], has_more: true, last_id: "item-0" });
      return Response.json({ data: options.noFinal ? [] : [{ id: "final-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: JSON.stringify(output) }] }], has_more: false });
    }
    throw new Error("unexpected mock path");
  });
  const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any });
  const params = { input: "synthetic context", jobId: "job-1", checkpoint: options.reconnect ? { createClaimedAt: "2026-09-30T23:00:00Z", sessionId: "session-1", turnId: "turn-1" } : { createClaimedAt: null, sessionId: null, turnId: null }, saveCheckpoint: async (value: any) => { checkpoints.push(value); } };
  return { api, params, calls, fetchMock, checkpoints, output };
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
  });
  it("observes saved sessions and paginated final items without repeating paid create", async () => {
    const f = apiFixture({ reconnect: true, itemsPage: true });
    expect((await f.api.run(f.params)).output).toEqual(f.output);
    expect(f.calls[0].path).toBe("/v1/agents/sessions/session-1/events");
    expect(f.calls.some(call => call.init.method === "POST")).toBe(false);
    expect(f.calls.some(call => call.path.includes("after=item-0"))).toBe(true);
  });
  it("never interprets idle or streamed deltas as completion", async () => {
    const f = apiFixture({ idle: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_turn_pending", retryable: true });
  });
  it("fails on missing canonical final answer", async () => {
    const f = apiFixture({ noFinal: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_final_answer_missing_or_ambiguous" });
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
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ events: [{ type: "agent.session.input.cancel" }] });
  });
});
