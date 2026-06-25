const humanoidReadinessBase = "/generated/humanoid-readiness-2026-06-03";
const robotMosaicHeroBase = "/editorial/2026-06-04";
const robotTeamEvalBase = "/editorial/2026-06-06";
const wamPolicyEvalBase = "/generated/wam-policy-eval-2026-06-21";
const wamPolicyEvalPovBase = "/generated/wam-policy-eval-pov-2026-06-25";

export const wamPolicyEvalAssets = {
  hero: `${wamPolicyEvalBase}/figure03-style-hero.png`,
  siteTask: `${wamPolicyEvalBase}/figure03-style-site-task.png`,
  rolloutStrip: `${wamPolicyEvalBase}/figure03-style-rollout-strip.png`,
  povClips: [
    {
      src: `${wamPolicyEvalPovBase}/warehouse-tote-pov.jpg`,
      alt: "First-person humanoid robot POV lifting a blue tote from a warehouse shelf",
    },
    {
      src: `${wamPolicyEvalPovBase}/factory-conveyor-pov.jpg`,
      alt: "First-person humanoid robot POV sorting small metal parts on a factory conveyor",
    },
    {
      src: `${wamPolicyEvalPovBase}/loading-dock-pov.jpg`,
      alt: "First-person humanoid robot POV moving a carton at a loading dock",
    },
    {
      src: `${wamPolicyEvalPovBase}/cold-storage-pov.jpg`,
      alt: "First-person humanoid robot POV pulling a frosted crate from a cold-storage shelf",
    },
    {
      src: `${wamPolicyEvalPovBase}/machine-tending-pov.jpg`,
      alt: "First-person humanoid robot POV operating a guarded industrial machine station",
    },
    {
      src: `${wamPolicyEvalPovBase}/inspection-bench-pov.jpg`,
      alt: "First-person humanoid robot POV inspecting a small component at a QA bench",
    },
    {
      src: `${wamPolicyEvalPovBase}/packing-cell-pov.jpg`,
      alt: "First-person humanoid robot POV sorting parts between bins in a packing cell",
    },
    {
      src: `${wamPolicyEvalPovBase}/retail-backroom-pov.jpg`,
      alt: "First-person humanoid robot POV restocking packaged goods in a backroom aisle",
    },
    {
      src: `${wamPolicyEvalPovBase}/dishwasher-pov.jpg`,
      alt: "First-person humanoid robot POV loading dishes into a dishwasher",
    },
    {
      src: `${wamPolicyEvalPovBase}/laundry-folding-pov.jpg`,
      alt: "First-person humanoid robot POV folding a towel in a laundry room",
    },
    {
      src: `${wamPolicyEvalPovBase}/route-scan-pov.jpg`,
      alt: "First-person humanoid robot POV checking an industrial aisle route marker",
    },
  ],
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
