import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeWorkQueueItemsForScan,
  canonicalWorkQueueScanKey,
  collapseWorkQueueItemsByNaturalKey,
  detectStaleKnowledgeEntries,
  extractNotionId,
  extractAnalyticsSnapshotDate,
  isStaleAnalyticsSnapshotQueueItem,
  mapWorkQueueLifecycleStageToIssueStatus,
  normalizeKnowledgeEntry,
  resolveRepoKnowledgeLastReviewed,
  normalizeWorkQueueItem,
  planNotionUpsert,
} from "./notion.js";

describe("notion helpers", () => {
  it("plans a create when no matching pages exist", () => {
    const plan = planNotionUpsert([]);

    expect(plan.action).toBe("create");
    expect(plan.canonical).toBeNull();
    expect(plan.duplicates).toHaveLength(0);
  });

  it("prefers the newest non-archived page and flags older matches as duplicates", () => {
    const plan = planNotionUpsert([
      {
        id: "archived-old",
        archived: true,
        created_time: "2026-03-01T00:00:00.000Z",
        last_edited_time: "2026-03-15T00:00:00.000Z",
      },
      {
        id: "active-old",
        archived: false,
        created_time: "2026-03-10T00:00:00.000Z",
        last_edited_time: "2026-03-20T00:00:00.000Z",
      },
      {
        id: "active-new",
        archived: false,
        created_time: "2026-03-11T00:00:00.000Z",
        last_edited_time: "2026-03-22T00:00:00.000Z",
      },
    ]);

    expect(plan.action).toBe("update");
    expect(plan.canonical?.id).toBe("active-new");
    expect(plan.duplicates.map((page) => page.id)).toEqual(["active-old", "archived-old"]);
  });

  it("detects stale knowledge pages from review cadence and last reviewed date", () => {
    const stale = detectStaleKnowledgeEntries(
      [
        {
          id: "weekly-stale",
          reviewCadence: "Weekly",
          lastReviewed: "2026-03-20",
        },
        {
          id: "monthly-fresh",
          reviewCadence: "Monthly",
          lastReviewed: "2026-03-10",
        },
        {
          id: "missing-review-date",
          reviewCadence: "Quarterly",
          lastReviewed: null,
        },
        {
          id: "adhoc",
          reviewCadence: "Ad Hoc",
          lastReviewed: "2025-01-01",
        },
      ],
      "2026-04-01T12:00:00.000Z",
    );

    expect(stale).toEqual(["weekly-stale", "missing-review-date"]);
  });

  it("normalizes Notion ids from raw ids, URLs, and collection URIs", () => {
    expect(extractNotionId("16d80154161d80db869bcfba4fe70be3")).toBe(
      "16d80154-161d-80db-869b-cfba4fe70be3",
    );
    expect(extractNotionId("https://www.notion.so/16d80154161d80db869bcfba4fe70be3")).toBe(
      "16d80154-161d-80db-869b-cfba4fe70be3",
    );
    expect(extractNotionId("collection://51d93d65-8a00-4dd4-a9a2-fd9a6e69120d")).toBe(
      "51d93d65-8a00-4dd4-a9a2-fd9a6e69120d",
    );
  });

  it("normalizes founder visibility work queue metadata with inferred business lane", () => {
    const item = normalizeWorkQueueItem(
      {
        title: "Buyer proof path is blocked",
        priority: "P1",
        system: "WebApp",
        lifecycleStage: "Blocked",
        "Proof State": "Source needed",
        "Metric Outcome": "Missing source",
        "Verification Commands": "npm run check",
        "Blocker ID": "buyer-proof-source-needed",
        needsFounder: true,
        lastStatusChange: "2026-04-01T09:20:00.000Z",
        escalateAfter: "2026-04-01T13:20:00.000Z",
      },
      true,
    );

    expect(item.businessLane).toBe("Buyer");
    expect(item.proofState).toBe("Source needed");
    expect(item.metricOutcome).toBe("Missing source");
    expect(item.verificationCommands).toBe("npm run check");
    expect(item.blockerId).toBe("buyer-proof-source-needed");
    expect(item.needsFounder).toBe(true);
    expect(item.lastStatusChange).toBe("2026-04-01T09:20:00.000Z");
    expect(item.escalateAfter).toBe("2026-04-01T13:20:00.000Z");
  });

  it("collapses duplicate queue items onto the freshest natural key entry", () => {
    const collapsed = collapseWorkQueueItemsByNaturalKey([
      {
        id: "older-duplicate",
        title: "Analytics Daily Snapshot - 2026-04-03",
        priority: "P2",
        system: "WebApp",
        businessLane: "Growth",
        lifecycleStage: "Backlog",
        workType: "Refresh",
        url: "https://www.notion.so/older",
        needsFounder: false,
        ownerIds: [],
        lastStatusChange: "2026-04-02T08:00:00.000Z",
        lastEditedTime: "2026-04-02T08:00:00.000Z",
        naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
      },
      {
        id: "newer-duplicate",
        title: "Analytics Daily Snapshot - 2026-04-03",
        priority: "P2",
        system: "WebApp",
        businessLane: "Growth",
        lifecycleStage: "Backlog",
        workType: "Refresh",
        url: "https://www.notion.so/newer",
        needsFounder: false,
        ownerIds: [],
        lastStatusChange: "2026-04-03T08:00:00.000Z",
        lastEditedTime: "2026-04-03T08:05:00.000Z",
        naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
      },
      {
        id: "other-item",
        title: "Analytics Weekly Snapshot - 2026-04-06",
        priority: "P1",
        system: "WebApp",
        businessLane: "Growth",
        lifecycleStage: "Open",
        workType: "Refresh",
        url: "https://www.notion.so/weekly",
        needsFounder: false,
        ownerIds: [],
        lastEditedTime: "2026-04-03T09:00:00.000Z",
        naturalKey: "Analytics Weekly Snapshot - 2026-04-06::WebApp::Refresh",
      },
    ]);

    expect(collapsed.map((item) => item.id)).toEqual(["newer-duplicate", "other-item"]);
  });

  it("derives the same canonical scan key for visually identical queue duplicates", () => {
    const first = canonicalWorkQueueScanKey({
      title: "Analytics Daily Snapshot - 2026-04-03",
      system: "WebApp",
      workType: "Refresh",
      naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
    });
    const second = canonicalWorkQueueScanKey({
      title: "  Analytics   Daily Snapshot - 2026-04-03  ",
      system: "webapp",
      workType: "refresh",
      naturalKey: " analytics   daily snapshot - 2026-04-03 :: webapp :: refresh ",
    });

    expect(second).toBe(first);
  });

  it("keeps legacy title/system/work-type matching available when naturalKey is present", () => {
    const first = canonicalWorkQueueScanKey({
      title: "Analytics Daily Snapshot - 2026-04-03",
      system: "WebApp",
      workType: "Refresh",
      naturalKey: "analytics:webapp:daily-snapshot:2026-04-03",
    });
    const second = canonicalWorkQueueScanKey({
      title: "Analytics Daily Snapshot - 2026-04-03",
      system: "WebApp",
      workType: "Refresh",
      naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
    });

    expect(first).toBe("analytics:webapp:daily-snapshot:2026-04-03");
    expect(second).toBe("analytics daily snapshot - 2026-04-03::webapp::refresh");
  });

  it("suppresses queue scan sync when duplicate queue entries disagree on issue state", () => {
    const result = analyzeWorkQueueItemsForScan([
      {
        id: "done-item",
        title: "Analytics Daily Snapshot - 2026-04-03",
        priority: "P2",
        system: "WebApp",
        businessLane: "Growth",
        lifecycleStage: "Done",
        workType: "Refresh",
        url: "https://www.notion.so/done",
        needsFounder: false,
        ownerIds: [],
        lastStatusChange: "2026-04-03T08:00:00.000Z",
        lastEditedTime: "2026-04-03T08:00:00.000Z",
        naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
      },
      {
        id: "todo-item",
        title: "Analytics Daily Snapshot - 2026-04-03",
        priority: "P2",
        system: "WebApp",
        businessLane: "Growth",
        lifecycleStage: "Open",
        workType: "Refresh",
        url: "https://www.notion.so/todo",
        needsFounder: false,
        ownerIds: [],
        lastStatusChange: "2026-04-03T09:00:00.000Z",
        lastEditedTime: "2026-04-03T09:00:00.000Z",
        naturalKey: "Analytics Daily Snapshot - 2026-04-03::WebApp::Refresh",
      },
    ]);

    expect(result.actionableItems).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.issueStatuses).toEqual(["done", "backlog"]);
    expect(result.conflicts[0]?.canonicalItem.id).toBe("todo-item");
  });

  it("maps actionable work queue lifecycle stages onto Paperclip issue states", () => {
    expect(mapWorkQueueLifecycleStageToIssueStatus("Open")).toBe("backlog");
    expect(mapWorkQueueLifecycleStageToIssueStatus("Analytics")).toBe("backlog");
    expect(mapWorkQueueLifecycleStageToIssueStatus("In Progress")).toBe("in_progress");
    expect(mapWorkQueueLifecycleStageToIssueStatus("Waiting on Founder")).toBe("blocked");
    expect(mapWorkQueueLifecycleStageToIssueStatus("Done")).toBe("done");
  });

  it("parses dated analytics snapshot titles", () => {
    expect(extractAnalyticsSnapshotDate("Analytics Daily Snapshot - 2026-04-03")).toEqual({
      cadence: "daily",
      date: "2026-04-03",
    });
    expect(extractAnalyticsSnapshotDate("Analytics Weekly Snapshot - 2026-03-30")).toEqual({
      cadence: "weekly",
      date: "2026-03-30",
    });
    expect(extractAnalyticsSnapshotDate("Demand Intel Daily Digest - 2026-04-03 - robotics")).toBeNull();
  });

  it("treats older dated analytics snapshots as stale queue items", () => {
    expect(
      isStaleAnalyticsSnapshotQueueItem(
        { title: "Analytics Daily Snapshot - 2026-04-03" } as any,
        { now: new Date("2026-04-04T05:00:00.000Z"), timeZone: "America/New_York" },
      ),
    ).toBe(true);
    expect(
      isStaleAnalyticsSnapshotQueueItem(
        { title: "Analytics Daily Snapshot - 2026-04-04" } as any,
        { now: new Date("2026-04-04T05:00:00.000Z"), timeZone: "America/New_York" },
      ),
    ).toBe(false);
  });

  it("normalizes founder-facing knowledge artifacts", () => {
    const entry = normalizeKnowledgeEntry(
      {
        title: "Founder EoD Brief | 2026-04-01 | Blueprint",
        type: "Decision",
        content: "Summary",
        artifactType: "EoD Founder Brief",
        agentSurfaces: ["Founder OS"],
      },
      true,
    );

    expect(entry.artifactType).toBe("EoD Founder Brief");
    expect(entry.agentSurfaces).toEqual(["Founder OS"]);
  });

  it("uses repo markdown mtime for repo-backed knowledge freshness", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "bp-knowledge-"));
    const markdownPath = path.join(tempDir, "knowledge.md");

    try {
      writeFileSync(markdownPath, "# Knowledge\n");
      const mtime = new Date("2026-04-01T15:45:12.000Z");
      utimesSync(markdownPath, mtime, mtime);

      const relativeSource = path.relative(process.cwd(), markdownPath);
      const resolved = resolveRepoKnowledgeLastReviewed({
        title: "Repo-backed Knowledge",
        type: "Reference",
        system: "WebApp",
        content: "",
        sourceOfTruth: "Repo",
        canonicalSource: relativeSource,
      });

      expect(resolved).toBe("2026-04-01T15:45:12.000Z");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
