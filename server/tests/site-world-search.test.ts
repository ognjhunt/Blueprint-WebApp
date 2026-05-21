// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

const embedTextsMock = vi.hoisted(() =>
  vi.fn(async (texts: string[]) => texts.map(() => [] as number[])),
);

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: null,
  storageAdmin: null,
}));

vi.mock("../retrieval/embeddings", () => ({
  embedTexts: embedTextsMock,
}));

import siteWorldsRouter from "../routes/site-worlds";
import { parseSiteWorldSearchQuery, searchPublicSiteWorlds } from "../retrieval/siteWorldSearch";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/site-worlds", siteWorldsRouter);

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
      if (error) reject(error);
      else resolve();
    });
  });
});

describe("site-world search aliases", () => {
  it("parses retail aliases for agent-style store queries", () => {
    const aliases = [
      ["store", "store"],
      ["supermarket", "supermarket"],
      ["grocer", "grocer"],
      ["Whole Foods", "whole foods"],
      ["Kroger", "kroger"],
      ["retail aisle", "retail aisle"],
    ];

    for (const [query, alias] of aliases) {
      const parsed = parseSiteWorldSearchQuery(query);
      expect(parsed.aliases.map((item) => item.alias)).toContain(alias);
      expect(parsed.aliases[0].categories).toContain("Retail");
    }
  });
});

describe("site-world search ranking", () => {
  it("ranks the grocery/retail close match for q=whole foods without claiming exact availability", async () => {
    const response = await searchPublicSiteWorlds({ query: "whole foods", limit: 5 });

    expect(response.meta.usedEmbeddings).toBe(false);
    expect(response.warnings.join(" ")).toContain("embeddings_unavailable");
    expect(response.results[0].siteWorld.id).toBe("sw-chi-01");
    expect(response.results[0].siteWorld.siteName).toBe("Harborview Grocery Distribution Annex");
    expect(response.results[0].matchedAliases.join(" ")).toContain("whole foods");
    expect(response.results[0].reasons.join(" ").toLowerCase()).toContain("no exact whole foods availability is implied");
  });

  it("returns retail/grocery matches for q=store even without exact store text", async () => {
    const response = await searchPublicSiteWorlds({ query: "store", limit: 5 });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].siteWorld.category).toBe("Retail");
    expect(response.results[0].matchedAliases.join(" ")).toContain("store");
  });

  it("ranks logistics/warehouse-like records for q=warehouse tote", async () => {
    const response = await searchPublicSiteWorlds({ query: "warehouse tote", limit: 5 });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].siteWorld.category).toBe("Logistics");
    expect(response.results[0].matchedFields).toContain("objectTags");
    expect(response.results[0].reasons.join(" ").toLowerCase()).toContain("tote");
  });
});

describe("GET /api/site-worlds/search", () => {
  it("returns explainable public search results before /:siteWorldId matching", async () => {
    const response = await fetch(`${baseUrl}/api/site-worlds/search?q=whole%20foods&limit=5`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as any;

    expect(payload.results[0].siteWorld.id).toBe("sw-chi-01");
    expect(payload.results[0].score).toBeGreaterThan(0);
    expect(payload.results[0].matchedAliases.join(" ")).toContain("whole foods");
    expect(payload.parsed.aliases[0].alias).toBe("whole foods");
    expect(["static-fallback", "firestore-live"]).toContain(payload.meta.backend);
  });
});
