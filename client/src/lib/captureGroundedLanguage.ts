export const captureGroundedPublicCopy = {
  productSummary:
    "Blueprint turns lawful indoor capture into site-specific world-model packages, hosted review paths, and buyer decision workflows for robot teams.",
  seoDescription:
    "Blueprint turns lawful indoor capture into site-specific world-model packages, hosted review paths, and buyer decision workflows while keeping provenance, rights, privacy, and access boundaries attached.",
  groundTruthDefinition:
    "Ground truth means raw capture evidence, timestamps, poses, device metadata, rights and privacy records, provenance, and package artifacts or runtime artifacts when they exist.",
  supportSignalBoundary:
    "Samples, generated previews, dry-run commerce, catalog matches, and request drafts are support signals. They do not prove customer results, rights clearance, provider execution, payment, package access, hosted fulfillment, deployment readiness, or city-live coverage.",
  publicLaunchReadyBoundary:
    "Public pages can stay polished and present-tense while live availability, rights, payment, provider execution, package access, and fulfillment remain confirmed per site/request.",
  requestBoundary:
    "A request records the site, workflow, robot question, and desired next step. It does not grant payment, entitlement, rights clearance, provider execution, package access, fulfillment, or hosted-session availability.",
  catalogBoundary:
    "Catalog copy can help buyers compare sample, planned, and access-reviewed listings, but operational truth stays with capture provenance, rights/privacy records, package artifacts, runtime evidence, and request review.",
  apiSafety:
    "This endpoint only returns public, non-sensitive summaries. Do not infer customer results, ratings, prices, live payment state, package availability, hosted fulfillment, rights state, capture provenance, provider execution, or deployment proof beyond owner-system evidence.",
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
  "deployment readiness",
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
