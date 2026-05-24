import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasExactSiteRecipientBackedEvidence,
  loadExactSiteHostedReviewGtmLedger,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { buildExactSiteFirstTouchReview } from "../../server/utils/exactSiteHostedReviewFirstTouch";

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
      "Review recipient evidence, proposed subject/body, draft angle, CTA, landing-page handoff, objection plan, and review flags before setting a decision.",
      "Set decision to approve, edit, or reject only for rows the founder/operator has actually reviewed.",
      "Do not approve pricing, legal, privacy, permission, rights, readiness, live spend, sender durability, or live dispatch from this packet.",
      "Live sends remain blocked until decisions are applied, npm run gtm:send -- --dry-run --allow-blocked is rerun, npm run human-replies:audit-durability passes, and live dispatch is explicitly authorized.",
      "Leave decision null for rows that have not been reviewed.",
    ],
    reviewChecklist: [
      "Recipient email and evidence source are acceptable for a first touch.",
      "Proposed subject and body ask one clear thing and stay aligned to the row track.",
      "Proof source matches the CTA and does not overstate what exists.",
      "Proof-ready rows link to a labeled review/sample without claiming customer traction.",
      "Demand-sourced rows ask for the site/workflow to capture and do not imply a hosted review exists.",
      "Landing-page handoff matches the CTA.",
      "Blocked claims are preserved in the final draft and approval note.",
      "Objection response can be answered from ledger evidence and public pages without inventing claims.",
    ],
    decisionOptions: [
      "approve: row may move to human_approved after apply, but live send remains separately gated.",
      "edit: row stays draft_ready with a required revision note.",
      "reject: row stays blocked until the target, proof artifact, recipient, or message is revised.",
    ],
    approvals: pendingTargets.map((target) => {
      const review = buildExactSiteFirstTouchReview(target);
      return {
        targetId: target.id,
        organizationName: target.organizationName,
        recipientEmail: target.recipient?.email || null,
        recipientRole: target.recipient?.role || null,
        recipientEvidenceSource: target.recipient?.evidenceSource || null,
        recipientEvidenceType: target.recipient?.evidenceType || null,
        track: target.track,
        buyerSegment: target.buyerSegment,
        workflowNeed: target.workflowNeed,
        intentSignals: target.intentSignals,
        messagePath: target.outbound.messagePath || null,
        artifactPath: target.artifact?.path || null,
        hostedReviewPath: target.artifact?.hostedReviewPath || null,
        siteWorldId: target.artifact?.siteWorldId || null,
        proofSource: review.proofSource,
        proposedSubject: review.proposedSubject,
        proposedBody: review.proposedBody,
        draftAngle: review.draftAngle,
        cta: review.cta,
        landingPage: review.landingPage,
        objectionPlan: review.objectionPlan,
        blockedClaims: review.blockedClaims,
        reviewFlags: review.reviewFlags,
        reviewerPrompt: review.reviewerPrompt,
        decision: null as "approve" | "edit" | "reject" | null,
        approvedBy: null as string | null,
        approvalNote: null as string | null,
      };
    }),
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
