import {
  resolveCityLaunchScorecardCheckpointHour,
  renderCityLaunchScorecardWindowCloseoutMarkdown,
  writeCityLaunchScorecardWindowCloseout,
} from "../../server/utils/cityLaunchScorecardWindow";
import {
  resolveCityLaunchCityInput,
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
  const checkpointHour = resolveCityLaunchScorecardCheckpointHour(
    getFlagValue(args, "--checkpoint-hour") ?? process.env.CHECKPOINT_HOUR,
  );
  const closeout = await writeCityLaunchScorecardWindowCloseout({
    city,
    checkpointHour,
    reportsRoot: getFlagValue(args, "--reports-root") || undefined,
    timestamp: getFlagValue(args, "--report-timestamp") || undefined,
    nowIso: getFlagValue(args, "--now-iso") || undefined,
    allowBeforeWindow: hasFlag(args, "--allow-before-window"),
    queryLimits: hasFlag(args, "--bounded-query-limits")
      ? {
          waitlistSubmissions: getNumericFlag(args, "--max-waitlist-submissions") || 250,
          users: getNumericFlag(args, "--max-users") || 250,
          inboundRequests: getNumericFlag(args, "--max-inbound-requests") || 250,
          growthEvents: getNumericFlag(args, "--max-growth-events") || 500,
        }
      : {
          waitlistSubmissions: getNumericFlag(args, "--max-waitlist-submissions"),
          users: getNumericFlag(args, "--max-users"),
          inboundRequests: getNumericFlag(args, "--max-inbound-requests"),
          growthEvents: getNumericFlag(args, "--max-growth-events"),
        },
    runQueryDiagnostics: hasFlag(args, "--run-query-diagnostics"),
    queryTimeoutMs: getFlagValue(args, "--query-timeout-ms")
      ? Number(getFlagValue(args, "--query-timeout-ms"))
      : undefined,
    scorecardManifestPath: getFlagValue(args, "--scorecard-manifest-path") || undefined,
  });

  const format = getFlagValue(args, "--format") || "json";
  if (format === "markdown" || format === "md") {
    console.log(renderCityLaunchScorecardWindowCloseoutMarkdown(closeout));
  } else {
    console.log(JSON.stringify(closeout, null, 2));
  }

  if (closeout.status === "blocked" && !hasFlag(args, "--allow-blocked")) {
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
