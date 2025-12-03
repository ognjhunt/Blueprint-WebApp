export type InteractionType =
  | "revolute"
  | "prismatic"
  | "pickable"
  | "button"
  | "knob"
  | "switch";

export interface Interaction {
  component: string;
  type: InteractionType;
  axis: string;
  limits: string;
  notes?: string;
}

export interface Scene {
  title: string;
  slug: string;
  thumb: string;
  gallery: string[];
  categories: string[];
  tags: string[];
  usdVersion: string;
  units: string;
  materials: string;
  interactions: Interaction[];
  colliders: string;
  replicator?: string;
  testedWith: string;
  leadTime: string;
  download?: string;
  ctaText: string;
  seo: string;
  highlights: string[];
}

export interface EnvironmentCategory {
  title: string;
  slug: string;
  heroImage: string;
  summary: string;
  tags: string[];
  scenes: string[];
}

export interface EnvironmentPolicy {
  slug: string;
  title: string;
  focus: string;
  cadence: string;
  summary: string;
  coverage: string[];
  metric?: string;
  environments: string[];
}

export interface SyntheticDataset {
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  pricePerScene: number;
  sceneCount: number;
  variantCount: number;
  releaseDate: string;
  tags: string[];
  randomizerScripts: string[];
  deliverables: string[];
  isNew?: boolean;
  standardPricePerScene?: number; // For showing discount
  isFeatured?: boolean;
  isTrending?: boolean;
}

// Individual scene product for marketplace
export interface MarketplaceScene {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  locationType: string;
  policySlugs: string[];
  objectTags: string[];
  price: number; // Individual scene price
  variantCount?: number;
  releaseDate: string;
  tags: string[];
  deliverables: string[];
  interactions?: string[]; // e.g., ["Revolute doors", "Prismatic drawers"]
  isNew?: boolean;
  isFeatured?: boolean;
  inStock?: boolean;
}

// Union type for marketplace items
export type MarketplaceItem =
  | (SyntheticDataset & { itemType: 'dataset' })
  | (MarketplaceScene & { itemType: 'scene' });

export interface CaseStudy {
  title: string;
  slug: string;
  summary: string;
  hero: string;
  body: string;
  outcomes: string[];
  cta: string;
}

export interface Job {
  title: string;
  type: string;
  location: string;
  summary: string;
  description: string;
  applyEmail: string;
}

