import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExactSiteHostedReviewGtmLedger,
  loadExactSiteHostedReviewGtmLedger,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { buildExactSiteHostedReviewBuyerLoopReport } from "../../server/utils/exactSiteHostedReviewBuyerLoop";
import { buildOutboundReplyDurabilityStatus } from "../../server/utils/outbound-reply-durability";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_REPORT_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/exact-site-hosted-review-buyer-loop",
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const reportDate = args.get("date") || todayIso();
  const city = args.get("city") || null;
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const audit = auditExactSiteHostedReviewGtmLedger(ledger);
  const durability = args.get("skip-durability") === "1"
    ? null
    : await buildOutboundReplyDurabilityStatus();
  const report = buildExactSiteHostedReviewBuyerLoopReport({
    ledger,
    audit,
    ledgerPath,
    city,
    reportDate,
    durability,
  });

  if (args.get("write") === "1") {
    const reportRoot = path.resolve(args.get("out-dir") ?? DEFAULT_REPORT_ROOT);
    const reportDir = path.join(reportRoot, city ? slugify(city) : "global", reportDate);
    await fs.mkdir(reportDir, { recursive: true });
    const markdownPath = path.join(reportDir, "buyer-loop.md");
    const manifestPath = path.join(reportDir, "buyer-loop-manifest.json");
    await fs.writeFile(markdownPath, report.markdown, "utf8");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        schema: "blueprint/exact-site-hosted-review-buyer-loop/v1",
        reportDate,
        city,
        ledgerPath: path.relative(process.cwd(), ledgerPath),
        summary: report.summary,
        auditStatus: audit.ok ? "ok" : "blocked",
        auditFindings: audit.findings,
      }, null, 2),
      "utf8",
    );
    process.stdout.write(`${path.relative(process.cwd(), markdownPath)}\n`);
  } else {
    process.stdout.write(report.markdown);
  }

  if (!audit.ok && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
