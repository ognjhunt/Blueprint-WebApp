import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunEntry } from "./notion.js";

const upsertedRuns: AgentRunEntry[] = [];
const metadataUpdates: Array<{ pageId: string; metadata: Record<string, unknown> }> = [];

vi.mock("./notion.js", () => ({
  queryDatabase: vi.fn(async () => [
    {
      id: "agent-page-1",
      properties: {
        Agent: { title: [{ plain_text: "WebApp Codex" }] },
        "Canonical Key": { rich_text: [{ plain_text: "webapp-codex" }] },
        "Paperclip Agent Key": { rich_text: [{ plain_text: "webapp-codex" }] },
      },
    },
  ]),
  updatePageMetadata: vi.fn(async (_client: unknown, pageId: string, _database: string, metadata: Record<string, unknown>) => {
    metadataUpdates.push({ pageId, metadata });
    return { pageId, pageUrl: `https://notion.so/${pageId}` };
  }),
  upsertAgentRunEntry: vi.fn(async (_client: unknown, entry: AgentRunEntry) => {
    upsertedRuns.push(entry);
    return { duplicatePageIds: [], pageId: `run-page-${entry.runId}`, pageUrl: `https://notion.so/run-page-${entry.runId}`, status: "created" };
  }),
}));

import { syncBlueprintAgentRuns } from "./agent-run-sync.js";

describe("agent run sync", () => {
  beforeEach(() => {
    upsertedRuns.length = 0;
    metadataUpdates.length = 0;
  });

  it("maps heartbeat runs into Notion run rows and updates each agent latest run", async () => {
    await syncBlueprintAgentRuns({
      heartbeatRuns: [
        {
          agentId: "agent-1",
          contextSnapshot: {
            issueId: "issue-1",
            wakeReason: "execution_dispatch",
          },
          finishedAt: "2026-04-09T16:00:30.000Z",
          id: "run-1",
          invocationSource: "automation",
          startedAt: "2026-04-09T16:00:00.000Z",
          status: "succeeded",
          triggerDetail: "system",
        },
      ],
      liveAgents: [
        {
          adapterType: "codex_local",
          id: "agent-1",
          name: "WebApp Codex",
          urlKey: "webapp-codex",
        },
      ],
      notionClient: {} as never,
      pauseMs: 0,
    });

    expect(upsertedRuns).toHaveLength(1);
    expect(upsertedRuns[0]).toMatchObject({
      agentKey: "webapp-codex",
      agentPageIds: ["agent-page-1"],
      paperclipUrl: expect.stringContaining("/agents/agent-1/runs/run-1"),
      runtime: "Paperclip/Codex",
      runId: "run-1",
      status: "Done",
      triggerSource: "Webhook",
    });

    expect(metadataUpdates).toEqual([
      {
        pageId: "agent-page-1",
        metadata: {
          latestRunPageIds: ["run-page-run-1"],
          lastActive: "2026-04-09T16:00:30.000Z",
          lastRunStatus: "Done",
        },
      },
    ]);
  });

  it("respects agent-key filtering for targeted backfills", async () => {
    await syncBlueprintAgentRuns({
      heartbeatRuns: [
        {
          agentId: "agent-1",
          id: "run-1",
          invocationSource: "timer",
          startedAt: "2026-04-09T16:00:00.000Z",
          status: "running",
          triggerDetail: "system",
        },
        {
          agentId: "agent-2",
          id: "run-2",
          invocationSource: "assignment",
          startedAt: "2026-04-09T17:00:00.000Z",
          status: "queued",
          triggerDetail: "system",
        },
      ],
      liveAgents: [
        { adapterType: "codex_local", id: "agent-1", name: "WebApp Codex", urlKey: "webapp-codex" },
        { adapterType: "hermes_local", id: "agent-2", name: "Growth Lead", urlKey: "growth-lead" },
      ],
      notionClient: {} as never,
      onlyAgentKeys: ["growth-lead"],
      pauseMs: 0,
    });

    expect(upsertedRuns).toHaveLength(1);
    expect(upsertedRuns[0]?.runId).toBe("run-2");
  });
});
