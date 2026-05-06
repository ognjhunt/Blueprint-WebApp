import path from "node:path";
import {
  type ExactSiteGtmAuditResult,
  type ExactSiteGtmBlocker,
  type ExactSiteGtmPilotLedger,
  type ExactSiteGtmPaperclipIssueRef,
  type ExactSiteGtmTarget,
  hasExactSiteRecipientBackedEvidence,
} from "./exactSiteHostedReviewGtmPilot";
import type { OutboundReplyDurabilityStatus } from "./outbound-reply-durability";

export type ExactSiteBuyerLoopSummary = {
  city: string | null;
  reportDate: string;
  targetRows: number;
  recipientBackedTargets: number;
  enrichmentAttemptedTargets: number;
  enrichmentCandidateTargets: number;
  enrichmentContactFoundTargets: number;
  approvalReadyTargets: number;
  founderApprovalNeededTargets: number;
  sentTargets: number;
  replies: number;
  hostedReviewStarts: number;
  qualifiedCalls: number;
  proofReadyArtifacts: number;
  captureAsks: number;
  nextActionRows: number;
  openBlockers: number;
  paperclipLinkedBlockers: number;
  decisionTouches: number;
  decisionTouchGoal: number;
  decisionTouchGap: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyTouchTargetMin: number;
  loopStatus: "blocked" | "warming" | "learning" | "decision_due";
  durabilityStatus: "ready" | "blocked" | "unknown";
};

export type ExactSiteBuyerLoopReport = {
  summary: ExactSiteBuyerLoopSummary;
  targets: ExactSiteGtmTarget[];
  contactQueue: ExactSiteGtmTarget[];
  founderApprovalQueue: ExactSiteGtmTarget[];
  proofArtifactQueue: ExactSiteGtmTarget[];
  nextActionQueue: ExactSiteGtmTarget[];
  blockerQueue: ExactSiteBuyerLoopBlockerRow[];
  markdown: string;
};

export type ExactSiteBuyerLoopBlockerRow = {
  targetLabel: string;
  blocker: ExactSiteGtmBlocker;
  paperclipIssue: string;
};

function hasText(value: string | undefined | null) {
  return Boolean(value && value.trim());
}

function normalizeCity(value: string | undefined | null) {
  return String(value || "").trim().toLowerCase();
}

function dateOnly(value: string | undefined | null) {
  return hasText(value) ? String(value).slice(0, 10) : "";
}

