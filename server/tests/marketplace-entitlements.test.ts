// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  entitlements: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => ({
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs:
            name === "marketplaceEntitlements"
              ? state.entitlements
                  .filter((entry) => entry[field] === value)
                  .map((entry) => ({
                    id: String(entry.id || "ent-1"),
                    data: () => entry,
                  }))
              : [],
        }),
      }),
    }),
  },
}));

async function startServer() {
  const { default: router } = await import("../routes/marketplace-entitlements");
  const app = express();
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid: "buyer-123" };
    next();
  });
  app.use("/api/marketplace/entitlements", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(() => {
  state.entitlements = [];
});

describe("marketplace entitlements route", () => {
  it("returns entitlement-backed buyer access for the current SKU", async () => {
    state.entitlements = [
      {
        id: "ent-1",
        buyer_user_id: "buyer-123",
        sku: "modular-kitchen-line",
        access_state: "provisioned",
      },
    ];

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/marketplace/entitlements/current?sku=modular-kitchen-line`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        entitlement: expect.objectContaining({
          id: "ent-1",
          sku: "modular-kitchen-line",
        }),
        access: expect.objectContaining({
          kind: "download",
          label: "Download Scene Package",
        }),
      });
    } finally {
      await stopServer(server);
    }
  });
});
