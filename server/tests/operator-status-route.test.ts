// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  requests: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const source = name === "users" ? state.users : state.requests;
          return { exists: source.has(id), data: () => source.get(id) };
        },
      }),
    }),
  },
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (record: Record<string, unknown>) => record,
}));

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/operator-status");
  const app = express();
  app.use((req, res, next) => {
    res.locals.firebaseUser = { uid: String(req.headers["x-test-uid"] || "") };
    next();
  });
  app.use("/api/operator-status", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  state.users.clear();
  state.requests.clear();
  vi.resetModules();
});

describe("operator status route", () => {
  it("returns only the authenticated operator's linked intake truth", async () => {
    state.users.set("operator-1", {
      buyerType: "site_operator",
      structuredIntakeRequestId: "request-1",
    });
    state.requests.set("request-1", {
      requestId: "request-1",
      status: "submitted",
      qualification_state: "evidence_requested",
      request: {
        siteName: "North line",
        siteLocation: "Chicago, IL",
        targetSiteType: "manufacturing",
        taskStatement: "Inspect tote transfer",
      },
      ops: {
        rights_status: "pending_review",
        capture_status: "not_requested",
        quote_status: "not_started",
        next_step: "Upload access evidence",
      },
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/operator-status/current`, {
        headers: { "x-test-uid": "operator-1" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          request: expect.objectContaining({
            request_id: "request-1",
            site_name: "North line",
            qualification_state: "evidence_requested",
            rights_status: "pending_review",
            next_step: "Upload access evidence",
          }),
          proof_boundary: expect.stringContaining("does not invent"),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("rejects a non-operator account", async () => {
    state.users.set("buyer-1", { buyerType: "robot_team" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/operator-status/current`, {
        headers: { "x-test-uid": "buyer-1" },
      });
      expect(response.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });
});
