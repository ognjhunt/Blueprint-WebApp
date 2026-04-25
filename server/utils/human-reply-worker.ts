import { recordExternalGapReport } from "./gap-closure";
import { resolveHumanBlockerAwaitingReply } from "./human-blocker-dispatch";
import { approveAction } from "../agents/action-executor";
import {
  createPaperclipIssueComment,
  getPaperclipIssue,
  resolvePaperclipAgentId,
  resetPaperclipAgentSession,
  resolvePaperclipCompanyId,
  updatePaperclipIssue,
  wakePaperclipAgent,
} from "./paperclip";
import {
  classifyHumanReply,
  extractHumanBlockerIdFromText,
  normalizeCorrelationSubject,
  subjectsMatchForCorrelation,
  type HumanReplyChannel,
} from "./human-reply-routing";
import {
  getHumanReplyGmailDurabilityStatus,
  listHumanReplyGmailMessages,
} from "./human-reply-gmail";
import {
  applyHumanReplyThreadUpdate,
  getHumanReplyEvent,
  listOpenHumanBlockerThreads,
  noteHumanReplyThreadBlocker,
  recordHumanReplyEvent,
  type HumanBlockerThreadRecord,
} from "./human-reply-store";
import { runCityLaunchExecutionHarness } from "./cityLaunchExecutionHarness";
import type { CityLaunchBudgetTier } from "./cityLaunchPolicy";

function truncate(value: string, max = 280) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function extractCorrelationId(message: {
  subject: string | null;
  body: string;
}) {
  return (
    extractHumanBlockerIdFromText(message.subject)
    || extractHumanBlockerIdFromText(message.body)
    || null
  );
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;
}

function asBudgetTier(value: unknown): CityLaunchBudgetTier | undefined {
  return value === "zero_budget" || value === "low_budget" || value === "funded"
    ? value
    : undefined;
}

function findMatchingThread(
  threads: HumanBlockerThreadRecord[],
  message: {
    external_thread_id: string | null;
    subject: string | null;
    body: string;
  },
) {
  const blockerId = extractCorrelationId(message);
  if (blockerId) {
    return threads.find((thread) => thread.blocker_id === blockerId) || null;
  }

  const normalizedSubject = normalizeCorrelationSubject(message.subject);
  return (
    threads.find((thread) => {
      if (
        message.external_thread_id
        && thread.correlation.gmail_thread_id
        && message.external_thread_id === thread.correlation.gmail_thread_id
      ) {
        return true;
      }
      return normalizedSubject
        ? subjectsMatchForCorrelation(thread.correlation.outbound_subject, normalizedSubject)
        : false;
    }) || null
  );
}

