import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  decryptFieldValue,
  decryptInboundRequestForAdmin,
  encryptFieldValue,
} from "../utils/field-encryption";
import type {
  InboundRequest,
  InboundRequestStored,
  RequestStatus,
  InboundRequestListItem,
  UpdateRequestStatusPayload,
  AssignRequestOwnerPayload,
  AddRequestNotePayload,
} from "../types/inbound-request";

const router = Router();

// Admin email allowlist (in production, use Firebase Custom Claims)
const ADMIN_EMAILS = [
  "ohstnhunt@gmail.com",
  "ops@tryblueprint.io",
];

/**
 * Middleware to check if user is admin
 */
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Check if user email is in admin list
  if (!ADMIN_EMAILS.includes(user.email || "")) {
    // Also check for admin custom claim
    if (!user.admin) {
      logger.warn(
        { email: user.email },
        "Non-admin user attempted to access admin routes"
      );
      return res.status(403).json({ error: "Admin access required" });
    }
  }

  next();
}

/**
 * GET /api/admin/leads
 * List all inbound requests with pagination and filtering
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const {
      status,
      priority,
      limit = "50",
      startAfter,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let query = db.collection("inboundRequests") as FirebaseFirestore.Query;

    // Apply filters
    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    if (priority && typeof priority === "string") {
      query = query.where("priority", "==", priority);
    }

    // Apply sorting
    const validSortFields = ["createdAt", "priority", "status"];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : "createdAt";
    const order = sortOrder === "asc" ? "asc" : "desc";
    query = query.orderBy(sortField, order);

    // Apply pagination
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    if (startAfter && typeof startAfter === "string") {
      const startDoc = await db
        .collection("inboundRequests")
        .doc(startAfter)
        .get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();

    const leads = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as InboundRequestStored;
        const decrypted = await decryptInboundRequestForAdmin(data);
        return {
          requestId: decrypted.requestId,
          createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
          status: decrypted.status,
          priority: decrypted.priority,
          contact: {
            firstName: decrypted.contact.firstName,
            lastName: decrypted.contact.lastName,
            email: decrypted.contact.email,
            company: decrypted.contact.company,
          },
          request: {
            budgetBucket: decrypted.request.budgetBucket,
            helpWith: decrypted.request.helpWith,
          },
          owner: decrypted.owner,
        } satisfies InboundRequestListItem;
      })
    );

    // Get total count for pagination info
    const countQuery = db.collection("inboundRequests");
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    return res.json({
      leads,
      pagination: {
        total: totalCount,
        limit: limitNum,
        hasMore: leads.length === limitNum,
        lastId: leads.length > 0 ? leads[leads.length - 1].requestId : null,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching leads");
    return res.status(500).json({ error: "Failed to fetch leads" });
  }
});

/**
 * GET /api/admin/leads/:requestId
 * Get full details for a specific request
 */
router.get("/:requestId", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const doc = await db.collection("inboundRequests").doc(requestId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const data = doc.data() as InboundRequestStored;
    const decrypted = await decryptInboundRequestForAdmin(data);

    // Get notes subcollection
    const notesSnapshot = await db
      .collection("inboundRequests")
      .doc(requestId)
      .collection("notes")
      .orderBy("createdAt", "desc")
      .get();

    const notes = await Promise.all(
      notesSnapshot.docs.map(async (noteDoc) => {
        const noteData = noteDoc.data();
        return {
          id: noteDoc.id,
          content: await decryptFieldValue(noteData.content),
          authorUid: noteData.authorUid,
          authorEmail: noteData.authorEmail,
          createdAt: noteData.createdAt?.toDate?.()?.toISOString() || "",
        };
      })
    );

    return res.json({
      requestId: decrypted.requestId,
      createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
      status: decrypted.status,
      priority: decrypted.priority,
      contact: {
        firstName: decrypted.contact.firstName,
        lastName: decrypted.contact.lastName,
        email: decrypted.contact.email,
        company: decrypted.contact.company,
        roleTitle: decrypted.contact.roleTitle,
      },
      request: {
        budgetBucket: decrypted.request.budgetBucket,
        helpWith: decrypted.request.helpWith,
        details: decrypted.request.details,
      },
      owner: decrypted.owner,
      context: {
        sourcePageUrl: decrypted.context.sourcePageUrl,
        referrer: decrypted.context.referrer,
        utm: decrypted.context.utm,
      },
      enrichment: decrypted.enrichment,
      events: {
        confirmationEmailSentAt:
          decrypted.events.confirmationEmailSentAt?.toDate?.()?.toISOString() ||
          null,
        slackNotifiedAt:
          decrypted.events.slackNotifiedAt?.toDate?.()?.toISOString() || null,
        crmSyncedAt:
          decrypted.events.crmSyncedAt?.toDate?.()?.toISOString() || null,
      },
      notes,
    });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error fetching lead detail");
    return res.status(500).json({ error: "Failed to fetch lead details" });
  }
});

/**
 * PATCH /api/admin/leads/:requestId/status
 * Update the status of a request
 */
