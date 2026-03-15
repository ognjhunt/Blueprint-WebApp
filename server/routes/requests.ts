import { Request, Response, Router } from "express";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";
import {
  getRequestReviewCookieName,
  verifyRequestReviewToken,
} from "../utils/request-review-auth";
import { parseCookies } from "../utils/hosted-session-ui-auth";

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
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to load request" });
  }
});

export default router;
