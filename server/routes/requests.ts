import { Request, Response, Router } from "express";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";
import admin from "../../client/src/lib/firebaseAdmin";
import {
  getRequestReviewCookieName,
  verifyRequestReviewToken,
} from "../utils/request-review-auth";
import { parseCookies } from "../utils/hosted-session-ui-auth";
import { logGrowthEvent } from "../utils/growth-events";
import {
  appendOperatingGraphEvent,
  buildHostedReviewRunId,
} from "../utils/operatingGraph";
import {
  buildBuyerOperatingGraphMetadata,
  deriveCityContext,
  deriveStableHostedReviewRunId,
  deriveStablePackageId,
  deriveStableBuyerAccountId,
} from "../utils/buyerOutcomes";

const router = Router();

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

function normalizeProofPathMilestones(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const milestone = value as Record<string, unknown>;
  return {
    exact_site_requested_at: normalizeTimestamp(milestone.exact_site_requested_at),
    qualified_inbound_at: normalizeTimestamp(milestone.qualified_inbound_at),
    proof_pack_delivered_at: normalizeTimestamp(milestone.proof_pack_delivered_at),
    proof_pack_reviewed_at: normalizeTimestamp(milestone.proof_pack_reviewed_at),
    hosted_review_ready_at: normalizeTimestamp(milestone.hosted_review_ready_at),
    hosted_review_started_at: normalizeTimestamp(milestone.hosted_review_started_at),
    hosted_review_follow_up_at: normalizeTimestamp(milestone.hosted_review_follow_up_at),
    artifact_handoff_delivered_at: normalizeTimestamp(milestone.artifact_handoff_delivered_at),
    artifact_handoff_accepted_at: normalizeTimestamp(milestone.artifact_handoff_accepted_at),
    human_commercial_handoff_at: normalizeTimestamp(milestone.human_commercial_handoff_at),
  };
}

function currentAccessToken(req: Request) {
  const cookieToken = parseCookies(req.headers.cookie)[getRequestReviewCookieName()];
  const queryToken = typeof req.query.access === "string" ? req.query.access.trim() : "";
  return cookieToken || queryToken || "";
}

function canAccessRequest(req: Request, requestId: string) {
  const token = currentAccessToken(req);
  return Boolean(token && verifyRequestReviewToken(token, requestId));
}

router.post("/:requestId/bootstrap", async (req: Request, res: Response) => {
  const token = typeof req.body?.access === "string" ? req.body.access.trim() : "";
  if (!token || !verifyRequestReviewToken(token, req.params.requestId)) {
    return res.status(401).json({ error: "Invalid review link" });
  }

  res.cookie(getRequestReviewCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });

  return res.json({ ok: true });
});

