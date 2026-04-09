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
  authAdmin: {
    verifyIdToken,
  },
}));

let server: Server;
let baseUrl: string;
let registerRoutes: typeof import("../routes").registerRoutes;
let csrfCookie: string;
let csrfToken: string;

beforeAll(async () => {
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

  const csrfResponse = await fetch(`${baseUrl}/api/csrf`);
  const setCookie = csrfResponse.headers.get("set-cookie");
  csrfCookie = setCookie ? setCookie.split(";")[0] : "";
  const data = (await csrfResponse.json()) as { csrfToken?: string };
  csrfToken = data.csrfToken ?? "";
}, 60000);

afterAll(async () => {
  if (!server) {
    return;
  }
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
  { method: "POST", path: "/api/gemini/analyze" },
  { method: "POST", path: "/api/submit-to-sheets" },
  { method: "POST", path: "/api/post-signup-workflows" },
  { method: "POST", path: "/api/submit-to-sheets" },
  { method: "POST", path: "/api/upload-to-b2" },
  { method: "POST", path: "/api/ai-studio/chat" },
  { method: "POST", path: "/api/admin/agent/sessions" },
  { method: "GET", path: "/api/admin/agent/sessions" },
  { method: "GET", path: "/api/admin/agent/context/options" },
  { method: "GET", path: "/api/admin/agent/profiles" },
  { method: "GET", path: "/api/admin/agent/environments" },
  { method: "POST", path: "/api/admin/agent/delegations" },
  { method: "POST", path: "/api/admin/agent/sessions/test-session/control/start" },
  { method: "POST", path: "/api/admin/agent/sessions/test-session/control/compact" },
  { method: "POST", path: "/api/qr/pending-session" },
  { method: "GET", path: "/api/googlePlaces" },
  { method: "POST", path: "/api/site-worlds/sessions" },
  { method: "GET", path: "/api/site-worlds/sessions/test-session" },
];

describe("verifyFirebaseToken middleware", () => {
  for (const endpoint of protectedEndpoints) {
    it(`returns 401 when missing auth for ${endpoint.method} ${endpoint.path}`, async () => {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
          ...(endpoint.method === "POST"
            ? {
                Cookie: csrfCookie,
                "X-CSRF-Token": csrfToken,
              }
            : {}),
        },
      });

      expect(response.status).toBe(401);
    });
  }
});
