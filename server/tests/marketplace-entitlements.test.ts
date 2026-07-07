// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  entitlements: [] as Array<Record<string, unknown>>,
  marketplaceItems: new Map<string, Record<string, unknown>>(),
  signedUrlCalls: [] as Array<{ bucket: string; objectPath: string; options: Record<string, unknown> }>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (name === "marketplaceEntitlements") {
            const entitlement = state.entitlements.find((entry) => entry.id === id);
            return {
              exists: Boolean(entitlement),
              id,
              data: () => entitlement,
            };
          }
          if (name === "publishedMarketplaceInventory" || name === "marketplace_items") {
            const item = state.marketplaceItems.get(id);
            return {
              exists: Boolean(item),
              id,
              data: () => item,
            };
          }
          return {
            exists: false,
            id,
            data: () => undefined,
          };
        },
      }),
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
  storageAdmin: {
    bucket: (bucket: string) => ({
      file: (objectPath: string) => ({
        getSignedUrl: async (options: Record<string, unknown>) => {
          state.signedUrlCalls.push({ bucket, objectPath, options });
          return [`https://storage.example.test/${bucket}/${objectPath}?signed=1`];
        },
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
  state.marketplaceItems.clear();
  state.signedUrlCalls = [];
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
        entitlements: [
          expect.objectContaining({
            id: "ent-1",
            access: expect.objectContaining({
              kind: "download",
              label: "Download Scene Package",
            }),
          }),
        ],
      });
    } finally {
      await stopServer(server);
    }
  });

  it("mints a signed artifact URL only for the authenticated buyer's provisioned entitlement", async () => {
    state.entitlements = [
      {
        id: "ent-robot-eval-1",
        buyer_user_id: "buyer-123",
        sku: "robot-eval-capture-1",
        access_state: "provisioned",
      },
    ];
    state.marketplaceItems.set("robot-eval-capture-1", {
      artifact_uris: {
        package_uri: "gs://blueprint-artifacts/packages/capture-1/package.zip",
        buyer_readout_uri: "gs://blueprint-artifacts/packages/capture-1/readout.json",
      },
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/marketplace/entitlements/ent-robot-eval-1/artifact-access?artifact=package_uri`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        entitlement_id: "ent-robot-eval-1",
        sku: "robot-eval-capture-1",
        artifact_key: "package_uri",
        artifact_uri: "gs://blueprint-artifacts/packages/capture-1/package.zip",
        signed_url: "https://storage.example.test/blueprint-artifacts/packages/capture-1/package.zip?signed=1",
        buyer_access_check: expect.objectContaining({
          entitlement_verified: true,
          buyer_access_checked: true,
          buyer_accessible: true,
          status: "signed_url_minted",
        }),
      });
      expect(state.signedUrlCalls).toEqual([
        expect.objectContaining({
          bucket: "blueprint-artifacts",
          objectPath: "packages/capture-1/package.zip",
        }),
      ]);
    } finally {
      await stopServer(server);
    }
  });

  it("does not sign artifact URLs for a different buyer's entitlement", async () => {
    state.entitlements = [
      {
        id: "ent-robot-eval-2",
        buyer_user_id: "buyer-other",
        sku: "robot-eval-capture-2",
        access_state: "provisioned",
        artifact_uris: {
          package_uri: "gs://blueprint-artifacts/packages/capture-2/package.zip",
        },
      },
    ];

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/marketplace/entitlements/ent-robot-eval-2/artifact-access`,
      );

      expect(response.status).toBe(403);
      expect(state.signedUrlCalls).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("does not sign artifact URLs before entitlement provisioning", async () => {
    state.entitlements = [
      {
        id: "ent-robot-eval-3",
        buyer_user_id: "buyer-123",
        sku: "robot-eval-capture-3",
        access_state: "pending",
        artifact_uris: {
          package_uri: "gs://blueprint-artifacts/packages/capture-3/package.zip",
        },
      },
    ];

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/marketplace/entitlements/ent-robot-eval-3/artifact-access`,
      );

      expect(response.status).toBe(409);
      expect(state.signedUrlCalls).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });
});
