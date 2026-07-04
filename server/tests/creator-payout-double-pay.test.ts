// @vitest-environment node
//
// Regression coverage for beta blocker WEB-01: creator payout disbursement had a
// read-then-write double-pay race. beginCreatorPayoutDisbursement selected
// "approved" payout entries and, in a *separate* step, flipped them to
// "in_transit" with no atomic guard. Two overlapping instant_payout requests for
// the same creator both read the same approved entries and each produced a
// disbursement for the same money.
//
// These tests use a Firestore mock that models runTransaction with Firestore's
// serializable-isolation guarantee (transactions run one-at-a-time and re-read
// live state), so two overlapping beginCreatorPayoutDisbursement calls must
// collapse into a single disbursement.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  // Serializes runTransaction callbacks to emulate Firestore's serializable
  // isolation: a transaction cannot observe a partial write from another.
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

function snapshotFor(collection: string, id: string) {
  const data = readDoc(collection, id);
  return {
    id,
    exists: Boolean(data),
    data: () => (data ? clone(data) : undefined),
    ref: { id, path: docKey(collection, id) },
  };
}

function refFor(collection: string, id: string) {
  return {
    id,
    path: docKey(collection, id),
    __collection: collection,
    get: async () => snapshotFor(collection, id),
    set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
      const existing = readDoc(collection, id) || {};
      state.docs.set(
        docKey(collection, id),
        options?.merge ? deepMerge(existing, payload) : clone(payload),
      );
    },
    update: async (payload: StoredDoc) => {
      const existing = readDoc(collection, id) || {};
      state.docs.set(docKey(collection, id), deepMerge(existing, payload));
    },
    create: async (payload: StoredDoc) => {
      const key = docKey(collection, id);
      if (state.docs.has(key)) {
        const error = new Error("already exists") as Error & { code?: string };
        error.code = "already-exists";
        throw error;
      }
      state.docs.set(key, clone(payload));
    },
  };
}

function makeCollection(collectionName: string) {
  return {
    doc: (id: string) => refFor(collectionName, id),
    where: (field: string, op: string, value: unknown) => ({
      get: async () => {
        if (op !== "==") {
          throw new Error(`Unsupported operator ${op}`);
        }
        const docs = Array.from(state.docs.entries())
          .filter(([key, data]) => {
            if (!key.startsWith(`${collectionName}/`)) {
              return false;
            }
            return data[field] === value;
          })
          .map(([key, data]) => {
            const id = key.slice(collectionName.length + 1);
            return {
              id,
              data: () => clone(data),
              ref: refFor(collectionName, id),
            };
          });
        return { docs };
      },
    }),
  };
}

const dbAdmin = {
  collection: (collectionName: string) => makeCollection(collectionName),
  runTransaction: async <T>(
    updateFn: (tx: {
      get: (ref: ReturnType<typeof refFor>) => Promise<ReturnType<typeof snapshotFor>>;
      set: (
        ref: ReturnType<typeof refFor>,
        payload: StoredDoc,
        options?: { merge?: boolean },
      ) => void;
      update: (ref: ReturnType<typeof refFor>, payload: StoredDoc) => void;
      create: (ref: ReturnType<typeof refFor>, payload: StoredDoc) => void;
    }) => Promise<T>,
  ): Promise<T> => {
    // Emulate Firestore's serializable isolation by chaining transactions so
    // their read + write critical sections never interleave. A correct fix
    // re-reads entry status *inside* the transaction, so the second serialized
    // transaction observes the first transaction's in_transit flip.
    const run = state.txChain.then(async () => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (ref: ReturnType<typeof refFor>) =>
          snapshotFor(ref.__collection, ref.id),
        set: (
          ref: ReturnType<typeof refFor>,
          payload: StoredDoc,
          options?: { merge?: boolean },
        ) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(
              docKey(ref.__collection, ref.id),
              options?.merge ? deepMerge(existing, payload) : clone(payload),
            );
          });
        },
        update: (ref: ReturnType<typeof refFor>, payload: StoredDoc) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(
              docKey(ref.__collection, ref.id),
              deepMerge(existing, payload),
            );
          });
        },
        create: (ref: ReturnType<typeof refFor>, payload: StoredDoc) => {
          writes.push(() => {
            const key = docKey(ref.__collection, ref.id);
            if (state.docs.has(key)) {
              const error = new Error("already exists") as Error & {
                code?: string;
              };
              error.code = "already-exists";
              throw error;
            }
            state.docs.set(key, clone(payload));
          });
        },
      };
      const result = await updateFn(tx);
      // Commit buffered writes atomically once the callback resolves.
      for (const write of writes) {
        write();
      }
      return result;
    });
    // Keep the chain alive even if this transaction rejects.
    state.txChain = run.catch(() => undefined);
    return run;
  },
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin,
}));

