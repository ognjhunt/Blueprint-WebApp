import {
  planCityLaunchCoverageExpansion,
} from "../../server/utils/cityLaunchCoverageExpansion";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function numberArg(value: string | true | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const city = typeof args.get("city") === "string" ? String(args.get("city")).trim() : "";
  if (!city) {
    throw new Error('Usage: tsx scripts/city-launch/plan-coverage-expansion.ts --city "Durham, NC" [--max-queries 20] [--max-candidates 40]');
  }

  const plan = await planCityLaunchCoverageExpansion({
    city,
    maxQueries: numberArg(args.get("max-queries") || args.get("maxQueries")),
    maxCandidates: numberArg(args.get("max-candidates") || args.get("maxCandidates")),
  });

  console.log(JSON.stringify({
    mode: "dry_run",
    city: plan.city,
    citySlug: plan.citySlug,
    generatedAtIso: plan.generatedAtIso,
    inventoryTargets: plan.policy.inventoryTargets,
    totals: plan.coverageBefore.totals,
    gapCellCount: plan.gapCells.length,
    queryCount: plan.queryPlan.length,
    recommendedNextAction: plan.recommendedNextAction,
    gapCells: plan.gapCells.slice(0, 25),
    queryPlan: plan.queryPlan,
    duplicateRiskWarnings: plan.duplicateRiskWarnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
