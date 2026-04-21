// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildNotionGroundingRelativePath,
  renderNotionGroundingMarkdown,
  selectNotionGroundingPages,
} from "../utils/notionGrounding";

function makeKnowledgePage(input: {
  id: string;
  title: string;
  lastEditedTime?: string;
  archived?: boolean;
}) {
  return {
    id: input.id,
    url: `https://www.notion.so/${input.id.replaceAll("-", "")}`,
    archived: input.archived ?? false,
    last_edited_time: input.lastEditedTime ?? "2026-04-21T00:00:00.000Z",
    parent: {
      database_id: "7c729783-c377-4342-bf00-5555b88a2ec6",
    },
    properties: {
      Title: {
        title: [
          {
            plain_text: input.title,
          },
        ],
      },
    },
  };
}

function makeWorkQueuePage(input: {
  id: string;
  title: string;
  lastEditedTime?: string;
  archived?: boolean;
}) {
  return {
    id: input.id,
    url: `https://www.notion.so/${input.id.replaceAll("-", "")}`,
    archived: input.archived ?? false,
    last_edited_time: input.lastEditedTime ?? "2026-04-21T00:00:00.000Z",
    parent: {
      database_id: "f83b6c53-a33a-4790-9ca4-786dddadad46",
    },
    properties: {
      Title: {
        title: [
          {
            plain_text: input.title,
          },
        ],
      },
    },
  };
}

describe("notion grounding", () => {
  it("selects the curated Deep Research Notion pages and respects per-database limits", () => {
    const selection = selectNotionGroundingPages({
      knowledgePages: [
        makeKnowledgePage({
          id: "knowledge-older",
          title: "Deep Research Brief - Warehouse Robotics Demand",
          lastEditedTime: "2026-04-20T00:00:00.000Z",
        }),
        makeKnowledgePage({
          id: "knowledge-newer",
          title: "City Launch Deep Research Playbook - Austin, TX",
          lastEditedTime: "2026-04-21T00:00:00.000Z",
        }),
        makeKnowledgePage({
          id: "knowledge-ignored",
          title: "Unrelated Architecture Page",
          lastEditedTime: "2026-04-22T00:00:00.000Z",
        }),
      ],
      workQueuePages: [
        makeWorkQueuePage({
          id: "queue-newer",
          title: "Review city launch deep research playbook - Austin, TX",
          lastEditedTime: "2026-04-21T00:00:00.000Z",
        }),
        makeWorkQueuePage({
          id: "queue-older",
          title: "Review deep research brief - Warehouse Robotics Demand",
          lastEditedTime: "2026-04-20T00:00:00.000Z",
        }),
        makeWorkQueuePage({
          id: "queue-ignored",
          title: "Random open task",
          lastEditedTime: "2026-04-22T00:00:00.000Z",
        }),
      ],
      limitPerDatabase: 1,
    });

    expect(selection).toEqual([
      {
        database: "knowledge",
        id: "knowledge-newer",
        title: "City Launch Deep Research Playbook - Austin, TX",
        url: "https://www.notion.so/knowledgenewer",
        lastEditedTime: "2026-04-21T00:00:00.000Z",
      },
      {
        database: "work_queue",
        id: "queue-newer",
        title: "Review city launch deep research playbook - Austin, TX",
        url: "https://www.notion.so/queuenewer",
        lastEditedTime: "2026-04-21T00:00:00.000Z",
      },
    ]);
  });

  it("narrows the curated Notion slice to a requested city when provided", () => {
    const selection = selectNotionGroundingPages({
      city: "Austin, TX",
      knowledgePages: [
        makeKnowledgePage({
          id: "knowledge-austin",
          title: "City Launch Deep Research Playbook - Austin, TX",
        }),
        makeKnowledgePage({
          id: "knowledge-seattle",
          title: "City Launch Deep Research Playbook - Seattle, WA",
        }),
      ],
      workQueuePages: [
        makeWorkQueuePage({
          id: "queue-austin",
          title: "Review city launch deep research playbook - Austin, TX",
        }),
        makeWorkQueuePage({
          id: "queue-seattle",
          title: "Review city launch deep research playbook - Seattle, WA",
        }),
      ],
    });

    expect(selection.map((entry) => entry.id)).toEqual([
      "knowledge-austin",
      "queue-austin",
    ]);
  });

  it("renders deterministic markdown snapshots with page metadata and block text", () => {
    const markdown = renderNotionGroundingMarkdown({
      database: "knowledge",
      page: {
        id: "page-123",
        title: "Deep Research Brief - Warehouse Robotics Demand",
        url: "https://www.notion.so/page123",
        lastEditedTime: "2026-04-21T01:02:03.000Z",
        properties: {
          System: { select: { name: "WebApp" } },
          Type: { select: { name: "Reference" } },
          "Source of Truth": { select: { name: "Repo" } },
          "Canonical Source": {
            rich_text: [{ plain_text: "ops/paperclip/reports/deep-research-briefs/warehouse/latest.md" }],
          },
        },
      },
      blocks: [
        {
          id: "b1",
          type: "heading_2",
          text: "Executive summary",
          hasChildren: false,
        },
        {
          id: "b2",
          type: "paragraph",
          text: "Warehouse robotics demand is strongest in exact-site pilot lanes.",
          hasChildren: false,
        },
        {
          id: "b3",
          type: "bulleted_list_item",
          text: "Focus on operator-ready proof paths.",
          hasChildren: false,
        },
      ],
    });

    expect(markdown).toContain("# Deep Research Brief - Warehouse Robotics Demand");
    expect(markdown).toContain("- notion_page_id: page-123");
    expect(markdown).toContain("- database: knowledge");
    expect(markdown).toContain("- system: WebApp");
    expect(markdown).toContain("## Content");
    expect(markdown).toContain("## Executive summary");
    expect(markdown).toContain("Warehouse robotics demand is strongest in exact-site pilot lanes.");
    expect(markdown).toContain("- Focus on operator-ready proof paths.");
  });

  it("builds stable repo-relative paths for notion grounding snapshots", () => {
    expect(
      buildNotionGroundingRelativePath({
        database: "work_queue",
        id: "page-123",
        title: "Review city launch deep research playbook - Austin, TX",
      }),
    ).toBe(
      "ops/paperclip/research-grounding/notion/work_queue/review-city-launch-deep-research-playbook-austin-tx--page-123.md",
    );
  });
});
