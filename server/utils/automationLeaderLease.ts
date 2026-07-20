import { randomUUID } from "crypto";

import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { getRateLimitRedisClient } from "./rate-limit-redis";

/**
 * Single-writer lease for the ops automation scheduler. Exactly one instance
 * may run automation lanes at a time; every other instance keeps trying to
 * acquire the lease so failover happens within one lease TTL. Redis
 * (SET NX PX + compare-and-renew) is preferred when configured; otherwise a
 * Firestore transaction lease is used. With neither store available the lease
 * grants leadership, preserving today's single-instance behavior.
 */

const LEASE_NAME = "ops-automation-leader";
const LEASE_COLLECTION = "opsAutomationLeases";
const DEFAULT_LEASE_TTL_MS = 60_000;

const RENEW_IF_HOLDER_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';
const RELEASE_IF_HOLDER_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export type LeaseRedisClient = {
  set: (
    key: string,
    value: string,
    options: { NX: true; PX: number },
  ) => Promise<string | null>;
  eval: (
    script: string,
    options: { keys: string[]; arguments: string[] },
  ) => Promise<unknown>;
};

export type LeaseFirestoreClient = {
  collection: (name: string) => {
    doc: (id: string) => FirebaseFirestore.DocumentReference;
  };
  runTransaction: <T>(
    updateFunction: (tx: FirebaseFirestore.Transaction) => Promise<T>,
  ) => Promise<T>;
};

export type AutomationLeaderLeaseOptions = {
  leaseName?: string;
  instanceId?: string;
  ttlMs?: number;
  now?: () => number;
  getRedisClient?: () => LeaseRedisClient | null;
  getFirestore?: () => LeaseFirestoreClient | null;
  isForced?: () => boolean;
};

export type AutomationLeaderLease = {
  instanceId: string;
  isLeader: () => boolean;
  tick: () => Promise<boolean>;
  start: () => void;
  stop: () => Promise<void>;
};

function envForcedLeader() {
  return ["1", "true", "yes"].includes(
    String(process.env.BLUEPRINT_OPS_AUTOMATION_FORCE_LEADER || "")
      .trim()
      .toLowerCase(),
  );
}

function defaultFirestoreClient(): LeaseFirestoreClient | null {
  // Some test harnesses mock dbAdmin without transaction support; a lease
  // backend that cannot run transactions is treated as absent.
  if (!dbAdmin || typeof dbAdmin.runTransaction !== "function") {
    return null;
  }
  return dbAdmin as unknown as LeaseFirestoreClient;
}

export function createAutomationLeaderLease(
  options: AutomationLeaderLeaseOptions = {},
): AutomationLeaderLease {
  const leaseName = options.leaseName || LEASE_NAME;
  const instanceId = options.instanceId || randomUUID();
  const ttlMs = Math.max(5_000, options.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  const now = options.now || Date.now;
  const getRedis =
    options.getRedisClient
    || (() => getRateLimitRedisClient() as LeaseRedisClient | null);
  const getFirestore = options.getFirestore || defaultFirestoreClient;
  const isForced = options.isForced || envForcedLeader;

  let leader = false;
  let stopped = false;
  let intervalId: NodeJS.Timeout | null = null;

  const acquireOrRenewViaRedis = async (redis: LeaseRedisClient) => {
    const acquired = await redis.set(leaseName, instanceId, {
      NX: true,
      PX: ttlMs,
    });
    if (acquired) {
      return true;
    }
    const renewed = await redis.eval(RENEW_IF_HOLDER_SCRIPT, {
      keys: [leaseName],
      arguments: [instanceId, String(ttlMs)],
    });
    return Number(renewed) === 1;
  };

  const acquireOrRenewViaFirestore = async (firestore: LeaseFirestoreClient) => {
    const ref = firestore.collection(LEASE_COLLECTION).doc(leaseName);
    return firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = (snapshot.data() || {}) as Record<string, unknown>;
      const holderId = typeof data.holder_id === "string" ? data.holder_id : null;
      const expiresAtMs = Number(data.expires_at_ms);
      const currentMs = now();
      const holdable =
        !snapshot.exists
        || holderId === instanceId
        || !Number.isFinite(expiresAtMs)
        || expiresAtMs <= currentMs;
      if (!holdable) {
        return false;
      }
      tx.set(
        ref,
        {
          lease: leaseName,
          holder_id: instanceId,
          expires_at_ms: currentMs + ttlMs,
          updated_at_iso: new Date(currentMs).toISOString(),
        },
        { merge: true },
      );
      return true;
    });
  };

  const tick = async (): Promise<boolean> => {
    if (isForced()) {
      leader = true;
      return leader;
    }
    const redis = getRedis();
    const firestore = getFirestore();
    if (!redis && !firestore) {
      // No coordination store: single-instance deployment behavior.
      leader = true;
      return leader;
    }
    try {
      if (redis) {
        leader = await acquireOrRenewViaRedis(redis);
        return leader;
      }
    } catch (error) {
      logger.warn(
        { err: error, lease: leaseName, instanceId },
        "Automation leader lease Redis error; falling back to Firestore",
      );
      if (!firestore) {
        leader = false;
        return leader;
      }
    }
    try {
      leader = await acquireOrRenewViaFirestore(firestore!);
    } catch (error) {
      // Fail closed: never risk two instances running automation lanes.
      logger.warn(
        { err: error, lease: leaseName, instanceId },
        "Automation leader lease Firestore error; treating instance as non-leader",
      );
      leader = false;
    }
    return leader;
  };

  const release = async () => {
    if (!leader || isForced()) {
      leader = false;
      return;
    }
    leader = false;
    const redis = getRedis();
    if (redis) {
      try {
        await redis.eval(RELEASE_IF_HOLDER_SCRIPT, {
          keys: [leaseName],
          arguments: [instanceId],
        });
        return;
      } catch (error) {
        logger.warn(
          { err: error, lease: leaseName, instanceId },
          "Automation leader lease Redis release failed",
        );
      }
    }
    const firestore = getFirestore();
    if (!firestore) {
      return;
    }
    try {
      const ref = firestore.collection(LEASE_COLLECTION).doc(leaseName);
      await firestore.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const data = (snapshot.data() || {}) as Record<string, unknown>;
        if (data.holder_id !== instanceId) {
          return;
        }
        tx.set(
          ref,
          {
            holder_id: null,
            expires_at_ms: 0,
            updated_at_iso: new Date(now()).toISOString(),
          },
          { merge: true },
        );
      });
    } catch (error) {
      logger.warn(
        { err: error, lease: leaseName, instanceId },
        "Automation leader lease Firestore release failed",
      );
    }
  };

  return {
    instanceId,
    isLeader: () => (isForced() ? true : leader),
    tick,
    start: () => {
      if (stopped || intervalId) {
        return;
      }
      void tick();
      intervalId = setInterval(() => {
        void tick();
      }, Math.max(1_000, Math.floor(ttlMs / 3)));
      intervalId.unref?.();
    },
    stop: async () => {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      await release();
    },
  };
}

let sharedLease: AutomationLeaderLease | null = null;

export function getOpsAutomationLeaderLease(): AutomationLeaderLease {
  if (!sharedLease) {
    sharedLease = createAutomationLeaderLease();
  }
  return sharedLease;
}

export function __resetOpsAutomationLeaderLeaseForTests() {
  sharedLease = null;
}
