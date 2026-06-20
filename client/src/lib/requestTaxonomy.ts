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
  qualification: "Site Access Review",
  preview_simulation: "Preview Simulation",
  deeper_evaluation: "Task / Policy Evaluation",
  managed_tuning: "Managed Tuning",
  data_licensing: "Policy Improvement Run",
} as const;

export const REQUESTED_LANE_DESCRIPTIONS = {
  qualification: "Review the site, access path, and blockers before capture or release.",
  preview_simulation: "Prepare a preview asset once the record supports it.",
  deeper_evaluation: "Request a Policy Evaluation Run or validation scope.",
  managed_tuning: "Flag later scenario generation or managed tuning work.",
  data_licensing: "Request baseline evaluation, failure diagnosis, twin/cousin scenarios, sim-only curriculum, policy improvement, sealed testing, and an evidence report.",
} as const;

export const COMMERCIAL_REQUEST_PATH_LABELS = {
  world_model: "Policy Improvement Run request",
  hosted_evaluation: "Policy evaluation request",
  capture_access: "Capture access request",
  site_claim: "Site operator claim",
} as const;

export const COMMERCIAL_REQUEST_PATH_DESCRIPTIONS = {
  world_model:
    "`world_model` is an internal compatibility lane for Policy Improvement Run requests: baseline evaluation, failure diagnosis, twin/cousin scenario generation, sim-only curriculum work, policy improvement, sealed testing, and evidence reporting.",
  hosted_evaluation:
    "Scope a policy-evaluation path after Blueprint confirms site, entitlement, and runtime availability.",
  capture_access:
    "Ask Blueprint to open a capture path for a site or workflow that is not packaged yet.",
  site_claim:
    "Register a facility, access boundary, and governance posture for Blueprint review.",
} as const;

export const HELP_WITH_LABELS = {
  "benchmark-packs": "Site Review",
  "scene-library": "Preview Simulation",
  "dataset-packs": "Policy Improvement",
  "custom-capture": "Capture Request",
  "pilot-exchange-location-brief": "Site Review Brief",
  "pilot-exchange-policy-submission": "Evaluation Package",
  "pilot-exchange-data-licensing": "Managed Tuning / Licensing",
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
  qualification: "site-review",
  preview_simulation: "preview-simulation",
  deeper_evaluation: "evaluation-package",
  managed_tuning: "managed-tuning",
  data_licensing: "policy-improvement-run",
} as const;

export const CONTACT_INTEREST_TO_LANE = {
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
  escalated_to_validation: "Evaluation Package Active",
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
