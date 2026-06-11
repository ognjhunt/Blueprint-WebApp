export const siteTypeFilterOptions = [
  "All",
  "Warehouse",
  "Factory",
  "Retail",
  "Hospital",
  "Outdoor / Yard",
  "Lab",
] as const;

export const taskPackFilterOptions = [
  "All",
  "Tote transfer",
  "Pick/place",
  "Inspection route",
  "Line-side delivery",
  "Shelf/bin check",
  "Blocked-path recovery",
  "Human crossing",
] as const;

export const readinessFilterOptions = [
  "All",
  "Ready to evaluate",
  "Capture complete",
  "Needs review",
  "Coming soon",
] as const;

export const accessFilterOptions = [
  "All",
  "Open sample",
  "Request-gated",
  "Private / NDA",
  "Operator approval required",
] as const;

export const regionFilterOptions = [
  "All",
  "Southeast",
  "Midwest",
  "Northeast",
  "West",
  "International",
] as const;

export type SiteType = Exclude<(typeof siteTypeFilterOptions)[number], "All">;
export type TaskPack = Exclude<(typeof taskPackFilterOptions)[number], "All">;
export type ReadinessStatus = Exclude<(typeof readinessFilterOptions)[number], "All">;
export type AccessStatus = Exclude<(typeof accessFilterOptions)[number], "All">;
export type SiteRegion = Exclude<(typeof regionFilterOptions)[number], "All">;

export type RobotEvalPublicationArtifactUris = {
  manifestUri: string;
  siteCardUri: string;
  taskCardsUri: string;
  scenarioCardsUri: string;
  evalCardsUri: string;
  proofBoundariesUri: string;
  taskOntologyUri: string;
  scenarioFamilyLibraryUri: string;
  scoringMethodologyUri: string;
  taskThresholdsUri: string;
  publicationReadinessUri: string;
  sceneAssetInventoryUri: string;
  sceneAssetDependencyAuditUri: string;
  sceneAssetPreflightUri: string;
  sceneAssetInspectionUri: string;
  sceneFrameEstimateUri: string;
  colliderProxyPlanUri: string;
  cpuSceneProxyManifestUri: string;
  cpuPreflightScorecardUri: string;
  taskAnchorProposalManifestUri: string;
  episodeSpecManifestUri: string;
  episodeSpecsUri: string;
  spawnPoseValidationManifestUri: string;
  cpuPreflightManifestUri: string;
  preGpuReadinessSummaryUri: string;
  cpuSimulatorPreflightManifestUri: string;
  gpuHandoffPacketUri: string;
  gpuOwnerSystemProofSchemaUri: string;
  gpuRunChecklistUri: string;
  ownerGpuSimulatorExecutionBlockedManifestUri: string;
};

export type RobotEvalPreflightDisplaySummary = {
  sceneAssetLabel: string;
  dependencyLabel: string;
  colliderProxyLabel: string;
  episodeSpecLabel: string;
  spawnValidationLabel: string;
  cpuSimulatorLabel: string;
  gpuHandoffLabel: string;
  localCpuSmokeRan: boolean;
  readyForOwnerGpuPreflight: boolean;
  proofBoundaryLabel: string;
};

export type RobotEvalPublicationSummary = {
  readyToEvaluatePublishable: boolean;
  publicationLabel: "Ready to evaluate" | "Needs review";
  taskThresholdSummary: {
    taskThresholdCount: number;
    thresholdPolicy: string;
  };
  missingProofLabels: string[];
  preflightSummary: RobotEvalPreflightDisplaySummary;
  artifactUris: RobotEvalPublicationArtifactUris;
};

export type PipelineManifestStatusLane =
  | "privacy"
  | "world_labs"
  | "materialization"
  | "cpu_preflight"
  | "gpu_handoff"
  | "eval_result"
  | "data_package_export";

export type PipelineManifestStatus = {
  lane: PipelineManifestStatusLane;
  label: string;
  status: "complete" | "advisory" | "blocked" | "queued" | "not_started";
  summary: string;
  artifactUri: string;
  retrySummary: string;
  failureSummary: string;
};

export type DefaultRobotEvalSelection = {
  taskId: string;
  scenarioId: string;
  robotProfileId: string;
  policyId: string;
};

export type SiteCaptureLineage = {
  siteSubmissionId: string;
  captureJobId: string;
  captureId: string;
  pipelinePrefix: string;
};

