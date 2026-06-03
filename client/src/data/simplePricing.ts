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
    summary: "Buy the capture-backed world model, scenario data, and export bundle for one real indoor site.",
    includes: [
      "Site-specific spatial data from real capture",
      "World model package tied to one exact site and workflow",
      "Task and scenario data for evaluation, post-training, or fine-tuning",
      "Exports, proof notes, and stated limitations for that site",
    ],
  },
  {
    id: "simulation",
    step: "Evaluation set",
    name: "Policy Evaluation Set",
    internalName: "Full Site Policy Evaluation",
    price: "$6,500",
    unit: "per site-policy evaluation",
    payer: "Robot team / OEM / integrator",
    summary:
      "Evaluate one robot policy/profile across a site's task suite by manual session or headless agent.",
    includes: [
      "One site and one robot policy/profile",
      "Up to 8 task families and 50 episodes per task",
      "Success rate, cycle time, failure notes, and logs",
      "Exports and availability confirmed per request before evaluation starts",
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
