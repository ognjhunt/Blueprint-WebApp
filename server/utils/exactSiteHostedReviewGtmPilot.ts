import { promises as fs } from "node:fs";
import path from "node:path";

export const EXACT_SITE_GTM_LEDGER_SCHEMA = "blueprint/exact-site-hosted-review-gtm-ledger/v1";

export type ExactSiteGtmTargetStatus =
  | "not_ready"
  | "draft_ready"
  | "human_approved"
  | "sent"
  | "replied"
  | "hosted_review_started"
  | "closed";

export type ExactSiteGtmTrack =
  | "proof_ready_outreach"
  | "demand_sourced_capture";

export interface ExactSiteGtmPilotLedger {
  schema: string;
  pilot: {
    name: string;
    wedge: string;
    startDate: string;
    endDate: string;
    status: "planned" | "active" | "complete" | "paused";
    dailyTouchTargetMin: number;
    dailyTouchTargetMax: number;
    paidScaleAllowed: boolean;
    paidScaleDecision?: string;
    defaultTrack?: ExactSiteGtmTrack;
    decisionTouchGoal?: number;
    proofArtifactGoal?: number;
    targetAccountGoalMin?: number;
    targetAccountGoalMax?: number;
  };
  targets: ExactSiteGtmTarget[];
  dailyActivity: ExactSiteGtmDailyActivity[];
}

export interface ExactSiteGtmTarget {
  id: string;
  track: ExactSiteGtmTrack;
  organizationName: string;
  buyerSegment: string;
  city?: string;
  workflowNeed: string;
  intentSignals: string[];
  evidence: {
    summary: string;
    sourceUrls?: string[];
    repoArtifacts?: string[];
    notes?: string;
  };
  artifact: {
    type: "exact_site_hosted_review" | "city_site_opportunity_brief";
    status: "missing" | "draft" | "review_ready" | "delivered";
    path?: string;
    siteWorldId?: string;
    hostedReviewPath?: string;
  };
  captureAsk?: {
    requestedSiteType?: string;
    requestedCity?: string;
    buyerQuestion?: string;
    captureRequestPath?: string;
    status: "not_started" | "requested" | "capturer_routed" | "captured" | "packaged";
  };
  recipient?: {
    name?: string;
    role?: string;
    email?: string;
    evidenceSource?: string;
    evidenceType?: "explicit_research" | "historical_campaign" | "human_supplied";
  };
  outbound: {
    status: ExactSiteGtmTargetStatus;
    approvalState?: "not_required" | "pending_first_send_approval" | "approved" | "blocked";
    approvedBy?: string;
    approvedAt?: string;
    messagePath?: string;
    sendLedgerPath?: string;
    sendReceipt?: string;
    replyThreadPath?: string;
    sentAt?: string;
    replyAt?: string;
  };
  sales?: {
    nextAction?: string;
    nextActionOwner?: string;
    nextActionDue?: string;
    objection?: string;
    callStatus?: "not_started" | "requested" | "scheduled" | "completed" | "no_fit";
    decision?: "continue" | "change_icp" | "change_offer" | "change_artifact" | "change_cta" | "stop";
  };
  contentLoop?: Array<{
    channel: "linkedin" | "x" | "reddit" | "youtube" | "blog" | "newsletter" | "other";
    draftPath: string;
    proofArtifactPath: string;
    status: "draft" | "review_ready" | "published";
  }>;
  outcomes?: {
    hostedReviewStartedAt?: string;
    captureRequestCreatedAt?: string;
    qualifiedCallAt?: string;
    buyerOutcome?: string;
    notes?: string;
  };
}

export interface ExactSiteGtmDailyActivity {
  date: string;
  targetsAdded?: number;
  draftedTouches: number;
  approvedTouches: number;
  sentTouches: number;
  replies: number;
  hostedReviewStarts: number;
  qualifiedCalls: number;
  contentDrafts: number;
  paidSpendCents: number;
}

