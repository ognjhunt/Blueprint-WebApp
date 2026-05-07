// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdStudioRunRecord } from "../utils/ad-studio";
import {
  buildCityLaunchCreativeAdsEvidence,
  writeCityLaunchCreativeAdsEvidence,
  type CityLaunchCreativeAdsEvidenceDeps,
} from "../utils/cityLaunchCreativeAdsEvidence";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

function metaStatus(overrides: Partial<ReturnType<CityLaunchCreativeAdsEvidenceDeps["getMetaStatus"]>> = {}) {
  return {
    enabled: false,
    binary: "meta",
    accessTokenConfigured: false,
    adAccountConfigured: false,
    businessIdConfigured: false,
    accountId: null,
    maxDailyBudgetUsd: 250,
    timeoutMs: 120_000,
    provenanceCollection: "meta_ads_cli_runs",
    allowedActions: [
      "adaccount list",
      "page list",
      "campaign list",
      "insights get",
      "dataset list",
      "catalog list",
      "campaign/adset/creative/ad create with paused status only",
    ],
    ...overrides,
  };
}

function draftSafeRun(overrides: Partial<AdStudioRunRecord> = {}): AdStudioRunRecord {
  return {
    id: "ad-studio-run-1",
    lane: "buyer",
    audience: "robotics deployment leads",
    cta: "Request an exact-site hosted review",
    budgetCapUsd: 500,
    city: "Austin, TX",
    aspectRatio: "16:9",
    status: "draft_safe",
    claimsLedger: {
      allowedClaims: ["Illustrative marketing scenes allowed"],
      blockedClaims: ["No fabricated site proof"],
      evidenceLinks: [],
      reviewDecision: "approved",
      reviewNotes: [],
    },
    brief: {
      lane: "buyer",
      visualDirection: "Synthetic hosted-review concept.",
      copyHooks: ["Review the exact site before your robot shows up."],
      claimsLedger: {
        allowedClaims: ["Illustrative marketing scenes allowed"],
        blockedClaims: ["No fabricated site proof"],
        evidenceLinks: [],
        reviewDecision: "approved",
        reviewNotes: [],
      },
    },
    promptPack: {
      imagePromptVariants: ["Synthetic public indoor hosted-review concept."],
      videoPrompt: "Animate the approved first frame.",
      headlineOptions: ["Hosted review for one deployment question"],
      primaryTextOptions: [
        "Illustrative concept ad. Real proof remains evidence-gated.",
      ],
    },
    assets: [
      {
        type: "image",
        role: "first_frame",
        uri: "https://cdn.example.test/frame.png",
        provider: "codex_gpt_image_2",
        createdAtIso: "2026-05-06T12:00:00.000Z",
      },
    ],
    imageExecutionHandoff: {
      issueId: "issue-1",
      status: "todo",
      assignee: "webapp-codex",
      error: null,
    },
    videoTask: {
      taskId: "video-task-1",
      status: "SUCCEEDED",
      provider: "higgsfield",
      model: "seedance-2.0",
      firstFrameUrl: "https://cdn.example.test/frame.png",
      firstFrameProvenance: "https://cdn.example.test/frame.png",
      ratio: "16:9",
      promptText: "Animate the approved first frame.",
      outputUris: ["https://cdn.example.test/video.mp4"],
      providerAuthStatus: "agent_authenticated",
      humanReviewStatus: "approved",
    },
    review: {
      status: "draft_safe",
      reasons: [],
      headline: "Hosted review for one deployment question",
      primaryText: "Illustrative concept ad. Real proof remains evidence-gated.",
    },
    metaDraft: {
      campaignId: null,
      adSetId: null,
      adId: null,
      status: "not_created",
    },
    createdAtIso: "2026-05-06T12:00:00.000Z",
    updatedAtIso: "2026-05-06T12:00:00.000Z",
    ...overrides,
  };
}

