export type RobotEvalMoatEnvironment =
  | "warehouse"
  | "factory"
  | "hospital"
  | "retail"
  | "cold_chain"
  | "service";

export type RobotEvalMoatArtifactStatus =
  | "representative_mock"
  | "synced_if_pipeline_present"
  | "blocked_until_rights_review"
  | "advisory_only";

export interface RobotEvalMoatArtifact {
  id: string;
  label: string;
  fileName: string;
  status: RobotEvalMoatArtifactStatus;
  boundary: string;
}

export interface RobotEvalMoatTask {
  id: string;
  label: string;
  canonicalTaskId: string;
  successDefinition: string;
  requiredEvidence: string[];
}

export interface RobotEvalMoatScenarioFamily {
  id: string;
  label: string;
  variationIds: string[];
  generatedScenarioCount: number;
  reviewStatus: "needs_human_review" | "ready_for_advisory_eval";
  sampleScenario: string;
}

export interface RobotEvalMoatReportMetric {
  id: string;
  label: string;
  value: string;
  status: "advisory" | "blocked";
  detail: string;
}

export interface RobotEvalMoatSite {
  id: string;
  catalogSiteWorldId: string;
  environment: RobotEvalMoatEnvironment;
  siteName: string;
  siteType: string;
  locationLabel: string;
  packageStatus: "representative_package";
  rightsStatus: "rights_packet_required" | "rights_packet_advisory";
  taskOntologyVersion: "task_ontology_v1";
  tasks: RobotEvalMoatTask[];
  scenarioFamilies: RobotEvalMoatScenarioFamily[];
  evalReport: RobotEvalMoatReportMetric[];
  artifacts: RobotEvalMoatArtifact[];
}

export interface RobotEvalMoatWorkflowStep {
  id: string;
  label: string;
  artifact: string;
  boundary: string;
}

export interface RobotEvalMoatModule {
  id: string;
  label: string;
  summary: string;
}

const coreArtifacts: RobotEvalMoatArtifact[] = [
  {
    id: "rights_packet",
    label: "Rights packet",
    fileName: "rights_packet.json",
    status: "blocked_until_rights_review",
    boundary: "Shows allowed uses and blockers. It is not commercial clearance by itself.",
  },
  {
    id: "rights_ledger",
    label: "Rights ledger",
    fileName: "rights_ledger.json",
    status: "blocked_until_rights_review",
    boundary: "Tracks rights records and unresolved blockers across uses.",
  },
  {
    id: "task_ontology",
    label: "Task ontology",
    fileName: "task_ontology_v1.json",
    status: "synced_if_pipeline_present",
    boundary: "Normalizes task names without creating a readiness claim.",
  },
  {
    id: "scenario_family_library",
    label: "Scenario families",
    fileName: "scenario_family_library.json",
    status: "synced_if_pipeline_present",
    boundary: "Generated variants remain review-scoped until evidence exists.",
  },
  {
    id: "scoring_methodology",
    label: "Scoring methodology",
    fileName: "scoring_methodology.json",
    status: "advisory_only",
    boundary: "Defines metrics and blocked claim upgrades.",
  },
  {
    id: "recorded_trace_eval_report",
    label: "Recorded trace eval report",
    fileName: "recorded_trace_eval_report.json",
    status: "advisory_only",
    boundary: "Scores supplied traces without claiming completed policy execution.",
  },
  {
    id: "policy_eval_report",
    label: "Policy eval report",
    fileName: "policy_eval_report.json",
    status: "representative_mock",
    boundary: "Representative report only. No submitted policy is passed here.",
  },
  {
    id: "prediction_vs_actual",
    label: "Prediction-vs-actual",
    fileName: "prediction_vs_actual_summary.json",
    status: "advisory_only",
    boundary: "Tracks gaps when actual outcomes exist. Missing outcomes block promotion.",
  },
];

