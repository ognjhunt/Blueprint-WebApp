import { Request, Response, Router } from "express";
import crypto from "crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { sendEmail } from "../utils/email";
import { notifySlackInboundRequest } from "../utils/slack";
import { logger } from "../logger";
import { isValidEmailAddress } from "../utils/validation";
import { getRateLimitRedisClient } from "../utils/rate-limit-redis";
import { encryptInboundRequestForStorage } from "../utils/field-encryption";
import { createRequestReviewToken } from "../utils/request-review-auth";
import { createSlaTracker } from "../utils/sla-enforcement";
import { runInboundQualificationForRequest } from "../agents";
import { logGrowthEvent } from "../utils/growth-events";
import { runHighIntentLeadEnrichmentForRequest } from "../utils/highIntentLeadEnrichment";
import {
  HELP_WITH_OPTIONS,
  LEGACY_HELP_WITH_TO_LANE,
  LANE_TO_LEGACY_HELP_WITH,
  REQUESTED_LANES,
} from "../../client/src/lib/requestTaxonomy";
import { getDemandAttributionFromContext } from "../../client/src/lib/demandAttribution";
import { evaluateStructuredIntake } from "../../client/src/lib/structuredIntake";
import type {
  InboundRequestPayload,
  InboundRequest,
  RequestPriority,
  RequestStatus,
  BudgetBucket,
  HelpWithOption,
  ProofPathPreference,
  RequestedLane,
  BuyerType,
  RequestQueueKey,
  GrowthWedgeKey,
  SubmitInboundRequestResponse,
  StructuredIntakeSummary,
  PlaceLocationMetadata,
} from "../types/inbound-request";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_IP = 10; // Max 10 submissions per IP per window
const RATE_LIMIT_MAX_EMAIL = 3; // Max 3 submissions per email per window
const RATE_LIMIT_PREFIX = "rl:inbound:";
const LOCAL_RATE_LIMIT_MAX_ENTRIES = 10_000;

const localRateLimitStore = new Map<string, { count: number; resetAt: number }>();

const rateLimitRedisClient = getRateLimitRedisClient();

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

// Valid budget buckets
const VALID_BUDGET_BUCKETS: BudgetBucket[] = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
];

// Valid helpWith options
const VALID_HELP_WITH: HelpWithOption[] = [...HELP_WITH_OPTIONS];

const VALID_REQUESTED_LANES: RequestedLane[] = [...REQUESTED_LANES];
const VALID_PROOF_PATH_PREFERENCES: ProofPathPreference[] = [
  "exact_site_required",
  "adjacent_site_acceptable",
  "need_guidance",
];

// Known disposable email domains (extend as needed)
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
];

const DEV_INBOUND_REQUEST_LOG = path.join(
  os.tmpdir(),
  "blueprint-dev-inbound-requests.jsonl"
);

/**
 * Hash IP address for privacy in logs/rate-limit keys
 */
function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Check rate limit for a given key
 */
async function checkRateLimit(
  key: string,
  maxCount: number
): Promise<{ allowed: boolean; remaining: number }> {
  const pruneLocalRateLimitStore = (now: number) => {
    for (const [storeKey, record] of localRateLimitStore.entries()) {
      if (record.resetAt <= now) {
        localRateLimitStore.delete(storeKey);
      }
    }

    if (localRateLimitStore.size <= LOCAL_RATE_LIMIT_MAX_ENTRIES) {
      return;
    }

    const entriesToDelete = localRateLimitStore.size - LOCAL_RATE_LIMIT_MAX_ENTRIES;
    let deleted = 0;

    for (const storeKey of localRateLimitStore.keys()) {
      localRateLimitStore.delete(storeKey);
      deleted += 1;

      if (deleted >= entriesToDelete) {
        break;
      }
    }
  };

  const checkLocalRateLimit = () => {
    const now = Date.now();
    pruneLocalRateLimitStore(now);
    const record = localRateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      localRateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return { allowed: true, remaining: maxCount - 1 };
    }

    record.count += 1;
    const remaining = Math.max(maxCount - record.count, 0);
    return { allowed: record.count <= maxCount, remaining };
  };

  if (!rateLimitRedisClient) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("Redis rate limit client unavailable; using local inbound rate limit fallback");
    }
    return checkLocalRateLimit();
  }

  try {
    const count = await rateLimitRedisClient.eval(RATE_LIMIT_SCRIPT, {
      keys: [key],
      arguments: [RATE_LIMIT_WINDOW_MS.toString()],
    });
    const current = typeof count === "number" ? count : Number(count);
    const remaining = Math.max(maxCount - current, 0);
    return { allowed: current <= maxCount, remaining };
  } catch (error) {
    logger.warn({ error }, "Redis rate limit check failed; using local inbound rate limit fallback");
    return checkLocalRateLimit();
  }
}

/**
 * Compute priority based on budget and product interests
 */
function computePriority(
  budgetBucket: BudgetBucket,
  requestedLanes: RequestedLane[]
): RequestPriority {
  // High priority for large budgets
  if (budgetBucket === ">$1M" || budgetBucket === "$300K-$1M") {
    return "high";
  }

  // High priority for high-touch deployment discovery work
  if (
    requestedLanes.includes("managed_tuning") ||
    requestedLanes.includes("deeper_evaluation") ||
    requestedLanes.includes("data_licensing")
  ) {
    return "high";
  }

  if (requestedLanes.includes("preview_simulation")) {
    return "normal";
  }

  // Normal priority for medium budgets
  if (budgetBucket === "$50K-$300K") {
    return "normal";
  }

  if (requestedLanes.includes("qualification")) {
    return "normal";
  }

  // Low priority for small/undecided budgets
  return "low";
}

