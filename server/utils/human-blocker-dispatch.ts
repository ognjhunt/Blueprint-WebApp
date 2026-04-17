import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { recordOpsActionLog } from "../agents/ops-action-logs";
import { sendEmail } from "./email";
import { recordExternalGapReport, resolveExternalGapReport } from "./gap-closure";
import {
  renderHumanBlockerPacketEmailSubject,
  renderHumanBlockerPacketHtml,
  renderHumanBlockerPacketSlack,
  renderHumanBlockerPacketText,
  type HumanBlockerPacket,
} from "./human-blocker-packet";
import {
  APPROVED_HUMAN_REPLY_EMAIL,
  DEFAULT_HUMAN_REPLY_ROUTING_OWNER,
  DEFAULT_OPS_EXECUTION_OWNER,
  DEFAULT_TECHNICAL_ESCALATION_OWNER,
  DEFAULT_TECHNICAL_EXECUTION_OWNER,
  type HumanBlockerKind,
} from "./human-reply-routing";
import {
  type HumanBlockerThreadRecord,
  getHumanBlockerThread,
  upsertHumanBlockerThread,
} from "./human-reply-store";
import { sendSlackMessage } from "./slack";

const DISPATCH_COLLECTION = "humanBlockerDispatches";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
        : [],
    ),
  );
}

export type HumanBlockerDeliveryMode = "send_now" | "review_required" | "send_saved_draft";
export type HumanBlockerDeliveryStatus = "awaiting_review" | "sent" | "failed";

export type HumanBlockerDispatchRecord = {
  id: string;
  blocker_id: string;
  blocker_kind: HumanBlockerKind;
  title: string;
  delivery_mode: HumanBlockerDeliveryMode;
  delivery_status: HumanBlockerDeliveryStatus;
  email_target: string | null;
  email_subject: string | null;
  email_sent: boolean;
  slack_mirrored: boolean;
  slack_sent: boolean;
  routing_owner: string;
  execution_owner: string;
  escalation_owner: string | null;
  review_owner: string | null;
  sender_owner: string | null;
  report_paths: string[];
  paperclip_issue_id: string | null;
  ops_work_item_id: string | null;
  packet: HumanBlockerPacket;
  packet_text: string;
  packet_html: string;
  packet_slack: string;
  actor: {
    uid: string | null;
    email: string | null;
  };
  reviewed_by: {
    uid: string | null;
    email: string | null;
  } | null;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
};

export async function getHumanBlockerDispatch(dispatchId: string) {
  if (!db || !dispatchId) {
    return null;
  }
  const doc = await db.collection(DISPATCH_COLLECTION).doc(dispatchId).get();
  return doc.exists ? (doc.data() as HumanBlockerDispatchRecord) : null;
}

async function saveHumanBlockerDispatchRecord(record: HumanBlockerDispatchRecord) {
  if (!db) {
    return;
  }
  await db.collection(DISPATCH_COLLECTION).doc(record.id).set(record, { merge: true });
}

type PreparedHumanBlockerDispatch = {
  blockerId: string;
  executionOwner: string;
  routingOwner: string;
  escalationOwner: string | null;
  reviewOwner: string | null;
  senderOwner: string | null;
  emailTarget: string;
  packet: HumanBlockerPacket;
  emailSubject: string;
  packetText: string;
  packetHtml: string;
  packetSlack: string;
  reportPaths: string[];
  paperclipIssueId: string | null;
  opsWorkItemId: string | null;
};

