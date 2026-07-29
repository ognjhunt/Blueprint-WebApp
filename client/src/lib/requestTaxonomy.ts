export const REQUESTED_LANES = [
  "deeper_evaluation",
  "preview_simulation",
  "data_licensing",
  "managed_tuning",
  "qualification",
] as const;

export const COMMERCIAL_REQUEST_PATHS = [
  "world_model",
  "hosted_evaluation",
  "capture_access",
  "site_claim",
] as const;

export const HELP_WITH_OPTIONS = [
  "benchmark-packs",
  "scene-library",
  "dataset-packs",
  "custom-capture",
  "pilot-exchange-location-brief",
  "pilot-exchange-policy-submission",
  "pilot-exchange-data-licensing",
] as const;

export const QUALIFICATION_STATES = [
  "submitted",
  "capture_requested",
  "qa_passed",
  "needs_more_evidence",
  "in_review",
  "qualified_ready",
  "qualified_risky",
  "needs_refresh",
  "not_ready_yet",
] as const;

export const OPPORTUNITY_STATES = [
  "not_applicable",
  "handoff_ready",
  "escalated_to_geometry",
  "escalated_to_validation",
] as const;

export const REQUESTED_LANE_LABELS = {
  qualification: "Task Evaluation Run (site intake)",
  preview_simulation: "Task Evaluation Run (legacy preview lane)",
  deeper_evaluation: "Task Evaluation Run",
  managed_tuning: "Task Evaluation Run (legacy evidence-use lane)",
  data_licensing: "Task Evaluation Run (legacy data lane)",
} as const;

export const REQUESTED_LANE_DESCRIPTIONS = {
  qualification: "Review the site, access path, and blockers before capture or release.",
  preview_simulation: "Prepare a preview asset once the record supports it.",
  deeper_evaluation: "Request a decision-oriented Task Evaluation Run.",
  managed_tuning: "Record evidence-use needs inside the relevant run; this is not a separate product.",
  data_licensing: "Translate a legacy data request into a run with explicit evaluation or post-training eligibility, without implying training occurred.",
} as const;

export const COMMERCIAL_REQUEST_PATH_LABELS = {
  world_model: "Task Evaluation Run request (legacy compatibility path)",
  hosted_evaluation: "Task Evaluation Run request",
  capture_access: "Capture access request",
  site_claim: "Site operator claim",
} as const;

export const COMMERCIAL_REQUEST_PATH_DESCRIPTIONS = {
  world_model:
    "`world_model` is a retained internal compatibility value. It translates to a Task Evaluation Run request; Pipeline decides whether a world-model method is qualified for any claim.",
  hosted_evaluation:
    "Scope a decision-oriented Task Evaluation Run after Blueprint confirms the testbed and authorization path.",
  capture_access:
    "Ask Blueprint to open a capture path for a site or workflow that is not packaged yet.",
  site_claim:
    "Register a facility, access boundary, and governance posture for Blueprint review.",
} as const;

export const HELP_WITH_LABELS = {
  "benchmark-packs": "Task Evaluation Run site intake",
  "scene-library": "Task Evaluation Run preview evidence",
  "dataset-packs": "Task Evaluation Run evidence-use review",
  "custom-capture": "Capture Request",
  "pilot-exchange-location-brief": "Site Review Brief",
  "pilot-exchange-policy-submission": "Task Evaluation Run candidate intake",
  "pilot-exchange-data-licensing": "Task Evaluation Run evidence-use review",
} as const;

export const LEGACY_HELP_WITH_TO_LANE = {
  "benchmark-packs": "qualification",
  "scene-library": "preview_simulation",
  "dataset-packs": "data_licensing",
  "custom-capture": "qualification",
  "pilot-exchange-location-brief": "qualification",
  "pilot-exchange-policy-submission": "deeper_evaluation",
  "pilot-exchange-data-licensing": "managed_tuning",
} as const;

export const LANE_TO_LEGACY_HELP_WITH = {
  qualification: "benchmark-packs",
  preview_simulation: "scene-library",
  deeper_evaluation: "pilot-exchange-policy-submission",
  managed_tuning: "pilot-exchange-data-licensing",
  data_licensing: "dataset-packs",
} as const;

export const CANONICAL_CONTACT_INTEREST_BY_LANE = {
  qualification: "task-evaluation-run",
  preview_simulation: "task-evaluation-run",
  deeper_evaluation: "task-evaluation-run",
  managed_tuning: "task-evaluation-run",
  data_licensing: "task-evaluation-run",
} as const;

export const CONTACT_INTEREST_TO_LANE = {
  "task-evaluation-run": "deeper_evaluation",
  "site-review": "qualification",
  "site-qualification": "qualification",
  "site-access-review": "qualification",
  "preview-simulation": "preview_simulation",
  "world-model": "data_licensing",
  "world-model-package": "data_licensing",
  "post-training-data-package": "data_licensing",
  "policy-improvement-run": "data_licensing",
  "policy-lift": "data_licensing",
  "data-package": "data_licensing",
  "capture-access": "deeper_evaluation",
  "evaluation-package": "deeper_evaluation",
  "deeper-evaluation": "deeper_evaluation",
  "evaluation-run": "deeper_evaluation",
  "hosted-session": "deeper_evaluation",
  "hosted-evaluation": "deeper_evaluation",
  "adaptation-data-pack": "data_licensing",
  "exclusive-dataset": "data_licensing",
  "scene-package": "data_licensing",
  "private-twin-buyout": "preview_simulation",
  enterprise: "deeper_evaluation",
  "egocentric-video": "preview_simulation",
  "managed-tuning": "managed_tuning",
  "managed-adaptation": "managed_tuning",
  "data-licensing": "data_licensing",
} as const;

export const OPPORTUNITY_STATE_LABELS = {
  not_applicable: "Not Applicable",
  handoff_ready: "Ready For Review",
  escalated_to_geometry: "Preview / Asset Prep",
  escalated_to_validation: "Task Evaluation Run active",
} as const;

export const DERIVED_ASSET_KEYS = [
  "scene_memory",
  "preview_simulation",
  "validation_package",
  "dataset_package",
] as const;

export const DERIVED_ASSET_STATUSES = [
  "not_requested",
  "prep_ready",
  "generating",
  "generated",
  "failed",
  "review_required",
] as const;
