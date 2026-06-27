// Shared illustrative mock data for the OPS CONSOLE surfaces.
//
// Everything here is mock/illustrative — there is NO backend behind these
// values. Run ids, episode counts, costs, ratings, etc. are realistic but
// clearly synthetic so the ops screens can render the full spec without
// implying real supply, readiness, or operational state. Keep generated /
// simulated media labeled as review support, never real-world proof.

import type { StatusChipProps } from "@/components/blueprint";

type Tone = NonNullable<StatusChipProps["tone"]>;

// ---------------------------------------------------------------------------
// QUEUE — /ops
// ---------------------------------------------------------------------------

/** Top-of-console summary tiles for the queue. */
export interface OpsQueueMetric {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "proof" | "block" | "warn" | "neutral";
  caption?: string;
}

export const QUEUE_METRICS: OpsQueueMetric[] = [
  {
    label: "Open requests",
    value: "18",
    delta: "+4 wk",
    deltaTone: "neutral",
    caption: "Across capture, review, handoff",
  },
  {
    label: "Blocked",
    value: "3",
    delta: "+1 wk",
    deltaTone: "block",
    caption: "Need an operator decision",
  },
  {
    label: "Median time to package",
    value: "6.2",
    unit: "days",
    delta: "-0.8 wk",
    deltaTone: "proof",
    caption: "Scout to buyer-ready",
  },
  {
    label: "Committed spend MTD",
    value: "$182k",
    delta: "+$24k wk",
    deltaTone: "warn",
    caption: "Against $240k ceiling",
  },
];

export type OpsRequestStatus =
  | "blocked"
  | "review"
  | "capturing"
  | "packaging"
  | "scouting";

const requestStatusTone: Record<OpsRequestStatus, Tone> = {
  blocked: "block",
  review: "warn",
  capturing: "info",
  packaging: "info",
  scouting: "neutral",
};

const requestStatusLabel: Record<OpsRequestStatus, string> = {
  blocked: "Blocked",
  review: "In review",
  capturing: "Capturing",
  packaging: "Packaging",
  scouting: "Scouting",
};

/** Next-action route target — keyed to an ops screen path. */
export interface OpsNextAction {
  label: string;
  href: string;
}

export interface OpsQueueRequest {
  id: string;
  site: string;
  task: string;
  status: OpsRequestStatus;
  statusLabel: string;
  statusTone: Tone;
  owner: string;
  cost: string;
  nextAction: OpsNextAction;
}

function queueRequest(
  partial: Omit<OpsQueueRequest, "statusLabel" | "statusTone">,
): OpsQueueRequest {
  return {
    ...partial,
    statusLabel: requestStatusLabel[partial.status],
    statusTone: requestStatusTone[partial.status],
  };
}

export const QUEUE_REQUESTS: OpsQueueRequest[] = [
  queueRequest({
    id: "REQ-2049",
    site: "Northgate Fulfillment",
    task: "Tote induction · pick-to-belt",
    status: "blocked",
    owner: "M. Okafor",
    cost: "$15.0k",
    nextAction: { label: "Resolve rights gap", href: "/ops/evidence" },
  }),
  queueRequest({
    id: "REQ-2051",
    site: "Cedar Cold Storage",
    task: "Pallet wrap · cold aisle",
    status: "blocked",
    owner: "M. Okafor",
    cost: "$15.0k",
    nextAction: { label: "Review coverage", href: "/ops/evidence" },
  }),
  queueRequest({
    id: "REQ-2047",
    site: "Harbor Packing Cell",
    task: "Carton seal · single-pick",
    status: "review",
    owner: "D. Reyes",
    cost: "$6.5k",
    nextAction: { label: "Open evidence review", href: "/ops/evidence" },
  }),
  queueRequest({
    id: "REQ-2052",
    site: "Westline Machine Tending",
    task: "Door load · CNC bay",
    status: "review",
    owner: "D. Reyes",
    cost: "$15.0k",
    nextAction: { label: "Open evidence review", href: "/ops/evidence" },
  }),
  queueRequest({
    id: "REQ-2044",
    site: "Mill Road Conveyor",
    task: "Divert sort · induction",
    status: "capturing",
    owner: "S. Patel",
    cost: "$6.5k",
    nextAction: { label: "View capture supply", href: "/ops/supply" },
  }),
  queueRequest({
    id: "REQ-2053",
    site: "Lakeside Retail Backroom",
    task: "Restock · tote to shelf",
    status: "capturing",
    owner: "S. Patel",
    cost: "$6.5k",
    nextAction: { label: "View capture supply", href: "/ops/supply" },
  }),
  queueRequest({
    id: "REQ-2040",
    site: "Atlas Inspection Bench",
    task: "Defect pick · QA line",
    status: "packaging",
    owner: "D. Reyes",
    cost: "$15.0k",
    nextAction: { label: "Open buyer handoff", href: "/ops/handoff" },
  }),
  queueRequest({
    id: "REQ-2055",
    site: "Granite Loading Dock",
    task: "Trailer unload · floor-load",
    status: "scouting",
    owner: "Unassigned",
    cost: "$5.0k",
    nextAction: { label: "Open city launch", href: "/ops/city-launch" },
  }),
];

