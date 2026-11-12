import { Request, Response, Router } from "express";
import { sceneScreenGateEnded } from "../utils/sceneScreenGate";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import {
  decryptFieldValue,
  decryptInboundRequestForAdmin,
  encryptFieldValue,
} from "../utils/field-encryption";
import {
  incrementInboundRequestStats,
  readInboundRequestStats,
} from "../utils/inboundRequestStats";
import {
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import {
  approveAction,
  rejectAction,
  retryFailedAction,
} from "../agents/action-executor";
import { reviewOutreachDraft, type OutreachReviewResult } from "../agents/outreach-review";
import { linkedinPeopleSearchHint } from "../agents/communications-linkedin-hint";
import { isCommunicationsPayload, reviewCommunicationsPayload } from "../agents/communications-review";
import { communicationsSendingEnabled } from "../agents/communications-send";
import { mirrorCommunicationsGmailDraft, CommunicationsGmailDraftError, communicationsGmailDraftStatus, configuredGmailDraftPorts } from "../agents/communications-gmail-draft";
import { reviseCommunicationsDraft, CommunicationsDraftRevisionError } from "../agents/communications-draft-revision";
import type {
  DerivedAssetsAttachment,
  EvaluationReadinessSummary,
  InboundRequest,
  InboundRequestStored,
  ProofPathMilestones,
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
  CommercialRequestPath,
  RequestQueueKey,
  GrowthWedgeKey,
  UpdateRequestOpsPayload,
  ProofPathMilestoneKey,
  OpsAutomationEnvelope,
  PilotOpportunityOutcome,
} from "../types/inbound-request";
import { parseGsUri, sceneDashboardSchema } from "../utils/pipeline-dashboard";
import { hasAnyRole } from "../utils/access-control";
import { CallOutcomeError, recordSiteTaskCallOutcome } from "../utils/siteTaskBrief";
import { gateAnswersOnFile } from "../utils/gateAnswersOnFile";
import { runWaitlistAutomationLoop } from "../utils/waitlistAutomation";
import { logGrowthEvent } from "../utils/growth-events";
import {
  appendOperatingGraphEvent,
  buildHostedReviewRunId,
} from "../utils/operatingGraph";
import {
  buildBuyerOperatingGraphMetadata,
  deriveCityContext,
  deriveStableBuyerAccountId,
  deriveStableHostedReviewRunId,
  deriveStablePackageId,
  recordBuyerOutcome,
} from "../utils/buyerOutcomes";

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

const PROOF_PATH_STAGE_TO_FIELD: Record<ProofPathMilestoneKey, keyof ProofPathMilestones> = {
  proof_pack_delivered: "proof_pack_delivered_at",
  proof_pack_reviewed: "proof_pack_reviewed_at",
  hosted_review_ready: "hosted_review_ready_at",
  hosted_review_started: "hosted_review_started_at",
  hosted_review_follow_up: "hosted_review_follow_up_at",
  artifact_handoff_delivered: "artifact_handoff_delivered_at",
  artifact_handoff_accepted: "artifact_handoff_accepted_at",
  human_commercial_handoff: "human_commercial_handoff_at",
};

const PROOF_PATH_STAGE_TO_EVENT: Partial<Record<ProofPathMilestoneKey, string>> = {
  proof_pack_delivered: "proof_pack_delivered",
  hosted_review_ready: "hosted_review_ready",
  hosted_review_started: "hosted_review_started",
  hosted_review_follow_up: "hosted_review_follow_up_sent",
  human_commercial_handoff: "human_commercial_handoff_started",
};

const QUALIFIED_ROBOT_TEAM_STATES = new Set<QualificationState>([
  "qualified_ready",
  "qualified_risky",
]);

function normalizeProofPathMilestones(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as ProofPathMilestones;
  return {
    exact_site_requested_at: normalizeTimestamp(value.exact_site_requested_at),
    qualified_inbound_at: normalizeTimestamp(value.qualified_inbound_at),
    proof_pack_delivered_at: normalizeTimestamp(value.proof_pack_delivered_at),
    proof_pack_reviewed_at: normalizeTimestamp(value.proof_pack_reviewed_at),
    hosted_review_ready_at: normalizeTimestamp(value.hosted_review_ready_at),
    hosted_review_started_at: normalizeTimestamp(value.hosted_review_started_at),
    hosted_review_follow_up_at: normalizeTimestamp(value.hosted_review_follow_up_at),
    artifact_handoff_delivered_at: normalizeTimestamp(value.artifact_handoff_delivered_at),
    artifact_handoff_accepted_at: normalizeTimestamp(value.artifact_handoff_accepted_at),
    human_commercial_handoff_at: normalizeTimestamp(value.human_commercial_handoff_at),
  };
}

function normalizeOpsAutomationEnvelope(raw: unknown): OpsAutomationEnvelope | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  return {
    status: typeof value.status === "string" ? value.status : "pending",
    queue: typeof value.queue === "string" ? value.queue : undefined,
    queue_label: typeof value.queue_label === "string" ? value.queue_label : null,
    intent: typeof value.intent === "string" ? value.intent : undefined,
    wedge_key:
      value.wedge_key === "exact_site_hosted_review"
        ? "exact_site_hosted_review"
        : null,
    filter_tags: Array.isArray(value.filter_tags)
      ? value.filter_tags.filter((entry): entry is string => typeof entry === "string")
      : [],
    next_action: typeof value.next_action === "string" ? value.next_action : null,
    recommended_path:
      typeof value.recommended_path === "string" ? value.recommended_path : null,
    confidence: typeof value.confidence === "number" ? value.confidence : null,
    requires_human_review:
      typeof value.requires_human_review === "boolean"
        ? value.requires_human_review
        : null,
    provider: typeof value.provider === "string" ? value.provider : null,
    runtime: typeof value.runtime === "string" ? value.runtime : null,
    model: typeof value.model === "string" ? value.model : null,
    last_error: typeof value.last_error === "string" ? value.last_error : null,
    last_attempt_at: normalizeTimestamp(value.last_attempt_at),
    processed_at: normalizeTimestamp(value.processed_at),
  };
}