router.get("/:requestId", async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    if (!canAccessRequest(req, req.params.requestId)) {
      return res.status(401).json({ error: "Review link required" });
    }

    const doc = await db.collection("inboundRequests").doc(req.params.requestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const decrypted = (await decryptInboundRequestForAdmin(
      doc.data() as InboundRequestStored
    )) as unknown as InboundRequest;

    if (
      decrypted.request?.buyerType === "robot_team"
      && !normalizeTimestamp(decrypted.ops?.proof_path?.hosted_review_started_at)
    ) {
      const hostedReviewRunId = deriveStableHostedReviewRunId({
        requestId: req.params.requestId,
        buyerRequestId: decrypted.buyer_request_id || decrypted.requestId,
      });
      const packageId = deriveStablePackageId({
        captureId: decrypted.pipeline?.capture_id || null,
        sceneId: decrypted.pipeline?.scene_id || null,
        siteSubmissionId: decrypted.site_submission_id || decrypted.requestId,
        buyerRequestId: decrypted.buyer_request_id || decrypted.requestId,
        requestId: decrypted.requestId,
      });
      const buyerAccountId = deriveStableBuyerAccountId({
        contactEmail: decrypted.contact?.email || null,
        contactCompany: decrypted.contact?.company || null,
        buyerRequestId: decrypted.buyer_request_id || decrypted.requestId,
      });
      const cityContext = deriveCityContext({
        city: decrypted.context?.demandCity || null,
      });
      const recordedAtIso = new Date().toISOString();

      await db.collection("inboundRequests").doc(req.params.requestId).update({
        "ops.proof_path.hosted_review_started_at":
          admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logGrowthEvent({
        event: "hosted_review_started",
        source: "server:request_console",
        properties: {
          request_id: req.params.requestId,
          city: decrypted.context?.demandCity || null,
          buyer_segment: decrypted.contact?.roleTitle || null,
          hosted_mode: "buyer_review_console",
        },
        attribution: {
          demandCity: decrypted.context?.demandCity || null,
          buyerChannelSource: decrypted.context?.buyerChannelSource || null,
          buyerChannelSourceCaptureMode:
            decrypted.context?.buyerChannelSourceCaptureMode || null,
          utm: decrypted.context?.utm || {},
        },
        user: {
          email: decrypted.contact?.email || null,
        },
      }).catch(() => null);

      if (cityContext.city && cityContext.citySlug && hostedReviewRunId) {
        await appendOperatingGraphEvent({
          eventKey: `hosted_review_started:${req.params.requestId}:${hostedReviewRunId}`,
          entityType: "hosted_review_run",
          entityId: buildHostedReviewRunId({
            hostedReviewRunId,
          }),
          city: cityContext.city,
          citySlug: cityContext.citySlug,
          stage: "hosted_review_started",
          summary: "Hosted review started from buyer review access.",
          sourceRepo: "Blueprint-WebApp",
          sourceKind: "buyer_review_access",
          origin: {
            repo: "Blueprint-WebApp",
            project: "blueprint-webapp",
            sourceCollection: "inboundRequests",
            sourceDocId: req.params.requestId,
            route: "/api/requests/:requestId",
          },
          metadata: buildBuyerOperatingGraphMetadata({
            cityProgramId: cityContext.cityProgramId,
            siteSubmissionId: decrypted.site_submission_id || decrypted.requestId,
            captureId: decrypted.pipeline?.capture_id || null,
            sceneId: decrypted.pipeline?.scene_id || null,
            buyerRequestId: decrypted.buyer_request_id || decrypted.requestId,
            captureJobId: decrypted.pipeline?.capture_job_id || null,
            packageId,
            hostedReviewRunId,
            buyerAccountId,
          }),
          recordedAtIso,
        }).catch(() => null);
      }

      if (decrypted.ops?.proof_path && typeof decrypted.ops.proof_path === "object") {
        decrypted.ops.proof_path.hosted_review_started_at =
          new Date().toISOString() as never;
      }
    }

    return res.json({
      requestId: decrypted.requestId,
      site_submission_id: decrypted.site_submission_id || decrypted.requestId,
      buyer_request_id: decrypted.buyer_request_id || decrypted.requestId,
      createdAt: decrypted.createdAt?.toDate?.()?.toISOString?.() || "",
      qualification_state: decrypted.qualification_state || decrypted.status,
      opportunity_state: decrypted.opportunity_state || "not_applicable",
      request: {
        siteName: decrypted.request.siteName,
        siteLocation: decrypted.request.siteLocation,
        taskStatement: decrypted.request.taskStatement,
        workflowContext: decrypted.request.workflowContext,
        operatingConstraints: decrypted.request.operatingConstraints,
        privacySecurityConstraints: decrypted.request.privacySecurityConstraints,
        knownBlockers: decrypted.request.knownBlockers,
        requestedLanes: decrypted.request.requestedLanes || [],
        buyerType: decrypted.request.buyerType,
      },
      pipeline: decrypted.pipeline || null,
      derived_assets: decrypted.derived_assets || null,
      deployment_readiness: decrypted.deployment_readiness || null,
      buyer_review_access: {
        buyer_review_url: decrypted.buyer_review_access?.buyer_review_url || null,
        token_issued_at: normalizeTimestamp(decrypted.buyer_review_access?.token_issued_at),
        last_sent_at: normalizeTimestamp(decrypted.buyer_review_access?.last_sent_at),
      },
      ops: {
        assigned_region_id: decrypted.ops?.assigned_region_id || null,
        rights_status: decrypted.ops?.rights_status || "unknown",
        capture_policy_tier: decrypted.ops?.capture_policy_tier || "review_required",
        capture_status: decrypted.ops?.capture_status || "not_requested",
        recapture_reason: decrypted.ops?.recapture_reason || null,
        quote_status: decrypted.ops?.quote_status || "not_started",
        next_step: decrypted.ops?.next_step || null,
        last_buyer_ready_at: normalizeTimestamp(decrypted.ops?.last_buyer_ready_at),
        proof_path: normalizeProofPathMilestones(decrypted.ops?.proof_path),
      },
      context: {
        sourcePageUrl: decrypted.context.sourcePageUrl,
        referrer: decrypted.context.referrer || null,
        demandCity: decrypted.context.demandCity || null,
        buyerChannelSource: decrypted.context.buyerChannelSource || null,
        buyerChannelSourceCaptureMode:
          decrypted.context.buyerChannelSourceCaptureMode || null,
        buyerChannelSourceRaw: decrypted.context.buyerChannelSourceRaw || null,
        utm: decrypted.context.utm,
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to load request" });
  }
});

export default router;