/** Headline blocker shown above the queue table. */
export const QUEUE_BLOCKER = {
  title: "3 requests blocked on an operator decision",
  body: "REQ-2049 and REQ-2051 are holding on a rights/privacy gap in the capture bundle; REQ-2052 is holding on coverage below the review threshold. These will not advance to packaging until cleared in Evidence review.",
} as const;

// ---------------------------------------------------------------------------
// CAPTURE SUPPLY — /ops/supply
// ---------------------------------------------------------------------------

export type CapturerAvailability = "available" | "on-assignment" | "off";

const availabilityTone: Record<CapturerAvailability, Tone> = {
  available: "proof",
  "on-assignment": "info",
  off: "neutral",
};

const availabilityLabel: Record<CapturerAvailability, string> = {
  available: "Available",
  "on-assignment": "On assignment",
  off: "Off rotation",
};

export interface Capturer {
  id: string;
  name: string;
  city: string;
  availability: CapturerAvailability;
  availabilityLabel: string;
  availabilityTone: Tone;
  /** Current site/task assignment, or null when idle. */
  assignment: string | null;
  rating: string;
  captures: number;
}

function capturer(
  partial: Omit<Capturer, "availabilityLabel" | "availabilityTone">,
): Capturer {
  return {
    ...partial,
    availabilityLabel: availabilityLabel[partial.availability],
    availabilityTone: availabilityTone[partial.availability],
  };
}

export const CAPTURER_ROSTER: Capturer[] = [
  capturer({
    id: "CAP-118",
    name: "Sofia Nguyen",
    city: "Austin, TX",
    availability: "on-assignment",
    assignment: "Mill Road Conveyor · divert sort",
    rating: "4.9",
    captures: 64,
  }),
  capturer({
    id: "CAP-092",
    name: "Marcus Bell",
    city: "Austin, TX",
    availability: "available",
    assignment: null,
    rating: "4.8",
    captures: 51,
  }),
  capturer({
    id: "CAP-134",
    name: "Priya Anand",
    city: "Dallas, TX",
    availability: "on-assignment",
    assignment: "Lakeside Retail Backroom · restock",
    rating: "4.7",
    captures: 39,
  }),
  capturer({
    id: "CAP-077",
    name: "Devon Carter",
    city: "Austin, TX",
    availability: "available",
    assignment: null,
    rating: "4.9",
    captures: 88,
  }),
  capturer({
    id: "CAP-145",
    name: "Lena Ortiz",
    city: "Houston, TX",
    availability: "off",
    assignment: null,
    rating: "4.6",
    captures: 22,
  }),
  capturer({
    id: "CAP-103",
    name: "Theo Walsh",
    city: "Dallas, TX",
    availability: "available",
    assignment: null,
    rating: "4.8",
    captures: 47,
  }),
];

export interface CaptureSupplyMetric {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
}

export const CAPTURE_SUPPLY_METRICS: CaptureSupplyMetric[] = [
  { label: "Active capturers", value: "6", caption: "Across 3 cities" },
  { label: "Available now", value: "3", caption: "Ready for assignment" },
  { label: "On assignment", value: "2", caption: "Live captures in field" },
  { label: "Avg rating", value: "4.8", unit: "/ 5", caption: "Last 90 days" },
];

// ---------------------------------------------------------------------------
// CITY LAUNCH — /ops/city-launch
// ---------------------------------------------------------------------------

export type CityStage =
  | "scouting"
  | "supply-build"
  | "demand-matched"
  | "live";

/** Signal color for the top border of each city card. */
const cityStageSignal: Record<CityStage, "proof" | "warn" | "info" | "neutral"> =
  {
    scouting: "neutral",
    "supply-build": "warn",
    "demand-matched": "info",
    live: "proof",
  };

