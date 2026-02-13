// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

import {
  environmentPolicies,
  marketplaceScenes,
  trainingDatasets,
} from "../../client/src/data/content";
import { parseMarketplaceQuery } from "../utils/marketplaceQueryParser";
import { rankCandidates, searchMarketplace } from "../retrieval/marketplaceSearch";

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

function buildParserContext() {
  const knownLocationTypes = Array.from(
    new Set([
      ...marketplaceScenes.map((s) => s.locationType),
      ...trainingDatasets.map((t) => t.locationType),
    ]),
  );
  const knownObjectTags = Array.from(
    new Set([
      ...marketplaceScenes.flatMap((s) => s.objectTags),
      ...trainingDatasets.flatMap((t) => t.objectTags),
    ]),
  );
  const knownPolicies = environmentPolicies.map((policy) => ({
    slug: policy.slug,
    title: policy.title,
  }));
  return { knownLocationTypes, knownObjectTags, knownPolicies };
}

describe("marketplaceQueryParser", () => {
  it("extracts minQualityScore=0.8 from 'quality scores above 0.8'", () => {
    const parsed = parseMarketplaceQuery(
      "I need diverse tabletop manipulation data with quality scores above 0.8",
      buildParserContext(),
    );
    expect((parsed.hard as any).minQualityScore).toBeCloseTo(0.8, 5);
  });

  it("extracts minEpisodes=10000 from '10K demos'", () => {
    const parsed = parseMarketplaceQuery(
      "I need 10K pick-and-place demos in kitchens",
      buildParserContext(),
    );
    expect((parsed.hard as any).minEpisodes).toBe(10000);
  });
});

describe("marketplaceSearch (static)", () => {
  it("hard filter excludes items missing/under qualityScore when constraint is present", async () => {
    const response = await searchMarketplace({
      query: "diverse manipulation data with quality > 0.8",
      limit: 60,
      filters: { itemType: "all", sort: "relevance" },
      hard: { minQualityScore: 0.8 },
      soft: {},
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((r) => r.type === "training")).toBe(true);
    expect(
      response.results.every(
        (r) =>
          typeof (r.item as any).qualityScore === "number" &&
          ((r.item as any).qualityScore as number) >= 0.8,
      ),
    ).toBe(true);

    // Ensure at least one known-below-threshold dataset is excluded.
    expect(
      response.results.some((r) => r.item.slug === "warehouse-palletizing-episodes"),
    ).toBe(false);
  });

  it("rankCandidates is deterministic with mocked embeddings", () => {
    const a = {
      type: "training" as const,
      item: trainingDatasets[0],
      searchDoc: "alpha",
      embedding: [1, 0],
    };
    const b = {
      type: "training" as const,
      item: trainingDatasets[1],
      searchDoc: "beta",
      embedding: [0, 1],
    };

    const ranked = rankCandidates({
      query: "alpha",
      queryEmbedding: [1, 0],
      candidates: [b as any, a as any],
      filters: { sort: "relevance" },
      hard: {},
      soft: {},
    });

    expect(ranked[0].candidate.item.slug).toBe(trainingDatasets[0].slug);
  });
});

describe("POST /api/marketplace/search", () => {
  it("manual locationType overrides parsed locationType", async () => {
    const response = await fetch(`${baseUrl}/api/marketplace/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: csrfCookie,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        q: "kitchen manipulation episodes",
        manualFilters: { locationType: "Warehouses" },
        limit: 60,
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.every((r: any) => r.item.locationType === "Warehouses")).toBe(
      true,
    );
  });

  it("ignoreParsedKeys disables parsed location constraint and broadens results", async () => {
    const responseWithIgnore = await fetch(`${baseUrl}/api/marketplace/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: csrfCookie,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        q: "kitchen warehouse episodes",
        ignoreParsedKeys: ["locationType"],
        limit: 60,
      }),
    });

    expect(responseWithIgnore.status).toBe(200);
    const data = (await responseWithIgnore.json()) as any;

    // Without the strict location filter, we should see at least one non-kitchen item.
    expect(data.results.some((r: any) => r.item.locationType !== "Kitchens")).toBe(
      true,
    );
  });
});

