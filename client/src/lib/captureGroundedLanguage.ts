export const captureGroundedPublicCopy = {
  productSummary:
    "Blueprint turns a real site-task into a maintained testbed and one Task Evaluation Run that returns a bounded decision or explicit abstention. Pipeline routes each claim to the least expensive currently qualified evidence; capture provenance and proof boundaries stay attached.",
  seoDescription:
    "Blueprint helps robot teams and site operators turn a real site-task into a maintained testbed and a bounded decision or explicit abstention, with provenance and evidence limits attached.",
  groundTruthDefinition:
    "Ground truth means immutable raw capture evidence, native timestamps, poses, device metadata, rights and privacy records, and provenance. Derived geometry, simulation, generated media, provider output, and runtime artifacts remain separately labeled evidence and do not automatically upgrade the claim.",
  supportSignalBoundary:
    "Samples, generated previews, catalog matches, request drafts, research correlations, and virtual measurements are support signals. Historical dry-run records prove only their test shape. None proves customer results, rights clearance, provider execution, payment, package access, hosted fulfillment, an operational deployment verdict, real-world accuracy, guaranteed threshold performance, or city-live coverage.",
  publicLaunchReadyBoundary:
    "Public pages can stay polished and present-tense while live availability, rights, payment, provider execution, package access, and fulfillment remain confirmed per site/request.",
  requestBoundary:
    "A request records the site-task, decision, claims, thresholds, false-safe consequences, evidence, budget, deadline, restrictions, and candidates when applicable. It does not grant payment, entitlement, rights clearance, provider execution, artifact access, fulfillment, or hosted-session availability.",
  catalogBoundary:
    "Catalog copy can help buyers compare sample, planned, and access-reviewed listings, but operational truth stays with capture provenance, rights/privacy records, package artifacts, runtime evidence, and request review.",
  apiSafety:
    "This endpoint only returns public, non-sensitive summaries. Do not infer customer results, ratings, prices, live payment state, package availability, hosted fulfillment, rights state, capture provenance, provider execution, threshold guarantees, or package proof beyond owner-system evidence.",
};

export const captureGroundedRequiredSignals = [
  "raw capture evidence",
  "native timestamps and poses",
  "device metadata",
  "rights and privacy records",
  "provenance",
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
  "legacy_commerce_read_only",
  "decision_or_abstention",
] as const;
