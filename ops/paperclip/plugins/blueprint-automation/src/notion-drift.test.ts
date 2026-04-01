import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "./constants.js";
import { assessNotionDrift } from "./notion-drift.js";

describe("notion drift assessment", () => {
  it("opens duplicate drift only when duplicates remain unresolved", () => {
    const result = assessNotionDrift(
      TOOL_NAMES.notionUpsertKnowledge,
      {
        title: "Founder EoD Brief | 2026-04-01 | Blueprint",
        database: "knowledge",
      },
      {
        pageId: "page-1",
        pageUrl: "https://www.notion.so/page-1",
        duplicatePageIds: ["dup-1", "dup-2"],
      },
    );

    expect(result.open).toHaveLength(1);
    expect(result.open[0]?.driftKind).toBe("duplicate");
    expect(result.resolve).toHaveLength(0);
  });

  it("resolves duplicate drift when archiveDuplicates is enabled", () => {
    const result = assessNotionDrift(
      TOOL_NAMES.notionUpsertWorkQueue,
      {
        title: "Analytics Weekly Snapshot",
        database: "work_queue",
        archiveDuplicates: true,
      },
      {
        pageId: "page-2",
        duplicatePageIds: ["dup-3"],
      },
    );

    expect(result.open).toHaveLength(0);
    expect(result.resolve[0]?.sourceId).toBe("duplicate:work_queue:page-2");
  });

  it("opens and resolves stale drift from metadata reconciliation", () => {
    const stale = assessNotionDrift(
      TOOL_NAMES.notionUpdatePageMetadata,
      {
        pageId: "page-3",
        database: "knowledge",
        title: "Demand Intel Weekly Digest",
      },
      {
        pageId: "page-3",
        stale: true,
      },
    );

    expect(stale.open[0]?.sourceId).toBe("stale:knowledge:page-3");

    const clean = assessNotionDrift(
      TOOL_NAMES.notionReconcileRelations,
      {
        pageId: "page-3",
        database: "knowledge",
        title: "Demand Intel Weekly Digest",
      },
      {
        pageId: "page-3",
        stale: false,
      },
    );

    expect(clean.open).toHaveLength(0);
    expect(clean.resolve[0]?.sourceId).toBe("stale:knowledge:page-3");
  });
});
