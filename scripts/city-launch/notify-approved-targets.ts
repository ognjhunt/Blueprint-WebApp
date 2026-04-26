import { listCityLaunchProspects } from "../../server/utils/cityLaunchLedgers";
import { dispatchCityLaunchTargetPromotionNotifications } from "../../server/utils/cityLaunchNotifications";

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

function normalizeList(value: string | true | undefined) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const city = typeof args.get("city") === "string" ? String(args.get("city")).trim() : "";
  if (!city) {
    throw new Error(
      'Usage: tsx scripts/city-launch/notify-approved-targets.ts --city "Durham, NC" [--dry-run] [--apply --creator-id <id>] [--allow-broad]',
    );
  }

  const apply = args.has("apply");
  const dryRun = !apply || args.has("dry-run");
  const recipientCreatorIds = normalizeList(args.get("creator-id"));
  const allowBroad = args.has("allow-broad");
  if (apply && !recipientCreatorIds.length && !allowBroad) {
    throw new Error("--apply requires --creator-id <id> unless --allow-broad is explicitly set");
  }

  const prospects = await listCityLaunchProspects(city, {
    statuses: ["approved", "onboarded", "capturing"],
  });
  const result = await dispatchCityLaunchTargetPromotionNotifications({
    city,
    promotedProspects: prospects,
    dryRun,
    recipientCreatorIds,
  });

  console.log(JSON.stringify({
    mode: dryRun ? "dry_run" : "apply",
    city,
    prospectCount: prospects.length,
    result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
