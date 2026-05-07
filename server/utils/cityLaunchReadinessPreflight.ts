import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildCityLaunchGtm72hArtifactPaths,
  CITY_LAUNCH_GTM_CHECKPOINT_HOURS,
  CITY_LAUNCH_GTM_EVIDENCE_SOURCES,
} from "./cityLaunchExecutionHarness";
import {
  CITY_LAUNCH_DEFAULT_ACTIVATION_TASK_KEYS,
  CITY_LAUNCH_REQUIRED_SURFACE_KEYS,
  type CityLaunchRequiredSurfaceKey,
} from "./cityLaunchDoctrine";
import {
  buildCityLaunchBudgetPolicy,
  normalizeCityLaunchBudgetTier,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
} from "./cityLaunchPolicy";
import {
  CITY_LAUNCH_WINDOW_HOURS,
  resolveCityLaunchWindowHours,
} from "./cityLaunchRunControl";
import { resolveCityLaunchProfile, slugifyCityName } from "./cityLaunchProfiles";
import {
  listCityLaunchSendActions,
  readCityLaunchActivation,
  type CityLaunchActivationRecord,
  type CityLaunchSendActionRecord,
} from "./cityLaunchLedgers";
import {
  resolveCityLaunchPlanningState,
  type CityLaunchPlanningState,
} from "./cityLaunchPlanningState";
import {
  loadAndParseCityLaunchResearchArtifact,
  type CityLaunchResearchParseResult,
} from "./cityLaunchResearchParser";
import {
  assessCityLaunchOutboundReadiness,
  type CityLaunchOutboundReadiness,
} from "./cityLaunchSendExecutor";
import {
  buildOutboundReplyDurabilityStatus,
  type OutboundReplyDurabilityStatus,
} from "./outbound-reply-durability";

export type CityLaunchReadinessPreflightStatus =
  | "ready"
  | "blocked"
  | "awaiting_human_decision";

export type CityLaunchReadinessCheckStatus =
  | "ready"
  | "blocked"
  | "awaiting_human_decision"
  | "warning"
  | "not_due";

export type CityLaunchReadinessCheck = {
  key: string;
  status: CityLaunchReadinessCheckStatus;
  summary: string;
  evidencePaths?: string[];
  collectionNames?: string[];
  nextAction?: string | null;
};

export type CityLaunchPromptArtifactChecklistItem = {
  key: string;
  promptRequirement: string;
  status: CityLaunchReadinessCheckStatus;
  summary: string;
  evidencePaths: string[];
  collectionNames: string[];
  queryNames: string[];
  command?: string | null;
  nextAction?: string | null;
  artifactOnly?: boolean;
};

export type CityLaunchEarliestHardBlocker = {
  key: string;
  status: "blocked" | "awaiting_human_decision";
  stageReached: string;
  summary: string;
  evidencePaths: string[];
  collectionNames: string[];
  queryNames: string[];
  requiredInputs: string[];
  owner: string;
  retryCondition: string;
  nextAction: string | null;
};

export type CityLaunchLaunchSurfaceCoverageSummary = {
  status: CityLaunchReadinessCheckStatus;
  requiredSurfaces: CityLaunchRequiredSurfaceKey[];
  coveredSurfaces: CityLaunchRequiredSurfaceKey[];
  missingSurfaces: CityLaunchRequiredSurfaceKey[];
  evidencePaths: string[];
  nextAction: string | null;
};

export type CityLaunchEvidenceCloseoutSnapshot = {
  status: string;
  generatedAt: string | null;
  jsonPath: string;
  markdownPath: string | null;
  blockers: string[];
  warnings: string[];
  raw: Record<string, unknown>;
};

export type CityLaunchScorecardCloseoutSnapshots = Record<
  `${number}h`,
  CityLaunchEvidenceCloseoutSnapshot | null
>;

export type CityLaunchAutonomousLoopCloseout = {
  objective: string;
  claimScope: "city_launch_readiness_preflight";
  stateClaim: "done" | "blocked" | "awaiting_human_decision";
  stageReached: string;
  durableEvidence: string[];
  verification: string[];
  requirementCoverage: Array<{
    key: string;
    status: CityLaunchReadinessCheckStatus;
    evidencePaths: string[];
    collectionNames: string[];
    queryNames: string[];
  }>;
  nextAction: string;
  residualRisk: string[];
  blocked: {
    earliestHardStop: string;
    whyNoReversibleWorkRemains: string;
    nextRequiredInput: string[];
    owner: string;
    retryResumeCondition: string;
    linkedFollowUp: string | null;
  } | null;
  awaitingHumanDecision: {
    gateCategory: string;
    decisionRequested: string;
    recommendation: string;
    evidencePacket: string | null;
    blockerId: string;
    routingSurface: string;
    watcherOwner: string;
    resumeCondition: string;
    deadline: string;
  } | null;
};

export type CityLaunchReadinessPreflightResult = {
  city: string;
  citySlug: string;
  generatedAt: string;
  status: CityLaunchReadinessPreflightStatus;
  budgetPolicy: CityLaunchBudgetPolicy;
  founderApproved: boolean;
  windowHours: 72;
  checks: CityLaunchReadinessCheck[];
  promptToArtifactChecklist: CityLaunchPromptArtifactChecklistItem[];
  earliestHardBlocker: CityLaunchEarliestHardBlocker | null;
  earliestHardBlockerKey: string | null;
  launchSurfaceCoverage: CityLaunchLaunchSurfaceCoverageSummary;
  blockers: string[];
  warnings: string[];
  requiredInputs: string[];
  evidencePaths: {
    completedPlaybookPath: string | null;
    activationPayloadPath: string | null;
    deepResearchBlockerPacketPath: string | null;
    founderDecisionPacketPath: string | null;
    gtm72hContractPath: string;
    adStudioCreativeHandoffPath: string;
    metaAdsReadinessPath: string;
    scorecardWindowManifestPath: string;
    scorecardPaths: Record<`${number}h`, string>;
  };
  planning: Pick<
    CityLaunchPlanningState,
    "status" | "latestArtifactPath" | "completedArtifactPath" | "warnings"
  >;
  outboundReadiness: CityLaunchOutboundReadiness | null;
  replyDurability: Pick<
    OutboundReplyDurabilityStatus,
    "ok" | "status" | "blockers" | "warnings" | "missingEnv" | "proofCommands"
  > | null;
  autonomousLoopCloseout: CityLaunchAutonomousLoopCloseout;
};

export type CityLaunchReadinessPreflightDeps = {
  resolvePlanningState: typeof resolveCityLaunchPlanningState;
  loadResearchArtifact: typeof loadAndParseCityLaunchResearchArtifact;
  readActivation: typeof readCityLaunchActivation;
  listSendActions: typeof listCityLaunchSendActions;
  buildReplyDurabilityStatus: typeof buildOutboundReplyDurabilityStatus;
  fileExists: (filePath: string) => Promise<boolean>;
  findLatestCreativeAdsEvidence: (input: {
    citySlug: string;
    reportsRoot: string;
  }) => Promise<CityLaunchEvidenceCloseoutSnapshot | null>;
  findScorecardCloseouts: (input: {
    citySlug: string;
    reportsRoot: string;
    canonicalScorecardJsonPaths: Record<`${number}h`, string>;
  }) => Promise<CityLaunchScorecardCloseoutSnapshots>;
  findFounderDecisionPacket: (input: {
    citySlug: string;
    reportsRoot: string;
  }) => Promise<string | null>;
  findDeepResearchBlockerPacket: (input: {
    citySlug: string;
    reportsRoot: string;
  }) => Promise<string | null>;
};

