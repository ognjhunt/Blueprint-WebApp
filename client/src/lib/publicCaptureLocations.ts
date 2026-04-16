/**
 * Public-location tier list for the capture app.
 *
 * These are sites where lawful access is `public_non_controlled_site`:
 * the capturer may walk in during business hours and capture without
 * a consent packet, provided they follow the guardrails below.
 *
 * Tier 1 = high-traffic, regular geometry, strong robot-workflow demand signal.
 * Tier 2 = viable but lower demand signal or more complex geometry.
 */

export interface PublicCaptureLocation {
  id: string;
  name: string;
  category: PublicCaptureCategory;
  tier: 1 | 2;
  address: string;
  city: string;
  state: string;
  lawfulAccessMode: "public_non_controlled_site";
  /** What the capturer may capture (public areas only). */
  captureBrief: string;
  /** Robot workflows this site validates. */
  robotWorkflowFit: string[];
  /** Privacy / signage guardrails the capturer must follow. */
  guardrails: string[];
}

export type PublicCaptureCategory =
  | "warehouse_club"
  | "superstore"
  | "grocery"
  | "home_improvement"
  | "shopping_mall"
  | "museum"
  | "hotel"
  | "office_lobby";

export const PUBLIC_CAPTURE_LOCATIONS: PublicCaptureLocation[] = [
  // ── Sacramento (active city launch) ──
  {
    id: "sacramento-costco-natomas",
    name: "Sacramento Costco - Natomas",
    category: "warehouse_club",
    tier: 1,
    address: "3631 Truxel Rd, Sacramento, CA 95834",
    city: "Sacramento",
    state: "CA",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Wide aisles, high ceilings, pallet inventory on floor. Capture aisle geometry, shelf height, and floor markings from public walkways only.",
    robotWorkflowFit: ["inventory_amr_aisle_navigation", "stock_audit"],
    guardrails: [
      "Do not capture checkout lanes with identifiable customers.",
      "Do not capture employee-only areas (back-of-house doors, break rooms).",
      "Avoid capturing point-of-sale screens or payment terminals.",
    ],
  },
  {
    id: "sacramento-walmart-natomas",
    name: "Walmart Supercenter - Natomas",
    category: "superstore",
    tier: 1,
    address: "8270 Delta Shores Cir S, Sacramento, CA 95832",
    city: "Sacramento",
    state: "CA",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Large big-box retail with wide aisles, grocery section. Capture aisle geometry and shelf layout from public walkways only.",
    robotWorkflowFit: ["inventory_amr_aisle_navigation", "stock_audit", "shelf_scanning"],
    guardrails: [
      "Do not capture pharmacy counter or health clinic areas.",
      "Do not capture checkout lanes with identifiable customers.",
      "Avoid employee-only back-of-house doors.",
    ],
  },
  {
    id: "sacramento-safeway-alhambra",
    name: "Safeway - Alhambra Blvd",
    category: "grocery",
    tier: 1,
    address: "2770 Alhambra Blvd, Sacramento, CA 95816",
    city: "Sacramento",
    state: "CA",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Standard grocery store with shelf aisles, good lighting, regular geometry. Capture aisle layout and shelf structure from public walkways.",
    robotWorkflowFit: ["shelf_scanning", "stock_audit", "aisle_navigation"],
    guardrails: [
      "Do not capture checkout lanes with identifiable customers.",
      "Do not capture pharmacy counter.",
      "Avoid capturing product labels with customer PII (receipts, loyalty cards).",
    ],
  },
  {
    id: "sacramento-homedepot-calexpo",
    name: "Home Depot - Sacramento (Cal Expo)",
    category: "home_improvement",
    tier: 1,
    address: "4330 Stockton Blvd, Sacramento, CA 95820",
    city: "Sacramento",
    state: "CA",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Large home improvement store with wide aisles, forklift traffic zones, pallet racking. Capture aisle geometry and racking structure from public walkways.",
    robotWorkflowFit: ["forklift_robot_co_navigation", "pallet_movement", "inventory"],
    guardrails: [
      "Do not capture Pro Desk or tool rental counter with identifiable customers.",
      "Stay clear of active forklift zones — safety first.",
      "Avoid capturing contractor license plates in parking lot.",
    ],
  },
  {
    id: "sacramento-ardenfair-mall",
    name: "Arden Fair Mall - Common Areas",
    category: "shopping_mall",
    tier: 2,
    address: "1689 Arden Way, Sacramento, CA 95815",
    city: "Sacramento",
    state: "CA",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Regional shopping mall common areas with wide corridors, good lighting. Capture corridor geometry and floor layout from public walkways only.",
    robotWorkflowFit: ["cleaning_robot_patrol", "monitoring_robot_floor_patrol", "wayfinding"],
    guardrails: [
      "Do not capture inside individual retail stores without store permission.",
      "Do not capture identifiable shoppers (faces, children).",
      "Avoid capturing security camera placements.",
    ],
  },

  // ── Austin (reference city) ──
  {
    id: "austin-costco-south",
    name: "Costco - South Austin",
    category: "warehouse_club",
    tier: 1,
    address: "9191 S IH 35, Austin, TX 78748",
    city: "Austin",
    state: "TX",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Wide aisles, high ceilings, pallet inventory on floor. Capture aisle geometry from public walkways.",
    robotWorkflowFit: ["inventory_amr_aisle_navigation", "stock_audit"],
    guardrails: [
      "Do not capture checkout lanes with identifiable customers.",
      "Do not capture employee-only areas.",
      "Avoid capturing point-of-sale screens.",
    ],
  },
  {
    id: "austin-homedepot-brodie",
    name: "Home Depot - Brodie Ln",
    category: "home_improvement",
    tier: 1,
    address: "11200 Brodie Ln, Austin, TX 78748",
    city: "Austin",
    state: "TX",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Large home improvement store with wide aisles, forklift zones. Capture aisle geometry from public walkways.",
    robotWorkflowFit: ["forklift_robot_co_navigation", "pallet_movement"],
    guardrails: [
      "Stay clear of active forklift zones.",
      "Do not capture Pro Desk with identifiable customers.",
    ],
  },
  {
    id: "austin-hes-south-lamar",
    name: "HEB - South Lamar",
    category: "grocery",
    tier: 1,
    address: "6801 S Lamar Blvd, Austin, TX 78745",
    city: "Austin",
    state: "TX",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Large Texas grocery store with wide aisles, good lighting. Capture aisle layout from public walkways.",
    robotWorkflowFit: ["shelf_scanning", "stock_audit", "aisle_navigation"],
    guardrails: [
      "Do not capture checkout lanes with identifiable customers.",
      "Do not capture pharmacy counter.",
    ],
  },

  // ── Durham (reference city) ──
  {
    id: "durham-costco-raleigh-rd",
    name: "Costco - Raleigh Rd",
    category: "warehouse_club",
    tier: 1,
    address: "1515 Raleigh Rd, Durham, NC 27707",
    city: "Durham",
    state: "NC",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Wide aisles, high ceilings, pallet inventory on floor. Capture aisle geometry from public walkways.",
    robotWorkflowFit: ["inventory_amr_aisle_navigation", "stock_audit"],
    guardrails: [
      "Do not capture checkout lanes with identifiable customers.",
      "Do not capture employee-only areas.",
    ],
  },
  {
    id: "durham-homedepot-chapel-hill",
    name: "Home Depot - Chapel Hill Blvd",
    category: "home_improvement",
    tier: 1,
    address: "4600 Chapel Hill Blvd, Durham, NC 27707",
    city: "Durham",
    state: "NC",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Large home improvement store with wide aisles. Capture aisle geometry from public walkways.",
    robotWorkflowFit: ["forklift_robot_co_navigation", "pallet_movement"],
    guardrails: [
      "Stay clear of active forklift zones.",
      "Do not capture Pro Desk with identifiable customers.",
    ],
  },

  // ── Generic / template entries for future cities ──
  {
    id: "template-museum",
    name: "Museum (Common Areas)",
    category: "museum",
    tier: 2,
    address: "",
    city: "",
    state: "",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Museum common areas with exhibit halls, corridors, good lighting. Capture corridor geometry from public walkways only.",
    robotWorkflowFit: ["wayfinding", "tour_guide_robot_navigation"],
    guardrails: [
      "Do not capture artwork that may have copyright restrictions.",
      "Do not capture identifiable visitors (faces, children).",
      "Check for photography restriction signs before capturing.",
    ],
  },
  {
    id: "template-hotel-lobby",
    name: "Hotel (Lobby & Common Areas)",
    category: "hotel",
    tier: 2,
    address: "",
    city: "",
    state: "",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Hotel lobby and common areas with corridors, good lighting. Capture lobby geometry from public spaces only.",
    robotWorkflowFit: ["wayfinding", "delivery_robot_navigation"],
    guardrails: [
      "Do not capture guest room hallways (private areas).",
      "Do not capture identifiable guests or staff.",
      "Avoid capturing front desk screens with guest PII.",
    ],
  },
  {
    id: "template-office-lobby",
    name: "Office Building (Lobby Only)",
    category: "office_lobby",
    tier: 2,
    address: "",
    city: "",
    state: "",
    lawfulAccessMode: "public_non_controlled_site",
    captureBrief:
      "Office building lobby and reception area. Capture lobby geometry from public reception area only.",
    robotWorkflowFit: ["delivery_robot_navigation", "visitor_checkin"],
    guardrails: [
      "Do not capture beyond the lobby / reception area (private offices).",
      "Do not capture security badge readers or screens with PII.",
      "Avoid capturing identifiable employees or visitors.",
    ],
  },
];

/**
 * Get locations filtered by city.
 */
export function getPublicCaptureLocationsByCity(
  city: string,
  state?: string,
): PublicCaptureLocation[] {
  return PUBLIC_CAPTURE_LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase() === city.toLowerCase()
      && (!state || loc.state.toLowerCase() === state.toLowerCase()),
  );
}

/**
 * Get locations filtered by tier.
 */
export function getPublicCaptureLocationsByTier(tier: 1 | 2): PublicCaptureLocation[] {
  return PUBLIC_CAPTURE_LOCATIONS.filter((loc) => loc.tier === tier);
}

/**
 * Get locations filtered by category.
 */
export function getPublicCaptureLocationsByCategory(
  category: PublicCaptureCategory,
): PublicCaptureLocation[] {
  return PUBLIC_CAPTURE_LOCATIONS.filter((loc) => loc.category === category);
}

/**
 * Get unique categories present in the location list.
 */
export function getPublicCaptureCategories(): PublicCaptureCategory[] {
  const seen = new Set<PublicCaptureCategory>();
  for (const loc of PUBLIC_CAPTURE_LOCATIONS) {
    seen.add(loc.category);
  }
  return [...seen];
}
