import {
  CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES,
  CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
  CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
} from "./cityLaunchResearchContracts";

export const CITY_LAUNCH_MACHINE_POLICY_VERSION =
  "2026-04-13.city-launch-doctrine.v1";

export const CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION =
  "2026-04-13.city-launch-activation-payload.v1";

export const CITY_LAUNCH_PRIORITY_WEDGE = {
  key: "exact_site_hosted_review",
  label: "Exact-Site Hosted Review",
  summary:
    "One real site, one workflow lane, one truthful proof path tied to hosted review and bounded commercial follow-up.",
} as const;

export const CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES = [
  "buyer_requested_site",
  "site_operator_intro",
  "capturer_existing_lawful_access",
  "public_non_controlled_site",
] as const;

export type CityLaunchLawfulAccessMode =
  (typeof CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES)[number];

export const CITY_LAUNCH_APPROVAL_LANE_VALUES = [
  "founder",
  "growth-lead",
  "ops-lead",
  "designated-human-commercial-owner",
  "designated-human-rights-reviewer",
  "cto",
  "chief-of-staff",
] as const;

export type CityLaunchApprovalLane =
  (typeof CITY_LAUNCH_APPROVAL_LANE_VALUES)[number];

export const CITY_LAUNCH_AGENT_LANE_VALUES = [
  "growth-lead",
  "ops-lead",
  "city-launch-agent",
  "city-demand-agent",
  "site-operator-partnership-agent",
  "capturer-growth-agent",
  "intake-agent",
  "capturer-success-agent",
  "field-ops-agent",
  "capture-qa-agent",
  "rights-provenance-agent",
  "demand-intel-agent",
  "robot-team-growth-agent",
  "outbound-sales-agent",
  "community-updates-agent",
  "buyer-solutions-agent",
  "revenue-ops-pricing-agent",
  "analytics-agent",
  "notion-manager-agent",
  "beta-launch-commander",
] as const;

export type CityLaunchAgentLane =
  (typeof CITY_LAUNCH_AGENT_LANE_VALUES)[number];

export const CITY_LAUNCH_HUMAN_LANE_VALUES = [
  "founder",
  "growth-lead",
  "ops-lead",
  "designated-human-commercial-owner",
  "designated-human-rights-reviewer",
  "cto",
  "chief-of-staff",
] as const;

export type CityLaunchHumanLane =
  (typeof CITY_LAUNCH_HUMAN_LANE_VALUES)[number];

export const CITY_LAUNCH_LANE_DISPLAY_NAMES: Record<
  CityLaunchAgentLane | CityLaunchHumanLane,
  string
> = {
  founder: "Founder",
  "growth-lead": "Growth Lead",
  "ops-lead": "Ops Lead",
  "designated-human-commercial-owner": "Designated human commercial owner",
  "designated-human-rights-reviewer": "Designated human rights reviewer",
  cto: "CTO",
  "chief-of-staff": "Chief of Staff",
  "city-launch-agent": "city-launch-agent",
  "city-demand-agent": "city-demand-agent",
  "site-operator-partnership-agent": "site-operator-partnership-agent",
  "capturer-growth-agent": "capturer-growth-agent",
  "intake-agent": "intake-agent",
  "capturer-success-agent": "capturer-success-agent",
  "field-ops-agent": "field-ops-agent",
  "capture-qa-agent": "capture-qa-agent",
  "rights-provenance-agent": "rights-provenance-agent",
  "demand-intel-agent": "demand-intel-agent",
  "robot-team-growth-agent": "robot-team-growth-agent",
  "outbound-sales-agent": "outbound-sales-agent",
  "community-updates-agent": "community-updates-agent",
  "buyer-solutions-agent": "buyer-solutions-agent",
  "revenue-ops-pricing-agent": "revenue-ops-pricing-agent",
  "analytics-agent": "analytics-agent",
  "notion-manager-agent": "notion-manager-agent",
  "beta-launch-commander": "beta-launch-commander",
};

export const CITY_LAUNCH_ISSUE_SEED_PHASE_VALUES = [
  "founder_gates",
  "supply",
  "proof_assets",
  "demand",
  "commercial",
  "measurement",
] as const;

export type CityLaunchIssueSeedPhase =
  (typeof CITY_LAUNCH_ISSUE_SEED_PHASE_VALUES)[number];

export const CITY_LAUNCH_VALIDATION_BLOCKER_SEVERITY_VALUES = [
  "high",
  "medium",
  "low",
] as const;

export type CityLaunchValidationBlockerSeverity =
  (typeof CITY_LAUNCH_VALIDATION_BLOCKER_SEVERITY_VALUES)[number];

export const CITY_LAUNCH_NAMED_CLAIM_TYPE_VALUES = [
  "company",
  "stack",
  "delivery",
] as const;

