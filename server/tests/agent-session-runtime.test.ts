// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});

afterEach(() => {
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
});
