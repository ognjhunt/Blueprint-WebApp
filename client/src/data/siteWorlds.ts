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
  sampleRobot: string;
  sampleTask: string;
  samplePolicy: string;
  scenarioVariants: string[];
  exportArtifacts: string[];
  packages: [SiteWorldPackage, SiteWorldPackage];
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

function buildPackages(
  siteId: string,
  scenePrice: string,
  hostedRate: string,
): [SiteWorldPackage, SiteWorldPackage] {
  return [
    {
      name: "Scene Package",
      summary: "License the site asset package for this exact workflow area.",
      priceLabel: scenePrice,
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "See package",
      actionHref: `/site-worlds/${siteId}#scene-package`,
      deliverables: [
        "Walkthrough video",
        "Camera poses and site metadata",
        "Geometry / depth if available",
        "License terms",
      ],
      emphasis: "recommended",
    },
    {
      name: "Hosted Sessions",
      summary: "Use Blueprint-managed evaluation sessions built from this site.",
      priceLabel: hostedRate,
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "See hosted eval flow",
      actionHref: `/site-worlds/${siteId}#hosted-sessions`,
      deliverables: [
        "Managed eval runtime",
        "Scenario variations",
        "Rollout exports",
        "Policy comparison runs",
      ],
    },
  ];
}

