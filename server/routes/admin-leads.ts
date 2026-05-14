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
import {
  approveAction,
  rejectAction,
  retryFailedAction,
} from "../agents/action-executor";
import type {
  DerivedAssetsAttachment,
  DeploymentReadinessSummary,
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
} from "../types/inbound-request";
import { parseGsUri, sceneDashboardSchema } from "../utils/pipeline-dashboard";
import { hasAnyRole } from "../utils/access-control";
import { runWaitlistAutomationLoop } from "../utils/waitlistAutomation";
import { buildGrowthIntegrationSummary } from "../utils/provider-status";
import { getAgentRuntimeConnectionMetadata } from "../agents/runtime-connectivity";
import { isAutomationLaneEnabled, isTruthyEnvValue } from "../config/env";
import { buildLaunchReadinessSnapshot } from "../utils/launch-readiness";
import { logGrowthEvent } from "../utils/growth-events";
import { collectCityLaunchScorecard } from "../utils/cityLaunchScorecard";
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

const ACTION_LEDGER_QUERY_STATUSES = [
  "pending_approval",
  "failed",
  "sent",
  "operator_rejected",
  "rejected",
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
  };
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

function parseGrowthEventTimestamp(value: unknown) {
  const timestamp = value as { toDate?: () => Date } | string | null | undefined;
  if (!timestamp) return null;
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const resolved = timestamp.toDate?.();
  return resolved && !Number.isNaN(resolved.getTime()) ? resolved : null;
}

function normalizeDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
  const deploymentReadiness = normalizeDeploymentReadiness(decrypted.deployment_readiness);
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
          },
          owner: decrypted.owner,
          ops_automation: normalizeOpsAutomationEnvelope(decrypted.ops_automation),
          structured_intake: decrypted.structured_intake,
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
            proof_path: normalizeProofPathMilestones(decrypted.ops?.proof_path),
          },
          pipeline: decrypted.pipeline,
          derived_assets: decrypted.derived_assets,
          deployment_readiness: decrypted.deployment_readiness,
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
      : ["pending_approval", "failed"];

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

    const items = sortActionQueueItems(snapshots.flat()).filter((item) =>
      lane ? item.lane === lane : true,
    );
    const limitedItems = items.slice(0, limitNum);

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

