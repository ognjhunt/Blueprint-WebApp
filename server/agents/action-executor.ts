// Phase 2 — Action Ledger & Executor
//
// Evaluates a lane agent's draft output against the lane's safety policy,
// writes an action_ledger document, and (when permitted) executes the action.
//
// Supports idempotency, daily volume caps, content validation, tier-based
// routing (auto / auto-with-notify / human-required), and operator
// approve/reject/retry flows.

import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { sendEmail } from "../utils/email";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../utils/google-calendar";
import { sendSlackMessage } from "../utils/slack";
import { logger } from "../logger";

function getDb() {
  if (!dbAdmin) throw new Error("Firestore is not initialized");
  return dbAdmin;
}
import {
  type ActionPayload,
  type ActionTier,
  type ActionType,
  type DraftOutput,
  type LaneSafetyPolicy,
  evaluateActionTier,
  validateEmailContent,
} from "./action-policies";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ActionState =
  | "draft_ready"
  | "auto_approved"
  | "pending_approval"
  | "operator_approved"
  | "operator_rejected"
  | "executing"
  | "sent"
  | "failed"
  | "rejected";

export interface ActionResult {
  state: ActionState;
  tier: ActionTier;
  ledgerDocId: string;
  autoApproveReason?: string;
  error?: string;
}

export interface ExecuteActionParams {
  sourceCollection: string;
  sourceDocId: string;
  actionType: ActionType;
  actionPayload: ActionPayload;
  safetyPolicy: LaneSafetyPolicy;
  draftOutput: DraftOutput;
  idempotencyKey: string;
}