export const robotEvalMoatWorkflowSteps: RobotEvalMoatWorkflowStep[] = [
  {
    id: "choose_site",
    label: "Choose site",
    artifact: "site_card.json",
    boundary: "Representative packages show the workflow shape, not cleared supply.",
  },
  {
    id: "choose_task",
    label: "Choose task",
    artifact: "task_ontology_v1.json",
    boundary: "Canonical task IDs keep scoring comparable across sites.",
  },
  {
    id: "choose_scenario_family",
    label: "Choose scenario family",
    artifact: "scenario_family_library.json",
    boundary: "Generated variants stay review-scoped until evidence is attached.",
  },
  {
    id: "submit_policy_or_trace",
    label: "Submit policy or trace",
    artifact: "robot_team_test_submission_modalities.json",
    boundary: "Submitted refs are artifact references, not execution proof.",
  },
  {
    id: "inspect_eval_report",
    label: "Inspect eval report",
    artifact: "policy_eval_report.json",
    boundary: "Report metrics are advisory unless owner-system outcomes exist.",
  },
  {
    id: "decide_next_step",
    label: "Decide pilot, tune, or hold",
    artifact: "prediction_vs_actual_summary.json",
    boundary: "A decision is request-scoped and does not become a public guarantee.",
  },
];

export const robotEvalMoatModules: RobotEvalMoatModule[] = [
  {
    id: "rights_packet",
    label: "Rights packet and ledger",
    summary: "Use rights records to separate raw capture, derived environment, robot-eval, licensing, and blockers.",
  },
  {
    id: "task_ontology",
    label: "Canonical task ontology",
    summary: "Map site-specific work into stable task IDs before scenario generation or scoring.",
  },
  {
    id: "scenario_family_generator",
    label: "Scenario family generator",
    summary: "Expand one task into reviewable lighting, layout, occlusion, human, and object-state variants.",
  },
  {
    id: "scoring_runner",
    label: "Trace scoring runner",
    summary: "Score recorded action traces into an advisory policy eval report with blocked claim upgrades.",
  },
  {
    id: "prediction_actual",
    label: "Prediction-vs-actual loop",
    summary: "Compare predicted failure modes with observed outcomes when real outcome records are available.",
  },
];

export const robotEvalDecisionOptions = [
  {
    id: "pilot",
    label: "Pilot",
    criteria: "Open only when rights, safety, real outcomes, and owner approvals exist.",
  },
  {
    id: "tune",
    label: "Tune",
    criteria: "Use when trace metrics show failures that are fixable with policy or scenario changes.",
  },
  {
    id: "hold",
    label: "Hold",
    criteria: "Use when missing evidence, unsafe proximity, or rights blockers remain unresolved.",
  },
] as const;

const standardReport: RobotEvalMoatReportMetric[] = [
  {
    id: "success_rate",
    label: "Success rate",
    value: "0.00 advisory",
    status: "advisory",
    detail: "Recorded trace fixture can score local outcomes without passing the policy.",
  },
  {
    id: "cycle_time",
    label: "Cycle time",
    value: "18.25 s",
    status: "advisory",
    detail: "Measured from the supplied trace when timestamps are present.",
  },
  {
    id: "intervention_rate",
    label: "Intervention rate",
    value: "1 event",
    status: "advisory",
    detail: "Intervention events remain a tuning signal, not a deployment blocker by themselves.",
  },
  {
    id: "unsafe_proximity",
    label: "Unsafe proximity",
    value: "1 flag",
    status: "blocked",
    detail: "Safety flags block pilot promotion until owner-system proof clears them.",
  },
  {
    id: "prediction_actual_gap",
    label: "Predicted vs actual gap",
    value: "outcome missing",
    status: "blocked",
    detail: "Actual outcome records are required before scoring can support a claim upgrade.",
  },
];

