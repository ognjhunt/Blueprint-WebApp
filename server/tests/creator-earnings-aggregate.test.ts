// @vitest-environment node
//
// creatorEarningsAggregates/{creatorId} keeps lifetime per-status payout
// totals so /earnings and disbursement reads stop scanning a creator's full
// payout history. The aggregate is lazily backfilled from one full scan and
// then maintained inside the same transactions that write creatorPayouts
// entries — these tests cover create → increment, disburse/settle → bucket
// moves, and the missing-aggregate backfill path.
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  txChain: Promise.resolve() as Promise<unknown>,
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      merged[key] = deepMerge(existing, value);
      continue;
    }
    merged[key] = clone(value);
  }
  return merged;
}

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function readDoc(collection: string, id: string): StoredDoc | undefined {
  const stored = state.docs.get(docKey(collection, id));
  return stored ? clone(stored) : undefined;
}

function writeDoc(
  collection: string,
  id: string,
  payload: StoredDoc,
  options?: { merge?: boolean },
) {
  const existing = readDoc(collection, id) || {};
  state.docs.set(
    docKey(collection, id),
    options?.merge ? deepMerge(existing, payload) : clone(payload),
  );
}

function snapshotFor(collection: string, id: string) {
  const data = readDoc(collection, id);
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? clone(data) : undefined),
  };
}

function refFor(collection: string, id: string) {
  return {
    id,
    __collection: collection,
    get: async () => snapshotFor(collection, id),
    set: async (payload: StoredDoc, options?: { merge?: boolean }) =>
      writeDoc(collection, id, payload, options),
  };
}

type QueryFilter = { field: string; op: string; value: unknown };

function matchesFilter(data: StoredDoc, filter: QueryFilter): boolean {
  if (filter.op === "==") {
    return data[filter.field] === filter.value;
  }
  if (filter.op === "in") {
    return (
      Array.isArray(filter.value) &&
      (filter.value as unknown[]).includes(data[filter.field])
    );
  }
  throw new Error(`Unsupported operator ${filter.op}`);
}

function runQuery(collection: string, filters: QueryFilter[]) {
  const docs = Array.from(state.docs.entries())
    .filter(([key, data]) => {
      if (!key.startsWith(`${collection}/`)) {
        return false;
      }
      return filters.every((filter) => matchesFilter(data, filter));
    })
    .map(([key, data]) => {
      const id = key.slice(collection.length + 1);
      return { id, data: () => clone(data), ref: refFor(collection, id) };
    });
  return { docs };
}

function makeQuery(collection: string, filters: QueryFilter[]) {
  return {
    __collection: collection,
    __filters: filters,
    where: (field: string, op: string, value: unknown) =>
      makeQuery(collection, [...filters, { field, op, value }]),
    get: async () => runQuery(collection, filters),
  };
}

type MockRef = ReturnType<typeof refFor>;
type MockQuery = ReturnType<typeof makeQuery>;

const dbAdmin = {
  collection: (collection: string) => ({
    doc: (id: string) => refFor(collection, id),
    where: (field: string, op: string, value: unknown) =>
      makeQuery(collection, [{ field, op, value }]),
  }),
  // Serialized transactions with buffered writes, mirroring Firestore's
  // serializable isolation. tx.get supports both document refs and queries
  // (the aggregate backfill scans inside a transaction).
  runTransaction: async <T>(
    updateFn: (tx: {
      get: (target: MockRef | MockQuery) => Promise<unknown>;
      set: (ref: MockRef, payload: StoredDoc, options?: { merge?: boolean }) => void;
    }) => Promise<T>,
  ): Promise<T> => {
    const run = state.txChain.then(async () => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (target: MockRef | MockQuery) => {
          if ("__filters" in target) {
            return runQuery(target.__collection, target.__filters);
          }
          return snapshotFor(target.__collection, target.id);
        },
        set: (ref: MockRef, payload: StoredDoc, options?: { merge?: boolean }) => {
          writes.push(() => writeDoc(ref.__collection, ref.id, payload, options));
        },
      };
      const result = await updateFn(tx);
      for (const write of writes) {
        write();
      }
      return result;
    });
    state.txChain = run.catch(() => undefined);
    return run;
  },
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin,
}));

const FUNDED_RECOMMENDATION = {
  status: "baseline",
  base_payout_cents: 4500,
  recommended_payout_cents: 4500,
  payout_funding_policy: {
    mode: "buyer_revenue_linked",
    buyer_order_id: "order-paid-1",
    realized_buyer_revenue_cents: 10000,
  },
  reasons: [],
};

async function upsertFundedPayout(captureId: string) {
  const { upsertCreatorPayoutFromPipeline } = await import("../utils/accounting");
  state.docs.set(docKey("capture_submissions", captureId), {
    creator_id: "creator-123",
    status: "submitted",
    payout_cents: 0,
  });
  return upsertCreatorPayoutFromPipeline({
    captureId,
    sceneId: "scene-1",
    captureJobId: "job-1",
    buyerRequestId: "req-1",
    siteSubmissionId: "site-1",
    qualificationState: "qualified_ready",
    opportunityState: "handoff_ready",
    recommendation: FUNDED_RECOMMENDATION,
    recommendationUri: "gs://bucket/payout.json",
    stripeConnectAccountId: "acct_creator_123",
  });
}

function seedPayout(params: {
  id: string;
  creatorId?: string;
  status: string;
  amountCents: number;
}) {
  state.docs.set(docKey("creatorPayouts", params.id), {
    id: params.id,
    creator_id: params.creatorId || "creator-123",
    capture_id: params.id,
    status: params.status,
    approved_amount_cents: params.amountCents,
    base_payout_cents: params.amountCents,
    created_at: "2026-07-03T00:00:00.000Z",
    updated_at: "2026-07-03T00:00:00.000Z",
    approved_at: "2026-07-03T00:00:00.000Z",
  });
}