function daysBetween(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

function targetNextAction(target: ExactSiteGtmTarget) {
  if (hasText(target.sales?.nextAction)) {
    return target.sales?.nextAction || "";
  }
  if (!hasExactSiteRecipientBackedEvidence(target)) {
    return "Find explicit recipient-backed contact evidence or keep this row in research.";
  }
  if (target.outbound.status === "draft_ready") {
    return "Founder approves, edits, or rejects the draft before the first send batch.";
  }
  if (target.outbound.status === "human_approved") {
    return "Send through the configured provider and write the send ledger receipt.";
  }
  if (target.outbound.status === "sent") {
    return "Watch durable replies, record objection or next meeting, then route to call or hosted review.";
  }
  if (target.outbound.status === "replied") {
    return "Classify reply and route to qualified call, hosted-review start, capture ask, no-fit, or blocker.";
  }
  return "Keep current state visible and move only when evidence changes.";
}

function targetMarkdownLine(target: ExactSiteGtmTarget) {
  const recipient = target.recipient?.email || "missing";
  const approval = target.outbound.approvalState || "not_recorded";
  const next = targetNextAction(target).replace(/\|/g, "/");
  return `| ${target.organizationName} | ${target.track} | ${recipient} | ${target.outbound.status} | ${approval} | ${next} |`;
}

function targetListLine(target: ExactSiteGtmTarget) {
  return `- ${target.id}: ${target.organizationName} / ${target.buyerSegment} / ${targetNextAction(target)}`;
}

function cleanTableValue(value: string | undefined | null) {
  return String(value || "").replace(/\|/g, "/").trim();
}

function isOpenBlocker(blocker: ExactSiteGtmBlocker) {
  return blocker.status !== "resolved";
}

function paperclipIssueLabel(
  blocker: ExactSiteGtmBlocker,
  paperclipIssues: ExactSiteGtmPaperclipIssueRef[] | undefined,
) {
  if (hasText(blocker.paperclipIssueIdentifier)) return blocker.paperclipIssueIdentifier || "";
  if (hasText(blocker.paperclipIssueId)) return blocker.paperclipIssueId || "";
  const issue = (paperclipIssues ?? []).find((entry) =>
    ((entry.blockerIds ?? []).includes(blocker.id) || (entry.blockerIds ?? []).length === 0)
    && (hasText(entry.identifier) || hasText(entry.id)),
  );
  return issue?.identifier || issue?.id || "missing";
}

function blockerMarkdownLine(row: ExactSiteBuyerLoopBlockerRow) {
  return [
    cleanTableValue(row.targetLabel),
    cleanTableValue(row.blocker.summary),
    cleanTableValue(row.blocker.owner),
    cleanTableValue(row.blocker.status),
    cleanTableValue(row.paperclipIssue || "missing"),
    cleanTableValue(row.blocker.nextAction),
  ].join(" | ");
}

export function buildExactSiteHostedReviewBuyerLoopReport(input: {
  ledger: ExactSiteGtmPilotLedger;
  audit: ExactSiteGtmAuditResult;
  ledgerPath: string;
  city?: string | null;
  reportDate?: string;
  durability?: OutboundReplyDurabilityStatus | null;
}): ExactSiteBuyerLoopReport {
  const reportDate = input.reportDate || new Date().toISOString().slice(0, 10);
  const cityKey = normalizeCity(input.city);
  const cityTargets = cityKey
    ? input.ledger.targets.filter((target) => normalizeCity(target.city) === cityKey)
    : input.ledger.targets;
  const targets = cityKey && cityTargets.length === 0 ? input.ledger.targets : cityTargets;
  const contactQueue = targets.filter((target) => !hasExactSiteRecipientBackedEvidence(target));
  const founderApprovalQueue = targets.filter((target) =>
    target.outbound.status === "draft_ready" && hasExactSiteRecipientBackedEvidence(target),
  );
  const proofArtifactQueue = targets.filter((target) =>
    target.track === "demand_sourced_capture"
    || (target.artifact.status !== "review_ready" && target.artifact.status !== "delivered"),
  );
  const nextActionQueue = targets.filter((target) => !hasText(target.sales?.nextAction));
  const ledgerBlockerRows: ExactSiteBuyerLoopBlockerRow[] = (input.ledger.blockers ?? [])
    .filter(isOpenBlocker)
    .map((blocker) => ({
      targetLabel: "pilot",
      blocker,
      paperclipIssue: paperclipIssueLabel(blocker, input.ledger.paperclipIssues),
    }));
  const targetBlockerRows: ExactSiteBuyerLoopBlockerRow[] = targets.flatMap((target) =>
    (target.blockers ?? [])
      .filter(isOpenBlocker)
      .map((blocker) => ({
        targetLabel: `${target.id}: ${target.organizationName}`,
        blocker,
        paperclipIssue: paperclipIssueLabel(blocker, target.paperclipIssues),
      })),
  );
  const blockerQueue = [...ledgerBlockerRows, ...targetBlockerRows];
  const proofReadyArtifacts = targets.filter((target) =>
    target.artifact.status === "review_ready" || target.artifact.status === "delivered",
  ).length;
  const captureAsks = targets.filter((target) => Boolean(target.captureAsk)).length;
  const sentTargets = targets.filter((target) =>
    ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound.status),
  ).length;
  const recipientBackedTargets = targets.filter(hasExactSiteRecipientBackedEvidence).length;
  const enrichmentAttemptedTargets = targets.filter((target) => (target.enrichment?.providerRuns ?? []).length > 0).length;
  const enrichmentCandidateTargets = targets.filter((target) => (target.enrichment?.recipientCandidates ?? []).length > 0).length;
  const enrichmentContactFoundTargets = targets.filter((target) => target.enrichment?.status === "contact_found").length;
  const approvalReadyTargets = founderApprovalQueue.length;
  const paperclipLinkedBlockers = blockerQueue.filter((row) => row.paperclipIssue !== "missing").length;
  const daysElapsed = daysBetween(input.ledger.pilot.startDate, reportDate);
  const daysRemaining = Math.max(0, daysBetween(reportDate, input.ledger.pilot.endDate));
  const decisionTouchGoal = input.ledger.pilot.decisionTouchGoal || 100;
  const decisionTouchGap = Math.max(0, decisionTouchGoal - sentTargets);
  const replies = input.audit.summary.replies;
  const hostedReviewStarts = input.audit.summary.hostedReviewStarts;
  const qualifiedCalls = input.audit.summary.qualifiedCalls;
  const organicSignal = replies + hostedReviewStarts + qualifiedCalls;
  const durabilityStatus = input.durability?.status || "unknown";
  const loopStatus: ExactSiteBuyerLoopSummary["loopStatus"] =
    sentTargets >= decisionTouchGoal || daysRemaining === 0
      ? "decision_due"
      : organicSignal > 0
        ? "learning"
        : recipientBackedTargets > 0
          ? "warming"
          : "blocked";

  const summary: ExactSiteBuyerLoopSummary = {
    city: input.city || null,
    reportDate,
    targetRows: targets.length,
    recipientBackedTargets,
    enrichmentAttemptedTargets,
    enrichmentCandidateTargets,
    enrichmentContactFoundTargets,
    approvalReadyTargets,
    founderApprovalNeededTargets: founderApprovalQueue.length,
    sentTargets,
    replies,
    hostedReviewStarts,
    qualifiedCalls,
    proofReadyArtifacts,
    captureAsks,
    nextActionRows: targets.length - nextActionQueue.length,
    openBlockers: blockerQueue.length,
    paperclipLinkedBlockers,
    decisionTouches: sentTargets,
    decisionTouchGoal,
    decisionTouchGap,
    daysElapsed,
    daysRemaining,
    dailyTouchTargetMin: input.ledger.pilot.dailyTouchTargetMin,
    loopStatus,
    durabilityStatus,
  };

  const relativeLedgerPath = path.relative(process.cwd(), input.ledgerPath) || input.ledgerPath;
  const cityNote = cityKey && cityTargets.length === 0
    ? `No city-specific rows matched ${input.city}; using the global target queue until this city adds its own rows.`
    : input.city
      ? `Filtered to ${input.city}.`
      : "Global pilot view.";
  const markdown = [
    "# Exact-Site Hosted Review Buyer Loop",
    "",
    `- report_date: ${reportDate}`,
    `- city: ${input.city || "global"}`,
    `- ledger: ${relativeLedgerPath}`,
    `- loop_status: ${summary.loopStatus}`,
    `- durability_status: ${summary.durabilityStatus}`,
    `- note: ${cityNote}`,
    "",
    "## Daily Dashboard",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Target rows | ${summary.targetRows} |`,
    `| Recipient-backed targets | ${summary.recipientBackedTargets} |`,
    `| Enrichment attempted targets | ${summary.enrichmentAttemptedTargets} |`,
    `| Enrichment candidate targets | ${summary.enrichmentCandidateTargets} |`,
    `| Enrichment contact-found targets | ${summary.enrichmentContactFoundTargets} |`,
    `| Founder approval needed | ${summary.founderApprovalNeededTargets} |`,
    `| Sent touches | ${summary.sentTargets} |`,
    `| Replies | ${summary.replies} |`,
    `| Hosted-review starts | ${summary.hostedReviewStarts} |`,
    `| Qualified calls | ${summary.qualifiedCalls} |`,
    `| Proof-ready artifacts | ${summary.proofReadyArtifacts} |`,
    `| Capture asks | ${summary.captureAsks} |`,
    `| Explicit next-action rows | ${summary.nextActionRows} |`,
    `| Open blockers | ${summary.openBlockers} |`,
    `| Paperclip-linked blockers | ${summary.paperclipLinkedBlockers} |`,
    `| 100-touch decision gap | ${summary.decisionTouchGap} |`,
    `| Days remaining | ${summary.daysRemaining} |`,
    "",
    "## One Sales Ledger",
    "",
    "| Target | Track | Recipient | Status | Approval | Next action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(targets.length > 0 ? targets.map(targetMarkdownLine) : ["| none | none | none | none | none | Add target rows. |"]),
    "",
    "## Recipient-Backed Contact Engine",
    "",
    "- Run `npm run gtm:enrichment:run -- --write` to refresh provider-backed recipient evidence before founder approval.",
    "- Clay or another enrichment tool may feed this lane only as a provider-normalized candidate source; the GTM ledger remains the system of record.",
    "",
    ...(contactQueue.length > 0
      ? contactQueue.slice(0, 30).map(targetListLine)
      : ["- no missing recipient-backed target rows in this view"]),
    "",
    "## Founder First Send Batch",
    "",
    ...(founderApprovalQueue.length > 0
      ? [
          "- Founder action: approve, edit, or reject these recipient-backed drafts. Do not authorize pricing, rights, privacy, legal, or permission commitments here.",
          ...founderApprovalQueue.slice(0, 30).map(targetListLine),
        ]
      : ["- no recipient-backed drafts are ready for founder approval yet"]),
    "",
    "## Proof Artifact Queue",
    "",
    ...(proofArtifactQueue.length > 0
      ? proofArtifactQueue.slice(0, 30).map(targetListLine)
      : ["- all rows in this view have review-ready or delivered proof artifacts"]),
    "",
    "## Blocker Ledger",
    "",
    "| Target | Blocker | Owner | Status | Paperclip issue | Next action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(blockerQueue.length > 0
      ? blockerQueue.slice(0, 30).map((row) => `| ${blockerMarkdownLine(row)} |`)
      : ["| none | none | none | none | none | none |"]),
    "",
    "## Durable Reply Plumbing",
    "",
    ...(input.durability
      ? [
          `- status: ${input.durability.status}`,
          `- sender_configured: ${input.durability.sender.transport.configured}`,
          `- sender_verification: ${input.durability.sender.sender.verificationStatus}`,
          `- watcher_enabled: ${input.durability.humanReply.watcherEnabled}`,
          ...(input.durability.blockers.length > 0
            ? ["- blockers:", ...input.durability.blockers.map((entry) => `  - ${entry}`)]
            : ["- blockers: none"]),
        ]
      : [
          "- status: unknown",
          "- run `npm run human-replies:audit-durability` before marking buyer outreach production-durable.",
        ]),
    "",
    "## Public Conversion Rule",
    "",
    "- Robot-team pages should drive exactly two buyer actions: inspect an exact-site review now, or request a capture for the site/workflow they need.",
    "- Do not add public CTAs that create generic demos, platform tours, vague waitlist joins, or unsupported readiness claims for this wedge.",
    "",
    "## Routine Pruning Rule",
    "",
    "- During city launch, product/proof owns proof artifacts, demand/sales owns the sales ledger, and reliability owns send/reply durability.",
    "- Agent work that does not change target, contact, draft, approval, send, reply, call, hosted-review start, exact-site request, capture ask, or blocker state does not count as progress.",
    "",
    "## 14-Day Decision Rule",
    "",
    `- Decision goal: ${summary.decisionTouchGoal} recipient-backed touches in the 14-day window.`,
    `- Current touches: ${summary.decisionTouches}.`,
    `- Remaining gap: ${summary.decisionTouchGap}.`,
    organicSignal > 0
      ? "- Organic signal exists. Decide whether the signal is strong enough to repeat by city or vertical."
      : "- No organic signal recorded yet. After 100 touches or at day 14, change ICP, offer, artifact, or CTA instead of extending the same motion by default.",
  ].join("\n");

  return {
    summary,
    targets,
    contactQueue,
    founderApprovalQueue,
    proofArtifactQueue,
    nextActionQueue,
    blockerQueue,
    markdown: `${markdown}\n`,
  };
}
