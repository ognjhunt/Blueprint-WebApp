import path from "node:path";
import { runCityLaunchExecutionHarness } from "../../server/utils/cityLaunchExecutionHarness";

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

async function main() {
  const args = process.argv.slice(2);
  const city = getFlagValue(args, "--city") || "Austin, TX";
  const budgetTier =
    getFlagValue(args, "--budget-tier") || undefined;
  const budgetMaxUsdValue = getFlagValue(args, "--budget-max-usd");
  const operatorAutoApproveUsdValue = getFlagValue(args, "--operator-auto-approve-usd");

  const reportsRoot =
    getFlagValue(args, "--reports-root")
    || path.resolve(
      process.cwd(),
      "ops/paperclip/reports/city-launch-execution",
    );

  const result = await runCityLaunchExecutionHarness({
    city,
    founderApproved: hasFlag(args, "--founder-approved"),
    reportsRoot,
    budgetTier:
      budgetTier === "zero_budget" || budgetTier === "low_budget" || budgetTier === "funded"
        ? budgetTier
        : undefined,
    budgetMaxUsd: budgetMaxUsdValue ? Number(budgetMaxUsdValue) : undefined,
    operatorAutoApproveUsd: operatorAutoApproveUsdValue
      ? Number(operatorAutoApproveUsdValue)
      : undefined,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: result.city,
        status: result.status,
        budgetTier: result.budgetTier,
        canonicalSystemDocPath: result.artifacts.canonicalSystemDocPath,
        canonicalIssueBundlePath: result.artifacts.canonicalIssueBundlePath,
        canonicalTargetLedgerPath: result.artifacts.canonicalTargetLedgerPath,
        runDirectory: result.artifacts.runDirectory,
        notionKnowledgePageUrl: result.notion?.knowledgePageUrl || null,
        notionWorkQueuePageUrl: result.notion?.workQueuePageUrl || null,
        paperclipRootIssueId: result.paperclip?.rootIssueId || null,
        dispatchedIssueCount: result.paperclip?.dispatched.length || 0,
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
