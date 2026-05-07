// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CityLaunchScorecard } from "../utils/cityLaunchScorecard";
import {
  resolveCityLaunchScorecardCheckpointHour,
  writeCityLaunchScorecardWindowCloseout,
} from "../utils/cityLaunchScorecardWindow";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

function metric(key: string) {
  return {
    key,
    label: key,
    actual: 1,
    targetMin: 1,
    targetMax: null,
    tracked: true,
    status: "on_track" as const,
    note: null,
  };
}

function scorecard(): CityLaunchScorecard {
  return {
    city: {
      key: "austin-tx",
      label: "Austin, TX",
    },
    generatedAt: "2026-05-06T12:00:00.000Z",
    supply: [metric("approved_capturers")],
    cityOpening: [metric("city_opening_actions_sent")],
    demand: [metric("hosted_reviews_started")],
    budget: {
      tier: "lean",
      totalRecordedSpendUsd: 100,
      withinPolicySpendUsd: 100,
      outsidePolicySpendUsd: 0,
    },
    activation: {
      founderApproved: true,
      status: "activation_ready",
      wideningAllowed: false,
      wideningReasons: ["single-city proof motion still required"],
      rootIssueId: "BLU-1",
      cityThesis: "Austin proof thesis",
      primarySiteLane: "warehouse",
      primaryWorkflowLane: "dock handoff",
      primaryBuyerProofPath: "exact_site",
      lawfulAccessModes: ["site_operator_intro"],
      validationBlockers: [],
      metricsDependencies: [],
      executionStates: {
        proofAsset: "ready",
        proofPack: "delivered",
        hostedReview: "started",
        commercialHandoff: "missing",
        analyticsSource: "first_party_only",
      },
      sourceActivationPayloadPath: "/tmp/austin-playbook.md",
    },
    warnings: [],
    dataSources: ["growth_events", "cityLaunchSendActions"],
    queryLimits: {
      waitlistSubmissions: 1500,
      users: 2000,
      inboundRequests: 1500,
      growthEvents: 4000,
    },
  };
}

describe("city launch scorecard window closeout", () => {
  it("validates checkpoint hours", () => {
    expect(resolveCityLaunchScorecardCheckpointHour("24")).toBe(24);
    expect(resolveCityLaunchScorecardCheckpointHour(48)).toBe(48);
    expect(() => resolveCityLaunchScorecardCheckpointHour("12")).toThrow(/24\|48\|72/);
  });

  it("writes JSON and markdown checkpoint evidence from the first-party scorecard", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-scorecard-window-"));
    tempDirs.push(root);
    const manifestPath = path.join(root, "scorecard-windows.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        scorecard_windows: [
          {
            checkpoint_hour: 24,
            window_start_iso: "2026-05-01T00:00:00.000Z",
            window_end_iso: "2026-05-02T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );
    const collectScorecard = vi.fn().mockResolvedValue(scorecard());

    const closeout = await writeCityLaunchScorecardWindowCloseout({
      city: "Austin, TX",
      checkpointHour: 24,
      reportsRoot: path.join(root, "reports"),
      timestamp: "2026-05-06T12-00-00.000Z",
      nowIso: "2026-05-06T12:00:00.000Z",
      scorecardManifestPath: manifestPath,
      deps: {
        collectScorecard,
      },
    });

    expect(closeout.status).toBe("complete");
    expect(closeout.blockers).toEqual([]);
    expect(collectScorecard).toHaveBeenCalledWith("Austin, TX", {
      queryLimits: {
        waitlistSubmissions: 1500,
        users: 2000,
        inboundRequests: 1500,
        growthEvents: 4000,
      },
    });

    const json = JSON.parse(await fs.readFile(closeout.artifacts.jsonPath, "utf8")) as {
      status: string;
      evidenceSources: Array<{ collection: string; query_name: string }>;
      queryDiagnostics: Array<{ collection: string; status: string }>;
      queryLimits: { growthEvents: number };
    };
    const markdown = await fs.readFile(closeout.artifacts.markdownPath, "utf8");

    expect(json.status).toBe("complete");
    expect(json.queryLimits.growthEvents).toBe(4000);
    expect(json.evidenceSources.map((source) => source.collection)).toContain("cityLaunchSendActions");
    expect(json.queryDiagnostics.map((diagnostic) => diagnostic.status)).toContain(
      "covered_by_scorecard_query",
    );
    expect(markdown).toContain("Austin, TX 24h City Launch Scorecard Closeout");
    expect(markdown).toContain("city_launch_send_actions_by_city");
    expect(markdown).toContain("## Query Diagnostics");
    expect(markdown).toContain("hosted_reviews_started");
  });

  it("writes a blocked closeout when first-party scorecard evidence cannot be queried", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-scorecard-window-"));
    tempDirs.push(root);

    const closeout = await writeCityLaunchScorecardWindowCloseout({
      city: "Boise, ID",
      checkpointHour: 24,
      reportsRoot: path.join(root, "reports"),
      timestamp: "2026-05-06T12-00-00.000Z",
      runQueryDiagnostics: true,
      deps: {
        collectScorecard: vi.fn().mockRejectedValue(new Error("Database not available")),
        runQueryDiagnostics: vi.fn().mockResolvedValue([
          {
            collection: "growth_events",
            queryName: "city_launch_growth_events_recent",
            expectedQuery: 'collection("growth_events").orderBy("created_at", "desc").limit(4000)',
            diagnosticQuery: 'collection("growth_events").limit(1)',
            status: "blocked",
            error: "Database not available",
          },
        ]),
      },
    });

    expect(closeout.status).toBe("blocked");
    expect(closeout.blockers.join("\n")).toContain("Database not available");
    expect(closeout.blockers.join("\n")).toContain("No scorecard window manifest entry");
    expect(closeout.queryDiagnostics[0]).toMatchObject({
      collection: "growth_events",
      status: "blocked",
      error: "Database not available",
    });
    expect(await fs.readFile(closeout.artifacts.markdownPath, "utf8")).toContain(
      "first-party scorecard query failed",
    );
  });
});
