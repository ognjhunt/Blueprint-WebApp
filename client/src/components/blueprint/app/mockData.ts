// Buyer-app mock data — rich, illustrative, backend-free.
//
// Single source of truth for every BUYER APP screen (Overview, Evaluation Runs,
// Site & Task Packs, Site detail, Run detail, Policies, Data Packages,
// Entitlements). Screens READ from here; do not mutate at runtime.
//
// Values are realistic but clearly illustrative (RUN-2049, 100/500 episodes,
// correlation 0.929, $6.5k/$15k). All generated / simulated media referenced
// here is review support, never real-world proof.

import type { StatusChipProps } from "@/components/blueprint";

/* -------------------------------------------------------------------------- */
/*  Shared signal types                                                       */
/* -------------------------------------------------------------------------- */

export type SignalTone = NonNullable<StatusChipProps["tone"]>;

/** A status label paired with the StatusChip tone that renders it. */
export interface StatusBadge {
  label: string;
  tone: SignalTone;
}

/* -------------------------------------------------------------------------- */
/*  Account: plan, usage, user                                                */
/* -------------------------------------------------------------------------- */

export interface PlanUsage {
  /** Plan name shown in the sidebar plan card. */
  planName: string;
  /** Mono price line (e.g. "$15k / mo"). */
  priceLabel: string;
  /** Short usage caption (mono). */
  usageLabel: string;
  /** Runs consumed this cycle. */
  runsUsed: number;
  /** Runs included this cycle. */
  runsIncluded: number;
  /** Renewal date (mono, ISO-ish display). */
  renews: string;
}

export const planUsage: PlanUsage = {
  planName: "Robot-team subscription",
  priceLabel: "$15k / mo",
  usageLabel: "Runs this cycle",
  runsUsed: 8,
  runsIncluded: 12,
  renews: "2026-07-12",
};

export interface BuyerUser {
  name: string;
  initials: string;
  org: string;
  role: string;
}

export const buyerUser: BuyerUser = {
  name: "Dana Okafor",
  initials: "DO",
  org: "Northwind Robotics",
  role: "Eval Lead",
};

/** Unread notifications — drives the topbar bell blocker dot. */
export interface NotificationFlags {
  /** True renders the clay-red blocker dot on the bell. */
  hasBlocker: boolean;
  count: number;
}

export const notifications: NotificationFlags = {
  hasBlocker: true,
  count: 3,
};

/* -------------------------------------------------------------------------- */
/*  Overview / Dashboard — greeting + metric tiles                            */
/* -------------------------------------------------------------------------- */

export interface MetricTile {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "proof" | "block" | "warn" | "neutral";
  caption?: string;
}

export const overviewMetrics: MetricTile[] = [
  {
    label: "Runs in flight",
    value: "3",
    caption: "1 blocked on evidence",
  },
  {
    label: "Mean predicted success",
    value: "0.71",
    delta: "+0.06 vs prior",
    deltaTone: "proof",
    caption: "rank fidelity, not a guarantee",
  },
  {
    label: "Episodes this cycle",
    value: "4,200",
    caption: "across 6 sites",
  },
  {
    label: "Spend MTD",
    value: "$48.5k",
    delta: "+$15k vs plan",
    deltaTone: "warn",
    caption: "subscription + add-ons",
  },
];

export const greeting = {
  hello: "Welcome back, Dana",
  sub: "Here is where your evaluation runs stand today.",
};

/* -------------------------------------------------------------------------- */
/*  Evaluation Runs                                                           */
/* -------------------------------------------------------------------------- */

export type RunStatus = "Running" | "Complete" | "Blocked" | "Queued";

const runStatusTone: Record<RunStatus, SignalTone> = {
  Running: "info",
  Complete: "proof",
  Blocked: "block",
  Queued: "neutral",
};

export function statusToneForRun(status: RunStatus): SignalTone {
  return runStatusTone[status];
}