export type CityLaunchNamedClaimType =
  (typeof CITY_LAUNCH_NAMED_CLAIM_TYPE_VALUES)[number];

export const CITY_LAUNCH_METRIC_DEPENDENCY_KIND_VALUES = [
  "event",
  "milestone",
] as const;

export type CityLaunchMetricDependencyKind =
  (typeof CITY_LAUNCH_METRIC_DEPENDENCY_KIND_VALUES)[number];

export const CITY_LAUNCH_METRIC_DEPENDENCY_STATUS_VALUES = [
  "required_not_tracked",
  "required_tracked",
  "tracked_not_verified",
  "verified",
] as const;

export type CityLaunchMetricDependencyStatus =
  (typeof CITY_LAUNCH_METRIC_DEPENDENCY_STATUS_VALUES)[number];

export const CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES = [
  "first_lawful_access_path",
  "first_approved_capturer",
  "first_completed_capture",
  "first_qa_passed_capture",
  "first_rights_cleared_proof_asset",
  "first_proof_pack_delivery",
  "first_hosted_review",
  "first_human_commercial_handoff",
] as const;

export type CityLaunchProofMotionMilestone =
  (typeof CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES)[number];

export const CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS = [
  "robot_team_inbound_captured",
  "proof_path_assigned",
  "proof_pack_delivered",
  "hosted_review_ready",
  "hosted_review_started",
  "hosted_review_follow_up_sent",
  "human_commercial_handoff_started",
  "proof_motion_stalled",
] as const;

export type CityLaunchRequiredMetricDependencyKey =
  (typeof CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS)[number];

export const CITY_LAUNCH_REQUIRED_METRICS = [
  {
    key: "robot_team_inbound_captured",
    kind: "event",
    purpose: "Captures the first serious robot-team proof-motion signal.",
  },
  {
    key: "proof_path_assigned",
    kind: "event",
    purpose: "Measures exact-site, adjacent-site, or scoped-follow-up routing.",
  },
  {
    key: "proof_pack_delivered",
    kind: "event",
    purpose: "Measures time-to-proof and artifact delivery.",
  },
  {
    key: "hosted_review_ready",
    kind: "event",
    purpose: "Confirms a technical review surface exists.",
  },
  {
    key: "hosted_review_started",
    kind: "event",
    purpose: "Measures whether proof converts into review.",
  },
  {
    key: "hosted_review_follow_up_sent",
    kind: "event",
    purpose: "Keeps follow-up operational and measurable.",
  },
  {
    key: "human_commercial_handoff_started",
    kind: "event",
    purpose: "Marks the shift into human commercial handling.",
  },
  {
    key: "proof_motion_stalled",
    kind: "event",
    purpose: "Exposes why proof motion breaks.",
  },
] as const satisfies ReadonlyArray<{
  key: CityLaunchRequiredMetricDependencyKey;
  kind: CityLaunchMetricDependencyKind;
  purpose: string;
}>;

export const CITY_LAUNCH_CONTROL_PLANE_RULES = {
  machinePolicyVersion: CITY_LAUNCH_MACHINE_POLICY_VERSION,
  activationPayloadSchemaVersion: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  priorityWedge: CITY_LAUNCH_PRIORITY_WEDGE,
  lawfulAccessModes: CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES,
  approvedProofPaths: CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
  approvedBudgetCategories: CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
  approvedAnalyticsReferences: CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES,
  requiredProofMotionMilestones: CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES,
  requiredMetrics: CITY_LAUNCH_REQUIRED_METRICS,
  agentLanes: CITY_LAUNCH_AGENT_LANE_VALUES,
  humanLanes: CITY_LAUNCH_HUMAN_LANE_VALUES,
  approvalLanes: CITY_LAUNCH_APPROVAL_LANE_VALUES,
} as const;

export function isCityLaunchLawfulAccessMode(
  value: string | null | undefined,
): value is CityLaunchLawfulAccessMode {
  return CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES.includes(
    String(value || "") as CityLaunchLawfulAccessMode,
  );
}

export function isCityLaunchAgentLane(
  value: string | null | undefined,
): value is CityLaunchAgentLane {
  return CITY_LAUNCH_AGENT_LANE_VALUES.includes(
    String(value || "") as CityLaunchAgentLane,
  );
}

export function isCityLaunchHumanLane(
  value: string | null | undefined,
): value is CityLaunchHumanLane {
  return CITY_LAUNCH_HUMAN_LANE_VALUES.includes(
    String(value || "") as CityLaunchHumanLane,
  );
}

export function isCityLaunchApprovalLane(
  value: string | null | undefined,
): value is CityLaunchApprovalLane {
  return CITY_LAUNCH_APPROVAL_LANE_VALUES.includes(
    String(value || "") as CityLaunchApprovalLane,
  );
}
