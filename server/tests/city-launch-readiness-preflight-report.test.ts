// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CityLaunchReadinessPreflightResult } from "../utils/cityLaunchReadinessPreflight";
import {
  renderCityLaunchReadinessPreflightMarkdown,
  writeCityLaunchReadinessPreflightCloseoutVerification,
  writeCityLaunchReadinessPreflightReport,
} from "../utils/cityLaunchReadinessPreflightReport";
import type { CityLaunchCloseoutVerification } from "../utils/cityLaunchCloseoutVerifier";
import { CITY_LAUNCH_REQUIRED_SURFACE_KEYS } from "../utils/cityLaunchDoctrine";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

function preflightResult(): CityLaunchReadinessPreflightResult {
  return {
    city: "Austin, TX",
    citySlug: "austin-tx",
    generatedAt: "2026-05-06T18:00:00.000Z",
    status: "blocked",
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
    founderApproved: false,
    windowHours: 72,
    checks: [
      {
        key: "deep_research_playbook",
        status: "blocked",
        summary: "No valid completed city playbook is available.",
      },
    ],
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
      evidencePaths: ["/tmp/manifest.json"],
      nextAction: "Run npm run city-launch:plan.",
    },
    promptToArtifactChecklist: [
      {
        key: "deep_research_city_plan",
        promptRequirement: "Run Deep Research or stop with a blocker packet.",
        status: "blocked",
        summary: "No valid completed city playbook is available.",
        evidencePaths: ["/tmp/manifest.json"],
        collectionNames: [],
        queryNames: [],
        nextAction: "Run npm run city-launch:plan.",
      },
    ],
    blockers: ["No valid completed Deep Research playbook is available."],
    warnings: [],
    requiredInputs: ["Deep Research credentials/account access, or a valid existing city playbook."],
    evidencePaths: {
      completedPlaybookPath: null,
      activationPayloadPath: null,
      deepResearchBlockerPacketPath: "/tmp/deep-research-blocker-packet.md",
      founderDecisionPacketPath: null,
      gtm72hContractPath: "/tmp/contract.md",
      adStudioCreativeHandoffPath: "/tmp/ad-studio.md",
      metaAdsReadinessPath: "/tmp/meta.md",
      scorecardWindowManifestPath: "/tmp/scorecards.json",
      scorecardPaths: {
        "24h": "/tmp/24.md",
        "48h": "/tmp/48.md",
        "72h": "/tmp/72.md",
      },
    },
    planning: {
      status: "not_started",
      latestArtifactPath: null,
      completedArtifactPath: null,
      warnings: [],
    },
    outboundReadiness: null,
    replyDurability: null,
    autonomousLoopCloseout: {
      objective:
        "Verify whether Austin, TX can enter the truthful 72-hour CITY+BUDGET launch loop at lean budget tier without inventing contacts, proof, sends, readiness, or spend.",
      claimScope: "city_launch_readiness_preflight",
      stateClaim: "blocked",
      stageReached: "deep_research_city_plan",
      durableEvidence: ["/tmp/manifest.json", "/tmp/deep-research-blocker-packet.md"],
      verification: [
        "runCityLaunchReadinessPreflight evaluated planning state, activation state, recipient-backed send actions, reply durability, required lane artifacts, and the prompt-to-artifact checklist.",
      ],
      requirementCoverage: [
        {
          key: "deep_research_city_plan",
          status: "blocked",
          evidencePaths: ["/tmp/manifest.json", "/tmp/deep-research-blocker-packet.md"],
          collectionNames: [],
          queryNames: [],
        },
      ],
      nextAction: "Run npm run city-launch:plan.",
      residualRisk: [
        "This closeout is scoped to readiness preflight; it is not proof that live sends, live spend, buyer responses, capture outcomes, or 24/48/72h scorecard windows have happened.",
      ],
      blocked: {
        earliestHardStop: "No valid completed city playbook is available.",
        whyNoReversibleWorkRemains:
          "The readiness branch cannot truthfully advance to the next city-launch stage until the earliest missing evidence or provider/account input is recorded.",
        nextRequiredInput: ["Deep Research credentials/account access, or a valid existing city playbook."],
        owner: "city-launch-agent",
        retryResumeCondition: "Run npm run city-launch:plan.",
        linkedFollowUp: "/tmp/deep-research-blocker-packet.md",
      },
      awaitingHumanDecision: null,
    },
  };
}