export type SiteLibrarySite = {
  slug: string;
  aliasSlugs?: string[];
  name: string;
  siteType: SiteType;
  locationLabel: string;
  region: SiteRegion;
  readiness: ReadinessStatus;
  access: AccessStatus;
  taskPacks: TaskPack[];
  taskPackNotes: string[];
  scenarioCount: number;
  thumbnailSrc: string;
  thumbnailAlt: string;
  summary: string;
  evidenceLine: string;
  captureSummary: string;
  robotPovSummary: string;
  geometrySummary: string;
  included: string[];
  robotEvalPublication?: RobotEvalPublicationSummary;
  pipelineManifestStatuses?: PipelineManifestStatus[];
  defaultRobotEvalSelection?: DefaultRobotEvalSelection;
  captureLineage?: SiteCaptureLineage;
};

const defaultMissingProofLabels = [
  "needs_robot_pov",
  "needs_human_demo",
  "needs_action_logs",
  "needs_actual_outcome",
  "needs_policy_api_endpoint_ref",
  "needs_docker_container_ref",
  "needs_recorded_action_trace_ref",
  "needs_high_level_skill_trace_ref",
  "needs_teleop_demo_ref",
  "needs_sim_controller_plugin_ref",
  "review_only_no_robot_readiness",
];

function robotEvalPublicationPackage(
  slug: string,
  taskThresholdCount: number,
): RobotEvalPublicationSummary {
  const datasetPrefix = `/synced-artifacts/sites/${slug}/pipeline/robot_eval_dataset`;
  const simulationPrefix = `/synced-artifacts/sites/${slug}/pipeline/simulation_automation`;
  return {
    readyToEvaluatePublishable: true,
    publicationLabel: "Ready to evaluate",
    taskThresholdSummary: {
      taskThresholdCount,
      thresholdPolicy: "Repo-synced task thresholds are evaluation gates, not robot-readiness claims.",
    },
    missingProofLabels: defaultMissingProofLabels,
    preflightSummary: {
      sceneAssetLabel: "Scene asset preflight",
      dependencyLabel: "Dependencies audited",
      colliderProxyLabel: "Collider/proxy plan review-required",
      episodeSpecLabel: "Episode specs review-required",
      spawnValidationLabel: "Spawn candidates checked",
      cpuSimulatorLabel: "CPU setup manifests",
      gpuHandoffLabel: "Owner GPU handoff review-required",
      localCpuSmokeRan: false,
      readyForOwnerGpuPreflight: false,
      proofBoundaryLabel: "No simulator execution or robot readiness claim",
    },
    artifactUris: {
      manifestUri: `${datasetPrefix}/robot_eval_dataset_manifest.json`,
      siteCardUri: `${datasetPrefix}/site_card.json`,
      taskCardsUri: `${datasetPrefix}/task_cards.json`,
      scenarioCardsUri: `${datasetPrefix}/scenario_cards.json`,
      evalCardsUri: `${datasetPrefix}/eval_cards.json`,
      proofBoundariesUri: `${datasetPrefix}/proof_boundaries.json`,
      taskOntologyUri: `${datasetPrefix}/task_ontology_v1.json`,
      scenarioFamilyLibraryUri: `${datasetPrefix}/scenario_family_library.json`,
      scoringMethodologyUri: `${datasetPrefix}/scoring_methodology.json`,
      taskThresholdsUri: `${datasetPrefix}/task_thresholds.json`,
      publicationReadinessUri: `${datasetPrefix}/publication_readiness.json`,
      sceneAssetInventoryUri: `${simulationPrefix}/scene_asset_inventory.json`,
      sceneAssetDependencyAuditUri: `${simulationPrefix}/scene_asset_dependency_audit.json`,
      sceneAssetPreflightUri: `${simulationPrefix}/scene_asset_preflight.json`,
      sceneAssetInspectionUri: `${simulationPrefix}/scene_asset_inspection.json`,
      sceneFrameEstimateUri: `${simulationPrefix}/scene_frame_estimate.json`,
      colliderProxyPlanUri: `${simulationPrefix}/collider_proxy_plan.json`,
      cpuSceneProxyManifestUri: `${simulationPrefix}/cpu_scene_proxy_manifest.json`,
      cpuPreflightScorecardUri: `${simulationPrefix}/cpu_preflight_scorecard.json`,
      taskAnchorProposalManifestUri: `${simulationPrefix}/task_anchor_proposal_manifest.json`,
      episodeSpecManifestUri: `${simulationPrefix}/episode_spec_manifest.json`,
      episodeSpecsUri: `${simulationPrefix}/episode_specs.json`,
      spawnPoseValidationManifestUri: `${simulationPrefix}/spawn_pose_validation_manifest.json`,
      cpuPreflightManifestUri: `${simulationPrefix}/cpu_preflight_manifest.json`,
      preGpuReadinessSummaryUri: `${simulationPrefix}/pre_gpu_readiness_summary.json`,
      cpuSimulatorPreflightManifestUri: `${simulationPrefix}/cpu_simulator_preflight_manifest.json`,
      gpuHandoffPacketUri: `${simulationPrefix}/gpu_handoff_packet.json`,
      gpuOwnerSystemProofSchemaUri: `${simulationPrefix}/gpu_owner_system_proof_schema.json`,
      gpuRunChecklistUri: `${simulationPrefix}/gpu_run_checklist.md`,
      ownerGpuSimulatorExecutionBlockedManifestUri: `${simulationPrefix}/owner_gpu_simulator_execution_blocked_manifest.json`,
    },
  };
}

