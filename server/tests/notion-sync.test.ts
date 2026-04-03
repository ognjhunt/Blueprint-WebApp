// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockNotionQuery = vi.fn();
const mockNotionCreate = vi.fn();
const mockNotionUpdate = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
      limit: vi.fn(() => ({
        get: mockGet,
      })),
    })),
  },
}));

vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    databases: {
      query: mockNotionQuery,
    },
    pages: {
      create: mockNotionCreate,
      update: mockNotionUpdate,
    },
  })),
}));

const originalEnv = { ...process.env };

describe("notion sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NOTION_API_KEY: "secret",
      NOTION_CAMPAIGNS_DB_ID: "campaign_db",
      NOTION_CREATIVE_RUNS_DB_ID: "creative_db",
      NOTION_GRADUATION_DB_ID: "graduation_db",
      NOTION_SLA_DB_ID: "sla_db",
      NOTION_TASKS_DB_ID: "tasks_db",
    };
    mockNotionCreate.mockResolvedValue({ id: "page_123" });
    mockNotionUpdate.mockResolvedValue({ id: "page_123" });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates Notion pages from Firestore records", async () => {
    mockGet
      .mockResolvedValueOnce({
        docs: [{ id: "campaign_1", data: () => ({ name: "Campaign", status: "draft" }) }],
      })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });
    mockNotionQuery.mockResolvedValue({ results: [] });

    const { syncFirestoreToNotion } = await import("../utils/notion-sync");
    const result = await syncFirestoreToNotion({ limit: 10 });

    expect(result.created).toBeGreaterThan(0);
    expect(mockNotionCreate).toHaveBeenCalled();
  });

  it("syncs operator overrides from Notion into Firestore", async () => {
    mockNotionQuery.mockResolvedValue({
      results: [
        {
          id: "page_123",
          properties: {
            external_id: { rich_text: [{ plain_text: "req_123" }] },
            target_collection: { rich_text: [{ plain_text: "inboundRequests" }] },
            approved_by: { rich_text: [{ plain_text: "founder@tryblueprint.io" }] },
            priority_override: { select: { name: "high" } },
            notes: { rich_text: [{ plain_text: "Approved manually" }] },
          },
        },
      ],
    });

    const { syncNotionToFirestore } = await import("../utils/notion-sync");
    const result = await syncNotionToFirestore({ limit: 10 });

    expect(result.updated).toBe(1);
    expect(mockSet).toHaveBeenCalled();
  });
});