async function ingestHumanReplyMessage(params: {
  channel: HumanReplyChannel;
  external_message_id: string;
  external_thread_id: string | null;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string;
  received_at: string;
  thread: HumanBlockerThreadRecord;
}) {
  const existing = await getHumanReplyEvent(`${params.channel}:${params.external_message_id}`);
  if (existing) {
    return { processed: false, reason: "duplicate" as const };
  }

  const decision = classifyHumanReply(params.body, {
    blocker_kind: params.thread.blocker_kind,
    routing_owner: params.thread.routing_owner,
    execution_owner: params.thread.execution_owner,
    escalation_owner: params.thread.escalation_owner,
  });

  const bodyExcerpt = truncate(params.body);
  const replyEvent = await recordHumanReplyEvent({
    blocker_id: params.thread.blocker_id,
    channel: params.channel,
    sender: params.sender,
    recipient: params.recipient,
    subject: params.subject,
    body: params.body,
    body_excerpt: bodyExcerpt,
    received_at: params.received_at,
    external_message_id: params.external_message_id,
    external_thread_id: params.external_thread_id,
    classification: decision.classification,
    resolution: decision.resolution,
    routing_owner: decision.routing_owner,
    execution_owner: decision.execution_owner,
    escalation_owner: decision.escalation_owner,
    should_resume_now: decision.should_resume_now,
    reason: decision.reason,
  });

  await applyHumanReplyThreadUpdate({
    blocker_id: params.thread.blocker_id,
    event_id: replyEvent.id,
    received_at: params.received_at,
    body_excerpt: bodyExcerpt,
    classification: decision.classification,
    resolution: decision.resolution,
    routed_owner:
      decision.resolution === "resolved_input"
        ? decision.execution_owner
        : decision.routing_owner,
    should_resume_now: decision.should_resume_now,
    blocked_reason:
      decision.resolution === "ambiguous_input"
        ? decision.reason
        : null,
  });

  const suggestedOwner =
    decision.resolution === "resolved_input"
      ? decision.execution_owner
      : decision.routing_owner;
  const detailLines = [
    `Channel: ${params.channel}`,
    `Sender: ${params.sender || "unknown"}`,
    `Received at: ${params.received_at}`,
    `Classification: ${decision.classification}`,
    `Resolution: ${decision.resolution}`,
    `Reason: ${decision.reason}`,
    `Reply summary: ${bodyExcerpt || "(empty)"}`,
    `Execution owner: ${decision.execution_owner}`,
    decision.escalation_owner ? `Escalation owner: ${decision.escalation_owner}` : null,
    `Next action: ${params.thread.resume_action.description}`,
    params.thread.record_of_truth.report_paths.length > 0
      ? `Report paths: ${params.thread.record_of_truth.report_paths.join(", ")}`
      : null,
    params.thread.record_of_truth.paperclip_issue_id
      ? `Paperclip issue: ${params.thread.record_of_truth.paperclip_issue_id}`
      : null,
  ].filter(Boolean);

  const gap = await recordExternalGapReport({
    source: `human_reply:${params.channel}`,
    stable_id: `human_reply:${params.thread.blocker_id}`,
    title:
      decision.resolution === "resolved_input"
        ? `Human reply ready for execution: ${params.thread.title}`
        : `Human reply needs clarification: ${params.thread.title}`,
    detail: detailLines.join("\n"),
    severity: decision.resolution === "resolved_input" ? "warn" : "blocker",
    suggested_owner: suggestedOwner,
  });

  if (decision.resolution === "resolved_input") {
    try {
      const operatorEmail = params.thread.approved_identity || "ohstnhunt@gmail.com";
      const replySummary = bodyExcerpt || "(empty reply)";
      if (
        decision.classification === "approval"
        && params.thread.resume_action.kind === "city_launch_activate"
      ) {
        const activationMetadata = params.thread.resume_action.metadata || {};
        const city = asTrimmedString(activationMetadata.city);
        if (!city) {
          throw new Error("City launch activation reply is missing a city in resume metadata.");
        }

        await runCityLaunchExecutionHarness({
          city,
          founderApproved: true,
          budgetTier: asBudgetTier(activationMetadata.budgetTier),
          budgetMaxUsd: asOptionalNumber(activationMetadata.budgetMaxUsd),
          operatorAutoApproveUsd: asOptionalNumber(activationMetadata.operatorAutoApproveUsd),
        });
      } else if (
        decision.classification === "approval"
        && params.thread.record_of_truth.ops_work_item_id
      ) {
        await approveAction(params.thread.record_of_truth.ops_work_item_id, operatorEmail);
      } else if (params.thread.record_of_truth.paperclip_issue_id) {
        const companyId = await resolvePaperclipCompanyId();
        const issueId = params.thread.record_of_truth.paperclip_issue_id;
        const executionAgentId = await resolvePaperclipAgentId(decision.execution_owner);
        if (!companyId || !executionAgentId) {
          throw new Error("Paperclip company or execution agent could not be resolved for human-reply resume.");
        }
        const existingIssue = await getPaperclipIssue(issueId).catch(() => null);
        if (!existingIssue) {
          throw new Error(`Paperclip issue ${issueId} could not be loaded for human-reply resume.`);
        }
        if (existingIssue.assigneeAgentId !== executionAgentId) {
          await updatePaperclipIssue(issueId, {
            assigneeAgentId: executionAgentId,
          });
        }
        await createPaperclipIssueComment(
          issueId,
          [
            `Human reply recorded for blocker ${params.thread.blocker_id}.`,
            `Classification: ${decision.classification}.`,
            `Reason: ${decision.reason}`,
            `Reply summary: ${replySummary}`,
            `Auto-resume: waking ${decision.execution_owner}.`,
          ].join("\n"),
        );
        await resetPaperclipAgentSession(executionAgentId, issueId, companyId).catch(() => undefined);
        await wakePaperclipAgent({
          agentId: executionAgentId,
          companyId,
          reason: "human_reply_resolved",
          idempotencyKey: `human-reply:${params.thread.blocker_id}:${replyEvent.id}`,
          payload: {
            issueId,
            taskKey: issueId,
            blockerId: params.thread.blocker_id,
            humanReplyEventId: replyEvent.id,
            classification: decision.classification,
            resolution: decision.resolution,
            receivedAt: params.received_at,
          },
        });
      }
    } catch (error) {
      await noteHumanReplyThreadBlocker({
        blocker_id: params.thread.blocker_id,
        reason: error instanceof Error ? error.message : "Human reply auto-resume failed.",
      });
      return {
        processed: true,
        blocker_id: params.thread.blocker_id,
        gap_id: gap.stable_id,
        classification: decision.classification,
        resolution: decision.resolution,
        owner: suggestedOwner,
        auto_resume_error: error instanceof Error ? error.message : "Human reply auto-resume failed.",
      };
    }
  }

  if (decision.resolution === "resolved_input") {
    await resolveHumanBlockerAwaitingReply(params.thread.blocker_id).catch(() => false);
  }

  return {
    processed: true,
    blocker_id: params.thread.blocker_id,
    gap_id: gap.stable_id,
    classification: decision.classification,
    resolution: decision.resolution,
    owner: suggestedOwner,
  };
}

