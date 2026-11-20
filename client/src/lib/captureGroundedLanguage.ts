import { EVERYDAY_ANSWERS, FIRST_LOOK_WHEN_READY, HOME_SEO_DESCRIPTION, TESTED_ANSWERS } from "./publicCopy";

export const captureGroundedPublicCopy = {
  productSummary:
    `Blueprint turns a site's video of one recurring job into a job packet. A site starts with an email, where the job is, and the required video. The packet holds the site's own sentence for the job and what counts as done when known. ${FIRST_LOOK_WHEN_READY} We use published specifications and a cited track record. The packet includes the video without sound and adds the simulation when it is ready. Blueprint sends each job automatically to the deployment companies it has approved. A site's name, address and contact details go to a company only when the site asks for an introduction. A company can answer ${EVERYDAY_ANSWERS}. Once the simulation can be downloaded, it can also answer ${TESTED_ANSWERS}. Any work is agreed between the site and the company. Free for sites. Nothing is charged today. Blueprint runs no robot software in the simulation; a company can test the downloaded simulation in its own tools. A simulation is a bounded estimate; it is not physical proof and never certifies physical performance or safety.`,
  seoDescription: HOME_SEO_DESCRIPTION,
  publicLaunchReadyBoundary:
    "Public pages can stay polished and present-tense while live availability, rights, payment, provider execution, package access, and fulfillment remain confirmed per site/request.",
  requestBoundary:
    "A request records the workflow, deployment question, claims, thresholds, evidence, timing, restrictions, and robot candidates when applicable. It does not grant payment, rights clearance, provider execution, raw site-model access, physical access, fulfillment, or deployment approval.",
  catalogBoundary:
    "Catalog copy can help buyers compare sample, planned, and access-reviewed listings, but operational truth stays with capture provenance, rights/privacy records, package artifacts, runtime evidence, and request review.",
  apiSafety:
    "This endpoint returns public summaries only.",
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
