import { Request, Response, Router } from "express";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import {
  decryptFieldValue,
  decryptInboundRequestForAdmin,
  encryptFieldValue,
} from "../utils/field-encryption";
import { createRequestReviewToken } from "../utils/request-review-auth";
import {
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import type {
  DerivedAssetsAttachment,
  DeploymentReadinessSummary,
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
  UpdateRequestOpsPayload,
} from "../types/inbound-request";
import { parseGsUri, sceneDashboardSchema } from "../utils/pipeline-dashboard";
import { hasAnyRole } from "../utils/access-control";
import { runWaitlistAutomationLoop } from "../utils/waitlistAutomation";

const router = Router();

const CSV_FORMULA_PREFIX = /^[=+\-@]/;

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

function normalizeWaitlistSubmission(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
) {
  const data = doc.data() as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }

  const opsAutomation =
    data.ops_automation && typeof data.ops_automation === "object"
      ? (data.ops_automation as Record<string, unknown>)
      : {};

  return {
    id: doc.id,
    email: typeof data.email === "string" ? data.email : "",
    email_domain: typeof data.email_domain === "string" ? data.email_domain : "",
    location_type: typeof data.location_type === "string" ? data.location_type : "",
    market: typeof data.market === "string" ? data.market : "",
    role: typeof data.role === "string" ? data.role : "",
    device: typeof data.device === "string" ? data.device : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    source: typeof data.source === "string" ? data.source : "",
    status: typeof data.status === "string" ? data.status : "new",
    queue: typeof data.queue === "string" ? data.queue : "",
    filter_tags: Array.isArray(data.filter_tags)
      ? data.filter_tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    intent: typeof data.intent === "string" ? data.intent : "",
    created_at: normalizeTimestamp(data.created_at),
    updated_at: normalizeTimestamp(data.updated_at),
    ops_automation: {
      status: typeof opsAutomation.status === "string" ? opsAutomation.status : "pending",
      version: typeof opsAutomation.version === "string" ? opsAutomation.version : "",
      model: typeof opsAutomation.model === "string" ? opsAutomation.model : "",
      next_action:
        typeof opsAutomation.next_action === "string" ? opsAutomation.next_action : "",
      recommended_path:
        typeof opsAutomation.recommended_path === "string"
          ? opsAutomation.recommended_path
          : "",
      eligible_for_ai_triage: opsAutomation.eligible_for_ai_triage === true,
      confidence:
        typeof opsAutomation.confidence === "number" ? opsAutomation.confidence : null,
      market_fit_score:
        typeof opsAutomation.market_fit_score === "number"
          ? opsAutomation.market_fit_score
          : null,
      device_fit_score:
        typeof opsAutomation.device_fit_score === "number"
          ? opsAutomation.device_fit_score
          : null,
      invite_readiness_score:
        typeof opsAutomation.invite_readiness_score === "number"
          ? opsAutomation.invite_readiness_score
          : null,
      recommendation:
        typeof opsAutomation.recommendation === "string" ? opsAutomation.recommendation : "",
      rationale: typeof opsAutomation.rationale === "string" ? opsAutomation.rationale : "",
      market_summary:
        typeof opsAutomation.market_summary === "string" ? opsAutomation.market_summary : "",
      requires_human_review: opsAutomation.requires_human_review === true,
      block_reason_code:
        typeof opsAutomation.block_reason_code === "string"
          ? opsAutomation.block_reason_code
          : null,
      retryable: opsAutomation.retryable === true,
      last_error: typeof opsAutomation.last_error === "string" ? opsAutomation.last_error : null,
      last_attempt_at: normalizeTimestamp(opsAutomation.last_attempt_at),
      processed_at: normalizeTimestamp(opsAutomation.processed_at),
      draft_email:
        opsAutomation.draft_email && typeof opsAutomation.draft_email === "object"
          ? {
              subject:
                typeof (opsAutomation.draft_email as Record<string, unknown>).subject === "string"
                  ? String((opsAutomation.draft_email as Record<string, unknown>).subject)
                  : "",
              body:
                typeof (opsAutomation.draft_email as Record<string, unknown>).body === "string"
                  ? String((opsAutomation.draft_email as Record<string, unknown>).body)
                  : "",
            }
          : null,
    },
  };
}

