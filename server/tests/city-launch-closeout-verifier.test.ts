// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CITY_LAUNCH_REQUIRED_PROMPT_TO_ARTIFACT_KEYS,
  verifyCityLaunchReadinessCloseout,
} from "../utils/cityLaunchCloseoutVerifier";
import { CITY_LAUNCH_REQUIRED_SURFACE_KEYS } from "../utils/cityLaunchDoctrine";
import type { CityLaunchReadinessPreflightResult } from "../utils/cityLaunchReadinessPreflight";

function checklist(status: CityLaunchReadinessPreflightResult["promptToArtifactChecklist"][number]["status"]) {
  return CITY_LAUNCH_REQUIRED_PROMPT_TO_ARTIFACT_KEYS.map((key) => ({
    key,
    promptRequirement: `Requirement ${key}`,
    status,
    summary: `${key} summary`,
    evidencePaths: key === "city_budget_window" ? [] : [`/tmp/${key}.json`],
    collectionNames: key === "city_budget_window" ? [] : [],
    queryNames: [],
    command: key === "city_budget_window" ? "npm run city-launch:run" : null,
    nextAction: status === "ready" ? null : `Resolve ${key}`,
  }));
}

function readyReport(
  overrides: Partial<CityLaunchReadinessPreflightResult> = {},
): CityLaunchReadinessPreflightResult {
  const promptToArtifactChecklist = checklist("ready");
  return {
    city: "Austin, TX",
    citySlug: "austin-tx",
    generatedAt: "2026-05-06T18:00:00.000Z",
    status: "ready",
    budgetPolicy: {
      tier: "lean",
      label: "Lean",
      maxTotalApprovedUsd: 2_500,
      operatorAutoApproveUsd: 500,
      allowPaidAcquisition: true,
      allowReferralRewards: false,
      allowTravelReimbursement: true,
      founderApprovalRequiredAboveUsd: 2_500,
      founderApprovalTriggers: [],
      operatorLane: "growth-lead",
    },
    founderApproved: true,
    windowHours: 72,
    checks: [],
    promptToArtifactChecklist,
    earliestHardBlocker: null,
    earliestHardBlockerKey: null,
    launchSurfaceCoverage: {
      status: "ready",
      requiredSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
      coveredSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
      missingSurfaces: [],
      evidencePaths: ["/tmp/playbook.md"],
      nextAction: null,
    },
    blockers: [],
    warnings: [],
    requiredInputs: [],
    evidencePaths: {
      completedPlaybookPath: "/tmp/playbook.md",
      activationPayloadPath: "/tmp/activation.json",
      deepResearchBlockerPacketPath: null,
      founderDecisionPacketPath: "/tmp/founder.md",
      gtm72hContractPath: "/tmp/contract.md",
      adStudioCreativeHandoffPath: "/tmp/ad.md",
      metaAdsReadinessPath: "/tmp/meta.md",
      scorecardWindowManifestPath: "/tmp/scorecards.json",
      scorecardPaths: {
        "24h": "/tmp/24.md",
        "48h": "/tmp/48.md",
        "72h": "/tmp/72.md",
      },
    },
    planning: {
      status: "completed",
      latestArtifactPath: "/tmp/playbook.md",
      completedArtifactPath: "/tmp/playbook.md",
      warnings: [],
    },
    outboundReadiness: null,
    replyDurability: null,
    autonomousLoopCloseout: {
      objective: "Verify whether Austin, TX can enter the truthful 72-hour CITY+BUDGET launch loop.",
      claimScope: "city_launch_readiness_preflight",
      stateClaim: "done",
      stageReached: "city_launch_readiness_preflight",
      durableEvidence: ["/tmp/playbook.md", "/tmp/scorecards.json"],
      verification: ["verified closeout"],
      requirementCoverage: promptToArtifactChecklist.map((item) => ({
        key: item.key,
        status: item.status,
        evidencePaths: item.evidencePaths,
        collectionNames: item.collectionNames,
        queryNames: item.queryNames,
      })),
      nextAction: "Run npm run city-launch:run.",
      residualRisk: ["Preflight is not live-send proof."],
      blocked: null,
      awaitingHumanDecision: null,
    },
    ...overrides,
  };
}

