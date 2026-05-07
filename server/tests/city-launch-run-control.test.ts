// @vitest-environment node
import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

const dispatchHumanBlocker = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-blocker-dispatch", () => ({
  dispatchHumanBlocker,
}));

import { buildCityLaunchBudgetPolicy } from "../utils/cityLaunchPolicy";
import type { CityLaunchPlanningState } from "../utils/cityLaunchPlanningState";
import {
  buildCityLaunchDeepResearchBlockerPacket,
  resolveCityLaunchCityInput,
  resolveCityLaunchDeepResearchFailure,
  resolveCityLaunchFounderBudgetMaxUsdInput,
  resolveCityLaunchFounderBudgetTierInput,
  resolveCityLaunchWindowHours,
} from "../utils/cityLaunchRunControl";

const tempDirs: string[] = [];
const execFile = promisify(execFileCallback);

function completedPlanningState(
  overrides: Partial<CityLaunchPlanningState> = {},
): CityLaunchPlanningState {
  return {
    city: "Boise, ID",
    citySlug: "boise-id",
    status: "completed",
    reportsRoot: "/tmp/city-launch-deep-research",
    cityReportsRoot: "/tmp/city-launch-deep-research/boise-id",
    canonicalPlaybookPath: "/tmp/city-launch-boise-id-deep-research.md",
    runDirectory: "/tmp/city-launch-deep-research/boise-id/run-1",
    manifestPath: "/tmp/city-launch-deep-research/boise-id/run-1/manifest.json",
    latestArtifactPath: "/tmp/city-launch-deep-research/boise-id/run-1/99-final-playbook.md",
    completedArtifactPath: "/tmp/city-launch-boise-id-deep-research.md",
    latestRunTimestamp: "run-1",
    warnings: [],
    ...overrides,
  };
}