router.patch(
  "/:requestId/status",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const { requestId } = req.params;
      const { status, note } = req.body as UpdateRequestStatusPayload;
      const user = (req as any).user;

      const validStatuses: RequestStatus[] = [
        "new",
        "triaging",
        "scheduled",
        "qualified",
        "disqualified",
        "closed",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const docRef = db.collection("inboundRequests").doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Request not found" });
      }
      const previousStatus = (doc.data() as InboundRequest).status;

      // Update status
      await docRef.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (previousStatus !== status) {
        await db
          .collection("stats")
          .doc("inboundRequests")
          .set(
            {
              [`byStatus.${previousStatus}`]:
                admin.firestore.FieldValue.increment(-1),
              [`byStatus.${status}`]: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }

      // Add note if provided
      if (note && note.trim()) {
        const encryptedContent = await encryptFieldValue(
          `Status changed to "${status}": ${note.trim()}`
        );
        await docRef.collection("notes").add({
          content: encryptedContent,
          authorUid: user.uid || null,
          authorEmail: user.email || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      logger.info({ requestId, status, by: user.email }, "Lead status updated");

      return res.json({ ok: true, status });
    } catch (error) {
      logger.error(
        { error, requestId: req.params.requestId },
        "Error updating lead status"
      );
      return res.status(500).json({ error: "Failed to update status" });
    }
  }
);

/**
 * PATCH /api/admin/leads/:requestId/owner
 * Assign an owner to a request
 */
router.patch(
  "/:requestId/owner",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const { requestId } = req.params;
      const { owner } = req.body as AssignRequestOwnerPayload;
      const user = (req as any).user;

      const docRef = db.collection("inboundRequests").doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Request not found" });
      }

      await docRef.update({
        owner: {
          uid: owner.uid || null,
          email: owner.email || null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Add note about assignment
      const encryptedContent = await encryptFieldValue(
        `Owner assigned: ${owner.email || owner.uid || "Unassigned"}`
      );
      await docRef.collection("notes").add({
        content: encryptedContent,
        authorUid: user.uid || null,
        authorEmail: user.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        { requestId, owner, by: user.email },
        "Lead owner assigned"
      );

      return res.json({ ok: true, owner });
    } catch (error) {
      logger.error(
        { error, requestId: req.params.requestId },
        "Error assigning lead owner"
      );
      return res.status(500).json({ error: "Failed to assign owner" });
    }
  }
);

/**
 * POST /api/admin/leads/:requestId/notes
 * Add a note to a request
 */
router.post(
  "/:requestId/notes",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const { requestId } = req.params;
      const { content } = req.body as AddRequestNotePayload;
      const user = (req as any).user;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Note content is required" });
      }

      const docRef = db.collection("inboundRequests").doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Request not found" });
      }

      const encryptedContent = await encryptFieldValue(content.trim());
      const noteRef = await docRef.collection("notes").add({
        content: encryptedContent,
        authorUid: user.uid || null,
        authorEmail: user.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info({ requestId, noteId: noteRef.id, by: user.email }, "Note added to lead");

      return res.json({
        ok: true,
        note: {
          id: noteRef.id,
          content: content.trim(),
          authorUid: user.uid || null,
          authorEmail: user.email || null,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(
        { error, requestId: req.params.requestId },
        "Error adding note"
      );
      return res.status(500).json({ error: "Failed to add note" });
    }
  }
);

/**
 * GET /api/admin/leads/stats
 * Get summary statistics for the dashboard
 */
router.get("/stats/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const statsSnapshot = await db
      .collection("stats")
      .doc("inboundRequests")
      .get();
    const statsData = statsSnapshot.exists ? statsSnapshot.data() ?? {} : {};

    const statusCounts: Record<string, number> = {
      new: statsData.byStatus?.new ?? 0,
      triaging: statsData.byStatus?.triaging ?? 0,
      scheduled: statsData.byStatus?.scheduled ?? 0,
      qualified: statsData.byStatus?.qualified ?? 0,
      disqualified: statsData.byStatus?.disqualified ?? 0,
      closed: statsData.byStatus?.closed ?? 0,
    };

    const priorityCounts: Record<string, number> = {
      high: statsData.byPriority?.high ?? 0,
      normal: statsData.byPriority?.normal ?? 0,
      low: statsData.byPriority?.low ?? 0,
    };

    // Get new leads from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentSnapshot = await db
      .collection("inboundRequests")
      .where("createdAt", ">=", oneDayAgo)
      .count()
      .get();
    const newLast24h = recentSnapshot.data().count;

    const total = statsData.total ?? 0;

    return res.json({
      total,
      newLast24h,
      byStatus: statusCounts,
      byPriority: priorityCounts,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching lead stats");
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * GET /api/admin/leads/export
 * Export leads as CSV
 */
router.get("/export/csv", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { status, startDate, endDate } = req.query;

    let query = db.collection("inboundRequests") as FirebaseFirestore.Query;

    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    if (startDate && typeof startDate === "string") {
      query = query.where("createdAt", ">=", new Date(startDate));
    }

    if (endDate && typeof endDate === "string") {
      query = query.where("createdAt", "<=", new Date(endDate));
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Build CSV
    const headers = [
      "Request ID",
      "Created At",
      "Status",
      "Priority",
      "First Name",
      "Last Name",
      "Email",
      "Company",
      "Role",
      "Budget",
      "Products",
      "Details",
      "Source URL",
      "Owner Email",
    ];

    const rows = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as InboundRequestStored;
        const decrypted = await decryptInboundRequestForAdmin(data);
        return [
          decrypted.requestId,
          decrypted.createdAt?.toDate?.()?.toISOString() || "",
          decrypted.status,
          decrypted.priority,
          decrypted.contact.firstName,
          decrypted.contact.lastName,
          decrypted.contact.email,
          decrypted.contact.company,
          decrypted.contact.roleTitle,
          decrypted.request.budgetBucket,
          decrypted.request.helpWith.join("; "),
          (decrypted.request.details || "").replace(/"/g, '""'),
          decrypted.context.sourcePageUrl,
          decrypted.owner.email || "",
        ].map((val) => `"${val}"`);
      })
    );

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="leads-export-${new Date().toISOString().split("T")[0]}.csv"`
    );

    return res.send(csv);
  } catch (error) {
    logger.error({ error }, "Error exporting leads");
    return res.status(500).json({ error: "Failed to export leads" });
  }
});

export default router;
