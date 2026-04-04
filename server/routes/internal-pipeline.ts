import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  DERIVED_ASSET_KEYS,
  DERIVED_ASSET_STATUSES,
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import { logger } from "../logger";
import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";
import {
  resolveCreatorIdForCapture,
  upsertCreatorPayoutFromPipeline,
} from "../utils/accounting";
import { ensureCreatorStripeAccountId } from "../utils/stripeConnectAccounts";
import type {
  DerivedAssetEntry,
  DerivedAssetsAttachment,
  DeploymentReadinessSummary,
  ExchangeStatus,
  ExchangeVisibility,
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
  RequestCapturePolicyTier,
  RequestCaptureStatus,
  RequestRightsStatus,
} from "../types/inbound-request";
import { ZodError } from "zod";

const router = Router();

const AUTO_CREATED_CONTACT = {
  firstName: "Pipeline",
  lastName: "Sync",
  email: "pipeline-sync@tryblueprint.io",
  roleTitle: "Automation",
  company: "Blueprint",
} as const;

const READY_QUALIFICATION_STATES = new Set<QualificationState>([
  "qualified_ready",
  "qualified_risky",
]);

const REVIEW_REQUIRED_QUALIFICATION_STATES = new Set<QualificationState>([
  "in_review",
  "needs_more_evidence",
  "needs_refresh",
  "not_ready_yet",
  "qualified_risky",
]);

const PRESERVED_EXCHANGE_STATUSES = new Set<ExchangeStatus>([
  "live",
  "paused",
  "closed",
]);

const AUTO_MANAGED_NEXT_STEPS = new Set<string>([
  "Contributor capture requested. Wait for upload or assign a closer space.",
  "Review the auto-created pipeline-backed request and backfill customer metadata if needed.",
  "Review qualification artifacts and decide whether this site can move into buyer handoff.",
  "Review qualification artifacts and prepare buyer handoff for robot-team diligence.",
  "Review qualification artifacts, risk notes, and decide whether to advance the buyer handoff.",
  "Review missing evidence, recapture requirements, and schedule the next capture pass.",
  "Review pipeline outputs and decide whether more evidence or manual escalation is required.",
]);

