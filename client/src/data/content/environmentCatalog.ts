import type { EnvironmentCategory, EnvironmentPolicy } from "./types";

export const environmentCategories: EnvironmentCategory[] = [
  {
    title: "Kitchens",
    slug: "kitchens",
    heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Commercial prep lines, dish pits, and quick-serve stations with articulated appliances ready for pick-and-place training.",
    tags: ["Indoor", "Industrial"],
    scenes: ["modular-kitchen-line", "dishroom-articulation", "chef-prep-station"],
  },
  {
    title: "Grocery Aisles",
    slug: "grocery-aisles",
    heroImage: "https://images.unsplash.com/photo-1586202692873-0227667ccf6b?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Planogrammed aisles with stocked SKUs, cart interactions, and articulated refrigeration for restocking policies.",
    tags: ["Retail", "Indoor"],
    scenes: ["grocery-endcap-kit", "refrigerated-aisle", "bulk-dry-goods"],
  },
  {
    title: "Warehouse Lanes",
    slug: "warehouse-lanes",
    heroImage: "https://images.unsplash.com/photo-OnbSOhz0oig?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Racked inventory corridors with pallets, totes, and AMR-clearances tuned for perception and manipulation.",
    tags: ["Industrial"],
    scenes: ["tote-pick-lane", "cross-dock-staging", "pallet-buffer-zone"],
  },
  {
    title: "Loading Docks",
    slug: "loading-docks",
    heroImage: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Configurable bays with liftgates, restraints, and staging pallets for dock automation trials.",
    tags: ["Industrial", "Outdoor"],
    scenes: ["dock-high-bay", "parcel-sort-alcove"],
  },
  {
    title: "Labs",
    slug: "labs",
    heroImage: "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Wet lab benches, articulated enclosures, and sensor-ready fixtures with precise metric setups.",
    tags: ["Indoor"],
    scenes: ["bioreactor-suite", "sample-prep-lab"],
  },
  {
    title: "Office Pods",
    slug: "office-pods",
    heroImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Focus rooms, hot desks, and service nooks featuring doors, drawers, and switchgear for manipulation policies.",
    tags: ["Indoor"],
    scenes: ["service-pantry", "focus-room-pair"],
  },
  {
    title: "Utility Rooms",
    slug: "utility-rooms",
    heroImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Back-of-house closets with valves, panels, and service clearances tuned for inspection routines.",
    tags: ["Industrial"],
    scenes: ["janitorial-closet", "mechanical-room"],
  },
  {
    title: "Home Laundry",
    slug: "home-laundry",
    heroImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Consumer-grade washer/dryer stacks with articulated doors, knobs, and hampers for assistive robotics research.",
    tags: ["Home"],
    scenes: ["laundry-alcove"],
  },
];

export const environmentPolicies: EnvironmentPolicy[] = [
  {
    slug: "dexterous-pick-place",
    title: "Dexterous Pick & Place Curriculum",
    focus: "Manipulation",
    cadence: "Weekly sim pushes",
    summary:
      "Cluttered pick-and-place loops tuned against ManiSkill3, RLBench, and Isaac Manipulator success criteria.",
    coverage: [
      "Shelf, tote, and countertop pick-place runs aligned with 2025 ManiSkill3 evaluation splits",
      "Clutter removal and table reset sequences with RLBench multi-stage rewards",
      "Domain-randomized grasp sets spanning suction, two-finger, and soft grippers",
    ],
    metric: "92% success on ManiSkill3 multi-object pick benchmark",
    environments: ["kitchens", "grocery-aisles", "warehouse-lanes"],
  },
  {
    slug: "articulated-access-validation",
    title: "Articulated Access Validation",
    focus: "Articulation",
    cadence: "Nightly regression",
    summary:
      "Door, drawer, and appliance articulation policies benchmarked with Isaac Sim articulation inspector baselines.",
    coverage: [
      "Hinge and slider trajectories sourced from RLBench and ARMBench articulated-object suites",
      "Pose targets for multi-stage cabinet access with torque envelope monitoring",
      "Failure replay logging for latch, gasket, and seal compliance checks",
    ],
    metric: "Maintains <2° closure error across 500-cycle regressions",
    environments: ["kitchens", "office-pods", "labs", "utility-rooms"],
  },
  {
    slug: "panel-interaction-suite",
    title: "Panel Interaction Suite",
    focus: "Controls",
    cadence: "Continuous integration",
    summary:
      "Buttons, switches, and dial manipulation policies validated against Control Suite 2025 panel tasks.",
    coverage: [
      "IEC-compliant switch toggles with Isaac Sim event instrumentation",
      "Dial sweep calibration derived from ALOHA and Isaac Panel benchmark references",
      "Pushbutton actuation with latency targets for status acknowledgement",
    ],
    metric: "<500 ms control acknowledgement across regression runs",
    environments: ["utility-rooms", "labs", "office-pods"],
  },
  {
    slug: "mixed-sku-logistics",
    title: "Mixed-SKU Logistics Handling",
    focus: "Logistics",
    cadence: "Shift open & close",
    summary:
      "Bin picking, induction, and palletizing curricula used in 2025 AMR + arm logistics pilots.",
    coverage: [
      "Mixed-item grasp planning with Isaac perception models and DGX synthetic depth sweeps",
      "Dynamic pallet build scripts for 48×40 and Euro pallets with collision-aware stacking",
      "Exception tagging for tote overhang, void fill, and dunnage placement",
    ],
    metric: "Targets <3% drop rate across 1k simulated picks",
    environments: ["warehouse-lanes", "loading-docks"],
  },
  {
    slug: "precision-insertion-assembly",
    title: "Precision Insertion & Assembly",
    focus: "Assembly",
    cadence: "Weekly hardware sync",
    summary:
      "Peg-in-hole, connector insertion, and cable routing benchmarks aligned with 2026 electronics assembly lines.",
    coverage: [
      "Force-limited peg and plug insertion tasks derived from ARMBench connectors",
      "Cable routing and clip fastening trajectories with impedance-controlled approach phases",
      "Fastener seating verification with torque and vision cross-checks",
    ],
    metric: "<0.5 mm positional drift across 10k simulated insertions",
    environments: ["labs", "utility-rooms"],
  },
  {
    slug: "laundry-folding-assist",
    title: "Laundry Sorting & Folding Assist",
    focus: "Home Services",
    cadence: "Biweekly sim QA",
    summary:
      "Bedroom and laundry alcove routines tuned for hamper pickup, garment classification, and fold placement autonomy.",
    coverage: [
      "Washer, dryer, and hamper retrieval loops with Isaac Manipulator cloth proxies",
      "Garment spread, fold, and stack sequences referencing FoldingBench and ALOHA laundry baselines",
      "Closet handoff routines with hanger alignment and dresser drawer organization checks",
    ],
    metric: "Maintains 88% fold quality on FoldingBench long-horizon tasks",
    environments: ["home-laundry"],
  },
];
