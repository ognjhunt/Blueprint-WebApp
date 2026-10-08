import { COMMUNICATIONS_FRAMING_VERSION, COMMUNICATIONS_FRAMING_V1, COMMUNICATIONS_FRAMING_V2, COMMUNICATIONS_FRAMING_V1_DIGEST,
  COMMUNICATIONS_LAUNCH_GUIDANCE, COMMUNICATIONS_LAUNCH_GUIDANCE_V1 } from "../agents/communications-launch-framing";
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunicationsAgentsAPI, COMMUNICATIONS_INSTRUCTIONS } from "../agents/communications-api";
import { COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, communicationsDigest } from "../agents/communications-contract";
import { communicationsFixture, memoryFirestore } from "./fixtures/communications";
import { reserveCommunicationsDraft } from "../agents/communications-draft-budget";
import { LEGACY_COMMUNICATIONS_INSTRUCTIONS, LEGACY_COMMUNICATIONS_DEFINITION, COMMUNICATIONS_DEFINITION, COMMUNICATIONS_V2_INSTRUCTIONS, COMMUNICATIONS_V2_DEFINITION, COMMUNICATIONS_V3_INSTRUCTIONS, COMMUNICATIONS_V3_DEFINITION } from "../agents/communications-instructions";
import { communicationsHypothesisConfiguration, communicationsHypothesisDefinition, COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION,
  COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION, COMMUNICATIONS_GMAIL_READ_DEFINITION, COMMUNICATIONS_HISTORY_DEFINITION,
  COMMUNICATIONS_HYPOTHESIS_PROFILE, COMMUNICATIONS_PERSONALIZED_PROFILE } from "../agents/communications-saved-agent";
import { COMMUNICATIONS_SAVED_AGENT_ID, COMMUNICATIONS_SAVED_CONFIGURATION,
  COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST, COMMUNICATIONS_HISTORY_CONFIGURATION, COMMUNICATIONS_HISTORY_PROFILE } from "../agents/communications-saved-agent";

import { hydrateAgentEvidence } from "../agents/private-evidence";
import { HYPOTHESIS_DRAFTS_FLAG } from "../agents/communications-hypothesis-controls";
import { buildCommunicationsInput } from "../agents/communications-worker";
import { COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE, LEGACY_COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE } from "../agents/communications-outreach-quality";
import { founderOutreachFixture } from "./fixtures/founder-outreach";
import { communicationsMcpCallAllowed } from "../agents/communications-saved-agent";
const httpStorage = vi.hoisted(() => ({ enabled: false, fail: false, objects: new Map<string, string>() }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => httpStorage.enabled ? {
  bucketName: "mock-private-http-evidence",
  createOnly: async (name: string, content: string) => {
    if (httpStorage.fail) throw new Error("storage unavailable");
    if (!httpStorage.objects.has(name)) httpStorage.objects.set(name, content);
    return "created";
  },
  readText: async (name: string) => httpStorage.objects.get(name) ?? null,
  info: async (name: string) => httpStorage.objects.has(name)
    ? { generation: "1", size: Buffer.byteLength(httpStorage.objects.get(name)!) } : null,
} : null }));
afterEach(() => { httpStorage.enabled = false; httpStorage.fail = false; httpStorage.objects.clear(); });

