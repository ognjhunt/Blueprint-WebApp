import { Request, Response, Router } from "express";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import {
  decryptFieldValue,
  decryptInboundRequestForAdmin,
  encryptFieldValue,
} from "../utils/field-encryption";
import {
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import type {
  DerivedAssetsAttachment,
  InboundRequest,
  InboundRequestStored,
  RequestStatus,
  InboundRequestListItem,
  UpdateRequestStatusPayload,
  AssignRequestOwnerPayload,
  AddRequestNotePayload,
  QualificationState,
  OpportunityState,
  PipelineAttachment,
  RequestedLane,
  BuyerType,
} from "../types/inbound-request";
import { parseGsUri, sceneDashboardSchema } from "../utils/pipeline-dashboard";

const router = Router();

const CSV_FORMULA_PREFIX = /^[=+\-@]/;

function sanitizeCsvCell(value: unknown): string {
  const normalized = String(value ?? "").replace(/\r?\n|\r/g, " ");
  const formulaSafe = CSV_FORMULA_PREFIX.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

// Admin email allowlist (in production, use Firebase Custom Claims)
const ADMIN_EMAILS = [
  "ohstnhunt@gmail.com",
  "ops@tryblueprint.io",
];

const VALID_QUALIFICATION_STATES: QualificationState[] = [...QUALIFICATION_STATES];

const VALID_OPPORTUNITY_STATES: OpportunityState[] = [...OPPORTUNITY_STATES];

function legacyStatusToQualificationState(status?: string | null): QualificationState {
  switch (status) {
    case "triaging":
      return "in_review";
    case "scheduled":
      return "capture_requested";
    case "qualified":
      return "qualified_ready";
    case "disqualified":
      return "not_ready_yet";
    case "closed":
      return "not_ready_yet";
    default:
      return "submitted";
  }
}

function deriveOpportunityState(
  qualificationState: QualificationState,
  rawValue?: string | null
): OpportunityState {
  if (rawValue && VALID_OPPORTUNITY_STATES.includes(rawValue as OpportunityState)) {
    return rawValue as OpportunityState;
  }

  if (qualificationState === "qualified_ready" || qualificationState === "qualified_risky") {
    return "handoff_ready";
  }

  return "not_applicable";
}

function normalizeDecryptedRequest(decrypted: InboundRequest) {
  const qualificationState =
    decrypted.qualification_state &&
    VALID_QUALIFICATION_STATES.includes(decrypted.qualification_state)
      ? decrypted.qualification_state
      : legacyStatusToQualificationState(decrypted.status);

  const opportunityState = deriveOpportunityState(
    qualificationState,
    decrypted.opportunity_state
  );

  const requestedLanes: RequestedLane[] =
    decrypted.request.requestedLanes && decrypted.request.requestedLanes.length > 0
      ? decrypted.request.requestedLanes
      : ["qualification"];

  const buyerType: BuyerType = decrypted.request.buyerType ?? "site_operator";
  const pipeline = normalizePipelineAttachment(decrypted.pipeline);
  const derivedAssets = normalizeDerivedAssets(decrypted.derived_assets);

  return {
    ...decrypted,
    site_submission_id: decrypted.site_submission_id || decrypted.requestId,
    status: qualificationState as RequestStatus,
    qualification_state: qualificationState,
    opportunity_state: opportunityState,
    request: {
      ...decrypted.request,
      requestedLanes,
      buyerType,
      siteName: decrypted.request.siteName || "Legacy submission",
      siteLocation: decrypted.request.siteLocation || "Legacy location",
      taskStatement:
        decrypted.request.taskStatement || "Legacy submission requires manual scoping",
    },
    pipeline,
    derived_assets: derivedAssets,
  };
}

function normalizePipelineAttachment(raw: unknown): PipelineAttachment | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const artifacts = value.artifacts && typeof value.artifacts === "object" ? value.artifacts : {};
  const syncedAt = value.synced_at as { toDate?: () => Date } | null | undefined;
  return {
    scene_id: String(value.scene_id || ""),
    capture_id: String(value.capture_id || ""),
    pipeline_prefix: String(value.pipeline_prefix || ""),
    artifacts: { ...(artifacts as PipelineAttachment["artifacts"]) },
    synced_at: syncedAt?.toDate?.()?.toISOString() || null,
  };
}

function normalizeDerivedAssets(raw: unknown): DerivedAssetsAttachment | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const syncedAt = value.synced_at as { toDate?: () => Date } | null | undefined;
  return {
    ...(value as DerivedAssetsAttachment),
    synced_at: syncedAt?.toDate?.()?.toISOString() || null,
  };
}

