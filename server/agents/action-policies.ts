// Action-level safety policies for autonomous lane execution (Phase 2).
// These are distinct from the agent-runtime approval policies in ./policies.ts —
// they govern what an already-running lane agent is allowed to *do* without a
// human in the loop.

export type ActionType =
  | "send_email"
  | "send_campaign_emails"
  | "create_calendar_event"
  | "update_calendar_event"
  | "send_slack"
  | "update_sheet"
  | "update_firestore_status"
  | "route_to_queue";

export type ActionTier = 1 | 2 | 3;
export type ActionExecutionMode =
  | "auto_execute"
  | "auto_execute_with_notification"
  | "universal_founder_inbox";
export type IrreversibleActionClass =
  | "money_movement"
  | "pricing_or_commercial"
  | "rights_privacy_legal"
  | "external_send"
  | "policy_change";

export interface DraftOutput {
  recommendation?: string;
  confidence?: number;
  requires_human_review?: boolean;
  automation_status?: string;
  scores?: Record<string, number>;
  category?: string;
  priority?: string;
  disposition?: string;
  [key: string]: unknown;
}

export interface LaneSafetyPolicy {
  lane: string;
  autoApproveCriteria: (draft: DraftOutput) => boolean;
  alwaysHumanReview: (draft: DraftOutput) => boolean;
  maxDailyAutoSends: number;
  contentChecks: boolean;
}

export interface ActionPayload {
  type: ActionType;
  to?: string;
  subject?: string;
  body?: string;
  calendarId?: string;
  eventId?: string;
  channel?: string;
  message?: string;
  sheetId?: string;
  collection?: string;
  docId?: string;
  updates?: Record<string, unknown>;
  queue?: string;
  [key: string]: unknown;
}

export interface ActionExecutionDecision {
  tier: ActionTier;
  executionMode: ActionExecutionMode;
  irreversibleActionClass: IrreversibleActionClass | null;
  reasonCategory: string;
}

// ---------------------------------------------------------------------------
// Concrete per-lane policies
// ---------------------------------------------------------------------------

export const WAITLIST_POLICY: LaneSafetyPolicy = {
  lane: "waitlist",
  autoApproveCriteria: (draft) =>
    draft.recommendation === "invite_now" &&
    (draft.confidence ?? 0) >= 0.85 &&
    (draft.scores?.market_fit ?? 0) >= 70 &&
    !draft.requires_human_review &&
    draft.automation_status !== "blocked",
  alwaysHumanReview: (draft) =>
    draft.recommendation === "decline_for_now" ||
    draft.requires_human_review === true ||
    draft.automation_status === "blocked",
  maxDailyAutoSends: 50,
  contentChecks: true,
};

export const INBOUND_POLICY: LaneSafetyPolicy = {
  lane: "inbound",
  autoApproveCriteria: (draft) =>
    (draft.confidence ?? 0) >= 0.80 &&
    (draft.recommendation === "needs_more_evidence" ||
      draft.recommendation === "submitted") &&
    !draft.requires_human_review &&
    draft.automation_status !== "blocked",
  alwaysHumanReview: (draft) =>
    draft.requires_human_review === true ||
    draft.automation_status === "blocked" ||
    [
      "qualified_ready",
      "qualified_risky",
      "escalated_to_geometry",
      "escalated_to_validation",
    ].includes(draft.recommendation ?? ""),
  maxDailyAutoSends: 30,
  contentChecks: true,
};

export const SUPPORT_POLICY: LaneSafetyPolicy = {
  lane: "support",
  autoApproveCriteria: (draft) =>
    (draft.confidence ?? 0) >= 0.85 &&
    (draft.category === "general_support" ||
      draft.category === "qualification_follow_up") &&
    draft.priority !== "high" &&
    !draft.requires_human_review &&
    draft.automation_status !== "blocked",
  alwaysHumanReview: (draft) =>
    draft.requires_human_review === true ||
    draft.automation_status === "blocked" ||
    ["billing_question", "technical_issue"].includes(draft.category ?? "") ||
    draft.priority === "high",
  maxDailyAutoSends: 20,
  contentChecks: true,
};

export const CAPTURER_COMMS_POLICY: LaneSafetyPolicy = {
  lane: "capturer_comms",
  autoApproveCriteria: (draft) =>
    ["reminder_48h", "reminder_24h", "confirmation"].includes(
      draft.recommendation ?? "",
    ) && !draft.requires_human_review,
  alwaysHumanReview: (draft) =>
    draft.requires_human_review === true ||
    ["reschedule_notice", "cancellation", "custom"].includes(
      draft.recommendation ?? "",
    ),
  maxDailyAutoSends: 100,
  contentChecks: true,
};

