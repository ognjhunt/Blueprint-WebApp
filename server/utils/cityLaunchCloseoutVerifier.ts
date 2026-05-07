import { promises as fs } from "node:fs";

import type {
  CityLaunchAutonomousLoopCloseout,
  CityLaunchPromptArtifactChecklistItem,
  CityLaunchReadinessPreflightResult,
} from "./cityLaunchReadinessPreflight";

export const CITY_LAUNCH_CLOSEOUT_VERIFIER_SCHEMA_VERSION =
  "2026-05-06.city-launch-closeout-verifier.v1";

export const CITY_LAUNCH_REQUIRED_PROMPT_TO_ARTIFACT_KEYS = [
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
] as const;

export type CityLaunchCloseoutVerifierStatus = "pass" | "fail";

export type CityLaunchCloseoutVerification = {
  schemaVersion: typeof CITY_LAUNCH_CLOSEOUT_VERIFIER_SCHEMA_VERSION;
  status: CityLaunchCloseoutVerifierStatus;
  reportJsonPath: string;
  city: string | null;
  citySlug: string | null;
  stateClaim: CityLaunchAutonomousLoopCloseout["stateClaim"] | null;
  readinessStatus: CityLaunchReadinessPreflightResult["status"] | null;
  requireReady: boolean;
  failures: string[];
  warnings: string[];
  coveredRequirementKeys: string[];
  missingRequirementKeys: string[];
  nonReadyRequirementKeys: string[];
  earliestHardBlockerKey: string | null;
};

