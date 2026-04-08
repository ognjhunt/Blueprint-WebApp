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
const mockVerifyGrowthIntegrations = vi.fn();
const mockListContentOutcomeReviews = vi.fn();

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

vi.mock("../utils/growth-ops", () => ({
  verifyGrowthIntegrations: mockVerifyGrowthIntegrations,
}));

vi.mock("../utils/content-ops", () => ({
  listContentOutcomeReviews: mockListContentOutcomeReviews,
}));

const originalEnv = { ...process.env };

function doc(id: string, data: Record<string, unknown>): DocLike {
  return {
    id,
    data: () => data,
  };
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
      NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID: "notion-db-ship-broadcast",
      NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID: "notion-db-campaign-drafts",
      NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID: "notion-db-creative-runs",
      NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID: "notion-db-integration-checks",
      NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID: "notion-db-content-reviews",
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
    mockDatabasesQuery.mockResolvedValue({ results: [] });
    mockPagesCreate.mockResolvedValue({ id: "page-created", url: "https://notion.so/page-created" });
    mockPagesUpdate.mockResolvedValue({ id: "page-existing", url: "https://notion.so/page-existing" });
    mockVerifyGrowthIntegrations.mockResolvedValue({ verificationId: "verification-1" });
    mockListContentOutcomeReviews.mockResolvedValue([]);
  });

  it("mirrors recent Growth Studio state into the configured Notion databases with source authority and sync stamps", async () => {
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

    const { syncGrowthStudioToNotion } = await import("../utils/notion-sync");
    const result = await syncGrowthStudioToNotion({ limit: 10 });

    expect(result.shipBroadcastApprovalQueue).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.campaignDrafts).toEqual({ created: 1, updated: 0, errors: 0 });
    expect(result.creativeRuns).toEqual({ created: 1, updated: 0, errors: 0 });
    expect(result.integrationChecks).toEqual({ created: 1, updated: 0, errors: 0 });
    expect(result.contentOutcomeReviews).toEqual({ created: 0, updated: 0, errors: 0 });
    expect(result.processedCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.sourceCounts).toEqual({
      shipBroadcastApprovals: 0,
      campaignDrafts: 1,
      creativeRuns: 1,
      integrationVerifications: 1,
      contentReviews: 0,
    });

    const campaignCreate = mockPagesCreate.mock.calls.find(([payload]) => {
      const properties = (payload as { properties?: Record<string, unknown> }).properties || {};
      return "Campaign ID" in properties;
    })?.[0] as { properties: Record<string, any> } | undefined;

    expect(campaignCreate).toBeTruthy();
    expect(campaignCreate?.properties["Campaign ID"]).toEqual({
      rich_text: [{ text: { content: "campaign-1" } }],
    });
    expect(campaignCreate?.properties["Authoritative Source"]).toEqual({
      select: { name: "WebApp API / SendGrid" },
    });
    expect(campaignCreate?.properties["Last Synced At"]).toEqual({
      date: { start: expect.any(String) },
    });

    // Legacy expectations kept here only as a regression guard for the empty ship-broadcast lane.
    expect(result.shipBroadcastApprovalQueue).toEqual({ created: 0, updated: 0, errors: 0 });
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
