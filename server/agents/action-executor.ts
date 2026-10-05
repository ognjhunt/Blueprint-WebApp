import { humanDecisionBinding, humanDecisionDigest, humanReplyAdmissionError } from "../utils/human-reply-admission";
import type { HumanBlockerThreadRecord, HumanReplyEventRecord } from "../utils/human-reply-store";
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
  appendCommercialEmailFooter,
  isEmailSuppressed,
} from "../utils/email-suppression";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../utils/google-calendar";
import {
  dispatchActionApprovalHumanBlocker,
  safelyDispatchHumanBlocker,
} from "../utils/human-blocker-autonomy";
import { sendSlackMessage } from "../utils/slack";
import { logger } from "../logger";
import { reviewOutreachDraft, validateOutreachSemanticReview, outreachSemanticReviewSchema } from "./outreach-review";
import { isCommunicationsPayload, reviewCommunicationsPayload } from "./communications-review";
import { communicationsSendBlocker, communicationsSendingEnabled, executeCommunicationsSend, reconcileCommunicationsSend } from "./communications-send";
import { communicationsDigest, outreachReadySendRefusal } from "./communications-contract";
import { assertNotHypothesisRecipient, prospectResearchTier, researchProspectSendBlocker } from "../utils/outboundProspects";

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
  validateRecipientEmailAddress,
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

