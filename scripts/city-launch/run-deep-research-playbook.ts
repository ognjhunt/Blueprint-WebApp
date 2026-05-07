import path from "node:path";
import {
  runCityLaunchFollowUpQuestion,
  runCityLaunchPlanningHarness,
  slugifyCityName,
} from "../../server/utils/cityLaunchPlanningHarness";
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

function getCsvFlagValues(args: string[], flag: string) {
  const rawValue = getFlagValue(args, flag);
  if (!rawValue) {
    return undefined;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = getFlagValue(args, "--mode") || "run";

  if (mode === "followup") {
    const previousInteractionId =
      getFlagValue(args, "--interaction")
      || getFlagValue(args, "--previous-interaction-id");
    const question = getFlagValue(args, "--question");
    if (!previousInteractionId || !question) {
      throw new Error(
        "Follow-up mode requires --interaction <id> and --question <text>.",
      );
    }

    const city = resolveCityLaunchCityInput(
      getFlagValue(args, "--city") ?? process.env.CITY,
    );
    const reportsRoot =
      getFlagValue(args, "--reports-root")
      || path.resolve(
        process.cwd(),
        "ops/paperclip/reports/city-launch-deep-research",
      );
    const followUpPath = path.join(
      reportsRoot,
      slugifyCityName(city),
      `${new Date().toISOString().replaceAll(":", "-")}-followup.md`,
    );

    const result = await runCityLaunchFollowUpQuestion({
      previousInteractionId,
      question,
      artifactPath: followUpPath,
      fileSearchStoreNames: getCsvFlagValues(args, "--file-search-store"),
      deepResearchAgent:
        getFlagValue(args, "--research-agent")
        || getFlagValue(args, "--deep-research-agent")
        || undefined,
      pollIntervalMs: Number(getFlagValue(args, "--poll-interval-ms") || "10000"),
      timeoutMs: Number(
        getFlagValue(args, "--timeout-ms") || String(20 * 60 * 1000),
      ),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          interactionId: result.interaction.id,
          artifactPath: followUpPath,
        },
        null,
        2,
      ),
    );
    return;
  }

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

  const region = getFlagValue(args, "--region");
  const critiqueRounds = Number(getFlagValue(args, "--critique-rounds") || "1");
  const pollIntervalMs = Number(getFlagValue(args, "--poll-interval-ms") || "10000");
  const timeoutMs = Number(getFlagValue(args, "--timeout-ms") || String(20 * 60 * 1000));
  const reportsRoot = getFlagValue(args, "--reports-root") || undefined;
  const similarCompaniesArg = getFlagValue(args, "--similar-companies");
  const similarCompanies = similarCompaniesArg
    ? similarCompaniesArg
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;
  const fileSearchStoreNames = getCsvFlagValues(args, "--file-search-store");
  const deepResearchAgent =
    getFlagValue(args, "--research-agent")
    || getFlagValue(args, "--deep-research-agent");

  const result = await runCityLaunchPlanningHarness({
    city,
    region,
    budgetTier,
    budgetMaxUsd,
    windowHours,
    fileSearchStoreNames,
    deepResearchAgent: deepResearchAgent || undefined,
    critiqueRounds: Number.isFinite(critiqueRounds) ? critiqueRounds : 1,
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 10_000,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20 * 60 * 1000,
    reportsRoot,
    similarCompanies,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: result.city,
        citySlug: result.citySlug,
        canonicalPlaybookPath: result.artifacts.canonicalPlaybookPath,
        canonicalActivationPayloadPath: result.artifacts.canonicalActivationPayloadPath,
        finalPlaybookPath: result.artifacts.finalPlaybookPath,
        activationPayloadPath: result.artifacts.activationPayloadPath,
        initialResearchPath: result.artifacts.initialResearchPath,
        runDirectory: result.artifacts.runDirectory,
        runContract: result.runContract,
        notionKnowledgePageUrl: result.notion?.knowledgePageUrl || null,
        notionWorkQueuePageUrl: result.notion?.workQueuePageUrl || null,
        stageCount: result.stages.length,
        latestInteractionId: result.stages[result.stages.length - 1]?.interactionId || null,
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