export interface EvalRun {
  id: string;
  site: string;
  task: string;
  /** Pack / site id this run is paired to (joins to sitePacks). */
  packId: string;
  status: RunStatus;
  robotProfile: string;
  /** Predicted success 0–1; null while still running/blocked. */
  success: number | null;
  /** Mono success delta vs prior run (e.g. "+0.08"). */
  successDelta?: string;
  episodes: number;
  /** Mono cost (e.g. "$6.5k"). */
  cost: string;
  /** Display date (mono). */
  started: string;
  /** Out-of-distribution flags raised during the run. */
  oodFlags: number;
  /** Mean cycle time, seconds. */
  cycleTimeSec: number;
}

export const runs: EvalRun[] = [
  {
    id: "RUN-2049",
    site: "Linde Cold Storage — Aurora",
    task: "Tote retrieval to conveyor",
    packId: "PACK-CONVEYOR-04",
    status: "Complete",
    robotProfile: "Generic 7-DOF arm + mobile base",
    success: 0.72,
    successDelta: "+0.08",
    episodes: 500,
    cost: "$15k",
    started: "2026-06-21",
    oodFlags: 14,
    cycleTimeSec: 41.6,
  },
  {
    id: "RUN-2051",
    site: "Cedar Packing Co — Reno",
    task: "Carton sealing at packing cell",
    packId: "PACK-PACKING-02",
    status: "Running",
    robotProfile: "Dual-arm fixed cell",
    success: null,
    episodes: 500,
    cost: "$15k",
    started: "2026-06-25",
    oodFlags: 6,
    cycleTimeSec: 38.2,
  },
  {
    id: "RUN-2047",
    site: "Halsted Retail Backroom — Chicago",
    task: "Restock cart to shelf",
    packId: "PACK-BACKROOM-07",
    status: "Blocked",
    robotProfile: "Generic 7-DOF arm + mobile base",
    success: null,
    episodes: 100,
    cost: "$6.5k",
    started: "2026-06-24",
    oodFlags: 22,
    cycleTimeSec: 0,
  },
  {
    id: "RUN-2042",
    site: "Riverside Inspection Bench — Tulsa",
    task: "Part inspection + reject sort",
    packId: "PACK-INSPECT-01",
    status: "Complete",
    robotProfile: "Single-arm fixed cell",
    success: 0.81,
    successDelta: "+0.03",
    episodes: 500,
    cost: "$15k",
    started: "2026-06-18",
    oodFlags: 5,
    cycleTimeSec: 33.9,
  },
  {
    id: "RUN-2039",
    site: "Meadow Laundry — Sacramento",
    task: "Towel fold + stack",
    packId: "PACK-LAUNDRY-03",
    status: "Complete",
    robotProfile: "Dual-arm fixed cell",
    success: 0.64,
    successDelta: "-0.02",
    episodes: 100,
    cost: "$6.5k",
    started: "2026-06-12",
    oodFlags: 11,
    cycleTimeSec: 52.4,
  },
  {
    id: "RUN-2055",
    site: "Granite Loading Dock — Boise",
    task: "Pallet stage to dock door",
    packId: "PACK-DOCK-05",
    status: "Queued",
    robotProfile: "Mobile base + lift",
    success: null,
    episodes: 100,
    cost: "$6.5k",
    started: "2026-06-26",
    oodFlags: 0,
    cycleTimeSec: 0,
  },
];

/** Run counts by tab for the Evaluation Runs tab strip. */
export const runTabCounts = {
  all: runs.length,
  running: runs.filter((r) => r.status === "Running").length,
  complete: runs.filter((r) => r.status === "Complete").length,
  blocked: runs.filter((r) => r.status === "Blocked").length,
};

/** Recent runs shown on the Overview table (most recent first, capped). */
export const recentRuns: EvalRun[] = [...runs]
  .sort((a, b) => (a.started < b.started ? 1 : -1))
  .slice(0, 4);

/* -------------------------------------------------------------------------- */
/*  Site & Task Packs                                                         */
/* -------------------------------------------------------------------------- */

export interface SitePack {
  id: string;
  name: string;
  task: string;
  /** POV asset id — maps to /redesign/pov/<povId>.jpg */
  povId: string;
  status: StatusBadge;
  /** Short attribute chips (clutter level, lighting, etc.). */
  attributes: string[];
  city: string;
  /** Captured episode coverage available in the pack. */
  episodesAvailable: number;
  /** Mono capture date. */
  captured: string;
}

