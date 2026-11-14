import { createClient, type RedisClientType } from "redis";

import { validateEnv } from "../config/env";
import { logger } from "../logger";

const env = validateEnv();
const redisUrl = env.REDIS_URL;
const liveSessionTtlSeconds = Math.max(
  60,
  Number(process.env.BLUEPRINT_HOSTED_SESSION_LIVE_TTL_SECONDS || 60 * 60 * 12),
);
const liveSessionPrefix = process.env.BLUEPRINT_HOSTED_SESSION_LIVE_PREFIX || "hosted-session-live";

const liveSessionClient: RedisClientType | null = redisUrl ? createClient({ url: redisUrl }) : null;

if (liveSessionClient) {
  liveSessionClient.on("error", (error) => {
    logger.warn({ error }, "Hosted session live Redis store error");
  });
  void liveSessionClient.connect().catch((error) => {
    logger.warn({ error }, "Hosted session live Redis store connection failed");
  });
}

export function getHostedSessionLiveStoreStatus() {
  return {
    backend: liveSessionClient ? ("redis" as const) : ("memory" as const),
    redisConfigured: Boolean(redisUrl),
    redisConnected: liveSessionClient ? liveSessionClient.isReady : false,
    keyPrefix: liveSessionPrefix,
    ttlSeconds: liveSessionTtlSeconds,
  };
}