export interface CityCard {
  id: string;
  city: string;
  /** Headline metric for the card, e.g. "4 sites scouted". */
  metric: string;
  /** Supporting mono detail line. */
  detail: string;
  /** Signal color for the card top-border. */
  signal: "proof" | "warn" | "info" | "neutral";
  owner: string;
}

export interface CityColumn {
  stage: CityStage;
  title: string;
  cards: CityCard[];
}

function cityCard(
  stage: CityStage,
  partial: Omit<CityCard, "signal">,
): CityCard {
  return { ...partial, signal: cityStageSignal[stage] };
}

export const CITY_LAUNCH_COLUMNS: CityColumn[] = [
  {
    stage: "scouting",
    title: "Scouting",
    cards: [
      cityCard("scouting", {
        id: "CITY-PHX",
        city: "Phoenix, AZ",
        metric: "6 sites scouted",
        detail: "0 capturers · 1 buyer intent",
        owner: "Growth — R. Kim",
      }),
      cityCard("scouting", {
        id: "CITY-DEN",
        city: "Denver, CO",
        metric: "3 sites scouted",
        detail: "0 capturers · 0 buyer intent",
        owner: "Growth — R. Kim",
      }),
    ],
  },
  {
    stage: "supply-build",
    title: "Supply build",
    cards: [
      cityCard("supply-build", {
        id: "CITY-HOU",
        city: "Houston, TX",
        metric: "11 sites · 2 capturers",
        detail: "Target 5 capturers · 60% there",
        owner: "Supply — L. Ortiz",
      }),
    ],
  },
  {
    stage: "demand-matched",
    title: "Demand matched",
    cards: [
      cityCard("demand-matched", {
        id: "CITY-DAL",
        city: "Dallas, TX",
        metric: "14 sites · 4 capturers",
        detail: "3 buyer requests matched",
        owner: "Supply — L. Ortiz",
      }),
    ],
  },
  {
    stage: "live",
    title: "Live",
    cards: [
      cityCard("live", {
        id: "CITY-AUS",
        city: "Austin, TX",
        metric: "22 sites · 4 capturers",
        detail: "9 packages shipped · 2 live runs",
        owner: "Ops — M. Okafor",
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// EVIDENCE REVIEW — /ops/evidence
// ---------------------------------------------------------------------------

/** Capture frame tiles for the review board (POV placeholders). */
export interface EvidenceFrame {
  id: string;
  /** Asset path under /redesign/pov. */
  src: string;
  alt: string;
  /** Short mono caption (timecode / segment). */
  caption: string;
}

export const EVIDENCE_FRAMES: EvidenceFrame[] = [
  {
    id: "FRM-01",
    src: "/redesign/pov/warehouse-tote.jpg",
    alt: "Tote induction approach (review media, not real-world proof)",
    caption: "00:00 · approach",
  },
  {
    id: "FRM-02",
    src: "/redesign/pov/factory-conveyor.jpg",
    alt: "Conveyor pick segment (review media, not real-world proof)",
    caption: "00:42 · pick",
  },
  {
    id: "FRM-03",
    src: "/redesign/pov/packing-cell.jpg",
    alt: "Packing cell place segment (review media, not real-world proof)",
    caption: "01:18 · place",
  },
  {
    id: "FRM-04",
    src: "/redesign/pov/inspection-bench.jpg",
    alt: "Inspection bench QA segment (review media, not real-world proof)",
    caption: "01:55 · inspect",
  },
  {
    id: "FRM-05",
    src: "/redesign/pov/loading-dock.jpg",
    alt: "Loading dock transit segment (review media, not real-world proof)",
    caption: "02:30 · transit",
  },
  {
    id: "FRM-06",
    src: "/redesign/pov/machine-tending.jpg",
    alt: "Machine tending load segment (review media, not real-world proof)",
    caption: "03:04 · load",
  },
];

export type QaGateStatus = "pass" | "review" | "fail";

const qaGateTone: Record<QaGateStatus, Tone> = {
  pass: "proof",
  review: "warn",
  fail: "block",
};

const qaGateLabel: Record<QaGateStatus, string> = {
  pass: "Pass",
  review: "Review",
  fail: "Fail",
};

export interface QaGate {
  id: string;
  label: string;
  detail: string;
  status: QaGateStatus;
  statusLabel: string;
  statusTone: Tone;
}

function qaGate(partial: Omit<QaGate, "statusLabel" | "statusTone">): QaGate {
  return {
    ...partial,
    statusLabel: qaGateLabel[partial.status],
    statusTone: qaGateTone[partial.status],
  };
}

export const EVIDENCE_QA_GATES: QaGate[] = [
  qaGate({
    id: "GATE-DEPTH",
    label: "Depth coverage",
    detail: "Mesh density across the work envelope",
    status: "pass",
  }),
  qaGate({
    id: "GATE-POSE",
    label: "Pose continuity",
    detail: "Trajectory tracking through the path",
    status: "pass",
  }),
  qaGate({
    id: "GATE-COVER",
    label: "Scene coverage",
    detail: "Approach and place faces below target",
    status: "review",
  }),
  qaGate({
    id: "GATE-RIGHTS",
    label: "Rights & consent",
    detail: "Signed site release on file",
    status: "pass",
  }),
  qaGate({
    id: "GATE-PRIVACY",
    label: "Privacy redaction",
    detail: "Faces and badges pending redaction",
    status: "fail",
  }),
];

/** Capture manifest for the bundle under review. */
export interface ManifestEntry {
  label: string;
  value: string;
  /** Optional trailing chip tone + label. */
  chipTone?: Tone;
  chipLabel?: string;
}

export const EVIDENCE_MANIFEST: ManifestEntry[] = [
  { label: "Capture ID", value: "CAP-2049-07" },
  { label: "Site", value: "Northgate Fulfillment" },
  { label: "Task", value: "Tote induction · pick-to-belt" },
  { label: "Walkthrough", value: "03:41 · 1 pass" },
  { label: "Frames", value: "4,820" },
  { label: "Meshes", value: "12 segments" },
  { label: "Capturer", value: "CAP-118 · S. Nguyen" },
  {
    label: "Source",
    value: "On-site capture",
    chipTone: "proof",
    chipLabel: "Raw = proof",
  },
];

export type ProvenanceState = "done" | "active" | "pending";

export interface ProvenanceEvent {
  id: string;
  label: string;
  detail: string;
  time: string;
  state: ProvenanceState;
}

export const EVIDENCE_PROVENANCE: ProvenanceEvent[] = [
  {
    id: "PRV-1",
    label: "Captured on site",
    detail: "CAP-118 · Northgate Fulfillment",
    time: "2026-06-22 09:14",
    state: "done",
  },
  {
    id: "PRV-2",
    label: "Uploaded & encrypted",
    detail: "18.4 GB · resumable transfer",
    time: "2026-06-22 11:02",
    state: "done",
  },
  {
    id: "PRV-3",
    label: "Auto QA gates run",
    detail: "4 of 5 gates passed",
    time: "2026-06-22 11:48",
    state: "done",
  },
  {
    id: "PRV-4",
    label: "Operator review",
    detail: "Coverage + privacy gates open",
    time: "2026-06-23 08:30",
    state: "active",
  },
  {
    id: "PRV-5",
    label: "Accept & package",
    detail: "Awaiting gate clearance",
    time: "—",
    state: "pending",
  },
];

export const EVIDENCE_COVERAGE_BOUNDARY = {
  title: "Coverage below review threshold",
  body: "Approach and place faces are below the coverage target and faces/badges are pending privacy redaction. Return to supply for a recapture pass or clear the gates before this bundle can be packaged for a buyer.",
} as const;

// ---------------------------------------------------------------------------
// BUYER HANDOFF — /ops/handoff
// ---------------------------------------------------------------------------

export type PackageItemState =
  | "included"
  | "labeled"
  | "withheld"
  | "pending";

const packageStateTone: Record<PackageItemState, Tone> = {
  included: "proof",
  labeled: "warn",
  withheld: "neutral",
  pending: "info",
};

const packageStateLabel: Record<PackageItemState, string> = {
  included: "Included",
  labeled: "Labeled",
  withheld: "Withheld",
  pending: "Pending",
};

export interface PackageItem {
  id: string;
  label: string;
  detail: string;
  state: PackageItemState;
  stateLabel: string;
  stateTone: Tone;
}

function packageItem(
  partial: Omit<PackageItem, "stateLabel" | "stateTone">,
): PackageItem {
  return {
    ...partial,
    stateLabel: packageStateLabel[partial.state],
    stateTone: packageStateTone[partial.state],
  };
}

export const HANDOFF_PACKAGE_ITEMS: PackageItem[] = [
  packageItem({
    id: "PKG-1",
    label: "Site Card + capture manifest",
    detail: "Geometry, attributes, provenance record",
    state: "included",
  }),
  packageItem({
    id: "PKG-2",
    label: "Raw capture walkthrough",
    detail: "Single pass · 4,820 frames",
    state: "included",
  }),
  packageItem({
    id: "PKG-3",
    label: "Eval Card (100 episodes)",
    detail: "Rank fidelity readout · predicted, not guaranteed",
    state: "included",
  }),
  packageItem({
    id: "PKG-4",
    label: "Advisory sim preflight",
    detail: "Generated — review support, not real-world proof",
    state: "labeled",
  }),
  packageItem({
    id: "PKG-5",
    label: "Raw faces & badge frames",
    detail: "Redacted from buyer package per privacy scope",
    state: "withheld",
  }),
  packageItem({
    id: "PKG-6",
    label: "Validated 500-episode pack",
    detail: "Building — ships on entitlement upgrade",
    state: "pending",
  }),
];

export interface HandoffField {
  label: string;
  value: string;
  chipTone?: Tone;
  chipLabel?: string;
}

export const HANDOFF_ENTITLEMENT: HandoffField[] = [
  { label: "Buyer", value: "Vendor B Robotics" },
  { label: "Package ID", value: "PKG-2040-A" },
  { label: "Plan", value: "Robot-team subscription" },
  {
    label: "Access window",
    value: "2026-06-26 → 2026-09-26",
    chipTone: "info",
    chipLabel: "90-day",
  },
  { label: "Licensed site", value: "Atlas Inspection Bench" },
  { label: "Task scope", value: "Defect pick · QA line only" },
  {
    label: "Export rights",
    value: "Hosted access · no raw export",
    chipTone: "warn",
    chipLabel: "Scoped",
  },
];

export const HANDOFF_RELEASE_BOUNDARY = {
  title: "Proof-safe release checklist",
  body: "Generated and simulated media in this package is labeled as review support, not real-world proof. The Eval Card reports rank fidelity and predicted outcomes — it does not claim deployment readiness or guaranteed success. Releasing grants the buyer hosted access within the scope and window above.",
} as const;

// ---------------------------------------------------------------------------
// SPEND CONTROLS — /ops/spend
// ---------------------------------------------------------------------------

export interface SpendMetric {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "proof" | "block" | "warn" | "neutral";
  caption?: string;
}

export const SPEND_METRICS: SpendMetric[] = [
  {
    label: "Committed MTD",
    value: "$182k",
    delta: "+$24k wk",
    deltaTone: "warn",
    caption: "Against $240k ceiling",
  },
  {
    label: "Monthly ceiling",
    value: "$240k",
    caption: "Set by finance",
  },
  {
    label: "Headroom",
    value: "$58k",
    delta: "-$24k wk",
    deltaTone: "block",
    caption: "24% remaining",
  },
  {
    label: "Cost per package",
    value: "$11.4k",
    delta: "-$0.6k wk",
    deltaTone: "proof",
    caption: "Blended, last 30 days",
  },
];

export type SpendFill = "proof" | "warn" | "block";

export interface SpendCategory {
  id: string;
  label: string;
  /** Spent so far in this category. */
  amount: string;
  /** Category ceiling. */
  budget: string;
  /** 0–1 fraction of budget consumed. */
  ratio: number;
  /** Signal fill for the bar. */
  fill: SpendFill;
  caption: string;
}

export const SPEND_CATEGORIES: SpendCategory[] = [
  {
    id: "SPC-CAPTURE",
    label: "Capturer payouts",
    amount: "$74k",
    budget: "$110k",
    ratio: 0.67,
    fill: "proof",
    caption: "On track for the month",
  },
  {
    id: "SPC-HOSTING",
    label: "Hosted runtime",
    amount: "$48k",
    budget: "$60k",
    ratio: 0.8,
    fill: "warn",
    caption: "Approaching category ceiling",
  },
  {
    id: "SPC-SCOUT",
    label: "City scouting",
    amount: "$22k",
    budget: "$40k",
    ratio: 0.55,
    fill: "proof",
    caption: "Phoenix + Denver active",
  },
  {
    id: "SPC-REVIEW",
    label: "Evidence review",
    amount: "$38k",
    budget: "$30k",
    ratio: 1.0,
    fill: "block",
    caption: "Over category ceiling — needs approval",
  },
];

export const SPEND_THRESHOLD_BOUNDARY = {
  title: "Evidence review is over its category ceiling",
  body: "Evidence review spend ($38k) has exceeded its $30k monthly ceiling. New review work in this category needs an operator approval before more spend is committed. These are committed estimates, not final invoiced amounts.",
} as const;
