// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

let server: Server;
let baseUrl: string;
let registerRoutes: typeof import("../routes").registerRoutes;

const getCookieValue = (setCookieHeader: string | null) => {
  if (!setCookieHeader) {
    return null;
  }
  return setCookieHeader.split(";")[0];
};

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

describe("CSRF protection", () => {
  it("rejects state-changing requests without CSRF tokens", async () => {
    const response = await fetch(`${baseUrl}/api/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "TestError",
        message: "Missing token",
        timestamp: new Date().toISOString(),
        url: "http://localhost",
        userAgent: "vitest",
      }),
    });

    expect(response.status).toBe(403);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe("Invalid CSRF token");
  });

  it("accepts requests with matching CSRF cookie and header", async () => {
    const csrfResponse = await fetch(`${baseUrl}/api/csrf`);
    expect(csrfResponse.status).toBe(200);
    const cookieHeader = getCookieValue(csrfResponse.headers.get("set-cookie"));
    const data = (await csrfResponse.json()) as { csrfToken?: string };

    expect(cookieHeader).toBeTruthy();
    expect(data.csrfToken).toBeTruthy();

    const response = await fetch(`${baseUrl}/api/errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader as string,
        "X-CSRF-Token": data.csrfToken as string,
      },
      body: JSON.stringify({
        name: "TestError",
        message: "With token",
        timestamp: new Date().toISOString(),
        url: "http://localhost",
        userAgent: "vitest",
      }),
    });

    expect(response.status).toBe(202);
  });
});