describe("city launch readiness preflight reports", () => {
  it("writes durable JSON and markdown artifacts with the prompt-to-artifact checklist", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-preflight-"));
    tempDirs.push(reportsRoot);

    const artifacts = await writeCityLaunchReadinessPreflightReport({
      result: preflightResult(),
      reportsRoot,
      timestamp: "2026-05-06T18-00-00.000Z",
    });

    expect(artifacts.runDirectory).toBe(
      path.join(reportsRoot, "austin-tx", "preflight", "2026-05-06T18-00-00.000Z"),
    );
    expect(artifacts.jsonPath).toBe(path.join(artifacts.runDirectory, "readiness-preflight.json"));
    expect(artifacts.markdownPath).toBe(path.join(artifacts.runDirectory, "readiness-preflight.md"));

    const json = JSON.parse(await fs.readFile(artifacts.jsonPath, "utf8")) as {
      earliestHardBlocker: { key: string };
      earliestHardBlockerKey: string;
      launchSurfaceCoverage: { status: string; missingSurfaces: string[] };
      autonomousLoopCloseout: { stateClaim: string; blocked: { owner: string } | null };
      promptToArtifactChecklist: Array<{ key: string }>;
      reportArtifacts: { markdownPath: string };
    };
    const markdown = await fs.readFile(artifacts.markdownPath, "utf8");

    expect(json.earliestHardBlocker.key).toBe("deep_research_city_plan");
    expect(json.earliestHardBlockerKey).toBe("deep_research_city_plan");
    expect(json.launchSurfaceCoverage.status).toBe("blocked");
    expect(json.launchSurfaceCoverage.missingSurfaces).toContain("city_thesis_and_wedge");
    expect(json.autonomousLoopCloseout.stateClaim).toBe("blocked");
    expect(json.autonomousLoopCloseout.blocked?.owner).toBe("city-launch-agent");
    expect(json.promptToArtifactChecklist[0]?.key).toBe("deep_research_city_plan");
    expect(json.reportArtifacts.markdownPath).toBe(artifacts.markdownPath);
    expect(markdown).toContain("## Autonomous Loop Closeout");
    expect(markdown).toContain("state_claim: blocked");
    expect(markdown).toContain("why_no_reversible_work_remains:");
    expect(markdown).toContain("linked_follow_up: /tmp/deep-research-blocker-packet.md");
    expect(markdown).toContain("## Earliest Hard Blocker");
    expect(markdown).toContain("## Launch Surface Coverage");
    expect(markdown).toContain("- earliest_hard_blocker_key: deep_research_city_plan");
    expect(markdown).toContain("- missing_count:");
    expect(markdown).toContain("## Prompt-To-Artifact Checklist");
    expect(markdown).toContain("Run Deep Research or stop with a blocker packet.");
    expect(markdown).toContain("No valid completed Deep Research playbook is available.");
  });

  it("persists closeout verification into the JSON and markdown report artifacts", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-preflight-"));
    tempDirs.push(reportsRoot);
    const result = preflightResult();
    const artifacts = await writeCityLaunchReadinessPreflightReport({
      result,
      reportsRoot,
      timestamp: "2026-05-06T18-10-00.000Z",
    });
    const closeoutVerification: CityLaunchCloseoutVerification = {
      schemaVersion: "2026-05-06.city-launch-closeout-verifier.v1",
      status: "pass",
      reportJsonPath: artifacts.jsonPath,
      city: "Austin, TX",
      citySlug: "austin-tx",
      stateClaim: "blocked",
      readinessStatus: "blocked",
      requireReady: false,
      failures: [],
      warnings: [],
      coveredRequirementKeys: ["deep_research_city_plan"],
      missingRequirementKeys: [],
      nonReadyRequirementKeys: ["deep_research_city_plan"],
      earliestHardBlockerKey: "deep_research_city_plan",
    };

    await writeCityLaunchReadinessPreflightCloseoutVerification({
      reportArtifacts: artifacts,
      result,
      closeoutVerification,
    });

    const json = JSON.parse(await fs.readFile(artifacts.jsonPath, "utf8")) as {
      closeoutVerification: { status: string; earliestHardBlockerKey: string };
    };
    const markdown = await fs.readFile(artifacts.markdownPath, "utf8");

    expect(json.closeoutVerification.status).toBe("pass");
    expect(json.closeoutVerification.earliestHardBlockerKey).toBe("deep_research_city_plan");
    expect(markdown).toContain("## Closeout Verification");
    expect(markdown).toContain("- status: pass");
    expect(markdown).toContain("earliest_hard_blocker_key: deep_research_city_plan");
  });

  it("renders all awaiting-human-decision proof fields required by the closeout checklist", () => {
    const result = preflightResult();
    result.status = "awaiting_human_decision";
    result.autonomousLoopCloseout.stateClaim = "awaiting_human_decision";
    result.autonomousLoopCloseout.blocked = null;
    result.autonomousLoopCloseout.awaitingHumanDecision = {
      gateCategory: "founder_decision_packet",
      decisionRequested: "Approve city posture and budget.",
      recommendation: "Approve only after the named city posture and budget envelope are acceptable.",
      evidencePacket: "/tmp/founder-decision-packet.md",
      blockerId: "city-launch-approval-austin-tx",
      routingSurface: "founder inbox",
      watcherOwner: "founder",
      resumeCondition: "Record APPROVE on the blocker thread.",
      deadline: "Immediate",
    };

    const markdown = renderCityLaunchReadinessPreflightMarkdown({ result });

    expect(markdown).toContain("- awaiting_human_decision:");
    expect(markdown).toContain("recommendation: Approve only after");
    expect(markdown).toContain("deadline: Immediate");
    expect(markdown).toContain("blocker_id: city-launch-approval-austin-tx");
  });
});
