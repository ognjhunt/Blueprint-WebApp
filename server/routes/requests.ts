import { Request, Response, Router } from "express";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";

const router = Router();

router.get("/:requestId", async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
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
      },
      pipeline: decrypted.pipeline || null,
      derived_assets: decrypted.derived_assets || null,
      deployment_readiness: decrypted.deployment_readiness || null,
    });
  } catch {
    return res.status(500).json({ error: "Failed to load request" });
  }
});

export default router;
