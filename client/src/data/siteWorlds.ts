import type { DeploymentReadinessSummary } from "../types/inbound-request";
import type {
  RobotObservationCamera,
  RobotProfile,
  RuntimeManifestSummary,
  ScenarioCatalogEntry,
  StartStateCatalogEntry,
  TaskCatalogEntry,
} from "@/types/hostedSession";

export type SiteCategory =
  | "All"
  | "Retail"
  | "Logistics"
  | "Manufacturing"
  | "Service"
  | "Cold Chain"
  | "Healthcare";

export type ThumbnailKind =
  | "grocery"
  | "parcel"
  | "lineSide"
  | "laundry"
  | "coldChain"
  | "returns"
  | "microFulfillment"
  | "pharmacy"
  | "battery"
  | "airport"
  | "hospital"
  | "electronics";

export type SiteWorldPackageName = "Scene Package" | "Hosted Sessions";

export type SiteWorldPackage = {
  name: SiteWorldPackageName;
  summary: string;
  priceLabel: string;
  payerLabel: string;
  actionLabel: string;
  actionHref: string;
  deliverables: string[];
  emphasis?: "default" | "recommended";
};

export type SiteWorldCard = {
  id: string;
  siteCode: string;
  siteName: string;
  siteAddress: string;
  sceneId: string;
  captureId: string;
  siteSubmissionId: string;
  pipelinePrefix: string;
  category: Exclude<SiteCategory, "All">;
  industry: string;
  taskLane: string;
  tone: string;
  accent: string;
  thumbnailKind: ThumbnailKind;
  summary: string;
  bestFor: string;
  startStates: string[];
  runtime: string;
  defaultRuntimeBackend: string;
  availableRuntimeBackends: string[];
  sampleRobot: string;
  sampleRobotProfile: RobotProfile;
  sampleTask: string;
  samplePolicy: string;
  scenarioVariants: string[];
  exportArtifacts: string[];
  runtimeManifest: RuntimeManifestSummary;
  taskCatalog: TaskCatalogEntry[];
  scenarioCatalog: ScenarioCatalogEntry[];
  startStateCatalog: StartStateCatalogEntry[];
  robotProfiles: RobotProfile[];
  exportModes: string[];
  packages: [SiteWorldPackage, SiteWorldPackage];
  dataSource?: "static" | "pipeline";
  deploymentReadiness?: DeploymentReadinessSummary;
  presentationDemoReadiness?: {
    launchable: boolean;
    blockers: string[];
    presentationWorldManifestUri?: string | null;
  };
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  siteWorldSpecUri?: string | null;
  siteWorldRegistrationUri?: string | null;
  siteWorldHealthUri?: string | null;
  hostedSessionOverride?: {
    allowBlockedSiteWorld?: boolean;
    qualificationState?: "qualified_ready" | "qualified_risky" | "needs_refresh" | "not_ready_yet";
  };
};

type RawSiteWorldCard = Omit<
  SiteWorldCard,
  | "sampleRobotProfile"
  | "defaultRuntimeBackend"
  | "availableRuntimeBackends"
  | "runtimeManifest"
  | "taskCatalog"
  | "scenarioCatalog"
  | "startStateCatalog"
  | "robotProfiles"
  | "exportModes"
>;

type PackageConfig = {
  siteId: string;
  siteName: string;
  siteAddress: string;
  scenePrice: string;
  hostedRate: string;
  sampleTask: string;
  sampleRobot: string;
};

export const categoryFilters: SiteCategory[] = [
  "All",
  "Retail",
  "Logistics",
  "Manufacturing",
  "Service",
  "Cold Chain",
  "Healthcare",
];

function inferEmbodimentType(sampleRobot: string): RobotProfile["embodimentType"] {
  const normalized = sampleRobot.toLowerCase();
  if (normalized.includes("humanoid")) return "humanoid";
  if (normalized.includes("arm")) return "fixed_arm";
  if (normalized.includes("cart")) return "cart";
  if (normalized.includes("amr") || normalized.includes("mobile")) return "mobile_manipulator";
  if (normalized.includes("tug")) return "mobile_base";
  return "other";
}