export const RESCHEDULE_POLICY: LaneSafetyPolicy = {
  lane: "reschedule",
  autoApproveCriteria: (draft) =>
    draft.recommendation === "same_day_time_change" &&
    !draft.requires_human_review,
  alwaysHumanReview: (draft) =>
    draft.requires_human_review === true ||
    draft.recommendation !== "same_day_time_change",
  maxDailyAutoSends: 20,
  contentChecks: true,
};

export const PAYOUT_POLICY: LaneSafetyPolicy = {
  lane: "payout",
  autoApproveCriteria: () => false, // Never auto-approve
  alwaysHumanReview: () => true, // Always human
  maxDailyAutoSends: 0,
  contentChecks: false,
};

export const GROWTH_CAMPAIGN_POLICY: LaneSafetyPolicy = {
  lane: "growth_campaign",
  autoApproveCriteria: () => false,
  alwaysHumanReview: () => true,
  maxDailyAutoSends: 0,
  contentChecks: true,
};

export const LIFECYCLE_POLICY: LaneSafetyPolicy = {
  lane: "buyer_lifecycle",
  autoApproveCriteria: () => false,
  alwaysHumanReview: () => true,
  maxDailyAutoSends: 0,
  contentChecks: true,
};

export const SITE_ACCESS_POLICY: LaneSafetyPolicy = {
  lane: "site_access",
  autoApproveCriteria: (draft) =>
    draft.recommendation === "initial_outreach" &&
    !draft.requires_human_review,
  alwaysHumanReview: (draft) =>
    draft.requires_human_review === true ||
    draft.recommendation !== "initial_outreach",
  maxDailyAutoSends: 10,
  contentChecks: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRecipientEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isReservedOrPlaceholderEmail(value: string): boolean {
  const normalized = normalizeRecipientEmail(value);
  const domain = normalized.split("@").at(-1) || "";
  return normalized.endsWith("@example.com")
    || normalized.endsWith("@example.org")
    || normalized.endsWith("@example.net")
    || normalized.endsWith("@test.com")
    || domain === "example"
    || domain.endsWith(".example")
    || domain === "localhost"
    || domain.endsWith(".localhost")
    || domain === "invalid"
    || domain.endsWith(".invalid")
    || domain === "test"
    || domain.endsWith(".test")
    || normalized.includes("placeholder")
    || normalized.includes("fake");
}

export function validateRecipientEmailAddress(
  value: unknown,
): { valid: boolean; reason?: string } {
  const email = normalizeRecipientEmail(value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, reason: "Invalid recipient email" };
  }
  if (isReservedOrPlaceholderEmail(email)) {
    return {
      valid: false,
      reason: "Recipient email uses a reserved or placeholder domain",
    };
  }
  return { valid: true };
}

export function evaluateActionTier(
  draft: DraftOutput,
  policy: LaneSafetyPolicy,
): ActionTier {
  if (policy.alwaysHumanReview(draft)) return 3;
  if (policy.autoApproveCriteria(draft)) return 1;
  return 2; // auto-execute with notification
}

export function classifyActionExecution(params: {
  lane: string;
  actionType: ActionType;
  draft: DraftOutput;
  policy: LaneSafetyPolicy;
}): ActionExecutionDecision {
  const tier = evaluateActionTier(params.draft, params.policy);

  if (params.lane === "payout") {
    return {
      tier: 3,
      executionMode: "universal_founder_inbox",
      irreversibleActionClass: "money_movement",
      reasonCategory: "payout_always_human",
    };
  }

  if (params.lane === "growth_campaign" || params.lane === "buyer_lifecycle") {
    return {
      tier: 3,
      executionMode: "universal_founder_inbox",
      irreversibleActionClass: "external_send",
      reasonCategory: "campaign_or_lifecycle_send_requires_review",
    };
  }

  if (tier === 3) {
    return {
      tier,
      executionMode: "universal_founder_inbox",
      irreversibleActionClass: "pricing_or_commercial",
      reasonCategory: "policy_forced_human_review",
    };
  }

  return {
    tier,
    executionMode: tier === 1 ? "auto_execute" : "auto_execute_with_notification",
    irreversibleActionClass: null,
    reasonCategory: tier === 1 ? "policy_auto_approved" : "policy_notification_only",
  };
}

export function validateEmailContent(
  payload: ActionPayload,
): { valid: boolean; reason?: string } {
  const recipientValidation = validateRecipientEmailAddress(payload.to);
  if (!recipientValidation.valid) return recipientValidation;
  if (!payload.subject || payload.subject.trim().length === 0)
    return { valid: false, reason: "Empty subject" };
  if (!payload.body || payload.body.length < 50)
    return { valid: false, reason: "Body too short (min 50 chars)" };
  if (/\{\{|(\[TODO\])|(\[NAME\])/i.test(payload.subject + payload.body))
    return { valid: false, reason: "Contains placeholder text" };
  return { valid: true };
}
