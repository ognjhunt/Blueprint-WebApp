// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/hosted-session-live-store", () => ({
  getHostedSessionLiveStoreStatus: () => ({
    backend: "redis",
    redisConfigured: true,
    redisConnected: true,
    keyPrefix: "hosted-session-live",
    ttlSeconds: 43200,
  }),
}));

async function startServer() {
  const { default: healthRouter } = await import("../routes/health");
  const app = express();
  app.use(healthRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

afterEach(() => {
  vi.resetModules();
});

describe("health routes", () => {
  it("reports the hosted session live-store backend in health status", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/health/status`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(
        (((payload.debug as Record<string, unknown>).liveSessionStore as Record<string, unknown>).backend),
      ).toBe("redis");
    } finally {
      await stopServer(server);
    }
  });

  it("fails readiness when launch-critical dependencies are unavailable and still reports backend detail", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      expect(response.status).toBe(503);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(
        ((((payload.dependencies as Record<string, unknown>).liveSessionStore) as Record<string, unknown>).backend),
      ).toBe("redis");
      expect(((payload.checks as Record<string, unknown>).firebaseAdmin)).toBe(false);
    } finally {
      await stopServer(server);
    }
  });
});