export const siteWorldCards: SiteWorldCard[] = [
  {
    id: "sw-chi-01",
    siteCode: "SW-CHI-01",
    siteName: "Midwest Grocery Backroom",
    category: "Retail",
    industry: "Retail backroom",
    taskLane: "Case pick and shelf replenishment",
    tone: "from-emerald-100 via-white to-emerald-50",
    accent: "#10b981",
    thumbnailKind: "grocery",
    summary: "A backroom layout with dock access, aisle replenishment paths, and a short handoff into shelf staging.",
    bestFor: "Shelf replenishment validation before a rollout.",
    startStates: ["Dock-side tote stack", "Open aisle replenishment lane", "Shelf staging handoff"],
    runtime: "Vision + wrist cams",
    sampleRobot: "Unitree G1 with head cam and wrist cam",
    sampleTask: "Walk to shelf staging and pick the blue tote",
    samplePolicy: "Checkpoint 148000",
    scenarioVariants: ["Normal lighting", "Dim backroom lighting", "Partial aisle clutter"],
    exportArtifacts: ["Rollout video", "Action trace", "Success labels", "Episode summary"],
    packages: buildPackages("sw-chi-01", "$2,400", "$18 / session-hour"),
  },
  {
    id: "sw-atl-02",
    siteCode: "SW-ATL-02",
    siteName: "Atlanta Parcel Sort Lane",
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
    packages: buildPackages("sw-atl-02", "$2,700", "$22 / session-hour"),
  },
  {
    id: "sw-phx-03",
    siteCode: "SW-PHX-03",
    siteName: "Phoenix Line-Side Cart Feed",
    category: "Manufacturing",
    industry: "Light manufacturing",
    taskLane: "Cart fetch and station handoff",
    tone: "from-amber-100 via-white to-orange-50",
    accent: "#f59e0b",
    thumbnailKind: "lineSide",
    summary: "A line-side lane with cart staging, station delivery, and return clearance in a tight envelope.",
    bestFor: "Repeated line-side resupply loops.",
    startStates: ["Cart at inbound lane", "Station requesting resupply", "Clear return path"],
    runtime: "Vision + proprio",
    sampleRobot: "Autonomous cart tug with front stereo pair",
    sampleTask: "Fetch the staged cart and deliver it to the resupply station",
    samplePolicy: "Resupply checkpoint B",
    scenarioVariants: ["Clear lane", "Narrow return path", "Busy station handoff"],
    exportArtifacts: ["Sensor trace", "Rendered views", "Task outcomes", "Episode summary"],
    packages: buildPackages("sw-phx-03", "$3,100", "$26 / session-hour"),
  },
  {
    id: "sw-dal-04",
    siteCode: "SW-DAL-04",
    siteName: "Dallas Laundry Sort Floor",
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
    packages: buildPackages("sw-dal-04", "$2,100", "$16 / session-hour"),
  },
  {
    id: "sw-col-05",
    siteCode: "SW-COL-05",
    siteName: "Cold-Chain Pick Module",
    category: "Cold Chain",
    industry: "Food distribution",
    taskLane: "Bin pick under temperature constraints",
    tone: "from-cyan-100 via-white to-cyan-50",
    accent: "#06b6d4",
    thumbnailKind: "coldChain",
    summary: "A chilled pick room with an airlock handoff, insulated staging, and short route lengths.",
    bestFor: "Temperature-sensitive pick flows.",
    startStates: ["Airlock entry", "Cold pick bay", "Outbound insulated bin"],
    runtime: "Vision + thermal tags",
    sampleRobot: "Cold-room picker with arm camera and thermal state feed",
    sampleTask: "Pick the target bin and hand it off without breaking the route timing",
    samplePolicy: "Cold-chain policy 3.4",
    scenarioVariants: ["Normal chill cycle", "Airlock delay", "Reordered outbound bins"],
    exportArtifacts: ["Thermal tags", "Episode log", "Video frames", "Timing metrics"],
    packages: buildPackages("sw-col-05", "$3,200", "$24 / session-hour"),
  },
  {
    id: "sw-jer-06",
    siteCode: "SW-JER-06",
    siteName: "Returns Triage Room",
    category: "Service",
    industry: "E-commerce returns",
    taskLane: "Item triage and tote routing",
    tone: "from-rose-100 via-white to-rose-50",
    accent: "#fb7185",
    thumbnailKind: "returns",
    summary: "A returns lane with intake, triage, and routing tables for fast judgment and tote movement.",
    bestFor: "Quick visual judgment and routing loops.",
    startStates: ["Single-item intake", "Mixed return batch", "Outbound route handoff"],
    runtime: "Vision + table cams",
    sampleRobot: "Stationary arm with table cams and barcode reader",
    sampleTask: "Triage the returned item and route it to the correct tote",
    samplePolicy: "Returns triage checkpoint 27",
    scenarioVariants: ["Single return", "Mixed batch", "Late route change"],
    exportArtifacts: ["Event log", "Video segment", "Routing outcome", "Error cases"],
    packages: buildPackages("sw-jer-06", "$2,300", "$19 / session-hour"),
  },
  {
    id: "sw-sjc-07",
    siteCode: "SW-SJC-07",
    siteName: "Bay Micro-Fulfillment Grid",
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
    packages: buildPackages("sw-sjc-07", "$2,800", "$21 / session-hour"),
  },
  {
    id: "sw-bos-08",
    siteCode: "SW-BOS-08",
    siteName: "Boston Pharmacy Refill Cell",
    category: "Healthcare",
    industry: "Pharmacy ops",
    taskLane: "Pick, verify, and bin refill transfer",
    tone: "from-indigo-100 via-white to-indigo-50",
    accent: "#6366f1",
    thumbnailKind: "pharmacy",
    summary: "A pharmacy refill lane with shelf picks, verification, and secure bin handoff under audit constraints.",
    bestFor: "Structured, auditable refill workflows.",
    startStates: ["Shelf refill pick", "Barcode verify", "Secure bin transfer"],
    runtime: "Vision + barcode state",
    sampleRobot: "Dual-arm pharmacy assistant with wrist cam and barcode state",
    sampleTask: "Pick the refill item, verify it, and load the secure bin",
    samplePolicy: "Pharmacy refill policy 11",
    scenarioVariants: ["Standard refill", "Barcode read failure", "Secure bin almost full"],
    exportArtifacts: ["Audit log", "Barcode state", "Episode video", "Verifier output"],
    packages: buildPackages("sw-bos-08", "$2,900", "$23 / session-hour"),
  },
  {
    id: "sw-det-09",
    siteCode: "SW-DET-09",
    siteName: "Detroit Battery Pack Subassembly",
    category: "Manufacturing",
    industry: "Battery assembly",
    taskLane: "Part feed and fixture handoff",
    tone: "from-yellow-100 via-white to-yellow-50",
    accent: "#eab308",
    thumbnailKind: "battery",
    summary: "A subassembly cell with parts feed, fixture positioning, and tightly bounded handoff stations.",
    bestFor: "Structured assembly handoffs.",
    startStates: ["Parts feed active", "Fixture aligned", "Buffer handoff ready"],
    runtime: "Vision + force traces",
    sampleRobot: "Assembly arm with force trace stream and wrist camera",
    sampleTask: "Move the part feed into the fixture and complete the handoff",
    samplePolicy: "Subassembly checkpoint 402",
    scenarioVariants: ["Nominal fixture", "Offset fixture", "Late buffer arrival"],
    exportArtifacts: ["Force trace", "Episode video", "Task outcome labels", "Failure review"],
    packages: buildPackages("sw-det-09", "$3,400", "$29 / session-hour"),
  },
  {
    id: "sw-ewr-10",
    siteCode: "SW-EWR-10",
    siteName: "Newark Baggage Feed",
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
    packages: buildPackages("sw-ewr-10", "$3,000", "$25 / session-hour"),
  },
  {
    id: "sw-den-11",
    siteCode: "SW-DEN-11",
    siteName: "Denver Hospital Supply Room",
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
    packages: buildPackages("sw-den-11", "$2,500", "$20 / session-hour"),
  },
  {
    id: "sw-sea-12",
    siteCode: "SW-SEA-12",
    siteName: "Seattle Electronics Rework Bench",
    category: "Manufacturing",
    industry: "Electronics repair",
    taskLane: "Tray fetch and bench handoff",
    tone: "from-pink-100 via-white to-pink-50",
    accent: "#ec4899",
    thumbnailKind: "electronics",
    summary: "A rework bench cell with tray fetch, bench-side part handoff, and test station transitions.",
    bestFor: "Short-horizon bench-side handoffs.",
    startStates: ["Tray fetch", "Bench handoff", "Test queue"],
    runtime: "Vision + wrist cams",
    sampleRobot: "Bench-side arm with wrist cams and tray state sensor",
    sampleTask: "Fetch the tray and hand the part to the rework bench",
    samplePolicy: "Bench handoff policy R3",
    scenarioVariants: ["Nominal tray", "Shifted tray position", "Busy test queue"],
    exportArtifacts: ["Wrist camera feed", "Episode summary", "Handoff result", "Failure notes"],
    packages: buildPackages("sw-sea-12", "$3,000", "$27 / session-hour"),
  },
];

export function getSiteWorldById(id: string) {
  return siteWorldCards.find((site) => site.id === id) ?? null;
}
