export const worldModelDefinition =
  "A Blueprint world model is a site-specific digital environment built from real capture of one facility and one workflow.";

export const sitePackageDefinition =
  "A site package is everything a robot team needs to run, adapt, or build its own world model for that site: walkthrough media, geometry, metadata, and rights, without starting in a Blueprint-hosted session.";

export const hostedEvaluationDefinition =
  "Hosted evaluation is the Blueprint-managed review path for one exact site, used for reruns, failure review, checkpoint comparison, and export generation without passing files around first.";

export const sessionHourDefinition =
  "A session-hour is one hour of self-serve hosted review on one exact site. It covers the live session time used to run, rerun, inspect, and export results.";

export const sitePackageIncludes = [
  "Walkthrough video, timestamps, and camera poses tied to one real facility",
  "Intrinsics, depth, and geometry files when the source capture supports them",
  "Site notes, provenance, privacy, and rights metadata",
  "Package manifest and reference material for grounding your own world model",
];

export const hostedEvaluationOutputs = [
  "Repeatable runs on the same exact site",
  "Rollout video, failure review, and checkpoint comparison",
  "Dataset, raw bundle, and export generation tied to the listing",
  "A browser-accessible hosted session, no local setup needed",
];

export const stableContractItems = [
  "Capture truth: walkthrough media, timestamps, poses, and device metadata",
  "Rights, privacy, consent, and provenance metadata",
  "Site package manifests and hosted-session contracts",
  "Buyer-facing licensing, export, and access rules",
];

export const listingVariationItems = [
  "Depth and geometry coverage",
  "Available scenario variations and start states",
  "Robot assumptions and sensor requirements",
  "Export set, freshness state, and any restricted zones",
];

export const companyTrustItems = [
  "Blueprint captures real facilities and turns them into products robot teams can buy.",
  "Blueprint sells site-specific packages and hosted access, not deployment guarantees.",
  "Rights, privacy, and usage controls are attached to every listing up front.",
];

export const illustrativeLabel = "Example preview";
export const sampleArtifactLabel = "Sample file";
