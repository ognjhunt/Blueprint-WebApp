import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { InboundRequest } from "../types/inbound-request";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import { runAgentTask } from "./runtime";
import type { InboundQualificationOutput } from "./tasks/inbound-qualification";
import type { PreviewDiagnosisInput } from "./tasks/preview-diagnosis";
import type {
  PostSignupSchedulingTaskInput,
  PostSignupSchedulingOutput,
} from "./tasks/post-signup-scheduling";
import type { PayoutExceptionInput } from "./tasks/payout-exception-triage";
import type { SupportTriageInput } from "./tasks/support-triage";
import type {
  WaitlistTriageOutput,
  WaitlistTriageTaskInput,
} from "./tasks/waitlist-triage";

type WaitlistSubmissionRecord = {
  id: string;
  email: string;
  email_domain: string;
  location_type: string;
  market: string;
  market_normalized: string;
  role: string;
  role_normalized: string;
  device: string;
  device_normalized: string;
  phone: string;
  source: string;
  status: string;
  queue: string;
  intent: string;
  filter_tags: string[];
  created_at: FirebaseFirestore.Timestamp | string | null;
  updated_at: FirebaseFirestore.Timestamp | string | null;
  ops_automation: Record<string, unknown>;
};

type WaitlistMarketContext = {
  sameMarketCount: number;
  sameMarketDeviceCount: number;
  sameMarketPendingCount: number;
  sameRoleCount: number;
  recentExamples: Array<{
    market: string;
    device: string;
    status: string;
    queue: string;
  }>;
};

export type WaitlistAutomationRunResult = {
  submissionId: string;
  status: "processed" | "failed";
  automationStatus?: "completed" | "blocked";
  recommendation?: WaitlistTriageOutput["recommendation"];
  recommendedQueue?: string;
  inviteReadinessScore?: number;
  requiresHumanReview?: boolean;
  error?: string;
};

function normalizeAutomationStatus(value: unknown): "completed" | "blocked" {
  return value === "blocked" ? "blocked" : "completed";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function timestampToMs(value: unknown): number | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().getTime();
    }

    if (typeof maybeTimestamp.seconds === "number") {
      return (
        maybeTimestamp.seconds * 1000 +
        Math.floor((maybeTimestamp.nanoseconds || 0) / 1_000_000)
      );
    }
  }

  return null;
}

function isOlderThanHours(value: unknown, ageHours: number, nowMs = Date.now()) {
  const timestampMs = timestampToMs(value);
  if (timestampMs === null) {
    return false;
  }

  return nowMs - timestampMs >= ageHours * 60 * 60 * 1000;
}

function normalizeWaitlistSubmission(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
): WaitlistSubmissionRecord | null {
  const data = doc.data() as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }

  return {
    id: doc.id,
    email: typeof data.email === "string" ? data.email : "",
    email_domain: typeof data.email_domain === "string" ? data.email_domain : "",
    location_type: typeof data.location_type === "string" ? data.location_type : "",
    market: typeof data.market === "string" ? data.market : "",
    market_normalized:
      typeof data.market_normalized === "string" ? data.market_normalized : "",
    role: typeof data.role === "string" ? data.role : "",
    role_normalized:
      typeof data.role_normalized === "string" ? data.role_normalized : "",
    device: typeof data.device === "string" ? data.device : "",
    device_normalized:
      typeof data.device_normalized === "string" ? data.device_normalized : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    source: typeof data.source === "string" ? data.source : "",
    status: typeof data.status === "string" ? data.status : "new",
    queue: typeof data.queue === "string" ? data.queue : "",
    intent: typeof data.intent === "string" ? data.intent : "",
    filter_tags: Array.isArray(data.filter_tags)
      ? data.filter_tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    created_at:
      typeof data.created_at === "string" ||
      typeof data.created_at === "object" ||
      data.created_at === null
        ? (data.created_at as FirebaseFirestore.Timestamp | string | null)
        : null,
    updated_at:
      typeof data.updated_at === "string" ||
      typeof data.updated_at === "object" ||
      data.updated_at === null
        ? (data.updated_at as FirebaseFirestore.Timestamp | string | null)
        : null,
    ops_automation:
      data.ops_automation && typeof data.ops_automation === "object"
        ? (data.ops_automation as Record<string, unknown>)
        : {},
  };
}

