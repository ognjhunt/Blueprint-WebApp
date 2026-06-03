const humanoidReadinessBase = "/generated/humanoid-readiness-2026-06-03";

export const humanoidReadinessAssets = {
  warehouseHero: `${humanoidReadinessBase}/humanoid-warehouse-readiness-hero.png`,
  groceryTask: `${humanoidReadinessBase}/humanoid-grocery-task-readiness.png`,
  loadingDock: `${humanoidReadinessBase}/humanoid-loading-dock-readiness.png`,
  manufacturing: `${humanoidReadinessBase}/humanoid-manufacturing-readiness.png`,
  coldStorage: `${humanoidReadinessBase}/humanoid-cold-storage-readiness.png`,
  hostedDashboard: `${humanoidReadinessBase}/humanoid-hosted-readiness-dashboard.png`,
  proofBoard: `${humanoidReadinessBase}/humanoid-proof-board.png`,
} as const;

export const editorialGeneratedAssets = {
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
