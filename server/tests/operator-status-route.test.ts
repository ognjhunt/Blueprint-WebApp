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
    res.locals.firebaseUser = {
      uid: String(req.headers["x-test-uid"] || ""),
      email: req.headers["x-test-email"] ? String(req.headers["x-test-email"]) : undefined,
      email_verified: req.headers["x-test-verified"] === "true",
    };
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
      account_owner_uid: "operator-1",
      status: "submitted",
      qualification_state: "evidence_requested",
      request: {
        buyerType: "site_operator",
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

  it("returns null instead of inventing missing operational states", async () => {
    state.users.set("operator-2", {
      buyerType: "site_operator",
      structuredIntakeRequestId: "request-2",
    });
    state.requests.set("request-2", {
      requestId: "request-2",
      account_owner_uid: "operator-2",
      request: {
        buyerType: "site_operator",
        siteName: "South line",
      },
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/operator-status/current`, {
        headers: { "x-test-uid": "operator-2" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          request: expect.objectContaining({
            qualification_state: null,
            opportunity_state: null,
            rights_status: null,
            capture_status: null,
            quote_status: null,
            next_step: null,
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  describe("cross-tenant reads through an owner-writable profile link", () => {
    function seedVictim(extra: Record<string, unknown> = {}) {
      state.requests.set("victim-request", {
        requestId: "victim-request",
        request: { buyerType: "site_operator", siteName: "Victim site", taskStatement: "Secret task" },
        contact: { email: "victim@example.com" },
        ops: { next_step: "Private next step" },
        ...extra,
      });
    }

    async function readAs(uid: string, headers: Record<string, string> = {}) {
      const { server, baseUrl } = await startRoute();
      try {
        const response = await fetch(`${baseUrl}/api/operator-status/current`, {
          headers: { "x-test-uid": uid, ...headers },
        });
        return { status: response.status, body: await response.json() };
      } finally {
        await stopServer(server);
      }
    }

    it("does not return another account's owned request even when the profile links it", async () => {
      seedVictim({ account_owner_uid: "victim-uid" });
      state.users.set("attacker", { buyerType: "site_operator", structuredIntakeRequestId: "victim-request" });
      const { status, body } = await readAs("attacker", { "x-test-email": "victim@example.com", "x-test-verified": "true" });
      expect(status).toBe(200);
      expect(body.request).toBeNull();
      expect(JSON.stringify(body)).not.toContain("Victim site");
      expect(JSON.stringify(body)).not.toContain("Private next step");
    });

    it("does not return a legacy unowned request to an unverified or different email", async () => {
      seedVictim();
      state.users.set("attacker", { buyerType: "site_operator", structuredIntakeRequestId: "victim-request" });
      expect((await readAs("attacker", { "x-test-email": "attacker@example.com", "x-test-verified": "true" })).body.request).toBeNull();
      expect((await readAs("attacker", { "x-test-email": "victim@example.com", "x-test-verified": "false" })).body.request).toBeNull();
    });

    it("does not return a robot-team request through an operator profile", async () => {
      seedVictim({ account_owner_uid: "operator-9", request: { buyerType: "robot_team", siteName: "Victim site" } });
      state.users.set("operator-9", { buyerType: "site_operator", structuredIntakeRequestId: "victim-request" });
      expect((await readAs("operator-9")).body.request).toBeNull();
    });

    it("still serves a legacy unowned request to the verified contact email", async () => {
      seedVictim();
      state.users.set("victim-uid", { buyerType: "site_operator", structuredIntakeRequestId: "victim-request" });
      const { body } = await readAs("victim-uid", { "x-test-email": "Victim@Example.com", "x-test-verified": "true" });
      expect(body.request).toMatchObject({ request_id: "victim-request", site_name: "Victim site" });
    });
  });
});