export const sitePacks: SitePack[] = [
  {
    id: "PACK-CONVEYOR-04",
    name: "Linde Cold Storage — Aurora",
    task: "Tote retrieval to conveyor",
    povId: "factory-conveyor",
    status: { label: "Validated", tone: "proof" },
    attributes: ["Cold aisle", "High clutter", "Mixed lighting"],
    city: "Aurora, CO",
    episodesAvailable: 540,
    captured: "2026-05-30",
  },
  {
    id: "PACK-PACKING-02",
    name: "Cedar Packing Co — Reno",
    task: "Carton sealing at packing cell",
    povId: "packing-cell",
    status: { label: "Validated", tone: "proof" },
    attributes: ["Fixed cell", "Bright", "Low clutter"],
    city: "Reno, NV",
    episodesAvailable: 612,
    captured: "2026-06-02",
  },
  {
    id: "PACK-BACKROOM-07",
    name: "Halsted Retail Backroom — Chicago",
    task: "Restock cart to shelf",
    povId: "retail-backroom",
    status: { label: "Recapture", tone: "warn" },
    attributes: ["Narrow aisle", "Dim", "Dynamic obstacles"],
    city: "Chicago, IL",
    episodesAvailable: 120,
    captured: "2026-06-09",
  },
  {
    id: "PACK-INSPECT-01",
    name: "Riverside Inspection Bench — Tulsa",
    task: "Part inspection + reject sort",
    povId: "inspection-bench",
    status: { label: "Validated", tone: "proof" },
    attributes: ["Bench", "Even lighting", "Static"],
    city: "Tulsa, OK",
    episodesAvailable: 580,
    captured: "2026-05-22",
  },
  {
    id: "PACK-LAUNDRY-03",
    name: "Meadow Laundry — Sacramento",
    task: "Towel fold + stack",
    povId: "laundry-folding",
    status: { label: "Validated", tone: "proof" },
    attributes: ["Deformable", "Bright", "Low clutter"],
    city: "Sacramento, CA",
    episodesAvailable: 160,
    captured: "2026-06-04",
  },
  {
    id: "PACK-DOCK-05",
    name: "Granite Loading Dock — Boise",
    task: "Pallet stage to dock door",
    povId: "loading-dock",
    status: { label: "Building", tone: "warn" },
    attributes: ["Outdoor edge", "Variable light", "Heavy load"],
    city: "Boise, ID",
    episodesAvailable: 80,
    captured: "2026-06-20",
  },
];

/** Site packs surfaced on the Overview mini-grid (capped). */
export const overviewSitePacks: SitePack[] = sitePacks.slice(0, 3);

/** Lookup helper used by Site detail. */
export function findSitePack(id: string): SitePack | undefined {
  return sitePacks.find((p) => p.id === id);
}

/* -------------------------------------------------------------------------- */
/*  Site detail — capture manifest + run-kickoff options                      */
/* -------------------------------------------------------------------------- */

export interface ManifestRow {
  label: string;
  value: string;
  /** Render value as mono (default) or prose. */
  mono?: boolean;
  /** Optional trailing status badge. */
  badge?: StatusBadge;
}

/** Capture manifest rows for the Aurora pack (representative). */
export const captureManifest: ManifestRow[] = [
  { label: "Capture ID", value: "CAP-AUR-0530-04" },
  { label: "Walkthrough", value: "6m 42s · 1.2 GB" },
  { label: "RGB frames", value: "18,440" },
  { label: "Depth frames", value: "18,440" },
  { label: "Camera poses", value: "18,440 (drift 0.6%)" },
  { label: "Reconstructed mesh", value: "1 · 4.1M tris" },
  { label: "Coverage", value: "94%", badge: { label: "Validated", tone: "proof" } },
  { label: "Captured by", value: "Capturer C-1187" },
  { label: "Provenance", value: "Signed · chain intact", badge: { label: "Proof", tone: "proof" } },
];

