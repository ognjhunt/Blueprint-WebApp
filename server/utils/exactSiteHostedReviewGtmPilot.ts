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
    messagePath?: string;
    sendLedgerPath?: string;
    sentAt?: string;
    replyAt?: string;
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
    sentTargets: number;
    replies: number;
    hostedReviewStarts: number;
    qualifiedCalls: number;
    totalPaidSpendCents: number;
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
  }

  const targets = Array.isArray(ledger.targets) ? ledger.targets : [];
  const activity = Array.isArray(ledger.dailyActivity) ? ledger.dailyActivity : [];

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
    if (["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status) && !hasMeaningfulString(target.outbound?.sendLedgerPath)) {
      addFinding(
        findings,
        "error",
        `${basePath}.outbound.sendLedgerPath`,
        "Sent or later outbound must point to a send ledger receipt path.",
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
  const sentTargets = targets.filter((target) =>
    ["sent", "replied", "hosted_review_started", "closed"].includes(target.outbound?.status),
  ).length;

  const summary = {
    targets: targets.length,
    proofReadyTargets,
    demandSourcedTargets,
    readyTargets,
    sentTargets,
    replies: activity.reduce((sum, day) => sum + asNumber(day.replies), 0),
    hostedReviewStarts: activity.reduce((sum, day) => sum + asNumber(day.hostedReviewStarts), 0),
    qualifiedCalls: activity.reduce((sum, day) => sum + asNumber(day.qualifiedCalls), 0),
    totalPaidSpendCents: paidSpendCents,
  };

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
  const lines = [
    "# Exact-Site Hosted Review GTM Pilot Audit",
    "",
    `- ledger: ${relativePath}`,
    `- status: ${result.ok ? "ready" : "blocked"}`,
    `- targets: ${result.summary.targets}`,
    `- proof-ready outreach targets: ${result.summary.proofReadyTargets}`,
    `- demand-sourced capture targets: ${result.summary.demandSourcedTargets}`,
    `- ready targets: ${result.summary.readyTargets}`,
    `- sent targets: ${result.summary.sentTargets}`,
    `- replies: ${result.summary.replies}`,
    `- hosted review starts: ${result.summary.hostedReviewStarts}`,
    `- qualified calls: ${result.summary.qualifiedCalls}`,
    `- paid spend cents: ${result.summary.totalPaidSpendCents}`,
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
