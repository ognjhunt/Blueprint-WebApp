import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExactSiteHostedReviewGtmLedger } from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { validateHumanRecipientEvidenceFile } from "../../server/utils/gtmEnrichmentProviders";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
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

function renderMarkdown(input: Awaited<ReturnType<typeof validateHumanRecipientEvidenceFile>>) {
  return [
    "# Human Recipient Evidence Validation",
    "",
    `- evidence_path: ${input.evidencePath}`,
    `- total_rows: ${input.totalRows}`,
    `- matched_rows: ${input.matchedRows}`,
    `- selected_rows: ${input.selectedRows}`,
    `- valid_selected_rows: ${input.validSelectedRows}`,
    `- targets_with_selected_evidence: ${input.targetsWithSelectedEvidence.length}`,
    `- blockers: ${input.blockers.length}`,
    "",
    "## Row Results",
    "",
    "| Row | Status | Targets | Organizations | Email | Selected | Blockers |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
    ...input.rowResults.map((row) =>
      `| ${row.index} | ${row.status} | ${row.targetIds.join(", ") || "none"} | ${row.organizationNames.join(", ") || "none"} | ${row.email || "none"} | ${row.selectedForFirstSend ? "yes" : "no"} | ${row.blockers.join("; ") || "none"} |`,
    ),
    "",
    "## Blockers",
    "",
    ...(input.blockers.length > 0 ? input.blockers.map((entry) => `- ${entry}`) : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const evidencePath =
    args.get("human-recipient-evidence-path")
    || args.get("human-evidence-path")
    || process.env.BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH
    || process.env.BLUEPRINT_GTM_MANUAL_RECIPIENT_EVIDENCE_PATH
    || "";
  if (!evidencePath) {
    throw new Error("Set --human-recipient-evidence-path or BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH.");
  }

  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const result = await validateHumanRecipientEvidenceFile({
    ledger,
    evidencePath,
  });

  process.stdout.write(renderMarkdown(result));
  if (result.blockers.length > 0 && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