/**
 * Middleware to check if user is admin
 */
async function requireAdmin(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;

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
        const decrypted = normalizeDecryptedRequest(
          (await decryptInboundRequestForAdmin(data as any)) as InboundRequest
        );
        return {
          requestId: decrypted.requestId,
          site_submission_id: decrypted.site_submission_id,
          createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
          status: decrypted.status,
          qualification_state: decrypted.qualification_state,
          opportunity_state: decrypted.opportunity_state,
          priority: decrypted.priority,
          contact: {
            firstName: decrypted.contact.firstName,
            lastName: decrypted.contact.lastName,
            email: decrypted.contact.email,
            company: decrypted.contact.company,
          },
          request: {
            budgetBucket: decrypted.request.budgetBucket,
            requestedLanes: decrypted.request.requestedLanes,
            helpWith: decrypted.request.helpWith,
            buyerType: decrypted.request.buyerType,
            siteName: decrypted.request.siteName,
            siteLocation: decrypted.request.siteLocation,
            taskStatement: decrypted.request.taskStatement,
          },
          owner: decrypted.owner,
          pipeline: decrypted.pipeline,
          derived_assets: decrypted.derived_assets,
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
    const decrypted = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(data as any)) as InboundRequest
    );

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
      site_submission_id: decrypted.site_submission_id,
      createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
      status: decrypted.status,
      qualification_state: decrypted.qualification_state,
      opportunity_state: decrypted.opportunity_state,
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
        requestedLanes: decrypted.request.requestedLanes,
        helpWith: decrypted.request.helpWith,
        buyerType: decrypted.request.buyerType,
        siteName: decrypted.request.siteName,
        siteLocation: decrypted.request.siteLocation,
        taskStatement: decrypted.request.taskStatement,
        workflowContext: decrypted.request.workflowContext,
        operatingConstraints: decrypted.request.operatingConstraints,
        privacySecurityConstraints: decrypted.request.privacySecurityConstraints,
        knownBlockers: decrypted.request.knownBlockers,
        targetRobotTeam: decrypted.request.targetRobotTeam,
        details: decrypted.request.details,
      },
      owner: decrypted.owner,
      context: {
        sourcePageUrl: decrypted.context.sourcePageUrl,
        referrer: decrypted.context.referrer,
        utm: decrypted.context.utm,
      },
      enrichment: decrypted.enrichment,
      pipeline: decrypted.pipeline,
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

router.get("/:requestId/pipeline/dashboard", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    if (!storageAdmin) {
      return res.status(500).json({ error: "Storage not available" });
    }

    const { requestId } = req.params;
    const doc = await db.collection("inboundRequests").doc(requestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const data = doc.data() as InboundRequestStored;
    const decrypted = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(data as any)) as InboundRequest
    );
    const dashboardUri = decrypted.pipeline?.artifacts?.dashboard_summary_uri?.trim();
    if (!dashboardUri) {
      return res.status(404).json({ error: "Scene dashboard is not attached to this request" });
    }

    const { bucket, objectPath } = parseGsUri(dashboardUri);
    let rawPayload = "";
    try {
      const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
      rawPayload = buffer.toString("utf-8");
    } catch (error) {
      logger.error({ error, requestId, dashboardUri }, "Scene dashboard artifact missing");
      return res.status(404).json({ error: "Scene dashboard artifact was not found" });
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (error) {
      logger.error({ error, requestId, dashboardUri }, "Scene dashboard artifact is not valid JSON");
      return res.status(409).json({ error: "Scene dashboard artifact is malformed" });
    }

    const validation = sceneDashboardSchema.safeParse(parsedPayload);
    if (!validation.success) {
      logger.error(
        { requestId, dashboardUri, issues: validation.error.issues },
        "Scene dashboard artifact failed validation"
      );
      return res.status(409).json({ error: "Scene dashboard artifact failed validation" });
    }

    return res.json(validation.data);
  } catch (error) {
    logger.error(
      { error, requestId: req.params.requestId },
      "Error fetching scene dashboard"
    );
    return res.status(500).json({ error: "Failed to fetch scene dashboard" });
  }
});

