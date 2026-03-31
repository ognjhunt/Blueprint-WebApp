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
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
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

function allowPipelinePlaceholderRequests() {
  const normalized = String(process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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
      requestedLanes: ["deeper_evaluation"],
      helpWith: [],
      buyerType: "robot_team",
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
      proof_path: {
        exact_site_requested_at: null,
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
    };

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
      qualification_state: nextQualificationState,
      opportunity_state: nextOpportunityState,
      pipeline,
      derived_assets: derivedAssets,
      deployment_readiness: deploymentReadiness,
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
