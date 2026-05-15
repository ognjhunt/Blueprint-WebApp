import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasExactSiteRecipientBackedEvidence,
  loadExactSiteHostedReviewGtmLedger,
  type ExactSiteGtmTarget,
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

function draftAngleForTarget(target: ExactSiteGtmTarget) {
  if (target.track === "proof_ready_outreach") {
    return "Invite the recipient to inspect a labeled exact-site hosted review, then ask what site or workflow would make the review more relevant.";
  }

  return "Ask which site or workflow Blueprint should capture first; do not imply that a hosted review already exists for this row.";
}

function ctaForTarget(target: ExactSiteGtmTarget) {
  if (target.track === "proof_ready_outreach") {
    return "Inspect the review, then name the more relevant site or workflow.";
  }

  return "Name the site or workflow worth capturing first.";
}

function landingPageForTarget(target: ExactSiteGtmTarget) {
  if (target.track === "proof_ready_outreach") {
    return target.artifact.hostedReviewPath || "/product";
  }

  return "/contact?persona=robot-team&buyerType=robot_team&interest=capture-access&path=request-capture&source=gtm-first-touch";
}

function reviewFlagForTarget(target: ExactSiteGtmTarget) {
  const flags: string[] = [];
  const recipientRole = String(target.recipient?.role || "").toLowerCase();
  const recipientEmail = String(target.recipient?.email || "").toLowerCase();

  if (target.track === "demand_sourced_capture") {
    flags.push("capture ask only; no hosted-review claim");
  }
  if (target.artifact.status === "draft") {
    flags.push("artifact is a draft opportunity brief");
  }
  if (
    recipientRole.includes("general")
    || recipientRole.includes("support")
    || recipientRole.includes("public inbox")
    || recipientEmail.startsWith("info@")
    || recipientEmail.startsWith("support@")
    || recipientEmail.startsWith("contact@")
    || recipientEmail.startsWith("community@")
  ) {
    flags.push("public/general inbox; expect routing friction");
  }

  return flags;
}

function objectionPlanForTarget(target: ExactSiteGtmTarget) {
  if (target.track === "proof_ready_outreach") {
    return "If they say the sample is not their site, ask for the exact workflow to capture next and keep the sample labeled as representative proof shape.";
  }

  return "If they ask for a hosted review first, offer only labeled sample proof or state that a new capture is needed before a buyer-specific review exists.";
}

function proofSourceForTarget(target: ExactSiteGtmTarget) {
  const artifactPath = target.artifact?.path || "missing artifact path";
  if (target.track === "proof_ready_outreach") {
    return [
      `Labeled hosted-review proof at ${artifactPath}.`,
      target.artifact?.hostedReviewPath ? `Hosted review handoff: ${target.artifact.hostedReviewPath}.` : null,
      target.artifact?.siteWorldId ? `Site-world id: ${target.artifact.siteWorldId}.` : null,
      "Use as representative proof shape only; do not claim recipient/customer-specific proof.",
    ].filter(Boolean).join(" ");
  }

  return [
    `Draft opportunity brief at ${artifactPath}.`,
    "No hosted review or site-world package exists for this target yet.",
    "Use only to ask which site/workflow should be captured first.",
  ].join(" ");
}

function blockedClaimsForTarget(target: ExactSiteGtmTarget) {
  const claims = [
    "No live send, reply, hosted-review start, qualified call, customer traction, paid spend, sender durability, or dispatch authorization is approved by this packet.",
    "No pricing, legal, privacy, rights, permission, readiness, deployment, or guaranteed support commitment is approved by this packet.",
  ];

  if (target.track === "proof_ready_outreach") {
    claims.push("Do not present the sample review as the recipient's site, a customer result, or a deployment outcome.");
  } else {
    claims.push("Do not imply a hosted review, site-world package, package access, or capture evidence already exists for this target.");
  }

  if (target.recipient?.email) {
    claims.push("Recipient-backed evidence proves the address source only; it does not prove buyer intent or permission to make unsupported claims.");
  }

  return claims;
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
      "Review recipient evidence, draft angle, CTA, landing-page handoff, objection plan, and review flags before setting a decision.",
      "Set decision to approve, edit, or reject only for rows the founder/operator has actually reviewed.",
      "Do not approve pricing, legal, privacy, permission, rights, readiness, live spend, sender durability, or live dispatch from this packet.",
      "Live sends remain blocked until decisions are applied, npm run gtm:send -- --dry-run --allow-blocked is rerun, npm run human-replies:audit-durability passes, and live dispatch is explicitly authorized.",
      "Leave decision null for rows that have not been reviewed.",
    ],
    reviewChecklist: [
      "Recipient email and evidence source are acceptable for a first touch.",
      "Message asks one clear thing and stays aligned to the row track.",
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
    approvals: pendingTargets.map((target) => ({
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
      proofSource: proofSourceForTarget(target),
      draftAngle: draftAngleForTarget(target),
      cta: ctaForTarget(target),
      landingPage: landingPageForTarget(target),
      objectionPlan: objectionPlanForTarget(target),
      blockedClaims: blockedClaimsForTarget(target),
      reviewFlags: reviewFlagForTarget(target),
      reviewerPrompt: "Approve, edit, or reject this first-send draft. Approval here does not authorize live dispatch.",
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
