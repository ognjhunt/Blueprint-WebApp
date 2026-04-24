import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";

export type PublicProofStory = {
  id: string;
  label: string;
  locationName: string;
  locationType: string;
  city: string;
  captureMode: string;
  captureAppCue: string;
  buyerPersona: string;
  buyerRole: string;
  robotQuestion: string;
  evidenceOpened: string[];
  decisionNote: string;
  guardrails: string[];
  image: string;
};

export type HostedRunRow = {
  run: string;
  scenario: string;
  observation: string;
  output: string;
};

export const mediaRoomSampleEvaluation = {
  siteId: "siteworld-f5fd54898cfb",
  packetId: "BP-MEDIA-ROOM-SAMPLE-EVAL-0426",
  siteName: "Media Room Demo Walkthrough",
  siteCode: "SW-DEMO-01",
  siteType: "Captured indoor media and mechanical-room route",
  location: "Blueprint hosted runtime demo",
  captureBasis: "Blueprint demo capture with example buyer deliverables",
  robotSetup: "Mobile manipulator with head and wrist cameras",
  workflowLane: "Media room entry, rack approach, cabinet inspection, and exit route",
  buyerQuestion:
    "Can the team inspect one exact indoor route, its constraints, and its hosted-review output shape before committing field time or custom simulation work?",
  disclosure:
    "Example evaluation. The site, route, and interface are Blueprint demo material; real customer exports use approved site-specific proof and rights review.",
  artifacts: [
    "Capture manifest with site id, scene id, capture id, route notes, and freshness state",
    "Rights sheet with demo-use boundary, sharing limits, and export review notes",
    "Hosted setup with robot profile, task, scenario, requested outputs, and run notes",
    "Run evidence table with observation frames, route replay notes, and next-step recommendation",
    "Export bundle tree showing package, hosted report, and buyer review files",
  ],
  truthBoundaries: [
    "Not a deployment guarantee",
    "Example, not a customer result",
    "Export approval is request-scoped",
    "Runtime access remains request-gated unless a live workspace is available",
  ],
};

export const publicCaptureProofStories: PublicProofStory[] = [
  {
    id: "cedar-market-aisle-loop",
    label: "Example public capture",
    locationName: "Cedar Market Aisle Loop",
    locationType: "Grocery store public aisles",
    city: "Austin, TX",
    captureMode: "Public-facing route from common customer areas",
    captureAppCue: "$40 review cue, 25 minute walkthrough",
    buyerPersona: "Maya Ortiz",
    buyerRole: "Robotics deployment lead",
    robotQuestion:
      "Can a shelf-scanning AMR navigate produce, endcaps, and refrigeration lanes without treating this as a generic warehouse aisle?",
    evidenceOpened: [
      "Aisle route filmstrip with entry, endcap, refrigeration, and checkout-avoidance frames",
      "Capture manifest showing public-facing route, timestamp, device metadata, and redaction state",
      "Hosted report with route notes, occlusion risks, and export scope",
    ],
    decisionNote:
      "A robotics team can use this to decide whether a grocery-specific hosted review is worth scoping before field work.",
    guardrails: [
      "Avoid checkout lanes, pharmacy counters, screens, receipts, and identifiable shoppers",
      "Stop capture if staff objects or signage restricts photography",
      "Use common aisles only; no stockrooms or employee-only doors",
    ],
    image: publicCaptureGeneratedAssets.cedarMarketAisleLoop,
  },
  {
    id: "harbor-mall-common-corridor",
    label: "Example public capture",
    locationName: "Harbor Mall Common Corridor",
    locationType: "Shopping mall common areas",
    city: "Sacramento, CA",
    captureMode: "Public common-area loop",
    captureAppCue: "$45 review cue, 30 minute walkthrough",
    buyerPersona: "Evan Cho",
    buyerRole: "Autonomy product manager",
    robotQuestion:
      "Is the corridor geometry useful for cleaning, patrol, or wayfinding robots before anyone builds a custom sim scene?",
    evidenceOpened: [
      "Corridor geometry preview with entrance, kiosk, elevator-bank, and seating-zone frames",
      "Rights sheet showing public-common-area limits and store-entry exclusions",
      "Export bundle tree with route notes, raw walkthrough pointer, and review memo",
    ],
    decisionNote:
      "A buyer can keep the corridor in review while leaving storefront interiors out of scope until each store gives permission.",
    guardrails: [
      "Capture common corridors only",
      "Do not record inside individual stores without store permission",
      "Avoid faces, children, security desks, and camera placements",
    ],
    image: publicCaptureGeneratedAssets.harborMallCommonCorridor,
  },
  {
    id: "northline-hotel-lobby-loop",
    label: "Example public capture",
    locationName: "Northline Hotel Lobby Loop",
    locationType: "Hotel lobby and public common areas",
    city: "Durham, NC",
    captureMode: "Lobby and public circulation path",
    captureAppCue: "$80 review cue, 40 minute walkthrough",
    buyerPersona: "Priya Raman",
    buyerRole: "Robot delivery partnerships",
    robotQuestion:
      "Can a delivery robot reason about lobby approach, elevator threshold, and concierge-adjacent handoff areas without entering private guest zones?",
    evidenceOpened: [
      "Lobby filmstrip with entrance, seating, elevator approach, and front-desk avoidance notes",
      "Redaction summary for people, screens, and guest-facing paperwork",
      "Hosted review report with next-step recommendation and not-a-deployment-guarantee boundary",
    ],
    decisionNote:
      "The route gives the robot team enough context to ask the hotel operator for scoped access before any private-floor capture.",
    guardrails: [
      "Do not capture guest room hallways or rooms",
      "Avoid front desk screens and guest paperwork",
      "Keep the route in public lobby and common areas",
    ],
    image: publicCaptureGeneratedAssets.northlineHotelLobbyLoop,
  },
  {
    id: "atlas-retail-service-aisle",
    label: "Example public capture",
    locationName: "Atlas Retail Service Aisle",
    locationType: "Retail store public aisles",
    city: "San Jose, CA",
    captureMode: "Public sales-floor route",
    captureAppCue: "$40 review cue, 25 minute walkthrough",
    buyerPersona: "Noah Stein",
    buyerRole: "Field robotics founder",
    robotQuestion:
      "Does the real retail floor have enough aisle width, signage variation, and obstacle variety to justify a hosted policy comparison?",
    evidenceOpened: [
      "Sales-floor stills with aisle, display, service-counter exclusion, and route transition notes",
      "Manifest preview with capture basis, freshness state, and buyer-visible restrictions",
      "Sample export tree with run summary, observation frames, and route replay placeholders",
    ],
    decisionNote:
      "The robot team can start with hosted review while export rights stay gated until the listing-specific review is done.",
    guardrails: [
      "Do not capture payment terminals, service-desk screens, or employee-only spaces",
      "Avoid identifiable shoppers and staff",
      "Stay on customer-accessible sales-floor routes",
    ],
    image: publicCaptureGeneratedAssets.atlasRetailServiceAisle,
  },
];

