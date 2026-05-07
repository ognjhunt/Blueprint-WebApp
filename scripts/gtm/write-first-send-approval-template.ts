import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasExactSiteRecipientBackedEvidence,
  loadExactSiteHostedReviewGtmLedger,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_OUTPUT_PATH = path.join(
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const outputPath = path.resolve(args.get("output") ?? DEFAULT_OUTPUT_PATH);
  const write = args.get("write") === "1";
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const pendingTargets = ledger.targets.filter((target) =>
    hasExactSiteRecipientBackedEvidence(target)
      && target.outbound.status === "draft_ready"
      && target.outbound.approvalState === "pending_first_send_approval",
  );
  const payload = {
    schema: "blueprint/exact-site-hosted-review-first-send-approval-template/v1",
    generatedAt: new Date().toISOString(),
    ledgerPath: path.relative(process.cwd(), ledgerPath) || ledgerPath,
    instructions: [
      "Set decision to approve, edit, or reject for each row the founder has actually reviewed.",
      "Do not approve pricing, legal, privacy, permission, rights, readiness, live spend, or sender durability from this packet.",
      "Live sends remain blocked until npm run human-replies:audit-durability passes.",
      "Leave decision null for rows that have not been reviewed.",
    ],
    approvals: pendingTargets.map((target) => ({
      targetId: target.id,
      organizationName: target.organizationName,
      recipientEmail: target.recipient?.email || null,
      recipientEvidenceSource: target.recipient?.evidenceSource || null,
      track: target.track,
      buyerSegment: target.buyerSegment,
      workflowNeed: target.workflowNeed,
      messagePath: target.outbound.messagePath || null,
      artifactPath: target.artifact?.path || null,
      decision: null as "approve" | "edit" | "reject" | null,
      approvedBy: null as string | null,
      approvalNote: null as string | null,
    })),
  };

  if (write) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  process.stdout.write([
    "# First-Send Approval Template",
    "",
    `- mode: ${write ? "write" : "dry_run"}`,
    `- ledger: ${path.relative(process.cwd(), ledgerPath) || ledgerPath}`,
    `- output: ${path.relative(process.cwd(), outputPath) || outputPath}`,
    `- approval_rows: ${pendingTargets.length}`,
    "- approvals_recorded: 0",
    "- live_send_status: blocked until founder decisions are recorded and reply durability passes",
    "",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
