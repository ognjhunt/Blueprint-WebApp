import { describe, expect, it } from "vitest";
import {
  queueActivityTimestamp,
  shouldPreserveResolvedNotionQueueIssue,
  workQueueIssueTitle,
  workQueueLifecycleStageForResolution,
} from "./notion-queue-lifecycle.js";

describe("notion queue lifecycle helpers", () => {
  it("strips the managed issue prefix from work queue titles", () => {
    expect(workQueueIssueTitle("Notion Work Queue: Build production bridge")).toBe(
      "Build production bridge",
    );
    expect(workQueueIssueTitle("Standalone title")).toBe("Standalone title");
  });

  it("maps resolved Paperclip states onto Notion lifecycle stages", () => {
    expect(workQueueLifecycleStageForResolution("done")).toBe("Done");
    expect(workQueueLifecycleStageForResolution("cancelled")).toBe("Done");
    expect(workQueueLifecycleStageForResolution("blocked")).toBe("Blocked");
  });

  it("uses the freshest queue timestamp when comparing queue activity", () => {
    expect(
      queueActivityTimestamp({
        lastStatusChange: "2026-04-09T15:00:00.000Z",
        lastEditedTime: "2026-04-09T16:00:00.000Z",
      }),
    ).toBe(Date.parse("2026-04-09T16:00:00.000Z"));
  });

  it("preserves a resolved issue when queue state has not changed since resolution", () => {
    expect(
      shouldPreserveResolvedNotionQueueIssue(
        {
          status: "done",
          updatedAt: "2026-04-09T16:04:39.000Z",
        },
        {
          lastSeenAt: "2026-04-09T16:04:39.000Z",
          resolutionStatus: "done",
        },
        {
          lastStatusChange: "2026-04-09T14:00:00.000Z",
          lastEditedTime: "2026-04-09T14:10:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("allows reopening when the queue changed after the issue was resolved", () => {
    expect(
      shouldPreserveResolvedNotionQueueIssue(
        {
          status: "done",
          updatedAt: "2026-04-09T16:04:39.000Z",
        },
        {
          lastSeenAt: "2026-04-09T16:04:39.000Z",
          resolutionStatus: "done",
        },
        {
          lastStatusChange: "2026-04-09T17:00:00.000Z",
          lastEditedTime: "2026-04-09T17:05:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