type ReportPayload = CityLaunchReadinessPreflightResult & {
  reportArtifacts?: {
    jsonPath?: string | null;
    markdownPath?: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function checklistItems(report: ReportPayload) {
  return Array.isArray(report.promptToArtifactChecklist)
    ? report.promptToArtifactChecklist
    : [];
}

function checklistEvidencePresent(item: CityLaunchPromptArtifactChecklistItem) {
  return (
    item.evidencePaths.length > 0
    || item.collectionNames.length > 0
    || item.queryNames.length > 0
    || nonEmptyString(item.command)
  );
}

function claimExpectedForStatus(status: CityLaunchReadinessPreflightResult["status"]) {
  if (status === "ready") return "done";
  return status;
}

function validateBlockedCloseout(input: {
  report: ReportPayload;
  failures: string[];
}) {
  const blocked = input.report.autonomousLoopCloseout?.blocked;
  const earliestHardBlocker = input.report.earliestHardBlocker;
  if (!earliestHardBlocker) {
    input.failures.push("Blocked closeout is missing earliestHardBlocker.");
  }
  if (!blocked) {
    input.failures.push("Blocked closeout is missing autonomousLoopCloseout.blocked.");
    return;
  }
  if (!nonEmptyString(blocked.earliestHardStop)) {
    input.failures.push("Blocked closeout is missing earliestHardStop.");
  }
  if (!nonEmptyString(blocked.whyNoReversibleWorkRemains)) {
    input.failures.push("Blocked closeout is missing whyNoReversibleWorkRemains.");
  }
  if (!nonEmptyString(blocked.owner)) {
    input.failures.push("Blocked closeout is missing owner.");
  }
  if (!nonEmptyString(blocked.retryResumeCondition)) {
    input.failures.push("Blocked closeout is missing retryResumeCondition.");
  }
  if (!Array.isArray(blocked.nextRequiredInput) || blocked.nextRequiredInput.length === 0) {
    input.failures.push("Blocked closeout is missing nextRequiredInput.");
  }
  const hasBlockerEvidence = Boolean(
    earliestHardBlocker
    && (
      earliestHardBlocker.evidencePaths.length > 0
      || earliestHardBlocker.collectionNames.length > 0
      || earliestHardBlocker.queryNames.length > 0
    ),
  );
  if (!hasBlockerEvidence) {
    input.failures.push("Blocked closeout is missing evidence paths, collections, or query names for the earliest hard blocker.");
  }
  if (earliestHardBlocker?.key === "deep_research_city_plan") {
    const blockerEvidencePaths = [
      ...earliestHardBlocker.evidencePaths,
      blocked.linkedFollowUp,
    ].filter((entry): entry is string => nonEmptyString(entry));
    const hasDeepResearchBlockerPacket = blockerEvidencePaths.some((entry) =>
      entry.endsWith("deep-research-blocker-packet.md"),
    );
    if (!hasDeepResearchBlockerPacket) {
      input.failures.push(
        "Deep Research blocked closeout must include a deep-research-blocker-packet.md path before it can pass verification.",
      );
    }
  }
}

function validateAwaitingHumanCloseout(input: {
  report: ReportPayload;
  failures: string[];
}) {
  const awaiting = input.report.autonomousLoopCloseout?.awaitingHumanDecision;
  if (!awaiting) {
    input.failures.push("Awaiting-human-decision closeout is missing autonomousLoopCloseout.awaitingHumanDecision.");
    return;
  }
  for (const key of [
    "gateCategory",
    "decisionRequested",
    "recommendation",
    "blockerId",
    "routingSurface",
    "watcherOwner",
    "resumeCondition",
    "deadline",
  ] as const) {
    if (!nonEmptyString(awaiting[key])) {
      input.failures.push(`Awaiting-human-decision closeout is missing ${key}.`);
    }
  }
  if (!nonEmptyString(awaiting.evidencePacket)) {
    input.failures.push("Awaiting-human-decision closeout is missing evidencePacket.");
  }
}

function validateRootBlockerKey(input: {
  report: ReportPayload;
  failures: string[];
}) {
  const rootKey = input.report.earliestHardBlockerKey;
  const nestedKey = input.report.earliestHardBlocker?.key || null;
  if (rootKey !== nestedKey) {
    input.failures.push(
      `Root earliestHardBlockerKey ${rootKey || "none"} does not match earliestHardBlocker.key ${nestedKey || "none"}.`,
    );
  }
  if (input.report.status === "ready" && rootKey) {
    input.failures.push("Ready closeout must not include earliestHardBlockerKey.");
  }
  if (input.report.status === "blocked" && !rootKey) {
    input.failures.push("Blocked closeout is missing earliestHardBlockerKey.");
  }
}

function validateLaunchSurfaceCoverage(input: {
  report: ReportPayload;
  items: CityLaunchPromptArtifactChecklistItem[];
  failures: string[];
}) {
  const coverage = input.report.launchSurfaceCoverage;
  const checklistItem = input.items.find((item) => item.key === "launch_surface_coverage");
  if (!coverage) {
    input.failures.push("Report is missing launchSurfaceCoverage.");
    return;
  }
  if (!Array.isArray(coverage.requiredSurfaces) || coverage.requiredSurfaces.length === 0) {
    input.failures.push("launchSurfaceCoverage is missing requiredSurfaces.");
  }
  if (!Array.isArray(coverage.coveredSurfaces)) {
    input.failures.push("launchSurfaceCoverage is missing coveredSurfaces.");
  }
  if (!Array.isArray(coverage.missingSurfaces)) {
    input.failures.push("launchSurfaceCoverage is missing missingSurfaces.");
  }
  if (checklistItem && coverage.status !== checklistItem.status) {
    input.failures.push(
      `launchSurfaceCoverage.status ${coverage.status} does not match checklist status ${checklistItem.status}.`,
    );
  }
  if (coverage.status === "ready" && coverage.missingSurfaces.length > 0) {
    input.failures.push("Ready launchSurfaceCoverage must not include missingSurfaces.");
  }
  const required = new Set(coverage.requiredSurfaces || []);
  const coveredAndMissing = new Set([
    ...(coverage.coveredSurfaces || []),
    ...(coverage.missingSurfaces || []),
  ]);
  for (const surface of required) {
    if (!coveredAndMissing.has(surface)) {
      input.failures.push(`launchSurfaceCoverage required surface ${surface} is neither covered nor missing.`);
    }
  }
}

export function verifyCityLaunchReadinessCloseout(input: {
  report: ReportPayload;
  reportJsonPath: string;
  requireReady?: boolean | null;
}): CityLaunchCloseoutVerification {
  const failures: string[] = [];
  const warnings: string[] = [];
  const report = input.report;
  const closeout = report.autonomousLoopCloseout;

  if (!nonEmptyString(report.city)) {
    failures.push("Report is missing city.");
  }
  if (!nonEmptyString(report.citySlug)) {
    failures.push("Report is missing citySlug.");
  }
  if (report.windowHours !== 72) {
    failures.push("Report windowHours must be 72.");
  }
  if (!isRecord(report.budgetPolicy) || !nonEmptyString(report.budgetPolicy.tier)) {
    failures.push("Report is missing budgetPolicy.tier.");
  }
  if (!closeout) {
    failures.push("Report is missing autonomousLoopCloseout.");
  }
  validateRootBlockerKey({ report, failures });

  const items = checklistItems(report);
  const coveredRequirementKeys = items.map((item) => item.key);
  const coveredKeySet = new Set(coveredRequirementKeys);
  const missingRequirementKeys = CITY_LAUNCH_REQUIRED_PROMPT_TO_ARTIFACT_KEYS.filter(
    (key) => !coveredKeySet.has(key),
  );
  const nonReadyRequirementKeys = items
    .filter((item) => item.status !== "ready")
    .map((item) => item.key);

  if (missingRequirementKeys.length > 0) {
    failures.push(`Prompt-to-artifact checklist is missing required key(s): ${missingRequirementKeys.join(", ")}.`);
  }
  for (const item of items) {
    if (!nonEmptyString(item.promptRequirement)) {
      failures.push(`Checklist item ${item.key} is missing promptRequirement.`);
    }
    if (!checklistEvidencePresent(item)) {
      warnings.push(`Checklist item ${item.key} has no evidence path, collection, query, or command.`);
    }
  }
  validateLaunchSurfaceCoverage({ report, items, failures });

  if (closeout) {
    const expectedClaim = claimExpectedForStatus(report.status);
    if (closeout.stateClaim !== expectedClaim) {
      failures.push(
        `Closeout stateClaim ${closeout.stateClaim} does not match readiness status ${report.status}; expected ${expectedClaim}.`,
      );
    }
    if (!nonEmptyString(closeout.objective)) {
      failures.push("Closeout is missing objective.");
    }
    if (!nonEmptyString(closeout.stageReached)) {
      failures.push("Closeout is missing stageReached.");
    }
    if (!Array.isArray(closeout.durableEvidence) || closeout.durableEvidence.length === 0) {
      failures.push("Closeout is missing durableEvidence.");
    }
    if (!Array.isArray(closeout.verification) || closeout.verification.length === 0) {
      failures.push("Closeout is missing verification.");
    }
    if (!Array.isArray(closeout.requirementCoverage) || closeout.requirementCoverage.length === 0) {
      failures.push("Closeout is missing requirementCoverage.");
    }
    if (!nonEmptyString(closeout.nextAction)) {
      failures.push("Closeout is missing nextAction.");
    }
    if (!Array.isArray(closeout.residualRisk) || closeout.residualRisk.length === 0) {
      failures.push("Closeout is missing residualRisk.");
    }
    if (closeout.stateClaim === "blocked") {
      validateBlockedCloseout({ report, failures });
    }
    if (closeout.stateClaim === "awaiting_human_decision") {
      validateAwaitingHumanCloseout({ report, failures });
    }
    if (closeout.stateClaim === "done") {
      if (report.status !== "ready") {
        failures.push("Done closeout requires readiness status ready.");
      }
      if (report.earliestHardBlocker) {
        failures.push("Done closeout must not include earliestHardBlocker.");
      }
      if (Array.isArray(report.blockers) && report.blockers.length > 0) {
        failures.push("Done closeout must not include blockers.");
      }
      if (nonReadyRequirementKeys.length > 0) {
        failures.push(`Done closeout has non-ready requirement key(s): ${nonReadyRequirementKeys.join(", ")}.`);
      }
    }
  }

  if (input.requireReady && (report.status !== "ready" || nonReadyRequirementKeys.length > 0)) {
    failures.push(
      `--require-ready was set, but readiness status is ${report.status} and non-ready requirement key(s) are: ${nonReadyRequirementKeys.join(", ") || "none"}.`,
    );
  }

  return {
    schemaVersion: CITY_LAUNCH_CLOSEOUT_VERIFIER_SCHEMA_VERSION,
    status: failures.length > 0 ? "fail" : "pass",
    reportJsonPath: input.reportJsonPath,
    city: nonEmptyString(report.city) ? report.city : null,
    citySlug: nonEmptyString(report.citySlug) ? report.citySlug : null,
    stateClaim: closeout?.stateClaim || null,
    readinessStatus: report.status || null,
    requireReady: input.requireReady === true,
    failures,
    warnings,
    coveredRequirementKeys,
    missingRequirementKeys,
    nonReadyRequirementKeys,
    earliestHardBlockerKey: report.earliestHardBlockerKey || null,
  };
}

export async function verifyCityLaunchReadinessCloseoutFile(input: {
  reportJsonPath: string;
  requireReady?: boolean | null;
}) {
  const report = JSON.parse(
    await fs.readFile(input.reportJsonPath, "utf8"),
  ) as ReportPayload;
  return verifyCityLaunchReadinessCloseout({
    report,
    reportJsonPath: input.reportJsonPath,
    requireReady: input.requireReady,
  });
}
