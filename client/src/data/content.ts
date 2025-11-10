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
    slug: "restocking-planogram",
    title: "Restocking & Planogram QA",
    focus: "Inventory accuracy",
    cadence: "Shift open + close",
    summary:
      "Monitor shelf compliance, restock priorities, and aisle readiness with structured annotations for each bay.",
    coverage: [
      "Facing and gap detection across gondolas",
      "Dynamic restock queue export for associates",
      "Exception hand-off with annotated product IDs",
    ],
    metric: "96% shelf compliance in sim",
    environments: ["grocery-aisles"],
  },
  {
    slug: "kitchen-safety-sops",
    title: "Kitchen Safety SOP Walkthrough",
    focus: "Food safety",
    cadence: "Pre-service",
    summary:
      "Validate sanitation, cookline readiness, and HACCP checkpoints before service windows open.",
    coverage: [
      "Hot-zone clearance and PPE confirmation",
      "Chemical storage and label verification",
      "Temperature log capture from articulated equipment",
    ],
    metric: "Cuts audit prep time by 40%",
    environments: ["kitchens"],
  },
  {
    slug: "dock-safety-checks",
    title: "Dock Safety Checklist",
    focus: "Operations safety",
    cadence: "Per trailer move",
    summary:
      "Run restraint, light curtain, and chock confirmation before AMRs or lift operators engage the bay.",
    coverage: [
      "Verify restraint engagement and signal lights",
      "Scan dock pit for foreign objects",
      "Confirm staged pallet clearances for AMR entries",
    ],
    metric: "90% incident reduction in pilots",
    environments: ["loading-docks", "warehouse-lanes"],
  },
  {
    slug: "lane-clearance-monitoring",
    title: "Lane Clearance Monitoring",
    focus: "AMR readiness",
    cadence: "Continuous",
    summary:
      "Ensure high-traffic warehouse lanes stay within clearance tolerances for autonomous fleets.",
    coverage: [
      "Detect protrusions into AMR lanes",
      "Alert on pallet overhang and tote stack height",
      "Log timestamped exceptions for retraining",
    ],
    metric: "Keeps 1.8m clearance 99% of shift",
    environments: ["warehouse-lanes", "utility-rooms"],
  },
  {
    slug: "lab-protocol-audit",
    title: "Lab Protocol Audit",
    focus: "Compliance",
    cadence: "Run start",
    summary:
      "Verify bench readiness, sample custody, and enclosure interlocks before lab automation kicks off.",
    coverage: [
      "Checklist for PPE storage and eyewash access",
      "Sample ID validation via label scans",
      "Enclosure door and sensor interlock tests",
    ],
    metric: "Automates 18-point GLP checklist",
    environments: ["labs"],
  },
  {
    slug: "office-service-routes",
    title: "Office Service Routes",
    focus: "Hospitality",
    cadence: "Daily",
    summary:
      "Guide service robots through office pods and pantries to restock amenities and reset collaboration rooms.",
    coverage: [
      "Prioritized loop for pantry restock and waste pickup",
      "Door, drawer, and switch manipulation prompts",
      "End-of-route report with consumable counts",
    ],
    environments: ["office-pods", "utility-rooms"],
  },
  {
    slug: "laundry-assist",
    title: "Laundry Assist Program",
    focus: "Assistive",
    cadence: "On-demand",
    summary:
      "Coordinate washer/dryer cycles, hamper sorting, and folding sequences for in-home service robots.",
    coverage: [
      "Cycle scheduling with detergent prompts",
      "Adaptive hamper sorting by fabric class",
      "Fold stack placement with reach envelopes",
    ],
    metric: "Cuts cycle handling time to 12 min",
    environments: ["home-laundry"],
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
    ctaText: "Book delivery",
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
    ctaText: "Schedule delivery",
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
    summary: "Create high-fidelity assets with watertight topology and clean UVs for SimReady delivery.",
    description:
      "You will translate capture outputs and kitbashed assets into polished simulation-ready geometry. Expect to iterate with our robotics specialists on articulation coverage, pivots, and collider tuning.",
    applyEmail: "apply+artist@tryblueprint.io",
  },
  {
    title: "Technical Artist (Simulation)",
    type: "Contract",
    location: "Remote",
    summary:
      "Author scene stages, tune joints, and validate physics so labs can drop environments straight into their simulator.",
    description:
      "Work across DCC tools and our internal pipeline to ensure every scene ships with precise limits, semantic schemas, and test harnesses. Bonus points for experience automating annotation exports.",
    applyEmail: "apply+techartist@tryblueprint.io",
  },
  {
    title: "USD Tools Engineer",
    type: "Full-time",
    location: "Durham, NC or Remote",
    summary: "Build the authoring tools that automate SimReady finishing across our environment network.",
    description:
      "Design and ship USD pipelines that enforce our SimReady spec, from collider validation to articulation presets. You'll collaborate with artists and robotics teams to accelerate delivery.",
    applyEmail: "apply+usd@tryblueprint.io",
  },
];