export interface ExactSiteGtmAuditFinding {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface ExactSiteGtmAuditResult {
  ok: boolean;
  findings: ExactSiteGtmAuditFinding[];
  summary: {
    targets: number;
    proofReadyTargets: number;
    demandSourcedTargets: number;
    readyTargets: number;
    proofArtifactsOrCaptureAsks: number;
    draftReadyTargets: number;
    humanApprovedTargets: number;
    recipientBackedTargets: number;
    targetsMissingRecipientEvidence: number;
    approvalNeededTargets: number;
    founderApprovalNeededTargets: number;
    sentTargets: number;
    explicitNextActionTargets: number;
    replies: number;
    hostedReviewStarts: number;
    qualifiedCalls: number;
    totalPaidSpendCents: number;
    decisionRule: {
      touchGoal: number;
      touches: number;
      gap: number;
      daysElapsed: number;
      daysRemaining: number;
      status: "collecting" | "organic_signal" | "decision_due";
    };
    latestDay: {
      date: string | null;
      targetsAdded: number;
      draftedTouches: number;
      approvedTouches: number;
      sentTouches: number;
      replies: number;
      hostedReviewStarts: number;
      qualifiedCalls: number;
      contactDensityGap: number;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasMeaningfulString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

function isLikelyPlaceholderEmail(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.endsWith("@example.com")
    || normalized.endsWith("@example.org")
    || normalized.endsWith("@test.com")
    || normalized.includes("placeholder")
    || normalized.includes("fake");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requiresRecipientEvidence(status: ExactSiteGtmTargetStatus): boolean {
  return ["human_approved", "sent", "replied", "hosted_review_started", "closed"].includes(status);
}

function isAllowedTargetStatus(value: unknown): value is ExactSiteGtmTargetStatus {
  return typeof value === "string"
    && ["not_ready", "draft_ready", "human_approved", "sent", "replied", "hosted_review_started", "closed"].includes(value);
}

function isAllowedTrack(value: unknown): value is ExactSiteGtmTrack {
  return typeof value === "string"
    && ["proof_ready_outreach", "demand_sourced_capture"].includes(value);
}

function isOutboundActive(status: ExactSiteGtmTargetStatus | undefined): boolean {
  return status !== undefined && status !== "not_ready";
}

function addFinding(
  findings: ExactSiteGtmAuditFinding[],
  severity: ExactSiteGtmAuditFinding["severity"],
  pathValue: string,
  message: string,
) {
  findings.push({ severity, path: pathValue, message });
}

export function auditExactSiteHostedReviewGtmLedger(
  ledger: ExactSiteGtmPilotLedger,
): ExactSiteGtmAuditResult {
  const findings: ExactSiteGtmAuditFinding[] = [];

  if (ledger.schema !== EXACT_SITE_GTM_LEDGER_SCHEMA) {
    addFinding(
      findings,
      "error",
      "schema",
      `Expected schema ${EXACT_SITE_GTM_LEDGER_SCHEMA}.`,
    );
  }

  if (!isRecord(ledger.pilot)) {
    addFinding(findings, "error", "pilot", "Pilot metadata is required.");
  } else {
    if (!hasMeaningfulString(ledger.pilot.name)) {
      addFinding(findings, "error", "pilot.name", "Pilot name is required.");
    }
    if (ledger.pilot.wedge !== "Exact-Site Hosted Review") {
      addFinding(
        findings,
        "error",
        "pilot.wedge",
        "The pilot wedge must remain Exact-Site Hosted Review.",
      );
    }
    if (!isIsoDate(asString(ledger.pilot.startDate)) || !isIsoDate(asString(ledger.pilot.endDate))) {
      addFinding(findings, "error", "pilot", "Pilot startDate and endDate must be YYYY-MM-DD.");
    }
    if (ledger.pilot.dailyTouchTargetMin < 1 || ledger.pilot.dailyTouchTargetMax > 50) {
      addFinding(
        findings,
        "error",
        "pilot.dailyTouchTargetMax",
        "Daily touch targets must stay in the controlled 1-50 range.",
      );
    }
    if (ledger.pilot.dailyTouchTargetMin > ledger.pilot.dailyTouchTargetMax) {
      addFinding(
        findings,
        "error",
        "pilot.dailyTouchTargetMin",
        "Daily touch target minimum cannot exceed the maximum.",
      );
    }
    if (
      ledger.pilot.decisionTouchGoal !== undefined
      && (!Number.isFinite(ledger.pilot.decisionTouchGoal) || ledger.pilot.decisionTouchGoal < 1)
    ) {
      addFinding(findings, "error", "pilot.decisionTouchGoal", "Decision touch goal must be a positive number.");
    }
    if (
      ledger.pilot.proofArtifactGoal !== undefined
      && (!Number.isFinite(ledger.pilot.proofArtifactGoal) || ledger.pilot.proofArtifactGoal < 1)
    ) {
      addFinding(findings, "error", "pilot.proofArtifactGoal", "Proof artifact goal must be a positive number.");
    }
    if (
      ledger.pilot.targetAccountGoalMin !== undefined
      && (!Number.isFinite(ledger.pilot.targetAccountGoalMin) || ledger.pilot.targetAccountGoalMin < 1)
    ) {
      addFinding(findings, "error", "pilot.targetAccountGoalMin", "Target account goal minimum must be a positive number.");
    }
    if (
      ledger.pilot.targetAccountGoalMax !== undefined
      && (!Number.isFinite(ledger.pilot.targetAccountGoalMax) || ledger.pilot.targetAccountGoalMax < 1)
    ) {
      addFinding(findings, "error", "pilot.targetAccountGoalMax", "Target account goal maximum must be a positive number.");
    }
    if (
      ledger.pilot.targetAccountGoalMin !== undefined
      && ledger.pilot.targetAccountGoalMax !== undefined
      && ledger.pilot.targetAccountGoalMin > ledger.pilot.targetAccountGoalMax
    ) {
      addFinding(findings, "error", "pilot.targetAccountGoalMin", "Target account goal minimum cannot exceed maximum.");
    }
  }

  const targets = Array.isArray(ledger.targets) ? ledger.targets : [];
  const activity = Array.isArray(ledger.dailyActivity) ? ledger.dailyActivity : [];

  if (targets.length === 0) {
    addFinding(
      findings,
      "error",
      "targets",
      "The pilot cannot be marked ready with zero target rows; add real robot-team targets or pause the pilot.",
    );
  }

  targets.forEach((target, index) => {
    const basePath = `targets[${index}]`;
    if (!hasMeaningfulString(target.id)) {
      addFinding(findings, "error", `${basePath}.id`, "Target id is required.");
    }
    if (!isAllowedTrack(target.track)) {
      addFinding(
        findings,
        "error",
        `${basePath}.track`,
        "Target track must be proof_ready_outreach or demand_sourced_capture.",
      );
    }
    if (!hasMeaningfulString(target.organizationName)) {
      addFinding(findings, "error", `${basePath}.organizationName`, "Organization name is required.");
    }
    if (!hasMeaningfulString(target.buyerSegment)) {
      addFinding(findings, "error", `${basePath}.buyerSegment`, "Buyer segment is required.");
    }
    if (!hasMeaningfulString(target.workflowNeed)) {
      addFinding(findings, "error", `${basePath}.workflowNeed`, "Workflow need is required.");
    }
    if (!Array.isArray(target.intentSignals) || target.intentSignals.length === 0) {
      addFinding(findings, "error", `${basePath}.intentSignals`, "At least one real buying signal is required.");
    }
    if (!hasMeaningfulString(target.evidence?.summary)) {
      addFinding(findings, "error", `${basePath}.evidence.summary`, "Evidence summary is required.");
    }
    if (target.artifact?.type !== "exact_site_hosted_review" && target.artifact?.type !== "city_site_opportunity_brief") {
      addFinding(findings, "error", `${basePath}.artifact.type`, "Artifact must be a hosted review or city/site brief.");
    }
    if (!["missing", "draft", "review_ready", "delivered"].includes(asString(target.artifact?.status))) {
      addFinding(findings, "error", `${basePath}.artifact.status`, "Artifact status is invalid.");
    }
    if (target.artifact?.status !== "missing" && !hasMeaningfulString(target.artifact?.path)) {
      addFinding(findings, "error", `${basePath}.artifact.path`, "Non-missing artifacts must include a path.");
    }
    if (!isAllowedTargetStatus(target.outbound?.status)) {
      addFinding(findings, "error", `${basePath}.outbound.status`, "Outbound status is invalid.");
    }
    if (
      hasMeaningfulString(target.outbound?.approvalState)
      && !["not_required", "pending_first_send_approval", "approved", "blocked"].includes(target.outbound.approvalState)
    ) {
      addFinding(findings, "error", `${basePath}.outbound.approvalState`, "Outbound approval state is invalid.");
    }

    if (target.track === "proof_ready_outreach") {
      if (target.artifact?.type !== "exact_site_hosted_review") {
        addFinding(
          findings,
          "error",
          `${basePath}.artifact.type`,
          "Proof-ready outreach must use an exact-site hosted-review artifact.",
        );
      }
      if (target.artifact?.status !== "review_ready" && target.artifact?.status !== "delivered") {
        addFinding(
          findings,
          "error",
          `${basePath}.artifact.status`,
          "Proof-ready outreach requires a review_ready or delivered hosted-review artifact.",
        );
      }
      if (!hasMeaningfulString(target.artifact?.siteWorldId) && !hasMeaningfulString(target.artifact?.hostedReviewPath)) {
        addFinding(
          findings,
          "error",
          `${basePath}.artifact`,
          "Proof-ready outreach must identify the site-world id or hosted-review path being pitched.",
        );
      }
    }

    if (target.track === "demand_sourced_capture") {
      if (target.artifact?.status === "review_ready" || target.artifact?.status === "delivered") {
        addFinding(
          findings,
          "warning",
          `${basePath}.track`,
          "This target has a reviewable artifact; consider moving it to proof_ready_outreach.",
        );
      }
      if (!isRecord(target.captureAsk)) {
        addFinding(
          findings,
          "error",
          `${basePath}.captureAsk`,
          "Demand-sourced capture targets require a captureAsk object.",
        );
      } else {
        if (!["not_started", "requested", "capturer_routed", "captured", "packaged"].includes(asString(target.captureAsk.status))) {
          addFinding(findings, "error", `${basePath}.captureAsk.status`, "Capture ask status is invalid.");
        }
        if (!hasMeaningfulString(target.captureAsk.requestedSiteType) && !hasMeaningfulString(target.captureAsk.requestedCity)) {
          addFinding(
            findings,
            "error",
            `${basePath}.captureAsk`,
            "Demand-sourced capture targets must name a requested site type or city.",
          );
        }
      }
      if (target.artifact?.type !== "city_site_opportunity_brief" && target.artifact?.status === "missing") {
        addFinding(
          findings,
          "error",
          `${basePath}.artifact.type`,
          "Demand-sourced capture with no reviewable artifact must use the city/site opportunity brief type.",
        );
      }
    }

    if (
      isOutboundActive(target.outbound?.status)
      && target.artifact?.status === "missing"
      && target.track !== "demand_sourced_capture"
    ) {
      addFinding(findings, "error", `${basePath}.artifact.status`, "Outbound cannot start before the lead magnet artifact exists.");
    }

    const recipient = target.recipient;
    const email = asString(recipient?.email);
    if (email) {
      if (!isValidEmail(email)) {
        addFinding(findings, "error", `${basePath}.recipient.email`, "Recipient email is not valid.");
      }
      if (isLikelyPlaceholderEmail(email)) {
        addFinding(findings, "error", `${basePath}.recipient.email`, "Placeholder or fake recipient emails are disallowed.");
      }
      if (!hasMeaningfulString(recipient?.evidenceSource) || !hasMeaningfulString(recipient?.evidenceType)) {
        addFinding(
          findings,
          "error",
          `${basePath}.recipient`,
          "Recipient email requires explicit evidence source and evidence type.",
        );
      }
      if (
        hasMeaningfulString(recipient?.evidenceType)
        && !["explicit_research", "historical_campaign", "human_supplied"].includes(recipient.evidenceType)
      ) {
        addFinding(findings, "error", `${basePath}.recipient.evidenceType`, "Recipient evidence type is invalid.");
      }
    }
    if (requiresRecipientEvidence(target.outbound?.status) && !email) {
      addFinding(
        findings,
        "error",
        `${basePath}.recipient.email`,
        "Human-approved or live outbound requires recipient-backed email evidence.",
      );
    }
    if (
      target.outbound?.status === "draft_ready"
      && email
      && target.outbound.approvalState !== "pending_first_send_approval"
      && target.outbound.approvalState !== "approved"
    ) {
      addFinding(
        findings,
        "warning",
        `${basePath}.outbound.approvalState`,
        "Recipient-backed draft should be queued for founder first-send approval or explicitly approved.",
      );
    }
    if (
      ["human_approved", "sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status)
      && target.outbound.approvalState !== "approved"
    ) {
      addFinding(
        findings,
        "error",
        `${basePath}.outbound.approvalState`,
        "Human-approved or sent outbound must record approvalState=approved.",
      );
    }
    if (["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status) && !hasMeaningfulString(target.outbound?.sendLedgerPath)) {
      addFinding(
        findings,
        "error",
        `${basePath}.outbound.sendLedgerPath`,
        "Sent or later outbound must point to a send ledger receipt path.",
      );
    }
    if (
      ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status)
      && !hasMeaningfulString(target.sales?.nextAction)
      && !hasMeaningfulString(target.outcomes?.buyerOutcome)
    ) {
      addFinding(
        findings,
        "warning",
        `${basePath}.sales.nextAction`,
        "Sent or later targets should record a next action, objection, buyer outcome, or closeout decision.",
      );
    }

    for (const [contentIndex, content] of (target.contentLoop ?? []).entries()) {
      if (!hasMeaningfulString(content.draftPath)) {
        addFinding(findings, "error", `${basePath}.contentLoop[${contentIndex}].draftPath`, "Content draft path is required.");
      }
      if (!hasMeaningfulString(content.proofArtifactPath)) {
        addFinding(
          findings,
          "error",
          `${basePath}.contentLoop[${contentIndex}].proofArtifactPath`,
          "Content loop entries must cite the proof artifact they came from.",
        );
      }
      if (content.status === "published") {
        addFinding(
          findings,
          "warning",
          `${basePath}.contentLoop[${contentIndex}].status`,
          "Published content must have a stored external receipt outside this pilot ledger.",
        );
      }
    }
  });

  const paidSpendCents = activity.reduce((sum, day) => sum + asNumber(day.paidSpendCents), 0);
  const organicSignals = activity.reduce(
    (sum, day) => sum + asNumber(day.replies) + asNumber(day.hostedReviewStarts) + asNumber(day.qualifiedCalls),
    0,
  );

  activity.forEach((day, index) => {
    const basePath = `dailyActivity[${index}]`;
    if (!isIsoDate(asString(day.date))) {
      addFinding(findings, "error", `${basePath}.date`, "Daily activity date must be YYYY-MM-DD.");
    }
    for (const key of [
      "draftedTouches",
      "approvedTouches",
      "sentTouches",
      "replies",
      "hostedReviewStarts",
      "qualifiedCalls",
      "contentDrafts",
      "paidSpendCents",
      "targetsAdded",
    ] as const) {
      if (asNumber(day[key]) < 0) {
        addFinding(findings, "error", `${basePath}.${key}`, "Daily activity counts cannot be negative.");
      }
    }
    if (asNumber(day.sentTouches) > ledger.pilot.dailyTouchTargetMax) {
      addFinding(
        findings,
        "error",
        `${basePath}.sentTouches`,
        "Daily sent touches exceed the pilot cap.",
      );
    }
    if (asNumber(day.sentTouches) > 0 && asNumber(day.sentTouches) < ledger.pilot.dailyTouchTargetMin) {
      addFinding(
        findings,
        "warning",
        `${basePath}.sentTouches`,
        "Daily sent touches are below the pilot target; record whether this was intentional.",
      );
    }
    if (asNumber(day.paidSpendCents) > 0 && !ledger.pilot.paidScaleAllowed) {
      addFinding(
        findings,
        "error",
        `${basePath}.paidSpendCents`,
        "Paid spend is blocked until the pilot explicitly allows scale.",
      );
    }
  });

  if (paidSpendCents > 0 && organicSignals === 0) {
    addFinding(
      findings,
      "error",
      "dailyActivity.paidSpendCents",
      "Paid scale requires organic replies, hosted reviews, or qualified calls first.",
    );
  }

  const readyTargets = targets.filter((target) =>
    target.artifact?.status === "review_ready" || target.artifact?.status === "delivered",
  ).length;
  const proofReadyTargets = targets.filter((target) => target.track === "proof_ready_outreach").length;
  const demandSourcedTargets = targets.filter((target) => target.track === "demand_sourced_capture").length;
  const proofArtifactsOrCaptureAsks = targets.filter((target) =>
    target.artifact?.status === "review_ready"
    || target.artifact?.status === "delivered"
    || Boolean(target.captureAsk),
  ).length;
  const draftReadyTargets = targets.filter((target) => target.outbound?.status === "draft_ready").length;
  const humanApprovedTargets = targets.filter((target) => target.outbound?.status === "human_approved").length;
  const recipientBackedTargets = targets.filter((target) => hasMeaningfulString(target.recipient?.email)).length;
  const targetsMissingRecipientEvidence = targets.filter((target) => !hasMeaningfulString(target.recipient?.email)).length;
  const approvalNeededTargets = targets.filter((target) =>
    target.outbound?.status === "draft_ready" && hasMeaningfulString(target.recipient?.email),
  ).length;
  const founderApprovalNeededTargets = targets.filter((target) =>
    target.outbound?.status === "draft_ready"
    && hasMeaningfulString(target.recipient?.email)
    && target.outbound.approvalState !== "approved",
  ).length;
  const sentTargets = targets.filter((target) =>
    ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status),
  ).length;
  const explicitNextActionTargets = targets.filter((target) => hasMeaningfulString(target.sales?.nextAction)).length;
  const latestDay = [...activity]
    .filter((day) => isIsoDate(asString(day.date)))
    .sort((left, right) => asString(right.date).localeCompare(asString(left.date)))[0];
  const totalReplies = activity.reduce((sum, day) => sum + asNumber(day.replies), 0);
  const totalHostedReviewStarts = activity.reduce((sum, day) => sum + asNumber(day.hostedReviewStarts), 0);
  const totalQualifiedCalls = activity.reduce((sum, day) => sum + asNumber(day.qualifiedCalls), 0);
  const decisionTouchGoal = asNumber(ledger.pilot.decisionTouchGoal) || 100;
  const today = new Date().toISOString().slice(0, 10);
  const daysElapsed = daysBetween(asString(ledger.pilot.startDate), today);
  const daysRemaining = daysBetween(today, asString(ledger.pilot.endDate));
  const decisionOrganicSignal = totalReplies + totalHostedReviewStarts + totalQualifiedCalls;
  const decisionRuleStatus: ExactSiteGtmAuditResult["summary"]["decisionRule"]["status"] =
    sentTargets >= decisionTouchGoal || daysRemaining === 0
      ? "decision_due"
      : decisionOrganicSignal > 0
        ? "organic_signal"
        : "collecting";

  const summary = {
    targets: targets.length,
    proofReadyTargets,
    demandSourcedTargets,
    readyTargets,
    proofArtifactsOrCaptureAsks,
    draftReadyTargets,
    humanApprovedTargets,
    recipientBackedTargets,
    targetsMissingRecipientEvidence,
    approvalNeededTargets,
    founderApprovalNeededTargets,
    sentTargets,
    explicitNextActionTargets,
    replies: totalReplies,
    hostedReviewStarts: totalHostedReviewStarts,
    qualifiedCalls: totalQualifiedCalls,
    totalPaidSpendCents: paidSpendCents,
    decisionRule: {
      touchGoal: decisionTouchGoal,
      touches: sentTargets,
      gap: Math.max(0, decisionTouchGoal - sentTargets),
      daysElapsed,
      daysRemaining,
      status: decisionRuleStatus,
    },
    latestDay: {
      date: asString(latestDay?.date) || null,
      targetsAdded: asNumber(latestDay?.targetsAdded),
      draftedTouches: asNumber(latestDay?.draftedTouches),
      approvedTouches: asNumber(latestDay?.approvedTouches),
      sentTouches: asNumber(latestDay?.sentTouches),
      replies: asNumber(latestDay?.replies),
      hostedReviewStarts: asNumber(latestDay?.hostedReviewStarts),
      qualifiedCalls: asNumber(latestDay?.qualifiedCalls),
      contactDensityGap: Math.max(
        0,
        asNumber(ledger.pilot.dailyTouchTargetMin) - asNumber(latestDay?.sentTouches),
      ),
    },
  };

  if (ledger.pilot.status === "active" && targets.length > 0 && recipientBackedTargets === 0) {
    addFinding(
      findings,
      "warning",
      "targets.recipient",
      "Active pilot has target rows but no recipient-backed contacts; live sends remain blocked on explicit contact evidence.",
    );
  }
  if (ledger.pilot.status === "active" && targets.length > 0 && sentTargets === 0) {
    addFinding(
      findings,
      "warning",
      "targets.outbound",
      "Active pilot has no sent targets yet; daily progress is still target research until a send ledger exists.",
    );
  }
  if (ledger.pilot.status === "active" && targets.length > 0 && targets.length < (ledger.pilot.targetAccountGoalMin || 30)) {
    addFinding(
      findings,
      "warning",
      "targets",
      `Active pilot has ${targets.length} target rows; expand toward ${ledger.pilot.targetAccountGoalMin || 30}-${ledger.pilot.targetAccountGoalMax || 50} target accounts before judging the wedge.`,
    );
  }
  if (ledger.pilot.status === "active" && readyTargets < (ledger.pilot.proofArtifactGoal || 3)) {
    addFinding(
      findings,
      "warning",
      "targets.artifact",
      `Active pilot has ${readyTargets} proof-ready artifacts; create ${ledger.pilot.proofArtifactGoal || 3} buyer-specific hosted-review artifacts or capture asks before scaling.`,
    );
  }
  if (ledger.pilot.status === "active" && explicitNextActionTargets < targets.length) {
    addFinding(
      findings,
      "warning",
      "targets.sales.nextAction",
      "Some target rows do not record an explicit next action; the buyer-loop report will infer one, but the canonical sales ledger should be made explicit as evidence changes.",
    );
  }

  return {
    ok: findings.every((finding) => finding.severity !== "error"),
    findings,
    summary,
  };
}

export async function loadExactSiteHostedReviewGtmLedger(
  ledgerPath: string,
): Promise<ExactSiteGtmPilotLedger> {
  const raw = await fs.readFile(ledgerPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Ledger at ${ledgerPath} must be a JSON object.`);
  }
  return parsed as unknown as ExactSiteGtmPilotLedger;
}

export function renderExactSiteHostedReviewGtmAuditMarkdown(
  result: ExactSiteGtmAuditResult,
  ledgerPath: string,
): string {
  const relativePath = path.relative(process.cwd(), ledgerPath) || ledgerPath;
  const status = !result.ok
    ? "blocked"
    : result.findings.length > 0
      ? "ready_with_warnings"
      : "ready";
  const lines = [
    "# Exact-Site Hosted Review GTM Pilot Audit",
    "",
    `- ledger: ${relativePath}`,
    `- status: ${status}`,
    `- targets: ${result.summary.targets}`,
    `- proof-ready outreach targets: ${result.summary.proofReadyTargets}`,
    `- demand-sourced capture targets: ${result.summary.demandSourcedTargets}`,
    `- ready targets: ${result.summary.readyTargets}`,
    `- proof artifacts or capture asks: ${result.summary.proofArtifactsOrCaptureAsks}`,
    `- draft-ready targets: ${result.summary.draftReadyTargets}`,
    `- human-approved targets: ${result.summary.humanApprovedTargets}`,
    `- recipient-backed targets: ${result.summary.recipientBackedTargets}`,
    `- targets missing recipient evidence: ${result.summary.targetsMissingRecipientEvidence}`,
    `- approval-needed targets: ${result.summary.approvalNeededTargets}`,
    `- founder approval needed targets: ${result.summary.founderApprovalNeededTargets}`,
    `- sent targets: ${result.summary.sentTargets}`,
    `- explicit next-action targets: ${result.summary.explicitNextActionTargets}`,
    `- replies: ${result.summary.replies}`,
    `- hosted review starts: ${result.summary.hostedReviewStarts}`,
    `- qualified calls: ${result.summary.qualifiedCalls}`,
    `- paid spend cents: ${result.summary.totalPaidSpendCents}`,
    `- decision touch goal: ${result.summary.decisionRule.touchGoal}`,
    `- decision touch gap: ${result.summary.decisionRule.gap}`,
    `- decision status: ${result.summary.decisionRule.status}`,
    `- latest day: ${result.summary.latestDay.date ?? "none"}`,
    `- latest day targets added: ${result.summary.latestDay.targetsAdded}`,
    `- latest day contact-density gap: ${result.summary.latestDay.contactDensityGap}`,
    "",
    "## Findings",
    "",
  ];

  if (result.findings.length === 0) {
    lines.push("- none");
  } else {
    for (const finding of result.findings) {
      lines.push(`- ${finding.severity.toUpperCase()} ${finding.path}: ${finding.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderExactSiteHostedReviewGtmFounderReviewMarkdown(
  ledger: ExactSiteGtmPilotLedger,
  result: ExactSiteGtmAuditResult,
  ledgerPath: string,
  reportDate = new Date().toISOString().slice(0, 10),
): string {
  const relativePath = path.relative(process.cwd(), ledgerPath) || ledgerPath;
  const needsRecipientEvidence = ledger.targets.filter((target) => !hasMeaningfulString(target.recipient?.email));
  const needsApproval = ledger.targets.filter((target) =>
    target.outbound?.status === "draft_ready" && hasMeaningfulString(target.recipient?.email),
  );
  const sentOrLater = ledger.targets.filter((target) =>
    ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status),
  );
  const latest = result.summary.latestDay;
  const auditStatus = !result.ok
    ? "blocked"
    : result.findings.length > 0
      ? "ready_with_warnings"
      : "ready";
  const lines = [
    "# Exact-Site Hosted Review Daily Founder Review",
    "",
    `- report_date: ${reportDate}`,
    `- ledger: ${relativePath}`,
    `- pilot_status: ${ledger.pilot.status}`,
    `- wedge: ${ledger.pilot.wedge}`,
    `- north_star: qualified hosted-review starts or qualified buyer calls from proof-led outreach`,
    `- audit_status: ${auditStatus}`,
    "",
    "## Daily Dashboard",
    "",
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| Targets in ledger | ${result.summary.targets} |`,
    `| Targets added latest day | ${latest.targetsAdded} |`,
    `| Draft-ready targets | ${result.summary.draftReadyTargets} |`,
    `| Recipient-backed targets | ${result.summary.recipientBackedTargets} |`,
    `| Founder approval needed | ${result.summary.founderApprovalNeededTargets} |`,
    `| Human-approved targets | ${result.summary.humanApprovedTargets} |`,
    `| Sent targets | ${result.summary.sentTargets} |`,
    `| Replies | ${result.summary.replies} |`,
    `| Hosted-review starts | ${result.summary.hostedReviewStarts} |`,
    `| Qualified calls | ${result.summary.qualifiedCalls} |`,
    `| Proof artifacts or capture asks | ${result.summary.proofArtifactsOrCaptureAsks} |`,
    `| Explicit next-action targets | ${result.summary.explicitNextActionTargets} |`,
    `| 100-touch decision gap | ${result.summary.decisionRule.gap} |`,
    `| Latest day sent touches | ${latest.sentTouches} |`,
    `| Latest day contact-density gap | ${latest.contactDensityGap} |`,
    "",
    "## Founder Action",
    "",
  ];

  if (needsApproval.length > 0) {
    lines.push(
      `Approve, edit, or reject ${needsApproval.length} recipient-backed draft target(s). Do not authorize pricing, rights, permission, legal, or public-readiness commitments from this packet.`,
    );
  } else if (needsRecipientEvidence.length > 0) {
    lines.push(
      `Supply or approve recipient-backed contacts for ${needsRecipientEvidence.length} target(s), or direct agents to keep researching explicit contact evidence. No live send is ready yet.`,
    );
  } else if (sentOrLater.length > 0) {
    lines.push("Review replies, calls, hosted-review starts, and blockers from sent targets.");
  } else {
    lines.push("Add target rows before using founder time on send approval.");
  }

  lines.push("", "## Targets Needing Recipient Evidence", "");
  if (needsRecipientEvidence.length === 0) {
    lines.push("- none");
  } else {
    for (const target of needsRecipientEvidence.slice(0, 20)) {
      lines.push(
        `- ${target.id}: ${target.organizationName} / ${target.buyerSegment} / ${target.workflowNeed}`,
      );
    }
  }

  lines.push("", "## Targets Needing Approval", "");
  if (needsApproval.length === 0) {
    lines.push("- none");
  } else {
    for (const target of needsApproval.slice(0, 20)) {
      lines.push(
        `- ${target.id}: ${target.organizationName} -> ${target.recipient?.email} (${target.recipient?.evidenceType})`,
      );
    }
  }

  lines.push("", "## Audit Findings", "");
  if (result.findings.length === 0) {
    lines.push("- none");
  } else {
    for (const finding of result.findings) {
      lines.push(`- ${finding.severity.toUpperCase()} ${finding.path}: ${finding.message}`);
    }
  }

  lines.push(
    "",
    "## Operating Rule",
    "",
    "For this 14-day window, the autonomous org is judged by targets added, recipient-backed touches approved/sent, replies, qualified calls, hosted-review starts, and explicit blockers. Internal summaries that do not move one of those numbers do not count as pilot progress.",
  );

  return `${lines.join("\n")}\n`;
}
