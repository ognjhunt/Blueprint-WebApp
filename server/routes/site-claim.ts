/**
 * The public half of "claim your site": what a claim link points at.
 *
 * The claim link arrives by email to an operator who may never have signed
 * in. Before asking them to, the page shows what they would be claiming —
 * the site, the task, where the scene stands. This route is the read: token
 * in the path is the credential, so it returns only what the claim page
 * needs and nothing that would help a guessed token enumerate requests.
 * The attach itself is `POST /api/workspace/claim`, behind Firebase auth.
 */
import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { verifySiteClaimToken } from "../utils/request-review-auth";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import { logger } from "../logger";
import { isCurrentLegalAcceptance } from "../../client/src/lib/legalAcceptance";

const router = Router();

router.get(
  "/:token",
  async (req: Request, res: Response) => {
    const payload = verifySiteClaimToken(String(req.params.token || ""));
    if (!payload || !db) {
      return res.status(404).json({ error: "This claim link is not valid or has expired." });
    }

    const snap = await db.collection("inboundRequests").doc(payload.requestId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "This claim link is not valid or has expired." });
    }

    try {
      const record = (await decryptInboundRequestForAdmin(
        snap.data() as never,
      )) as Record<string, any>;
      const request = (record.request ?? {}) as Record<string, any>;
      return res.json({
        ok: true,
        requestId: payload.requestId,
        alreadyClaimed: Boolean(record.account_owner_uid),
        // The address the invite was sent to, so the sign-in form can prefill
        // it — the holder of a valid link received that email anyway.
        claimEmail: typeof record.contact?.email === "string" ? record.contact.email : null,
        siteTermsAcceptedCurrent: isCurrentLegalAcceptance(record.terms_acceptance),
        site: {
          siteName: request.siteName || null,
          siteLocation: request.siteLocation || null,
          taskStatement: request.taskStatement || null,
          qualificationState: record.qualification_state || null,
        },
      });
    } catch (error) {
      logger.warn({ error, requestId: payload.requestId }, "Could not read a claim summary");
      return res.status(503).json({ error: "We could not load that right now. Try again shortly." });
    }
  },
);

export default router;
