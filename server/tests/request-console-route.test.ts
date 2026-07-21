// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  requests: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: state.requests.has(id),
          data: () => state.requests.get(id),
        }),
      }),
    }),
  },
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin: async (record: Record<string, unknown>) => record,
}));

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/requests");
  const app = express();
  app.use(express.json());
  app.use("/api/requests", router);
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
  state.requests.clear();
  vi.resetModules();
});

describe("buyer request console route", () => {
  it("returns null instead of inventing missing request operations state", async () => {
    state.requests.set("request-1", {
      requestId: "request-1",
      status: "submitted",
      request: {
        siteName: "Unassigned site",
        siteLocation: "Chicago, IL",
        taskStatement: "Review submitted intake.",
        requestedLanes: [],
        buyerType: "site_operator",
      },
      context: {
        sourcePageUrl: "https://tryblueprint.io/contact",
        utm: {},
      },
    });
    const { createRequestReviewToken } = await import("../utils/request-review-auth");
    const token = createRequestReviewToken("request-1");
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(
        `${baseUrl}/api/requests/request-1?access=${encodeURIComponent(token)}`,
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          qualification_state: "submitted",
          opportunity_state: null,
          ops: null,
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
