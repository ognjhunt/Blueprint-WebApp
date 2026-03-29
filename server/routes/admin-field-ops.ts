import { Request, Response, Router } from "express";

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
  sendCapturerCommunication,
  sendSiteAccessOutreach,
  updateFinanceReview,
  updateSiteAccessStatus,
} from "../utils/field-ops-automation";

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
        operatorName:
          typeof req.body?.operator_name === "string" ? req.body.operator_name.trim() : null,
        operatorEmail:
          typeof req.body?.operator_email === "string" ? req.body.operator_email.trim() : null,
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
