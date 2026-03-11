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

export type SiteWorldCard = {
  id: string;
  siteCode: string;
  siteName: string;
  category: Exclude<SiteCategory, "All">;
  industry: string;
  taskLane: string;
  exportFormat: string;
  runtime: string;
  hourlyRate: number;
  tone: string;
  accent: string;
  thumbnailKind: ThumbnailKind;
  summary: string;
  startStates: string[];
  exportNotes: string[];
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

export const siteWorldCards: SiteWorldCard[] = [
  {
    id: "sw-chi-01",
    siteCode: "SW-CHI-01",
    siteName: "Midwest Grocery Backroom",
    category: "Retail",
    industry: "Retail backroom",
    taskLane: "Case pick and shelf replenishment",
    exportFormat: "RLDS + video",
    runtime: "Vision + wrist cams",
    hourlyRate: 18,
    tone: "from-emerald-100 via-white to-emerald-50",
    accent: "#10b981",
    thumbnailKind: "grocery",
    summary: "A backroom layout with receiving dock access, aisle replenishment paths, and a short handoff route into shelf staging.",
    startStates: ["Dock-side tote stack", "Open aisle replenishment lane", "Shelf staging handoff"],
    exportNotes: ["Episode videos", "Action traces", "Task success labels"],
  },
  {
    id: "sw-atl-02",
    siteCode: "SW-ATL-02",
    siteName: "Atlanta Parcel Sort Lane",
    category: "Logistics",
    industry: "Parcel logistics",
    taskLane: "Induct, handoff, and tote reset",
    exportFormat: "RLDS + JSON events",
    runtime: "Vision + overhead",
    hourlyRate: 22,
    tone: "from-sky-100 via-white to-sky-50",
    accent: "#0ea5e9",
    thumbnailKind: "parcel",
    summary: "A parcel feed lane with induct points, diverter handoffs, and tote reset positions for quick cycle testing.",
    startStates: ["Single-box induct", "Mixed parcel wave", "Tote clear and reset"],
    exportNotes: ["Per-step events", "Video rollouts", "Lane timing summary"],
  },
  {
    id: "sw-phx-03",
    siteCode: "SW-PHX-03",
    siteName: "Phoenix Line-Side Cart Feed",
    category: "Manufacturing",
    industry: "Light manufacturing",
    taskLane: "Cart fetch and station handoff",
    exportFormat: "HDF5 + video",
    runtime: "Vision + proprio",
    hourlyRate: 26,
    tone: "from-amber-100 via-white to-orange-50",
    accent: "#f59e0b",
    thumbnailKind: "lineSide",
    summary: "A line-side lane with cart staging, station delivery, and return clearance in a narrow manufacturing envelope.",
    startStates: ["Cart at inbound lane", "Station requesting resupply", "Clear return path"],
    exportNotes: ["Sensor tensors", "Episode summaries", "Rendered camera views"],
  },
  {
    id: "sw-dal-04",
    siteCode: "SW-DAL-04",
    siteName: "Dallas Laundry Sort Floor",
    category: "Service",
    industry: "Service operations",
    taskLane: "Bag lift, sort, and station transfer",
    exportFormat: "RLDS + MP4",
    runtime: "Vision + top-down",
    hourlyRate: 16,
    tone: "from-violet-100 via-white to-fuchsia-50",
    accent: "#8b5cf6",
    thumbnailKind: "laundry",
    summary: "A repeatable laundry floor with intake bags, sort tables, and fold-outbound handoffs.",
    startStates: ["Bag at intake", "Active sort table", "Outbound transfer ready"],
    exportNotes: ["Rollout videos", "Pick/place traces", "Per-station timing"],
  },
  {
    id: "sw-col-05",
    siteCode: "SW-COL-05",
    siteName: "Cold-Chain Pick Module",
    category: "Cold Chain",
    industry: "Food distribution",
    taskLane: "Bin pick under temperature constraints",
    exportFormat: "RLDS + sensor logs",
    runtime: "Vision + thermal tags",
    hourlyRate: 24,
    tone: "from-cyan-100 via-white to-cyan-50",
    accent: "#06b6d4",
    thumbnailKind: "coldChain",
    summary: "A chilled pick room with an airlock handoff, insulated staging, and short route lengths for cold-storage testing.",
    startStates: ["Airlock entry", "Cold pick bay", "Outbound insulated bin"],
    exportNotes: ["Thermal tags", "Episode logs", "Video frames"],
  },
  {
    id: "sw-jer-06",
    siteCode: "SW-JER-06",
    siteName: "Returns Triage Room",
    category: "Service",
    industry: "E-commerce returns",
    taskLane: "Item triage and tote routing",
    exportFormat: "JSONL + video",
    runtime: "Vision + table cams",
    hourlyRate: 19,
    tone: "from-rose-100 via-white to-rose-50",
    accent: "#fb7185",
    thumbnailKind: "returns",
    summary: "A returns lane with intake, triage, and routing tables for fast judgment and tote movement loops.",
    startStates: ["Single-item intake", "Mixed return batch", "Outbound route handoff"],
    exportNotes: ["Event logs", "Video segments", "Routing outcomes"],
  },
  {
    id: "sw-sjc-07",
    siteCode: "SW-SJC-07",
    siteName: "Bay Micro-Fulfillment Grid",
    category: "Retail",
    industry: "Micro-fulfillment",
    taskLane: "Aisle pick and tote transfer",
    exportFormat: "RLDS + JSON events",
    runtime: "Vision + map state",
    hourlyRate: 21,
    tone: "from-lime-100 via-white to-lime-50",
    accent: "#65a30d",
    thumbnailKind: "microFulfillment",
    summary: "A dense micro-fulfillment layout with short aisle hops and a clean pack-side handoff.",
    startStates: ["Single order pick", "Multi-order batch", "Pack station transfer"],
    exportNotes: ["Episode events", "Rendered video", "Aisle path summary"],
  },
  {
    id: "sw-bos-08",
    siteCode: "SW-BOS-08",
    siteName: "Boston Pharmacy Refill Cell",
    category: "Healthcare",
    industry: "Pharmacy ops",
    taskLane: "Pick, verify, and bin refill transfer",
    exportFormat: "RLDS + audit log",
    runtime: "Vision + barcode state",
    hourlyRate: 23,
    tone: "from-indigo-100 via-white to-indigo-50",
    accent: "#6366f1",
    thumbnailKind: "pharmacy",
    summary: "A pharmacy refill lane with shelf picks, verification, and secure bin handoff under audit constraints.",
    startStates: ["Shelf refill pick", "Barcode verify", "Secure bin transfer"],
    exportNotes: ["Audit log", "Barcode state", "Episode video"],
  },
  {
    id: "sw-det-09",
    siteCode: "SW-DET-09",
    siteName: "Detroit Battery Pack Subassembly",
    category: "Manufacturing",
    industry: "Battery assembly",
    taskLane: "Part feed and fixture handoff",
    exportFormat: "HDF5 + video",
    runtime: "Vision + force traces",
    hourlyRate: 29,
    tone: "from-yellow-100 via-white to-yellow-50",
    accent: "#eab308",
    thumbnailKind: "battery",
    summary: "A subassembly cell with parts feed, fixture positioning, and tightly bounded handoff stations.",
    startStates: ["Parts feed active", "Fixture aligned", "Buffer handoff ready"],
    exportNotes: ["Force traces", "Episode video", "Task outcome labels"],
  },
  {
    id: "sw-ewr-10",
    siteCode: "SW-EWR-10",
    siteName: "Newark Baggage Feed",
    category: "Logistics",
    industry: "Airport handling",
    taskLane: "Bag feed, scan, and lane clear",
    exportFormat: "RLDS + MP4",
    runtime: "Vision + scan events",
    hourlyRate: 25,
    tone: "from-blue-100 via-white to-sky-50",
    accent: "#3b82f6",
    thumbnailKind: "airport",
    summary: "A baggage feed layout with scan points, belt handoff logic, and lane-clear cycles.",
    startStates: ["Single bag scan", "Mixed baggage wave", "Lane recovery pass"],
    exportNotes: ["Scan events", "Rendered clips", "Per-lane timing"],
  },
  {
    id: "sw-den-11",
    siteCode: "SW-DEN-11",
    siteName: "Denver Hospital Supply Room",
    category: "Healthcare",
    industry: "Hospital supply",
    taskLane: "Restock, cart load, and room return",
    exportFormat: "JSONL + video",
    runtime: "Vision + map state",
    hourlyRate: 20,
    tone: "from-teal-100 via-white to-teal-50",
    accent: "#14b8a6",
    thumbnailKind: "hospital",
    summary: "A supply room flow with cart loading, corridor return, and room restock points.",
    startStates: ["Cart load", "Room-side handoff", "Return path clear"],
    exportNotes: ["Action logs", "Video frames", "Task summaries"],
  },
  {
    id: "sw-sea-12",
    siteCode: "SW-SEA-12",
    siteName: "Seattle Electronics Rework Bench",
    category: "Manufacturing",
    industry: "Electronics repair",
    taskLane: "Tray fetch and bench handoff",
    exportFormat: "HDF5 + video",
    runtime: "Vision + wrist cams",
    hourlyRate: 27,
    tone: "from-pink-100 via-white to-pink-50",
    accent: "#ec4899",
    thumbnailKind: "electronics",
    summary: "A rework bench cell with tray fetch, bench-side part handoff, and test station transitions.",
    startStates: ["Tray fetch", "Bench handoff", "Test queue"],
    exportNotes: ["Wrist video", "State tensors", "Outcome labels"],
  },
];

export function getSiteWorldById(id: string) {
  return siteWorldCards.find((site) => site.id === id) ?? null;
}
