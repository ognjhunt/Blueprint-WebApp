import { createClient, type RedisClientType } from "redis";

import { validateEnv } from "../config/env";
import { logger } from "../logger";
import type { HostedSessionRecord } from "../types/hosted-session";

const env = validateEnv();
const redisUrl = env.REDIS_URL;
const liveSessionTtlSeconds = Math.max(
  60,
  Number(process.env.BLUEPRINT_HOSTED_SESSION_LIVE_TTL_SECONDS || 60 * 60 * 12),
);
const liveSessionPrefix = process.env.BLUEPRINT_HOSTED_SESSION_LIVE_PREFIX || "hosted-session-live";

const liveSessionClient: RedisClientType | null = redisUrl ? createClient({ url: redisUrl }) : null;
const fallbackLiveSessions = new Map<string, HostedSessionRecord>();

if (liveSessionClient) {
  liveSessionClient.on("error", (error) => {
    logger.warn({ error }, "Hosted session live Redis store error");
  });
  void liveSessionClient.connect().catch((error) => {
    logger.warn({ error }, "Hosted session live Redis store connection failed");
  });
}

function liveSessionKey(sessionId: string) {
  return `${liveSessionPrefix}:${sessionId}`;
}

function sanitizeForLiveStore(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLiveStore(item));
  }
  if (typeof value === "object") {
    if ("toDate" in (value as Record<string, unknown>) && typeof (value as { toDate?: () => Date }).toDate === "function") {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return null;
      }
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizeForLiveStore(nested)]),
    );
  }
  return String(value);
}

function mergeSessionRecord(
  base: HostedSessionRecord | null,
  update: Partial<HostedSessionRecord>,
): HostedSessionRecord | null {
  if (!base) {
    return update && Object.keys(update).length > 0 ? (update as HostedSessionRecord) : null;
  }
  return {
    ...base,
    ...update,
  };
}

export async function getLiveHostedSession(sessionId: string): Promise<HostedSessionRecord | null> {
  if (liveSessionClient) {
    try {
      const payload = await liveSessionClient.get(liveSessionKey(sessionId));
      if (!payload) {
        return null;
      }
      return JSON.parse(payload) as HostedSessionRecord;
    } catch (error) {
      logger.warn({ error, sessionId }, "Failed to read hosted session from Redis live store");
    }
  }
  return fallbackLiveSessions.get(sessionId) ?? null;
}

export async function setLiveHostedSession(record: HostedSessionRecord): Promise<void> {
  const sanitized = sanitizeForLiveStore(record) as HostedSessionRecord;
  fallbackLiveSessions.set(record.sessionId, sanitized);
  if (!liveSessionClient) {
    return;
  }
  try {
    await liveSessionClient.set(liveSessionKey(record.sessionId), JSON.stringify(sanitized), {
      EX: liveSessionTtlSeconds,
    });
  } catch (error) {
    logger.warn({ error, sessionId: record.sessionId }, "Failed to write hosted session to Redis live store");
  }
}

export async function mergeLiveHostedSession(
  sessionId: string,
  update: Partial<HostedSessionRecord>,
): Promise<HostedSessionRecord | null> {
  const current = await getLiveHostedSession(sessionId);
  const merged = mergeSessionRecord(current, sanitizeForLiveStore(update) as Partial<HostedSessionRecord>);
  if (!merged) {
    return null;
  }
  await setLiveHostedSession(merged);
  return merged;
}

export function resetHostedSessionLiveStoreForTests() {
  fallbackLiveSessions.clear();
}
