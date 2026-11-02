import { parseArgs } from "node:util";

const help = `Usage:
  npx tsx scripts/restore-granted-brief.ts --request-id ID
  npx tsx scripts/restore-granted-brief.ts --request-id ID --apply
Puts a website job's brief back to the task its scene grant was issued for, by removing
only model-read proposals merged after the grant (before WebApp #1182). Acts only when one
smallest removal reproduces the grant's context digest exactly. Each removed proposal is kept
for the site's review. Without --apply it writes nothing. Run it before renewing an expired
grant (scripts/renew-website-scene-sponsorship.ts), which refuses a moved task.`;

async function main() {
  const { values } = parseArgs({ options: { "request-id": { type: "string" }, apply: { type: "boolean" },
    help: { type: "boolean" } } });
  if (values.help) { console.log(help); return; }
  const requestId = values["request-id"];
  if (!requestId) throw Error("restore_arguments_required");
  process.env.LOG_LEVEL = "silent";
  const { restoreGrantedBrief } = await import("../server/utils/grantedBriefRestore");
  const result = await restoreGrantedBrief(requestId, { apply: Boolean(values.apply) });
  const { restored: _restored, ...printable } = result as Record<string, unknown>;
  console.log(JSON.stringify(printable, null, 2));
}

main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
