import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  DERIVED_ASSET_KEYS,
  DERIVED_ASSET_STATUSES,
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import { logger } from "../logger";
import {
  appendOperatingGraphEvent,
  buildCityProgramId,
  buildPackageRunId,
} from "../utils/operatingGraph";
import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";
import {
  resolveCreatorIdForCapture,
  upsertCreatorPayoutFromPipeline,
} from "../utils/accounting";
import { ensureCreatorStripeAccountId } from "../utils/stripeConnectAccounts";
import {
  computePipelineStateTransition,
  checkHostedReviewReadiness,
  growthEventsForStamps,
} from "../utils/pipelineStateMachine";
import { logGrowthEvent } from "../utils/growth-events";
import type {
  DerivedAssetEntry,
  DerivedAssetsAttachment,
  DeploymentReadinessSummary,
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
  ProofPathMilestones,
} from "../types/inbound-request";
import { ZodError } from "zod";
import type { OperatingGraphStage } from "../utils/operatingGraphTypes";
import {
  buildBuyerOperatingGraphMetadata,
  deriveCityContext,
  deriveStablePackageId,
} from "../utils/buyerOutcomes";

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
    const readinessQualificationState = String(
      parsedBody.deployment_readiness?.qualification_state || "",
    ).trim();
    const readinessOpportunityState = String(
      parsedBody.deployment_readiness?.opportunity_state || "",
    ).trim();

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

    const nextQualificationStateSource =
      qualificationState || readinessQualificationState;
    const nextOpportunityStateSource =
      opportunityState || readinessOpportunityState;

    if (authoritativeStateUpdate && !isQualificationState(nextQualificationStateSource)) {
      return res.status(400).json({ error: "Valid qualification_state is required" });
    }

    if (nextOpportunityStateSource && !isOpportunityState(nextOpportunityStateSource)) {
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
      ? (nextQualificationStateSource as QualificationState)
      : String(
          currentData?.qualification_state || currentData?.status || "submitted"
        ).trim() as QualificationState;
    const nextOpportunityState = (
      authoritativeStateUpdate
        ? nextOpportunityStateSource ||
          currentData?.opportunity_state ||
          inferDefaultOpportunityState(nextQualificationState)
        : currentData?.opportunity_state ||
          inferDefaultOpportunityState(nextQualificationState)
    ) as OpportunityState;
    const currentBuyerType =
      shouldCreate
        ? "robot_team"
        : String(
            (currentData?.request as Record<string, unknown> | undefined)?.buyerType || "",
          ).trim();
    const currentOps =
      currentData?.ops && typeof currentData.ops === "object"
        ? (currentData.ops as Record<string, unknown>)
        : {};
    const currentProofPath: ProofPathMilestones =
      currentOps.proof_path && typeof currentOps.proof_path === "object"
        ? (currentOps.proof_path as ProofPathMilestones)
        : {
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
          };

    // Use the pipeline state machine for comprehensive state transition
    const stateTransition = computePipelineStateTransition({
      artifacts: pipeline.artifacts,
      derivedAssets: derivedAssets || (currentData?.derived_assets as DerivedAssetsAttachment | undefined),
      deploymentReadiness: deploymentReadiness || (currentData?.deployment_readiness as DeploymentReadinessSummary | undefined),
      authoritativeStateUpdate,
      explicitQualificationState: parsedBody.qualification_state,
      explicitOpportunityState: parsedBody.opportunity_state,
      currentQualificationState: nextQualificationState as QualificationState | undefined,
      currentOpportunityState: nextOpportunityState as OpportunityState | undefined,
      currentProofPath,
      currentOps,
      currentDerivedAssets: currentData?.derived_assets as DerivedAssetsAttachment | undefined,
      currentDeploymentReadiness: currentData?.deployment_readiness as DeploymentReadinessSummary | undefined,
    });

    const finalQualificationState = authoritativeStateUpdate
      ? stateTransition.qualificationState
      : nextQualificationState;
    const finalOpportunityState = authoritativeStateUpdate
      ? stateTransition.opportunityState
      : nextOpportunityState;

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

    if (stateTransition.deploymentReadiness) {
      updatePayload.deployment_readiness = stateTransition.deploymentReadiness;
    } else if (deploymentReadiness) {
      updatePayload.deployment_readiness = deploymentReadiness;
    }

    const payoutRecommendationSource =
      (stateTransition.deploymentReadiness || deploymentReadiness) && typeof (stateTransition.deploymentReadiness || deploymentReadiness) === "object"
        ? ((stateTransition.deploymentReadiness || deploymentReadiness) as Record<string, unknown>)
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
      updatePayload.status = finalQualificationState;
      updatePayload.qualification_state = finalQualificationState;
      updatePayload.opportunity_state = finalOpportunityState;
    }

    // Update ops envelope from state machine (includes proof path milestones)
    const updatedOps = {
      ...currentOps,
      proof_path: stateTransition.proofPathUpdate.proofPath,
      ...(stateTransition.opsUpdate.capturePolicyTier ? {
        capture_policy_tier: stateTransition.opsUpdate.capturePolicyTier,
      } : {}),
      ...(stateTransition.opsUpdate.rightsStatus ? {
        rights_status: stateTransition.opsUpdate.rightsStatus,
      } : {}),
      ...(stateTransition.opsUpdate.captureStatus ? {
        capture_status: stateTransition.opsUpdate.captureStatus,
      } : {}),
      ...(stateTransition.opsUpdate.quoteStatus ? {
        quote_status: stateTransition.opsUpdate.quoteStatus,
      } : {}),
      ...(stateTransition.opsUpdate.nextStep ? {
        next_step: stateTransition.opsUpdate.nextStep,
      } : {}),
    };
    updatePayload.ops = updatedOps;

    if (shouldCreate) {
      const placeholderRecord = buildPlaceholderInboundRequest({
        requestId: docRef.id,
        siteSubmissionId: siteSubmissionId || docRef.id,
        buyerRequestId: String(parsedBody.buyer_request_id || "").trim() || undefined,
        qualificationState: nextQualificationState,
        opportunityState: nextOpportunityState,
        sceneId: pipeline.scene_id,
        captureId: pipeline.capture_id,
      });
      await docRef.set(
        {
          ...placeholderRecord,
          ...updatePayload,
          ...(updatePayload.ops
            ? {
                ops: {
                  ...(placeholderRecord.ops || {}),
                  ...(updatePayload.ops as Record<string, unknown>),
                },
              }
            : {}),
        },
        { merge: true }
      );
    } else {
      await docRef.update(updatePayload);
    }

    // Emit growth events for newly stamped milestones and stall detection
    const requestIdForEvent = docRef.id;
    const cityForEvent =
      (currentData?.context as Record<string, unknown> | undefined)?.demandCity as string | null ?? null;
    const buyerSegmentForEvent =
      ((currentData?.contact as Record<string, unknown> | undefined)?.roleTitle as string | null) ?? null;

    const milestoneEvents = growthEventsForStamps(
      stateTransition.proofPathUpdate.stampedThisSync
    );
    for (const event of milestoneEvents) {
      await logGrowthEvent({
        event,
        source: "server:pipeline_state_machine",
        properties: {
          request_id: requestIdForEvent,
          city: cityForEvent,
          buyer_segment: buyerSegmentForEvent,
          pipeline_sync: true,
        },
      }).catch((err: unknown) => {
        logger.warn({ err, event }, "Failed to emit pipeline growth event");
      });
    }

    // Emit proof_motion_stalled when pipeline detects a stall
    if (stateTransition.proofMotionStalled) {
      await logGrowthEvent({
        event: "proof_motion_stalled",
        source: "server:pipeline_state_machine",
        properties: {
          request_id: requestIdForEvent,
          city: cityForEvent,
          blocker_reason: stateTransition.stallReason,
          buyer_segment: buyerSegmentForEvent,
          pipeline_sync: true,
        },
      }).catch((err: unknown) => {
        logger.warn({ err, event: "proof_motion_stalled" }, "Failed to emit pipeline growth event");
      });

      // Emit Sacramento proof-motion contract instrumented event if city is Sacramento
      if (cityForEvent === "sacramento-ca") {
        await logGrowthEvent({
          event: "sacramento_proof_motion_contract_instrumented",
          source: "server:pipeline_state_machine",
          properties: {
            request_id: requestIdForEvent,
            city: cityForEvent,
            pipeline_sync: true,
          },
        }).catch((err: unknown) => {
          logger.warn({ err, event: "sacramento_proof_motion_contract_instrumented" }, "Failed to emit Sacramento contract event");
        });
      }
    }

    if (cityForEvent) {
      const hostedReviewReadiness = checkHostedReviewReadiness({
        artifacts: pipeline?.artifacts,
        derivedAssets,
      });
      const cityContext = deriveCityContext({
        city: cityForEvent,
      });
      const packageId = deriveStablePackageId({
        captureId: pipeline?.capture_id || null,
        sceneId: pipeline?.scene_id || null,
        siteSubmissionId: siteSubmissionId || requestId || docRef.id,
        buyerRequestId:
          String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
            .trim()
          || null,
        requestId: docRef.id,
      });
      const graphStage: OperatingGraphStage = hostedReviewReadiness.ready
        ? "hosted_review_ready"
        : stateTransition.qualificationState === "qualified_ready"
          || stateTransition.qualificationState === "qualified_risky"
          ? "package_ready"
          : "pipeline_packaging";
      const captureIdForSync =
        String(pipeline?.capture_id || parsedBody.capture_id || "").trim() || null;
      if (captureIdForSync) {
        await db.collection("capture_submissions").doc(captureIdForSync).set(
          {
            capture_id: captureIdForSync,
            scene_id: String(pipeline?.scene_id || parsedBody.scene_id || "").trim() || null,
            site_submission_id: siteSubmissionId || requestId || docRef.id,
            buyer_request_id:
              String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                .trim()
              || null,
            capture_job_id: String(pipeline?.capture_job_id || parsedBody.capture_job_id || "").trim() || null,
            city_context: {
              city: cityForEvent,
              city_slug: cityContext.citySlug,
            },
            lifecycle: {
              pipeline_handoff_published_at: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      }
      await appendOperatingGraphEvent({
        eventKey: `pipeline_sync:${docRef.id}:${String(pipeline?.capture_id || pipeline?.scene_id || docRef.id)}`,
        entityId: buildCityProgramId({
          citySlug: cityContext.citySlug,
        }),
        city: cityForEvent,
        citySlug: cityContext.citySlug,
        stage: graphStage,
        summary: `Pipeline sync updated ${cityForEvent} to ${graphStage.replaceAll("_", " ")}.`,
        sourceRepo: "Blueprint-WebApp",
        sourceKind: "pipeline_sync",
        origin: {
          repo: "Blueprint-WebApp",
          project: "blueprint-webapp",
          sourceCollection: "inboundRequests",
          sourceDocId: docRef.id,
          route: "/api/internal/pipeline/attachments",
        },
        nextActions: [
          {
            id: `pipeline_request:${docRef.id}`,
            summary: stateTransition.recommendedAction,
            owner: stateTransition.requiresHumanReview ? "ops-lead" : "webapp-codex",
            status: stateTransition.requiresHumanReview
              ? "awaiting_human_decision"
              : "ready_to_execute",
            sourceRef: docRef.id,
          },
        ],
        metadata: {
          ...buildBuyerOperatingGraphMetadata({
            cityProgramId: cityContext.cityProgramId,
            siteSubmissionId: siteSubmissionId || requestId || docRef.id,
            captureId: pipeline?.capture_id || null,
            sceneId: pipeline?.scene_id || null,
            buyerRequestId:
              String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                .trim()
              || null,
            captureJobId: pipeline?.capture_job_id || null,
            packageId,
          }),
          qualificationState: nextQualificationState,
          opportunityState: nextOpportunityState,
          hostedReviewReady: hostedReviewReadiness.ready,
        },
      }).catch(() => null);

      if (packageId) {
        await appendOperatingGraphEvent({
          eventKey: `pipeline_sync:package:${docRef.id}:${packageId}:${graphStage}`,
          entityType: "package_run",
          entityId: buildPackageRunId({
            packageId,
          }),
          city: cityForEvent,
          citySlug: cityContext.citySlug,
          stage: graphStage,
          summary: `Package run ${packageId} updated to ${graphStage.replaceAll("_", " ")}.`,
          sourceRepo: "Blueprint-WebApp",
          sourceKind: "pipeline_sync",
          origin: {
            repo: "Blueprint-WebApp",
            project: "blueprint-webapp",
            sourceCollection: "inboundRequests",
            sourceDocId: docRef.id,
            route: "/api/internal/pipeline/attachments",
          },
          nextActions: [
            {
              id: `package_run:${packageId}:next_action`,
              summary: stateTransition.recommendedAction,
              owner: stateTransition.requiresHumanReview ? "ops-lead" : "webapp-codex",
              status: stateTransition.requiresHumanReview
                ? "awaiting_human_decision"
                : "ready_to_execute",
              sourceRef: docRef.id,
            },
          ],
          metadata: {
            ...buildBuyerOperatingGraphMetadata({
              cityProgramId: cityContext.cityProgramId,
              siteSubmissionId: siteSubmissionId || requestId || docRef.id,
              captureId: pipeline?.capture_id || null,
              sceneId: pipeline?.scene_id || null,
              buyerRequestId:
                String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                  .trim()
                || null,
              captureJobId: pipeline?.capture_job_id || null,
              packageId,
            }),
            qualificationState: nextQualificationState,
            opportunityState: nextOpportunityState,
            hostedReviewReady: hostedReviewReadiness.ready,
          },
        }).catch(() => null);
      }
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

/**
 * GET /api/internal/pipeline/status/:requestId
 *
 * Inspect the current pipeline bridge state for a request: artifact inventory,
 * milestone status, hosted review readiness, and recommended next action.
 */
router.get("/status/:requestId", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const doc = await db.collection("inboundRequests").doc(req.params.requestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found", requestId: req.params.requestId });
    }

    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) {
      return res.status(404).json({ error: "Request has no data", requestId: req.params.requestId });
    }

    const pipeline = data.pipeline as (PipelineAttachment | undefined);
    const derivedAssets = data.derived_assets as (DerivedAssetsAttachment | undefined);
    const deploymentReadiness = data.deployment_readiness as (DeploymentReadinessSummary | undefined);
    const ops = data.ops as (Record<string, unknown> | undefined);

    const hostedReviewReadiness = checkHostedReviewReadiness({
      artifacts: pipeline?.artifacts,
      derivedAssets,
    });

    const stateTransition = computePipelineStateTransition({
      artifacts: pipeline?.artifacts,
      derivedAssets,
      deploymentReadiness,
      authoritativeStateUpdate: false,
      currentQualificationState: data.qualification_state as QualificationState | undefined,
      currentOpportunityState: data.opportunity_state as OpportunityState | undefined,
      currentProofPath: (ops?.proof_path as ProofPathMilestones | undefined) ?? {
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
      currentOps: ops,
      currentDeploymentReadiness: deploymentReadiness,
    });

    return res.json({
      ok: true,
      requestId: doc.id,
      artifacts: {
        total: stateTransition.artifactCount.total,
        core: stateTransition.artifactCount.core,
        inventory: pipeline?.artifacts ?? {},
      },
      milestones: stateTransition.proofPathUpdate.proofPath,
      hostedReviewReadiness,
      state: {
        qualification: stateTransition.qualificationState,
        opportunity: stateTransition.opportunityState,
        recommendedAction: stateTransition.recommendedAction,
        requiresHumanReview: stateTransition.requiresHumanReview,
      },
      ops: stateTransition.opsUpdate.opsAutomation,
      deployment_readiness: stateTransition.deploymentReadiness,
      pipelineSyncedAt: pipeline?.synced_at,
    });
  } catch (error) {
    logger.error({ error }, "Failed to retrieve pipeline status");
    return res.status(500).json({ error: "Failed to retrieve pipeline status" });
  }
});

/**
 * GET /api/internal/pipeline/hosted-readiness/:siteSubmissionId
 *
 * Check whether a site has sufficient pipeline outputs for buyer-facing
 * hosted review. Used by the marketing/sales-facing surfaces to know when
 * a site world is "live" for demos.
 */
router.get("/hosted-readiness/:siteSubmissionId", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const snapshot = await db
      .collection("inboundRequests")
      .where("site_submission_id", "==", req.params.siteSubmissionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Site submission not found" });
    }

    const data = snapshot.docs[0].data();
    const pipeline = data?.pipeline as (PipelineAttachment | undefined);
    const derivedAssets = data?.derived_assets as (DerivedAssetsAttachment | undefined);

    const readiness = checkHostedReviewReadiness({
      artifacts: pipeline?.artifacts,
      derivedAssets,
    });

    return res.json({
      ok: true,
      siteSubmissionId: req.params.siteSubmissionId,
      ...readiness,
      pipeline: pipeline ? {
        scene_id: pipeline.scene_id,
        capture_id: pipeline.capture_id,
        pipeline_prefix: pipeline.pipeline_prefix,
        synced_at: pipeline.synced_at,
      } : null,
    });
  } catch (error) {
    logger.error({ error }, "Failed to check hosted readiness");
    return res.status(500).json({ error: "Failed to check hosted readiness" });
  }
});

export default router;
