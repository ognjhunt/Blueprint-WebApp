import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        increment: (value: number) => ({ __increment: value }),
        serverTimestamp: () => ({ __serverTimestamp: true }),
      },
    },
  },
  dbAdmin: null,
}));

import {
  INBOUND_REQUEST_STATS_SHARD_COUNT,
  incrementInboundRequestStats,
  pickInboundRequestStatsShard,
  readInboundRequestStats,
} from "../utils/inboundRequestStats";

class FakeTimestamp {
  constructor(
    public _seconds: number,
    public _nanoseconds: number,
  ) {}
}

function fakeDb(options: {
  baseData?: Record<string, unknown> | null;
  shardDocs?: Array<Record<string, unknown>>;
  onShardSet?: (docId: string, payload: Record<string, unknown>) => void;
}) {
  const shardsCollection = {
    doc: (docId: string) => ({
      set: async (payload: Record<string, unknown>, opts: unknown) => {
        expect(opts).toEqual({ merge: true });
        options.onShardSet?.(docId, payload);
      },
    }),
    get: async () => ({
      docs: (options.shardDocs ?? []).map((data) => ({ data: () => data })),
    }),
  };
  const baseDoc = {
    get: async () => ({
      exists: options.baseData != null,
      data: () => options.baseData ?? undefined,
    }),
    collection: (name: string) => {
      expect(name).toBe("shards");
      return shardsCollection;
    },
  };
  return {
    collection: (name: string) => {
      expect(name).toBe("stats");
      return { doc: (id: string) => (expect(id).toBe("inboundRequests"), baseDoc) };
    },
  } as never;
}

describe("pickInboundRequestStatsShard", () => {
  it("always lands inside the shard range", () => {
    expect(pickInboundRequestStatsShard(() => 0)).toBe("0");
    expect(pickInboundRequestStatsShard(() => 0.999999)).toBe(
      String(INBOUND_REQUEST_STATS_SHARD_COUNT - 1),
    );
  });
});

describe("incrementInboundRequestStats", () => {
  it("writes increments and a timestamp to one shard", async () => {
    const writes: Array<{ docId: string; payload: Record<string, unknown> }> = [];
    const db = fakeDb({
      onShardSet: (docId, payload) => writes.push({ docId, payload }),
    });

    await incrementInboundRequestStats(
      db,
      { total: 1, "byStatus.submitted": 1, "byStatus.in_review": -1 },
      () => 0.5,
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].docId).toBe(String(Math.floor(0.5 * INBOUND_REQUEST_STATS_SHARD_COUNT)));
    expect(writes[0].payload).toEqual({
      updatedAt: { __serverTimestamp: true },
      total: { __increment: 1 },
      "byStatus.submitted": { __increment: 1 },
      "byStatus.in_review": { __increment: -1 },
    });
  });
});

describe("readInboundRequestStats", () => {
  it("sums the legacy base doc with every shard, keeping non-numeric base fields", async () => {
    const db = fakeDb({
      baseData: {
        total: 100,
        byStatus: { submitted: 60, in_review: 40 },
        updatedAt: new FakeTimestamp(1, 2),
      },
      shardDocs: [
        { total: 3, byStatus: { submitted: 2, qa_passed: 1 }, updatedAt: new FakeTimestamp(3, 4) },
        { total: 1, byStatus: { in_review: -1 }, byPriority: { high: 1 } },
      ],
    });

    const stats = (await readInboundRequestStats(db)) as Record<string, any>;

    expect(stats.total).toBe(104);
    expect(stats.byStatus).toEqual({ submitted: 62, in_review: 39, qa_passed: 1 });
    expect(stats.byPriority).toEqual({ high: 1 });
    expect(stats.updatedAt).toBeInstanceOf(FakeTimestamp);
    expect((stats.updatedAt as FakeTimestamp)._seconds).toBe(1);
  });

  it("returns shard-only sums when the base doc is missing", async () => {
    const db = fakeDb({
      baseData: null,
      shardDocs: [{ total: 2, byStatus: { submitted: 2 } }],
    });
    const stats = (await readInboundRequestStats(db)) as Record<string, any>;
    expect(stats.total).toBe(2);
    expect(stats.byStatus).toEqual({ submitted: 2 });
  });
});
