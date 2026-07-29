// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const stripeState = vi.hoisted(() => ({ creates: 0 }));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: async () => {
          stripeState.creates += 1;
          return { id: "unexpected" };
        },
      },
    };
  },
}));

async function startServer() {
  const { default: handler } = await import("../routes/api/create-checkout-session");
  const app = express();
  app.use(express.json());
  app.post("/api/create-checkout-session", handler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { server, url: `http://127.0.0.1:${address.port}/api/create-checkout-session` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

afterEach(() => {
  stripeState.creates = 0;
  vi.resetModules();
});

describe("legacy robot-eval-run checkout", () => {
  it("returns a precise migration response and creates no Stripe state", async () => {
    const route = await startServer();
    try {
      const response = await fetch(route.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionType: "robot-eval-run",
          robotEvalRun: { siteSlug: "historical-site" },
          totalCost: 1,
        }),
      });
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({
        code: "legacy_robot_eval_checkout_retired",
        current_product: "Task Evaluation Run",
        request_url: expect.stringContaining("task-evaluation-run"),
      });
      expect(stripeState.creates).toBe(0);
    } finally {
      await stopServer(route.server);
    }
  });

  it("does not silently reinterpret unknown legacy customer intent", async () => {
    const route = await startServer();
    try {
      const response = await fetch(route.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionType: "robot-eval-run", totalCost: 999999 }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(410);
      expect(body).not.toHaveProperty("sessionId");
      expect(body).not.toHaveProperty("price");
      expect(stripeState.creates).toBe(0);
    } finally {
      await stopServer(route.server);
    }
  });
});
