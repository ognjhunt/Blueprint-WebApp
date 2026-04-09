import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRegistryEntry, SimpleTextBlock } from "./notion.js";

const createdEntries: Array<{ entry: AgentRegistryEntry; pageId: string }> = [];
const metadataUpdates: Array<{ pageId: string; metadata: Record<string, unknown> }> = [];
const replacedBlocks: Array<{ blocks: SimpleTextBlock[]; pageId: string }> = [];

vi.mock("./notion.js", () => {
  let pageCounter = 0;

  return {
    archivePage: vi.fn(async () => undefined),
    createAgentRegistryEntry: vi.fn(async (_client: unknown, entry: AgentRegistryEntry) => {
      pageCounter += 1;
      const pageId = `agent-page-${pageCounter}`;
      createdEntries.push({ entry, pageId });
      return { pageId, pageUrl: `https://notion.so/${pageId}` };
    }),
    queryDatabase: vi.fn(async () => []),
    replacePageBlocks: vi.fn(async (_client: unknown, pageId: string, blocks: SimpleTextBlock[]) => {
      replacedBlocks.push({ blocks, pageId });
    }),
    updatePageMetadata: vi.fn(async (_client: unknown, pageId: string, _database: string, metadata: Record<string, unknown>) => {
      metadataUpdates.push({ pageId, metadata });
      return { pageId, pageUrl: `https://notion.so/${pageId}` };
    }),
  };
});

import { syncBlueprintAgentRegistry } from "./agent-registry-sync.js";

describe("agent registry sync", () => {
  beforeEach(() => {
    createdEntries.length = 0;
    metadataUpdates.length = 0;
    replacedBlocks.length = 0;
  });

  it("inherits canonical routine metadata for documentation-agent while disambiguating the disabled canonical row", async () => {
    await syncBlueprintAgentRegistry({
      liveAgents: [
        {
          adapterType: "codex_local",
          createdAt: "2026-04-09T14:00:00.000Z",
          id: "documentation-agent-id",
          name: "Documentation Agent",
          status: "idle",
          updatedAt: "2026-04-09T14:34:00.000Z",
          urlKey: "documentation-agent",
        },
      ],
      notionClient: {} as never,
    });

    const liveAlias = createdEntries.find((entry) => entry.entry.canonicalKey === "documentation-agent");
    const canonicalRow = createdEntries.find((entry) => entry.entry.canonicalKey === "docs-agent");
    expect(liveAlias?.entry.title).toBe("Documentation Agent");
    expect(liveAlias?.entry.defaultTriggers).toEqual(expect.arrayContaining(["Manual", "Schedule", "Webhook"]));
    expect(liveAlias?.entry.toolAccess).toEqual(expect.arrayContaining(["Slack", "Notion", "GitHub", "Repo", "MCP"]));

    expect(canonicalRow?.entry.title).toBe("Documentation Agent (docs-agent)");
    expect(canonicalRow?.entry.status).toBe("Disabled");
    expect(canonicalRow?.entry.lastActive).toBe("2026-04-09T14:34:00.000Z");

    const aliasBody = replacedBlocks.find((entry) => entry.pageId === liveAlias?.pageId);
    const aliasLines = aliasBody?.blocks.map((block) => block.text) ?? [];
    expect(aliasLines).toContain("Schedule: Docs Agent Sweep (active) — 0 10 * * 2,5 America/New_York");
    expect(aliasLines).toContain("Legacy live agent: repo metadata is sourced from docs-agent until the live alias is retired.");
  });

  it("keeps legacy reviewer aliases readable while still inheriting the canonical review schedule", async () => {
    await syncBlueprintAgentRegistry({
      liveAgents: [
        {
          adapterType: "codex_local",
          createdAt: "2026-04-09T14:00:00.000Z",
          id: "capture-claude-id",
          name: "Capture Claude",
          status: "error",
          updatedAt: "2026-04-09T14:36:00.000Z",
          urlKey: "capture-claude",
        },
      ],
      notionClient: {} as never,
    });

    const aliasRow = createdEntries.find((entry) => entry.entry.canonicalKey === "capture-claude");
    expect(aliasRow?.entry.title).toBe("Capture Claude");
    expect(aliasRow?.entry.defaultTriggers).toEqual(expect.arrayContaining(["Manual", "Schedule", "Webhook"]));

    const aliasBody = replacedBlocks.find((entry) => entry.pageId === aliasRow?.pageId);
    const aliasLines = aliasBody?.blocks.map((block) => block.text) ?? [];
    expect(aliasLines).toContain("Schedule: Capture Review Loop (active) — 45 13 * * 1-5 America/New_York");
  });
});
