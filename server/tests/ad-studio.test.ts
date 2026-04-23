// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runDocs = new Map<string, Record<string, unknown>>();
let autoIdCounter = 0;

function resetState() {
  runDocs.clear();
  autoIdCounter = 0;
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
      if (name !== "ad_studio_runs") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id: string) {
          return {
            async get() {
              return {
                exists: runDocs.has(id),
                data: () => runDocs.get(id),
              };
            },
            async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
              if (options?.merge) {
                runDocs.set(id, {
                  ...(runDocs.get(id) || {}),
                  ...payload,
                });
                return;
              }

              runDocs.set(id, payload);
            },
          };
        },
        async add(payload: Record<string, unknown>) {
          const id = `ad-studio-run-${++autoIdCounter}`;
          runDocs.set(id, payload);
          return { id };
        },
      };
    },
  },
}));

import {
  attachAdStudioAsset,
  buildAdStudioBrief,
  buildAndPersistAdStudioBrief,
  createAdStudioRun,
  createPersistedAdStudioMetaDraft,
  queueAdStudioVideo,
  queuePersistedAdStudioVideo,
  reviewPersistedAdStudioCreative,
  reviewAdStudioCreative,
} from "../utils/ad-studio";

beforeEach(() => {
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ad studio service", () => {
  it("creates an ad studio run with normalized lane, claims, and paused meta placeholders", async () => {
    const result = await createAdStudioRun({
      lane: "capturer",
      audience: " public indoor capturers ",
      cta: " Apply to capture public indoor spaces ",
      budgetCapUsd: 250,
      city: " Atlanta ",
      allowedClaims: [" Illustrative public-indoor scenes are allowed "],
      blockedClaims: [" No fabricated proof claims "],
      aspectRatio: " 9:16 ",
    });

    expect(result.run.id).toBe("ad-studio-run-1");
    expect(result.run.lane).toBe("capturer");
    expect(result.run.audience).toBe("public indoor capturers");
    expect(result.run.status).toBe("draft_requested");
    expect(result.run.claimsLedger).toEqual({
      allowedClaims: ["Illustrative public-indoor scenes are allowed"],
      blockedClaims: ["No fabricated proof claims"],
      evidenceLinks: [],
      reviewDecision: "pending",
      reviewNotes: [],
    });
    expect(result.run.metaDraft).toEqual({
      campaignId: null,
      adSetId: null,
      adId: null,
      status: "not_created",
    });

    expect(runDocs.get("ad-studio-run-1")).toMatchObject({
      lane: "capturer",
      audience: "public indoor capturers",
      cta: "Apply to capture public indoor spaces",
      city: "Atlanta",
      aspect_ratio: "9:16",
      status: "draft_requested",
    });
  });

  it("rejects runs missing the brief contract", async () => {
    await expect(
      createAdStudioRun({
        lane: "capturer",
        audience: "",
        cta: "",
        budgetCapUsd: 0,
        city: null,
        allowedClaims: [],
        blockedClaims: [],
        aspectRatio: "",
      }),
    ).rejects.toThrow(
      "Ad Studio run requires audience, CTA, budget cap, aspect ratio, and claim boundaries.",
    );
  });

  it("builds a capturer brief with synthetic public-indoor scene guidance", async () => {
    const { brief } = await buildAdStudioBrief({
      lane: "capturer",
      audience: "public indoor capturers",
      cta: "Apply to capture public indoor spaces",
      budgetCapUsd: 250,
      city: "Atlanta",
      allowedClaims: ["Illustrative scenes allowed"],
      blockedClaims: ["No fabricated payout proof"],
      aspectRatio: "9:16",
    });

    expect(brief.visualDirection).toContain("public-facing indoor");
    expect(brief.copyHooks.length).toBeGreaterThan(0);
    expect(brief.copyHooks[0]).toContain("capture");
  });

  it("fails review when synthetic proof is presented as real", () => {
    const result = reviewAdStudioCreative({
      headline: "Earn $430 today capturing a real Atlanta gym",
      primaryText: "Three capturers already got paid this week.",
      claimsLedger: {
        allowedClaims: ["Illustrative scenes allowed"],
        blockedClaims: ["No fabricated earnings or captured sites"],
        evidenceLinks: [],
      },
    });

    expect(result.status).toBe("failed_claims_review");
    expect(result.reasons).toContain("Creative presents fabricated proof as real.");
  });

  it("starts a Seedance task from an approved first frame", async () => {
    const startVideo = vi.fn().mockResolvedValue({ id: "task_1", status: "PENDING" });

    const result = await queueAdStudioVideo(
      {
        runId: "run_1",
        promptText: "Public indoor capture POV",
        firstFrameUrl: "https://cdn.example.com/frame.png",
        ratio: "9:16",
      },
      startVideo,
    );

    expect(startVideo).toHaveBeenCalledWith({
      promptText: "Public indoor capture POV",
      promptImage: "https://cdn.example.com/frame.png",
      ratio: "9:16",
    });
    expect(result.videoTaskId).toBe("task_1");
    expect(result.status).toBe("PENDING");
  });

  it("persists the brief, review result, and paused Meta draft ids", async () => {
    const created = await createAdStudioRun({
      lane: "buyer",
      audience: "robotics deployment leads",
      cta: "Request an exact-site hosted review",
      budgetCapUsd: 450,
      city: "Atlanta",
      allowedClaims: ["Illustrative scenes allowed"],
      blockedClaims: ["No fabricated buyer proof"],
      aspectRatio: "16:9",
    });

    const briefResult = await buildAndPersistAdStudioBrief(created.run.id);
    expect(briefResult.run.status).toBe("brief_ready");
    expect(briefResult.promptPack?.headlineOptions.length).toBeGreaterThan(0);

    await attachAdStudioAsset(created.run.id, {
      type: "image",
      role: "first_frame",
      uri: "https://cdn.example.com/first-frame.png",
      provider: "codex_gpt_image_2",
    });

    const startPersistedVideo = vi.fn().mockResolvedValue({ id: "task_2", status: "PENDING" });
    const queuedVideo = await queuePersistedAdStudioVideo(
      created.run.id,
      {
        promptText: "Hosted review concept ad",
        firstFrameUrl: "https://cdn.example.com/first-frame.png",
        ratio: "16:9",
      },
      startPersistedVideo as never,
    );
    expect(queuedVideo.videoTask?.taskId).toBeTruthy();

    const reviewResult = await reviewPersistedAdStudioCreative(created.run.id, {
      headline: "Review the exact site before your robot shows up",
      primaryText:
        "Illustrative concept ad for Blueprint's hosted review workflow. No fabricated buyer proof or site claims.",
      claimsLedger: {
        allowedClaims: ["Illustrative scenes allowed"],
        blockedClaims: ["No fabricated buyer proof"],
        evidenceLinks: [],
      },
    });
    expect(reviewResult.run.status).toBe("draft_safe");
    expect(reviewResult.run.claimsLedger.reviewDecision).toBe("approved");

    vi.stubEnv("META_MARKETING_API_ACCESS_TOKEN", "meta-token");
    vi.stubEnv("META_PAGE_ID", "page_1");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "cmp_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "adset_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "ad_1" }),
      });

    const metaResult = await createPersistedAdStudioMetaDraft(
      created.run.id,
      {
        accountId: "123",
        campaignName: "Blueprint Buyer Draft",
        objective: "OUTCOME_TRAFFIC",
        dailyBudgetMinorUnits: 4500,
        primaryText:
          "Illustrative hosted-review concept ad. Real proof remains evidence-gated.",
        headline: "Hosted review for one deployment question",
        videoId: "vid_1",
        destinationUrl: "https://tryblueprint.io/world-models",
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(metaResult.run.status).toBe("meta_draft_created");
    expect(metaResult.metaDraft).toEqual({
      campaignId: "cmp_1",
      adSetId: "adset_1",
      adId: "ad_1",
      status: "paused_created",
    });
  });
});
