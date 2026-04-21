// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheDocs = new Map<string, Record<string, unknown>>();
const queryDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

function resetState() {
  cacheDocs.clear();
  queryDocs.length = 0;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name !== "market_signal_cache") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id: string) {
          return {
            async get() {
              return {
                exists: cacheDocs.has(id),
                data: () => cacheDocs.get(id),
              };
            },
            async set(payload: Record<string, unknown>) {
              cacheDocs.set(id, {
                ...(cacheDocs.get(id) || {}),
                ...payload,
              });
            },
          };
        },
        orderBy() {
          return {
            limit(limit: number) {
              return {
                async get() {
                  return {
                    empty: queryDocs.length === 0,
                    docs: queryDocs.slice(0, limit).map((entry) => ({
                      id: entry.id,
                      data: () => entry.data,
                    })),
                  };
                },
              };
            },
          };
        },
        where(field: string, op: string, value: string) {
          if (field !== "last_seen_run_id" || op !== "==") {
            throw new Error(`Unexpected query ${field} ${op}`);
          }

          return {
            async get() {
              return {
                empty: queryDocs.every((entry) => entry.data.last_seen_run_id !== value),
                docs: queryDocs
                  .filter((entry) => entry.data.last_seen_run_id === value)
                  .map((entry) => ({
                    id: entry.id,
                    data: () => entry.data,
                  })),
              };
            },
          };
        },
      };
    },
  },
}));

import {
  readLatestMarketSignalSnapshot,
  writeMarketSignalCache,
} from "../utils/marketSignalCache";

beforeEach(() => {
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("market signal cache", () => {
  it("persists normalized signals into a dedicated cross-run cache ledger", async () => {
    await writeMarketSignalCache({
      runId: "2026-04-20__warehouse-robotics",
      providerKey: "web_search",
      topic: "warehouse robotics",
      signals: [
        {
          id: "signal-1",
          topic: "warehouse robotics",
          title: "Signal one",
          summary: "Summary one",
          url: "https://example.com/1",
          source: "web_search:brave",
          publishedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
    });

    expect(cacheDocs.get("signal-1")).toMatchObject({
      topic: "warehouse robotics",
      signal_provider_key: "web_search",
      title: "Signal one",
      last_seen_run_id: "2026-04-20__warehouse-robotics",
      seen_count: 1,
    });
  });

  it("reads the latest snapshot from the dedicated cache instead of run records", async () => {
    queryDocs.push(
      {
        id: "signal-1",
        data: {
          topic: "warehouse robotics",
          title: "Signal one",
          summary: "Summary one",
          source: "web_search:brave",
          signal_provider_key: "web_search",
          last_seen_run_id: "run-1",
          last_seen_at_iso: "2026-04-20T12:00:00.000Z",
        },
      },
      {
        id: "signal-2",
        data: {
          topic: "warehouse robotics",
          title: "Signal two",
          summary: "Summary two",
          source: "web_search:brave",
          signal_provider_key: "web_search",
          last_seen_run_id: "run-1",
          last_seen_at_iso: "2026-04-20T12:00:00.000Z",
        },
      },
      {
        id: "signal-older",
        data: {
          topic: "field robotics",
          title: "Older signal",
          summary: "Older summary",
          source: "web_search:brave",
          signal_provider_key: "web_search",
          last_seen_run_id: "run-0",
          last_seen_at_iso: "2026-04-19T12:00:00.000Z",
        },
      },
    );

    const snapshot = await readLatestMarketSignalSnapshot();

    expect(snapshot).toMatchObject({
      topic: "warehouse robotics",
      runId: "run-1",
      providerKey: "web_search",
    });
    expect(snapshot?.signals).toHaveLength(2);
  });
});
