// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));

let server: Server;
let baseUrl: string;
let csrfCookie: string;
let csrfToken: string;

beforeAll(async () => {
  const { registerRoutes } = await import("../routes");

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
});

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

describe("verifyFirebaseToken configuration guard", () => {
  it("returns 503 when Firebase Admin auth is unavailable even if a bearer token is provided", async () => {
    const response = await fetch(`${baseUrl}/api/marketplace/entitlements/current?sku=test`, {
      headers: {
        Authorization: "Bearer test-token",
        Cookie: csrfCookie,
        "X-CSRF-Token": csrfToken,
      },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Firebase Admin auth is not configured/i),
    });
  });
});
