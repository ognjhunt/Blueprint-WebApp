// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const autonomousGrowthRuns = new Map<string, Record<string, unknown>>();
const createGrowthCampaignDraft = vi.hoisted(() => vi.fn());
const queueGrowthCampaignSend = vi.hoisted(() => vi.fn());

function resetState() {
  autonomousGrowthRuns.clear();
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
      if (name !== "autonomous_growth_runs") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id: string) {
          return {
            async get() {
              return {
                exists: autonomousGrowthRuns.has(id),
                data: () => autonomousGrowthRuns.get(id),
              };
            },
            async set(payload: Record<string, unknown>) {
              autonomousGrowthRuns.set(id, {
                ...(autonomousGrowthRuns.get(id) || {}),
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
  vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
  vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS", "warehouse robotics,field robotics deployment");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS", "ops@tryblueprint.io,team@tryblueprint.io");
  vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL", "sendgrid");
  createGrowthCampaignDraft.mockResolvedValue({
    id: "campaign-1",
    nitrosendCampaignId: null,
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "sig-1",
            topic: "warehouse robotics",
            title: "Signal one",
            summary: "Summary one",
          },
        ],
      }),
    } as Response);

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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "sig-1",
            topic: "warehouse robotics",
            title: "Signal one",
            summary: "Summary one",
            url: "https://example.com/1",
          },
        ],
      }),
    } as Response);

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
      }),
    );
    expect(queueGrowthCampaignSend).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      operatorEmail: "operator@tryblueprint.io",
    });
  });

  it("processes multiple topics in one pass", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "sig-1",
            topic: "topic",
            title: "Signal one",
            summary: "Summary one",
          },
        ],
      }),
    } as Response);

    const result = await runAutonomousResearchOutboundLoop({
      topics: ["warehouse robotics", "field robotics deployment"],
    });

    expect(result.count).toBe(2);
    expect(createGrowthCampaignDraft).toHaveBeenCalledTimes(2);
    expect(queueGrowthCampaignSend).toHaveBeenCalledTimes(2);
  });
});