function buildBuyerReviewUrl(requestId: string) {
  const token = createRequestReviewToken(requestId);
  const baseUrl = (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");
  return `${baseUrl}/requests/${encodeURIComponent(requestId)}?access=${encodeURIComponent(token)}`;
}

function sanitizeCsvCell(value: unknown): string {
  const normalized = String(value ?? "").replace(/\r?\n|\r/g, " ");
  const formulaSafe = CSV_FORMULA_PREFIX.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

const VALID_QUALIFICATION_STATES: QualificationState[] = [...QUALIFICATION_STATES];

const VALID_OPPORTUNITY_STATES: OpportunityState[] = [...OPPORTUNITY_STATES];
const CAPTURE_JOB_MARKETPLACE_STATES = [
  "draft",
  "approved_for_marketplace",
  "claimable",
  "reserved",
  "in_progress",
  "uploaded",
  "under_review",
  "approved",
  "paid",
  "needs_recapture",
  "cancelled",
] as const;
type CaptureJobMarketplaceState = (typeof CAPTURE_JOB_MARKETPLACE_STATES)[number];

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
  const deploymentReadiness = normalizeDeploymentReadiness(decrypted.deployment_readiness);

  return {
    ...decrypted,
    site_submission_id: decrypted.site_submission_id || decrypted.requestId,
    buyer_request_id: decrypted.buyer_request_id || decrypted.requestId,
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
    deployment_readiness: deploymentReadiness,
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
    buyer_request_id: String(value.buyer_request_id || ""),
    capture_job_id: String(value.capture_job_id || ""),
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

function normalizeDeploymentReadiness(raw: unknown): DeploymentReadinessSummary | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  return { ...(raw as DeploymentReadinessSummary) };
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseGeoPoint(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const lat = parseCoordinate(parsed.lat ?? parsed.latitude);
      const lng = parseCoordinate(parsed.lng ?? parsed.longitude);
      if (lat !== null && lng !== null) {
        return { lat, lng };
      }
    } catch {
      const [latValue, lngValue] = raw.split(",").map((value) => parseCoordinate(value));
      if (latValue !== null && lngValue !== null) {
        return { lat: latValue, lng: lngValue };
      }
    }
  }

  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const lat = parseCoordinate(value.lat ?? value.latitude);
    const lng = parseCoordinate(value.lng ?? value.longitude);
    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }

  return null;
}

function isValidMarketplaceCoordinate(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false;
  }
  return !(lat === 0 && lng === 0);
}

function resolveCaptureJobCoordinates(
  decrypted: ReturnType<typeof normalizeDecryptedRequest>,
  body: Record<string, unknown>,
): { lat: number; lng: number } | null {
  const lat = parseCoordinate(body.lat ?? body.latitude);
  const lng = parseCoordinate(body.lng ?? body.longitude);
  if (lat !== null && lng !== null) {
    return isValidMarketplaceCoordinate(lat, lng) ? { lat, lng } : null;
  }

  const requestGeo = parseGeoPoint((decrypted as Record<string, unknown>).geo);
  if (requestGeo && isValidMarketplaceCoordinate(requestGeo.lat, requestGeo.lng)) {
    return requestGeo;
  }

  const enrichmentGeo = parseGeoPoint((decrypted.enrichment as Record<string, unknown> | undefined)?.geo);
  if (enrichmentGeo && isValidMarketplaceCoordinate(enrichmentGeo.lat, enrichmentGeo.lng)) {
    return enrichmentGeo;
  }

  return null;
}

