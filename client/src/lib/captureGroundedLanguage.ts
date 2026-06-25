export const captureGroundedPublicCopy = {
  productSummary:
    "Blueprint owns the real-site robot evaluation dataset and workflow: it turns lawful indoor capture, site/task scope, robot profiles, buyer thresholds, and submitted policy references into Site, Task, Scenario, Eval, and comparison artifacts for robot teams and site operators.",
  seoDescription:
    "Blueprint helps robot teams and site operators turn a specific site, task, and policy set into a real-site robot evaluation workflow while keeping capture provenance, rights, privacy, evidence, and access boundaries attached.",
  groundTruthDefinition:
    "Ground truth means raw capture evidence, timestamps, poses, device metadata, rights and privacy records, provenance, and package artifacts or runtime artifacts when they exist.",
  supportSignalBoundary:
    "Samples, generated previews, dry-run commerce, catalog matches, request drafts, research correlations, and virtual comparison scores are support signals. They do not prove customer results, rights clearance, provider execution, payment, package access, hosted fulfillment, an operational deployment verdict, real-world accuracy, guaranteed threshold performance, or city-live coverage.",
  publicLaunchReadyBoundary:
    "Public pages can stay polished and present-tense while live availability, rights, payment, provider execution, package access, and fulfillment remain confirmed per site/request.",
  requestBoundary:
    "A request records the site, workflow, robot question, and desired next step. It does not grant payment, entitlement, rights clearance, provider execution, package access, fulfillment, or hosted-session availability.",
  catalogBoundary:
    "Catalog copy can help buyers compare sample, planned, and access-reviewed listings, but operational truth stays with capture provenance, rights/privacy records, package artifacts, runtime evidence, and request review.",
  apiSafety:
    "This endpoint only returns public, non-sensitive summaries. Do not infer customer results, ratings, prices, live payment state, package availability, hosted fulfillment, rights state, capture provenance, provider execution, threshold guarantees, or package proof beyond owner-system evidence.",
};

export const captureGroundedRequiredSignals = [
  "raw capture evidence",
  "timestamps and poses",
  "device metadata",
  "rights and privacy records",
  "provenance",
  "package artifacts",
  "runtime artifacts when available",
];

export const captureGroundedBlockedClaims = [
  "customer results",
  "rights clearance",
  "provider execution",
  "payment",
  "package access",
  "hosted fulfillment",
  "operational deployment verdict",
  "real-world accuracy",
  "guaranteed threshold performance",
  "city-live coverage",
];

export const captureGroundedTruthLabels = [
  "capture_grounded",
  "provider_derived",
  "generated",
  "sample_demo",
  "request_gated",
  "protected_robot_team",
  "dry_run_order",
] as const;