/** Robot profile options for the run-kickoff Select. */
export const robotProfileOptions = [
  { value: "arm7-mobile", label: "Generic 7-DOF arm + mobile base" },
  { value: "dual-fixed", label: "Dual-arm fixed cell" },
  { value: "single-fixed", label: "Single-arm fixed cell" },
  { value: "mobile-lift", label: "Mobile base + lift" },
];

/** Policy options selectable for a run. */
export const policySelectOptions = [
  { value: "pol-v4", label: "Team v4 (checkpoint)" },
  { value: "pol-v3", label: "Team v3 (checkpoint)" },
  { value: "pol-api", label: "Vendor B (API runner)" },
  { value: "pol-vla", label: "OpenVLA-7B (VLA)" },
];

/** Compare-against checkboxes (baselines). */
export const compareAgainstOptions = [
  { value: "vendor-b", label: "Vendor B (API runner)", defaultChecked: true },
  { value: "team-v3", label: "Team v3 (prior checkpoint)", defaultChecked: true },
  { value: "openvla", label: "OpenVLA-7B (reference VLA)", defaultChecked: false },
  { value: "scripted", label: "Scripted baseline", defaultChecked: false },
];

/** Episode-count toggle options and their paired mono cost. */
export const episodeOptions: { value: 100 | 500; label: string; cost: string }[] = [
  { value: 100, label: "100 episodes", cost: "$6.5k" },
  { value: 500, label: "500 episodes", cost: "$15k" },
];

/** Default threshold (success ratio) shown in the kickoff form. */
export const defaultSuccessThreshold = "0.70";

/* -------------------------------------------------------------------------- */
/*  Run detail — metrics, policy comparison, failure clusters, manifests      */
/* -------------------------------------------------------------------------- */

export const runDetailMetrics: MetricTile[] = [
  {
    label: "Predicted success",
    value: "0.72",
    delta: "+0.08 vs prior",
    deltaTone: "proof",
    caption: "rank fidelity estimate",
  },
  {
    label: "Mean cycle time",
    value: "41.6",
    unit: "s",
    delta: "-3.1s vs prior",
    deltaTone: "proof",
  },
  {
    label: "OOD flags",
    value: "14",
    deltaTone: "block",
    caption: "out-of-distribution episodes",
  },
  {
    label: "Episodes",
    value: "500",
    caption: "completed of 500",
  },
];

/** Policy comparison bars for the Run summary tab (correlation 0.929 to field). */
export interface PolicyRank {
  label: string;
  value: number;
  rank: string;
  winner?: boolean;
  /** Mono metric override (defaults to percent). */
  metric?: string;
}

export const policyComparison: PolicyRank[] = [
  { label: "Vendor B", value: 0.88, rank: "1", winner: true, metric: "0.88" },
  { label: "Team v4", value: 0.72, rank: "2", metric: "0.72" },
  { label: "Team v3", value: 0.66, rank: "3", metric: "0.66" },
  { label: "OpenVLA-7B", value: 0.58, rank: "4", metric: "0.58" },
  { label: "Scripted baseline", value: 0.41, rank: "5", metric: "0.41" },
];

/** Rank-fidelity note paired with the comparison. */
export const rankFidelity = {
  correlation: "0.929",
  caption:
    "Observed rank correlation between Blueprint predicted success and field results across prior validated runs. Predicts ordering, not guaranteed field success.",
};

export interface FailureCluster {
  id: string;
  label: string;
  count: number;
  /** Share of failed episodes, percent. */
  share: number;
  tone: SignalTone;
  note: string;
}

export const failureClusters: FailureCluster[] = [
  {
    id: "FC-01",
    label: "Grasp slip on frosted tote rim",
    count: 38,
    share: 27,
    tone: "block",
    note: "Concentrated in cold-aisle lighting; not seen in capture set.",
  },
  {
    id: "FC-02",
    label: "Mislocalize against reflective floor",
    count: 24,
    share: 17,
    tone: "warn",
    note: "Recovers within 2s in 70% of cases.",
  },
  {
    id: "FC-03",
    label: "Conveyor handoff overshoot",
    count: 19,
    share: 13,
    tone: "warn",
    note: "Timing offset at high belt speed.",
  },
  {
    id: "FC-04",
    label: "Stall on unexpected pallet jack",
    count: 11,
    share: 8,
    tone: "block",
    note: "Out-of-distribution dynamic obstacle.",
  },
];

