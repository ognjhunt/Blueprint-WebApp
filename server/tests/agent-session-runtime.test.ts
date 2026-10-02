// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    status: "completed",
    provider: "openai_responses",
    runtime: "openai_responses",
    model: "gpt-5.4",
    tool_mode: "mixed",
    output: {
      reply: "Fresh thread started.",
      summary: "Compressed handoff accepted.",
      suggested_actions: ["Implement the fix"],
      requires_human_review: false,
    },
    raw_output_text:
      '{"reply":"Fresh thread started.","summary":"Compressed handoff accepted.","suggested_actions":["Implement the fix"],"requires_human_review":false}',
    artifacts: {
      openai_response_id: "resp_123",
    },
    continuation_state: {
      openai_replay_input: [
        {
          role: "developer",
          content: [{
            type: "input_text",
            text: "stable contract",
            prompt_cache_breakpoint: { mode: "explicit" },
          }],
        },
        { role: "user", content: "first message" },
      ],
    },
    requires_human_review: false,
    requires_approval: false,
  }),
);
const runDeepSeekChatTask = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    status: "completed",
    provider: "deepseek_chat",
    runtime: "deepseek_chat",
    model: "deepseek-v4-pro",
    tool_mode: "mixed",
    output: {
      reply: "Managed profile completed.",
      summary: "Profile task accepted.",
      suggested_actions: ["Record the checkpoint"],
      requires_human_review: false,
    },
    raw_output_text:
      '{"reply":"Managed profile completed.","summary":"Profile task accepted.","suggested_actions":["Record the checkpoint"],"requires_human_review":false}',
    artifacts: {
      deepseek_request_id: "ds_123",
    },
    requires_human_review: false,
    requires_approval: false,
  }),
);
const resolveStartupContext = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    attached_startup_packs: [],
    repo_docs: [],
    knowledge_pages: [],
    blueprint_contexts: [],
    attached_documents: [],
    external_sources: [],
    creative_contexts: [],
  }),
);

vi.mock("../agents/adapters/openai-responses", () => ({
  runOpenAIResponsesTask,
}));

vi.mock("../agents/adapters/deepseek-chat", () => ({
  runDeepSeekChatTask,
}));

vi.mock("../agents/knowledge", () => ({
  resolveStartupContext,
}));

const failures = vi.hoisted(() => ({ sessionMarker: false, commit: false }));
const privateStorage = vi.hoisted(() => ({ objects: new Map<string, string>(), available: false }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => privateStorage.available ? {
  bucketName: "existing-private-bucket",
  createOnly: async (name: string, content: string) => { if (!privateStorage.objects.has(name)) privateStorage.objects.set(name, content); return "created"; },
  readText: async (name: string) => privateStorage.objects.get(name) ?? null,
  info: async (name: string) => privateStorage.objects.has(name) ? { name, generation: "1", size: Buffer.byteLength(privateStorage.objects.get(name)!) } : null,
} : null }));

type QueryFilter = {
  field: string;
  op: string;
  value: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && !(value instanceof Date);
}

function deepMergeRecords(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({ ...current, ...next }).map(([key, value]) => {
      const currentValue = current[key];
      return [
        key,
        isPlainRecord(currentValue) && isPlainRecord(value)
          ? deepMergeRecords(currentValue, value)
          : value,
      ];
    }),
  );
}

