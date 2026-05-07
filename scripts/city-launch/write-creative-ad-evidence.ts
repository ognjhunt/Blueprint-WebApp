import {
  renderCityLaunchCreativeAdsEvidenceMarkdown,
  writeCityLaunchCreativeAdsEvidence,
} from "../../server/utils/cityLaunchCreativeAdsEvidence";
import {
  resolveCityLaunchCityInput,
  resolveCityLaunchFounderBudgetMaxUsdInput,
  resolveCityLaunchFounderBudgetTierInput,
  resolveCityLaunchWindowHours,
} from "../../server/utils/cityLaunchRunControl";

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function getNumericFlag(args: string[], flag: string) {
  const value = getFlagValue(args, flag);
  return value ? Number(value) : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const city = resolveCityLaunchCityInput(
    getFlagValue(args, "--city") ?? process.env.CITY,
  );
  const budgetTier = resolveCityLaunchFounderBudgetTierInput(
    getFlagValue(args, "--budget-tier") ?? process.env.BUDGET_TIER,
  );
  const budgetMaxUsd = resolveCityLaunchFounderBudgetMaxUsdInput(
    getFlagValue(args, "--budget-max-usd") ?? process.env.BUDGET_MAX_USD,
  );
  const windowHours = resolveCityLaunchWindowHours(
    getFlagValue(args, "--window-hours") ?? process.env.WINDOW_HOURS,
  );

  const evidence = await writeCityLaunchCreativeAdsEvidence({
    city,
    budgetTier,
    budgetMaxUsd,
    windowHours,
    reportsRoot: getFlagValue(args, "--reports-root") || undefined,
    timestamp: getFlagValue(args, "--report-timestamp") || undefined,
    adStudioRunId: getFlagValue(args, "--ad-studio-run-id") || undefined,
    requireVideoHandoff: hasFlag(args, "--require-video-handoff"),
    runMetaReadOnly: hasFlag(args, "--run-meta-read-only"),
    founderApprovedPausedDraft:
      hasFlag(args, "--founder-approved-paused-draft")
      || hasFlag(args, "--allow-paused-meta-draft"),
    launchId: getFlagValue(args, "--launch-id") || undefined,
    metaAccountId: getFlagValue(args, "--meta-account-id") || undefined,
    metaPageId: getFlagValue(args, "--meta-page-id") || undefined,
    mediaPath: getFlagValue(args, "--media-path") || undefined,
    mediaType: getFlagValue(args, "--media-type") || undefined,
    destinationUrl: getFlagValue(args, "--destination-url") || undefined,
    dailyBudgetUsd: getNumericFlag(args, "--daily-budget-usd"),
    callToAction: getFlagValue(args, "--call-to-action") || undefined,
  });

  const format = getFlagValue(args, "--format") || "json";
  if (format === "markdown" || format === "md") {
    console.log(renderCityLaunchCreativeAdsEvidenceMarkdown(evidence));
  } else {
    console.log(JSON.stringify(evidence, null, 2));
  }

  if (evidence.status === "blocked" && !hasFlag(args, "--allow-blocked")) {
    process.exitCode = 1;
  }
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
