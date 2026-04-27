import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExactSiteHostedReviewGtmLedger } from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { executeGtmSends } from "../../server/utils/gtmSendExecutor";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_REPORT_ROOT = path.join(REPO_ROOT, "ops/paperclip/reports/gtm-send-executor");

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

function renderReport(input: {
  ledgerPath: string;
  write: boolean;
  dryRun: boolean;
  result: Awaited<ReturnType<typeof executeGtmSends>>;
}) {
  return [
    "# GTM Send Executor",
    "",
    `- ledger: ${path.relative(process.cwd(), input.ledgerPath) || input.ledgerPath}`,
    `- mode: ${input.write ? "write" : "dry_run"}`,
    `- dry_run: ${input.dryRun}`,
    `- eligible: ${input.result.summary.eligible}`,
    `- sent: ${input.result.summary.sent}`,
    `- dry_run_receipts: ${input.result.summary.dryRun}`,
    `- skipped_approval: ${input.result.summary.skippedApproval}`,
    `- skipped_no_recipient: ${input.result.summary.skippedNoRecipient}`,
    `- skipped_no_message: ${input.result.summary.skippedNoMessage}`,
    `- skipped_already_sent: ${input.result.summary.skippedAlreadySent}`,
    `- failed: ${input.result.summary.failed}`,
    "",
    "## Receipts",
    "",
    ...(input.result.receipts.length > 0 ? input.result.receipts.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Errors",
    "",
    ...(input.result.errors.length > 0 ? input.result.errors.map((entry) => `- ${entry}`) : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const write = args.get("write") === "1";
  const dryRun = args.get("dry-run") !== "0";
  const targetIds = csv(args.get("target-id") || args.get("target-ids"));
  const maxSends = args.get("max-sends") ? Number(args.get("max-sends")) : undefined;
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const result = await executeGtmSends({
    ledger,
    dryRun,
    targetIds,
    maxSends,
    skipDurability: args.get("skip-durability") === "1",
  });
  const report = renderReport({
    ledgerPath,
    write,
    dryRun,
    result,
  });

  if (write && !dryRun) {
    await fs.writeFile(ledgerPath, `${JSON.stringify(result.ledger, null, 2)}\n`, "utf8");
  }

  if (write) {
    const reportDir = path.join(DEFAULT_REPORT_ROOT, todayIso());
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(path.join(reportDir, "send-executor.md"), report, "utf8");
    await fs.writeFile(
      path.join(reportDir, "send-executor-manifest.json"),
      `${JSON.stringify({
        schema: "blueprint/gtm-send-executor/v1",
        generatedAt: new Date().toISOString(),
        ledgerPath: path.relative(process.cwd(), ledgerPath),
        dryRun,
        summary: result.summary,
        receipts: result.receipts,
        errors: result.errors,
      }, null, 2)}\n`,
      "utf8",
    );
  }

  process.stdout.write(report);
  if (result.errors.length > 0 && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