async function buildWaitlistMarketContext(
  submission: WaitlistSubmissionRecord,
): Promise<WaitlistMarketContext> {
  if (!db) {
    return {
      sameMarketCount: 0,
      sameMarketDeviceCount: 0,
      sameMarketPendingCount: 0,
      sameRoleCount: 0,
      recentExamples: [],
    };
  }

  const sameRoleSnapshot = await db
    .collection("waitlistSubmissions")
    .where("role_normalized", "==", submission.role_normalized || "capturer")
    .limit(100)
    .get();

  const sameRoleRecords = sameRoleSnapshot.docs
    .map((doc) => normalizeWaitlistSubmission(doc))
    .filter((item): item is WaitlistSubmissionRecord => Boolean(item));

  const sameMarketRecords = submission.market_normalized
    ? sameRoleRecords.filter((record) => record.market_normalized === submission.market_normalized)
    : [];

  return {
    sameMarketCount: sameMarketRecords.length,
    sameMarketDeviceCount: sameMarketRecords.filter(
      (record) => record.device_normalized === submission.device_normalized,
    ).length,
    sameMarketPendingCount: sameMarketRecords.filter(
      (record) => record.status === "new" || record.queue === "capturer_beta_review",
    ).length,
    sameRoleCount: sameRoleRecords.length,
    recentExamples: sameRoleRecords.slice(0, 8).map((record) => ({
      market: record.market,
      device: record.device,
      status: record.status,
      queue: record.queue,
    })),
  };
}

function nextWaitlistStatus(
  recommendation: WaitlistTriageOutput["recommendation"],
  automationStatus: "completed" | "blocked",
) {
  if (automationStatus === "blocked") {
    return "follow_up_required";
  }

  switch (recommendation) {
    case "invite_now":
      return "invite_ready";
    case "hold_for_market":
      return "on_hold";
    case "request_follow_up":
      return "follow_up_required";
    case "decline_for_now":
      return "deferred";
  }
}

