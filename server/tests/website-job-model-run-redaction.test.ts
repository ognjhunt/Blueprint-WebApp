// @vitest-environment node
/**
 * A withdrawal also redacts the job's stored model runs, sessions, runtime events, checkpoints and action logs, in
 * the form `persist_content: "redacted"` writes, keeping cost, usage, model, provider, status, timings, failover and
 * ids exactly. Fake store, fake evidence storage, fake bucket; nothing leaves this process.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore } from "./helpers/fake-firestore";

const evidence = vi.hoisted(() => ({ objects: new Map<string, string>(), reads: 0, readNames: [] as string[], unavailable: false,
  failReads: new Set<string>() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => evidence.unavailable ? null : ({ bucketName: "fake-bucket",
  info: async (name: string) => evidence.objects.has(name)
    ? { generation: "1", size: Buffer.byteLength(evidence.objects.get(name)!, "utf8") } : null,
  readText: async (name: string) => {
    evidence.reads++; evidence.readNames.push(name);
    if (evidence.failReads.has(name)) throw Object.assign(new Error("backend"), { code: 503 });
    return evidence.objects.get(name) ?? null;
  },
  createOnly: async (name: string, content: string) => { if (evidence.objects.has(name)) return "exists"; evidence.objects.set(name, content); return "created"; },
}) }));

import { MODEL_RUN_REDACTION_FIELD, MODEL_RUN_REDACTION_PENDING, RUN_HORIZON_MS, resetWebsiteJobModelRunRedactionCursorsForTests,
  runWebsiteJobModelRunRedactions } from "../utils/websiteJobModelRunRedaction";
import { agentEvidencePrefix, hydrateAgentEvidence, persistAgentEvidence, projectAgentEvidence } from "../agents/private-evidence";
import { fitsStore, redactWithdrawnRecord } from "../agents/withdrawal-redaction";
import { extractAgentCostTelemetry, summarizeAgentCostTelemetry, summarizeAgentCostWaste,
  summarizeRollingAgentSpend } from "../utils/agentCostTelemetry";

const MARK = "WITHDRAWN-SITE-TEXT-7c1e";
const OTHER = "OTHER-JOB-TEXT-2b9d";
const REQUESTED_AT = Date.parse("2026-11-13T10:00:00Z");
const HOUR = 60 * 60 * 1000;
let clock: number;
const bucketDeletes: string[] = [];
const failingDeletes = { count: 0 };
const listing = { honoursMaxResults: false };
const bucket = {
  // Like the real client with autoPaginate:false: one page of at most maxResults, and a next query with a page token.
  getFiles: async (options: Record<string, any>) => {
    const all = [...evidence.objects.keys()].filter(name => name.startsWith(options.prefix)).sort();
    if (!listing.honoursMaxResults) return [all.map(name => ({ name, metadata: { generation: "1" } })), null] as [any[], any];
    const start = Number(options.pageToken || 0), size = Number(options.maxResults || all.length);
    const next = start + size < all.length ? { ...options, pageToken: String(start + size) } : null;
    return [all.slice(start, start + size).map(name => ({ name, metadata: { generation: "1" } })), next] as [any[], any];
  },
  file: (name: string) => ({ delete: async () => {
    if (failingDeletes.count > 0) { failingDeletes.count--; throw Object.assign(new Error("backend"), { code: 503 }); }
    bucketDeletes.push(name); evidence.objects.delete(name); } }),
};
const deps = (extra: Record<string, unknown> = {}) => ({ now: () => clock, bucket, bucketName: "fake-bucket", ...extra });
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const usage = { prompt_tokens: 1500, completion_tokens: 100, total_tokens: 1600, cached_tokens: 0 };
const accounting = {
  usage,
  inference_reservation: { max_output_tokens: 600, projected_max_cost_per_call_usd: 0.0123, reconciled_cost_usd: 0.004 },
  provider_failover: { from_provider: "openai_responses", from_model: "gpt-6-luna", to_provider: "anthropic_agent_sdk",
    to_model: "claude-haiku-5-5", trigger: "no_funds", error: { error_class: "no_funds", http_status: 429,
      error_type: "insufficient_quota", error_code: "insufficient_quota" }, skipped: [{ provider: "codex_local", reason: "run_cap_not_enforced" }] },
  usage_samples: [{ estimated_total_cost_usd: 0.004, prompt_tokens: 1500, model: "claude-haiku-5-5" }],
};
const costTelemetry = { provider: "anthropic_agent_sdk", model: "claude-haiku-5-5", prompt_tokens: 1500, cost_estimate_usd: 0.004,
  spend_accounting_status: "complete" };
function run(id: string, fields: Record<string, unknown>, text = MARK) {
  return { id, task_kind: "site_task_brief_reading", provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk",
    model: "claude-haiku-5-5", status: "completed", dispatch_mode: "direct", requires_human_review: false,
    created_at: "2026-11-13T09:00:00.000Z", updated_at: "2026-11-13T09:01:00.000Z", started_at: "2026-11-13T09:00:01.000Z",
    completed_at: "2026-11-13T09:01:00.000Z",
    input: { kind: "site_task_brief_reading", input: { requestId: "x", taskStatement: `Move totes ${text} to the dock`,
      taskVideoUrl: `https://example.com/${text}.mp4`, contact: { name: `Dana ${text}`, email: `${text}@example.com` } } },
    output: { brief: `A brief about ${text}` }, raw_output_text: `{"brief":"${text}"}`,
    error: `provider said: could not read ${text}`, approval_reason: null,
    logs: [{ event_type: "provider.request.prepared", status: "info", summary: `Prepared ${text}`, detail: text }],
    artifacts: { ...structuredClone(accounting), provider_responses: [{ response_id: "resp_1", content: [{ type: "text", text }], usage }] },
    tool_policy: { mode: "api" }, approval_policy: { mode: "never", sensitive_actions: [] },
    metadata: { cost_telemetry: costTelemetry }, ...fields };
}
function offloaded(id: string, fields: Record<string, unknown>, text = MARK) {
  const full = run(id, fields, text);
  const payloadFields = ["input", "output", "raw_output_text", "artifacts", "logs", "metadata", "error"];
  const payload = Object.fromEntries(payloadFields.map(field => [field, (full as any)[field]]));
  const content = JSON.stringify({ version: 1, collection: "agentRuns", id, payload });
  const digest = sha(content);
  const object = `agent-runtime-evidence/v1/agentRuns/${sha(id)}/${digest}.json`;
  evidence.objects.set(object, content);
  const stub: Record<string, unknown> = { ...full, agent_evidence_ref: { version: 1, collection: "agentRuns", id, bucket: "fake-bucket",
    object, sha256: digest, bytes: Buffer.byteLength(content, "utf8"), generation: "1", fields: payloadFields },
    agent_evidence_accounting_sha256: digest };
  for (const field of payloadFields) stub[field] = null;
  stub.metadata = { cost_telemetry: costTelemetry };
  return { stub, object };
}

function seedWithdrawn(requestId = "req1", extra: Record<string, unknown> = {}) {
  state.docs.set(`inboundRequests/${requestId}`, { consent_revoked: true, captureWithdrawalPending: false,
    capture_withdrawal: { requestedAtIso: new Date(REQUESTED_AT).toISOString(), requestId, sceneId: `site-${requestId}`,
      captureId: `walkthrough-${requestId}`, state: "deleted", pipelineAcknowledged: true }, ...extra });
}
let offloadedObject = "";
function seedRows() {
  state.docs.set("agentRuns/run-bound", run("run-bound", { privacy_request_binding: { request_id: "req1" }, session_id: "sess-1",
    session_key: "session:staff" }));
  state.docs.set("agentRuns/run-metadata-only", run("run-metadata-only", { metadata: { request_id: "req1", cost_telemetry: costTelemetry } }));
  const { stub, object } = offloaded("run-offloaded", { session_key: "inbound:req1" });
  offloadedObject = object;
  state.docs.set("agentRuns/run-offloaded", stub);
  state.docs.set("agentRuns/run-footage", run("run-footage", { task_kind: "site_video_evidence", provider: "gemini_video",
    session_key: "capture_review:walkthrough-req1", metadata: { capture_id: "walkthrough-req1", cost_telemetry: costTelemetry } }));
  state.docs.set("agentSessions/sess-1", { id: "sess-1", task_kind: "support_triage", provider: "openai_responses", runtime: "openai_responses",
    status: "idle", title: `About ${MARK}`, session_key: "session:staff", created_at: "2026-11-13T08:00:00.000Z",
    updated_at: "2026-11-13T09:00:00.000Z", last_run_id: "run-bound", metadata: { note: MARK, openai_replay_input: [{ content: MARK }] } });
  state.docs.set("agentRuntimeEvents/ev-1", { id: "ev-1", session_id: "sess-1", run_id: "run-bound", kind: "provider.request.prepared",
    status: "info", summary: `Asked about ${MARK}`, detail: MARK, metadata: { log: MARK }, created_at: "2026-11-13T09:00:02.000Z" });
  state.docs.set("agentCheckpoints/cp-1", { id: "cp-1", session_id: "sess-1", run_id: "run-bound", session_key: "session:staff",
    label: `Before ${MARK}`, trigger: "run.pending_approval", replayable: true, snapshot: { task: { input: { text: MARK } } },
    created_at: "2026-11-13T09:00:03.000Z" });
  state.docs.set("agentCompactions/comp-1", { id: "comp-1", source_session_id: "sess-1", source_run_id: "run-bound",
    summary: `Compacted ${MARK}`, created_at: "2026-11-13T09:05:00.000Z" });
  state.docs.set("opsActionLogs/log-1", { id: "log-1", run_id: "run-bound", action_key: "agent.run.completed", status: "completed",
    summary: `Done with ${MARK}`, metadata: { error: MARK }, provider: "anthropic_agent_sdk", task_kind: "site_task_brief_reading",
    latency_ms: 1200 });
  // Another job's rows, and a staff session's event that is not this job's.
  state.docs.set("agentRuns/run-other", run("run-other", { privacy_request_binding: { request_id: "req2" },
    metadata: { request_id: "req2", cost_telemetry: costTelemetry } }, OTHER));
  state.docs.set("agentRuntimeEvents/ev-other", { id: "ev-other", session_id: "sess-other", run_id: "run-other", kind: "x",
    status: "info", summary: OTHER, metadata: {} });
}
const JOB_ROWS = ["agentRuns/run-bound", "agentRuns/run-metadata-only", "agentRuns/run-offloaded", "agentRuns/run-footage",
  "agentSessions/sess-1", "agentRuntimeEvents/ev-1", "agentCheckpoints/cp-1", "agentCompactions/comp-1", "opsActionLogs/log-1"];
const redaction = (requestId = "req1") => state.docs.get(`inboundRequests/${requestId}`)?.[MODEL_RUN_REDACTION_FIELD] as any;
const receipts = () => [...state.docs.entries()].filter(([key]) => key.startsWith("websiteCaptureModelRunRedactionReceipts/"))
  .map(([, value]) => value as any);
async function tickUntilDone(extra: Record<string, unknown> = {}, ticks = 30) {
  for (let i = 0; i < ticks && redaction()?.phase !== "done"; i++) {
    await runWebsiteJobModelRunRedactions({ deps: deps(extra) });
    clock += 1000;
  }
}
const money = (row: any) => ({ status: row.status, model: row.model, provider: row.provider, runtime: row.runtime,
  created_at: row.created_at, started_at: row.started_at, completed_at: row.completed_at, task_kind: row.task_kind,
  usage: row.artifacts?.usage, inference_reservation: row.artifacts?.inference_reservation,
  provider_failover: row.artifacts?.provider_failover, usage_samples: row.artifacts?.usage_samples,
  provider_responses_usage: row.artifacts?.provider_responses?.map((entry: any) => [entry.response_id, entry.usage]),
  cost_telemetry: row.metadata?.cost_telemetry, binding: row.privacy_request_binding ?? null, session_id: row.session_id ?? null });

beforeEach(() => {
  state.docs.clear(); evidence.objects.clear(); bucketDeletes.length = 0; failingDeletes.count = 0;
  evidence.reads = 0; evidence.readNames.length = 0; evidence.unavailable = false; evidence.failReads.clear();
  listing.honoursMaxResults = false;
  resetWebsiteJobModelRunRedactionCursorsForTests();
  clock = REQUESTED_AT + RUN_HORIZON_MS + HOUR;
});

describe("a withdrawal redacts the job's stored model runs", () => {
  it("leaves no trace of the job's text in any of its rows, keeps the money fields exactly, and touches no other job", async () => {
    seedWithdrawn(); seedRows();
    const otherBefore = structuredClone([state.docs.get("agentRuns/run-other"), state.docs.get("agentRuntimeEvents/ev-other")]);
    const { hydrateAgentEvidence } = await import("../agents/private-evidence");
    const before = Object.fromEntries(await Promise.all(["run-bound", "run-metadata-only", "run-offloaded", "run-footage"].map(async id =>
      [id, money(await hydrateAgentEvidence(state.docs.get(`agentRuns/${id}`), { collection: "agentRuns", id }))])));
    await tickUntilDone();
    expect(redaction()).toMatchObject({ phase: "done", redacted: { agentRuns: 4, agentSessions: 1, agentRuntimeEvents: 1,
      agentCheckpoints: 1, agentCompactions: 1, opsActionLogs: 1 } });
    expect(state.docs.get("inboundRequests/req1")?.[MODEL_RUN_REDACTION_PENDING]).toBe(false);
    for (const key of JOB_ROWS) {
      const row = state.docs.get(key);
      expect(row, key).toBeDefined();
      expect(JSON.stringify(row), key).not.toContain(MARK);
      expect(JSON.stringify(row), key).not.toContain("example.com");
      expect(row?.withdrawal_redaction, key).toMatchObject({ request_id: "req1" });
    }
    for (const id of Object.keys(before)) expect(money(state.docs.get(`agentRuns/${id}`)), id).toEqual(before[id]);
    // Found only by the caller-set metadata.request_id, and still redacted.
    expect(state.docs.get("agentRuns/run-metadata-only")?.privacy_request_binding).toBeUndefined();
    // The offloaded row's private evidence object is gone, and the row holds its redacted content inline.
    expect(evidence.objects.has(offloadedObject)).toBe(false);
    expect(bucketDeletes).toEqual([offloadedObject]);
    expect(state.docs.get("agentRuns/run-offloaded")?.agent_evidence_ref).toBeNull();
    expect(state.docs.get("agentRuns/run-offloaded")?.output).toMatchObject({ brief: { redacted: true } });
    expect([state.docs.get("agentRuns/run-other"), state.docs.get("agentRuntimeEvents/ev-other")]).toEqual(otherBefore);
    // Receipts carry counts only.
    expect(receipts().at(-1)).toMatchObject({ outcome: "complete", request_id: "req1" });
    for (const receipt of receipts()) expect(JSON.stringify(receipt)).not.toContain(MARK);
  });

  it("finishes over several bounded passes, and the receipt is complete only after the last", async () => {
    seedWithdrawn();
    for (let i = 0; i < 7; i++) state.docs.set(`agentRuns/run-${i}`, run(`run-${i}`, { privacy_request_binding: { request_id: "req1" } }));
    await runWebsiteJobModelRunRedactions({ deps: deps({ maxRecordsPerPass: 3 }) });
    expect(redaction().phase).not.toBe("done");
    expect(receipts().map(receipt => receipt.outcome)).toEqual(["partial"]);
    expect(state.docs.get("inboundRequests/req1")?.[MODEL_RUN_REDACTION_PENDING]).toBe(true);
    await tickUntilDone({ maxRecordsPerPass: 3 });
    const outcomes = receipts().sort((a, b) => a.pass - b.pass).map(receipt => receipt.outcome);
    expect(outcomes.length).toBeGreaterThan(2);
    expect(outcomes.slice(0, -1).every(outcome => outcome === "partial")).toBe(true);
    expect(outcomes.at(-1)).toBe("complete");
    for (let i = 0; i < 7; i++) expect(JSON.stringify(state.docs.get(`agentRuns/run-${i}`))).not.toContain(MARK);
    expect(redaction().redacted.agentRuns).toBe(7);
  });

  it("never stores the content of a run that finishes after the pass, and sweeps again after the horizon", async () => {
    clock = REQUESTED_AT + HOUR;
    seedWithdrawn();
    state.docs.set("agentRuns/run-inflight", run("run-inflight", { privacy_request_binding: { request_id: "req1" }, status: "running",
      output: null, raw_output_text: null, completed_at: null }));
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction()).toMatchObject({ phase: "final_sweep" });
    expect(receipts().map(receipt => receipt.outcome)).toEqual(["awaiting_horizon"]);
    // The run finishes now, through the runtime's evidence writer.
    const ref = sharedFakeFirestore.collection("agentRuns").doc("run-inflight");
    await persistAgentEvidence(ref, { collection: "agentRuns", id: "run-inflight" }, { status: "completed",
      output: { brief: `late ${MARK}` }, raw_output_text: `late ${MARK}`, error: null,
      logs: [{ event_type: "provider.response.received", summary: `late ${MARK}` }],
      artifacts: { usage, provider_responses: [{ response_id: "late", content: MARK, usage }] } }, sharedFakeFirestore);
    const finished = state.docs.get("agentRuns/run-inflight") as any;
    expect(finished.status).toBe("completed");
    expect(finished.artifacts.usage).toEqual(usage);
    expect(JSON.stringify(finished)).not.toContain(MARK);
    // A row the job wrote after the first pass is found by the sweep after the horizon.
    state.docs.set("agentRuns/run-late", run("run-late", { metadata: { request_id: "req1" } }));
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction().phase).toBe("final_sweep");
    clock = REQUESTED_AT + RUN_HORIZON_MS + 1;
    await tickUntilDone();
    expect(redaction().phase).toBe("done");
    expect(JSON.stringify(state.docs.get("agentRuns/run-late"))).not.toContain(MARK);
  });

  it("finishes a job withdrawn before this change once, with the marker, and a second tick does nothing", async () => {
    seedWithdrawn(); seedRows();
    expect(redaction()).toBeUndefined();
    await tickUntilDone();
    expect(redaction()).toMatchObject({ phase: "done" });
    const snapshot = structuredClone([...state.docs.entries()]);
    clock += HOUR;
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect([...state.docs.entries()]).toEqual(snapshot);
  });

  it("redacts only jobs whose site withdrew", async () => {
    seedRows();
    state.docs.set("inboundRequests/req1", { consent_revoked: false });
    state.docs.set("inboundRequests/req2", { consent_revoked: true });
    const rows = () => [...state.docs.entries()].filter(([key]) => !key.startsWith("websiteMaintenance/"));
    const before = structuredClone(rows());
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(rows()).toEqual(before);
  });
});

describe("the withdrawal's own gate", () => {
  it("redacts nothing under a legal hold, says so, and runs once the hold is lifted", async () => {
    seedWithdrawn("req1"); seedRows();
    (state.docs.get("inboundRequests/req1") as any).capture_withdrawal.legalHold = true;
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction()).toMatchObject({ held: true, phase: "pending", redacted: { agentRuns: 0 } });
    expect(JSON.stringify(state.docs.get("agentRuns/run-bound"))).toContain(MARK);
    // A hold that arrives later stops further passes too.
    (state.docs.get("inboundRequests/req1") as any).capture_withdrawal.legalHold = false;
    redaction().nextAttemptAtMs = 0;
    await runWebsiteJobModelRunRedactions({ deps: deps({ maxRecordsPerPass: 1 }) });
    expect(redaction().held).toBe(false);
    (state.docs.get("inboundRequests/req1") as any).capture_withdrawal.legalHold = true;
    const snapshot = structuredClone(state.docs.get("agentRuns/run-metadata-only"));
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction().held).toBe(true);
    expect(state.docs.get("agentRuns/run-metadata-only")).toEqual(snapshot);
    (state.docs.get("inboundRequests/req1") as any).capture_withdrawal.legalHold = false;
    redaction().nextAttemptAtMs = 0;
    await tickUntilDone();
    expect(redaction().phase).toBe("done");
  });

  it("waits, like the object deletion, for the acknowledgement or its timeout", async () => {
    clock = REQUESTED_AT + 40 * 60 * 1000; // upload targets expired, no acknowledgement, before the timeout
    seedWithdrawn(); seedRows();
    (state.docs.get("inboundRequests/req1") as any).capture_withdrawal.pipelineAcknowledged = false;
    await runWebsiteJobModelRunRedactions({ deps: deps({ ackTimeoutMs: 2 * HOUR }) });
    expect(JSON.stringify(state.docs.get("agentRuns/run-bound"))).toContain(MARK);
    expect(redaction()).toMatchObject({ held: false, nextAttemptAtMs: REQUESTED_AT + 50 * 60 * 1000 });
    clock = REQUESTED_AT + 2 * HOUR + 1;
    redaction().nextAttemptAtMs = 0;
    await runWebsiteJobModelRunRedactions({ deps: deps({ ackTimeoutMs: 2 * HOUR }) });
    expect(JSON.stringify(state.docs.get("agentRuns/run-bound"))).not.toContain(MARK);
  });
});

describe("no evidence object of a redacted row survives", () => {
  function storeObject(collection: string, id: string, text: string) {
    const name = `${agentEvidencePrefix({ collection: collection as any, id })}${sha(text)}.json`;
    evidence.objects.set(name, JSON.stringify({ version: 1, collection, id, payload: { input: text } }));
    return name;
  }
  it("deletes every earlier object of an offloaded row, not only the one it points to", async () => {
    seedWithdrawn(); seedRows();
    const earlier = storeObject("agentRuns", "run-offloaded", `created with ${MARK}`);
    const sessionEarlier = storeObject("agentSessions", "sess-1", `an earlier save of ${MARK}`);
    await tickUntilDone();
    expect(redaction().phase).toBe("done");
    for (const name of [earlier, sessionEarlier, offloadedObject]) expect(evidence.objects.has(name), name).toBe(false);
    for (const [name, content] of evidence.objects) expect(content, name).not.toContain(MARK);
  });

  it("keeps the job pending while a delete fails, and finishes it on a later pass", async () => {
    seedWithdrawn(); seedRows();
    failingDeletes.count = 1;
    await tickUntilDone();
    // A delete failed: the sweep is not clean, so the job is not done, however much else succeeded.
    expect(state.docs.get("agentRuns/run-offloaded")?.withdrawal_redaction).toBeDefined();
    expect(redaction().phase).not.toBe("done");
    expect(receipts().some(receipt => receipt.evidence_objects_remaining > 0)).toBe(true);
    clock += 10 * 60 * 1000;
    for (let i = 0; i < 10 && redaction().phase !== "done"; i++) {
      redaction().nextAttemptAtMs = 0; await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
    expect(redaction().phase).toBe("done");
    expect(evidence.objects.has(offloadedObject)).toBe(false);
    const outcomes = receipts().sort((a, b) => a.pass - b.pass).map(receipt => receipt.outcome);
    expect(outcomes).toContain("sweep_repeated");
    expect(outcomes.at(-1)).toBe("complete");
  });
});

describe("one row never stops the job", () => {
  it("redacts a row whose evidence cannot be read as it stands, and counts it", async () => {
    seedWithdrawn(); seedRows();
    evidence.objects.delete(offloadedObject);
    await tickUntilDone();
    expect(redaction()).toMatchObject({ phase: "done", evidence_unreadable: 1 });
    expect(state.docs.get("agentRuns/run-offloaded")?.withdrawal_redaction).toBeDefined();
  });

  it("keeps the structure of a large or awkwardly shaped row through the runtime's projection", async () => {
    seedWithdrawn();
    state.docs.set("agentRuns/run-grid", run("run-grid", { privacy_request_binding: { request_id: "req1" },
      input: { grid: [[`a ${MARK}`, "b"], ["c", "d"]] } }));
    await tickUntilDone();
    const full = await hydrateAgentEvidence(state.docs.get("agentRuns/run-grid"), { collection: "agentRuns", id: "run-grid" }) as any;
    expect(full.input.grid).toHaveLength(2);
    expect(full.input.grid[0][0]).toMatchObject({ redacted: true });
    expect(full.artifacts.usage).toEqual(usage);
  });

  it("collapses what does not fit in a row that has no evidence storage", async () => {
    seedWithdrawn(); seedRows();
    state.docs.set("agentCompactions/comp-grid", { id: "comp-grid", source_session_id: "sess-1",
      summary: { turns: [[`a ${MARK}`], ["b"]] }, words: Array.from({ length: 60_000 }, (_, i) => `w${i}`) });
    await tickUntilDone();
    const stored = state.docs.get("agentCompactions/comp-grid");
    expect(fitsStore(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(MARK);
  });

  it.each([
    ["nested arrays", () => ({ input: { grid: [[`a ${MARK}`, "b"], ["c", "d"]] } })],
    ["depth 20", () => { let deep: any = `leaf ${MARK}`; for (let i = 0; i < 18; i++) deep = { n: deep }; return { input: deep }; }],
    ["60,000 short strings", () => ({ input: { words: Array.from({ length: 60_000 }, (_, i) => `w${i}`) }, output: MARK })],
  ])("stores a redacted row that fits the store: %s", async (_name, fields) => {
    seedWithdrawn();
    state.docs.set("agentRuns/run-shape", run("run-shape", { privacy_request_binding: { request_id: "req1" }, ...fields() }));
    await tickUntilDone();
    const stored = state.docs.get("agentRuns/run-shape") as any;
    expect(stored.withdrawal_redaction).toBeDefined();
    expect(fitsStore(stored)).toBe(true);
    const full = await hydrateAgentEvidence(stored, { collection: "agentRuns", id: "run-shape" });
    expect(JSON.stringify(full)).not.toContain(MARK);
    expect(redaction().phase).toBe("done");
  });

  it("skips a row it cannot write this pass, finishes every other row, and is not complete until that one is done", async () => {
    seedWithdrawn(); seedRows();
    const { sharedFakeFirestore: store } = await import("./helpers/fake-firestore");
    const original = store.runTransaction.bind(store);
    let blocked = true;
    (store as any).runTransaction = async (fn: any) => original(async (tx: any) => fn({ ...tx,
      set: (ref: any, value: any, options?: any) => { if (blocked && ref.id === "run-metadata-only") throw new Error("refused"); return tx.set(ref, value, options); },
      get: (ref: any) => tx.get(ref) }));
    try {
      await tickUntilDone({}, 5);
      expect(redaction().phase).not.toBe("done");
      expect(JSON.stringify(state.docs.get("agentRuns/run-metadata-only"))).toContain(MARK);
      for (const key of JOB_ROWS.filter(key => key !== "agentRuns/run-metadata-only")) expect(JSON.stringify(state.docs.get(key)), key).not.toContain(MARK);
      expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
      blocked = false;
      for (let i = 0; i < 20 && redaction().phase !== "done"; i++) {
        redaction().nextAttemptAtMs = 0; await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
      }
      expect(redaction().phase).toBe("done");
      expect(JSON.stringify(state.docs.get("agentRuns/run-metadata-only"))).not.toContain(MARK);
    } finally { (store as any).runTransaction = original; }
  });
});

describe("sessions that hold more than the job", () => {
  it("redacts the conversation and the replay copies in the session's other runs, and leaves those runs' own content", async () => {
    seedWithdrawn(); seedRows();
    const staffOutput = { brief: "STAFF-OWN-OUTPUT about planning" };
    state.docs.set("agentRuns/run-staff", { ...run("run-staff", { session_id: "sess-1", session_key: "session:staff",
      metadata: { openai_replay_input: [{ role: "user", content: `earlier turn ${MARK}` }], cost_telemetry: costTelemetry } }, "STAFFTEXT"),
      output: staffOutput, input: { kind: "operator_thread", input: { message: "STAFFTEXT plan" },
        metadata: { openai_replay_input: [{ role: "user", content: `earlier turn ${MARK}` }] } } });
    state.docs.set("agentRuntimeEvents/ev-staff", { id: "ev-staff", session_id: "sess-1", run_id: "run-staff", kind: "provider.response",
      status: "info", summary: "STAFFTEXT done", metadata: { output: staffOutput }, created_at: "2026-11-13T09:10:00.000Z" });
    state.docs.set("agentRuntimeEvents/ev-session", { id: "ev-session", session_id: "sess-1", run_id: null, kind: "session.control",
      status: "info", summary: `About ${MARK}`, metadata: {} });
    const staffEventBefore = structuredClone(state.docs.get("agentRuntimeEvents/ev-staff"));
    await tickUntilDone();
    const staff = state.docs.get("agentRuns/run-staff") as any;
    expect(JSON.stringify(staff)).not.toContain(MARK);
    expect(staff.output).toEqual(staffOutput);
    expect(staff.input.input.message).toBe("STAFFTEXT plan");
    expect(staff.withdrawal_redaction).toBeUndefined();
    expect(state.docs.get("agentRuntimeEvents/ev-staff")).toEqual(staffEventBefore);
    expect(JSON.stringify(state.docs.get("agentRuntimeEvents/ev-session"))).not.toContain(MARK);
    expect(redaction().replay_copies_redacted).toBe(1);
  });
});

describe("rows found by the remaining keys", () => {
  it("finds a coverage run keyed by its review id through the capture, a retired assessment session, and an old offloaded row", async () => {
    seedWithdrawn();
    state.docs.set("agentRuns/run-coverage", run("run-coverage", { task_kind: "capture_coverage", provider: "gemini_video",
      session_key: "capture_coverage:review-77", metadata: { capture_id: "walkthrough-req1", review_id: "review-77", cost_telemetry: costTelemetry } }));
    state.docs.set("agentRuns/run-assessment", run("run-assessment", { task_kind: "site_assessment", session_key: "session:admin-1",
      input: { kind: "site_assessment", input: { context: { request_id: "req1", note: `decrypted ${MARK}` } } } }));
    state.docs.set("agentRuns/run-assessment-other", run("run-assessment-other", { task_kind: "site_assessment", session_key: "session:admin-2",
      input: { kind: "site_assessment", input: { context: { request_id: "req9", note: `decrypted ${OTHER}` } } } }, OTHER));
    // Offloaded under the old projection, which kept no request id inline.
    const legacy = await projectAgentEvidence(run("run-legacy", { task_kind: "support_triage", session_key: "session:support-1",
      metadata: { request_id: "req1", cost_telemetry: costTelemetry }, input: { big: `${MARK} `.repeat(30_000) } }),
      { collection: "agentRuns", id: "run-legacy" });
    delete (legacy.metadata as any).request_id;
    state.docs.set("agentRuns/run-legacy", legacy);
    const otherBefore = structuredClone(state.docs.get("agentRuns/run-assessment-other"));
    await tickUntilDone();
    for (const id of ["run-coverage", "run-assessment"]) expect(JSON.stringify(state.docs.get(`agentRuns/${id}`)), id).not.toContain(MARK);
    expect(state.docs.get("agentRuns/run-legacy")?.withdrawal_redaction).toMatchObject({ request_id: "req1" });
    for (const [name, content] of evidence.objects) expect(content, name).not.toContain(MARK);
    expect(state.docs.get("agentRuns/run-assessment-other")).toEqual(otherBefore);
  });

  it("keeps the request ids inline when a row is offloaded from now on", async () => {
    const projected = await projectAgentEvidence(run("run-new", { metadata: { request_id: "req1", inbound_request_id: "req1",
      cost_telemetry: costTelemetry }, input: { big: "x ".repeat(300_000) } }), { collection: "agentRuns", id: "run-new" });
    expect(projected.agent_evidence_ref).toBeTruthy();
    expect(projected.metadata).toMatchObject({ request_id: "req1", inbound_request_id: "req1" });
  });
});

describe("kept strings", () => {
  const marker = { schema_version: "website_withdrawal_content_redaction.v1" as const, request_id: "req1", redacted_at_iso: "2026-11-13T12:00:00.000Z" };
  it("keeps codes and ids, never an address, a link or free text, even under an id key", () => {
    const redacted = redactWithdrawnRecord({ id: "run-1", session_key: "free text a staff member typed",
      artifacts: { openai_response_id: "jane@example.com", record_id: "https://ex.com/x", source_id: "sha256:abc",
        provider_route: "openai>default", model: "gpt-6-luna", created_at: "2026-11-13T09:00:00.000Z" },
      input: { note: { redacted: true, chars: 1, sha256: "a".repeat(64), text: "KEPT jane@example.com" } } }, marker) as any;
    expect(redacted.session_key).toMatchObject({ redacted: true });
    expect(redacted.artifacts.openai_response_id).toMatchObject({ redacted: true });
    expect(redacted.artifacts.record_id).toMatchObject({ redacted: true });
    expect(redacted.artifacts).toMatchObject({ source_id: "sha256:abc", provider_route: "openai>default", model: "gpt-6-luna",
      created_at: "2026-11-13T09:00:00.000Z" });
    expect(JSON.stringify(redacted)).not.toContain("jane@example.com");
  });
});

describe("money readers give the same answer after redaction", () => {
  const openAiRow = (id: string, extra: Record<string, unknown> = {}) => run(id, { provider: "openai_responses", runtime: "openai_responses",
    model: "gpt-6-luna", task_kind: "inbound_qualification", privacy_request_binding: { request_id: "req1" },
    metadata: { agent_key: "inbound-qualifier", paperclip_issue_id: "BLU-12" },
    artifacts: { openai_response_id: "resp_1", usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100, cached_tokens: 200,
      cache_write_tokens: 0, estimated_total_cost_usd: 0.0021 }, usage_samples: [{ estimated_total_cost_usd: 0.0021 }],
      known_usage_subtotals: { estimated_total_cost_usd: 0.0021 }, usage_detail_status: "partial", cost_status: "estimated",
      cache_policy: { family: "inbound_v3", contract_version: "v3", status: "enabled", decision_reason: "stable_prefix_over_threshold",
        privacy_scope: "site_job", processing_region: "us" },
      cache_family: "inbound_v3", prompt_contract_version: "v3", privacy_scope: "site_job", processing_region: "us",
      cache_decision: "reusable", cache_decision_reason: "stable_prefix_over_threshold", route: "openai_direct", provider_route: "openai>default",
      inference_reservation: { reconciled_cost_status: "reserved_unknown", unknown_usage_reserved_cost_usd: 0.01 },
      provider_responses: [{ response_id: "resp_1", output: [{ text: MARK }] }] },
    logs: [{ event_type: "provider.response.created", summary: `said ${MARK}`, usage: { prompt_tokens: 1000 } }], ...extra });
  const readers = (rows: any[]) => ({
    telemetry: rows.map(row => extractAgentCostTelemetry(row)),
    summary: summarizeAgentCostTelemetry(rows),
    rolling: summarizeRollingAgentSpend(rows, { nowMs: Date.parse("2026-11-14T00:00:00Z") }),
    waste: summarizeAgentCostWaste(rows),
  });
  it("for inline OpenAI and Anthropic rows, a failover-switched run and an offloaded row", async () => {
    seedWithdrawn();
    const rows: Record<string, any> = {
      "money-openai": openAiRow("money-openai"),
      "money-unknown": openAiRow("money-unknown", { artifacts: { inference_reservation: { reconciled_cost_status: "reserved_unknown",
        unknown_usage_reserved_cost_usd: 0.02, known_reported_cost_usd: 0 }, usage_detail_status: "unknown", cost_status: "unknown" } }),
      "money-anthropic": run("money-anthropic", { privacy_request_binding: { request_id: "req1" } }),
      // Only the cache policy names the family and the reason; a reserved-unknown run counted at its worst case.
      "money-policy-only": openAiRow("money-policy-only", { artifacts: { usage: { prompt_tokens: 500, completion_tokens: 50, total_tokens: 550 },
        cache_policy: { family: "brief_v2", contract_version: "v2", decision_reason: "stable_prefix_over_threshold", status: "enabled" },
        usage_samples: [{ estimated_total_cost_usd: 0.001 }, { prompt_tokens: 500 }], known_usage_subtotals: { estimated_total_cost_usd: 0.001 },
        inference_reservation: { reconciled_cost_status: "includes_worst_case_reservations", known_reported_cost_usd: 0.001,
          unknown_usage_reserved_cost_usd: 0.004, reconciled_cost_usd: 0.005, projected_max_cost_per_call_usd: 0.004 },
        cost_status: "unknown", usage_detail_status: "partial" } }),
    };
    for (const [id, row] of Object.entries(rows)) state.docs.set(`agentRuns/${id}`, row);
    const big = openAiRow("money-offloaded", { input: { big: `${MARK} `.repeat(30_000) } });
    big.metadata = { ...big.metadata, cost_telemetry: extractAgentCostTelemetry(big as any) };
    state.docs.set("agentRuns/money-offloaded", await projectAgentEvidence(big, { collection: "agentRuns", id: "money-offloaded" }));
    const ids = [...Object.keys(rows), "money-offloaded"];
    const load = async () => Promise.all(ids.map(async id => ({ ...(await hydrateAgentEvidence(state.docs.get(`agentRuns/${id}`),
      { collection: "agentRuns", id })), id })));
    const before = readers(await load());
    await tickUntilDone();
    for (const id of ids) expect(JSON.stringify(state.docs.get(`agentRuns/${id}`)), id).not.toContain(MARK);
    const after = readers(await load());
    expect(after).toEqual(before);
  });
});

describe("round 3", () => {
  const examined = () => receipts().reduce((sum, receipt) => sum + receipt.rows_examined, 0);
  async function otherJobsOffloaded(count: number) {
    for (let i = 0; i < count; i++) {
      const id = `other-off-${String(i).padStart(4, "0")}`;
      state.docs.set(`agentRuns/${id}`, await projectAgentEvidence(run(id, { metadata: { request_id: `other-${i}`, cost_telemetry: costTelemetry },
        input: { big: `${OTHER} `.repeat(30_000) } }, OTHER), { collection: "agentRuns", id }));
    }
  }

  it("reads the same for a withdrawal whatever the number of other jobs' inline rows, and scans offloaded rows once", async () => {
    const measure = async (inlineOthers: number) => {
      state.docs.clear(); evidence.objects.clear(); evidence.reads = 0; resetWebsiteJobModelRunRedactionCursorsForTests();
      clock = REQUESTED_AT + RUN_HORIZON_MS + HOUR;
      seedWithdrawn(); seedRows();
      for (let i = 0; i < inlineOthers; i++) state.docs.set(`agentRuns/other-inline-${i}`, run(`other-inline-${i}`,
        { task_kind: i % 2 ? "support_triage" : "operator_thread", metadata: { request_id: `other-${i}` } }, OTHER));
      await otherJobsOffloaded(5);
      evidence.reads = 0;
      await tickUntilDone();
      expect(redaction().phase).toBe("done");
      return { examined: examined(), evidenceReads: evidence.reads };
    };
    const none = await measure(0);
    const many = await measure(1000);
    expect(many).toEqual(none);
  }, 60_000);

  it("does not scan again on a repeated sweep or the final sweep", async () => {
    clock = REQUESTED_AT + 3 * HOUR; // before the horizon: a first sweep, then the final one
    seedWithdrawn(); seedRows();
    await otherJobsOffloaded(5);
    failingDeletes.count = 1; // the first sweep repeats
    evidence.reads = 0; evidence.readNames.length = 0;
    for (let i = 0; i < 30; i++) { redaction() && (redaction().nextAttemptAtMs = 0); await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000; }
    expect(redaction().scans).toMatchObject({ offloaded: { done: true }, site_assessment: { done: true } });
    const readsAfterFirst = evidence.reads;
    expect(receipts().some(receipt => receipt.outcome === "sweep_repeated")).toBe(true);
    clock = REQUESTED_AT + RUN_HORIZON_MS + 1;
    redaction().nextAttemptAtMs = 0;
    await tickUntilDone();
    expect(redaction().phase).toBe("done");
    // The other jobs' five offloaded rows were each downloaded exactly once in all, though the first sweep repeated.
    expect(evidence.reads).toBe(readsAfterFirst);
    for (let i = 0; i < 5; i++) {
      const prefix = agentEvidencePrefix({ collection: "agentRuns", id: `other-off-${String(i).padStart(4, "0")}` });
      expect(evidence.readNames.filter(name => name.startsWith(prefix)), prefix).toHaveLength(1);
    }
  }, 60_000);

  it("keeps the job incomplete while a listing is truncated and deletes the rest on later visits", async () => {
    listing.honoursMaxResults = true;
    seedWithdrawn(); seedRows();
    const prefix = agentEvidencePrefix({ collection: "agentRuns", id: "run-bound" });
    for (let i = 0; i < 250; i++) evidence.objects.set(`${prefix}${sha(String(i))}.json`, `old ${MARK} ${i}`);
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction().phase).not.toBe("done");
    expect([...evidence.objects.keys()].filter(name => name.startsWith(prefix)).length).toBeGreaterThan(0);
    for (let i = 0; i < 20 && redaction().phase !== "done"; i++) {
      redaction().nextAttemptAtMs = 0; await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
    expect(redaction().phase).toBe("done");
    expect([...evidence.objects.keys()].filter(name => name.startsWith(prefix))).toEqual([]);
  });

  it("never collapses money or usage records when a row is stored without evidence storage", async () => {
    seedWithdrawn();
    const row = { ...run("run-nostore", { privacy_request_binding: { request_id: "req1" },
      input: { big: `${MARK} `.repeat(300_000) } }), artifacts: { ...structuredClone(accounting),
        cache_policy: { family: "brief_v2", decision_reason: "stable_prefix_over_threshold" },
        provider_responses: [{ response_id: "resp_1", content: [{ type: "text", text: MARK }], usage }] } };
    state.docs.set("agentRuns/run-nostore", row);
    const before = extractAgentCostTelemetry({ ...row } as any);
    evidence.unavailable = true;
    await tickUntilDone();
    const stored = state.docs.get("agentRuns/run-nostore") as any;
    expect(stored.withdrawal_redaction).toBeDefined();
    expect(stored.agent_evidence_ref ?? null).toBeNull();
    expect(fitsStore(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(MARK);
    expect(extractAgentCostTelemetry({ ...stored } as any)).toEqual(before);
    expect(stored.artifacts.usage).toEqual(usage);
  });

  it("counts a row that cannot fit with its money kept as remaining, and never stores it with money collapsed", async () => {
    seedWithdrawn();
    state.docs.set("agentRuns/run-hugeusage", run("run-hugeusage", { privacy_request_binding: { request_id: "req1" },
      artifacts: { usage_samples: Array.from({ length: 40_000 }, (_, i) => ({ estimated_total_cost_usd: 0.000001 * i, model: "claude-haiku-5-5" })) } }));
    evidence.unavailable = true;
    await tickUntilDone({}, 3);
    expect(state.docs.get("agentRuns/run-hugeusage")?.withdrawal_redaction).toBeUndefined();
    expect(redaction().phase).not.toBe("done");
    expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
  });

  it.each([
    ["a transient read failure", (object: string) => { evidence.failReads.add(object); },
      (object: string) => { evidence.failReads.delete(object); }],
    ["a corrupt object", (object: string) => { const good = evidence.objects.get(object)!; evidence.objects.set(object, good.slice(0, -2) + "XX");
      return good; }, (object: string, good?: string) => { evidence.objects.set(object, good!); }],
  ])("keeps the job incomplete while another run's replay copies cannot be read (%s), and finishes once they can", async (_name, breakIt, fixIt) => {
    seedWithdrawn(); seedRows();
    const { stub, object } = offloaded("run-staff-replay", { session_id: "sess-1", session_key: "session:staff",
      metadata: { openai_replay_input: [{ role: "user", content: `earlier ${MARK}` }], cost_telemetry: costTelemetry } }, "STAFFTEXT");
    state.docs.set("agentRuns/run-staff-replay", stub);
    const good = breakIt(object) as string | undefined;
    const before = structuredClone(stub);
    await tickUntilDone({}, 5);
    for (let i = 0; i < 5; i++) { redaction().nextAttemptAtMs = 0; await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000; }
    expect(redaction().phase).not.toBe("done");
    expect(state.docs.get("agentRuns/run-staff-replay")).toEqual(before);
    expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
    for (const key of JOB_ROWS) expect(JSON.stringify(state.docs.get(key)), key).not.toContain(MARK);
    fixIt(object, good);
    for (let i = 0; i < 20 && redaction().phase !== "done"; i++) {
      redaction().nextAttemptAtMs = 0; await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
    expect(redaction().phase).toBe("done");
    const full = await hydrateAgentEvidence(state.docs.get("agentRuns/run-staff-replay"), { collection: "agentRuns", id: "run-staff-replay" }) as any;
    expect(JSON.stringify(full)).not.toContain(MARK);
    // That run's own content is untouched; only its replay copy was redacted.
    expect(full.output).toEqual(run("x", {}, "STAFFTEXT").output);
    expect(full.withdrawal_redaction).toBeUndefined();
  });

  it("counts and skips another run of the session whose evidence the store says is gone, and finishes the job's own rows", async () => {
    seedWithdrawn(); seedRows();
    const { stub } = offloaded("run-staff-broken", { session_id: "sess-1", session_key: "session:staff" });
    state.docs.set("agentRuns/run-staff-broken", stub);
    evidence.objects.delete(stub.agent_evidence_ref.object);
    const before = structuredClone(stub);
    await tickUntilDone();
    expect(redaction()).toMatchObject({ phase: "done", evidence_unreadable: 0 });
    expect(redaction().other_rows_unreadable).toBeGreaterThan(0);
    expect(state.docs.get("agentRuns/run-staff-broken")).toEqual(before);
    for (const key of JOB_ROWS) expect(JSON.stringify(state.docs.get(key)), key).not.toContain(MARK);
  });

  it("counts another job's unreadable row met in a scan on its own counter", async () => {
    seedWithdrawn(); seedRows();
    const { stub } = offloaded("other-broken", { metadata: { request_id: "req2", cost_telemetry: costTelemetry } });
    state.docs.set("agentRuns/other-broken", stub);
    evidence.objects.delete(stub.agent_evidence_ref.object);
    await tickUntilDone();
    expect(redaction()).toMatchObject({ phase: "done", evidence_unreadable: 0, other_rows_unreadable: 1 });
  });

  it("never keeps a phone number's shape, except under a numeric-id key", () => {
    const marker = { schema_version: "website_withdrawal_content_redaction.v1" as const, request_id: "req1", redacted_at_iso: "x" };
    const redacted = redactWithdrawnRecord({ id: "+15551234567", artifacts: { reason: "+15551234567", contact_id: "+15551234567",
      instance_id: "15551234567", record_id: "555-123-4567" } }, marker) as any;
    expect(redacted.id).toMatchObject({ redacted: true });
    expect(redacted.artifacts.reason).toMatchObject({ redacted: true });
    expect(redacted.artifacts.contact_id).toMatchObject({ redacted: true });
    expect(redacted.artifacts.record_id).toMatchObject({ redacted: true });
    expect(redacted.artifacts.instance_id).toBe("15551234567");
  });
});

describe("round 4", () => {
  async function legacyOffloaded(id: string, requestId: string, text: string) {
    const projected = await projectAgentEvidence(run(id, { task_kind: "support_triage", session_key: `session:${id}`,
      metadata: { request_id: requestId, cost_telemetry: costTelemetry }, input: { big: `${text} `.repeat(30_000) } }, text),
      { collection: "agentRuns", id });
    delete (projected.metadata as any).request_id; // as the old projection stored it
    state.docs.set(`agentRuns/${id}`, projected);
    return (projected.agent_evidence_ref as any).object as string;
  }
  const passes = async (count: number) => {
    for (let i = 0; i < count && redaction()?.phase !== "done"; i++) {
      if (redaction()) redaction().nextAttemptAtMs = 0;
      await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
  };

  it("keeps the job incomplete while a scanned row cannot be read, then redacts it once it can", async () => {
    seedWithdrawn(); seedRows();
    const object = await legacyOffloaded("run-legacy-job", "req1", MARK);
    evidence.failReads.add(object);
    await passes(8);
    expect(redaction().phase).not.toBe("done");
    expect(redaction().scan_retry).toEqual(["run-legacy-job"]);
    expect(evidence.objects.get(object)).toContain(MARK);
    expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
    evidence.failReads.delete(object);
    await passes(20);
    expect(redaction()).toMatchObject({ phase: "done", scan_retry: [] });
    expect(state.docs.get("agentRuns/run-legacy-job")?.withdrawal_redaction).toMatchObject({ request_id: "req1" });
    expect(evidence.objects.has(object)).toBe(false);
    for (const [name, content] of evidence.objects) expect(content, name).not.toContain(MARK);
  });

  it("drops a listed row untouched once it reads as another job's", async () => {
    seedWithdrawn(); seedRows();
    const object = await legacyOffloaded("run-legacy-other", "req2", OTHER);
    evidence.failReads.add(object);
    await passes(5);
    expect(redaction().scan_retry).toEqual(["run-legacy-other"]);
    const before = structuredClone(state.docs.get("agentRuns/run-legacy-other"));
    evidence.failReads.delete(object);
    await passes(20);
    expect(redaction()).toMatchObject({ phase: "done", scan_retry: [] });
    expect(state.docs.get("agentRuns/run-legacy-other")).toEqual(before);
    expect(evidence.objects.has(object)).toBe(true);
  });

  it("retries a row the scan found whose first visit failed, by its id", async () => {
    seedWithdrawn(); seedRows();
    await legacyOffloaded("run-legacy-flaky", "req1", MARK);
    const { sharedFakeFirestore: store } = await import("./helpers/fake-firestore");
    const original = store.runTransaction.bind(store);
    let failures = 1;
    (store as any).runTransaction = async (fn: any) => original(async (tx: any) => fn({ ...tx, get: (ref: any) => tx.get(ref),
      set: (ref: any, value: any, options?: any) => {
        if (failures > 0 && ref.id === "run-legacy-flaky" && value?.withdrawal_redaction) { failures--; throw new Error("refused"); }
        return tx.set(ref, value, options);
      } }));
    try {
      await passes(30);
      expect(redaction().phase).toBe("done");
      expect(state.docs.get("agentRuns/run-legacy-flaky")?.withdrawal_redaction).toMatchObject({ request_id: "req1" });
      expect(redaction().scans.offloaded.done).toBe(true);
    } finally { (store as any).runTransaction = original; }
  });

  it("keeps a usage record deep inside a row that has to be collapsed without evidence storage", async () => {
    seedWithdrawn();
    let deep: any = { usage: { prompt_tokens: 1234, completion_tokens: 56 }, text: `deep ${MARK}`, grid: [[MARK]] };
    for (let i = 0; i < 16; i++) deep = { level: deep }; // the usage record sits at depth 19, its numbers at 20
    state.docs.set("agentRuns/run-deep", run("run-deep", { privacy_request_binding: { request_id: "req1" },
      artifacts: { ...structuredClone(accounting), trace: deep } }));
    evidence.unavailable = true;
    await passes(10);
    const stored = state.docs.get("agentRuns/run-deep") as any;
    expect(stored.withdrawal_redaction).toBeDefined();
    expect(fitsStore(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(MARK);
    expect(JSON.stringify(stored)).toContain('"usage":{"prompt_tokens":1234,"completion_tokens":56}');
  });

  it("keeps times and dates, and still redacts a phone number, dashes included", () => {
    const marker = { schema_version: "website_withdrawal_content_redaction.v1" as const, request_id: "req1", redacted_at_iso: "x" };
    const redacted = redactWithdrawnRecord({ id: "+15551234567", artifacts: { day_iso: "2026-11-13", priced_at_ms: "1794650460000",
      checked_at: "2026-11-13T09:00:00Z", reason: "+15551234567", contact_id: "+15551234567", dashed_id: "555-123-4567",
      record_id: "2026-11-13" } }, marker) as any;
    expect(redacted.artifacts).toMatchObject({ day_iso: "2026-11-13", priced_at_ms: "1794650460000", checked_at: "2026-11-13T09:00:00Z",
      record_id: "2026-11-13" });
    for (const value of [redacted.id, redacted.artifacts.reason, redacted.artifacts.contact_id, redacted.artifacts.dashed_id])
      expect(value).toMatchObject({ redacted: true });
  });
});

describe("round 5", () => {
  const passes = async (count: number) => {
    for (let i = 0; i < count && redaction()?.phase !== "done"; i++) {
      if (redaction()) redaction().nextAttemptAtMs = 0;
      await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
  };

  it("never loses a failed row when a later query in the same pass throws", async () => {
    seedWithdrawn(); seedRows(); // the clock is past the horizon: the first sweep is the final one
    const { sharedFakeFirestore: store } = await import("./helpers/fake-firestore");
    const originalTransaction = store.runTransaction.bind(store);
    const originalCollection = store.collection.bind(store);
    let writeFailures = 1, queryFailures = 1;
    (store as any).runTransaction = async (fn: any) => originalTransaction(async (tx: any) => fn({ ...tx, get: (ref: any) => tx.get(ref),
      set: (ref: any, value: any, options?: any) => {
        if (writeFailures > 0 && ref.id === "run-bound" && value?.withdrawal_redaction) { writeFailures--; throw new Error("refused"); }
        return tx.set(ref, value, options);
      } }));
    (store as any).collection = (name: string) => {
      const collection = originalCollection(name);
      if (name !== "agentRuns") return collection;
      return { ...collection, doc: collection.doc, where: (field: string, op: any, value: any) => {
        const query = collection.where(field, op, value);
        if (field !== "metadata.request_id" || queryFailures === 0) return query;
        queryFailures--;
        const failing: any = { orderBy: () => failing, limit: () => failing, startAfter: () => failing,
          get: async () => { throw Object.assign(new Error("deadline exceeded"), { code: 4 }); } };
        return failing;
      } };
    };
    try {
      await runWebsiteJobModelRunRedactions({ deps: deps() });
      expect(writeFailures).toBe(0);
      expect(queryFailures).toBe(0);
      expect(JSON.stringify(state.docs.get("agentRuns/run-bound"))).toContain(MARK);
      expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
      await passes(30);
      expect(redaction().phase).toBe("done");
      expect(JSON.stringify(state.docs.get("agentRuns/run-bound"))).not.toContain(MARK);
    } finally {
      (store as any).runTransaction = originalTransaction;
      (store as any).collection = originalCollection;
    }
  });

  it("keeps the job's own offloaded row and its object through a transient read failure, then redacts it with its money", async () => {
    seedWithdrawn(); seedRows();
    const full = await hydrateAgentEvidence(state.docs.get("agentRuns/run-offloaded"), { collection: "agentRuns", id: "run-offloaded" });
    const moneyBefore = extractAgentCostTelemetry({ ...full } as any);
    const usageBefore = (full as any).artifacts.usage;
    const stubBefore = structuredClone(state.docs.get("agentRuns/run-offloaded"));
    evidence.failReads.add(offloadedObject);
    await passes(6);
    expect(redaction().phase).not.toBe("done");
    expect(state.docs.get("agentRuns/run-offloaded")).toEqual(stubBefore);
    expect(evidence.objects.has(offloadedObject)).toBe(true);
    expect(receipts().some(receipt => receipt.rows_remaining > 0)).toBe(true);
    evidence.failReads.delete(offloadedObject);
    await passes(30);
    expect(redaction().phase).toBe("done");
    const after = await hydrateAgentEvidence(state.docs.get("agentRuns/run-offloaded"), { collection: "agentRuns", id: "run-offloaded" }) as any;
    expect(JSON.stringify(after)).not.toContain(MARK);
    expect(after.artifacts.usage).toEqual(usageBefore);
    expect(extractAgentCostTelemetry({ ...after } as any)).toEqual(moneyBefore);
    expect(evidence.objects.has(offloadedObject)).toBe(false);
  });

  it("redacts and deletes the job's own row whose object is corrupt, and goes on at once when it is missing", async () => {
    seedWithdrawn(); seedRows();
    const good = evidence.objects.get(offloadedObject)!;
    evidence.objects.set(offloadedObject, good.slice(0, -2) + "XX");
    await passes(30);
    expect(redaction()).toMatchObject({ phase: "done", evidence_unreadable: 1 });
    expect(state.docs.get("agentRuns/run-offloaded")?.withdrawal_redaction).toBeDefined();
    expect(evidence.objects.has(offloadedObject)).toBe(false);
  });
});

describe("round 5, the retry list and time keys", () => {
  async function legacyOffloaded(id: string, requestId: string, text: string) {
    const projected = await projectAgentEvidence(run(id, { task_kind: "support_triage", session_key: `session:${id}`,
      metadata: { request_id: requestId, cost_telemetry: costTelemetry }, input: { big: `${text} `.repeat(30_000) } }, text),
      { collection: "agentRuns", id });
    delete (projected.metadata as any).request_id;
    state.docs.set(`agentRuns/${id}`, projected);
    return (projected.agent_evidence_ref as any).object as string;
  }
  const passes = async (count: number, extra: Record<string, unknown> = {}) => {
    for (let i = 0; i < count && redaction()?.phase !== "done"; i++) {
      if (redaction()) redaction().nextAttemptAtMs = 0;
      await runWebsiteJobModelRunRedactions({ deps: deps(extra) }); clock += 1000;
    }
  };

  it("caps the retry list, pauses the scan with it, and finishes once reads recover", async () => {
    seedWithdrawn(); seedRows();
    const objects: string[] = [];
    for (let i = 0; i < 6; i++) objects.push(await legacyOffloaded(`run-scan-${i}`, i === 4 ? "req1" : `req-other-${i}`, i === 4 ? MARK : OTHER));
    for (const object of objects) evidence.failReads.add(object);
    await passes(12, { maxScanRetryIds: 3 });
    expect(redaction().phase).not.toBe("done");
    expect(redaction().scan_retry).toHaveLength(3);
    expect(redaction().scans.offloaded.done).toBe(false);
    // The cursor stopped before the first row that could not be listed.
    expect(redaction().scans.offloaded.cursor).toBe(redaction().scan_retry.at(-1));
    for (const object of objects) evidence.failReads.delete(object);
    await passes(40, { maxScanRetryIds: 3 });
    expect(redaction()).toMatchObject({ phase: "done", scan_retry: [] });
    expect(state.docs.get("agentRuns/run-scan-4")?.withdrawal_redaction).toMatchObject({ request_id: "req1" });
    for (const [name, content] of evidence.objects) expect(content, name).not.toContain(MARK);
  });

  it("counts a newly listed row once in the sweep that lists it", async () => {
    seedWithdrawn(); seedRows();
    const object = await legacyOffloaded("run-once", "req2", OTHER);
    evidence.failReads.add(object);
    await runWebsiteJobModelRunRedactions({ deps: deps() });
    expect(redaction().scan_retry).toEqual(["run-once"]);
    expect(redaction().sweep.rows_failed).toBe(1);
  });

  it("under a time key keeps dates, date-times and epochs, and still redacts dashed or dotted numbers", () => {
    const marker = { schema_version: "website_withdrawal_content_redaction.v1" as const, request_id: "req1", redacted_at_iso: "x" };
    const redacted = redactWithdrawnRecord({ artifacts: { called_at: "555-123-4567", dialled_at: "555.123.4567",
      day_at: "2026-11-13", checked_at: "2026-11-13T09:00:00Z", priced_at_ms: "1794650460000" } }, marker) as any;
    expect(redacted.artifacts.called_at).toMatchObject({ redacted: true });
    expect(redacted.artifacts.dialled_at).toMatchObject({ redacted: true });
    expect(redacted.artifacts).toMatchObject({ day_at: "2026-11-13", checked_at: "2026-11-13T09:00:00Z", priced_at_ms: "1794650460000" });
  });
});

describe("round 6, rows whose evidence can never be read", () => {
  async function legacyOffloaded(id: string, requestId: string, text: string) {
    const projected = await projectAgentEvidence(run(id, { task_kind: "support_triage", session_key: `session:${id}`,
      metadata: { request_id: requestId, cost_telemetry: costTelemetry }, input: { big: `${text} `.repeat(30_000) } }, text),
      { collection: "agentRuns", id });
    delete (projected.metadata as any).request_id;
    state.docs.set(`agentRuns/${id}`, projected);
    return (projected.agent_evidence_ref as any).object as string;
  }
  const passes = async (count: number) => {
    for (let i = 0; i < count && redaction()?.phase !== "done"; i++) {
      if (redaction()) redaction().nextAttemptAtMs = 0;
      await runWebsiteJobModelRunRedactions({ deps: deps() }); clock += 1000;
    }
  };
  const lastReceipt = () => receipts().sort((a, b) => a.pass - b.pass || a.completed_at_iso.localeCompare(b.completed_at_iso)).at(-1);

  it.each([
    ["corrupt bytes", (object: string) => { const good = evidence.objects.get(object)!; evidence.objects.set(object, good.slice(0, -2) + "XX"); }],
    ["bytes that are not json", (object: string) => {
      const row = state.docs.get("agentRuns/run-scan-x") as any; const content = "{not json".padEnd(row.agent_evidence_ref.bytes, " ");
      evidence.objects.set(object, content); row.agent_evidence_ref = { ...row.agent_evidence_ref, sha256: sha(content) };
    }],
    ["a malformed reference", () => { const row = state.docs.get("agentRuns/run-scan-x") as any;
      row.agent_evidence_ref = { ...row.agent_evidence_ref, sha256: "not-a-digest" }; }],
  ])("leaves a scanned row with %s exactly as it is, counts it, logs its id, and completes the job", async (_label, breakIt) => {
    const { logger } = await import("../logger");
    vi.mocked(logger.warn).mockClear();
    seedWithdrawn(); seedRows();
    const object = await legacyOffloaded("run-scan-x", "req-unknown", OTHER);
    breakIt(object);
    const rowBefore = structuredClone(state.docs.get("agentRuns/run-scan-x"));
    const objectBefore = evidence.objects.get(object);
    await passes(30);
    expect(redaction()).toMatchObject({ phase: "done", scan_retry: [], scan_rows_unverifiable: 1, evidence_unreadable: 0 });
    expect(state.docs.get("agentRuns/run-scan-x")).toEqual(rowBefore);
    expect(evidence.objects.get(object)).toBe(objectBefore);
    expect(receipts().reduce((sum, receipt) => sum + receipt.scan_rows_unverifiable, 0)).toBe(1);
    expect(lastReceipt()).toMatchObject({ outcome: "complete", total_scan_rows_unverifiable: 1 });
    const logged = vi.mocked(logger.warn).mock.calls.filter(([, message]) => String(message).includes("cannot be verified"));
    expect(logged).toHaveLength(1);
    expect(Object.keys(logged[0][0] as object).sort()).toEqual(["code", "collection", "id", "requestId"]);
    expect(logged[0][0]).toMatchObject({ requestId: "req1", collection: "agentRuns", id: "run-scan-x" });
    expect(JSON.stringify(logged)).not.toContain(OTHER);
  });

  it("keeps the same scanned row listed while its read fails with a 503", async () => {
    seedWithdrawn(); seedRows();
    const object = await legacyOffloaded("run-scan-x", "req-unknown", OTHER);
    evidence.failReads.add(object);
    await passes(8);
    expect(redaction()).toMatchObject({ scan_retry: ["run-scan-x"], scan_rows_unverifiable: 0 });
    expect(redaction().phase).not.toBe("done");
  });

  it("keeps a scanned row listed, and the job's own offloaded row remaining, while no storage is reachable", async () => {
    seedWithdrawn(); seedRows();
    await legacyOffloaded("run-scan-x", "req-unknown", OTHER);
    evidence.unavailable = true;
    await passes(8);
    // The job's own offloaded row is met by the scan too: not yet readable, so listed with it.
    expect(redaction()).toMatchObject({ scan_retry: expect.arrayContaining(["run-scan-x", "run-offloaded"]), scan_rows_unverifiable: 0,
      evidence_unreadable: 0 });
    expect(redaction().phase).not.toBe("done");
    expect(state.docs.get("agentRuns/run-offloaded")?.withdrawal_redaction).toBeUndefined();
    expect(evidence.objects.get(offloadedObject)).toContain(MARK);
    evidence.unavailable = false;
    await passes(30);
    expect(redaction()).toMatchObject({ phase: "done", scan_retry: [], scan_rows_unverifiable: 0 });
    expect(state.docs.get("agentRuns/run-offloaded")?.withdrawal_redaction).toMatchObject({ request_id: "req1" });
  });

  it("redacts the job's own row whose reference is malformed and sweeps its evidence prefix", async () => {
    seedWithdrawn(); seedRows();
    const row = state.docs.get("agentRuns/run-offloaded") as any;
    row.agent_evidence_ref = { ...row.agent_evidence_ref, fields: "input" };
    await passes(30);
    expect(redaction()).toMatchObject({ phase: "done", evidence_unreadable: 1, scan_rows_unverifiable: 0 });
    const after = state.docs.get("agentRuns/run-offloaded") as any;
    expect(after.withdrawal_redaction).toMatchObject({ request_id: "req1" });
    expect(JSON.stringify(after)).not.toContain(MARK);
    expect(evidence.objects.has(offloadedObject)).toBe(false);
    expect([...evidence.objects.keys()].some(name => name.startsWith(agentEvidencePrefix({ collection: "agentRuns", id: "run-offloaded" })))).toBe(false);
  });
});
