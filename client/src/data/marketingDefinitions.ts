export const worldModelDefinition =
  "A Blueprint world model is a site-specific digital environment built from real capture of one indoor operating space and the robot workflows that need to run there.";

export const sitePackageDefinition =
  "A site package gives a robot team capture-grounded site context, scenario data, provenance, rights posture, and export limits for one real site.";

export const hostedEvaluationDefinition =
  "A Policy Evaluation Run is the fixed-scope path for ranking 1-3 robot policies or checkpoints on one capture-backed site task pack.";

export const categoryValidationDefinition =
  "Street View-grounded world models make outdoor places easier for agents to explore; Blueprint focuses the same site-specific logic on indoor spaces that need lawful capture, provenance, and rights review.";

export const policyEvaluationSetDefinition =
  "A Policy Evaluation Run covers one site package, one task pack, one robot embodiment, and 100 or 500 WAM-eval episodes, with policy ranking, predicted success, failure taxonomy, OOD flags, recommended validation targets, and export framing.";

export const sitePackageIncludes = [
  "Walkthrough video, timestamps, and camera poses tied to one real facility",
  "Intrinsics, depth, and geometry files when the source capture supports them",
  "Scenario variations, site notes, provenance, privacy, and rights metadata",
  "Package manifest and reference material for training, fine-tuning, and evaluation",
];

export const hostedEvaluationOutputs = [
  "1-3 policies or checkpoints reviewed against the same exact site's scoped task pack",
  "100 or 500 WAM-eval episodes, with failure review and checkpoint comparison",
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
  "Blueprint sells Policy Evaluation Runs, Validated Evaluation Packs, and follow-on Policy Improvement Runs, not deployment guarantees.",
  "Rights, privacy, and usage controls are attached to every listing up front.",
];

export const illustrativeLabel = "Example preview";
export const sampleArtifactLabel = "Sample file";
