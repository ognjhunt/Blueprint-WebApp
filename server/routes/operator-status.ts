import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";

const router = Router();

function toIso(value: unknown) {
  const candidate = value as { toDate?: () => Date } | string | null | undefined;
  if (!candidate) return null;
  if (typeof candidate === "string") return candidate;
  return candidate.toDate?.()?.toISOString?.() || null;
}

router.get("/current", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Database not available" });
  const uid = String(res.locals.firebaseUser?.uid || "").trim();
  if (!uid) return res.status(401).json({ error: "Authentication required" });

  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) return res.status(404).json({ error: "Operator account not found" });
  const user = (userSnapshot.data() || {}) as Record<string, unknown>;
  if (String(user.buyerType || "") !== "site_operator") {
    return res.status(403).json({ error: "Site-operator account required" });
  }

  const requestId = String(user.structuredIntakeRequestId || "").trim();
  if (!requestId) {
    return res.json({ ok: true, request: null, proof_boundary: "No operator intake record is linked to this account." });
  }
  const requestSnapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!requestSnapshot.exists) {
    return res.json({ ok: true, request: null, request_id: requestId, proof_boundary: "The linked operator intake record has not been stored." });
  }

  const record = (await decryptInboundRequestForAdmin(
    requestSnapshot.data() as InboundRequestStored,
  )) as unknown as InboundRequest;
  return res.json({
    ok: true,
    request: {
      request_id: record.requestId || requestId,
      site_name: record.request?.siteName || null,
      site_location: record.request?.siteLocation || null,
      site_type: record.request?.targetSiteType || null,
      workflow: record.request?.taskStatement || null,
      qualification_state: record.qualification_state || record.status || "submitted",
      opportunity_state: record.opportunity_state || "not_applicable",
      rights_status: record.ops?.rights_status || "unknown",
      capture_status: record.ops?.capture_status || "not_requested",
      quote_status: record.ops?.quote_status || "not_started",
      next_step: record.ops?.next_step || null,
      access_boundary_outcome: record.structured_intake?.access_boundary_outcome || null,
      site_claim_outcome: record.structured_intake?.site_operator_claim_outcome || null,
      created_at: toIso(record.createdAt),
      updated_at: null,
    },
    proof_boundary:
      "This surface reports the linked operator intake and ops record. It does not invent active buyer demand, approved rights, completed capture, payment, payout, or deployment.",
  });
});

export default router;
