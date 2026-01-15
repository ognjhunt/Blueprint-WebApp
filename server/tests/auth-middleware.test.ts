// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

const verifyIdToken = vi.fn().mockResolvedValue({ uid: "test-user" });

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    auth: () => ({
      verifyIdToken,
    }),
  },
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));

let server: Server;
let baseUrl: string;
let registerRoutes: typeof import("../routes").registerRoutes;

beforeAll(async () => {
  process.env.PARALLEL_API_KEY = "test-parallel-key";
  process.env.PERPLEXITY_API_KEY = "test-perplexity-key";

  ({ registerRoutes } = await import("../routes"));

  const app = express();
  app.use(express.json());
  registerRoutes(app);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind test server");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

const protectedEndpoints = [
  { method: "POST", path: "/api/post-signup-workflows" },
  { method: "POST", path: "/api/upload-to-b2" },
  { method: "POST", path: "/api/ai-studio/chat" },
  { method: "POST", path: "/api/qr/pending-session" },
  { method: "GET", path: "/api/googlePlaces" },
];

describe("verifyFirebaseToken middleware", () => {
  for (const endpoint of protectedEndpoints) {
    it(`returns 401 when missing auth for ${endpoint.method} ${endpoint.path}`, async () => {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
    });
  }
});
