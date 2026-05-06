// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const autonomousGrowthRuns = new Map<string, Record<string, unknown>>();
const marketSignalCache = new Map<string, Record<string, unknown>>();
const createGrowthCampaignDraft = vi.hoisted(() => vi.fn());
const queueGrowthCampaignSend = vi.hoisted(() => vi.fn());

function resetState() {
  autonomousGrowthRuns.clear();
  marketSignalCache.clear();
}

function mockFetchJson(payload: unknown) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as Response);
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name !== "autonomous_growth_runs" && name !== "market_signal_cache") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id: string) {
          return {
            async get() {
              return {
                exists:
                  name === "autonomous_growth_runs"
                    ? autonomousGrowthRuns.has(id)
                    : marketSignalCache.has(id),
                data: () =>
                  name === "autonomous_growth_runs"
                    ? autonomousGrowthRuns.get(id)
                    : marketSignalCache.get(id),
              };
            },
            async set(payload: Record<string, unknown>) {
              const target = name === "autonomous_growth_runs" ? autonomousGrowthRuns : marketSignalCache;
              target.set(id, {
                ...(target.get(id) || {}),
                ...payload,
              });
            },
          };
        },
      };
    },
  },
}));

vi.mock("../utils/growth-ops", () => ({
  createGrowthCampaignDraft,
  queueGrowthCampaignSend,
}));

import {
  buildAutonomousOutboundDraft,
  runAutonomousResearchOutboundLoop,
} from "../utils/autonomous-growth";