export async function runWaitlistAutomationLoop(params?: {
  submissionId?: string;
  limit?: number;
  queue?: string;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (params?.submissionId) {
    const doc = await db.collection("waitlistSubmissions").doc(params.submissionId).get();
    if (!doc.exists) {
      throw new Error("Waitlist submission not found");
    }
    docs = [doc as FirebaseFirestore.QueryDocumentSnapshot];
  } else {
    const snapshot = await db
      .collection("waitlistSubmissions")
      .where("queue", "==", params?.queue || "capturer_beta_review")
      .where("status", "==", "new")
      .limit(Math.min(params?.limit ?? 10, 25))
      .get();
    docs = snapshot.docs;
  }

  const results: WaitlistAutomationRunResult[] = [];

  for (const doc of docs) {
    const submission = normalizeWaitlistSubmission(doc);
    if (!submission) {
      continue;
    }

    const automationStatus = asString(submission.ops_automation.status);
    if (!params?.submissionId && automationStatus && !["pending", "failed"].includes(automationStatus)) {
      continue;
    }

    try {
      await doc.ref.set(
        {
          ops_automation: {
            ...(submission.ops_automation || {}),
            status: "running",
            provider: "openclaw",
            runtime: "openclaw",
            tool_mode: "api",
            last_error: null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
            session_key: `waitlist:${submission.id}`,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const marketContext = await buildWaitlistMarketContext(submission);
      const taskInput: WaitlistTriageTaskInput = {
        submission: {
          id: submission.id,
          email: submission.email,
          email_domain: submission.email_domain,
          location_type: submission.location_type,
          market: submission.market,
          role: submission.role,
          device: submission.device,
          phone_present: Boolean(submission.phone),
          source: submission.source,
          status: submission.status,
          queue: submission.queue,
          filter_tags: submission.filter_tags,
        },
        market_context: marketContext,
      };

      const result = await runAgentTask<
        WaitlistTriageTaskInput,
        WaitlistTriageOutput
      >({
        kind: "waitlist_triage",
        input: taskInput,
        session_key: `waitlist:${submission.id}`,
        metadata: {
          submission_id: submission.id,
        },
      });

      if (result.status !== "completed" || !result.output) {
        throw new Error(result.error || "Waitlist automation did not complete");
      }

      const automationStatus = normalizeAutomationStatus(
        result.output.automation_status,
      );
      const nextStatus = nextWaitlistStatus(result.output.recommendation, automationStatus);

      await doc.ref.set(
        {
          status: nextStatus,
          queue: result.output.recommended_queue,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          human_review_required: result.output.requires_human_review,
          automation_confidence: result.output.confidence,
          ops_automation: {
            ...(submission.ops_automation || {}),
            status: automationStatus,
            version: "waitlist_v3",
            provider: result.provider,
            runtime: result.runtime,
            model: result.model,
            tool_mode: result.tool_mode,
            execution_id: `${submission.id}:${Date.now()}`,
            session_key: `waitlist:${submission.id}`,
            next_action: result.output.next_action,
            recommended_path: result.output.recommended_queue,
            eligible_for_ai_triage: true,
            last_error: null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
            confidence: result.output.confidence,
            market_fit_score: result.output.market_fit_score,
            device_fit_score: result.output.device_fit_score,
            invite_readiness_score: result.output.invite_readiness_score,
            recommendation: result.output.recommendation,
            rationale: result.output.rationale,
            market_summary: result.output.market_summary,
            requires_human_review: result.output.requires_human_review,
            block_reason_code: result.output.block_reason_code,
            retryable: result.output.retryable,
            market_context: marketContext,
            draft_email: result.output.draft_email,
          },
        },
        { merge: true },
      );

      results.push({
        submissionId: submission.id,
        status: "processed",
        automationStatus,
        recommendation: result.output.recommendation,
        recommendedQueue: result.output.recommended_queue,
        inviteReadinessScore: result.output.invite_readiness_score,
        requiresHumanReview: result.output.requires_human_review,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown waitlist automation error";

      await doc.ref.set(
        {
          ops_automation: {
            ...(submission.ops_automation || {}),
            status: "failed",
            last_error: message,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      logger.error({ err: error, submissionId: submission.id }, "Waitlist automation failed");

      results.push({
        submissionId: submission.id,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    ok: true,
    processedCount: results.filter((item) => item.status === "processed").length,
    failedCount: results.filter((item) => item.status === "failed").length,
    results,
  };
}

function extractInboundQualificationInput(request: InboundRequest) {
  return {
    requestId: request.requestId,
    priority: request.priority,
    buyerType: request.request.buyerType,
    requestedLanes: request.request.requestedLanes,
    budgetBucket: request.request.budgetBucket,
    company: request.contact.company,
    roleTitle: request.contact.roleTitle || "",
    siteName: request.request.siteName,
    siteLocation: request.request.siteLocation,
    taskStatement: request.request.taskStatement,
    workflowContext: request.request.workflowContext || null,
    operatingConstraints: request.request.operatingConstraints || null,
    privacySecurityConstraints:
      request.request.privacySecurityConstraints || null,
    knownBlockers: request.request.knownBlockers || null,
    targetRobotTeam: request.request.targetRobotTeam || null,
    captureRights: request.request.captureRights || null,
    derivedScenePermission: request.request.derivedScenePermission || null,
    datasetLicensingPermission: request.request.datasetLicensingPermission || null,
    payoutEligibility: request.request.payoutEligibility || null,
    details: request.request.details || null,
  };
}

export async function runInboundQualificationForRequest(
  request: InboundRequest,
) {
  if (!db) {
    throw new Error("Database not available");
  }

  const docRef = db.collection("inboundRequests").doc(request.requestId);

  await docRef.set(
    {
      human_review_required: null,
      automation_confidence: null,
      ops_automation: {
        ...(request.ops_automation || {}),
        status: "running",
        queue: request.ops_automation?.queue || "inbound_request_review",
        intent: request.ops_automation?.intent || "inbound_qualification",
        next_action: "generate qualification recommendation",
        provider: "openclaw",
        runtime: "openclaw",
        tool_mode: "api",
        session_key: `inbound:${request.requestId}`,
        last_error: null,
        last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  const result = await runAgentTask<
    ReturnType<typeof extractInboundQualificationInput>,
    InboundQualificationOutput
  >({
    kind: "inbound_qualification",
    input: extractInboundQualificationInput(request),
    session_key: `inbound:${request.requestId}`,
    metadata: {
      request_id: request.requestId,
    },
  });

  if (result.status !== "completed" || !result.output) {
    await docRef.set(
      {
        ops_automation: {
          ...(request.ops_automation || {}),
          status: "failed",
          provider: result.provider,
          runtime: result.runtime,
          model: result.model,
          tool_mode: result.tool_mode,
          last_error: result.error || "Inbound qualification failed",
          last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    throw new Error(result.error || "Inbound qualification failed");
  }

  const automationStatus = normalizeAutomationStatus(
    result.output.automation_status,
  );

  await docRef.set(
    {
      human_review_required: result.output.requires_human_review,
      automation_confidence: result.output.confidence,
      ops_automation: {
        ...(request.ops_automation || {}),
        status: automationStatus,
        queue: request.ops_automation?.queue || "inbound_request_review",
        intent: request.ops_automation?.intent || "inbound_qualification",
        next_action: result.output.next_action,
        recommended_path: result.output.qualification_state_recommendation,
        provider: result.provider,
        runtime: result.runtime,
        model: result.model,
        tool_mode: result.tool_mode,
        execution_id: `${request.requestId}:${Date.now()}`,
        session_key: `inbound:${request.requestId}`,
        confidence: result.output.confidence,
        requires_human_review: result.output.requires_human_review,
        block_reason_code: result.output.block_reason_code,
        retryable: result.output.retryable,
        qualification_state_recommendation:
          result.output.qualification_state_recommendation,
        opportunity_state_recommendation:
          result.output.opportunity_state_recommendation,
        missing_information: result.output.missing_information,
        internal_summary: result.output.internal_summary,
        buyer_follow_up: result.output.buyer_follow_up,
        rationale: result.output.rationale,
        last_error: null,
        last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
        processed_at: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  return result.output;
}

export async function runPostSignupSchedulingTask(
  input: PostSignupSchedulingTaskInput,
): Promise<PostSignupSchedulingOutput> {
  const result = await runAgentTask<
    PostSignupSchedulingTaskInput,
    PostSignupSchedulingOutput
  >({
    kind: "post_signup_scheduling",
    input,
    session_key: `post-signup:${input.blueprintId}`,
    metadata: {
      blueprint_id: input.blueprintId,
    },
  });

  if (result.status !== "completed" || !result.output) {
    throw new Error(result.error || "Post-signup scheduling failed");
  }

  return result.output;
}

export async function runInboundQualificationLoop(params?: { limit?: number }) {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db
    .collection("inboundRequests")
    .where("ops_automation.intent", "==", "inbound_qualification")
    .where("ops_automation.status", "in", ["pending", "failed"])
    .limit(Math.max(1, Math.min(params?.limit ?? 10, 25)))
    .get();

  let processedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const decrypted = (await decryptInboundRequestForAdmin(
        doc.data() as any,
      )) as InboundRequest;
      await runInboundQualificationForRequest({
        ...decrypted,
        requestId: decrypted.requestId || doc.id,
      });
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.error({ err: error, requestId: doc.id }, "Inbound qualification loop item failed");
    }
  }

  return {
    ok: true,
    processedCount,
    failedCount,
  };
}

const STALE_INTAKE_THRESHOLD_HOURS = 24;
const STALE_WAITLIST_STATUS = "follow_up_required";
const STALE_INBOUND_STATUS = "in_review";
const STALE_BLOCK_REASON_CODE = "stale_over_24h";
const STALE_NEXT_ACTION_WAITLIST = "Review stalled capturer application";
const STALE_NEXT_ACTION_INBOUND = "Review stalled buyer request";
const STALE_LAST_ERROR = "No status update for >24h";
const STALE_AUTOMATION_STATUSES = new Set(["pending", "running"]);

export async function runIntakeStaleScanLoop(params?: { limit?: number; ageHours?: number }) {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 25, 100));
  const ageHours = Math.max(1, params?.ageHours ?? STALE_INTAKE_THRESHOLD_HOURS);
  const nowMs = Date.now();

  let processedCount = 0;
  let failedCount = 0;

  const waitlistSnapshot = await db
    .collection("waitlistSubmissions")
    .where("queue", "==", "capturer_beta_review")
    .where("status", "==", "new")
    .limit(limit)
    .get();

  for (const doc of waitlistSnapshot.docs) {
    const submission = normalizeWaitlistSubmission(doc);
    if (!submission) {
      continue;
    }

    const automationStatus = asString(submission.ops_automation.status);
    if (!automationStatus || !STALE_AUTOMATION_STATUSES.has(automationStatus)) {
      continue;
    }

    const lastStatusUpdateAt =
      submission.ops_automation.last_attempt_at ??
      submission.updated_at ??
      submission.created_at;

    if (!isOlderThanHours(lastStatusUpdateAt, ageHours, nowMs)) {
      continue;
    }

    try {
      await doc.ref.set(
        {
          status: STALE_WAITLIST_STATUS,
          human_review_required: true,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          ops_automation: {
            ...(submission.ops_automation || {}),
            status: "stale",
            next_action: STALE_NEXT_ACTION_WAITLIST,
            last_error: STALE_LAST_ERROR,
            block_reason_code: STALE_BLOCK_REASON_CODE,
            retryable: true,
            requires_human_review: true,
          },
        },
        { merge: true },
      );
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.error(
        { err: error, submissionId: submission.id },
        "Failed to mark stale waitlist submission",
      );
    }
  }

  const inboundSnapshot = await db
    .collection("inboundRequests")
    .where("ops_automation.intent", "==", "inbound_qualification")
    .limit(limit)
    .get();

  for (const doc of inboundSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const automation =
      data.ops_automation && typeof data.ops_automation === "object"
        ? (data.ops_automation as Record<string, unknown>)
        : {};
    const automationStatus = asString(automation.status);

    if (!automationStatus || !STALE_AUTOMATION_STATUSES.has(automationStatus)) {
      continue;
    }

    const lastStatusUpdateAt =
      automation.last_attempt_at ?? data.updatedAt ?? data.createdAt;

    if (!isOlderThanHours(lastStatusUpdateAt, ageHours, nowMs)) {
      continue;
    }

    try {
      await doc.ref.set(
        {
          status: STALE_INBOUND_STATUS,
          qualification_state: STALE_INBOUND_STATUS,
          human_review_required: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ops: {
            ...(data.ops && typeof data.ops === "object" ? data.ops : {}),
            next_step: `${STALE_NEXT_ACTION_INBOUND}; no status update for >24h.`,
          },
          ops_automation: {
            ...automation,
            status: "stale",
            next_action: STALE_NEXT_ACTION_INBOUND,
            last_error: STALE_LAST_ERROR,
            block_reason_code: STALE_BLOCK_REASON_CODE,
            retryable: true,
            requires_human_review: true,
          },
        },
        { merge: true },
      );
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.error(
        { err: error, requestId: doc.id },
        "Failed to mark stale inbound request",
      );
    }
  }

  return {
    ok: true,
    processedCount,
    failedCount,
  };
}

export async function runSupportTriageLoop(params?: { limit?: number }) {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db
    .collection("contactRequests")
    .where("ops_automation.status", "in", ["pending", "failed"])
    .limit(Math.max(1, Math.min(params?.limit ?? 10, 25)))
    .get();

  let processedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const input: SupportTriageInput = {
      id: doc.id,
      requestSource: typeof data.requestSource === "string" ? data.requestSource : "contact_request",
      requesterName: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      company: typeof data.company === "string" ? data.company : "",
      city: typeof data.city === "string" ? data.city : "",
      state: typeof data.state === "string" ? data.state : "",
      companyWebsite: typeof data.companyWebsite === "string" ? data.companyWebsite : "",
      message: typeof data.message === "string" ? data.message : "",
      summary: typeof data.summary === "string" ? data.summary : "",
    };

    try {
      await doc.ref.set(
        {
          ops_automation: {
            ...(data.ops_automation && typeof data.ops_automation === "object"
              ? data.ops_automation
              : {}),
            status: "running",
            queue: "support_triage",
            intent: "support_triage",
            next_action: "triage contact request",
            provider: "openclaw",
            runtime: "openclaw",
            tool_mode: "api",
            session_key: `support:${doc.id}`,
            last_error: null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      const result = await runAgentTask<SupportTriageInput, any>({
        kind: "support_triage",
        input,
        session_key: `support:${doc.id}`,
        metadata: {
          contact_request_id: doc.id,
        },
      });

      if (result.status !== "completed" || !result.output) {
        throw new Error(result.error || "Support triage failed");
      }

      await doc.ref.set(
        {
          queue: result.output.queue,
          human_review_required: result.output.requires_human_review,
          automation_confidence: result.output.confidence,
          ops_automation: {
            ...(data.ops_automation && typeof data.ops_automation === "object"
              ? data.ops_automation
              : {}),
            status: normalizeAutomationStatus(result.output.automation_status),
            queue: result.output.queue,
            intent: "support_triage",
            next_action: result.output.next_action,
            recommended_path: result.output.category,
            provider: result.provider,
            runtime: result.runtime,
            model: result.model,
            tool_mode: result.tool_mode,
            execution_id: `${doc.id}:${Date.now()}`,
            session_key: `support:${doc.id}`,
            confidence: result.output.confidence,
            requires_human_review: result.output.requires_human_review,
            block_reason_code: result.output.block_reason_code,
            retryable: result.output.retryable,
            rationale: result.output.rationale,
            internal_summary: result.output.internal_summary,
            suggested_response: result.output.suggested_response,
            last_error: null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "Support triage failed";
      await doc.ref.set(
        {
          ops_automation: {
            ...(data.ops_automation && typeof data.ops_automation === "object"
              ? data.ops_automation
              : {}),
            status: "failed",
            last_error: message,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
      logger.error({ err: error, contactRequestId: doc.id }, "Support triage loop item failed");
    }
  }

  return { ok: true, processedCount, failedCount };
}

export async function runPayoutExceptionTriageLoop(params?: { limit?: number }) {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db
    .collection("creatorPayouts")
    .where("status", "in", ["review_required", "disbursement_failed"])
    .limit(Math.max(1, Math.min(params?.limit ?? 10, 25)))
    .get();

  let processedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const input: PayoutExceptionInput = {
      id: doc.id,
      creator_id: typeof data.creator_id === "string" ? data.creator_id : "",
      capture_id: typeof data.capture_id === "string" ? data.capture_id : "",
      status: typeof data.status === "string" ? data.status : "",
      stripe_payout_id:
        typeof data.stripe_payout_id === "string" ? data.stripe_payout_id : null,
      failure_reason:
        typeof data.failure_reason === "string" ? data.failure_reason : null,
      qualification_state:
        typeof data.qualification_state === "string" ? data.qualification_state : null,
      opportunity_state:
        typeof data.opportunity_state === "string" ? data.opportunity_state : null,
      recommendation:
        data.recommendation && typeof data.recommendation === "object"
          ? (data.recommendation as Record<string, unknown>)
          : null,
    };

    try {
      const result = await runAgentTask<PayoutExceptionInput, any>({
        kind: "payout_exception_triage",
        input,
        session_key: `payout:${doc.id}`,
        metadata: {
          payout_id: doc.id,
        },
      });

      if (result.status !== "completed" || !result.output) {
        throw new Error(result.error || "Payout exception triage failed");
      }

      await doc.ref.set(
        {
          human_review_required: result.output.requires_human_review,
          automation_confidence: result.output.confidence,
          ops_automation: {
            status: normalizeAutomationStatus(result.output.automation_status),
            queue: result.output.queue || "payout_exception_queue",
            intent: "payout_exception_triage",
            next_action: result.output.next_action,
            recommended_path: result.output.disposition,
            provider: result.provider,
            runtime: result.runtime,
            model: result.model,
            tool_mode: result.tool_mode,
            execution_id: `${doc.id}:${Date.now()}`,
            session_key: `payout:${doc.id}`,
            confidence: result.output.confidence,
            requires_human_review: result.output.requires_human_review,
            block_reason_code: result.output.block_reason_code,
            retryable: result.output.retryable,
            rationale: result.output.rationale,
            internal_summary: result.output.internal_summary,
            approval_reason: null,
            last_error: result.error || null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      await doc.ref.set(
        {
          ops_automation: {
            status: "failed",
            intent: "payout_exception_triage",
            last_error: error instanceof Error ? error.message : "Payout triage failed",
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
      logger.error({ err: error, payoutId: doc.id }, "Payout exception loop item failed");
    }
  }

  return { ok: true, processedCount, failedCount };
}

export async function runPreviewDiagnosisLoop(params?: { limit?: number }) {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db
    .collection("inboundRequests")
    .where("deployment_readiness.provider_run.status", "==", "failed")
    .limit(Math.max(1, Math.min(params?.limit ?? 10, 25)))
    .get();

  let processedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const decrypted = (await decryptInboundRequestForAdmin(doc.data() as any)) as InboundRequest;
    const deploymentReadiness =
      decrypted.deployment_readiness && typeof decrypted.deployment_readiness === "object"
        ? decrypted.deployment_readiness
        : {};
    const providerRun =
      deploymentReadiness.provider_run && typeof deploymentReadiness.provider_run === "object"
        ? deploymentReadiness.provider_run
        : {};
    const artifacts =
      decrypted.pipeline?.artifacts && typeof decrypted.pipeline.artifacts === "object"
        ? decrypted.pipeline.artifacts
        : {};

    const input: PreviewDiagnosisInput = {
      requestId: decrypted.requestId || doc.id,
      siteWorldId:
        typeof decrypted.pipeline?.scene_id === "string"
          ? decrypted.pipeline.scene_id
          : null,
      preview_status:
        typeof deploymentReadiness.preview_status === "string"
          ? deploymentReadiness.preview_status
          : null,
      provider_name:
        typeof providerRun.provider_name === "string" ? providerRun.provider_name : null,
      provider_model:
        typeof providerRun.provider_model === "string" ? providerRun.provider_model : null,
      provider_run_id:
        typeof providerRun.provider_run_id === "string"
          ? providerRun.provider_run_id
          : null,
      failure_reason:
        typeof providerRun.failure_reason === "string" ? providerRun.failure_reason : null,
      preview_manifest_uri:
        typeof providerRun.preview_manifest_uri === "string"
          ? providerRun.preview_manifest_uri
          : null,
      worldlabs_operation_manifest_uri:
        typeof artifacts.worldlabs_operation_manifest_uri === "string"
          ? artifacts.worldlabs_operation_manifest_uri
          : null,
      worldlabs_world_manifest_uri:
        typeof artifacts.worldlabs_world_manifest_uri === "string"
          ? artifacts.worldlabs_world_manifest_uri
          : null,
    };

    try {
      const result = await runAgentTask<PreviewDiagnosisInput, any>({
        kind: "preview_diagnosis",
        input,
        session_key: `preview:${doc.id}`,
        metadata: {
          request_id: doc.id,
        },
      });

      if (result.status !== "completed" || !result.output) {
        throw new Error(result.error || "Preview diagnosis failed");
      }

      await doc.ref.set(
        {
          human_review_required: result.output.requires_human_review,
          automation_confidence: result.output.confidence,
          ops_automation: {
            ...(decrypted.ops_automation || {}),
            status: normalizeAutomationStatus(result.output.automation_status),
            queue: result.output.queue,
            intent: "preview_diagnosis",
            next_action: result.output.next_action,
            recommended_path: result.output.disposition,
            provider: result.provider,
            runtime: result.runtime,
            model: result.model,
            tool_mode: result.tool_mode,
            execution_id: `${doc.id}:${Date.now()}`,
            session_key: `preview:${doc.id}`,
            confidence: result.output.confidence,
            requires_human_review: result.output.requires_human_review,
            block_reason_code: result.output.block_reason_code,
            retryable: result.output.retryable,
            rationale: result.output.rationale,
            internal_summary: result.output.internal_summary,
            retry_recommended: result.output.retry_recommended,
            last_error: null,
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      await doc.ref.set(
        {
          ops_automation: {
            ...(decrypted.ops_automation || {}),
            status: "failed",
            intent: "preview_diagnosis",
            last_error:
              error instanceof Error ? error.message : "Preview diagnosis failed",
            last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
      logger.error({ err: error, requestId: doc.id }, "Preview diagnosis loop item failed");
    }
  }

  return { ok: true, processedCount, failedCount };
}
