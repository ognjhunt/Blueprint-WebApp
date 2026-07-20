// @vitest-environment node
//
// Leader election for the ops automation scheduler: exactly one instance may
// hold the "ops-automation-leader" lease at a time (Redis SET NX PX when Redis
// is configured, Firestore transaction lease otherwise), non-holders keep
// retrying, and a released or expired lease is claimable by another instance.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAutomationLeaderLease,
  type LeaseFirestoreClient,
  type LeaseRedisClient,
} from "../utils/automationLeaderLease";

function makeFakeRedis() {
  const store = new Map<string, { value: string; expiresAtMs: number }>();
  let nowMs = 0;
  const alive = (key: string) => {
    const entry = store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAtMs <= nowMs) {
      store.delete(key);
      return null;
    }
    return entry;
  };
  const client: LeaseRedisClient = {
    set: async (key, value, options) => {
      if (options.NX && alive(key)) {
        return null;
      }
      store.set(key, { value, expiresAtMs: nowMs + options.PX });
      return "OK";
    },
    eval: async (script, { keys, arguments: args }) => {
      const entry = alive(keys[0]);
      if (!entry || entry.value !== args[0]) {
        return 0;
      }
      if (script.includes("pexpire")) {
        entry.expiresAtMs = nowMs + Number(args[1]);
        return 1;
      }
      store.delete(keys[0]);
      return 1;
    },
  };
  return {
    client,
    holder: (key: string) => alive(key)?.value ?? null,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function makeFakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  let txChain: Promise<unknown> = Promise.resolve();
  const firestore: LeaseFirestoreClient = {
    collection: (collectionName: string) => ({
      doc: (id: string) =>
        ({ __path: `${collectionName}/${id}` }) as unknown as FirebaseFirestore.DocumentReference,
    }),
    runTransaction: async (updateFunction) => {
      const run = txChain.then(async () => {
        const writes: Array<() => void> = [];
        const tx = {
          get: async (ref: { __path: string }) => {
            const data = docs.get(ref.__path);
            return {
              exists: Boolean(data),
              data: () => (data ? { ...data } : undefined),
            };
          },
          set: (
            ref: { __path: string },
            payload: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => {
            writes.push(() => {
              const existing = options?.merge ? docs.get(ref.__path) || {} : {};
              docs.set(ref.__path, { ...existing, ...payload });
            });
          },
        } as unknown as FirebaseFirestore.Transaction;
        const result = await updateFunction(tx);
        for (const write of writes) {
          write();
        }
        return result;
      });
      txChain = run.catch(() => undefined);
      return run as ReturnType<typeof updateFunction>;
    },
  };
  return {
    firestore,
    holder: () =>
      (docs.get("opsAutomationLeases/ops-automation-leader")?.holder_id as
        | string
        | null
        | undefined) ?? null,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("automation leader lease (Redis)", () => {
  it("grants the lease to one instance and keeps the other in standby", async () => {
    const redis = makeFakeRedis();
    const first = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });
    const second = createAutomationLeaderLease({
      instanceId: "instance-b",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });

    expect(await first.tick()).toBe(true);
    expect(await second.tick()).toBe(false);
    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);
    expect(redis.holder("ops-automation-leader")).toBe("instance-a");

    // Renewal keeps the same holder.
    expect(await first.tick()).toBe(true);
    expect(redis.holder("ops-automation-leader")).toBe("instance-a");
  });

  it("lets a standby instance take over after the lease expires", async () => {
    const redis = makeFakeRedis();
    const first = createAutomationLeaderLease({
      instanceId: "instance-a",
      ttlMs: 60_000,
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });
    const second = createAutomationLeaderLease({
      instanceId: "instance-b",
      ttlMs: 60_000,
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });

    expect(await first.tick()).toBe(true);
    redis.advance(61_000);
    expect(await second.tick()).toBe(true);
    expect(redis.holder("ops-automation-leader")).toBe("instance-b");
    // The stale leader loses the lease on its next tick.
    expect(await first.tick()).toBe(false);
  });

  it("releases the lease on stop so another instance can acquire immediately", async () => {
    const redis = makeFakeRedis();
    const first = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });
    const second = createAutomationLeaderLease({
      instanceId: "instance-b",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });

    expect(await first.tick()).toBe(true);
    await first.stop();
    expect(redis.holder("ops-automation-leader")).toBeNull();
    expect(await second.tick()).toBe(true);
  });
});

