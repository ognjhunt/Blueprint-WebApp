import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExactSiteHostedReviewGtmLedger } from "../../server/utils/exactSiteHostedReviewGtmPilot";
import {
  applyExactSiteFirstSendApprovals,
  type ExactSiteFirstSendApprovalPacket,
} from "../../server/utils/gtmFirstSendApprovals";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_APPROVAL_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json",
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

async function readApprovalPacket(packetPath: string): Promise<ExactSiteFirstSendApprovalPacket> {
  const raw = await fs.readFile(packetPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("First-send approval packet must be a JSON object.");
  }
  return parsed as ExactSiteFirstSendApprovalPacket;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const approvalPath = path.resolve(args.get("approval") ?? args.get("approval-path") ?? DEFAULT_APPROVAL_PATH);
  const write = args.get("write") === "1";
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const packet = await readApprovalPacket(approvalPath);
  const result = applyExactSiteFirstSendApprovals({ ledger, packet });

  if (write && result.errors.length === 0) {
    await fs.writeFile(ledgerPath, `${JSON.stringify(result.ledger, null, 2)}\n`, "utf8");
  }

  process.stdout.write([
    "# First-Send Approval Apply",
    "",
    `- mode: ${write ? "write" : "dry_run"}`,
    `- ledger: ${path.relative(process.cwd(), ledgerPath) || ledgerPath}`,
    `- approval_packet: ${path.relative(process.cwd(), approvalPath) || approvalPath}`,
    `- rows: ${result.summary.rows}`,
    `- approved: ${result.summary.approved}`,
    `- edit_requested: ${result.summary.editRequested}`,
    `- rejected: ${result.summary.rejected}`,
    `- skipped: ${result.summary.skipped}`,
    `- errors: ${result.summary.errors}`,
    "",
    "## Warnings",
    "",
    ...(result.warnings.length > 0 ? result.warnings.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Errors",
    "",
    ...(result.errors.length > 0 ? result.errors.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "- live_send_status: still gated by npm run human-replies:audit-durability and npm run gtm:send -- --dry-run",
    "",
  ].join("\n"));

  if (result.errors.length > 0 && args.get("allow-blocked") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
