import crypto from "node:crypto";
import type { DocumentReference } from "firebase-admin/firestore";

import type { ActionPayload, ActionType, DraftOutput, LaneSafetyPolicy } from "./action-policies";
import { executeAction, type ActionResult } from "./action-executor";

export type Phase2WorkflowLane = "waitlist" | "inbound" | "support" | "payout";

export type Phase2WorkflowActionSpec = {
  actionKey: string;
  actionType: ActionType;
  actionPayload: ActionPayload;
  policy: LaneSafetyPolicy;
};

export type Phase2WorkflowActionRecord = {
  action_key: string;
  action_type: ActionType;
  action_state: ActionResult["state"];
  action_tier: ActionResult["tier"];
  idempotency_key: string;
  ledger_doc_id: string;
  auto_approve_reason: string | null;
  error: string | null;
  executed_at: string;
};

type PersistPhase2ActionStateParams = {
  docRef: DocumentReference;
  existingOpsAutomation: Record<string, unknown>;
  record: Phase2WorkflowActionRecord;
};

type ExecutePhase2WorkflowActionsParams = {
  docRef: DocumentReference;
  sourceCollection: string;
  sourceDocId: string;
  lane: Phase2WorkflowLane;
  draftOutput: DraftOutput;
  existingOpsAutomation: Record<string, unknown>;
  actions: Phase2WorkflowActionSpec[];
};

function createPhase2IdempotencyKey(params: {
  lane: Phase2WorkflowLane;
  sourceCollection: string;
  sourceDocId: string;
  actionKey: string;
  actionType: ActionType;
  actionPayload: ActionPayload;
  draftOutput: DraftOutput;
}) {
  const payload = JSON.stringify({
    lane: params.lane,
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionKey: params.actionKey,
    actionType: params.actionType,
    actionPayload: params.actionPayload,
    draftOutput: params.draftOutput,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

function createInternalRoutingPolicy(lane: Phase2WorkflowLane): LaneSafetyPolicy {
  return {
    lane: `${lane}_internal_routing`,
    autoApproveCriteria: () => true,
    alwaysHumanReview: () => false,
    maxDailyAutoSends: 1_000,
    contentChecks: false,
  };
}

function normalizePhase2Actions(
  existingOpsAutomation: Record<string, unknown>,
): Phase2WorkflowActionRecord[] {
  const raw = existingOpsAutomation.phase2_actions;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((item): item is Phase2WorkflowActionRecord => {
    return Boolean(
      item &&
        typeof item === "object" &&
        typeof (item as Phase2WorkflowActionRecord).action_key === "string" &&
        typeof (item as Phase2WorkflowActionRecord).action_type === "string" &&
        typeof (item as Phase2WorkflowActionRecord).action_state === "string" &&
        typeof (item as Phase2WorkflowActionRecord).idempotency_key === "string" &&
        typeof (item as Phase2WorkflowActionRecord).ledger_doc_id === "string",
    );
  });
}

async function persistPhase2ActionState(
  params: PersistPhase2ActionStateParams,
): Promise<void> {
  const history = normalizePhase2Actions(params.existingOpsAutomation);
  const nextHistory = [...history, params.record];

  await params.docRef.set(
    {
      ops_automation: {
        ...params.existingOpsAutomation,
        phase2_action_state: params.record.action_state,
        phase2_action_type: params.record.action_type,
        phase2_action_tier: params.record.action_tier,
        phase2_action_idempotency_key: params.record.idempotency_key,
        phase2_action_ledger_ref: params.record.ledger_doc_id,
        phase2_action_error: params.record.error,
        phase2_action_auto_approve_reason: params.record.auto_approve_reason,
        phase2_action_executed_at: params.record.executed_at,
        phase2_actions: nextHistory,
      },
    },
    { merge: true },
  );
}

export async function executePhase2WorkflowActions(
  params: ExecutePhase2WorkflowActionsParams,
): Promise<{
  records: Phase2WorkflowActionRecord[];
  lastResult: ActionResult | null;
  lastState: ActionResult["state"] | null;
}> {
  let currentOpsAutomation = params.existingOpsAutomation;
  let lastResult: ActionResult | null = null;
  const records: Phase2WorkflowActionRecord[] = [];

  for (const action of params.actions) {
    const idempotencyKey = createPhase2IdempotencyKey({
      lane: params.lane,
      sourceCollection: params.sourceCollection,
      sourceDocId: params.sourceDocId,
      actionKey: action.actionKey,
      actionType: action.actionType,
      actionPayload: action.actionPayload,
      draftOutput: params.draftOutput,
    });

    const result = await executeAction({
      sourceCollection: params.sourceCollection,
      sourceDocId: params.sourceDocId,
      actionType: action.actionType,
      actionPayload: action.actionPayload,
      safetyPolicy: action.policy,
      draftOutput: params.draftOutput,
      idempotencyKey,
    });

    const record: Phase2WorkflowActionRecord = {
      action_key: action.actionKey,
      action_type: action.actionType,
      action_state: result.state,
      action_tier: result.tier,
      idempotency_key: idempotencyKey,
      ledger_doc_id: result.ledgerDocId,
      auto_approve_reason: result.autoApproveReason ?? null,
      error: result.error ?? null,
      executed_at: new Date().toISOString(),
    };

    await persistPhase2ActionState({
      docRef: params.docRef,
      existingOpsAutomation: currentOpsAutomation,
      record,
    });

    currentOpsAutomation = {
      ...currentOpsAutomation,
      phase2_action_state: record.action_state,
      phase2_action_type: record.action_type,
      phase2_action_tier: record.action_tier,
      phase2_action_idempotency_key: record.idempotency_key,
      phase2_action_ledger_ref: record.ledger_doc_id,
      phase2_action_error: record.error,
      phase2_action_auto_approve_reason: record.auto_approve_reason,
      phase2_action_executed_at: record.executed_at,
      phase2_actions: [...normalizePhase2Actions(currentOpsAutomation), record],
    };

    records.push(record);
    lastResult = result;

    if (result.state === "failed" || result.state === "pending_approval") {
      break;
    }
  }

  return {
    records,
    lastResult,
    lastState: lastResult?.state ?? null,
  };
}

export function makeWorkflowDraftStatePatch(params: {
  existingOpsAutomation: Record<string, unknown>;
  lane: Phase2WorkflowLane;
  queue: string;
  nextAction: string;
  recommendation?: string;
  confidence?: number | null;
  requiresHumanReview?: boolean | null;
  retryable?: boolean | null;
  blockReasonCode?: string | null;
}) {
  return {
    phase2_action_state: "draft_ready",
    phase2_action_type: "draft",
    phase2_action_tier: null,
    phase2_action_idempotency_key: null,
    phase2_action_ledger_ref: null,
    phase2_action_error: null,
    phase2_action_auto_approve_reason: null,
    phase2_action_executed_at: null,
    phase2_actions: normalizePhase2Actions(params.existingOpsAutomation),
    phase2_lane: params.lane,
    queue: params.queue,
    next_action: params.nextAction,
    recommendation: params.recommendation ?? null,
    confidence: params.confidence ?? null,
    requires_human_review: params.requiresHumanReview ?? null,
    retryable: params.retryable ?? null,
    block_reason_code: params.blockReasonCode ?? null,
  } as const;
}

export function createPhase2RoutingPolicy(lane: Phase2WorkflowLane): LaneSafetyPolicy {
  return createInternalRoutingPolicy(lane);
}