export async function ingestHumanReplyPayload(params: {
  channel: HumanReplyChannel;
  external_message_id: string;
  external_thread_id?: string | null;
  sender?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body: string;
  received_at?: string | null;
}) {
  const openThreads = await listOpenHumanBlockerThreads(250);
  const matchedThread = findMatchingThread(openThreads, {
    external_thread_id: params.external_thread_id || null,
    subject: params.subject || null,
    body: params.body,
  });

  if (!matchedThread) {
    return {
      processed: false,
      reason: "unmatched",
    };
  }

  return ingestHumanReplyMessage({
    channel: params.channel,
    external_message_id: params.external_message_id,
    external_thread_id: params.external_thread_id || null,
    sender: params.sender || null,
    recipient: params.recipient || null,
    subject: params.subject || null,
    body: params.body,
    received_at: params.received_at || new Date().toISOString(),
    thread: matchedThread,
  });
}

export async function runHumanReplyEmailWatcher(params?: { limit?: number }) {
  const status = await getHumanReplyGmailDurabilityStatus();
  if (!status.production_ready) {
    const openThreads = await listOpenHumanBlockerThreads(250);
    const reason =
      status.reason
      || status.risk
      || "Email reply watcher is not production-ready.";
    for (const thread of openThreads.filter((entry) => entry.channel === "email")) {
      await noteHumanReplyThreadBlocker({
        blocker_id: thread.blocker_id,
        reason,
      });
    }
    return {
      processedCount: 0,
      failedCount: openThreads.filter((entry) => entry.channel === "email").length > 0 ? 1 : 0,
      blockedCount: openThreads.filter((entry) => entry.channel === "email").length,
      reason,
    };
  }

  const messages = await listHumanReplyGmailMessages({
    limit: params?.limit ?? 25,
  });

  let processedCount = 0;
  let failedCount = 0;
  for (const message of messages) {
    try {
      const result = await ingestHumanReplyPayload(message);
      if (result.processed) {
        processedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return {
    processedCount,
    failedCount,
    blockedCount: 0,
    reason: null,
  };
}
