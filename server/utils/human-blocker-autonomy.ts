import crypto from "node:crypto";

import type { ActionType } from "../agents/action-policies";
import type { AgentTask, AgentTaskKind } from "../agents/types";
import { logger } from "../logger";
import { dispatchHumanBlocker } from "./human-blocker-dispatch";
import type { HumanBlockerKind } from "./human-reply-routing";

const HUMAN_BLOCKER_REVIEW_OWNER = "blueprint-chief-of-staff";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function blockerHash(parts: string[]) {
  return crypto
    .createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 16);
}

function blockerId(prefix: string, parts: string[]) {
  return `${prefix}-${blockerHash(parts)}`;
}

function humanBlockerKindForTaskKind(kind: AgentTaskKind): HumanBlockerKind {
  switch (kind) {
    case "waitlist_triage":
    case "inbound_qualification":
    case "post_signup_scheduling":
    case "support_triage":
    case "payout_exception_triage":
      return "ops_commercial";
    case "preview_diagnosis":
    case "operator_thread":
    case "external_harness_thread":
    default:
      return "technical";
  }
}

function executionOwnerForTaskKind(kind: AgentTaskKind) {
  switch (kind) {
    case "waitlist_triage":
    case "inbound_qualification":
    case "post_signup_scheduling":
    case "support_triage":
    case "payout_exception_triage":
      return "ops-lead";
    case "preview_diagnosis":
    case "operator_thread":
    case "external_harness_thread":
    default:
      return "webapp-codex";
  }
}

function executionOwnerForLane(lane: string) {
  switch (lane) {
    case "growth_campaign":
    case "buyer_lifecycle":
    case "lifecycle_cadence":
      return "growth-lead";
    default:
      return "ops-lead";
  }
}