function buildCaptureJobPayload(
  decrypted: ReturnType<typeof normalizeDecryptedRequest>,
  params: {
    coordinates: { lat: number; lng: number };
    marketplaceState?: CaptureJobMarketplaceState;
    availabilityStartsAt?: string | null;
    availabilityEndsAt?: string | null;
  },
) {
  const priorityWeight =
    decrypted.priority === "high" ? 1.5 : decrypted.priority === "normal" ? 1.0 : 0.75;
  const specialTaskType =
    decrypted.request.requestedLanes.includes("preview_simulation")
      ? "buyer_requested_preview"
      : decrypted.request.requestedLanes.includes("deeper_evaluation")
      ? "buyer_requested_evaluation"
      : "managed_capture";
  const quotedPayoutCents = decrypted.priority === "high" ? 6500 : 4500;
  const marketplaceState = params.marketplaceState || "claimable";

  return {
    title: decrypted.request.siteName,
    address: decrypted.request.siteLocation,
    lat: params.coordinates.lat,
    lng: params.coordinates.lng,
    payout_cents: quotedPayoutCents,
    quoted_payout_cents: quotedPayoutCents,
    est_minutes: 25,
    active: true,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    published_at: admin.firestore.FieldValue.serverTimestamp(),
    workflow_name: decrypted.request.taskStatement,
    workflow_steps: decrypted.request.workflowContext
      ? [decrypted.request.workflowContext]
      : [decrypted.request.taskStatement],
    target_kpi: decrypted.request.details || "",
    known_blockers: decrypted.request.knownBlockers ? [decrypted.request.knownBlockers] : [],
    privacy_restrictions: decrypted.request.privacySecurityConstraints
      ? [decrypted.request.privacySecurityConstraints]
      : [],
    region_id: "managed-alpha",
    task_type: "buyer_requested_special_task",
    special_task_type: specialTaskType,
    buyer_request_id: decrypted.requestId,
    site_submission_id: decrypted.site_submission_id,
    priority_weight: priorityWeight,
    marketplace_state: marketplaceState,
    approval_requirements: ["ops_review", "rights_review"],
    rights_checklist: [
      "permission doc present or policy recorded",
      "consent scope documented",
      "restricted zones listed",
    ],
    rights_status: decrypted.ops?.rights_status || "unknown",
    capture_policy_tier: decrypted.ops?.capture_policy_tier || "review_required",
    requested_outputs: decrypted.request.requestedLanes,
    due_window: "managed",
    recapture_reason: "",
    capture_job_state: marketplaceState,
    availability_window:
      params.availabilityStartsAt || params.availabilityEndsAt
        ? {
            starts_at: params.availabilityStartsAt || null,
            ends_at: params.availabilityEndsAt || null,
          }
        : null,
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

  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    logger.warn(
      { email: user.email, uid: user.uid },
      "Non-admin user attempted to access admin routes"
    );
    return res.status(403).json({ error: "Admin access required" });
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
          buyer_request_id: decrypted.buyer_request_id,
          createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
          latest_capture_completed_at: normalizeTimestamp(decrypted.latest_capture_completed_at),
          latest_pipeline_completed_at: normalizeTimestamp(decrypted.latest_pipeline_completed_at),
          status: decrypted.status,
          qualification_state: decrypted.qualification_state,
          opportunity_state: decrypted.opportunity_state,
          exchange_status: decrypted.exchange_status || "not_listed",
          exchange_visibility: decrypted.exchange_visibility || "private",
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
          pipeline: decrypted.pipeline,
          derived_assets: decrypted.derived_assets,
          deployment_readiness: decrypted.deployment_readiness,
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

router.get("/waitlist-submissions", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const {
      role,
      device,
      status,
      queue,
      market,
      limit = "100",
      startAfter,
    } = req.query;

    let query = db.collection("waitlistSubmissions") as FirebaseFirestore.Query;

    if (role && typeof role === "string") {
      query = query.where("role_normalized", "==", role.trim().toLowerCase());
    }

    if (device && typeof device === "string") {
      query = query.where("device_normalized", "==", device.trim().toLowerCase());
    }

    if (status && typeof status === "string") {
      query = query.where("status", "==", status.trim());
    }

    if (queue && typeof queue === "string") {
      query = query.where("queue", "==", queue.trim());
    }

    if (market && typeof market === "string") {
      query = query.where("market_normalized", "==", market.trim().toLowerCase());
    }

    query = query.orderBy("created_at", "desc");

    const limitNum = Math.min(parseInt(limit as string, 10) || 100, 200);

    if (startAfter && typeof startAfter === "string") {
      const startDoc = await db.collection("waitlistSubmissions").doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();
    const submissions = snapshot.docs
      .map((doc) => normalizeWaitlistSubmission(doc))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    let countQuery = db.collection("waitlistSubmissions") as FirebaseFirestore.Query;
    if (role && typeof role === "string") {
      countQuery = countQuery.where("role_normalized", "==", role.trim().toLowerCase());
    }
    if (device && typeof device === "string") {
      countQuery = countQuery.where("device_normalized", "==", device.trim().toLowerCase());
    }
    if (status && typeof status === "string") {
      countQuery = countQuery.where("status", "==", status.trim());
    }
    if (queue && typeof queue === "string") {
      countQuery = countQuery.where("queue", "==", queue.trim());
    }
    if (market && typeof market === "string") {
      countQuery = countQuery.where("market_normalized", "==", market.trim().toLowerCase());
    }

    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    return res.json({
      submissions,
      pagination: {
        total: totalCount,
        limit: limitNum,
        hasMore: submissions.length === limitNum,
        lastId: submissions.length > 0 ? submissions[submissions.length - 1].id : null,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching waitlist submissions");
    return res.status(500).json({ error: "Failed to fetch waitlist submissions" });
  }
});

router.post(
  "/waitlist-submissions/automation/run",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const submissionId =
        typeof req.body?.submissionId === "string" ? req.body.submissionId.trim() : undefined;
      const queue = typeof req.body?.queue === "string" ? req.body.queue.trim() : undefined;
      const limit =
        typeof req.body?.limit === "number"
          ? req.body.limit
          : typeof req.body?.limit === "string"
            ? Number(req.body.limit)
            : undefined;

      const result = await runWaitlistAutomationLoop({
        submissionId,
        queue,
        limit: Number.isFinite(limit) ? limit : undefined,
      });

      return res.json(result);
    } catch (error) {
      logger.error({ error }, "Error running waitlist automation");
      return res.status(500).json({ error: "Failed to run waitlist automation" });
    }
  },
);

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
      buyer_request_id: decrypted.buyer_request_id,
      createdAt: decrypted.createdAt?.toDate?.()?.toISOString() || "",
      latest_capture_completed_at: normalizeTimestamp(decrypted.latest_capture_completed_at),
      latest_pipeline_completed_at: normalizeTimestamp(decrypted.latest_pipeline_completed_at),
      status: decrypted.status,
      qualification_state: decrypted.qualification_state,
      opportunity_state: decrypted.opportunity_state,
      exchange_status: decrypted.exchange_status || "not_listed",
      exchange_visibility: decrypted.exchange_visibility || "private",
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
      context: {
        sourcePageUrl: decrypted.context.sourcePageUrl,
        referrer: decrypted.context.referrer,
        utm: decrypted.context.utm,
      },
      enrichment: decrypted.enrichment,
      pipeline: decrypted.pipeline,
      derived_assets: decrypted.derived_assets,
      deployment_readiness: decrypted.deployment_readiness,
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

router.post("/:requestId/capture-job", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const requestDoc = await db.collection("inboundRequests").doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const decrypted = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(requestDoc.data() as any)) as InboundRequest
    );
    const coordinates = resolveCaptureJobCoordinates(
      decrypted,
      (req.body || {}) as Record<string, unknown>,
    );
    if (!coordinates) {
      return res.status(409).json({
        error:
          "Capture job cannot be published without valid site coordinates. Provide lat/lng or backfill request geo data first.",
      });
    }

    if (decrypted.ops?.rights_status === "blocked" || decrypted.ops?.capture_policy_tier === "not_allowed") {
      return res.status(409).json({
        error:
          "Capture job cannot be published while rights status or capture policy blocks commercialization.",
      });
    }

    const captureJobId = `job_${requestId}`;
    const requestedMarketplaceState = String(req.body?.marketplace_state || "").trim() as CaptureJobMarketplaceState;
    const payload = buildCaptureJobPayload(decrypted, {
      coordinates,
      marketplaceState: CAPTURE_JOB_MARKETPLACE_STATES.includes(requestedMarketplaceState)
        ? requestedMarketplaceState
        : "claimable",
      availabilityStartsAt:
        typeof req.body?.availability_starts_at === "string"
          ? req.body.availability_starts_at
          : null,
      availabilityEndsAt:
        typeof req.body?.availability_ends_at === "string"
          ? req.body.availability_ends_at
          : null,
    });

    await db.collection("capture_jobs").doc(captureJobId).set(payload, { merge: true });
    await requestDoc.ref.update({
      qualification_state: "capture_requested",
      status: "capture_requested",
      ops: {
        ...(decrypted.ops || {}),
        assigned_region_id: decrypted.ops?.assigned_region_id || payload.region_id || "managed-alpha",
        capture_status: "capture_requested",
        next_step: "Contributor capture requested. Wait for upload or assign a closer space.",
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true,
      capture_job_id: captureJobId,
      site_submission_id: decrypted.site_submission_id,
      buyer_request_id: decrypted.requestId,
      payload,
    });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error creating capture job");
    return res.status(500).json({ error: "Failed to create capture job" });
  }
});

