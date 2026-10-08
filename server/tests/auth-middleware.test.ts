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
  { method: "POST", path: "/api/storage/uploads" },
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
  { method: "GET", path: "/api/admin/outbound-prospects/communications/connection" },
  { method: "GET", path: "/api/admin/outbound-prospects/communications/blocked-jobs" },
  { method: "GET", path: "/api/admin/outbound-prospects/test-prospect/communications" },
  { method: "POST", path: "/api/admin/outbound-prospects/test-prospect/communications" },
  { method: "POST", path: `/api/admin/outbound-prospects/test-prospect/communications/${"a".repeat(64)}/retry` },
  { method: "POST", path: `/api/admin/outbound-prospects/test-prospect/communications/${"a".repeat(64)}/reconcile-draft` },
  { method: "POST", path: "/api/admin/outbound-prospects/test-prospect/communications/research-preview" },
  { method: "POST", path: "/api/admin/outbound-prospects/test-prospect/communications/research-approve" },
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

describe("mounted communications authentication and CSRF", () => {
  const preparation = "/api/admin/outbound-prospects/communications/connection";
  const retry = `/api/admin/outbound-prospects/test-prospect/communications/${"a".repeat(64)}/retry`;
  for (const action of ["preview", "approve"]) {
    const path = `/api/admin/outbound-prospects/test-prospect/communications/research-${action}`;
    it(`rejects research ${action} without CSRF before touching storage`, async () => {
      const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: {
        Authorization: "Bearer mock-valid-ops-token", "Content-Type": "application/json",
      }, body: "{}" });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Invalid CSRF token" });
    });
    it(`passes verified ops and matching CSRF to research ${action}'s fail-closed store guard`, async () => {
      verifyIdToken.mockResolvedValueOnce({ uid: "ops-user", roles: ["ops"] });
      const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: {
        Authorization: "Bearer mock-valid-ops-token", "Content-Type": "application/json",
        Cookie: csrfCookie, "X-CSRF-Token": csrfToken,
      }, body: "{}" });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "communications_store_unavailable" });
    });
  }
  it("verifies an actual bearer before exposing preparation to ops", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "ops-user", roles: ["ops"] });
    const response = await fetch(`${baseUrl}${preparation}`, { headers: { Authorization: "Bearer mock-valid-ops-token" } });
    expect(response.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith("mock-valid-ops-token", true);
    expect((await response.json()).connection).toMatchObject({ credentialsAccepted: false, grantStarted: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("denies a verified bearer without an ops/admin role", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "ordinary-user" });
    const response = await fetch(`${baseUrl}${preparation}`, { headers: { Authorization: "Bearer mock-valid-user-token" } });
    expect(response.status).toBe(403);
  });
  it("rejects an invalid bearer instead of trusting its claimed identity", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("mock-invalid-token"));
    const response = await fetch(`${baseUrl}${preparation}`, { headers: { Authorization: "Bearer mock-invalid-token" } });
    expect(response.status).toBe(401);
  });
  it("rejects a retry lacking matching CSRF even with a bearer", async () => {
    const response = await fetch(`${baseUrl}${retry}`, {
      method: "POST", headers: { Authorization: "Bearer mock-valid-ops-token", "Content-Type": "application/json" },
      body: JSON.stringify({ briefDigest: "b".repeat(64) }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Invalid CSRF token" });
  });
  it("passes matching CSRF and verified ops identity to the fail-closed store guard", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "ops-user", roles: ["ops"] });
    const response = await fetch(`${baseUrl}${retry}`, {
      method: "POST", headers: { Authorization: "Bearer mock-valid-ops-token", "Content-Type": "application/json", Cookie: csrfCookie, "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ briefDigest: "b".repeat(64) }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "communications_store_unavailable" });
  });
});
