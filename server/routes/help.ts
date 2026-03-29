import { Request, Response, Router } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { processSimpleReschedule } from "../utils/field-ops-automation";
import { isValidEmailAddress } from "../utils/validation";

const router = Router();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

router.post("/reschedule", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body?.email);
  const businessName =
    typeof req.body?.businessName === "string" ? req.body.businessName.trim() : "";
  const requestedDate =
    typeof req.body?.requested_date === "string" ? req.body.requested_date.trim() : "";
  const requestedTime =
    typeof req.body?.requested_time === "string" ? req.body.requested_time.trim() : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

  if (!name || !email || !requestedDate || !requestedTime || !reason) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  if (!isValidEmailAddress(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const snapshot = await db
    .collection("bookings")
    .where("email", "==", email)
    .limit(10)
    .get();

  const matches = snapshot.docs.filter((doc) => {
    if (!businessName) {
      return true;
    }
    const data = doc.data() as Record<string, unknown>;
    return (
      typeof data.businessName === "string"
      && data.businessName.trim().toLowerCase() === businessName.toLowerCase()
    );
  });

  if (matches.length === 1) {
    const result = await processSimpleReschedule({
      bookingId: matches[0].id,
      requestedDate,
      requestedTime,
      requestedBy: "buyer",
      reason: [reason, notes].filter(Boolean).join(" | "),
      triggeredBy: `buyer:${email}`,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      routing: "booking",
      result,
    });
  }

  const requestId = `help_reschedule_${Date.now()}`;
  await db.collection("contactRequests").doc(requestId).set({
    name,
    email,
    company: businessName || "",
    message:
      `Customer requested a reschedule to ${requestedDate} at ${requestedTime}.\n` +
      `Reason: ${reason}\n` +
      (notes ? `Notes: ${notes}` : ""),
    requestSource: "help_reschedule",
    summary:
      `${name} requested a mapping reschedule to ${requestedDate} ${requestedTime}. ` +
      `Booking matches found: ${matches.length}.`,
    ops_automation: {
      status: "pending",
      queue: "support_triage",
      intent: "support_triage",
      next_action: "triage help center reschedule request",
      requested_date: requestedDate,
      requested_time: requestedTime,
      requested_reason: reason,
      booking_match_count: matches.length,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(HTTP_STATUS.ACCEPTED).json({
    success: true,
    routing: "support_queue",
    message: "The reschedule request was queued for manual review.",
  });
});

export default router;