/**
 * PATCH /api/admin/leads/:requestId/status
 * Update the qualification/opportunity state of a submission
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
      const { qualification_state, opportunity_state, note } =
        req.body as UpdateRequestStatusPayload;
      const user = res.locals.firebaseUser!;

      if (!VALID_QUALIFICATION_STATES.includes(qualification_state)) {
        return res.status(400).json({ error: "Invalid qualification_state" });
      }

      if (
        opportunity_state &&
        !VALID_OPPORTUNITY_STATES.includes(opportunity_state)
      ) {
        return res.status(400).json({ error: "Invalid opportunity_state" });
      }

      const docRef = db.collection("inboundRequests").doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Request not found" });
      }
      const previousData = normalizeDecryptedRequest(
        (await decryptInboundRequestForAdmin(
          doc.data() as InboundRequestStored
        )) as InboundRequest
      );
      const nextOpportunityState =
        opportunity_state ??
        deriveOpportunityState(qualification_state, previousData.opportunity_state);

      // Update status
      await docRef.update({
        status: qualification_state,
        qualification_state,
        opportunity_state: nextOpportunityState,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (previousData.status !== qualification_state) {
        await db
          .collection("stats")
          .doc("inboundRequests")
          .set(
            {
              [`byStatus.${previousData.status}`]:
                admin.firestore.FieldValue.increment(-1),
              [`byStatus.${qualification_state}`]:
                admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }

      // Add note if provided
      if (note && note.trim()) {
        const encryptedContent = await encryptFieldValue(
          `Qualification state changed to "${qualification_state}" and opportunity state set to "${nextOpportunityState}": ${note.trim()}`
        );
        await docRef.collection("notes").add({
          content: encryptedContent,
          authorUid: user.uid || null,
          authorEmail: user.email || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      logger.info(
        {
          requestId,
          qualification_state,
          opportunity_state: nextOpportunityState,
          by: user.email,
        },
        "Submission state updated"
      );

      return res.json({
        ok: true,
        qualification_state,
        opportunity_state: nextOpportunityState,
      });
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
      const user = res.locals.firebaseUser!;

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

      return res.status(HTTP_STATUS.OK).json({ ok: true, owner });
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
      const user = res.locals.firebaseUser!;

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

      return res.status(HTTP_STATUS.CREATED).json({
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
      submitted: statsData.byStatus?.submitted ?? 0,
      capture_requested: statsData.byStatus?.capture_requested ?? 0,
      qa_passed: statsData.byStatus?.qa_passed ?? 0,
      needs_more_evidence: statsData.byStatus?.needs_more_evidence ?? 0,
      in_review: statsData.byStatus?.in_review ?? 0,
      qualified_ready: statsData.byStatus?.qualified_ready ?? 0,
      qualified_risky: statsData.byStatus?.qualified_risky ?? 0,
      not_ready_yet: statsData.byStatus?.not_ready_yet ?? 0,
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
      "Submission ID",
      "Created At",
      "Qualification State",
      "Opportunity State",
      "Priority",
      "First Name",
      "Last Name",
      "Email",
      "Company",
      "Role",
      "Buyer Type",
      "Site Name",
      "Site Location",
      "Task Statement",
      "Budget",
      "Requested Lanes",
      "Legacy Help With",
      "Details",
      "Source URL",
      "Owner Email",
    ];

    const rows = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as InboundRequestStored;
        const decrypted = normalizeDecryptedRequest(
          (await decryptInboundRequestForAdmin(data as any)) as InboundRequest
        );
        return [
          decrypted.requestId,
          decrypted.site_submission_id,
          decrypted.createdAt?.toDate?.()?.toISOString() || "",
          decrypted.qualification_state,
          decrypted.opportunity_state,
          decrypted.priority,
          decrypted.contact.firstName,
          decrypted.contact.lastName,
          decrypted.contact.email,
          decrypted.contact.company,
          decrypted.contact.roleTitle,
          decrypted.request.buyerType,
          decrypted.request.siteName,
          decrypted.request.siteLocation,
          decrypted.request.taskStatement,
          decrypted.request.budgetBucket,
          decrypted.request.requestedLanes.join("; "),
          decrypted.request.helpWith.join("; "),
          decrypted.request.details || "",
          decrypted.context.sourcePageUrl,
          decrypted.owner.email || "",
        ].map((val) => sanitizeCsvCell(val));
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
