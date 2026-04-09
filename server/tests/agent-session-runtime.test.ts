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
    requires_human_review: false,
    requires_approval: false,
  }),
);

vi.mock("../agents/adapters/openai-responses", () => ({
  runOpenAIResponsesTask,
}));

type QueryFilter = {
  field: string;
  op: string;
  value: unknown;
};

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
      collection(name: keyof typeof store) {
        return {
          doc(id: string) {
            return {
              async set(value: Record<string, unknown>, options?: { merge?: boolean }) {
                const current = store[name].get(id) || {};
                store[name].set(id, options?.merge ? { ...current, ...value } : value);
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
  vi.resetModules();
});

describe("agent session runtime", () => {
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
        input: {
          message: "Summarize the bounded work.",
        },
      },
    });

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
