import {
  summarizeCityLaunchCoverage,
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const city = typeof args.get("city") === "string" ? String(args.get("city")).trim() : "";
  if (!city) {
    throw new Error('Usage: tsx scripts/city-launch/audit-coverage-inventory.ts --city "Durham, NC"');
  }

  const summary = await summarizeCityLaunchCoverage(city);
  console.log(JSON.stringify({
    mode: "audit",
    city: summary.city,
    citySlug: summary.citySlug,
    inventoryTargets: summary.policy.inventoryTargets,
    totals: summary.coverage.totals,
    countsByStatus: summary.coverage.countsByStatus,
    countsByCategory: summary.coverage.countsByCategory,
    countsByTile: summary.coverage.countsByTile,
    countsBySourceBucket: summary.coverage.countsBySourceBucket,
    gapCellCount: summary.gapCells.length,
    topGapCells: summary.gapCells.slice(0, 25),
    lastRun: summary.lastRun,
    recommendedNextAction: summary.recommendedNextAction,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