function createFakeDb() {
  const store = {
    agentSessions: new Map<string, Record<string, unknown>>(),
    agentRuns: new Map<string, Record<string, unknown>>(),
    opsActionLogs: new Map<string, Record<string, unknown>>(),
    agentRuntimeEvents: new Map<string, Record<string, unknown>>(),
    agentCheckpoints: new Map<string, Record<string, unknown>>(),
    agentCompactions: new Map<string, Record<string, unknown>>(),
    agentProfiles: new Map<string, Record<string, unknown>>(),
    agentEnvironmentProfiles: new Map<string, Record<string, unknown>>(),
    opsDocuments: new Map<string, Record<string, unknown>>(),
    startupPacks: new Map<string, Record<string, unknown>>(),
  };

  const applyFilters = (docs: Array<{ id: string; data: Record<string, unknown> }>, filters: QueryFilter[]) =>
    docs.filter(({ data }) =>
      filters.every(({ field, op, value }) => {
        const current = data[field];
        if (op === "==") {
          return current === value;
        }
        if (op === "in" && Array.isArray(value)) {
          return value.includes(current);
        }
        return false;
      }),
    );

  const makeQuery = (
    collectionName: keyof typeof store,
    filters: QueryFilter[] = [],
    limitValue = Number.POSITIVE_INFINITY,
  ) => ({
    where(field: string, op: string, value: unknown) {
      return makeQuery(collectionName, [...filters, { field, op, value }], limitValue);
    },
    orderBy() {
      return makeQuery(collectionName, filters, limitValue);
    },
    limit(value: number) {
      return makeQuery(collectionName, filters, value);
    },
    async get() {
      const allDocs = [...store[collectionName].entries()].map(([id, data]) => ({
        id,
        data,
      }));
      const filtered = applyFilters(allDocs, filters).slice(0, limitValue);
      return {
        empty: filtered.length === 0,
        docs: filtered.map(({ id, data }) => ({
          id,
          data: () => data,
          exists: true,
        })),
      };
    },
  });

  return {
    store,
    db: {
      async runTransaction(callback: any) {
        const writes: Array<() => Promise<void>> = [];
        const value = await callback({ get: (ref: any) => ref.get(), set: (ref: any, data: any, options?: any) => { if (failures.commit && data.agent_evidence_ref && !options?.merge) throw new Error("private backend exception"); writes.push(() => ref.set(data, options)); } });
        for (const write of writes) await write();
        return value;
      },
      collection(name: keyof typeof store) {
        return {
          doc(id: string) {
            return {
              async set(value: Record<string, unknown>, options?: { merge?: boolean }) {
                if (failures.sessionMarker && name === "agentSessions" && Object.keys(value).length === 1 && value.mutation_reconciliation_required === true) throw new Error("session marker transport unavailable");
                const current = store[name].get(id) || {};
                const next = options?.merge ? deepMergeRecords(current, value) : value;
                if (Buffer.byteLength(JSON.stringify(next)) > 1_048_576) throw new Error("Firestore document too large");
                store[name].set(id, next);
              },
              async get() {
                const value = store[name].get(id);
                return {
                  exists: Boolean(value),
                  data: () => value,
                };
              },
            };
          },
          where(field: string, op: string, value: unknown) {
            return makeQuery(name, [{ field, op, value }]);
          },
          orderBy() {
            return makeQuery(name);
          },
          limit(value: number) {
            return makeQuery(name, [], value);
          },
        };
      },
    },
  };
}

const fake = createFakeDb();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: fake.db,
  storageAdmin: null,
  authAdmin: null,
}));

beforeEach(() => {
  failures.sessionMarker = false;
  failures.commit = false;
  privateStorage.objects.clear();
  privateStorage.available = false;
  fake.store.agentSessions.clear();
  fake.store.agentRuns.clear();
  fake.store.opsActionLogs.clear();
  fake.store.agentRuntimeEvents.clear();
  fake.store.agentCheckpoints.clear();
  fake.store.agentCompactions.clear();
  fake.store.agentProfiles.clear();
  fake.store.agentEnvironmentProfiles.clear();
  fake.store.opsDocuments.clear();
  fake.store.startupPacks.clear();
});