export const representativeRobotEvalSites: RobotEvalMoatSite[] = [
  {
    id: "robot-eval-warehouse",
    catalogSiteWorldId: "sw-atl-01",
    environment: "warehouse",
    siteName: "Peachtree Parcel Exchange South",
    siteType: "Warehouse and parcel lane",
    locationLabel: "Logistics environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_required",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "warehouse-move-tote",
        label: "Move tote through lane",
        canonicalTaskId: "move_tote",
        successDefinition: "Tote reaches the target lane without contact or intervention.",
        requiredEvidence: ["recorded_action_trace", "video_frames", "actual_outcome_record"],
      },
      {
        id: "warehouse-cart-transfer",
        label: "Cart to conveyor transfer",
        canonicalTaskId: "cart_to_conveyor_transfer",
        successDefinition: "Parcel is inducted and the lane is reset.",
        requiredEvidence: ["action_trace", "timing_summary", "failure_labels"],
      },
    ],
    scenarioFamilies: [
      {
        id: "warehouse-blocked-path",
        label: "Blocked path recovery",
        variationIds: ["blocked_path", "cart_shifted", "occlusion"],
        generatedScenarioCount: 18,
        reviewStatus: "needs_human_review",
        sampleScenario: "A tote is shifted into the approach lane before the robot reaches the conveyor.",
      },
      {
        id: "warehouse-human-crossing",
        label: "Human crossing safety",
        variationIds: ["human_crossing", "forklift_nearby", "narrow_approach_angle"],
        generatedScenarioCount: 14,
        reviewStatus: "needs_human_review",
        sampleScenario: "A person crosses the lane as the robot begins the final approach.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
  {
    id: "robot-eval-factory",
    catalogSiteWorldId: "sw-phx-01",
    environment: "factory",
    siteName: "Sonoran Assembly Cart Bay",
    siteType: "Factory line-side station",
    locationLabel: "Manufacturing environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_required",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "factory-line-delivery",
        label: "Line-side delivery",
        canonicalTaskId: "line_side_delivery",
        successDefinition: "Cart arrives at the resupply station inside the allowed transfer window.",
        requiredEvidence: ["route_trace", "station_timing", "human_review"],
      },
      {
        id: "factory-fixture-transfer",
        label: "Fixture transfer",
        canonicalTaskId: "move_tote",
        successDefinition: "Part feed is placed in the fixture without forcing a recovery step.",
        requiredEvidence: ["force_trace", "action_trace", "failure_labels"],
      },
    ],
    scenarioFamilies: [
      {
        id: "factory-narrow-approach",
        label: "Narrow approach angle",
        variationIds: ["narrow_approach_angle", "cart_shifted", "object_rotation"],
        generatedScenarioCount: 16,
        reviewStatus: "needs_human_review",
        sampleScenario: "The cart begins offset from the fixture and a return path narrows during approach.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
  {
    id: "robot-eval-hospital",
    catalogSiteWorldId: "sw-den-01",
    environment: "hospital",
    siteName: "Cherry Creek Hospital Supply Annex",
    siteType: "Hospital supply corridor",
    locationLabel: "Healthcare environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_required",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "hospital-room-delivery",
        label: "Deliver cart to room",
        canonicalTaskId: "line_side_delivery",
        successDefinition: "Supply cart reaches the room and returns through the clear corridor.",
        requiredEvidence: ["route_video", "doorway_state", "actual_outcome_record"],
      },
      {
        id: "hospital-door-entry",
        label: "Open door and enter room",
        canonicalTaskId: "open_door_enter_room",
        successDefinition: "Door entry is completed without blocking staff movement.",
        requiredEvidence: ["door_state_trace", "human_crossing_labels", "safety_review"],
      },
    ],
    scenarioFamilies: [
      {
        id: "hospital-dim-corridor",
        label: "Dim corridor and cart shift",
        variationIds: ["lighting_variation", "human_crossing", "cart_shifted"],
        generatedScenarioCount: 12,
        reviewStatus: "needs_human_review",
        sampleScenario: "Lights are dimmed and the cart start position changes near a crossing corridor.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
  {
    id: "robot-eval-retail",
    catalogSiteWorldId: "sw-chi-01",
    environment: "retail",
    siteName: "Harborview Grocery Distribution Annex",
    siteType: "Retail backroom and shelf staging",
    locationLabel: "Retail environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_advisory",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "retail-shelf-inspection",
        label: "Inspect shelf staging",
        canonicalTaskId: "inspect_shelf",
        successDefinition: "Shelf target and tote state are identified without a wrong-object pick.",
        requiredEvidence: ["observation_frames", "barcode_state", "human_label"],
      },
      {
        id: "retail-pick-object",
        label: "Pick known object",
        canonicalTaskId: "pick_known_object",
        successDefinition: "Target object is picked and placed into the blue tote.",
        requiredEvidence: ["action_trace", "object_state", "success_labels"],
      },
    ],
    scenarioFamilies: [
      {
        id: "retail-object-confusion",
        label: "Object rotation and wrong item nearby",
        variationIds: ["object_rotation", "wrong_object_nearby", "missing_label"],
        generatedScenarioCount: 20,
        reviewStatus: "needs_human_review",
        sampleScenario: "A target case is rotated while a similar product sits beside the intended bin.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
  {
    id: "robot-eval-cold-chain",
    catalogSiteWorldId: "sw-den-02",
    environment: "cold_chain",
    siteName: "Front Range Cold Storage Pod",
    siteType: "Cold storage picking pod",
    locationLabel: "Cold chain environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_required",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "cold-chain-bin-transfer",
        label: "Pick chilled bin",
        canonicalTaskId: "pick_known_object",
        successDefinition: "Correct bin is moved without breaking route timing or temperature handling rules.",
        requiredEvidence: ["thermal_tags", "route_timing", "actual_outcome_record"],
      },
      {
        id: "cold-chain-airlock",
        label: "Airlock delay recovery",
        canonicalTaskId: "blocked_path_recovery",
        successDefinition: "Robot pauses and resumes without unsafe proximity after airlock delay.",
        requiredEvidence: ["event_log", "safety_flags", "recovery_labels"],
      },
    ],
    scenarioFamilies: [
      {
        id: "cold-chain-glare-occlusion",
        label: "Glare and occlusion",
        variationIds: ["glare", "occlusion", "blocked_path"],
        generatedScenarioCount: 15,
        reviewStatus: "needs_human_review",
        sampleScenario: "Condensation glare obscures the target bin during an airlock delay.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
  {
    id: "robot-eval-service",
    catalogSiteWorldId: "sw-mia-01",
    environment: "service",
    siteName: "Trinity Linen Operations Hub",
    siteType: "Service operations intake",
    locationLabel: "Service environment",
    packageStatus: "representative_package",
    rightsStatus: "rights_packet_required",
    taskOntologyVersion: "task_ontology_v1",
    tasks: [
      {
        id: "service-sort-load",
        label: "Sort intake bag",
        canonicalTaskId: "place_object_into_bin",
        successDefinition: "Returned load is sorted into the correct outbound tote without a drop.",
        requiredEvidence: ["pick_place_trace", "station_timing", "failure_tags"],
      },
      {
        id: "service-transfer-load",
        label: "Transfer load to outbound",
        canonicalTaskId: "cart_to_conveyor_transfer",
        successDefinition: "Load reaches outbound transfer without delayed handoff.",
        requiredEvidence: ["event_log", "handoff_timing", "human_review"],
      },
    ],
    scenarioFamilies: [
      {
        id: "service-crowded-intake",
        label: "Crowded intake and delayed outbound",
        variationIds: ["blocked_path", "human_crossing", "wrong_object_nearby"],
        generatedScenarioCount: 13,
        reviewStatus: "needs_human_review",
        sampleScenario: "The intake floor is crowded and the outbound tote is delayed.",
      },
    ],
    evalReport: standardReport,
    artifacts: coreArtifacts,
  },
];

export function getRobotEvalMoatSite(siteId: string): RobotEvalMoatSite {
  return (
    representativeRobotEvalSites.find((site) => site.id === siteId) ||
    representativeRobotEvalSites[0]
  );
}

export function getRobotEvalMoatTask(site: RobotEvalMoatSite, taskId: string): RobotEvalMoatTask {
  return site.tasks.find((task) => task.id === taskId) || site.tasks[0];
}

export function getRobotEvalMoatScenarioFamily(
  site: RobotEvalMoatSite,
  scenarioFamilyId: string,
): RobotEvalMoatScenarioFamily {
  return (
    site.scenarioFamilies.find((scenarioFamily) => scenarioFamily.id === scenarioFamilyId) ||
    site.scenarioFamilies[0]
  );
}