router.post("/:requestId/trigger-preview", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const requestRef = db.collection("inboundRequests").doc(requestId);
    const doc = await requestRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const current = (doc.data() as Record<string, unknown>) || {};
    const deploymentReadiness = normalizeDeploymentReadiness(current.deployment_readiness) || {};
    const derivedAssets = normalizeDerivedAssets(current.derived_assets) || {};

    await requestRef.update({
      derived_assets: {
        ...derivedAssets,
        preview_simulation: {
          ...(derivedAssets.preview_simulation || {}),
          status: "generating",
          updated_at: new Date().toISOString(),
        },
        synced_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      deployment_readiness: {
        ...deploymentReadiness,
        preview_status: "queued",
        provider_run: {
          ...(deploymentReadiness.provider_run || {}),
          status: "queued",
          provider_name: "world_model_provider",
        },
      },
      ops: {
        ...(current.ops as Record<string, unknown> | undefined),
        next_step: "Preview queued. Buyer can review qualification while preview is processing.",
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true,
      requestId,
      preview_status: "queued",
    });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error triggering provider preview");
    return res.status(500).json({ error: "Failed to trigger provider preview" });
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

router.patch("/:requestId/ops", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const {
      assigned_region_id,
      rights_status,
      capture_policy_tier,
      capture_status,
      recapture_reason,
      quote_status,
      next_step,
      note,
    } = req.body as UpdateRequestOpsPayload;
    const user = res.locals.firebaseUser!;

    const docRef = db.collection("inboundRequests").doc(requestId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const existing = (doc.data() as Record<string, unknown>) || {};
    const ops = (existing.ops as Record<string, unknown> | undefined) || {};
    const nextOps = {
      ...ops,
      ...(assigned_region_id !== undefined ? { assigned_region_id } : {}),
      ...(rights_status !== undefined ? { rights_status } : {}),
      ...(capture_policy_tier !== undefined ? { capture_policy_tier } : {}),
      ...(capture_status !== undefined ? { capture_status } : {}),
      ...(recapture_reason !== undefined ? { recapture_reason } : {}),
      ...(quote_status !== undefined ? { quote_status } : {}),
      ...(next_step !== undefined ? { next_step } : {}),
      ...(quote_status === "buyer_ready"
        ? { last_buyer_ready_at: admin.firestore.FieldValue.serverTimestamp() }
        : {}),
    };

    await docRef.update({
      ops: nextOps,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (note?.trim()) {
      await docRef.collection("notes").add({
        content: await encryptFieldValue(note.trim()),
        authorUid: user.uid || "unknown",
        authorEmail: user.email || "unknown",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.json({ ok: true, ops: nextOps });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error updating request ops");
    return res.status(500).json({ error: "Failed to update request ops" });
  }
});

router.post("/:requestId/review-link", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const docRef = db.collection("inboundRequests").doc(requestId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const buyer_review_url = buildBuyerReviewUrl(requestId);
    await docRef.update({
      buyer_review_access: {
        buyer_review_url,
        token_issued_at: admin.firestore.FieldValue.serverTimestamp(),
        last_sent_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true, buyer_review_url });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error issuing buyer review link");
    return res.status(500).json({ error: "Failed to issue buyer review link" });
  }
});

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