function validateCampaignEmailPayload(
  payload: ActionPayload,
): { valid: boolean; reason?: string } {
  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter((value): value is string => typeof value === "string")
    : [];

  if (recipients.length === 0) {
    return { valid: false, reason: "At least one campaign recipient is required" };
  }

  for (const recipient of recipients) {
    if (!recipient.includes("@")) {
      return { valid: false, reason: `Invalid campaign recipient email: ${recipient}` };
    }
  }

  return validateEmailContent({
    ...payload,
    to: recipients[0],
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function executeAction(
  params: ExecuteActionParams,
): Promise<ActionResult> {
  const {
    sourceCollection,
    sourceDocId,
    actionType,
    actionPayload,
    safetyPolicy,
    draftOutput,
    idempotencyKey,
  } = params;

  // 1. Idempotency check — look up existing ledger doc
  const existingLedger = await findLedgerByIdempotencyKey(idempotencyKey);
  if (existingLedger) {
    if (existingLedger.status === "sent") {
      return {
        state: "sent",
        tier: existingLedger.action_tier,
        ledgerDocId: existingLedger.id,
        autoApproveReason: "already_sent",
      };
    }
    if (
      existingLedger.status === "failed" &&
      existingLedger.execution_attempts >= 3
    ) {
      return {
        state: "failed",
        tier: existingLedger.action_tier,
        ledgerDocId: existingLedger.id,
        error: "max_retries_exceeded",
      };
    }
    // If failed with retries remaining, fall through to retry
  }

  // 2. Evaluate tier
  const tier = evaluateActionTier(draftOutput, safetyPolicy);

  // 3. Content validation for email actions
  if (
    safetyPolicy.contentChecks &&
    (actionType === "send_email" || actionType === "send_campaign_emails")
  ) {
    const validation =
      actionType === "send_campaign_emails"
        ? validateCampaignEmailPayload(actionPayload)
        : validateEmailContent(actionPayload);
    if (!validation.valid) {
      const ledgerDocId = await writeLedgerDoc({
        idempotencyKey,
        lane: safetyPolicy.lane,
        actionType,
        tier: 3,
        sourceCollection,
        sourceDocId,
        actionPayload,
        draftOutput,
        status: "pending_approval",
        autoApproveReason: null,
        approvalReason: `content_validation_failed: ${validation.reason}`,
      });
      await syncSourceDocumentState({
        sourceCollection,
        sourceDocId,
        actionType,
        actionPayload,
        ledgerDocId,
        state: "pending_approval",
        approvalReason: `content_validation_failed: ${validation.reason}`,
      });
      return {
        state: "pending_approval",
        tier: 3,
        ledgerDocId,
        error: validation.reason,
      };
    }
  }

  // 4. Daily volume cap check
  if (tier !== 3) {
    const todayCount = await countTodayAutoSends(safetyPolicy.lane);
    if (todayCount >= safetyPolicy.maxDailyAutoSends) {
      const ledgerDocId = await writeLedgerDoc({
        idempotencyKey,
        lane: safetyPolicy.lane,
        actionType,
        tier: 3,
        sourceCollection,
        sourceDocId,
        actionPayload,
        draftOutput,
        status: "pending_approval",
        autoApproveReason: null,
        approvalReason: `daily_cap_exceeded: ${todayCount}/${safetyPolicy.maxDailyAutoSends}`,
      });
      await syncSourceDocumentState({
        sourceCollection,
        sourceDocId,
        actionType,
        actionPayload,
        ledgerDocId,
        state: "pending_approval",
        approvalReason: `daily_cap_exceeded: ${todayCount}/${safetyPolicy.maxDailyAutoSends}`,
      });
      return { state: "pending_approval", tier: 3, ledgerDocId };
    }
  }

  // 5. Route by tier
  if (tier === 3) {
    const ledgerDocId =
      existingLedger?.id ??
      (await writeLedgerDoc({
        idempotencyKey,
        lane: safetyPolicy.lane,
        actionType,
        tier,
        sourceCollection,
        sourceDocId,
        actionPayload,
        draftOutput,
        status: "pending_approval",
        autoApproveReason: null,
        approvalReason: "requires_human_review",
      }));
    await syncSourceDocumentState({
      sourceCollection,
      sourceDocId,
      actionType,
      actionPayload,
      ledgerDocId,
      state: "pending_approval",
      approvalReason: "requires_human_review",
    });
    return { state: "pending_approval", tier, ledgerDocId };
  }

  // Tier 1 or 2: auto-execute
  const autoApproveReason =
    tier === 1 ? "policy_auto_approved" : "policy_auto_with_notification";
  const ledgerDocId =
    existingLedger?.id ??
    (await writeLedgerDoc({
      idempotencyKey,
      lane: safetyPolicy.lane,
      actionType,
      tier,
      sourceCollection,
      sourceDocId,
      actionPayload,
      draftOutput,
      status: "auto_approved",
      autoApproveReason,
      approvalReason: null,
    }));
  await syncSourceDocumentState({
    sourceCollection,
    sourceDocId,
    actionType,
    actionPayload,
    ledgerDocId,
    state: "auto_approved",
  });

  // 6. Execute the action
  try {
    await updateLedgerStatus(ledgerDocId, "executing");
    await syncSourceDocumentState({
      sourceCollection,
      sourceDocId,
      actionType,
      actionPayload,
      ledgerDocId,
      state: "executing",
    });
    await performAction(actionType, actionPayload);
    await updateLedgerStatus(ledgerDocId, "sent", { sent_at: new Date() });
    await syncSourceDocumentState({
      sourceCollection,
      sourceDocId,
      actionType,
      actionPayload,
      ledgerDocId,
      state: "sent",
    });

    // Tier 2: send notification
    if (tier === 2) {
      await notifyOperatorOfAutoAction(
        safetyPolicy.lane,
        sourceCollection,
        sourceDocId,
        actionType,
      );
    }

    return { state: "sent", tier, ledgerDocId, autoApproveReason };
  } catch (err) {
    const attempts = (existingLedger?.execution_attempts ?? 0) + 1;
    await updateLedgerStatus(ledgerDocId, "failed", {
      last_execution_error:
        err instanceof Error ? err.message : String(err),
      execution_attempts: attempts,
    });
    await syncSourceDocumentState({
      sourceCollection,
      sourceDocId,
      actionType,
      actionPayload,
      ledgerDocId,
      state: "failed",
      error: err instanceof Error ? err.message : String(err),
    });

    if (attempts >= 3) {
      await notifyOperatorOfFailure(
        safetyPolicy.lane,
        sourceCollection,
        sourceDocId,
        ledgerDocId,
      );
    }

    return {
      state: "failed",
      tier,
      ledgerDocId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Operator actions
// ---------------------------------------------------------------------------

/** Approve a pending action (called from admin routes). */
export async function approveAction(
  ledgerDocId: string,
  operatorEmail: string,
): Promise<ActionResult> {
  const ledgerRef = getDb().collection("action_ledger").doc(ledgerDocId);
  const ledgerDoc = await ledgerRef.get();
  if (!ledgerDoc.exists) throw new Error(`Ledger doc ${ledgerDocId} not found`);

  const data = ledgerDoc.data()!;
  if (data.status !== "pending_approval") {
    throw new Error(`Cannot approve action in state: ${data.status}`);
  }

  await ledgerRef.update({
    status: "operator_approved",
    approved_by: operatorEmail,
    approved_at: new Date(),
    updated_at: new Date(),
  });
  await syncSourceDocumentState({
    sourceCollection: data.source_collection,
    sourceDocId: data.source_doc_id,
    actionType: data.action_type,
    actionPayload: data.action_payload,
    ledgerDocId,
    state: "operator_approved",
    approvedBy: operatorEmail,
  });

  // Now execute
  try {
    await ledgerRef.update({ status: "executing", updated_at: new Date() });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "executing",
      approvedBy: operatorEmail,
    });
    await performAction(data.action_type, data.action_payload);
    await ledgerRef.update({
      status: "sent",
      sent_at: new Date(),
      updated_at: new Date(),
    });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "sent",
      approvedBy: operatorEmail,
    });

    // Log override
    await ledgerRef.collection("overrides").add({
      operator_email: operatorEmail,
      decision: "approved",
      reason: null,
      original_payload: data.action_payload,
      modified_payload: null,
      timestamp: new Date(),
    });

    return { state: "sent", tier: data.action_tier, ledgerDocId };
  } catch (err) {
    const attempts = (data.execution_attempts ?? 0) + 1;
    await ledgerRef.update({
      status: "failed",
      last_execution_error:
        err instanceof Error ? err.message : String(err),
      execution_attempts: attempts,
      updated_at: new Date(),
    });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "failed",
      approvedBy: operatorEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      state: "failed",
      tier: data.action_tier,
      ledgerDocId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Reject a pending action. */
export async function rejectAction(
  ledgerDocId: string,
  operatorEmail: string,
  reason: string,
): Promise<ActionResult> {
  const ledgerRef = getDb().collection("action_ledger").doc(ledgerDocId);
  const ledgerDoc = await ledgerRef.get();
  if (!ledgerDoc.exists) throw new Error(`Ledger doc ${ledgerDocId} not found`);

  const data = ledgerDoc.data()!;
  if (data.status !== "pending_approval") {
    throw new Error(`Cannot reject action in state: ${data.status}`);
  }

  await ledgerRef.update({
    status: "rejected",
    rejected_by: operatorEmail,
    rejected_reason: reason,
    updated_at: new Date(),
  });
  await syncSourceDocumentState({
    sourceCollection: data.source_collection,
    sourceDocId: data.source_doc_id,
    actionType: data.action_type,
    actionPayload: data.action_payload,
    ledgerDocId,
    state: "rejected",
    rejectedReason: reason,
  });

  await ledgerRef.collection("overrides").add({
    operator_email: operatorEmail,
    decision: "rejected",
    reason,
    original_payload: data.action_payload,
    modified_payload: null,
    timestamp: new Date(),
  });

  return { state: "rejected", tier: data.action_tier, ledgerDocId };
}

/** Retry a failed action. */
export async function retryFailedAction(
  ledgerDocId: string,
): Promise<ActionResult> {
  const ledgerRef = getDb().collection("action_ledger").doc(ledgerDocId);
  const ledgerDoc = await ledgerRef.get();
  if (!ledgerDoc.exists) throw new Error(`Ledger doc ${ledgerDocId} not found`);

  const data = ledgerDoc.data()!;
  if (data.status !== "failed")
    throw new Error(`Cannot retry action in state: ${data.status}`);
  if (data.execution_attempts >= 3) throw new Error("Max retries exceeded");

  try {
    await ledgerRef.update({ status: "executing", updated_at: new Date() });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "executing",
    });
    await performAction(data.action_type, data.action_payload);
    await ledgerRef.update({
      status: "sent",
      sent_at: new Date(),
      execution_attempts: (data.execution_attempts ?? 0) + 1,
      updated_at: new Date(),
    });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "sent",
    });
    return { state: "sent", tier: data.action_tier, ledgerDocId };
  } catch (err) {
    const attempts = (data.execution_attempts ?? 0) + 1;
    await ledgerRef.update({
      status: "failed",
      last_execution_error:
        err instanceof Error ? err.message : String(err),
      execution_attempts: attempts,
      updated_at: new Date(),
    });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      state: "failed",
      tier: data.action_tier,
      ledgerDocId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function findLedgerByIdempotencyKey(key: string) {
  const snap = await getDb()
    .collection("action_ledger")
    .where("idempotency_key", "==", key)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Record<string, any>;
}

interface WriteLedgerParams {
  idempotencyKey: string;
  lane: string;
  actionType: ActionType;
  tier: ActionTier;
  sourceCollection: string;
  sourceDocId: string;
  actionPayload: ActionPayload;
  draftOutput: DraftOutput;
  status: ActionState;
  autoApproveReason: string | null;
  approvalReason: string | null;
}

async function writeLedgerDoc(params: WriteLedgerParams): Promise<string> {
  const ref = getDb().collection("action_ledger").doc();
  await ref.set({
    idempotency_key: params.idempotencyKey,
    lane: params.lane,
    action_type: params.actionType,
    action_tier: params.tier,
    source_collection: params.sourceCollection,
    source_doc_id: params.sourceDocId,
    action_payload: params.actionPayload,
    draft_output: params.draftOutput,
    status: params.status,
    auto_approve_reason: params.autoApproveReason,
    approval_reason: params.approvalReason,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_reason: null,
    execution_attempts: 0,
    last_execution_at: null,
    last_execution_error: null,
    sent_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return ref.id;
}

async function updateLedgerStatus(
  docId: string,
  status: ActionState,
  extra?: Record<string, unknown>,
) {
  await getDb()
    .collection("action_ledger")
    .doc(docId)
    .update({
      status,
      updated_at: new Date(),
      ...(extra ?? {}),
    });
}

async function syncSourceDocumentState(params: {
  sourceCollection?: string | null;
  sourceDocId?: string | null;
  actionType: ActionType;
  actionPayload: ActionPayload;
  ledgerDocId: string;
  state: ActionState;
  approvalReason?: string | null;
  rejectedReason?: string | null;
  approvedBy?: string | null;
  error?: string | null;
}) {
  const sourceCollection = typeof params.sourceCollection === "string" ? params.sourceCollection.trim() : "";
  const sourceDocId = typeof params.sourceDocId === "string" ? params.sourceDocId.trim() : "";
  if (!sourceCollection || !sourceDocId) {
    return;
  }

  const ref = getDb().collection(sourceCollection).doc(sourceDocId);
  const now = new Date();
  const nowIso = now.toISOString();

  if (sourceCollection === "growthCampaigns") {
    await ref.set(
      {
        send_status: params.state,
        last_ledger_doc_id: params.ledgerDocId,
        approval_reason: params.approvalReason ?? null,
        rejected_reason: params.rejectedReason ?? null,
        last_execution_error: params.error ?? null,
        approved_by: params.approvedBy ?? null,
        approved_at: params.approvedBy ? nowIso : null,
        sent_at: params.state === "sent" ? nowIso : null,
        updated_at: nowIso,
      },
      { merge: true },
    );
    return;
  }

  if (sourceCollection === "marketplaceEntitlements" && params.actionType === "send_email") {
    const lifecycleStage =
      typeof params.actionPayload.lifecycleStage === "string"
        ? params.actionPayload.lifecycleStage
        : null;
    const lifecycleDaysSinceGrant =
      typeof params.actionPayload.lifecycleDaysSinceGrant === "number"
        ? params.actionPayload.lifecycleDaysSinceGrant
        : null;
    const subject =
      typeof params.actionPayload.subject === "string" ? params.actionPayload.subject : null;
    const buyerEmail =
      typeof params.actionPayload.to === "string" ? params.actionPayload.to : null;

    await ref.set(
      {
        buyer_success: {
          lifecycle: {
            last_stage: lifecycleStage,
            last_days_since_grant: lifecycleDaysSinceGrant,
            last_status: params.state,
            last_ledger_doc_id: params.ledgerDocId,
            last_subject: subject,
            last_buyer_email: buyerEmail,
            last_approval_reason: params.approvalReason ?? null,
            last_rejected_reason: params.rejectedReason ?? null,
            last_error: params.error ?? null,
            approved_by: params.approvedBy ?? null,
            approved_at: params.approvedBy ? nowIso : null,
            last_sent_at: params.state === "sent" ? nowIso : null,
            updated_at: nowIso,
          },
        },
        updated_at: now,
      },
      { merge: true },
    );
  }
}

async function countTodayAutoSends(lane: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const snap = await getDb()
    .collection("action_ledger")
    .where("lane", "==", lane)
    .where("status", "in", ["sent", "auto_approved", "executing"])
    .where("created_at", ">=", startOfDay)
    .get();
  return snap.size;
}

async function performAction(
  actionType: ActionType,
  payload: ActionPayload,
): Promise<void> {
  switch (actionType) {
    case "send_email":
      await sendEmail({
        to: payload.to!,
        subject: payload.subject!,
        text: payload.body!,
      });
      break;
    case "send_campaign_emails": {
      const recipients = Array.isArray(payload.recipients)
        ? payload.recipients.filter((value): value is string => typeof value === "string" && value.includes("@"))
        : [];
      if (recipients.length === 0) {
        throw new Error("Campaign send requires at least one recipient");
      }

      const failures: string[] = [];
      for (const recipient of recipients) {
        const result = await sendEmail({
          to: recipient,
          subject: payload.subject!,
          text: payload.body!,
          replyTo:
            typeof payload.replyTo === "string" ? payload.replyTo : undefined,
          sendGridCategories: ["blueprint_growth_campaign"],
          sendGridCustomArgs:
            typeof payload.campaignId === "string" && payload.campaignId.trim()
              ? {
                  bp_campaign_id: payload.campaignId,
                }
              : undefined,
        });

        if (!result.sent) {
          failures.push(recipient);
        }
      }

      if (payload.collection && payload.docId) {
        await getDb()
          .collection(String(payload.collection))
          .doc(String(payload.docId))
          .set(
            {
              event_counts: {
                sent: recipients.length - failures.length,
              },
              recipient_count: recipients.length,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
      }

      if (failures.length > 0) {
        throw new Error(`Campaign send failed for ${failures.length} recipient(s): ${failures.join(", ")}`);
      }
      break;
    }
    case "send_slack":
      await sendSlackMessage(payload.message ?? payload.body ?? "");
      break;
    case "route_to_queue":
      if (payload.collection && payload.docId && payload.queue) {
        await getDb()
          .collection(payload.collection)
          .doc(payload.docId)
          .update({
            "ops_automation.queue": payload.queue,
            "ops_automation.routed_at": new Date(),
            updated_at: new Date(),
          });
      }
      break;
    case "update_firestore_status":
      if (payload.collection && payload.docId && payload.updates) {
        await getDb()
          .collection(payload.collection)
          .doc(payload.docId)
          .update({
            ...payload.updates,
            updated_at: new Date(),
          });
      }
      break;
    case "create_calendar_event":
      await createGoogleCalendarEvent({
        calendarId:
          typeof payload.calendarId === "string" ? payload.calendarId : undefined,
        title:
          typeof payload.title === "string"
            ? payload.title
            : typeof payload.subject === "string"
              ? payload.subject
              : "Blueprint calendar event",
        description:
          typeof payload.description === "string"
            ? payload.description
            : typeof payload.body === "string"
              ? payload.body
              : "",
        address: typeof payload.address === "string" ? payload.address : "",
        date:
          typeof payload.date === "string"
            ? payload.date
            : typeof payload.mappingDate === "string"
              ? payload.mappingDate
              : "",
        time:
          typeof payload.time === "string"
            ? payload.time
            : typeof payload.mappingTime === "string"
              ? payload.mappingTime
              : "",
        attendeeEmail:
          typeof payload.contactEmail === "string" ? payload.contactEmail : undefined,
      });
      break;
    case "update_calendar_event":
      if (typeof payload.eventId !== "string" || payload.eventId.trim().length === 0) {
        throw new Error("Calendar update requires an eventId");
      }

      await updateGoogleCalendarEvent({
        calendarId:
          typeof payload.calendarId === "string" ? payload.calendarId : undefined,
        eventId: payload.eventId,
        title: typeof payload.title === "string" ? payload.title : null,
        description:
          typeof payload.description === "string"
            ? payload.description
            : typeof payload.body === "string"
              ? payload.body
              : null,
        address: typeof payload.address === "string" ? payload.address : null,
        date:
          typeof payload.date === "string"
            ? payload.date
            : typeof payload.mappingDate === "string"
              ? payload.mappingDate
              : "",
        time:
          typeof payload.time === "string"
            ? payload.time
            : typeof payload.mappingTime === "string"
              ? payload.mappingTime
              : "",
        attendeeEmail:
          typeof payload.contactEmail === "string" ? payload.contactEmail : undefined,
      });
      break;
    case "update_sheet":
      // Sheets remain lane-specific today; post-signup wraps these outside the executor.
      // workstreams. For now just log.
      logger.warn(
        `Action type ${actionType} not yet wired to executor — requires lane-specific integration`,
      );
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

async function notifyOperatorOfAutoAction(
  lane: string,
  sourceCollection: string,
  sourceDocId: string,
  actionType: string,
) {
  try {
    await sendSlackMessage(
      `[Phase 2] Auto-executed ${actionType} for ${lane} (${sourceCollection}/${sourceDocId})`,
    );
  } catch {
    logger.warn("Failed to notify operator of auto-action", {
      lane,
      sourceCollection,
      sourceDocId,
    } as any);
  }
}

async function notifyOperatorOfFailure(
  lane: string,
  sourceCollection: string,
  sourceDocId: string,
  ledgerDocId: string,
) {
  try {
    await sendSlackMessage(
      `[Phase 2 ALERT] Action failed 3x for ${lane} (${sourceCollection}/${sourceDocId}) — ledger: ${ledgerDocId}`,
    );
  } catch {
    logger.warn("Failed to notify operator of failure", {
      lane,
      sourceCollection,
      sourceDocId,
    } as any);
  }
}