const INTAKE_FOLLOW_UP_COLLECTIONS = new Set([
  "inboundRequests",
  "waitlistSubmissions",
  "contactRequests",
  "jobApplications",
]);

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
    const recipientValidation = validateRecipientEmailAddress(recipient);
    if (!recipientValidation.valid) {
      return {
        valid: false,
        reason: `Invalid campaign recipient email: ${recipient} (${recipientValidation.reason})`,
      };
    }
  }

  const evidenceValidation = validateRequiredCampaignRecipientEvidence(payload, recipients);
  if (!evidenceValidation.valid) {
    return evidenceValidation;
  }

  return validateEmailContent({
    ...payload,
    to: recipients[0],
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry === "string")
    .map(([key, entry]) => [key, entry as string]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function emailSuppressionScope(payload: ActionPayload, fallback: "lifecycle" | "growth_campaign") {
  return typeof payload.emailSuppressionScope === "string"
    ? payload.emailSuppressionScope
    : fallback;
}

function hasEvidenceSource(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const sourceValues = [
    record.evidenceSource,
    record.evidence_source,
    record.source,
    record.sourceUrl,
    record.source_url,
    record.url,
  ];
  if (sourceValues.some((entry) => typeof entry === "string" && entry.trim().length > 0)) {
    return true;
  }
  const sourceUrls = record.sourceUrls || record.source_urls;
  return Array.isArray(sourceUrls)
    && sourceUrls.some((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function hasRecipientEvidence(payload: ActionPayload, recipient: string) {
  const normalizedRecipient = normalizeEmail(recipient);
  if (!normalizedRecipient) {
    return false;
  }

  const evidenceByEmail = payload.recipientEvidenceByEmail || payload.recipient_evidence_by_email;
  if (evidenceByEmail && typeof evidenceByEmail === "object" && !Array.isArray(evidenceByEmail)) {
    const directEvidence = (evidenceByEmail as Record<string, unknown>)[normalizedRecipient]
      || (evidenceByEmail as Record<string, unknown>)[recipient];
    if (hasEvidenceSource(directEvidence)) {
      return true;
    }
  }

  const evidence = payload.recipientEvidence || payload.recipient_evidence;
  if (!Array.isArray(evidence)) {
    return false;
  }

  return evidence.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const record = entry as Record<string, unknown>;
    const evidenceEmail = normalizeEmail(
      record.email
      || record.recipientEmail
      || record.recipient_email
      || record.to,
    );
    return evidenceEmail === normalizedRecipient && hasEvidenceSource(record);
  });
}

function validateRequiredCampaignRecipientEvidence(
  payload: ActionPayload,
  recipients?: string[],
): { valid: boolean; reason?: string } {
  if (payload.recipientEvidenceRequired !== true) {
    return { valid: true };
  }
  const normalizedRecipients = recipients ?? (
    Array.isArray(payload.recipients)
      ? payload.recipients.filter((value): value is string => typeof value === "string")
      : []
  );
  const missingEvidence = normalizedRecipients.filter((recipient) =>
    !hasRecipientEvidence(payload, recipient),
  );
  if (missingEvidence.length === 0) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Recipient evidence required for campaign sends: missing evidence for ${missingEvidence.join(", ")}`,
  };
}

function validateActionPayloadBeforeExecution(
  actionType: ActionType,
  payload: ActionPayload,
  scope?: { lane?: string; source_collection?: string },
): { valid: boolean; reason?: string } {
  if (isProspectOutreach(scope) || isCommunicationsPayload(payload)) {
    if (actionType !== "send_email") return { valid: false, reason: "prospect_outreach_requires_single_email" };
  }
  if (actionType === "send_campaign_emails") {
    return validateCampaignEmailPayload(payload);
  }
  if (actionType === "send_email") {
    if (isProspectOutreach(scope) || isCommunicationsPayload(payload)) {
      const review = prospectOutreachReview(payload);
      if (!review.hardChecksPassed) return { valid: false, reason: review.blockers.join(", ") };
    }
    return validateEmailContent(payload);
  }
  return { valid: true };
}

function isProspectOutreach(scope?: { lane?: string; source_collection?: string; action_payload?: ActionPayload }): boolean {
  return scope?.lane === "outbound_prospect" || scope?.source_collection === "outboundProspects"
    || isCommunicationsPayload(scope?.action_payload ?? {});
}

/** A hypothesis brief is draft only; refused before content review or any flag. */
function communicationsHypothesisRefusal(payload: ActionPayload) {
  return isCommunicationsPayload(payload) ? outreachReadySendRefusal((payload.communications as any)?.brief) : null;
}

/** Research-origin refusal for the legacy mailer at the release point. The queued
 * payload does not say where the prospect came from, so this reads the canonical
 * prospect record; a record that cannot be read refuses. The address is checked
 * too: another record may hold it as a hypothesis. */
async function legacyProspectResearchBlocker(data: Record<string, any>): Promise<string | null> {
  const prospectId = typeof data.source_doc_id === "string" ? data.source_doc_id.trim() : "";
  if (data.source_collection !== "outboundProspects" || !prospectId) return "prospect_research_origin_unavailable";
  let record: Record<string, any> | undefined;
  try {
    const prospect = await getDb().collection("outboundProspects").doc(prospectId).get();
    if (!prospect?.exists) return "prospect_research_origin_unavailable";
    record = prospect.data();
  } catch {
    return "prospect_research_origin_unavailable";
  }
  const blocker = researchProspectSendBlocker(record, communicationsSendingEnabled())?.blocker;
  if (blocker) return blocker;
  try {
    await assertNotHypothesisRecipient([data.action_payload?.to, record?.contactEmail],
      { researchBacked: prospectResearchTier(record) !== "none" });
    return null;
  } catch (error) {
    return error instanceof Error && error.message === "outreach_ready_hypothesis_draft_only"
      ? error.message : "recipient_research_origin_unavailable";
  }
}

const LEGACY_RELEASE_STATE_CHANGED = "legacy_release_state_or_payload_changed";

/** Claims a legacy prospect release. The prospect record is read again in the same
 * transaction that moves the ledger to executing, so a research marker written after
 * the release check above still refuses. The ledger must still be in the state that
 * was checked, with the same payload, so two releases cannot both send.
 *
 * Returns null once claimed, or the refusal, with the ledger already back at
 * pending_approval. Throws `LEGACY_RELEASE_STATE_CHANGED` with nothing written when
 * another release owns the ledger. */
async function claimLegacyProspectRelease(
  ledgerRef: FirebaseFirestore.DocumentReference,
  data: Record<string, any>,
  check: (current: Record<string, any>) => boolean,
  verifyAuthority?: (tx: FirebaseFirestore.Transaction) => Promise<boolean>,
): Promise<string | null> {
  const prospectRef = getDb().collection("outboundProspects").doc(String(data.source_doc_id).trim());
  const claim = await getDb().runTransaction(async (tx) => {
    const [ledger, prospect] = await Promise.all([tx.get(ledgerRef), tx.get(prospectRef)]);
    const current = ledger.data();
    if (!current || !check(current) || current.action_type !== data.action_type
      || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)
      || (verifyAuthority && !await verifyAuthority(tx))) {
      return { changed: true, blocker: null };
    }
    const blocker = !prospect?.exists ? "prospect_research_origin_unavailable"
      : researchProspectSendBlocker(prospect.data(), communicationsSendingEnabled())?.blocker ?? null;
    tx.update(ledgerRef, blocker
      ? { status: "pending_approval", approval_reason: `content_validation_failed: ${blocker}`, updated_at: new Date() }
      : { status: "executing", updated_at: new Date() });
    return { changed: false, blocker };
  });
  if (claim.changed) throw new Error(LEGACY_RELEASE_STATE_CHANGED);
  return claim.blocker;
}

/** The release claim refused: the ledger is already back at pending_approval. */
async function legacyReleaseRefused(data: Record<string, any>, ledgerDocId: string, reason: string): Promise<ActionResult> {
  await syncSourceDocumentState({
    sourceCollection: data.source_collection,
    sourceDocId: data.source_doc_id,
    actionType: data.action_type,
    actionPayload: data.action_payload,
    ledgerDocId,
    state: "pending_approval",
    approvalReason: `content_validation_failed: ${reason}`,
  });
  return { state: "pending_approval", tier: data.action_tier, ledgerDocId, error: reason };
}

function prospectOutreachReview(payload: ActionPayload) {
  if (isCommunicationsPayload(payload)) return reviewCommunicationsPayload(payload);
  return reviewOutreachDraft({
    to: typeof payload.to === "string" ? payload.to : "",
    subject: typeof payload.subject === "string" ? payload.subject : "",
    body: typeof payload.body === "string" ? payload.body : "",
    contract: payload.outreachContract,
    context: payload.outreachContext,
  });
}

async function routeContentValidationFailure(params: {
  existingLedgerId?: string | null;
  idempotencyKey: string;
  lane: string;
  actionType: ActionType;
  sourceCollection: string;
  sourceDocId: string;
  actionPayload: ActionPayload;
  draftOutput: DraftOutput;
  reason: string;
}): Promise<ActionResult> {
  const approvalReason = `content_validation_failed: ${params.reason}`;
  const ledgerDocId = params.existingLedgerId ?? await writeLedgerDoc({
    idempotencyKey: params.idempotencyKey,
    lane: params.lane,
    actionType: params.actionType,
    tier: 3,
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionPayload: params.actionPayload,
    draftOutput: params.draftOutput,
    status: "pending_approval",
    autoApproveReason: null,
    approvalReason,
  });
  if (params.existingLedgerId) {
    await updateLedgerStatus(params.existingLedgerId, "pending_approval", {
      approval_reason: approvalReason,
    });
  }
  await syncSourceDocumentState({
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    actionType: params.actionType,
    actionPayload: params.actionPayload,
    ledgerDocId,
    state: "pending_approval",
    approvalReason,
  });
  await safelyDispatchHumanBlocker("action.content_validation_failed", () =>
    dispatchActionApprovalHumanBlocker({
      lane: params.lane,
      sourceCollection: params.sourceCollection,
      sourceDocId: params.sourceDocId,
      actionType: params.actionType,
      approvalReason,
      ledgerDocId,
    }),
  );
  return {
    state: "pending_approval",
    tier: 3,
    ledgerDocId,
    error: params.reason,
  };
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
  const prospectScope = { lane: safetyPolicy.lane, source_collection: sourceCollection, action_payload: actionPayload };

  // 1. Idempotency check — look up existing ledger doc
  const existingLedger = await findLedgerByIdempotencyKey(idempotencyKey);
  const contentValidation =
    isProspectOutreach(prospectScope) ||
    (safetyPolicy.contentChecks && (actionType === "send_email" || actionType === "send_campaign_emails"))
      ? validateActionPayloadBeforeExecution(actionType, actionPayload, prospectScope)
      : { valid: true };
  if (!contentValidation.valid) {
    return routeContentValidationFailure({
      existingLedgerId: typeof existingLedger?.id === "string" ? existingLedger.id : null,
      idempotencyKey,
      lane: safetyPolicy.lane,
      actionType,
      sourceCollection,
      sourceDocId,
      actionPayload,
      draftOutput,
      reason: contentValidation.reason || "Invalid action content",
    });
  }
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
  const tier = isProspectOutreach(prospectScope)
    ? 3 : evaluateActionTier(draftOutput, safetyPolicy);

  // 3. Content validation for email actions
  if (
    safetyPolicy.contentChecks &&
    (actionType === "send_email" || actionType === "send_campaign_emails")
  ) {
    const validation = contentValidation;
    if (!validation.valid) {
      return routeContentValidationFailure({
        idempotencyKey,
        lane: safetyPolicy.lane,
        actionType,
        sourceCollection,
        sourceDocId,
        actionPayload,
        draftOutput,
        reason: validation.reason || "Invalid action content",
      });
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
      await safelyDispatchHumanBlocker("action.daily_cap_exceeded", () =>
        dispatchActionApprovalHumanBlocker({
          lane: safetyPolicy.lane,
          sourceCollection,
          sourceDocId,
          actionType,
          approvalReason: `daily_cap_exceeded: ${todayCount}/${safetyPolicy.maxDailyAutoSends}`,
          ledgerDocId,
        }),
      );
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
    await safelyDispatchHumanBlocker("action.requires_human_review", () =>
      dispatchActionApprovalHumanBlocker({
        lane: safetyPolicy.lane,
        sourceCollection,
        sourceDocId,
        actionType,
        approvalReason: "requires_human_review",
        ledgerDocId,
      }),
    );
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
    const sentAt = new Date();
    await updateLedgerStatus(ledgerDocId, "sent", {
      sent_at: sentAt,
      last_execution_at: sentAt,
    });
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
  outreachSemanticReview?: unknown,
  expectedActionDigest?: string,
  replyAuthority?: { eventId: string; claim: string },
): Promise<ActionResult> {
  const verifyReply = async (tx: FirebaseFirestore.Transaction) => {
    if (!replyAuthority) return true;
    const event = (await tx.get(getDb().collection("humanReplyEvents").doc(replyAuthority.eventId))).data() as HumanReplyEventRecord | undefined;
    if (!event || event.resume_claim !== replyAuthority.claim || event.resume_state !== "running"
      || event.classification !== "approval") return false;
    const thread = (await tx.get(getDb().collection("humanBlockerThreads").doc(event.blocker_id))).data() as HumanBlockerThreadRecord | undefined;
    return Boolean(thread && thread.record_of_truth.ops_work_item_id === ledgerDocId
      && thread.last_human_reply_event_id === event.id && thread.action_digest === expectedActionDigest
      && event.binding === humanDecisionBinding(thread) && !humanReplyAdmissionError(thread, event));
  };
  const ledgerRef = getDb().collection("action_ledger").doc(ledgerDocId);
  const ledgerDoc = await ledgerRef.get();
  if (!ledgerDoc.exists) throw new Error(`Ledger doc ${ledgerDocId} not found`);

  const data = ledgerDoc.data()!;
  if (expectedActionDigest && expectedActionDigest !== humanDecisionDigest({ type: data.action_type, payload: data.action_payload })) {
    throw new Error("action_changed");
  }
  if (data.status !== "pending_approval") {
    throw new Error(`Cannot approve action in state: ${data.status}`);
  }

  if (isProspectOutreach(data) || data.action_type === "send_email" || data.action_type === "send_campaign_emails") {
    const hypothesis = communicationsHypothesisRefusal(data.action_payload);
    const validation: { valid: boolean; reason?: string } = hypothesis ? { valid: false, reason: hypothesis }
      : validateActionPayloadBeforeExecution(data.action_type, data.action_payload, data);
    if (validation.valid && isProspectOutreach(data)) {
      const reason = validateOutreachSemanticReview(prospectOutreachReview(data.action_payload), outreachSemanticReview);
      if (reason) { validation.valid = false; validation.reason = reason; }
    }
    if (validation.valid && isProspectOutreach(data) && !isCommunicationsPayload(data.action_payload)) {
      const blocker = await legacyProspectResearchBlocker(data);
      if (blocker) { validation.valid = false; validation.reason = blocker; }
    }
    if (validation.valid && isCommunicationsPayload(data.action_payload)) {
      const blocker = await communicationsSendBlocker(data.action_payload, ledgerDocId);
      if (blocker) { validation.valid = false; validation.reason = blocker; }
    }
    if (!validation.valid) {
      const approvalReason = `content_validation_failed: ${validation.reason}`;
      await ledgerRef.update({
        approval_reason: approvalReason,
        updated_at: new Date(),
      });
      await syncSourceDocumentState({
        sourceCollection: data.source_collection,
        sourceDocId: data.source_doc_id,
        actionType: data.action_type,
        actionPayload: data.action_payload,
        ledgerDocId,
        state: "pending_approval",
        approvalReason,
      });
      return {
        state: "pending_approval",
        tier: data.action_tier,
        ledgerDocId,
        error: validation.reason,
      };
    }
  }

  const approvalUpdate = {
    status: "operator_approved",
    approved_by: operatorEmail,
    approved_at: new Date(),
    ...(replyAuthority ? { human_reply_event_id: replyAuthority.eventId, human_reply_claim: replyAuthority.claim } : {}),
    ...(isProspectOutreach(data) ? {
      outreach_semantic_review: outreachSemanticReviewSchema.parse(outreachSemanticReview),
      outreach_reviewed_by: operatorEmail,
      outreach_reviewed_at: new Date(),
    } : {}),
    updated_at: new Date(),
  };
  {
    const acquired = await getDb().runTransaction(async (tx) => {
      const current = (await tx.get(ledgerRef)).data();
      if (!await verifyReply(tx)) return false;
      if (current?.status !== "pending_approval" || current.action_type !== data.action_type || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)) return false;
      tx.update(ledgerRef, approvalUpdate);
      return true;
    });
    if (!acquired) throw new Error("communications_approval_state_or_payload_changed");
  }
  await syncSourceDocumentState({
    sourceCollection: data.source_collection,
    sourceDocId: data.source_doc_id,
    actionType: data.action_type,
    actionPayload: data.action_payload,
    ledgerDocId,
    state: "operator_approved",
    approvedBy: operatorEmail,
  });

  // The legacy prospect release also reads the current research admission in
  // its execution transaction, alongside the human decision authority.
  const legacyProspect = isProspectOutreach(data) && !isCommunicationsPayload(data.action_payload);
  // Now execute
  if (!legacyProspect) {
    const acquired = await getDb().runTransaction(async (tx) => {
      const current = (await tx.get(ledgerRef)).data();
      if (!await verifyReply(tx)) return false;
      if (current?.status !== "operator_approved" || current.action_type !== data.action_type || current.approved_by !== operatorEmail
        || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)) return false;
      tx.update(ledgerRef, { status: "executing", updated_at: new Date() });
      return true;
    });
    if (!acquired) throw new Error("communications_execution_state_or_payload_changed");
  }
  let effectStarted = false;
  let effectAcknowledged = false;
  try {
    if (legacyProspect) {
      const refusal = await claimLegacyProspectRelease(ledgerRef, data,
        (current) => current.status === "operator_approved" && current.approved_by === operatorEmail, verifyReply);
      if (refusal) return await legacyReleaseRefused(data, ledgerDocId, refusal);
    }
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "executing",
      approvedBy: operatorEmail,
    });
    effectStarted = true;
    await performAction(data.action_type, data.action_payload);
    effectAcknowledged = true;
    const sentAt = new Date();
    await ledgerRef.update({
      status: "sent",
      sent_at: sentAt,
      last_execution_at: sentAt,
      updated_at: sentAt,
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
    if (effectStarted) {
      // An external acknowledgement or its loss must never be turned into an
      // automatically retryable failure by a later projection/log write.
      const state = effectAcknowledged ? "sent" : "executing";
      await ledgerRef.update({ status: state, outcome_observation: effectAcknowledged ? "acknowledged" : "unknown",
        last_execution_error: err instanceof Error ? err.message : String(err), updated_at: new Date() });
      return { state, tier: data.action_tier, ledgerDocId,
        error: effectAcknowledged ? undefined : "action_outcome_unknown" };
    }
    // Another release owns the ledger now: leave it exactly as it is.
    if (err instanceof Error && err.message === LEGACY_RELEASE_STATE_CHANGED) throw err;
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

  const rejectionUpdate = {
    status: "rejected",
    rejected_by: operatorEmail,
    rejected_reason: reason,
    updated_at: new Date(),
  };
  if (isCommunicationsPayload(data.action_payload)) {
    const acquired = await getDb().runTransaction(async (tx) => {
      const current = (await tx.get(ledgerRef)).data();
      if (current?.status !== "pending_approval" || current.action_type !== data.action_type || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)) return false;
      tx.update(ledgerRef, rejectionUpdate);
      return true;
    });
    if (!acquired) throw new Error("communications_rejection_state_or_payload_changed");
  } else await ledgerRef.update(rejectionUpdate);
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
  if (isCommunicationsPayload(data.action_payload) && ["failed", "executing", "operator_approved"].includes(data.status)) {
    // Observe an actual prior send before freshness/new-send checks. This may
    // recover a lost acknowledgement after the sent message changed the thread.
    const recovered = await reconcileCommunicationsSend(data.action_payload);
    if (recovered) {
      await ledgerRef.update({ status: "sent", sent_at: new Date(), last_execution_error: null, updated_at: new Date() });
      return { state: "sent", tier: data.action_tier, ledgerDocId };
    }
    // Crash-shaped active states only permit receipt observation, never a POST.
    if (data.status !== "failed") throw new Error("communications_interrupted_send_requires_reconciliation");
  }
  if (data.status !== "failed") throw new Error(`Cannot retry action in state: ${data.status}`);
  if (data.execution_attempts >= 3) throw new Error("Max retries exceeded");

  const hypothesis = communicationsHypothesisRefusal(data.action_payload);
  const validation: { valid: boolean; reason?: string } = hypothesis ? { valid: false, reason: hypothesis }
    : validateActionPayloadBeforeExecution(data.action_type, data.action_payload, data);
  if (validation.valid && isProspectOutreach(data)) {
    const reason = !data.outreach_reviewed_by || data.outreach_reviewed_by !== data.approved_by
      ? "outreach_semantic_review_required"
      : validateOutreachSemanticReview(prospectOutreachReview(data.action_payload), data.outreach_semantic_review);
    if (reason) { validation.valid = false; validation.reason = reason; }
  }
  if (validation.valid && isProspectOutreach(data) && !isCommunicationsPayload(data.action_payload)) {
    const blocker = await legacyProspectResearchBlocker(data);
    if (blocker) { validation.valid = false; validation.reason = blocker; }
  }
  if (validation.valid && isCommunicationsPayload(data.action_payload)) {
    const blocker = await communicationsSendBlocker(data.action_payload, ledgerDocId);
    if (blocker) { validation.valid = false; validation.reason = blocker; }
  }
  if (!validation.valid) {
    const approvalReason = `content_validation_failed: ${validation.reason}`;
    const invalidationUpdate = {
      status: "pending_approval",
      approval_reason: approvalReason,
      updated_at: new Date(),
    };
    if (isCommunicationsPayload(data.action_payload)) {
      const invalidated = await getDb().runTransaction(async (tx) => {
        const current = (await tx.get(ledgerRef)).data();
        if (current?.status !== "failed" || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)) return false;
        tx.update(ledgerRef, invalidationUpdate);
        return true;
      });
      if (!invalidated) throw new Error("communications_retry_state_or_payload_changed");
    } else await ledgerRef.update(invalidationUpdate);
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "pending_approval",
      approvalReason,
    });
    return {
      state: "pending_approval",
      tier: data.action_tier,
      ledgerDocId,
      error: validation.reason,
    };
  }

  if (isCommunicationsPayload(data.action_payload)) {
      const acquired = await getDb().runTransaction(async (tx) => {
        const current = (await tx.get(ledgerRef)).data();
        if (current?.status !== "failed" || communicationsDigest(current.action_payload) !== communicationsDigest(data.action_payload)) return false;
        tx.update(ledgerRef, { status: "executing", updated_at: new Date() });
        return true;
      });
      if (!acquired) throw new Error("communications_retry_state_or_payload_changed");
  }
  try {
    if (isProspectOutreach(data) && !isCommunicationsPayload(data.action_payload)) {
      const refusal = await claimLegacyProspectRelease(ledgerRef, data, (current) => current.status === "failed"
        && current.approved_by === data.approved_by && (current.execution_attempts ?? 0) === (data.execution_attempts ?? 0));
      if (refusal) return await legacyReleaseRefused(data, ledgerDocId, refusal);
    } else if (!isCommunicationsPayload(data.action_payload)) await ledgerRef.update({ status: "executing", updated_at: new Date() });
    await syncSourceDocumentState({
      sourceCollection: data.source_collection,
      sourceDocId: data.source_doc_id,
      actionType: data.action_type,
      actionPayload: data.action_payload,
      ledgerDocId,
      state: "executing",
    });
    await performAction(data.action_type, data.action_payload);
    const sentAt = new Date();
    await ledgerRef.update({
      status: "sent",
      sent_at: sentAt,
      last_execution_at: sentAt,
      execution_attempts: (data.execution_attempts ?? 0) + 1,
      updated_at: sentAt,
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
    // Another release owns the ledger now: leave it exactly as it is.
    if (err instanceof Error && err.message === LEGACY_RELEASE_STATE_CHANGED) throw err;
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

  if (
    INTAKE_FOLLOW_UP_COLLECTIONS.has(sourceCollection) &&
    (params.actionType === "send_email" || params.actionType === "send_campaign_emails")
  ) {
    const recipient =
      typeof params.actionPayload.to === "string"
        ? params.actionPayload.to
        : Array.isArray(params.actionPayload.recipients)
          ? params.actionPayload.recipients
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .join(", ")
          : null;
    const subject =
      typeof params.actionPayload.subject === "string"
        ? params.actionPayload.subject
        : null;

    await ref.set(
      {
        intake_follow_up: {
          last_status: params.state,
          last_action_type: params.actionType,
          last_ledger_doc_id: params.ledgerDocId,
          last_subject: subject,
          last_recipient: recipient,
          last_approval_reason: params.approvalReason ?? null,
          last_rejected_reason: params.rejectedReason ?? null,
          last_error: params.error ?? null,
          approved_by: params.approvedBy ?? null,
          approved_at: params.approvedBy ? nowIso : null,
          last_sent_at: params.state === "sent" ? nowIso : null,
          updated_at: nowIso,
        },
      },
      { merge: true },
    );
  }

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
    case "send_email": {
      if (isCommunicationsPayload(payload)) {
        await executeCommunicationsSend(payload);
        break;
      }
      const validation = validateEmailContent(payload);
      if (!validation.valid) {
        throw new Error(`Email content validation failed: ${validation.reason}`);
      }
      const scope = emailSuppressionScope(payload, "lifecycle");
      if (payload.commercialEmail === true) {
        const suppressed = await isEmailSuppressed(payload.to!, scope);
        if (suppressed) {
          throw new Error(`Recipient is suppressed for ${scope} emails`);
        }
      }
      const text =
        payload.commercialEmail === true
          ? appendCommercialEmailFooter({
              text: payload.body!,
              email: payload.to!,
              scope,
              campaignId: typeof payload.campaignId === "string" ? payload.campaignId : null,
              cadenceId: typeof payload.lifecycleCadenceId === "string"
                ? payload.lifecycleCadenceId
                : typeof payload.cadenceId === "string"
                  ? payload.cadenceId
                  : null,
            })
          : payload.body!;
      const result = await sendEmail({
        to: payload.to!,
        subject: payload.subject!,
        text,
        replyTo:
          typeof payload.replyTo === "string" ? payload.replyTo : undefined,
        sendGridCategories: normalizeStringList(payload.sendGridCategories),
        sendGridCustomArgs: normalizeStringRecord(payload.sendGridCustomArgs),
      });
      if (!result.sent) {
        const errorMessage =
          result.error instanceof Error
            ? result.error.message
            : typeof result.error === "string"
              ? result.error
              : "Email transport returned sent=false";
        throw new Error(errorMessage);
      }
      break;
    }
    case "send_campaign_emails": {
      const recipients = Array.isArray(payload.recipients)
        ? payload.recipients.filter((value): value is string => typeof value === "string")
        : [];
      if (recipients.length === 0) {
        throw new Error("Campaign send requires at least one recipient");
      }
      for (const recipient of recipients) {
        const recipientValidation = validateRecipientEmailAddress(recipient);
        if (!recipientValidation.valid) {
          throw new Error(
            `Invalid campaign recipient email: ${recipient} (${recipientValidation.reason})`,
          );
        }
      }
      const contentValidation = validateEmailContent({
        ...payload,
        to: recipients[0],
      });
      if (!contentValidation.valid) {
        throw new Error(`Campaign content validation failed: ${contentValidation.reason}`);
      }
      const evidenceValidation = validateRequiredCampaignRecipientEvidence(payload, recipients);
      if (!evidenceValidation.valid) {
        throw new Error(evidenceValidation.reason || "Campaign send requires recipient-backed evidence");
      }

      const failures: string[] = [];
      const suppressedRecipients: string[] = [];
      for (const recipient of recipients) {
        const scope = emailSuppressionScope(payload, "growth_campaign");
        if (payload.commercialEmail === true && await isEmailSuppressed(recipient, scope)) {
          suppressedRecipients.push(recipient);
          continue;
        }
        const text =
          payload.commercialEmail === true
            ? appendCommercialEmailFooter({
                text: payload.body!,
                email: recipient,
                scope,
                campaignId:
                  typeof payload.campaignId === "string" ? payload.campaignId : undefined,
              })
            : payload.body!;
        const categories = [
          "blueprint_growth_campaign",
          ...normalizeStringList(payload.sendGridCategories),
        ];
        const customArgs = {
          ...(normalizeStringRecord(payload.sendGridCustomArgs) || {}),
          ...(typeof payload.campaignId === "string" && payload.campaignId.trim()
            ? { bp_campaign_id: payload.campaignId }
            : {}),
        };
        const result = await sendEmail({
          to: recipient,
          subject: payload.subject!,
          text,
          replyTo:
            typeof payload.replyTo === "string" ? payload.replyTo : undefined,
          sendGridCategories: [...new Set(categories)],
          sendGridCustomArgs:
            Object.keys(customArgs).length > 0 ? customArgs : undefined,
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
                sent: recipients.length - failures.length - suppressedRecipients.length,
              },
              recipient_count: recipients.length,
              suppressed_recipient_count: suppressedRecipients.length,
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
