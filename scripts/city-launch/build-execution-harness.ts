import { promises as fs } from "node:fs";
import path from "node:path";
import { runCityLaunchExecutionHarness } from "../../server/utils/cityLaunchExecutionHarness";
import {
  buildCityLaunchBudgetPolicy,
} from "../../server/utils/cityLaunchPolicy";
import {
  resolveCityLaunchCityInput,
  resolveCityLaunchFounderBudgetMaxUsdInput,
  resolveCityLaunchFounderBudgetTierInput,
  resolveCityLaunchWindowHours,
} from "../../server/utils/cityLaunchRunControl";
import { summarizeCityLaunchAutonomyCertification } from "../../server/utils/cityLaunchAutonomyCertification";
import { renderCityLaunchFounderApprovalArtifact } from "../../server/utils/cityLaunchFounderApproval";
import { slugifyCityName } from "../../server/utils/cityLaunchProfiles";

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function getCommaSeparatedFlagValues(args: string[], flag: string) {
  const raw = getFlagValue(args, flag);
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

async function main() {
  const args = process.argv.slice(2);
  const city = resolveCityLaunchCityInput(
    getFlagValue(args, "--city") ?? process.env.CITY,
  );
  const windowHours = resolveCityLaunchWindowHours(
    getFlagValue(args, "--window-hours") ?? process.env.WINDOW_HOURS,
  );
  const budgetTier = resolveCityLaunchFounderBudgetTierInput(
    getFlagValue(args, "--budget-tier") ?? process.env.BUDGET_TIER,
  );
  const budgetMaxUsd = resolveCityLaunchFounderBudgetMaxUsdInput(
    getFlagValue(args, "--budget-max-usd") ?? process.env.BUDGET_MAX_USD,
  );
  const operatorAutoApproveUsdValue = getFlagValue(args, "--operator-auto-approve-usd");
  const rewakeTaskKeys = getCommaSeparatedFlagValues(args, "--rewake-task-keys");
  const rewakeOwnerLanes = getCommaSeparatedFlagValues(args, "--rewake-owner-lanes");
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: budgetTier,
    maxTotalApprovedUsd: budgetMaxUsd,
    operatorAutoApproveUsd: operatorAutoApproveUsdValue
      ? Number(operatorAutoApproveUsdValue)
      : undefined,
  });
  const founderApproved = hasFlag(args, "--founder-approved");

  const reportsRoot =
    getFlagValue(args, "--reports-root")
    || path.resolve(
      process.cwd(),
      "ops/paperclip/reports/city-launch-execution",
    );

  if (!founderApproved) {
    const citySlug = slugifyCityName(city);
    const runDirectory = path.join(reportsRoot, citySlug, timestampForFile());
    const founderDecisionPacketPath = path.join(runDirectory, "founder-decision-packet.md");
    await fs.mkdir(runDirectory, { recursive: true });
    await fs.writeFile(
      founderDecisionPacketPath,
      renderCityLaunchFounderApprovalArtifact({
        city,
        budgetPolicy,
      }),
      "utf8",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          state: "awaiting_human_decision",
          city,
          budgetTier: budgetPolicy.tier,
          windowHours,
          stageReached: "founder_decision_packet_generated",
          founderApproved: false,
          founderDecisionPacketPath,
          activationStarted: false,
          nextAction: "Founder replies APPROVE, then rerun with --founder-approved.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await runCityLaunchExecutionHarness({
    city,
    founderApproved,
    windowHours,
    reportsRoot,
    budgetTier: budgetPolicy.tier,
    budgetMaxUsd: budgetPolicy.maxTotalApprovedUsd,
    operatorAutoApproveUsd: budgetPolicy.operatorAutoApproveUsd,
    rewakeTaskKeys,
    rewakeOwnerLanes,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: result.city,
        status: result.status,
        budgetTier: result.budgetTier,
        windowHours,
        planningStatus: result.planning.status,
        canonicalSystemDocPath: result.artifacts.canonicalSystemDocPath,
        canonicalIssueBundlePath: result.artifacts.canonicalIssueBundlePath,
        canonicalLaunchPlaybookPath: result.artifacts.canonicalLaunchPlaybookPath,
        canonicalDemandPlaybookPath: result.artifacts.canonicalDemandPlaybookPath,
        canonicalTargetLedgerPath: result.artifacts.canonicalTargetLedgerPath,
        canonicalActivationPayloadPath: result.artifacts.canonicalActivationPayloadPath,
        canonicalCityOpeningArtifactPack: result.artifacts.cityOpeningArtifactPack.canonical,
        outboundReadiness: result.outboundReadiness || null,
        sourceActivationPayloadPath: result.artifacts.sourceActivationPayloadPath || null,
        runDirectory: result.artifacts.runDirectory,
        notionKnowledgePageUrl: result.notion?.knowledgePageUrl || null,
        notionWorkQueuePageUrl: result.notion?.workQueuePageUrl || null,
        paperclipRootIssueId: result.paperclip?.rootIssueId || null,
        dispatchedIssueCount: result.paperclip?.dispatched.length || 0,
        wokenIssueCount:
          result.paperclip?.dispatched.filter((entry) => Boolean(entry.wakeRunId)).length || 0,
        wakeFailureCount:
          result.paperclip?.dispatched.filter((entry) => entry.wakeError).length || 0,
        researchMaterializationStatus: result.researchMaterialization?.status || null,
        researchMaterializationSource: result.researchMaterialization?.sourceArtifactPath || null,
        prospectsUpserted: result.researchMaterialization?.prospectsUpserted || 0,
        buyerTargetsUpserted: result.researchMaterialization?.buyerTargetsUpserted || 0,
        capabilitySnapshot: result.capabilitySnapshot || null,
        certification: summarizeCityLaunchAutonomyCertification(result),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