afterEach(() => {
  runOpenAIResponsesTask.mockClear();
  runDeepSeekChatTask.mockClear();
  resolveStartupContext.mockClear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("agent session runtime", () => {
  it("offloads large proof across run/session/checkpoints/events and hydrates a resumed quarantine", async () => {
    privateStorage.available = true;
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Private proof", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", session_key: "session:large" });
    const original = structuredClone(await runOpenAIResponsesTask.getMockImplementation()!());
    const result = { ...original, raw_output_text: "raw".repeat(400_000), artifacts: { ...original.artifacts, mutation_reconciliation_required: true, output_repairs: [{ rawOutput: "bad".repeat(300_000) }] }, continuation_state: { mutation_reconciliation_required: true, openai_replay_input: [...original.continuation_state.openai_replay_input, { role: "assistant", content: "replay".repeat(200_000) }] } };
    runOpenAIResponsesTask.mockResolvedValueOnce(result);
    const completed = await runtime.sendAgentSessionMessage({ sessionId: session.id, task: { kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Read evidence" } } });
    expect(completed.result?.status).toBe("completed");
    expect([...fake.store.agentRuns.values()].some(row => row.agent_evidence_ref)).toBe(true);
    expect([...fake.store.agentSessions.values()].some(row => row.agent_evidence_ref)).toBe(true);
    expect([...fake.store.agentCheckpoints.values()].some(row => row.agent_evidence_ref)).toBe(true);
    expect([...fake.store.agentRuntimeEvents.values()].some(row => row.agent_evidence_ref)).toBe(true);
    for (const rows of Object.values(fake.store)) for (const row of rows.values()) expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(1_048_576);
    const runs = await runtime.listAgentRunsForSession(session.id);
    expect(runs[0].raw_output_text).toBe(result.raw_output_text);
    expect(runs[0].artifacts?.output_repairs).toEqual(result.artifacts.output_repairs);
    const checkpoints = await runtime.listCheckpointsForSession(session.id);
    expect(checkpoints.some(row => (row.snapshot.result as any)?.raw_output_text === result.raw_output_text)).toBe(true);
    const events = await runtime.listRuntimeEventsForSession(session.id);
    expect(events.some(row => row.metadata?.raw_output_text === result.raw_output_text)).toBe(true);
    // Saved replay can be unavailable; compact controls must independently win.
    const rawSession = fake.store.agentSessions.get(session.id)!;
    rawSession.metadata = { mutation_reconciliation_required: true };
    rawSession.agent_evidence_ref = null;
    runOpenAIResponsesTask.mockResolvedValueOnce(original);
    await runtime.sendAgentSessionMessage({ sessionId: session.id, task: { kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Inspect safe reads" } } });
    expect(runOpenAIResponsesTask.mock.calls.at(-1)?.[0].metadata.mutation_reconciliation_required).toBe(true);
  }, 20_000);

  it("honors paid STOP after offload and refuses unavailable source without invoking a provider", async () => {
    privateStorage.available = true;
    const runtime = await import("../agents/runtime");
    const original = structuredClone(await runOpenAIResponsesTask.getMockImplementation()!());
    runOpenAIResponsesTask.mockResolvedValueOnce({ ...original, raw_output_text: "raw".repeat(400_000), artifacts: { usage: { prompt_tokens: 100_000, completion_tokens: 100, total_tokens: 100_100, cost_usd: 2 } } });
    await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", model: "gpt-5.6", input: { message: "Existing paid reading" } }, { dispatchQueuedOnFinish: false });
    const paid = [...fake.store.agentRuns.values()].find(row => row.agent_evidence_ref)!;
    expect(paid).toBeDefined();
    paid.created_at = new Date().toISOString();
    vi.stubEnv("BLUEPRINT_AGENT_COST_STOP_DAY_USD", "1");
    runOpenAIResponsesTask.mockClear();
    const stopped = await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Next request" } }, { dispatchQueuedOnFinish: false });
    expect(stopped.error).toContain("cost stop threshold reached");
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    privateStorage.objects.clear();
    const missing = await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Source repair required" } }, { dispatchQueuedOnFinish: false });
    expect(missing.error).toContain("agent_evidence_object_missing");
    expect(missing.artifacts).toMatchObject({ inference_not_invoked: true, cost_evidence_unavailable: true });
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
  }, 20_000);

  it("strictly hydrates large queued input before dispatch", async () => {
    privateStorage.available = true;
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Queued proof", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", session_key: "session:queued-large" });
    fake.store.agentRuns.set("active-parent", { id: "active-parent", session_id: session.id, session_key: session.session_key, status: "running", created_at: "timestamp" });
    const context = { source: "retain".repeat(150_000) };
    const queued = await runtime.sendAgentSessionMessage({ sessionId: session.id, task: { kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Queued authorized read", context } } });
    expect(queued.queued).toBe(true);
    expect(fake.store.agentRuns.get(queued.runId)?.input).toBeNull();
    fake.store.agentRuns.get("active-parent")!.status = "completed";
    fake.store.agentRuns.get("active-parent")!.mutation_reconciliation_required = true;
    await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", session_key: session.session_key, input: { message: "Finish prior safe read" } });
    const resumed = runOpenAIResponsesTask.mock.calls.find(([task]) => task.input.context?.source === context.source)?.[0];
    expect(resumed?.input.context?.source).toBe(context.source);
    expect(resumed?.metadata.mutation_reconciliation_required).toBe(true);
    expect(fake.store.agentRuns.get(queued.runId)?.status).toBe("completed");
  }, 20_000);

  it("recovers quarantine from a run when the independent session marker write fails", async () => {
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Partial marker failure", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses" });
    failures.sessionMarker = true;
    const original = structuredClone(await runOpenAIResponsesTask.getMockImplementation()!());
    runOpenAIResponsesTask.mockResolvedValueOnce({ ...original, artifacts: { mutation_reconciliation_required: true } });
    const failed = await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Existing operation" } }, { sessionId: session.id, dispatchQueuedOnFinish: false });
    expect(failed.raw_output_text).toBe(original.raw_output_text);
    const uncertain = [...fake.store.agentRuns.values()].find(row => row.mutation_reconciliation_required === true)!;
    expect(uncertain.status).toBe("running");
    expect(fake.store.agentSessions.get(session.id)?.mutation_reconciliation_required).not.toBe(true);
    // Reconciliation inspection may change lifecycle status, but cannot erase
    // an unknown business effect or reauthorize fresh mutating tools.
    failures.sessionMarker = false;
    uncertain.status = "failed";
    await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Inspect safe reads" } }, { sessionId: session.id, dispatchQueuedOnFinish: false });
    expect(runOpenAIResponsesTask.mock.calls.at(-1)?.[0].metadata.mutation_reconciliation_required).toBe(true);
  }, 20_000);

  it("returns verified durable proof reference when Firestore manifest commit fails", async () => {
    privateStorage.available = true;
    failures.commit = true;
    const runtime = await import("../agents/runtime");
    const original = structuredClone(await runOpenAIResponsesTask.getMockImplementation()!());
    const raw = "raw".repeat(400_000);
    runOpenAIResponsesTask.mockResolvedValueOnce({ ...original, raw_output_text: raw });
    const failed = await runtime.runAgentTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Finish existing read" } }, { dispatchQueuedOnFinish: false });
    expect(failed.error).toContain("agent_evidence_firestore_commit_failed");
    expect(failed.raw_output_text).toBe(raw);
    const ref = failed.artifacts?.private_evidence_reference as any;
    expect(ref).toMatchObject({ version: 1, collection: "agentRuns", generation: "1" });
    expect(JSON.parse(privateStorage.objects.get(ref.object)!).payload.raw_output_text).toBe(raw);
    expect(fake.store.agentRuns.get(ref.id)?.agent_evidence_ref).toEqual(ref);
    const { hydrateAgentEvidence } = await import("../agents/private-evidence");
    const restored = await hydrateAgentEvidence(fake.store.agentRuns.get(ref.id)!, { collection: "agentRuns", id: ref.id });
    expect(restored.raw_output_text).toBe(raw);
    expect(restored.error).toContain("agent_evidence_firestore_commit_failed");
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("blocks resume of a selected unavailable checkpoint without rerunning an older task", async () => {
    privateStorage.available = true;
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Unavailable checkpoint", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses" });
    const { createAgentCheckpoint } = await import("../agents/checkpoints");
    const checkpoint = await createAgentCheckpoint({ session_id: session.id, label: "Latest", trigger: "test", snapshot: { task: { kind: "operator_thread", input: { message: "x".repeat(800_000) } } } });
    fake.store.agentSessions.get(session.id)!.latest_checkpoint_id = checkpoint!.id;
    privateStorage.objects.clear();
    await expect(runtime.resumeAgentSession({ sessionId: session.id })).rejects.toThrow("agent_evidence_object_missing");
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
  }, 20_000);

  it.each(["deepseek_chat", "zai_glm"] as const)("blocks provider switch to %s from escaping a saved quarantine", async provider => {
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Saved unknown mutation", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", metadata: { mutation_reconciliation_required: true, source_evidence: "existing" } });
    const denied = await runtime.sendAgentSessionMessage({ sessionId: session.id, task: { kind: "operator_thread", provider, runtime: "deepseek_chat", input: { message: "Continue existing task" } } });
    expect(denied.result?.status).toBe("failed");
    expect(denied.result?.error).toContain("mutation_reconciliation_required");
    expect(denied.result?.artifacts).toMatchObject({ mutation_reconciliation_required: true, inference_not_invoked: true });
    expect(runDeepSeekChatTask).not.toHaveBeenCalled();
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    expect((await runtime.getAgentSession(session.id))?.metadata?.source_evidence).toBe("existing");
  }, 20_000);

  it("keeps quarantine when compacting a session without replay", async () => {
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Unknown mutation", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", metadata: { mutation_reconciliation_required: true } });
    const forked = await runtime.forkAgentSessionWithHandoff({ sessionId: session.id, phase: "implementation" });
    expect(forked.session.metadata?.mutation_reconciliation_required).toBe(true);
    expect(runOpenAIResponsesTask.mock.calls.at(-1)?.[0].metadata.mutation_reconciliation_required).toBe(true);
  }, 20_000);

  it("keeps returned proof and independent quarantine when private persistence is unavailable", async () => {
    const runtime = await import("../agents/runtime");
    const session = await runtime.createAgentSession({ title: "Failed proof persistence", task_kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", session_key: "session:persistence-failure" });
    const original = structuredClone(await runOpenAIResponsesTask.getMockImplementation()!());
    const result = { ...original, raw_output_text: "private".repeat(200_000), artifacts: { mutation_reconciliation_required: true }, continuation_state: { mutation_reconciliation_required: true, openai_replay_input: [{ role: "assistant", content: "replay".repeat(200_000) }] } };
    runOpenAIResponsesTask.mockResolvedValueOnce(result);
    const failed = await runtime.sendAgentSessionMessage({ sessionId: session.id, task: { kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", input: { message: "Existing authorized task" } } });
    expect(failed.result?.status).toBe("failed");
    expect(failed.result?.error).toContain("agent_evidence_storage_unavailable");
    expect(failed.result?.raw_output_text).toBe(result.raw_output_text);
    expect(failed.result?.continuation_state).toEqual(result.continuation_state);
    expect(fake.store.agentSessions.get(session.id)?.mutation_reconciliation_required).toBe(true);
    expect([...fake.store.agentRuns.values()].some(row => row.mutation_reconciliation_required === true)).toBe(true);
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
  }, 20_000);

  it(
    "queues later session messages when a run is already active",
    async () => {
    const { createAgentSession, sendAgentSessionMessage } = await import("../agents/runtime");

    const session = await createAgentSession({
      title: "Ops thread",
      task_kind: "operator_thread",
      provider: "openclaw",
      session_key: "session:test",
    });

    fake.store.agentRuns.set("run-active", {
      id: "run-active",
      session_id: session.id,
      session_key: "session:test",
      status: "running",
      created_at: "timestamp",
      updated_at: "timestamp",
    });

    const result = await sendAgentSessionMessage({
      sessionId: session.id,
      task: {
        kind: "operator_thread",
        provider: "openai_responses",
        runtime: "openai_responses",
        input: {
          message: "Follow up after the current run.",
        },
        session_policy: {
          dispatch_mode: "collect",
        },
      },
    });

    expect(result.queued).toBe(true);
    expect([...fake.store.agentRuns.values()].some((run) => run.status === "queued")).toBe(true);
    },
    15_000,
  );

  it("suppresses duplicate no-change session messages while an equivalent run is active", async () => {
    const { createAgentSession, sendAgentSessionMessage, listRuntimeEventsForSession } =
      await import("../agents/runtime");

    const session = await createAgentSession({
      title: "Duplicate suppression session",
      task_kind: "operator_thread",
      provider: "deepseek_chat",
      runtime: "deepseek_chat",
      session_key: "session:dedupe",
    });
    const repeatedInput = {
      message: "Recheck BLU-77; last run found no material movement.",
    };

    fake.store.agentRuns.set("run-active", {
      id: "run-active",
      session_id: session.id,
      session_key: "session:dedupe",
      task_kind: "operator_thread",
      provider: "deepseek_chat",
      runtime: "deepseek_chat",
      model: "deepseek-v4-pro",
      status: "running",
      dispatch_mode: "collect",
      input: {
        kind: "operator_thread",
        input: repeatedInput,
        provider: "deepseek_chat",
        runtime: "deepseek_chat",
        model: "deepseek-v4-pro",
        session_key: "session:dedupe",
        session_policy: {
          dispatch_mode: "collect",
        },
      },
      created_at: "timestamp",
      updated_at: "timestamp",
    });

    const result = await sendAgentSessionMessage({
      sessionId: session.id,
      task: {
        kind: "operator_thread",
        provider: "deepseek_chat",
        runtime: "deepseek_chat",
        input: repeatedInput,
        session_policy: {
          dispatch_mode: "collect",
        },
      },
    });

    expect(result.suppressed).toBe(true);
    expect(result.queued).toBe(false);
    expect(result.activeRunId).toBe("run-active");
    expect(runDeepSeekChatTask).not.toHaveBeenCalled();
    expect(resolveStartupContext).not.toHaveBeenCalled();
    expect([...fake.store.agentRuns.values()].filter((run) => run.status === "queued")).toHaveLength(0);
    expect([...fake.store.agentRuns.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "cancelled",
          metadata: expect.objectContaining({
            runtime_suppression: expect.objectContaining({
              reason: "duplicate_active_run",
              active_run_id: "run-active",
            }),
          }),
        }),
      ]),
    );

    const events = await listRuntimeEventsForSession(session.id);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "run.suppressed",
          status: "info",
        }),
      ]),
    );
  });

  it("forks a session into a fresh implementation thread with a compressed handoff", async () => {
    const { createAgentSession, forkAgentSessionWithHandoff, listAgentRunsForSession } =
      await import("../agents/runtime");

    const session = await createAgentSession({
      title: "Ops thread",
      task_kind: "operator_thread",
      provider: "openai_responses",
      session_key: "session:source",
      metadata: {
        startupContext: {
          repoDocPaths: ["docs/runbook.md"],
          documentIds: ["doc-1"],
          operatorNotes: "Keep this scoped to one fix.",
        },
      },
    });

    fake.store.agentRuns.set("run-failed", {
      id: "run-failed",
      session_id: session.id,
      session_key: "session:source",
      task_kind: "operator_thread",
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.4",
      status: "failed",
      input: {
        kind: "operator_thread",
        input: {
          message: "Investigate the failing issue and summarize the fix path.",
        },
      },
      error:
        "stream disconnected before completion: Incomplete response returned, reason: max_output_tokens",
      created_at: "timestamp",
      updated_at: "timestamp",
    });

    const result = await forkAgentSessionWithHandoff({
      sessionId: session.id,
      phase: "implementation",
      sourceRunId: "run-failed",
    });

    expect(result.session?.title).toContain("Implementation");
    expect(result.handoffPrompt).toContain("Phase: Implementation");
    expect(result.handoffPrompt).toContain("docs/runbook.md");
    expect(result.handoffPrompt).toContain("Retry once in this fresh thread");
    expect(result.handoffPrompt).toContain("Paperclip goal closeout contract");
    expect(result.handoffPrompt).toContain("Goal objective:");
    expect(result.handoffPrompt).toContain("Retry/resume condition:");

    const forkRuns = await listAgentRunsForSession(result.session!.id);
    expect(forkRuns[0]?.metadata).toMatchObject({
      compact_startup_context: true,
      workflow_phase: "implementation",
    });
    expect(runOpenAIResponsesTask).toHaveBeenCalled();
  });

  it("applies managed runtime profiles and records runtime events and checkpoints", async () => {
    const {
      createAgentSession,
      sendAgentSessionMessage,
      listRuntimeEventsForSession,
      listCheckpointsForSession,
    } = await import("../agents/runtime");

    const session = await createAgentSession({
      title: "Managed runtime session",
      task_kind: "operator_thread",
      agent_profile_id: "built-in-ops-operator",
      environment_profile_id: "built-in-session-default",
      metadata: {
        startupContext: {
          repoDocPaths: ["docs/runbook.md"],
        },
      },
    });

    await sendAgentSessionMessage({
      sessionId: session.id,
      task: {
        kind: "operator_thread",
        provider: "openai_responses",
        runtime: "openai_responses",
        input: {
          message: "Summarize the bounded work.",
        },
      },
    });
    expect(runOpenAIResponsesTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          expected_prompt_cache_reuse_count: 1,
          expected_prompt_cache_reuse_probability: 0.5,
        }),
      }),
    );
    await sendAgentSessionMessage({
      sessionId: session.id,
      task: {
        kind: "operator_thread",
        provider: "openai_responses",
        runtime: "openai_responses",
        input: { message: "Continue with retained context." },
      },
    });
    expect(runOpenAIResponsesTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          openai_replay_input: expect.any(Array),
          expected_prompt_cache_reuse_count: 1,
          expected_prompt_cache_reuse_probability: 0.5,
        }),
      }),
    );

    const events = await listRuntimeEventsForSession(session.id);
    const checkpoints = await listCheckpointsForSession(session.id);

    expect(events.some((event) => event.kind === "session.created")).toBe(true);
    expect(events.some((event) => event.kind === "run.outcome.graded")).toBe(true);
    expect(checkpoints.length).toBeGreaterThan(0);
  });

  it("delegates a bounded subagent task from a parent session", async () => {
    const {
      createAgentSession,
      delegateManagedAgentTask,
      listRuntimeEventsForSession,
    } = await import("../agents/runtime");

    const parentSession = await createAgentSession({
      title: "Parent session",
      task_kind: "operator_thread",
      agent_profile_id: "built-in-ops-operator",
      environment_profile_id: "built-in-session-default",
    });

    const delegated = await delegateManagedAgentTask({
      title: "Delegated research task",
      message: "Collect the narrow evidence needed for the issue.",
      agentProfileId: "built-in-research-subagent",
      environmentProfileId: "built-in-web-research",
      parentSessionId: parentSession.id,
    });

    expect(delegated.session.agent_profile_id).toBe("built-in-research-subagent");

    const parentEvents = await listRuntimeEventsForSession(parentSession.id);
    expect(parentEvents.some((event) => event.kind === "subagent.spawned")).toBe(true);
  });

  it("records a first-class compaction when a session is forked", async () => {
    const {
      createAgentSession,
      forkAgentSessionWithHandoff,
      listCompactionsForSession,
    } = await import("../agents/runtime");

    const session = await createAgentSession({
      title: "Compaction source",
      task_kind: "operator_thread",
      provider: "openai_responses",
      session_key: "session:compaction",
    });

    fake.store.agentRuns.set("run-compaction", {
      id: "run-compaction",
      session_id: session.id,
      session_key: "session:compaction",
      task_kind: "operator_thread",
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.4",
      status: "failed",
      input: {
        kind: "operator_thread",
        input: {
          message: "The thread overflowed and needs compaction.",
        },
      },
      error: "context window exceeded",
      created_at: "timestamp",
      updated_at: "timestamp",
    });

    await forkAgentSessionWithHandoff({
      sessionId: session.id,
      phase: "implementation",
      sourceRunId: "run-compaction",
    });

    const compactions = await listCompactionsForSession(session.id);
    expect(compactions.length).toBeGreaterThan(0);
    expect(compactions[0]?.target_session_id).toBeTruthy();
  });
});