beforeEach(() => {
  resetState();
  vi.stubEnv("SEARCH_API_KEY", "");
  vi.stubEnv("SEARCH_API_PROVIDER", "");
  vi.stubEnv("BLUEPRINT_MARKET_SIGNAL_PROVIDER", "firehose");
  vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
  vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS", "warehouse robotics,field robotics deployment");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS", "ops@tryblueprint.io,team@tryblueprint.io");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL", "sendgrid");
  createGrowthCampaignDraft.mockResolvedValue({
    id: "campaign-1",
  });
  queueGrowthCampaignSend.mockResolvedValue({
    state: "queued",
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("buildAutonomousOutboundDraft", () => {
  it("turns research signals into a proof-led outbound draft", () => {
    const draft = buildAutonomousOutboundDraft({
      topic: "warehouse robotics",
      signals: [
        {
          id: "sig-1",
          topic: "warehouse robotics",
          title: "Operators are narrowing facility pilots",
          summary: "Teams want one exact site before another travel-heavy review cycle.",
        },
      ],
    });

    expect(draft.subject).toContain("warehouse robotics");
    expect(draft.body).toContain("Operators are narrowing facility pilots");
    expect(draft.body).toContain("one real facility");
  });

  it("handles empty signals without throwing", () => {
    const draft = buildAutonomousOutboundDraft({
      topic: "field robotics deployment",
      signals: [],
    });

    expect(draft.subject).toContain("field robotics deployment");
    expect(draft.body).toContain("What came up repeatedly:");
    expect(draft.body).toContain("one real facility");
  });

  it("limits evidence to the top three signals and includes urls when present", () => {
    const draft = buildAutonomousOutboundDraft({
      topic: "warehouse robotics",
      signals: [
        {
          id: "sig-1",
          topic: "warehouse robotics",
          title: "Signal one",
          summary: "Summary one",
          url: "https://example.com/1",
        },
        {
          id: "sig-2",
          topic: "warehouse robotics",
          title: "Signal two",
          summary: "Summary two",
        },
        {
          id: "sig-3",
          topic: "warehouse robotics",
          title: "Signal three",
          summary: "Summary three",
        },
        {
          id: "sig-4",
          topic: "warehouse robotics",
          title: "Signal four",
          summary: "Summary four",
        },
      ],
    });

    expect(draft.body).toContain("Signal one: Summary one (https://example.com/1)");
    expect(draft.body).toContain("Signal two: Summary two");
    expect(draft.body).toContain("Signal three: Summary three");
    expect(draft.body).not.toContain("Signal four");
  });
});

describe("runAutonomousResearchOutboundLoop", () => {
  it("fails open when no market signal provider is configured", async () => {
    vi.stubEnv("SEARCH_API_KEY", "");
    vi.stubEnv("SEARCH_API_PROVIDER", "");
    vi.stubEnv("FIREHOSE_API_TOKEN", "");
    vi.stubEnv("FIREHOSE_BASE_URL", "");

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "provider_unavailable",
      }),
    ]);
    expect(createGrowthCampaignDraft).not.toHaveBeenCalled();
    expect(queueGrowthCampaignSend).not.toHaveBeenCalled();
  });

  it("skips a topic that already ran today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    autonomousGrowthRuns.set(`${today}__warehouse-robotics`, {
      status: "campaign_queued",
    });

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "skipped_existing",
      }),
    ]);
    expect(createGrowthCampaignDraft).not.toHaveBeenCalled();
  });

  it("records a no-signals run without creating a campaign", async () => {
    mockFetchJson({ items: [] });

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "no_signals",
      }),
    ]);
    expect(createGrowthCampaignDraft).not.toHaveBeenCalled();
    expect([...autonomousGrowthRuns.values()][0]).toMatchObject({
      status: "no_signals",
      signals: [],
    });
  });

  it("creates a draft without queueing when recipients are absent", async () => {
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS", "");
    mockFetchJson({
      items: [
        {
          id: "sig-1",
          topic: "warehouse robotics",
          title: "Signal one",
          summary: "Summary one",
        },
      ],
    });

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "draft_created",
      }),
    ]);
    expect(createGrowthCampaignDraft).toHaveBeenCalledOnce();
    expect(queueGrowthCampaignSend).not.toHaveBeenCalled();
  });

  it("queues a sendgrid campaign when recipients exist", async () => {
    mockFetchJson({
      items: [
        {
          id: "sig-1",
          topic: "warehouse robotics",
          title: "Signal one",
          summary: "Summary one",
          url: "https://example.com/1",
        },
      ],
    });

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
      operatorEmail: "operator@tryblueprint.io",
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "campaign_queued",
        campaignId: "campaign-1",
      }),
    ]);
    expect(createGrowthCampaignDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sendgrid",
        recipientEmails: ["ops@tryblueprint.io", "team@tryblueprint.io"],
        recipientEvidenceRequired: true,
        automationContext: expect.objectContaining({
          source: "autonomous_research_outbound",
          recipientEvidenceRequired: true,
        }),
      }),
    );
    expect(queueGrowthCampaignSend).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      operatorEmail: "operator@tryblueprint.io",
    });
    expect(marketSignalCache.get("sig-1")).toMatchObject({
      topic: "warehouse robotics",
      signal_provider_key: "firehose",
      last_seen_run_id: expect.stringContaining("warehouse-robotics"),
    });
  });

  it("processes multiple topics in one pass", async () => {
    mockFetchJson({
      items: [
        {
          id: "sig-1",
          topic: "topic",
          title: "Signal one",
          summary: "Summary one",
        },
      ],
    });

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics", "field robotics deployment"],
    });

    expect(result.count).toBe(2);
    expect(createGrowthCampaignDraft).toHaveBeenCalledTimes(2);
    expect(queueGrowthCampaignSend).toHaveBeenCalledTimes(2);
  });

  it("builds outbound drafts through the normalized provider interface", async () => {
    const provider = {
      key: "stub_provider",
      async fetchSignals(topic: string) {
        return {
          providerKey: "stub_provider",
          signals: [
            {
              id: "signal-1",
              topic,
              title: "Grounded deployment signal",
              summary: "Teams want exact-site review before another facility visit.",
              url: "https://example.com/signal-1",
              source: "stub_provider",
              publishedAt: "2026-04-20T00:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics"],
      provider: provider as any,
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        topic: "warehouse robotics",
        status: "campaign_queued",
      }),
    ]);
    expect(createGrowthCampaignDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Autonomous outbound: warehouse robotics",
        body: expect.stringContaining("Grounded deployment signal"),
        recipientEvidenceRequired: true,
      }),
    );
  });
});
