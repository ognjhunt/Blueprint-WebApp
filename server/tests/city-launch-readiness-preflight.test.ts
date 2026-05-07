// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  CITY_LAUNCH_DEFAULT_ACTIVATION_TASK_KEYS,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
  CITY_LAUNCH_REQUIRED_SURFACE_KEYS,
} from "../utils/cityLaunchDoctrine";
import type {
  CityLaunchActivationRecord,
  CityLaunchSendActionRecord,
} from "../utils/cityLaunchLedgers";
import type { CityLaunchPlanningState } from "../utils/cityLaunchPlanningState";
import type { CityLaunchResearchParseResult } from "../utils/cityLaunchResearchParser";
import {
  runCityLaunchReadinessPreflight,
  type CityLaunchEvidenceCloseoutSnapshot,
  type CityLaunchReadinessPreflightDeps,
  type CityLaunchScorecardCloseoutSnapshots,
} from "../utils/cityLaunchReadinessPreflight";
import type { OutboundReplyDurabilityStatus } from "../utils/outbound-reply-durability";

afterEach(() => {
  vi.unstubAllEnvs();
});

const generatedAt = "2026-05-06T12:00:00.000Z";

function stubReadySender() {
  vi.stubEnv("SENDGRID_API_KEY", "sg-key");
  vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
  vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");
}

function planningState(overrides: Partial<CityLaunchPlanningState> = {}) {
  return {
    city: "Austin, TX",
    citySlug: "austin-tx",
    status: "completed",
    reportsRoot: "/tmp/city-launch-deep-research",
    cityReportsRoot: "/tmp/city-launch-deep-research/austin-tx",
    canonicalPlaybookPath: "/tmp/city-launch-austin-tx-deep-research.md",
    runDirectory: "/tmp/city-launch-deep-research/austin-tx/2026-05-06T12-00-00.000Z",
    manifestPath: "/tmp/city-launch-deep-research/austin-tx/2026-05-06T12-00-00.000Z/manifest.json",
    latestArtifactPath: "/tmp/city-launch-deep-research/austin-tx/2026-05-06T12-00-00.000Z/99-final-playbook.md",
    completedArtifactPath: "/tmp/city-launch-austin-tx-deep-research.md",
    latestRunTimestamp: "2026-05-06T12-00-00.000Z",
    warnings: [],
    ...overrides,
  } satisfies CityLaunchPlanningState;
}

function researchResult(overrides: Partial<CityLaunchResearchParseResult> = {}) {
  const activationPayload = {
    schemaVersion: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
    machinePolicyVersion: CITY_LAUNCH_MACHINE_POLICY_VERSION,
    city: "Austin, TX",
    citySlug: "austin-tx",
    cityThesis: "Open one exact-site hosted-review lane tied to real capture provenance.",
    primarySiteLane: "warehouse robotics",
    primaryWorkflowLane: "robot fleet validation",
    primaryBuyerProofPath: "exact_site",
    lawfulAccessModes: ["site_operator_intro"],
    preferredLawfulAccessMode: "site_operator_intro",
    rightsPath: {
      summary: "Operator intro required before private controlled interior capture.",
      privateControlledInteriorsRequireAuthorization: true,
      validationRequired: true,
      sourceUrls: ["https://city.example.test/source"],
    },
    validationBlockers: [],
    requiredApprovals: [{ lane: "founder", reason: "Budget and live-send posture." }],
    ownerLanes: ["city-launch-agent", "outbound-sales-agent", "analytics-agent"],
    issueSeeds: [],
    metricsDependencies: [],
    namedClaims: [],
    launchSurfaceCoverage: CITY_LAUNCH_REQUIRED_SURFACE_KEYS.map((surfaceKey) => ({
      surfaceKey,
      ownerLane: "city-launch-agent",
      humanLane: surfaceKey.includes("budget") ? "founder" : null,
      artifact: `${surfaceKey}.md`,
      evidenceStandard: "artifact path or Firestore collection/query name required",
      completionGate: "must be evidence-backed before closeout",
      delegationTaskKey: surfaceKey,
      blockerBehavior: "ready_to_execute",
      validationRequired: true,
      sourceUrls: ["https://city.example.test/source"],
    })),
  } satisfies NonNullable<CityLaunchResearchParseResult["activationPayload"]>;

  return {
    city: "Austin, TX",
    citySlug: "austin-tx",
    artifactPath: "/tmp/city-launch-austin-tx-deep-research.md",
    schemaVersion: "2026-04-12.city-launch-research.v1",
    generatedAtIso: generatedAt,
    captureCandidates: [],
    buyerTargets: [],
    firstTouches: [],
    budgetRecommendations: [],
    activationPayload,
    warnings: [],
    errors: [],
    ...overrides,
  } satisfies CityLaunchResearchParseResult;
}

