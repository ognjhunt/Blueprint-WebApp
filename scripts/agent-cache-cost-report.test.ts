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
});
