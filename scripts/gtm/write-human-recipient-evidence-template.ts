import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExactSiteHostedReviewGtmLedger } from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { buildHumanRecipientEvidenceTemplate } from "../../server/utils/gtmEnrichmentProviders";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_OUTPUT_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-human-recipient-evidence.template.json",
);

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "1");
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const outputPath = path.resolve(args.get("output") ?? DEFAULT_OUTPUT_PATH);
  const write = args.get("write") === "1";
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const template = buildHumanRecipientEvidenceTemplate({
    ledger,
    ledgerPath: path.relative(process.cwd(), ledgerPath) || ledgerPath,
  });
  const payload = `${JSON.stringify(template, null, 2)}\n`;

  if (write) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, payload, "utf8");
  }

  process.stdout.write([
    "# Human Recipient Evidence Template",
    "",
    `- mode: ${write ? "write" : "dry_run"}`,
    `- ledger: ${path.relative(process.cwd(), ledgerPath) || ledgerPath}`,
    `- output: ${path.relative(process.cwd(), outputPath) || outputPath}`,
    `- target_rows: ${template.recipients.length}`,
    "- selected_for_first_send: 0",
    "- recipient_emails_written: 0",
    "",
    "Run validation after filling source-backed rows:",
    `npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path ${path.relative(process.cwd(), outputPath) || outputPath}`,
    "",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