function budgetRecommendation(amountUsd: number) {
  return {
    stableKey: `budget_austin_${amountUsd}`,
    category: "outbound",
    amountUsd,
    note: "Test budget recommendation.",
    sourceUrls: ["https://city.example.test/source"],
    explicitFields: ["category", "amount_usd"],
    inferredFields: [],
    provenance: {
      sourceType: "deep_research_playbook",
      artifactPath: "/tmp/city-launch-austin-tx-deep-research.md",
      sourceKey: "budget_recommendations[0]",
      sourceUrls: ["https://city.example.test/source"],
      parsedAtIso: generatedAt,
      explicitFields: ["category", "amount_usd"],
      inferredFields: [],
    },
  } satisfies CityLaunchResearchParseResult["budgetRecommendations"][number];
}

function activationRecord(
  overrides: Partial<CityLaunchActivationRecord> = {},
): CityLaunchActivationRecord {
  return {
    city: "Austin, TX",
    citySlug: "austin-tx",
    budgetTier: "lean",
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
    status: "planning",
    rootIssueId: null,
    taskIssueIds: {},
    machineReadablePolicyVersion: CITY_LAUNCH_MACHINE_POLICY_VERSION,
    wideningGuard: {
      mode: "single_city_until_proven",
      wideningAllowed: false,
      reasons: ["Proof-motion milestones are not complete."],
    },
    createdAtIso: generatedAt,
    updatedAtIso: generatedAt,
    ...overrides,
  };
}

function allActivationTaskIssueIds(prefix = "issue-child") {
  return Object.fromEntries(
    CITY_LAUNCH_DEFAULT_ACTIVATION_TASK_KEYS.map((taskKey, index) => [
      taskKey,
      `${prefix}-${index + 1}`,
    ]),
  );
}

function sendAction(
  overrides: Partial<CityLaunchSendActionRecord> = {},
): CityLaunchSendActionRecord {
  return {
    id: "austin-tx-send-warehouse-direct-1",
    city: "Austin, TX",
    citySlug: "austin-tx",
    launchId: "issue-root-1",
    lane: "warehouse-facility-direct",
    actionType: "direct_outreach",
    channelAccountId: "austin-tx-channel-warehouse-facility-direct",
    channelLabel: "warehouse/facility direct outreach lane",
    targetLabel: "Capital Robotics",
    assetKey: "city-opening-first-wave-pack",
    ownerAgent: "city-launch-agent",
    recipientEmail: "ops@capitalrobotics.com",
    emailSubject: "Blueprint Austin exact-site warehouse opening",
    emailBody: "Proof-led outreach.",
    status: "ready_to_send",
    approvalState: "approved",
    responseIngestState: "awaiting_response",
    issueId: "issue-child-1",
    notes: "Recipient-backed direct outreach.",
    sentAtIso: null,
    firstResponseAtIso: null,
    createdAtIso: generatedAt,
    updatedAtIso: generatedAt,
    ...overrides,
  };
}

function replyDurability(
  overrides: Partial<OutboundReplyDurabilityStatus> = {},
): OutboundReplyDurabilityStatus {
  return {
    ok: true,
    status: "ready",
    generatedAt,
    blockers: [],
    warnings: [],
    missingEnv: [],
    proofCommands: ["npm run human-replies:audit-durability"],
    sender: {
      capability: "ready",
      productionProven: true,
      transport: { enabled: true, configured: true, provider: "sendgrid" },
      sender: {
        fromEmail: "launches@tryblueprint.io",
        fromName: "Blueprint City Launch",
        replyTo: "launches@tryblueprint.io",
        source: "sendgrid_default",
        verificationStatus: "verified",
      },
      blockers: [],
      warnings: [],
    },
    humanReply: {
      ingestTokenConfigured: true,
      approvedIdentityConfigured: true,
      approvedIdentity: "ohstnhunt@gmail.com",
      approvedIdentityMatchesDefault: true,
      watcherEnabled: true,
      gmail: {
        production_ready: true,
        risk: "none",
        reason: null,
        oauth_publishing_status: "production",
        has_client_id: true,
        has_client_secret: true,
        has_refresh_token: true,
        watcher_enabled: true,
      },
    },
    ...overrides,
  } as OutboundReplyDurabilityStatus;
}

