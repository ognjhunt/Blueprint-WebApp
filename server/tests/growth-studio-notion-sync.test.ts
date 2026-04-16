// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNotionQuery = vi.fn();
const mockNotionCreate = vi.fn();
const mockNotionUpdate = vi.fn();
const mockVerifyGrowthIntegrations = vi.fn();
const mockListContentOutcomeReviews = vi.fn();

type MockDoc = {
  id: string;
  data: Record<string, unknown>;
};

const collectionDocs = new Map<string, MockDoc[]>();

function makeSnapshot(docs: MockDoc[]) {
  return {
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => doc.data,
    })),
  };
}

function makeQueryChain(docs: MockDoc[]) {
  const chain: Record<string, any> = {};
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn((limit: number) => ({
    get: vi.fn(async () => makeSnapshot(docs.slice(0, limit))),
  }));
  chain.get = vi.fn(async () => makeSnapshot(docs));
  return chain;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: vi.fn((name: string) => makeQueryChain(collectionDocs.get(name) || [])),
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

vi.mock("../utils/growth-ops", () => ({
  verifyGrowthIntegrations: mockVerifyGrowthIntegrations,
}));

vi.mock("../utils/content-ops", () => ({
  listContentOutcomeReviews: mockListContentOutcomeReviews,
}));

const originalEnv = { ...process.env };

describe("growth studio notion sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    collectionDocs.clear();

    process.env = {
      ...originalEnv,
      NOTION_API_TOKEN: "secret-token",
      NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID: "ship_db",
      NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID: "campaign_db",
      NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID: "creative_db",
      NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID: "integration_db",
      NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID: "reviews_db",
    };

    collectionDocs.set("growthCampaigns", [
      {
        id: "campaign_1",
        data: {
          name: "Warehouse ship broadcast",
          send_status: "pending_approval",
          recipient_count: 18,
          channel: "sendgrid",
          subject: "Exact-site hosted review update",
          created_at_iso: "2026-04-04T16:00:00.000Z",
          last_ledger_doc_id: "ledger_1",
          approval_reason: "needs human review",
          automation_context: {
            asset_key: "ship-broadcast:warehouse-1",
            asset_type: "ship_broadcast",
            source_issue_ids: ["issue-1"],
            proof_links: ["https://www.notion.so/proof-1"],
          },
          creative_context: {
            creative_run_id: "creative_run_1",
          },
          response_tracking: {
            last_event_type: "queued",
            last_recipient: "ops@tryblueprint.io",
          },
        },
      },
    ]);
    collectionDocs.set("creative_factory_runs", [
      {
        id: "creative_run_1",
        data: {
          sku_name: "Exact-Site Hosted Review",
          research_topic: "warehouse robotics proof",
          rollout_variant: "v1",
          status: "execution_handoff_queued",
          created_at_iso: "2026-04-04T15:45:00.000Z",
          buyer_objections: ["How exact is the site coverage?"],
          image_batch: [],
          execution_handoff: {
            issue_id: "issue-creative-1",
            status: "todo",
            assignee: "webapp-codex",
          },
          remotion_reel: {
            storage_uri: "gs://bucket/reel.mp4",
          },
        },
      },
    ]);
    collectionDocs.set("growthIntegrationVerifications", [
      {
        id: "verification_1",
        data: {
          verified_at_iso: "2026-04-04T15:30:00.000Z",
          summary: {
            analytics: {
              firstPartyIngest: { enabled: true },
              ga4: { configured: true },
              posthog: { configured: false },
              alignment: { note: "First-party ingest is active." },
            },
            sendgrid: { configured: true },
            sendgridWebhook: { configured: true },
            googleImage: {
              configured: true,
              executionState: "configured_unverified",
              note: "Quota still needs verification.",
            },
            runway: { configured: true },
            elevenlabs: { configured: true },
            telephony: { configured: false },
            researchOutbound: { configured: true },
          },
        },
      },
    ]);

    mockNotionQuery.mockResolvedValue({ results: [] });
    mockNotionCreate.mockResolvedValue({ id: "page_123" });
    mockNotionUpdate.mockResolvedValue({ id: "page_123" });
    mockVerifyGrowthIntegrations.mockResolvedValue({
      verificationId: "verification_2",
    });
    mockListContentOutcomeReviews.mockResolvedValue([
      {
        id: "review_1",
        assetKey: "ship-broadcast:warehouse-1",
        issueId: "issue-1",
        assetType: "ship_broadcast",
        channels: ["sendgrid"],
        summary: "Proof-led ship broadcast performed well.",
        whatWorked: ["Concrete exact-site framing"],
        whatDidNot: ["Subject line was too soft"],
        nextRecommendation: "Tighten the opening line.",
        evidenceSource: "sendgrid:webhook",
        confidence: 0.82,
        recordedAt: "2026-04-04T15:35:00.000Z",
        recordedBy: "ops@tryblueprint.io",
      },
    ]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("syncs growth studio surfaces into the configured Notion databases", async () => {
    const { syncGrowthStudioToNotion } = await import("../utils/notion-sync");
    const result = await syncGrowthStudioToNotion({
      limit: 10,
      refreshIntegrationSnapshot: true,
    });

    expect(mockVerifyGrowthIntegrations).toHaveBeenCalledTimes(1);
    expect(result.processedCount).toBe(5);
    expect(result.failedCount).toBe(0);
    expect(mockNotionCreate).toHaveBeenCalledTimes(5);
  });

  it("refreshes the live integration snapshot by default when bidirectionally syncing", async () => {
    const { runNotionBidirectionalSync } = await import("../utils/notion-sync");
    const result = await runNotionBidirectionalSync({
      limit: 10,
    });

    expect(mockVerifyGrowthIntegrations).toHaveBeenCalledTimes(1);
    expect(result.processedCount).toBe(5);
    expect(result.failedCount).toBe(0);
  });
});
