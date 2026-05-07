import {
  executeCityLaunchSends,
  approveCityLaunchSendAction,
} from "../../server/utils/cityLaunchSendExecutor";
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

async function main() {
  const args = process.argv.slice(2);
  const city = resolveCityLaunchCityInput(
    getFlagValue(args, "--city") ?? process.env.CITY,
  );

  const mode = getFlagValue(args, "--mode") || "execute";

  if (mode === "approve") {
    const actionId = getFlagValue(args, "--action-id");
    if (!actionId) {
      throw new Error("Approve mode requires --action-id");
    }
    const approverRole = getFlagValue(args, "--approver-role") || "founder";
    const result = await approveCityLaunchSendAction({ actionId, approverRole });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }

  const live = hasFlag(args, "--live");
  const founderApproved = hasFlag(args, "--founder-approved");
  if (live && !founderApproved) {
    throw new Error("Live city-launch sends require --founder-approved. Omit --live for the default dry-run.");
  }
  const dryRun = !live || hasFlag(args, "--dry-run");
  const maxSends = getFlagValue(args, "--max-sends")
    ? Number(getFlagValue(args, "--max-sends"))
    : undefined;
  const sendKeyFilter = getFlagValue(args, "--action-ids")
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const result = await executeCityLaunchSends({
    city,
    dryRun,
    maxSends,
    sendKeyFilter,
  });

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
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
