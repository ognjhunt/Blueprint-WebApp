import crypto from "crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getRateLimitRedisClient } from "./rate-limit-redis";

const DEFAULT_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const IDEMPOTENCY_COLLECTION = "idempotencyKeys";

type IdempotencyResponse = {
  status: number;
  body: Record<string, unknown>;
};

type IdempotencyRecord = IdempotencyResponse & {
  expiresAt?: admin.firestore.Timestamp | Date | number;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`);

  return `{${entries.join(",")}}`;
};

export const buildIdempotencyKey = ({
  scope,
  email,
  payload,
  windowMs = DEFAULT_IDEMPOTENCY_WINDOW_MS,
}: {
  scope: string;
  email: string;
  payload: Record<string, unknown>;
  windowMs?: number;
}) => {
  const windowId = Math.floor(Date.now() / windowMs);
  const normalizedEmail = email.trim().toLowerCase();
  const hash = crypto
    .createHash("sha256")
    .update(`${normalizedEmail}|${windowId}|${stableStringify(payload)}`)
    .digest("hex");

  return {
    key: `idempotency:${scope}:${hash}`,
    ttlMs: windowMs,
  };
};

const isRecordExpired = (record?: IdempotencyRecord | null) => {
  if (!record?.expiresAt) {
    return false;
  }

  const expiresAt =
    record.expiresAt instanceof admin.firestore.Timestamp
      ? record.expiresAt.toMillis()
      : record.expiresAt instanceof Date
        ? record.expiresAt.getTime()
        : record.expiresAt;

  return Date.now() > expiresAt;
};

export const fetchIdempotencyResponse = async (
  key: string,
): Promise<IdempotencyResponse | null> => {
  const redisClient = getRateLimitRedisClient();

  if (redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as IdempotencyResponse;
      }
    } catch (error) {
      console.warn("Failed to read idempotency key from Redis:", error);
    }
  }

  if (!db) {
    return null;
  }

  try {
    const snapshot = await db.collection(IDEMPOTENCY_COLLECTION).doc(key).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as IdempotencyRecord | undefined;
    if (!data || isRecordExpired(data)) {
      return null;
    }

    return {
      status: data.status,
      body: data.body,
    };
  } catch (error) {
    console.warn("Failed to read idempotency key from Firestore:", error);
    return null;
  }
};

export const storeIdempotencyResponse = async ({
  key,
  response,
  ttlMs,
}: {
  key: string;
  response: IdempotencyResponse;
  ttlMs: number;
}) => {
  const redisClient = getRateLimitRedisClient();

  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(response), {
        PX: ttlMs,
      });
    } catch (error) {
      console.warn("Failed to store idempotency key in Redis:", error);
    }
  }

  if (!db) {
    return;
  }

  try {
    await db.collection(IDEMPOTENCY_COLLECTION).doc(key).set({
      ...response,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + ttlMs),
    });
  } catch (error) {
    console.warn("Failed to store idempotency key in Firestore:", error);
  }
};
