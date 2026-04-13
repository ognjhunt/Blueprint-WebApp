import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { recordOpsActionLog } from "../agents/ops-action-logs";
import { logger } from "../logger";
import type {
  HumanBlockerCorrelation,
  HumanBlockerKind,
  HumanBlockerReviewStatus,
  HumanBlockerThreadStatus,
  HumanReplyChannel,
  HumanReplyClassification,
  HumanReplyResolution,
  HumanResumeActionKind,
} from "./human-reply-routing";

const THREAD_COLLECTION = "humanBlockerThreads";
const EVENT_COLLECTION = "humanReplyEvents";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
    ),
  );
}

export type HumanBlockerThreadRecord = {
  id: string;
  blocker_id: string;
  title: string;
  summary: string | null;
  blocker_kind: HumanBlockerKind;
  channel: HumanReplyChannel;
  channel_target: string;
  status: HumanBlockerThreadStatus;
  approved_identity: string | null;
  routing_owner: string;
  execution_owner: string;
  escalation_owner: string | null;
  review_owner: string | null;
  sender_owner: string | null;
  review_status: HumanBlockerReviewStatus;
  review_requested_at: string | null;
  review_completed_at: string | null;
  resume_action: {
    kind: HumanResumeActionKind;
    description: string;
    metadata: Record<string, unknown>;
  };
  record_of_truth: {
    report_paths: string[];
    paperclip_issue_id: string | null;
    ops_work_item_id: string | null;
  };
  correlation: HumanBlockerCorrelation;
  last_human_reply_at: string | null;
  last_human_reply_event_id: string | null;
  last_human_reply_summary: string | null;
  last_classification: HumanReplyClassification | null;
  last_resolution: HumanReplyResolution | null;
  last_routed_owner: string | null;
  last_resume_requested_at: string | null;
  last_dispatch_id: string | null;
  blocked_reason: string | null;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
};

export type HumanReplyEventRecord = {
  id: string;
  blocker_id: string;
  channel: HumanReplyChannel;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string;
  body_excerpt: string;
  received_at: string;
  external_message_id: string;
  external_thread_id: string | null;
  classification: HumanReplyClassification;
  resolution: HumanReplyResolution;
  routing_owner: string;
  execution_owner: string;
  escalation_owner: string | null;
  should_resume_now: boolean;
  reason: string;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
};

export async function getHumanBlockerThread(blockerId: string) {
  if (!db || !blockerId) {
    return null;
  }

  const doc = await db.collection(THREAD_COLLECTION).doc(blockerId).get();
  return doc.exists ? (doc.data() as HumanBlockerThreadRecord) : null;
}

