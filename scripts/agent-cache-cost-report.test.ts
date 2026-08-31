import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveReportRuns } from "./agent-cache-cost-report.ts";

describe("agent cache cost report", () => {
  it("falls back to the local fixture when live Firestore runs are unavailable", async () => {
    const fixturePath = path.resolve("server/tests/fixtures/agent-cost-cache-runs.json");

    const result = await resolveReportRuns({
      fromJson: null,
      limit: 500,
      fallbackJson: fixturePath,
      firestoreReader: async () => {
        throw new Error("Firestore is not configured; pass --from-json to report on exported runs.");
      },
    });

    expect(result.source.kind).toBe("local_fixture_fallback");
    expect(result.source.path).toBe(fixturePath);
    expect(result.source.warning).toContain("Firestore is not configured");
    expect(result.runs).toHaveLength(4);
  });

  it("fails closed without fixture fallback in strict-live mode", async () => {
    await expect(resolveReportRuns({
      fromJson: null,
      limit: 100,
      sinceHours: 24,
      fallbackJson: null,
      firestoreReader: async () => {
        throw new Error("Firestore is not configured");
      },
    })).rejects.toThrow("Firestore is not configured");
  });

  it("bounds the live time range and reports exact collection identity", async () => {
    let observedSince = "";
    const result = await resolveReportRuns({
      fromJson: null,
      limit: 25,
      sinceHours: 12,
      fallbackJson: null,
      firestoreReader: async (_limit, sinceIso) => {
        observedSince = sinceIso;
        return [];
      },
    });

    expect(Date.parse(observedSince)).toBeGreaterThan(Date.now() - 13 * 60 * 60 * 1000);
    expect(result.source).toMatchObject({
      kind: "firestore",
      collection: "agentRuns",
      limit: 25,
    });
  });
});