function prepareHumanBlockerDispatch(input: {
  packet: HumanBlockerPacket;
  blocker_kind: HumanBlockerKind;
  email_target?: string | null;
  routing_owner?: string | null;
  execution_owner?: string | null;
  escalation_owner?: string | null;
  review_owner?: string | null;
  sender_owner?: string | null;
  report_paths?: string[];
  paperclip_issue_id?: string | null;
  ops_work_item_id?: string | null;
}) : PreparedHumanBlockerDispatch {
  const blockerId = normalizeString(input.packet.blockerId) || crypto.randomUUID();
  const executionOwner =
    normalizeString(input.execution_owner)
    || normalizeString(input.packet.executionOwner)
    || (input.blocker_kind === "technical"
      ? DEFAULT_TECHNICAL_EXECUTION_OWNER
      : DEFAULT_OPS_EXECUTION_OWNER);
  const routingOwner =
    normalizeString(input.routing_owner) || DEFAULT_HUMAN_REPLY_ROUTING_OWNER;
  const escalationOwner =
    normalizeString(input.escalation_owner)
    || (input.blocker_kind === "technical" ? DEFAULT_TECHNICAL_ESCALATION_OWNER : null);
  const reviewOwner = normalizeString(input.review_owner) || null;
  const senderOwner = normalizeString(input.sender_owner) || reviewOwner || executionOwner;
  const emailTarget =
    normalizeString(input.email_target) || APPROVED_HUMAN_REPLY_EMAIL;
  const packet: HumanBlockerPacket = {
    ...input.packet,
    blockerId,
    executionOwner,
  };

  return {
    blockerId,
    executionOwner,
    routingOwner,
    escalationOwner,
    reviewOwner,
    senderOwner,
    emailTarget,
    packet,
    emailSubject: renderHumanBlockerPacketEmailSubject(packet.title, blockerId),
    packetText: renderHumanBlockerPacketText(packet),
    packetHtml: renderHumanBlockerPacketHtml(packet),
    packetSlack: renderHumanBlockerPacketSlack(packet),
    reportPaths: normalizeStringArray(input.report_paths),
    paperclipIssueId: normalizeString(input.paperclip_issue_id) || null,
    opsWorkItemId: normalizeString(input.ops_work_item_id) || null,
  };
}

async function upsertHumanBlockerThreadForDispatch(
  prepared: PreparedHumanBlockerDispatch,
  blockerKind: HumanBlockerKind,
  params: {
    status: HumanBlockerThreadRecord["status"];
    review_status: HumanBlockerThreadRecord["review_status"];
    last_dispatch_id?: string | null;
  },
) {
  return await upsertHumanBlockerThread({
    blocker_id: prepared.blockerId,
    title: prepared.packet.title,
    summary: prepared.packet.summary,
    blocker_kind: blockerKind,
    channel: "email",
    channel_target: prepared.emailTarget,
    status: params.status,
    approved_identity: APPROVED_HUMAN_REPLY_EMAIL,
    routing_owner: prepared.routingOwner,
    execution_owner: prepared.executionOwner,
    escalation_owner: prepared.escalationOwner,
    review_owner: prepared.reviewOwner,
    sender_owner: prepared.senderOwner,
    review_status: params.review_status,
    review_completed_at: params.review_status === "approved" ? new Date().toISOString() : null,
    resume_action: {
      kind: prepared.packet.resumeAction?.kind || "manual_followup",
      description:
        normalizeString(prepared.packet.resumeAction?.description)
        || prepared.packet.immediateNextAction,
      metadata: {
        deadline: prepared.packet.deadline,
        ...(prepared.packet.resumeAction?.metadata || {}),
      },
    },
    record_of_truth: {
      report_paths: prepared.reportPaths,
      paperclip_issue_id: prepared.paperclipIssueId,
      ops_work_item_id: prepared.opsWorkItemId,
    },
    correlation: {
      outbound_subject: prepared.emailSubject,
    },
    last_dispatch_id: params.last_dispatch_id ?? null,
  });
}

