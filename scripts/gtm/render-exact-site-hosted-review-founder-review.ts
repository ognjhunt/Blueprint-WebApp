import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExactSiteHostedReviewGtmLedger,
  loadExactSiteHostedReviewGtmLedger,
  renderExactSiteHostedReviewGtmFounderReviewMarkdown,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_REPORT_DIR = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/exact-site-hosted-review-gtm-pilot",
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const reportDate = args.get("date") || todayIso();
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const result = auditExactSiteHostedReviewGtmLedger(ledger);
  const report = renderExactSiteHostedReviewGtmFounderReviewMarkdown(
    ledger,
    result,
    ledgerPath,
    reportDate,
  );

  if (args.get("write") === "1") {
    const reportDir = path.resolve(args.get("out-dir") ?? DEFAULT_REPORT_DIR);
    await fs.mkdir(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `${reportDate}.md`);
    await fs.writeFile(reportPath, report, "utf8");
    process.stdout.write(`${path.relative(process.cwd(), reportPath)}\n`);
  } else {
    process.stdout.write(report);
  }

  if (!result.ok && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
