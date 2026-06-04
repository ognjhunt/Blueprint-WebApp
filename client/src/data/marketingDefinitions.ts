export const worldModelDefinition =
  "A Blueprint world model is a site-specific digital environment built from real capture of one indoor operating space and the robot workflows that need to run there.";

export const sitePackageDefinition =
  "A site data package gives a robot team the capture-backed world model, scenario data, provenance, rights posture, and export limits for one real site.";

export const hostedEvaluationDefinition =
  "A policy evaluation set is the fixed-scope path for testing one robot policy/profile on one real site against one scoped task pack.";

export const categoryValidationDefinition =
  "Street View-grounded world models make outdoor places easier for agents to explore; Blueprint focuses the same site-specific logic on indoor spaces that need lawful capture, provenance, and rights review.";

export const policyEvaluationSetDefinition =
  "A policy evaluation set covers one site, one robot policy/profile, one scoped task pack, and up to 500 scenarios/episodes, with pass/fail metrics, cycle time, intervention and failure notes, selected rollout evidence, and export framing.";

export const sitePackageIncludes = [
  "Walkthrough video, timestamps, and camera poses tied to one real facility",
  "Intrinsics, depth, and geometry files when the source capture supports them",
  "Scenario variations, site notes, provenance, privacy, and rights metadata",
  "Package manifest and reference material for training, fine-tuning, and evaluation",
];

export const hostedEvaluationOutputs = [
  "One policy/profile reviewed against the same exact site's scoped task pack",
  "Up to 500 scenarios/episodes, with failure review and checkpoint comparison",
  "Scenario/results manifest and export generation tied to the site",
  "A policy-evaluation path selected after request review",
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
  "Blueprint captures indoor facilities and turns them into site-specific data products robot teams can request, evaluate, and license.",
  "Blueprint sells site data packages and fixed-scope policy evaluation sets, not deployment guarantees.",
  "Rights, privacy, and usage controls are attached to every listing up front.",
];

export const illustrativeLabel = "Example preview";
export const sampleArtifactLabel = "Sample file";