function seedApprovedPayout(params: {
  id: string;
  creatorId: string;
  amountCents: number;
  connectAccountId: string;
}) {
  state.docs.set(docKey("creatorPayouts", params.id), {
    id: params.id,
    creator_id: params.creatorId,
    capture_id: params.id,
    status: "approved",
    approved_amount_cents: params.amountCents,
    base_payout_cents: params.amountCents,
    stripe_connect_account_id: params.connectAccountId,
    disbursement_id: null,
    created_at: "2026-07-03T00:00:00.000Z",
    updated_at: "2026-07-03T00:00:00.000Z",
    approved_at: "2026-07-03T00:00:00.000Z",
  });
}

function listDisbursements(creatorId: string): StoredDoc[] {
  return Array.from(state.docs.entries())
    .filter(([key, data]) => {
      return (
        key.startsWith("creatorPayoutDisbursements/") &&
        data.creator_id === creatorId
      );
    })
    .map(([, data]) => clone(data));
}

beforeEach(() => {
  state.docs.clear();
  state.txChain = Promise.resolve();
});

afterEach(() => {
  vi.resetModules();
});

describe("WEB-01 creator payout disbursement double-pay race", () => {
  it("collapses two overlapping disbursement attempts into a single disbursement", async () => {
    const { beginCreatorPayoutDisbursement } = await import("../utils/accounting");

    seedApprovedPayout({
      id: "cap-1",
      creatorId: "creator-123",
      amountCents: 4500,
      connectAccountId: "acct_creator_123",
    });
    seedApprovedPayout({
      id: "cap-2",
      creatorId: "creator-123",
      amountCents: 2500,
      connectAccountId: "acct_creator_123",
    });

    const [first, second] = await Promise.all([
      beginCreatorPayoutDisbursement({
        creatorId: "creator-123",
        stripeConnectAccountId: "acct_creator_123",
      }),
      beginCreatorPayoutDisbursement({
        creatorId: "creator-123",
        stripeConnectAccountId: "acct_creator_123",
      }),
    ]);

    // Exactly one call may claim the approved entries. The other must find
    // nothing left to disburse (null) — never a second live disbursement.
    const winners = [first, second].filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
    expect(winners).toHaveLength(1);

    const disbursements = listDisbursements("creator-123");
    expect(disbursements).toHaveLength(1);

    // Both approved entries were moved to in_transit exactly once, and both
    // point at the single winning disbursement.
    const cap1 = readDoc("creatorPayouts", "cap-1");
    const cap2 = readDoc("creatorPayouts", "cap-2");
    expect(cap1?.status).toBe("in_transit");
    expect(cap2?.status).toBe("in_transit");
    expect(cap1?.disbursement_id).toBe(disbursements[0].id);
    expect(cap2?.disbursement_id).toBe(disbursements[0].id);

    // No money double-counted: the single disbursement covers the full amount.
    expect(disbursements[0].disbursed_amount_cents).toBe(7000);
    expect(disbursements[0].payout_entry_ids).toEqual(
      expect.arrayContaining(["cap-1", "cap-2"]),
    );
  });

  it("does not re-select an entry already moved to in_transit or paid", async () => {
    const { beginCreatorPayoutDisbursement } = await import("../utils/accounting");

    // An entry already mid-flight must never be swept into a new disbursement.
    state.docs.set(docKey("creatorPayouts", "cap-inflight"), {
      id: "cap-inflight",
      creator_id: "creator-123",
      capture_id: "cap-inflight",
      status: "in_transit",
      approved_amount_cents: 4500,
      base_payout_cents: 4500,
      stripe_connect_account_id: "acct_creator_123",
      disbursement_id: "disb_prior",
      created_at: "2026-07-03T00:00:00.000Z",
      updated_at: "2026-07-03T00:00:00.000Z",
      approved_at: "2026-07-03T00:00:00.000Z",
    });

    const result = await beginCreatorPayoutDisbursement({
      creatorId: "creator-123",
      stripeConnectAccountId: "acct_creator_123",
    });

    expect(result).toBeNull();
    expect(listDisbursements("creator-123")).toHaveLength(0);
    // The in-flight entry is untouched and still tied to the prior disbursement.
    expect(readDoc("creatorPayouts", "cap-inflight")?.disbursement_id).toBe(
      "disb_prior",
    );
  });
});
