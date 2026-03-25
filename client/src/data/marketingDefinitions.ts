export const worldModelDefinition =
  "A Blueprint world model is a site-specific digital environment built from real capture of one facility and one workflow lane.";

export const sitePackageDefinition =
  "A site package is the full grounding bundle a robot team uses when it wants to run, adapt, or generate its own world model for that site instead of using Blueprint-hosted runtime.";

export const hostedEvaluationDefinition =
  "Hosted evaluation is the Blueprint-managed runtime path for one exact site, used for reruns, failure review, checkpoint comparison, and export generation without passing files around first.";

export const sessionHourDefinition =
  "A session-hour is one hour of self-serve hosted runtime on one exact site. It covers the live session time used to run, rerun, inspect, and export results.";

export const sitePackageIncludes = [
  "Walkthrough video, timestamps, and camera poses tied to one real facility",
  "Intrinsics, depth, and geometry artifacts when the source capture supports them",
  "Site notes, provenance, privacy, and rights metadata",
  "Package manifest and reference material for grounding your own world model",
];

export const hostedEvaluationOutputs = [
  "Repeatable runs on the same exact site",
  "Rollout video, failure review, and checkpoint comparison",
  "Dataset, raw bundle, and export generation tied to the listing",
  "A browser-accessible runtime session without moving the package into your stack first",
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
  "Blueprint is a capture-first, world-model-product-first company.",
  "Blueprint sells site-specific packages and hosted access, not deployment guarantees.",
  "Rights, privacy, and commercialization controls stay attached to the listing instead of being implied later.",
];

export const illustrativeLabel = "Illustrative preview";
export const sampleArtifactLabel = "Sample artifact";