function creativeAdsEvidence(
  overrides: Partial<CityLaunchEvidenceCloseoutSnapshot> = {},
): CityLaunchEvidenceCloseoutSnapshot {
  return {
    status: "ready",
    generatedAt,
    jsonPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-creative-ads-evidence.json",
    markdownPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-creative-ads-evidence.md",
    blockers: [],
    warnings: [],
    raw: {
      status: "ready",
      adStudio: {
        status: "ready",
        runId: "ad-studio-run-1",
        blocker: null,
      },
      metaAds: {
        readOnlyProof: {
          status: "ready",
          blocker: null,
        },
        pausedDraft: {
          status: "ready",
          blocker: null,
        },
      },
    },
    ...overrides,
  };
}

function scorecardCloseouts(
  status = "complete",
): CityLaunchScorecardCloseoutSnapshots {
  return {
    "24h": {
      status,
      generatedAt,
      jsonPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-24h.json",
      markdownPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-24h.md",
      blockers: [],
      warnings: [],
      raw: { status },
    },
    "48h": {
      status,
      generatedAt,
      jsonPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-48h.json",
      markdownPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-48h.md",
      blockers: [],
      warnings: [],
      raw: { status },
    },
    "72h": {
      status,
      generatedAt,
      jsonPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-72h.json",
      markdownPath: "/tmp/city-launch-execution/austin-tx/2026-05-06T12-00-00.000Z/city-launch-austin-tx-scorecard-72h.md",
      blockers: [],
      warnings: [],
      raw: { status },
    },
  };
}

function deps(
  overrides: {
    planning?: CityLaunchPlanningState;
    research?: CityLaunchResearchParseResult;
    activation?: CityLaunchActivationRecord | null;
    sendActions?: CityLaunchSendActionRecord[];
    durability?: OutboundReplyDurabilityStatus;
    artifactExists?: boolean | ((filePath: string) => boolean);
    creativeEvidence?: CityLaunchEvidenceCloseoutSnapshot | null;
    scorecardCloseouts?: CityLaunchScorecardCloseoutSnapshots;
    deepResearchBlockerPacket?: string | null;
  } = {},
) {
  const artifactExists = overrides.artifactExists ?? false;
  return {
    resolvePlanningState: async () => overrides.planning || planningState(),
    loadResearchArtifact: async () => overrides.research || researchResult(),
    readActivation: async () => overrides.activation ?? null,
    listSendActions: async () => overrides.sendActions || [sendAction()],
    buildReplyDurabilityStatus: async () => overrides.durability || replyDurability(),
    fileExists: async (filePath: string) =>
      typeof artifactExists === "function" ? artifactExists(filePath) : artifactExists,
    findLatestCreativeAdsEvidence: async () => overrides.creativeEvidence ?? null,
    findScorecardCloseouts: async () =>
      overrides.scorecardCloseouts || { "24h": null, "48h": null, "72h": null },
    findFounderDecisionPacket: async () => null,
    findDeepResearchBlockerPacket: async () => overrides.deepResearchBlockerPacket ?? null,
  } satisfies Partial<CityLaunchReadinessPreflightDeps>;
}