function blockedReport() {
  const report = readyReport({
    status: "blocked",
    promptToArtifactChecklist: checklist("blocked"),
    blockers: ["No valid completed Deep Research playbook is available."],
    requiredInputs: ["Deep Research credentials/account access, or a valid existing city playbook."],
    earliestHardBlocker: {
      key: "deep_research_city_plan",
      status: "blocked",
      stageReached: "deep_research_city_plan",
      summary: "No valid completed city playbook is available.",
      evidencePaths: ["/tmp/manifest.json", "/tmp/deep-research-blocker-packet.md"],
      collectionNames: [],
      queryNames: [],
      requiredInputs: ["Deep Research credentials/account access, or a valid existing city playbook."],
      owner: "city-launch-agent",
      retryCondition: "Run npm run city-launch:plan.",
      nextAction: "Run npm run city-launch:plan.",
    },
    earliestHardBlockerKey: "deep_research_city_plan",
    launchSurfaceCoverage: {
      status: "blocked",
      requiredSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
      coveredSurfaces: [],
      missingSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
      evidencePaths: [],
      nextAction: "Run npm run city-launch:plan.",
    },
  });
  report.autonomousLoopCloseout.stateClaim = "blocked";
  report.autonomousLoopCloseout.stageReached = "deep_research_city_plan";
  report.autonomousLoopCloseout.blocked = {
    earliestHardStop: "No valid completed city playbook is available.",
    whyNoReversibleWorkRemains:
      "The readiness branch cannot truthfully advance until the missing city playbook is recorded.",
    nextRequiredInput: ["Deep Research credentials/account access, or a valid existing city playbook."],
    owner: "city-launch-agent",
    retryResumeCondition: "Run npm run city-launch:plan.",
    linkedFollowUp: "/tmp/deep-research-blocker-packet.md",
  };
  return report;
}

describe("city launch closeout verifier", () => {
  it("passes a complete ready closeout", () => {
    const result = verifyCityLaunchReadinessCloseout({
      report: readyReport(),
      reportJsonPath: "/tmp/readiness-preflight.json",
      requireReady: true,
    });

    expect(result.status).toBe("pass");
    expect(result.missingRequirementKeys).toEqual([]);
    expect(result.nonReadyRequirementKeys).toEqual([]);
  });

  it("fails a false done claim with non-ready prompt-to-artifact requirements", () => {
    const report = readyReport({
      promptToArtifactChecklist: checklist("blocked"),
      blockers: ["Still blocked."],
    });

    const result = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
    });

    expect(result.status).toBe("fail");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Done closeout must not include blockers"),
        expect.stringContaining("Done closeout has non-ready requirement key"),
      ]),
    );
  });

  it("passes a truthful blocked closeout unless ready status is required", () => {
    const report = blockedReport();

    const normal = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
    });
    const requireReady = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
      requireReady: true,
    });

    expect(normal.status).toBe("pass");
    expect(normal.earliestHardBlockerKey).toBe("deep_research_city_plan");
    expect(requireReady.status).toBe("fail");
    expect(requireReady.failures).toContainEqual(expect.stringContaining("--require-ready was set"));
  });

  it("fails a Deep Research blocked closeout without a blocker packet path", () => {
    const report = blockedReport();
    report.earliestHardBlocker!.evidencePaths = ["/tmp/manifest.json"];
    report.autonomousLoopCloseout.blocked!.linkedFollowUp = null;

    const result = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
    });

    expect(result.status).toBe("fail");
    expect(result.failures).toContainEqual(
      expect.stringContaining("deep-research-blocker-packet.md"),
    );
  });

  it("fails when the root blocker key and nested blocker disagree", () => {
    const report = blockedReport();
    report.earliestHardBlockerKey = "recipient_backed_direct_outreach";

    const result = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
    });

    expect(result.status).toBe("fail");
    expect(result.failures).toContainEqual(
      expect.stringContaining("Root earliestHardBlockerKey recipient_backed_direct_outreach does not match earliestHardBlocker.key deep_research_city_plan"),
    );
  });

  it("fails when launch surface coverage contradicts the checklist", () => {
    const report = readyReport();
    report.launchSurfaceCoverage.status = "blocked";
    report.launchSurfaceCoverage.missingSurfaces = ["city_thesis_and_wedge"];

    const result = verifyCityLaunchReadinessCloseout({
      report,
      reportJsonPath: "/tmp/readiness-preflight.json",
      requireReady: true,
    });

    expect(result.status).toBe("fail");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("launchSurfaceCoverage.status blocked does not match checklist status ready"),
      ]),
    );
  });
});