describe("automation leader lease (Firestore fallback)", () => {
  it("grants the lease via transaction and blocks a second holder until expiry", async () => {
    let nowMs = 1_000_000;
    const backing = makeFakeFirestore();
    const first = createAutomationLeaderLease({
      instanceId: "instance-a",
      ttlMs: 60_000,
      now: () => nowMs,
      getRedisClient: () => null,
      getFirestore: () => backing.firestore,
      isForced: () => false,
    });
    const second = createAutomationLeaderLease({
      instanceId: "instance-b",
      ttlMs: 60_000,
      now: () => nowMs,
      getRedisClient: () => null,
      getFirestore: () => backing.firestore,
      isForced: () => false,
    });

    expect(await first.tick()).toBe(true);
    expect(await second.tick()).toBe(false);
    expect(backing.holder()).toBe("instance-a");

    // Renewal by the holder extends the lease.
    nowMs += 30_000;
    expect(await first.tick()).toBe(true);
    expect(await second.tick()).toBe(false);

    // After expiry the standby instance claims the lease.
    nowMs += 61_000;
    expect(await second.tick()).toBe(true);
    expect(backing.holder()).toBe("instance-b");
  });

  it("clears the holder on stop", async () => {
    const backing = makeFakeFirestore();
    const lease = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () => null,
      getFirestore: () => backing.firestore,
      isForced: () => false,
    });

    expect(await lease.tick()).toBe(true);
    await lease.stop();
    expect(backing.holder()).toBeNull();
  });

  it("fails closed when the transaction errors", async () => {
    const lease = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () => null,
      getFirestore: () =>
        ({
          collection: () => ({ doc: () => ({}) }),
          runTransaction: async () => {
            throw new Error("firestore unavailable");
          },
        }) as unknown as LeaseFirestoreClient,
      isForced: () => false,
    });

    expect(await lease.tick()).toBe(false);
    expect(lease.isLeader()).toBe(false);
  });
});

describe("automation leader lease (defaults and overrides)", () => {
  it("acts as leader when no coordination store is available", async () => {
    const lease = createAutomationLeaderLease({
      getRedisClient: () => null,
      getFirestore: () => null,
      isForced: () => false,
    });
    expect(await lease.tick()).toBe(true);
    expect(lease.isLeader()).toBe(true);
  });

  it("honors the force-leader kill switch even without acquiring the lease", async () => {
    const redis = makeFakeRedis();
    const holder = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
      isForced: () => false,
    });
    expect(await holder.tick()).toBe(true);

    vi.stubEnv("BLUEPRINT_OPS_AUTOMATION_FORCE_LEADER", "true");
    const forced = createAutomationLeaderLease({
      instanceId: "instance-b",
      getRedisClient: () => redis.client,
      getFirestore: () => null,
    });
    expect(forced.isLeader()).toBe(true);
    expect(await forced.tick()).toBe(true);
  });

  it("falls back to Firestore when Redis errors", async () => {
    const backing = makeFakeFirestore();
    const lease = createAutomationLeaderLease({
      instanceId: "instance-a",
      getRedisClient: () =>
        ({
          set: async () => {
            throw new Error("redis down");
          },
          eval: async () => {
            throw new Error("redis down");
          },
        }) as LeaseRedisClient,
      getFirestore: () => backing.firestore,
      isForced: () => false,
    });

    expect(await lease.tick()).toBe(true);
    expect(backing.holder()).toBe("instance-a");
  });
});
