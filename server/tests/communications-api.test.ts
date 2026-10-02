// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CommunicationsAgentsAPI, COMMUNICATIONS_INSTRUCTIONS } from "../agents/communications-api";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, communicationsDigest } from "../agents/communications-contract";
import { communicationsFixture } from "./fixtures/communications";
import { LEGACY_COMMUNICATIONS_INSTRUCTIONS, LEGACY_COMMUNICATIONS_DEFINITION, COMMUNICATIONS_DEFINITION, COMMUNICATIONS_V2_INSTRUCTIONS, COMMUNICATIONS_V2_DEFINITION, COMMUNICATIONS_V3_INSTRUCTIONS, COMMUNICATIONS_V3_DEFINITION } from "../agents/communications-instructions";
import { COMMUNICATIONS_SAVED_AGENT_ID, COMMUNICATIONS_SAVED_CONFIGURATION,
  COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST, COMMUNICATIONS_HISTORY_CONFIGURATION, COMMUNICATIONS_HISTORY_PROFILE } from "../agents/communications-saved-agent";

function apiFixture(options: { reconnect?: boolean; idle?: boolean; model?: string; noFinal?: boolean; http?: number; failed?: boolean; itemsPage?: boolean; itemPages?: number; repeatedCursor?: boolean; pagePadding?: number; advancePageClock?: boolean; missingMetadata?: boolean; rawOutput?: string; instructions?: string; usage?: unknown; changedSaved?: string } = {}) {
  const { output } = communicationsFixture();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const checkpoints: any[] = [];
  let requestDigest = "a".repeat(64), pageNumber = 0;
  let savedBinding = false;
  let sessionAgent: any = null, sessionMetadata: any = null;
  const agentId = () => savedBinding ? COMMUNICATIONS_SAVED_AGENT_ID : "agent-1";
  const savedAgent = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...structuredClone(COMMUNICATIONS_SAVED_CONFIGURATION) };
  if (options.changedSaved === "instructions") savedAgent.instructions += " Changed";
  if (options.changedSaved === "reasoning") savedAgent.reasoning.effort = "medium";
  if (options.changedSaved === "tools") (savedAgent.tools as any[]).push({ type: "function" });
  if (options.changedSaved === "tier") savedAgent.service_tier = "default";
  const stream = [{ type: "agent.session.created", session: { id: "session-1" } },
    { type: "agent.session.turn.created", turn_id: "turn-1", turn: { id: "turn-1", subagent_id: null } },
    { type: options.failed ? "agent.session.turn.failed" : "agent.session.turn.completed", turn_id: "turn-1" }];
  const fetchMock = vi.fn(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    calls.push({ path, init });
    if (options.http) return new Response("PRIVATE MUST NOT LEAK", { status: options.http });
    if (path.includes("/models/")) return Response.json({ id: options.model ?? COMMUNICATIONS_MODEL });
    if (path.endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`)) return Response.json(savedAgent);
    if (path.endsWith("/agents/sessions") || path.endsWith("/events")) {
      if (init.method === "POST" && path.endsWith("/agents/sessions")) {
        const body = JSON.parse(String(init.body));
        requestDigest = body.metadata.blueprint_communications_request_digest;
        sessionAgent = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...body.agent }; sessionMetadata = body.metadata;
        savedBinding = true;
      }
      return new Response(stream.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    }
    if (path.endsWith("/session-1")) return Response.json({ id: "session-1", status: "idle", agent: savedBinding ? sessionAgent : { id: "agent-1", model: options.model ?? COMMUNICATIONS_MODEL,
      instructions: options.instructions ?? COMMUNICATIONS_INSTRUCTIONS, service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: [],
      metadata: options.missingMetadata ? {} : sessionMetadata ?? { blueprint_communications_job: "job-1", role: "communications", blueprint_communications_request_digest: requestDigest,
        ...(savedBinding ? { blueprint_communications_saved_agent: COMMUNICATIONS_SAVED_AGENT_ID,
          blueprint_communications_configuration_digest: COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST, COMMUNICATIONS_HISTORY_CONFIGURATION, COMMUNICATIONS_HISTORY_PROFILE } : {}) } });
    if (path.includes("/turns?")) return Response.json({ data: [{ id: "turn-1", agent_id: agentId(), status: options.idle ? "running" : "completed", usage: options.usage ?? { input_tokens: 3 } }], has_more: false });
    if (path.includes("/items?")) {
      pageNumber++;
      if (options.advancePageClock) vi.setSystemTime(Date.now() + 100001);
      if (options.itemPages && pageNumber < options.itemPages) return Response.json({ data: [{ id: `item-${pageNumber}`, type: "message", role: "assistant", phase: "commentary", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: "x".repeat(options.pagePadding ?? 1) }] }], has_more: true, last_id: options.repeatedCursor ? "same-cursor" : `item-${pageNumber}` });
      if (options.itemsPage && !path.includes("after=")) return Response.json({ data: [{ id: "item-0", type: "message", role: "assistant", phase: "commentary", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: "UNTRUSTED DELTA" }] }], has_more: true, last_id: "item-0" });
      return Response.json({ data: options.noFinal ? [] : [{ id: "final-1", type: "message", role: "assistant", phase: "final_answer", status: "completed", turn_id: "turn-1", content: [{ type: "output_text", text: options.rawOutput ?? JSON.stringify(output) }] }], has_more: false });
    }
    throw new Error("unexpected mock path");
  });
  const reservePaidDraft = vi.fn(async () => undefined), recordPaidDraftUsage = vi.fn(async () => undefined);
  const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any, reservePaidDraft, recordPaidDraftUsage });
  const params = { input: "synthetic context", jobId: "job-1", checkpoint: options.reconnect ? { createClaimedAt: "2026-09-30T23:00:00Z", sessionId: "session-1", turnId: "turn-1", requestDigest } : { createClaimedAt: null, sessionId: null, turnId: null }, saveCheckpoint: async (value: any) => { checkpoints.push(value); } };
  return { api, params, calls, fetchMock, checkpoints, output, reservePaidDraft, recordPaidDraftUsage, savedAgent };
}

describe("portable communications Agents API", () => {
  it("uses exact Luna/Default project and a new-session read-only history override", async () => {
    const f = apiFixture();
    expect((await f.api.run(f.params)).output).toEqual(f.output);
    const create = f.calls.find(call => call.init.method === "POST")!;
    const body = JSON.parse(String(create.init.body));
    expect(body).toMatchObject({ agent_id: COMMUNICATIONS_SAVED_AGENT_ID, environment: { type: "none" }, stream: true });
    expect(body.agent).toEqual(COMMUNICATIONS_HISTORY_CONFIGURATION);
    expect(body.metadata.blueprint_communications_history_profile).toBe(COMMUNICATIONS_HISTORY_PROFILE);
    expect(COMMUNICATIONS_SAVED_CONFIGURATION.tools).toEqual([]);
    expect(create.init.headers).toMatchObject({ "OpenAI-Project": COMMUNICATIONS_PROJECT });
    expect(f.checkpoints[0]).toMatchObject({ createClaimedAt: expect.any(String), sessionId: null });
    expect(f.checkpoints.at(-1)).toMatchObject({ sessionId: "session-1", turnId: "turn-1" });
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1); expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1);
    expect(body.metadata.blueprint_communications_configuration_digest).toBe(COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST);
    expect(body.metadata.blueprint_communications_request_digest).toBe(f.checkpoints[0].requestDigest);
    expect(body.metadata.blueprint_communications_request_digest).toMatch(/^[a-f0-9]{64}$/);
  });
  it("accepts the actual saved-agent GET metadata shape without resetting its reviewed settings", async () => {
    const f = apiFixture();
    const fetch = vi.fn(async (url: any) => String(url).includes("/models/") ? Response.json({ id: COMMUNICATIONS_MODEL })
      : Response.json({ id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION,
        reasoning: { effort: "max", summary: null }, text: { format: { type: "text" }, verbosity: "low" },
        multi_agent: { enabled: false, max_concurrent_subagents: null } }));
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: fetch as any });
    expect(await api.preflight()).toMatchObject({ runtime: "saved_agent", binding: {
      agentId: COMMUNICATIONS_SAVED_AGENT_ID, instructionsDigest: "85bcc95f3f8d02fd680de41dbb00c5e4fb84aec7d68f3de3132f6ae57444f5d7" } });
    expect(fetch).toHaveBeenCalledTimes(2); expect(f.reservePaidDraft).not.toHaveBeenCalled();
  });
  it.each(["instructions", "reasoning", "tools", "tier"])("blocks changed saved %s before reserving or creating a paid session", async changedSaved => {
    const f = apiFixture({ changedSaved });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "communications_saved_agent_definition_changed" });
    expect(f.reservePaidDraft).not.toHaveBeenCalled(); expect(f.checkpoints).toEqual([]);
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
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
  it("recovers a completed historical definition with its original request digest, provenance and usage", async () => {
    const usage = { input_tokens: 10396, output_tokens: 2373, total_tokens: 12769 };
    const f = apiFixture({ reconnect: true, instructions: LEGACY_COMMUNICATIONS_INSTRUCTIONS, usage });
    const result = await f.api.run({ ...f.params, input: "Changed current writing guidance must not relabel this existing request" });
    expect(result.output).toEqual(f.output);
    expect(result.outputSource).toMatchObject({ schema_version: "blueprint.communications-output-source.v1",
      jobId: "job-1", sessionId: "session-1", turnId: "turn-1", finalItemId: "final-1", requestDigest: "a".repeat(64),
      definitionVersion: LEGACY_COMMUNICATIONS_DEFINITION.version, instructionsDigest: LEGACY_COMMUNICATIONS_DEFINITION.instructionsDigest,
      rawOutput: JSON.stringify(f.output), normalizedMetadataPaths: [] });
    expect(COMMUNICATIONS_DEFINITION.instructionsDigest).not.toBe(LEGACY_COMMUNICATIONS_DEFINITION.instructionsDigest);
    expect(result.usage).toEqual(usage); expect(result.checkpoint.requestDigest).toBe("a".repeat(64));
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", "a".repeat(64), usage);
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it("keeps the exact reviewed v2 framing definition recoverable after adding scoped history", async () => {
    expect(COMMUNICATIONS_V2_DEFINITION.instructionsDigest).toBe("a3f340fc6c0745b7903673841c72a0eefb9721812453604dc3f9a5f3fe873f68");
    const f = apiFixture({ reconnect: true, instructions: COMMUNICATIONS_V2_INSTRUCTIONS });
    const result = await f.api.run({ ...f.params, input: "New learning context cannot replace a completed v2 request" });
    expect(result.outputSource).toMatchObject({ definitionVersion: "blueprint.communications-definition.v2",
      instructionsDigest: COMMUNICATIONS_V2_DEFINITION.instructionsDigest, requestDigest: "a".repeat(64) });
    expect(f.reservePaidDraft).not.toHaveBeenCalled(); expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
    expect(COMMUNICATIONS_DEFINITION.version).toBe("blueprint.communications-definition.v4");
  });
  it("keeps the exact v3 learning instructions recoverable after the autonomy repair", async () => {
    expect(COMMUNICATIONS_V3_DEFINITION.instructionsDigest).toBe("f225c45972fa5dc7e2d582a24672fa865abd8a661b55a41363168ff4854ea6d1");
    const f = apiFixture({ reconnect: true, instructions: COMMUNICATIONS_V3_INSTRUCTIONS });
    const result = await f.api.reconcileSaved(f.params.checkpoint, "job-1");
    expect(result?.outputSource).toMatchObject({ definitionVersion: "blueprint.communications-definition.v3", instructionsDigest: COMMUNICATIONS_V3_DEFINITION.instructionsDigest });
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it("retains a final on the fifth saved page without a result quota or another paid create", async () => {
    const f = apiFixture({ reconnect: true, itemPages: 5 });
    expect((await f.api.reconcileSaved(f.params.checkpoint, "job-1"))?.output).toEqual(f.output);
    expect(f.calls.filter(call => call.path.includes("/items?"))).toHaveLength(5);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1); expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it.each(["cursor", "resources", "deadline"])("returns a recovery diagnostic for saved read %s without partial success or create", async kind => {
    const f = apiFixture({ reconnect: true, itemPages: 20, repeatedCursor: kind === "cursor", pagePadding: kind === "resources" ? 240000 : 0, advancePageClock: kind === "deadline" });
    try {
      if (kind === "deadline") { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T00:00:00Z")); }
      await expect(f.api.reconcileSaved(f.params.checkpoint, "job-1")).rejects.toMatchObject({ code: kind === "cursor" ? "agents_items_cursor_did_not_advance" : kind === "resources" ? "agents_saved_items_export_required" : "agents_saved_items_read_deadline" });
      expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1); expect(f.reservePaidDraft).not.toHaveBeenCalled();
      expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
    } finally { if (kind === "deadline") vi.useRealTimers(); }
  });
  it("retains invalid output evidence and accounts terminal usage without creating another session", async () => {
    const usage = { input_tokens: 10396, output_tokens: 2373, total_tokens: 12769 }, rawOutput = '{"requiresHumanReview":false}';
    const f = apiFixture({ reconnect: true, usage, rawOutput });
    await expect(f.api.reconcileSaved(f.params.checkpoint, "job-1")).rejects.toMatchObject({ code: "communications_output_invalid",
      outputSource: { rawOutput, rawOutputBytes: Buffer.byteLength(rawOutput), jobId: "job-1", requestDigest: "a".repeat(64),
        validationIssues: expect.arrayContaining([expect.objectContaining({ path: "/requiresHumanReview" })]) } });
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", "a".repeat(64), usage);
    expect(f.reservePaidDraft).not.toHaveBeenCalled(); expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it.each(["valid_unicode", "inert_metadata", "invalid_body"])("preserves fully observed %s output beyond the old 20KB cutoff", async kind => {
    const { output } = communicationsFixture(), wire: any = structuredClone(output);
    if (kind === "inert_metadata") wire.sourceSnapshot = "x".repeat(24000);
    else wire.body += "界".repeat(kind === "invalid_body" ? 20001 : 8000);
    const rawOutput = JSON.stringify(wire), f = apiFixture({ reconnect: true, rawOutput });
    expect(Buffer.byteLength(rawOutput)).toBeGreaterThan(20000);
    if (kind === "invalid_body") await expect(f.api.reconcileSaved(f.params.checkpoint, "job-1")).rejects.toMatchObject({ code: "communications_output_invalid", outputSource: {
      rawOutput, rawOutputBytes: Buffer.byteLength(rawOutput), validationIssues: expect.arrayContaining([expect.objectContaining({ path: "/body", code: "too_big" })]) } });
    else {
      const result = await f.api.reconcileSaved(f.params.checkpoint, "job-1");
      expect(result?.outputSource).toMatchObject({ rawOutput, rawOutputBytes: Buffer.byteLength(rawOutput) });
      expect(result?.output).toEqual(kind === "inert_metadata" ? output : wire);
    }
    expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1); expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
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
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_existing_session_binding_mismatch" });
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
      if (String(url).endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`)) return Response.json({
        id: COMMUNICATIONS_SAVED_AGENT_ID, ...COMMUNICATIONS_SAVED_CONFIGURATION });
      if (kind === "timeout") throw new Error("synthetic connection timeout");
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error("synthetic stream loss")); } }));
    });
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any,
      reservePaidDraft: f.reservePaidDraft, recordPaidDraftUsage: f.recordPaidDraftUsage });
    await expect(api.run(f.params)).rejects.toMatchObject({ code: kind === "timeout" ? "agents_api_connection_unknown" : "session_create_requires_reconciliation", retryable: false });
    expect(f.checkpoints[0]).toMatchObject({ createClaimedAt: expect.any(String), requestDigest: expect.stringMatching(/^[a-f0-9]{64}$/), sessionId: null });
    await expect(api.run({ ...f.params, checkpoint: f.checkpoints[0] })).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(fetchMock).toHaveBeenCalledTimes(3); expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
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