/**
 * Compute initial owner based on product interests
 */
function computeOwner(
  requestedLanes: RequestedLane[]
): { uid: string | null; email: string | null } {
  if (
    requestedLanes.includes("deeper_evaluation") ||
    requestedLanes.includes("managed_tuning") ||
    requestedLanes.includes("data_licensing")
  ) {
    return {
      uid: null,
      email: process.env.SOLUTIONS_OWNER_EMAIL || "ops@tryblueprint.io",
    };
  }

  return {
    uid: null,
    email: process.env.INTAKE_OWNER_EMAIL || "ops@tryblueprint.io",
  };
}

function normalizeRequestedLanes(
  requestedLanes?: RequestedLane[],
  helpWith?: HelpWithOption[]
): RequestedLane[] {
  const normalized = new Set<RequestedLane>();

  requestedLanes?.forEach((lane) => {
    if (VALID_REQUESTED_LANES.includes(lane)) {
      normalized.add(lane);
    }
  });

  helpWith?.forEach((entry) => {
    const mappedLane = LEGACY_HELP_WITH_TO_LANE[entry];
    if (mappedLane) {
      normalized.add(mappedLane as RequestedLane);
    }
  });

  if (normalized.size === 0) {
    normalized.add("qualification");
  }

  return [...normalized];
}

function normalizeLegacyHelpWith(
  requestedLanes: RequestedLane[],
  helpWith?: HelpWithOption[]
): HelpWithOption[] {
  const normalized = new Set<HelpWithOption>();

  helpWith?.forEach((entry) => {
    if (VALID_HELP_WITH.includes(entry)) {
      normalized.add(entry);
    }
  });

  requestedLanes.forEach((lane) => {
    normalized.add(LANE_TO_LEGACY_HELP_WITH[lane] as HelpWithOption);
  });

  return [...normalized];
}

function normalizeBuyerType(value?: BuyerType): BuyerType {
  return value === "robot_team" ? "robot_team" : "site_operator";
}

function normalizeProofPathPreference(
  value?: ProofPathPreference
): ProofPathPreference | null {
  if (!value) {
    return null;
  }

  return VALID_PROOF_PATH_PREFERENCES.includes(value) ? value : null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizePlaceLocationMetadata(
  value?: PlaceLocationMetadata | null
): PlaceLocationMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const normalized: PlaceLocationMetadata = {
    source: normalizeOptionalString(value.source) || "manual",
    placeId: normalizeOptionalString(value.placeId),
    formattedAddress: normalizeOptionalString(value.formattedAddress),
    lat: normalizeOptionalNumber(value.lat),
    lng: normalizeOptionalNumber(value.lng),
    city: normalizeOptionalString(value.city),
    state: normalizeOptionalString(value.state),
    country: normalizeOptionalString(value.country),
    postalCode: normalizeOptionalString(value.postalCode),
  };

  return [
    normalized.placeId,
    normalized.formattedAddress,
    normalized.city,
    normalized.state,
    normalized.country,
    normalized.postalCode,
    normalized.lat,
    normalized.lng,
  ].some((entry) => entry !== null && entry !== undefined && entry !== "")
    ? normalized
    : null;
}

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function determineInboundRouting(params: {
  buyerType: BuyerType;
  requestedLanes: RequestedLane[];
  proofPathPreference: ProofPathPreference | null;
  sourcePageUrl?: string | null;
  utmCampaign?: string | null;
  utmSource?: string | null;
}) {
  const sourcePageUrl = String(params.sourcePageUrl || "");
  const normalizedCampaign = normalizeToken(params.utmCampaign);
  const normalizedSource = normalizeToken(params.utmSource);
  const exactSiteSignals = [
    params.buyerType === "robot_team",
    params.requestedLanes.includes("deeper_evaluation"),
    params.proofPathPreference === "exact_site_required"
      || sourcePageUrl.includes("/product")
      || sourcePageUrl.includes("/exact-site-hosted-review")
      || normalizedCampaign.includes("hosted_review")
      || normalizedSource === "exact_site_review",
  ];

  const isExactSiteHostedReview = exactSiteSignals.every(Boolean);
  const queueKey: RequestQueueKey = isExactSiteHostedReview
    ? "exact_site_hosted_review_queue"
    : "inbound_request_review";
  const growthWedge: GrowthWedgeKey | null = isExactSiteHostedReview
    ? "exact_site_hosted_review"
    : null;
  const queueTags = [
    params.buyerType,
    ...params.requestedLanes,
    params.proofPathPreference || null,
    isExactSiteHostedReview ? "exact_site_hosted_review" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    queueKey,
    growthWedge,
    queueTags,
    queueLabel: isExactSiteHostedReview
      ? "Exact-Site Hosted Review"
      : "Inbound Request Review",
    nextAction: isExactSiteHostedReview
      ? "review exact-site hosted-review scope, proof path, and buyer handoff readiness"
      : "generate qualification recommendation",
  };
}