router.post(
  "/action-queue/:ledgerId/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const ledgerId = req.params.ledgerId?.trim();
      if (!ledgerId) {
        return res.status(400).json({ error: "Missing ledger id" });
      }

      const result = await approveAction(ledgerId, getOperatorEmail(res));
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
        details: decrypted.request.details,
      },
      owner: decrypted.owner,
      ops_automation: normalizeOpsAutomationEnvelope(decrypted.ops_automation),
      structured_intake: decrypted.structured_intake,
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
        proof_path: normalizeProofPathMilestones(decrypted.ops?.proof_path),
      },
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

    const current = (doc.data() as Record<string, unknown>) || {};
    const previousData = normalizeDecryptedRequest(
      (await decryptInboundRequestForAdmin(
        doc.data() as InboundRequestStored,
      )) as InboundRequest,
    );
    const currentOps =
      current.ops && typeof current.ops === "object"
        ? (current.ops as Record<string, unknown>)
        : {};
    const currentProofPath =
      currentOps.proof_path && typeof currentOps.proof_path === "object"
        ? (currentOps.proof_path as Record<string, unknown>)
        : {};
    const buyer_review_url = buildBuyerReviewUrl(requestId);
    await docRef.update({
      buyer_review_access: {
        buyer_review_url,
        token_issued_at: admin.firestore.FieldValue.serverTimestamp(),
        last_sent_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      ops: {
        ...currentOps,
        proof_path: {
          ...currentProofPath,
          hosted_review_ready_at:
            currentProofPath.hosted_review_ready_at
            ?? admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (previousData.request.buyerType === "robot_team") {
      const user = res.locals.firebaseUser!;
      await logGrowthEvent({
        event: "hosted_review_ready",
        source: "server:admin_leads_review_link",
        properties: {
          request_id: requestId,
          city: previousData.context?.demandCity || null,
          hosted_mode: "review_link",
          review_path: "buyer_review_url",
          buyer_segment: previousData.contact?.roleTitle || null,
        },
        attribution: buildDemandAttributionForEvent(previousData),
        user: {
          uid: user.uid || null,
          email: user.email || null,
        },
      }).catch(() => null);
    }

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

router.get("/growth-scorecard", requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const periodDays = Math.min(
      Math.max(parseInt(typeof req.query.days === "string" ? req.query.days : "30", 10) || 30, 7),
      90,
    );
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (periodDays - 1));

    const growthEventsSnapshot = await db
      .collection("growth_events")
      .where("created_at", ">=", from)
      .orderBy("created_at", "desc")
      .limit(2500)
      .get();

    const eventsByDay = new Map<string, {
      views: number;
      contactStarts: number;
      contactSubmissions: number;
      contactCompleted: number;
      voiceStarts: number;
      voiceCompleted: number;
    }>();
    const experimentMap = new Map<string, { exposures: number; variants: Record<string, number> }>();
    const campaignMap = new Map<
      string,
      { views: number; contactStarts: number; contactSubmissions: number; contactCompleted: number }
    >();
    const homeRobotTeamExperimentKey = "home_robot_team_conversion_v1";
    const homeRobotTeamVariantMap = new Map<
      string,
      {
        views: number;
        sectionViews: number;
        ctaClicks: number;
        contactStarts: number;
        contactSubmissions: number;
        contactCompleted: number;
      }
    >();

    let exactSiteViews = 0;
    let exactSiteContactStarts = 0;
    let exactSiteContactSubmissions = 0;
    let exactSiteContactCompleted = 0;
    let homeRobotTeamViews = 0;
    let homeRobotTeamSectionViews = 0;
    let homeRobotTeamCtaClicks = 0;
    let homeRobotTeamContactStarts = 0;
    let homeRobotTeamContactSubmissions = 0;
    let homeRobotTeamContactCompleted = 0;
    let voiceStarts = 0;
    let voiceCompleted = 0;

    for (const doc of growthEventsSnapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const event = typeof data.event === "string" ? data.event : "";
      const properties =
        data.properties && typeof data.properties === "object"
          ? (data.properties as Record<string, unknown>)
          : {};
      const attribution =
        data.attribution && typeof data.attribution === "object"
          ? (data.attribution as Record<string, unknown>)
          : {};
      const attributionUtm =
        attribution.utm && typeof attribution.utm === "object"
          ? (attribution.utm as Record<string, unknown>)
          : {};
      const assignments =
        data.experiments && typeof data.experiments === "object"
          ? (data.experiments as Record<string, unknown>)
          : {};
      const homeVariant =
        typeof properties.variant_id === "string"
          ? properties.variant_id
          : typeof assignments[homeRobotTeamExperimentKey] === "string"
            ? String(assignments[homeRobotTeamExperimentKey])
            : "unassigned";
      const homeBucket = homeRobotTeamVariantMap.get(homeVariant) || {
        views: 0,
        sectionViews: 0,
        ctaClicks: 0,
        contactStarts: 0,
        contactSubmissions: 0,
        contactCompleted: 0,
      };
      const timestamp = parseGrowthEventTimestamp(data.created_at || data.created_at_iso);
      const dayKey = normalizeDateKey(timestamp || from);
      const daily = eventsByDay.get(dayKey) || {
        views: 0,
        contactStarts: 0,
        contactSubmissions: 0,
        contactCompleted: 0,
        voiceStarts: 0,
        voiceCompleted: 0,
      };
      const campaign =
        typeof properties.utm_campaign === "string"
          ? properties.utm_campaign
          : typeof attributionUtm.campaign === "string"
            ? attributionUtm.campaign
            : null;
      const isHostedReviewCampaign = campaign === "hosted_review_v1";

      if (event === "exact_site_review_view") {
        exactSiteViews += 1;
        daily.views += 1;
      }
      if (event === "home_hero_view") {
        homeRobotTeamViews += 1;
        homeBucket.views += 1;
      }
      if (event === "home_section_viewed") {
        homeRobotTeamSectionViews += 1;
        homeBucket.sectionViews += 1;
      }
      if (event === "home_conversion_cta_clicked") {
        homeRobotTeamCtaClicks += 1;
        homeBucket.ctaClicks += 1;
      }
      if (event === "contact_request_started" && isHostedReviewCampaign) {
        exactSiteContactStarts += 1;
        daily.contactStarts += 1;
      }
      if (event === "contact_request_submitted" && isHostedReviewCampaign) {
        exactSiteContactSubmissions += 1;
        daily.contactSubmissions += 1;
      }
      if (event === "contact_request_completed" && isHostedReviewCampaign) {
        exactSiteContactCompleted += 1;
        daily.contactCompleted += 1;
      }
      if (event === "contact_request_started" && assignments[homeRobotTeamExperimentKey]) {
        homeRobotTeamContactStarts += 1;
        homeBucket.contactStarts += 1;
      }
      if (event === "contact_request_submitted" && assignments[homeRobotTeamExperimentKey]) {
        homeRobotTeamContactSubmissions += 1;
        homeBucket.contactSubmissions += 1;
      }
      if (event === "contact_request_completed" && assignments[homeRobotTeamExperimentKey]) {
        homeRobotTeamContactCompleted += 1;
        homeBucket.contactCompleted += 1;
      }
      if (event === "voice_concierge_started") {
        voiceStarts += 1;
        daily.voiceStarts += 1;
      }
      if (event === "voice_concierge_completed") {
        voiceCompleted += 1;
        daily.voiceCompleted += 1;
      }

      if (campaign) {
        const bucket = campaignMap.get(campaign) || {
          views: 0,
          contactStarts: 0,
          contactSubmissions: 0,
          contactCompleted: 0,
        };
        if (event === "exact_site_review_view") bucket.views += 1;
        if (event === "contact_request_started") bucket.contactStarts += 1;
        if (event === "contact_request_submitted") bucket.contactSubmissions += 1;
        if (event === "contact_request_completed") bucket.contactCompleted += 1;
        campaignMap.set(campaign, bucket);
      }

      if (event === "experiment_exposure") {
        const experimentKey =
          typeof properties.experiment_key === "string" ? properties.experiment_key : "unknown";
        const variant =
          typeof properties.variant === "string" ? properties.variant : "unknown";
        const bucket = experimentMap.get(experimentKey) || {
          exposures: 0,
          variants: {},
        };
        bucket.exposures += 1;
        bucket.variants[variant] = (bucket.variants[variant] || 0) + 1;
        experimentMap.set(experimentKey, bucket);
      }

      if (
        homeBucket.views > 0
        || homeBucket.sectionViews > 0
        || homeBucket.ctaClicks > 0
        || homeBucket.contactStarts > 0
        || homeBucket.contactSubmissions > 0
        || homeBucket.contactCompleted > 0
      ) {
        homeRobotTeamVariantMap.set(homeVariant, homeBucket);
      }

      eventsByDay.set(dayKey, daily);
    }

    const hostedReviewQueueSnapshot = await db
      .collection("inboundRequests")
      .where("queue_key", "==", "exact_site_hosted_review_queue")
      .get();

    let currentQueueCount = 0;
    let highPriorityQueueCount = 0;
    let exactSiteRequiredCount = 0;
    let queueCreatedLast7d = 0;
    const workerDefinitions = [
      { key: "waitlist", enabled: isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED") },
      { key: "inbound_qualification", enabled: isAutomationLaneEnabled("BLUEPRINT_INBOUND_AUTOMATION_ENABLED") },
      { key: "support_triage", enabled: isAutomationLaneEnabled("BLUEPRINT_SUPPORT_TRIAGE_ENABLED") },
      { key: "payout_exception", enabled: isAutomationLaneEnabled("BLUEPRINT_PAYOUT_TRIAGE_ENABLED") },
      { key: "capturer_reminders", enabled: isAutomationLaneEnabled("BLUEPRINT_CAPTURER_REMINDER_ENABLED") },
      { key: "buyer_lifecycle", enabled: isAutomationLaneEnabled("BLUEPRINT_BUYER_LIFECYCLE_ENABLED") },
      { key: "lifecycle_cadence", enabled: isAutomationLaneEnabled("BLUEPRINT_LIFECYCLE_CADENCE_ENABLED") },
      { key: "experiment_rollout", enabled: isAutomationLaneEnabled("BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED") },
      { key: "autonomous_research_outbound", enabled: isAutomationLaneEnabled("BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED") },
      { key: "creative_asset_factory", enabled: isAutomationLaneEnabled("BLUEPRINT_CREATIVE_FACTORY_ENABLED") },
      { key: "site_access_overdue_watchdog", enabled: isAutomationLaneEnabled("BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED") },
      { key: "finance_review_overdue_watchdog", enabled: isAutomationLaneEnabled("BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED") },
      { key: "preview_diagnosis", enabled: isAutomationLaneEnabled("BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED") },
      { key: "sla_watchdog", enabled: isAutomationLaneEnabled("BLUEPRINT_SLA_WATCHDOG_ENABLED") },
      { key: "notion_sync", enabled: isAutomationLaneEnabled("BLUEPRINT_NOTION_SYNC_ENABLED") },
      { key: "graduation_eval", enabled: isAutomationLaneEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED") },
      { key: "onboarding_sequence", enabled: isAutomationLaneEnabled("BLUEPRINT_ONBOARDING_ENABLED") },
    ];
    const last7d = new Date();
    last7d.setDate(last7d.getDate() - 7);

    hostedReviewQueueSnapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      currentQueueCount += 1;
      if (data.priority === "high") {
        highPriorityQueueCount += 1;
      }
      if (data.request && typeof data.request === "object") {
        const request = data.request as Record<string, unknown>;
        if (request.proofPathPreference === "exact_site_required") {
          exactSiteRequiredCount += 1;
        }
      }
      const createdAt = parseGrowthEventTimestamp(data.createdAt);
      if (createdAt && createdAt >= last7d) {
        queueCreatedLast7d += 1;
      }
    });

    const workerStatusSnapshot = await db
      .collection("opsAutomationWorkerStatus")
      .get();
    const persistedWorkerStatuses = new Map(
      workerStatusSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]),
    );
    const workerStatuses = workerDefinitions.map(({ key, enabled }) => {
      const data = persistedWorkerStatuses.get(key) || {};
      return {
        workerKey: key,
        enabled,
        status:
          typeof data.status === "string"
            ? data.status
            : enabled
              ? "awaiting_first_run"
              : "disabled",
        intervalMs:
          typeof data.interval_ms === "number" ? data.interval_ms : null,
        batchSize:
          typeof data.batch_size === "number" ? data.batch_size : null,
        startupDelayMs:
          typeof data.startup_delay_ms === "number" ? data.startup_delay_ms : null,
        lastRunNumber:
          typeof data.last_run_number === "number" ? data.last_run_number : null,
        lastRunStartedAt:
          typeof data.last_run_started_at_iso === "string"
            ? data.last_run_started_at_iso
            : null,
        lastRunCompletedAt:
          typeof data.last_run_completed_at_iso === "string"
            ? data.last_run_completed_at_iso
            : null,
        lastRunDurationMs:
          typeof data.last_run_duration_ms === "number"
            ? data.last_run_duration_ms
            : null,
        lastProcessedCount:
          typeof data.last_processed_count === "number"
            ? data.last_processed_count
            : null,
        lastFailedCount:
          typeof data.last_failed_count === "number"
            ? data.last_failed_count
            : null,
        lastError:
          typeof data.last_error === "string" && data.last_error.trim().length > 0
            ? data.last_error
            : null,
      };
    });
    const integrationVerificationSnapshot = await db
      .collection("growthIntegrationVerifications")
      .orderBy("verified_at", "desc")
      .limit(1)
      .get();
    const latestIntegrationVerification = integrationVerificationSnapshot.empty
      ? null
      : (() => {
          const doc = integrationVerificationSnapshot.docs[0];
          const data = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            verifiedAt:
              typeof data.verified_at_iso === "string" ? data.verified_at_iso : null,
          };
        })();
    const creativeRunsSnapshot = await db
      .collection("creative_factory_runs")
      .orderBy("created_at", "desc")
      .limit(5)
      .get();
    const recentCreativeRuns = creativeRunsSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const remotionReel =
        data.remotion_reel && typeof data.remotion_reel === "object"
          ? (data.remotion_reel as Record<string, unknown>)
          : {};
      return {
        id: doc.id,
        status: typeof data.status === "string" ? data.status : "unknown",
        skuName: typeof data.sku_name === "string" ? data.sku_name : "Unknown SKU",
        createdAt: typeof data.created_at_iso === "string" ? data.created_at_iso : null,
        storageUri:
          typeof remotionReel.storage_uri === "string" ? remotionReel.storage_uri : null,
      };
    });

    const launchReadiness = buildLaunchReadinessSnapshot();

    return res.json({
      window: {
        days: periodDays,
        from: from.toISOString(),
        to: new Date().toISOString(),
      },
      funnel: {
        exactSiteViews,
        exactSiteContactStarts,
        exactSiteContactSubmissions,
        exactSiteContactCompleted,
        homeRobotTeamViews,
        homeRobotTeamSectionViews,
        homeRobotTeamCtaClicks,
        homeRobotTeamContactStarts,
        homeRobotTeamContactSubmissions,
        homeRobotTeamContactCompleted,
        voiceStarts,
        voiceCompleted,
      },
      homeRobotTeamLanding: {
        experimentKey: homeRobotTeamExperimentKey,
        conversionGoal: "structured_robot_team_intake",
        variants: [...homeRobotTeamVariantMap.entries()]
          .map(([variant, value]) => ({
            variant,
            ...value,
          }))
          .sort((left, right) => right.contactCompleted - left.contactCompleted),
      },
      queue: {
        currentHostedReviewItems: currentQueueCount,
        newHostedReviewLast7d: queueCreatedLast7d,
        highPriorityHostedReview: highPriorityQueueCount,
        exactSiteRequiredSubmitted: exactSiteRequiredCount,
      },
      experiments: [...experimentMap.entries()].map(([experimentKey, value]) => ({
        experimentKey,
        exposures: value.exposures,
        variants: value.variants,
      })),
      campaigns: [...campaignMap.entries()]
        .map(([campaignName, value]) => ({
          campaignName,
          ...value,
        }))
        .sort((left, right) => right.contactSubmissions - left.contactSubmissions)
        .slice(0, 10),
      eventsByDay: [...eventsByDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => ({
          date,
          ...value,
        })),
      operatorStatus: {
        providers: buildGrowthIntegrationSummary(),
        agentRuntime: getAgentRuntimeConnectionMetadata(),
        workers: workerStatuses,
        lastIntegrationVerification: latestIntegrationVerification,
        recentCreativeRuns,
        launchReadiness: {
          status: launchReadiness.status,
          blockers: launchReadiness.blockers,
          warnings: launchReadiness.warnings,
          checks: launchReadiness.checks,
          launchChecks: launchReadiness.dependencies.launchChecks,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching growth scorecard");
    return res.status(500).json({ error: "Failed to fetch growth scorecard" });
  }
});

router.get("/city-launch-scorecard", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const city =
      typeof _req.query.city === "string" && _req.query.city.trim().length > 0
        ? _req.query.city
        : "Austin, TX";
    return res.json(await collectCityLaunchScorecard(city));
  } catch (error) {
    logger.error({ error }, "Error fetching city-launch scorecard");
    return res.status(500).json({ error: "Failed to fetch city-launch scorecard" });
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
