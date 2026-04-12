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
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: result.city,
        status: result.status,
        canonicalSystemDocPath: result.artifacts.canonicalSystemDocPath,
        canonicalIssueBundlePath: result.artifacts.canonicalIssueBundlePath,
        canonicalTargetLedgerPath: result.artifacts.canonicalTargetLedgerPath,
        runDirectory: result.artifacts.runDirectory,
        notionKnowledgePageUrl: result.notion?.knowledgePageUrl || null,
        notionWorkQueuePageUrl: result.notion?.workQueuePageUrl || null,
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