async function persistGapAndOpsLog(input: {
  blockerId: string;
  title: string;
  executionOwner: string;
  routingOwner: string;
  escalationOwner: string | null;
  emailTarget: string;
  emailSubject: string;
  reportPaths: string[];
  nextAction: string;
  deadline: string;
  deliveryMode: HumanBlockerDeliveryMode;
  deliveryStatus: HumanBlockerDeliveryStatus;
  emailSent: boolean;
  slackMirrored: boolean;
  slackSent: boolean;
}) {
  const gapTitle =
    input.deliveryMode === "review_required"
      ? `Human blocker awaiting review: ${input.title}`
      : `Human blocker awaiting reply: ${input.title}`;
  const gap = await recordExternalGapReport({
    source: "human_blocker_dispatch",
    stable_id: `human_blocker:${input.blockerId}`,
    title: gapTitle,
    detail: [
      `Blocker id: ${input.blockerId}`,
      `Email target: ${input.emailTarget}`,
      `Execution owner: ${input.executionOwner}`,
      `Routing owner: ${input.routingOwner}`,
      input.escalationOwner ? `Escalation owner: ${input.escalationOwner}` : null,
      `Delivery mode: ${input.deliveryMode}`,
      `Delivery status: ${input.deliveryStatus}`,
      `Next action after reply: ${input.nextAction}`,
      `Deadline: ${input.deadline}`,
      input.reportPaths.length > 0
        ? `Report paths: ${input.reportPaths.join(", ")}`
        : null,
    ].filter(Boolean).join("\n"),
    severity: "blocker",
    suggested_owner: input.routingOwner,
  });

  await recordOpsActionLog({
    session_id: null,
    run_id: null,
    session_key: `human-blocker:${input.blockerId}`,
    action_key: input.deliveryMode === "review_required"
      ? "human.blocker.queue_review"
      : "human.blocker.dispatch",
    status: "completed",
    summary:
      input.deliveryMode === "review_required"
        ? `Queued human blocker ${input.blockerId} for review`
        : `Dispatched human blocker ${input.blockerId}`,
    provider: null,
    runtime: null,
    task_kind: "operator_thread",
    risk_level: "medium",
    reversible: true,
    requires_approval: input.deliveryMode === "review_required",
    metadata: {
      blocker_id: input.blockerId,
      email_target: input.emailTarget,
      email_subject: input.emailSubject,
      email_sent: input.emailSent,
      slack_mirrored: input.slackMirrored,
      slack_sent: input.slackSent,
      delivery_mode: input.deliveryMode,
      delivery_status: input.deliveryStatus,
      gap_id: gap.stable_id,
    },
  });

  return gap;
}

async function sendPreparedHumanBlockerDispatch(
  prepared: PreparedHumanBlockerDispatch,
  input: {
    dispatchId: string;
    blockerKind: HumanBlockerKind;
    mirrorToSlack: boolean;
    slackWebhookUrl?: string | null;
    actor?: {
      uid?: string | null;
      email?: string | null;
    };
    reviewedBy?: {
      uid?: string | null;
      email?: string | null;
    } | null;
  },
) {
  const emailResult = await sendEmail({
    to: prepared.emailTarget,
    subject: prepared.emailSubject,
    text: prepared.packetText,
    html: prepared.packetHtml,
    replyTo: APPROVED_HUMAN_REPLY_EMAIL,
  });

  let slackSent = false;
  if (input.mirrorToSlack) {
    const slackResult = await sendSlackMessage(
      prepared.packetSlack,
      normalizeString(input.slackWebhookUrl) || undefined,
    );
    slackSent = slackResult.sent === true;
  }

  await upsertHumanBlockerThreadForDispatch(prepared, input.blockerKind, {
    status: "awaiting_reply",
    review_status: prepared.reviewOwner ? "approved" : "not_required",
    last_dispatch_id: input.dispatchId,
  });

  const record: HumanBlockerDispatchRecord = {
    id: input.dispatchId,
    blocker_id: prepared.blockerId,
    blocker_kind: input.blockerKind,
    title: prepared.packet.title,
    delivery_mode: "send_now",
    delivery_status: emailResult.sent === true ? "sent" : "failed",
    email_target: prepared.emailTarget,
    email_subject: prepared.emailSubject,
    email_sent: emailResult.sent === true,
    slack_mirrored: input.mirrorToSlack,
    slack_sent: slackSent,
    routing_owner: prepared.routingOwner,
    execution_owner: prepared.executionOwner,
    escalation_owner: prepared.escalationOwner,
    review_owner: prepared.reviewOwner,
    sender_owner: prepared.senderOwner,
    report_paths: prepared.reportPaths,
    paperclip_issue_id: prepared.paperclipIssueId,
    ops_work_item_id: prepared.opsWorkItemId,
    packet: prepared.packet,
    packet_text: prepared.packetText,
    packet_html: prepared.packetHtml,
    packet_slack: prepared.packetSlack,
    actor: {
      uid: normalizeString(input.actor?.uid) || null,
      email: normalizeString(input.actor?.email) || null,
    },
    reviewed_by: input.reviewedBy
      ? {
          uid: normalizeString(input.reviewedBy.uid) || null,
          email: normalizeString(input.reviewedBy.email) || null,
        }
      : null,
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
  };
  await saveHumanBlockerDispatchRecord(record);

  const gap = await persistGapAndOpsLog({
    blockerId: prepared.blockerId,
    title: prepared.packet.title,
    executionOwner: prepared.executionOwner,
    routingOwner: prepared.routingOwner,
    escalationOwner: prepared.escalationOwner,
    emailTarget: prepared.emailTarget,
    emailSubject: prepared.emailSubject,
    reportPaths: prepared.reportPaths,
    nextAction: prepared.packet.immediateNextAction,
    deadline: prepared.packet.deadline,
    deliveryMode: "send_now",
    deliveryStatus: record.delivery_status,
    emailSent: record.email_sent,
    slackMirrored: record.slack_mirrored,
    slackSent: record.slack_sent,
  });

  const thread = await getHumanBlockerThread(prepared.blockerId);
  return {
    blocker_id: prepared.blockerId,
    dispatch_id: input.dispatchId,
    email_sent: record.email_sent,
    slack_sent: record.slack_sent,
    gap_id: gap.stable_id,
    thread,
    email_subject: prepared.emailSubject,
    packet_text: prepared.packetText,
    delivery_mode: "send_now" as const,
    delivery_status: record.delivery_status,
  };
}

