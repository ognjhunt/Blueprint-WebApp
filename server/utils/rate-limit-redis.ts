import { RedisStore } from "rate-limit-redis";
import { createClient, type RedisClientType } from "redis";

import { validateEnv } from "../config/env";
import { logger } from "../logger";

const env = validateEnv();
const rateLimitRedisUrl = env.RATE_LIMIT_REDIS_URL || env.REDIS_URL;

const rateLimitRedisClient: RedisClientType | null =
  rateLimitRedisUrl && process.env.NODE_ENV === "production"
    ? createClient({ url: rateLimitRedisUrl })
    : null;

if (rateLimitRedisClient) {
  rateLimitRedisClient.on("error", (error) => {
    logger.warn({ error }, "Redis rate limit store error");
  });
  void rateLimitRedisClient.connect();
}

export const getRateLimitRedisClient = (): RedisClientType | null =>
  rateLimitRedisClient;

export const createRateLimitRedisStore = (prefix: string) =>
  rateLimitRedisClient
    ? new RedisStore({
        sendCommand: (...args: string[]) => rateLimitRedisClient.sendCommand(args),
        prefix,
      })
    : undefined;
