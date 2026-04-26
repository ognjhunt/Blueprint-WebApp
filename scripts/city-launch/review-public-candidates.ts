import { reviewCityLaunchCandidateBatch } from "../../server/utils/cityLaunchCandidateReview";

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
  const city = typeof args.get("city") === "string" ? String(args.get("city")).trim() : null;
  const candidateIds = typeof args.get("candidate-ids") === "string"
    ? String(args.get("candidate-ids"))
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    : [];
  const limit = typeof args.get("limit") === "string"
    ? Number(args.get("limit"))
    : candidateIds.length || 100;
  const reviewedBy =
    typeof args.get("reviewed-by") === "string"
      ? String(args.get("reviewed-by")).trim()
      : "public-space-review-agent";
  const dryRun = !args.has("apply");

  const result = await reviewCityLaunchCandidateBatch({
    city,
    candidateIds,
    limit,
    dryRun,
    reviewedBy,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