function apiFixture(options: { reconnect?: boolean; idle?: boolean; model?: string; noFinal?: boolean; http?: number; failed?: boolean; itemsPage?: boolean; itemPages?: number; repeatedCursor?: boolean; pagePadding?: number; advancePageClock?: boolean; missingMetadata?: boolean; rawOutput?: string; instructions?: string; usage?: unknown; changedSaved?: string } = {}) {
  const { output } = communicationsFixture();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const checkpoints: any[] = [];
  let requestDigest = "a".repeat(64), pageNumber = 0;
  let savedBinding = false;
  let sessionAgent: any = null, sessionMetadata: any = null, sessionVaults: string[] = [];
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
        sessionAgent = { id: COMMUNICATIONS_SAVED_AGENT_ID, ...body.agent }; sessionMetadata = body.metadata; sessionVaults = body.vault_ids ?? [];
        savedBinding = true;
      }
      return new Response(stream.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    }
    if (path.endsWith("/session-1")) return Response.json({ id: "session-1", status: "idle", agent: savedBinding ? sessionAgent : { id: "agent-1", model: options.model ?? COMMUNICATIONS_MODEL,
      instructions: options.instructions ?? COMMUNICATIONS_INSTRUCTIONS, service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: sessionVaults,
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

async function rejectedCreateFixture(options: { coverage?: "matching" | "incomplete" | "ambiguous" | "timestamp";
  correctedUnknown?: boolean; gateChanges?: boolean; mcp?: boolean } = {}) {
  const f = apiFixture({ usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } }), baseline = f.fetchMock.getMockImplementation()!;
  if (options.mcp) (f.savedAgent as any).tools = [{ type: "mcp", server_label: "gmail",
    credential_id: "synthetic-owner-credential", transport: { type: "http", server_url: "https://gmailmcp.googleapis.com/mcp/v1", headers: {} },
    request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" }];
  let creates = 0;
  const prior = Math.floor(Date.now() / 1000) - 3600;
  f.fetchMock.mockImplementation(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    if (options.mcp && path.startsWith("/v1/vaults?")) return Response.json({ data: [{ id: "vault_mock_gmail", object: "vault" }], has_more: false });
    if (options.mcp && path.startsWith("/v1/vaults/vault_mock_gmail/credentials?")) return Response.json({ data: [{
      id: "synthetic-owner-credential", object: "vault.credential", vault_id: "vault_mock_gmail" }], has_more: false });
    if (init.method === "POST" && path.endsWith("/agents/sessions")) {
      expect(Object.keys(JSON.parse(String(init.body)).metadata).length).toBeLessThanOrEqual(16);
      creates++;
      if (creates === 1) return new Response("retained known invalid request", { status: 400 });
      if (options.correctedUnknown) throw new Error("unknown corrected response");
    }
    if (path.startsWith("/v1/agents/sessions?")) {
      expect(path).not.toContain("agent_id"); expect(path).not.toContain("job");
      if (options.coverage === "incomplete") return Response.json({ data: [{ id: "old-1" }], has_more: true, last_id: "bad-cursor" });
      return Response.json({ data: [{ id: "old-1" }], has_more: false });
    }
    if (path.endsWith("/agents/sessions/old-1")) return Response.json({ id: "old-1",
      created_at: options.coverage === "timestamp" ? null : prior,
      ...(options.coverage === "ambiguous" ? {} : { metadata: options.coverage === "matching" ? { blueprint_communications_job: "job-1" } : {} }) });
    return baseline(url, init);
  });
  await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_api_http_400" });
  const original = structuredClone(f.checkpoints.at(-1));
  const proof = { httpStatus: 400 as const, jobId: "job-1", requestDigest: original.requestDigest,
    createClaimedAt: original.createClaimedAt, inputDigest: communicationsDigest({ input: f.params.input }), evidenceDigest: communicationsDigest(original.httpEvidence) };
  const intent = { ownerDirectionRef: "retained-owner-direction", briefDigest: "b".repeat(64), deliveryKey: "same-delivery-key" };
  const assertion = vi.fn(async () => proof);
  const gate = vi.fn(async () => { if (options.gateChanges && gate.mock.calls.length > 1) throw new Error("recipient_suppressed"); });
  const claim = vi.fn(async (_jobId: string, checkpoint: any, recovery: any) => {
    expect(communicationsDigest(checkpoint)).toBe(recovery.originalCheckpointDigest);
    expect(creates).toBe(1);
    await f.params.saveCheckpoint({ ...checkpoint, rejectedCreateRecovery: structuredClone(recovery) });
  });
  const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true, fetch: f.fetchMock as any,
    reservePaidDraft: f.reservePaidDraft, recordPaidDraftUsage: f.recordPaidDraftUsage,
    assertRejectedCreateRecovery: assertion, claimRejectedCreateRecovery: claim });
  return { ...f, api, original, intent, assertion, claim, gate, creates: () => creates,
    recoveryParams: { ...f.params, checkpoint: original, intent, assertRepairAllowed: gate } };
}

describe("portable communications Agents API", () => {
  it("backs off transient saved GET failures within one new window without settling pending usage or creating another turn", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T00:00:00Z"));
    const f = apiFixture({ usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } });
    const now = Date.now(), errors = [503, 429, "connection", "body"];
    const window = { version: "communications-execution-window-v1" as const, preparedAt: new Date(now).toISOString(),
      deadlineAt: new Date(now + 1200000).toISOString(), timeoutSeconds: 1200 };
    const baseline = f.fetchMock.getMockImplementation()!; let failures = 0, replacement = false;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/session-1") && f.checkpoints.at(-1)?.usageReceipts?.length && failures < errors.length) {
        if (!replacement) expect(f.checkpoints.at(-1).finalRepairSettled).not.toBe(true);
        expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
        const error = errors[failures++];
        if (error === "connection") throw Error("synthetic GET connection lost");
        if (error === "body") return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("synthetic GET body lost")); } }));
        return new Response("synthetic temporary read failure", { status: error as number });
      }
      const response = await baseline(url, init);
      if (path.endsWith("/agents/sessions") && init.method === "POST") return new Response([
        { type: "agent.session.created", session: { id: "session-1" } },
        { type: "agent.session.turn.created", turn_id: "turn-1", turn: { id: "turn-1", subagent_id: null } },
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(""));
      if (path.endsWith("/turns")) {
        const body = await response.json(); body.data[0].status = failures === errors.length ? "completed" : "in_progress";
        return Response.json(body);
      }
      return response;
    });
    try {
      const assertRepairAllowed = vi.fn(async () => undefined);
      const pending = f.api.run({ ...f.params, input: JSON.stringify({ executionBoundary: { window } }),
        checkpoint: { ...f.params.checkpoint, executionWindow: window }, assertRepairAllowed });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.output).toEqual(f.output); expect(failures).toBe(errors.length);
      expect(Date.now() - now).toBeGreaterThanOrEqual(12000);
      expect(result.checkpoint.finalRepairSettled).toBe(true);
      expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", result.checkpoint.requestDigest,
        { input_tokens: 3, output_tokens: 2, total_tokens: 5 });
      expect(f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST")).toHaveLength(1);
      expect(assertRepairAllowed.mock.calls.length).toBeGreaterThanOrEqual(6);
      // A replacement observer follows the same bounded GET path even before
      // any quality-repair turn exists; it never reopens a create claim.
      failures = 0; replacement = true; f.recordPaidDraftUsage.mockClear();
      const replay = f.api.run({ ...f.params, input: JSON.stringify({ executionBoundary: { window } }),
        checkpoint: result.checkpoint, assertRepairAllowed });
      await vi.runAllTimersAsync(); expect((await replay).output).toEqual(f.output);
      expect(failures).toBe(errors.length);
      expect(f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST")).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
  it("reconnects the same prospective turn past three minutes and refuses a changed frozen clock on replay", async () => {
    const f = apiFixture({ usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } });
    const now = Date.now(); let clock = now, observed = false;
    const date = vi.spyOn(Date, "now").mockImplementation(() => clock);
    const window = { version: "communications-execution-window-v1" as const, preparedAt: new Date(now).toISOString(),
      deadlineAt: new Date(now + 1200000).toISOString(), timeoutSeconds: 1200 };
    const baseline = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname;
      const response = await baseline(url, init);
      if (init.method === "POST" && path.endsWith("/agents/sessions")) {
        expect(JSON.parse(String(init.body)).metadata.blueprint_communications_execution_window_digest).toBe(communicationsDigest(window));
        return new Response([{ type: "agent.session.created", session: { id: "session-1" } },
          { type: "agent.session.turn.created", turn_id: "turn-1", turn: { id: "turn-1", subagent_id: null } }]
          .map(event => `data: ${JSON.stringify(event)}\n\n`).join(""));
      }
      if (path.endsWith("/events") && init.method !== "POST") {
        clock = now + 240000; observed = true;
        return new Response(`data: ${JSON.stringify({ type: "agent.session.turn.completed", turn_id: "turn-1" })}\n\n`);
      }
      if (path.endsWith("/turns") && !observed) {
        const body = await response.json(); body.data[0].status = "in_progress"; return Response.json(body);
      }
      return response;
    });
    try {
      const params = { ...f.params, input: JSON.stringify({ executionBoundary: { window } }),
        checkpoint: { ...f.params.checkpoint, executionWindow: window }, assertRepairAllowed: vi.fn(async () => undefined) };
      const result = await f.api.run(params);
      expect(result.output).toEqual(f.output); expect(result.checkpoint.executionWindow).toEqual(window);
      expect(clock - now).toBe(240000);
      expect(f.calls.filter(call => call.init.method === "POST")).toHaveLength(1);
      expect(f.reservePaidDraft).toHaveBeenCalledTimes(1); expect(f.recordPaidDraftUsage).toHaveBeenCalledTimes(1);
      const changed = { ...result.checkpoint, executionWindow: { ...window, timeoutSeconds: 1800, deadlineAt: new Date(now + 1800000).toISOString() } };
      await expect(f.api.reconcileSaved(changed, "job-1")).rejects.toMatchObject({ code: "agents_execution_window_binding_mismatch" });
      expect(f.calls.filter(call => call.init.method === "POST")).toHaveLength(1);
    } finally { date.mockRestore(); }
  });
  it("claims one corrected create after a verified400 and fresh complete global coverage, retaining original identity", async () => {
    const f = await rejectedCreateFixture({ mcp: true });
    const result = await f.api.recoverRejectedCreate(f.recoveryParams);
    expect(result.output).toEqual(f.output);
    expect(result.checkpoint.createClaimedAt).toBe(f.original.createClaimedAt);
    expect(result.checkpoint.requestDigest).toBe(f.original.requestDigest);
    expect(result.checkpoint.sessionId).toBeNull();
    const recovery = result.checkpoint.rejectedCreateRecovery!;
    expect(recovery.checkpoint.sessionId).toBe("session-1");
    expect(recovery.originalCheckpointDigest).toBe(communicationsDigest(f.original));
    expect(recovery.negativeCoverage).toMatchObject({ project: COMMUNICATIONS_PROJECT, count: 1 });
    expect(recovery.deadlineMs).toBe(Date.parse(recovery.checkpoint.createClaimedAt!) + 180000);
    expect(JSON.parse(recovery.correctedBody).metadata).toMatchObject({
      blueprint_communications_recovery_binding_digest: communicationsDigest({
        originalCheckpointDigest: recovery.originalCheckpointDigest, originalRequestDigest: f.original.requestDigest,
        intent: f.intent, claimedAt: recovery.checkpoint.createClaimedAt, deadlineMs: recovery.deadlineMs }) });
    expect(recovery.checkpoint.gmailMcp?.profile).toBe("mcp-vault-read-v1");
    expect(f.creates()).toBe(2); expect(f.claim).toHaveBeenCalledTimes(1);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
    expect(f.recordPaidDraftUsage).toHaveBeenCalledWith("job-1", recovery.correctedRequestDigest, expect.any(Object));
    // Replacement observation and the other supported readers use the child;
    // none converts original unknown usage or creates a third session.
    expect((await f.api.run({ ...f.params, checkpoint: result.checkpoint })).output).toEqual(f.output);
    expect((await f.api.reconcileSaved(result.checkpoint, "job-1"))?.output).toEqual(f.output);
    expect(await f.api.reconcileUsage(result.checkpoint, "job-1")).toMatchObject({ input_tokens: 3 });
    expect(await f.api.verifyExistingDraftSession(result.checkpoint, "job-1", f.original.requestDigest)).toMatchObject({ sessionId: "session-1", requestDigest: recovery.correctedRequestDigest });
    expect(await f.api.cancel(result.checkpoint)).toBe(true);
    expect(f.creates()).toBe(2);
    await expect(f.api.recoverRejectedCreate({ ...f.recoveryParams, checkpoint: result.checkpoint })).rejects.toMatchObject({ code: "communications_rejected_create_ineligible" });
  });
  it("recovers an older canonical known400 without requiring a response body that was never retained", async () => {
    const f = await rejectedCreateFixture();
    delete f.original.httpFailure; delete f.original.httpEvidence;
    const result = await f.api.recoverRejectedCreate(f.recoveryParams);
    expect(result.output).toEqual(f.output);
    expect(result.checkpoint.rejectedCreateRecovery!.rejectionProof).toMatchObject({ httpStatus: 400,
      requestDigest: f.original.requestDigest, createClaimedAt: f.original.createClaimedAt });
    expect(result.checkpoint.httpEvidence).toBeUndefined();
    expect(f.creates()).toBe(2); expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
  });
  it("rejects an altered corrected deadline or authority binding before any provider observation", async () => {
    const f = await rejectedCreateFixture();
    const result = await f.api.recoverRejectedCreate(f.recoveryParams);
    const changed = structuredClone(result.checkpoint);
    changed.rejectedCreateRecovery!.checkpoint.createClaimedAt = new Date(Date.now() + 180000).toISOString();
    changed.rejectedCreateRecovery!.deadlineMs = Date.parse(changed.rejectedCreateRecovery!.checkpoint.createClaimedAt!) + 180000;
    const calls = f.fetchMock.mock.calls.length;
    await expect(f.api.run({ ...f.params, checkpoint: changed })).rejects.toMatchObject({ code: "communications_rejected_create_binding_invalid" });
    expect(f.fetchMock).toHaveBeenCalledTimes(calls); expect(f.creates()).toBe(2);
  });
  it.each(["matching", "incomplete", "ambiguous", "timestamp"] as const)("refuses corrected create when global coverage is %s", async coverage => {
    const f = await rejectedCreateFixture({ coverage });
    await expect(f.api.recoverRejectedCreate(f.recoveryParams)).rejects.toMatchObject({ code: coverage === "matching"
      ? "communications_rejected_create_session_exists" : coverage === "incomplete"
        ? "communications_rejected_create_coverage_incomplete" : "communications_rejected_create_coverage_ambiguous" });
    expect(f.claim).not.toHaveBeenCalled(); expect(f.creates()).toBe(1);
  });
  it("never repeats an uncertain corrected POST, preserving both separate claims and unknown usage", async () => {
    const f = await rejectedCreateFixture({ correctedUnknown: true });
    await expect(f.api.recoverRejectedCreate(f.recoveryParams)).rejects.toMatchObject({ code: "agents_api_connection_unknown" });
    const retained = f.checkpoints.at(-1);
    expect(retained.rejectedCreateRecovery.checkpoint).toMatchObject({ createClaimedAt: expect.any(String), sessionId: null });
    const calls = f.fetchMock.mock.calls.length;
    await expect(f.api.run({ ...f.params, checkpoint: retained })).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(f.fetchMock).toHaveBeenCalledTimes(calls); expect(f.creates()).toBe(2);
    expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
    expect(retained.requestDigest).toBe(f.original.requestDigest);
  });
  it("rechecks consequential controls after the one-use recovery claim and does not POST if suppressed", async () => {
    const f = await rejectedCreateFixture({ gateChanges: true });
    await expect(f.api.recoverRejectedCreate(f.recoveryParams)).rejects.toThrow("recipient_suppressed");
    expect(f.claim).toHaveBeenCalledTimes(1); expect(f.creates()).toBe(1);
    expect(f.checkpoints.at(-1).rejectedCreateRecovery.checkpoint.sessionId).toBeNull();
  });
  it("denies owner-proof scope mismatch and non400 outcomes without global listing or another create", async () => {
    const f = await rejectedCreateFixture();
    f.assertion.mockResolvedValueOnce({ ...await f.assertion(), httpStatus: 429 as any });
    const calls = f.fetchMock.mock.calls.length;
    await expect(f.api.recoverRejectedCreate(f.recoveryParams)).rejects.toMatchObject({ code: "communications_rejected_create_evidence_invalid" });
    expect(f.fetchMock).toHaveBeenCalledTimes(calls); expect(f.claim).not.toHaveBeenCalled();
  });
  it("retains rejected create bytes privately and resumes without another paid POST", async () => {
    httpStorage.enabled = true;
    const f = apiFixture();
    const body = JSON.stringify({ error: { message: "PRIVATE INPUT " + "x".repeat(420000), type: "invalid_request_error" } });
    const originalFetch = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => init.method === "POST"
      ? new Response(body, { status: 400, headers: { "x-request-id": "req-synthetic-rejected" } })
      : originalFetch(url, init));
    let error: any;
    try { await f.api.run(f.params); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "agents_api_http_400", retryable: false });
    expect(JSON.stringify(error)).not.toContain("PRIVATE INPUT");
    const checkpoint = f.checkpoints.at(-1);
    expect(checkpoint).toMatchObject({ sessionId: null, createClaimedAt: expect.any(String),
      httpFailure: { status: 400, retention: "retained", capture: "complete" } });
    expect(checkpoint.httpEvidence.agent_evidence_ref).toBeTruthy();
    expect(JSON.stringify(checkpoint)).not.toContain("PRIVATE INPUT");
    const binding = checkpoint.httpFailure.binding;
    const hydrated = await hydrateAgentEvidence(checkpoint.httpEvidence, { collection: "agentCheckpoints",
      id: `communications-http:job-1:${communicationsDigest(binding)}` });
    expect(hydrated.snapshot.binding).toEqual(binding);
    expect(hydrated.snapshot.response).toMatchObject({ status: 400, requestId: "req-synthetic-rejected" });
    expect(Buffer.from(hydrated.snapshot.response.bodyBase64, "base64").toString()).toBe(body);
    const calls = f.fetchMock.mock.calls.length;
    await expect(f.api.run({ ...f.params, checkpoint })).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(f.fetchMock).toHaveBeenCalledTimes(calls);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
    expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
  });
  it("keeps the actual HTTP status and one-use claim when private offload and checkpoint retention fail", async () => {
    httpStorage.enabled = true; httpStorage.fail = true;
    const f = apiFixture(), originalFetch = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => init.method === "POST"
      ? new Response("private " + "x".repeat(420000), { status: 422 }) : originalFetch(url, init));
    let saves = 0, error: any;
    try { await f.api.run({ ...f.params, saveCheckpoint: async value => {
      if (++saves > 1) throw new Error("checkpoint unavailable");
      await f.params.saveCheckpoint(value);
    } }); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "agents_api_http_422", httpFailure: { status: 422, retention: "checkpoint_unpersisted" } });
    expect(error.privateHttpResponse.status).toBe(422);
    expect(Buffer.from(error.privateHttpResponse.bodyBase64, "base64").toString()).toContain("private ");
    expect(JSON.stringify(error)).not.toContain("private ");
    const calls = f.fetchMock.mock.calls.length;
    await expect(f.api.run({ ...f.params, checkpoint: f.checkpoints[0] })).rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(f.fetchMock).toHaveBeenCalledTimes(calls);
    expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
  });
  it("binds preflight HTTP evidence to the existing job/input without creating paid authority", async () => {
    const f = apiFixture({ http: 403 });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_api_http_403" });
    const checkpoint = f.checkpoints.at(-1);
    expect(checkpoint).toMatchObject({ createClaimedAt: null, sessionId: null,
      httpFailure: { status: 403, binding: { jobId: "job-1", requestDigest: null,
        inputDigest: communicationsDigest({ input: f.params.input }) } } });
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.fetchMock.mock.calls.every(([, init]) => init.method !== "POST")).toBe(true);
    await expect(f.api.run({ ...f.params, jobId: "other-job", checkpoint })).rejects.toMatchObject({ code: "agents_api_http_403" });
    expect(f.fetchMock).toHaveBeenCalledTimes(2);
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
  });
  it("continues after a historical preflight rejection without renewing its original diagnostic scope", async () => {
    const f = apiFixture();
    f.fetchMock.mockImplementationOnce(async () => new Response("original preflight error", { status: 403 }));
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_api_http_403" });
    const checkpoint = f.checkpoints.at(-1), originalBinding = checkpoint.httpFailure.binding;
    const result = await f.api.run({ ...f.params, checkpoint });
    expect(result.output).toEqual(f.output);
    expect(result.checkpoint.httpFailure?.binding).toEqual(originalBinding);
    expect(result.checkpoint.httpFailure?.binding.createClaimedAt).toBeNull();
    expect(f.fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(1);
  });
  it("observes a later verified turn even when earlier HTTP diagnostics are unavailable", async () => {
    const f = apiFixture({ reconnect: true });
    f.fetchMock.mockImplementationOnce(async () => new Response("earlier observation error", { status: 400 }));
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_api_http_400" });
    const checkpoint = f.checkpoints.at(-1), originalBinding = checkpoint.httpFailure.binding;
    const originalFetch = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const response = await originalFetch(url, init);
      return new Response((await response.text()).replaceAll("turn-1", "turn-2"), { status: response.status, headers: response.headers });
    });
    checkpoint.turnId = "turn-2";
    // A lost optional diagnostic object cannot cancel valid saved accounting.
    checkpoint.httpEvidence.snapshot.response.bodyBase64 = "corrupt";
    const result = await f.api.run({ ...f.params, checkpoint });
    expect(result.output).toEqual(f.output);
    expect(result.checkpoint.turnId).toBe("turn-2");
    expect(result.checkpoint.httpFailure).toMatchObject({ status: 400, binding: originalBinding, retention: "private_evidence_unavailable" });
    expect(originalBinding.turnId).toBe("turn-1");
    expect(f.fetchMock.mock.calls.every(([, init]) => init.method !== "POST")).toBe(true);
  });
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
    alwaysInvalid?: boolean; wrongMessage?: boolean; evidence?: boolean; missingHistoryEvent?: boolean;
    historyAck?: "accepted" | "pending" | "deadline";
    beforeSave?: (checkpoint: any) => void } = {}) {
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
    let historySubmitted = false, historyAttempts = 0;
    let latest: any;
    const fetchMock = vi.fn(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname + new URL(String(url)).search;
      if (options.evidence && path.includes("/vaults?")) return Response.json({ data: [{ id: "vault_mock_gmail", object: "vault" }], has_more: false });
      if (options.evidence && path.includes("/vaults/vault_mock_gmail/credentials?")) return Response.json({ data: [{
        id: "synthetic-owner-credential", object: "vault.credential", vault_id: "vault_mock_gmail" }], has_more: false });
      if (path.includes("/turns?")) return Response.json({ data: options.evidence && !historySubmitted
        ? turns.map(turn => ({ ...turn, status: "waiting" })) : turns, has_more: false });
      if (path.includes("/items?")) return Response.json({ data: items, has_more: false });
      if (path.endsWith("/events") && init.method === "POST") {
        expect(f.recordPaidDraftUsage).not.toHaveBeenCalled();
        const event = JSON.parse(init.body).events[0];
        if (event.type === "agent.session.input.tool_result") {
          historyAttempts++;
          if (options.historyAck && historyAttempts === 1) {
            historySubmitted = options.historyAck === "accepted";
            if (options.historyAck === "deadline") vi.setSystemTime(Date.parse(latest.executionWindow.deadlineAt));
            throw Error("synthetic history acknowledgment lost");
          }
          historySubmitted = true; return new Response(null, { status: 202 });
        }
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
      if (options.evidence && !options.missingHistoryEvent && path.endsWith("/agents/sessions")) return new Response((await response.text()).replace(
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
  it.each(["accepted", "pending", "deadline"] as const)("recovers a normal-window %s history ACK in the same invocation without another history read or create", async historyAck => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T02:00:00Z"));
    const tools = await import("../agents/operator-tools");
    const access = vi.spyOn(tools, "getCompanyHistoryAccess").mockResolvedValue({ expiresAt: "2099-10-01T00:00:00Z" } as any);
    const run = vi.spyOn(tools, "runOperatorTool").mockResolvedValue({ ok: true, record: { outcome: "retained history" } });
    try {
      const f = repairFixture({ evidence: true, historyAck, raw: JSON.stringify(communicationsFixture().output) });
      const window = { version: "communications-execution-window-v1" as const, preparedAt: new Date().toISOString(),
        deadlineAt: new Date(Date.now() + 1200000).toISOString(), timeoutSeconds: 1200 };
      const resultPromise = f.api.run({ ...f.params, input: JSON.stringify({ executionBoundary: { window } }),
        checkpoint: { ...f.params.checkpoint, executionWindow: window }, assertRepairAllowed: async () => undefined });
      const outcome = resultPromise.then(value => ({ value, error: null }), error => ({ value: null, error }));
      await vi.runAllTimersAsync(); const result = await outcome;
      expect(run).toHaveBeenCalledTimes(1);
      const posts = f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST");
      expect(posts.filter(([url]: any[]) => String(url).endsWith("/agents/sessions"))).toHaveLength(1);
      const toolPosts = posts.filter(([url]: any[]) => String(url).endsWith("/events"));
      expect(toolPosts).toHaveLength(historyAck === "pending" ? 2 : 1);
      const receipt = f.checkpoint().historyToolReceipts[0];
      for (const [, init] of toolPosts as any[]) {
        expect(init.headers["Idempotency-Key"]).toBe(receipt.idempotencyKey);
        expect(JSON.parse(init.body).events).toEqual([{ type: "agent.session.input.tool_result", turn_id: receipt.turnId,
          call_id: receipt.callId, success: true, output: receipt.output }]);
      }
      if (historyAck === "deadline") {
        expect(result.error).toMatchObject({ code: "communications_execution_deadline" });
        expect(f.checkpoint().finalRepairSettled).not.toBe(true);
        expect(f.recordPaidDraftUsage).toHaveBeenCalledExactlyOnceWith("job-1", f.checkpoint().requestDigest, null);
      } else {
        expect(result.error).toBeNull(); expect(result.value?.output).toEqual(f.output);
        expect(f.checkpoint().finalRepairs ?? []).toHaveLength(0);
      }
    } finally { access.mockRestore(); run.mockRestore(); vi.useRealTimers(); }
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
    expect(result.checkpoint.gmailMcp).toMatchObject({ profile: "mcp-vault-read-v1", vaultIds: ["vault_mock_gmail"] });
    const create = f.calls.find(call => call.path.endsWith("/agents/sessions") && call.init.method === "POST")!;
    expect(JSON.parse(String(create.init.body)).vault_ids).toEqual(["vault_mock_gmail"]);
    expect(result.checkpoint.finalOutputSources).toHaveLength(2);
    expect(run).toHaveBeenCalledTimes(1);
    } finally { access.mockRestore(); run.mockRestore(); }
  });
  it("answers a saved history request when the final-repair stream missed its action event, without a new turn", async () => {
    const tools = await import("../agents/operator-tools");
    const access = vi.spyOn(tools, "getCompanyHistoryAccess").mockResolvedValue({ expiresAt: "2099-10-01T00:00:00Z" } as any);
    const run = vi.spyOn(tools, "runOperatorTool").mockResolvedValue({ ok: true, record: { outcome: "prior outreach feedback" } });
    try {
      const f = repairFixture({ evidence: true, missingHistoryEvent: true, raw: JSON.stringify(communicationsFixture().output) });
      const assertRepairAllowed = vi.fn(async () => undefined);
      const result = await f.api.run({ ...f.params, assertRepairAllowed });
      expect(result.output).toEqual(f.output);
      expect(run).toHaveBeenCalledExactlyOnceWith("fetch_company_history_record", { record_id: "history:original" }, expect.any(Object));
      const posted = f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST");
      expect(posted.filter(([url]: any[]) => String(url).endsWith("/agents/sessions"))).toHaveLength(1);
      const events = posted.filter(([url]: any[]) => String(url).endsWith("/events"))
        .flatMap(([, init]: any[]) => JSON.parse(String(init.body)).events);
      expect(events).toMatchObject([{ type: "agent.session.input.tool_result", turn_id: "turn-1", call_id: "original-history-call", success: true }]);
      expect(result.checkpoint.historyToolReceipts).toMatchObject([{ callId: "original-history-call", delivery: "submitted" }]);
      expect(result.checkpoint.finalRepairs ?? []).toHaveLength(0);
      expect(assertRepairAllowed).toHaveBeenCalledTimes(2);
    } finally { access.mockRestore(); run.mockRestore(); }
  });
  it("does not answer missed actions once the original deadline has passed, including through saved observation", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T20:00:00Z"));
    const tools = await import("../agents/operator-tools");
    const run = vi.spyOn(tools, "runOperatorTool");
    try {
      const f = repairFixture({ evidence: true, missingHistoryEvent: true, beforeSave: checkpoint => {
        if (checkpoint.usageReceipts?.length) vi.setSystemTime(Date.parse(checkpoint.createClaimedAt) + 180000);
      } });
      await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_turn_pending" });
      const postsBefore = f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST").length;
      expect(await f.api.reconcileSaved(f.checkpoint(), "job-1")).toBeNull();
      expect(f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST")).toHaveLength(postsBefore);
      expect(postsBefore).toBe(1); expect(run).not.toHaveBeenCalled();
    } finally { run.mockRestore(); vi.useRealTimers(); }
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

describe("declared MCP connection failure observations", () => {
  const failedInitialize = { id: "mcp-synthetic-initialize", type: "mcp_call", turn_id: "turn-1", server_label: "notion",
    name: "initialize", arguments: {}, status: "failed", output: null,
    error: { code: "connection_failed", message: "Synthetic declared connection unavailable" } };
  function fixture(item: any) {
    const f = apiFixture(), original = f.fetchMock.getMockImplementation()!;
    (f.savedAgent.tools as any[]) = [
      ["gmail", "https://gmailmcp.googleapis.com/mcp/v1"], ["notion", "https://mcp.notion.com/mcp"],
      ["firebase", "https://firestore.googleapis.com/mcp"],
    ].map(([server_label, server_url]) => ({ type: "mcp", server_label, credential_id: `synthetic-${server_label}-credential`,
      transport: { type: "http", server_url, headers: {} }, request_metadata: {}, allowed_tools: null, required: false, connection_origin: "service" }));
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v1/vaults") return Response.json({ data: ["gmail", "notion", "firebase"].map(label => ({ id: `vault_mock_${label}`, object: "vault" })), has_more: false });
      const vault = path.match(/^\/v1\/vaults\/vault_mock_(gmail|notion|firebase)\/credentials$/);
      if (vault) return Response.json({ data: [{ id: `synthetic-${vault[1]}-credential`, object: "vault.credential", vault_id: `vault_mock_${vault[1]}` }], has_more: false });
      const response = await original(url, init);
      if (path.endsWith("/items")) {
        const page = await response.json(); page.data.unshift(structuredClone(item)); return Response.json(page);
      }
      if (path.endsWith("/turns")) {
        const page = await response.json(); page.data[0].usage = null; return Response.json(page);
      }
      return response;
    });
    return f;
  }
  it.each(["gmail", "notion", "firebase"])("retains failed %s initialization and recovers the exact final with paid inference off", async server_label => {
    const item = { ...failedInitialize, server_label }, f = fixture(item), result = await f.api.run(f.params);
    expect(result.checkpoint.nativeMcpItems).toEqual([item]);
    expect(result.outputSource?.nativeMcpEvidence).toMatchObject({ observedCalls: 1, failedConnections: 1, observedToolCalls: 0 });
    expect(communicationsMcpCallAllowed(result.checkpoint.gmailMcp!, server_label, "initialize")).toBe(false);
    expect(result.usage).toBeNull();
    const postsBefore = f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST").length;
    const reserveCount = f.reservePaidDraft.mock.calls.length;
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: f.fetchMock as any,
      reviewedSavedOutputDigest: result.outputSource!.rawOutputSha256, reservePaidDraft: f.reservePaidDraft });
    const recovered = await api.reconcileSaved(result.checkpoint, "job-1");
    expect(recovered?.output).toEqual(result.output);
    expect(recovered?.outputSource?.rawOutputSha256).toBe(result.outputSource!.rawOutputSha256);
    expect(recovered?.checkpoint.nativeMcpItems).toEqual([item]);
    expect(recovered?.usage).toBeNull();
    expect(f.fetchMock.mock.calls.filter(([, init]: any[]) => init.method === "POST")).toHaveLength(postsBefore);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(reserveCount);
    expect(postsBefore).toBe(1);
  });
  it.each([
    { server_label: "foreign" }, { turn_id: "foreign-turn" }, { name: "notion-create-pages" },
    { status: "completed" }, { output: "unverified server data" }, { arguments: { grant: "read" } },
    { arguments: null }, { arguments: [] }, { error: { code: "permission_denied" } }, { error: null },
  ])("rejects unrelated or tool-bearing initialization observations: %j", async change => {
    const f = fixture({ ...failedInitialize, ...change });
    await expect(f.api.run(f.params)).rejects.toMatchObject({ code: "agents_native_mcp_call_binding_mismatch" });
    expect(f.calls.filter(call => call.init.method === "POST")).toHaveLength(1);
  });
  it.each([["notion", "notion-search"], ["firebase", "get_database"], ["gmail", "get_thread"]])("preserves the existing %s/%s read allowlist", async (server_label, name) => {
    const item = { ...failedInitialize, server_label, name, status: "completed", output: "synthetic read", error: null };
    const f = fixture(item), result = await f.api.run(f.params);
    expect(result.checkpoint.nativeMcpItems).toEqual([item]);
    expect(result.outputSource?.nativeMcpEvidence).toMatchObject({ failedConnections: 0, observedToolCalls: 1 });
  });
  it("refuses a changed retained connection diagnostic on GET-only replay", async () => {
    const f = fixture(failedInitialize), result = await f.api.run(f.params);
    const retained = structuredClone(result.checkpoint);
    (retained.nativeMcpItems![0] as any).error.message = "different diagnostic";
    const before = f.fetchMock.mock.calls.length;
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: f.fetchMock as any });
    await expect(api.reconcileSaved(retained, "job-1")).rejects.toMatchObject({ code: "agents_native_mcp_call_binding_mismatch" });
    expect(f.fetchMock.mock.calls.slice(before).every(([, init]: any[]) => init.method !== "POST")).toBe(true);
  });
});

