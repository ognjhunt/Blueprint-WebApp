import {
  runCityLaunchCoverageExpansion,
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
    throw new Error('Usage: tsx scripts/city-launch/run-coverage-expansion.ts --city "Durham, NC" [--apply] [--max-candidates 40]');
  }

  const result = await runCityLaunchCoverageExpansion({
    city,
    apply: args.has("apply"),
    maxQueries: numberArg(args.get("max-queries") || args.get("maxQueries")),
    maxCandidates: numberArg(args.get("max-candidates") || args.get("maxCandidates")),
    trigger: args.has("low-inventory") ? "low_inventory" : "manual",
  });

  console.log(JSON.stringify({
    mode: args.has("apply") ? "applied" : "dry_run",
    city: result.run.city,
    citySlug: result.run.citySlug,
    runId: result.run.id,
    status: result.run.status,
    failureReason: result.run.failureReason,
    coverageBefore: result.run.coverageBefore.totals,
    coverageAfter: result.run.coverageAfter?.totals || null,
    gapCellCount: result.run.gapCells.length,
    queryCount: result.run.queryPlan.length,
    seededCandidateIds: result.run.seededCandidateIds,
    promotedProspectIds: result.run.promotedProspectIds,
    keptInReviewCandidateIds: result.run.keptInReviewCandidateIds,
    rejectedCandidateIds: result.run.rejectedCandidateIds,
    dedupedCandidateIds: result.run.dedupedCandidateIds,
    searchEvidence: result.run.searchEvidence,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
