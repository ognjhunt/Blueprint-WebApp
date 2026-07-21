import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

import { hasAnyRole, resolveAccessContext } from "../utils/access-control";
import {
  assignCapturerToCaptureJob,
  discoverSiteAccessContacts,
  listCapturerCandidates,
  listFieldOpsCaptureJobs,
  listFinanceQueue,
  listRescheduleQueue,
  processSimpleReschedule,
  runCapturerReminderLoop,
  runManualReviewWatchdogLoop,
  saveSiteAccessContact,
  sendCapturerCommunication,
  sendSiteAccessOutreach,
  updateFinanceReview,
  updateSiteAccessStatus,
} from "../utils/field-ops-automation";
import { dispatchTransactionalNotification } from "../utils/transactional-notifications";

const router = Router();

async function requireOps(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    return res.status(403).json({ error: "Ops access required" });
  }

  next();
}

async function operatorEmail(res: Response) {
  const access = await resolveAccessContext(res);
  return access.email || "ops@tryblueprint.io";
}

const CAPTURER_REVIEW_STATUSES = new Set([
  "pending_review",
  "future_city_waitlist",
  "approved",
  "rejected",
  "paused",
]);

function isoTimestamp(value: unknown) {
  const candidate = value as { toDate?: () => Date } | string | null | undefined;
  if (!candidate) return null;
  if (typeof candidate === "string") return candidate;
  return candidate.toDate?.()?.toISOString?.() || null;
}

router.get("/capturer-applications", requireOps, async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ error: "Database not available" });
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const snapshot = await db.collection("users").where("role", "==", "capturer").limit(200).get();
  const applications = (snapshot.docs || [])
    .map((doc) => {
      const data = (doc.data() || {}) as Record<string, unknown>;
      return {
        id: doc.id,
        name: String(data.name || data.displayName || "Capturer applicant"),
        email: String(data.email || ""),
        market: String(data.capturerMarket || ""),
        equipment: Array.isArray(data.capturerEquipment) ? data.capturerEquipment : [],
        availability: String(data.capturerAvailability || ""),
        application_status: String(data.capturerApplicationStatus || "pending_review"),
        submitted_at: isoTimestamp(data.createdAt || data.created_at || data.createdDate),
        reviewed_at: isoTimestamp(data.capturerReviewedAt),
        review_note: String(data.capturerReviewNote || ""),
      };
    })
    .filter((application) => !status || application.application_status === status)
    .sort((left, right) => String(right.submitted_at || "").localeCompare(String(left.submitted_at || "")));
  return res.json({ applications, count: applications.length });
});

router.patch(
  "/capturer-applications/:userId",
  requireOps,
  async (req: Request, res: Response) => {
    if (!db) return res.status(503).json({ error: "Database not available" });
    const userId = String(req.params.userId || "").trim();
    const status = String(req.body?.status || "").trim();
    const reviewNote = String(req.body?.review_note || "").trim().slice(0, 1000);
    if (!userId || !CAPTURER_REVIEW_STATUSES.has(status)) {
      return res.status(400).json({ error: "Valid capturer user id and review status are required" });
    }

    const userRef = db.collection("users").doc(userId);
    const snapshot = await userRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: "Capturer application not found" });
    const existing = (snapshot.data() || {}) as Record<string, unknown>;
    if (String(existing.role || "") !== "capturer") {
      return res.status(409).json({ error: "User is not a capturer applicant" });
    }

    const reviewedAt = new Date().toISOString();
    const reviewedBy = await operatorEmail(res);
    await userRef.set(
      {
        capturerApplicationStatus: status,
        capturerReviewNote: reviewNote || null,
        capturerReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        capturerReviewedBy: reviewedBy,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (status === "approved" || status === "rejected") {
      await dispatchTransactionalNotification({
        eventType: status === "approved" ? "capturer_application_approved" : "capturer_application_rejected",
        recipientType: "creator",
        recipientUserId: userId,
        recipientEmail: typeof existing.email === "string" ? existing.email : null,
        subjectId: userId,
        sourceEventId: `capturer-application:${userId}:${status}:${reviewedAt}`,
        sourceCollection: "users",
        sourceDocId: userId,
        title: status === "approved" ? "Capturer application approved" : "Capturer application update",
        body:
          status === "approved"
            ? "Your capturer application is approved. Open Capture Access to review assignment and payout setup."
            : "Your capturer application was reviewed. Open Capture Access for the recorded status and next step.",
        emailSubject:
          status === "approved"
            ? "Your Blueprint capturer application is approved"
            : "Update on your Blueprint capturer application",
        emailText:
          status === "approved"
            ? "Your capturer application is approved. Sign in to Blueprint and open Capture Access to review assignment and payout setup."
            : "Your capturer application was reviewed. Sign in to Blueprint and open Capture Access for the recorded status and next step.",
        preferenceKey: "account",
        data: { application_status: status, reviewed_by: reviewedBy },
      });
    }

    return res.json({ ok: true, user_id: userId, application_status: status, reviewed_at: reviewedAt });
  },
);