export async function dispatchHumanBlocker(input: {
  packet?: HumanBlockerPacket;
  blocker_kind?: HumanBlockerKind;
  delivery_mode?: HumanBlockerDeliveryMode;
  dispatch_id?: string | null;
  email_target?: string | null;
  mirror_to_slack?: boolean;
  slack_webhook_url?: string | null;
  routing_owner?: string | null;
  execution_owner?: string | null;
  escalation_owner?: string | null;
  review_owner?: string | null;
  sender_owner?: string | null;
  report_paths?: string[];
  paperclip_issue_id?: string | null;
  ops_work_item_id?: string | null;
  actor?: {
    uid?: string | null;
    email?: string | null;
  };
  reviewed_by?: {
    uid?: string | null;
    email?: string | null;
  } | null;
}) {
  const deliveryMode =
    input.delivery_mode === "review_required" || input.delivery_mode === "send_saved_draft"
      ? input.delivery_mode
      : "send_now";
  const dispatchId = normalizeString(input.dispatch_id) || crypto.randomUUID();

  if (deliveryMode === "review_required") {
    if (!input.packet || !input.blocker_kind) {
      throw new Error("packet and blocker_kind are required when delivery_mode=review_required.");
    }
    const prepared = prepareHumanBlockerDispatch({
      ...input,
      packet: input.packet,
      blocker_kind: input.blocker_kind,
    });
    await upsertHumanBlockerThreadForDispatch(prepared, input.blocker_kind, {
      status: "awaiting_review",
      review_status: "awaiting_review",
      last_dispatch_id: dispatchId,
    });
    const record: HumanBlockerDispatchRecord = {
      id: dispatchId,
      blocker_id: prepared.blockerId,
      blocker_kind: input.blocker_kind,
      title: prepared.packet.title,
      delivery_mode: "review_required",
      delivery_status: "awaiting_review",
      email_target: prepared.emailTarget,
      email_subject: prepared.emailSubject,
      email_sent: false,
      slack_mirrored: input.mirror_to_slack === true,
      slack_sent: false,
      routing_owner: prepared.routingOwner,
      execution_owner: prepared.executionOwner,
      escalation_owner: prepared.escalationOwner,
      review_owner: prepared.reviewOwner,
      sender_owner: prepared.senderOwner,
      report_paths: prepared.reportPaths,
      paperclip_issue_id: prepared.paperclipIssueId,
      ops_work_item_id: prepared.opsWorkItemId,
      packet: prepared.packet,
      packet_text: prepared.packetText,
      packet_html: prepared.packetHtml,
      packet_slack: prepared.packetSlack,
      actor: {
        uid: normalizeString(input.actor?.uid) || null,
        email: normalizeString(input.actor?.email) || null,
      },
      reviewed_by: null,
      created_at: nowTimestamp(),
      updated_at: nowTimestamp(),
    };
    await saveHumanBlockerDispatchRecord(record);
    const gap = await persistGapAndOpsLog({
      blockerId: prepared.blockerId,
      title: prepared.packet.title,
      executionOwner: prepared.executionOwner,
      routingOwner: prepared.routingOwner,
      escalationOwner: prepared.escalationOwner,
      emailTarget: prepared.emailTarget,
      emailSubject: prepared.emailSubject,
      reportPaths: prepared.reportPaths,
      nextAction: prepared.packet.immediateNextAction,
      deadline: prepared.packet.deadline,
      deliveryMode: "review_required",
      deliveryStatus: "awaiting_review",
      emailSent: false,
      slackMirrored: record.slack_mirrored,
      slackSent: false,
    });
    return {
      blocker_id: prepared.blockerId,
      dispatch_id: dispatchId,
      email_sent: false,
      slack_sent: false,
      gap_id: gap.stable_id,
      thread: await getHumanBlockerThread(prepared.blockerId),
      email_subject: prepared.emailSubject,
      packet_text: prepared.packetText,
      delivery_mode: "review_required" as const,
      delivery_status: "awaiting_review" as const,
    };
  }

  if (deliveryMode === "send_saved_draft") {
    const existing = await getHumanBlockerDispatch(dispatchId);
    if (!existing) {
      throw new Error(`Human blocker dispatch ${dispatchId} was not found.`);
    }
    if (!existing.packet) {
      throw new Error(`Human blocker dispatch ${dispatchId} does not contain a saved packet payload.`);
    }
    const savedPrepared: PreparedHumanBlockerDispatch = {
      blockerId: existing.blocker_id,
      executionOwner: existing.execution_owner,
      routingOwner: existing.routing_owner,
      escalationOwner: existing.escalation_owner,
      reviewOwner: existing.review_owner,
      senderOwner: existing.sender_owner,
      emailTarget: existing.email_target || APPROVED_HUMAN_REPLY_EMAIL,
      packet: existing.packet,
      emailSubject:
        existing.email_subject || renderHumanBlockerPacketEmailSubject(existing.title, existing.blocker_id),
      packetText: existing.packet_text,
      packetHtml: existing.packet_html,
      packetSlack: existing.packet_slack,
      reportPaths: existing.report_paths,
      paperclipIssueId: existing.paperclip_issue_id,
      opsWorkItemId: existing.ops_work_item_id,
    };
    return await sendPreparedHumanBlockerDispatch(savedPrepared, {
      dispatchId,
      blockerKind: existing.blocker_kind,
      mirrorToSlack: existing.slack_mirrored,
      slackWebhookUrl: input.slack_webhook_url,
      actor: input.actor,
      reviewedBy: input.reviewed_by ?? input.actor ?? null,
    });
  }

  if (!input.packet || !input.blocker_kind) {
    throw new Error("packet and blocker_kind are required when delivery_mode=send_now.");
  }
  const prepared = prepareHumanBlockerDispatch({
    ...input,
    packet: input.packet,
    blocker_kind: input.blocker_kind,
  });
  return await sendPreparedHumanBlockerDispatch(prepared, {
    dispatchId,
    blockerKind: input.blocker_kind,
    mirrorToSlack: input.mirror_to_slack === true,
    slackWebhookUrl: input.slack_webhook_url,
    actor: input.actor,
    reviewedBy: input.reviewed_by ?? null,
  });
}

export async function resolveHumanBlockerAwaitingReply(blockerId: string) {
  return resolveExternalGapReport(`human_blocker:${blockerId}`);
}
