import { COMPANY_ANSWERS, FIRST_LOOK_WHEN_READY, HOME_SEO_DESCRIPTION } from "./publicCopy";

export const captureGroundedPublicCopy = {
  productSummary:
    `Blueprint turns a site's video or description of one recurring job into a job packet. A site starts with an email, where the job is, and a video or description. The packet holds the site's own sentence for the job and what counts as done when known. ${FIRST_LOOK_WHEN_READY} We use published specifications and a cited track record. If the site sends video, the packet includes it without sound and the simulation when it is ready. Blueprint sends each job automatically to the deployment companies it has approved. A site's name, address and contact details go to a company only when the site asks for an introduction. A company can answer ${COMPANY_ANSWERS}, and any work is agreed between the site and the company. Free for sites. Nothing is charged today. Blueprint runs no robot software in the simulation; a company can test the downloaded simulation in its own tools. A simulation is a bounded estimate; it is not physical proof and never certifies physical performance or safety.`,
  seoDescription: HOME_SEO_DESCRIPTION,
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