function buildDemandAttributionForEvent(request: {
  context?: {
    demandCity?: string | null;
    buyerChannelSource?: string | null;
    buyerChannelSourceCaptureMode?: string | null;
    utm?: unknown;
  } | null;
}) {
  return {
    demandCity: request.context?.demandCity || null,
    buyerChannelSource: request.context?.buyerChannelSource || null,
    buyerChannelSourceCaptureMode:
      request.context?.buyerChannelSourceCaptureMode || null,
    utm: request.context?.utm || {},
  };
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

function sanitizeCsvCell(value: unknown): string {
  const normalized = String(value ?? "").replace(/\r?\n|\r/g, " ");
  const formulaSafe = CSV_FORMULA_PREFIX.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

const VALID_QUALIFICATION_STATES: QualificationState[] = [...QUALIFICATION_STATES];

const VALID_OPPORTUNITY_STATES: OpportunityState[] = [...OPPORTUNITY_STATES];
const VALID_PILOT_OPPORTUNITY_OUTCOMES: PilotOpportunityOutcome[] = [
  "not_requested",
  "review_pending",
  "evaluation_candidate",
  "wrong_robot_class",
  "economics_insufficient",
  "missing_evidence",
];
const ACTION_LEDGER_QUERY_STATUSES = [
  "pending_approval",
  "failed",
  "sent",
  "operator_rejected",
  "rejected",
  "executing",
  "operator_approved",
] as const;

type ActionLedgerRecord = Record<string, unknown> & {
  status?: string;
  lane?: string;
  action_type?: string;
  source_collection?: string;
  source_doc_id?: string;
  action_tier?: number;
  idempotency_key?: string;
  auto_approve_reason?: string | null;
  approval_reason?: string | null;
  approved_by?: string | null;
  approved_at?: unknown;
  rejected_by?: string | null;
  rejected_reason?: string | null;
  execution_attempts?: number;
  last_execution_error?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
  sent_at?: unknown;
  last_execution_at?: unknown;
  action_payload?: Record<string, unknown>;
  draft_output?: Record<string, unknown>;
  draft_revision_id?: string | null;
  qualification_tier?: unknown;
  send_authority?: unknown;
};

type ActionQueueItem = {
  id: string;
  status: string;
  lane: string;
  action_type: string;
  source_collection: string;
  source_doc_id: string;
  action_tier: number;
  idempotency_key: string;
  auto_approve_reason: string | null;
  approval_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_reason: string | null;
  execution_attempts: number;
  last_execution_error: string | null;
  created_at: string | null;
  updated_at: string | null;
  sent_at: string | null;
  last_execution_at: string | null;
  action_payload: Record<string, unknown>;
  draft_output: Record<string, unknown>;
  outreach_review?: OutreachReviewResult;
  draft_revision_id?: string | null;
  // Present only on an outreach-ready hypothesis draft: tier "outreach_ready", send authority "none".
  qualification_tier?: string;
  send_authority?: string;
  // Computed on each read for a hypothesis draft; never fetched, stored or used as evidence.
  linkedin_search?: { url: string; role: string; operator: string };
};

function normalizeActionLedgerItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): ActionQueueItem | null {
  const data = doc.data() as ActionLedgerRecord | undefined;
  if (!data) {
    return null;
  }

  return {
    id: doc.id,
    status: typeof data.status === "string" ? data.status : "unknown",
    lane: typeof data.lane === "string" ? data.lane : "",
    action_type: typeof data.action_type === "string" ? data.action_type : "",
    source_collection:
      typeof data.source_collection === "string" ? data.source_collection : "",
    source_doc_id: typeof data.source_doc_id === "string" ? data.source_doc_id : "",
    action_tier: typeof data.action_tier === "number" ? data.action_tier : 0,
    idempotency_key: typeof data.idempotency_key === "string" ? data.idempotency_key : "",
    auto_approve_reason:
      typeof data.auto_approve_reason === "string" ? data.auto_approve_reason : null,
    approval_reason: typeof data.approval_reason === "string" ? data.approval_reason : null,
    approved_by: typeof data.approved_by === "string" ? data.approved_by : null,
    approved_at: normalizeTimestamp(data.approved_at),
    rejected_by: typeof data.rejected_by === "string" ? data.rejected_by : null,
    rejected_reason:
      typeof data.rejected_reason === "string" ? data.rejected_reason : null,
    execution_attempts:
      typeof data.execution_attempts === "number" ? data.execution_attempts : 0,
    last_execution_error:
      typeof data.last_execution_error === "string" ? data.last_execution_error : null,
    created_at: normalizeTimestamp(data.created_at),
    updated_at: normalizeTimestamp(data.updated_at),
    sent_at: normalizeTimestamp(data.sent_at),
    last_execution_at: normalizeTimestamp(data.last_execution_at),
    action_payload:
      data.action_payload && typeof data.action_payload === "object"
        ? data.action_payload
        : {},
    draft_output:
      data.draft_output && typeof data.draft_output === "object"
        ? data.draft_output
        : {},
    ...(data.lane === "outbound_prospect" || data.source_collection === "outboundProspects" || isCommunicationsPayload(data.action_payload ?? {}) ? {
      outreach_review: isCommunicationsPayload(data.action_payload ?? {})
        ? reviewCommunicationsPayload(data.action_payload ?? {}) : reviewOutreachDraft({
        to: typeof data.action_payload?.to === "string" ? data.action_payload.to : "",
        subject: typeof data.action_payload?.subject === "string" ? data.action_payload.subject : "",
        body: typeof data.action_payload?.body === "string" ? data.action_payload.body : "",
        contract: data.action_payload?.outreachContract,
        context: data.action_payload?.outreachContext,
      }),
    } : {}),
    ...(isCommunicationsPayload(data.action_payload ?? {}) ? { sending_enabled: communicationsSendingEnabled(), draft_revision_id: data.draft_revision_id ?? null } : {}),
    ...(typeof data.qualification_tier === "string" ? { qualification_tier: data.qualification_tier } : {}),
    ...(typeof data.send_authority === "string" ? { send_authority: data.send_authority } : {}),
    ...(linkedinSearchFor(data.action_payload) ? { linkedin_search: linkedinSearchFor(data.action_payload)! } : {}),
  };
}

/** The founder's LinkedIn people-search link for an outreach-ready hypothesis draft, or null. */
function linkedinSearchFor(payload: unknown) {
  const communications = payload && typeof payload === "object" ? (payload as { communications?: { brief?: unknown } }).communications : undefined;
  return linkedinPeopleSearchHint(communications && typeof communications === "object" ? communications.brief : undefined);
}

function sortActionQueueItems(items: ActionQueueItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "");
    const rightTime = Date.parse(right.updated_at || right.created_at || "");

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

function getOperatorEmail(res: Response) {
  const firebaseUser = res.locals.firebaseUser as { email?: unknown; uid?: unknown } | undefined;
  if (typeof firebaseUser?.email === "string" && firebaseUser.email.trim()) {
    return firebaseUser.email.trim().toLowerCase();
  }
  if (typeof firebaseUser?.uid === "string" && firebaseUser.uid.trim()) {
    return firebaseUser.uid.trim();
  }
  return "unknown-operator";
}

function ledgerMutationStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) {
    return 404;
  }
  if (/cannot approve/i.test(message) || /cannot reject/i.test(message) || /cannot retry/i.test(message)) {
    return 409;
  }
  if (/max retries exceeded/i.test(message)) {
    return 409;
  }
  return 500;
}

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
  const commercialRequestPath: CommercialRequestPath =
    decrypted.request.commercialRequestPath ||
    (buyerType === "site_operator"
      ? "site_claim"
      : requestedLanes.includes("deeper_evaluation") ||
          requestedLanes.includes("data_licensing")
        ? "world_model"
        : "world_model");
  const pipeline = normalizePipelineAttachment(decrypted.pipeline);
  const derivedAssets = normalizeDerivedAssets(decrypted.derived_assets);
  const evaluationReadiness = normalizeEvaluationReadiness(decrypted.evaluation_readiness);
  const queueKey =
    (typeof decrypted.queue_key === "string" && decrypted.queue_key.trim()) ||
    (typeof decrypted.ops_automation?.queue === "string" && decrypted.ops_automation.queue.trim()) ||
    "inbound_request_review";
  const growthWedge =
    (typeof decrypted.growth_wedge === "string" && decrypted.growth_wedge.trim()) ||
    (typeof decrypted.ops_automation?.wedge_key === "string" &&
      decrypted.ops_automation.wedge_key.trim()) ||
    null;
  const queueTags = Array.from(
    new Set(
      [
        ...(Array.isArray(decrypted.queue_tags) ? decrypted.queue_tags : []),
        ...(Array.isArray(decrypted.ops_automation?.filter_tags)
          ? decrypted.ops_automation?.filter_tags
          : []),
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );

  return {
    ...decrypted,
    site_submission_id: decrypted.site_submission_id || decrypted.requestId,
    buyer_request_id: decrypted.buyer_request_id || decrypted.requestId,
    queue_key: queueKey as RequestQueueKey,
    growth_wedge: growthWedge as GrowthWedgeKey | null,
    queue_tags: queueTags,
    status: qualificationState as RequestStatus,
    qualification_state: qualificationState,
    opportunity_state: opportunityState,
    request: {
      ...decrypted.request,
      requestedLanes,
      buyerType,
      commercialRequestPath,
      siteName: decrypted.request.siteName || "Legacy submission",
      siteLocation: decrypted.request.siteLocation || "Legacy location",
      taskStatement:
        decrypted.request.taskStatement || "Legacy submission requires manual scoping",
    },
    ops: decrypted.ops
      ? {
          ...decrypted.ops,
          proof_path: normalizeProofPathMilestones(decrypted.ops.proof_path),
        }
      : decrypted.ops,
    ops_automation: {
      ...(decrypted.ops_automation || {}),
      queue: queueKey,
      wedge_key: growthWedge,
      filter_tags: queueTags,
    },
    pipeline,
    derived_assets: derivedAssets,
    evaluation_readiness: evaluationReadiness,
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

function normalizeEvaluationReadiness(raw: unknown): EvaluationReadinessSummary | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  return { ...(raw as EvaluationReadinessSummary) };
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
      queue,
      wedge,
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
    const queueFilter = typeof queue === "string" ? queue.trim() : "";
    const wedgeFilter = typeof wedge === "string" ? wedge.trim() : "";
    const fetchLimit =
      queueFilter || wedgeFilter ? Math.max(limitNum * 4, 200) : limitNum;

    if (startAfter && typeof startAfter === "string") {
      const startDoc = await db
        .collection("inboundRequests")
        .doc(startAfter)
        .get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    query = query.limit(fetchLimit);

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
          queue_key: decrypted.queue_key || null,
          growth_wedge: decrypted.growth_wedge || null,
          queue_tags: decrypted.queue_tags || [],
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
            commercialRequestPath: decrypted.request.commercialRequestPath || null,
            siteName: decrypted.request.siteName,
            siteLocation: decrypted.request.siteLocation,
            taskStatement: decrypted.request.taskStatement,
            proofPathPreference: decrypted.request.proofPathPreference || null,
            pilotOpportunity: decrypted.request.pilotOpportunity || null,
            displayCaptureMetadata: decrypted.request.displayCaptureMetadata || null,
            realSiteRobotEvalFit: decrypted.request.realSiteRobotEvalFit || null,
          },
          owner: decrypted.owner,
          ops_automation: normalizeOpsAutomationEnvelope(decrypted.ops_automation),
          structured_intake: decrypted.structured_intake,
          ops: decrypted.ops
            ? {
                assigned_region_id: decrypted.ops.assigned_region_id || null,
                rights_status: decrypted.ops.rights_status || null,
                capture_policy_tier: decrypted.ops.capture_policy_tier || null,
                capture_status: decrypted.ops.capture_status || null,
                recapture_reason: decrypted.ops.recapture_reason || null,
                quote_status: decrypted.ops.quote_status || null,
                next_step: decrypted.ops.next_step || null,
                last_buyer_ready_at: normalizeTimestamp(decrypted.ops.last_buyer_ready_at),
                proof_path: normalizeProofPathMilestones(decrypted.ops.proof_path),
              }
            : null,
          pipeline: decrypted.pipeline,
          derived_assets: decrypted.derived_assets,
          evaluation_readiness: decrypted.evaluation_readiness,
        } satisfies InboundRequestListItem;
      })
    );
    const filteredLeads = leads.filter((lead) => {
      if (queueFilter && lead.queue_key !== queueFilter) {
        return false;
      }
      if (wedgeFilter && lead.growth_wedge !== wedgeFilter) {
        return false;
      }
      return true;
    });
    const pagedLeads = filteredLeads.slice(0, limitNum);

    // Get total count for pagination info
    const countQuery = db.collection("inboundRequests");
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    return res.json({
      leads: pagedLeads,
      pagination: {
        total: queueFilter || wedgeFilter ? filteredLeads.length : totalCount,
        limit: limitNum,
        hasMore: filteredLeads.length > limitNum,
        lastId: pagedLeads.length > 0 ? pagedLeads[pagedLeads.length - 1].requestId : null,
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

router.get("/action-queue", requireAdmin, async (req: Request, res: Response) => {
  try {
    const firestore = db;
    if (!firestore) {
      return res.status(500).json({ error: "Database not available" });
    }

    const status = typeof req.query.status === "string" ? req.query.status.trim() : "all";
    const lane = typeof req.query.lane === "string" ? req.query.lane.trim() : "";
    const limitNum = Math.min(
      Math.max(parseInt(typeof req.query.limit === "string" ? req.query.limit : "25", 10) || 25, 1),
      100,
    );

    const statuses = ACTION_LEDGER_QUERY_STATUSES.includes(
      status as (typeof ACTION_LEDGER_QUERY_STATUSES)[number],
    )
      ? [status]
      : ["pending_approval", "failed", "executing", "operator_approved"];

    const fetchLimit = Math.max(limitNum * 2, 50);
    const snapshots = await Promise.all(
      statuses.map(async (queueStatus) => {
        const snapshot = await firestore
          .collection("action_ledger")
          .where("status", "==", queueStatus)
          .orderBy("updated_at", "desc")
          .limit(fetchLimit)
          .get();
        return snapshot.docs
          .map((doc) => normalizeActionLedgerItem(doc))
          .filter((item): item is ActionQueueItem => Boolean(item));
      }),
    );

    const items = sortActionQueueItems(snapshots.flat()).filter((item) => {
      if (["executing", "operator_approved"].includes(item.status) && !isCommunicationsPayload(item.action_payload)) return false;
      return lane ? item.lane === lane : true;
    });
    const limitedItems = await Promise.all(items.slice(0, limitNum).map(async item =>
      item.action_payload.communications ? { ...item, gmail_draft: await communicationsGmailDraftStatus(firestore, item.id, item.action_payload, item.draft_revision_id ?? null, item.outreach_review?.digest ?? null) } : item));

    return res.json({
      items: limitedItems,
      summary: {
        total: items.length,
        pending_approval: items.filter((item) => item.status === "pending_approval").length,
        failed: items.filter((item) => item.status === "failed").length,
        sent: items.filter((item) => item.status === "sent").length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching action queue");
    return res.status(500).json({ error: "Failed to fetch action queue" });
  }
});

router.post("/action-queue/:ledgerId/revise", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not available" });
    return res.json(await reviseCommunicationsDraft(db, req.params.ledgerId, getOperatorEmail(res), req.body));
  } catch (error) {
    if (error instanceof CommunicationsDraftRevisionError) return res.status(error.status).json({ error: error.message, issues: error.issues });
    logger.error({ error }, "Error revising communications draft");
    return res.status(500).json({ error: "Could not save this revision. Reload the draft and retry." });
  }
});

router.post("/action-queue/:ledgerId/gmail-draft", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ownerUid = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID?.trim();
    if (!ownerUid || res.locals.firebaseUser?.uid !== ownerUid) return res.status(403).json({ error: "gmail_draft_owner_required" });
    if (!db) return res.status(503).json({ error: "Database not available" });
    return res.json(await mirrorCommunicationsGmailDraft(db, req.params.ledgerId, getOperatorEmail(res), req.body, configuredGmailDraftPorts(undefined, "manual_approved_copy")));
  } catch (error) {
    if (error instanceof CommunicationsGmailDraftError) return res.status(error.status).json({ error: error.message });
    return res.status(409).json({ error: "gmail_draft_request_invalid_or_source_unavailable" });
  }
});

router.post(
  "/action-queue/:ledgerId/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const ledgerId = req.params.ledgerId?.trim();
      if (!ledgerId) {
        return res.status(400).json({ error: "Missing ledger id" });
      }

      const result = await approveAction(ledgerId, getOperatorEmail(res), req.body?.outreachSemanticReview);
      return res.json(result);
    } catch (error) {
      logger.error({ error }, "Error approving action queue item");
      return res.status(ledgerMutationStatus(error)).json({
        error: error instanceof Error ? error.message : "Failed to approve action",
      });
    }
  },
);

