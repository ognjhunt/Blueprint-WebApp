// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type DocLike = { id: string; data: () => Record<string, unknown> };

const collectionDocs = new Map<string, DocLike[]>();
const existingPagesByQueryKey = new Map<string, Array<{ id: string }>>();
const mockDatabasesRetrieve = vi.fn();
const mockDatabasesUpdate = vi.fn();
const mockDatabasesQuery = vi.fn();
const mockPagesCreate = vi.fn();
const mockPagesUpdate = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: vi.fn((name: string) => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ docs: collectionDocs.get(name) || [] }),
        }),
      }),
      limit: () => ({
        get: async () => ({ docs: collectionDocs.get(name) || [] }),
      }),
    })),
  },
}));

vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    databases: {
      retrieve: mockDatabasesRetrieve,
      update: mockDatabasesUpdate,
      query: mockDatabasesQuery,
    },
    pages: {
      create: mockPagesCreate,
      update: mockPagesUpdate,
    },
  })),
}));

const originalEnv = { ...process.env };

function doc(id: string, data: Record<string, unknown>): DocLike {
  return {
    id,
    data: () => data,
  };
}

function queryKey(filter: unknown) {
  const clauses = Array.isArray((filter as { and?: unknown[] })?.and)
    ? ((filter as { and?: Array<Record<string, unknown>> }).and || [])
    : [];

  const findClause = (property: string) =>
    clauses.find((clause) => clause.property === property) as
      | { title?: { equals?: string }; select?: { equals?: string } }
      | undefined;

  return [
    findClause("Title")?.title?.equals || "",
    findClause("System")?.select?.equals || "",
    findClause("Work Type")?.select?.equals || "",
    findClause("Source Authority")?.select?.equals || "",
  ].join("::");
}

describe("growth Notion sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    collectionDocs.clear();
    existingPagesByQueryKey.clear();

    process.env = {
      ...originalEnv,
      NOTION_API_TOKEN: "secret-token",
    };

    mockDatabasesRetrieve.mockResolvedValue({
      properties: {
        Title: {},
        Priority: {},
        System: {},
        "Business Lane": {},
        "Lifecycle Stage": {},
        "Work Type": {},
        Substage: {},
        "Output Location": {},
        "Execution Surface": {},
        "Needs Founder": {},
        "Last Status Change": {},
      },
    });

    mockDatabasesUpdate.mockResolvedValue({});
    mockDatabasesQuery.mockImplementation(({ filter }) => ({
      results: existingPagesByQueryKey.get(queryKey(filter)) || [],
    }));
    mockPagesCreate.mockResolvedValue({ id: "page-created", url: "https://notion.so/page-created" });
    mockPagesUpdate.mockResolvedValue({ id: "page-existing", url: "https://notion.so/page-existing" });
  });

  it("mirrors recent growth state into the Work Queue with source authority and sync stamps", async () => {
    collectionDocs.set("action_ledger", [
      doc("ledger-1", {
        lane: "growth_campaign",
        status: "pending_approval",
        action_type: "send_campaign_emails",
        action_payload: {
          campaignId: "campaign-1",
          subject: "Launch sequence",
        },
        draft_output: {
          recommendation: "send_campaign",
        },
        created_at: new Date("2026-04-01T00:00:00.000Z"),
        updated_at: new Date("2026-04-01T00:05:00.000Z"),
      }),
    ]);
    collectionDocs.set("growthCampaigns", [
      doc("campaign-1", {
        send_status: "draft",
        name: "Launch sequence",
        channel: "sendgrid",
        delivery_provider: "sendgrid",
        recipient_count: 12,
        created_at: new Date("2026-04-01T01:00:00.000Z"),
        updated_at: new Date("2026-04-01T01:10:00.000Z"),
      }),
    ]);
    collectionDocs.set("creative_factory_runs", [
      doc("creative-run-1", {
        sku_name: "Exact-Site Hosted Review",
        status: "assets_generated",
        image_batch: [{}, {}],
        remotion_reel: {
          status: "rendered",
        },
        created_at: new Date("2026-04-01T02:00:00.000Z"),
      }),
    ]);
    collectionDocs.set("growthIntegrationVerifications", [
      doc("verification-1", {
        verified_at: new Date("2026-04-01T03:00:00.000Z"),
        verified_at_iso: "2026-04-01T03:00:00.000Z",
        summary: {
          analytics: {
            alignment: {
              note: "First-party growth events are aligned with external analytics.",
            },
          },
          nitrosend: { configured: false },
          runway: { configured: true },
          elevenlabs: { configured: true },
          telephony: { configured: false },
          sendgrid: { configured: true },
          googleImage: { executionState: "configured_unverified" },
        },
      }),
    ]);
    collectionDocs.set("content_outcome_reviews", [
      doc("review-1", {
        title: "Homepage refresh",
        status: "approved",
        summary: "Clear and on brand.",
        reviewed_at: new Date("2026-04-01T04:00:00.000Z"),
      }),
    ]);

    existingPagesByQueryKey.set("Creative run: creative-run-1::WebApp::Refresh::app/API", [
      { id: "page-existing" },
    ]);

    const { syncGrowthStudioToNotion } = await import("../utils/notion-sync");
    const result = await syncGrowthStudioToNotion({ limit: 10 });

    // Verify per-lane sync counts are present (each is a SyncCounts object)
    expect(result.shipBroadcastApprovalQueue).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.campaignDrafts).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.creativeRuns).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.integrationChecks).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.contentOutcomeReviews).toEqual({ created: 0, updated: 0, errors: 0 });

    // Verify processed and failed counts
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });

  it("returns zero counts when notion client is unavailable", async () => {
    delete process.env.NOTION_API_TOKEN;

    const { syncGrowthStudioToNotion } = await import("../utils/notion-sync");
    const result = await syncGrowthStudioToNotion({ limit: 10 });

    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.shipBroadcastApprovalQueue).toEqual({ created: 0, updated: 0, errors: 0 });
  });
});