const defaultDeps: CityLaunchReadinessPreflightDeps = {
  resolvePlanningState: resolveCityLaunchPlanningState,
  loadResearchArtifact: loadAndParseCityLaunchResearchArtifact,
  readActivation: readCityLaunchActivation,
  listSendActions: listCityLaunchSendActions,
  buildReplyDurabilityStatus: buildOutboundReplyDurabilityStatus,
  fileExists: async (filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  findLatestCreativeAdsEvidence: findLatestCityLaunchCreativeAdsEvidence,
  findScorecardCloseouts: findCityLaunchScorecardCloseouts,
  findFounderDecisionPacket: findLatestFounderDecisionPacket,
  findDeepResearchBlockerPacket: findLatestDeepResearchBlockerPacket,
};

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function requiredSurfaceSet(
  research: CityLaunchResearchParseResult | null,
) {
  const rows = research?.activationPayload?.launchSurfaceCoverage || [];
  return new Set(
    rows
      .map((entry) => entry.surfaceKey)
      .filter((entry): entry is CityLaunchRequiredSurfaceKey =>
        CITY_LAUNCH_REQUIRED_SURFACE_KEYS.includes(entry as CityLaunchRequiredSurfaceKey),
      ),
  );
}

function formatUsd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function summarizePlaybookBudgetFit(input: {
  research: CityLaunchResearchParseResult;
  budgetPolicy: CityLaunchBudgetPolicy;
}) {
  const totalRecommendedUsd = input.research.budgetRecommendations.reduce(
    (total, entry) => total + entry.amountUsd,
    0,
  );
  const recommendationCount = input.research.budgetRecommendations.length;
  const maxTotalApprovedUsd = input.budgetPolicy.maxTotalApprovedUsd;

  if (recommendationCount === 0) {
    return {
      status: "warning" as const,
      totalRecommendedUsd,
      summary:
        `Completed playbook has no structured budget recommendations; ${input.budgetPolicy.label} max ${formatUsd(maxTotalApprovedUsd)} remains the authoritative run cap.`,
      nextAction: null,
    };
  }

  if (totalRecommendedUsd > maxTotalApprovedUsd) {
    return {
      status: "blocked" as const,
      totalRecommendedUsd,
      summary:
        `Completed playbook recommends ${formatUsd(totalRecommendedUsd)}, exceeding the founder-provided ${input.budgetPolicy.label} max ${formatUsd(maxTotalApprovedUsd)}.`,
      nextAction:
        "Regenerate the city playbook for the current budget max, prune the budget recommendations, or record founder approval for a higher budget before reuse.",
    };
  }

  return {
    status: "ready" as const,
    totalRecommendedUsd,
    summary:
      `Completed playbook recommends ${formatUsd(totalRecommendedUsd)} across ${recommendationCount} budget line(s), within the ${input.budgetPolicy.label} max ${formatUsd(maxTotalApprovedUsd)}.`,
    nextAction: null,
  };
}

function scorecardPathsForResult(paths: ReturnType<typeof buildCityLaunchGtm72hArtifactPaths>) {
  return Object.fromEntries(
    CITY_LAUNCH_GTM_CHECKPOINT_HOURS.map((hour) => [
      `${hour}h`,
      paths.canonical.scorecardPaths[`${hour}h`],
    ]),
  ) as Record<`${number}h`, string>;
}

function activationLooksStarted(activation: CityLaunchActivationRecord | null) {
  return Boolean(
    activation
    && ["activation_ready", "executing", "proof_live", "growth_live"].includes(activation.status),
  );
}

function summarizeArtifactStatus(input: {
  activationStarted: boolean;
  present: Array<{ key: string; path: string; exists: boolean }>;
}) {
  const missing = input.present.filter((entry) => !entry.exists);
  if (!input.activationStarted) {
    return {
      status: "not_due" as const,
      summary: missing.length === 0
        ? "72h GTM artifact paths already exist, but they are not launch-execution proof because city activation has not started."
        : "72h GTM artifacts are not written yet because city activation has not started.",
    };
  }
  if (missing.length === 0) {
    return {
      status: "ready" as const,
      summary: "72h GTM contract, Ad Studio handoff, Meta gate, and scorecard window artifacts exist.",
    };
  }
  return {
    status: "blocked" as const,
    summary: `Missing post-activation 72h GTM artifact(s): ${missing.map((entry) => entry.key).join(", ")}.`,
  };
}

function evidenceSnapshotPaths(snapshot: CityLaunchEvidenceCloseoutSnapshot | null) {
  return uniqueValues([snapshot?.jsonPath, snapshot?.markdownPath]);
}

function adStudioCloseoutStatus(input: {
  activationStarted: boolean;
  snapshot: CityLaunchEvidenceCloseoutSnapshot | null;
}) {
  if (!input.activationStarted) {
    return {
      status: "not_due" as const,
      summary:
        "Ad Studio closeout is not due until city activation starts; generated creative remains marketing material, not ground truth.",
      nextAction: "Run activation first, then write creative/ad evidence for this city.",
    };
  }
  if (!input.snapshot) {
    return {
      status: "blocked" as const,
      summary:
        "Activation started but no creative/ad evidence closeout JSON was found for this city.",
      nextAction:
        "Run npm run city-launch:creative-ads for this city and verify a draft-safe Ad Studio run with claims review and handoff evidence.",
    };
  }
  const adStudio = nestedRecord(input.snapshot.raw, "adStudio");
  const runId = nestedString(adStudio, "runId");
  const blocker = nestedString(adStudio, "blocker");
  if (nestedString(adStudio, "status") === "ready") {
    return {
      status: "ready" as const,
      summary: `Ad Studio closeout is ready${runId ? ` for run ${runId}` : ""}; claims review and handoff evidence are recorded.`,
      nextAction: null,
    };
  }
  return {
    status: "blocked" as const,
    summary:
      blocker
      || input.snapshot.blockers.join(" ")
      || "Ad Studio closeout exists but is not ready.",
    nextAction:
      "Create or update the Ad Studio run with prompt_pack, approved claims review, and image/video handoff evidence, then rerun creative/ad evidence.",
  };
}

function metaAdsCloseoutStatus(input: {
  activationStarted: boolean;
  snapshot: CityLaunchEvidenceCloseoutSnapshot | null;
}) {
  if (!input.activationStarted) {
    return {
      status: "not_due" as const,
      summary:
        "Meta Ads proof is not due until city activation starts; paused drafts never count as live spend.",
      nextAction: "Run activation first, then write creative/ad evidence with Meta read-only proof when provider env allows it.",
    };
  }
  if (!input.snapshot) {
    return {
      status: "blocked" as const,
      summary:
        "Activation started but no creative/ad evidence closeout JSON was found for Meta Ads proof.",
      nextAction:
        "Run npm run city-launch:creative-ads with --run-meta-read-only after Meta Ads CLI env/account access is configured.",
    };
  }
  const metaAds = nestedRecord(input.snapshot.raw, "metaAds");
  const readOnlyProof = nestedRecord(metaAds, "readOnlyProof");
  const pausedDraft = nestedRecord(metaAds, "pausedDraft");
  const readOnlyStatus = nestedString(readOnlyProof, "status");
  const pausedDraftStatus = nestedString(pausedDraft, "status");
  const readOnlyReady = readOnlyStatus === "ready" || readOnlyStatus === "artifact_only";
  const pausedDraftReady = pausedDraftStatus === "ready" || pausedDraftStatus === "artifact_only";
  if (readOnlyReady && pausedDraftReady) {
    return {
      status: "ready" as const,
      summary:
        `Meta Ads closeout is ${readOnlyStatus}/${pausedDraftStatus}; no live spend is claimed.`,
      nextAction: null,
    };
  }
  if (readOnlyStatus === "human_gated" || pausedDraftStatus === "human_gated") {
    return {
      status: "awaiting_human_decision" as const,
      summary:
        nestedString(pausedDraft, "blocker")
        || nestedString(readOnlyProof, "blocker")
        || "Meta Ads paused-draft posture is waiting on founder approval.",
      nextAction:
        "Record founder approval for paused-draft/budget posture before creating any paused Meta draft.",
    };
  }
  return {
    status: "blocked" as const,
    summary:
      nestedString(readOnlyProof, "blocker")
      || nestedString(pausedDraft, "blocker")
      || input.snapshot.blockers.join(" ")
      || "Meta Ads closeout exists but read-only proof or paused-draft provenance is not ready.",
    nextAction:
      "Configure Meta Ads CLI env/account access, run read-only proof, and keep any drafts paused unless founder approval is recorded.",
  };
}

function scorecardCloseoutStatus(input: {
  activationStarted: boolean;
  snapshots: CityLaunchScorecardCloseoutSnapshots;
}) {
  if (!input.activationStarted) {
    return {
      status: "not_due" as const,
      summary:
        "24h, 48h, and 72h scorecards are not due until activation starts and each checkpoint window closes.",
      nextAction: "Activate the city first; early scorecard snapshots are not performance proof.",
    };
  }
  const snapshots = Object.values(input.snapshots);
  const blocked = snapshots.filter((snapshot) => snapshot?.status === "blocked");
  if (blocked.length > 0) {
    return {
      status: "blocked" as const,
      summary:
        `Scorecard closeout query or manifest evidence is blocked for ${blocked.map((snapshot) => snapshot?.jsonPath).join(", ")}.`,
      nextAction:
        "Fix first-party Firestore/admin query access, then rerun the blocked scorecard closeout.",
    };
  }
  if (snapshots.every((snapshot) => snapshot?.status === "complete")) {
    return {
      status: "ready" as const,
      summary:
        "24h, 48h, and 72h scorecard closeouts are complete with first-party collection/query evidence.",
      nextAction: null,
    };
  }
  const present = snapshots.filter(Boolean);
  return {
    status: "not_due" as const,
    summary:
      present.length > 0
        ? "Some scorecard closeouts exist, but at least one 24/48/72h window is still scheduled, early, or missing."
        : "Scorecard windows are scheduled by the manifest; no scorecard closeout JSONs are present yet.",
    nextAction:
      "Run npm run city-launch:scorecard for 24h, 48h, and 72h after each checkpoint window closes.",
  };
}

function checkByKey(checks: CityLaunchReadinessCheck[], key: string) {
  return checks.find((check) => check.key === key) || null;
}

function sourceForCollection(collection: string) {
  return CITY_LAUNCH_GTM_EVIDENCE_SOURCES.find((source) => source.collection === collection);
}

function evidenceQueryNames(collections: string[]) {
  const queryNames: string[] = [];
  for (const collection of collections) {
    const queryName = sourceForCollection(collection)?.query_name;
    if (queryName) {
      queryNames.push(queryName);
    }
  }
  return queryNames;
}

function canonicalPlaybookPath(relativePath: string) {
  return path.resolve(process.cwd(), relativePath);
}

function scorecardJsonPathsForResult(paths: ReturnType<typeof buildCityLaunchGtm72hArtifactPaths>) {
  return Object.fromEntries(
    CITY_LAUNCH_GTM_CHECKPOINT_HOURS.map((hour) => {
      const checkpointKey = `${hour}h` as const;
      return [
        checkpointKey,
        paths.canonical.scorecardPaths[checkpointKey].replace(/\.md$/, ".json"),
      ];
    }),
  ) as Record<`${number}h`, string>;
}

function cityOpeningArtifactPath(citySlug: string, kind: string) {
  return path.resolve(
    process.cwd(),
    "ops/paperclip/playbooks",
    `city-opening-${citySlug}-${kind}.md`,
  );
}

async function findLatestFounderDecisionPacket(input: {
  citySlug: string;
  reportsRoot: string;
}) {
  const cityRoot = path.resolve(input.reportsRoot, input.citySlug);
  try {
    const entries = await fs.readdir(cityRoot, { withFileTypes: true });
    const packetPaths = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(cityRoot, entry.name, "founder-decision-packet.md"));
    const existing = await Promise.all(
      packetPaths.map(async (packetPath) => {
        try {
          const stat = await fs.stat(packetPath);
          return { packetPath, mtimeMs: stat.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    return existing
      .filter((entry): entry is { packetPath: string; mtimeMs: number } => Boolean(entry))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.packetPath || null;
  } catch {
    return null;
  }
}

async function findLatestDeepResearchBlockerPacket(input: {
  citySlug: string;
  reportsRoot: string;
}) {
  const cityRoot = path.resolve(input.reportsRoot, input.citySlug);
  try {
    const entries = await fs.readdir(cityRoot, { withFileTypes: true });
    const packetPaths = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(cityRoot, entry.name, "deep-research-blocker-packet.md"));
    const existing = await Promise.all(
      packetPaths.map(async (packetPath) => {
        try {
          const stat = await fs.stat(packetPath);
          return { packetPath, mtimeMs: stat.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    return existing
      .filter((entry): entry is { packetPath: string; mtimeMs: number } => Boolean(entry))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.packetPath || null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function nestedRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return asRecord(value[key]) || {};
}

function nestedString(
  value: Record<string, unknown>,
  key: string,
): string {
  const entry = value[key];
  return typeof entry === "string" ? entry : "";
}

async function readCloseoutSnapshot(jsonPath: string) {
  const raw = JSON.parse(await fs.readFile(jsonPath, "utf8")) as unknown;
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const artifacts = asRecord(record.artifacts) || {};
  const markdownPath = typeof artifacts.markdownPath === "string"
    ? artifacts.markdownPath
    : jsonPath.replace(/\.json$/, ".md");
  const status = typeof record.status === "string" ? record.status : "unknown";
  return {
    status,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : null,
    jsonPath,
    markdownPath,
    blockers: asStringArray(record.blockers),
    warnings: asStringArray(record.warnings),
    raw: record,
  } satisfies CityLaunchEvidenceCloseoutSnapshot;
}

async function latestExistingSnapshot(candidatePaths: string[]) {
  const candidates = await Promise.all(
    [...new Set(candidatePaths)].map(async (jsonPath) => {
      try {
        const stat = await fs.stat(jsonPath);
        return { jsonPath, mtimeMs: stat.mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  const latest = candidates
    .filter((entry): entry is { jsonPath: string; mtimeMs: number } => Boolean(entry))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  return latest ? readCloseoutSnapshot(latest.jsonPath) : null;
}

async function runDirectoryJsonCandidates(input: {
  citySlug: string;
  reportsRoot: string;
  fileName: string;
}) {
  const cityRoot = path.resolve(input.reportsRoot, input.citySlug);
  try {
    const entries = await fs.readdir(cityRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(cityRoot, entry.name, input.fileName));
  } catch {
    return [];
  }
}

async function findLatestCityLaunchCreativeAdsEvidence(input: {
  citySlug: string;
  reportsRoot: string;
}) {
  const fileName = `city-launch-${input.citySlug}-creative-ads-evidence.json`;
  const candidates = await runDirectoryJsonCandidates({
    citySlug: input.citySlug,
    reportsRoot: input.reportsRoot,
    fileName,
  });
  const defaultCandidates = await runDirectoryJsonCandidates({
    citySlug: input.citySlug,
    reportsRoot: path.join(process.cwd(), "ops/paperclip/reports/city-launch-creative-ads"),
    fileName,
  });
  return latestExistingSnapshot([...candidates, ...defaultCandidates]);
}

async function findCityLaunchScorecardCloseouts(input: {
  citySlug: string;
  reportsRoot: string;
  canonicalScorecardJsonPaths: Record<`${number}h`, string>;
}) {
  const entries = await Promise.all(
    CITY_LAUNCH_GTM_CHECKPOINT_HOURS.map(async (hour) => {
      const checkpointKey = `${hour}h` as const;
      const fileName = `city-launch-${input.citySlug}-scorecard-${checkpointKey}.json`;
      const runCandidates = await runDirectoryJsonCandidates({
        citySlug: input.citySlug,
        reportsRoot: input.reportsRoot,
        fileName,
      });
      const snapshot = await latestExistingSnapshot([
        input.canonicalScorecardJsonPaths[checkpointKey],
        ...runCandidates,
      ]);
      return [checkpointKey, snapshot] as const;
    }),
  );
  return Object.fromEntries(entries) as CityLaunchScorecardCloseoutSnapshots;
}

const HARD_BLOCKER_PRIORITY = [
  "city_budget_window",
  "deep_research_city_plan",
  "canonical_activation_payload",
  "launch_surface_coverage",
  "founder_decision_packet",
  "paperclip_issue_tree",
  "target_ledger_distribution_pack",
  "recipient_backed_direct_outreach",
  "reply_durability_resume",
  "community_social_artifact_only",
  "ad_studio_claims_review_handoff",
  "meta_ads_read_only_paused_draft",
  "firestore_admin_evidence",
  "scorecards_24_48_72",
];

function ownerForChecklistKey(key: string) {
  if (key === "founder_decision_packet") return "founder";
  if (key === "deep_research_city_plan" || key === "canonical_activation_payload" || key === "launch_surface_coverage") {
    return "city-launch-agent";
  }
  if (key === "recipient_backed_direct_outreach" || key === "reply_durability_resume") {
    return "growth-lead";
  }
  if (key === "paperclip_issue_tree") return "city-launch-agent";
  if (key === "city_budget_window") return "founder";
  return "city-launch-agent";
}

function requiredInputsForChecklistKey(input: {
  key: string;
  requiredInputs: string[];
  item: CityLaunchPromptArtifactChecklistItem;
}) {
  const values = input.requiredInputs.filter((entry) => {
    if (input.key === "city_budget_window") return /budget tier|budget recommendations|budget max|raise the budget|budget envelope/i.test(entry);
    if (input.key === "deep_research_city_plan" || input.key === "canonical_activation_payload" || input.key === "launch_surface_coverage") {
      return /deep research|city playbook/i.test(entry);
    }
    if (input.key === "founder_decision_packet") {
      return /founder/i.test(entry);
    }
    if (input.key === "recipient_backed_direct_outreach") {
      return /recipient-backed|fake|placeholder|contact/i.test(entry);
    }
    if (input.key === "reply_durability_resume") {
      return /gmail|human_reply|sender|verification|sendgrid|reply/i.test(entry);
    }
    return false;
  });
  return values.length > 0 ? [...new Set(values)] : input.item.nextAction ? [input.item.nextAction] : [];
}

function buildEarliestHardBlocker(input: {
  checklist: CityLaunchPromptArtifactChecklistItem[];
  requiredInputs: string[];
}): CityLaunchEarliestHardBlocker | null {
  const byKey = new Map(input.checklist.map((item) => [item.key, item]));
  for (const key of HARD_BLOCKER_PRIORITY) {
    const item = byKey.get(key);
    if (!item || (item.status !== "blocked" && item.status !== "awaiting_human_decision")) {
      continue;
    }
    const requiredInputs = requiredInputsForChecklistKey({
      key,
      requiredInputs: input.requiredInputs,
      item,
    });
    return {
      key,
      status: item.status,
      stageReached: key,
      summary: item.summary,
      evidencePaths: item.evidencePaths,
      collectionNames: item.collectionNames,
      queryNames: item.queryNames,
      requiredInputs,
      owner: ownerForChecklistKey(key),
      retryCondition: item.nextAction || item.command || "Rerun city-launch preflight after the missing evidence is recorded.",
      nextAction: item.nextAction || item.command || null,
    };
  }
  return null;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((entry): entry is string => Boolean(entry)))];
}

function closeoutStateForStatus(
  status: CityLaunchReadinessPreflightStatus,
): CityLaunchAutonomousLoopCloseout["stateClaim"] {
  if (status === "ready") return "done";
  return status;
}

function buildAutonomousLoopCloseout(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
  windowHours: typeof CITY_LAUNCH_WINDOW_HOURS;
  status: CityLaunchReadinessPreflightStatus;
  promptToArtifactChecklist: CityLaunchPromptArtifactChecklistItem[];
  earliestHardBlocker: CityLaunchEarliestHardBlocker | null;
  requiredInputs: string[];
  evidencePaths: CityLaunchReadinessPreflightResult["evidencePaths"];
}): CityLaunchAutonomousLoopCloseout {
  const objective =
    `Verify whether ${input.city} can enter the truthful 72-hour CITY+BUDGET launch loop at ${input.budgetPolicy.tier} budget tier without inventing contacts, proof, sends, readiness, or spend.`;
  const requirementCoverage = input.promptToArtifactChecklist.map((item) => ({
    key: item.key,
    status: item.status,
    evidencePaths: item.evidencePaths,
    collectionNames: item.collectionNames,
    queryNames: item.queryNames,
  }));
  const durableEvidence = uniqueValues([
    input.evidencePaths.completedPlaybookPath,
    input.evidencePaths.activationPayloadPath,
    input.evidencePaths.deepResearchBlockerPacketPath,
    input.evidencePaths.founderDecisionPacketPath,
    input.evidencePaths.gtm72hContractPath,
    input.evidencePaths.adStudioCreativeHandoffPath,
    input.evidencePaths.metaAdsReadinessPath,
    input.evidencePaths.scorecardWindowManifestPath,
    ...Object.values(input.evidencePaths.scorecardPaths),
    ...(input.earliestHardBlocker?.evidencePaths || []),
  ]);
  const stageReached = input.earliestHardBlocker?.stageReached || "city_launch_readiness_preflight";
  const nextAction =
    input.earliestHardBlocker?.nextAction
    || input.earliestHardBlocker?.retryCondition
    || "Run npm run city-launch:run after the preflight status is ready and all human gates are recorded.";
  const residualRisk = [
    "This closeout is scoped to readiness preflight; it is not proof that live sends, live spend, buyer responses, capture outcomes, or 24/48/72h scorecard windows have happened.",
    "Generated creative and draft ad artifacts remain marketing material, not ground truth.",
    "Passing this preflight does not override founder gates for city posture, budget, rights/privacy exceptions, live sends, or live paid spend.",
  ];
  const isHumanGate = input.earliestHardBlocker?.status === "awaiting_human_decision";
  const evidencePacket =
    input.evidencePaths.founderDecisionPacketPath
    || input.earliestHardBlocker?.evidencePaths[0]
    || null;

  return {
    objective,
    claimScope: "city_launch_readiness_preflight",
    stateClaim: closeoutStateForStatus(input.status),
    stageReached,
    durableEvidence,
    verification: [
      "runCityLaunchReadinessPreflight evaluated planning state, activation state, recipient-backed send actions, reply durability, required lane artifacts, and the prompt-to-artifact checklist.",
      `WINDOW_HOURS=${input.windowHours} was enforced by resolveCityLaunchWindowHours.`,
    ],
    requirementCoverage,
    nextAction,
    residualRisk,
    blocked:
      input.earliestHardBlocker && !isHumanGate
        ? {
            earliestHardStop: input.earliestHardBlocker.summary,
            whyNoReversibleWorkRemains:
              "The readiness branch cannot truthfully advance to the next city-launch stage until the earliest missing evidence or provider/account input is recorded.",
            nextRequiredInput:
              input.earliestHardBlocker.requiredInputs.length > 0
                ? input.earliestHardBlocker.requiredInputs
                : input.requiredInputs,
            owner: input.earliestHardBlocker.owner,
            retryResumeCondition: input.earliestHardBlocker.retryCondition,
            linkedFollowUp:
              input.earliestHardBlocker.key === "deep_research_city_plan"
                ? input.evidencePaths.deepResearchBlockerPacketPath
                : null,
          }
        : null,
    awaitingHumanDecision:
      input.earliestHardBlocker && isHumanGate
        ? {
            gateCategory: input.earliestHardBlocker.key,
            decisionRequested: input.earliestHardBlocker.summary,
            recommendation:
              "Approve only after the named city posture, budget envelope, rights/privacy posture, live-send gate, and live-spend gate are acceptable.",
            evidencePacket,
            blockerId: `city-launch-approval-${slugifyCityName(input.city)}`,
            routingSurface: "founder inbox / Slack DM / repo-local no-send, depending on configured human-blocker delivery mode",
            watcherOwner: input.earliestHardBlocker.owner,
            resumeCondition: input.earliestHardBlocker.retryCondition,
            deadline: "Immediate",
          }
        : null,
  };
}

export async function runCityLaunchReadinessPreflight(input: {
  city: string;
  budgetTier?: string | CityLaunchBudgetTier | null;
  budgetMaxUsd?: number | null;
  operatorAutoApproveUsd?: number | null;
  windowHours?: string | number | null;
  founderApproved?: boolean | null;
  requireFounderApproval?: boolean | null;
  reportsRoot?: string;
  executionReportsRoot?: string | null;
  deps?: Partial<CityLaunchReadinessPreflightDeps>;
}): Promise<CityLaunchReadinessPreflightResult> {
  const deps = { ...defaultDeps, ...(input.deps || {}) };
  const city = input.city.trim();
  if (!city) {
    throw new Error("city is required");
  }

  const citySlug = slugifyCityName(city);
  const windowHours = resolveCityLaunchWindowHours(input.windowHours);
  const budgetTier = input.budgetTier
    ? normalizeCityLaunchBudgetTier(input.budgetTier)
    : null;
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: budgetTier,
    maxTotalApprovedUsd: input.budgetMaxUsd,
    operatorAutoApproveUsd: input.operatorAutoApproveUsd,
  });
  const profile = resolveCityLaunchProfile(city);
  const runDirectory = path.join(
    process.cwd(),
    "ops/paperclip/reports/city-launch-execution",
    citySlug,
    "preflight",
  );
  const gtmPaths = buildCityLaunchGtm72hArtifactPaths(profile, runDirectory);
  const targetLedgerPath = canonicalPlaybookPath(profile.targetLedgerPath);
  const cityOpeningFirstWavePackPath = cityOpeningArtifactPath(profile.key, "first-wave-pack");
  const cityOpeningBuyerLoopPath = cityOpeningArtifactPath(profile.key, "buyer-loop");
  const cityOpeningSendLedgerPath = cityOpeningArtifactPath(profile.key, "send-ledger");
  const cityOpeningChannelRegistryPath = cityOpeningArtifactPath(profile.key, "channel-registry");
  const executionReportsRoot = input.executionReportsRoot
    || path.join(process.cwd(), "ops/paperclip/reports/city-launch-execution");
  const founderDecisionPacketPath = await deps.findFounderDecisionPacket({
    citySlug,
    reportsRoot: executionReportsRoot,
  });
  const deepResearchBlockerPacketPath = await deps.findDeepResearchBlockerPacket({
    citySlug,
    reportsRoot: executionReportsRoot,
  });
  const checks: CityLaunchReadinessCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredInputs: string[] = [];

  if (input.budgetTier && !budgetTier) {
    const message = `Unsupported budget tier: ${input.budgetTier}. Use lean, standard, aggressive, or a legacy tier.`;
    blockers.push(message);
    requiredInputs.push("A valid budget tier: lean, standard, or aggressive.");
    checks.push({
      key: "budget_policy",
      status: "blocked",
      summary: message,
      nextAction: "Rerun with --budget-tier lean|standard|aggressive.",
    });
  } else {
    checks.push({
      key: "budget_policy",
      status: "ready",
      summary: `${budgetPolicy.label} budget policy resolves to max $${budgetPolicy.maxTotalApprovedUsd}.`,
    });
  }

  checks.push({
    key: "launch_window",
    status: "ready",
    summary: `CITY+BUDGET run uses the ${windowHours}h launch contract with 24h, 48h, and 72h scorecards.`,
  });

  const planning = await deps.resolvePlanningState({
    city,
    reportsRoot: input.reportsRoot,
  });
  warnings.push(...planning.warnings);
  const planningReady = Boolean(planning.completedArtifactPath);
  checks.push({
    key: "deep_research_playbook",
    status: planningReady ? "ready" : "blocked",
    summary: planningReady
      ? "A valid completed city playbook is available for activation reuse."
      : "No valid completed city playbook is available; Deep Research must run or credentials/account state must be fixed.",
    evidencePaths: [
      planning.completedArtifactPath,
      planning.latestArtifactPath,
      planning.manifestPath,
      deepResearchBlockerPacketPath,
    ].filter((entry): entry is string => Boolean(entry)),
    nextAction: planningReady
      ? null
      : "Run npm run city-launch:plan for this city, or provide a valid completed playbook.",
  });
  if (!planningReady) {
    blockers.push("No valid completed Deep Research playbook is available.");
    requiredInputs.push("Deep Research credentials/account access, or a valid existing city playbook.");
  }

  let research: CityLaunchResearchParseResult | null = null;
  if (planning.completedArtifactPath) {
    try {
      research = await deps.loadResearchArtifact({
        city,
        artifactPath: planning.completedArtifactPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blockers.push(`Completed playbook could not be parsed: ${message}`);
      checks.push({
        key: "activation_payload",
        status: "blocked",
        summary: `Completed playbook could not be parsed: ${message}`,
        evidencePaths: [planning.completedArtifactPath],
      });
    }
  }

  let launchSurfaceCoverage: CityLaunchLaunchSurfaceCoverageSummary = {
    status: "blocked",
    requiredSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
    coveredSurfaces: [],
    missingSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
    evidencePaths: [],
    nextAction: "Run npm run city-launch:plan for this city, or provide a valid completed playbook.",
  };

  if (research) {
    const coverage = requiredSurfaceSet(research);
    const coveredSurfaces = CITY_LAUNCH_REQUIRED_SURFACE_KEYS.filter(
      (surface) => coverage.has(surface),
    );
    const missingSurfaces = CITY_LAUNCH_REQUIRED_SURFACE_KEYS.filter(
      (surface) => !coverage.has(surface),
    );
    const activationPayloadReady = Boolean(research.activationPayload);
    const coverageReady = activationPayloadReady && missingSurfaces.length === 0;
    const coverageNextAction = coverageReady
      ? null
      : `Regenerate or fix the activation payload for: ${missingSurfaces.join(", ")}.`;
    launchSurfaceCoverage = {
      status: coverageReady ? "ready" : "blocked",
      requiredSurfaces: [...CITY_LAUNCH_REQUIRED_SURFACE_KEYS],
      coveredSurfaces,
      missingSurfaces,
      evidencePaths: [research.artifactPath],
      nextAction: coverageNextAction,
    };
    const playbookBudgetFit = summarizePlaybookBudgetFit({
      research,
      budgetPolicy,
    });
    checks.push({
      key: "activation_payload",
      status: activationPayloadReady ? "ready" : "blocked",
      summary: activationPayloadReady
        ? "Machine-readable activation payload is present."
        : "Machine-readable activation payload is missing.",
      evidencePaths: [research.artifactPath],
    });
    checks.push({
      key: "launch_surface_coverage",
      status: coverageReady ? "ready" : "blocked",
      summary: coverageReady
        ? "launch_surface_coverage covers every required city-launch surface."
        : `launch_surface_coverage is missing ${missingSurfaces.length} required surface(s).`,
      evidencePaths: [research.artifactPath],
      nextAction: coverageNextAction,
    });
    checks.push({
      key: "playbook_budget_fit",
      status: playbookBudgetFit.status,
      summary: playbookBudgetFit.summary,
      evidencePaths: [research.artifactPath],
      nextAction: playbookBudgetFit.nextAction,
    });
    if (!activationPayloadReady) {
      blockers.push("Activation payload is missing from the completed city playbook.");
    }
    if (!coverageReady) {
      blockers.push("launch_surface_coverage is incomplete.");
    }
    if (playbookBudgetFit.status === "blocked") {
      blockers.push(playbookBudgetFit.summary);
      requiredInputs.push(
        `A completed city playbook whose budget recommendations fit ${budgetPolicy.label} max ${formatUsd(budgetPolicy.maxTotalApprovedUsd)}, or founder approval to raise the budget.`,
      );
    } else if (playbookBudgetFit.status === "warning") {
      warnings.push(playbookBudgetFit.summary);
    }
  }

  const activation = await deps.readActivation(city).catch(() => null);
  const founderApproved = Boolean(input.founderApproved || activation?.founderApproved);
  const requireFounderApproval = input.requireFounderApproval !== false;
  if (requireFounderApproval && !founderApproved) {
    checks.push({
      key: "founder_approval",
      status: "awaiting_human_decision",
      summary: "Founder approval is required before activation, live sends, or live spend.",
      evidencePaths: founderDecisionPacketPath ? [founderDecisionPacketPath] : [],
      nextAction:
        "Use the founder decision packet and record APPROVE before running activation with live launch posture.",
    });
    requiredInputs.push("Founder approval for city posture, budget envelope, live sends, and live spend gates.");
  } else {
    checks.push({
      key: "founder_approval",
      status: "ready",
      summary: "Founder approval is present or not required for this preflight mode.",
      evidencePaths: founderDecisionPacketPath ? [founderDecisionPacketPath] : [],
    });
  }

  const activationStarted = activationLooksStarted(activation);
  const activationTaskIssueIds = activation?.taskIssueIds || {};
  const missingPaperclipTaskIssueKeys = CITY_LAUNCH_DEFAULT_ACTIVATION_TASK_KEYS.filter(
    (taskKey) => !activationTaskIssueIds[taskKey],
  );
  const paperclipIssueTreeReady = Boolean(activation?.rootIssueId)
    && missingPaperclipTaskIssueKeys.length === 0;
  checks.push({
    key: "paperclip_issue_tree",
    status:
      paperclipIssueTreeReady
        ? "ready"
        : activationStarted
          ? "blocked"
          : "not_due",
    summary:
      paperclipIssueTreeReady
        ? `Paperclip root issue and all ${CITY_LAUNCH_DEFAULT_ACTIVATION_TASK_KEYS.length} delegated child issue ids are recorded.`
        : activationStarted
          ? !activation?.rootIssueId
            ? "Activation started but Paperclip root issue id is missing."
            : `Activation started but Paperclip child issue ids are missing for ${missingPaperclipTaskIssueKeys.length} required task(s): ${missingPaperclipTaskIssueKeys.join(", ")}.`
          : "Paperclip issue tree is not due until activation runs.",
    evidencePaths: activation?.rootIssueId ? [`cityLaunchActivations/${citySlug}`] : [],
    collectionNames: ["cityLaunchActivations"],
  });
  if (activationStarted && !activation?.rootIssueId) {
    blockers.push("Activation started but Paperclip root issue id is missing.");
  }
  if (activationStarted && activation?.rootIssueId && missingPaperclipTaskIssueKeys.length > 0) {
    blockers.push(
      `Activation started but Paperclip child issue ids are missing for required task(s): ${missingPaperclipTaskIssueKeys.join(", ")}.`,
    );
    pushUnique(
      requiredInputs,
      "Paperclip delegated child issue ids for every default city-launch activation task.",
    );
  }

  const sendActions = await deps.listSendActions(city).catch(() => [] as CityLaunchSendActionRecord[]);
  const outboundReadiness = assessCityLaunchOutboundReadiness({ city, sendActions });
  checks.push({
    key: "recipient_backed_outreach",
    status: outboundReadiness.status === "ready" ? "ready" : outboundReadiness.status,
    summary:
      outboundReadiness.directOutreachActions.recipientBacked > 0
        ? `${outboundReadiness.directOutreachActions.recipientBacked} recipient-backed direct-outreach action(s) are in the city send ledger.`
        : "No recipient-backed direct-outreach action is available for live first-wave outreach.",
    collectionNames: ["cityLaunchSendActions"],
  });
  if (outboundReadiness.status === "blocked") {
    blockers.push(...outboundReadiness.blockers);
    for (const blocker of outboundReadiness.blockers) {
      if (/recipient-backed|recipient emails/i.test(blocker)) {
        pushUnique(requiredInputs, "Recipient-backed direct outreach evidence; no fake or placeholder emails.");
      }
      if (/sender|transport/i.test(blocker)) {
        pushUnique(requiredInputs, "Verified live sender/domain and configured email transport.");
      }
    }
  }
  warnings.push(...outboundReadiness.warnings);
  if (outboundReadiness.directOutreachActions.approvalNeeded > 0) {
    const message =
      `${outboundReadiness.directOutreachActions.approvalNeeded} recipient-backed direct-outreach action(s) still require founder first-send approval in cityLaunchSendActions.`;
    checks.push({
      key: "founder_first_send_approval",
      status: "awaiting_human_decision",
      summary: message,
      collectionNames: ["cityLaunchSendActions"],
      nextAction:
        "Approve the exact send action ids with npm run city-launch:send -- --city \"CITY\" --mode approve --action-id ACTION_ID after founder approval is recorded.",
    });
    pushUnique(
      requiredInputs,
      "Founder first-send approval recorded on each recipient-backed direct outreach action before live dispatch.",
    );
  } else if (outboundReadiness.directOutreachActions.recipientBacked > 0) {
    checks.push({
      key: "founder_first_send_approval",
      status: "ready",
      summary: "Recipient-backed direct-outreach actions do not have pending first-send approval gates.",
      collectionNames: ["cityLaunchSendActions"],
    });
  }

  let replyDurability: CityLaunchReadinessPreflightResult["replyDurability"] = null;
  try {
    const durability = await deps.buildReplyDurabilityStatus();
    replyDurability = {
      ok: durability.ok,
      status: durability.status,
      blockers: durability.blockers,
      warnings: durability.warnings,
      missingEnv: durability.missingEnv,
      proofCommands: durability.proofCommands,
    };
    checks.push({
      key: "reply_durability",
      status: durability.ok ? "ready" : "blocked",
      summary: durability.ok
        ? "Outbound reply durability is production-ready."
        : "Outbound reply durability is blocked for live sends and resume.",
      nextAction: durability.ok
        ? null
        : "Run npm run human-replies:audit-durability and configure the missing env/account inputs.",
    });
    if (!durability.ok) {
      blockers.push(...durability.blockers);
      requiredInputs.push(...durability.missingEnv);
    }
    warnings.push(...durability.warnings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(`Reply durability audit failed: ${message}`);
    checks.push({
      key: "reply_durability",
      status: "blocked",
      summary: `Reply durability audit failed: ${message}`,
    });
  }

  const expectedArtifacts = [
    { key: "gtm_72h_contract", path: gtmPaths.canonical.contractMarkdownPath },
    { key: "ad_studio_creative_handoff", path: gtmPaths.canonical.adStudioCreativeHandoffPath },
    { key: "meta_ads_readiness", path: gtmPaths.canonical.metaAdsReadinessPath },
    { key: "scorecard_window_manifest", path: gtmPaths.canonical.scorecardManifestPath },
    ...CITY_LAUNCH_GTM_CHECKPOINT_HOURS.map((hour) => ({
      key: `scorecard_${hour}h`,
      path: gtmPaths.canonical.scorecardPaths[`${hour}h`],
    })),
  ];
  const artifactStates = await Promise.all(
    expectedArtifacts.map(async (artifact) => ({
      ...artifact,
      exists: await deps.fileExists(artifact.path),
    })),
  );
  const canonicalScorecardJsonPaths = scorecardJsonPathsForResult(gtmPaths);
  const creativeAdsEvidence = await deps.findLatestCreativeAdsEvidence({
    citySlug,
    reportsRoot: executionReportsRoot,
  });
  const scorecardCloseouts = await deps.findScorecardCloseouts({
    citySlug,
    reportsRoot: executionReportsRoot,
    canonicalScorecardJsonPaths,
  });
  const cityOpeningArtifacts = [
    { key: "target_ledger", path: targetLedgerPath },
    { key: "first_wave_pack", path: cityOpeningFirstWavePackPath },
    { key: "buyer_loop", path: cityOpeningBuyerLoopPath },
    { key: "send_ledger", path: cityOpeningSendLedgerPath },
    { key: "channel_registry", path: cityOpeningChannelRegistryPath },
  ];
  const cityOpeningArtifactStates = await Promise.all(
    cityOpeningArtifacts.map(async (artifact) => ({
      ...artifact,
      exists: await deps.fileExists(artifact.path),
    })),
  );
  const artifactSummary = summarizeArtifactStatus({
    activationStarted,
    present: artifactStates,
  });
  checks.push({
    key: "gtm_72h_artifacts",
    status: artifactSummary.status,
    summary: artifactSummary.summary,
    evidencePaths: expectedArtifacts.map((artifact) => artifact.path),
    collectionNames: CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map((source) => source.collection),
  });
  if (artifactSummary.status === "blocked") {
    blockers.push(artifactSummary.summary);
  } else if (artifactSummary.status === "not_due") {
    warnings.push(artifactSummary.summary);
  }

  const adStudioStatus = adStudioCloseoutStatus({
    activationStarted,
    snapshot: creativeAdsEvidence,
  });
  checks.push({
    key: "ad_studio_claims_review_handoff",
    status: adStudioStatus.status,
    summary: adStudioStatus.summary,
    evidencePaths: uniqueValues([
      gtmPaths.canonical.adStudioCreativeHandoffPath,
      ...evidenceSnapshotPaths(creativeAdsEvidence),
    ]),
    collectionNames: ["ad_studio_runs"],
    nextAction: adStudioStatus.nextAction,
  });
  if (adStudioStatus.status === "blocked") {
    blockers.push(adStudioStatus.summary);
  }

  const metaStatus = metaAdsCloseoutStatus({
    activationStarted,
    snapshot: creativeAdsEvidence,
  });
  checks.push({
    key: "meta_ads_read_only_paused_draft",
    status: metaStatus.status,
    summary: metaStatus.summary,
    evidencePaths: uniqueValues([
      gtmPaths.canonical.metaAdsReadinessPath,
      ...evidenceSnapshotPaths(creativeAdsEvidence),
    ]),
    collectionNames: ["meta_ads_cli_runs"],
    nextAction: metaStatus.nextAction,
  });
  if (metaStatus.status === "blocked") {
    blockers.push(metaStatus.summary);
  } else if (metaStatus.status === "awaiting_human_decision") {
    pushUnique(
      requiredInputs,
      "Founder approval for paused Meta draft posture before any draft creation.",
    );
  }

  const scorecardStatus = scorecardCloseoutStatus({
    activationStarted,
    snapshots: scorecardCloseouts,
  });
  const scorecardCloseoutEvidencePaths = uniqueValues([
    gtmPaths.canonical.scorecardManifestPath,
    ...Object.values(gtmPaths.canonical.scorecardPaths),
    ...Object.values(canonicalScorecardJsonPaths),
    ...Object.values(scorecardCloseouts).flatMap((snapshot) => evidenceSnapshotPaths(snapshot)),
  ]);
  checks.push({
    key: "scorecards_24_48_72",
    status: scorecardStatus.status,
    summary: scorecardStatus.summary,
    evidencePaths: scorecardCloseoutEvidencePaths,
    collectionNames: CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map((source) => source.collection),
    nextAction: scorecardStatus.nextAction,
  });
  if (scorecardStatus.status === "blocked") {
    blockers.push(scorecardStatus.summary);
  } else if (scorecardStatus.status === "not_due") {
    warnings.push(scorecardStatus.summary);
  }

  checks.push({
    key: "firestore_admin_evidence",
    status:
      scorecardStatus.status === "blocked"
        ? "blocked"
        : scorecardStatus.status === "ready"
          ? "ready"
          : "not_due",
    summary:
      scorecardStatus.status === "blocked"
        ? "Firestore/admin evidence queries are blocked in one or more scorecard closeouts."
        : scorecardStatus.status === "ready"
          ? "Firestore/admin evidence was queried by the completed scorecard closeouts."
          : "Firestore/admin evidence is named by collection/query and remains not due until checkpoint closeouts run.",
    evidencePaths: scorecardCloseoutEvidencePaths,
    collectionNames: CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map((source) => source.collection),
    nextAction:
      scorecardStatus.status === "ready"
        ? null
        : scorecardStatus.nextAction,
  });

  const gtmCheck = checkByKey(checks, "gtm_72h_artifacts");
  const budgetCheck = checkByKey(checks, "budget_policy");
  const launchWindowCheck = checkByKey(checks, "launch_window");
  const deepResearchCheck = checkByKey(checks, "deep_research_playbook");
  const activationPayloadCheck = checkByKey(checks, "activation_payload");
  const coverageCheck = checkByKey(checks, "launch_surface_coverage");
  const playbookBudgetFitCheck = checkByKey(checks, "playbook_budget_fit");
  const paperclipIssueTreeCheck = checkByKey(checks, "paperclip_issue_tree");
  const outreachCheck = checkByKey(checks, "recipient_backed_outreach");
  const founderApprovalCheck = checkByKey(checks, "founder_approval");
  const founderFirstSendApprovalCheck = checkByKey(checks, "founder_first_send_approval");
  const adStudioCheck = checkByKey(checks, "ad_studio_claims_review_handoff");
  const metaAdsCheck = checkByKey(checks, "meta_ads_read_only_paused_draft");
  const firestoreEvidenceCheck = checkByKey(checks, "firestore_admin_evidence");
  const scorecardsCheck = checkByKey(checks, "scorecards_24_48_72");
  const allCityOpeningArtifactsExist = cityOpeningArtifactStates.every((entry) => entry.exists);
  const launchPlanUsable = planningReady && playbookBudgetFitCheck?.status !== "blocked";
  const targetPackStatus: CityLaunchReadinessCheckStatus = planningReady
    ? !launchPlanUsable
      ? "blocked"
      : allCityOpeningArtifactsExist
      ? "ready"
      : "blocked"
    : "blocked";
  const targetPackSummary = planningReady
    ? !launchPlanUsable
      ? "Target and distribution artifacts are not launch-valid until the completed playbook fits the founder-provided budget contract."
      : allCityOpeningArtifactsExist
      ? "Target ledger, distribution pack, buyer loop, send ledger, and channel registry artifacts exist."
      : `Missing city-opening artifact(s): ${cityOpeningArtifactStates.filter((entry) => !entry.exists).map((entry) => entry.key).join(", ")}.`
    : "Target and distribution artifacts are not launch-valid until a completed Deep Research playbook passes validation.";
  const communityArtifactStatus: CityLaunchReadinessCheckStatus = planningReady
    ? !launchPlanUsable
      ? "blocked"
      : cityOpeningArtifactStates.find((entry) => entry.key === "first_wave_pack")?.exists
      && cityOpeningArtifactStates.find((entry) => entry.key === "channel_registry")?.exists
      ? "ready"
      : "blocked"
    : "blocked";
  const founderDecisionStatus =
    founderFirstSendApprovalCheck?.status === "awaiting_human_decision"
      ? founderFirstSendApprovalCheck.status
      : founderApprovalCheck?.status || "blocked";
  const founderDecisionSummary =
    founderFirstSendApprovalCheck?.status === "awaiting_human_decision"
      ? founderFirstSendApprovalCheck.summary
      : founderApprovalCheck?.summary || "Founder approval check was not produced.";
  const founderDecisionNextAction =
    founderFirstSendApprovalCheck?.nextAction
    || founderApprovalCheck?.nextAction
    || null;
  const founderDecisionEvidencePaths =
    founderFirstSendApprovalCheck?.evidencePaths
    || founderApprovalCheck?.evidencePaths
    || [];
  const gtmCollections = CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map((source) => source.collection);
  const promptToArtifactChecklist: CityLaunchPromptArtifactChecklistItem[] = [
    {
      key: "city_budget_window",
      promptRequirement:
        "Founder provides one city and one budget tier/max, with WINDOW_HOURS=72, before any city launch loop starts.",
      status:
        budgetCheck?.status === "blocked"
        || launchWindowCheck?.status === "blocked"
        || playbookBudgetFitCheck?.status === "blocked"
          ? "blocked"
          : "ready",
      summary: [
        `${budgetPolicy.label} budget policy, max ${formatUsd(budgetPolicy.maxTotalApprovedUsd)}, ${windowHours}h window.`,
        playbookBudgetFitCheck?.summary,
      ].filter(Boolean).join(" "),
      evidencePaths: playbookBudgetFitCheck?.evidencePaths || [],
      collectionNames: [],
      queryNames: [],
      command:
        `npm run city-launch:run -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --require-founder-approval`,
      nextAction:
        budgetCheck?.nextAction
        || launchWindowCheck?.nextAction
        || playbookBudgetFitCheck?.nextAction
        || null,
    },
    {
      key: "deep_research_city_plan",
      promptRequirement:
        "Run Deep Research through the configured harness, reuse a valid completed playbook, or stop with an evidence-backed blocker packet.",
      status: deepResearchCheck?.status || "blocked",
      summary: deepResearchCheck?.summary || "Deep Research playbook check was not produced.",
      evidencePaths: deepResearchCheck?.evidencePaths || [],
      collectionNames: ["humanBlockerThreads", "humanBlockerDispatches"],
      queryNames: ["human_blocker_thread", "human_blocker_dispatch"],
      command: `npm run city-launch:run -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --phase plan`,
      nextAction: deepResearchCheck?.nextAction || null,
    },
    {
      key: "canonical_activation_payload",
      promptRequirement:
        "Produce or verify the canonical machine-readable activation payload for the city launch.",
      status: activationPayloadCheck?.status || (planningReady ? "blocked" : "blocked"),
      summary:
        activationPayloadCheck?.summary
        || "Activation payload is not available until a completed playbook parses cleanly.",
      evidencePaths: activationPayloadCheck?.evidencePaths || [planning.completedArtifactPath].filter((entry): entry is string => Boolean(entry)),
      collectionNames: [],
      queryNames: [],
      command: `npm run city-launch:run -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --phase plan`,
      nextAction: activationPayloadCheck?.nextAction || deepResearchCheck?.nextAction || null,
    },
    {
      key: "launch_surface_coverage",
      promptRequirement:
        "Verify launch_surface_coverage for every required city-launch lane and delegation surface.",
      status: coverageCheck?.status || "blocked",
      summary:
        coverageCheck?.summary
        || "launch_surface_coverage is not available until the activation payload is parsed.",
      evidencePaths: coverageCheck?.evidencePaths || [research?.artifactPath].filter((entry): entry is string => Boolean(entry)),
      collectionNames: [],
      queryNames: [],
      command: `npm run city-launch:run -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --phase plan`,
      nextAction: coverageCheck?.nextAction || deepResearchCheck?.nextAction || null,
    },
    {
      key: "paperclip_issue_tree",
      promptRequirement:
        "Dispatch a Paperclip root issue and delegated child issue tree before claiming agents can run the city launch work.",
      status: paperclipIssueTreeCheck?.status || "not_due",
      summary: paperclipIssueTreeCheck?.summary || "Paperclip issue tree check was not produced.",
      evidencePaths: paperclipIssueTreeCheck?.evidencePaths || [],
      collectionNames: ["cityLaunchActivations"],
      queryNames: ["city_launch_activation"],
      nextAction: paperclipIssueTreeCheck?.nextAction || null,
    },
    {
      key: "target_ledger_distribution_pack",
      promptRequirement:
        "Produce or verify the target ledger and city-opening distribution pack with exact artifact paths.",
      status: targetPackStatus,
      summary: targetPackSummary,
      evidencePaths: cityOpeningArtifacts.map((artifact) => artifact.path),
      collectionNames: ["cityLaunchProspects", "cityLaunchBuyerTargets", "cityLaunchTouches"],
      queryNames: ["city_launch_prospects", "city_launch_buyer_targets", "city_launch_touches"],
      nextAction: targetPackStatus === "ready" ? null : "Run activation after a valid Deep Research playbook is available.",
    },
    {
      key: "recipient_backed_direct_outreach",
      promptRequirement:
        "Verify recipient-backed direct outreach ledger with no fake or placeholder emails before live first sends.",
      status: outreachCheck?.status || "blocked",
      summary: outreachCheck?.summary || "Recipient-backed outreach check was not produced.",
      evidencePaths: [],
      collectionNames: ["cityLaunchSendActions"],
      queryNames: ["city_launch_send_actions"],
      nextAction: outreachCheck?.nextAction || "Provide recipient-backed contact evidence; no invented emails.",
    },
    {
      key: "reply_durability_resume",
      promptRequirement:
        "Verify durable reply handling, correlation, and resume ownership before counting live replies or auto-resuming blocked city-launch lanes.",
      status: checkByKey(checks, "reply_durability")?.status || "blocked",
      summary:
        checkByKey(checks, "reply_durability")?.summary
        || "Reply durability check was not produced.",
      evidencePaths: [],
      collectionNames: ["humanBlockerThreads", "humanReplyEvents"],
      queryNames: ["human_blocker_threads_open", "human_reply_events_by_blocker"],
      command: "npm run human-replies:audit-durability",
      nextAction:
        checkByKey(checks, "reply_durability")?.nextAction
        || "Configure durable reply watcher credentials and rerun npm run human-replies:audit-durability.",
    },
    {
      key: "community_social_artifact_only",
      promptRequirement:
        "Mark community/social publication tasks artifact-only unless a real publication connector and proof record exist.",
      status: communityArtifactStatus,
      summary:
        communityArtifactStatus === "ready"
          ? "Community/social lane is represented by distribution artifacts only; no external publication is claimed."
          : "Community/social artifact-only lane is not launch-valid until distribution artifacts exist from a valid activation.",
      evidencePaths: [cityOpeningFirstWavePackPath, cityOpeningChannelRegistryPath],
      collectionNames: ["cityLaunchSendActions"],
      queryNames: ["city_launch_send_actions"],
      artifactOnly: true,
      nextAction: communityArtifactStatus === "ready" ? null : "Run activation after a valid Deep Research playbook is available.",
    },
    {
      key: "ad_studio_claims_review_handoff",
      promptRequirement:
        "Run Ad Studio with claims review and image/video handoff; generated creative is marketing material, not ground truth.",
      status: adStudioCheck?.status || "blocked",
      summary:
        adStudioCheck?.summary
        || "Ad Studio closeout check was not produced.",
      evidencePaths:
        adStudioCheck?.evidencePaths
        || [gtmPaths.canonical.adStudioCreativeHandoffPath],
      collectionNames: ["ad_studio_runs"],
      queryNames: evidenceQueryNames(["ad_studio_runs"]),
      command:
        `npm run city-launch:creative-ads -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --allow-blocked`,
      nextAction:
        adStudioCheck?.nextAction
        || "Run the city-launch creative/ad evidence writer, then create or update a real Ad Studio run only after city posture and claims review are valid.",
    },
    {
      key: "meta_ads_read_only_paused_draft",
      promptRequirement:
        "Run Meta Ads CLI read-only proof and paused draft creation only when policy/env allow it; never claim live spend from drafts.",
      status: metaAdsCheck?.status || "blocked",
      summary:
        metaAdsCheck?.summary
        || "Meta Ads closeout check was not produced.",
      evidencePaths:
        metaAdsCheck?.evidencePaths
        || [gtmPaths.canonical.metaAdsReadinessPath],
      collectionNames: ["meta_ads_cli_runs"],
      queryNames: evidenceQueryNames(["meta_ads_cli_runs"]),
      command:
        `npm run city-launch:creative-ads -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --run-meta-read-only --allow-blocked`,
      nextAction:
        metaAdsCheck?.nextAction
        || "Configure Meta Ads CLI env, run read-only proof through the evidence writer, and keep drafts paused unless founder-approved budget posture exists.",
    },
    {
      key: "founder_decision_packet",
      promptRequirement:
        "Generate a founder decision packet for city posture, budget, rights/privacy exceptions, live sends, and live paid spend gates.",
      status: founderDecisionStatus,
      summary: founderDecisionSummary,
      evidencePaths: founderDecisionEvidencePaths,
      collectionNames: ["humanBlockerThreads", "cityLaunchActivations"],
      queryNames: ["human_blocker_thread", "city_launch_activation"],
      command:
        `npm run city-launch:run -- --city "${city}" --budget-tier ${budgetPolicy.tier} --budget-max-usd ${budgetPolicy.maxTotalApprovedUsd} --window-hours ${windowHours} --phase approve --require-founder-approval`,
      nextAction: founderDecisionNextAction,
    },
    {
      key: "firestore_admin_evidence",
      promptRequirement:
        "Verify Firestore/admin evidence for waitlist, signups, CTA responses, sends, replies, spend, creative, and Meta provenance.",
      status: firestoreEvidenceCheck?.status || "blocked",
      summary:
        firestoreEvidenceCheck?.summary
        || "Firestore/admin evidence check was not produced.",
      evidencePaths:
        firestoreEvidenceCheck?.evidencePaths
        || [gtmPaths.canonical.scorecardManifestPath],
      collectionNames: gtmCollections,
      queryNames: evidenceQueryNames(gtmCollections),
      nextAction:
        firestoreEvidenceCheck?.nextAction
        || "Query the named collections for the city after the relevant 24/48/72h window closes.",
    },
    {
      key: "scorecards_24_48_72",
      promptRequirement:
        "Produce 24h, 48h, and 72h scorecards with exact artifact paths and collection/query names.",
      status: scorecardsCheck?.status || "blocked",
      summary:
        scorecardsCheck?.summary
        || gtmCheck?.summary
        || "72h scorecard artifact check was not produced.",
      evidencePaths:
        scorecardsCheck?.evidencePaths
        || [
          gtmPaths.canonical.scorecardManifestPath,
          ...Object.values(gtmPaths.canonical.scorecardPaths),
        ],
      collectionNames: gtmCollections,
      queryNames: evidenceQueryNames(gtmCollections),
      command:
        CITY_LAUNCH_GTM_CHECKPOINT_HOURS.map((hour) =>
          `npm run city-launch:scorecard -- --city "${city}" --checkpoint-hour ${hour} --allow-blocked`,
        ).join(" && "),
      nextAction:
        scorecardsCheck?.nextAction
        || gtmCheck?.nextAction
        || "Close each scorecard with npm run city-launch:scorecard after the checkpoint window closes; early snapshots are not performance proof.",
    },
  ];
  const earliestHardBlocker = buildEarliestHardBlocker({
    checklist: promptToArtifactChecklist,
    requiredInputs,
  });
  const earliestHardBlockerKey = earliestHardBlocker?.key || null;

  const hasBlockingCheck = checks.some((check) => check.status === "blocked");
  const hasFounderGate = checks.some((check) => check.status === "awaiting_human_decision");
  const status: CityLaunchReadinessPreflightStatus = hasBlockingCheck
    ? "blocked"
    : hasFounderGate
      ? "awaiting_human_decision"
      : "ready";
  const evidencePaths = {
    completedPlaybookPath: planning.completedArtifactPath,
    activationPayloadPath: research?.artifactPath || null,
    deepResearchBlockerPacketPath,
    founderDecisionPacketPath,
    gtm72hContractPath: gtmPaths.canonical.contractMarkdownPath,
    adStudioCreativeHandoffPath: gtmPaths.canonical.adStudioCreativeHandoffPath,
    metaAdsReadinessPath: gtmPaths.canonical.metaAdsReadinessPath,
    scorecardWindowManifestPath: gtmPaths.canonical.scorecardManifestPath,
    scorecardPaths: scorecardPathsForResult(gtmPaths),
  };
  const autonomousLoopCloseout = buildAutonomousLoopCloseout({
    city,
    budgetPolicy,
    windowHours,
    status,
    promptToArtifactChecklist,
    earliestHardBlocker,
    requiredInputs,
    evidencePaths,
  });

  return {
    city,
    citySlug,
    generatedAt: new Date().toISOString(),
    status,
    budgetPolicy,
    founderApproved,
    windowHours,
    checks,
    promptToArtifactChecklist,
    earliestHardBlocker,
    earliestHardBlockerKey,
    launchSurfaceCoverage,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    requiredInputs: [...new Set(requiredInputs.filter(Boolean))],
    evidencePaths,
    planning: {
      status: planning.status,
      latestArtifactPath: planning.latestArtifactPath,
      completedArtifactPath: planning.completedArtifactPath,
      warnings: planning.warnings,
    },
    outboundReadiness,
    replyDurability,
    autonomousLoopCloseout,
  };
}
