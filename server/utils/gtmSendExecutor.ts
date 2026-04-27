import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExactSiteHostedReviewGtmLedger,
  type ExactSiteGtmPilotLedger,
  type ExactSiteGtmTarget,
} from "./exactSiteHostedReviewGtmPilot";
import { buildOutboundReplyDurabilityStatus } from "./outbound-reply-durability";
import {
  getCityLaunchSenderStatus,
  sendEmail,
} from "./email";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SEND_LEDGER_ROOT = path.join(REPO_ROOT, "ops/paperclip/reports/gtm-send-ledger");

export type GtmSendExecutionResult = {
  ledger: ExactSiteGtmPilotLedger;
  summary: {
    eligible: number;
    sent: number;
    dryRun: number;
    skippedApproval: number;
    skippedNoRecipient: number;
    skippedNoMessage: number;
    skippedAlreadySent: number;
    failed: number;
  };
  receipts: string[];
  errors: string[];
};

function hasText(value: string | undefined | null) {
  return Boolean(value && value.trim());
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function receiptDir() {
  return path.join(DEFAULT_SEND_LEDGER_ROOT, todayIso());
}

function emailBodyForTarget(target: ExactSiteGtmTarget) {
  if (target.outbound.messagePath) {
    return `Blueprint GTM approved draft for ${target.organizationName} is recorded at ${target.outbound.messagePath}.\n\n${target.workflowNeed}`;
  }
  return "";
}

function emailSubjectForTarget(target: ExactSiteGtmTarget) {
  if (target.track === "proof_ready_outreach") {
    return `Exact-site hosted review for ${target.buyerSegment}`;
  }
  return `Which ${target.buyerSegment} site should Blueprint capture next?`;
}

function markDailySend(ledger: ExactSiteGtmPilotLedger) {
  const today = todayIso();
  const day = ledger.dailyActivity.find((entry) => entry.date === today);
  if (day) {
    day.sentTouches += 1;
  } else {
    ledger.dailyActivity.push({
      date: today,
      draftedTouches: 0,
      approvedTouches: 0,
      sentTouches: 1,
      replies: 0,
      hostedReviewStarts: 0,
      qualifiedCalls: 0,
      contentDrafts: 0,
      paidSpendCents: 0,
    });
  }
}

async function writeReceipt(input: {
  target: ExactSiteGtmTarget;
  dryRun: boolean;
  sent: boolean;
  error?: string;
}) {
  const dir = receiptDir();
  await fs.mkdir(dir, { recursive: true });
  const receiptPath = path.join(dir, `${input.target.id}.json`);
  await fs.writeFile(
    receiptPath,
    `${JSON.stringify({
      schema: "blueprint/gtm-send-receipt/v1",
      generatedAt: new Date().toISOString(),
      dryRun: input.dryRun,
      sent: input.sent,
      targetId: input.target.id,
      organizationName: input.target.organizationName,
      recipient: input.target.recipient?.email || null,
      subject: emailSubjectForTarget(input.target),
      error: input.error || null,
    }, null, 2)}\n`,
    "utf8",
  );
  return path.relative(REPO_ROOT, receiptPath).replaceAll(path.sep, "/");
}

function eligibleTargets(ledger: ExactSiteGtmPilotLedger, targetIds?: string[]) {
  const filter = new Set(targetIds ?? []);
  return ledger.targets.filter((target) => {
    if (filter.size > 0 && !filter.has(target.id)) return false;
    return target.outbound.status === "human_approved"
      || (
        target.outbound.status === "draft_ready"
        && target.outbound.approvalState === "approved"
      );
  });
}

export async function executeGtmSends(input: {
  ledger: ExactSiteGtmPilotLedger;
  dryRun?: boolean;
  targetIds?: string[];
  maxSends?: number;
  skipDurability?: boolean;
}): Promise<GtmSendExecutionResult> {
  const dryRun = input.dryRun !== false;
  const audit = auditExactSiteHostedReviewGtmLedger(input.ledger);
  if (!audit.ok) {
    return {
      ledger: input.ledger,
      summary: {
        eligible: 0,
        sent: 0,
        dryRun: 0,
        skippedApproval: 0,
        skippedNoRecipient: 0,
        skippedNoMessage: 0,
        skippedAlreadySent: 0,
        failed: 1,
      },
      receipts: [],
      errors: ["GTM ledger audit has errors; sends are blocked until audit passes."],
    };
  }

  if (!input.skipDurability) {
    const durability = await buildOutboundReplyDurabilityStatus();
    if (!durability.ok) {
      return {
        ledger: input.ledger,
        summary: {
          eligible: 0,
          sent: 0,
          dryRun: 0,
          skippedApproval: 0,
          skippedNoRecipient: 0,
          skippedNoMessage: 0,
          skippedAlreadySent: 0,
          failed: 1,
        },
        receipts: [],
        errors: [
          "Outbound reply durability is blocked; run npm run human-replies:audit-durability for exact env gaps.",
          ...durability.blockers,
        ],
      };
    }
  }

  const sender = getCityLaunchSenderStatus();
  const allTargets = input.ledger.targets.filter((target) =>
    !input.targetIds || input.targetIds.includes(target.id),
  );
  const targets = eligibleTargets(input.ledger, input.targetIds).slice(0, input.maxSends ?? Number.POSITIVE_INFINITY);
  const receipts: string[] = [];
  const errors: string[] = [];
  const summary: GtmSendExecutionResult["summary"] = {
    eligible: targets.length,
    sent: 0,
    dryRun: 0,
    skippedApproval: allTargets.filter((target) =>
      target.outbound.status === "draft_ready" && target.outbound.approvalState !== "approved",
    ).length,
    skippedNoRecipient: 0,
    skippedNoMessage: 0,
    skippedAlreadySent: allTargets.filter((target) =>
      ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound.status),
    ).length,
    failed: 0,
  };

  for (const target of targets) {
    const recipientEmail = target.recipient?.email?.trim();
    if (!recipientEmail) {
      summary.skippedNoRecipient += 1;
      continue;
    }
    const body = emailBodyForTarget(target);
    if (!body) {
      summary.skippedNoMessage += 1;
      continue;
    }
    if (dryRun) {
      summary.dryRun += 1;
      continue;
    }

    const result = await sendEmail({
      to: recipientEmail,
      subject: emailSubjectForTarget(target),
      text: body,
      fromEmail: sender.fromEmail || undefined,
      fromName: sender.fromName,
      replyTo: sender.replyTo || undefined,
      sendGridCategories: ["gtm", "exact-site-hosted-review"],
      sendGridCustomArgs: {
        gtm_target_id: target.id,
        gtm_track: target.track,
      },
    });
    const receiptPath = await writeReceipt({
      target,
      dryRun: false,
      sent: result.sent,
      error: result.error instanceof Error ? result.error.message : result.error ? String(result.error) : undefined,
    });
    receipts.push(receiptPath);
    if (result.sent) {
      const now = new Date().toISOString();
      target.outbound.status = "sent";
      target.outbound.sentAt = now;
      target.outbound.sendLedgerPath = receiptPath;
      target.outbound.approvalState = "approved";
      markDailySend(input.ledger);
      summary.sent += 1;
    } else {
      summary.failed += 1;
      errors.push(`Send failed for ${target.id}: ${result.error instanceof Error ? result.error.message : String(result.error || "unknown")}`);
    }
  }

  return {
    ledger: input.ledger,
    summary,
    receipts,
    errors,
  };
}
