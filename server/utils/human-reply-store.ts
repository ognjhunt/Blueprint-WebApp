import crypto from "node:crypto";
import { automationBatch } from "./automationBatch";
import { humanDecisionBinding, humanDecisionDigest, humanReplyAdmissionError } from "./human-reply-admission";

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
  decision_expires_at?: string;
  decision_issued_at?: string;
  action_digest?: string | null;
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
  decision_context: {
    decision_type: string | null;
    irreversible_action_class: string | null;
    gate_mode: "universal_founder_inbox" | "repo_local_no_send";
    reason_category: string | null;
  };
  repo_context: {
    repo: string | null;
    project: string | null;
    issue_id: string | null;
    ops_work_item_id: string | null;
    source_ref: string | null;
  };
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
  binding?: string;
  message_digest?: string;
  resume_state?: "pending" | "running" | "completed" | "failed" | "unknown" | "rejected";
  resume_claim?: string;
  resume_started_at?: number;
  resume_reason?: string | null;
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
    .where("status", "in", ["awaiting_review", "awaiting_reply", "reply_recorded", "ambiguous", "routed", "blocked"])
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
  decision_context?: {
    decision_type?: string | null;
    irreversible_action_class?: string | null;
    gate_mode?: "universal_founder_inbox" | "repo_local_no_send";
    reason_category?: string | null;
  };
  repo_context?: {
    repo?: string | null;
    project?: string | null;
    issue_id?: string | null;
    ops_work_item_id?: string | null;
    source_ref?: string | null;
  };
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const blockerId = normalizeString(input.blocker_id) || crypto.randomUUID();
  const existing = await getHumanBlockerThread(blockerId);
  const action = input.record_of_truth?.ops_work_item_id
    ? (await db.collection("action_ledger").doc(input.record_of_truth.ops_work_item_id).get()).data() : null;
  const record: HumanBlockerThreadRecord = {
    decision_issued_at: existing?.decision_issued_at || new Date().toISOString(),
    decision_expires_at: existing?.decision_expires_at || new Date(Date.now() + 7 * 86400_000).toISOString(),
    action_digest: action ? humanDecisionDigest({ type: action.action_type, payload: action.action_payload }) : existing?.action_digest || null,
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
    decision_context: {
      decision_type:
        normalizeString(input.decision_context?.decision_type)
        || existing?.decision_context?.decision_type
        || null,
      irreversible_action_class:
        normalizeString(input.decision_context?.irreversible_action_class)
        || existing?.decision_context?.irreversible_action_class
        || null,
      gate_mode:
        input.decision_context?.gate_mode
        || existing?.decision_context?.gate_mode
        || "universal_founder_inbox",
      reason_category:
        normalizeString(input.decision_context?.reason_category)
        || existing?.decision_context?.reason_category
        || null,
    },
    repo_context: {
      repo:
        normalizeString(input.repo_context?.repo)
        || existing?.repo_context?.repo
        || null,
      project:
        normalizeString(input.repo_context?.project)
        || existing?.repo_context?.project
        || null,
      issue_id:
        normalizeString(input.repo_context?.issue_id)
        || existing?.repo_context?.issue_id
        || null,
      ops_work_item_id:
        normalizeString(input.repo_context?.ops_work_item_id)
        || existing?.repo_context?.ops_work_item_id
        || normalizeString(input.record_of_truth?.ops_work_item_id)
        || existing?.record_of_truth?.ops_work_item_id
        || null,
      source_ref:
        normalizeString(input.repo_context?.source_ref)
        || existing?.repo_context?.source_ref
        || null,
    },
    created_at: existing?.created_at || nowTimestamp(),
    updated_at: nowTimestamp(),
  };

  if (existing && humanDecisionBinding(existing) !== humanDecisionBinding(record)) {
    record.decision_issued_at = new Date().toISOString();
    record.decision_expires_at = new Date(Date.now() + 7 * 86400_000).toISOString();
    record.last_human_reply_event_id = null;
  }
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
  const record = await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const prior = existing.data() as HumanReplyEventRecord;
      if (prior.blocker_id !== input.blocker_id || prior.message_digest !== humanDecisionDigest({
        sender: input.sender, body: input.body, channel: input.channel, thread: input.external_thread_id,
      })) throw new Error("reply_event_conflict");
      return prior;
    }
    const threadRef = db!.collection(THREAD_COLLECTION).doc(input.blocker_id);
    const thread = (await tx.get(threadRef)).data() as HumanBlockerThreadRecord;
    const refusal = !thread ? "blocker_missing" : humanReplyAdmissionError(thread, input);
    if (refusal) throw new Error(refusal);
    const record: HumanReplyEventRecord = { ...input, id: eventId,
      binding: humanDecisionBinding(thread),
      message_digest: humanDecisionDigest({ sender: input.sender, body: input.body,
        channel: input.channel, thread: input.external_thread_id }),
      resume_state: input.should_resume_now ? "pending" : "rejected", created_at: nowTimestamp() };
    tx.create(ref, stripUndefinedDeep(record));
    // Arrival order is not decision order. Retain older messages, but never let
    // a delayed approval supersede a newer refusal.
    const received = Date.parse(input.received_at), previous = Date.parse(thread.last_human_reply_at || "");
    if (!Number.isFinite(previous) || received > previous
      || (received === previous && input.classification !== "approval")) {
      tx.set(threadRef, { last_human_reply_event_id: eventId, last_human_reply_at: input.received_at,
        updated_at: nowTimestamp() }, { merge: true });
    }
    return record;
  });

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

  await db.runTransaction(async tx => {
    const ref = db!.collection(THREAD_COLLECTION).doc(input.blocker_id);
    const current = (await tx.get(ref)).data();
    if (current?.last_human_reply_event_id !== input.event_id) return;
    tx.set(ref,
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
  });
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


/** Claim and recheck the current authority in the same transaction. */
export async function claimHumanReplyResume(eventId: string): Promise<string | null> {
  if (!db) throw new Error("Database not available");
  return db.runTransaction(async tx => {
    const ref = db!.collection(EVENT_COLLECTION).doc(eventId);
    const event = (await tx.get(ref)).data() as HumanReplyEventRecord | undefined;
    if (!event || event.resume_state !== "pending") return null;
    const threadRef = db!.collection(THREAD_COLLECTION).doc(event.blocker_id);
    const thread = (await tx.get(threadRef)).data() as HumanBlockerThreadRecord;
    const refusal = !thread ? "blocker_missing" : humanReplyAdmissionError(thread, event)
      || (event.binding !== humanDecisionBinding(thread) || thread.last_human_reply_event_id !== event.id ? "stale_revision" : null);
    if (refusal) {
      tx.update(ref, { resume_state: "rejected", resume_reason: refusal });
      return null;
    }
    if (thread.record_of_truth.ops_work_item_id) {
      const action = (await tx.get(db!.collection("action_ledger").doc(thread.record_of_truth.ops_work_item_id))).data();
      if (!action || !thread.action_digest || thread.action_digest !== humanDecisionDigest({ type: action.action_type, payload: action.action_payload })) {
        tx.update(ref, { resume_state: "rejected", resume_reason: "action_changed" }); return null;
      }
    }
    const claim = crypto.randomUUID();
    tx.update(ref, { resume_state: "running", resume_claim: claim, resume_started_at: Date.now() });
    return claim;
  });
}

export async function finishHumanReplyResume(eventId: string, claim: string,
  state: "completed" | "failed" | "unknown", reason: string | null = null) {
  if (!db) throw new Error("Database not available");
  await db.runTransaction(async tx => {
    const ref = db!.collection(EVENT_COLLECTION).doc(eventId);
    const event = (await tx.get(ref)).data() as HumanReplyEventRecord;
    if (event?.resume_claim !== claim) throw new Error("resume_claim_changed");
    tx.update(ref, { resume_state: state, resume_reason: reason, resume_projection_pending: state === "completed" });
  });
}

export async function listPendingHumanReplyEvents(limit = 50) {
  if (!db) return [];
  return (await db.collection(EVENT_COLLECTION).where("resume_state", "==", "pending").limit(limit).get())
    .docs.map(doc => doc.data() as HumanReplyEventRecord);
}

/** Reconcile a lost acknowledgement from the existing action's durable state.
 * Never repeat an executing/failed/unknown external effect to obtain certainty. */
export async function reconcileHumanReplyResumes(limit = 50) {
  if (!db) return;
  const rows = await automationBatch(db, db.collection(EVENT_COLLECTION).where("resume_state", "in", ["running", "unknown"]), "human_reply_reconciliation", limit);
  for (const row of rows.docs) await db.runTransaction(async tx => {
    const event = (await tx.get(row.ref)).data() as HumanReplyEventRecord;
    if (!event || !["running", "unknown"].includes(event.resume_state || "")
      || Date.now() - (event.resume_started_at || 0) < 300_000) return;
    const threadRef = db!.collection(THREAD_COLLECTION).doc(event.blocker_id);
    const thread = (await tx.get(threadRef)).data() as HumanBlockerThreadRecord;
    if (!thread || thread.last_human_reply_event_id !== event.id || event.binding !== humanDecisionBinding(thread)) {
      tx.update(row.ref, { resume_state: "rejected", resume_reason: "stale_revision" }); return;
    }
    const ledgerId = thread.record_of_truth.ops_work_item_id;
    if (!ledgerId) {
      tx.update(row.ref, { resume_state: "unknown", resume_reason: "action_outcome_unknown" }); return;
    }
    const action = (await tx.get(db!.collection("action_ledger").doc(ledgerId))).data();
    if (!action || humanDecisionDigest({ type: action.action_type, payload: action.action_payload }) !== thread.action_digest) {
      tx.update(row.ref, { resume_state: "rejected", resume_reason: "action_changed" }); return;
    }
    if (action.status === "sent") {
      tx.update(row.ref, { resume_state: "completed", resume_projection_pending: true, resume_reason: null });
    } else if (action.status === "pending_approval" && !humanReplyAdmissionError(thread, event)) {
      // The executor's compare-and-set proves that no execution was claimed.
      tx.update(row.ref, { resume_state: "pending", resume_reason: null });
    } else {
      tx.update(row.ref, { resume_state: "unknown", resume_reason: `action_outcome_${action.status}` });
    }
  });
}

export async function projectCompletedHumanReplies(resolve: (blockerId: string) => Promise<unknown>, limit = 50) {
  if (!db) return;
  const rows = await db.collection(EVENT_COLLECTION).where("resume_projection_pending", "==", true).limit(limit).get();
  for (const row of rows.docs) {
    const event = row.data() as HumanReplyEventRecord;
    const thread = await getHumanBlockerThread(event.blocker_id);
    if (event.resume_state !== "completed" || !thread || thread.last_human_reply_event_id !== event.id
      || event.binding !== humanDecisionBinding(thread)) continue;
    const resolved = await resolve(event.blocker_id);
    if (resolved) await row.ref.update({ resume_projection_pending: false });
  }
}
