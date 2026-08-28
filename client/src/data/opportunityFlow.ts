/**
 * The gated RFP flow, as data.
 *
 * The disclosure rule the whole product turns on, in one line:
 *
 *   Robot teams are publicly discoverable. Their participation in any one
 *   opportunity is private. Sites are de-identified until award. Identity and
 *   contacts unlock only after the winning team pays.
 *
 * That is one-way anonymity, and it is neither a public marketplace nor
 * permanent secrecy. A site will not put its name on a board saying "we are
 * shopping for robots"; a robot team has no reason to hide that it exists. So
 * the asymmetry is deliberate rather than a compromise.
 *
 * Everything here is preview data for a design mock. See
 * `opportunityBoardPreview` for why the labelling on those screens is
 * mandatory.
 */

export const disclosurePolicy = {
  headline: "One-way anonymity",
  rules: [
    {
      id: "teams-public",
      subject: "Robot teams",
      state: "Publicly discoverable",
      detail: "Profile, embodiments, task history and references are open. Credibility is the point.",
    },
    {
      id: "participation-private",
      subject: "Their participation",
      state: "Private",
      detail: "Nobody sees which opportunities a team is evaluating, or that it evaluated and walked away.",
    },
    {
      id: "sites-private",
      subject: "Sites",
      state: "De-identified until award",
      detail: "Industry, region, task and economics are visible. Name, address, contacts, logos and file metadata are not.",
    },
    {
      id: "unlock-on-payment",
      subject: "Identity",
      state: "Unlocks on payment",
      detail: "The winning team gets the name, address, direct contacts, unredacted files and pilot calendar — after the award fee clears.",
    },
  ],
} as const;

/** The five steps, in the language the product uses on screen. */
export const flowSteps = [
  {
    step: "01",
    id: "view",
    label: "View opportunity",
    actor: "Robot team",
    detail:
      "Industry, broad geography, the task, the economics, constraints, expected scale and timing. No name, address, contact or logo.",
    cost: "Free",
  },
  {
    step: "02",
    id: "unlock",
    label: "Unlock deployment package",
    actor: "Robot team",
    detail:
      "Accept the opportunity-specific terms, authorise payment, pay the evaluation fee. The full de-identified package and the simulation environment open.",
    cost: "$1,000",
  },
  {
    step: "03",
    id: "evaluate",
    label: "Run evaluation",
    actor: "Robot team",
    detail:
      "Up to 500 episodes against the captured twin, scored on the listing rubric. Your result is yours; the site sees it only when you submit.",
    cost: "Included",
  },
  {
    step: "04",
    id: "offer",
    label: "Submit deployment offer",
    actor: "Robot team",
    detail:
      "One standard form, the same fields for everyone, so the site compares like with like instead of reading five different sales decks.",
    cost: "Included",
  },
  {
    step: "05",
    id: "award",
    label: "Site compares and awards",
    actor: "Site",
    detail:
      "Offers side by side as Team A, B, C. Names reveal at shortlist. On award the fee is charged and the site's identity unlocks to the winner.",
    cost: "$9,000 more, from the winner",
  },
] as const;

/**
 * What a robot team can see before it pays anything. Two envelopes, because a
 * team needs to know the job is commercially real before it spends evaluation
 * time — not just that it is technically interesting.
 */
export interface TechnicalEnvelope {
  task: string;
  objects: string;
  payloadKg: [number, number];
  reach: string;
  humanCycleSeconds: number;
  movesPerHour: number;
  shifts: number;
  successGate: string;
  environment: string;
  integrations: readonly string[];
  exceptions: string;
}

/**
 * The commercial half. A site states this up front — budget, model, scale,
 * timing — so nobody evaluates an opportunity that was never going to buy.
 * What it does NOT contain is a pre-written robot contract: the robot team
 * proposes the economics, because in 2026 feasibility still determines what a
 * team can economically offer.
 */
export interface CommercialEnvelope {
  budgetApproved: boolean;
  pilotBudget: string;
  preferredModel: "RaaS" | "Purchase" | "Either";
  targetEconomics: string;
  initialScale: string;
  expansionPotential: string;
  targetDeployment: string;
  procurementConstraints: string;
}

export interface AnonymousOpportunity {
  id: string;
  /** Short display name. The full task sentence is far too long for a headline. */
  title: string;
  /** The sanitized teaser. Everything here is safe for the open board. */
  teaser: string;
  industry: string;
  region: string;
  technical: TechnicalEnvelope;
  commercial: CommercialEnvelope;
  /** What is deliberately withheld until award, listed so the rule is visible. */
  withheld: readonly string[];
  proposalsClose: string;
}

