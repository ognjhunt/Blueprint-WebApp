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

export type HumanBlockerDispatchRecord = {
  id: string;
  blocker_id: string;
  blocker_kind: HumanBlockerKind;
  title: string;
  email_target: string | null;
  email_subject: string | null;
  email_sent: boolean;
  slack_mirrored: boolean;
  slack_sent: boolean;
  routing_owner: string;
  execution_owner: string;
  escalation_owner: string | null;
  report_paths: string[];
  paperclip_issue_id: string | null;
  ops_work_item_id: string | null;
  packet_text: string;
  packet_html: string;
  packet_slack: string;
  actor: {
    uid: string | null;
    email: string | null;
  };
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
};

export async function getHumanBlockerDispatch(dispatchId: string) {
  if (!db || !dispatchId) {
    return null;
  }
  const doc = await db.collection(DISPATCH_COLLECTION).doc(dispatchId).get();
  return doc.exists ? (doc.data() as HumanBlockerDispatchRecord) : null;
}

export async function dispatchHumanBlocker(input: {
  packet: HumanBlockerPacket;
  blocker_kind: HumanBlockerKind;
  email_target?: string | null;
  mirror_to_slack?: boolean;
  slack_webhook_url?: string | null;
  routing_owner?: string | null;
  execution_owner?: string | null;
  escalation_owner?: string | null;
  report_paths?: string[];
  paperclip_issue_id?: string | null;
  ops_work_item_id?: string | null;
  actor?: {
    uid?: string | null;
    email?: string | null;
  };
}) {
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
  const emailTarget =
    normalizeString(input.email_target) || APPROVED_HUMAN_REPLY_EMAIL;
  const packet: HumanBlockerPacket = {
    ...input.packet,
    blockerId,
    executionOwner,
  };

  const emailSubject = renderHumanBlockerPacketEmailSubject(packet.title, blockerId);
  const packetText = renderHumanBlockerPacketText(packet);
  const packetHtml = renderHumanBlockerPacketHtml(packet);
  const packetSlack = renderHumanBlockerPacketSlack(packet);

  await upsertHumanBlockerThread({
    blocker_id: blockerId,
    title: packet.title,
    summary: packet.summary,
    blocker_kind: input.blocker_kind,
    channel: "email",
    channel_target: emailTarget,
    status: "awaiting_reply",
    approved_identity: APPROVED_HUMAN_REPLY_EMAIL,
    routing_owner: routingOwner,
    execution_owner: executionOwner,
    escalation_owner: escalationOwner,
    resume_action: {
      kind: "manual_followup",
      description: packet.immediateNextAction,
      metadata: {
        deadline: packet.deadline,
      },
    },
    record_of_truth: {
      report_paths: normalizeStringArray(input.report_paths),
      paperclip_issue_id: normalizeString(input.paperclip_issue_id) || null,
      ops_work_item_id: normalizeString(input.ops_work_item_id) || null,
    },
    correlation: {
      outbound_subject: emailSubject,
    },
  });

  const emailResult = await sendEmail({
    to: emailTarget,
    subject: emailSubject,
    text: packetText,
    html: packetHtml,
    replyTo: APPROVED_HUMAN_REPLY_EMAIL,
  });

  let slackSent = false;
  if (input.mirror_to_slack) {
    const slackResult = await sendSlackMessage(packetSlack, normalizeString(input.slack_webhook_url) || undefined);
    slackSent = slackResult.sent === true;
  }

  const dispatchId = crypto.randomUUID();
  if (db) {
    const record: HumanBlockerDispatchRecord = {
      id: dispatchId,
      blocker_id: blockerId,
      blocker_kind: input.blocker_kind,
      title: packet.title,
      email_target: emailTarget,
      email_subject: emailSubject,
      email_sent: emailResult.sent === true,
      slack_mirrored: input.mirror_to_slack === true,
      slack_sent: slackSent,
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      report_paths: normalizeStringArray(input.report_paths),
      paperclip_issue_id: normalizeString(input.paperclip_issue_id) || null,
      ops_work_item_id: normalizeString(input.ops_work_item_id) || null,
      packet_text: packetText,
      packet_html: packetHtml,
      packet_slack: packetSlack,
      actor: {
        uid: normalizeString(input.actor?.uid) || null,
        email: normalizeString(input.actor?.email) || null,
      },
      created_at: nowTimestamp(),
    };
    await db.collection(DISPATCH_COLLECTION).doc(dispatchId).set(record);
  }

  const gap = await recordExternalGapReport({
    source: "human_blocker_dispatch",
    stable_id: `human_blocker:${blockerId}`,
    title: `Human blocker awaiting reply: ${packet.title}`,
    detail: [
      `Blocker id: ${blockerId}`,
      `Email target: ${emailTarget}`,
      `Execution owner: ${executionOwner}`,
      `Routing owner: ${routingOwner}`,
      escalationOwner ? `Escalation owner: ${escalationOwner}` : null,
      `Next action after reply: ${packet.immediateNextAction}`,
      `Deadline: ${packet.deadline}`,
      normalizeStringArray(input.report_paths).length > 0
        ? `Report paths: ${normalizeStringArray(input.report_paths).join(", ")}`
        : null,
    ].filter(Boolean).join("\n"),
    severity: "blocker",
    suggested_owner: routingOwner,
  });

  await recordOpsActionLog({
    session_id: null,
    run_id: null,
    session_key: `human-blocker:${blockerId}`,
    action_key: "human.blocker.dispatch",
    status: "completed",
    summary: `Dispatched human blocker ${blockerId}`,
    provider: null,
    runtime: null,
    task_kind: "operator_thread",
    risk_level: "medium",
    reversible: true,
    requires_approval: false,
    metadata: {
      blocker_id: blockerId,
      email_target: emailTarget,
      email_subject: emailSubject,
      email_sent: emailResult.sent === true,
      slack_mirrored: input.mirror_to_slack === true,
      slack_sent: slackSent,
      gap_id: gap.stable_id,
    },
  });

  const thread = await getHumanBlockerThread(blockerId);

  return {
    blocker_id: blockerId,
    dispatch_id: dispatchId,
    email_sent: emailResult.sent === true,
    slack_sent: slackSent,
    gap_id: gap.stable_id,
    thread,
    email_subject: emailSubject,
  };
}

export async function resolveHumanBlockerAwaitingReply(blockerId: string) {
  return resolveExternalGapReport(`human_blocker:${blockerId}`);
}
