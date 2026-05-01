// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaAdsCliExecutor } from "../utils/meta-ads-cli";

const provenanceDocs = new Map<string, Record<string, unknown>>();
let autoIdCounter = 0;

function resetState() {
  provenanceDocs.clear();
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
      if (name !== "meta_ads_cli_runs") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id?: string) {
          const docId = id || `meta-cli-${++autoIdCounter}`;
          return {
            id: docId,
            async get() {
              return {
                exists: provenanceDocs.has(docId),
                data: () => provenanceDocs.get(docId),
              };
            },
            async set(payload: Record<string, unknown>) {
              provenanceDocs.set(docId, payload);
            },
          };
        },
      };
    },
  },
}));

beforeEach(() => {
  resetState();
  vi.stubEnv("META_ADS_CLI_ENABLED", "1");
  vi.stubEnv("META_ADS_ACCESS_TOKEN", "secret-token");
  vi.stubEnv("META_ADS_AD_ACCOUNT_ID", "act_123");
  vi.stubEnv("META_ADS_BUSINESS_ID", "biz_1");
  vi.stubEnv("META_ADS_MAX_DAILY_BUDGET_USD", "100");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("meta ads cli adapter", () => {
  it("runs only allowlisted read commands and records sanitized provenance", async () => {
    const executor = vi.fn<MetaAdsCliExecutor>().mockResolvedValue({
      stdout: JSON.stringify({ data: [{ id: "cmp_1" }] }),
      stderr: "",
      exitCode: 0,
      signal: null,
    });

    const { listMetaAdsCampaigns } = await import("../utils/meta-ads-cli");
    const result = await listMetaAdsCampaigns({ limit: 5, city: "Atlanta" }, executor);

    expect(executor).toHaveBeenCalledWith(
      "meta",
      ["--output", "json", "--no-input", "ads", "campaign", "list", "--limit", "5"],
      expect.objectContaining({
        env: expect.objectContaining({
          ACCESS_TOKEN: "secret-token",
          AD_ACCOUNT_ID: "123",
        }),
      }),
    );
    expect(result.output).toEqual({ data: [{ id: "cmp_1" }] });
    expect(result.provenance.action).toBe("campaign_list");
    expect(result.provenance.mode).toBe("read_only");
    expect(result.provenance.sanitizedCommand).not.toContain("secret-token");
    expect([...provenanceDocs.values()][0]).toMatchObject({
      action: "campaign_list",
      city: "Atlanta",
      accountId: "123",
    });
  });

  it("creates a complete paused draft through official CLI commands with per-command provenance", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "meta-ads-cli-"));
    const mediaPath = join(tempDir, "frame.jpg");
    writeFileSync(mediaPath, "fake image bytes");

    const executor = vi.fn<MetaAdsCliExecutor>().mockImplementation(async (_command, args) => {
      const joined = args.join(" ");
      if (joined.includes(" campaign create ")) {
        return { stdout: JSON.stringify({ id: "cmp_1" }), stderr: "", exitCode: 0, signal: null };
      }
      if (joined.includes(" adset create ")) {
        return { stdout: JSON.stringify({ id: "adset_1" }), stderr: "", exitCode: 0, signal: null };
      }
      if (joined.includes(" creative create ")) {
        return { stdout: JSON.stringify({ id: "creative_1" }), stderr: "", exitCode: 0, signal: null };
      }
      if (joined.includes(" ad create ")) {
        return { stdout: JSON.stringify({ id: "ad_1" }), stderr: "", exitCode: 0, signal: null };
      }
      throw new Error(`Unexpected args ${joined}`);
    });

    try {
      const { createPausedMetaAdsCliDraft } = await import("../utils/meta-ads-cli");
      const result = await createPausedMetaAdsCliDraft(
        {
          campaignName: "Blueprint Atlanta Draft",
          objective: "OUTCOME_TRAFFIC",
          dailyBudgetMinorUnits: 5000,
          primaryText: "Illustrative concept ad. Real proof remains evidence-gated.",
          headline: "Capture public indoor spaces",
          destinationUrl: "https://tryblueprint.io/capture",
          pageId: "page_1",
          mediaPath,
          mediaType: "image",
          city: "Atlanta",
          launchId: "atlanta_launch",
          adStudioRunId: "run_1",
          ledgerLink: "cityLaunchTouches/touch_1",
        },
        executor,
      );

      expect(result).toMatchObject({
        accountId: "123",
        campaignId: "cmp_1",
        adSetId: "adset_1",
        creativeId: "creative_1",
        adId: "ad_1",
        status: "PAUSED",
      });
      expect(result.provenanceIds).toHaveLength(4);
      expect(executor).toHaveBeenCalledTimes(4);
      const flattenedArgs = executor.mock.calls.flatMap((call) => call[1]);
      expect(flattenedArgs).toContain("paused");
      expect(flattenedArgs).not.toContain("active");
      expect([...provenanceDocs.values()]).toHaveLength(4);
      expect([...provenanceDocs.values()].map((doc) => doc.status)).toEqual([
        "PAUSED",
        "PAUSED",
        "PAUSED",
        "PAUSED",
      ]);
      expect([...provenanceDocs.values()]).toEqual([
        expect.objectContaining({ action: "campaign_create_paused", campaignId: "cmp_1" }),
        expect.objectContaining({ action: "adset_create_paused", campaignId: "cmp_1", adSetId: "adset_1" }),
        expect.objectContaining({ action: "creative_create", campaignId: "cmp_1", adSetId: "adset_1", creativeId: "creative_1" }),
        expect.objectContaining({ action: "ad_create_paused", campaignId: "cmp_1", adSetId: "adset_1", creativeId: "creative_1", adId: "ad_1" }),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("blocks paused drafts above the configured budget ceiling before running the CLI", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "meta-ads-cli-"));
    const mediaPath = join(tempDir, "frame.jpg");
    writeFileSync(mediaPath, "fake image bytes");
    const executor = vi.fn<MetaAdsCliExecutor>();

    try {
      const { createPausedMetaAdsCliDraft } = await import("../utils/meta-ads-cli");
      await expect(
        createPausedMetaAdsCliDraft(
          {
            campaignName: "Budget blocked",
            objective: "OUTCOME_TRAFFIC",
            dailyBudgetMinorUnits: 100_001,
            primaryText: "Illustrative concept ad.",
            headline: "Capture public indoor spaces",
            destinationUrl: "https://tryblueprint.io/capture",
            pageId: "page_1",
            mediaPath,
            mediaType: "image",
          },
          executor,
        ),
      ).rejects.toThrow("exceeds the configured policy ceiling");
      expect(executor).not.toHaveBeenCalled();
      expect(provenanceDocs.size).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