router.post(
  "/action-queue/:ledgerId/reject",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const ledgerId = req.params.ledgerId?.trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!ledgerId) {
        return res.status(400).json({ error: "Missing ledger id" });
      }
      if (!reason) {
        return res.status(400).json({ error: "Missing rejection reason" });
      }

      const result = await rejectAction(ledgerId, getOperatorEmail(res), reason);
      return res.json(result);
    } catch (error) {
      logger.error({ error }, "Error rejecting action queue item");
      return res.status(ledgerMutationStatus(error)).json({
        error: error instanceof Error ? error.message : "Failed to reject action",
      });
    }
  },
);

router.post(
  "/action-queue/:ledgerId/retry",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const ledgerId = req.params.ledgerId?.trim();
      if (!ledgerId) {
        return res.status(400).json({ error: "Missing ledger id" });
      }

      const result = await retryFailedAction(ledgerId);
      return res.json(result);
    } catch (error) {
      logger.error({ error }, "Error retrying action queue item");
      return res.status(ledgerMutationStatus(error)).json({
        error: error instanceof Error ? error.message : "Failed to retry action",
      });
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
      queue_key: decrypted.queue_key || null,
      growth_wedge: decrypted.growth_wedge || null,
      queue_tags: decrypted.queue_tags || [],
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
        commercialRequestPath: decrypted.request.commercialRequestPath || null,
        siteName: decrypted.request.siteName,
        siteLocation: decrypted.request.siteLocation,
        taskStatement: decrypted.request.taskStatement,
        proofPathPreference: decrypted.request.proofPathPreference || null,
        targetSiteType: decrypted.request.targetSiteType || null,
        existingStackReviewWorkflow:
          decrypted.request.existingStackReviewWorkflow || null,
        humanGateTopics: decrypted.request.humanGateTopics || null,
        workflowContext: decrypted.request.workflowContext,
        operatingConstraints: decrypted.request.operatingConstraints,
        privacySecurityConstraints: decrypted.request.privacySecurityConstraints,
        knownBlockers: decrypted.request.knownBlockers,
        targetRobotTeam: decrypted.request.targetRobotTeam,
        pilotOpportunity: decrypted.request.pilotOpportunity || null,
        details: decrypted.request.details,
        displayCaptureMetadata: decrypted.request.displayCaptureMetadata || null,
        realSiteRobotEvalFit: decrypted.request.realSiteRobotEvalFit || null,
      },
      owner: decrypted.owner,
      ops_automation: normalizeOpsAutomationEnvelope(decrypted.ops_automation),
      structured_intake: decrypted.structured_intake,
      ops: decrypted.ops
        ? {
            assigned_region_id: decrypted.ops.assigned_region_id || null,
            rights_status: decrypted.ops.rights_status || null,
            capture_policy_tier: decrypted.ops.capture_policy_tier || null,
            capture_status: decrypted.ops.capture_status || null,
            recapture_reason: decrypted.ops.recapture_reason || null,
            quote_status: decrypted.ops.quote_status || null,
            next_step: decrypted.ops.next_step || null,
            last_buyer_ready_at: normalizeTimestamp(decrypted.ops.last_buyer_ready_at),
            proof_path: normalizeProofPathMilestones(decrypted.ops.proof_path),
          }
        : null,
      context: {
        sourcePageUrl: decrypted.context.sourcePageUrl,
        referrer: decrypted.context.referrer,
        demandCity: decrypted.context.demandCity || null,
        buyerChannelSource: decrypted.context.buyerChannelSource || null,
        buyerChannelSourceCaptureMode:
          decrypted.context.buyerChannelSourceCaptureMode || null,
        buyerChannelSourceRaw: decrypted.context.buyerChannelSourceRaw || null,
        utm: decrypted.context.utm,
      },
      enrichment: decrypted.enrichment,
      pipeline: decrypted.pipeline,
      derived_assets: decrypted.derived_assets,
      evaluation_readiness: decrypted.evaluation_readiness,
      site_task_triage: decrypted.site_task_triage ?? null,
      site_task_gates_on_file: gateAnswersOnFile(decrypted),
      site_task_brief_confirmed: Boolean(decrypted.site_task_brief_confirmed_at),
      site_task_screen_gate_ended: sceneScreenGateEnded(data as unknown as Record<string, any>, decrypted.requestId),
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
    const evaluationReadiness = normalizeEvaluationReadiness(current.evaluation_readiness) || {};
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
      evaluation_readiness: {
        ...evaluationReadiness,
        preview_status: "queued",
        provider_run: {
          ...(evaluationReadiness.provider_run || {}),
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
      const {
        qualification_state,
        opportunity_state,
        pilot_opportunity_outcome,
        note,
      } =
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

      if (
        pilot_opportunity_outcome &&
        !VALID_PILOT_OPPORTUNITY_OUTCOMES.includes(pilot_opportunity_outcome)
      ) {
        return res.status(400).json({ error: "Invalid pilot_opportunity_outcome" });
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

      const shouldStampQualifiedRobotTeam =
        previousData.request.buyerType === "robot_team" &&
        QUALIFIED_ROBOT_TEAM_STATES.has(qualification_state) &&
        !previousData.ops?.proof_path?.qualified_inbound_at;

      const updatePayload: Record<string, unknown> = {
        status: qualification_state,
        qualification_state,
        opportunity_state: nextOpportunityState,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (pilot_opportunity_outcome) {
        updatePayload["structured_intake.pilot_opportunity_outcome"] =
          pilot_opportunity_outcome;
      }

      if (shouldStampQualifiedRobotTeam) {
        updatePayload.ops = {
          ...(previousData.ops || {}),
          proof_path: {
            ...(previousData.ops?.proof_path || {}),
            qualified_inbound_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        };
      }

      // Update status
      await docRef.update(updatePayload);

      if (previousData.request.buyerType === "robot_team") {
        const exactSiteClassification =
          previousData.request.proofPathPreference === "exact_site_required"
            ? "exact_site"
            : previousData.request.proofPathPreference === "adjacent_site_acceptable"
              ? "adjacent_site"
              : "needs_guidance";

        await logGrowthEvent({
          event: "robot_team_fit_checked",
          source: "server:admin_leads_status",
          properties: {
            request_id: requestId,
            city: previousData.context?.demandCity || null,
            qualification_state,
            opportunity_state: nextOpportunityState,
            exact_site_classification: exactSiteClassification,
            adjacent_site_allowed:
              previousData.request.proofPathPreference === "adjacent_site_acceptable",
            proof_path_preference: previousData.request.proofPathPreference || "unknown",
          },
          attribution: buildDemandAttributionForEvent(previousData),
          user: {
            uid: user.uid || null,
            email: user.email || null,
          },
        }).catch(() => null);

        if (shouldStampQualifiedRobotTeam) {
          await logGrowthEvent({
            event: "proof_path_assigned",
            source: "server:admin_leads_status",
            properties: {
              request_id: requestId,
              city: previousData.context?.demandCity || null,
              outcome:
                exactSiteClassification === "exact_site"
                  ? "exact_site"
                  : exactSiteClassification === "adjacent_site"
                    ? "adjacent_site"
                    : "scoped_follow_up",
              assigned_by: user.email || "unknown",
              buyer_segment: previousData.contact?.roleTitle || null,
            },
            attribution: buildDemandAttributionForEvent(previousData),
            user: {
              uid: user.uid || null,
              email: user.email || null,
            },
          }).catch(() => null);
        }

        if (
          ["needs_more_evidence", "needs_refresh", "not_ready_yet"].includes(
            qualification_state,
          )
        ) {
          await logGrowthEvent({
            event: "proof_motion_stalled",
            source: "server:admin_leads_status",
            properties: {
              request_id: requestId,
              city: previousData.context?.demandCity || null,
              blocker_reason: qualification_state,
              blocker_detail:
                previousData.request.knownBlockers
                || previousData.request.humanGateTopics
                || previousData.request.operatingConstraints
                || null,
              buyer_segment: previousData.contact?.roleTitle || null,
            },
            attribution: buildDemandAttributionForEvent(previousData),
            user: {
              uid: user.uid || null,
              email: user.email || null,
            },
          }).catch(() => null);
        }
      }

      if (previousData.status !== qualification_state) {
        await incrementInboundRequestStats(db, {
          [`byStatus.${previousData.status}`]: -1,
          [`byStatus.${qualification_state}`]: 1,
        });
      }

      // Add note if provided
      if (note && note.trim()) {
        const encryptedContent = await encryptFieldValue(
          `Qualification state changed to "${qualification_state}", opportunity state set to "${nextOpportunityState}", and pilot opportunity outcome set to "${pilot_opportunity_outcome || previousData.structured_intake?.pilot_opportunity_outcome || "unchanged"}": ${note.trim()}`
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
        pilot_opportunity_outcome:
          pilot_opportunity_outcome ||
          previousData.structured_intake?.pilot_opportunity_outcome ||
          null,
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
      proof_path_stage,
      proof_path_stage_action,
      note,
    } = req.body as UpdateRequestOpsPayload;
    const user = res.locals.firebaseUser!;

    const docRef = db.collection("inboundRequests").doc(requestId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const existing = (doc.data() as Record<string, unknown>) || {};
    const previousData = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(
        doc.data() as InboundRequestStored,
      )) as InboundRequest,
    );
    const ops = (existing.ops as Record<string, unknown> | undefined) || {};
    const currentProofPath =
      ops.proof_path && typeof ops.proof_path === "object"
        ? ({ ...(ops.proof_path as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const nextProofPath = { ...currentProofPath };

    if (proof_path_stage) {
      const proofPathField = PROOF_PATH_STAGE_TO_FIELD[proof_path_stage];
      if (!proofPathField) {
        return res.status(400).json({ error: "Invalid proof_path_stage" });
      }

      if (proof_path_stage_action === "clear") {
        nextProofPath[proofPathField] = null;
      } else {
        nextProofPath[proofPathField] = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    if (
      quote_status === "buyer_ready" &&
      existing.request &&
      typeof existing.request === "object" &&
      (existing.request as Record<string, unknown>).buyerType === "robot_team" &&
      !nextProofPath.human_commercial_handoff_at
    ) {
      nextProofPath.human_commercial_handoff_at = admin.firestore.FieldValue.serverTimestamp();
    }

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
      proof_path: nextProofPath,
    };

    await docRef.update({
      ops: nextOps,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (previousData.request.buyerType === "robot_team") {
      const cityContext = deriveCityContext({
        city: previousData.context?.demandCity || null,
      });
      const hostedReviewRunId = deriveStableHostedReviewRunId({
        requestId,
        buyerRequestId: previousData.buyer_request_id || previousData.requestId,
      });
      const packageId = deriveStablePackageId({
        captureId: previousData.pipeline?.capture_id || null,
        sceneId: previousData.pipeline?.scene_id || null,
        siteSubmissionId: previousData.site_submission_id || previousData.requestId,
        buyerRequestId: previousData.buyer_request_id || previousData.requestId,
        requestId: previousData.requestId,
      });
      const buyerAccountId = deriveStableBuyerAccountId({
        contactEmail: previousData.contact?.email || null,
        contactCompany: previousData.contact?.company || null,
        buyerRequestId: previousData.buyer_request_id || previousData.requestId,
      });

      if (proof_path_stage) {
        await logGrowthEvent({
          event: "proof_path_stage_updated",
          source: "server:admin_leads_ops",
          properties: {
            request_id: requestId,
            city: previousData.context?.demandCity || null,
            stage: proof_path_stage,
            action: proof_path_stage_action === "clear" ? "clear" : "stamp",
          },
          attribution: buildDemandAttributionForEvent(previousData),
          user: {
            uid: user.uid || null,
            email: user.email || null,
          },
        }).catch(() => null);

        const stageEvent = PROOF_PATH_STAGE_TO_EVENT[proof_path_stage];
        if (stageEvent && proof_path_stage_action !== "clear") {
          await logGrowthEvent({
            event: stageEvent,
            source: "server:admin_leads_ops",
            properties: {
              request_id: requestId,
              city: previousData.context?.demandCity || null,
              buyer_segment: previousData.contact?.roleTitle || null,
              hosted_mode:
                proof_path_stage.startsWith("hosted_review") ? "review_link" : null,
            },
            attribution: buildDemandAttributionForEvent(previousData),
            user: {
              uid: user.uid || null,
              email: user.email || null,
            },
          }).catch(() => null);
        }

        if (
          proof_path_stage === "hosted_review_follow_up"
          && proof_path_stage_action !== "clear"
          && cityContext.city
          && cityContext.citySlug
          && hostedReviewRunId
        ) {
          await appendOperatingGraphEvent({
            eventKey: `buyer_follow_up:${requestId}:hosted_review_follow_up`,
            entityType: "hosted_review_run",
            entityId: buildHostedReviewRunId({
              hostedReviewRunId,
            }),
            city: cityContext.city,
            citySlug: cityContext.citySlug,
            stage: "buyer_follow_up_in_progress",
            summary: "Buyer follow-up is in progress after hosted review.",
            sourceRepo: "Blueprint-WebApp",
            sourceKind: "admin_ops_follow_up",
            origin: {
              repo: "Blueprint-WebApp",
              project: "blueprint-webapp",
              sourceCollection: "inboundRequests",
              sourceDocId: requestId,
              route: "/api/admin/leads/:requestId/ops",
            },
            metadata: buildBuyerOperatingGraphMetadata({
              cityProgramId: cityContext.cityProgramId,
              siteSubmissionId: previousData.site_submission_id || previousData.requestId,
              captureId: previousData.pipeline?.capture_id || null,
              sceneId: previousData.pipeline?.scene_id || null,
              buyerRequestId: previousData.buyer_request_id || previousData.requestId,
              captureJobId: previousData.pipeline?.capture_job_id || null,
              packageId,
              hostedReviewRunId,
              buyerAccountId,
            }),
          }).catch(() => null);
        }
      }

      if (quote_status === "buyer_ready") {
        await logGrowthEvent({
          event: "human_commercial_handoff_started",
          source: "server:admin_leads_ops",
          properties: {
            request_id: requestId,
            city: previousData.context?.demandCity || null,
            handoff_reason: "buyer_ready",
            buyer_segment: previousData.contact?.roleTitle || null,
          },
          attribution: buildDemandAttributionForEvent(previousData),
          user: {
            uid: user.uid || null,
            email: user.email || null,
          },
        }).catch(() => null);

        if (cityContext.city && cityContext.citySlug && hostedReviewRunId) {
          await appendOperatingGraphEvent({
            eventKey: `buyer_follow_up:${requestId}:human_commercial_handoff`,
            entityType: "hosted_review_run",
            entityId: buildHostedReviewRunId({
              hostedReviewRunId,
            }),
            city: cityContext.city,
            citySlug: cityContext.citySlug,
            stage: "buyer_follow_up_in_progress",
            summary: "Human commercial handoff is in progress for the buyer.",
            sourceRepo: "Blueprint-WebApp",
            sourceKind: "admin_ops_handoff",
            origin: {
              repo: "Blueprint-WebApp",
              project: "blueprint-webapp",
              sourceCollection: "inboundRequests",
              sourceDocId: requestId,
              route: "/api/admin/leads/:requestId/ops",
            },
            metadata: buildBuyerOperatingGraphMetadata({
              cityProgramId: cityContext.cityProgramId,
              siteSubmissionId: previousData.site_submission_id || previousData.requestId,
              captureId: previousData.pipeline?.capture_id || null,
              sceneId: previousData.pipeline?.scene_id || null,
              buyerRequestId: previousData.buyer_request_id || previousData.requestId,
              captureJobId: previousData.pipeline?.capture_job_id || null,
              packageId,
              hostedReviewRunId,
              buyerAccountId,
            }),
          }).catch(() => null);
        }
      }
    }

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

/**
 * POST /api/admin/leads/:requestId/site-task-call
 * Record what a screening call settled for a `needs_conversation` site and
 * re-screen it. A `qualified` result is what lets Blueprint fund its scene.
 */
router.get("/:requestId/site-task-clarification", requireAdmin, async (req, res) => {
  try {
    const { readSiteClarification } = await import("../utils/siteTaskClarifications");
    return res.json(await readSiteClarification(req.params.requestId));
  } catch { return res.status(503).json({ error: "Could not load clarification." }); }
});
router.post("/:requestId/site-task-call", requireAdmin, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 10 || note.length > 2000) {
    return res.status(400).json({ error: "Say what the call settled, in at least a sentence." });
  }
  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? Object.fromEntries(Object.entries(body.answers as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value))
    : {};
  const clearedFieldIds = Array.isArray(body.clearedFieldIds)
    ? body.clearedFieldIds.filter((value): value is string => typeof value === "string").slice(0, 40)
    : [];
  const user = res.locals.firebaseUser!;
  try {
    const result = await recordSiteTaskCallOutcome({
      requestId: req.params.requestId,
      answers: answers as Record<string, string>,
      clearedFieldIds,
      note,
      resolvedBy: String(user.email || user.uid),
      clarificationId: typeof body.clarificationId === "string" ? body.clarificationId : undefined,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CallOutcomeError) return res.status(409).json({ error: error.message });
    logger.error({ error, requestId: req.params.requestId }, "Error recording site screening call");
    return res.status(500).json({ error: "Failed to record the call outcome" });
  }
});

router.post("/:requestId/buyer-outcomes", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { requestId } = req.params;
    const {
      buyer_outcome_id,
      buyer_account_id,
      outcome_type,
      outcome_status,
      commercial_value_usd,
      confidence,
      source,
      notes,
      proof_refs,
    } = req.body as Record<string, unknown>;
    const user = res.locals.firebaseUser!;

    if (typeof outcome_type !== "string" || !outcome_type.trim()) {
      return res.status(400).json({ error: "outcome_type is required" });
    }
    if (typeof outcome_status !== "string" || !outcome_status.trim()) {
      return res.status(400).json({ error: "outcome_status is required" });
    }
    if (typeof source !== "string" || !source.trim()) {
      return res.status(400).json({ error: "source is required" });
    }

    const doc = await db.collection("inboundRequests").doc(requestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found" });
    }

    const current = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(
        doc.data() as InboundRequestStored,
      )) as InboundRequest,
    );

    const result = await recordBuyerOutcome({
      requestId,
      city: current.context?.demandCity || null,
      siteSubmissionId: current.site_submission_id || current.requestId,
      captureId: current.pipeline?.capture_id || null,
      sceneId: current.pipeline?.scene_id || null,
      buyerRequestId: current.buyer_request_id || current.requestId,
      captureJobId: current.pipeline?.capture_job_id || null,
      packageId: deriveStablePackageId({
        captureId: current.pipeline?.capture_id || null,
        sceneId: current.pipeline?.scene_id || null,
        siteSubmissionId: current.site_submission_id || current.requestId,
        buyerRequestId: current.buyer_request_id || current.requestId,
        requestId: current.requestId,
      }),
      hostedReviewRunId: deriveStableHostedReviewRunId({
        requestId,
        buyerRequestId: current.buyer_request_id || current.requestId,
      }),
      buyerAccountId: deriveStableBuyerAccountId({
        buyerAccountId: typeof buyer_account_id === "string" ? buyer_account_id : null,
        contactEmail: current.contact?.email || null,
        contactCompany: current.contact?.company || null,
        buyerRequestId: current.buyer_request_id || current.requestId,
      }),
      outcomeType: outcome_type,
      outcomeStatus: outcome_status,
      recordedBy:
        (typeof user.email === "string" && user.email.trim())
        || (typeof user.uid === "string" && user.uid.trim())
        || "admin",
      commercialValueUsd:
        typeof commercial_value_usd === "number" && Number.isFinite(commercial_value_usd)
          ? commercial_value_usd
          : null,
      confidence:
        typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null,
      source,
      notes: typeof notes === "string" ? notes : null,
      proofRefs: Array.isArray(proof_refs)
        ? proof_refs.filter((entry): entry is string => typeof entry === "string")
        : [],
      originRoute: "/api/admin/leads/:requestId/buyer-outcomes",
      sourceDocId: requestId,
      buyerOutcomeId: typeof buyer_outcome_id === "string" ? buyer_outcome_id : null,
    });

    return res.status(201).json({
      ok: true,
      buyer_outcome_id: result?.buyerOutcomeId || null,
      hosted_review_run_id: result?.hostedReviewRunId || null,
    });
  } catch (error) {
    logger.error({ error, requestId: req.params.requestId }, "Error recording buyer outcome");
    return res.status(500).json({ error: "Failed to record buyer outcome" });
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

    const statsData = (await readInboundRequestStats(db)) as Record<string, any>;

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
      byQueue: {
        inbound_request_review: statsData.byQueue?.inbound_request_review ?? 0,
        exact_site_hosted_review_queue:
          statsData.byQueue?.exact_site_hosted_review_queue ?? 0,
      },
      byWedge: {
        exact_site_hosted_review:
          statsData.byWedge?.exact_site_hosted_review ?? 0,
      },
      byRequestPath: {
        world_model: statsData.byRequestPath?.world_model ?? 0,
        hosted_evaluation: statsData.byRequestPath?.hosted_evaluation ?? 0,
        capture_access: statsData.byRequestPath?.capture_access ?? 0,
        site_claim: statsData.byRequestPath?.site_claim ?? 0,
      },
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