/** Eval-card manifest rows for the Run detail Manifest tab. */
export const runManifest: ManifestRow[] = [
  { label: "Run ID", value: "RUN-2049" },
  { label: "Eval card", value: "EVAL-AUR-2049" },
  { label: "Paired site", value: "PACK-CONVEYOR-04" },
  { label: "Robot profile", value: "Generic 7-DOF arm + mobile base", mono: false },
  { label: "Episodes", value: "500" },
  { label: "Policies compared", value: "5" },
  { label: "Threshold", value: "success >= 0.70" },
  { label: "Advisory sim", value: "On (preflight only)", badge: { label: "Warn", tone: "warn" } },
  { label: "Started", value: "2026-06-21 09:14" },
  { label: "Completed", value: "2026-06-22 18:02" },
  { label: "Cost", value: "$15k" },
];

/** Rights & privacy rows for the Run detail Rights tab. */
export interface RightsItem {
  label: string;
  detail: string;
  level: "proof" | "warn" | "block" | "info";
}

export const rightsPrivacyItems: RightsItem[] = [
  {
    label: "Site capture rights",
    detail: "Licensed for evaluation use through 2027-05-30. Resale of raw capture withheld.",
    level: "proof",
  },
  {
    label: "Privacy scrub",
    detail: "Faces and license plates blurred at capture. Operator PII redacted from manifest.",
    level: "proof",
  },
  {
    label: "Provenance chain",
    detail: "Signed capture-to-eval chain intact. No re-encoding gaps detected.",
    level: "proof",
  },
  {
    label: "Generated media",
    detail:
      "Any preview clips on this run are generated/simulated review support — not real-world proof of performance.",
    level: "warn",
  },
  {
    label: "Export scope limit",
    detail: "Field deployment outside the licensed window is out of scope for this package.",
    level: "block",
  },
];

/* -------------------------------------------------------------------------- */
/*  Policies registry                                                         */
/* -------------------------------------------------------------------------- */

export type PolicyType = "checkpoint" | "API runner" | "VLA";

export interface PolicyRecord {
  id: string;
  name: string;
  type: PolicyType;
  /** Endpoint or checkpoint ref (mono). */
  ref: string;
  lastEval: string;
  /** Best observed predicted success, 0–1. */
  best: number;
  status: StatusBadge;
}

export const policies: PolicyRecord[] = [
  {
    id: "POL-V4",
    name: "Team v4",
    type: "checkpoint",
    ref: "ckpt://northwind/v4-20260618.pt",
    lastEval: "2026-06-21",
    best: 0.72,
    status: { label: "Active", tone: "proof" },
  },
  {
    id: "POL-V3",
    name: "Team v3",
    type: "checkpoint",
    ref: "ckpt://northwind/v3-20260512.pt",
    lastEval: "2026-06-12",
    best: 0.66,
    status: { label: "Active", tone: "proof" },
  },
  {
    id: "POL-API",
    name: "Vendor B",
    type: "API runner",
    ref: "https://api.vendorb.ai/act/v2",
    lastEval: "2026-06-21",
    best: 0.88,
    status: { label: "Active", tone: "proof" },
  },
  {
    id: "POL-VLA",
    name: "OpenVLA-7B",
    type: "VLA",
    ref: "hf://openvla/openvla-7b",
    lastEval: "2026-06-21",
    best: 0.58,
    status: { label: "Reference", tone: "info" },
  },
  {
    id: "POL-V5",
    name: "Team v5 (candidate)",
    type: "checkpoint",
    ref: "ckpt://northwind/v5-rc1.pt",
    lastEval: "—",
    best: 0,
    status: { label: "Pending eval", tone: "warn" },
  },
];

/* -------------------------------------------------------------------------- */
/*  Data Packages                                                             */
/* -------------------------------------------------------------------------- */

export type DataPackageStatus = "Ready" | "Building" | "Queued";

const dataPackageTone: Record<DataPackageStatus, SignalTone> = {
  Ready: "proof",
  Building: "warn",
  Queued: "neutral",
};

