export type SimplePricingOption = {
  id: "capture" | "world-models" | "simulation" | "site-operator";
  step: string;
  name: string;
  internalName: string;
  price: string;
  unit: string;
  payer: string;
  summary: string;
  includes: string[];
};

export const simplePricingOptions: SimplePricingOption[] = [
  {
    id: "capture",
    step: "Supply side",
    name: "Capture & Earn",
    internalName: "Capturer",
    price: "Free",
    unit: "you get paid per capture",
    payer: "Capturers (phone-first; smart glasses only when approved)",
    summary:
      "Apply for approved capture assignments. No cost to join; assignment cards show payout before work starts.",
    includes: [
      "Apply free; city, invite, and assignment gates still apply",
      "Assignment payout shown before you start",
      "Accepted captures become payout-eligible after review",
      "Phone-first capture; smart glasses only for approved repeat walkthroughs",
      "Referral or bonus programs require separate approval",
    ],
  },
  {
    id: "world-models",
    step: "Start here",
    name: "Site Data Package",
    internalName: "World Model + Scenario Data",
    price: "$3,500+",
    unit: "per site package",
    payer: "Robot team / OEM / integrator",
    summary: "Buy the capture-backed site package, scenario metadata, and export scope for one real indoor site.",
    includes: [
      "Site-specific spatial data from real capture",
      "Site package tied to one exact site and workflow",
      "Task and scenario metadata for evaluation, post-training, or regression work",
      "Exports, proof notes, rights posture, and stated limitations for that site",
    ],
  },
  {
    id: "simulation",
    step: "Evaluation set",
    name: "Policy Evaluation Set",
    internalName: "Full Site Policy Evaluation",
    price: "$6,500",
    unit: "per Policy Evaluation Run",
    payer: "Robot team / OEM / integrator",
    summary:
      "Evaluate one robot policy/profile on one real site against one scoped task pack.",
    includes: [
      "Unit: 1 site, 1 robot policy/profile, 1 task pack",
      "Up to 500 scenarios/episodes",
      "Pass/fail metrics, cycle time, intervention and failure notes",
      "Scenario/results manifest and availability confirmed per request before evaluation starts",
    ],
  },
  {
    id: "site-operator",
    step: "Operator side",
    name: "Site Operators",
    internalName: "Participation",
    price: "Free",
    unit: "submit and govern sites",
    payer: "Site operator / facility owner",
    summary: "Submit a facility, define access boundaries, and review buyer-use posture without paying Blueprint.",
    includes: [
      "Submit or claim a real facility",
      "Define access windows, privacy boundaries, and restricted areas",
      "Review commercialization posture before robot-team use",
      "No paid plan required for operator participation",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "capture") return "capturer-signup";
  if (id === "site-operator") return "site-review";
  if (id === "simulation") return "hosted-evaluation";
  return "world-models";
}
