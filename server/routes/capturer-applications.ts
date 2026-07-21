import { Request, Response, Router } from "express";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";

const router = Router();

/**
 * Capturer application review (audit fix P2-G).
 *
 * CapturerSignUpFlow writes users/{uid} with
 * capturerApplicationStatus: "pending_review" and nothing previously flipped
 * that status. These endpoints give admins/ops a read path over the stored
 * application fields and a decision path that records approval/rejection.
 * Everything returned is read from stored fields; nothing is synthesized.
 */

const APPLICATION_STATUSES = ["pending_review", "approved", "rejected"] as const;

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(2000).optional(),
});

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

function normalizeApplication(uid: string, raw: Record<string, unknown> | undefined) {
  const data = raw || {};
  return {
    uid,
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : typeof data.name === "string"
          ? data.name
          : "",
    email: typeof data.email === "string" ? data.email : "",
    market: typeof data.capturerMarket === "string" ? data.capturerMarket : "",
    equipment: Array.isArray(data.capturerEquipment)
      ? data.capturerEquipment.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    availability:
      typeof data.capturerAvailability === "string" ? data.capturerAvailability : "",
    referralSource:
      typeof data.capturerReferralSource === "string"
        ? data.capturerReferralSource
        : null,
    status:
      typeof data.capturerApplicationStatus === "string"
        ? data.capturerApplicationStatus
        : "unknown",
    appliedAt: normalizeTimestamp(data.createdDate),
    reviewedAt: normalizeTimestamp(data.capturerReviewedAt),
    reviewedBy:
      typeof data.capturerReviewedBy === "string" ? data.capturerReviewedBy : null,
    reviewNote:
      typeof data.capturerReviewNote === "string" ? data.capturerReviewNote : null,
  };
}

type NormalizedApplication = ReturnType<typeof normalizeApplication>;

function sortApplications(applications: NormalizedApplication[]) {
  return [...applications].sort((left, right) => {
    const leftPending = left.status === "pending_review" ? 0 : 1;
    const rightPending = right.status === "pending_review" ? 0 : 1;
    if (leftPending !== rightPending) {
      return leftPending - rightPending;
    }
    const leftTime = Date.parse(left.appliedAt || "");
    const rightTime = Date.parse(right.appliedAt || "");
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return 0;
    }
    if (Number.isNaN(leftTime)) {
      return 1;
    }
    if (Number.isNaN(rightTime)) {
      return -1;
    }
    return rightTime - leftTime;
  });
}

/**
 * GET /api/admin/capturer-applications
 * List users that have a capturer application on record, pending first.
 * Firestore has no "field exists" query, so we fetch each known status value
 * with a simple single-field equality query (index-friendly) and merge.
 */
router.get("/", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const firestore = db;
    if (!firestore) {
      return res.status(500).json({ ok: false, error: "Database not available" });
    }

    const limitNum = Math.min(
      Math.max(
        parseInt(typeof req.query.limit === "string" ? req.query.limit : "100", 10) ||
          100,
        1,
      ),
      200,
    );

    const snapshots = await Promise.all(
      APPLICATION_STATUSES.map((status) =>
        firestore
          .collection("users")
          .where("capturerApplicationStatus", "==", status)
          .limit(limitNum)
          .get(),
      ),
    );

    const applications = sortApplications(
      snapshots.flatMap((snapshot) =>
        snapshot.docs.map((doc) =>
          normalizeApplication(doc.id, doc.data() as Record<string, unknown>),
        ),
      ),
    );

    return res.json({ ok: true, applications });
  } catch (error) {
    logger.error({ error }, "Error listing capturer applications");
    return res
      .status(500)
      .json({ ok: false, error: "Failed to list capturer applications" });
  }
});

/**
 * POST /api/admin/capturer-applications/:uid/decision
 * Body: { decision: "approved" | "rejected", note?: string }
 * Records the review outcome on users/{uid}: status, server-timestamped
 * reviewedAt, reviewing admin uid, and an optional note.
 */
router.post(
  "/:uid/decision",
  requireAdminRole,
  async (req: Request, res: Response) => {
    let payload: z.infer<typeof decisionSchema>;
    try {
      payload = decisionSchema.parse(req.body ?? {});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid decision payload";
      return res.status(400).json({ ok: false, error: message });
    }

    try {
      if (!db) {
        return res.status(500).json({ ok: false, error: "Database not available" });
      }

      const uid = req.params.uid?.trim();
      if (!uid) {
        return res.status(400).json({ ok: false, error: "Missing user id" });
      }

      const userRef = db.collection("users").doc(uid);
      const snapshot = await userRef.get();
      const data = snapshot.exists
        ? (snapshot.data() as Record<string, unknown> | undefined)
        : undefined;

      if (!snapshot.exists || typeof data?.capturerApplicationStatus !== "string") {
        return res
          .status(404)
          .json({ ok: false, error: "Capturer application not found" });
      }

      const reviewer = res.locals.firebaseUser as
        | { uid?: unknown; email?: unknown }
        | undefined;
      const reviewedBy =
        typeof reviewer?.uid === "string" && reviewer.uid.trim()
          ? reviewer.uid.trim()
          : typeof reviewer?.email === "string" && reviewer.email.trim()
            ? reviewer.email.trim()
            : "unknown-admin";

      const note = payload.note?.trim();
      await userRef.update({
        capturerApplicationStatus: payload.decision,
        capturerReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        capturerReviewedBy: reviewedBy,
        ...(note ? { capturerReviewNote: note } : {}),
      });

      const updated = await userRef.get();
      return res.json({
        ok: true,
        application: normalizeApplication(
          uid,
          updated.data() as Record<string, unknown> | undefined,
        ),
      });
    } catch (error) {
      logger.error(
        { error, uid: req.params.uid },
        "Error recording capturer application decision",
      );
      return res
        .status(500)
        .json({ ok: false, error: "Failed to record capturer decision" });
    }
  },
);

export default router;
