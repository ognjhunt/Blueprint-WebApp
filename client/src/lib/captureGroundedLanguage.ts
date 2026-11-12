export const captureGroundedPublicCopy = {
  productSummary:
    "Blueprint turns a site's video of one recurring job into a job packet. A site starts with an email and a video of the job. The job packet holds the site's own sentence for the job, a first look on paper (the robot most likely to fit, from published specifications and a cited track record), a simulation of the site built from its video, and what counts as done. Sometimes Blueprint also tries openly available robot software on the job in that simulation; this early trial is not the site's answer and does not predict what a deployment company's robot would do. Blueprint shares each job with the deployment companies it approves by hand: the site's description of the job, its video without sound, the simulation, what counts as done, the first look and the early trial's result where one exists. A site's name, address and contact details go to a company only when the site asks for an introduction. A company can say it is interested, that the job is not a fit, or that it would need something, and any work is agreed between the site and the company. Free for sites. Nothing is charged today. Inside Blueprint each job's simulation work runs as a Task Evaluation Run, which returns a bounded decision or explicit abstention; it is not physical proof and never certifies physical performance or safety.",
  seoDescription:
    "Send a video of one job that repeats. Blueprint turns it into a job packet: a first look at which robots could fit and a simulation of your site. We share it with deployment companies we approve, and they answer. Free for sites.",
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
