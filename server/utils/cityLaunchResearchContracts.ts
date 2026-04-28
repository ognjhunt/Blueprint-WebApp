export const CITY_LAUNCH_PROSPECT_STATUS_VALUES = [
  "identified",
  "contacted",
  "responded",
  "qualified",
  "approved",
  "onboarded",
  "capturing",
  "inactive",
] as const;

export type CityLaunchProspectStatus =
  (typeof CITY_LAUNCH_PROSPECT_STATUS_VALUES)[number];

export const CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES = [
  "identified",
  "researched",
  "queued",
  "contacted",
  "engaged",
  "hosted_review",
  "commercial_handoff",
  "closed_won",
  "closed_lost",
] as const;

export type CityLaunchBuyerTargetStatus =
  (typeof CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES)[number];

export const CITY_LAUNCH_TOUCH_STATUS_VALUES = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "replied",
  "failed",
] as const;

export type CityLaunchTouchStatus =
  (typeof CITY_LAUNCH_TOUCH_STATUS_VALUES)[number];

export const CITY_LAUNCH_TOUCH_TYPE_VALUES = [
  "first_touch",
  "follow_up",
  "approval_request",
  "intro",
  "operator_send",
] as const;

export type CityLaunchTouchType =
  (typeof CITY_LAUNCH_TOUCH_TYPE_VALUES)[number];

export const CITY_LAUNCH_BUDGET_CATEGORY_VALUES = [
  "creative",
  "outbound",
  "community",
  "field_ops",
  "travel",
  "tools",
  "other",
] as const;

export type CityLaunchBudgetCategory =
  (typeof CITY_LAUNCH_BUDGET_CATEGORY_VALUES)[number];

export const CITY_LAUNCH_BUYER_PROOF_PATH_VALUES = [
  "exact_site",
  "adjacent_site",
  "scoped_follow_up",
] as const;

export type CityLaunchBuyerProofPath =
  (typeof CITY_LAUNCH_BUYER_PROOF_PATH_VALUES)[number];

export const CITY_LAUNCH_APPROVED_ANALYTICS_EVENTS = [
  "exact_site_review_view",
  "proof_path_stage_updated",
  "contact_request_started",
  "contact_request_submitted",
  "contact_request_completed",
  "contact_request_failed",
  "experiment_exposure",
  "robot_team_inbound_captured",
  "robot_team_fit_checked",
  "proof_path_assigned",
  "proof_pack_delivered",
  "hosted_review_ready",
  "hosted_review_started",
  "hosted_review_follow_up_sent",
  "exact_site_request_created",
  "deeper_review_requested",
  "human_commercial_handoff_started",
  "proof_motion_stalled",
  // City-launch proof-motion instrumentation events
  "city_launch_lawful_access_established",
  "city_launch_capturer_approved",
  "city_launch_capture_completed",
  "city_launch_capture_qa_passed",
  "city_launch_proof_asset_rights_cleared",
  "city_launch_proof_pack_delivered",
  "city_launch_hosted_review_ready",
  "city_launch_commercial_handoff",
  // Sacramento proof-motion contract events (instrumented in live path)
  "sacramento_proof_motion_contract_instrumented",
  "sacramento_lawful_access_established",
  "sacramento_capturer_approved",
  "sacramento_capture_completed",
  "sacramento_capture_qa_passed",
  "sacramento_proof_asset_rights_cleared",
  "sacramento_proof_pack_delivered",
  "sacramento_hosted_review_ready",
  "sacramento_commercial_handoff",
] as const;

export const CITY_LAUNCH_APPROVED_ANALYTICS_MILESTONES = [
  "qualified_inbound_at",
  "proof_pack_delivered_at",
  "proof_pack_reviewed_at",
  "hosted_review_ready_at",
  "hosted_review_started_at",
  "hosted_review_follow_up_at",
  "exact_site_requested_at",
  "artifact_handoff_delivered_at",
  "artifact_handoff_accepted_at",
  "human_commercial_handoff_at",
] as const;

export const CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES = [
  "growth_events",
  "inboundRequests.ops.proof_path",
  ...CITY_LAUNCH_APPROVED_ANALYTICS_EVENTS,
  ...CITY_LAUNCH_APPROVED_ANALYTICS_MILESTONES,
] as const;

export const CITY_LAUNCH_BANNED_MESSAGING_PATTERNS = [
  {
    pattern: /aura of exclusive/i,
    reason: "Avoid posture-changing exclusivity language.",
  },
  {
    pattern: /exclusive,\s*high-demand access/i,
    reason: "Avoid artificial scarcity framing.",
  },
  {
    pattern: /manufactur(?:e|ing)\s+scarcity/i,
    reason: "Avoid manipulative scarcity language.",
  },
  {
    pattern: /artificial urgency/i,
    reason: "Avoid deceptive urgency cues.",
  },
  {
    pattern: /\bFOMO\b/i,
    reason: "Avoid fear-of-missing-out messaging.",
  },
] as const;

export function isCityLaunchBuyerProofPath(
  value: string | null | undefined,
): value is CityLaunchBuyerProofPath {
  return CITY_LAUNCH_BUYER_PROOF_PATH_VALUES.includes(
    String(value || "") as CityLaunchBuyerProofPath,
  );
}
