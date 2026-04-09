import { describe, expect, it } from "vitest";
import { findAutoResolvableCloseoutComment } from "./managed-closeout.js";
import {
  shouldPreserveResolvedNotionQueueIssue,
  workQueueLifecycleStageForResolution,
} from "./notion-queue-lifecycle.js";

describe("managed automation lifecycle", () => {
  it("keeps a rerouted and resolved Notion-backed issue closed on the next queue scan", () => {
    const reroutedIssue = {
      id: "BLU-1584",
      status: "backlog",
      assigneeAgentId: "webapp-codex",
      updatedAt: "2026-04-09T14:27:45.000Z",
    };

    const closeoutComment = findAutoResolvableCloseoutComment(
      [
        {
          authorAgentId: "webapp-codex",
          createdAt: "2026-04-09T16:04:40.000Z",
          body: "## Done\nValidated `server/routes/internal-pipeline.ts`, `server/routes/inbound-request.ts`, and `npm run check`.",
        },
      ],
      {
        issueUpdatedAt: reroutedIssue.updatedAt,
        assigneeAgentId: reroutedIssue.assigneeAgentId,
      },
    );

    expect(closeoutComment).not.toBeNull();

    const resolvedIssue = {
      status: "done",
      updatedAt: "2026-04-09T16:04:40.000Z",
    };
    const sourceMapping = {
      lastSeenAt: "2026-04-09T16:04:40.000Z",
      resolutionStatus: "done",
    };
    const staleNotionQueueItem = {
      lastStatusChange: "2026-04-09T14:00:00.000Z",
      lastEditedTime: "2026-04-09T14:10:00.000Z",
    };

    expect(
      shouldPreserveResolvedNotionQueueIssue(
        resolvedIssue,
        sourceMapping,
        staleNotionQueueItem,
      ),
    ).toBe(true);
    expect(workQueueLifecycleStageForResolution("done")).toBe("Done");
  });
});