export function statusToneForPackage(status: DataPackageStatus): SignalTone {
  return dataPackageTone[status];
}

export interface DataPackage {
  id: string;
  source: string;
  episodes: number;
  format: string;
  size: string;
  status: DataPackageStatus;
}

export const dataPackages: DataPackage[] = [
  {
    id: "DP-AUR-2049",
    source: "RUN-2049 · Aurora tote retrieval",
    episodes: 500,
    format: "RLDS + MP4 proxies",
    size: "82.4 GB",
    status: "Ready",
  },
  {
    id: "DP-TUL-2042",
    source: "RUN-2042 · Tulsa inspection",
    episodes: 500,
    format: "RLDS + MP4 proxies",
    size: "76.1 GB",
    status: "Ready",
  },
  {
    id: "DP-RNO-2051",
    source: "RUN-2051 · Reno carton sealing",
    episodes: 500,
    format: "RLDS + MP4 proxies",
    size: "—",
    status: "Building",
  },
  {
    id: "DP-SAC-2039",
    source: "RUN-2039 · Sacramento towel fold",
    episodes: 100,
    format: "HDF5",
    size: "14.7 GB",
    status: "Ready",
  },
  {
    id: "DP-BOI-2055",
    source: "RUN-2055 · Boise pallet stage",
    episodes: 100,
    format: "RLDS",
    size: "—",
    status: "Queued",
  },
];

/** Export-scope note for the Data Packages proof boundary. */
export const exportScopeNote =
  "Exports are licensed for evaluation and model training within your access window. " +
  "Raw capture redistribution and field deployment outside the window remain out of scope.";

/* -------------------------------------------------------------------------- */
/*  Entitlements                                                              */
/* -------------------------------------------------------------------------- */

export const entitlementMetrics: MetricTile[] = [
  { label: "Plan", value: "Subscription", caption: "$15k / mo" },
  { label: "Active policies", value: "3 / 5", caption: "slots in use" },
  { label: "Licensed sites", value: "6", caption: "4 validated" },
  { label: "Spend MTD", value: "$48.5k", deltaTone: "warn", delta: "+$15k vs plan" },
];

export interface LicensedSite {
  id: string;
  site: string;
  task: string;
  access: StatusBadge;
  /** Mono access window. */
  window: string;
  /** Scope summary. */
  scope: string;
}

export const licensedSites: LicensedSite[] = [
  {
    id: "ENT-AUR-04",
    site: "Linde Cold Storage — Aurora",
    task: "Tote retrieval to conveyor",
    access: { label: "Active", tone: "proof" },
    window: "2026-05-30 → 2027-05-30",
    scope: "Eval + training export",
  },
  {
    id: "ENT-RNO-02",
    site: "Cedar Packing Co — Reno",
    task: "Carton sealing at packing cell",
    access: { label: "Active", tone: "proof" },
    window: "2026-06-02 → 2027-06-02",
    scope: "Eval + training export",
  },
  {
    id: "ENT-TUL-01",
    site: "Riverside Inspection Bench — Tulsa",
    task: "Part inspection + reject sort",
    access: { label: "Active", tone: "proof" },
    window: "2026-05-22 → 2027-05-22",
    scope: "Eval only",
  },
  {
    id: "ENT-CHI-07",
    site: "Halsted Retail Backroom — Chicago",
    task: "Restock cart to shelf",
    access: { label: "Recapture", tone: "warn" },
    window: "2026-06-09 → 2027-06-09",
    scope: "Eval only",
  },
  {
    id: "ENT-BOI-05",
    site: "Granite Loading Dock — Boise",
    task: "Pallet stage to dock door",
    access: { label: "Pending", tone: "neutral" },
    window: "Activates on validation",
    scope: "Eval only",
  },
];

/* -------------------------------------------------------------------------- */
/*  Run-summary cost map (kickoff live cost)                                  */
/* -------------------------------------------------------------------------- */

/** Map episode count → mono cost for live run-summary updates. */
export const runCostByEpisodes: Record<number, string> = {
  100: "$6.5k",
  500: "$15k",
};