export const proofEvidencePacket = {
  packetId: "BP-SAMPLE-PROOF-PACKET-0426",
  disclosure:
    "The names are examples. Customer claims appear only when approved proof is available.",
  headline: "Public capture can start with everyday places.",
  summary:
    "See the route, manifest, rights notes, hosted run notes, export tree, and the next decision a robot team can make.",
  selectedStory: publicCaptureProofStories[0],
};

export const sampleHostedRunRows: HostedRunRow[] = [
  {
    run: "Run 01",
    scenario: "Baseline aisle navigation",
    observation: "Route is readable through endcap and mid-aisle transitions.",
    output: "Keep lane in hosted review",
  },
  {
    run: "Run 02",
    scenario: "Busy public aisle",
    observation: "People and carts create occlusion risk; privacy redaction remains required.",
    output: "Review only, no raw public export",
  },
  {
    run: "Run 03",
    scenario: "Refrigeration approach",
    observation: "Lighting and reflective glass need a dedicated perception note.",
    output: "Add capture note to manifest",
  },
  {
    run: "Run 04",
    scenario: "Checkout-adjacent exclusion",
    observation: "Route should stop before payment and identifiable-customer zones.",
    output: "Restricted zone attached",
  },
];

export const sampleProofTimeline = [
  {
    label: "Capture app",
    detail: "Capturer records a lawful public-facing route from common areas.",
  },
  {
    label: "Raw bundle",
    detail: "Walkthrough video, timestamps, poses, device metadata, and capture context are preserved.",
  },
  {
    label: "Review",
    detail: "Blueprint checks coverage, privacy, restrictions, and whether the site is useful for robot teams.",
  },
  {
    label: "Buyer proof",
    detail: "Manifest, rights sheet, hosted report, and export bundle shape become readable before commercial access.",
  },
];

export const sampleExportTree = [
  "manifest/site_package_manifest.json",
  "rights/sample_rights_sheet.md",
  "media/redacted_walkthrough_reference.mp4",
  "routes/public_aisle_loop_waypoints.json",
  "hosted/runs/run_01_observations.json",
  "hosted/reports/sample_hosted_review_report.md",
  "exports/buyer_review_bundle.zip",
];

export const publicCaptureLocationTypes = [
  {
    label: "Grocery aisles",
    detail: "Shelf scanning, inventory AMR navigation, stock-audit routes.",
  },
  {
    label: "Retail sales floors",
    detail: "Planogram, signage, display, and service-area navigation evidence.",
  },
  {
    label: "Mall common corridors",
    detail: "Cleaning, patrol, wayfinding, and large public circulation paths.",
  },
  {
    label: "Hotel lobbies",
    detail: "Delivery, handoff, concierge-adjacent, and elevator-approach review.",
  },
  {
    label: "Museums and venues",
    detail: "Tour, guide, wayfinding, and exhibit-hall navigation where capture is allowed.",
  },
  {
    label: "Office lobbies",
    detail: "Visitor check-in, delivery dropoff, and reception-area route evidence.",
  },
];

export function pickProofStoryForSite(siteId: string): PublicProofStory {
  const normalized = String(siteId || "");
  const total = publicCaptureProofStories.length;
  const index = [...normalized].reduce((sum, character) => sum + character.charCodeAt(0), 0) % total;
  return publicCaptureProofStories[index] || publicCaptureProofStories[0];
}
