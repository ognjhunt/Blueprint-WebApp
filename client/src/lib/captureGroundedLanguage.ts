export const captureGroundedPublicCopy = {
  productSummary:
    "Blueprint evaluates robots for real sites and prepares the deployment. One Task Evaluation Run records a real workflow at a site with a named budget and owner, builds a permissioned Site-Task Testbed, tests robot fit, returns a bounded decision or explicit abstention, and packages the onsite handoff. Blueprint does not perform the onsite install, commissioning, or safety approval.",
  seoDescription:
    "Blueprint helps sites and robot teams do the task discovery, site recreation, and robot-fit evaluation that happens before onsite deployment.",
  groundTruthDefinition:
    "Ground truth means immutable raw capture evidence, native timestamps, poses, device metadata, rights and privacy records, and provenance. Derived geometry, simulation, generated media, provider output, and runtime artifacts remain separately labeled evidence and do not automatically upgrade the claim.",
  supportSignalBoundary:
    "Samples, generated previews, catalog matches, request drafts, research correlations, and virtual measurements are support signals. Historical dry-run records prove only their test shape. None proves customer results, rights clearance, provider execution, payment, package access, hosted fulfillment, an operational deployment verdict, real-world accuracy, guaranteed threshold performance, or city-live coverage.",
  publicLaunchReadyBoundary:
    "Public pages can stay polished and present-tense while live availability, rights, payment, provider execution, package access, and fulfillment remain confirmed per site/request.",
  requestBoundary:
    "A request records the workflow, deployment question, claims, thresholds, evidence, timing, restrictions, and robot candidates when applicable. It does not grant payment, rights clearance, provider execution, raw site-model access, physical access, fulfillment, or deployment approval.",
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
