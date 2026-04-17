// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const listCityLaunchActivations = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());
const listCityLaunchCandidateSignals = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    listCityLaunchActivations,
    listCityLaunchProspects,
    listCityLaunchCandidateSignals,
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
  it("returns public launch truth with live, planned, and under-review cities without auth", async () => {
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
    listCityLaunchProspects.mockImplementation(async (city: string) => {
      if (city === "Austin, TX") {
        return [
          {
            id: "austin-prospect",
            city: "Austin, TX",
            citySlug: "austin-tx",
            status: "capturing",
            lat: 30.2672,
            lng: -97.7431,
          },
        ];
      }
      return [];
    });
    listCityLaunchCandidateSignals.mockResolvedValue([
      {
        id: "raleigh-candidate",
        city: "Raleigh, NC",
        citySlug: "raleigh-nc",
        name: "Raleigh Research Queue",
        status: "in_review",
        lat: 35.7796,
        lng: -78.6382,
      },
    ]);

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/public/launch/status?city=Austin&state_code=TX`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        supportedCities: Array<{ displayName: string }>;
        cities: Array<{ displayName: string; status: string; latitude: number | null }>;
        statusCounts: { live: number; planned: number; underReview: number };
        currentCity: { isSupported: boolean; citySlug: string | null; status: string | null } | null;
      };

      expect(payload.ok).toBe(true);
      expect(payload.supportedCities).toMatchObject([
        { displayName: "Austin, TX" },
        { displayName: "San Francisco, CA" },
      ]);
      expect(payload.cities).toEqual([
        expect.objectContaining({
          displayName: "Austin, TX",
          status: "live",
          latitude: 30.2672,
        }),
        expect.objectContaining({
          displayName: "Durham, NC",
          status: "planned",
        }),
        expect.objectContaining({
          displayName: "Raleigh, NC",
          status: "under_review",
          latitude: 35.7796,
        }),
        expect.objectContaining({
          displayName: "San Francisco, CA",
          status: "live",
        }),
      ]);
      expect(payload.statusCounts).toEqual({
        live: 2,
        planned: 1,
        underReview: 1,
      });
      expect(payload.currentCity).toEqual(
        expect.objectContaining({
          isSupported: true,
          citySlug: "austin-tx",
          status: "live",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
