// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const listCityLaunchActivations = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchActivations,
  };
});

async function startServer() {
  const { default: publicLaunchRouter } = await import("../routes/public-launch");
  const app = express();
  app.use("/api/public/launch", publicLaunchRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("public launch route", () => {
  it("returns only launch-supported cities without auth", async () => {
    listCityLaunchActivations.mockResolvedValue([
      {
        city: "Austin, TX",
        citySlug: "austin-tx",
        founderApproved: true,
        status: "activation_ready",
      },
      {
        city: "San Francisco, CA",
        citySlug: "san-francisco-ca",
        founderApproved: false,
        status: "growth_live",
      },
      {
        city: "Durham, NC",
        citySlug: "durham-nc",
        founderApproved: false,
        status: "planning",
      },
    ]);

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/public/launch/status?city=Austin&state_code=TX`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        supportedCities: Array<{ displayName: string }>;
        currentCity: { isSupported: boolean; citySlug: string | null } | null;
      };

      expect(payload.ok).toBe(true);
      expect(payload.supportedCities).toMatchObject([
        { displayName: "Austin, TX" },
        { displayName: "San Francisco, CA" },
      ]);
      expect(payload.currentCity).toEqual(
        expect.objectContaining({
          isSupported: true,
          citySlug: "austin-tx",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
