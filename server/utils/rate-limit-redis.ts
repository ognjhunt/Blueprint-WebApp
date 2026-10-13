import type { ClientRateLimitInfo, IncrementResponse, Options, Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient, type RedisClientType } from "redis";

import { validateEnv } from "../config/env";
import { logger } from "../logger";

const env = validateEnv();
const rateLimitRedisUrl = env.RATE_LIMIT_REDIS_URL || env.REDIS_URL;

function commandTimeoutMs() {
  const parsed = Number(process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 750;
}

/**
 * A Redis outage must degrade to "no shared rate limit", never to a hung
 * /api. The client keeps its offline queue (the automation leader lease and
 * other boot-time callers rely on it), so callers on the request path check
 * `isRedisCommandReady()` / use the fail-open store below, which never wait
 * on a disconnected or slow Redis.
 */
const rateLimitRedisClient: RedisClientType | null =
  rateLimitRedisUrl && process.env.NODE_ENV === "production"
    ? createClient({ url: rateLimitRedisUrl, socket: { connectTimeout: 5_000 } })
    : null;

if (rateLimitRedisClient) {
  rateLimitRedisClient.on("error", (error) => {
    logger.warn({ error }, "Redis rate limit store error");
  });
  void rateLimitRedisClient.connect().catch((error) => {
    logger.error({ error }, "Redis rate limit store could not connect; rate limits fail open");
  });
}

export const getRateLimitRedisClient = (): RedisClientType | null =>
  rateLimitRedisClient;

/** True only while the shared client can answer now (not queued for reconnect). */
export function isRedisCommandReady(client: { isReady?: boolean } | null | undefined = rateLimitRedisClient): boolean {
  return Boolean(client && client.isReady !== false);
}

/** Race a Redis call against the request-path timeout. */
export function withRedisTimeout<T>(promise: Promise<T>, timeoutMs = commandTimeoutMs()): Promise<T> {
  return withTimeout(promise, timeoutMs);
}

type SendCommand = (...args: string[]) => Promise<unknown>;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("redis_command_timeout")), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

let lastFailOpenLogAt = 0;

function logFailOpen(prefix: string, error: unknown) {
  const now = Date.now();
  if (now - lastFailOpenLogAt < 60_000) return;
  lastFailOpenLogAt = now;
  logger.warn(
    { event: "rate_limit_fail_open", prefix, err: error instanceof Error ? error.message : String(error) },
    "Redis rate limit store unavailable; allowing requests without the shared limit",
  );
}

/**
 * Wrap the Redis store so any store failure or slow reply lets the request
 * through (fail open) within `timeoutMs`, independent of each limiter's
 * `passOnStoreError` setting.
 */
export function createFailOpenRateLimitStore(options: {
  sendCommand: SendCommand;
  prefix: string;
  timeoutMs?: number;
  isReady?: () => boolean;
}): Store {
  const timeoutMs = options.timeoutMs ?? commandTimeoutMs();
  const isReady = options.isReady || (() => true);
  const sendCommand: SendCommand = (...args) => {
    if (!isReady()) return Promise.reject(new Error("redis_not_ready"));
    return withTimeout(Promise.resolve().then(() => options.sendCommand(...args)), timeoutMs);
  };
  const inner = new RedisStore({ sendCommand: sendCommand as never, prefix: options.prefix });
  // The store loads its scripts eagerly. If Redis is down at boot those loads
  // reject before anything awaits them; the store reloads on first use, so
  // mark the initial attempts handled instead of crashing on an unhandled
  // rejection.
  for (const key of ["incrementScriptSha", "getScriptSha"] as const) {
    const pending = (inner as unknown as Record<string, unknown>)[key];
    if (pending && typeof (pending as Promise<unknown>).catch === "function") {
      (pending as Promise<unknown>).catch(() => undefined);
    }
  }
  let windowMs = 60_000;

  return {
    prefix: options.prefix,
    localKeys: false,
    init(config: Options) {
      windowMs = config.windowMs;
      inner.init(config);
    },
    async get(key: string): Promise<ClientRateLimitInfo | undefined> {
      try {
        return await withTimeout(inner.get(key), timeoutMs * 2);
      } catch (error) {
        logFailOpen(options.prefix, error);
        return undefined;
      }
    },
    async increment(key: string): Promise<IncrementResponse> {
      try {
        return await withTimeout(inner.increment(key), timeoutMs * 2);
      } catch (error) {
        logFailOpen(options.prefix, error);
        return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
      }
    },
    async decrement(key: string) {
      try { await withTimeout(inner.decrement(key), timeoutMs * 2); } catch { /* fail open */ }
    },
    async resetKey(key: string) {
      try { await withTimeout(inner.resetKey(key), timeoutMs * 2); } catch { /* fail open */ }
    },
  };
}

export const createRateLimitRedisStore = (prefix: string): Store | undefined =>
  rateLimitRedisClient
    ? createFailOpenRateLimitStore({
        sendCommand: (...args: string[]) => rateLimitRedisClient.sendCommand(args),
        prefix,
        isReady: () => rateLimitRedisClient.isReady,
      })
    : undefined;