function captureLineage(slug: string): SiteCaptureLineage {
  return {
    siteSubmissionId: `site-submission-${slug}`,
    captureJobId: `capture-job-${slug}`,
    captureId: `capture-${slug}`,
    pipelinePrefix: `/synced-artifacts/sites/${slug}/pipeline`,
  };
}

function pipelineManifestStatuses(slug: string): PipelineManifestStatus[] {
  const datasetPrefix = `/synced-artifacts/sites/${slug}/pipeline/robot_eval_dataset`;
  const simulationPrefix = `/synced-artifacts/sites/${slug}/pipeline/simulation_automation`;
  return [
    {
      lane: "privacy",
      label: "Privacy",
      status: "advisory",
      summary: "Rights/privacy packet attached for request review",
      artifactUri: `${datasetPrefix}/rights_packet.json`,
      retrySummary: "Retry after rights ledger or operator approval updates sync.",
      failureSummary: "Blocked if the rights packet is missing or rejects external use.",
    },
    {
      lane: "world_labs",
      label: "World Labs",
      status: "advisory",
      summary: "Compatibility artifacts are support evidence only",
      artifactUri: `${simulationPrefix}/scene_asset_dependency_audit.json`,
      retrySummary: "Retry after dependency audit or generated-support asset refresh.",
      failureSummary: "Dependency failures do not prove or disprove robot readiness.",
    },
    {
      lane: "materialization",
      label: "Materialization",
      status: "complete",
      summary: "Site, task, scenario, eval, and threshold manifests attached",
      artifactUri: `${datasetPrefix}/robot_eval_dataset_manifest.json`,
      retrySummary: "Retry materialization sync if card counts or thresholds are missing.",
      failureSummary: "Partial card families stay Needs review.",
    },
    {
      lane: "cpu_preflight",
      label: "CPU preflight",
      status: "advisory",
      summary: "CPU setup manifests present; no owner-system simulator run claimed",
      artifactUri: `${simulationPrefix}/cpu_simulator_preflight_manifest.json`,
      retrySummary: "Retry after optional MuJoCo/PyBullet dependency repair.",
      failureSummary: "CPU failures are setup blockers, not robot policy failures.",
    },
    {
      lane: "gpu_handoff",
      label: "GPU handoff",
      status: "queued",
      summary: "Owner GPU handoff packet available for request-scoped execution",
      artifactUri: `${simulationPrefix}/gpu_handoff_packet.json`,
      retrySummary: "Retry once owner-system GPU proof artifacts are supplied.",
      failureSummary: "No GPU handoff packet can be treated as simulator execution.",
    },
    {
      lane: "eval_result",
      label: "Eval result",
      status: "not_started",
      summary: "Awaiting policy/container/trace/demo/plugin evidence",
      artifactUri: `${datasetPrefix}/policy_eval_report.json`,
      retrySummary: "Retry after all six policy modalities have owner-system refs.",
      failureSummary: "Missing evidence keeps pass/fail and threshold claims blocked.",
    },
    {
      lane: "data_package_export",
      label: "Data-package export",
      status: "queued",
      summary: "Post-Training Data Package export awaits request approval",
      artifactUri: `${datasetPrefix}/real_site_robot_eval_dataset_manifest.json`,
      retrySummary: "Retry export after entitlement and package-scope approval.",
      failureSummary: "Export blockers do not change the site capture provenance.",
    },
  ];
}