export const environmentCategories: EnvironmentCategory[] = [
  {
    title: "Kitchens",
    slug: "kitchens",
    heroImage: "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
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
    heroImage: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
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
      "Domain-randomized grasp sets spanning suction, parallel jaw, and soft grippers",
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

export const syntheticDatasets: SyntheticDataset[] = [
  {
    slug: "prep-line-essentials",
    title: "Prep-Line Essentials",
    description:
      "150-scene bundle covering prep tables, dish pits, and service pass-throughs with drawer, door, and appliance articulation baked in.",
    heroImage:
      "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1600&q=80",
    locationType: "Kitchens",
    policySlugs: [
      "dexterous-pick-place",
      "articulated-access-validation",
      "panel-interaction-suite",
    ],
    objectTags: ["drawers", "dishwashers", "utensils", "appliances"],
    pricePerScene: 65,
    standardPricePerScene: 185,
    sceneCount: 150,
    variantCount: 8,
    releaseDate: "2024-12-12",
    tags: ["Articulated", "Plug & Play", "USD"],
    randomizerScripts: [
      "Lighting drift",
      "Stock level shuffle",
      "Tool clutter permutations",
    ],
    deliverables: ["USD / Isaac 4.x", "Isaac 5.x", "Replicator semantics"],
    isNew: true,
    isFeatured: true,
  },
  {
    slug: "retail-restock-loop",
    title: "Retail Restock Loop",
    description:
      "110 grocery and convenience aisles with planogrammed shelving, refrigeration bays, and pallet drops for mixed-SKU restock policies.",
    heroImage:
      "https://images.unsplash.com/photo-1586202692873-0227667ccf6b?auto=format&fit=crop&w=1600&q=80",
    locationType: "Grocery / Retail",
    policySlugs: ["dexterous-pick-place", "mixed-sku-logistics"],
    objectTags: ["shelves", "pallets", "totes", "coolers"],
    pricePerScene: 58,
    standardPricePerScene: 175,
    sceneCount: 110,
    variantCount: 6,
    releaseDate: "2024-12-05",
    tags: ["Retail", "High SKU", "Randomized"],
    randomizerScripts: ["SKU swaps", "Cart clutter", "Lighting color temp"],
    deliverables: ["USD", "Onshape", "Synthetic sensor captures"],
    isFeatured: true,
  },
  {
    slug: "warehouse-flow-kit",
    title: "Warehouse Flow Kit",
    description:
      "200-lane dataset covering cross-dock staging, tote picking, and pallet buffers tuned for AMR and arm-on-rail deployments.",
    heroImage:
      "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1600&q=80",
    locationType: "Warehouses",
    policySlugs: ["mixed-sku-logistics", "dexterous-pick-place"],
    objectTags: ["pallets", "totes", "cartons", "racking"],
    pricePerScene: 72,
    standardPricePerScene: 195,
    sceneCount: 200,
    variantCount: 10,
    releaseDate: "2024-11-28",
    tags: ["Industrial", "Heavy lift", "Conveyor-ready"],
    randomizerScripts: [
      "Forklift traffic",
      "Pallet height shuffle",
      "Spill + debris events",
    ],
    deliverables: ["USD", "URDF", "Isaac Mission playback"],
    isFeatured: true,
    isTrending: true,
  },
  {
    slug: "lab-procedures-pack",
    title: "Lab Procedures Pack",
    description:
      "65 precision lab benches with gloveboxes, articulated enclosures, and sample handoff tooling for panel + insertion curricula.",
    heroImage:
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1600&q=80",
    locationType: "Labs",
    policySlugs: [
      "panel-interaction-suite",
      "precision-insertion-assembly",
    ],
    objectTags: ["valves", "switches", "drawers", "sample racks"],
    pricePerScene: 84,
    standardPricePerScene: 220,
    sceneCount: 65,
    variantCount: 5,
    releaseDate: "2024-11-22",
    tags: ["Cleanroom", "Controls", "QA"],
    randomizerScripts: ["Gauge offsets", "Cabinet wiring", "Consumable clutter"],
    deliverables: ["USD", "STEP", "Semantic layers"],
  },
  {
    slug: "utility-panel-tour",
    title: "Utility Panel Tour",
    description:
      "90 mechanical rooms and utility closets with valves, breakers, and switches for inspection and panel interaction testing.",
    heroImage:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80",
    locationType: "Utility Rooms",
    policySlugs: ["panel-interaction-suite"],
    objectTags: ["breakers", "knobs", "switches", "valves"],
    pricePerScene: 52,
    standardPricePerScene: 150,
    sceneCount: 90,
    variantCount: 4,
    releaseDate: "2024-11-18",
    tags: ["Inspection", "Low light", "Compact"],
    randomizerScripts: ["Status LEDs", "Valve state", "Dust + grime"],
    deliverables: ["USD", "GLTF", "Event scripts"],
  },
  {
    slug: "laundry-assist-starter",
    title: "Laundry Assist Starter",
    description:
      "50 assistive home laundry alcoves with washers, dryers, and hampers for folding and transfer training.",
    heroImage:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
    locationType: "Home / Assistive",
    policySlugs: ["laundry-folding-assist"],
    objectTags: ["washers", "dryers", "hampers", "folding tables"],
    pricePerScene: 50,
    standardPricePerScene: 165,
    sceneCount: 50,
    variantCount: 3,
    releaseDate: "2024-11-12",
    tags: ["Assistive", "Household", "Soft goods"],
    randomizerScripts: ["Fabric types", "Lighting temp", "Clutter"],
    deliverables: ["USD", "URDF", "Teleop demos"],
  },
];

// Individual marketplace scenes for direct purchase
export const marketplaceScenes: MarketplaceScene[] = [
  {
    slug: "commercial-dishroom-station",
    title: "Commercial Dishroom Station",
    description: "High-traffic dishwashing station with articulated rack loaders, spray nozzles, and drying shelves for manipulation training.",
    thumbnail: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80",
    locationType: "Kitchens",
    policySlugs: ["dexterous-pick-place", "articulated-access-validation"],
    objectTags: ["dishwashers", "shelves", "utensils"],
    price: 185,
    variantCount: 3,
    releaseDate: "2024-12-01",
    tags: ["Articulated", "High-detail", "USD"],
    deliverables: ["USD / Isaac 4.x", "Replicator semantics"],
    interactions: ["Revolute rack doors", "Prismatic shelves"],
    inStock: true,
    isFeatured: true,
  },
  {
    slug: "grocery-refrigeration-bay",
    title: "Grocery Refrigeration Bay",
    description: "Walk-in refrigeration unit with articulated doors, stocked shelves, and temperature monitoring for retail restocking.",
    thumbnail: "https://images.unsplash.com/photo-1534723328310-e82dad3ee43f?auto=format&fit=crop&w=800&q=80",
    locationType: "Grocery / Retail",
    policySlugs: ["dexterous-pick-place", "mixed-sku-logistics"],
    objectTags: ["coolers", "shelves", "totes"],
    price: 195,
    variantCount: 2,
    releaseDate: "2024-11-29",
    tags: ["Retail", "Cold storage", "Randomized"],
    deliverables: ["USD", "Synthetic sensor captures"],
    interactions: ["Revolute doors", "Adjustable shelving"],
    inStock: true,
  },
  {
    slug: "warehouse-pallet-buffer",
    title: "Warehouse Pallet Buffer Zone",
    description: "Staging area with mixed pallet heights, wrapped goods, and forklift clearances for logistics training.",
    thumbnail: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80",
    locationType: "Warehouses",
    policySlugs: ["mixed-sku-logistics"],
    objectTags: ["pallets", "cartons", "racking"],
    price: 175,
    releaseDate: "2024-11-25",
    tags: ["Industrial", "Heavy lift"],
    deliverables: ["USD", "URDF"],
    interactions: ["Pallet jack handles"],
    inStock: true,
  },
  {
    slug: "precision-lab-glovebox",
    title: "Precision Lab Glovebox",
    description: "Sealed glovebox enclosure with articulated glove ports, pass-through chambers, and sample handling fixtures.",
    thumbnail: "https://images.unsplash.com/photo-1582719478250-c6a3d60d1f6e?auto=format&fit=crop&w=800&q=80",
    locationType: "Labs",
    policySlugs: ["precision-insertion-assembly", "panel-interaction-suite"],
    objectTags: ["sample racks", "valves", "drawers"],
    price: 220,
    variantCount: 2,
    releaseDate: "2024-11-20",
    tags: ["Cleanroom", "Precision", "Controls"],
    deliverables: ["USD", "STEP", "Semantic layers"],
    interactions: ["Revolute access ports", "Prismatic drawers"],
    inStock: true,
    isNew: true,
  },
  {
    slug: "service-corridor-panel",
    title: "Service Corridor Control Panel",
    description: "Wall-mounted electrical panel with breakers, switches, and status LEDs for inspection and control training.",
    thumbnail: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
    locationType: "Utility Rooms",
    policySlugs: ["panel-interaction-suite"],
    objectTags: ["breakers", "switches", "knobs"],
    price: 150,
    releaseDate: "2024-11-18",
    tags: ["Inspection", "Controls", "Compact"],
    deliverables: ["USD", "Event scripts"],
    interactions: ["Toggle switches", "Rotary breakers"],
    inStock: true,
  },
  {
    slug: "home-washer-dryer-stack",
    title: "Home Washer-Dryer Stack",
    description: "Residential laundry pair with articulated doors, control dials, and detergent dispensers for assistive robotics.",
    thumbnail: "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80",
    locationType: "Home / Assistive",
    policySlugs: ["laundry-folding-assist"],
    objectTags: ["washers", "dryers", "hampers"],
    price: 165,
    variantCount: 2,
    releaseDate: "2024-11-15",
    tags: ["Assistive", "Household"],
    deliverables: ["USD", "URDF"],
    interactions: ["Revolute doors", "Rotary dials"],
    inStock: true,
  },
  {
    slug: "prep-table-articulated",
    title: "Prep Table with Articulated Storage",
    description: "Commercial prep station featuring under-counter drawers, cutting boards, and utensil racks for kitchen manipulation.",
    thumbnail: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
    locationType: "Kitchens",
    policySlugs: ["dexterous-pick-place", "articulated-access-validation"],
    objectTags: ["drawers", "utensils", "appliances"],
    price: 170,
    variantCount: 4,
    releaseDate: "2024-12-08",
    tags: ["Articulated", "USD"],
    deliverables: ["USD / Isaac 4.x", "Isaac 5.x"],
    interactions: ["Prismatic drawers", "Removable utensils"],
    inStock: true,
    isNew: true,
  },
  {
    slug: "retail-checkout-counter",
    title: "Retail Checkout Counter",
    description: "Point-of-sale station with scanner, cash drawer, bagging area, and payment terminal for retail automation.",
    thumbnail: "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&w=800&q=80",
    locationType: "Grocery / Retail",
    policySlugs: ["dexterous-pick-place", "panel-interaction-suite"],
    objectTags: ["drawers", "shelves"],
    price: 190,
    releaseDate: "2024-11-27",
    tags: ["Retail", "POS", "Articulated"],
    deliverables: ["USD", "Synthetic sensor captures"],
    interactions: ["Cash drawer slide", "Touchscreen panel"],
    inStock: true,
  },
  {
    slug: "cross-dock-staging-zone",
    title: "Cross-Dock Staging Zone",
    description: "Loading dock staging area with pallet positions, restraints, and clearance markers for logistics workflows.",
    thumbnail: "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=800&q=80",
    locationType: "Warehouses",
    policySlugs: ["mixed-sku-logistics", "dexterous-pick-place"],
    objectTags: ["pallets", "totes"],
    price: 180,
    releaseDate: "2024-11-23",
    tags: ["Industrial", "Logistics"],
    deliverables: ["USD", "Isaac Mission playback"],
    interactions: ["Pallet jack", "Dock leveler"],
    inStock: true,
  },
  {
    slug: "sample-prep-workbench",
    title: "Sample Prep Workbench",
    description: "Laboratory workbench with articulated equipment mounts, sample racks, and precision measurement tools.",
    thumbnail: "https://images.unsplash.com/photo-1582719366127-dac0e1b08b0a?auto=format&fit=crop&w=800&q=80",
    locationType: "Labs",
    policySlugs: ["precision-insertion-assembly"],
    objectTags: ["sample racks", "drawers"],
    price: 210,
    variantCount: 3,
    releaseDate: "2024-11-19",
    tags: ["Precision", "Assembly"],
    deliverables: ["USD", "STEP"],
    interactions: ["Microscope mount", "Tool holders"],
    inStock: true,
  },
  {
    slug: "mechanical-room-valve-bank",
    title: "Mechanical Room Valve Bank",
    description: "Industrial valve cluster with pressure gauges, shut-off valves, and piping for inspection routines.",
    thumbnail: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
    locationType: "Utility Rooms",
    policySlugs: ["panel-interaction-suite"],
    objectTags: ["valves", "knobs"],
    price: 155,
    releaseDate: "2024-11-17",
    tags: ["Inspection", "Industrial"],
    deliverables: ["USD", "GLTF"],
    interactions: ["Rotary valves", "Pressure gauges"],
    inStock: true,
  },
  {
    slug: "folding-station-deluxe",
    title: "Folding Station Deluxe",
    description: "Dedicated folding table with hanging rod, sorted bins, and shelf organization for laundry automation.",
    thumbnail: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80",
    locationType: "Home / Assistive",
    policySlugs: ["laundry-folding-assist"],
    objectTags: ["folding tables", "hampers"],
    price: 160,
    releaseDate: "2024-11-14",
    tags: ["Assistive", "Soft goods"],
    deliverables: ["USD", "Teleop demos"],
    interactions: ["Hanging rod", "Sorting bins"],
    inStock: true,
  },
  {
    slug: "quick-serve-pass-window",
    title: "Quick-Serve Pass Window",
    description: "Kitchen service window with warming shelves, order displays, and condiment stations for food service automation.",
    thumbnail: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    locationType: "Kitchens",
    policySlugs: ["dexterous-pick-place"],
    objectTags: ["shelves", "appliances"],
    price: 175,
    variantCount: 2,
    releaseDate: "2024-12-02",
    tags: ["Food service", "Articulated"],
    deliverables: ["USD / Isaac 4.x"],
    interactions: ["Sliding window", "Warming trays"],
    inStock: true,
  },
  {
    slug: "pharmacy-dispensing-unit",
    title: "Pharmacy Dispensing Unit",
    description: "Secure medication cabinet with lockable drawers, label printer, and counting tray for pharmaceutical automation.",
    thumbnail: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80",
    locationType: "Grocery / Retail",
    policySlugs: ["dexterous-pick-place", "precision-insertion-assembly"],
    objectTags: ["drawers", "shelves"],
    price: 225,
    variantCount: 1,
    releaseDate: "2024-11-30",
    tags: ["Healthcare", "Precision", "Secure"],
    deliverables: ["USD", "Semantic layers"],
    interactions: ["Locking drawers", "Label dispenser"],
    inStock: true,
    isFeatured: true,
  },
  {
    slug: "tote-picking-aisle",
    title: "Tote Picking Aisle",
    description: "Narrow warehouse aisle with tote racks, barcode scanners, and mobile robot clearances for order fulfillment.",
    thumbnail: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    locationType: "Warehouses",
    policySlugs: ["mixed-sku-logistics", "dexterous-pick-place"],
    objectTags: ["totes", "racking"],
    price: 185,
    releaseDate: "2024-11-24",
    tags: ["Industrial", "AMR-ready"],
    deliverables: ["USD", "URDF"],
    interactions: ["Tote slides", "Rack access"],
    inStock: true,
  },
  {
    slug: "cleanroom-airlockstation",
    title: "Cleanroom Airlock Station",
    description: "Dual-door cleanroom entry with garment hooks, shoe covers, and air shower controls for contamination control.",
    thumbnail: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
    locationType: "Labs",
    policySlugs: ["articulated-access-validation", "panel-interaction-suite"],
    objectTags: ["doors", "switches"],
    price: 200,
    variantCount: 2,
    releaseDate: "2024-11-21",
    tags: ["Cleanroom", "Safety"],
    deliverables: ["USD", "Event scripts"],
    interactions: ["Revolute doors", "Control buttons"],
    inStock: true,
  },
  {
    slug: "hvac-control-hub",
    title: "HVAC Control Hub",
    description: "Climate control panel with thermostats, damper controls, and airflow sensors for building automation.",
    thumbnail: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80",
    locationType: "Utility Rooms",
    policySlugs: ["panel-interaction-suite"],
    objectTags: ["switches", "knobs"],
    price: 165,
    releaseDate: "2024-11-16",
    tags: ["HVAC", "Controls"],
    deliverables: ["USD", "GLTF"],
    interactions: ["Dial controls", "Digital displays"],
    inStock: true,
  },
  {
    slug: "bedroom-closet-organizer",
    title: "Bedroom Closet Organizer",
    description: "Walk-in closet system with hanging rods, drawer units, and shoe racks for home organization automation.",
    thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
    locationType: "Home / Assistive",
    policySlugs: ["laundry-folding-assist", "articulated-access-validation"],
    objectTags: ["drawers", "hampers"],
    price: 180,
    variantCount: 3,
    releaseDate: "2024-11-13",
    tags: ["Assistive", "Organization"],
    deliverables: ["USD"],
    interactions: ["Sliding doors", "Pull-out drawers"],
    inStock: true,
  },
];

export const scenes: Scene[] = [
  {
    title: "Modular Kitchen Line",
    slug: "modular-kitchen-line",
    thumb: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["kitchens"],
    tags: ["Indoor", "Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR + OpenPBR surface overrides",
    interactions: [
      {
        component: "Oven Door",
        type: "revolute",
        axis: "Y",
        limits: "0° – 105°",
        notes: "Soft-close damping curve",
      },
      {
        component: "Prep Drawer",
        type: "prismatic",
        axis: "Z",
        limits: "0m – 0.45m",
      },
      {
        component: "Stock Pot",
        type: "pickable",
        axis: "",
        limits: "",
        notes: "Pivot-aligned for compliant grasping",
      },
    ],
    colliders: "Hybrid convex decomposition",
    replicator: "Semantic labels for appliances, storage, surfaces",
    testedWith: "Simulation QA suite",
    leadTime: "5 business days",
    download: "https://tryblueprint.io/assets/modular-kitchen-line.usdz",
    ctaText: "Request this scene",
    seo: "SimReady commercial kitchen line with articulated appliances for robotics training.",
    highlights: [
      "Captured base mesh finished for watertight topology",
      "Link-separated appliances with clean pivots",
      "Physics materials tuned for sliding, grasping, heat zones",
    ],
  },
  {
    title: "Dishroom Articulation Pack",
    slug: "dishroom-articulation",
    thumb: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["kitchens"],
    tags: ["Indoor", "Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR stainless, roughness sweeps",
    interactions: [
      {
        component: "Dishwasher Door",
        type: "revolute",
        axis: "X",
        limits: "0° – 95°",
      },
      {
        component: "Rack Lift",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.38m",
      },
      {
        component: "Control Buttons",
        type: "button",
        axis: "",
        limits: "",
        notes: "Discrete event hooks for policy triggers",
      },
    ],
    colliders: "Signed distance fields for enclosures",
    replicator: "Surface class + SKU tags",
    testedWith: "Simulation QA suite",
    leadTime: "7 business days",
    ctaText: "Book a build",
    seo: "SimReady dishroom with revolute doors and prismatic racks for articulated policy training.",
    highlights: [
      "High-gloss stainless with baked AO",
      "Collision capsules for hose routing",
      "LOD1 for headsets and remote review",
    ],
  },
  {
    title: "Chef Prep Station",
    slug: "chef-prep-station",
    thumb: "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["kitchens"],
    tags: ["Indoor", "Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "OpenPBR with specular workflow",
    interactions: [
      {
        component: "Prep Fridge",
        type: "revolute",
        axis: "Z",
        limits: "0° – 90°",
      },
      {
        component: "Ingredient Bins",
        type: "pickable",
        axis: "",
        limits: "",
      },
      {
        component: "Herb Drawer",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.25m",
      },
    ],
    colliders: "Compound convex hulls",
    testedWith: "Simulation QA suite",
    leadTime: "5 business days",
    ctaText: "Add to pipeline",
    seo: "Chef prep station with articulated cold storage and labeled ingredient bins.",
    highlights: [
      "UV-packed to 0-1 for fast texture swaps",
      "Semantic layers for surfaces and utensils",
      "Countertop friction tuned for pick-place",
    ],
  },
  {
    title: "Grocery Endcap Kit",
    slug: "grocery-endcap-kit",
    thumb: "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["grocery-aisles"],
    tags: ["Retail", "Indoor"],
    usdVersion: "USD 23.05",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Display Shelves",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.2m",
        notes: "Adjustable shelf heights",
      },
      {
        component: "Promo Button",
        type: "button",
        axis: "",
        limits: "",
      },
      {
        component: "Sample Basket",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Box + convex mix",
    replicator: "SKU families with class labels",
    testedWith: "Simulation QA suite",
    leadTime: "4 business days",
    ctaText: "Request planogram",
    seo: "Retail endcap with adjustable shelving and labeled products for stocking policies.",
    highlights: [
      "Planogram CSV import ready",
      "LOD1/LOD2 for perception sweeps",
      "Cart clearance volumes baked",
    ],
  },
  {
    title: "Refrigerated Aisle",
    slug: "refrigerated-aisle",
    thumb: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["grocery-aisles"],
    tags: ["Retail", "Indoor"],
    usdVersion: "USD 23.05",
    units: "Meters",
    materials: "PBR glass + emissive",
    interactions: [
      {
        component: "Cooler Doors",
        type: "revolute",
        axis: "Z",
        limits: "0° – 95°",
      },
      {
        component: "Shelf Slides",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.18m",
      },
      {
        component: "Product Packs",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex decomp with door sweep volumes",
    testedWith: "Simulation QA suite",
    leadTime: "6 business days",
    ctaText: "Schedule a build",
    seo: "SimReady refrigerated grocery aisle with articulated doors and shelf slides.",
    highlights: [
      "Thermal gradients for sensor testing",
      "Per-door hinge metadata",
      "Product label layers for perception",
    ],
  },
  {
    title: "Bulk Dry Goods",
    slug: "bulk-dry-goods",
    thumb: "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["grocery-aisles"],
    tags: ["Retail"],
    usdVersion: "USD 23.05",
    units: "Meters",
    materials: "OpenPBR granular",
    interactions: [
      {
        component: "Gravity Bins",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.3m",
      },
      {
        component: "Dispense Handles",
        type: "revolute",
        axis: "X",
        limits: "0° – 60°",
      },
      {
        component: "Scale Buttons",
        type: "button",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex hulls",
    testedWith: "Simulation QA suite",
    leadTime: "5 business days",
    ctaText: "Add to quote",
    seo: "Bulk dry goods aisle with articulated dispensers and scale for manipulation tasks.",
    highlights: [
      "Seeded variations for dataset diversity",
      "Embedded signage metadata",
      "Material IDs for granular fill levels",
    ],
  },
  {
    title: "Tote Pick Lane",
    slug: "tote-pick-lane",
    thumb: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["warehouse-lanes"],
    tags: ["Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Tote Guides",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.12m",
      },
      {
        component: "Rack Safety Gate",
        type: "revolute",
        axis: "Z",
        limits: "0° – 115°",
      },
      {
        component: "Pick Crate",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex decomposition + AMR clearance volumes",
    replicator: "Pallet, tote, beacon labels",
    testedWith: "Simulation QA suite",
    leadTime: "7 business days",
    ctaText: "Book integration slot",
    seo: "Warehouse tote pick lane with safety gate articulation and AMR clearances.",
    highlights: [
      "Sensor-ready lighting baked",
      "Navigation volumes exported to USD",
      "Dynamic pallets for scenario mixing",
    ],
  },
  {
    title: "Cross-Dock Staging",
    slug: "cross-dock-staging",
    thumb: "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["warehouse-lanes", "loading-docks"],
    tags: ["Industrial", "Outdoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Dock Lever",
        type: "revolute",
        axis: "X",
        limits: "0° – 90°",
      },
      {
        component: "Safety Chain",
        type: "pickable",
        axis: "",
        limits: "",
      },
      {
        component: "Pallet Jacks",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex + plane volumes",
    testedWith: "Simulation QA suite",
    leadTime: "6 business days",
    ctaText: "Reserve",
    seo: "Cross-dock staging area with articulated dock lever and pallet handling assets.",
    highlights: [
      "Rainy + sunny lighting variants",
      "Restraint sensors flagged as USD tokens",
      "Line markings exported as semantic layers",
    ],
  },
  {
    title: "Pallet Buffer Zone",
    slug: "pallet-buffer-zone",
    thumb: "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["warehouse-lanes"],
    tags: ["Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Gate Arm",
        type: "revolute",
        axis: "Z",
        limits: "0° – 110°",
      },
      {
        component: "Pallet Stack",
        type: "pickable",
        axis: "",
        limits: "",
      },
      {
        component: "Stop Buttons",
        type: "button",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Hybrid convex",
    testedWith: "Simulation QA suite",
    leadTime: "5 business days",
    ctaText: "Request scene",
    seo: "Pallet buffer zone tuned for palletizing and AMR handoff policies.",
    highlights: [
      "Fork pocket physics volumes",
      "Dynamic signage variations",
      "Safety envelope markup",
    ],
  },
  {
    title: "Dock High Bay",
    slug: "dock-high-bay",
    thumb: "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["loading-docks"],
    tags: ["Industrial", "Outdoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Dock Leveler",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.4m",
      },
      {
        component: "Vehicle Restraint",
        type: "revolute",
        axis: "Z",
        limits: "0° – 80°",
      },
      {
        component: "Signal Column",
        type: "button",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex hulls + SDF ramp",
    testedWith: "Simulation QA suite",
    leadTime: "8 business days",
    ctaText: "Join waitlist",
    seo: "Dock-high bay environment with articulated leveler and vehicle restraint for automation pilots.",
    highlights: [
      "Weather variants bundled",
      "Truck approach spline annotated",
      "Collision proxies tuned for compliance",
    ],
  },
  {
    title: "Parcel Sort Alcove",
    slug: "parcel-sort-alcove",
    thumb: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["loading-docks", "warehouse-lanes"],
    tags: ["Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Chute Gate",
        type: "revolute",
        axis: "X",
        limits: "0° – 65°",
      },
      {
        component: "Tote Diverter",
        type: "prismatic",
        axis: "Z",
        limits: "0m – 0.25m",
      },
      {
        component: "Parcel Bins",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex",
    testedWith: "Simulation QA suite",
    leadTime: "6 business days",
    ctaText: "Request scene",
    seo: "Parcel sort alcove with articulated diverters and bins for automation trials.",
    highlights: [
      "Sensor frustums exported",
      "Annotated barcode zones",
      "Resettable conveyors",
    ],
  },
  {
    title: "Bioreactor Suite",
    slug: "bioreactor-suite",
    thumb: "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["labs"],
    tags: ["Indoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "OpenPBR",
    interactions: [
      {
        component: "Glove Ports",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.18m",
      },
      {
        component: "Valve Wheels",
        type: "knob",
        axis: "Z",
        limits: "0° – 120°",
      },
      {
        component: "Sample Tray",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "SDF vessels + convex racks",
    replicator: "Hazard zones + sample IDs",
    testedWith: "Simulation QA suite",
    leadTime: "9 business days",
    ctaText: "Reserve",
    seo: "Bioreactor lab suite with articulated glove ports and annotated hazard zones.",
    highlights: [
      "Cleanroom lighting profile",
      "Metric signage and labels",
      "Supports teleoperation rig",
    ],
  },
  {
    title: "Sample Prep Lab",
    slug: "sample-prep-lab",
    thumb: "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["labs"],
    tags: ["Indoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "OpenPBR",
    interactions: [
      {
        component: "Fume Hood",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.5m",
      },
      {
        component: "Sample Carousel",
        type: "revolute",
        axis: "Z",
        limits: "0° – 360°",
      },
      {
        component: "Microplate",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Hybrid",
    testedWith: "Simulation QA suite",
    leadTime: "7 business days",
    ctaText: "Book",
    seo: "Sample preparation lab with articulated fume hood and carousel.",
    highlights: [
      "UV-safe texture variants",
      "Calibrated lighting for machine vision",
      "Semantic tags for reagents",
    ],
  },
  {
    title: "Service Pantry",
    slug: "service-pantry",
    thumb: "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["office-pods"],
    tags: ["Indoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Cabinet Doors",
        type: "revolute",
        axis: "Z",
        limits: "0° – 100°",
      },
      {
        component: "Fridge Drawer",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.35m",
      },
      {
        component: "Coffee Machine",
        type: "button",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex",
    testedWith: "Simulation QA suite",
    leadTime: "5 business days",
    ctaText: "Request scene",
    seo: "Office service pantry with articulated cabinetry and appliance controls.",
    highlights: [
      "ADA clearance volumes",
      "Switchboard annotations",
      "Colorways for corporate branding",
    ],
  },
  {
    title: "Focus Room Pair",
    slug: "focus-room-pair",
    thumb: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["office-pods"],
    tags: ["Indoor"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Glass Door",
        type: "revolute",
        axis: "Z",
        limits: "0° – 95°",
      },
      {
        component: "Sit/Stand Desk",
        type: "prismatic",
        axis: "Y",
        limits: "0.7m – 1.2m",
      },
      {
        component: "Lighting Dial",
        type: "knob",
        axis: "",
        limits: "0° – 180°",
      },
    ],
    colliders: "Convex hulls",
    testedWith: "Simulation QA suite",
    leadTime: "4 business days",
    ctaText: "Add to plan",
    seo: "Office focus rooms with adjustable desks and articulated doors.",
    highlights: [
      "Acoustic panel acoustics metadata",
      "Occupancy sensors modeled",
      "Ceiling fixtures for SLAM",
    ],
  },
  {
    title: "Janitorial Closet",
    slug: "janitorial-closet",
    thumb: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["utility-rooms"],
    tags: ["Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Valve Manifold",
        type: "knob",
        axis: "",
        limits: "0° – 180°",
      },
      {
        component: "Supply Drawer",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.4m",
      },
      {
        component: "Chemical Bottles",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "Convex",
    testedWith: "Simulation QA suite",
    leadTime: "4 business days",
    ctaText: "Request scene",
    seo: "Utility closet with valve controls and pickable supplies for inspection policies.",
    highlights: [
      "Utility labels with text metadata",
      "Floor drain SDF",
      "Hook height variations",
    ],
  },
  {
    title: "Mechanical Room",
    slug: "mechanical-room",
    thumb: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["utility-rooms"],
    tags: ["Industrial"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "PBR",
    interactions: [
      {
        component: "Panel Switch",
        type: "switch",
        axis: "",
        limits: "",
      },
      {
        component: "Air Handler Door",
        type: "revolute",
        axis: "X",
        limits: "0° – 95°",
      },
      {
        component: "Filter Cartridge",
        type: "pickable",
        axis: "",
        limits: "",
      },
    ],
    colliders: "SDF volumetrics",
    testedWith: "Simulation QA suite",
    leadTime: "6 business days",
    ctaText: "Join waitlist",
    seo: "Mechanical room with articulated panels and switchgear for inspection robotics.",
    highlights: [
      "Thermal IR textures",
      "Pressure gauge semantics",
      "Access ladder clearances",
    ],
  },
  {
    title: "Laundry Alcove",
    slug: "laundry-alcove",
    thumb: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    ],
    categories: ["home-laundry"],
    tags: ["Home"],
    usdVersion: "USD 23.11",
    units: "Meters",
    materials: "OpenPBR",
    interactions: [
      {
        component: "Washer Door",
        type: "revolute",
        axis: "Z",
        limits: "0° – 135°",
      },
      {
        component: "Detergent Drawer",
        type: "prismatic",
        axis: "Y",
        limits: "0m – 0.18m",
      },
      {
        component: "Cycle Dial",
        type: "knob",
        axis: "",
        limits: "0° – 330°",
      },
    ],
    colliders: "Convex",
    testedWith: "Simulation QA suite",
    leadTime: "4 business days",
    ctaText: "Request scene",
    seo: "Residential laundry alcove with articulated washer and dryer controls.",
    highlights: [
      "Stacked + side-by-side variants",
      "Laundry basket spawn points",
      "High-contrast textures for assistive research",
    ],
  },
];

export const caseStudies: CaseStudy[] = [
  {
    title: "Kitchen articulation pack",
    slug: "kitchen-articulation-pack",
    summary:
      "Training manipulation policies across ovens, racks, and drawers in a fast casual kitchen network.",
    hero: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    body:
      "We delivered a six-scene kitchen bundle with validated revolute and prismatic joints across ovens, reach-ins, and prep storage. The lab used our simulation QA process to author open/slide policies and transfer to in-situ hardware within two sprints.",
    outcomes: [
      "12x articulated assets with validated limits",
      "90% policy success rate in sim",
      "Two-week turnaround including feedback loop",
    ],
    cta: "Request the kitchen bundle",
  },
  {
    title: "Warehouse aisle with totes",
    slug: "warehouse-aisle-with-totes",
    summary:
      "AMR bin-pick tests using Blueprint's tote lanes with calibrated pallet heights and navigation envelopes.",
    hero: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
    body:
      "A robotics integrator used our warehouse lane pack to evaluate pallet-to-tote flows. We tuned colliders for suction grippers, delivered annotation-ready packages, and validated in the Simulation QA suite before deployment.",
    outcomes: [
      "Cut policy tuning time by 60%",
      "Validated AMR clearances before site visit",
      "Delivered 4 scenario variants in under 10 days",
    ],
    cta: "Book a warehouse walkthrough",
  },
  {
    title: "Retail shelf grasp-place",
    slug: "retail-shelf-grasp-place",
    summary:
      "Planogrammed shelves with labeled SKUs powering grasp-place evaluations for a retail robotics pilot.",
    hero: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    body:
      "We rebuilt a flagship retail aisle with signage, price tags, and semantic IDs. Teams trained grasp-place behaviors, tuned suction compliance, and exported annotation-ready datasets.",
    outcomes: [
      "8x shelf variations",
      "Product-level semantic metadata",
      "SLAM validation with synthetic-lidar",
    ],
    cta: "Get the retail pack",
  },
];

export const jobs: Job[] = [
  {
    title: "3D Artist",
    type: "Contract",
    location: "Remote",
    summary: "Create high-fidelity assets with watertight topology and clean UVs for SimReady handoff.",
    description:
      "You will translate capture outputs and kitbashed assets into polished simulation-ready geometry. Expect to iterate with our robotics specialists on articulation coverage, pivots, and collider tuning. Compensation is scoped to each project and averages approximately $50 per hour.",
    applyEmail: "apply+artist@tryblueprint.io",
  },
  {
    title: "USD Tools Engineer",
    type: "Full-time",
    location: "Remote",
    summary: "Build the authoring tools that automate SimReady finishing across our environment network.",
    description:
      "Design and ship USD pipelines that enforce our SimReady spec, from collider validation to articulation presets. You'll collaborate with artists and robotics teams to accelerate turnaround.",
    applyEmail: "apply+usd@tryblueprint.io",
  },
];

// export type InteractionType =
//   | "revolute"
//   | "prismatic"
//   | "pickable"
//   | "button"
//   | "knob"
//   | "switch";

// export interface Interaction {
//   component: string;
//   type: InteractionType;
//   axis: string;
//   limits: string;
//   notes?: string;
// }

// export interface Scene {
//   title: string;
//   slug: string;
//   thumb: string;
//   gallery: string[];
//   categories: string[];
//   tags: string[];
//   usdVersion: string;
//   units: string;
//   materials: string;
//   interactions: Interaction[];
//   colliders: string;
//   replicator?: string;
//   testedWith: string;
//   leadTime: string;
//   download?: string;
//   ctaText: string;
//   seo: string;
//   highlights: string[];
// }

// export interface EnvironmentCategory {
//   title: string;
//   slug: string;
//   heroImage: string;
//   summary: string;
//   tags: string[];
//   scenes: string[];
// }

// export interface Policy {
//   title: string;
//   slug: string;
//   summary: string;
//   focusAreas: string[];
//   tags: string[];
//   environments: string[];
// }

// export interface CaseStudy {
//   title: string;
//   slug: string;
//   summary: string;
//   hero: string;
//   body: string;
//   outcomes: string[];
//   cta: string;
// }

// export interface Job {
//   title: string;
//   type: string;
//   location: string;
//   summary: string;
//   description: string;
//   applyEmail: string;
// }

// export const environmentCategories: EnvironmentCategory[] = [
//   {
//     title: "Kitchens",
//     slug: "kitchens",
//     heroImage:
//       "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Commercial prep lines, dish pits, and quick-serve stations with articulated appliances ready for pick-and-place training.",
//     tags: ["Indoor", "Industrial"],
//     scenes: [
//       "modular-kitchen-line",
//       "dishroom-articulation",
//       "chef-prep-station",
//     ],
//   },
//   {
//     title: "Grocery Aisles",
//     slug: "grocery-aisles",
//     heroImage:
//       "https://images.unsplash.com/photo-1586202692873-0227667ccf6b?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Planogrammed aisles with stocked SKUs, cart interactions, and articulated refrigeration for restocking policies.",
//     tags: ["Retail", "Indoor"],
//     scenes: ["grocery-endcap-kit", "refrigerated-aisle", "bulk-dry-goods"],
//   },
//   {
//     title: "Warehouse Lanes",
//     slug: "warehouse-lanes",
//     heroImage:
//       "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Racked inventory corridors with pallets, totes, and AMR-clearances tuned for perception and manipulation.",
//     tags: ["Industrial"],
//     scenes: ["tote-pick-lane", "cross-dock-staging", "pallet-buffer-zone"],
//   },
//   {
//     title: "Loading Docks",
//     slug: "loading-docks",
//     heroImage:
//       "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Configurable bays with liftgates, restraints, and staging pallets for dock automation trials.",
//     tags: ["Industrial", "Outdoor"],
//     scenes: ["dock-high-bay", "parcel-sort-alcove"],
//   },
//   {
//     title: "Labs",
//     slug: "labs",
//     heroImage:
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Wet lab benches, articulated enclosures, and sensor-ready fixtures with precise metric setups.",
//     tags: ["Indoor"],
//     scenes: ["bioreactor-suite", "sample-prep-lab"],
//   },
//   {
//     title: "Office Pods",
//     slug: "office-pods",
//     heroImage:
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Focus rooms, hot desks, and service nooks featuring doors, drawers, and switchgear for manipulation policies.",
//     tags: ["Indoor"],
//     scenes: ["service-pantry", "focus-room-pair"],
//   },
//   {
//     title: "Utility Rooms",
//     slug: "utility-rooms",
//     heroImage:
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Back-of-house closets with valves, panels, and service clearances tuned for inspection routines.",
//     tags: ["Industrial"],
//     scenes: ["janitorial-closet", "mechanical-room"],
//   },
//   {
//     title: "Home Laundry",
//     slug: "home-laundry",
//     heroImage:
//       "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
//     summary:
//       "Consumer-grade washer/dryer stacks with articulated doors, knobs, and hampers for assistive robotics research.",
//     tags: ["Home"],
//     scenes: ["laundry-alcove"],
//   },
// ];

// export const policies: Policy[] = [
//   {
//     title: "Inventory Replenishment",
//     slug: "inventory-replenishment",
//     summary:
//       "Sequenced pick, place, and verification routines for keeping high-demand SKUs stocked without interrupting shoppers or operators.",
//     focusAreas: [
//       "Bin and shelf restock playbooks",
//       "Cart traffic awareness",
//       "Exception logging for missing items",
//     ],
//     tags: ["Fulfillment", "Perception"],
//     environments: ["grocery-aisles", "warehouse-lanes"],
//   },
//   {
//     title: "Dock Turnaround",
//     slug: "dock-turnaround",
//     summary:
//       "Coordinated trailer arrival, restraint, and staging workflows for shortening dwell time at busy distribution hubs.",
//     focusAreas: [
//       "Trailer presence validation",
//       "Restraint engagement checks",
//       "Hand-off to yard management",
//     ],
//     tags: ["Logistics", "Safety"],
//     environments: ["loading-docks", "warehouse-lanes"],
//   },
//   {
//     title: "Kitchen Line QA",
//     slug: "kitchen-line-qa",
//     summary:
//       "Sanitation, temperature, and station readiness inspections designed for multi-shift commercial kitchen operations.",
//     focusAreas: [
//       "Surface contact verification",
//       "Thermal probe sampling",
//       "Consumables stock confirmation",
//     ],
//     tags: ["Safety", "Inspection"],
//     environments: ["kitchens"],
//   },
//   {
//     title: "Sample Chain of Custody",
//     slug: "sample-chain-of-custody",
//     summary:
//       "Interlocked hand-off and labeling routines that preserve specimen traceability across prep, analysis, and cold storage.",
//     focusAreas: [
//       "Label verification",
//       "Instrument queue staging",
//       "Cold room access logging",
//     ],
//     tags: ["Compliance", "Precision"],
//     environments: ["labs"],
//   },
//   {
//     title: "Office Service Sweep",
//     slug: "office-service-sweep",
//     summary:
//       "After-hours routes for desk reset, amenity restock, and occupant feedback capture in flexible office footprints.",
//     focusAreas: [
//       "Surface reset playbook",
//       "Amenity stock sensing",
//       "Feedback kiosk sync",
//     ],
//     tags: ["Hospitality", "Experience"],
//     environments: ["office-pods", "utility-rooms"],
//   },
//   {
//     title: "Laundry Assist Loop",
//     slug: "laundry-assist-loop",
//     summary:
//       "Loading, cycle monitoring, and folding preparation designed for assistive home robotics pilots.",
//     focusAreas: [
//       "Washer and dryer door actuation",
//       "Detergent dosing guidance",
//       "Laundry bin hand-offs",
//     ],
//     tags: ["Assistive", "Manipulation"],
//     environments: ["home-laundry"],
//   },
//   {
//     title: "Mechanical Room Inspection",
//     slug: "mechanical-room-inspection",
//     summary:
//       "Routine valve, gauge, and panel checks to surface anomalies before they escalate into outages.",
//     focusAreas: [
//       "Gauge reading digitization",
//       "Valve position confirmation",
//       "Service ticket escalation",
//     ],
//     tags: ["Maintenance", "Safety"],
//     environments: ["utility-rooms", "warehouse-lanes"],
//   },
// ];

// export const scenes: Scene[] = [
//   {
//     title: "Modular Kitchen Line",
//     slug: "modular-kitchen-line",
//     thumb:
//       "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["kitchens"],
//     tags: ["Indoor", "Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR + OpenPBR surface overrides",
//     interactions: [
//       {
//         component: "Oven Door",
//         type: "revolute",
//         axis: "Y",
//         limits: "0° – 105°",
//         notes: "Soft-close damping curve",
//       },
//       {
//         component: "Prep Drawer",
//         type: "prismatic",
//         axis: "Z",
//         limits: "0m – 0.45m",
//       },
//       {
//         component: "Stock Pot",
//         type: "pickable",
//         axis: "",
//         limits: "",
//         notes: "Pivot-aligned for compliant grasping",
//       },
//     ],
//     colliders: "Hybrid convex decomposition",
//     replicator: "Semantic labels for appliances, storage, surfaces",
//     testedWith: "Simulation QA suite",
//     leadTime: "5 business days",
//     download: "https://tryblueprint.io/assets/modular-kitchen-line.usdz",
//     ctaText: "Request this scene",
//     seo: "SimReady commercial kitchen line with articulated appliances for robotics training.",
//     highlights: [
//       "Captured base mesh finished for watertight topology",
//       "Link-separated appliances with clean pivots",
//       "Physics materials tuned for sliding, grasping, heat zones",
//     ],
//   },
//   {
//     title: "Dishroom Articulation Pack",
//     slug: "dishroom-articulation",
//     thumb:
//       "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["kitchens"],
//     tags: ["Indoor", "Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR stainless, roughness sweeps",
//     interactions: [
//       {
//         component: "Dishwasher Door",
//         type: "revolute",
//         axis: "X",
//         limits: "0° – 95°",
//       },
//       {
//         component: "Rack Lift",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.38m",
//       },
//       {
//         component: "Control Buttons",
//         type: "button",
//         axis: "",
//         limits: "",
//         notes: "Discrete event hooks for policy triggers",
//       },
//     ],
//     colliders: "Signed distance fields for enclosures",
//     replicator: "Surface class + SKU tags",
//     testedWith: "Simulation QA suite",
//     leadTime: "7 business days",
//     ctaText: "Book delivery",
//     seo: "SimReady dishroom with revolute doors and prismatic racks for articulated policy training.",
//     highlights: [
//       "High-gloss stainless with baked AO",
//       "Collision capsules for hose routing",
//       "LOD1 for headsets and remote review",
//     ],
//   },
//   {
//     title: "Chef Prep Station",
//     slug: "chef-prep-station",
//     thumb:
//       "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["kitchens"],
//     tags: ["Indoor", "Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "OpenPBR with specular workflow",
//     interactions: [
//       {
//         component: "Prep Fridge",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 90°",
//       },
//       {
//         component: "Ingredient Bins",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//       {
//         component: "Herb Drawer",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.25m",
//       },
//     ],
//     colliders: "Compound convex hulls",
//     testedWith: "Simulation QA suite",
//     leadTime: "5 business days",
//     ctaText: "Add to pipeline",
//     seo: "Chef prep station with articulated cold storage and labeled ingredient bins.",
//     highlights: [
//       "UV-packed to 0-1 for fast texture swaps",
//       "Semantic layers for surfaces and utensils",
//       "Countertop friction tuned for pick-place",
//     ],
//   },
//   {
//     title: "Grocery Endcap Kit",
//     slug: "grocery-endcap-kit",
//     thumb:
//       "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["grocery-aisles"],
//     tags: ["Retail", "Indoor"],
//     usdVersion: "USD 23.05",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Display Shelves",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.2m",
//         notes: "Adjustable shelf heights",
//       },
//       {
//         component: "Promo Button",
//         type: "button",
//         axis: "",
//         limits: "",
//       },
//       {
//         component: "Sample Basket",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Box + convex mix",
//     replicator: "SKU families with class labels",
//     testedWith: "Simulation QA suite",
//     leadTime: "4 business days",
//     ctaText: "Request planogram",
//     seo: "Retail endcap with adjustable shelving and labeled products for stocking policies.",
//     highlights: [
//       "Planogram CSV import ready",
//       "LOD1/LOD2 for perception sweeps",
//       "Cart clearance volumes baked",
//     ],
//   },
//   {
//     title: "Refrigerated Aisle",
//     slug: "refrigerated-aisle",
//     thumb:
//       "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["grocery-aisles"],
//     tags: ["Retail", "Indoor"],
//     usdVersion: "USD 23.05",
//     units: "Meters",
//     materials: "PBR glass + emissive",
//     interactions: [
//       {
//         component: "Cooler Doors",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 95°",
//       },
//       {
//         component: "Shelf Slides",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.18m",
//       },
//       {
//         component: "Product Packs",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex decomp with door sweep volumes",
//     testedWith: "Simulation QA suite",
//     leadTime: "6 business days",
//     ctaText: "Schedule delivery",
//     seo: "SimReady refrigerated grocery aisle with articulated doors and shelf slides.",
//     highlights: [
//       "Thermal gradients for sensor testing",
//       "Per-door hinge metadata",
//       "Product label layers for perception",
//     ],
//   },
//   {
//     title: "Bulk Dry Goods",
//     slug: "bulk-dry-goods",
//     thumb:
//       "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581539250439-c77b94523f8a?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581555500984-d845bb967f10?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["grocery-aisles"],
//     tags: ["Retail"],
//     usdVersion: "USD 23.05",
//     units: "Meters",
//     materials: "OpenPBR granular",
//     interactions: [
//       {
//         component: "Gravity Bins",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.3m",
//       },
//       {
//         component: "Dispense Handles",
//         type: "revolute",
//         axis: "X",
//         limits: "0° – 60°",
//       },
//       {
//         component: "Scale Buttons",
//         type: "button",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex hulls",
//     testedWith: "Simulation QA suite",
//     leadTime: "5 business days",
//     ctaText: "Add to quote",
//     seo: "Bulk dry goods aisle with articulated dispensers and scale for manipulation tasks.",
//     highlights: [
//       "Seeded variations for dataset diversity",
//       "Embedded signage metadata",
//       "Material IDs for granular fill levels",
//     ],
//   },
//   {
//     title: "Tote Pick Lane",
//     slug: "tote-pick-lane",
//     thumb:
//       "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["warehouse-lanes"],
//     tags: ["Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Tote Guides",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.12m",
//       },
//       {
//         component: "Rack Safety Gate",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 115°",
//       },
//       {
//         component: "Pick Crate",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex decomposition + AMR clearance volumes",
//     replicator: "Pallet, tote, beacon labels",
//     testedWith: "Simulation QA suite",
//     leadTime: "7 business days",
//     ctaText: "Book integration slot",
//     seo: "Warehouse tote pick lane with safety gate articulation and AMR clearances.",
//     highlights: [
//       "Sensor-ready lighting baked",
//       "Navigation volumes exported to USD",
//       "Dynamic pallets for scenario mixing",
//     ],
//   },
//   {
//     title: "Cross-Dock Staging",
//     slug: "cross-dock-staging",
//     thumb:
//       "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["warehouse-lanes", "loading-docks"],
//     tags: ["Industrial", "Outdoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Dock Lever",
//         type: "revolute",
//         axis: "X",
//         limits: "0° – 90°",
//       },
//       {
//         component: "Safety Chain",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//       {
//         component: "Pallet Jacks",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex + plane volumes",
//     testedWith: "Simulation QA suite",
//     leadTime: "6 business days",
//     ctaText: "Reserve",
//     seo: "Cross-dock staging area with articulated dock lever and pallet handling assets.",
//     highlights: [
//       "Rainy + sunny lighting variants",
//       "Restraint sensors flagged as USD tokens",
//       "Line markings exported as semantic layers",
//     ],
//   },
//   {
//     title: "Pallet Buffer Zone",
//     slug: "pallet-buffer-zone",
//     thumb:
//       "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["warehouse-lanes"],
//     tags: ["Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Gate Arm",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 110°",
//       },
//       {
//         component: "Pallet Stack",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//       {
//         component: "Stop Buttons",
//         type: "button",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Hybrid convex",
//     testedWith: "Simulation QA suite",
//     leadTime: "5 business days",
//     ctaText: "Request scene",
//     seo: "Pallet buffer zone tuned for palletizing and AMR handoff policies.",
//     highlights: [
//       "Fork pocket physics volumes",
//       "Dynamic signage variations",
//       "Safety envelope markup",
//     ],
//   },
//   {
//     title: "Dock High Bay",
//     slug: "dock-high-bay",
//     thumb:
//       "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1580894908361-967195033215?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["loading-docks"],
//     tags: ["Industrial", "Outdoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Dock Leveler",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.4m",
//       },
//       {
//         component: "Vehicle Restraint",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 80°",
//       },
//       {
//         component: "Signal Column",
//         type: "button",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex hulls + SDF ramp",
//     testedWith: "Simulation QA suite",
//     leadTime: "8 business days",
//     ctaText: "Join waitlist",
//     seo: "Dock-high bay environment with articulated leveler and vehicle restraint for automation pilots.",
//     highlights: [
//       "Weather variants bundled",
//       "Truck approach spline annotated",
//       "Collision proxies tuned for compliance",
//     ],
//   },
//   {
//     title: "Parcel Sort Alcove",
//     slug: "parcel-sort-alcove",
//     thumb:
//       "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1549032305-5697c0fc0312?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["loading-docks", "warehouse-lanes"],
//     tags: ["Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Chute Gate",
//         type: "revolute",
//         axis: "X",
//         limits: "0° – 65°",
//       },
//       {
//         component: "Tote Diverter",
//         type: "prismatic",
//         axis: "Z",
//         limits: "0m – 0.25m",
//       },
//       {
//         component: "Parcel Bins",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex",
//     testedWith: "Simulation QA suite",
//     leadTime: "6 business days",
//     ctaText: "Request scene",
//     seo: "Parcel sort alcove with articulated diverters and bins for automation trials.",
//     highlights: [
//       "Sensor frustums exported",
//       "Annotated barcode zones",
//       "Resettable conveyors",
//     ],
//   },
//   {
//     title: "Bioreactor Suite",
//     slug: "bioreactor-suite",
//     thumb:
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["labs"],
//     tags: ["Indoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "OpenPBR",
//     interactions: [
//       {
//         component: "Glove Ports",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.18m",
//       },
//       {
//         component: "Valve Wheels",
//         type: "knob",
//         axis: "Z",
//         limits: "0° – 120°",
//       },
//       {
//         component: "Sample Tray",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "SDF vessels + convex racks",
//     replicator: "Hazard zones + sample IDs",
//     testedWith: "Simulation QA suite",
//     leadTime: "9 business days",
//     ctaText: "Reserve",
//     seo: "Bioreactor lab suite with articulated glove ports and annotated hazard zones.",
//     highlights: [
//       "Cleanroom lighting profile",
//       "Metric signage and labels",
//       "Supports teleoperation rig",
//     ],
//   },
//   {
//     title: "Sample Prep Lab",
//     slug: "sample-prep-lab",
//     thumb:
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["labs"],
//     tags: ["Indoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "OpenPBR",
//     interactions: [
//       {
//         component: "Fume Hood",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.5m",
//       },
//       {
//         component: "Sample Carousel",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 360°",
//       },
//       {
//         component: "Microplate",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Hybrid",
//     testedWith: "Simulation QA suite",
//     leadTime: "7 business days",
//     ctaText: "Book",
//     seo: "Sample preparation lab with articulated fume hood and carousel.",
//     highlights: [
//       "UV-safe texture variants",
//       "Calibrated lighting for machine vision",
//       "Semantic tags for reagents",
//     ],
//   },
//   {
//     title: "Service Pantry",
//     slug: "service-pantry",
//     thumb:
//       "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["office-pods"],
//     tags: ["Indoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Cabinet Doors",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 100°",
//       },
//       {
//         component: "Fridge Drawer",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.35m",
//       },
//       {
//         component: "Coffee Machine",
//         type: "button",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex",
//     testedWith: "Simulation QA suite",
//     leadTime: "5 business days",
//     ctaText: "Request scene",
//     seo: "Office service pantry with articulated cabinetry and appliance controls.",
//     highlights: [
//       "ADA clearance volumes",
//       "Switchboard annotations",
//       "Colorways for corporate branding",
//     ],
//   },
//   {
//     title: "Focus Room Pair",
//     slug: "focus-room-pair",
//     thumb:
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["office-pods"],
//     tags: ["Indoor"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Glass Door",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 95°",
//       },
//       {
//         component: "Sit/Stand Desk",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0.7m – 1.2m",
//       },
//       {
//         component: "Lighting Dial",
//         type: "knob",
//         axis: "",
//         limits: "0° – 180°",
//       },
//     ],
//     colliders: "Convex hulls",
//     testedWith: "Simulation QA suite",
//     leadTime: "4 business days",
//     ctaText: "Add to plan",
//     seo: "Office focus rooms with adjustable desks and articulated doors.",
//     highlights: [
//       "Acoustic panel acoustics metadata",
//       "Occupancy sensors modeled",
//       "Ceiling fixtures for SLAM",
//     ],
//   },
//   {
//     title: "Janitorial Closet",
//     slug: "janitorial-closet",
//     thumb:
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["utility-rooms"],
//     tags: ["Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Valve Manifold",
//         type: "knob",
//         axis: "",
//         limits: "0° – 180°",
//       },
//       {
//         component: "Supply Drawer",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.4m",
//       },
//       {
//         component: "Chemical Bottles",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "Convex",
//     testedWith: "Simulation QA suite",
//     leadTime: "4 business days",
//     ctaText: "Request scene",
//     seo: "Utility closet with valve controls and pickable supplies for inspection policies.",
//     highlights: [
//       "Utility labels with text metadata",
//       "Floor drain SDF",
//       "Hook height variations",
//     ],
//   },
//   {
//     title: "Mechanical Room",
//     slug: "mechanical-room",
//     thumb:
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1582719478250-02c3c15b6640?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["utility-rooms"],
//     tags: ["Industrial"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "PBR",
//     interactions: [
//       {
//         component: "Panel Switch",
//         type: "switch",
//         axis: "",
//         limits: "",
//       },
//       {
//         component: "Air Handler Door",
//         type: "revolute",
//         axis: "X",
//         limits: "0° – 95°",
//       },
//       {
//         component: "Filter Cartridge",
//         type: "pickable",
//         axis: "",
//         limits: "",
//       },
//     ],
//     colliders: "SDF volumetrics",
//     testedWith: "Simulation QA suite",
//     leadTime: "6 business days",
//     ctaText: "Join waitlist",
//     seo: "Mechanical room with articulated panels and switchgear for inspection robotics.",
//     highlights: [
//       "Thermal IR textures",
//       "Pressure gauge semantics",
//       "Access ladder clearances",
//     ],
//   },
//   {
//     title: "Laundry Alcove",
//     slug: "laundry-alcove",
//     thumb:
//       "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
//     gallery: [
//       "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
//       "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
//     ],
//     categories: ["home-laundry"],
//     tags: ["Home"],
//     usdVersion: "USD 23.11",
//     units: "Meters",
//     materials: "OpenPBR",
//     interactions: [
//       {
//         component: "Washer Door",
//         type: "revolute",
//         axis: "Z",
//         limits: "0° – 135°",
//       },
//       {
//         component: "Detergent Drawer",
//         type: "prismatic",
//         axis: "Y",
//         limits: "0m – 0.18m",
//       },
//       {
//         component: "Cycle Dial",
//         type: "knob",
//         axis: "",
//         limits: "0° – 330°",
//       },
//     ],
//     colliders: "Convex",
//     testedWith: "Simulation QA suite",
//     leadTime: "4 business days",
//     ctaText: "Request scene",
//     seo: "Residential laundry alcove with articulated washer and dryer controls.",
//     highlights: [
//       "Stacked + side-by-side variants",
//       "Laundry basket spawn points",
//       "High-contrast textures for assistive research",
//     ],
//   },
// ];

// export const caseStudies: CaseStudy[] = [
//   {
//     title: "Kitchen articulation pack",
//     slug: "kitchen-articulation-pack",
//     summary:
//       "Training manipulation policies across ovens, racks, and drawers in a fast casual kitchen network.",
//     hero: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
//     body: "We delivered a six-scene kitchen bundle with validated revolute and prismatic joints across ovens, reach-ins, and prep storage. The lab used our simulation QA process to author open/slide policies and transfer to in-situ hardware within two sprints.",
//     outcomes: [
//       "12x articulated assets with validated limits",
//       "90% policy success rate in sim",
//       "Two-week turnaround including feedback loop",
//     ],
//     cta: "Request the kitchen bundle",
//   },
//   {
//     title: "Warehouse aisle with totes",
//     slug: "warehouse-aisle-with-totes",
//     summary:
//       "AMR bin-pick tests using Blueprint's tote lanes with calibrated pallet heights and navigation envelopes.",
//     hero: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80",
//     body: "A robotics integrator used our warehouse lane pack to evaluate pallet-to-tote flows. We tuned colliders for suction grippers, delivered annotation-ready packages, and validated in the Simulation QA suite before deployment.",
//     outcomes: [
//       "Cut policy tuning time by 60%",
//       "Validated AMR clearances before site visit",
//       "Delivered 4 scenario variants in under 10 days",
//     ],
//     cta: "Book a warehouse walkthrough",
//   },
//   {
//     title: "Retail shelf grasp-place",
//     slug: "retail-shelf-grasp-place",
//     summary:
//       "Planogrammed shelves with labeled SKUs powering grasp-place evaluations for a retail robotics pilot.",
//     hero: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
//     body: "We rebuilt a flagship retail aisle with signage, price tags, and semantic IDs. Teams trained grasp-place behaviors, tuned suction compliance, and exported annotation-ready datasets.",
//     outcomes: [
//       "8x shelf variations",
//       "Product-level semantic metadata",
//       "SLAM validation with synthetic-lidar",
//     ],
//     cta: "Get the retail pack",
//   },
// ];

// export const jobs: Job[] = [
//   {
//     title: "3D Artist",
//     type: "Contract",
//     location: "Remote",
//     summary:
//       "Create high-fidelity assets with watertight topology and clean UVs for SimReady delivery.",
//     description:
//       "You will translate capture outputs and kitbashed assets into polished simulation-ready geometry. Expect to iterate with our robotics specialists on articulation coverage, pivots, and collider tuning.",
//     applyEmail: "apply+artist@tryblueprint.io",
//   },
//   {
//     title: "Technical Artist (Simulation)",
//     type: "Contract",
//     location: "Remote",
//     summary:
//       "Author scene stages, tune joints, and validate physics so labs can drop environments straight into their simulator.",
//     description:
//       "Work across DCC tools and our internal pipeline to ensure every scene ships with precise limits, semantic schemas, and test harnesses. Bonus points for experience automating annotation exports.",
//     applyEmail: "apply+techartist@tryblueprint.io",
//   },
//   {
//     title: "USD Tools Engineer",
//     type: "Full-time",
//     location: "Durham, NC or Remote",
//     summary:
//       "Build the authoring tools that automate SimReady finishing across our environment network.",
//     description:
//       "Design and ship USD pipelines that enforce our SimReady spec, from collider validation to articulation presets. You'll collaborate with artists and robotics teams to accelerate delivery.",
//     applyEmail: "apply+usd@tryblueprint.io",
//   },
// ];
