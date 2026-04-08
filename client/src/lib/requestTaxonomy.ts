export const REQUESTED_LANES = [
  "deeper_evaluation",
  "preview_simulation",
  "data_licensing",
  "managed_tuning",
  "qualification",
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
  qualification: "Site Review",
  preview_simulation: "Preview Simulation",
  deeper_evaluation: "Evaluation Package",
  managed_tuning: "Managed Tuning",
  data_licensing: "Data Licensing",
} as const;

export const REQUESTED_LANE_DESCRIPTIONS = {
  qualification: "Review the site, task, and blockers first.",
  preview_simulation: "Prepare a preview asset once the record supports it.",
  deeper_evaluation: "Request a deeper technical review package for one exact site.",
  managed_tuning: "Flag later scenario generation or managed tuning work.",
  data_licensing: "Request licensed datasets or derived asset packages for one exact site.",
} as const;

export const HELP_WITH_LABELS = {
  "benchmark-packs": "Site Review",
  "scene-library": "Preview Simulation",
  "dataset-packs": "Data Licensing",
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
  qualification: "site-qualification",
  preview_simulation: "preview-simulation",
  deeper_evaluation: "evaluation-package",
  managed_tuning: "managed-tuning",
  data_licensing: "data-licensing",
} as const;

export const CONTACT_INTEREST_TO_LANE = {
  "site-qualification": "qualification",
  "preview-simulation": "preview_simulation",
  "evaluation-package": "deeper_evaluation",
  "deeper-evaluation": "deeper_evaluation",
  "evaluation-run": "deeper_evaluation",
  "hosted-session": "deeper_evaluation",
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
  handoff_ready: "Handoff Ready",
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