export const opportunity: AnonymousOpportunity = {
  id: "ATX-007",
  title: "Tote induct & decant",
  teaser:
    "Austin-area 3PL · tote movement · two shifts · 25 lb payload · potential five-robot deployment",
  industry: "Third-party logistics",
  region: "Central Texas",
  technical: {
    task: "Move totes 60 ft from an inbound conveyor to six flow-rack stations, by lane label. Reverse on decant.",
    objects: "14 rigid SKUs across two tote types",
    payloadKg: [0.2, 11.3],
    reach: "Floor to 1.7 m, six fixed stations",
    humanCycleSeconds: 18,
    movesPerHour: 420,
    shifts: 2,
    successGate: "≥96% first-attempt placement at ≤27s sustained",
    environment: "Sealed concrete, 300–500 lux, no ramps, badge-gated aisle 22:00–06:00",
    integrations: ["WMS lane assignment", "Conveyor PLC handshake", "Site Wi-Fi 6 with robot VLAN"],
    exceptions: "Jammed lids and label misreads run 3.1% of cycles — flagged to a lane, not resolved by the robot",
  },
  commercial: {
    budgetApproved: true,
    pilotBudget: "$0–35K, or vendor-funded",
    preferredModel: "Either",
    targetEconomics: "Under $9,500 per robot per month, or a three-year payback",
    initialScale: "5 robots",
    expansionPotential: "Up to 30 across three sister facilities",
    targetDeployment: "Q1 2027",
    procurementConstraints: "Security review required before network access. No fixed infrastructure changes.",
  },
  withheld: [
    "Operator name and corporate parent",
    "Street address and site contacts",
    "Logos, signage and readable labels in media",
    "File metadata and original capture geotags",
  ],
  proposalsClose: "Sep 18",
};

/** What paying opens. Named for what it is, not for finance jargon. */
export const deploymentPackage = [
  {
    id: "twin",
    label: "Simulation environment",
    detail: "Scan-accurate twin, sim-ready USD and MJCF, collision meshes, articulated conveyor.",
  },
  {
    id: "media",
    label: "Task media",
    detail: "42 minutes of cycle footage and 62 human demonstrations — logos, faces and labels blurred.",
  },
  {
    id: "objects",
    label: "Object library",
    detail: "14 SKUs with dimensions, weights, centre-of-mass notes, tote CADs and grasp-surface photos.",
  },
  {
    id: "conditions",
    label: "Site conditions",
    detail: "Lux grid at both shift boundaries, floor spec and slope, dock access, power drop, network topology.",
  },
  {
    id: "measurements",
    label: "Measured baseline",
    detail: "Median human cycle across 142 timed cycles, throughput across six shifts, exception log.",
  },
  {
    id: "rubric",
    label: "Acceptance rubric",
    detail: "The exact test that scores your evaluation, the on-site week, and the pilot gate.",
  },
] as const;

/** Every access to the package is watermarked and logged. Stated, not implied. */
export const packageControls = [
  "Every file is watermarked to the accessing team",
  "Downloads and views are logged against the opportunity",
  "Licensed for this evaluation only; not transferable",
  "Non-circumvention and opportunity attribution signed before access",
] as const;

/**
 * The standardized offer. Every team answers the same fields, which is what
 * makes a comparison screen possible at all — the alternative is five
 * incomparable sales decks.
 */
export interface OfferField {
  id: string;
  label: string;
  group: "capability" | "plan" | "commercial" | "risk";
  hint?: string;
}

export const offerFields: readonly OfferField[] = [
  { id: "can-do", label: "Can you perform this task today?", group: "capability", hint: "Yes / No / Not yet" },
  { id: "score", label: "Evaluation score", group: "capability", hint: "Out of 100, on the listing rubric" },
  { id: "cycle", label: "Expected cycle time", group: "capability", hint: "Sustained, seconds" },
  { id: "uptime", label: "Expected uptime", group: "capability" },
  { id: "robots", label: "Robots required", group: "plan" },
  { id: "pilot-start", label: "Time to on-site pilot", group: "plan", hint: "Weeks from award" },
  { id: "pilot-length", label: "Pilot length", group: "plan" },
  { id: "who-pays", label: "Who pays whom during the pilot", group: "commercial", hint: "Site pays, vendor-funded, or shared" },
  { id: "price", label: "Commercial deployment price", group: "commercial" },
  { id: "term", label: "Term and model", group: "commercial", hint: "RaaS or purchase, and length" },
  { id: "integration", label: "Integration required", group: "plan" },
  { id: "risk", label: "Main remaining technical risk", group: "risk" },
  { id: "data-rights", label: "Data rights requested", group: "risk" },
  { id: "support", label: "Support plan", group: "risk" },
  { id: "insurance", label: "Insurance and safety status", group: "risk" },
  { id: "references", label: "References", group: "risk" },
];

