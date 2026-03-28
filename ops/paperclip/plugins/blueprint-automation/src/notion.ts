import { Client } from "@notionhq/client";

// Database IDs (page-level) from Blueprint Hub
const WORK_QUEUE_DB = "f83b6c53-a33a-4790-9ca4-786dddadad46";
const SKILLS_DB = "4e37bd7a-e448-4f81-aa3e-b8860826e98c";
const KNOWLEDGE_DB = "7c729783-c377-4342-bf00-5555b88a2ec6";

// Data Source IDs (collection-level) for querying
const WORK_QUEUE_DS = "51d93d65-8a00-4dd4-a9a2-fd9a6e69120d";
const KNOWLEDGE_DS = "b9e4ca9c-db43-4a16-9780-f15eb100c8b4";

export interface NotionConfig {
  token: string;
}

export function createNotionClient(config: NotionConfig): Client {
  return new Client({ auth: config.token });
}

// ── Work Queue Operations ────────────────────────────────

export interface WorkQueueItem {
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  lifecycleStage: string;
  workType: "Task" | "Research" | "Refresh" | "SOP" | "Improvement";
  substage?: string;
}

export async function createWorkQueueItem(
  client: Client,
  item: WorkQueueItem
): Promise<string> {
  const response = await client.pages.create({
    parent: { database_id: WORK_QUEUE_DB },
    properties: {
      Title: { title: [{ text: { content: item.title } }] },
      Priority: { select: { name: item.priority } },
      System: { select: { name: item.system } },
      "Lifecycle Stage": { select: { name: item.lifecycleStage } },
      "Work Type": { select: { name: item.workType } },
      ...(item.substage
        ? { Substage: { rich_text: [{ text: { content: item.substage } }] } }
        : {}),
    },
  });
  return response.id;
}

export async function queryWorkQueue(
  client: Client,
  filters: { system?: string; priority?: string; lifecycleStage?: string }
): Promise<Array<{ id: string; title: string; priority: string; system: string }>> {
  const filterConditions: Array<Record<string, unknown>> = [];

  if (filters.system) {
    filterConditions.push({
      property: "System",
      select: { equals: filters.system },
    });
  }
  if (filters.priority) {
    filterConditions.push({
      property: "Priority",
      select: { equals: filters.priority },
    });
  }
  if (filters.lifecycleStage) {
    filterConditions.push({
      property: "Lifecycle Stage",
      select: { equals: filters.lifecycleStage },
    });
  }

  const response = await client.dataSources.query({
    data_source_id: WORK_QUEUE_DS,
    filter:
      filterConditions.length > 1
        ? { and: filterConditions as any }
        : filterConditions.length === 1
          ? (filterConditions[0] as any)
          : undefined,
    sorts: [{ property: "Priority", direction: "ascending" }],
    page_size: 50,
  });

  return response.results.map((page: any) => ({
    id: page.id,
    title: page.properties.Title?.title?.[0]?.text?.content ?? "",
    priority: page.properties.Priority?.select?.name ?? "",
    system: page.properties.System?.select?.name ?? "",
  }));
}

// ── Knowledge DB Operations ──────────────────────────────

export interface KnowledgeEntry {
  title: string;
  type: "Concept" | "Reference" | "How-To" | "Decision" | "Architecture" | "Contract";
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  content: string;
}

export async function createKnowledgeEntry(
  client: Client,
  entry: KnowledgeEntry
): Promise<string> {
  const response = await client.pages.create({
    parent: { database_id: KNOWLEDGE_DB },
    properties: {
      Title: { title: [{ text: { content: entry.title } }] },
      Type: { select: { name: entry.type } },
      System: { select: { name: entry.system } },
      "Agent Surface": {
        multi_select: [{ name: "Shared" }, { name: "Claude" }],
      },
      "Source of Truth": { select: { name: "Notion" } },
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: entry.content } }],
        },
      },
    ],
  });
  return response.id;
}

// ── Tool Handler Factories ───────────────────────────────

export function buildNotionToolHandlers(client: Client) {
  return {
    "notion-read-work-queue": async (params: {
      system?: string;
      priority?: string;
    }) => {
      const items = await queryWorkQueue(client, params);
      return {
        success: true,
        items,
        count: items.length,
      };
    },

    "notion-write-work-queue": async (params: WorkQueueItem) => {
      const id = await createWorkQueueItem(client, params);
      return { success: true, pageId: id };
    },

    "notion-write-knowledge": async (params: KnowledgeEntry) => {
      const id = await createKnowledgeEntry(client, params);
      return { success: true, pageId: id };
    },
  };
}