export const siteLibrarySites: SiteLibrarySite[] = [
  {
    slug: "sw-chi-01",
    name: "Harborview Grocery Distribution Annex",
    siteType: "Warehouse",
    locationLabel: "Midwest",
    region: "Midwest",
    readiness: "Ready to evaluate",
    access: "Request-gated",
    taskPacks: ["Tote transfer", "Shelf/bin check", "Human crossing"],
    taskPackNotes: [
      "Tote transfer from dock-side stack to shelf staging",
      "Shelf and bin check with clutter variation",
      "Human crossing route interruption",
    ],
    scenarioCount: 500,
    thumbnailSrc: "/generated/editorial/grocery-fulfillment.png",
    thumbnailAlt: "Warehouse grocery backroom with dock and staging aisles",
    summary:
      "Backroom and dock-side grocery distribution layout for tote movement, shelf staging, and pedestrian-interruption checks.",
    evidenceLine: "Robot POV available · capture-backed site package",
    captureSummary: "Walkthrough capture, route notes, task labels, and site package metadata are attached for request review.",
    robotPovSummary: "Head-height robot POV and aisle-route review are available for scoped evaluation planning.",
    geometrySummary: "Collider and geometry fields are available where applicable, with exact access confirmed per request.",
    included: [
      "Site card with capture and access posture",
      "Task packs for tote, shelf, and crossing scenarios",
      "Scenario suite summary with route and blocker labels",
      "Task Evaluation Run request path",
    ],
    robotEvalPublication: robotEvalPublicationPackage("sw-chi-01", 3),
    pipelineManifestStatuses: pipelineManifestStatuses("sw-chi-01"),
    captureLineage: captureLineage("sw-chi-01"),
    defaultRobotEvalSelection: {
      taskId: "place_return_in_bin",
      scenarioId: "scenario_place_return_in_bin_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "default_fixture_policy",
    },
  },
  {
    slug: "sw-det-09",
    name: "Motor City Battery Staging Cell",
    siteType: "Factory",
    locationLabel: "Midwest",
    region: "Midwest",
    readiness: "Capture complete",
    access: "Private / NDA",
    taskPacks: ["Line-side delivery", "Blocked-path recovery"],
    taskPackNotes: [
      "Line-side delivery into a fixture transfer cell",
      "Cart approach and blocked buffer recovery",
      "Fixture-offset transfer review",
    ],
    scenarioCount: 320,
    thumbnailSrc: "/generated/editorial/manufacturing-plant.png",
    thumbnailAlt: "Factory line-side staging cell with fixtures and carts",
    summary:
      "Battery assembly staging cell with parts feed, cart approach, fixture positioning, and tight transfer envelopes.",
    evidenceLine: "Capture complete · operator approval needed",
    captureSummary: "Capture metadata and task scope are available, with private access and NDA review before expanded detail.",
    robotPovSummary: "Robot POV planning is attached to the request packet after approval.",
    geometrySummary: "Fixture, cart, and blocked-path geometry notes are tracked for evaluation scoping.",
    included: [
      "Factory site summary",
      "Line-side delivery task pack",
      "Blocked-path recovery variants",
      "Private access review path",
    ],
  },
  {
    slug: "sw-col-05",
    name: "Front Range Cold Storage Pod",
    siteType: "Warehouse",
    locationLabel: "West",
    region: "West",
    readiness: "Ready to evaluate",
    access: "Request-gated",
    taskPacks: ["Tote transfer", "Inspection route"],
    taskPackNotes: [
      "Tote transfer through airlock and cold aisle",
      "Inspection route with narrow aisle navigation",
      "Timing-sensitive outbound handoff",
    ],
    scenarioCount: 440,
    thumbnailSrc: "/generated/editorial/cold-storage.png",
    thumbnailAlt: "Cold storage aisle with insulated staging and narrow travel paths",
    summary:
      "Cold-storage pick pod with airlock transfer, insulated staging, narrow aisles, and temperature-sensitive route timing.",
    evidenceLine: "Robot POV available · scenario timing labels",
    captureSummary: "Chilled-room capture notes, route timing, and staging context are attached for request review.",
    robotPovSummary: "Robot POV and aisle-facing review are available for the primary task packs.",
    geometrySummary: "Aisle clearance and insulated staging geometry are summarized for evaluation planning.",
    included: [
      "Cold-storage site card",
      "Tote and inspection task packs",
      "Timing and airlock scenario notes",
      "Request-gated Task Evaluation Run path",
    ],
    robotEvalPublication: robotEvalPublicationPackage("sw-col-05", 2),
    pipelineManifestStatuses: pipelineManifestStatuses("sw-col-05"),
    captureLineage: captureLineage("sw-col-05"),
    defaultRobotEvalSelection: {
      taskId: "move_tote",
      scenarioId: "scenario_move_tote_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "default_fixture_policy",
    },
  },
  {
    slug: "northfield-distribution-center",
    aliasSlugs: ["sw-atl-02"],
    name: "Northfield Distribution Center",
    siteType: "Warehouse",
    locationLabel: "Southeast",
    region: "Southeast",
    readiness: "Ready to evaluate",
    access: "Request-gated",
    taskPacks: ["Tote transfer", "Human crossing", "Blocked-path recovery"],
    taskPackNotes: [
      "Cart-to-conveyor transfer",
      "Human crossing on a shared lane",
      "Blocked approach and recovery route",
    ],
    scenarioCount: 620,
    thumbnailSrc: "/generated/editorial/cross-dock.png",
    thumbnailAlt: "Distribution center cross-dock lane with totes and transfer points",
    summary:
      "Distribution lane with cart-to-conveyor transfer, human crossing, and blocked approach scenarios for mobile manipulation teams.",
    evidenceLine: "Capture-backed site package · request-gated access",
    captureSummary: "Lane capture, transfer points, and shared-path notes are available for scoped review.",
    robotPovSummary: "Robot POV is prepared for conveyor approach and crossing scenarios.",
    geometrySummary: "Transfer, blocked path, and lane-width geometry are summarized where applicable.",
    included: [
      "Warehouse site summary",
      "Cart-to-conveyor task pack",
      "Human crossing and blocked approach scenarios",
      "Evaluation request handoff",
    ],
    robotEvalPublication: robotEvalPublicationPackage("northfield-distribution-center", 3),
    pipelineManifestStatuses: pipelineManifestStatuses("northfield-distribution-center"),
    captureLineage: captureLineage("northfield-distribution-center"),
    defaultRobotEvalSelection: {
      taskId: "cart_to_conveyor_transfer",
      scenarioId: "scenario_cart_to_conveyor_transfer_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "default_fixture_policy",
    },
  },
  {
    slug: "piedmont-hospital-supply-hallway",
    aliasSlugs: ["sw-den-11"],
    name: "Piedmont Hospital Supply Hallway",
    siteType: "Hospital",
    locationLabel: "Southeast",
    region: "Southeast",
    readiness: "Needs review",
    access: "Operator approval required",
    taskPacks: ["Inspection route"],
    taskPackNotes: [
      "Supply delivery route review",
      "Door and hallway navigation",
      "Quiet-hour inspection pass",
    ],
    scenarioCount: 180,
    thumbnailSrc: "/generated/humanoid-readiness-2026-06-03/humanoid-hosted-readiness-dashboard.png",
    thumbnailAlt: "Hospital logistics hallway dashboard and robot evaluation view",
    summary:
      "Hospital logistics hallway for supply delivery, doorway navigation, hallway passing, and inspection-route planning.",
    evidenceLine: "Needs review · operator approval required",
    captureSummary: "Supply route and doorway context are documented, with operator approval required before broader access.",
    robotPovSummary: "Robot POV planning is scoped after privacy and operator review.",
    geometrySummary: "Doorway, hallway, and passing-width notes are available in the review packet.",
    included: [
      "Hospital logistics site card",
      "Supply delivery and inspection route notes",
      "Doorway and hallway navigation scenarios",
      "Operator approval checklist",
    ],
  },
  {
    slug: "south-bay-retail-stockroom",
    aliasSlugs: ["sw-sjc-07"],
    name: "South Bay Retail Stockroom",
    siteType: "Retail",
    locationLabel: "West",
    region: "West",
    readiness: "Coming soon",
    access: "Request-gated",
    taskPacks: ["Shelf/bin check", "Tote transfer", "Blocked-path recovery"],
    taskPackNotes: [
      "Shelf and bin check",
      "Tote movement from receiving to staging",
      "Clutter recovery in a tight stockroom",
    ],
    scenarioCount: 120,
    thumbnailSrc: "/generated/editorial/retail-store.png",
    thumbnailAlt: "Retail stockroom with shelves, bins, and receiving totes",
    summary:
      "Retail stockroom profile for shelf/bin checks, tote movement, and clutter recovery in constrained back-of-house layouts.",
    evidenceLine: "Catalog profile · request details open after review",
    captureSummary: "Profile and task scope are drafted for teams that want this retail layout evaluated.",
    robotPovSummary: "Robot POV is planned for shelf-facing and stockroom transfer routes.",
    geometrySummary: "Tight-aisle and shelf-access geometry notes are planned for the site packet.",
    included: [
      "Retail stockroom profile",
      "Shelf/bin and tote task pack draft",
      "Clutter recovery scenario outline",
      "New-site request path",
    ],
  },
  {
    slug: "lakeshore-loading-dock",
    aliasSlugs: ["sw-dal-04"],
    name: "Lakeshore Loading Dock",
    siteType: "Outdoor / Yard",
    locationLabel: "Midwest",
    region: "Midwest",
    readiness: "Capture complete",
    access: "Operator approval required",
    taskPacks: ["Blocked-path recovery", "Human crossing"],
    taskPackNotes: [
      "Pallet approach and staging",
      "Blocked path around dock equipment",
      "Human and vehicle crossing",
    ],
    scenarioCount: 260,
    thumbnailSrc: "/generated/humanoid-readiness-2026-06-03/humanoid-loading-dock-readiness.png",
    thumbnailAlt: "Loading dock with pallet staging and outdoor yard approach",
    summary:
      "Loading dock and yard-adjacent staging area for pallet approach, blocked path, and human/vehicle crossing evaluation.",
    evidenceLine: "Capture complete · access confirmed per site",
    captureSummary: "Dock approach, staging, and crossing context are captured for review.",
    robotPovSummary: "Robot POV planning is available for dock approach and crossing variants.",
    geometrySummary: "Dock edge, pallet, and blocked-path geometry are summarized where applicable.",
    included: [
      "Loading dock site card",
      "Pallet approach and blocked-path task packs",
      "Human/vehicle crossing scenario notes",
      "Operator approval path",
    ],
  },
  {
    slug: "triangle-robotics-lab",
    aliasSlugs: ["siteworld-f5fd54898cfb", "sw-demo-01"],
    name: "Triangle Robotics Lab",
    siteType: "Lab",
    locationLabel: "Southeast",
    region: "Southeast",
    readiness: "Ready to evaluate",
    access: "Open sample",
    taskPacks: ["Pick/place", "Inspection route"],
    taskPackNotes: [
      "Pick/place policy smoke test",
      "Robot POV validation pass",
      "Inspection route through a controlled lab layout",
    ],
    scenarioCount: 90,
    thumbnailSrc: "/generated/private/workspace-runtime-warehouse.png",
    thumbnailAlt: "Robotics lab runtime workspace with policy evaluation controls",
    summary:
      "Open sample lab profile for policy smoke tests, robot POV validation, and controlled inspection-route evaluation.",
    evidenceLine: "Open sample · robot POV validation",
    captureSummary: "Sample files show the product shape; request-specific proof is still confirmed per site and run.",
    robotPovSummary: "Robot POV validation is included for the sample task packs.",
    geometrySummary: "Controlled lab geometry is summarized for smoke-test planning.",
    included: [
      "Open sample site card",
      "Policy smoke-test task pack",
      "Robot POV validation notes",
      "Task Evaluation Run request path",
    ],
    robotEvalPublication: robotEvalPublicationPackage("triangle-robotics-lab", 2),
    pipelineManifestStatuses: pipelineManifestStatuses("triangle-robotics-lab"),
    captureLineage: captureLineage("triangle-robotics-lab"),
    defaultRobotEvalSelection: {
      taskId: "pick_known_object",
      scenarioId: "scenario_pick_known_object_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      policyId: "default_fixture_policy",
    },
  },
];

export function getSiteLibrarySite(slug: string | null | undefined) {
  const normalized = String(slug || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!normalized) return null;

  return (
    siteLibrarySites.find((site) => {
      const candidates = [site.slug, ...(site.aliasSlugs || [])].map((value) =>
        value.toLowerCase(),
      );
      return candidates.includes(normalized);
    }) || null
  );
}

export function buildTaskEvaluationRunHref(site: SiteLibrarySite, source = "sites-library") {
  const params = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "hosted-evaluation",
    path: "task-evaluation-run",
    source,
    siteSlug: site.slug,
    siteName: site.name,
    siteType: site.siteType,
    siteRegion: site.region,
    taskStatement: `Task Evaluation Run request for ${site.name}`,
    requestedOutputs: "Task Evaluation Run",
  });

  return `/contact?${params.toString()}`;
}

export function buildSubmitSiteHref(source = "sites-library") {
  return `/contact/site-operator?source=${encodeURIComponent(source)}`;
}