export async function listOpenHumanBlockerThreads(limit = 100) {
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection(THREAD_COLLECTION)
    .where("status", "in", ["awaiting_review", "awaiting_reply", "reply_recorded", "ambiguous", "routed"])
    .limit(Math.max(1, Math.min(limit, 200)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as HumanBlockerThreadRecord);
}

export async function upsertHumanBlockerThread(input: {
  blocker_id?: string;
  title: string;
  summary?: string | null;
  blocker_kind: HumanBlockerKind;
  channel: HumanReplyChannel;
  channel_target: string;
  status?: HumanBlockerThreadStatus;
  approved_identity?: string | null;
  routing_owner: string;
  execution_owner: string;
  escalation_owner?: string | null;
  review_owner?: string | null;
  sender_owner?: string | null;
  review_status?: HumanBlockerReviewStatus;
  review_requested_at?: string | null;
  review_completed_at?: string | null;
  resume_action: {
    kind: HumanResumeActionKind;
    description: string;
    metadata?: Record<string, unknown>;
  };
  record_of_truth?: {
    report_paths?: string[];
    paperclip_issue_id?: string | null;
    ops_work_item_id?: string | null;
  };
  correlation?: Partial<HumanBlockerCorrelation>;
  last_dispatch_id?: string | null;
  blocked_reason?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const blockerId = normalizeString(input.blocker_id) || crypto.randomUUID();
  const existing = await getHumanBlockerThread(blockerId);
  const record: HumanBlockerThreadRecord = {
    id: blockerId,
    blocker_id: blockerId,
    title: input.title.trim(),
    summary: normalizeString(input.summary) || null,
    blocker_kind: input.blocker_kind,
    channel: input.channel,
    channel_target: input.channel_target.trim(),
    status: input.status || existing?.status || "awaiting_reply",
    approved_identity: normalizeString(input.approved_identity) || null,
    routing_owner: input.routing_owner.trim(),
    execution_owner: input.execution_owner.trim(),
    escalation_owner: normalizeString(input.escalation_owner) || null,
    review_owner: normalizeString(input.review_owner) || existing?.review_owner || null,
    sender_owner: normalizeString(input.sender_owner) || existing?.sender_owner || null,
    review_status:
      input.review_status
      || existing?.review_status
      || (input.status === "awaiting_review" ? "awaiting_review" : "not_required"),
    review_requested_at:
      normalizeString(input.review_requested_at)
      || existing?.review_requested_at
      || (input.status === "awaiting_review" ? new Date().toISOString() : null),
    review_completed_at:
      normalizeString(input.review_completed_at)
      || existing?.review_completed_at
      || null,
    resume_action: {
      kind: input.resume_action.kind,
      description: input.resume_action.description.trim(),
      metadata: stripUndefinedDeep(input.resume_action.metadata || {}),
    },
    record_of_truth: {
      report_paths: normalizeStringArray(input.record_of_truth?.report_paths)
        .concat(existing?.record_of_truth?.report_paths || [])
        .filter((value, index, values) => values.indexOf(value) === index),
      paperclip_issue_id:
        normalizeString(input.record_of_truth?.paperclip_issue_id)
        || existing?.record_of_truth?.paperclip_issue_id
        || null,
      ops_work_item_id:
        normalizeString(input.record_of_truth?.ops_work_item_id)
        || existing?.record_of_truth?.ops_work_item_id
        || null,
    },
    correlation: {
      blocker_id: blockerId,
      outbound_subject:
        normalizeString(input.correlation?.outbound_subject)
        || existing?.correlation?.outbound_subject
        || null,
      gmail_thread_id:
        normalizeString(input.correlation?.gmail_thread_id)
        || existing?.correlation?.gmail_thread_id
        || null,
      gmail_message_id:
        normalizeString(input.correlation?.gmail_message_id)
        || existing?.correlation?.gmail_message_id
        || null,
      slack_thread_id:
        normalizeString(input.correlation?.slack_thread_id)
        || existing?.correlation?.slack_thread_id
        || null,
      external_message_id:
        normalizeString(input.correlation?.external_message_id)
        || existing?.correlation?.external_message_id
        || null,
    },
    last_human_reply_at: existing?.last_human_reply_at || null,
    last_human_reply_event_id: existing?.last_human_reply_event_id || null,
    last_human_reply_summary: existing?.last_human_reply_summary || null,
    last_classification: existing?.last_classification || null,
    last_resolution: existing?.last_resolution || null,
    last_routed_owner: existing?.last_routed_owner || null,
    last_resume_requested_at: existing?.last_resume_requested_at || null,
    last_dispatch_id:
      normalizeString(input.last_dispatch_id) || existing?.last_dispatch_id || null,
    blocked_reason: normalizeString(input.blocked_reason) || existing?.blocked_reason || null,
    created_at: existing?.created_at || nowTimestamp(),
    updated_at: nowTimestamp(),
  };

  await db.collection(THREAD_COLLECTION).doc(blockerId).set(stripUndefinedDeep(record), {
    merge: true,
  });

  await recordOpsActionLog({
    session_id: null,
    run_id: null,
    session_key: `human-blocker:${blockerId}`,
    action_key: "human.blocker.upsert",
    status: "completed",
    summary: `Upserted human blocker thread ${blockerId}`,
    provider: null,
    runtime: null,
    task_kind: "operator_thread",
    risk_level: "medium",
    reversible: true,
    requires_approval: false,
    metadata: {
      blocker_id: blockerId,
      channel: input.channel,
      target: input.channel_target,
    },
  });

  return (await getHumanBlockerThread(blockerId)) || record;
}

export async function recordHumanReplyEvent(
  input: Omit<HumanReplyEventRecord, "id" | "created_at">,
) {
  if (!db) {
    throw new Error("Database not available");
  }

  const eventId = `${input.channel}:${input.external_message_id}`;
  const ref = db.collection(EVENT_COLLECTION).doc(eventId);
  const existing = await ref.get();
  if (existing.exists) {
    return existing.data() as HumanReplyEventRecord;
  }

  const record: HumanReplyEventRecord = {
    ...input,
    id: eventId,
    created_at: nowTimestamp(),
  };
  await ref.set(stripUndefinedDeep(record));

  await recordOpsActionLog({
    session_id: null,
    run_id: null,
    session_key: `human-blocker:${input.blocker_id}`,
    action_key: "human.reply.record",
    status: "completed",
    summary: `Recorded human reply event ${eventId}`,
    provider: null,
    runtime: null,
    task_kind: "operator_thread",
    risk_level: "medium",
    reversible: true,
    requires_approval: false,
    metadata: {
      blocker_id: input.blocker_id,
      classification: input.classification,
      resolution: input.resolution,
      execution_owner: input.execution_owner,
      routing_owner: input.routing_owner,
    },
  });

  return record;
}

export async function applyHumanReplyThreadUpdate(input: {
  blocker_id: string;
  event_id: string;
  received_at: string;
  body_excerpt: string;
  classification: HumanReplyClassification;
  resolution: HumanReplyResolution;
  routed_owner: string;
  should_resume_now: boolean;
  blocked_reason?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const status: HumanBlockerThreadStatus =
    input.resolution === "resolved_input"
      ? input.should_resume_now
        ? "routed"
        : "reply_recorded"
      : "ambiguous";

  await db.collection(THREAD_COLLECTION).doc(input.blocker_id).set(
    {
      status,
      last_human_reply_at: input.received_at,
      last_human_reply_event_id: input.event_id,
      last_human_reply_summary: input.body_excerpt,
      last_classification: input.classification,
      last_resolution: input.resolution,
      last_routed_owner: input.routed_owner,
      last_resume_requested_at: input.should_resume_now ? input.received_at : null,
      blocked_reason: normalizeString(input.blocked_reason) || null,
      updated_at: nowTimestamp(),
    },
    { merge: true },
  );
}

export async function getHumanReplyEvent(eventId: string) {
  if (!db || !eventId) {
    return null;
  }
  const doc = await db.collection(EVENT_COLLECTION).doc(eventId).get();
  return doc.exists ? (doc.data() as HumanReplyEventRecord) : null;
}

export async function noteHumanReplyThreadBlocker(input: {
  blocker_id: string;
  reason: string;
}) {
  if (!db) {
    logger.warn({ blockerId: input.blocker_id, reason: input.reason }, "Skipping human reply blocker note because DB is unavailable");
    return;
  }

  await db.collection(THREAD_COLLECTION).doc(input.blocker_id).set(
    {
      status: "blocked",
      blocked_reason: input.reason.trim(),
      updated_at: nowTimestamp(),
    },
    { merge: true },
  );
}