describe("new-session bounded communications final repair", () => {
  const knownUsage = { input_tokens: 100, output_tokens: 20, total_tokens: 120,
    input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 2 } };
  function repairFixture(options: { raw?: string; missingUsage?: boolean; unknown?: "accepted" | "absent";
    alwaysInvalid?: boolean; wrongMessage?: boolean; evidence?: boolean; beforeSave?: (checkpoint: any) => void } = {}) {
    const f = apiFixture({ rawOutput: options.raw ?? "not JSON", usage: knownUsage });
    const originals = f.fetchMock;
    if (options.evidence) (f.savedAgent.tools as any[]) = [{ type: "mcp", server_label: "gmail", credential_id: "synthetic-owner-credential",
      transport: { type: "http", server_url: "https://gmailmcp.googleapis.com/mcp/v1", headers: {} }, request_metadata: {},
      allowed_tools: null, required: false, connection_origin: "service" }];
    const turns: any[] = [{ id: "turn-1", agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: "completed", usage: knownUsage }];
    const items: any[] = [{ id: "final-1", type: "message", role: "assistant", phase: "final_answer", status: "completed",
      turn_id: "turn-1", content: [{ type: "output_text", text: options.raw ?? "not JSON" }] }];
    const native = { id: "mcp-1", type: "mcp_call", turn_id: "turn-1", server_label: "gmail", name: "get_thread",
      arguments: JSON.stringify({ thread_id: "synthetic-thread" }), output: "Original private dated thread evidence", status: "completed" };
    if (options.evidence) items.push(native);
    const submissions: any[] = [], snapshots: any[] = [];
    let historySubmitted = false;
    let latest: any;
    const fetchMock = vi.fn(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname + new URL(String(url)).search;
      if (path.includes("/turns?")) return Response.json({ data: options.evidence && !historySubmitted
        ? turns.map(turn => ({ ...turn, status: "waiting" })) : turns, has_more: false });
      if (path.includes("/items?")) return Response.json({ data: items, has_more: false });
      if (path.endsWith("/events") && init.method === "POST") {
        expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
        const event = JSON.parse(init.body).events[0];
        if (event.type === "agent.session.input.tool_result") { historySubmitted = true; return new Response(null, { status: 202 }); }
        expect(latest.finalRepairs.at(-1)).toMatchObject({ state: "input_unresolved", event,
          requestDigest: communicationsDigest(event), idempotencyKey: init.headers["Idempotency-Key"] });
        submissions.push({ event, headers: init.headers });
        if (options.unknown !== "absent") {
          const id = `turn-${turns.length + 1}`;
          turns.push({ id, agent_id: COMMUNICATIONS_SAVED_AGENT_ID, status: "completed", usage: options.missingUsage ? null : knownUsage });
          items.push({ id: `input-${id}`, type: "message", role: "user", turn_id: id,
            content: options.wrongMessage ? [{ type: "input_text", text: "different input" }] : event.input[0].content },
          { id: `final-${id}`, type: "message", role: "assistant", phase: "final_answer", status: "completed", turn_id: id,
            content: [{ type: "output_text", text: options.alwaysInvalid ? "still invalid" : JSON.stringify(f.output) }] });
        }
        if (options.unknown) throw Error("synthetic acknowledgment lost");
        return new Response(null, { status: 202 });
      }
      if (path.endsWith("/events") && turns.length > 1) return new Response(`${options.evidence ? 'data: {"type":"agent.session.requires_action"}\n\n' : ""}data: ${JSON.stringify({
        type: "agent.session.turn.completed", turn_id: turns.at(-1).id })}\n\n`);
      const response = await originals(url, init);
      if (options.evidence && path.endsWith("/agents/sessions")) return new Response((await response.text()).replace(
        'data: {"type":"agent.session.turn.completed"', 'data: {"type":"agent.session.requires_action"}\n\ndata: {"type":"agent.session.turn.completed"'));
      if (options.evidence && path.endsWith("/session-1")) {
        const session = await response.json();
        session.required_actions = historySubmitted ? [] : [{ type: "function_call", name: "fetch_company_history_record",
          call_id: "original-history-call", turn_id: "turn-1", arguments: { record_id: "history:original" } }];
        session.status = historySubmitted ? "idle" : "requires_action";
        return Response.json(session);
      }
      return response;
    });
    const saveCheckpoint = async (value: any) => {
      options.beforeSave?.(value); latest = structuredClone(value); snapshots.push(latest);
    };
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: fetchMock as any,
      reservePaidDraft: f.reservePaidDraft, recordPaidDraftUsage: f.recordPaidDraftUsage });
    return { ...f, api, fetchMock, params: { ...f.params, saveCheckpoint }, turns, items, submissions, snapshots,
      checkpoint: () => latest };
  }
  it("returns exact schema feedback to the same session and settles both known turns once", async () => {
    const f = repairFixture(), result = await f.api.run(f.params);
    expect(result.output).toEqual(f.output); expect(f.submissions).toHaveLength(1);
    expect(f.submissions[0].event).toMatchObject({ type: "agent.session.input.message", input: [{ role: "user",
      content: [{ type: "input_text", text: expect.stringContaining("invalid_json") }] }] });
    expect(result.checkpoint.finalOutputSources).toHaveLength(2);
    expect(result.checkpoint.finalOutputSources![0]).toMatchObject({ rawOutput: "not JSON", turnId: "turn-1" });
    expect(result.checkpoint.finalRepairs![0]).toMatchObject({ baselineTurnIds: ["turn-1"], turnId: "turn-2" });
    expect(result.usage).toEqual({ input_tokens: 200, output_tokens: 40, total_tokens: 240,
      input_tokens_details: { cached_tokens: 20 }, output_tokens_details: { reasoning_tokens: 4 } });
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", result.checkpoint.requestDigest, result.usage);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
    expect(f.calls.filter(call => call.init.method === "POST")).toHaveLength(1);
  });
  it("repairs caller-filtered quality feedback before settling the original admission", async () => {
    const f = repairFixture({ raw: JSON.stringify(communicationsFixture().output) });
    let calls = 0;
    const validateOutput = vi.fn(() => ++calls === 1 ? [{ path: "/usedFactIds", code: "used_fact_missing", message: "Use a known brief fact ID." }] : null);
    const result = await f.api.run({ ...f.params, validateOutput });
    expect(validateOutput).toHaveBeenCalledTimes(2); expect(f.submissions).toHaveLength(1);
    expect(result.checkpoint.finalRepairs![0].feedback[0].code).toBe("used_fact_missing");
  });
  it("reconciles an accepted correction after lost acknowledgment using exact GET message proof", async () => {
    const f = repairFixture({ unknown: "accepted" });
    expect((await f.api.run(f.params)).output).toEqual(f.output);
    expect(f.submissions).toHaveLength(1);
    expect(f.fetchMock.mock.calls.filter(([url, init]: any[]) => String(url).endsWith("/events") && !init.method)).toHaveLength(0);
  });
  it("never resubmits an unknown correction or creates another session on replacement", async () => {
    const f = repairFixture({ unknown: "absent" });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_final_repair_pending" });
    const saved = f.checkpoint(); f.recordPaidDraftUsage.mockClear();
    await expect(f.api.run({ ...f.params, checkpoint: saved })).rejects.toMatchObject({ code: "agents_final_repair_pending" });
    expect(f.submissions).toHaveLength(1); expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledWith("job-1", saved.requestDigest, null);
    expect(await f.api.reconcileUsage(saved, "job-1")).toBeNull();
  });
  it("keeps missing correction usage unknown while retaining the original known receipt", async () => {
    const f = repairFixture({ missingUsage: true }), result = await f.api.run(f.params);
    expect(result.usage).toBeNull(); expect(result.checkpoint.usageReceipts).toMatchObject([
      { turnId: "turn-1", usage: knownUsage }, { turnId: "turn-2", usage: null }]);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", result.checkpoint.requestDigest, null);
  });
  it("stops after two uniquely claimed corrections and preserves every invalid original", async () => {
    const f = repairFixture({ alwaysInvalid: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "communications_output_invalid", outputSource: { turnId: "turn-3" } });
    expect(f.submissions).toHaveLength(2); expect(new Set(f.submissions.map(call => call.headers["Idempotency-Key"])).size).toBe(2);
    expect(f.checkpoint().finalOutputSources).toHaveLength(3);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", f.checkpoint().requestDigest, expect.objectContaining({ input_tokens: 300 }));
  });
  it("refuses a different saved user message instead of treating a latest turn as the correction", async () => {
    const f = repairFixture({ wrongMessage: true });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_final_repair_message_proof_mismatch" });
    expect(f.submissions).toHaveLength(1);
  });
  it("does not mint another turn when a consequential callback throws", async () => {
    const f = repairFixture({ raw: JSON.stringify(communicationsFixture().output) });
    await expect(f.api.run({ ...f.params, validateOutput: () => { throw Error("recipient_suppressed"); } })).rejects.toThrow("recipient_suppressed");
    expect(f.submissions).toHaveLength(0); expect(f.checkpoint().finalOutputSources).toHaveLength(1);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", f.checkpoint().requestDigest, knownUsage);
  });
  it("retains original history and native Gmail receipts across the correction turn", async () => {
    const tools = await import("../agents/operator-tools");
    const access = vi.spyOn(tools, "getCompanyHistoryAccess").mockResolvedValue({ expiresAt: "2099-10-01T00:00:00Z" } as any);
    const run = vi.spyOn(tools, "runOperatorTool").mockResolvedValue({ ok: true, record: { checked_at: "2026-10-01" } });
    try {
    const f = repairFixture({ evidence: true }), result = await f.api.run(f.params);
    expect(result.output).toEqual(f.output);
    expect(result.checkpoint.historyToolReceipts).toMatchObject([{ turnId: "turn-1", callId: "original-history-call",
      delivery: "submitted", output: expect.stringContaining("2026-10-01") }]);
    expect(result.checkpoint.nativeMcpItems).toMatchObject([{ turn_id: "turn-1", name: "get_thread", output: "Original private dated thread evidence" }]);
    expect(result.checkpoint.finalOutputSources).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(1);
    } finally { access.mockRestore(); run.mockRestore(); }
  });
  it("rechecks consequential controls for malformed JSON before any correction request", async () => {
    const f = repairFixture(), assertRepairAllowed = vi.fn(() => { throw Error("recipient_suppressed"); });
    await expect(f.api.run({ ...f.params, assertRepairAllowed })).rejects.toThrow("recipient_suppressed");
    expect(f.submissions).toHaveLength(0); expect(assertRepairAllowed).toHaveBeenCalledTimes(1);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", f.checkpoint().requestDigest, knownUsage);
  });
  it("retains final source and settles known usage when the original lease rejects final checkpoint persistence", async () => {
    const f = repairFixture({ raw: JSON.stringify(communicationsFixture().output), beforeSave: checkpoint => {
      if (checkpoint.finalRepairSettled) throw Error("communications_lease_lost");
    } });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "communications_final_checkpoint_unpersisted",
      outputSource: { rawOutput: JSON.stringify(f.output), turnId: "turn-1" } });
    expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", f.checkpoint().requestDigest, knownUsage);
    expect(f.submissions).toHaveLength(0);
  });
  it("sends no correction after the original deadline crosses during checkpoint persistence", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T20:00:00Z"));
    try {
      const f = repairFixture({ beforeSave: checkpoint => {
        if (checkpoint.finalRepairs?.length) vi.setSystemTime(Date.parse(checkpoint.createClaimedAt) + 180000);
      } });
      await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "communications_final_repair_deadline" });
      expect(f.submissions).toHaveLength(0);
      const saved = f.checkpoint(), previousCalls = f.fetchMock.mock.calls.length;
      await expect(f.api.reconcileSaved(saved, "job-1")).rejects.toMatchObject({ code: "communications_output_invalid" });
      expect(f.fetchMock.mock.calls.slice(previousCalls).every(([, init]: any[]) => init.method !== "POST")).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