describe("outreach-ready hypothesis session definitions (hypothesis jobs only)", () => {
  beforeEach(() => { vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true"); });
  afterEach(() => { vi.unstubAllEnvs(); });
  const hypothesisCheckpoint = () => ({ createClaimedAt: null, sessionId: null, turnId: null, draftProfile: COMMUNICATIONS_HYPOTHESIS_PROFILE });
  /** Replace what the provider reports for the created session's agent instructions. */
  const reportInstructions = (f: ReturnType<typeof apiFixture>, rewrite: (instructions: string) => string) => {
    const baseline = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const response = await baseline(url, init);
      if (!String(url).endsWith("/session-1")) return response;
      const session = await response.json();
      return Response.json({ ...session, agent: { ...session.agent, instructions: rewrite(session.agent.instructions) } });
    });
  };
  it("refuses a hypothesis reservation and create when the flag turns off during preflight", async () => {
    const f = apiFixture(), original = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const result = await original(url, init);
      if (String(url).endsWith(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`)) vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
      return result;
    });
    await expect(f.api.run({ ...f.params, checkpoint: hypothesisCheckpoint() as any })).rejects.toMatchObject({ code: "hypothesis_drafts_disabled" });
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it("keeps a pre-POST create claim when the flag turns off during checkpoint persistence, without a provider POST", async () => {
    const f = apiFixture();
    await expect(f.api.run({ ...f.params, checkpoint: hypothesisCheckpoint() as any, saveCheckpoint: async checkpoint => {
      await f.params.saveCheckpoint(checkpoint);
      vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
    } })).rejects.toMatchObject({ code: "hypothesis_drafts_disabled" });
    expect(f.reservePaidDraft).toHaveBeenCalledOnce();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
    expect(f.checkpoints.at(-1)).toMatchObject({ createClaimedAt: expect.any(String), sessionId: null,
      hypothesisCreateSubmission: { state: "not_submitted", requestDigest: expect.any(String), inputDigest: communicationsDigest({ input: f.params.input }) } });
  });
  it.each((["reservation", "claim_persisted"] as const).flatMap(pauseAt =>
    [undefined, COMMUNICATIONS_FRAMING_V1, COMMUNICATIONS_FRAMING_VERSION].map(framingVersion => [pauseAt, framingVersion] as const)))
  ("resumes the exact held budget admission after the flag turns off during %s with framing %s", async (pauseAt, framingVersion) => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "1");
    const f = apiFixture(), db = memoryFirestore();
    let paused = false, stored: any;
    const reserve = vi.fn(async (jobId: string, digest: string) => {
      await reserveCommunicationsDraft(db, jobId, digest, Date.now());
      if (!paused && pauseAt === "reservation") { paused = true; vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false"); }
    });
    const saveCheckpoint = async (checkpoint: any) => {
      stored = structuredClone(checkpoint);
      if (!paused && pauseAt === "claim_persisted" && checkpoint.hypothesisCreateSubmission?.state === "claimed") {
        paused = true; vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
      }
    };
    const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: true,
      fetch: f.fetchMock as any, reservePaidDraft: reserve, recordPaidDraftUsage: f.recordPaidDraftUsage });
    await expect(api.run({ ...f.params, checkpoint: { ...hypothesisCheckpoint(), ...(framingVersion ? { framingVersion } : {}) } as any, saveCheckpoint }))
      .rejects.toMatchObject({ code: "hypothesis_drafts_disabled" });
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
    expect(stored.hypothesisCreateSubmission).toMatchObject({ state: "not_submitted", requestDigest: stored.requestDigest,
      inputDigest: communicationsDigest({ input: f.params.input }) });
    const digest = stored.requestDigest;
    const admissions = () => [...db.records.entries()].filter(([path]: any) => path.includes("/draftBudgetAdmissions/"));
    expect(admissions()).toHaveLength(1);
    expect(admissions()[0][1]).toMatchObject({ jobId: f.params.jobId, requestDigest: digest, state: "reserved" });
    await expect(api.run({ ...f.params, input: "changed synthetic context", checkpoint: structuredClone(stored), saveCheckpoint }))
      .rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const result = await api.run({ ...f.params, checkpoint: structuredClone(stored), saveCheckpoint });
    expect(result.checkpoint.sessionId).toBe("session-1");
    expect(result.checkpoint.framingVersion).toBe(framingVersion);
    const body = JSON.parse(String(f.calls.find(call => call.init.method === "POST")!.init.body));
    expect(body.agent).toEqual(communicationsHypothesisConfiguration(COMMUNICATIONS_HISTORY_CONFIGURATION, framingVersion));
    expect(reserve.mock.calls.map(([, requestDigest]) => requestDigest)).toEqual([digest, digest]);
    expect(admissions()).toHaveLength(1);
    expect([...db.records.entries()].filter(([path]: any) => path.includes("/draftBudgetDays/"))[0][1].admissions).toBe(1);
    expect(f.calls.filter(call => call.init.method === "POST" && call.path.endsWith("/agents/sessions"))).toHaveLength(1);
  });
  it("does not resubmit a claimed hypothesis create after an unknown provider acknowledgment", async () => {
    const f = apiFixture(), baseline = f.fetchMock.getMockImplementation()!;
    let creates = 0, stored: any;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      if (init.method === "POST" && String(url).endsWith("/agents/sessions")) { creates++; throw new Error("synthetic unknown acknowledgment"); }
      return baseline(url, init);
    });
    const saveCheckpoint = async (checkpoint: any) => { stored = structuredClone(checkpoint); };
    await expect(f.api.run({ ...f.params, checkpoint: hypothesisCheckpoint() as any, saveCheckpoint })).rejects.toThrow();
    expect(stored.hypothesisCreateSubmission.state).toBe("claimed");
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    await expect(f.api.run({ ...f.params, checkpoint: stored, saveCheckpoint }))
      .rejects.toMatchObject({ code: "session_create_requires_reconciliation" });
    expect(creates).toBe(1);
    expect(f.reservePaidDraft).toHaveBeenCalledOnce();
  });
  it.each([undefined, COMMUNICATIONS_FRAMING_V1, COMMUNICATIONS_FRAMING_V2, COMMUNICATIONS_FRAMING_VERSION])("creates and reads back a hypothesis session with framing=%s, retaining archived hashes", async version => {
    const f = apiFixture();
    const result = await f.api.run({ ...f.params, checkpoint: { ...hypothesisCheckpoint(), ...(version ? { framingVersion: version } : {}) } as any });
    const body = JSON.parse(String(f.calls.find(call => call.init.method === "POST")!.init.body));
    const definition = communicationsHypothesisDefinition(COMMUNICATIONS_HISTORY_DEFINITION, version);
    expect(definition.version).toBe(version === undefined ? "blueprint.communications-definition.v9"
      : version === COMMUNICATIONS_FRAMING_V1 ? "blueprint.communications-definition.v13"
      : version === COMMUNICATIONS_FRAMING_V2 ? "blueprint.communications-definition.v17" : "blueprint.communications-definition.v21");
    expect(definition.instructions.startsWith(`${COMMUNICATIONS_HISTORY_DEFINITION.instructions}\n`)).toBe(true);
    expect(definition.instructions).toContain(version === COMMUNICATIONS_FRAMING_VERSION ? "blueprint.outreach.v4" : version ? "blueprint.outreach.v3" : "blueprint.outreach.v2");
    expect(body.agent).toEqual(communicationsHypothesisConfiguration(COMMUNICATIONS_HISTORY_CONFIGURATION, version));
    expect(body.metadata).toMatchObject({ blueprint_communications_definition: definition.version,
      blueprint_communications_instructions_digest: definition.instructionsDigest,
      blueprint_communications_draft_profile: COMMUNICATIONS_HYPOTHESIS_PROFILE,
      blueprint_communications_history_configuration_digest: communicationsDigest(communicationsHypothesisConfiguration(COMMUNICATIONS_HISTORY_CONFIGURATION, version)),
      blueprint_communications_configuration_digest: COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST });
    expect(Object.keys(body.metadata).length).toBeLessThanOrEqual(16);
    expect(result.checkpoint).toMatchObject({ draftProfile: COMMUNICATIONS_HYPOTHESIS_PROFILE, sessionId: "session-1" });
    expect(result.outputSource).toMatchObject({ definitionVersion: definition.version, instructionsDigest: definition.instructionsDigest });
    // The saved agent itself is untouched: the hypothesis paragraph exists only in this session's override.
    expect(COMMUNICATIONS_SAVED_CONFIGURATION.instructions).not.toContain(version ? "blueprint.outreach.v3" : "blueprint.outreach.v2");
    const previousCalls = f.calls.length, previousAdmissions = f.reservePaidDraft.mock.calls.length;
    await expect(f.api.reconcileSaved(result.checkpoint, f.params.jobId)).resolves.toMatchObject({ output: result.output });
    expect(f.calls.slice(previousCalls).every(call => (call.init.method ?? "GET") === "GET")).toBe(true);
    expect(f.reservePaidDraft).toHaveBeenCalledTimes(previousAdmissions);
    if (version) {
      await expect(f.api.reconcileSaved({ ...result.checkpoint,
        framingVersion: version === COMMUNICATIONS_FRAMING_V1 ? COMMUNICATIONS_FRAMING_VERSION : COMMUNICATIONS_FRAMING_V1 }, f.params.jobId))
        .rejects.toMatchObject({ code: "agents_existing_session_history_binding_mismatch" });
      expect(f.reservePaidDraft).toHaveBeenCalledTimes(previousAdmissions);
    }
  });
  it("preserves every v1 instruction hash and publishes booking guidance only in v17–20", () => {
    const bases = [COMMUNICATIONS_HISTORY_DEFINITION, COMMUNICATIONS_GMAIL_READ_DEFINITION,
      COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION, COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION];
    expect(COMMUNICATIONS_FRAMING_V1_DIGEST).toBe("920b1c200fa7421154565c29edf9de903b8fb12b1b07fcfe280fa6b0c8af8a85");
    expect(bases.map(base => communicationsHypothesisDefinition(base, COMMUNICATIONS_FRAMING_V1).instructionsDigest)).toEqual([
      "e96a2455ec75d63f67aa0608bbb8370f681502828787e25c6e6b8e195177212e",
      "1eb9a09dc11fb15d3b783df869579848f685154fdf0cc333e63ced2b40e4ab0e",
      "0616f5fe2b7a1db6c0fae319b932e2c75848e57ee8829074403b3a14bdf0f1d1",
      "fa07ace846fa248c2f98bc67dd048e4f3158f928d32716aee698e7ecad98b715",
    ]);
    for (const base of bases) expect(communicationsHypothesisDefinition(base, true)).toEqual(communicationsHypothesisDefinition(base, COMMUNICATIONS_FRAMING_V1));
    expect(bases.map(base => communicationsHypothesisDefinition(base, COMMUNICATIONS_FRAMING_V2).version))
      .toEqual([17, 18, 19, 20].map(version => `blueprint.communications-definition.v${version}`));
    expect(bases.map(base => communicationsHypothesisDefinition(base, COMMUNICATIONS_FRAMING_V2).instructionsDigest)).toEqual([
      "c24ac6997d73b2859b289036774fe372702f97be3b0049a4489a44f952a3e6e7",
      "28a8c0b87ce519e034e4e70ee2eed7597dfc8d3bb682ee8fa7b840cf0900c1d8",
      "99649ab589d1a1a0a911d03936c201acf8bcbf0d40395bd513d4601682482d2f",
      "f225b0f1f03fa832680207b1f62da3912752705b21e6d7254fefb291aec4c452",
    ]);
    expect(bases.map(base => communicationsHypothesisDefinition(base, COMMUNICATIONS_FRAMING_VERSION).version))
      .toEqual([21, 22, 23, 24].map(version => `blueprint.communications-definition.v${version}`));
    expect(COMMUNICATIONS_LAUNCH_GUIDANCE_V1).toContain("when a match is found");
    expect(COMMUNICATIONS_LAUNCH_GUIDANCE).toContain("only when the site books Blueprint's recommended pilot");
    expect(COMMUNICATIONS_LAUNCH_GUIDANCE).not.toContain("when a match is found");
  });
  it.each([false, true])("sends the real assembled founder guidance to the generator, hypothesis=%s", async hypothesis => {
    const fixture = hypothesis ? founderOutreachFixture("future") : communicationsFixture();
    (fixture.output.outreachContract as any).version = hypothesis ? "blueprint.outreach.v5" : "blueprint.outreach.v6";
    const f = apiFixture({ rawOutput: JSON.stringify(fixture.output) }), { brief } = fixture;
    const input = buildCommunicationsInput(brief, null, "outreach", "pending_approval", undefined, undefined,
      COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE, COMMUNICATIONS_FRAMING_VERSION, undefined, undefined, COMMUNICATIONS_PERSONALIZED_PROFILE);
    const historicalInput = JSON.parse(buildCommunicationsInput(brief, null, "outreach", "pending_approval", undefined, undefined,
      COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE, COMMUNICATIONS_FRAMING_VERSION));
    expect(historicalInput.firstTouchPolicy).toContain(LEGACY_COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
    expect(historicalInput.firstTouchFraming.guidance).not.toBe(COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
    const result = await f.api.run({ ...f.params, input, checkpoint: { ...f.params.checkpoint,
      framingVersion: COMMUNICATIONS_FRAMING_VERSION, writingProfile: COMMUNICATIONS_PERSONALIZED_PROFILE,
      ...(hypothesis ? { draftProfile: COMMUNICATIONS_HYPOTHESIS_PROFILE } : {}) } });
    const posted = JSON.parse(String(f.calls.find(call => call.init.method === "POST")!.init.body));
    expect(posted.input).toBe(input);
    const consumed = JSON.parse(posted.input);
    expect(consumed.researchBrief).toEqual(brief);
    expect(consumed.writingGuidance).toBe(COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
    expect(consumed.firstTouchPolicy).not.toContain("Learn why in a follow-up");
    expect(consumed.firstTouchPolicy).toContain("discovery-first");
    expect(consumed.firstTouchFraming.questionIsSuggestion).toBe(true);
    expect(consumed.firstTouchFraming).not.toHaveProperty("question");
    expect(consumed.firstTouchPolicy).toContain("recipient-aware-writing-v4");
    if (hypothesis) {
      expect(posted.agent.instructions).not.toContain(LEGACY_COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
      expect(consumed.firstTouchPolicy).toContain(COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
      expect(posted.agent.instructions).toContain('version:"blueprint.outreach.v5"');
      expect(posted.agent.instructions).toContain("may overlap");
      expect(result.outputSource?.definitionVersion).toBe("blueprint.communications-definition.v29");
    }
    expect(posted.agent.instructions).toContain(COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE);
    expect(posted.agent.instructions).not.toContain('Introduce "I\'m building Blueprint"');
    expect(posted.metadata.blueprint_communications_writing_profile).toBe(COMMUNICATIONS_PERSONALIZED_PROFILE);
    expect(f.reservePaidDraft).toHaveBeenCalledOnce(); // Mock admission only; no provider/spend.
    expect(result.checkpoint.requestDigest).toBe(posted.metadata.blueprint_communications_request_digest);
    expect(result.output).toEqual(fixture.output);
  });
  it.each([null, false, "blueprint.outreach-framing.v4", "", {}])("rejects unsupported framing %j before provider or paid admission", async framingVersion => {
    const f = apiFixture(), checkpoint = { ...hypothesisCheckpoint(), framingVersion } as any;
    await expect(f.api.run({ ...f.params, checkpoint })).rejects.toThrow("communications_framing_version_unsupported");
    await expect(f.api.reconcileSaved(checkpoint, f.params.jobId)).rejects.toThrow("communications_framing_version_unsupported");
    await expect(f.api.verifyExistingDraftSession(checkpoint, f.params.jobId, "a".repeat(64))).rejects.toThrow("communications_framing_version_unsupported");
    expect(f.fetchMock).not.toHaveBeenCalled(); expect(f.reservePaidDraft).not.toHaveBeenCalled();
  });
  it("uses the Gmail-read definition plus the same paragraph when the saved agent carries the owner's Gmail connection", async () => {
    const f = apiFixture();
    (f.savedAgent as any).tools = [{ type: "mcp", server_label: "gmail", credential_id: "synthetic-owner-credential",
      transport: { type: "http", server_url: "https://gmailmcp.googleapis.com/mcp/v1", headers: {} }, request_metadata: {},
      allowed_tools: null, required: false, connection_origin: "service" }];
    const baseline = f.fetchMock.getMockImplementation()!;
    f.fetchMock.mockImplementation(async (url: any, init: any) => {
      const path = new URL(String(url)).pathname + new URL(String(url)).search;
      if (path.startsWith("/v1/vaults?")) return Response.json({ data: [{ id: "vault_mock_gmail", object: "vault" }], has_more: false });
      if (path.startsWith("/v1/vaults/vault_mock_gmail/credentials?")) return Response.json({ data: [{
        id: "synthetic-owner-credential", object: "vault.credential", vault_id: "vault_mock_gmail" }], has_more: false });
      return baseline(url, init);
    });
    await f.api.run({ ...f.params, checkpoint: hypothesisCheckpoint() as any });
    const body = JSON.parse(String(f.calls.find(call => call.init.method === "POST")!.init.body));
    const definition = communicationsHypothesisDefinition(COMMUNICATIONS_GMAIL_READ_DEFINITION);
    expect(definition.version).toBe("blueprint.communications-definition.v10");
    expect(body.agent.instructions).toBe(definition.instructions);
    expect(body.metadata).toMatchObject({ blueprint_communications_definition: definition.version, blueprint_communications_mcp_profile: "mcp-vault-read-v1" });
    expect(body.vault_ids).toEqual(["vault_mock_gmail"]);
  });
  it("maps every current base definition to its own hypothesis definition, and no archived one", () => {
    expect([COMMUNICATIONS_HISTORY_DEFINITION, COMMUNICATIONS_GMAIL_READ_DEFINITION, COMMUNICATIONS_GMAIL_NOTION_READ_DEFINITION,
      COMMUNICATIONS_GMAIL_NOTION_FIREBASE_READ_DEFINITION].map(base => communicationsHypothesisDefinition(base).version))
      .toEqual(["v9", "v10", "v11", "v12"].map(version => `blueprint.communications-definition.${version}`));
    for (const archived of [LEGACY_COMMUNICATIONS_DEFINITION, COMMUNICATIONS_V2_DEFINITION, COMMUNICATIONS_V3_DEFINITION, COMMUNICATIONS_DEFINITION]) {
      expect(() => communicationsHypothesisDefinition(archived)).toThrow("communications_hypothesis_definition_unavailable");
    }
  });
  it.each<[string, boolean, (instructions: string) => string]>([
    ["a hypothesis session reported without its paragraph", true, () => COMMUNICATIONS_HISTORY_DEFINITION.instructions],
    ["a verified session reported with the hypothesis paragraph", false, instructions => communicationsHypothesisDefinition(COMMUNICATIONS_HISTORY_DEFINITION).instructions
      .replace(COMMUNICATIONS_HISTORY_DEFINITION.instructions, instructions)],
  ])("refuses %s", async (_name, hypothesis, rewrite) => {
    const f = apiFixture();
    reportInstructions(f, rewrite);
    await expect(f.api.run({ ...f.params, checkpoint: (hypothesis ? hypothesisCheckpoint() : f.params.checkpoint) as any }))
      .rejects.toMatchObject({ code: "agents_existing_session_history_binding_mismatch" });
  });
  it("refuses an unknown draft profile before reserving or creating a session", async () => {
    const f = apiFixture();
    await expect(f.api.run({ ...f.params, checkpoint: { createClaimedAt: null, sessionId: null, turnId: null, draftProfile: "send-capable-v1" } as any }))
      .rejects.toMatchObject({ code: "communications_draft_profile_unsupported" });
    expect(f.reservePaidDraft).not.toHaveBeenCalled();
    expect(f.calls.every(call => call.init.method !== "POST")).toBe(true);
  });
  it("keeps the operator recovery lanes closed to hypothesis sessions", async () => {
    const f = apiFixture();
    const checkpoint = { createClaimedAt: "2026-09-30T23:00:00Z", sessionId: null, turnId: null, requestDigest: "a".repeat(64),
      draftProfile: COMMUNICATIONS_HYPOTHESIS_PROFILE } as any;
    await expect(f.api.recoverRejectedCreate({ ...f.params, checkpoint, intent: { ownerDirectionRef: "synthetic", briefDigest: "b".repeat(64),
      deliveryKey: "synthetic" }, assertRepairAllowed: vi.fn() })).rejects.toMatchObject({ code: "communications_hypothesis_recovery_unsupported" });
    await expect(f.api.prepareCancelledContinuation({ jobId: "job-1", prospectId: "prospect-1", briefDigest: "b".repeat(64),
      checkpoint: { ...checkpoint, sessionId: "session-1", turnId: "turn-1" } }, { uri: "gs://synthetic", generation: "1", sha256: "c".repeat(64) } as any))
      .rejects.toMatchObject({ code: "communications_hypothesis_recovery_unsupported" });
    expect(f.calls).toEqual([]);
  });
});