function toStructuredIntakeSummary(
  decision: ReturnType<typeof evaluateStructuredIntake>
): StructuredIntakeSummary {
  return {
    mode: decision.intakeMode,
    primary_cta: decision.primaryCta,
    secondary_cta: decision.secondaryCta,
    calendar_disposition: decision.calendarDisposition,
    calendar_reasons: decision.calendarReasons,
    missing_structured_fields: decision.missingStructuredFields,
    owner_lane: decision.ownerLane,
    recommended_path: decision.recommendedPath,
    next_action: decision.nextAction,
    proof_ready_outcome: decision.proofReadyOutcome,
    proof_path_outcome: decision.proofPathOutcome,
    proof_readiness_score: decision.proofReadinessScore,
    proof_ready_criteria: decision.proofReadyCriteria,
    missing_proof_ready_fields: decision.missingProofReadyFields,
    site_operator_claim_outcome: decision.siteOperatorClaimOutcome,
    access_boundary_outcome: decision.accessBoundaryOutcome,
    site_claim_readiness_score: decision.siteClaimReadinessScore,
    site_claim_criteria: decision.siteClaimCriteria,
    missing_site_claim_fields: decision.missingSiteClaimFields,
  };
}

function proofPathClassification(
  outcome: ReturnType<typeof evaluateStructuredIntake>["proofPathOutcome"]
) {
  if (outcome === "exact_site" || outcome === "adjacent_site") {
    return outcome;
  }

  return "needs_guidance";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function writeDevInboundRequest(payload: Record<string, unknown>) {
  fs.appendFileSync(DEV_INBOUND_REQUEST_LOG, `${JSON.stringify(payload)}\n`, "utf8");
}

function buyerReviewUrl(requestId: string, token: string) {
  const baseUrl = (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");
  return `${baseUrl}/requests/${encodeURIComponent(requestId)}?access=${encodeURIComponent(token)}`;
}

/**
 * Validate email format and check for disposable domains
 */
function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!isValidEmailAddress(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, error: "Please use a work email address" };
  }

  return { valid: true };
}

/**
 * Generate confirmation email HTML
 */
function generateConfirmationEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blueprint submission received</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Blueprint</h1>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#111827;">Thanks, ${firstName}. Your site submission is in.</h2>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Blueprint has your intake details. We will review the site, task, and constraints and follow up with the right next step.
                </p>

                <!-- What happens next -->
                <div style="background-color:#f3f4f6;border-radius:8px;padding:24px;margin-bottom:24px;">
                  <h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">What happens next?</h3>
                  <ol style="margin:0;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.8;">
                    <li>We review the submission for scope, evidence needs, and qualification risk.</li>
                    <li>If key evidence is missing, we ask for a more targeted capture pass.</li>
                    <li>If the site is ready enough, we move it toward qualified handoff or deeper review.</li>
                  </ol>
                </div>

                <!-- CTA -->
                <div style="text-align:center;margin-bottom:32px;">
                  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Want to get started faster?</p>
                  <a href="https://calendly.com/blueprintar/30min" style="display:inline-block;padding:14px 28px;background-color:#4f46e5;color:#ffffff;font-weight:600;text-decoration:none;border-radius:8px;font-size:14px;">Book a Call Now</a>
                </div>

                <!-- Resources -->
                <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
                  <h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">Useful links while we review:</h3>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/product" style="color:#4f46e5;text-decoration:none;font-size:14px;">Product</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Site-specific world models, packages, hosted review, and proof boundaries</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/world-models" style="color:#4f46e5;text-decoration:none;font-size:14px;">World models</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Site-specific packages and hosted access</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/proof" style="color:#4f46e5;text-decoration:none;font-size:14px;">Proof</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Truth-labeled sample proof and story packets</span>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="text-align:center;">
                      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                        <a href="https://www.linkedin.com/company/blueprintsim/" style="color:#6b7280;text-decoration:none;margin:0 8px;">LinkedIn</a>
                        <a href="https://twitter.com/try_blueprint" style="color:#6b7280;text-decoration:none;margin:0 8px;">X</a>
                        <a href="https://www.youtube.com/c/BlueprintAI" style="color:#6b7280;text-decoration:none;margin:0 8px;">YouTube</a>
                      </p>
                      <p style="margin:0;font-size:12px;color:#9ca3af;">
                        Blueprint | 1005 Crete St, Durham, NC 27707
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * POST /api/inbound-request
 * Submit a new site submission for capture and world-model packaging
 */
