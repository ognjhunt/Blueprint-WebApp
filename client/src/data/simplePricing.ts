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
    step: "Policy lift",
    name: "Policy Improvement Run",
    internalName: "Sim-only Policy Improvement",
    price: "$35,000",
    unit: "per sim-only run",
    payer: "Robot team / OEM / integrator",
    summary: "Improve a customer-supplied policy, adapter, task head, distilled skill, or complete policy inside simulation.",
    includes: [
      "Baseline evaluation and dominant failure-mode diagnosis",
      "Twin and cousin scenarios plus curriculum",
      "Candidate policy improvement and sealed scenario test",
      "Improved artifact, export format, and evidence report",
    ],
  },
  {
    id: "simulation",
    step: "Evaluation run",
    name: "Task Evaluation Run",
    internalName: "Real-Site Task Evaluation",
    price: "$6,500",
    unit: "per run",
    payer: "Robot team / OEM / integrator",
    summary:
      "Evaluate one robot policy/profile on one real site against one scoped Task Pack.",
    includes: [
      "Unit: 1 site, 1 robot policy/profile, 1 Task Pack",
      "Up to 500 scenarios",
      "Pass/fail results, cycle-time results, intervention and failure notes",
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
  return "world-model";
}