function allowPipelinePlaceholderRequests() {
  const normalized = String(process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeTimestamp(value: unknown) {
  const timestamp = value as { toDate?: () => Date } | string | null | undefined;
  if (!timestamp) {
    return null;
  }
  if (typeof timestamp === "string") {
    return timestamp;
  }
  return timestamp.toDate?.()?.toISOString?.() || null;
}

function normalizeIsoTimestamp(value: unknown) {
  const text = asString(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function inferDefaultOpportunityState(
  qualificationState: QualificationState
): OpportunityState {
  if (
    qualificationState === "qualified_ready" ||
    qualificationState === "qualified_risky"
  ) {
    return "handoff_ready";
  }
  return "not_applicable";
}

function isQualificationState(value: string): value is QualificationState {
  return (QUALIFICATION_STATES as readonly string[]).includes(value);
}

function isOpportunityState(value: string): value is OpportunityState {
  return (OPPORTUNITY_STATES as readonly string[]).includes(value);
}

function isRequestCaptureStatus(value: string): value is RequestCaptureStatus {
  return [
    "not_requested",
    "capture_requested",
    "under_review",
    "approved",
    "needs_recapture",
    "paid",
  ].includes(value);
}

function isRequestRightsStatus(value: string): value is RequestRightsStatus {
  return ["unknown", "verified", "permission_required", "blocked"].includes(value);
}

function isRequestCapturePolicyTier(value: string): value is RequestCapturePolicyTier {
  return [
    "approved_capture",
    "review_required",
    "permission_required",
    "not_allowed",
  ].includes(value);
}

function isExchangeStatus(value: string): value is ExchangeStatus {
  return ["not_listed", "eligible", "live", "paused", "closed"].includes(value);
}

function isExchangeVisibility(value: string): value is ExchangeVisibility {
  return ["internal", "gated_robot_teams", "private"].includes(value);
}

function isDerivedAssetStatus(
  value: string
): value is DerivedAssetEntry["status"] {
  return (DERIVED_ASSET_STATUSES as readonly string[]).includes(value);
}

function requirePipelineToken(req: Request, res: Response, next: () => void) {
  const expected = (process.env.PIPELINE_SYNC_TOKEN || "").trim();
  const provided = String(req.header("X-Blueprint-Pipeline-Token") || "").trim();
  if (!expected || provided != expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function buildPipelineAttachment(
  body: Record<string, unknown>,
  current?: PipelineAttachment
): PipelineAttachment {
  const artifacts = body.artifacts && typeof body.artifacts === "object" ? body.artifacts : {};
  return {
    buyer_request_id: String(body.buyer_request_id || current?.buyer_request_id || ""),
    capture_job_id: String(body.capture_job_id || current?.capture_job_id || ""),
    scene_id: String(body.scene_id || current?.scene_id || ""),
    capture_id: String(body.capture_id || current?.capture_id || ""),
    pipeline_prefix: String(body.pipeline_prefix || current?.pipeline_prefix || ""),
    artifacts: {
      ...(current?.artifacts || {}),
      ...(artifacts as PipelineArtifacts),
    },
    synced_at: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

function buildDerivedAssets(
  body: Record<string, unknown>,
  current?: DerivedAssetsAttachment
): DerivedAssetsAttachment | undefined {
  const derivedAssets = body.derived_assets;
  if (!derivedAssets || typeof derivedAssets !== "object") {
    return current;
  }

  const next: DerivedAssetsAttachment = {
    ...(current || {}),
  };

  for (const key of DERIVED_ASSET_KEYS) {
    const rawEntry = (derivedAssets as Record<string, unknown>)[key];
    if (rawEntry == null) {
      continue;
    }

    if (typeof rawEntry !== "object") {
      throw new Error(`derived_assets.${key} must be an object`);
    }

    const status = String((rawEntry as Record<string, unknown>).status || "").trim();
    if (!isDerivedAssetStatus(status)) {
      throw new Error(`derived_assets.${key}.status is invalid`);
    }

    const previousEntry = current?.[key];
    const rawUpdatedAt = (rawEntry as Record<string, unknown>).updated_at;
    next[key] = {
      ...(previousEntry || {}),
      ...(rawEntry as DerivedAssetEntry),
      status,
      ...(rawUpdatedAt !== undefined ? { updated_at: rawUpdatedAt as never } : {}),
    };
  }

  next.synced_at = admin.firestore.FieldValue.serverTimestamp() as never;
  return next;
}

function buildDeploymentReadiness(
  body: Record<string, unknown>,
  current?: DeploymentReadinessSummary
): DeploymentReadinessSummary | undefined {
  const readiness = body.deployment_readiness;
  if (!readiness || typeof readiness !== "object") {
    return current;
  }
  return {
    ...(current || {}),
    ...(readiness as DeploymentReadinessSummary),
  };
}

function currentCaptureStatus(currentData: Record<string, unknown> | null) {
  const raw = asString((currentData?.ops as Record<string, unknown> | undefined)?.capture_status);
  return isRequestCaptureStatus(raw) ? raw : null;
}

function currentRightsStatus(currentData: Record<string, unknown> | null) {
  const raw = asString((currentData?.ops as Record<string, unknown> | undefined)?.rights_status);
  return isRequestRightsStatus(raw) ? raw : "unknown";
}

function currentCapturePolicyTier(currentData: Record<string, unknown> | null) {
  const raw = asString((currentData?.ops as Record<string, unknown> | undefined)?.capture_policy_tier);
  return isRequestCapturePolicyTier(raw) ? raw : "review_required";
}

function hasExchangeArtifacts(pipeline: PipelineAttachment) {
  const artifacts = pipeline.artifacts || {};
  return Boolean(
    asString(artifacts.readiness_report_uri) && asString(artifacts.opportunity_handoff_uri)
  );
}

function deriveCaptureStatus(params: {
  currentData: Record<string, unknown> | null;
  qualificationState: QualificationState;
  deploymentReadiness?: DeploymentReadinessSummary;
}): RequestCaptureStatus {
  const existing = currentCaptureStatus(params.currentData);
  if (existing === "paid") {
    return existing;
  }
  if (params.deploymentReadiness?.recapture_required === true) {
    return "needs_recapture";
  }
  switch (params.qualificationState) {
    case "capture_requested":
      return "capture_requested";
    case "qa_passed":
    case "in_review":
      return "under_review";
    case "qualified_ready":
    case "qualified_risky":
      return "approved";
    case "needs_more_evidence":
    case "needs_refresh":
      return "needs_recapture";
    case "not_ready_yet":
      return existing === "capture_requested" ? "under_review" : existing || "under_review";
    default:
      return existing || "not_requested";
  }
}

function derivedAssetsNeedReview(derivedAssets?: DerivedAssetsAttachment) {
  if (!derivedAssets) {
    return false;
  }
  return Object.entries(derivedAssets).some(([key, entry]) => {
    if (key === "synced_at" || !entry || typeof entry !== "object") {
      return false;
    }
    return entry.status === "failed" || entry.status === "review_required";
  });
}

function deriveHumanReviewRequired(params: {
  currentData: Record<string, unknown> | null;
  qualificationState: QualificationState;
  deploymentReadiness?: DeploymentReadinessSummary;
  derivedAssets?: DerivedAssetsAttachment;
}) {
  const currentValue = params.currentData?.human_review_required === true;
  if (currentValue) {
    return true;
  }
  if (REVIEW_REQUIRED_QUALIFICATION_STATES.has(params.qualificationState)) {
    return true;
  }
  if (params.deploymentReadiness?.recapture_required === true) {
    return true;
  }
  return derivedAssetsNeedReview(params.derivedAssets);
}

function deriveExchangeProjection(params: {
  currentData: Record<string, unknown> | null;
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  pipeline: PipelineAttachment;
  deploymentReadiness?: DeploymentReadinessSummary;
}) {
  const currentExchangeStatus = asString(params.currentData?.exchange_status);
  const currentExchangeVisibility = asString(params.currentData?.exchange_visibility);
  const rightsStatus = currentRightsStatus(params.currentData);
  const capturePolicyTier = currentCapturePolicyTier(params.currentData);
  const promotable =
    READY_QUALIFICATION_STATES.has(params.qualificationState) &&
    params.opportunityState === "handoff_ready" &&
    hasExchangeArtifacts(params.pipeline) &&
    params.deploymentReadiness?.recapture_required !== true &&
    rightsStatus !== "blocked" &&
    capturePolicyTier !== "not_allowed";

  let exchangeStatus: ExchangeStatus =
    PRESERVED_EXCHANGE_STATUSES.has(currentExchangeStatus as ExchangeStatus) &&
    isExchangeStatus(currentExchangeStatus)
      ? (currentExchangeStatus as ExchangeStatus)
      : promotable
        ? "eligible"
        : "not_listed";

  let exchangeVisibility: ExchangeVisibility;
  if (
    PRESERVED_EXCHANGE_STATUSES.has(exchangeStatus) &&
    isExchangeVisibility(currentExchangeVisibility)
  ) {
    exchangeVisibility = currentExchangeVisibility as ExchangeVisibility;
  } else if (promotable) {
    exchangeVisibility =
      rightsStatus === "verified" && capturePolicyTier === "approved_capture"
        ? "gated_robot_teams"
        : "internal";
  } else if (READY_QUALIFICATION_STATES.has(params.qualificationState)) {
    exchangeVisibility = rightsStatus === "blocked" ? "private" : "internal";
  } else {
    exchangeVisibility = "private";
  }

  if (!isExchangeStatus(exchangeStatus)) {
    exchangeStatus = "not_listed";
  }

  return { exchangeStatus, exchangeVisibility };
}

function shouldRefreshNextStep(currentData: Record<string, unknown> | null) {
  const currentNextStep = asString((currentData?.ops as Record<string, unknown> | undefined)?.next_step);
  return !currentNextStep || AUTO_MANAGED_NEXT_STEPS.has(currentNextStep);
}

function deriveNextStep(params: {
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  deploymentReadiness?: DeploymentReadinessSummary;
}) {
  if (
    params.qualificationState === "needs_more_evidence" ||
    params.deploymentReadiness?.recapture_required === true
  ) {
    return "Review missing evidence, recapture requirements, and schedule the next capture pass.";
  }
  if (params.qualificationState === "qualified_risky") {
    return "Review qualification artifacts, risk notes, and decide whether to advance the buyer handoff.";
  }
  if (
    params.qualificationState === "qualified_ready" &&
    params.opportunityState === "handoff_ready"
  ) {
    return "Review qualification artifacts and prepare buyer handoff for robot-team diligence.";
  }
  return "Review pipeline outputs and decide whether more evidence or manual escalation is required.";
}

function buildPlaceholderInboundRequest(params: {
  requestId: string;
  siteSubmissionId: string;
  buyerRequestId?: string;
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  sceneId?: string;
  captureId?: string;
}) {
  const siteLabel =
    String(params.siteSubmissionId || params.sceneId || params.requestId).trim() ||
    params.requestId;
  const sceneLabel = String(params.sceneId || "").trim();
  const captureLabel = String(params.captureId || "").trim();
  const locationDetail = sceneLabel ? `Scene ${sceneLabel}` : "Location pending";
  const taskDetail = captureLabel
    ? `Pipeline-backed site world from capture ${captureLabel}.`
    : "Pipeline-backed site world awaiting request details.";

  return {
    requestId: params.requestId,
    site_submission_id: params.siteSubmissionId,
    buyer_request_id: params.buyerRequestId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: params.qualificationState,
    qualification_state: params.qualificationState,
    opportunity_state: params.opportunityState,
    priority: "normal",
    owner: {},
    contact: AUTO_CREATED_CONTACT,
    request: {
      budgetBucket: "Undecided/Unsure",
      requestedLanes: ["qualification"],
      helpWith: [],
      buyerType: "site_operator",
      siteName: `Pipeline site ${siteLabel}`,
      siteLocation: locationDetail,
      taskStatement: taskDetail,
      workflowContext: null,
      operatingConstraints: null,
      privacySecurityConstraints: null,
      knownBlockers: null,
      targetRobotTeam: null,
      captureRights: null,
      derivedScenePermission: null,
      datasetLicensingPermission: null,
      payoutEligibility: null,
      details:
        "Auto-created by /api/internal/pipeline/attachments because no inbound request record existed yet.",
    },
    context: {
      sourcePageUrl: "pipeline://attachments",
      referrer: null,
      utm: {},
      userAgent: "internal-pipeline",
      timezoneOffset: null,
      locale: null,
      ipHash: null,
    },
    enrichment: {
      companyDomain: "tryblueprint.io",
      companySize: null,
      geo: null,
      notes:
        "Placeholder request seeded automatically from pipeline artifact sync.",
    },
    events: {
      confirmationEmailSentAt: null,
      slackNotifiedAt: null,
      crmSyncedAt: null,
    },
    ops: {
      assigned_region_id: "managed-alpha",
      rights_status: "unknown",
      capture_policy_tier: "review_required",
      capture_status: "approved",
      recapture_reason: null,
      quote_status: "not_started",
      next_step:
        "Review the auto-created pipeline-backed request and backfill customer metadata if needed.",
      last_buyer_ready_at: null,
    },
    debug: {
      schemaVersion: 2,
      autoCreatedByPipeline: true,
    },
  };
}

router.post("/attachments", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsedBody = parsePipelineAttachmentSyncPayload(body);
    const siteSubmissionId = String(parsedBody.site_submission_id || "").trim();
    const requestId = String(parsedBody.request_id || "").trim();
    const authoritativeStateUpdate = parsedBody.authoritative_state_update === true;
    const qualificationState = String(parsedBody.qualification_state || "").trim();
    const opportunityState = String(parsedBody.opportunity_state || "").trim();

    if (!siteSubmissionId && !requestId) {
      return res.status(400).json({ error: "site_submission_id or request_id is required" });
    }

    let docRef: FirebaseFirestore.DocumentReference | null = null;
    let currentData: Record<string, unknown> | null = null;
    let shouldCreate = false;
    if (siteSubmissionId) {
      const snapshot = await db
        .collection("inboundRequests")
        .where("site_submission_id", "==", siteSubmissionId)
        .limit(1)
        .get();
      const matchedDoc = snapshot.docs[0];
      docRef = matchedDoc?.ref ?? null;
      currentData = (matchedDoc?.data?.() as Record<string, unknown>) ?? null;
    }
    if (!docRef && requestId) {
      const fallbackRef = db.collection("inboundRequests").doc(requestId);
      const doc = await fallbackRef.get();
      if (doc.exists) {
        docRef = fallbackRef;
        currentData = (doc.data() as Record<string, unknown>) ?? null;
      }
    }
    if (!docRef) {
      if (!allowPipelinePlaceholderRequests()) {
        return res.status(409).json({
          error: "Inbound request bootstrap is required before pipeline attachment sync.",
          code: "missing_inbound_request_bootstrap",
          request_id: requestId || null,
          site_submission_id: siteSubmissionId || null,
        });
      }
      const targetDocId = requestId || siteSubmissionId;
      docRef = db.collection("inboundRequests").doc(targetDocId);
      shouldCreate = true;
    }

    if (authoritativeStateUpdate && !isQualificationState(qualificationState)) {
      return res.status(400).json({ error: "Valid qualification_state is required" });
    }

    if (opportunityState && !isOpportunityState(opportunityState)) {
      return res.status(400).json({ error: "Invalid opportunity_state" });
    }

    const pipeline = buildPipelineAttachment(parsedBody, currentData?.pipeline as PipelineAttachment);
    const derivedAssets = buildDerivedAssets(
      parsedBody,
      currentData?.derived_assets as DerivedAssetsAttachment | undefined
    );
    const deploymentReadiness = buildDeploymentReadiness(
      parsedBody,
      currentData?.deployment_readiness as DeploymentReadinessSummary | undefined
    );
    const nextQualificationState = authoritativeStateUpdate
      ? (qualificationState as QualificationState)
      : String(
          currentData?.qualification_state || currentData?.status || "submitted"
        ).trim() as QualificationState;
    const nextOpportunityState = (
      authoritativeStateUpdate
        ? opportunityState || currentData?.opportunity_state || inferDefaultOpportunityState(nextQualificationState)
        : currentData?.opportunity_state || inferDefaultOpportunityState(nextQualificationState)
    ) as OpportunityState;

    const updatePayload: Record<string, unknown> = {
      pipeline,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      latest_pipeline_completed_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const latestCaptureCompletedAt = normalizeIsoTimestamp(parsedBody.latest_capture_completed_at);
    if (latestCaptureCompletedAt) {
      updatePayload.latest_capture_completed_at = latestCaptureCompletedAt;
    }

    if (siteSubmissionId && !currentData?.site_submission_id) {
      updatePayload.site_submission_id = siteSubmissionId;
    }

    if (parsedBody.buyer_request_id) {
      updatePayload.buyer_request_id = String(parsedBody.buyer_request_id || "").trim();
    }

    if (derivedAssets) {
      updatePayload.derived_assets = derivedAssets;
    }

    if (deploymentReadiness) {
      updatePayload.deployment_readiness = deploymentReadiness;
    }

    updatePayload.human_review_required = deriveHumanReviewRequired({
      currentData,
      qualificationState: nextQualificationState,
      deploymentReadiness,
      derivedAssets,
    });

    const trustScore = deploymentReadiness?.buyer_trust_score?.score;
    if (typeof trustScore === "number" && Number.isFinite(trustScore)) {
      updatePayload.automation_confidence = trustScore;
    }

    const currentOps =
      currentData?.ops && typeof currentData.ops === "object"
        ? (currentData.ops as Record<string, unknown>)
        : {};
    const nextCaptureStatus = deriveCaptureStatus({
      currentData,
      qualificationState: nextQualificationState,
      deploymentReadiness,
    });
    updatePayload.ops = {
      ...currentOps,
      capture_status: nextCaptureStatus,
      ...(READY_QUALIFICATION_STATES.has(nextQualificationState) &&
      !currentOps.last_buyer_ready_at
        ? { last_buyer_ready_at: admin.firestore.FieldValue.serverTimestamp() }
        : {}),
      ...(shouldRefreshNextStep(currentData)
        ? {
            next_step: deriveNextStep({
              qualificationState: nextQualificationState,
              opportunityState: nextOpportunityState,
              deploymentReadiness,
            }),
          }
        : {}),
    };

    const exchangeProjection = deriveExchangeProjection({
      currentData,
      qualificationState: nextQualificationState,
      opportunityState: nextOpportunityState,
      pipeline,
      deploymentReadiness,
    });
    updatePayload.exchange_status = exchangeProjection.exchangeStatus;
    updatePayload.exchange_visibility = exchangeProjection.exchangeVisibility;

    const payoutRecommendationSource =
      deploymentReadiness && typeof deploymentReadiness === "object"
        ? (deploymentReadiness as Record<string, unknown>)
        : null;
    const payoutRecommendation =
      payoutRecommendationSource &&
      typeof payoutRecommendationSource.capturer_payout_recommendation === "object"
        ? (payoutRecommendationSource.capturer_payout_recommendation as Record<string, unknown>)
        : null;
    if (parsedBody.capture_id && payoutRecommendation) {
      const creatorId = await resolveCreatorIdForCapture(
        String(parsedBody.capture_id || ""),
      );
      const stripeConnectAccountId = creatorId
        ? await ensureCreatorStripeAccountId(creatorId)
        : null;
      await upsertCreatorPayoutFromPipeline({
        captureId: String(parsedBody.capture_id || ""),
        sceneId: String(parsedBody.scene_id || "") || null,
        captureJobId: String(parsedBody.capture_job_id || "") || null,
        buyerRequestId: String(parsedBody.buyer_request_id || "") || null,
        siteSubmissionId:
          String(parsedBody.site_submission_id || parsedBody.request_id || "") || null,
        qualificationState: String(parsedBody.qualification_state || "") || null,
        opportunityState: String(parsedBody.opportunity_state || "") || null,
        recommendation: payoutRecommendation,
        recommendationUri:
          typeof parsedBody.artifacts?.capturer_payout_recommendation_uri === "string"
            ? parsedBody.artifacts.capturer_payout_recommendation_uri
            : null,
        stripeConnectAccountId,
      });
    }

    if (authoritativeStateUpdate) {
      updatePayload.status = nextQualificationState;
      updatePayload.qualification_state = nextQualificationState;
      updatePayload.opportunity_state = nextOpportunityState;
    }

    if (shouldCreate) {
      await docRef.set(
        {
          ...buildPlaceholderInboundRequest({
            requestId: docRef.id,
            siteSubmissionId: siteSubmissionId || docRef.id,
            buyerRequestId: String(parsedBody.buyer_request_id || "").trim() || undefined,
            qualificationState: nextQualificationState,
            opportunityState: nextOpportunityState,
            sceneId: pipeline.scene_id,
            captureId: pipeline.capture_id,
          }),
          ...updatePayload,
        },
        { merge: true }
      );
    } else {
      await docRef.update(updatePayload);
    }

    return res.json({
      ok: true,
      requestId: docRef.id,
      site_submission_id: siteSubmissionId || requestId,
      latest_capture_completed_at:
        latestCaptureCompletedAt || normalizeTimestamp(currentData?.latest_capture_completed_at),
      qualification_state: nextQualificationState,
      opportunity_state: nextOpportunityState,
      pipeline,
      derived_assets: derivedAssets,
      deployment_readiness: deploymentReadiness,
      exchange_status: exchangeProjection.exchangeStatus,
      exchange_visibility: exchangeProjection.exchangeVisibility,
      human_review_required: updatePayload.human_review_required,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid pipeline attachment payload" });
    }
    logger.error({ error }, "Failed to attach pipeline metadata");
    return res.status(500).json({ error: "Failed to attach pipeline metadata" });
  }
});

export default router;
