const humanoidReadinessBase = "/generated/humanoid-readiness-2026-06-03";
const robotMosaicHeroBase = "/editorial/2026-06-04";
const robotTeamEvalBase = "/editorial/2026-06-06";
const wamPolicyEvalBase = "/generated/wam-policy-eval-2026-06-21";

export const wamPolicyEvalAssets = {
  hero: `${wamPolicyEvalBase}/figure03-style-hero.png`,
  siteTask: `${wamPolicyEvalBase}/figure03-style-site-task.png`,
  rolloutStrip: `${wamPolicyEvalBase}/figure03-style-rollout-strip.png`,
} as const;

export const humanoidReadinessAssets = {
  warehouseHero: `${humanoidReadinessBase}/humanoid-warehouse-readiness-hero.png`,
  groceryTask: `${humanoidReadinessBase}/humanoid-grocery-task-readiness.png`,
  loadingDock: `${humanoidReadinessBase}/humanoid-loading-dock-readiness.png`,
  manufacturing: `${humanoidReadinessBase}/humanoid-manufacturing-readiness.png`,
  coldStorage: `${humanoidReadinessBase}/humanoid-cold-storage-readiness.png`,
  hostedDashboard: `${humanoidReadinessBase}/humanoid-hosted-readiness-dashboard.png`,
  robotTeamEvalWorkflow: `${robotTeamEvalBase}/robot-team-eval-workflow.png`,
  proofBoard: `${humanoidReadinessBase}/humanoid-proof-board.png`,
} as const;

export const robotMosaicHeroAssets = {
  industrialScenarioMosaic: `${robotMosaicHeroBase}/figure-robot-industrial-mosaic-hero.jpg`,
} as const;

export const editorialGeneratedAssets = {
  wamPolicyEvalHero: wamPolicyEvalAssets.hero,
  wamPolicyEvalSiteTask: wamPolicyEvalAssets.siteTask,
  wamPolicyEvalRolloutStrip: wamPolicyEvalAssets.rolloutStrip,
  robotMosaicHero: robotMosaicHeroAssets.industrialScenarioMosaic,
  homeHero:
    "/generated/2026-05-13-brand-system/blueprint-hero-proof-room-gpt-image-2.png",
  groceryBackroom: humanoidReadinessAssets.groceryTask,
  warehouseAisle: humanoidReadinessAssets.warehouseHero,
  operatorControlEntry: humanoidReadinessAssets.hostedDashboard,
  proofBoardDeliverables: humanoidReadinessAssets.proofBoard,
  hostedReviewHero: humanoidReadinessAssets.hostedDashboard,
  sampleEvaluationProofBoard:
    "/generated/editorial/sample-evaluation-proof-board.png",
  scopingRoom:
    "/generated/2026-05-13-brand-system/blueprint-hero-proof-room-gpt-image-2.png",
  proofBoardGovernance: humanoidReadinessAssets.proofBoard,
  careersStudio: humanoidReadinessAssets.manufacturing,
  ogHostedReview:
    "/generated/2026-05-13-brand-system/blueprint-og-hosted-review-gpt-image-2.png",
} as const;
