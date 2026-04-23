// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const runDocs = new Map<string, Record<string, unknown>>();
let autoIdCounter = 0;

function resetState() {
  runDocs.clear();
  autoIdCounter = 0;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name !== "ad_studio_runs") {
        return {
          doc() {
            return {
              async get() {
                return { exists: false, data: () => null };
              },
            };
          },
        };
      }

      return {
        async add(payload: Record<string, unknown>) {
          const id = `run-${++autoIdCounter}`;
          runDocs.set(id, payload);
          return { id };
        },
        doc(id: string) {
          return {
            async get() {
              return {
                exists: runDocs.has(id),
                data: () => runDocs.get(id),
              };
            },
            async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
              if (options?.merge) {
                runDocs.set(id, {
                  ...(runDocs.get(id) || {}),
                  ...payload,
                });
                return;
              }

              runDocs.set(id, payload);
            },
          };
        },
        orderBy() {
          return {
            limit(limit: number) {
              return {
                async get() {
                  return {
                    docs: [...runDocs.entries()]
                      .slice(0, limit)
                      .map(([id, data]) => ({
                        id,
                        data: () => data,
                      })),
                  };
                },
              };
            },
          };
        },
      };
    },
  },
  storageAdmin: null,
}));

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async () => true,
  resolveAccessContext: async () => ({ email: "ops@tryblueprint.io" }),
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/admin-growth");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = {
      uid: "ops-user",
      email: "ops@tryblueprint.io",
      admin: true,
    };
    next();
  });
  app.use("/", router);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
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
  resetState();
  vi.resetModules();
});

describe("admin growth ad studio routes", () => {
  it("creates an ad studio run", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/ad-studio/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lane: "capturer",
          audience: "public indoor capturers",
          cta: "Apply now",
          budgetCapUsd: 250,
          allowedClaims: ["Illustrative scenes allowed"],
          blockedClaims: ["No fabricated proof"],
          aspectRatio: "9:16",
        }),
      });

      expect(response.status).toBe(201);
      const payload = (await response.json()) as {
        run: { lane: string; status: string; audience: string };
      };

      expect(payload.run).toMatchObject({
        lane: "capturer",
        status: "draft_requested",
        audience: "public indoor capturers",
      });
    } finally {
      await stopServer(server);
    }
  });
});