export interface SubmittedOffer {
  /** Blind label the site sees before shortlisting. */
  blindLabel: string;
  /** Revealed at shortlist. */
  teamName: string;
  embodiment: string;
  canDoToday: "yes" | "not-yet" | "no";
  score: number;
  cycleSeconds: number | null;
  uptimePct: number | null;
  robots: number | null;
  pilotStartWeeks: number | null;
  pilotLengthDays: number | null;
  whoPays: string;
  price: string;
  term: string;
  integration: string;
  risk: string;
  dataRights: string;
  support: string;
  insurance: string;
  references: string;
  shortlisted: boolean;
}

export const submittedOffers: readonly SubmittedOffer[] = [
  {
    blindLabel: "Team A",
    teamName: "Vantage Motion",
    embodiment: "Mobile manipulator",
    canDoToday: "yes",
    score: 94,
    cycleSeconds: 10.5,
    uptimePct: 96,
    robots: 5,
    pilotStartWeeks: 6,
    pilotLengthDays: 90,
    whoPays: "Vendor-funded — Vantage pays the site $20,000",
    price: "$8,000 / robot / month",
    term: "RaaS, 3 years",
    integration: "WMS lane feed + conveyor PLC handshake",
    risk: "Deformable poly bags outside the stated SKU set",
    dataRights: "Task video and episode logs for model improvement; site holds a veto",
    support: "4-hour remote response, next-business-day on site, spares held in Austin",
    insurance: "$5M general liability, ISO 10218 assessment complete",
    references: "Two 3PL deployments, both contactable",
    shortlisted: true,
  },
  {
    blindLabel: "Team B",
    teamName: "Halden Robotics",
    embodiment: "Humanoid",
    canDoToday: "yes",
    score: 88,
    cycleSeconds: 12,
    uptimePct: 94,
    robots: 6,
    pilotStartWeeks: 4,
    pilotLengthDays: 60,
    whoPays: "Site pays $15,000 for the pilot",
    price: "$7,200 / robot / month",
    term: "RaaS, 2 years",
    integration: "WMS lane feed only; no PLC handshake required",
    risk: "Sustained cycle time under two-shift thermal load",
    dataRights: "Full episode logs requested, non-exclusive",
    support: "Business-hours remote, 48-hour on site",
    insurance: "$2M general liability, safety assessment in progress",
    references: "One food-manufacturing pilot",
    shortlisted: true,
  },
  {
    blindLabel: "Team C",
    teamName: "Kestrel Automation",
    embodiment: "Arm on rail",
    canDoToday: "not-yet",
    score: 72,
    cycleSeconds: 9.4,
    uptimePct: null,
    robots: 2,
    pilotStartWeeks: 9,
    pilotLengthDays: 90,
    whoPays: "Site pays $31,000, plus $14,000 rail fixturing",
    price: "$11,200 / robot / month",
    term: "Purchase or RaaS",
    integration: "Requires fixed rail — outside the site's stated constraints",
    risk: "Failed the lane-label edge case; rail install not covered by the listing scope",
    dataRights: "None requested",
    support: "Business-hours remote",
    insurance: "$5M general liability, assessment complete",
    references: "Four machine-tending installs",
    shortlisted: false,
  },
];

/** What the winner receives the moment the award fee clears. */
export const unlockedOnAward = [
  "Operator name, corporate parent and site address",
  "Named contacts with direct lines: operations, IT, safety",
  "Unredacted media and original capture files",
  "The pilot calendar and the site's security-review window",
] as const;

/**
 * Circumvention cannot be eliminated — once people meet, secrecy is over. The
 * defence is a stack, and the last item is the one that actually works.
 */
export const circumventionControls = [
  { id: "anonymity", label: "Site anonymity until award" },
  { id: "terms", label: "Signed non-circumvention and opportunity attribution, both parties" },
  { id: "auth", label: "Payment authorisation before an offer can be submitted" },
  { id: "records", label: "Messaging, offers, scoring and award records held in Blueprint" },
  { id: "watermark", label: "Watermarked packages and access logs" },
  { id: "suspension", label: "Suspension from future opportunities for bypassing" },
  { id: "value", label: "Continuing value: acceptance testing, site updates, deployment records, expansion" },
] as const;

export const circumventionNote =
  "A fixed, legible fee is itself a defence: an open-ended percentage of a confidential contract is what gives both sides a reason to route around the platform in the first place.";
