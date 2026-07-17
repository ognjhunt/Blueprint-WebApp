// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Firestore stand-in. `docs` maps `${collection}/${id}` -> data.
const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  dbAvailable: true as boolean,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const makeDoc = (collection: string, id: string) => {
    const key = `${collection}/${id}`;
    return {
      get: async () => ({
        exists: state.docs.has(key),
        data: () => state.docs.get(key),
      }),
      set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        const current = state.docs.get(key) || {};
        state.docs.set(key, options?.merge ? { ...current, ...payload } : payload);
      },
    };
  };
  const collection = (name: string) => ({
    doc: (id: string) => makeDoc(name, id),
  });
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => new Date("2026-07-09T00:00:00.000Z"),
        },
      },
    },
    get dbAdmin() {
      return state.dbAvailable ? { collection } : null;
    },
    authAdmin: null,
  };
});

type TestUser = { uid: string; email: string; admin?: boolean } | null;

async function startServer(user: TestUser) {
  const { default: adminRouter, clientRuntimeConfigPublicHandler } = await import(
    "../routes/client-runtime-config"
  );
  const app = express();
  app.use(express.json());
  app.get("/api/client/runtime-config", clientRuntimeConfigPublicHandler);
  app.use(
    "/api/admin/client-runtime-config",
    (_req, res, next) => {
      res.locals.firebaseUser = user;
      next();
    },
    adminRouter,
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

beforeEach(() => {
  state.docs.clear();
  state.dbAvailable = true;
});

afterEach(() => {
  vi.resetModules();
});

describe("client runtime config endpoint (R052)", () => {
  it("serves availability-preserving defaults when no config doc exists", async () => {
    const { server, baseUrl } = await startServer(null);
    try {
      const response = await fetch(`${baseUrl}/api/client/runtime-config`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload.ok).toBe(true);
      expect(payload.schema).toBe("blueprint/client-runtime-config/v1");
      expect(payload.killSwitch).toBe(false);
      expect(payload.maintenanceMode).toBe(false);
      expect(payload.minSupportedVersion).toBe("0.0.0");
      expect(payload.source).toBe("default");
      expect(typeof payload.serverTime).toBe("string");
    } finally {
      await stopServer(server);
    }
  });

  it("reflects an admin-set kill-switch / maintenance / min-version doc", async () => {
    state.docs.set("appConfig/clientRuntime", {
      minSupportedVersion: "1.4.0",
      killSwitch: true,
      maintenanceMode: true,
      message: "Please update to continue.",
    });
    const { server, baseUrl } = await startServer(null);
    try {
      const response = await fetch(`${baseUrl}/api/client/runtime-config`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload.killSwitch).toBe(true);
      expect(payload.maintenanceMode).toBe(true);
      expect(payload.minSupportedVersion).toBe("1.4.0");
      expect(payload.message).toBe("Please update to continue.");
      expect(payload.source).toBe("firestore");
    } finally {
      await stopServer(server);
    }
  });

  it("falls back to safe defaults (kill-switch OFF) when the config store is unavailable", async () => {
    state.dbAvailable = false;
    const { server, baseUrl } = await startServer(null);
    try {
      const response = await fetch(`${baseUrl}/api/client/runtime-config`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload.killSwitch).toBe(false);
      expect(payload.source).toBe("default");
    } finally {
      await stopServer(server);
    }
  });

  it("lets an admin update the config and reads it back", async () => {
    const { server, baseUrl } = await startServer({
      uid: "admin-1",
      email: "admin@blueprint.test",
      admin: true,
    });
    try {
      const put = await fetch(`${baseUrl}/api/admin/client-runtime-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitch: true, minSupportedVersion: "2.0.0", message: "Rollout paused." }),
      });
      expect(put.status).toBe(200);
      const putPayload = (await put.json()) as { config: Record<string, unknown> };
      expect(putPayload.config.killSwitch).toBe(true);
      expect(putPayload.config.minSupportedVersion).toBe("2.0.0");
      expect(putPayload.config.updatedBy).toBe("admin@blueprint.test");

      // Public read now reflects the admin change.
      const publicRead = await fetch(`${baseUrl}/api/client/runtime-config`);
      const publicPayload = (await publicRead.json()) as Record<string, unknown>;
      expect(publicPayload.killSwitch).toBe(true);
      expect(publicPayload.minSupportedVersion).toBe("2.0.0");
      expect(publicPayload.source).toBe("firestore");
    } finally {
      await stopServer(server);
    }
  });

  it("rejects an invalid admin update body with 400", async () => {
    const { server, baseUrl } = await startServer({
      uid: "admin-1",
      email: "admin@blueprint.test",
      admin: true,
    });
    try {
      const put = await fetch(`${baseUrl}/api/admin/client-runtime-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSupportedVersion: "not-a-version" }),
      });
      expect(put.status).toBe(400);
      const payload = (await put.json()) as { details: string[] };
      expect(payload.details.join(" ")).toContain("minSupportedVersion");
    } finally {
      await stopServer(server);
    }
  });

  it("blocks a non-admin from updating the config", async () => {
    const { server, baseUrl } = await startServer({ uid: "u-2", email: "user@blueprint.test" });
    try {
      const put = await fetch(`${baseUrl}/api/admin/client-runtime-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitch: true }),
      });
      expect(put.status).toBe(403);
      // The kill-switch must NOT have been written.
      expect(state.docs.has("appConfig/clientRuntime")).toBe(false);
    } finally {
      await stopServer(server);
    }
  });
});