describe("city launch readiness preflight", () => {
  it("returns awaiting_human_decision when playbook, coverage, outreach, and durability are ready but founder approval is missing", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      requireFounderApproval: true,
      deps: deps(),
    });

    expect(result.status).toBe("awaiting_human_decision");
    expect(result.blockers).toEqual([]);
    expect(result.requiredInputs).toContain(
      "Founder approval for city posture, budget envelope, live sends, and live spend gates.",
    );
    expect(result.checks.find((check) => check.key === "launch_surface_coverage")?.status).toBe("ready");
    expect(result.checks.find((check) => check.key === "gtm_72h_artifacts")?.status).toBe("not_due");
  });

  it("blocks reuse when a completed playbook exceeds the founder budget max", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      requireFounderApproval: false,
      deps: deps({
        research: researchResult({
          budgetRecommendations: [budgetRecommendation(3_000)],
        }),
        activation: activationRecord({
          founderApproved: true,
          status: "activation_ready",
          rootIssueId: "issue-root-1",
          taskIssueIds: allActivationTaskIssueIds(),
        }),
        artifactExists: true,
        creativeEvidence: creativeAdsEvidence(),
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });
    const checklist = Object.fromEntries(
      result.promptToArtifactChecklist.map((item) => [item.key, item]),
    );

    expect(result.status).toBe("blocked");
    expect(result.earliestHardBlockerKey).toBe("city_budget_window");
    expect(result.launchSurfaceCoverage).toMatchObject({
      status: "ready",
      missingSurfaces: [],
    });
    expect(result.earliestHardBlocker).toMatchObject({
      key: "city_budget_window",
      status: "blocked",
      owner: "founder",
    });
    expect(checklist.city_budget_window).toMatchObject({
      status: "blocked",
      summary: expect.stringContaining("exceeding the founder-provided Lean max $2,500"),
      evidencePaths: expect.arrayContaining(["/tmp/city-launch-austin-tx-deep-research.md"]),
    });
    expect(checklist.target_ledger_distribution_pack.status).toBe("blocked");
    expect(result.requiredInputs).toContain(
      "A completed city playbook whose budget recommendations fit Lean max $2,500, or founder approval to raise the budget.",
    );
  });

  it("blocks when recipient-backed outreach and reply durability are missing", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        artifactExists: true,
        sendActions: [],
        durability: replyDurability({
          ok: false,
          status: "blocked",
          blockers: ["Gmail human-reply OAuth is not production-ready for durable reply resume."],
          missingEnv: ["BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN"],
        }),
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toContain(
      "No recipient-backed direct-outreach send actions were seeded for Austin, TX.",
    );
    expect(result.requiredInputs).toContain(
      "Recipient-backed direct outreach evidence; no fake or placeholder emails.",
    );
    expect(result.requiredInputs).toContain("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN");
    expect(result.earliestHardBlocker).toMatchObject({
      key: "recipient_backed_direct_outreach",
      status: "blocked",
      stageReached: "recipient_backed_direct_outreach",
      owner: "growth-lead",
      retryCondition: "Provide recipient-backed contact evidence; no invented emails.",
    });
  });

  it("blocks activation when the Paperclip delegated child issue tree is incomplete", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        activation: activationRecord({
          founderApproved: true,
          status: "activation_ready",
          rootIssueId: "issue-root-1",
          taskIssueIds: { "city-target-ledger": "issue-child-1" },
        }),
        artifactExists: true,
        creativeEvidence: creativeAdsEvidence(),
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });

    const paperclipCheck = result.checks.find((check) => check.key === "paperclip_issue_tree");
    expect(result.status).toBe("blocked");
    expect(paperclipCheck).toMatchObject({
      status: "blocked",
      summary: expect.stringContaining("Paperclip child issue ids are missing"),
      collectionNames: expect.arrayContaining(["cityLaunchActivations"]),
    });
    expect(result.earliestHardBlocker).toMatchObject({
      key: "paperclip_issue_tree",
      status: "blocked",
    });
    expect(result.requiredInputs).toContain(
      "Paperclip delegated child issue ids for every default city-launch activation task.",
    );
  });

  it("includes the Deep Research blocker packet path in blocked readiness evidence when one exists", async () => {
    const blockerPacket = "/tmp/city-launch-execution/austin-tx/run-1/deep-research-blocker-packet.md";

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        planning: planningState({
          status: "not_started",
          completedArtifactPath: null,
          latestArtifactPath: null,
        }),
        deepResearchBlockerPacket: blockerPacket,
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.evidencePaths.deepResearchBlockerPacketPath).toBe(blockerPacket);
    expect(result.earliestHardBlockerKey).toBe("deep_research_city_plan");
    expect(result.earliestHardBlocker?.evidencePaths).toContain(blockerPacket);
    expect(result.autonomousLoopCloseout.blocked?.linkedFollowUp).toBe(blockerPacket);
    expect(result.autonomousLoopCloseout.durableEvidence).toContain(blockerPacket);
    expect(result.launchSurfaceCoverage).toMatchObject({
      status: "blocked",
      coveredSurfaces: [],
      missingSurfaces: CITY_LAUNCH_REQUIRED_SURFACE_KEYS,
    });
  });

  it("does not treat existing 72h GTM artifacts as launch proof before activation starts", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        artifactExists: true,
        creativeEvidence: creativeAdsEvidence(),
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });

    const gtmCheck = result.checks.find((check) => check.key === "gtm_72h_artifacts");
    const checklist = Object.fromEntries(
      result.promptToArtifactChecklist.map((item) => [item.key, item]),
    );

    expect(gtmCheck).toMatchObject({
      status: "not_due",
      summary: expect.stringContaining("not launch-execution proof"),
    });
    expect(checklist.ad_studio_claims_review_handoff.status).toBe("not_due");
    expect(checklist.meta_ads_read_only_paused_draft.status).toBe("not_due");
    expect(checklist.firestore_admin_evidence.status).toBe("not_due");
    expect(checklist.scorecards_24_48_72.status).toBe("not_due");
  });

  it("surfaces an existing founder decision packet in the prompt-to-artifact checklist", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      requireFounderApproval: true,
      executionReportsRoot: "/tmp/city-launch-execution",
      deps: {
        ...deps(),
        findFounderDecisionPacket: async ({ citySlug, reportsRoot }) =>
          `${reportsRoot}/${citySlug}/2026-05-06T18-50-57.255Z/founder-decision-packet.md`,
      },
    });
    const checklist = Object.fromEntries(
      result.promptToArtifactChecklist.map((item) => [item.key, item]),
    );

    expect(result.evidencePaths.founderDecisionPacketPath).toBe(
      "/tmp/city-launch-execution/austin-tx/2026-05-06T18-50-57.255Z/founder-decision-packet.md",
    );
    expect(checklist.founder_decision_packet.evidencePaths).toContain(
      "/tmp/city-launch-execution/austin-tx/2026-05-06T18-50-57.255Z/founder-decision-packet.md",
    );
    expect(result.earliestHardBlocker).toMatchObject({
      key: "founder_decision_packet",
      evidencePaths: expect.arrayContaining([
        "/tmp/city-launch-execution/austin-tx/2026-05-06T18-50-57.255Z/founder-decision-packet.md",
      ]),
    });
  });

  it("does not mark a launch ready while recipient-backed sends still need first-send approval", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        sendActions: [sendAction({ approvalState: "pending_first_send_approval" })],
      }),
    });

    expect(result.status).toBe("awaiting_human_decision");
    expect(result.checks.find((check) => check.key === "founder_first_send_approval")).toMatchObject({
      status: "awaiting_human_decision",
    });
    expect(result.requiredInputs).toContain(
      "Founder first-send approval recorded on each recipient-backed direct outreach action before live dispatch.",
    );
    expect(result.earliestHardBlocker).toMatchObject({
      key: "founder_decision_packet",
      status: "awaiting_human_decision",
      owner: "founder",
    });
  });

  it("blocks after activation when creative/ad evidence closeout is missing", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        activation: activationRecord({
          founderApproved: true,
          status: "activation_ready",
          rootIssueId: "issue-root-1",
          taskIssueIds: allActivationTaskIssueIds(),
        }),
        artifactExists: true,
        creativeEvidence: null,
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });
    const checklist = Object.fromEntries(
      result.promptToArtifactChecklist.map((item) => [item.key, item]),
    );

    expect(result.status).toBe("blocked");
    expect(checklist.ad_studio_claims_review_handoff).toMatchObject({
      status: "blocked",
      summary: expect.stringContaining("no creative/ad evidence closeout JSON"),
    });
    expect(result.earliestHardBlocker).toMatchObject({
      key: "ad_studio_claims_review_handoff",
      status: "blocked",
    });
  });

  it("returns ready when every pre-activation and post-activation launch artifact is present", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        activation: activationRecord({
          founderApproved: true,
          status: "activation_ready",
          rootIssueId: "issue-root-1",
          taskIssueIds: allActivationTaskIssueIds(),
        }),
        artifactExists: true,
        creativeEvidence: creativeAdsEvidence(),
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.requiredInputs).toEqual([]);
    expect(result.checks.find((check) => check.key === "paperclip_issue_tree")?.status).toBe("ready");
    expect(result.checks.find((check) => check.key === "gtm_72h_artifacts")?.status).toBe("ready");
    expect(Object.keys(result.evidencePaths.scorecardPaths)).toEqual(["24h", "48h", "72h"]);
    expect(result.earliestHardBlocker).toBeNull();
    expect(result.earliestHardBlockerKey).toBeNull();
    expect(result.launchSurfaceCoverage).toMatchObject({
      status: "ready",
      coveredSurfaces: CITY_LAUNCH_REQUIRED_SURFACE_KEYS,
      missingSurfaces: [],
    });
  });

  it("returns a prompt-to-artifact checklist for every CITY+BUDGET launch contract lane", async () => {
    stubReadySender();

    const result = await runCityLaunchReadinessPreflight({
      city: "Austin, TX",
      budgetTier: "lean",
      budgetMaxUsd: 2_500,
      founderApproved: true,
      deps: deps({
        activation: activationRecord({
          founderApproved: true,
          status: "activation_ready",
          rootIssueId: "issue-root-1",
          taskIssueIds: allActivationTaskIssueIds(),
        }),
        artifactExists: true,
        creativeEvidence: creativeAdsEvidence(),
        scorecardCloseouts: scorecardCloseouts(),
      }),
    });
    const checklist = Object.fromEntries(
      result.promptToArtifactChecklist.map((item) => [item.key, item]),
    );

    expect(Object.keys(checklist)).toEqual([
      "city_budget_window",
      "deep_research_city_plan",
      "canonical_activation_payload",
      "launch_surface_coverage",
      "paperclip_issue_tree",
      "target_ledger_distribution_pack",
      "recipient_backed_direct_outreach",
      "reply_durability_resume",
      "community_social_artifact_only",
      "ad_studio_claims_review_handoff",
      "meta_ads_read_only_paused_draft",
      "founder_decision_packet",
      "firestore_admin_evidence",
      "scorecards_24_48_72",
    ]);
    expect(checklist.city_budget_window).toMatchObject({
      status: "ready",
      promptRequirement: expect.stringContaining("one city and one budget"),
    });
    expect(checklist.deep_research_city_plan).toMatchObject({
      collectionNames: expect.arrayContaining(["humanBlockerThreads", "humanBlockerDispatches"]),
      queryNames: expect.arrayContaining(["human_blocker_thread", "human_blocker_dispatch"]),
    });
    expect(checklist.target_ledger_distribution_pack.evidencePaths).toContain(
      "/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-capture-target-ledger-austin-tx.md",
    );
    expect(checklist.reply_durability_resume).toMatchObject({
      status: "ready",
      collectionNames: expect.arrayContaining(["humanBlockerThreads", "humanReplyEvents"]),
    });
    expect(checklist.community_social_artifact_only).toMatchObject({
      artifactOnly: true,
      status: "ready",
    });
    expect(checklist.ad_studio_claims_review_handoff.status).toBe("ready");
    expect(checklist.ad_studio_claims_review_handoff.collectionNames).toContain("ad_studio_runs");
    expect(checklist.meta_ads_read_only_paused_draft.status).toBe("ready");
    expect(checklist.meta_ads_read_only_paused_draft.collectionNames).toContain("meta_ads_cli_runs");
    expect(checklist.firestore_admin_evidence.status).toBe("ready");
    expect(checklist.firestore_admin_evidence.collectionNames).toContain("growth_events");
    expect(checklist.scorecards_24_48_72.status).toBe("ready");
    expect(checklist.scorecards_24_48_72.queryNames).toContain("city_launch_growth_events_recent");
    expect(checklist.scorecards_24_48_72.command).toContain("npm run city-launch:scorecard");
    expect(checklist.scorecards_24_48_72.command).toContain("--checkpoint-hour 72");
  });
});