router.get("/capture-jobs", requireOps, async (req: Request, res: Response) => {
  try {
    const jobs = await listFieldOpsCaptureJobs({
      limit:
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || undefined : undefined,
      status: typeof req.query.status === "string" ? req.query.status : null,
    });

    return res.json({ jobs });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list capture jobs",
    });
  }
});

router.get(
  "/capture-jobs/:captureJobId/candidates",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      if (!captureJobId) {
        return res.status(400).json({ error: "Missing capture job id" });
      }

      const candidates = await listCapturerCandidates(captureJobId);
      return res.json({ candidates });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list capturer candidates",
      });
    }
  },
);

router.post(
  "/capture-jobs/:captureJobId/assign-capturer",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      const creatorId = typeof req.body?.creator_id === "string" ? req.body.creator_id.trim() : "";
      if (!captureJobId || !creatorId) {
        return res.status(400).json({ error: "Missing capture job id or creator_id" });
      }

      const result = await assignCapturerToCaptureJob({
        captureJobId,
        creatorId,
        sendConfirmation: req.body?.send_confirmation === true,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        assignedBy: await operatorEmail(res),
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to assign capturer",
      });
    }
  },
);

router.get(
  "/capture-jobs/:captureJobId/site-access/contacts",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      if (!captureJobId) {
        return res.status(400).json({ error: "Missing capture job id" });
      }

      const contacts = await discoverSiteAccessContacts(captureJobId);
      return res.json({ contacts });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to discover site-access contacts",
      });
    }
  },
);

router.post(
  "/capture-jobs/:captureJobId/site-access/contacts",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      if (!captureJobId || !email) {
        return res.status(400).json({ error: "Missing capture job id or email" });
      }

      const result = await saveSiteAccessContact({
        captureJobId,
        email,
        name: typeof req.body?.name === "string" ? req.body.name.trim() : null,
        company: typeof req.body?.company === "string" ? req.body.company.trim() : null,
        roleTitle: typeof req.body?.role_title === "string" ? req.body.role_title.trim() : null,
        phoneNumber:
          typeof req.body?.phone_number === "string" ? req.body.phone_number.trim() : null,
        source: typeof req.body?.source === "string" ? req.body.source.trim() : "manual_entry",
        verificationStatus:
          typeof req.body?.verification_status === "string"
            ? req.body.verification_status.trim()
            : null,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save site-access contact",
      });
    }
  },
);

router.post(
  "/capture-jobs/:captureJobId/capturer-comms",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      if (!captureJobId) {
        return res.status(400).json({ error: "Missing capture job id" });
      }

      const communicationType = String(req.body?.communication_type || "").trim();
      if (
        ![
          "confirmation",
          "reminder_48h",
          "reminder_24h",
          "reschedule_notice",
          "custom",
        ].includes(communicationType)
      ) {
        return res.status(400).json({ error: "Invalid communication_type" });
      }

      const result = await sendCapturerCommunication({
        captureJobId,
        communicationType: communicationType as
          | "confirmation"
          | "reminder_48h"
          | "reminder_24h"
          | "reschedule_notice"
          | "custom",
        creatorId:
          typeof req.body?.creator_id === "string" ? req.body.creator_id.trim() : null,
        subject: typeof req.body?.subject === "string" ? req.body.subject : null,
        body: typeof req.body?.body === "string" ? req.body.body : null,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        triggeredBy: await operatorEmail(res),
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to send capturer communication",
      });
    }
  },
);

router.post(
  "/bookings/:bookingId/reschedule",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.bookingId?.trim();
      const requestedDate =
        typeof req.body?.requested_date === "string" ? req.body.requested_date.trim() : "";
      const requestedTime =
        typeof req.body?.requested_time === "string" ? req.body.requested_time.trim() : "";

      if (!bookingId || !requestedDate || !requestedTime) {
        return res.status(400).json({ error: "Missing booking id, requested_date, or requested_time" });
      }

      const result = await processSimpleReschedule({
        bookingId,
        requestedDate,
        requestedTime,
        requestedBy:
          req.body?.requested_by === "capturer"
            ? "capturer"
            : req.body?.requested_by === "operator"
              ? "operator"
              : "buyer",
        reason: typeof req.body?.reason === "string" ? req.body.reason : null,
        triggeredBy: await operatorEmail(res),
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to process reschedule",
      });
    }
  },
);

router.post(
  "/capture-jobs/:captureJobId/site-access/outreach",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      const operatorEmailValue =
        typeof req.body?.operator_email === "string" ? req.body.operator_email.trim() : "";

      if (!captureJobId || !operatorEmailValue) {
        return res.status(400).json({ error: "Missing capture job id or operator_email" });
      }

      const result = await sendSiteAccessOutreach({
        captureJobId,
        operatorEmail: operatorEmailValue,
        operatorName:
          typeof req.body?.operator_name === "string" ? req.body.operator_name.trim() : null,
        operatorCompany:
          typeof req.body?.operator_company === "string"
            ? req.body.operator_company.trim()
            : null,
        operatorRoleTitle:
          typeof req.body?.operator_role_title === "string"
            ? req.body.operator_role_title.trim()
            : null,
        operatorPhoneNumber:
          typeof req.body?.operator_phone_number === "string"
            ? req.body.operator_phone_number.trim()
            : null,
        source: typeof req.body?.source === "string" ? req.body.source.trim() : null,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        triggeredBy: await operatorEmail(res),
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to send site-access outreach",
      });
    }
  },
);

