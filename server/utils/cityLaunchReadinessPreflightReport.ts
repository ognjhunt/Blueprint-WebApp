import { promises as fs } from "node:fs";
import path from "node:path";

import type { CityLaunchReadinessPreflightResult } from "./cityLaunchReadinessPreflight";
import type { CityLaunchCloseoutVerification } from "./cityLaunchCloseoutVerifier";
import { slugifyCityName } from "./cityLaunchProfiles";

export type CityLaunchReadinessPreflightReportArtifacts = {
  runDirectory: string;
  jsonPath: string;
  markdownPath: string;
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function markdownCell(value: string | null | undefined) {
  return String(value || "")
    .replace(/\|/g, "/")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

export function buildCityLaunchReadinessPreflightReportPaths(input: {
  city: string;
  reportsRoot?: string | null;
  timestamp?: string | null;
}): CityLaunchReadinessPreflightReportArtifacts {
  const citySlug = slugifyCityName(input.city);
  const reportsRoot = input.reportsRoot?.trim()
    || path.resolve(process.cwd(), "ops/paperclip/reports/city-launch-execution");
  const runDirectory = path.join(
    reportsRoot,
    citySlug,
    "preflight",
    input.timestamp?.trim() || timestampForFile(),
  );
  return {
    runDirectory,
    jsonPath: path.join(runDirectory, "readiness-preflight.json"),
    markdownPath: path.join(runDirectory, "readiness-preflight.md"),
  };
}

export function renderCityLaunchReadinessPreflightMarkdown(input: {
  result: CityLaunchReadinessPreflightResult;
  reportArtifacts?: CityLaunchReadinessPreflightReportArtifacts | null;
  closeoutVerification?: CityLaunchCloseoutVerification | null;
}) {
  const { result, reportArtifacts, closeoutVerification } = input;
  const lines = [
    `# ${result.city} CITY+BUDGET Launch Readiness Preflight`,
    "",
    `- status: ${result.status}`,
    `- city_slug: ${result.citySlug}`,
    `- earliest_hard_blocker_key: ${result.earliestHardBlockerKey || "none"}`,
    `- budget_tier: ${result.budgetPolicy.tier}`,
    `- budget_max_usd: ${result.budgetPolicy.maxTotalApprovedUsd}`,
    `- window_hours: ${result.windowHours}`,
    `- founder_approved: ${result.founderApproved}`,
    ...(reportArtifacts
      ? [
          `- report_json: ${reportArtifacts.jsonPath}`,
          `- report_markdown: ${reportArtifacts.markdownPath}`,
        ]
      : []),
    "",
    "## Autonomous Loop Closeout",
    `- objective: ${result.autonomousLoopCloseout.objective}`,
    `- claim_scope: ${result.autonomousLoopCloseout.claimScope}`,
    `- state_claim: ${result.autonomousLoopCloseout.stateClaim}`,
    `- stage_reached: ${result.autonomousLoopCloseout.stageReached}`,
    `- next_action: ${result.autonomousLoopCloseout.nextAction}`,
    "- verification:",
    ...result.autonomousLoopCloseout.verification.map((entry) => `  - ${entry}`),
    "- durable_evidence:",
    ...(result.autonomousLoopCloseout.durableEvidence.length > 0
      ? result.autonomousLoopCloseout.durableEvidence.map((entry) => `  - ${entry}`)
      : ["  - none"]),
    "- residual_risk:",
    ...result.autonomousLoopCloseout.residualRisk.map((entry) => `  - ${entry}`),
    ...(result.autonomousLoopCloseout.blocked
      ? [
          "- blocked:",
          `  - earliest_hard_stop: ${result.autonomousLoopCloseout.blocked.earliestHardStop}`,
          `  - why_no_reversible_work_remains: ${result.autonomousLoopCloseout.blocked.whyNoReversibleWorkRemains}`,
          `  - owner: ${result.autonomousLoopCloseout.blocked.owner}`,
          `  - retry_resume_condition: ${result.autonomousLoopCloseout.blocked.retryResumeCondition}`,
          `  - linked_follow_up: ${result.autonomousLoopCloseout.blocked.linkedFollowUp || "none"}`,
          "  - next_required_input:",
          ...(result.autonomousLoopCloseout.blocked.nextRequiredInput.length > 0
            ? result.autonomousLoopCloseout.blocked.nextRequiredInput.map((entry) => `    - ${entry}`)
            : ["    - none"]),
        ]
      : []),
    ...(result.autonomousLoopCloseout.awaitingHumanDecision
      ? [
          "- awaiting_human_decision:",
          `  - gate_category: ${result.autonomousLoopCloseout.awaitingHumanDecision.gateCategory}`,
          `  - decision_requested: ${result.autonomousLoopCloseout.awaitingHumanDecision.decisionRequested}`,
          `  - recommendation: ${result.autonomousLoopCloseout.awaitingHumanDecision.recommendation}`,
          `  - evidence_packet: ${result.autonomousLoopCloseout.awaitingHumanDecision.evidencePacket || "missing"}`,
          `  - blocker_id: ${result.autonomousLoopCloseout.awaitingHumanDecision.blockerId}`,
          `  - routing_surface: ${result.autonomousLoopCloseout.awaitingHumanDecision.routingSurface}`,
          `  - watcher_owner: ${result.autonomousLoopCloseout.awaitingHumanDecision.watcherOwner}`,
          `  - resume_condition: ${result.autonomousLoopCloseout.awaitingHumanDecision.resumeCondition}`,
          `  - deadline: ${result.autonomousLoopCloseout.awaitingHumanDecision.deadline}`,
        ]
      : []),
    ...(closeoutVerification
      ? [
          "",
          "## Closeout Verification",
          `- schema_version: ${closeoutVerification.schemaVersion}`,
          `- status: ${closeoutVerification.status}`,
          `- require_ready: ${closeoutVerification.requireReady}`,
          `- earliest_hard_blocker_key: ${closeoutVerification.earliestHardBlockerKey || "none"}`,
          "- missing_requirement_keys:",
          ...(closeoutVerification.missingRequirementKeys.length > 0
            ? closeoutVerification.missingRequirementKeys.map((entry) => `  - ${entry}`)
            : ["  - none"]),
          "- non_ready_requirement_keys:",
          ...(closeoutVerification.nonReadyRequirementKeys.length > 0
            ? closeoutVerification.nonReadyRequirementKeys.map((entry) => `  - ${entry}`)
            : ["  - none"]),
          "- failures:",
          ...(closeoutVerification.failures.length > 0
            ? closeoutVerification.failures.map((entry) => `  - ${entry}`)
            : ["  - none"]),
          "- warnings:",
          ...(closeoutVerification.warnings.length > 0
            ? closeoutVerification.warnings.map((entry) => `  - ${entry}`)
            : ["  - none"]),
        ]
      : []),
    "",
    "## Earliest Hard Blocker",
    ...(result.earliestHardBlocker
      ? [
          `- key: ${result.earliestHardBlocker.key}`,
          `- status: ${result.earliestHardBlocker.status}`,
          `- stage_reached: ${result.earliestHardBlocker.stageReached}`,
          `- owner: ${result.earliestHardBlocker.owner}`,
          `- retry_condition: ${result.earliestHardBlocker.retryCondition}`,
          `- summary: ${result.earliestHardBlocker.summary}`,
          "- required_inputs:",
          ...(result.earliestHardBlocker.requiredInputs.length > 0
            ? result.earliestHardBlocker.requiredInputs.map((entry) => `  - ${entry}`)
            : ["  - none"]),
          "- evidence_paths:",
          ...(result.earliestHardBlocker.evidencePaths.length > 0
            ? result.earliestHardBlocker.evidencePaths.map((entry) => `  - ${entry}`)
            : ["  - none"]),
        ]
      : ["- none"]),
    "",
    "## Launch Surface Coverage",
    `- status: ${result.launchSurfaceCoverage.status}`,
    `- required_count: ${result.launchSurfaceCoverage.requiredSurfaces.length}`,
    `- covered_count: ${result.launchSurfaceCoverage.coveredSurfaces.length}`,
    `- missing_count: ${result.launchSurfaceCoverage.missingSurfaces.length}`,
    "- missing_surfaces:",
    ...(result.launchSurfaceCoverage.missingSurfaces.length > 0
      ? result.launchSurfaceCoverage.missingSurfaces.map((surface) => `  - ${surface}`)
      : ["  - none"]),
    "- evidence_paths:",
    ...(result.launchSurfaceCoverage.evidencePaths.length > 0
      ? result.launchSurfaceCoverage.evidencePaths.map((entry) => `  - ${entry}`)
      : ["  - none"]),
    `- next_action: ${result.launchSurfaceCoverage.nextAction || "none"}`,
    "",
    "## Checks",
    "| Check | Status | Summary |",
    "| --- | --- | --- |",
    ...result.checks.map((check) =>
      `| ${check.key} | ${check.status} | ${markdownCell(check.summary)} |`,
    ),
    "",
    "## Prompt-To-Artifact Checklist",
    "| Requirement | Status | Evidence | Collections / Queries | Next Action |",
    "| --- | --- | --- | --- | --- |",
    ...result.promptToArtifactChecklist.map((item) => {
      const evidence = item.evidencePaths.length > 0
        ? item.evidencePaths.join("<br>")
        : "none";
      const collections = [
        ...item.collectionNames.map((collection) => `collection:${collection}`),
        ...item.queryNames.map((query) => `query:${query}`),
      ].join("<br>") || "none";
      const nextAction = item.nextAction || item.command || "none";
      return [
        markdownCell(item.promptRequirement),
        item.status,
        markdownCell(evidence),
        markdownCell(collections),
        markdownCell(nextAction),
      ].join(" | ");
    }).map((row) => `| ${row} |`),
    "",
    "## Evidence Paths",
    `- completed_playbook: ${result.evidencePaths.completedPlaybookPath || "missing"}`,
    `- activation_payload: ${result.evidencePaths.activationPayloadPath || "missing"}`,
    `- deep_research_blocker_packet: ${result.evidencePaths.deepResearchBlockerPacketPath || "missing"}`,
    `- gtm_72h_contract: ${result.evidencePaths.gtm72hContractPath}`,
    `- ad_studio_handoff: ${result.evidencePaths.adStudioCreativeHandoffPath}`,
    `- meta_ads_readiness: ${result.evidencePaths.metaAdsReadinessPath}`,
    `- scorecard_manifest: ${result.evidencePaths.scorecardWindowManifestPath}`,
    ...Object.entries(result.evidencePaths.scorecardPaths).map(
      ([key, filePath]) => `- scorecard_${key}: ${filePath}`,
    ),
    "",
    "## Blockers",
    ...(result.blockers.length > 0
      ? result.blockers.map((blocker) => `- ${blocker}`)
      : ["- none"]),
    "",
    "## Required Inputs",
    ...(result.requiredInputs.length > 0
      ? result.requiredInputs.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
  ];
  return lines.join("\n");
}

export async function writeCityLaunchReadinessPreflightReport(input: {
  result: CityLaunchReadinessPreflightResult;
  reportsRoot?: string | null;
  timestamp?: string | null;
  closeoutVerification?: CityLaunchCloseoutVerification | null;
}): Promise<CityLaunchReadinessPreflightReportArtifacts> {
  const reportArtifacts = buildCityLaunchReadinessPreflightReportPaths({
    city: input.result.city,
    reportsRoot: input.reportsRoot,
    timestamp: input.timestamp,
  });
  const jsonPayload = {
    ...input.result,
    reportArtifacts,
    ...(input.closeoutVerification ? { closeoutVerification: input.closeoutVerification } : {}),
  };
  await fs.mkdir(reportArtifacts.runDirectory, { recursive: true });
  await fs.writeFile(
    reportArtifacts.jsonPath,
    JSON.stringify(jsonPayload, null, 2),
    "utf8",
  );
  await fs.writeFile(
    reportArtifacts.markdownPath,
    renderCityLaunchReadinessPreflightMarkdown({
      result: input.result,
      reportArtifacts,
      closeoutVerification: input.closeoutVerification,
    }),
    "utf8",
  );
  return reportArtifacts;
}

export async function writeCityLaunchReadinessPreflightCloseoutVerification(input: {
  reportArtifacts: CityLaunchReadinessPreflightReportArtifacts;
  result: CityLaunchReadinessPreflightResult;
  closeoutVerification: CityLaunchCloseoutVerification;
}) {
  const existingJson = JSON.parse(await fs.readFile(input.reportArtifacts.jsonPath, "utf8"));
  await fs.writeFile(
    input.reportArtifacts.jsonPath,
    JSON.stringify(
      {
        ...existingJson,
        closeoutVerification: input.closeoutVerification,
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(
    input.reportArtifacts.markdownPath,
    renderCityLaunchReadinessPreflightMarkdown({
      result: input.result,
      reportArtifacts: input.reportArtifacts,
      closeoutVerification: input.closeoutVerification,
    }),
    "utf8",
  );
}
