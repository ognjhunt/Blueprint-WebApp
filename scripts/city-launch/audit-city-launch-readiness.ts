import path from "node:path";

import {
  runCityLaunchReadinessPreflight,
} from "../../server/utils/cityLaunchReadinessPreflight";
import {
  resolveCityLaunchPlanningState,
} from "../../server/utils/cityLaunchPlanningState";
import {
  renderCityLaunchReadinessPreflightMarkdown,
  writeCityLaunchReadinessPreflightCloseoutVerification,
  writeCityLaunchReadinessPreflightReport,
} from "../../server/utils/cityLaunchReadinessPreflightReport";
import {
  resolveCityLaunchDeepResearchFailure,
  resolveCityLaunchCityInput,
  resolveCityLaunchFounderBudgetMaxUsdInput,
  resolveCityLaunchFounderBudgetTierInput,
  resolveCityLaunchHumanBlockerDeliveryMode,
  resolveCityLaunchWindowHours,
} from "../../server/utils/cityLaunchRunControl";
import {
  verifyCityLaunchReadinessCloseout,
} from "../../server/utils/cityLaunchCloseoutVerifier";

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

async function main() {
  const args = process.argv.slice(2);
  const city = resolveCityLaunchCityInput(
    getFlagValue(args, "--city") ?? process.env.CITY,
  );

  const budgetMaxUsd = resolveCityLaunchFounderBudgetMaxUsdInput(
    getFlagValue(args, "--budget-max-usd") ?? process.env.BUDGET_MAX_USD,
  );
  const budgetTier = resolveCityLaunchFounderBudgetTierInput(
    getFlagValue(args, "--budget-tier") ?? process.env.BUDGET_TIER,
  );
  const windowHours = resolveCityLaunchWindowHours(
    getFlagValue(args, "--window-hours") ?? process.env.WINDOW_HOURS,
  );
  const planningReportsRoot =
    getFlagValue(args, "--deep-research-reports-root")
    || getFlagValue(args, "--reports-root")
    || undefined;
  const preflightReportsRoot =
    getFlagValue(args, "--preflight-reports-root")
    || getFlagValue(args, "--report-root")
    || undefined;
  const executionReportsRoot =
    getFlagValue(args, "--execution-reports-root")
    || undefined;
  const resolvedExecutionReportsRoot = executionReportsRoot
    || path.resolve(process.cwd(), "ops/paperclip/reports/city-launch-execution");
  const humanBlockerDeliveryMode = resolveCityLaunchHumanBlockerDeliveryMode(
    getFlagValue(args, "--human-blocker-delivery-mode")
    ?? process.env.BLUEPRINT_CITY_LAUNCH_HUMAN_BLOCKER_DELIVERY_MODE
    ?? "none",
  );
  const preflightInput = {
    city,
    budgetTier,
    budgetMaxUsd,
    operatorAutoApproveUsd: getFlagValue(args, "--operator-auto-approve-usd")
      ? Number(getFlagValue(args, "--operator-auto-approve-usd"))
      : null,
    windowHours,
    founderApproved: hasFlag(args, "--founder-approved"),
    requireFounderApproval: hasFlag(args, "--require-founder-approval")
      ? true
      : hasFlag(args, "--no-founder-approval-required")
        ? false
        : true,
    reportsRoot: planningReportsRoot,
    executionReportsRoot: resolvedExecutionReportsRoot,
  };
  let result = await runCityLaunchReadinessPreflight(preflightInput);
  let deepResearchBlockerResolution = null as Awaited<
    ReturnType<typeof resolveCityLaunchDeepResearchFailure>
  > | null;
  if (
    result.earliestHardBlocker?.key === "deep_research_city_plan"
    && !result.evidencePaths.deepResearchBlockerPacketPath
    && !hasFlag(args, "--no-write-deep-research-blocker")
  ) {
    const planningState = await resolveCityLaunchPlanningState({
      city,
      reportsRoot: planningReportsRoot,
    });
    deepResearchBlockerResolution = await resolveCityLaunchDeepResearchFailure({
      city,
      budgetPolicy: result.budgetPolicy,
      planningState,
      error: new Error("City-launch preflight found no valid completed city playbook."),
      reportsRoot: resolvedExecutionReportsRoot,
      humanBlockerDeliveryMode,
    });
    if (deepResearchBlockerResolution.status === "blocked") {
      result = await runCityLaunchReadinessPreflight(preflightInput);
    }
  }
  const reportArtifacts = hasFlag(args, "--no-write-report")
    ? null
    : await writeCityLaunchReadinessPreflightReport({
        result,
        reportsRoot: preflightReportsRoot,
        timestamp: getFlagValue(args, "--report-timestamp"),
      });
  const closeoutVerification = verifyCityLaunchReadinessCloseout({
    report: result,
    reportJsonPath: reportArtifacts?.jsonPath || "(not written)",
    requireReady: hasFlag(args, "--require-ready"),
  });
  if (reportArtifacts) {
    await writeCityLaunchReadinessPreflightCloseoutVerification({
      reportArtifacts,
      result,
      closeoutVerification,
    });
  }

  const format = getFlagValue(args, "--format") || "json";
  if (format === "markdown" || format === "md") {
    console.log(renderCityLaunchReadinessPreflightMarkdown({
      result,
      reportArtifacts,
      closeoutVerification,
    }));
  } else {
    console.log(JSON.stringify({
      ...result,
      ...(deepResearchBlockerResolution ? { deepResearchBlockerResolution } : {}),
      ...(reportArtifacts ? { reportArtifacts } : {}),
      closeoutVerification,
    }, null, 2));
  }

  if (closeoutVerification.status !== "pass") {
    process.exitCode = 1;
  } else if (result.status !== "ready" && !hasFlag(args, "--allow-blocked")) {
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