router.patch(
  "/capture-jobs/:captureJobId/site-access/status",
  requireOps,
  async (req: Request, res: Response) => {
    try {
      const captureJobId = req.params.captureJobId?.trim();
      const status = String(req.body?.status || "").trim() as
        | "not_started"
        | "awaiting_response"
        | "granted"
        | "denied"
        | "conditional"
        | "review_required";

      if (
        !captureJobId
        || ![
          "not_started",
          "awaiting_response",
          "granted",
          "denied",
          "conditional",
          "review_required",
        ].includes(status)
      ) {
        return res.status(400).json({ error: "Invalid capture job id or status" });
      }

      await updateSiteAccessStatus({
        captureJobId,
        status,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        decisionSummary:
          typeof req.body?.decision_summary === "string" ? req.body.decision_summary : null,
        operatorName:
          typeof req.body?.operator_name === "string" ? req.body.operator_name.trim() : null,
        operatorEmail:
          typeof req.body?.operator_email === "string" ? req.body.operator_email.trim() : null,
        operatorCompany:
          typeof req.body?.operator_company === "string"
            ? req.body.operator_company.trim()
            : null,
        operatorRoleTitle:
          typeof req.body?.operator_role_title === "string"
            ? req.body.operator_role_title.trim()
            : null,
        operatorPhoneNumber:
          typeof req.body?.operator_phone_number === "string"
            ? req.body.operator_phone_number.trim()
            : null,
        verificationStatus:
          typeof req.body?.verification_status === "string"
            ? req.body.verification_status.trim()
            : null,
        restrictions: Array.isArray(req.body?.restrictions)
          ? req.body.restrictions.filter((value: unknown): value is string => typeof value === "string")
          : null,
        requiredEvidence: Array.isArray(req.body?.required_evidence)
          ? req.body.required_evidence.filter(
              (value: unknown): value is string => typeof value === "string",
            )
          : null,
        followUpBy:
          typeof req.body?.follow_up_by === "string" ? req.body.follow_up_by.trim() : null,
        updatedBy: await operatorEmail(res),
      });

      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update site-access status",
      });
    }
  },
);

router.post("/automation/capturer-reminders/run", requireOps, async (req: Request, res: Response) => {
  try {
    const result = await runCapturerReminderLoop({
      limit:
        typeof req.body?.limit === "number" && Number.isFinite(req.body.limit)
          ? req.body.limit
          : undefined,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run capturer reminders",
    });
  }
});

router.post("/automation/manual-review-watchdogs/run", requireOps, async (req: Request, res: Response) => {
  try {
    const result = await runManualReviewWatchdogLoop({
      limit:
        typeof req.body?.limit === "number" && Number.isFinite(req.body.limit)
          ? req.body.limit
          : undefined,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run overdue review watchdogs",
    });
  }
});

router.get("/reschedule-queue", requireOps, async (req: Request, res: Response) => {
  try {
    const items = await listRescheduleQueue({
      limit:
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || undefined : undefined,
    });

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list reschedule queue",
    });
  }
});

router.get("/finance-queue", requireOps, async (req: Request, res: Response) => {
  try {
    const items = await listFinanceQueue({
      limit:
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || undefined : undefined,
    });

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list finance queue",
    });
  }
});

router.patch("/finance-queue/:payoutId", requireOps, async (req: Request, res: Response) => {
  try {
    const payoutId = req.params.payoutId?.trim();
    const reviewStatus = String(req.body?.review_status || "").trim() as
      | "pending_human_review"
      | "investigating"
      | "ready_for_manual_action"
      | "waiting_on_creator"
      | "resolved";
    const nextAction = typeof req.body?.next_action === "string" ? req.body.next_action.trim() : "";

    if (!payoutId || !reviewStatus || !nextAction) {
      return res.status(400).json({ error: "Missing payout id, review_status, or next_action" });
    }

    const result = await updateFinanceReview({
      payoutId,
      reviewStatus,
      nextAction,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      responseDraft: typeof req.body?.response_draft === "string" ? req.body.response_draft : null,
      ownerEmail:
        typeof req.body?.owner_email === "string" ? req.body.owner_email.trim() : null,
      slaDueAt:
        typeof req.body?.sla_due_at === "string" ? req.body.sla_due_at.trim() : null,
      manualActionType:
        typeof req.body?.manual_action_type === "string"
          ? req.body.manual_action_type.trim()
          : null,
      requiredEvidence: Array.isArray(req.body?.required_evidence)
        ? req.body.required_evidence.filter(
            (value: unknown): value is string => typeof value === "string",
          )
        : null,
      humanOnlyNote:
        typeof req.body?.human_only_note === "string" ? req.body.human_only_note : null,
      updatedBy: await operatorEmail(res),
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update finance review",
    });
  }
});

export default router;