describe("city launch creative/ad evidence", () => {
  it("writes a blocked packet when Ad Studio and Meta provider proof are missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-creative-ads-"));
    tempDirs.push(root);

    const evidence = await writeCityLaunchCreativeAdsEvidence({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2500,
      windowHours: 72,
      reportsRoot: root,
      timestamp: "2026-05-06T12-00-00.000Z",
      deps: {
        readAdStudioRunForCity: vi.fn().mockResolvedValue(null),
        getMetaStatus: vi.fn(() => metaStatus()),
        runMetaReadOnlyProof: vi.fn(),
        createPausedDraft: vi.fn(),
      },
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.adStudio.status).toBe("not_found");
    expect(evidence.metaAds.missingEnv).toEqual([
      "META_ADS_CLI_ENABLED=1",
      "META_ADS_ACCESS_TOKEN or META_MARKETING_API_ACCESS_TOKEN",
      "META_ADS_AD_ACCOUNT_ID or META_AD_ACCOUNT_ID",
    ]);
    expect(evidence.blockers.join("\n")).toContain("No Ad Studio run");
    expect(evidence.blockers.join("\n")).toContain("Meta Ads CLI read-only proof is provider-gated");
    expect(await fs.readFile(evidence.artifacts.markdownPath, "utf8")).toContain(
      "Generated creative is marketing material, not captured site truth.",
    );
  });

  it("keeps paused draft creation human-gated unless founder approval is recorded", async () => {
    const readOnly = vi.fn().mockResolvedValue({
      status: "ready",
      provenanceIds: ["meta-cli-1"],
      actions: ["campaign_list"],
      blocker: null,
    });
    const createPausedDraft = vi.fn();

    const evidence = await buildCityLaunchCreativeAdsEvidence({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2500,
      windowHours: 72,
      runMetaReadOnly: true,
      deps: {
        readAdStudioRunForCity: vi.fn().mockResolvedValue(draftSafeRun()),
        getMetaStatus: vi.fn(() =>
          metaStatus({
            enabled: true,
            accessTokenConfigured: true,
            adAccountConfigured: true,
            accountId: "act_123",
          }),
        ),
        runMetaReadOnlyProof: readOnly,
        createPausedDraft,
      },
    });

    expect(evidence.adStudio.status).toBe("ready");
    expect(evidence.metaAds.readOnlyProof.status).toBe("ready");
    expect(evidence.metaAds.pausedDraft.status).toBe("human_gated");
    expect(evidence.status).toBe("blocked");
    expect(createPausedDraft).not.toHaveBeenCalled();
  });

  it("blocks required video handoff when provider, output, and review-gate evidence are missing", async () => {
    const run = draftSafeRun({
      videoTask: {
        taskId: "video-task-1",
        status: "PENDING",
        firstFrameUrl: "https://cdn.example.test/frame.png",
        ratio: "16:9",
        promptText: "Animate the approved first frame.",
      },
    });

    const evidence = await buildCityLaunchCreativeAdsEvidence({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2500,
      windowHours: 72,
      requireVideoHandoff: true,
      deps: {
        readAdStudioRunForCity: vi.fn().mockResolvedValue(run),
        getMetaStatus: vi.fn(() => metaStatus()),
        runMetaReadOnlyProof: vi.fn(),
        createPausedDraft: vi.fn(),
      },
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.adStudio.videoHandoffReady).toBe(false);
    expect(evidence.adStudio.blocker).toContain("provider is missing");
    expect(evidence.adStudio.blocker).toContain("output URI is missing");
    expect(evidence.adStudio.blocker).toContain("human review gate is not approved");
  });

  it("marks the lane ready when draft-safe creative, read-only proof, and paused draft provenance exist", async () => {
    const createPausedDraft = vi.fn().mockResolvedValue({
      status: "ready",
      provider: "ads_cli",
      campaignId: "cmp_1",
      adSetId: "adset_1",
      creativeId: "creative_1",
      adId: "ad_1",
      provenanceIds: ["meta-cli-2", "meta-cli-3", "meta-cli-4", "meta-cli-5"],
      ledgerLink: "cityLaunchTouches/ad_studio_meta_ads_cli_ad-studio-run-1",
      blocker: null,
    });

    const evidence = await buildCityLaunchCreativeAdsEvidence({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2500,
      windowHours: 72,
      runMetaReadOnly: true,
      founderApprovedPausedDraft: true,
      mediaPath: "/tmp/frame.jpg",
      mediaType: "image",
      destinationUrl: "https://tryblueprint.io/world-models",
      deps: {
        readAdStudioRunForCity: vi.fn().mockResolvedValue(draftSafeRun()),
        getMetaStatus: vi.fn(() =>
          metaStatus({
            enabled: true,
            accessTokenConfigured: true,
            adAccountConfigured: true,
            accountId: "act_123",
          }),
        ),
        runMetaReadOnlyProof: vi.fn().mockResolvedValue({
          status: "ready",
          provenanceIds: ["meta-cli-1"],
          actions: ["campaign_list"],
          blocker: null,
        }),
        createPausedDraft,
      },
    });

    expect(evidence.status).toBe("ready");
    expect(evidence.blockers).toEqual([]);
    expect(evidence.metaAds.pausedDraft).toMatchObject({
      status: "ready",
      campaignId: "cmp_1",
      adId: "ad_1",
    });
    expect(createPausedDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "ad-studio-run-1",
        destinationUrl: "https://tryblueprint.io/world-models",
        mediaPath: "/tmp/frame.jpg",
        dailyBudgetMinorUnits: 5000,
      }),
    );
  });
});