afterEach(async () => {
  dispatchHumanBlocker.mockReset();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("city launch run control", () => {
  it("rejects placeholder city and budget inputs before a CITY+BUDGET run can start", () => {
    expect(resolveCityLaunchCityInput("Durham, NC")).toBe("Durham, NC");
    expect(resolveCityLaunchFounderBudgetTierInput("lean")).toBe("lean");
    expect(resolveCityLaunchFounderBudgetMaxUsdInput("2500")).toBe(2500);

    expect(() => resolveCityLaunchCityInput("[CITY]")).toThrow(/Replace the placeholder/);
    expect(() => resolveCityLaunchFounderBudgetTierInput("[lean|standard|aggressive]")).toThrow(
      /Use lean, standard, or aggressive/,
    );
    expect(() => resolveCityLaunchFounderBudgetTierInput("zero_budget")).toThrow(
      /Use lean, standard, or aggressive/,
    );
    expect(() => resolveCityLaunchFounderBudgetMaxUsdInput("[NUMBER]")).toThrow(
      /non-negative number/,
    );
    expect(() => resolveCityLaunchFounderBudgetMaxUsdInput("not-a-number")).toThrow(
      /non-negative number/,
    );
  });

  it("requires the explicit city-launch window to match the 72h scorecard contract", () => {
    expect(resolveCityLaunchWindowHours(null)).toBe(72);
    expect(resolveCityLaunchWindowHours("72")).toBe(72);
    expect(resolveCityLaunchWindowHours(72)).toBe(72);
    expect(() => resolveCityLaunchWindowHours("48")).toThrow(
      /supports WINDOW_HOURS=72/,
    );
  });

  it("lets Paperclip-style CITY+BUDGET env vars drive the founder-facing run CLI", async () => {
    const { stdout } = await execFile(
      "npx",
      [
        "tsx",
        "scripts/city-launch/run-city-launch.ts",
        "--phase",
        "approve",
        "--skip-plan",
        "--skip-approval",
        "--skip-readiness-closeout",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CITY: "Boise, ID",
          BUDGET_TIER: "lean",
          BUDGET_MAX_USD: "2500",
          WINDOW_HOURS: "72",
        },
      },
    );
    const initLine = stdout
      .split("\n")
      .find((line) => line.trim().startsWith("{") && line.includes("\"phase\":\"init\""));

    expect(initLine).toBeTruthy();
    expect(JSON.parse(initLine!)).toMatchObject({
      phase: "init",
      city: "Boise, ID",
      budgetTier: "lean",
      budgetMaxUsd: 2500,
      windowHours: 72,
    });
  });

  it("honors the configured Deep Research reports root in the run controller blocked plan closeout", async () => {
    const executionReportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-exec-root-"));
    const deepResearchReportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-deep-root-"));
    tempDirs.push(executionReportsRoot, deepResearchReportsRoot);

    const { stdout } = await execFile(
      "npx",
      [
        "tsx",
        "scripts/city-launch/run-city-launch.ts",
        "--city",
        "Boise, ID",
        "--budget-tier",
        "lean",
        "--budget-max-usd",
        "2500",
        "--window-hours",
        "72",
        "--require-founder-approval",
        "--phase",
        "plan",
        "--reports-root",
        executionReportsRoot,
        "--deep-research-reports-root",
        deepResearchReportsRoot,
        "--human-blocker-delivery-mode",
        "none",
        "--timeout-ms",
        "1",
        "--poll-interval-ms",
        "1",
        "--allow-blocked",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GOOGLE_GENAI_API_KEY: "",
          GEMINI_API_KEY: "",
          BLUEPRINT_CITY_LAUNCH_HUMAN_BLOCKER_DELIVERY_MODE: "none",
        },
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    expect(stdout).toContain(deepResearchReportsRoot);
    expect(stdout).toContain('"earliestHardBlockerKey":"deep_research_city_plan"');
    expect(stdout).toContain('"launchSurfaceCoverage"');
    const cityRoot = path.join(deepResearchReportsRoot, "boise-id");
    const runDirs = await fs.readdir(cityRoot);
    expect(runDirs.length).toBeGreaterThan(0);
    expect(await fs.readFile(path.join(cityRoot, runDirs[0]!, "manifest.json"), "utf8")).toContain(
      '"city": "Boise, ID"',
    );
  });

  it("requires budget tier and max for the standalone Deep Research playbook CLI", async () => {
    let error: unknown = null;
    try {
      await execFile(
        "npx",
        [
          "tsx",
          "scripts/city-launch/run-deep-research-playbook.ts",
          "--city",
          "Boise, ID",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            BUDGET_TIER: "",
            BUDGET_MAX_USD: "",
            WINDOW_HOURS: "72",
          },
          maxBuffer: 1024 * 1024,
        },
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeTruthy();
    expect(String((error as { stderr?: string })?.stderr || "")).toContain(
      "Required: --budget-tier lean|standard|aggressive.",
    );
  });

  it("lets Paperclip-style env vars drive delegated creative and scorecard CLIs", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-delegated-cli-"));
    tempDirs.push(reportsRoot);
    const env = {
      ...process.env,
      CITY: "Boise, ID",
      BUDGET_TIER: "lean",
      BUDGET_MAX_USD: "2500",
      WINDOW_HOURS: "72",
    };

    const creative = await execFile(
      "npx",
      [
        "tsx",
        "scripts/city-launch/write-creative-ad-evidence.ts",
        "--reports-root",
        reportsRoot,
        "--report-timestamp",
        "2026-05-06T22-20-00.000Z",
        "--allow-blocked",
      ],
      {
        cwd: process.cwd(),
        env,
        maxBuffer: 1024 * 1024 * 5,
      },
    );

    expect(creative.stdout).toContain('"city": "Boise, ID"');
    expect(creative.stdout).toContain('"tier": "lean"');
    expect(creative.stdout).toContain('"maxTotalApprovedUsd": 2500');

    const scorecard = await execFile(
      "npx",
      [
        "tsx",
        "scripts/city-launch/write-scorecard-window.ts",
        "--reports-root",
        reportsRoot,
        "--report-timestamp",
        "2026-05-06T22-20-00.000Z",
        "--allow-before-window",
        "--allow-blocked",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...env,
          CHECKPOINT_HOUR: "24",
        },
        maxBuffer: 1024 * 1024 * 5,
      },
    );

    expect(scorecard.stdout).toContain('"city": "Boise, ID"');
    expect(scorecard.stdout).toContain('"checkpointHour": 24');
  });

  it("reuses a valid completed playbook when Deep Research cannot run", async () => {
    const budgetPolicy = buildCityLaunchBudgetPolicy({
      tier: "lean",
      maxTotalApprovedUsd: 2_500,
    });

    const result = await resolveCityLaunchDeepResearchFailure({
      city: "Boise, ID",
      budgetPolicy,
      planningState: completedPlanningState(),
      error: new Error("Gemini Interactions API account quota unavailable."),
      reportsRoot: "/tmp/city-launch-execution",
    });

    expect(result.status).toBe("reuse_existing_playbook");
    expect(result.completedPlaybookPath).toBe("/tmp/city-launch-boise-id-deep-research.md");
    expect(result.blockerPacketPath).toBeNull();
    expect(result.requiredInputs).toEqual([]);
  });

  it("writes a blocker packet with concrete Deep Research inputs when no valid playbook exists", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-run-control-"));
    tempDirs.push(reportsRoot);
    const budgetPolicy = buildCityLaunchBudgetPolicy({
      tier: "standard",
      maxTotalApprovedUsd: 7_500,
    });

    const result = await resolveCityLaunchDeepResearchFailure({
      city: "Boise, ID",
      budgetPolicy,
      planningState: completedPlanningState({
        status: "not_started",
        completedArtifactPath: null,
        latestArtifactPath: null,
        manifestPath: null,
        warnings: ["No city-launch planning artifacts were found for this city."],
      }),
      error: new Error("Gemini Interactions API requires GOOGLE_GENAI_API_KEY or GEMINI_API_KEY to be configured."),
      reportsRoot,
    });

    expect(result.status).toBe("blocked");
    expect(result.blockerId).toBe("city-launch-deep-research-boise-id");
    expect(result.blockerPacketPath).toContain("deep-research-blocker-packet.md");
    expect(result.requiredInputs).toContain("GOOGLE_GENAI_API_KEY or GEMINI_API_KEY");
    expect(result.requiredInputs).toContain("A valid completed city playbook for Boise, ID");

    const packet = await fs.readFile(result.blockerPacketPath!, "utf8");
    expect(packet).toContain("city-launch-deep-research-boise-id");
    expect(packet).toContain("GOOGLE_GENAI_API_KEY or GEMINI_API_KEY");
    expect(packet).toContain("A valid completed city playbook for Boise, ID");
    expect(packet).toContain("Gemini Interactions API requires GOOGLE_GENAI_API_KEY or GEMINI_API_KEY");
  });

  it("can queue a no-send review-required human blocker draft for Deep Research failures", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-run-control-"));
    tempDirs.push(reportsRoot);
    dispatchHumanBlocker.mockResolvedValue({
      blocker_id: "city-launch-deep-research-boise-id",
      dispatch_id: "dispatch-1",
      delivery_mode: "review_required",
      delivery_status: "awaiting_review",
      email_sent: false,
      slack_sent: false,
      thread: {
        id: "city-launch-deep-research-boise-id",
      },
    });
    const budgetPolicy = buildCityLaunchBudgetPolicy({
      tier: "lean",
      maxTotalApprovedUsd: 2_500,
    });

    const result = await resolveCityLaunchDeepResearchFailure({
      city: "Boise, ID",
      budgetPolicy,
      planningState: completedPlanningState({
        status: "not_started",
        completedArtifactPath: null,
      }),
      error: new Error("Gemini Interactions API requires GOOGLE_GENAI_API_KEY or GEMINI_API_KEY to be configured."),
      reportsRoot,
      humanBlockerDeliveryMode: "review_required",
    });

    expect(result.status).toBe("blocked");
    expect(result.humanBlockerDispatch).toMatchObject({
      queued: true,
      blockerId: "city-launch-deep-research-boise-id",
      dispatchId: "dispatch-1",
      deliveryMode: "review_required",
      deliveryStatus: "awaiting_review",
      emailSent: false,
      slackSent: false,
      threadId: "city-launch-deep-research-boise-id",
      error: null,
    });
    expect(dispatchHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "review_required",
        blocker_kind: "ops_commercial",
        routing_owner: "blueprint-chief-of-staff",
        execution_owner: "city-launch-agent",
        sender_owner: "city-launch-agent",
        mirror_to_slack: false,
        packet: expect.objectContaining({
          blockerId: "city-launch-deep-research-boise-id",
          resumeAction: expect.objectContaining({
            kind: "city_launch_plan",
          }),
        }),
        report_paths: expect.arrayContaining([
          expect.stringContaining("deep-research-blocker-packet.md"),
        ]),
      }),
    );
  });

  it("builds a standard blocker packet for Deep Research account failures", () => {
    const packet = buildCityLaunchDeepResearchBlockerPacket({
      city: "Boise, ID",
      budgetPolicy: buildCityLaunchBudgetPolicy({ tier: "lean", maxTotalApprovedUsd: 2_500 }),
      errorMessage: "Gemini Interactions API billing/quota unavailable.",
      requiredInputs: [
        "GOOGLE_GENAI_API_KEY or GEMINI_API_KEY",
        "A valid completed city playbook for Boise, ID",
      ],
      evidencePaths: ["/tmp/city-launch-deep-research/boise-id/manifest.json"],
    });

    expect(packet.blockerId).toBe("city-launch-deep-research-boise-id");
    expect(packet.executionOwner).toBe("city-launch-agent");
    expect(packet.exactResponseNeeded).toContain("provide Deep Research access");
    expect(packet.evidence.join("\n")).toContain("Gemini Interactions API billing/quota unavailable.");
    expect(packet.resumeAction?.kind).toBe("city_launch_plan");
    expect(packet.resumeAction?.metadata?.windowHours).toBe(72);
    expect(packet.immediateNextAction).toContain("--window-hours 72");
  });
});