function inferObservationCameras(sampleRobot: string, runtime: string): RobotObservationCamera[] {
  const normalized = `${sampleRobot} ${runtime}`.toLowerCase();
  const cameras: RobotObservationCamera[] = [];
  if (normalized.includes("head")) cameras.push({ id: "head_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("wrist")) cameras.push({ id: "wrist_rgb", role: "wrist", required: false, defaultEnabled: true });
  if (normalized.includes("overhead")) cameras.push({ id: "overhead_rgb", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("mast")) cameras.push({ id: "mast_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("stereo")) cameras.push({ id: "stereo_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("barcode")) cameras.push({ id: "barcode_stream", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("thermal")) cameras.push({ id: "thermal_state", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("map")) cameras.push({ id: "map_state", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("vision")) cameras.push({ id: "site_context_rgb", role: "context", required: false, defaultEnabled: true });
  return cameras.length > 0
    ? cameras
    : [{ id: "primary_rgb", role: "head", required: true, defaultEnabled: true }];
}

function inferActionSpaceSummary(sampleRobot: string) {
  const normalized = sampleRobot.toLowerCase();
  if (normalized.includes("arm")) return "End-effector pose deltas plus gripper open/close.";
  if (normalized.includes("humanoid")) return "Base locomotion, torso reach, and hand state transitions.";
  if (normalized.includes("cart") || normalized.includes("tug")) {
    return "Base motion, docking alignment, and handoff state changes.";
  }
  return "Bounded robot action vector for site-conditioned rollout control.";
}

function inferGripperSemantics(sampleRobot: string) {
  const normalized = sampleRobot.toLowerCase();
  if (normalized.includes("arm") || normalized.includes("picker") || normalized.includes("assistant")) {
    return "Binary grasp / release state on the active manipulator.";
  }
  if (normalized.includes("humanoid")) {
    return "Task-level hand closure and release semantics.";
  }
  return "No explicit gripper profile provided.";
}

function inferBaseSemantics(sampleRobot: string) {
  const normalized = sampleRobot.toLowerCase();
  if (normalized.includes("cart") || normalized.includes("tug") || normalized.includes("amr") || normalized.includes("mobile")) {
    return "Planar base translation with heading control for lane and aisle navigation.";
  }
  if (normalized.includes("humanoid")) {
    return "Footstep and body-pose control for approach and handoff alignment.";
  }
  return "Stationary or task-local base semantics.";
}

function buildSampleRobotProfile(sampleRobot: string, runtime: string): RobotProfile {
  const embodimentType = inferEmbodimentType(sampleRobot);
  return {
    id: `${embodimentType}_sample`,
    displayName: sampleRobot,
    embodimentType,
    observationCameras: inferObservationCameras(sampleRobot, runtime),
    actionSpace: {
      name: embodimentType === "fixed_arm" ? "joint_delta_gripper" : "ee_delta_pose_gripper",
      dim: 7,
      labels: ["x", "y", "z", "roll", "pitch", "yaw", "gripper"],
    },
    actionSpaceSummary: inferActionSpaceSummary(sampleRobot),
    gripperSemantics: inferGripperSemantics(sampleRobot),
    baseSemantics: inferBaseSemantics(sampleRobot),
    urdfRef: null,
    usdRef: null,
    allowedPolicyAdapters: ["openvla_oft", "pi05", "dreamzero"],
    defaultPolicyAdapter: "openvla_oft",
  };
}

function withDerivedSessionDefaults(site: RawSiteWorldCard): SiteWorldCard {
  const sampleRobotProfile = buildSampleRobotProfile(site.sampleRobot, site.runtime);
  const taskCatalog: TaskCatalogEntry[] = [
    {
      id: `${site.id}-task-1`,
      taskId: `${site.id}-task-1`,
      taskText: site.sampleTask,
      taskCategory: "generic",
    },
  ];
  const scenarioCatalog: ScenarioCatalogEntry[] = site.scenarioVariants.map((variant, index) => ({
    id: `${site.id}-scenario-${index + 1}`,
    name: variant,
    source: "static",
  }));
  const startStateCatalog: StartStateCatalogEntry[] = site.startStates.map((state, index) => ({
    id: `${site.id}-start-${index + 1}`,
    name: state,
    taskId: taskCatalog[0].id,
    source: "static",
  }));
  const robotProfiles = [sampleRobotProfile];
  const exportModes = ["raw_bundle", "rlds_dataset"];
  return {
    ...site,
    defaultRuntimeBackend: "neoverse",
    availableRuntimeBackends: ["neoverse", "gen3c"],
    sampleRobotProfile,
    runtimeManifest: {
      defaultBackend: "neoverse",
      launchableBackends: ["neoverse", "gen3c"],
      exportModes,
      supportsStepRollout: true,
      supportsBatchRollout: true,
      supportsCameraViews: true,
    },
    taskCatalog,
    scenarioCatalog,
    startStateCatalog,
    robotProfiles,
    exportModes,
  };
}

function buildContactHref(
  interest: "evaluation-package" | "data-licensing",
  config: Pick<PackageConfig, "siteName" | "siteAddress" | "sampleTask" | "sampleRobot">,
) {
  const params = new URLSearchParams({
    interest,
    buyerType: "robot_team",
    source: "site-worlds",
    siteName: config.siteName,
    siteLocation: config.siteAddress,
    taskStatement: config.sampleTask,
    targetRobotTeam: config.sampleRobot,
  });

  return `/contact?${params.toString()}`;
}

function buildPackages(config: PackageConfig): [SiteWorldPackage, SiteWorldPackage] {
  return [
    {
      name: "Scene Package",
      summary: "License the site-specific world-model package for this exact workflow area.",
      priceLabel: config.scenePrice,
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "Request scene package",
      actionHref: buildContactHref("data-licensing", config),
      deliverables: [
        "Walkthrough video and camera poses",
        "Site metadata and workflow notes",
        "Geometry / depth if available",
        "License for internal review or integration",
      ],
      emphasis: "recommended",
    },
    {
      name: "Hosted Sessions",
      summary: "Stream the site-specific world model in a Blueprint-managed session.",
      priceLabel: config.hostedRate,
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "Start hosted session",
      actionHref: `/site-worlds/${config.siteId}/start`,
      deliverables: [
        "Streamed world-model runtime",
        "Reset, rerun, and scenario changes",
        "Rollout exports and RLDS dataset",
        "Policy comparison on the same site",
      ],
    },
  ];
}

const rawSiteWorldCards: RawSiteWorldCard[] = [
  {
    id: "sw-chi-01",
    siteCode: "SW-CHI-01",
    siteName: "Harborview Grocery Distribution Annex",
    siteAddress: "1847 W Fulton St, Chicago, IL 60612",
    sceneId: "scene-harborview-grocery-annex",
    captureId: "cap-harborview-grocery-annex-v1",
    siteSubmissionId: "site-sub-harborview-grocery-annex",
    pipelinePrefix: "scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline",
    category: "Retail",
    industry: "Retail backroom",
    taskLane: "Case pick and shelf replenishment",
    tone: "from-emerald-100 via-white to-emerald-50",
    accent: "#10b981",
    thumbnailKind: "grocery",
    summary:
      "A backroom layout with dock access, aisle replenishment paths, and a short handoff into shelf staging.",
    bestFor: "Shelf replenishment validation before a rollout.",
    startStates: ["Dock-side tote stack", "Open aisle replenishment lane", "Shelf staging handoff"],
    runtime: "Vision + wrist cams",
    sampleRobot: "Unitree G1 with head cam and wrist cam",
    sampleTask: "Walk to shelf staging and pick the blue tote",
    samplePolicy: "Checkpoint 148000",
    scenarioVariants: ["Normal lighting", "Dim backroom lighting", "Partial aisle clutter"],
    exportArtifacts: ["Rollout video", "Action trace", "Success labels", "Episode summary"],
    packages: buildPackages({
      siteId: "sw-chi-01",
      siteName: "Harborview Grocery Distribution Annex",
      siteAddress: "1847 W Fulton St, Chicago, IL 60612",
      scenePrice: "$2,400",
      hostedRate: "$18 / session-hour",
      sampleTask: "Walk to shelf staging and pick the blue tote",
      sampleRobot: "Unitree G1 with head cam and wrist cam",
    }),
  },
  {
    id: "sw-atl-02",
    siteCode: "SW-ATL-02",
    siteName: "Peachtree Parcel Exchange South",
    siteAddress: "2550 Lakewood Ave SW, Atlanta, GA 30315",
    sceneId: "scene-peachtree-parcel-south",
    captureId: "cap-peachtree-parcel-south-v1",
    siteSubmissionId: "site-sub-peachtree-parcel-south",
    pipelinePrefix: "scenes/scene-peachtree-parcel-south/captures/cap-peachtree-parcel-south-v1/pipeline",
    category: "Logistics",
    industry: "Parcel logistics",
    taskLane: "Induct, handoff, and tote reset",
    tone: "from-sky-100 via-white to-sky-50",
    accent: "#0ea5e9",
    thumbnailKind: "parcel",
    summary: "A parcel feed lane with induct points, diverter handoffs, and tote reset positions.",
    bestFor: "Fast lane resets and handoff checks.",
    startStates: ["Single-box induct", "Mixed parcel wave", "Tote clear and reset"],
    runtime: "Vision + overhead",
    sampleRobot: "Mobile manipulator with mast cam and overhead assist view",
    sampleTask: "Induct a parcel, clear the lane, and reset the tote position",
    samplePolicy: "Lane policy v9",
    scenarioVariants: ["Single parcel", "Mixed parcel wave", "Late-lane congestion"],
    exportArtifacts: ["Per-step events", "Rollout video", "Lane timing summary", "Failure clips"],
    packages: buildPackages({
      siteId: "sw-atl-02",
      siteName: "Peachtree Parcel Exchange South",
      siteAddress: "2550 Lakewood Ave SW, Atlanta, GA 30315",
      scenePrice: "$2,700",
      hostedRate: "$22 / session-hour",
      sampleTask: "Induct a parcel, clear the lane, and reset the tote position",
      sampleRobot: "Mobile manipulator with mast cam and overhead assist view",
    }),
  },
  {
    id: "sw-phx-03",
    siteCode: "SW-PHX-03",
    siteName: "Sonoran Assembly Cart Bay",
    siteAddress: "4025 E University Dr, Phoenix, AZ 85034",
    sceneId: "scene-sonoran-assembly-cart-bay",
    captureId: "cap-sonoran-assembly-cart-bay-v1",
    siteSubmissionId: "site-sub-sonoran-assembly-cart-bay",
    pipelinePrefix: "scenes/scene-sonoran-assembly-cart-bay/captures/cap-sonoran-assembly-cart-bay-v1/pipeline",
    category: "Manufacturing",
    industry: "Light manufacturing",
    taskLane: "Cart fetch and station handoff",
    tone: "from-amber-100 via-white to-orange-50",
    accent: "#f59e0b",
    thumbnailKind: "lineSide",
    summary:
      "A line-side lane with cart staging, station delivery, and return clearance in a tight envelope.",
    bestFor: "Repeated line-side resupply loops.",
    startStates: ["Cart at inbound lane", "Station requesting resupply", "Clear return path"],
    runtime: "Vision + proprio",
    sampleRobot: "Autonomous cart tug with front stereo pair",
    sampleTask: "Fetch the staged cart and deliver it to the resupply station",
    samplePolicy: "Resupply checkpoint B",
    scenarioVariants: ["Clear lane", "Narrow return path", "Busy station handoff"],
    exportArtifacts: ["Sensor trace", "Rendered views", "Task outcomes", "Episode summary"],
    packages: buildPackages({
      siteId: "sw-phx-03",
      siteName: "Sonoran Assembly Cart Bay",
      siteAddress: "4025 E University Dr, Phoenix, AZ 85034",
      scenePrice: "$3,100",
      hostedRate: "$26 / session-hour",
      sampleTask: "Fetch the staged cart and deliver it to the resupply station",
      sampleRobot: "Autonomous cart tug with front stereo pair",
    }),
  },
  {
    id: "sw-dal-04",
    siteCode: "SW-DAL-04",
    siteName: "Trinity Linen Operations Hub",
    siteAddress: "1410 Irving Blvd, Dallas, TX 75207",
    sceneId: "scene-trinity-linen-ops-hub",
    captureId: "cap-trinity-linen-ops-hub-v1",
    siteSubmissionId: "site-sub-trinity-linen-ops-hub",
    pipelinePrefix: "scenes/scene-trinity-linen-ops-hub/captures/cap-trinity-linen-ops-hub-v1/pipeline",
    category: "Service",
    industry: "Service operations",
    taskLane: "Bag lift, sort, and station transfer",
    tone: "from-violet-100 via-white to-fuchsia-50",
    accent: "#8b5cf6",
    thumbnailKind: "laundry",
    summary: "A repeatable laundry floor with intake bags, sort tables, and fold-outbound handoffs.",
    bestFor: "Narrow service workflows with steady repetition.",
    startStates: ["Bag at intake", "Active sort table", "Outbound transfer ready"],
    runtime: "Vision + top-down",
    sampleRobot: "Humanoid with head cam and top-down supervisor view",
    sampleTask: "Lift the intake bag, sort it, and transfer the load to outbound",
    samplePolicy: "Laundry sort v12",
    scenarioVariants: ["Normal floor", "Crowded intake", "Delayed outbound handoff"],
    exportArtifacts: ["Rollout video", "Pick and place trace", "Station timing", "Failure tags"],
    packages: buildPackages({
      siteId: "sw-dal-04",
      siteName: "Trinity Linen Operations Hub",
      siteAddress: "1410 Irving Blvd, Dallas, TX 75207",
      scenePrice: "$2,100",
      hostedRate: "$16 / session-hour",
      sampleTask: "Lift the intake bag, sort it, and transfer the load to outbound",
      sampleRobot: "Humanoid with head cam and top-down supervisor view",
    }),
  },
  {
    id: "sw-col-05",
    siteCode: "SW-COL-05",
    siteName: "Front Range Cold Storage Pod",
    siteAddress: "1911 Groveport Rd, Columbus, OH 43207",
    sceneId: "scene-front-range-cold-storage-pod",
    captureId: "cap-front-range-cold-storage-pod-v1",
    siteSubmissionId: "site-sub-front-range-cold-storage-pod",
    pipelinePrefix: "scenes/scene-front-range-cold-storage-pod/captures/cap-front-range-cold-storage-pod-v1/pipeline",
    category: "Cold Chain",
    industry: "Food distribution",
    taskLane: "Bin pick under temperature constraints",
    tone: "from-cyan-100 via-white to-cyan-50",
    accent: "#06b6d4",
    thumbnailKind: "coldChain",
    summary:
      "A chilled pick room with an airlock handoff, insulated staging, and short route lengths.",
    bestFor: "Temperature-sensitive pick flows.",
    startStates: ["Airlock entry", "Cold pick bay", "Outbound insulated bin"],
    runtime: "Vision + thermal tags",
    sampleRobot: "Cold-room picker with arm camera and thermal state feed",
    sampleTask: "Pick the target bin and hand it off without breaking the route timing",
    samplePolicy: "Cold-chain policy 3.4",
    scenarioVariants: ["Normal chill cycle", "Airlock delay", "Reordered outbound bins"],
    exportArtifacts: ["Thermal tags", "Episode log", "Video frames", "Timing metrics"],
    packages: buildPackages({
      siteId: "sw-col-05",
      siteName: "Front Range Cold Storage Pod",
      siteAddress: "1911 Groveport Rd, Columbus, OH 43207",
      scenePrice: "$3,200",
      hostedRate: "$24 / session-hour",
      sampleTask: "Pick the target bin and hand it off without breaking the route timing",
      sampleRobot: "Cold-room picker with arm camera and thermal state feed",
    }),
  },
  {
    id: "sw-jer-06",
    siteCode: "SW-JER-06",
    siteName: "Meadowlands Returns Processing Suite",
    siteAddress: "500 Duncan Ave, Jersey City, NJ 07306",
    sceneId: "scene-meadowlands-returns-suite",
    captureId: "cap-meadowlands-returns-suite-v1",
    siteSubmissionId: "site-sub-meadowlands-returns-suite",
    pipelinePrefix: "scenes/scene-meadowlands-returns-suite/captures/cap-meadowlands-returns-suite-v1/pipeline",
    category: "Service",
    industry: "E-commerce returns",
    taskLane: "Item triage and tote routing",
    tone: "from-rose-100 via-white to-rose-50",
    accent: "#fb7185",
    thumbnailKind: "returns",
    summary:
      "A returns lane with intake, triage, and routing tables for fast judgment and tote movement.",
    bestFor: "Quick visual judgment and routing loops.",
    startStates: ["Single-item intake", "Mixed return batch", "Outbound route handoff"],
    runtime: "Vision + table cams",
    sampleRobot: "Stationary arm with table cams and barcode reader",
    sampleTask: "Triage the returned item and route it to the correct tote",
    samplePolicy: "Returns triage checkpoint 27",
    scenarioVariants: ["Single return", "Mixed batch", "Late route change"],
    exportArtifacts: ["Event log", "Video segment", "Routing outcome", "Error cases"],
    packages: buildPackages({
      siteId: "sw-jer-06",
      siteName: "Meadowlands Returns Processing Suite",
      siteAddress: "500 Duncan Ave, Jersey City, NJ 07306",
      scenePrice: "$2,300",
      hostedRate: "$19 / session-hour",
      sampleTask: "Triage the returned item and route it to the correct tote",
      sampleRobot: "Stationary arm with table cams and barcode reader",
    }),
  },
  {
    id: "sw-sjc-07",
    siteCode: "SW-SJC-07",
    siteName: "Bayview Micro-Fulfillment Center",
    siteAddress: "1380 Oakland Rd, San Jose, CA 95112",
    sceneId: "scene-bayview-micro-fulfillment-center",
    captureId: "cap-bayview-micro-fulfillment-center-v1",
    siteSubmissionId: "site-sub-bayview-micro-fulfillment-center",
    pipelinePrefix: "scenes/scene-bayview-micro-fulfillment-center/captures/cap-bayview-micro-fulfillment-center-v1/pipeline",
    category: "Retail",
    industry: "Micro-fulfillment",
    taskLane: "Aisle pick and tote transfer",
    tone: "from-lime-100 via-white to-lime-50",
    accent: "#65a30d",
    thumbnailKind: "microFulfillment",
    summary: "A dense micro-fulfillment layout with short aisle hops and a clean pack-side handoff.",
    bestFor: "Short-hop fulfillment loops.",
    startStates: ["Single order pick", "Multi-order batch", "Pack station transfer"],
    runtime: "Vision + map state",
    sampleRobot: "AMR with shelf-facing camera and tote sensor",
    sampleTask: "Pick the order items and transfer the tote to pack",
    samplePolicy: "Grid pick v5",
    scenarioVariants: ["Single order", "Multi-order wave", "Blocked pack handoff"],
    exportArtifacts: ["Episode events", "Rendered video", "Aisle path summary", "Success rate"],
    packages: buildPackages({
      siteId: "sw-sjc-07",
      siteName: "Bayview Micro-Fulfillment Center",
      siteAddress: "1380 Oakland Rd, San Jose, CA 95112",
      scenePrice: "$2,800",
      hostedRate: "$21 / session-hour",
      sampleTask: "Pick the order items and transfer the tote to pack",
      sampleRobot: "AMR with shelf-facing camera and tote sensor",
    }),
  },
  {
    id: "sw-bos-08",
    siteCode: "SW-BOS-08",
    siteName: "Commonwealth Pharmacy Refill Center",
    siteAddress: "71 Southampton St, Boston, MA 02118",
    sceneId: "scene-commonwealth-pharmacy-refill-center",
    captureId: "cap-commonwealth-pharmacy-refill-center-v1",
    siteSubmissionId: "site-sub-commonwealth-pharmacy-refill-center",
    pipelinePrefix: "scenes/scene-commonwealth-pharmacy-refill-center/captures/cap-commonwealth-pharmacy-refill-center-v1/pipeline",
    category: "Healthcare",
    industry: "Pharmacy ops",
    taskLane: "Pick, verify, and bin refill transfer",
    tone: "from-indigo-100 via-white to-indigo-50",
    accent: "#6366f1",
    thumbnailKind: "pharmacy",
    summary:
      "A pharmacy refill lane with shelf picks, verification, and secure bin handoff under audit constraints.",
    bestFor: "Structured, auditable refill workflows.",
    startStates: ["Shelf refill pick", "Barcode verify", "Secure bin transfer"],
    runtime: "Vision + barcode state",
    sampleRobot: "Dual-arm pharmacy assistant with wrist cam and barcode state",
    sampleTask: "Pick the refill item, verify it, and load the secure bin",
    samplePolicy: "Pharmacy refill policy 11",
    scenarioVariants: ["Standard refill", "Barcode read failure", "Secure bin almost full"],
    exportArtifacts: ["Audit log", "Barcode state", "Episode video", "Verifier output"],
    packages: buildPackages({
      siteId: "sw-bos-08",
      siteName: "Commonwealth Pharmacy Refill Center",
      siteAddress: "71 Southampton St, Boston, MA 02118",
      scenePrice: "$2,900",
      hostedRate: "$23 / session-hour",
      sampleTask: "Pick the refill item, verify it, and load the secure bin",
      sampleRobot: "Dual-arm pharmacy assistant with wrist cam and barcode state",
    }),
  },
  {
    id: "sw-det-09",
    siteCode: "SW-DET-09",
    siteName: "Motor City Battery Staging Cell",
    siteAddress: "7440 Lynch Rd, Detroit, MI 48234",
    sceneId: "scene-motor-city-battery-staging-cell",
    captureId: "cap-motor-city-battery-staging-cell-v1",
    siteSubmissionId: "site-sub-motor-city-battery-staging-cell",
    pipelinePrefix: "scenes/scene-motor-city-battery-staging-cell/captures/cap-motor-city-battery-staging-cell-v1/pipeline",
    category: "Manufacturing",
    industry: "Battery assembly",
    taskLane: "Part feed and fixture handoff",
    tone: "from-yellow-100 via-white to-yellow-50",
    accent: "#eab308",
    thumbnailKind: "battery",
    summary:
      "A subassembly cell with parts feed, fixture positioning, and tightly bounded handoff stations.",
    bestFor: "Structured assembly handoffs.",
    startStates: ["Parts feed active", "Fixture aligned", "Buffer handoff ready"],
    runtime: "Vision + force traces",
    sampleRobot: "Assembly arm with force trace stream and wrist camera",
    sampleTask: "Move the part feed into the fixture and complete the handoff",
    samplePolicy: "Subassembly checkpoint 402",
    scenarioVariants: ["Nominal fixture", "Offset fixture", "Late buffer arrival"],
    exportArtifacts: ["Force trace", "Episode video", "Task outcome labels", "Failure review"],
    packages: buildPackages({
      siteId: "sw-det-09",
      siteName: "Motor City Battery Staging Cell",
      siteAddress: "7440 Lynch Rd, Detroit, MI 48234",
      scenePrice: "$3,400",
      hostedRate: "$29 / session-hour",
      sampleTask: "Move the part feed into the fixture and complete the handoff",
      sampleRobot: "Assembly arm with force trace stream and wrist camera",
    }),
  },
  {
    id: "sw-ewr-10",
    siteCode: "SW-EWR-10",
    siteName: "Newark Terminal B Baggage Feed",
    siteAddress: "3 Brewster Rd, Newark, NJ 07114",
    sceneId: "scene-newark-terminal-b-baggage-feed",
    captureId: "cap-newark-terminal-b-baggage-feed-v1",
    siteSubmissionId: "site-sub-newark-terminal-b-baggage-feed",
    pipelinePrefix: "scenes/scene-newark-terminal-b-baggage-feed/captures/cap-newark-terminal-b-baggage-feed-v1/pipeline",
    category: "Logistics",
    industry: "Airport handling",
    taskLane: "Bag feed, scan, and lane clear",
    tone: "from-blue-100 via-white to-sky-50",
    accent: "#3b82f6",
    thumbnailKind: "airport",
    summary: "A baggage feed layout with scan points, belt handoff logic, and lane-clear cycles.",
    bestFor: "Scan-to-route handling loops.",
    startStates: ["Single bag scan", "Mixed baggage wave", "Lane recovery pass"],
    runtime: "Vision + scan events",
    sampleRobot: "Bag-handling arm with feed camera and scan event stream",
    sampleTask: "Scan the bag, route it correctly, and clear the lane",
    samplePolicy: "Baggage feed v6",
    scenarioVariants: ["Single bag", "Mixed baggage wave", "Lane recovery"],
    exportArtifacts: ["Scan events", "Rendered clip", "Per-lane timing", "Failure cases"],
    packages: buildPackages({
      siteId: "sw-ewr-10",
      siteName: "Newark Terminal B Baggage Feed",
      siteAddress: "3 Brewster Rd, Newark, NJ 07114",
      scenePrice: "$3,000",
      hostedRate: "$25 / session-hour",
      sampleTask: "Scan the bag, route it correctly, and clear the lane",
      sampleRobot: "Bag-handling arm with feed camera and scan event stream",
    }),
  },
  {
    id: "sw-den-11",
    siteCode: "SW-DEN-11",
    siteName: "Cherry Creek Hospital Supply Annex",
    siteAddress: "950 Josephine St, Denver, CO 80206",
    sceneId: "scene-cherry-creek-hospital-supply-annex",
    captureId: "cap-cherry-creek-hospital-supply-annex-v1",
    siteSubmissionId: "site-sub-cherry-creek-hospital-supply-annex",
    pipelinePrefix: "scenes/scene-cherry-creek-hospital-supply-annex/captures/cap-cherry-creek-hospital-supply-annex-v1/pipeline",
    category: "Healthcare",
    industry: "Hospital supply",
    taskLane: "Restock, cart load, and room return",
    tone: "from-teal-100 via-white to-teal-50",
    accent: "#14b8a6",
    thumbnailKind: "hospital",
    summary: "A supply room flow with cart loading, corridor return, and room restock points.",
    bestFor: "Steady restock and return loops.",
    startStates: ["Cart load", "Room-side handoff", "Return path clear"],
    runtime: "Vision + map state",
    sampleRobot: "Hospital cart robot with head cam and map state feed",
    sampleTask: "Load the cart, deliver to the room, and return through the clear corridor",
    samplePolicy: "Supply restock checkpoint 88",
    scenarioVariants: ["Normal route", "Dim corridor lighting", "Changed cart position"],
    exportArtifacts: ["Episode log", "Route video", "Restock metrics", "Failure clips"],
    packages: buildPackages({
      siteId: "sw-den-11",
      siteName: "Cherry Creek Hospital Supply Annex",
      siteAddress: "950 Josephine St, Denver, CO 80206",
      scenePrice: "$2,500",
      hostedRate: "$20 / session-hour",
      sampleTask: "Load the cart, deliver to the room, and return through the clear corridor",
      sampleRobot: "Hospital cart robot with head cam and map state feed",
    }),
  },
  {
    id: "sw-sea-12",
    siteCode: "SW-SEA-12",
    siteName: "Soundside Electronics Rework Lab",
    siteAddress: "2211 4th Ave S, Seattle, WA 98134",
    sceneId: "scene-soundside-electronics-rework-lab",
    captureId: "cap-soundside-electronics-rework-lab-v1",
    siteSubmissionId: "site-sub-soundside-electronics-rework-lab",
    pipelinePrefix: "scenes/scene-soundside-electronics-rework-lab/captures/cap-soundside-electronics-rework-lab-v1/pipeline",
    category: "Manufacturing",
    industry: "Electronics repair",
    taskLane: "Tray fetch and bench handoff",
    tone: "from-pink-100 via-white to-pink-50",
    accent: "#ec4899",
    thumbnailKind: "electronics",
    summary:
      "A rework bench cell with tray fetch, bench-side part handoff, and test station transitions.",
    bestFor: "Short-horizon bench-side handoffs.",
    startStates: ["Tray fetch", "Bench handoff", "Test queue"],
    runtime: "Vision + wrist cams",
    sampleRobot: "Bench-side arm with wrist cams and tray state sensor",
    sampleTask: "Fetch the tray and hand the part to the rework bench",
    samplePolicy: "Bench handoff policy R3",
    scenarioVariants: ["Nominal tray", "Shifted tray position", "Busy test queue"],
    exportArtifacts: ["Wrist camera feed", "Episode summary", "Handoff result", "Failure notes"],
    packages: buildPackages({
      siteId: "sw-sea-12",
      siteName: "Soundside Electronics Rework Lab",
      siteAddress: "2211 4th Ave S, Seattle, WA 98134",
      scenePrice: "$3,000",
      hostedRate: "$27 / session-hour",
      sampleTask: "Fetch the tray and hand the part to the rework bench",
      sampleRobot: "Bench-side arm with wrist cams and tray state sensor",
    }),
  },
];

export const siteWorldCards: SiteWorldCard[] = rawSiteWorldCards.map(withDerivedSessionDefaults);

siteWorldCards.push({
  id: "siteworld-f5fd54898cfb",
  siteCode: "SW-DEMO-01",
  siteName: "Media Room Demo Walkthrough",
  siteAddress: "Blueprint hosted runtime demo",
  sceneId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
  captureId: "6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
  siteSubmissionId: "9483414B-8776-4F68-AC80-D3B3BA774A90:6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
  pipelinePrefix:
    "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline",
  category: "Service",
  industry: "Demo walkthrough",
  taskLane: "Media room walkthrough",
  tone: "from-slate-100 via-white to-cyan-50",
  accent: "#0f766e",
  thumbnailKind: "electronics",
  summary:
    "A hard-wired demo of the already-built site-world and production NeoVerse runtime path for the March 13, 2026 walkthrough.",
  bestFor: "Customer-facing runtime-only review of a proven world model.",
  startStates: ["default_start_state"],
  runtime: "NeoVerse production runtime",
  defaultRuntimeBackend: "neoverse",
  availableRuntimeBackends: ["neoverse"],
  sampleRobot: "Mobile manipulator with head and wrist cameras",
  sampleRobotProfile: {
    id: "mobile_manipulator_rgb_v1",
    displayName: "Mobile manipulator",
    embodimentType: "mobile_manipulator",
    observationCameras: [
      { id: "head_rgb", role: "head", required: true, defaultEnabled: true },
      { id: "wrist_rgb", role: "wrist", required: false, defaultEnabled: true },
      { id: "site_context_rgb", role: "context", required: false, defaultEnabled: true },
    ],
    actionSpace: {
      name: "ee_delta_pose_gripper",
      dim: 7,
      labels: ["base_x", "base_y", "base_yaw", "ee_x", "ee_y", "ee_z", "gripper"],
    },
    actionSpaceSummary: "Bounded robot action vector for hosted rollout execution.",
    gripperSemantics: "Binary grasp / release state on the active manipulator.",
    baseSemantics: "Planar base translation with heading control for site navigation.",
    urdfRef: null,
    usdRef: null,
    allowedPolicyAdapters: ["openvla_oft", "pi05", "dreamzero"],
    defaultPolicyAdapter: "openvla_oft",
  },
  sampleTask: "Media room",
  samplePolicy: "Blueprint demo runtime",
  scenarioVariants: ["default", "counterfactual_lighting", "counterfactual_clutter"],
  exportArtifacts: ["Observation frames", "Rollout video", "Raw bundle", "RLDS dataset"],
  runtimeManifest: {
    defaultBackend: "neoverse",
    runtimeBaseUrl: "http://146.115.17.157:45457",
    websocketBaseUrl: "ws://146.115.17.157:45457",
    supportedCameras: ["head_rgb", "wrist_rgb", "site_context_rgb"],
    launchableBackends: ["neoverse"],
    exportModes: ["raw_bundle", "rlds_dataset"],
    supportsStepRollout: true,
    supportsBatchRollout: true,
    supportsCameraViews: true,
    supportsStream: false,
    healthStatus: "healthy",
    launchable: true,
  },
  taskCatalog: [
    {
      id: "9483414B-8776-4F68-AC80-D3B3BA774A90",
      taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
      taskText: "Media room",
      taskCategory: "generic",
    },
  ],
  scenarioCatalog: [
    { id: "scenario_default", name: "default", source: "site_world_runtime" },
    { id: "scenario_counterfactual_lighting", name: "counterfactual_lighting", source: "site_world_runtime" },
    { id: "scenario_counterfactual_clutter", name: "counterfactual_clutter", source: "site_world_runtime" },
  ],
  startStateCatalog: [
    {
      id: "start_default_start_state",
      name: "default_start_state",
      taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
      source: "task_run_manifest",
    },
  ],
  robotProfiles: [
    {
      id: "mobile_manipulator_rgb_v1",
      displayName: "Mobile manipulator",
      embodimentType: "mobile_manipulator",
      observationCameras: [
        { id: "head_rgb", role: "head", required: true, defaultEnabled: true },
        { id: "wrist_rgb", role: "wrist", required: false, defaultEnabled: true },
        { id: "site_context_rgb", role: "context", required: false, defaultEnabled: true },
      ],
      actionSpace: {
        name: "ee_delta_pose_gripper",
        dim: 7,
        labels: ["base_x", "base_y", "base_yaw", "ee_x", "ee_y", "ee_z", "gripper"],
      },
      actionSpaceSummary: "Bounded robot action vector for hosted rollout execution.",
      gripperSemantics: "Binary grasp / release state on the active manipulator.",
      baseSemantics: "Planar base translation with heading control for site navigation.",
      urdfRef: null,
      usdRef: null,
      allowedPolicyAdapters: ["openvla_oft", "pi05", "dreamzero"],
      defaultPolicyAdapter: "openvla_oft",
    },
  ],
  exportModes: ["raw_bundle", "rlds_dataset"],
  packages: buildPackages({
    siteId: "siteworld-f5fd54898cfb",
    siteName: "Media Room Demo Walkthrough",
    siteAddress: "Blueprint hosted runtime demo",
    scenePrice: "$0",
    hostedRate: "Demo runtime",
    sampleTask: "Media room",
    sampleRobot: "Mobile manipulator with head and wrist cameras",
  }),
  dataSource: "pipeline",
  deploymentReadiness: {
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    benchmark_coverage_status: "ready",
    benchmark_task_count: 1,
    export_readiness_status: "ready",
    recapture_status: "unchanged",
    recapture_required: false,
    freshness_date: "2026-03-13T17:58:27.041656+00:00",
    missing_evidence: [],
    exports_available: ["raw_bundle", "rlds_dataset"],
    task_categories: ["generic"],
    runtime_label: "NeoVerse production runtime",
  },
  presentationDemoReadiness: {
    launchable: false,
    blockers: ["Use the runtime-only workspace for this walkthrough demo."],
    presentationWorldManifestUri:
      "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/presentation_world/presentation_world_manifest.json",
  },
  sceneMemoryManifestUri:
    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/scene_memory_manifest.json",
  conditioningBundleUri:
    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/conditioning_bundle.json",
  siteWorldSpecUri:
    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_spec.json",
  siteWorldRegistrationUri:
    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_registration.json",
  siteWorldHealthUri:
    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_health.json",
  hostedSessionOverride: {
    allowBlockedSiteWorld: true,
    qualificationState: "qualified_ready",
  },
});

export function getSiteWorldById(id: string) {
  return siteWorldCards.find((site) => site.id === id) ?? null;
}