beforeEach(() => {
  state.docs.clear();
  state.txChain = Promise.resolve();
  vi.resetModules();
});

describe("creator earnings aggregate", () => {
  it("backfills the aggregate from a one-time full scan when it is missing", async () => {
    const { readCreatorEarningsAggregate, summarizeCreatorEarnings } = await import(
      "../utils/accounting"
    );

    seedPayout({ id: "cap-paid", status: "paid", amountCents: 4500 });
    seedPayout({ id: "cap-approved", status: "approved", amountCents: 2500 });
    seedPayout({ id: "cap-review", status: "review_required", amountCents: 1000 });
    seedPayout({
      id: "cap-other-creator",
      creatorId: "creator-999",
      status: "paid",
      amountCents: 9999,
    });

    const aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.entry_count).toBe(3);
    expect(aggregate.status_totals.paid).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
    expect(aggregate.status_totals.approved).toEqual({
      count: 1,
      approved_amount_cents: 2500,
    });
    expect(summarizeCreatorEarnings(aggregate)).toEqual({
      totalEarnedCents: 4500,
      pendingPayoutCents: 3500,
      scansCompleted: 2,
    });

    // The backfill materialized the aggregate document.
    expect(readDoc("creatorEarningsAggregates", "creator-123")).toMatchObject({
      creator_id: "creator-123",
      entry_count: 3,
    });

    // Subsequent reads serve the stored aggregate, not a fresh scan.
    seedPayout({ id: "cap-unseen", status: "paid", amountCents: 7777 });
    const cached = await readCreatorEarningsAggregate("creator-123");
    expect(cached.entry_count).toBe(3);
  });

  it("stays absent until first read, then the backfill captures earlier writes", async () => {
    const { readCreatorEarningsAggregate } = await import("../utils/accounting");

    await upsertFundedPayout("cap-1");
    // Payout writes never create the aggregate on their own.
    expect(readDoc("creatorEarningsAggregates", "creator-123")).toBeUndefined();

    const aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.entry_count).toBe(1);
    expect(aggregate.status_totals.approved).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
  });

  it("increments the aggregate when a payout entry is created and re-upserts idempotently", async () => {
    const { readCreatorEarningsAggregate } = await import("../utils/accounting");

    // Materialize an empty aggregate first so deltas maintain it.
    await readCreatorEarningsAggregate("creator-123");

    await upsertFundedPayout("cap-1");
    let aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.entry_count).toBe(1);
    expect(aggregate.status_totals.approved).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });

    // Re-running the pipeline upsert replaces the previous slice instead of
    // double counting.
    await upsertFundedPayout("cap-1");
    aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.entry_count).toBe(1);
    expect(aggregate.status_totals.approved).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
  });

  it("moves buckets approved -> in_transit -> paid across disbursement and settlement", async () => {
    const {
      applyCreatorPayoutWebhook,
      beginCreatorPayoutDisbursement,
      finalizeCreatorPayoutDisbursement,
      readCreatorEarningsAggregate,
      summarizeCreatorEarnings,
    } = await import("../utils/accounting");

    await readCreatorEarningsAggregate("creator-123");
    await upsertFundedPayout("cap-1");

    const disbursement = await beginCreatorPayoutDisbursement({
      creatorId: "creator-123",
      stripeConnectAccountId: "acct_creator_123",
    });
    expect(disbursement).not.toBeNull();

    let aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.status_totals.approved).toEqual({
      count: 0,
      approved_amount_cents: 0,
    });
    expect(aggregate.status_totals.in_transit).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
    expect(aggregate.entry_count).toBe(1);

    await finalizeCreatorPayoutDisbursement({
      disbursementId: disbursement!.disbursement.id,
      stripePayoutId: "po_test_123",
    });
    await applyCreatorPayoutWebhook({
      stripePayoutId: "po_test_123",
      eventId: "evt_payout_paid_1",
      eventType: "payout.paid",
      status: "paid",
    });

    aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.status_totals.in_transit).toEqual({
      count: 0,
      approved_amount_cents: 0,
    });
    expect(aggregate.status_totals.paid).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
    expect(summarizeCreatorEarnings(aggregate)).toEqual({
      totalEarnedCents: 4500,
      pendingPayoutCents: 0,
      scansCompleted: 1,
    });
  });

  it("moves buckets to disbursement_failed when a disbursement fails", async () => {
    const { failCreatorPayoutDisbursement, readCreatorEarningsAggregate } = await import(
      "../utils/accounting"
    );

    seedPayout({ id: "cap-1", status: "in_transit", amountCents: 4500 });
    state.docs.set(docKey("creatorPayoutDisbursements", "disb-1"), {
      id: "disb-1",
      creator_id: "creator-123",
      stripe_connect_account_id: "acct_creator_123",
      payout_entry_ids: ["cap-1"],
      status: "in_transit",
      created_at: "2026-07-03T00:00:00.000Z",
      updated_at: "2026-07-03T00:00:00.000Z",
    });
    await readCreatorEarningsAggregate("creator-123");

    await failCreatorPayoutDisbursement({
      disbursementId: "disb-1",
      reason: "stripe transfer failed",
    });

    const aggregate = await readCreatorEarningsAggregate("creator-123");
    expect(aggregate.status_totals.in_transit).toEqual({
      count: 0,
      approved_amount_cents: 0,
    });
    expect(aggregate.status_totals.disbursement_failed).toEqual({
      count: 1,
      approved_amount_cents: 4500,
    });
    expect(aggregate.entry_count).toBe(1);
    expect(readDoc("creatorPayouts", "cap-1")).toMatchObject({
      status: "disbursement_failed",
    });
  });
});