function humanBlockerKindForLane(lane: string): HumanBlockerKind {
  switch (lane) {
    case "preview":
    case "preview_diagnosis":
      return "technical";
    default:
      return "ops_commercial";
  }
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function approvalRecommendedAnswer(reason: string) {
  if (reason.startsWith("content_validation_failed")) {
    return "Do not execute as drafted. Reply with the exact edit needed or reject the action.";
  }
  if (reason.startsWith("daily_cap_exceeded")) {
    return "Approve this single queued action only if it is worth using manual override capacity.";
  }
  return "Approve the queued action only if it stays inside the current Blueprint guardrails.";
}

export async function dispatchRuntimeApprovalHumanBlocker(params: {
  runId: string;
  task: AgentTask<unknown>;
  approvalReason: string | null | undefined;
  sessionId?: string | null;
  sessionKey?: string | null;
}) {
  const approvalReason = normalizeText(params.approvalReason) || "requires_human_approval";
  const taskKind = params.task.kind;
  const blockerKind = humanBlockerKindForTaskKind(taskKind);
  const executionOwner = executionOwnerForTaskKind(taskKind);
  const nextAction =
    blockerKind === "technical"
      ? "Resume the blocked run from durable runtime state and verify the result."
      : "Resume the blocked lane from durable runtime state and complete the queued follow-through.";

  return dispatchHumanBlocker({
    delivery_mode: "review_required",
    blocker_kind: blockerKind,
    review_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    sender_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    execution_owner: executionOwner,
    packet: {
      blockerId: blockerId("runtime", [
        taskKind,
        normalizeText(params.sessionKey),
        normalizeText(params.sessionId),
        approvalReason,
      ]),
      title: `${titleCase(taskKind)} run requires human approval`,
      summary: [
        `A ${taskKind} run was moved to pending approval.`,
        params.sessionKey ? `Session key: ${params.sessionKey}` : null,
        `Run id: ${params.runId}`,
      ]
        .filter(Boolean)
        .join(" "),
      decisionType: "runtime_approval",
      recommendedAnswer: approvalRecommendedAnswer(approvalReason),
      exactResponseNeeded:
        "Reply with approved, rejected, or revise: <exact change> for this run.",
      whyBlocked: `The runtime approval policy blocked execution because ${approvalReason}.`,
      alternatives: [
        "Reject the run and keep the lane blocked.",
        "Reply with the exact change required, then rerun from the saved state.",
      ],
      risk:
        blockerKind === "technical"
          ? "Approving the wrong run can ship or validate against an unsafe technical boundary."
          : "Approving the wrong run can create unsupported buyer, ops, or commercial commitments.",
      executionOwner,
      immediateNextAction: nextAction,
      deadline: "Same-day operator review if this run is on the live path; otherwise next staffed review window.",
      evidence: [
        `Task kind: ${taskKind}`,
        `Approval reason: ${approvalReason}`,
        params.sessionKey ? `Session key: ${params.sessionKey}` : null,
        params.sessionId ? `Session id: ${params.sessionId}` : null,
        `Run id: ${params.runId}`,
      ].filter(Boolean) as string[],
      nonScope:
        "This does not authorize broader pricing, policy, rights/privacy, or scope changes outside this blocked run.",
      repoContext: {
        repo: "Blueprint-WebApp",
        project: "blueprint-webapp",
        sourceRef: params.runId,
      },
      policyContext: {
        gateMode: "universal_founder_inbox",
        reasonCategory: approvalReason,
        autoExecutionEligible: false,
      },
    },
  });
}

export async function dispatchActionApprovalHumanBlocker(params: {
  lane: string;
  sourceCollection: string;
  sourceDocId: string;
  actionType: ActionType;
  approvalReason: string | null | undefined;
  ledgerDocId: string;
}) {
  const approvalReason = normalizeText(params.approvalReason) || "requires_human_review";
  const executionOwner = executionOwnerForLane(params.lane);
  const blockerKind = humanBlockerKindForLane(params.lane);
  return dispatchHumanBlocker({
    delivery_mode: "review_required",
    blocker_kind: blockerKind,
    review_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    sender_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    ops_work_item_id: params.ledgerDocId,
    execution_owner: executionOwner,
    packet: {
      blockerId: blockerId("action", [
        params.lane,
        params.sourceCollection,
        params.sourceDocId,
        params.actionType,
        approvalReason,
      ]),
      title: `${titleCase(params.lane)} action requires human review`,
      summary: `The ${params.actionType} action for ${params.sourceCollection}/${params.sourceDocId} is queued in pending approval.`,
      decisionType: "queued_action_approval",
      recommendedAnswer: approvalRecommendedAnswer(approvalReason),
      exactResponseNeeded:
        "Reply with approved, rejected, or revise: <exact change> for this queued action.",
      whyBlocked: `This action was stopped by the lane safety policy because ${approvalReason}.`,
      alternatives: [
        "Reject the action and keep the record pending for manual handling.",
        "Reply with the exact change required and rerun the lane against the saved source record.",
      ],
      risk:
        "Approving the wrong action can send unsupported external communications or advance the wrong operator state.",
      executionOwner,
      immediateNextAction:
        "Resume from the saved ledger entry and execute or revise the queued action.",
      deadline: "Before the next operator review window for this lane.",
      evidence: [
        `Lane: ${params.lane}`,
        `Action type: ${params.actionType}`,
        `Source: ${params.sourceCollection}/${params.sourceDocId}`,
        `Approval reason: ${approvalReason}`,
        `Ledger id: ${params.ledgerDocId}`,
      ],
      nonScope:
        "This does not authorize unrelated pricing, rights/privacy, legal, or policy changes outside this one queued action.",
      repoContext: {
        repo: "Blueprint-WebApp",
        project: "blueprint-webapp",
        opsWorkItemId: params.ledgerDocId,
        sourceRef: `${params.sourceCollection}/${params.sourceDocId}`,
      },
      policyContext: {
        gateMode: "universal_founder_inbox",
        reasonCategory: approvalReason,
        autoExecutionEligible: false,
      },
    },
  });
}

export async function dispatchPostSignupHumanBlocker(params: {
  sourceCollection: string;
  sourceDocId: string;
  actionType: string;
  approvalReason: string | null | undefined;
  ledgerId?: string | null;
  idempotencyKey?: string | null;
}) {
  const approvalReason =
    normalizeText(params.approvalReason) || "post_signup_requires_human_review";

  return dispatchHumanBlocker({
    delivery_mode: "review_required",
    blocker_kind: "ops_commercial",
    review_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    sender_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    ops_work_item_id: params.ledgerId || null,
    execution_owner: "ops-lead",
    packet: {
      blockerId: blockerId("post-signup", [
        params.sourceCollection,
        params.sourceDocId,
        params.actionType,
        approvalReason,
        normalizeText(params.idempotencyKey),
      ]),
      title: "Post-signup automation requires human review",
      summary:
        `A post-signup ${params.actionType} action for ${params.sourceCollection}/${params.sourceDocId} ` +
        "is blocked pending human review.",
      recommendedAnswer:
        "Approve the post-signup action only if the exact-site scheduling and follow-up details are correct.",
      exactResponseNeeded:
        "Reply with approved, rejected, or revise: <exact change> for the blocked post-signup action.",
      whyBlocked: `The post-signup execution path stopped because ${approvalReason}.`,
      alternatives: [
        "Reject the action and handle the onboarding step manually.",
        "Reply with the exact change needed and rerun the blocked post-signup step.",
      ],
      risk:
        "Approving the wrong post-signup step can send the buyer the wrong scheduling or onboarding signal.",
      executionOwner: "ops-lead",
      immediateNextAction:
        "Resume the post-signup step from the saved ledger record and complete the correct onboarding action.",
      deadline: "Before the next buyer-facing onboarding checkpoint.",
      evidence: [
        `Source: ${params.sourceCollection}/${params.sourceDocId}`,
        `Action type: ${params.actionType}`,
        `Approval reason: ${approvalReason}`,
        params.ledgerId ? `Ledger id: ${params.ledgerId}` : null,
        params.idempotencyKey ? `Idempotency key: ${params.idempotencyKey}` : null,
      ].filter(Boolean) as string[],
      nonScope:
        "This does not authorize new pricing, contract, or broader commercial commitments outside the blocked post-signup step.",
    },
  });
}

export async function dispatchWorkflowHumanReviewBlocker(params: {
  lane: "waitlist" | "inbound" | "support" | "payout" | "preview";
  sourceCollection: string;
  sourceDocId: string;
  recommendedPath?: string | null;
  nextAction: string;
  confidence?: number | null;
  blockReasonCode?: string | null;
  rationale?: string | null;
  summary?: string | null;
}) {
  const blockerKind = humanBlockerKindForLane(params.lane);
  const executionOwner =
    params.lane === "preview" ? "webapp-codex" : executionOwnerForLane(params.lane);
  const reason = normalizeText(params.blockReasonCode) || "requires_human_review";

  return dispatchHumanBlocker({
    delivery_mode: "review_required",
    blocker_kind: blockerKind,
    review_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    sender_owner: HUMAN_BLOCKER_REVIEW_OWNER,
    execution_owner: executionOwner,
    packet: {
      blockerId: blockerId("workflow", [
        params.lane,
        params.sourceCollection,
        params.sourceDocId,
        normalizeText(params.recommendedPath),
        reason,
      ]),
      title: `${titleCase(params.lane)} workflow requires human review`,
      summary:
        normalizeText(params.summary) ||
        `The ${params.lane} workflow for ${params.sourceCollection}/${params.sourceDocId} marked the item for human review.`,
      recommendedAnswer:
        blockerKind === "technical"
          ? "Approve the next technical follow-through only if the diagnosis and recovery path are correct."
          : "Approve the next operator action only if it stays within the current Blueprint guardrails.",
      exactResponseNeeded:
        "Reply with approved, rejected, or revise: <exact change> for this blocked workflow item.",
      whyBlocked:
        `The ${params.lane} workflow cannot proceed safely without human review because ${reason}.`,
      alternatives: [
        "Reject the recommended path and keep the item blocked for manual handling.",
        "Reply with the exact correction needed and rerun the workflow from the saved state.",
      ],
      risk:
        blockerKind === "technical"
          ? "Approving the wrong diagnosis can hide a real release or provider issue."
          : "Approving the wrong workflow path can create unsupported buyer, ops, or commercial commitments.",
      executionOwner,
      immediateNextAction: params.nextAction,
      deadline: "Before the next staffed review window for this lane.",
      evidence: [
        `Lane: ${params.lane}`,
        `Source: ${params.sourceCollection}/${params.sourceDocId}`,
        params.recommendedPath ? `Recommended path: ${params.recommendedPath}` : null,
        params.confidence !== undefined && params.confidence !== null
          ? `Confidence: ${params.confidence}`
          : null,
        params.blockReasonCode ? `Block reason: ${params.blockReasonCode}` : null,
        params.rationale ? `Rationale: ${params.rationale}` : null,
      ].filter(Boolean) as string[],
      nonScope:
        "This does not authorize unrelated pricing, rights/privacy, legal, or scope changes outside this workflow item.",
    },
  });
}

export async function safelyDispatchHumanBlocker(
  label: string,
  dispatcher: () => Promise<unknown>,
) {
  try {
    await dispatcher();
  } catch (error) {
    logger.warn({ err: error, label }, "Failed to dispatch standard human blocker packet");
  }
}
