import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExactSiteHostedReviewGtmLedger,
  loadExactSiteHostedReviewGtmLedger,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { runGtmEnrichmentWaterfall } from "../../server/utils/gtmEnrichmentProviders";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_REPORT_ROOT = path.join(REPO_ROOT, "ops/paperclip/reports/gtm-enrichment");

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

function csv(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function renderMarkdown(input: {
  ledgerPath: string;
  write: boolean;
  selectRecipients: boolean;
  result: Awaited<ReturnType<typeof runGtmEnrichmentWaterfall>>;
}) {
  const lines = [
    "# GTM Enrichment Waterfall",
    "",
    `- ledger: ${path.relative(process.cwd(), input.ledgerPath) || input.ledgerPath}`,
    `- mode: ${input.write ? "write" : "dry_run"}`,
    `- select_recipients: ${input.selectRecipients}`,
    `- targets_considered: ${input.result.summary.targetsConsidered}`,
    `- targets_updated: ${input.result.summary.targetsUpdated}`,
    `- candidates_added: ${input.result.summary.candidatesAdded}`,
    `- selected_recipients: ${input.result.summary.selectedRecipients}`,
    `- provider_runs: ${input.result.summary.providerRuns}`,
    `- blockers: ${input.result.summary.blockers}`,
    "",
    "## Target Results",
    "",
    "| Target | Organization | Status | Candidates Added | Selected Recipient | Blockers |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...input.result.targetResults.map((entry) =>
      `| ${entry.targetId} | ${entry.organizationName} | ${entry.status} | ${entry.candidatesAdded} | ${entry.selectedRecipient || "none"} | ${entry.blockers.length} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const write = args.get("write") === "1";
  const selectRecipients = args.get("select-recipients") === "1";
  const targetIds = csv(args.get("target-id") || args.get("target-ids"));
  const providerKeys = csv(args.get("provider") || args.get("providers"));
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const result = await runGtmEnrichmentWaterfall({
    ledger,
    ledgerPath,
    targetIds,
    providerKeys,
    selectRecipients,
  });
  const markdown = renderMarkdown({
    ledgerPath,
    write,
    selectRecipients,
    result,
  });

  if (write) {
    await fs.writeFile(ledgerPath, `${JSON.stringify(result.ledger, null, 2)}\n`, "utf8");
    const reportDir = path.join(DEFAULT_REPORT_ROOT, todayIso());
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(path.join(reportDir, "enrichment-waterfall.md"), markdown, "utf8");
    await fs.writeFile(
      path.join(reportDir, "enrichment-waterfall-manifest.json"),
      `${JSON.stringify({
        schema: "blueprint/gtm-enrichment-waterfall/v1",
        generatedAt: new Date().toISOString(),
        ledgerPath: path.relative(process.cwd(), ledgerPath),
        summary: result.summary,
        targetResults: result.targetResults,
      }, null, 2)}\n`,
      "utf8",
    );
  }

  process.stdout.write(markdown);
  const audit = auditExactSiteHostedReviewGtmLedger(result.ledger);
  if (!audit.ok && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
