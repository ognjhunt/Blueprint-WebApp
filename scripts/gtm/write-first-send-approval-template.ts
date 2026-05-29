import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExactSiteHostedReviewGtmLedger,
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
const DEFAULT_PACKET_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval-blocker-packet.md",
);
const DEFAULT_FIRST_SEND_BLOCKER_ID = "human-blocker:exact-site-first-send-approval:2026-05-09";

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
  const packetPath = path.resolve(args.get("packet-output") ?? DEFAULT_PACKET_PATH);
  const write = args.get("write") === "1";
  const writePacket = args.get("write-packet") !== "0";
  const blockerId = args.get("blocker-id") ?? DEFAULT_FIRST_SEND_BLOCKER_ID;
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const audit = auditExactSiteHostedReviewGtmLedger(ledger);
  const pendingTargets = ledger.targets.filter((target) =>
    hasExactSiteRecipientBackedEvidence(target)
      && target.outbound.status === "draft_ready"
      && target.outbound.approvalState === "pending_first_send_approval",
  );
  const approvals = pendingTargets.map((target) => {
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
  });
  const generatedAt = new Date().toISOString();
  const payload = {
    schema: "blueprint/exact-site-hosted-review-first-send-approval-template/v1",
    generatedAt,
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
    approvals,
  };
  const proofReadyRows = approvals.filter((row) => row.track === "proof_ready_outreach").length;
  const demandSourcedRows = approvals.filter((row) => row.track === "demand_sourced_capture").length;
  const publicInboxRows = approvals.filter((row) =>
    row.reviewFlags.some((flag) => /public|general|inbox/i.test(flag)),
  ).length;
  const demandHandoffRows = approvals.filter((row) => row.landingPage.includes("/contact")).length;
  const proofSourceRows = approvals.filter((row) => row.proofSource.trim().length > 0).length;
  const blockedClaimRows = approvals.filter((row) => row.blockedClaims.length > 0).length;

  if (write) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (writePacket) {
      await fs.mkdir(path.dirname(packetPath), { recursive: true });
      const packet = [
        "# Blocker Title",
        "",
        "Exact-Site first-send batch needs row-level founder/operator approval before any live buyer sends.",
        "",
        "# Blocker Id",
        "",
        `\`${blockerId}\``,
        "",
        `Repo-local no-send packet generated at \`${generatedAt}\`.`,
        "",
        "# Why This Is Blocked",
        "",
        "The Exact-Site Hosted Review GTM ledger is recipient-backed and approval-ready, but it is not send-ready.",
        "",
        `- target rows: ${audit.summary.targets}`,
        `- recipient-backed targets: ${audit.summary.recipientBackedTargets}`,
        `- approval-ready targets: ${audit.summary.approvalReadyTargets}`,
        `- founder/operator approval needed targets: ${audit.summary.founderApprovalNeededTargets}`,
        `- reply-durability blocked targets: ${audit.summary.replyDurabilityBlockedTargets}`,
        `- stale next-action targets: ${audit.summary.staleNextActionTargets}`,
        `- stale blocker projection targets: ${audit.summary.staleBlockerProjectionTargets}`,
        `- human-approved targets: ${audit.summary.humanApprovedTargets}`,
        `- sent targets: ${audit.summary.sentTargets}`,
        `- replies: ${audit.summary.replies}`,
        `- hosted-review starts: ${audit.summary.hostedReviewStarts}`,
        `- qualified calls: ${audit.summary.qualifiedCalls}`,
        "",
        "Proceeding without row-level decisions would bypass the documented first-send human gate for external buyer outreach. Reply durability remains a separate downstream live-send gate and approval alone does not authorize dispatch.",
        "",
        "# Local Dry-Run Gate Summary",
        "",
        `- recipient-backed targets: ${audit.summary.recipientBackedTargets}`,
        `- approval rows: ${approvals.length}`,
        `- proof-ready outreach rows: ${proofReadyRows}`,
        `- demand-sourced capture rows: ${demandSourcedRows}`,
        `- proof-source rows: ${proofSourceRows}`,
        `- blocked-claim rows: ${blockedClaimRows}`,
        `- approval blockers: ${audit.summary.founderApprovalNeededTargets}`,
        `- reply-durability blockers: ${audit.summary.replyDurabilityBlockedTargets}`,
        "",
        "These are local approval and dry-run facts only. They do not prove founder approval, real dispatch, Gmail or SendGrid watcher durability, hosted-review starts, buyer replies, or operational launch readiness.",
        "",
        "# Recommended Answer",
        "",
        `Review \`${path.relative(process.cwd(), outputPath) || outputPath}\` and approve, edit, or reject each reviewed row.`,
        "",
        "Default recommendation: approve only rows where recipient evidence, proposed subject/body, draft angle, CTA, landing-page handoff, objection plan, proof source, and blocked claims are acceptable without inventing pricing, rights, readiness, traction, hosted-review starts, or reply proof.",
        "",
        "# Approval Rows",
        "",
        `- approval rows: ${approvals.length}`,
        "- approvals recorded: 0",
        `- proof-ready outreach rows: ${proofReadyRows}`,
        `- demand-sourced capture rows: ${demandSourcedRows}`,
        `- rows with public/general inbox review flags: ${publicInboxRows}`,
        `- rows with prefilled contact handoff URLs: ${demandHandoffRows}`,
        "",
        "# Exact Response Needed",
        "",
        "For each reviewed row, set `decision` to `approve`, `edit`, or `reject`. `approvedBy` is required for approvals. `approvalNote` is required for edits or rejection and recommended for approvals with review flags. Leave unreviewed rows at `decision=null`.",
        "",
        "# Execution Owner After Reply",
        "",
        "`growth-lead` owns applying explicit first-send decisions to the GTM ledger. `webapp-codex` owns repo validation after the reply is recorded. `blueprint-chief-of-staff` owns reply correlation and resume routing.",
        "",
        "# Immediate Next Action After Reply",
        "",
        "Only after explicit decisions are recorded with this blocker id, apply the approval packet and rerun local audit/report checks. Do not send email, poll Gmail, mutate live Paperclip, call providers, or touch payment setup from this packet.",
        "",
        "```bash",
        "npm run gtm:first-send-approval:apply -- --write --allow-blocked",
        "npm run gtm:hosted-review:audit",
        "npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked",
        "npm run human-replies:audit-durability -- --allow-not-ready",
        "```",
        "",
        "# Do Not Run Without Explicit Live Authorization",
        "",
        "```bash",
        "npm run gtm:send -- --write --dry-run 0",
        "npm run human-replies:poll",
        "npm run human-replies:send-test-blocker",
        "npm run human-replies:prove-production",
        "```",
        "",
        "# Evidence",
        "",
        `- \`${path.relative(process.cwd(), ledgerPath) || ledgerPath}\``,
        `- \`${path.relative(process.cwd(), outputPath) || outputPath}\``,
        "- `ops/paperclip/programs/human-blocker-packet-standard.md`",
        "- `ops/paperclip/programs/human-reply-handling-contract.md`",
        "",
        "# Non-Scope",
        "",
        "This packet does not authorize fake contacts, inferred emails, live sends, reply claims, hosted-review starts, city readiness claims, paid spend, pricing commitments, rights/privacy commitments, generated buyer proof, provider calls, Stripe changes, Gmail polling, or live Paperclip mutation.",
        "",
        "# Channel Target",
        "",
        "Repo-local no-send artifact. When live human-gate dispatch is configured, use Slack DM to `Nijel Hunt` for speed and email to `ohstnhunt@gmail.com` for a durable trail. Never use `hlfabhunt@gmail.com`.",
        "",
        "# Watcher / Resume Owner",
        "",
        `\`blueprint-chief-of-staff\` owns reply watching and correlation. Resume execution only after the response is recorded with blocker id \`${blockerId}\`.`,
      ].join("\n");
      await fs.writeFile(packetPath, `${packet}\n`, "utf8");
    }
  }

  process.stdout.write([
    "# First-Send Approval Template",
    "",
    `- mode: ${write ? "write" : "dry_run"}`,
    `- ledger: ${path.relative(process.cwd(), ledgerPath) || ledgerPath}`,
    `- output: ${path.relative(process.cwd(), outputPath) || outputPath}`,
    `- packet_output: ${path.relative(process.cwd(), packetPath) || packetPath}`,
    `- approval_rows: ${pendingTargets.length}`,
    "- approvals_recorded: 0",
    `- recipient_backed_targets: ${audit.summary.recipientBackedTargets}`,
    `- proof_ready_outreach_rows: ${proofReadyRows}`,
    `- demand_sourced_capture_rows: ${demandSourcedRows}`,
    `- proof_source_rows: ${proofSourceRows}`,
    `- blocked_claim_rows: ${blockedClaimRows}`,
    `- reply_durability_blockers: ${audit.summary.replyDurabilityBlockedTargets}`,
    `- approval_blockers: ${audit.summary.founderApprovalNeededTargets}`,
    "- live_send_status: blocked until founder decisions are recorded and reply durability passes",
    "",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
