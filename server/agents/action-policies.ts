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

export function evaluateActionTier(
  draft: DraftOutput,
  policy: LaneSafetyPolicy,
): ActionTier {
  if (policy.alwaysHumanReview(draft)) return 3;
  if (policy.autoApproveCriteria(draft)) return 1;
  return 2; // auto-execute with notification
}

export function validateEmailContent(
  payload: ActionPayload,
): { valid: boolean; reason?: string } {
  if (!payload.to || !payload.to.includes("@"))
    return { valid: false, reason: "Invalid recipient email" };
  if (!payload.subject || payload.subject.trim().length === 0)
    return { valid: false, reason: "Empty subject" };
  if (!payload.body || payload.body.length < 50)
    return { valid: false, reason: "Body too short (min 50 chars)" };
  if (/\{\{|(\[TODO\])|(\[NAME\])/i.test(payload.subject + payload.body))
    return { valid: false, reason: "Contains placeholder text" };
  return { valid: true };
}
