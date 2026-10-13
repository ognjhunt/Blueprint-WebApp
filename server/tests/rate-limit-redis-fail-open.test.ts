// @vitest-environment node
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer, type Server } from "node:http";
import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({ validateEnv: () => ({}) }));

import { createFailOpenRateLimitStore, isRedisCommandReady, withRedisTimeout } from "../utils/rate-limit-redis";

async function serve(store: ReturnType<typeof createFailOpenRateLimitStore>): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 2, standardHeaders: true, legacyHeaders: false, store }));
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stop(server: Server) {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("Redis rate-limit store fails open", () => {
  it("lets /api through quickly when Redis hangs", async () => {
    const sendCommand = vi.fn(() => new Promise<unknown>(() => undefined));
    const store = createFailOpenRateLimitStore({ sendCommand, prefix: "rl:test:", timeoutMs: 50 });
    const { server, baseUrl } = await serve(store);
    try {
      const started = Date.now();
      for (let i = 0; i < 4; i += 1) {
        const response = await fetch(`${baseUrl}/api/ping`);
        expect(response.status).toBe(200);
      }
      // 4 requests, each bounded by the timeout rather than hanging.
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      await stop(server);
    }
  });

  it("does not even try while the client is disconnected", async () => {
    const sendCommand = vi.fn(async () => "OK");
    const store = createFailOpenRateLimitStore({ sendCommand, prefix: "rl:test:", isReady: () => false });
    const { server, baseUrl } = await serve(store);
    try {
      expect((await fetch(`${baseUrl}/api/ping`)).status).toBe(200);
      expect(sendCommand).not.toHaveBeenCalled();
    } finally {
      await stop(server);
    }
  });

  it("lets requests through when Redis errors", async () => {
    const store = createFailOpenRateLimitStore({
      sendCommand: async () => { throw new Error("ECONNREFUSED"); },
      prefix: "rl:test:",
      timeoutMs: 50,
    });
    const { server, baseUrl } = await serve(store);
    try {
      for (let i = 0; i < 3; i += 1) expect((await fetch(`${baseUrl}/api/ping`)).status).toBe(200);
    } finally {
      await stop(server);
    }
  });

  it("still enforces the limit when Redis is healthy", async () => {
    const counts = new Map<string, number>();
    const sendCommand = vi.fn(async (...args: string[]) => {
      if (args[0] === "SCRIPT") return "sha";
      if (args[0] === "EVALSHA") {
        const key = args[3];
        counts.set(key, (counts.get(key) || 0) + 1);
        return [counts.get(key), 60_000];
      }
      return null;
    });
    const store = createFailOpenRateLimitStore({ sendCommand, prefix: "rl:test:", timeoutMs: 200 });
    const { server, baseUrl } = await serve(store);
    try {
      expect((await fetch(`${baseUrl}/api/ping`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/ping`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/ping`)).status).toBe(429);
    } finally {
      await stop(server);
    }
  });

  it("exposes readiness and timeout helpers for direct request-path calls", async () => {
    expect(isRedisCommandReady(null)).toBe(false);
    expect(isRedisCommandReady({ isReady: false })).toBe(false);
    expect(isRedisCommandReady({ isReady: true })).toBe(true);
    await expect(withRedisTimeout(new Promise(() => undefined), 20)).rejects.toThrow("redis_command_timeout");
  });
});
