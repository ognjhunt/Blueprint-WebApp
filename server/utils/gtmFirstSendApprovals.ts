import {
  hasExactSiteRecipientBackedEvidence,
  type ExactSiteGtmBlocker,
  type ExactSiteGtmPilotLedger,
} from "./exactSiteHostedReviewGtmPilot";

export type ExactSiteFirstSendApprovalDecision = "approve" | "edit" | "reject";

export type ExactSiteFirstSendApprovalRow = {
  targetId?: unknown;
  decision?: unknown;
  approvedBy?: unknown;
  approvalNote?: unknown;
};

export type ExactSiteFirstSendApprovalPacket = {
  schema?: unknown;
  approvals?: unknown;
};

export type ApplyExactSiteFirstSendApprovalsResult = {
  ledger: ExactSiteGtmPilotLedger;
  summary: {
    rows: number;
    approved: number;
    editRequested: number;
    rejected: number;
    skipped: number;
    errors: number;
  };
  errors: string[];
  warnings: string[];
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeDecision(value: unknown): ExactSiteFirstSendApprovalDecision | null {
  if (value === "approve" || value === "edit" || value === "reject") return value;
  return null;
}

function approvalRows(packet: ExactSiteFirstSendApprovalPacket): ExactSiteFirstSendApprovalRow[] {
  return Array.isArray(packet.approvals)
    ? packet.approvals.filter((entry): entry is ExactSiteFirstSendApprovalRow =>
        Boolean(entry) && typeof entry === "object",
      )
    : [];
}

function blockerForRejectedApproval(targetId: string, now: string, note: string): ExactSiteGtmBlocker {
  return {
    id: `gtm-blocker-founder-rejected-${targetId}`,
    status: "blocked",
    summary: "Founder rejected this Exact-Site Hosted Review first-send draft.",
    owner: "growth-lead",
    nextAction: note || "Revise the target, proof artifact, recipient, or message before requesting approval again.",
    createdAt: now,
    updatedAt: now,
  };
}

function upsertBlocker(blockers: ExactSiteGtmBlocker[] | undefined, blocker: ExactSiteGtmBlocker) {
  const existing = blockers ?? [];
  const index = existing.findIndex((entry) => entry.id === blocker.id);
  if (index >= 0) {
    existing[index] = {
      ...existing[index],
      ...blocker,
      createdAt: existing[index].createdAt || blocker.createdAt,
    };
    return existing;
  }
  return [...existing, blocker];
}

export function applyExactSiteFirstSendApprovals(input: {
  ledger: ExactSiteGtmPilotLedger;
  packet: ExactSiteFirstSendApprovalPacket;
  now?: string;
}): ApplyExactSiteFirstSendApprovalsResult {
  const now = input.now || new Date().toISOString();
  const rows = approvalRows(input.packet);
  const summary: ApplyExactSiteFirstSendApprovalsResult["summary"] = {
    rows: rows.length,
    approved: 0,
    editRequested: 0,
    rejected: 0,
    skipped: 0,
    errors: 0,
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  const targetsById = new Map(input.ledger.targets.map((target) => [target.id, target]));

  for (const row of rows) {
    if (!hasText(row.targetId)) {
      summary.skipped += 1;
      warnings.push("Skipped approval row without targetId.");
      continue;
    }
    const decision = normalizeDecision(row.decision);
    if (!decision) {
      summary.skipped += 1;
      continue;
    }
    const target = targetsById.get(row.targetId);
    if (!target) {
      summary.errors += 1;
      errors.push(`${row.targetId}: target not found in GTM ledger.`);
      continue;
    }
    if (!hasExactSiteRecipientBackedEvidence(target)) {
      summary.errors += 1;
      errors.push(`${target.id}: cannot apply first-send decision without explicit recipient-backed evidence.`);
      continue;
    }
    if (target.outbound.status !== "draft_ready" && target.outbound.status !== "human_approved") {
      summary.errors += 1;
      errors.push(`${target.id}: cannot apply first-send decision from outbound status ${target.outbound.status}.`);
      continue;
    }

    const note = hasText(row.approvalNote) ? row.approvalNote.trim() : "";
    if (decision === "approve") {
      if (!hasText(row.approvedBy)) {
        summary.errors += 1;
        errors.push(`${target.id}: approve decision requires approvedBy.`);
        continue;
      }
      target.outbound.status = "human_approved";
      target.outbound.approvalState = "approved";
      target.outbound.approvedBy = row.approvedBy.trim();
      target.outbound.approvedAt = now;
      target.sales = {
        ...(target.sales ?? {}),
        nextAction: "Run GTM send dry-run and live send only after reply durability passes.",
        nextActionOwner: "growth-lead",
      };
      summary.approved += 1;
      continue;
    }

    if (decision === "edit") {
      target.outbound.status = "draft_ready";
      target.outbound.approvalState = "pending_first_send_approval";
      target.sales = {
        ...(target.sales ?? {}),
        nextAction: note || "Founder requested edits before first-send approval.",
        nextActionOwner: "growth-lead",
      };
      summary.editRequested += 1;
      continue;
    }

    const rejectionNextAction = note || "Founder rejected this first-send draft; revise before requesting approval again.";
    target.outbound.status = "draft_ready";
    target.outbound.approvalState = "blocked";
    target.sales = {
      ...(target.sales ?? {}),
      nextAction: rejectionNextAction,
      nextActionOwner: "growth-lead",
    };
    target.blockers = upsertBlocker(
      target.blockers,
      blockerForRejectedApproval(target.id, now, rejectionNextAction),
    );
    summary.rejected += 1;
  }

  return {
    ledger: input.ledger,
    summary,
    errors,
    warnings,
  };
}