router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const ipHash = hashIp(clientIp);

  try {
    const payload = req.body as InboundRequestPayload;

    // 1. Check honeypot (anti-bot)
    if (payload.honeypot) {
      logger.warn("Honeypot triggered - likely bot submission");
      // Return success to not reveal detection
      return res.status(HTTP_STATUS.ACCEPTED).json({
        ok: true,
        requestId: payload.requestId || "fake-id",
        status: "submitted",
      } satisfies SubmitInboundRequestResponse);
    }

    // 2. Validate required fields
    const requestedLanes = normalizeRequestedLanes(
      payload.requestedLanes,
      payload.helpWith
    );
    const legacyHelpWith = normalizeLegacyHelpWith(
      requestedLanes,
      payload.helpWith
    );
    const buyerType = normalizeBuyerType(payload.buyerType);
    const siteName = payload.siteName?.trim() || "";
    const siteLocation = payload.siteLocation?.trim() || "";
    const siteLocationMetadata = normalizePlaceLocationMetadata(
      payload.siteLocationMetadata
    );
    const taskStatement = payload.taskStatement?.trim() || "";
    const targetSiteType = payload.targetSiteType?.trim() || "";
    const proofPathPreference = normalizeProofPathPreference(
      payload.proofPathPreference
    );
    const missingFields: string[] = [];
    if (!payload.requestId) missingFields.push("requestId");
    if (!payload.firstName?.trim()) missingFields.push("firstName");
    if (!payload.lastName?.trim()) missingFields.push("lastName");
    if (!payload.company?.trim()) missingFields.push("company");
    if (!payload.email?.trim()) missingFields.push("email");
    if (!payload.budgetBucket) missingFields.push("budgetBucket");
    if (!taskStatement) missingFields.push("taskStatement");
    if (buyerType === "site_operator") {
      if (!siteName) missingFields.push("siteName");
      if (!siteLocation) missingFields.push("siteLocation");
    }
    if (buyerType === "robot_team") {
      if (!payload.roleTitle?.trim()) missingFields.push("roleTitle");
      if (!targetSiteType && !siteName) missingFields.push("targetSiteTypeOrSiteName");
      if (!proofPathPreference) missingFields.push("proofPathPreference");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId || "",
        status: "submitted",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      } satisfies SubmitInboundRequestResponse);
    }

    // 3. Validate email
    const emailLower = payload.email.toLowerCase().trim();
    const emailValidation = validateEmail(emailLower);
    if (!emailValidation.valid) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: emailValidation.error,
      } satisfies SubmitInboundRequestResponse);
    }

    // 4. Validate enums
    if (!VALID_BUDGET_BUCKETS.includes(payload.budgetBucket)) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: "Invalid budget bucket",
      } satisfies SubmitInboundRequestResponse);
    }

    const invalidRequestedLanes =
      payload.requestedLanes?.filter((lane) => !VALID_REQUESTED_LANES.includes(lane)) ?? [];
    if (invalidRequestedLanes.length > 0) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: `Invalid requestedLanes values: ${invalidRequestedLanes.join(", ")}`,
      } satisfies SubmitInboundRequestResponse);
    }

    const invalidHelpWith = (payload.helpWith ?? []).filter((h) => !VALID_HELP_WITH.includes(h));
    if (invalidHelpWith.length > 0) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: `Invalid helpWith values: ${invalidHelpWith.join(", ")}`,
      } satisfies SubmitInboundRequestResponse);
    }

    if (payload.proofPathPreference && !proofPathPreference) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: `Invalid proofPathPreference value: ${payload.proofPathPreference}`,
      } satisfies SubmitInboundRequestResponse);
    }

    // 5. Check rate limits
    const ipRateLimit = await checkRateLimit(
      `${RATE_LIMIT_PREFIX}ip:${ipHash}`,
      RATE_LIMIT_MAX_IP
    );
    if (!ipRateLimit.allowed) {
      logger.warn({ ipHash }, "IP rate limit exceeded");
      return res.status(429).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: "Too many requests. Please try again later.",
      } satisfies SubmitInboundRequestResponse);
    }

    const emailDomain = emailLower.split("@")[1];
    const emailRateLimit = await checkRateLimit(
      `${RATE_LIMIT_PREFIX}email:${emailDomain}`,
      RATE_LIMIT_MAX_EMAIL
    );
    if (!emailRateLimit.allowed) {
      logger.warn({ emailDomain }, "Email domain rate limit exceeded");
      return res.status(429).json({
        ok: false,
        requestId: payload.requestId,
        status: "submitted",
        message: "Too many requests from this email domain. Please try again later.",
      } satisfies SubmitInboundRequestResponse);
    }

    // 6. Compute priority and owner
    const priority = computePriority(payload.budgetBucket, requestedLanes);
    const owner = computeOwner(requestedLanes);
    const demandAttribution = getDemandAttributionFromContext(payload.context);
    const routing = determineInboundRouting({
      buyerType,
      requestedLanes,
      proofPathPreference,
      sourcePageUrl: payload.context?.sourcePageUrl || null,
      utmCampaign: payload.context?.utm?.campaign || null,
      utmSource: payload.context?.utm?.source || null,
    });
    const structuredIntakeDecision = evaluateStructuredIntake({
      buyerType,
      requestedLanes,
      budgetBucket: payload.budgetBucket,
      siteName,
      siteLocation,
      taskStatement,
      targetSiteType: payload.targetSiteType?.trim() || null,
      proofPathPreference,
      targetRobotTeam: payload.targetRobotTeam?.trim() || null,
      roleTitle: payload.roleTitle?.trim() || null,
      workflowContext: payload.workflowContext?.trim() || null,
      operatingConstraints: payload.operatingConstraints?.trim() || null,
      privacySecurityConstraints: payload.privacySecurityConstraints?.trim() || null,
      knownBlockers: payload.knownBlockers?.trim() || null,
      captureRights: payload.captureRights?.trim() || null,
      derivedScenePermission: payload.derivedScenePermission?.trim() || null,
      datasetLicensingPermission: payload.datasetLicensingPermission?.trim() || null,
      payoutEligibility: payload.payoutEligibility?.trim() || null,
      details: payload.details?.trim() || null,
    });
    const structuredIntake = toStructuredIntakeSummary(structuredIntakeDecision);
    const queueTags = [...new Set([...routing.queueTags, ...structuredIntakeDecision.filterTags])];
    const emitRobotTeamFitChecked = async () => {
      if (buyerType !== "robot_team") {
        return;
      }

      await logGrowthEvent({
        event: "robot_team_fit_checked",
        source: "server:inbound_request",
        properties: {
          request_id: payload.requestId,
          city: demandAttribution.demandCity || null,
          requested_lane: requestedLanes[0] || null,
          requested_lane_count: requestedLanes.length,
          buyer_segment: payload.roleTitle?.trim() || null,
          exact_site_classification: proofPathClassification(
            structuredIntakeDecision.proofPathOutcome
          ),
          adjacent_site_allowed: proofPathPreference === "adjacent_site_acceptable",
          proof_path_preference: proofPathPreference || "unknown",
          proof_ready_outcome: structuredIntakeDecision.proofReadyOutcome,
          proof_path_outcome: structuredIntakeDecision.proofPathOutcome,
          proof_readiness_score: structuredIntakeDecision.proofReadinessScore,
          missing_proof_ready_fields: structuredIntakeDecision.missingProofReadyFields,
        },
        attribution: {
          demandCity: demandAttribution.demandCity,
          buyerChannelSource: demandAttribution.buyerChannelSource,
          buyerChannelSourceCaptureMode:
            demandAttribution.buyerChannelSourceCaptureMode,
          utm: payload.context?.utm || {},
        },
        user: {
          email: emailLower,
        },
      });
    };
    const emitSiteOperatorClaimChecked = async () => {
      if (buyerType !== "site_operator") {
        return;
      }

      await logGrowthEvent({
        event: "site_operator_claim_checked",
        source: "server:inbound_request",
        properties: {
          request_id: payload.requestId,
          city: demandAttribution.demandCity || null,
          requested_lane: requestedLanes[0] || null,
          requested_lane_count: requestedLanes.length,
          site_operator_claim_outcome: structuredIntakeDecision.siteOperatorClaimOutcome,
          access_boundary_outcome: structuredIntakeDecision.accessBoundaryOutcome,
          site_claim_readiness_score: structuredIntakeDecision.siteClaimReadinessScore,
          missing_site_claim_fields: structuredIntakeDecision.missingSiteClaimFields,
          has_access_rules: Boolean(payload.operatingConstraints?.trim()),
          has_privacy_security_boundary: Boolean(payload.privacySecurityConstraints?.trim()),
          has_commercialization_boundary: Boolean(payload.derivedScenePermission?.trim()),
        },
        attribution: {
          demandCity: demandAttribution.demandCity,
          buyerChannelSource: demandAttribution.buyerChannelSource,
          buyerChannelSourceCaptureMode:
            demandAttribution.buyerChannelSourceCaptureMode,
          utm: payload.context?.utm || {},
        },
        user: {
          email: emailLower,
        },
      });
    };

    if (!db) {
      if (isProduction()) {
        logger.error("Firebase Admin SDK not initialized");
        return res.status(500).json({
          ok: false,
          requestId: payload.requestId,
          status: "submitted",
          message: "Internal server error",
        } satisfies SubmitInboundRequestResponse);
      }

      writeDevInboundRequest({
        requestId: payload.requestId,
        createdAt: new Date().toISOString(),
        queue_key: routing.queueKey,
        growth_wedge: routing.growthWedge,
        queue_tags: queueTags,
        status: "submitted",
        priority,
        owner,
        contact: {
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          email: emailLower,
          roleTitle: payload.roleTitle?.trim() || "",
          company: payload.company.trim(),
        },
        request: {
          budgetBucket: payload.budgetBucket,
          requestedLanes,
          helpWith: legacyHelpWith,
          buyerType,
          siteName,
          siteLocation,
          siteLocationMetadata,
          taskStatement,
          targetSiteType: payload.targetSiteType?.trim() || null,
          proofPathPreference,
          existingStackReviewWorkflow:
            payload.existingStackReviewWorkflow?.trim() || null,
          humanGateTopics: payload.humanGateTopics?.trim() || null,
          workflowContext: payload.workflowContext?.trim() || null,
          operatingConstraints: payload.operatingConstraints?.trim() || null,
          privacySecurityConstraints:
            payload.privacySecurityConstraints?.trim() || null,
          knownBlockers: payload.knownBlockers?.trim() || null,
          targetRobotTeam: payload.targetRobotTeam?.trim() || null,
          captureRights: payload.captureRights?.trim() || null,
          derivedScenePermission: payload.derivedScenePermission?.trim() || null,
          datasetLicensingPermission: payload.datasetLicensingPermission?.trim() || null,
          payoutEligibility: payload.payoutEligibility?.trim() || null,
          details: payload.details?.trim() || null,
        },
        context: {
          sourcePageUrl: payload.context?.sourcePageUrl || "",
          referrer: payload.context?.referrer || null,
          demandCity: demandAttribution.demandCity,
          buyerChannelSource: demandAttribution.buyerChannelSource,
          buyerChannelSourceCaptureMode:
            demandAttribution.buyerChannelSourceCaptureMode,
          buyerChannelSourceRaw: demandAttribution.buyerChannelSourceRaw,
          utm: payload.context?.utm || {},
          userAgent: payload.context?.userAgent || req.get("user-agent") || null,
          timezoneOffset: payload.context?.timezoneOffset ?? null,
          locale: payload.context?.locale || null,
          ipHash,
        },
        ops: {
          assigned_region_id: "managed-alpha",
          rights_status: "unknown",
          capture_policy_tier: "review_required",
          capture_status: "not_requested",
          recapture_reason: null,
          quote_status: "not_started",
          next_step: "Review the site scope and decide whether to request capture.",
          last_buyer_ready_at: null,
          proof_path: {
            exact_site_requested_at:
              buyerType === "robot_team" && proofPathPreference === "exact_site_required"
                ? new Date().toISOString()
                : null,
            qualified_inbound_at: null,
            proof_pack_delivered_at: null,
            proof_pack_reviewed_at: null,
            hosted_review_ready_at: null,
            hosted_review_started_at: null,
            hosted_review_follow_up_at: null,
            artifact_handoff_delivered_at: null,
            artifact_handoff_accepted_at: null,
            human_commercial_handoff_at: null,
          },
        },
        ops_automation: {
          status: "pending",
          queue: routing.queueKey,
          queue_label: routing.queueLabel,
          wedge_key: routing.growthWedge,
          filter_tags: queueTags,
          intent: "inbound_qualification",
          next_action: structuredIntakeDecision.nextAction,
          recommended_path: structuredIntakeDecision.recommendedPath,
          requires_human_review: structuredIntakeDecision.requiresHumanReview,
        },
        structured_intake: structuredIntake,
        human_review_required: structuredIntakeDecision.requiresHumanReview,
        debug: {
          mode: "dev_fallback",
          logPath: DEV_INBOUND_REQUEST_LOG,
        },
      });

      await emitRobotTeamFitChecked().catch(() => null);
      await emitSiteOperatorClaimChecked().catch(() => null);

      logger.warn(
        { requestId: payload.requestId, logPath: DEV_INBOUND_REQUEST_LOG },
        "Firebase Admin SDK not initialized; saved inbound request to dev fallback log"
      );

      return res.status(HTTP_STATUS.CREATED).json({
        ok: true,
        requestId: payload.requestId,
        siteSubmissionId: payload.requestId,
        status: "submitted",
        message: "Development mode: request saved locally and notifications were skipped.",
      } satisfies SubmitInboundRequestResponse);
    }

    const existingDoc = await db
      .collection("inboundRequests")
      .doc(payload.requestId)
      .get();

    if (existingDoc.exists) {
      logger.info(
        { requestId: payload.requestId },
        "Duplicate request - returning existing"
      );
      const existingData = existingDoc.data() as InboundRequest;
      return res.status(HTTP_STATUS.OK).json({
        ok: true,
        requestId: payload.requestId,
        siteSubmissionId: payload.requestId,
        status: existingData.status,
      } satisfies SubmitInboundRequestResponse);
    }

    // 7. Build the document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const reviewToken = createRequestReviewToken(payload.requestId);
    const reviewUrl = buyerReviewUrl(payload.requestId, reviewToken);
    const inboundRequest: Omit<InboundRequest, "createdAt"> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      requestId: payload.requestId,
      site_submission_id: payload.requestId,
      queue_key: routing.queueKey,
      growth_wedge: routing.growthWedge,
      queue_tags: queueTags,
      createdAt: now,
      status: "submitted" as RequestStatus,
      qualification_state: "submitted",
      opportunity_state: "not_applicable",
      priority,
      owner,
      contact: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: emailLower,
        roleTitle: payload.roleTitle?.trim() || "",
        company: payload.company.trim(),
      },
      request: {
        budgetBucket: payload.budgetBucket,
        requestedLanes,
        helpWith: legacyHelpWith,
        details: payload.details?.trim() || null,
        buyerType,
        siteName,
        siteLocation,
        siteLocationMetadata,
        taskStatement,
        targetSiteType: payload.targetSiteType?.trim() || null,
        proofPathPreference,
        existingStackReviewWorkflow:
          payload.existingStackReviewWorkflow?.trim() || null,
        humanGateTopics: payload.humanGateTopics?.trim() || null,
        workflowContext: payload.workflowContext?.trim() || null,
        operatingConstraints: payload.operatingConstraints?.trim() || null,
        privacySecurityConstraints:
          payload.privacySecurityConstraints?.trim() || null,
        knownBlockers: payload.knownBlockers?.trim() || null,
        targetRobotTeam: payload.targetRobotTeam?.trim() || null,
        captureRights: payload.captureRights?.trim() || null,
        derivedScenePermission: payload.derivedScenePermission?.trim() || null,
        datasetLicensingPermission: payload.datasetLicensingPermission?.trim() || null,
        payoutEligibility: payload.payoutEligibility?.trim() || null,
      },
      context: {
        sourcePageUrl: payload.context?.sourcePageUrl || "",
        referrer: payload.context?.referrer || null,
        demandCity: demandAttribution.demandCity,
        buyerChannelSource: demandAttribution.buyerChannelSource,
        buyerChannelSourceCaptureMode:
          demandAttribution.buyerChannelSourceCaptureMode,
        buyerChannelSourceRaw: demandAttribution.buyerChannelSourceRaw,
        utm: {
          source: payload.context?.utm?.source || null,
          medium: payload.context?.utm?.medium || null,
          campaign: payload.context?.utm?.campaign || null,
          term: payload.context?.utm?.term || null,
          content: payload.context?.utm?.content || null,
        },
        userAgent: payload.context?.userAgent || req.get("user-agent") || null,
        timezoneOffset: payload.context?.timezoneOffset ?? null,
        locale: payload.context?.locale || null,
      },
      enrichment: {
        companyDomain: emailDomain,
        companySize: null,
        geo: null,
        notes: null,
      },
      events: {
        confirmationEmailSentAt: null,
        slackNotifiedAt: null,
        crmSyncedAt: null,
      },
      ops_automation: {
        status: "pending",
        queue: routing.queueKey,
        queue_label: routing.queueLabel,
        intent: "inbound_qualification",
        wedge_key: routing.growthWedge,
        filter_tags: queueTags,
        next_action: structuredIntakeDecision.nextAction,
        recommended_path: structuredIntakeDecision.recommendedPath,
        confidence: null,
        requires_human_review: structuredIntakeDecision.requiresHumanReview,
        provider: null,
        runtime: null,
        model: null,
        tool_mode: null,
        execution_id: null,
        session_key: `inbound:${payload.requestId}`,
        last_error: null,
        last_attempt_at: null,
        processed_at: null,
      },
      structured_intake: structuredIntake,
      human_review_required: structuredIntakeDecision.requiresHumanReview,
      automation_confidence: null,
      buyer_review_access: {
        buyer_review_url: reviewUrl,
        token_issued_at: now as never,
        last_sent_at: null,
      },
      ops: {
        assigned_region_id: "managed-alpha",
        rights_status: "unknown",
        capture_policy_tier: "review_required",
        capture_status: "not_requested",
        recapture_reason: null,
        quote_status: "not_started",
        next_step: structuredIntakeDecision.nextAction,
        last_buyer_ready_at: null,
        proof_path: {
          exact_site_requested_at:
            buyerType === "robot_team" && proofPathPreference === "exact_site_required"
              ? (now as never)
              : null,
          qualified_inbound_at: null,
          proof_pack_delivered_at: null,
          proof_pack_reviewed_at: null,
          hosted_review_ready_at: null,
          hosted_review_started_at: null,
          hosted_review_follow_up_at: null,
          artifact_handoff_delivered_at: null,
          artifact_handoff_accepted_at: null,
          human_commercial_handoff_at: null,
        },
      },
      debug: {
        schemaVersion: 3,
      },
    };

    const encryptedInboundRequest = await encryptInboundRequestForStorage(
      inboundRequest
    );

    // 8. Write to Firestore
    await db
      .collection("inboundRequests")
      .doc(payload.requestId)
      .set(encryptedInboundRequest);

    await db
      .collection("stats")
      .doc("inboundRequests")
      .set(
        {
          total: admin.firestore.FieldValue.increment(1),
          [`byStatus.submitted`]: admin.firestore.FieldValue.increment(1),
          [`byPriority.${priority}`]: admin.firestore.FieldValue.increment(1),
          [`byQueue.${routing.queueKey}`]: admin.firestore.FieldValue.increment(1),
          ...(routing.growthWedge
            ? {
                [`byWedge.${routing.growthWedge}`]:
                  admin.firestore.FieldValue.increment(1),
              }
            : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    if (buyerType === "robot_team") {
      await emitRobotTeamFitChecked().catch(() => null);

      await logGrowthEvent({
        event: "robot_team_inbound_captured",
        source: "server:inbound_request",
        properties: {
          request_id: payload.requestId,
          city: demandAttribution.demandCity || null,
          buyer_role: payload.roleTitle?.trim() || null,
          requested_lane: requestedLanes[0] || null,
          requested_lane_count: requestedLanes.length,
          proof_path_preference: proofPathPreference,
        },
        attribution: {
          demandCity: demandAttribution.demandCity,
          buyerChannelSource: demandAttribution.buyerChannelSource,
          buyerChannelSourceCaptureMode:
            demandAttribution.buyerChannelSourceCaptureMode,
          utm: payload.context?.utm || {},
        },
        user: {
          email: emailLower,
        },
      }).catch(() => null);

      if (proofPathPreference === "exact_site_required") {
        await logGrowthEvent({
          event: "exact_site_request_created",
          source: "server:inbound_request",
          properties: {
            request_id: payload.requestId,
            city: demandAttribution.demandCity || null,
            site_request_type: "exact_site_required",
            buyer_segment: payload.roleTitle?.trim() || null,
          },
          attribution: {
            demandCity: demandAttribution.demandCity,
            buyerChannelSource: demandAttribution.buyerChannelSource,
            buyerChannelSourceCaptureMode:
              demandAttribution.buyerChannelSourceCaptureMode,
            utm: payload.context?.utm || {},
          },
          user: {
            email: emailLower,
          },
        }).catch(() => null);
      }

      if (requestedLanes.includes("deeper_evaluation")) {
        await logGrowthEvent({
          event: "deeper_review_requested",
          source: "server:inbound_request",
          properties: {
            request_id: payload.requestId,
            city: demandAttribution.demandCity || null,
            blocker_type:
              payload.humanGateTopics?.trim()
              || payload.privacySecurityConstraints?.trim()
              || "deeper_evaluation_requested",
            buyer_segment: payload.roleTitle?.trim() || null,
          },
          attribution: {
            demandCity: demandAttribution.demandCity,
            buyerChannelSource: demandAttribution.buyerChannelSource,
            buyerChannelSourceCaptureMode:
              demandAttribution.buyerChannelSourceCaptureMode,
            utm: payload.context?.utm || {},
          },
          user: {
            email: emailLower,
          },
        }).catch(() => null);
      }
    }
    if (buyerType === "site_operator") {
      await emitSiteOperatorClaimChecked().catch(() => null);
    }

    logger.info(
      {
        requestId: payload.requestId,
        company: payload.company,
        priority,
        durationMs: Date.now() - startTime,
      },
      "Inbound request created"
    );

    // 9. Trigger async automations (don't block response)
    const automationPromises: Promise<void>[] = [];

    if (
      routing.queueKey === "exact_site_hosted_review_queue" ||
      (payload.context?.sourcePageUrl || "").includes("/product") ||
      (payload.context?.sourcePageUrl || "").includes("/exact-site-hosted-review")
    ) {
      automationPromises.push(
        createSlaTracker({
          requestId: payload.requestId,
          buyerEmail: emailLower,
        }).catch((error) => {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to create SLA tracker"
          );
        })
      );
    }

    // Slack notification
    automationPromises.push(
      (async () => {
        try {
          const slackResult = await notifySlackInboundRequest({
            requestId: payload.requestId,
            siteSubmissionId: payload.requestId,
            firstName: payload.firstName.trim(),
            lastName: payload.lastName.trim(),
            email: emailLower,
            company: payload.company.trim(),
            roleTitle: payload.roleTitle?.trim() || "",
            buyerType,
            siteName: payload.siteName?.trim() || "",
            siteLocation: payload.siteLocation?.trim() || "",
            taskStatement: payload.taskStatement?.trim() || "",
            targetSiteType: payload.targetSiteType?.trim() || null,
            proofPathPreference,
            existingStackReviewWorkflow:
              payload.existingStackReviewWorkflow?.trim() || null,
            humanGateTopics: payload.humanGateTopics?.trim() || null,
            budgetBucket: payload.budgetBucket,
            requestedLanes,
            helpWith: legacyHelpWith,
            details: payload.details || null,
            priority,
            sourcePageUrl: payload.context?.sourcePageUrl || "",
          });

          if (slackResult.sent) {
            await db
              .collection("inboundRequests")
              .doc(payload.requestId)
              .update({
                "events.slackNotifiedAt":
                  admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send Slack notification"
          );
        }
      })()
    );

    // Confirmation email
    automationPromises.push(
      (async () => {
        try {
          const confirmationHtml = generateConfirmationEmailHtml(
            payload.firstName.trim()
          );
          const confirmationText = `Hi ${payload.firstName.trim()},

Thank you for your request. We've received your submission and our team will get back to you within 24 hours.

What happens next?
1. We review the site, task, and constraints in your intake
2. We build the right qualification plan and flag any missing evidence
3. We use the qualification record to show feasibility, readiness, and whether the site should move toward team evaluation

Want to get started faster? Book a call now: https://calendly.com/blueprintar/30min

In the meantime, explore our resources:
- Product: https://tryblueprint.io/product
- World models: https://tryblueprint.io/world-models
- Proof: https://tryblueprint.io/proof

Best,
The Blueprint Team

Blueprint | 1005 Crete St, Durham, NC 27707`;

          const emailResult = await sendEmail({
            to: emailLower,
            subject: "Blueprint - We received your request",
            text: confirmationText,
            html: confirmationHtml,
            replyTo: "ops@tryblueprint.io",
          });

          if (emailResult.sent) {
            await db
              .collection("inboundRequests")
              .doc(payload.requestId)
              .update({
                "events.confirmationEmailSentAt":
                  admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send confirmation email"
          );
        }
      })()
    );

    // Internal notification email to ops
    automationPromises.push(
      (async () => {
        try {
          const to = process.env.CONTACT_TO ?? "ops@tryblueprint.io";
          const subject = `[${priority.toUpperCase()}] New site submission from ${payload.company.trim()}`;
          const text = `New site submission received:

Name: ${payload.firstName.trim()} ${payload.lastName.trim()}
Email: ${emailLower}
Company: ${payload.company.trim()}
Role: ${payload.roleTitle?.trim() || "Not specified"}
Buyer type: ${buyerType}
Site: ${payload.siteName?.trim()}
Location: ${payload.siteLocation?.trim()}
Task: ${payload.taskStatement?.trim()}
Budget: ${payload.budgetBucket}
Requested lanes: ${requestedLanes.join(", ")}
Priority: ${priority}
Queue: ${routing.queueLabel}
Growth wedge: ${routing.growthWedge || "none"}

${payload.workflowContext ? `Workflow context:\n${payload.workflowContext}\n` : ""}
${payload.targetSiteType ? `Target site type:\n${payload.targetSiteType}\n` : ""}
${proofPathPreference ? `Proof path preference:\n${proofPathPreference}\n` : ""}
${payload.existingStackReviewWorkflow ? `Existing stack/review workflow:\n${payload.existingStackReviewWorkflow}\n` : ""}
${payload.humanGateTopics ? `Human-gated topics:\n${payload.humanGateTopics}\n` : ""}
${payload.operatingConstraints ? `Operating constraints:\n${payload.operatingConstraints}\n` : ""}
${payload.privacySecurityConstraints ? `Privacy/security constraints:\n${payload.privacySecurityConstraints}\n` : ""}
${payload.knownBlockers ? `Known blockers:\n${payload.knownBlockers}\n` : ""}
${payload.targetRobotTeam ? `Target robot team:\n${payload.targetRobotTeam}\n` : ""}
${payload.details ? `Details:\n${payload.details}\n` : ""}
Source: ${payload.context?.sourcePageUrl || "Unknown"}

View in admin: ${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${payload.requestId}
`;

          await sendEmail({
            to,
            subject,
            text,
            replyTo: emailLower,
          });
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send internal notification email"
          );
        }
      })()
    );

    // Fire and forget automations
    automationPromises.push(
      (async () => {
        try {
          await runInboundQualificationForRequest(inboundRequest as InboundRequest);
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to run inbound qualification automation"
          );
        }
      })()
    );

    automationPromises.push(
      (async () => {
        try {
          await runHighIntentLeadEnrichmentForRequest(inboundRequest as InboundRequest);
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to run high-intent lead enrichment"
          );
        }
      })()
    );

    Promise.all(automationPromises).catch((error) => {
      logger.error({ error }, "Error in automation promises");
    });

    // 10. Return success
    return res.status(HTTP_STATUS.CREATED).json({
      ok: true,
      requestId: payload.requestId,
      siteSubmissionId: payload.requestId,
      status: "submitted",
    } satisfies SubmitInboundRequestResponse);
  } catch (error) {
    logger.error(
      { error, durationMs: Date.now() - startTime },
      "Error processing inbound request"
    );
    return res.status(500).json({
      ok: false,
      requestId: req.body?.requestId || "",
      status: "submitted",
      message: "An error occurred processing your request. Please try again.",
    } satisfies SubmitInboundRequestResponse);
  }
});

export default router;
